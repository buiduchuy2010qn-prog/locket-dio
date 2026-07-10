import React, { useEffect, useState } from "react";
import clsx from "clsx";
import ReactDOM from "react-dom";
import { Users, X } from "lucide-react";
import { SonnerPromise, SonnerInfo } from "@/components/ui/SonnerToast";
import { updateGroupName } from "@/services";
import { useTranslation } from "react-i18next";

const EditGroupPoup = ({
  open,
  onClose,
  group,
  onUpdated,
  loading = false,
}) => {
  const { t } = useTranslation("main");
  const [showModal, setShowModal] = useState(false);
  const [animate, setAnimate] = useState(false);

  const [name, setName] = useState(group?.name || "");
  const [avatar, setAvatar] = useState(group?.image_url || null);

  const [loadingField, setLoadingField] = useState(null);

  useEffect(() => {
    setName(group?.name || "");
    setAvatar(group?.image_url || null);
  }, [group]);

  useEffect(() => {
    document.body.style.overflow = showModal ? "hidden" : "";
    return () => (document.body.style.overflow = "");
  }, [showModal]);

  useEffect(() => {
    if (open) {
      setShowModal(true);
      setTimeout(() => setAnimate(true), 10);
    } else {
      setAnimate(false);
      setTimeout(() => setShowModal(false), 300);
    }
  }, [open]);

  if (!showModal) return null;

  // SAVE NAME
  const handleSaveName = () => {
    setLoadingField("name");

    const promise = updateGroupName({
      groupId: group.id,
      name,
    });

    SonnerPromise(promise, {
      loading: t("right.updating_group_name"),
      success: (res) => {
        if (res) onUpdated?.(res);
        return t("right.update_success");
      },
      error: t("right.update_failed"),
    });

    promise.finally(() => setLoadingField(null));
  };

  // CHANGE AVATAR (placeholder)
  const handleChangeAvatar = () => {
    SonnerInfo(t("right.change_photo_soon"));
  };

  return ReactDOM.createPortal(
    <div
      className={clsx(
        "fixed inset-0 bg-base-100/30 backdrop-blur-[4px] transition-opacity duration-500 z-[80]",
        {
          "opacity-100": animate,
          "opacity-0 pointer-events-none": !animate,
        },
      )}
      onClick={!loading ? onClose : undefined}
    >
      <div
        className={clsx(
          "fixed h-2/3 border-t border-base-300 bottom-0 left-0 w-full pt-6 pb-6 px-5 bg-base-100 rounded-t-4xl shadow-lg transition-all duration-500 z-[81] flex flex-col text-base-content",
          {
            "translate-y-0": animate,
            "translate-y-full": !animate,
          },
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button onClick={onClose} className="absolute top-2 right-3">
          <X className="w-8 h-8 btn btn-circle p-1" />
        </button>
        {/* TITLE */}
        <h3 className="text-xl font-semibold text-center mb-6">
          {t("right.edit_group")}
        </h3>

        <div className="flex-1 space-y-5">
          {/* Avatar Card */}
          <div className="card bg-base-200 shadow-sm">
            <div className="card-body items-center text-center">
              <div className="relative">
                {avatar ? (
                  <img
                    src={avatar}
                    alt="Group avatar"
                    className="w-24 h-24 rounded-full object-cover border-2 border-base-300"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="w-10 h-10 text-primary" />
                  </div>
                )}
              </div>

              <button
                onClick={handleChangeAvatar}
                className="btn btn-outline btn-primary btn-sm rounded-full mt-2"
              >
                {t("right.update_group_photo")}
              </button>
            </div>
          </div>

          {/* Name Card */}
          <div className="card bg-base-200 shadow-sm">
            <div className="card-body">
              <label className="text-sm font-medium text-base-content/70">
                {t("right.group_name")}
              </label>

              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="text-base text-base-content rounded-4xl input
            font-semibold bg-base-100 py-6 px-4 w-full max-w-full
            focus:outline-none focus:bg-base-300
            transition-all duration-300 ease-in-out placeholder:opacity-20"
                placeholder={t("right.enter_group_name_placeholder")}
              />

              <button
                onClick={handleSaveName}
                disabled={
                  loadingField === "name" ||
                  !name.trim() ||
                  name.trim() === group?.name
                }
                className="btn btn-primary rounded-xl"
              >
                {loadingField === "name" ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  t("right.update_group_name_btn")
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default EditGroupPoup;
