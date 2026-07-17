import React from "react";
import { ChevronDown, Images } from "lucide-react";
import { useTranslation } from "react-i18next";

const HistoryArrow = ({ setIsBottomOpen, isOpen = false }) => {
  const { t } = useTranslation("main");

  return (
    <button
      type="button"
      className="historyChip"
      onClick={() => setIsBottomOpen(true)}
      aria-label={t("home.history")}
      aria-expanded={isOpen}
    >
      <Images size={18} strokeWidth={2.2} aria-hidden />
      <span>{t("home.history")}</span>
      <ChevronDown
        size={18}
        strokeWidth={2.5}
        className={isOpen ? "rotate-180" : ""}
        aria-hidden
      />
    </button>
  );
};

export default HistoryArrow;
