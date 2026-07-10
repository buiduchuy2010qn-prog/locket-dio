import { create } from "zustand";
import {
  SonnerError,
  SonnerSuccess,
  SonnerWarning,
} from "@/components/ui/SonnerToast";
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
      let normalized = normalizeMoment(res?.data);

      // Response Locket thường thiếu / cắt payload music → luôn ghép từ optionsData
      // khi type đặc biệt (music/poll/review) hoặc overlays rỗng
      if (normalized && item?.optionsData) {
        const od = item.optionsData;
        const special =
          od.type === "music" ||
          od.type === "poll" ||
          od.type === "review" ||
          od.type === "color_palette";
        const ov = overlayFromOptionsData(od);
        const incoming = normalized.overlays;
        const missingPayload =
          special &&
          (!incoming ||
            !incoming.payload ||
            (od.type === "music" &&
              !incoming.payload?.isrc &&
              !incoming.payload?.preview_url));
        if (ov && (!incoming || missingPayload || special)) {
          normalized = {
            ...normalized,
            overlays: {
              ...(incoming || {}),
              ...ov,
              // Giữ payload/icon đầy đủ từ lúc đăng
              payload: {
                ...(incoming?.payload || {}),
                ...(ov.payload || {}),
              },
              icon: ov.icon?.data ? ov.icon : incoming?.icon || ov.icon,
              type: ov.type || incoming?.type,
              overlay_id: ov.overlay_id || incoming?.overlay_id,
            },
          };
        }
      }

      // Nếu API không trả id, vẫn thử gắn id tạm để hiện feed + overlay
      if (normalized && !normalized.id && res?.data) {
        normalized.id =
          res.data.id ||
          res.data.canonical_uid ||
          res.data.momentId ||
          `local_${Date.now()}`;
      }

      // ❗ Validate response
      if (!normalized || !normalized.id) {
        throw new Error("INVALID_UPLOAD_RESPONSE");
      }
      await get().savePostedMoment(item, normalized);

      // Đẩy bài vừa đăng vào feed lịch sử ngay (không chờ socket / F5)
      try {
        await useMomentsStoreV2.getState().addNewMoment(normalized);
      } catch (e) {
        console.warn("addNewMoment after upload failed:", e);
      }

      get().updateUploadItem(item.id, {
        status: STATUS_UPLOAD_MOMENT.DONE,
      });

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

      // ⚠️ Bài đăng đã tồn tại
      if (err?.response?.status === 409) {
        get().updateUploadItem(item.id, {
          status: STATUS_UPLOAD_MOMENT.DONE,
        });

        await deleteUploadItemFromDB(item.id);
        get().removeUploadItemById(item.id);
        SonnerWarning("Bài đăng đã tồn tại!");
        return;
      }

      // Media temp hết hạn / 404 → xóa luôn (retry vô ích)
      if (
        err?.response?.status === 404 ||
        err?.message === "INVALID_UPLOAD_RESPONSE"
      ) {
        SonnerError(
          "Đăng tải thất bại!",
          err?.response?.data?.message || "Media không còn, hãy chụp lại.",
        );
        await get().removeUploadItemById(item.id);
        return;
      }

      // Lỗi khác: failed + auto-retry sau vài giây (nếu còn lượt)
      const msg =
        err?.response?.data?.message || "Đăng tải thất bại, vui lòng thử lại";

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
        SonnerError("Đăng tải thất bại!", msg);
        // Xóa sau 12s để UI gọn
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
