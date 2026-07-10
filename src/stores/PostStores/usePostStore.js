import { create } from "zustand";

const defaultState = {
  selectedFile: null,
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

export const usePostStore = create((set) => ({
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

  setMediaFromFile: (file) => {
    const url = URL.createObjectURL(file);

    const type = file.type.startsWith("image/")
      ? "image"
      : file.type.startsWith("video/")
        ? "video"
        : null;

    set({
      selectedFile: file,
      preview: { type, data: url },
      isSizeMedia: (file.size / 1024 / 1024).toFixed(2),
    });
  },
  resetMedia: () => {
    set((state) => {
      // cleanup blob URL nếu có
      if (state.preview?.data?.startsWith("blob:")) {
        URL.revokeObjectURL(state.preview.data);
      }

      return {
        selectedFile: null,
        imageToCrop: null,
        videoToCrop: null,
        videoCropData: null,
        preview: null,
        isSizeMedia: null,
      };
    });
  },

  resetPostStore: () => set(defaultState),
}));

// const selectedFile = usePostStore((s) => s.selectedFile);
// const setSelectedFile = usePostStore((s) => s.setSelectedFile);

// const setMediaFromFile = usePostStore((s) => s.setMediaFromFile);
