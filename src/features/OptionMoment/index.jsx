import React, { useState, useEffect } from "react";
import { Download, Repeat, Share, Trash2, X } from "lucide-react";
import PlanBadge from "@/components/ui/PlanBadge/PlanBadge";
import {
  SonnerSuccess,
  SonnerWarning,
  SonnerInfo,
} from "@/components/ui/SonnerToast";
import Modal from "@/components/ui/Modal";
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
  const setSelectedFriendUid = useSelectedStore((s) => s.setSelectedFriendUid);

  const [openModal, setOpenModal] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const removeMoment = useMomentsStoreV2((s) => s.removeMoment);

  const { removeUploadItemById } = useUploadQueueStore();
  // Lock scroll khi mở modal
  useEffect(() => {
    document.body.style.overflow = isOptionModalOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOptionModalOpen]);

  const handleClose = () => {
    setSelectedMoment(null);
    setSelectedQueue(null);
    setSelectedQueueId(null);
    setSelectedMomentId(null);
  };

  const handleDelete = async () => {
    if (selectedMomentId !== null) {
      try {
        //Call API xoá ảnh
        const deletedMoment = await DeleteMoment(selectedMomentId);
        if (deletedMoment === selectedMomentId) {
          //Xoá ảnh trong local nếu id đã xoá trùng id chọn
          await removeMoment(selectedMomentId, selectedFriendUid);
          SonnerSuccess(t("option_moment.delete_success"));
          handleClose();
        } else {
          SonnerWarning(t("option_moment.delete_failed"));
        }
      } catch (error) {
        SonnerWarning(t("option_moment.delete_failed"));
        console.warn("❌ Failed", error);
      }
      return;
    }

    if (selectedQueueId !== null) {
      await removeUploadItemById(selectedQueueId);
      SonnerSuccess(t("option_moment.delete_queue_success"));
      handleClose();
    }
  };

  const getMediaInfo = async () => {
    if (selectedQueueId !== null) {
      const data = await getUploadItemFromDB(selectedQueueId);
      if (!data) return null;

      const { url, publicUrl, publicURL, type } = data.mediaInfo || {};
      const mediaUrl = publicUrl || publicURL || url;

      if (!mediaUrl) return null;

      return {
        url: mediaUrl,
        filename: `moment_${selectedQueueId}.${type === "video" ? "mp4" : "jpg"}`,
      };
    }

    if (selectedMomentId !== null) {
      const data = await getMomentById(selectedMomentId);
      if (!data) return null;

      if (data.videoUrl) {
        return {
          url: data.videoUrl,
          filename: `moment_${selectedMomentId}.mp4`,
        };
      }

      if (data.thumbnailUrl) {
        return {
          url: data.thumbnailUrl,
          filename: `moment_${selectedMomentId}.jpg`,
        };
      }
    }

    return null;
  };

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    SonnerInfo(t("option_moment.preparing_download"));

    try {
      const media = await getMediaInfo();
      if (!media) {
        SonnerInfo(t("option_moment.no_media_to_download"));
        return;
      }

      // Nút tải → lưu thẳng về máy (không share sheet)
      await downloadFileToDevice(media.url, media.filename, () =>
        setDownloading(false),
      );
    } catch (err) {
      SonnerWarning(t("option_moment.download_error"));
      console.error(err);
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
      if (!media) {
        SonnerInfo(t("option_moment.no_media_to_download"));
        return;
      }

      // Nút chia sẻ → share sheet
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
        onClick={() => onClose(false)}
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
              onClick={() => SonnerInfo(t("option_moment.feature_coming_soon"))}
              className="btn btn-secondary rounded-3xl w-full flex items-center justify-center gap-2"
            >
              {/* Icon repost */}
              <Repeat size={20} />
              {t("option_moment.repost")}
            </button>

            <button
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

            <button
              onClick={() => {
                setOptionModalOpen(false);
                setOpenModal(true);
              }}
              className="btn btn-error rounded-3xl w-full flex items-center justify-center gap-2"
            >
              <Trash2 size={20} /> {t("option_moment.delete")}
            </button>
          </div>
        </div>
      </div>

      {/* Modal xoá giữ nguyên */}
      <Modal
        open={openModal}
        onClose={() => setOpenModal(false)}
        title={t("option_moment.delete_modal_title")}
        actions={
          <>
            <button
              onClick={() => setOpenModal(false)}
              className="btn btn-soft px-4 py-2 rounded-xl transition-colors"
            >
              {t("option_moment.delete_modal_cancel")}
            </button>
            <button
              onClick={() => {
                handleDelete();
                setOpenModal(false);
              }}
              className="btn btn-error px-4 py-2 rounded-xl transition-colors"
            >
              {t("option_moment.delete_modal_confirm")}
            </button>
          </>
        }
      >
        {t("option_moment.delete_modal_content")}
      </Modal>
    </>
  );
};

export default OptionMoment;
