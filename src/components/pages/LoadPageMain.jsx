import React from "react";
import { Zoomies } from "ldrs/react";
import "ldrs/react/Zoomies.css";
import "./styles.css";
import clsx from "clsx";
import { useTranslation } from "react-i18next";

const LoadingPageMain = ({ isLoading }) => {
  const { t } = useTranslation("public");

  return (
    <div
      className={clsx(
        "fixed inset-0 flex flex-col items-center justify-center z-50 bg-base-100 gap-2 text-base-content transition-opacity duration-700",
        {
          "opacity-100": isLoading,
          "opacity-0 pointer-events-none": !isLoading,
        },
      )}
    >
      <div>
        <img
          src="/apple-touch-icon.png"
          alt="Huy Locket"
          width={80}
          height={80}
          decoding="async"
          fetchPriority="high"
          className="w-20 h-20 shadow-md rounded-2xl loading-bounce-y"
        />
      </div>

      <h1 className="text-xl font-semibold">{t("loading_page.title")}</h1>

      <p className="text-sm opacity-70 animate-pulse">
        {t("loading_page.description")}
      </p>

      <Zoomies
        size="80"
        stroke="5"
        bgOpacity="0.1"
        speed="1.4"
        color="currentColor"
      />
    </div>
  );
};

export default LoadingPageMain;
