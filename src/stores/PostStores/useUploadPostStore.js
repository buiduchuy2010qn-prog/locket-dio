import { create } from "zustand";
import {
  SonnerError,
  SonnerSuccess,
  SonnerWarning,
} from "@/components/uikit/SonnerToast";
import { PostMoments } from "@/services";
import { normalizeMoment } from "@/utils";
import { overlayFromOptionsData } from "@/utils/standardize/normalizeMoments";
import { useStreakStore } from "@/stores/StreakStores";
import { useMomentsStoreV2 } from "@/stores/MomentStores";

import {
  saveUploadItemToDB,
  updateUploadItemInDB,
  deleteUploadItemFromDB,
  getUploadItemFromDB,
  loadUploadItemsByStatus,
  loadAllUploadItems,
  getPostedMoments,
  savePostedMomentToDB,
} from "../../cache/uploadMomentDB";

export const STATUS_UPLOAD_MOMENT = {
  QUEUED: "queued",
  UPLOADING: "uploading",
  DONE: "done",
  FAILED: "failed",
};

/** Item kẹt uploading/queued quá lâu → coi failed / drop */
const STALE_MS = 8 * 60 * 1000; // 8 phút
/** Failed auto-retry tối đa */
const MAX_AUTO_RETRY = 2;

export const useUploadQueueStore = create((set, get) => ({
  uploadItems: [],
  postedMoments: [],
  isQueueRunning: false,

  /* ================= INIT / LOAD ================= */

  hydrateUploadQueue: async () => {
    const items = await loadAllUploadItems();

    // sort mới → cũ cho UI
    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    set({ uploadItems: items });

    const posted = await getPostedMoments();
    set({ postedMoments: posted });

    // Dọn done + resume queue kẹt
    await get().resumeQueue();
  },

  /**
   * Tự dọn item cũ / done, đưa uploading kẹt về queued, auto-retry failed,
   * rồi chạy queue. Gọi khi mở feed / mount UploadingQueue.
   */
  resumeQueue: async () => {
    const now = Date.now();
    const items = [...get().uploadItems];

    for (const item of items) {
      const created = new Date(item.createdAt || 0).getTime();
      const age = now - created;
      const retries = Number(item.retryCount) || 0;

      // Done → xóa ngay
      if (item.status === STATUS_UPLOAD_MOMENT.DONE) {
        await get().removeUploadItemById(item.id);
        continue;
      }

      // Uploading kẹt quá lâu → về queued để thử lại (hoặc drop nếu quá retry)
      if (
        item.status === STATUS_UPLOAD_MOMENT.UPLOADING &&
        age > STALE_MS
      ) {
        if (retries >= MAX_AUTO_RETRY) {
          await get().removeUploadItemById(item.id);
        } else {
          await get().updateUploadItem(item.id, {
            status: STATUS_UPLOAD_MOMENT.QUEUED,
            retryCount: retries + 1,
            lastTried: new Date().toISOString(),
          });
        }
        continue;
      }

      // Failed: auto-retry vài lần rồi xóa im lặng
      if (item.status === STATUS_UPLOAD_MOMENT.FAILED) {
        if (retries >= MAX_AUTO_RETRY) {
          await get().removeUploadItemById(item.id);
        } else {
          await get().updateUploadItem(item.id, {
            status: STATUS_UPLOAD_MOMENT.QUEUED,
            retryCount: retries + 1,
            lastTried: new Date().toISOString(),
            errorCode: null,
            errorMessage: null,
          });
        }
      }
    }

    // Còn queued → chạy
    const hasQueued = get().uploadItems.some(
      (i) => i.status === STATUS_UPLOAD_MOMENT.QUEUED,
    );
    if (hasQueued) {
      get().runQueue();
    }
  },

  enqueueUploadItem: async (data) => {
    const item = {
      ...data,
      status: STATUS_UPLOAD_MOMENT.QUEUED,
      createdAt: new Date().toISOString(),
      retryCount: 0,
    };

    set((s) => ({ uploadItems: [item, ...s.uploadItems] }));
    await saveUploadItemToDB(item);
    get().runQueue();
  },

  retryUploadItem: async (itemId) => {
    const current = get().uploadItems.find((i) => i.id === itemId);
    const retries = Number(current?.retryCount) || 0;
    get().updateUploadItem(itemId, {
      status: STATUS_UPLOAD_MOMENT.QUEUED,
      lastTried: new Date().toISOString(),
      retryCount: retries + 1,
      errorCode: null,
      errorMessage: null,
    });
    get().runQueue();
  },

  /* ================= WORKER ================= */

  runQueue: async () => {
    if (get().isQueueRunning) return;
    set({ isQueueRunning: true });

    try {
      let item;
      while (
        (item = (await loadUploadItemsByStatus(STATUS_UPLOAD_MOMENT.QUEUED))[0])
      ) {
        await get().uploadSingleItem(item);
      }
    } finally {
      set({ isQueueRunning: false });
    }
  },

  uploadSingleItem: async (item) => {
    get().updateUploadItem(item.id, {
      status: STATUS_UPLOAD_MOMENT.UPLOADING,
    });

    try {
      const res = await PostMoments(item);
      // API body: { success, data: locketMoment } — hỗ trợ cả hai lớp
      const raw =
        res?.data?.data && typeof res.data.data === "object"
          ? res.data.data
          : res?.data;
      let normalized = normalizeMoment(raw) || normalizeMoment(res?.data);

      const od = item?.optionsData || {};
      const media = item?.mediaInfo || {};
      const mediaUrl =
        media.publicUrl ||
        media.publicURL ||
        media.downloadURL ||
        media.url ||
        normalized?.image_url ||
        normalized?.thumbnail_url ||
        null;

      // ── Music/poll/review: LUÔN lấy overlay từ lúc đăng (Locket hay cắt response)
      const ov = overlayFromOptionsData(od);
      if (ov && (od.type === "music" || od.type === "poll" || od.type === "review" || od.type === "color_palette")) {
        const musicPayload = {
          ...(ov.payload || {}),
          ...(od.payload || {}),
          ...(od.music || {}),
        };
        const cover =
          ov.icon?.data ||
          od.icon?.data ||
          musicPayload.image_url ||
          musicPayload.image ||
          "";
        const text =
          ov.text ||
          od.text ||
          od.caption ||
          [musicPayload.song_title || musicPayload.song_name, musicPayload.artist]
            .filter(Boolean)
            .join(" · ") ||
          "";
        const musicOverlay = {
          overlay_id:
            od.type === "music" ? "caption:music" : ov.overlay_id || od.overlay_id,
          overlay_type: "caption",
          type: od.type === "music" ? "music" : ov.type || od.type,
          text,
          caption: text,
          text_color: od.text_color || "#FFFFFFE6",
          payload: musicPayload,
          icon: cover
            ? { type: "image", data: cover, source: "url" }
            : ov.icon || od.icon || {},
          platform:
            od.platform ||
            (musicPayload.apple_music_url && !musicPayload.spotify_url
              ? "apple"
              : "spotify"),
          background: ov.background || {
            material_blur: "ultra_thin",
            colors: [],
          },
        };
        normalized = {
          ...(normalized || {}),
          overlays: musicOverlay,
          captions: [
            {
              text,
              text_color: "#FFFFFFE6",
              icon: musicOverlay.icon,
              type: musicOverlay.type,
              payload: musicPayload,
            },
          ],
        };
      } else if (normalized && ov && !normalized.overlays) {
        normalized = { ...normalized, overlays: ov };
      }

      // Ảnh / video URL cho feed web
      if (normalized) {
        if (!normalized.image_url && !normalized.thumbnail_url && mediaUrl) {
          normalized.image_url = mediaUrl;
          normalized.thumbnail_url = mediaUrl;
        }
        if (!normalized.video_url && media.type === "video" && mediaUrl) {
          normalized.video_url = mediaUrl;
        }
      }

      // Nếu API không trả id, vẫn thử gắn id tạm để hiện feed + overlay
      if (normalized && !normalized.id) {
        const src = raw || res?.data || {};
        normalized.id =
          src.id ||
          src.canonical_uid ||
          src.momentId ||
          src.uid ||
          `local_${Date.now()}`;
      }
      // createTime để sort feed — tránh NaN đẩy bài mất
      if (normalized && !normalized.createTime) {
        normalized.createTime = Date.now();
      }

      // ❗ Validate response
      if (!normalized || !normalized.id) {
        throw new Error("INVALID_UPLOAD_RESPONSE");
      }
      await get().savePostedMoment(item, normalized);

      // Persist MomentMusic metadata when musicTrackId present
      try {
        const mp = item?.optionsData?.payload;
        if (mp?.musicTrackId && normalized?.id) {
          const { attachMomentMusic } = await import(
            "@/services/ExtensionsServices/MusicLibraryServices"
          );
          await attachMomentMusic(normalized.id, {
            musicTrackId: mp.musicTrackId,
            startTime: mp.startTime ?? 0,
            endTime: mp.endTime ?? mp.duration ?? 0,
            volume: mp.volume ?? 1,
            originalVideoVolume: mp.originalVideoVolume ?? 1,
          });
        }
      } catch (e) {
        console.warn("attachMomentMusic:", e?.message || e);
      }

      // Đẩy bài vừa đăng vào feed lịch sử ngay (không chờ socket / F5)
      try {
        await useMomentsStoreV2.getState().addNewMoment(normalized);
      } catch (e) {
        console.warn("addNewMoment after upload failed:", e);
      }

      get().updateUploadItem(item.id, {
        status: STATUS_UPLOAD_MOMENT.DONE,
      });

      // Draft only cleared after confirmed API success (by draftId if multi-draft)
      try {
        const { useMomentDraftStore } = await import(
          "@/stores/PostStores/useMomentDraftStore"
        );
        await useMomentDraftStore
          .getState()
          .clearAfterSuccessfulPost(item?.draftId || null);
      } catch {
        /* draft optional */
      }

      SonnerSuccess(
        "Đăng tải thành công!",
        `${
          item.contentType === "video" ? "Video" : "Hình ảnh"
        } đã được tải lên!`,
      );
      useStreakStore.getState().fetchStreakIfNeeded();

      get().autoCleanupItem(item.id);
    } catch (err) {
      const retries = Number(item.retryCount) || 0;

      const markDraftEditing = async () => {
        try {
          const { useMomentDraftStore } = await import(
            "@/stores/PostStores/useMomentDraftStore"
          );
          await useMomentDraftStore
            .getState()
            .markEditing(item?.draftId || null);
        } catch {
          /* draft optional */
        }
      };

      // ⚠️ Bài đăng đã tồn tại → coi như xong, xóa draft
      if (err?.response?.status === 409) {
        get().updateUploadItem(item.id, {
          status: STATUS_UPLOAD_MOMENT.DONE,
        });

        await deleteUploadItemFromDB(item.id);
        get().removeUploadItemById(item.id);
        try {
          const { useMomentDraftStore } = await import(
            "@/stores/PostStores/useMomentDraftStore"
          );
          await useMomentDraftStore
            .getState()
            .clearAfterSuccessfulPost(item?.draftId || null);
        } catch {
          /* ignore */
        }
        SonnerWarning("Bài đăng đã tồn tại!");
        return;
      }

      // Media temp hết hạn / 404 → xóa queue item nhưng GIỮ draft để thử lại
      if (
        err?.response?.status === 404 ||
        err?.message === "INVALID_UPLOAD_RESPONSE"
      ) {
        await markDraftEditing();
        SonnerError(
          "Đăng tải thất bại!",
          err?.response?.data?.message ||
            "Media không còn — mở Bản nháp để thử đăng lại.",
        );
        await get().removeUploadItemById(item.id);
        return;
      }

      // Lỗi khác: failed + auto-retry sau vài giây (nếu còn lượt)
      const msg =
        err?.response?.data?.message || "Đăng tải thất bại, vui lòng thử lại";

      await markDraftEditing();

      get().updateUploadItem(item.id, {
        status: STATUS_UPLOAD_MOMENT.FAILED,
        errorCode: "UPLOAD_FAILED",
        errorMessage: msg,
      });

      if (retries < MAX_AUTO_RETRY) {
        // Auto retry im lặng sau 4s
        setTimeout(() => {
          const still = get().uploadItems.find((i) => i.id === item.id);
          if (still?.status === STATUS_UPLOAD_MOMENT.FAILED) {
            get().retryUploadItem(item.id);
          }
        }, 4000);
      } else {
        SonnerError(
          "Đăng tải thất bại!",
          `${msg} — mở Bản nháp để thử đăng lại.`,
        );
        // Xóa queue item sau 12s; draft vẫn giữ
        setTimeout(() => {
          const still = get().uploadItems.find((i) => i.id === item.id);
          if (still?.status === STATUS_UPLOAD_MOMENT.FAILED) {
            get().removeUploadItemById(item.id);
          }
        }, 12000);
      }
    }
  },

  removeUploadItemById: async (id) => {
    if (!id) return;

    // xoá DB trước
    await deleteUploadItemFromDB(id);

    // xoá store
    set((state) => ({
      uploadItems: state.uploadItems.filter((item) => item.id !== id),
    }));
  },
  /* ================= CLEANUP ================= */

  autoCleanupItem: (itemId, delay = 2500) => {
    setTimeout(async () => {
      if (!itemId) return;
      const item = await getUploadItemFromDB(itemId);
      if (item?.status === STATUS_UPLOAD_MOMENT.DONE) {
        get().removeUploadItemById(itemId);
      }
    }, delay);
  },

  updateUploadItemInState: (id, patch) => {
    if (!id) return;

    set((state) => ({
      uploadItems: state.uploadItems.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    }));
  },

  updateUploadItem: async (id, patch) => {
    await updateUploadItemInDB(id, patch);
    get().updateUploadItemInState(id, patch);
  },

  savePostedMoment: async (payload, posted) => {
    try {
      await savePostedMomentToDB(payload, posted);

      set((state) => ({
        postedMoments: [
          {
            postId: posted.id,
            createdAt: new Date().toISOString(),
            contentType: payload.contentType,
            ...posted,
          },
          ...state.postedMoments,
        ],
      }));
    } catch (err) {
      console.error("❌ Failed to save posted moment:", err);
    }
  },
}));
