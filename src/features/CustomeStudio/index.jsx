import { Palette, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useApp } from "@/context/AppContext";
import GeneralThemes from "./components/GeneralSections";
import PlanBadge from "@/components/ui/PlanBadge/PlanBadge";
import Footer from "@/components/Footer";
import { useFeatureVisible } from "@/hooks/useFeature";
import SavedCaptions from "./components/SavedSections";
import {
  useOverlayDataStore,
  useOverlayUserStore,
} from "@/stores/OverlayStores";
import CaptionSections from "./components/OverlaySections";
import { useOverlayEditorStore } from "@/stores";
import { SonnerInfo } from "@/components/ui/SonnerToast";
import NotesSection from "./components/NotesSection";
import clsx from "clsx";

const ScreenCustomeStudio = () => {
  const { t } = useTranslation("features");
  const popupRef = useRef(null);
  const { navigation } = useApp();

  const { isFilterOpen, setIsFilterOpen } = navigation;
  const { userCaptions } = useOverlayUserStore();
  const sectionOverlays = useOverlayDataStore((s) => s.sectionOverlays);

  const updateOverlayEditor = useOverlayEditorStore(
    (s) => s.updateOverlayEditor,
  );
  const resetOverlayEditor = useOverlayEditorStore((s) => s.resetOverlayEditor);

  const savedCaptionSection = sectionOverlays.find(
    (s) => s.section_id === "saved_caption",
  );

  const canShowSavedCaptions = savedCaptionSection?.active ?? false;

  const canUseCaptionGif = useFeatureVisible("caption_gif");
  const canUseCaptionIcon = useFeatureVisible("caption_icon");
  const canUseCaptionimage = useFeatureVisible("caption_image");

  useEffect(() => {
    document.body.style.overflow = isFilterOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [isFilterOpen]);

  const handleSelectCaption = (caption) => {
    resetOverlayEditor();
    // console.log("Chọn caption:", caption);

    updateOverlayEditor({
      ...caption,
      overlay_id: caption?.overlay_id || caption?.id || "standard",

      text_color: caption.text_color || "#FFFFFF",
      text: caption?.text || "",
      type: caption?.type || "default",

      caption: caption?.text || "",
      color_top: caption.colortop || "",
      color_bottom: caption.colorbottom || "",
    });

    // SonnerInfo("DATA", JSON.stringify(caption, null, 2));

    setIsFilterOpen(false);
    // Xử lý khi chọn caption
  };

  return (
    <div
      className={clsx(
        "fixed inset-0 bg-base-100/10 backdrop-blur-[4px] transition-opacity duration-500 z-[62]",
        {
          "opacity-100": isFilterOpen,
          "opacity-0 pointer-events-none": !isFilterOpen,
        },
      )}
      onClick={() => setIsFilterOpen(false)}
    >
      {/* Popup */}
      <div
        ref={popupRef}
        onClick={(e) => e.stopPropagation()}
        className={clsx(
          "fixed border-t border-base-300 bottom-0 left-0 w-full h-2/3 bg-base-100 rounded-t-4xl shadow-lg transition-all duration-500 z-[63] flex flex-col text-base-content",
          {
            "translate-y-0 opacity-100": isFilterOpen,
            "translate-y-full opacity-0": !isFilterOpen,
          },
        )}
      >
        {/* Header - Ghim cố định */}
        <div className="flex justify-between rounded-t-4xl items-center py-2 px-4 bg-base-100 sticky top-0 left-0 right-0 z-50">
          <div className="flex items-center space-x-2 text-primary">
            <Palette size={22} />
            <div className="text-2xl font-lovehouse mt-1.5 font-semibold">
              Customize studio{" "}
            </div>
            <PlanBadge />
          </div>
          <button
            onClick={() => setIsFilterOpen(false)}
            className="text-primary cursor-pointer"
          >
            <X size={30} />
          </button>
        </div>
        {/* Nội dung - Cuộn được */}
        <div className="flex-1 overflow-y-auto space-y-4">
          <GeneralThemes
            title={t("custom_studio.general_title")}
            onSelect={handleSelectCaption}
          />

          <CaptionSections
            sections={sectionOverlays}
            onSelect={handleSelectCaption}
          />

          {canShowSavedCaptions && (
            <SavedCaptions
              title={t("custom_studio.kanade_caption_title")}
              captions={userCaptions}
              onSelect={handleSelectCaption}
            />
          )}
          {/* <FeatureGate canUse={canUseCaptionimage}>
            <ImageCaptionSelector title="🎨 Caption Ảnh - Truy cập sớm" />
          </FeatureGate> */}

          <NotesSection />
          <div className="bottom-0">
            <Footer />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScreenCustomeStudio;
