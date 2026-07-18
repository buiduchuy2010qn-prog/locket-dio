/**
 * Account draft sync — IndexedDB offline queue → Railway API.
 * Sequential uploads; never auto-posts moments.
 */
import { instanceMain } from "@/libs";
import momentDraftDB from "@/cache/momentDraftDB";
import {
  SYNC_STATUS,
  listDraftsMeta,
  getDraftFull,
  resolveDraftUid,
  getDeviceId,
  updateDraftMeta,
} from "./draftLibrary";

const MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 2500;

let syncRunning = false;
let pullRunning = false;

function authOk() {
  return Boolean(resolveDraftUid());
}

async function listPendingLocal(ownerUid) {
  // Read raw IDB (listDraftsMeta ẩn pending_delete — vẫn cần push xóa cloud)
  let all = [];
  try {
    all = await momentDraftDB.drafts
      .where("ownerUid")
      .equals(String(ownerUid))
      .toArray();
  } catch {
    all = await listDraftsMeta(ownerUid);
  }
  return all.filter(
    (d) =>
      d.syncStatus === SYNC_STATUS.PENDING_SYNC ||
      d.syncStatus === SYNC_STATUS.SYNC_FAILED ||
      d.syncStatus === SYNC_STATUS.PENDING_DELETE ||
      !d.syncStatus,
  );
}

async function putMeta(draft) {
  const body = {
    id: draft.id,
    baseRevision: draft.cloudRevision ?? draft.baseRevision ?? null,
    mediaType: draft.mediaType,
    caption: draft.caption,
    captionStyle: draft.captionStyle,
    music: draft.music,
    overlays: draft.overlays,
    audience: draft.audience,
    selectedFriendIds: draft.selectedFriendIds,
    optionsData: draft.optionsData,
    status: draft.status,
    mimeType: draft.mimeType,
    fileName: draft.fileName,
    width: draft.width,
    height: draft.height,
    duration: draft.duration,
    createdAt: draft.createdAt,
    sourceDeviceId: draft.sourceDeviceId || getDeviceId(),
  };
  const res = await instanceMain.put(`/api/drafts/${encodeURIComponent(draft.id)}`, body, {
    timeout: 60000,
  });
  return res?.data;
}

async function uploadRole(draftId, role, blob, mime) {
  if (!blob) return null;
  const buf = await blob.arrayBuffer();
  const res = await instanceMain.put(
    `/api/drafts/${encodeURIComponent(draftId)}/media/${role}`,
    buf,
    {
      headers: {
        "Content-Type": mime || blob.type || "application/octet-stream",
      },
      timeout: 180000,
      transformRequest: [(d) => d],
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    },
  );
  return res?.data;
}

function ownerUidHash(uid) {
  // Short non-reversible-ish label for console (not crypto secret)
  const s = String(uid || "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return `u${h.toString(16).slice(0, 8)}`;
}

async function syncOneDraft(draft) {
  const id = draft.id;
  const ownerUid = draft.ownerUid;
  await updateDraftMeta(id, {
    syncStatus: SYNC_STATUS.SYNCING,
    lastSyncError: null,
  });

  if (draft.syncStatus === SYNC_STATUS.PENDING_DELETE) {
    await instanceMain.delete(`/api/drafts/${encodeURIComponent(id)}`, {
      timeout: 30000,
    });
    await momentDraftDB.drafts.delete(id);
    await momentDraftDB.draftBlobs.delete(id);
    return { ok: true, deleted: true };
  }

  const full = await getDraftFull(id);
  if (!full?.meta) throw new Error("missing local draft");

  // 1) metadata upsert (idempotent)
  let metaRes;
  try {
    metaRes = await putMeta(full.meta);
  } catch (e) {
    if (e?.response?.status === 409) {
      await updateDraftMeta(id, {
        syncStatus: SYNC_STATUS.CONFLICT,
        lastSyncError: "Xung đột phiên bản trên thiết bị khác",
        cloudRevision: e.response.data?.serverDraft?.revision,
      });
      return { ok: false, conflict: true, serverDraft: e.response.data?.serverDraft };
    }
    throw e;
  }

  // 2) media — must complete before "synced" (not meta-only / not IDB-only)
  const media = full.media;
  if (!media?.blob) {
    throw new Error("Thiếu media local — không đánh dấu đã đồng bộ");
  }
  const mime = media?.mimeType || full.meta.mimeType || "application/octet-stream";

  const activeUp = await uploadRole(id, "active", media.blob, mime);
  if (!activeUp?.success && !activeUp?.key) {
    throw new Error("Upload active media thất bại");
  }

  // original: prefer separate original; else mirror active so other devices can open
  const originalBlob = media.originalMediaBlob || media.blob;
  const originalUp = await uploadRole(
    id,
    "original",
    originalBlob,
    media.originalMediaBlob?.type || mime,
  );
  if (!originalUp?.success && !originalUp?.key) {
    throw new Error("Upload original media thất bại");
  }

  if (media.thumbnailBlob) {
    const thumbUp = await uploadRole(
      id,
      "thumbnail",
      media.thumbnailBlob,
      media.thumbnailBlob.type || "image/jpeg",
    );
    if (!thumbUp?.success && !thumbUp?.key) {
      throw new Error("Upload thumbnail thất bại");
    }
  } else {
    throw new Error("Thiếu thumbnail — không đánh dấu đã đồng bộ");
  }

  // 3) Confirm server has metadata + object keys (never trust local write alone)
  const verify = await instanceMain.get(
    `/api/drafts/${encodeURIComponent(id)}`,
    { timeout: 60000 },
  );
  const cloud = verify?.data?.draft || metaRes?.draft || {};
  if (!cloud?.id) {
    throw new Error("Server không trả draft sau upload");
  }
  if (!cloud.activeObjectKey && !cloud.originalObjectKey) {
    throw new Error("Server chưa có file media");
  }
  if (!cloud.thumbnailObjectKey) {
    throw new Error("Server chưa có thumbnail");
  }
  if (cloud.revision == null) {
    throw new Error("Server không trả revision hợp lệ");
  }

  await updateDraftMeta(id, {
    syncStatus: SYNC_STATUS.SYNCED,
    lastSyncError: null,
    cloudRevision: cloud.revision,
    baseRevision: cloud.revision,
    mediaUrls: cloud.mediaUrls || full.meta.mediaUrls || null,
  });
  const safeLog = {
    draftId: id,
    ownerUidHash: ownerUidHash(ownerUid),
    revision: cloud.revision,
    syncStatus: SYNC_STATUS.SYNCED,
    metadataUploaded: true,
    originalUploaded: true,
    thumbnailUploaded: true,
    serverStatus: "ok",
  };
  // Safe diagnostics only — no token, no media, no full signed URL
  console.info("[draft-sync]", safeLog);
  return { ok: true, ownerUid, ...safeLog };
}

/**
 * Push local pending drafts to cloud (sequential).
 */
export async function pushPendingDrafts({ onProgress } = {}) {
  if (syncRunning || !authOk()) return { ok: false, reason: "busy_or_auth" };
  syncRunning = true;
  const ownerUid = resolveDraftUid();
  const results = [];
  try {
    const pending = await listPendingLocal(ownerUid);
    let attemptById = {};
    for (const d of pending) {
      let attempts = 0;
      let done = false;
      while (attempts < MAX_RETRIES && !done) {
        attempts += 1;
        try {
          onProgress?.({ phase: "push", draftId: d.id, attempts });
          const r = await syncOneDraft(d);
          results.push({ id: d.id, ...r });
          done = true;
        } catch (e) {
          const msg =
            e?.response?.data?.message || e?.message || "sync failed";
          await updateDraftMeta(d.id, {
            syncStatus: SYNC_STATUS.SYNC_FAILED,
            lastSyncError: msg,
          });
          if (attempts >= MAX_RETRIES) {
            results.push({ id: d.id, ok: false, error: msg });
            done = true;
          } else {
            await new Promise((r) =>
              setTimeout(r, BASE_BACKOFF_MS * attempts),
            );
          }
        }
      }
      attemptById[d.id] = attempts;
    }
    return { ok: true, results, attemptById };
  } finally {
    syncRunning = false;
  }
}

/**
 * Download draft media role with Bearer auth.
 * Prefer authenticated API path (no signed URL expiry) so PC/phone always work.
 * Fallback: signed mediaUrls if absolute path fails.
 */
function isUsableMediaBlob(blob) {
  return (
    blob instanceof Blob &&
    blob.size > 0 &&
    !(blob.type && String(blob.type).includes("application/json"))
  );
}

async function downloadDraftRoleBlob(draftId, role, mediaUrls) {
  // 1) Authenticated API path — works after signed URL expires (15m)
  const path = `/api/drafts/${encodeURIComponent(draftId)}/media/${encodeURIComponent(role)}`;
  try {
    const res = await instanceMain.get(path, {
      responseType: "blob",
      timeout: 180000,
    });
    if (isUsableMediaBlob(res?.data)) return res.data;
  } catch {
    /* try signed URLs */
  }

  // 2) Signed URLs from list/get (prefer same-origin proxy)
  const entry = mediaUrls?.[role];
  const candidates = [entry?.proxyUrl, entry?.url].filter(Boolean);
  for (const url of candidates) {
    try {
      let res;
      if (String(url).startsWith("http")) {
        // Full absolute host — do not prepend /dio-api
        res = await instanceMain.get(url, {
          responseType: "blob",
          timeout: 180000,
          baseURL: "",
        });
      } else {
        res = await instanceMain.get(url, {
          responseType: "blob",
          timeout: 180000,
        });
      }
      if (isUsableMediaBlob(res?.data)) return res.data;
    } catch {
      /* try next */
    }
  }
  return null;
}

async function refreshDraftMediaUrls(draftId) {
  try {
    const res = await instanceMain.get(
      `/api/drafts/${encodeURIComponent(draftId)}`,
      { timeout: 60000 },
    );
    const cloud = res?.data?.draft;
    if (cloud?.mediaUrls) {
      await updateDraftMeta(draftId, { mediaUrls: cloud.mediaUrls });
      return cloud.mediaUrls;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Pull cloud metadata (+ optional thumb) and merge into IndexedDB.
 * Does not download full media until user opens draft.
 */
export async function pullCloudDrafts({ onProgress } = {}) {
  if (pullRunning || !authOk()) return { ok: false, reason: "busy_or_auth" };
  pullRunning = true;
  const ownerUid = resolveDraftUid();
  try {
    onProgress?.({ phase: "pull" });
    const res = await instanceMain.get("/api/drafts", { timeout: 60000 });
    const remote = res?.data?.drafts || [];
    for (const cloud of remote) {
      if (!cloud?.id) continue;
      const local = await momentDraftDB.drafts.get(cloud.id);
      if (!local) {
        // Shell meta only — media on demand
        await momentDraftDB.drafts.put({
          id: cloud.id,
          ownerUid,
          schemaVersion: cloud.schemaVersion || 4,
          revision: cloud.revision || 1,
          cloudRevision: cloud.revision || 1,
          baseRevision: cloud.revision || 1,
          createdAt: cloud.createdAt || Date.now(),
          updatedAt: cloud.updatedAt || Date.now(),
          mediaType: cloud.mediaType || "image",
          caption: cloud.caption || "",
          captionStyle: cloud.captionStyle || null,
          music: cloud.music || null,
          overlays: cloud.overlays || null,
          audience: cloud.audience || "all",
          selectedFriendIds: cloud.selectedFriendIds || [],
          optionsData: cloud.optionsData || {},
          status: cloud.status || "ready",
          mimeType: cloud.mimeType || "",
          fileName: cloud.fileName || "",
          width: cloud.width,
          height: cloud.height,
          duration: cloud.duration,
          syncStatus: SYNC_STATUS.SYNCED,
          lastSyncError: null,
          mediaUrls: cloud.mediaUrls || null,
          sourceDeviceId: cloud.sourceDeviceId || null,
        });
        // Best-effort thumbnail for list (auth path — không phụ thuộc URL ký 15p)
        try {
          const thumbBlob = await downloadDraftRoleBlob(
            cloud.id,
            "thumbnail",
            cloud.mediaUrls,
          );
          if (thumbBlob) {
            await momentDraftDB.draftBlobs.put({
              id: cloud.id,
              mediaBlob: null,
              thumbnailBlob: thumbBlob,
              originalMediaBlob: null,
              mimeType: cloud.mimeType || "",
              fileName: cloud.fileName || "",
            });
          }
        } catch {
          /* thumbs are best-effort */
        }
        continue;
      }

      // Same account only
      if (String(local.ownerUid) !== String(ownerUid)) continue;

      const localPending =
        local.syncStatus === SYNC_STATUS.PENDING_SYNC ||
        local.syncStatus === SYNC_STATUS.SYNC_FAILED ||
        local.syncStatus === SYNC_STATUS.SYNCING;

      if (localPending && (local.revision || 1) > (cloud.revision || 1)) {
        // Local newer — will push later
        continue;
      }

      if (
        localPending &&
        (cloud.revision || 1) > (local.cloudRevision || local.baseRevision || 0) &&
        (local.revision || 1) > (local.cloudRevision || 0)
      ) {
        await updateDraftMeta(local.id, {
          syncStatus: SYNC_STATUS.CONFLICT,
          lastSyncError: "Đã sửa trên nhiều thiết bị",
          cloudRevision: cloud.revision,
        });
        // Keep local; store cloud fork as conflict sibling
        const forkId = `${cloud.id}__cloud_${cloud.revision}`;
        if (!(await momentDraftDB.drafts.get(forkId))) {
          await momentDraftDB.drafts.put({
            ...local,
            id: forkId,
            caption: cloud.caption,
            captionStyle: cloud.captionStyle,
            music: cloud.music,
            overlays: cloud.overlays,
            audience: cloud.audience,
            selectedFriendIds: cloud.selectedFriendIds,
            optionsData: cloud.optionsData,
            revision: cloud.revision,
            cloudRevision: cloud.revision,
            syncStatus: SYNC_STATUS.SYNCED,
            updatedAt: cloud.updatedAt,
            mediaUrls: cloud.mediaUrls,
            lastSyncError: "Bản từ thiết bị khác (xung đột)",
          });
        }
        continue;
      }

      // Cloud wins for metadata when local is synced
      if (!localPending || (cloud.revision || 0) >= (local.revision || 0)) {
        await momentDraftDB.drafts.put({
          ...local,
          caption: cloud.caption ?? local.caption,
          captionStyle: cloud.captionStyle ?? local.captionStyle,
          music: cloud.music ?? local.music,
          overlays: cloud.overlays ?? local.overlays,
          audience: cloud.audience ?? local.audience,
          selectedFriendIds: cloud.selectedFriendIds ?? local.selectedFriendIds,
          optionsData: cloud.optionsData ?? local.optionsData,
          status: cloud.status || local.status,
          revision: Math.max(local.revision || 1, cloud.revision || 1),
          cloudRevision: cloud.revision,
          baseRevision: cloud.revision,
          updatedAt: Math.max(local.updatedAt || 0, cloud.updatedAt || 0),
          syncStatus: localPending
            ? local.syncStatus
            : SYNC_STATUS.SYNCED,
          mediaUrls: cloud.mediaUrls || local.mediaUrls,
          mimeType: cloud.mimeType || local.mimeType,
          fileName: cloud.fileName || local.fileName,
          width: cloud.width ?? local.width,
          height: cloud.height ?? local.height,
          duration: cloud.duration ?? local.duration,
          mediaType: cloud.mediaType || local.mediaType,
        });
        // Fill missing thumb for already-synced shells (other devices)
        try {
          const blobs = await momentDraftDB.draftBlobs.get(local.id);
          if (!(blobs?.thumbnailBlob instanceof Blob) || !blobs.thumbnailBlob.size) {
            const thumbBlob = await downloadDraftRoleBlob(
              local.id,
              "thumbnail",
              cloud.mediaUrls || local.mediaUrls,
            );
            if (thumbBlob) {
              await momentDraftDB.draftBlobs.put({
                id: local.id,
                mediaBlob: blobs?.mediaBlob || null,
                thumbnailBlob: thumbBlob,
                originalMediaBlob: blobs?.originalMediaBlob || null,
                mimeType: blobs?.mimeType || cloud.mimeType || local.mimeType || "",
                fileName: blobs?.fileName || cloud.fileName || local.fileName || "",
              });
            }
          }
        } catch {
          /* best-effort */
        }
      }
    }

    // Drop local shells that only existed on cloud and were deleted elsewhere
    // (keep pending_sync / sync_failed / conflict / local_only)
    const remoteIds = new Set(remote.map((d) => d?.id).filter(Boolean));
    let locals = [];
    try {
      locals = await momentDraftDB.drafts
        .where("ownerUid")
        .equals(String(ownerUid))
        .toArray();
    } catch {
      locals = await listDraftsMeta(ownerUid);
    }
    for (const row of locals) {
      if (remoteIds.has(row.id)) continue;
      const st = row.syncStatus;
      const keepLocal =
        st === SYNC_STATUS.PENDING_SYNC ||
        st === SYNC_STATUS.SYNC_FAILED ||
        st === SYNC_STATUS.SYNCING ||
        st === SYNC_STATUS.CONFLICT ||
        st === SYNC_STATUS.LOCAL_ONLY ||
        st === SYNC_STATUS.PENDING_DELETE ||
        !st;
      if (keepLocal) continue;
      if (st === SYNC_STATUS.SYNCED || st === SYNC_STATUS.UPLOADING_POST) {
        await momentDraftDB.drafts.delete(row.id);
        await momentDraftDB.draftBlobs.delete(row.id);
      }
    }

    return { ok: true, count: remote.length };
  } catch (e) {
    return {
      ok: false,
      error: e?.response?.data?.message || e?.message,
    };
  } finally {
    pullRunning = false;
  }
}

/**
 * Ensure thumbnail blob present (for library preview on other devices).
 * Uses authenticated media route so signed URLs can expire safely.
 */
export async function ensureLocalThumbnail(draftId) {
  if (!draftId) return { ok: false, error: "missing_id" };
  const existing = await momentDraftDB.draftBlobs.get(draftId);
  if (existing?.thumbnailBlob instanceof Blob && existing.thumbnailBlob.size > 0) {
    return { ok: true, blob: existing.thumbnailBlob, blobs: existing };
  }
  const meta = await momentDraftDB.drafts.get(draftId);
  if (!meta) return { ok: false, error: "not_found" };

  let mediaUrls = meta.mediaUrls || null;
  let thumb =
    (await downloadDraftRoleBlob(draftId, "thumbnail", mediaUrls).catch(
      () => null,
    )) || null;

  // Fresh signed urls if first try failed
  if (!thumb) {
    mediaUrls = (await refreshDraftMediaUrls(draftId)) || mediaUrls;
    thumb = await downloadDraftRoleBlob(draftId, "thumbnail", mediaUrls).catch(
      () => null,
    );
  }
  // Fall back to active still (image drafts)
  if (!thumb && meta.mediaType !== "video") {
    thumb = await downloadDraftRoleBlob(draftId, "active", mediaUrls).catch(
      () => null,
    );
  }
  if (!thumb) return { ok: false, error: "no_remote_thumb" };

  await momentDraftDB.draftBlobs.put({
    id: draftId,
    mediaBlob: existing?.mediaBlob || null,
    thumbnailBlob: thumb,
    originalMediaBlob: existing?.originalMediaBlob || null,
    mimeType: existing?.mimeType || meta.mimeType || thumb.type || "",
    fileName: existing?.fileName || meta.fileName || "",
  });
  return {
    ok: true,
    blob: thumb,
    blobs: await momentDraftDB.draftBlobs.get(draftId),
  };
}

/** Ensure full media blob present locally (download active if needed). */
export async function ensureLocalMedia(draftId) {
  const blobs = await momentDraftDB.draftBlobs.get(draftId);
  if (blobs?.mediaBlob instanceof Blob && blobs.mediaBlob.size > 0) {
    return { ok: true, blobs };
  }
  const meta = await momentDraftDB.drafts.get(draftId);
  if (!meta) return { ok: false, error: "not_found" };

  let mediaUrls = meta.mediaUrls || null;
  let mediaBlob =
    (await downloadDraftRoleBlob(draftId, "active", mediaUrls).catch(
      () => null,
    )) ||
    (await downloadDraftRoleBlob(draftId, "original", mediaUrls).catch(
      () => null,
    ));

  if (!mediaBlob) {
    mediaUrls = (await refreshDraftMediaUrls(draftId)) || mediaUrls;
    mediaBlob =
      (await downloadDraftRoleBlob(draftId, "active", mediaUrls).catch(
        () => null,
      )) ||
      (await downloadDraftRoleBlob(draftId, "original", mediaUrls).catch(
        () => null,
      ));
  }
  if (!mediaBlob) return { ok: false, error: "no_remote_media" };

  // Also try to fill missing thumbnail while we're online
  let thumbnailBlob = blobs?.thumbnailBlob || null;
  if (!(thumbnailBlob instanceof Blob) || !thumbnailBlob.size) {
    thumbnailBlob =
      (await downloadDraftRoleBlob(draftId, "thumbnail", mediaUrls).catch(
        () => null,
      )) ||
      (meta.mediaType !== "video" ? mediaBlob : null);
  }

  await momentDraftDB.draftBlobs.put({
    id: draftId,
    mediaBlob,
    thumbnailBlob: thumbnailBlob || null,
    originalMediaBlob: blobs?.originalMediaBlob || null,
    mimeType: mediaBlob.type || meta.mimeType || "",
    fileName: meta.fileName || "",
  });
  return {
    ok: true,
    blobs: await momentDraftDB.draftBlobs.get(draftId),
  };
}

export async function syncAll({ onProgress } = {}) {
  if (!authOk()) return { ok: false, reason: "auth" };
  const pull = await pullCloudDrafts({ onProgress });
  const push = await pushPendingDrafts({ onProgress });
  return { ok: true, pull, push };
}

export function isDraftSyncRunning() {
  return syncRunning || pullRunning;
}
