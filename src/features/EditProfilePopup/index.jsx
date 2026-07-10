import { SonnerInfo } from "@/components/ui/SonnerToast";
import { useAuthStore } from "@/stores";
import { getAvatarOrFallback } from "@/utils";
import clsx from "clsx";
import { X } from "lucide-react";
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { useTranslation } from "react-i18next";

const EditProfilePopup = ({ open, onClose }) => {
  const [showModal, setShowModal] = useState(false);
  const [animate, setAnimate] = useState(false);

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
      setTimeout(() => setShowModal(false), 500);
    }
  }, [open]);

  const { t } = useTranslation("features");

  const user = useAuthStore((s) => s.user);
  const [editingName, setEditingName] = useState(false);

  const [firstName, setFirstName] = useState("Dio");
  const [lastName, setLastName] = useState("Nguyen");

  useEffect(() => {
    if (!user) return;

    setFirstName(user.firstName ?? "");
    setLastName(user.lastName ?? "");
  }, [user]);

  if (!showModal) return null;

  return ReactDOM.createPortal(
    <div
      className={clsx(
        "fixed inset-0 bg-base-100/30 backdrop-blur-[4px] transition-opacity duration-500 z-[62]",
        {
          "opacity-100": animate,
          "opacity-0 pointer-events-none": !animate,
        },
      )}
      onClick={onClose}
    >
      <div
        className={clsx(
          "fixed border-t border-base-300 bottom-0 left-0 w-full h-4/5 bg-base-100 rounded-t-4xl shadow-xl transition-all duration-500 z-[63] flex flex-col text-base-content",
          {
            "translate-y-0": animate,
            "translate-y-full": !animate,
          },
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative flex items-center justify-center border-b border-base-300 px-4 py-3">
          <h3 className="text-xl font-semibold">
            {t("edit_profile_popup.title")}
          </h3>
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2"
            onClick={onClose}
          >
            <X className="w-8 h-8 btn btn-circle p-1" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-8">
          {/* Avatar */}
          <section className="space-y-3">
            <h4 className="text-sm font-medium text-base-content/60">
              {t("edit_profile_popup.avatar.title")}
            </h4>

            <div className="rounded-3xl bg-base-200 p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <img
                  src={getAvatarOrFallback(user?.profilePicture)}
                  alt="Avatar"
                  className="w-18 h-18 rounded-full object-cover border-2 border-base-300"
                />

                <div className="space-y-1">
                  <p className="font-semibold">
                    {t("edit_profile_popup.avatar.profile_photo")}
                  </p>

                  <p className="text-sm text-base-content/60">
                    {t("edit_profile_popup.avatar.description")}
                  </p>
                </div>
              </div>

              <button
                className="btn btn-primary btn-sm rounded-xl"
                onClick={() => SonnerInfo(t("edit_profile_popup.actions.coming_soon"))}
              >
                {t("edit_profile_popup.avatar.change")}
              </button>
            </div>
          </section>

          {/* Display name */}
          <section className="space-y-3">
            <h4 className="text-sm font-medium text-base-content/60">
              {t("edit_profile_popup.name.title")}
            </h4>

            <div className="rounded-3xl bg-base-200 p-5">
              {!editingName ? (
                <div className="flex items-center justify-between gap-6">
                  <div className="min-w-0">
                    <p className="font-semibold text-lg truncate">
                      {firstName} {lastName}
                    </p>

                    <p className="text-sm text-base-content/60 mt-1">
                      {t("edit_profile_popup.name.description")}
                    </p>
                  </div>

                  <button
                    className="btn btn-outline btn-sm rounded-xl"
                    onClick={() => SonnerInfo(t("edit_profile_popup.actions.coming_soon"))}
                  >
                    {t("edit_profile_popup.actions.edit")}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="label">
                      <span className="label-text">
                        {t("edit_profile_popup.name.first_name")}
                      </span>
                    </label>

                    <input
                      className="input input-bordered w-full"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="label">
                      <span className="label-text">
                        {t("edit_profile_popup.name.last_name")}
                      </span>
                    </label>

                    <input
                      className="input input-bordered w-full"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      className="btn btn-ghost"
                      onClick={() => setEditingName(false)}
                    >
                      {t("edit_profile_popup.actions.cancel")}
                    </button>

                    <button
                      className="btn btn-primary"
                      onClick={() => {
                        setEditingName(false);
                        SonnerInfo(t("edit_profile_popup.actions.coming_soon"));
                      }}
                    >
                      {t("edit_profile_popup.actions.save")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Email */}
          <section className="space-y-3">
            <h4 className="text-sm font-medium text-base-content/60">
              {t("edit_profile_popup.email.title")}
            </h4>

            <div className="rounded-3xl bg-base-200 p-5">
              <p className="font-semibold break-all">{user?.email}</p>

              <p className="text-sm text-base-content/60 mt-2">
                {t("edit_profile_popup.email.description")}
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default EditProfilePopup;
