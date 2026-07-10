import {
  useLanguageStore,
  useReadReceipts,
  useShareHistory,
  useUserSetting,
} from "@/stores";
import clsx from "clsx";
import {
  CheckCheck,
  Eye,
  History,
  UserRoundSearch,
  X,
  ChevronRight,
  Languages,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import LanguagePopup from "../LanguagePopup";
import { useTranslation } from "react-i18next";
import { LANGUAGE_NAMES } from "@/constants";

const SettingPoup = ({ open, onClose }) => {
  const [showModal, setShowModal] = useState(false);
  const [animate, setAnimate] = useState(false);

  const [openLanguage, setOpenLanguage] = useState(false);

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

  const showSeenMoments = useUserSetting((s) => s.showSeenMoments);
  const toggleSeenMoments = useUserSetting((s) => s.toggleSeenMoments);

  const allowSearch = useUserSetting((s) => s.allowSearch);
  const toggleAllowSearch = useUserSetting((s) => s.toggleAllowSearch);

  const { sendReadReceipts, toggleReadReceipts } = useReadReceipts();
  const { shareHistoryOn, toggleShareHistoryOn } = useShareHistory();

  const language = useLanguageStore((s) => s.language);

  const languageItems = [
    {
      key: "language",
      icon: Languages,
      title: t("setting_poup.language.title"),
      value: LANGUAGE_NAMES[language]?.name ?? "Tiếng Việt",
      onClick: () => setOpenLanguage(true),
      right: <ChevronRight className="w-5 h-5 text-base-content/40" />,
    },
  ];

  const privacyItems = [
    {
      key: "seen",
      icon: Eye,
      title: t("setting_poup.privacy.seen_moments.title"),
      description: t("setting_poup.privacy.seen_moments.description"),
      checked: showSeenMoments,
      onChange: toggleSeenMoments,
    },
    {
      key: "history",
      icon: History,
      title: t("setting_poup.privacy.share_history.title"),
      description: t("setting_poup.privacy.share_history.description"),
      checked: shareHistoryOn,
      onChange: toggleShareHistoryOn,
    },
    {
      key: "receipt",
      icon: CheckCheck,
      title: t("setting_poup.privacy.read_receipts.title"),
      description: t("setting_poup.privacy.read_receipts.description"),
      checked: sendReadReceipts,
      onChange: toggleReadReceipts,
      disabled: true,
    },
    {
      key: "search",
      icon: UserRoundSearch,
      title: t("setting_poup.privacy.allow_search.title"),
      description: t("setting_poup.privacy.allow_search.description"),
      checked: allowSearch,
      onChange: toggleAllowSearch,
      disabled: true,
    },
  ];

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
      onClick={() => {
        if (!openLanguage) onClose();
      }}
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
          <h3 className="text-xl font-semibold">{t("setting_poup.title")}</h3>
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2"
            onClick={onClose}
          >
            <X className="w-8 h-8 btn btn-circle p-1" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          <div>
            <p className="text-sm text-base-content/60 mb-2">
              {t("setting_poup.language.section")}
            </p>

            <div className="bg-base-200 rounded-2xl divide-y divide-base-300">
              {languageItems.map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.key}
                    className="flex items-center justify-between px-4 py-3 cursor-pointer"
                    onClick={item.onClick}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-base-300">
                        <Icon className="w-5 h-5" />
                      </div>

                      <div>
                        <p className="font-medium">{item.title}</p>
                        <p className="text-xs text-base-content/60">
                          {item.value}
                        </p>
                      </div>
                    </div>

                    {item.right}
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-sm text-base-content/60 mb-2">
              {t("setting_poup.privacy.section")}
            </p>

            <div className="bg-base-200 rounded-2xl divide-y divide-base-300">
              {privacyItems.map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.key}
                    className="flex items-center justify-between px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-base-300 flex-shrink-0">
                        <Icon className="w-5 h-5" />
                      </div>

                      <div>
                        <p className="font-medium">{item.title}</p>
                        <p className="text-xs text-base-content/60">
                          {item.description}
                        </p>
                      </div>
                    </div>

                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={item.onChange}
                      disabled={item.disabled}
                      className="toggle toggle-secondary"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <LanguagePopup
        open={openLanguage}
        onClose={() => setOpenLanguage(false)}
      />
    </div>,
    document.body,
  );
};

export default SettingPoup;
