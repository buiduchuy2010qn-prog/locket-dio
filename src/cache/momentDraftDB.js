import Dexie from "dexie";

/**
 * Multi-draft offline library (Huy Locket).
 * v1: single draft per uid
 * v2: many drafts keyed by UUID + separate blob store
 */
export const momentDraftDB = new Dexie("HuyLocketMomentDraftDB");

momentDraftDB.version(1).stores({
  momentDraftMedia: "mediaKey, createdAt",
  momentDraftMeta: "id, uid, updatedAt, status",
});

momentDraftDB
  .version(2)
  .stores({
    // legacy tables kept for one-time migration
    momentDraftMedia: "mediaKey, createdAt",
    momentDraftMeta: "id, uid, updatedAt, status",
    // multi-draft metadata (no large blobs)
    drafts:
      "id, ownerUid, createdAt, updatedAt, status, mediaType, [ownerUid+updatedAt]",
    // full media blobs — only loaded on view/edit/post
    draftBlobs: "id",
  })
  .upgrade(async (tx) => {
    try {
      const oldMetas = await tx.table("momentDraftMeta").toArray();
      for (const meta of oldMetas) {
        if (!meta?.mediaKey) continue;
        const media = await tx.table("momentDraftMedia").get(meta.mediaKey);
        if (!media?.blob) continue;
        const id =
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `draft-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const ownerUid = String(meta.uid || meta.ownerUid || "");
        const createdAt = meta.createdAt || meta.updatedAt || Date.now();
        await tx.table("drafts").put({
          id,
          ownerUid,
          schemaVersion: 2,
          createdAt,
          updatedAt: meta.updatedAt || createdAt,
          mediaType: meta.mediaType || "image",
          caption: meta.caption || "",
          captionStyle: meta.captionStyle || null,
          music: meta.music || null,
          overlays: meta.overlays || null,
          audience: meta.selectedAudience || meta.audience || "all",
          selectedFriendIds: meta.selectedFriendIds || [],
          optionsData: meta.optionsData || {},
          status:
            meta.status === "posting"
              ? "failed"
              : meta.status === "pendingDeletion"
                ? "pending"
                : meta.status === "editing"
                  ? "ready"
                  : meta.status || "ready",
          lastError: null,
          uploadAttempts: 0,
          mimeType: media.mimeType || "",
          fileName: media.fileName || "",
          width: media.width || null,
          height: media.height || null,
          duration: media.duration || null,
        });
        await tx.table("draftBlobs").put({
          id,
          mediaBlob: media.blob,
          thumbnailBlob: null,
          mimeType: media.mimeType || media.blob.type || "",
          fileName: media.fileName || "",
        });
      }
    } catch (e) {
      console.warn("[moment-draft] v2 migrate failed", e);
    }
  });

/**
 * v3: optional originalMediaBlob + enhancement meta (AI Làm nét).
 * Backwards compatible — old rows keep working without original blob.
 */
momentDraftDB.version(3).stores({
  momentDraftMedia: "mediaKey, createdAt",
  momentDraftMeta: "id, uid, updatedAt, status",
  drafts:
    "id, ownerUid, createdAt, updatedAt, status, mediaType, [ownerUid+updatedAt]",
  draftBlobs: "id",
});

export default momentDraftDB;
