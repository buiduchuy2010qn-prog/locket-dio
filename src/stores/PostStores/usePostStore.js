import { create } from "zustand";

const defaultState = {
  selectedFile: null,
  /** First image of the current editor session — never overwritten by AI confirm */
  originalFile: null,
  /**
   * AI enhance meta when activeMedia !== original
   * { enabled, mode, model, createdAt } | null
   */
  enhancement: null,
  imageToCrop: null,
  videoToCrop: null,
  videoCropData: null,
  preview: null,
  isSizeMedia: null,
  audience: "all",
  selectedRecipients: [],
  restoreStreakData: null,
  selectedGroupId: null,
  videoCropArea: null,
};

function revokePreviewUrl(preview) {
  if (preview?.data?.startsWith("blob:")) {
    try {
      URL.revokeObjectURL(preview.data);
    } catch {
      /* ignore */
    }
  }
}

function mediaTypeOf(file) {
  if (!file?.type) return null;
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return null;
}

export const usePostStore = create((set, get) => ({
  ...defaultState,

  setSelectedFile: (file) => set({ selectedFile: file }),

  setImageToCrop: (img) => set({ imageToCrop: img }),

  setVideoToCrop: (video) => set({ videoToCrop: video }),

  setVideoCropData: (data) => set({ videoCropData: data }),

  setVideoCropArea: (data) => set({ videoCropArea: data }),

  setPreview: (p) => set({ preview: p }),
  setSizeMedia: (val) => set({ isSizeMedia: val }),

  setAudience: (val) => set({ audience: val }),
  setSelectedRecipients: (recipients) =>
    set({ selectedRecipients: recipients }),
  setRestoreStreakData: (val) => set({ restoreStreakData: val }),
  setSelectedGroupId: (val) => set({ selectedGroupId: val }),

  /**
   * New capture / upload / draft restore full replace.
   * Resets originalFile + clears enhancement (new session media).
   */
  setMediaFromFile: (file) => {
    if (!file) return;
    set((state) => {
      revokePreviewUrl(state.preview);
      const url = URL.createObjectURL(file);
      const type = mediaTypeOf(file);
      return {
        selectedFile: file,
        // Videos: originalFile tracks same file for consistency; AI only uses images
        originalFile: file,
        enhancement: null,
        preview: { type, data: url },
        isSizeMedia: (file.size / 1024 / 1024).toFixed(2),
      };
    });
  },

  /**
   * After user confirms AI result — swap active media only.
   * Does not change originalFile.
   */
  setActiveMediaFile: (file, enhancementMeta = null) => {
    if (!file) return;
    set((state) => {
      revokePreviewUrl(state.preview);
      const url = URL.createObjectURL(file);
      const type = mediaTypeOf(file) || "image";
      return {
        selectedFile: file,
        originalFile: state.originalFile || file,
        enhancement: enhancementMeta
          ? {
              enabled: true,
              mode: enhancementMeta.mode || "natural",
              model: enhancementMeta.model || "server-image-enhancement",
              createdAt: enhancementMeta.createdAt || Date.now(),
            }
          : null,
        preview: { type, data: url },
        isSizeMedia: (file.size / 1024 / 1024).toFixed(2),
      };
    });
  },

  /** Ensure originalFile is set before AI (first image of session). */
  ensureOriginalFile: () => {
    const s = get();
    if (!s.originalFile && s.selectedFile) {
      set({ originalFile: s.selectedFile });
    }
  },

  /** Undo AI — active back to original; enhancement cleared. */
  revertEnhancement: () => {
    const s = get();
    const orig = s.originalFile;
    if (!orig) {
      set({ enhancement: null });
      return;
    }
    set((state) => {
      revokePreviewUrl(state.preview);
      const url = URL.createObjectURL(orig);
      return {
        selectedFile: orig,
        enhancement: null,
        preview: {
          type: mediaTypeOf(orig) || "image",
          data: url,
        },
        isSizeMedia: (orig.size / 1024 / 1024).toFixed(2),
      };
    });
  },

  resetMedia: () => {
    set((state) => {
      revokePreviewUrl(state.preview);
      return {
        selectedFile: null,
        originalFile: null,
        enhancement: null,
        imageToCrop: null,
        videoToCrop: null,
        videoCropData: null,
        preview: null,
        isSizeMedia: null,
      };
    });
  },

  resetPostStore: () =>
    set((state) => {
      revokePreviewUrl(state.preview);
      return { ...defaultState };
    }),
}));
