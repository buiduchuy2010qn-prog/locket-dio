import Dexie from "dexie";

/**
 * Moment draft storage (unpublished post recovery).
 * Media Blob lives in IndexedDB — never localStorage / never only object URLs.
 */
export const momentDraftDB = new Dexie("HuyLocketMomentDraftDB");

momentDraftDB.version(1).stores({
  /** Primary key: mediaKey */
  momentDraftMedia: "mediaKey, createdAt",
  /** Primary key: id = moment-draft:${uid} */
  momentDraftMeta: "id, uid, updatedAt, status",
});

export default momentDraftDB;
