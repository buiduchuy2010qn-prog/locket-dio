import { getToken } from "@/utils";
import { uploadFileAndGetInfoR2 } from "./StorageServices";
import { useOverlayEditorStore, usePostStore, useStreakStore } from "@/stores";
import { SonnerWarning } from "@/components/ui/SonnerToast";

// Hàm con xác định recipients
const determineRecipients = (audience, selectedRecipients, localId) => {
  if (audience === "selected") return selectedRecipients || [];
  if (audience === "private") return localId ? [localId] : [];
  // Trường hợp public hoặc khác trả về mảng rỗng
  return [];
};

export const createRequestPayloadV6 = async () => {
  try {
    const { localId } = getToken() || {};

    // Media Stores
    const selectedFile = usePostStore.getState().selectedFile;
    const previewType = usePostStore.getState().preview.type;

    // Streak Stores
    const streakData = useStreakStore.getState().getTodayIfNotUpdated();
    const restoreStreakData = usePostStore.getState().restoreStreakData;

    // Overlay Caption Stores
    const overlayData = useOverlayEditorStore.getState().overlayData;

    // Post Options
    const audience = usePostStore.getState().audience;
    const selectedRecipients = usePostStore.getState().selectedRecipients;
    const selectedGroupId = usePostStore.getState().selectedGroupId;
    const videoCropData = usePostStore.getState().videoCropData;

    if (!localId) {
      SonnerWarning("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.");
      return null;
    }
    // Upload file & chuẩn bị thông tin media
    const fileInfo = await uploadFileAndGetInfoR2(
      selectedFile,
      previewType,
      localId,
    );
    // console.log(fileInfo);

    const mediaInfo = {
      ...fileInfo,
      type: previewType,
    };

    // Chuẩn bị dữ liệu tùy chọn (caption, overlay, v.v.)
    const optionsDataObj = {
      ...overlayData,
      audience, // Gắn audience vào options luôn
      recipients: determineRecipients(audience, selectedRecipients, localId),
    };

    // Music: giữ payload đầy đủ + alias `music` cho server legacy
    if (overlayData?.type === "music" && overlayData?.payload) {
      optionsDataObj.payload = { ...overlayData.payload };
      optionsDataObj.music = { ...overlayData.payload };
      optionsDataObj.overlay_id =
        overlayData.overlay_id || "caption:music";
      // caption/text = TÊN BÀI thuần — app Locket tự ghép · artist
      const p = overlayData.payload;
      const songOnly =
        p.song_title || p.song_name || p.name || optionsDataObj.caption || "";
      if (songOnly) {
        optionsDataObj.caption = songOnly;
        optionsDataObj.text = songOnly;
      }
    }

    if (videoCropData) {
      optionsDataObj.videoCropData = videoCropData;
    }

    // Thêm selectedGroupId vào optionsData nếu có
    if (selectedGroupId) {
      optionsDataObj.selectedGroupId = selectedGroupId;
    }

    // Ưu tiên restoreStreakData, nếu không có mới dùng streakData
    if (restoreStreakData?.mode === "restore") {
      optionsDataObj.restoreStreakDate = restoreStreakData;
      optionsDataObj.restoreStreakData = restoreStreakData;
    } else if (streakData) {
      optionsDataObj.streakData = streakData;
    }

    // Tạo payload cuối cùng
    const payload = {
      model: "Version-UploadmediaV3.1",
      mediaInfo,
      contentType: previewType,
      optionsData: optionsDataObj, // Thêm optionsData vào payload
    };

    return payload;
  } catch (error) {
    console.error("Lỗi khi tạo payload:", error);
    throw error;
  }
};
