import clsx from "clsx";
import { Check, X } from "lucide-react";
import { useLanguageStore } from "@/stores";
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { useTranslation } from "react-i18next";
import { LANGUAGES } from "@/constants";

const LanguagePopup = ({ open, onClose }) => {
  const { t } = useTranslation("features");
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

  const currentLanguage = useLanguageStore((s) => s.language);
  const changeLanguage = useLanguageStore((s) => s.changeLanguage);
    
  if (!showModal) return null;

  return ReactDOM.createPortal(
    <div
      className={clsx(
        "fixed inset-0 bg-base-100/30 backdrop-blur-[4px] transition-opacity duration-500 z-[70]",
        {
          "opacity-100": animate,
          "opacity-0 pointer-events-none": !animate,
        },
      )}
      onClick={onClose}
    >
      <div
        className={clsx(
          "fixed border-t border-base-300 bottom-0 left-0 w-full h-[70%] bg-base-100 rounded-t-4xl shadow-xl transition-all duration-500 z-[71] flex flex-col text-base-content",
          {
            "translate-y-0": animate,
            "translate-y-full": !animate,
          },
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative flex items-center justify-center border-b border-base-300 px-4 py-3">
          <h3 className="text-xl font-semibold">{t("language_popup.title")}</h3>
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2"
            onClick={onClose}
          >
            <X className="w-8 h-8 btn btn-circle p-1" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="bg-base-200 rounded-2xl divide-y divide-base-300">
            {LANGUAGES.map((item) => (
              <button
                key={item.code}
                onClick={() => {
                  changeLanguage(item.code);
                  onClose();
                }}
                className="w-full flex items-center justify-between px-4 py-3 text-left active:bg-base-300 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="text-3xl">{item.flag}</div>

                  <div>
                    <p className="font-medium">{item.name}</p>

                    <p className="text-sm text-base-content/60">
                      {item.native}
                    </p>
                  </div>
                </div>

                {currentLanguage === item.code && (
                  <Check className="w-5 h-5 text-primary" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default LanguagePopup;
