import React, { useState, useEffect, useCallback } from "react";
import { Download, Repeat, Share, Trash2, X } from "lucide-react";
import PlanBadge from "@/components/uikit/PlanBadge/PlanBadge";
import {
  SonnerSuccess,
  SonnerWarning,
  SonnerInfo,
  SonnerError,
} from "@/components/uikit/SonnerToast";
import ConfirmDeleteModal from "@/components/uikit/ConfirmDeleteModal";
import {
  DeleteMoment,
  downloadFileToDevice,
  shareFile,
} from "@/services";
import { getMomentById } from "@/cache/momentDB";
import {
  useMomentsStoreV2,
  useSelectedStore,
  useUploadQueueStore,
} from "@/stores";
import { getUploadItemFromDB } from "@/cache/uploadMomentDB";
import clsx from "clsx";
import { useTranslation } from "react-i18next";

/** Resolve media URL from moment object (snake_case + camelCase + legacy). */
function resolveMomentMedia(data, idFallback = "moment") {
  if (!data || typeof data !== "object") return null;

  const video =
    data.video_url ||
    data.videoUrl ||
    data.video ||
    data.media?.video_url ||
    null;
  const image =
    data.image_url ||
    data.imageUrl ||
    data.thumbnail_url ||
    data.thumbnailUrl ||
    data.thumbnail ||
    data.media?.image_url ||
    data.media?.thumbnail_url ||
    null;

  const id = data.id || idFallback || "moment";

  if (video && typeof video === "string" && video.startsWith("http")) {
    return { url: video, filename: `huylocket_${id}.mp4`, mediaType: "video" };
  }
  if (image && typeof image === "string" && image.startsWith("http")) {
    const ext = /\.png(\?|$)/i.test(image)
      ? "png"
      : /\.webp(\?|$)/i.test(image)
        ? "webp"
        : "jpg";
    return {
      url: image,
      filename: `huylocket_${id}.${ext}`,
      mediaType: "image",
    };
  }
  // blob: / data: (queue local)
  if (video && typeof video === "string") {
    return { url: video, filename: `huylocket_${id}.mp4`, mediaType: "video" };
  }
  if (image && typeof image === "string") {
    return { url: image, filename: `huylocket_${id}.jpg`, mediaType: "image" };
  }
  return null;
}

const OptionMoment = ({ setOptionModalOpen, isOptionModalOpen }) => {
  const { t } = useTranslation("features");
  const selectedMoment = useSelectedStore((s) => s.selectedMoment);
  const setSelectedMoment = useSelectedStore((s) => s.setSelectedMoment);

  const selectedQueue = useSelectedStore((s) => s.selectedQueue);
  const setSelectedQueue = useSelectedStore((s) => s.setSelectedQueue);

  const selectedMomentId = useSelectedStore((s) => s.selectedMomentId);
  const setSelectedMomentId = useSelectedStore((s) => s.setSelectedMomentId);

  const selectedQueueId = useSelectedStore((s) => s.selectedQueueId);
  const setSelectedQueueId = useSelectedStore((s) => s.setSelectedQueueId);

  const selectedFriendUid = useSelectedStore((s) => s.selectedFriendUid);

  const [openModal, setOpenModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [previewInfo, setPreviewInfo] = useState(null);
  const removeMoment = useMomentsStoreV2((s) => s.removeMoment);

  const selectedKey = selectedFriendUid ?? "all";
  const moments =
    useMomentsStoreV2((s) => s.momentsByUser[selectedKey]?.moments) ?? [];

  const { removeUploadItemById } = useUploadQueueStore();

  useEffect(() => {
    document.body.style.overflow = isOptionModalOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOptionModalOpen]);

  const handleClose = useCallback(() => {
    setSelectedMoment(null);
    setSelectedQueue(null);
    setSelectedQueueId(null);
    setSelectedMomentId(null);
    setOptionModalOpen(false);
  }, [
    setOptionModalOpen,
    setSelectedMoment,
    setSelectedMomentId,
    setSelectedQueue,
    setSelectedQueueId,
  ]);

  // Load preview for confirm modal when opening delete
  useEffect(() => {
    if (!openModal) {
      setPreviewInfo(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        if (selectedQueueId != null) {
          const data = await getUploadItemFromDB(selectedQueueId);
          const info = data?.mediaInfo || data?.media || {};
          const mediaUrl =
            info.publicUrl ||
            info.publicURL ||
            info.url ||
            info.thumbnailUrl ||
            info.thumbnail_url ||
            data?.publicUrl ||
            data?.url;
          const type =
            info.type ||
            data?.type ||
            (String(mediaUrl || "").includes(".mp4") ? "video" : "image");
          if (!cancelled && mediaUrl) {
            setPreviewInfo({ url: mediaUrl, mediaType: type });
          }
          return;
        }
        if (selectedMomentId != null) {
          const fromStore =
            moments.find((m) => m?.id === selectedMomentId) ||
            (typeof selectedMoment === "number"
              ? moments[selectedMoment]
              : null) ||
            (selectedMoment && typeof selectedMoment === "object"
              ? selectedMoment
              : null);
          const resolved =
            resolveMomentMedia(fromStore, selectedMomentId) ||
            resolveMomentMedia(
              await getMomentById(selectedMomentId),
              selectedMomentId,
            );
          if (!cancelled && resolved) {
            setPreviewInfo({
              url: resolved.url,
              mediaType: resolved.mediaType || "image",
            });
          }
        }
      } catch {
        /* preview optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [openModal, selectedMomentId, selectedQueueId, moments, selectedMoment]);

  /**
   * Only call delete API / remove after user confirms red button.
   * Keep modal open + show loading until server succeeds.
   * Do NOT remove post from UI on failure. No Undo for posted moments.
   */
  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);

    try {
      if (selectedMomentId !== null) {
        try {
          const deletedMoment = await DeleteMoment(selectedMomentId);
          if (deletedMoment === selectedMomentId) {
            await removeMoment(selectedMomentId, selectedFriendUid);
            SonnerSuccess(
              t("option_moment.delete_success", {
                defaultValue: "Đã xóa",
              }),
            );
            setOpenModal(false);
            handleClose();
          } else {
            SonnerError(
              t("option_moment.delete_failed_retry", {
                defaultValue: "Không thể xóa bài. Vui lòng thử lại.",
              }),
            );
          }
        } catch (error) {
          SonnerError(
            t("option_moment.delete_failed_retry", {
              defaultValue: "Không thể xóa bài. Vui lòng thử lại.",
            }),
          );
          console.warn("❌ Failed", error);
        }
        return;
      }

      if (selectedQueueId !== null) {
        await removeUploadItemById(selectedQueueId);
        SonnerSuccess(t("option_moment.delete_queue_success"));
        setOpenModal(false);
        handleClose();
      }
    } finally {
      setDeleting(false);
    }
  };

  const getMediaInfo = async () => {
    // 1) Upload queue item
    if (selectedQueueId !== null) {
      const data = await getUploadItemFromDB(selectedQueueId);
      if (data) {
        const info = data.mediaInfo || data.media || {};
        const mediaUrl =
          info.publicUrl ||
          info.publicURL ||
          info.url ||
          info.thumbnailUrl ||
          info.thumbnail_url ||
          data.publicUrl ||
          data.url;
        const type =
          info.type ||
          data.type ||
          (String(mediaUrl || "").includes(".mp4") ? "video" : "image");
        if (mediaUrl) {
          return {
            url: mediaUrl,
            filename: `huylocket_queue_${selectedQueueId}.${type === "video" ? "mp4" : "jpg"}`,
          };
        }
      }
    }

    // 2) Live feed store
    if (selectedMomentId != null) {
      const fromStore =
        moments.find((m) => m?.id === selectedMomentId) ||
        (typeof selectedMoment === "number" ? moments[selectedMoment] : null) ||
        (selectedMoment && typeof selectedMoment === "object"
          ? selectedMoment
          : null);

      const resolvedStore = resolveMomentMedia(fromStore, selectedMomentId);
      if (resolvedStore) return resolvedStore;

      const data = await getMomentById(selectedMomentId);
      const resolvedDb = resolveMomentMedia(data, selectedMomentId);
      if (resolvedDb) return resolvedDb;
    }

    return null;
  };

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    SonnerInfo(t("option_moment.preparing_download"));

    try {
      const media = await getMediaInfo();
      if (!media?.url) {
        SonnerWarning(t("option_moment.no_media_to_download"));
        return;
      }

      await downloadFileToDevice(media.url, media.filename, () =>
        setDownloading(false),
      );
      SonnerSuccess(
        t("option_moment.download_success", {
          defaultValue: "Đã tải xuống thành công!",
        }),
      );
    } catch (err) {
      SonnerWarning(t("option_moment.download_error"));
      console.error("[OptionMoment] download failed:", err);
    } finally {
      setDownloading(false);
    }
  };

  const handleSharing = async () => {
    if (sharing) return;
    setSharing(true);
    SonnerInfo(t("option_moment.preparing_share"));

    try {
      const media = await getMediaInfo();
      if (!media?.url) {
        SonnerWarning(t("option_moment.no_media_to_download"));
        return;
      }

      await shareFile(media.url, media.filename, () => setSharing(false));
    } catch (err) {
      SonnerWarning(t("option_moment.share_error"));
      console.error(err);
    } finally {
      setSharing(false);
    }
  };

  return (
    <>
      <div
        className={clsx(
          "fixed inset-0 bg-base-100/30 backdrop-blur-[4px] transition-opacity duration-500 z-[62]",
          {
            "opacity-100": isOptionModalOpen,
            "opacity-0 pointer-events-none": !isOptionModalOpen,
          },
        )}
        onClick={handleClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className={clsx(
            "fixed border-t border-base-300 bottom-0 left-0 w-full bg-base-100 rounded-t-4xl shadow-lg transition-all duration-500 ease-in-out z-[63] flex flex-col text-base-content p-3 pb-4",
            {
              "translate-y-0 opacity-100": isOptionModalOpen,
              "translate-y-full opacity-0": !isOptionModalOpen,
            },
          )}
        >
          {/* Header */}
          <div className="flex justify-between items-center rounded-t-4xl">
            <div className="flex items-center space-x-2">
              <div className="text-2xl font-lovehouse mt-1.5 font-semibold">
                Option Moment
              </div>
              <PlanBadge />
            </div>
            <button
              type="button"
              onClick={() => setOptionModalOpen(false)}
              className="btn btn-circle cursor-pointer hover:bg-base-200 p-1"
            >
              <X size={24} />
            </button>
          </div>
          <p className="text-left text-sm mt-4 text-base-content/70">
            {t("option_moment.description")} {selectedQueue}
          </p>
          <div className="w-full grid grid-cols-2 md:grid-cols-3 gap-3 mt-6">
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="btn btn-neutral rounded-3xl flex items-center justify-center gap-2"
            >
              {downloading ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  {t("option_moment.loading")}
                </>
              ) : (
                <>
                  <Download size={20} /> {t("option_moment.download")}
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => SonnerInfo(t("option_moment.feature_coming_soon"))}
              className="btn btn-secondary rounded-3xl w-full flex items-center justify-center gap-2"
            >
              <Repeat size={20} />
              {t("option_moment.repost")}
            </button>

            <button
              type="button"
              onClick={handleSharing}
              disabled={sharing}
              className="btn btn-info rounded-3xl flex items-center justify-center gap-2"
            >
              {sharing ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  {t("option_moment.loading")}
                </>
              ) : (
                <>
                  <Share size={20} />
                  {t("option_moment.share")}
                </>
              )}
            </button>

            {/* Delete separated from primary actions — opens confirm only */}
            <button
              type="button"
              onClick={() => {
                setOptionModalOpen(false);
                setOpenModal(true);
              }}
              className="btn btn-error rounded-3xl w-full flex items-center justify-center gap-2 col-span-2 md:col-span-1 md:col-start-auto"
            >
              <Trash2 size={20} /> {t("option_moment.delete")}
            </button>
          </div>
        </div>
      </div>

      <ConfirmDeleteModal
        open={openModal}
        onClose={() => {
          if (!deleting) setOpenModal(false);
        }}
        onConfirm={handleDelete}
        loading={deleting}
        title={
          t("option_moment.delete_confirm_title", {
            defaultValue: "Bạn chắc chắn muốn xóa bài này?",
          })
        }
        description={
          t("option_moment.delete_confirm_desc", {
            defaultValue: "Hành động này có thể không hoàn tác được.",
          })
        }
        keepLabel={
          t("option_moment.delete_keep", {
            defaultValue: "Giữ lại",
          })
        }
        deleteLabel={
          t("option_moment.delete_confirm_btn", {
            defaultValue: "Xóa bài",
          })
        }
        loadingLabel={
          t("option_moment.deleting", {
            defaultValue: "Đang xóa…",
          })
        }
        previewUrl={previewInfo?.url || null}
        mediaType={previewInfo?.mediaType || "image"}
      />
    </>
  );
};

export default OptionMoment;
