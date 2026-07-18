/**
 * Moment draft public API — multi-draft library + helpers.
 */

export {
  DRAFT_SCHEMA_VERSION,
  DRAFT_STATUS,
  SYNC_STATUS,
  syncStatusLabel,
  resolveDraftUid,
  newDraftId,
  getDeviceId,
  requestDraftPersist,
  estimateStorage,
  checkDraftMediaSize,
  ensureStorageForFile,
  makeThumbnailBlob,
  collectMetaFromStores,
  collectMetaFromStores as collectDraftMetaFromStores,
  createDraft,
  updateDraftMedia,
  updateDraftMeta,
  listDraftsMeta,
  getDraftMeta,
  getDraftFull,
  getDraftThumbnailBlob,
  getDraftMediaBlob,
  deleteDraft,
  resetStuckPostingDrafts,
  draftMediaToFile,
  formatDraftSavedAt,
  formatDraftCreatedAt,
  formatDraftStatusLine,
  statusLabel,
} from "./draftLibrary";

export {
  pushPendingDrafts,
  pullCloudDrafts,
  syncAll,
  ensureLocalMedia,
  isDraftSyncRunning,
} from "./draftSyncService";

export {
  sanitizeOverlayForDraft,
  serializeMusicFromOverlay,
  MAX_DRAFT_IMAGE_MB,
  MAX_DRAFT_VIDEO_MB,
} from "./serialize";

/** Soft-delete undo window (legacy); library uses confirm dialog. */
export const DRAFT_UNDO_MS = 8000;
export const MOMENT_DRAFT_VERSION = 2;

let restoreInProgress = false;

export function setRestoreInProgress(v) {
  restoreInProgress = Boolean(v);
}

export function isRestoreInProgress() {
  return restoreInProgress;
}

/** @deprecated single-draft id */
export function draftMetaIdForUid(uid) {
  return `moment-draft:${String(uid)}`;
}
