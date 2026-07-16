import momentDraftDB from "@/cache/momentDraftDB";
import { getMyLocalId } from "@/utils/auth/getMyLocalId";

export const MOMENT_DRAFT_VERSION = 1;
export const MAX_DRAFT_IMAGE_MB = 20;
export const MAX_DRAFT_VIDEO_MB = 90;

/** In-memory: skip replace-prompt while restoring a draft into studio */
let restoreInProgress = false;
/** In-memory: media already written for current session key */
let lastSavedMediaKey = null;

export function setRestoreInProgress(v) {
  restoreInProgress = Boolean(v);
}

export function isRestoreInProgress() {
  return restoreInProgress;
}

export function draftMetaIdForUid(uid) {
  return `moment-draft:${String(uid)}`;
}

export function resolveDraftUid(user = null) {
  const id = getMyLocalId(user);
  return id ? String(id) : "";
}

function mediaKeyFor(uid) {
  return `media:${uid}:${Date.now()}:${Math.random().toString(36).slice(2, 9)}`;
}

function serializeMusicPayload(payload = {}) {
  if (!payload || typeof payload !== "object") return {};
  return {
    song_title: payload.song_title || payload.song_name || payload.title || "",
    song_name: payload.song_name || payload.song_title || payload.title || "",
    artist: payload.artist || "",
    isrc: payload.isrc || "",
    spotify_url: payload.spotify_url || payload.spotifyUrl || "",
    apple_music_url: payload.apple_music_url || payload.appleMusicUrl || "",
    image_url: payload.image_url || payload.image || payload.cover || "",
    preview_url: payload.preview_url || payload.previewUrl || payload.audio || "",
    musicTrackId: payload.musicTrackId || null,
    startTime: payload.startTime ?? 0,
    endTime: payload.endTime ?? payload.duration ?? null,
    duration: payload.duration ?? null,
    volume: payload.volume ?? 1,
    platform: payload.platform || null,
  };
}

/**
 * Strip secrets / ephemeral upload fields from overlay before persist.
 */
export function sanitizeOverlayForDraft(overlayData = {}) {
  const o = { ...(overlayData || {}) };
  delete o.token;
  delete o.idToken;
  delete o.accessToken;
  delete o.firebaseToken;
  if (o.type === "music" && o.payload) {
    o.payload = serializeMusicPayload(o.payload);
  }
  return o;
}

export async function requestDraftPersist() {
  try {
    if (navigator.storage?.persist) {
      await navigator.storage.persist();
    }
  } catch {
    /* best effort only */
  }
}

export function checkDraftMediaSize(file) {
  if (!file) return { ok: false, reason: "missing" };
  const mb = (file.size || 0) / (1024 * 1024);
  const isVideo =
    (file.type && String(file.type).startsWith("video/")) ||
    /\.(mp4|webm|mov|m4v|3gp)$/i.test(file.name || "");
  const max = isVideo ? MAX_DRAFT_VIDEO_MB : MAX_DRAFT_IMAGE_MB;
  if (mb > max) {
    return {
      ok: false,
      reason: "too-large",
      message: `File quá lớn để lưu bản nháp (tối đa ~${max}MB).`,
      mb,
      max,
    };
  }
  return { ok: true, mb, max, isVideo };
}

async function readMediaDimensions(file, isVideo) {
  try {
    if (isVideo) {
      const url = URL.createObjectURL(file);
      try {
        const dims = await new Promise((resolve) => {
          const v = document.createElement("video");
          v.preload = "metadata";
          v.onloadedmetadata = () => {
            resolve({
              width: v.videoWidth || null,
              height: v.videoHeight || null,
              duration: Number.isFinite(v.duration) ? v.duration : null,
            });
          };
          v.onerror = () => resolve({ width: null, height: null, duration: null });
          v.src = url;
        });
        return dims;
      } finally {
        URL.revokeObjectURL(url);
      }
    }
    const url = URL.createObjectURL(file);
    try {
      const dims = await new Promise((resolve) => {
        const img = new Image();
        img.onload = () =>
          resolve({
            width: img.naturalWidth || null,
            height: img.naturalHeight || null,
            duration: null,
          });
        img.onerror = () =>
          resolve({ width: null, height: null, duration: null });
        img.src = url;
      });
      return dims;
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return { width: null, height: null, duration: null };
  }
}

/**
 * Save/replace media Blob once for uid. Updates meta pointer.
 * @returns {{ mediaKey: string } | { error: string, message?: string }}
 */
export async function saveMomentDraftMedia(uid, file, extras = {}) {
  if (!uid || !file) return { error: "missing" };
  const sizeCheck = checkDraftMediaSize(file);
  if (!sizeCheck.ok) {
    return {
      error: sizeCheck.reason,
      message:
        sizeCheck.message ||
        "Thiết bị không còn đủ dung lượng để lưu bản nháp này.",
    };
  }

  const isVideo = Boolean(sizeCheck.isVideo);
  const mediaType = isVideo ? "video" : "image";
  const dims = await readMediaDimensions(file, isVideo);
  const mediaKey = mediaKeyFor(uid);
  const now = Date.now();
  const metaId = draftMetaIdForUid(uid);

  try {
    await requestDraftPersist();

    // Remove previous media for this user (keep only one draft)
    const prev = await momentDraftDB.momentDraftMeta.get(metaId);
    if (prev?.mediaKey && prev.mediaKey !== mediaKey) {
      try {
        await momentDraftDB.momentDraftMedia.delete(prev.mediaKey);
      } catch {
        /* ignore */
      }
    }

    await momentDraftDB.momentDraftMedia.put({
      mediaKey,
      blob: file instanceof Blob ? file : new Blob([file], { type: file.type }),
      mimeType: file.type || (isVideo ? "video/mp4" : "image/jpeg"),
      fileName: file.name || (isVideo ? "draft.mp4" : "draft.jpg"),
      width: dims.width,
      height: dims.height,
      duration: dims.duration,
      createdAt: now,
    });

    const baseMeta = prev || {
      id: metaId,
      version: MOMENT_DRAFT_VERSION,
      uid: String(uid),
      caption: "",
      overlays: null,
      optionsData: {},
      selectedAudience: "all",
      selectedFriendIds: [],
      cameraMetadata: {},
      createdAt: now,
      status: "editing",
    };

    await momentDraftDB.momentDraftMeta.put({
      ...baseMeta,
      id: metaId,
      version: MOMENT_DRAFT_VERSION,
      uid: String(uid),
      mediaKey,
      mediaType,
      updatedAt: now,
      status: baseMeta.status === "posting" ? "editing" : baseMeta.status || "editing",
      ...extras,
    });

    lastSavedMediaKey = mediaKey;
    return { mediaKey, mediaType, metaId };
  } catch (err) {
    if (err?.name === "QuotaExceededError" || err?.code === 22) {
      return {
        error: "quota",
        message: "Thiết bị không còn đủ dung lượng để lưu bản nháp này.",
      };
    }
    console.error("[moment-draft] save media failed", err);
    return {
      error: "save-failed",
      message: err?.message || "Không lưu được bản nháp.",
    };
  }
}

/**
 * Patch metadata only (caption, overlay, audience…). Does not rewrite Blob.
 */
export async function updateMomentDraftMeta(uid, partial = {}) {
  if (!uid) return { error: "missing-uid" };
  const metaId = draftMetaIdForUid(uid);
  try {
    const prev = await momentDraftDB.momentDraftMeta.get(metaId);
    if (!prev?.mediaKey) return { error: "no-draft" };

    const next = {
      ...prev,
      ...partial,
      id: metaId,
      uid: String(uid),
      version: MOMENT_DRAFT_VERSION,
      mediaKey: prev.mediaKey,
      updatedAt: Date.now(),
    };
    if (partial.optionsData) {
      next.optionsData = {
        ...(prev.optionsData || {}),
        ...partial.optionsData,
      };
    }
    if (partial.overlays || partial.overlayData) {
      next.overlays = sanitizeOverlayForDraft(
        partial.overlays || partial.overlayData,
      );
    }
    await momentDraftDB.momentDraftMeta.put(next);
    return { ok: true, meta: next };
  } catch (err) {
    if (err?.name === "QuotaExceededError") {
      return {
        error: "quota",
        message: "Thiết bị không còn đủ dung lượng để lưu bản nháp này.",
      };
    }
    console.error("[moment-draft] update meta failed", err);
    return { error: "update-failed", message: err?.message };
  }
}

export async function setMomentDraftStatus(uid, status) {
  return updateMomentDraftMeta(uid, { status });
}

export async function getMomentDraftMeta(uid) {
  if (!uid) return null;
  try {
    return (await momentDraftDB.momentDraftMeta.get(draftMetaIdForUid(uid))) || null;
  } catch {
    return null;
  }
}

/**
 * Load meta + media Blob. Returns null if missing/corrupt.
 */
export async function loadMomentDraft(uid) {
  if (!uid) return null;
  try {
    const meta = await getMomentDraftMeta(uid);
    if (!meta?.mediaKey) return null;
    const media = await momentDraftDB.momentDraftMedia.get(meta.mediaKey);
    if (!media?.blob || !(media.blob instanceof Blob) || media.blob.size < 1) {
      return { meta, media: null, corrupt: true };
    }
    return { meta, media, corrupt: false };
  } catch (err) {
    console.error("[moment-draft] load failed", err);
    return null;
  }
}

export async function hasMomentDraft(uid) {
  const meta = await getMomentDraftMeta(uid);
  return Boolean(meta?.mediaKey);
}

export async function deleteMomentDraft(uid) {
  if (!uid) return false;
  const metaId = draftMetaIdForUid(uid);
  try {
    const prev = await momentDraftDB.momentDraftMeta.get(metaId);
    if (prev?.mediaKey) {
      await momentDraftDB.momentDraftMedia.delete(prev.mediaKey);
    }
    await momentDraftDB.momentDraftMeta.delete(metaId);
    if (lastSavedMediaKey && prev?.mediaKey === lastSavedMediaKey) {
      lastSavedMediaKey = null;
    }
    return true;
  } catch (err) {
    console.error("[moment-draft] delete failed", err);
    return false;
  }
}

/**
 * Build a File from draft media for studio restore.
 */
export function draftMediaToFile(media) {
  if (!media?.blob) return null;
  const type = media.mimeType || media.blob.type || "application/octet-stream";
  const name =
    media.fileName ||
    (String(type).startsWith("video/") ? "draft.mp4" : "draft.jpg");
  try {
    return new File([media.blob], name, {
      type,
      lastModified: media.createdAt || Date.now(),
    });
  } catch {
    // Safari older File constructor edge-case
    const blob = media.blob.slice(0, media.blob.size, type);
    blob.name = name;
    return blob;
  }
}

export function formatDraftSavedAt(ts) {
  try {
    const d = new Date(ts || Date.now());
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  } catch {
    return "";
  }
}

/**
 * Snapshot current editor stores into draft meta fields.
 */
export function collectDraftMetaFromStores({
  overlayData,
  audience,
  selectedRecipients,
  selectedGroupId,
  videoCropData,
  restoreStreakData,
} = {}) {
  const sanitized = sanitizeOverlayForDraft(overlayData || {});
  return {
    caption: sanitized.caption || sanitized.text || "",
    overlays: sanitized,
    optionsData: {
      caption: sanitized.caption || sanitized.text || "",
      text: sanitized.text || sanitized.caption || "",
      type: sanitized.type || "default",
      payload: sanitized.payload || {},
      icon: sanitized.icon || {},
      background: sanitized.background || {},
      text_color: sanitized.text_color || "#FFFFFF",
      overlay_id: sanitized.overlay_id || "standard",
      selectedGroupId: selectedGroupId || null,
      restoreStreakData: restoreStreakData || null,
      videoCropData: videoCropData || null,
    },
    selectedAudience: audience || "all",
    selectedFriendIds: Array.isArray(selectedRecipients)
      ? selectedRecipients.slice()
      : [],
    cameraMetadata: {},
    status: "editing",
  };
}
