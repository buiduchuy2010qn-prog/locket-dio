import React from "react";
import UploadFile from "./CameraControls/UploadFile";
import CameraButton from "./CameraControls/CameraButton";
import CameraToggle from "./CameraControls/CameraToggle";

import SendButton from "./MediaControls/SendButton";
import DelButton from "./MediaControls/DelButton";
import OverlayButton from "./MediaControls/OverlayButton";
import DraftButton from "./MediaControls/DraftButton";
import { useMomentDraftStore, usePostStore } from "@/stores";

/**
 * Capture/Send stays geometrically centered under the camera preview.
 * Side controls (library, draft, flip / delete, overlay) never participate
 * in the capture button's horizontal position.
 */
const ActionControls = () => {
  const selectedFile = usePostStore((s) => s.selectedFile);
  const preview = usePostStore((s) => s.preview);
  const hasDraft = useMomentDraftStore((s) => s.hasDraft);
  const showRestoreModal = useMomentDraftStore((s) => s.showRestoreModal);

  // Có preview = đã chụp (kể cả lúc file blob chưa encode xong)
  const hasFile = !!(selectedFile || preview);
  // "Bản nháp" when draft exists and modal not open (incl. after "Để sau")
  const showDraftChip = !hasFile && hasDraft && !showRestoreModal;

  const fade =
    "transition-opacity duration-300 ease-in-out";
  const showSide = "opacity-100";
  const hideSide = "opacity-0 pointer-events-none";

  return (
    <div
      className="relative w-full max-w-md mx-auto"
      data-action-controls="true"
      /* Reserve height of capture button (w-24 h-24) so layout doesn't collapse */
      style={{ minHeight: "6rem" }}
    >
      {/* ── Center: capture / send — independent of side buttons ── */}
      <div
        className="captureButtonCenter absolute left-1/2 top-1/2 z-10 w-24 h-24"
        style={{ transform: "translate(-50%, -50%)" }}
        data-capture-center="true"
      >
        {/* Fixed 96×96 slot = CameraButton/SendButton size; press scale stays on the button */}
        <div
          className={`${fade} absolute inset-0 flex items-center justify-center ${
            !hasFile ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
          aria-hidden={hasFile}
        >
          <CameraButton />
        </div>
        <div
          className={`${fade} absolute inset-0 flex items-center justify-center ${
            hasFile ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
          aria-hidden={!hasFile}
        >
          <SendButton />
        </div>
      </div>

      {/* ── Left side: library + draft  OR  delete (independent) ── */}
      <div
        className="absolute left-2 sm:left-4 top-1/2 z-[5] flex items-center gap-2 sm:gap-3"
        style={{ transform: "translateY(-50%)" }}
        data-action-left="true"
      >
        <div
          className={`${fade} flex items-center gap-2 sm:gap-3 ${
            !hasFile ? showSide : hideSide
          }`}
        >
          <UploadFile />
          {showDraftChip ? <DraftButton /> : null}
        </div>
        <div className={`${fade} ${hasFile ? showSide : hideSide}`}>
          <DelButton />
        </div>
      </div>

      {/* ── Right side: flip camera  OR  overlay (independent) ── */}
      <div
        className="absolute right-2 sm:right-4 top-1/2 z-[5] flex items-center justify-end"
        style={{ transform: "translateY(-50%)" }}
        data-action-right="true"
      >
        <div className={`${fade} ${!hasFile ? showSide : hideSide}`}>
          <CameraToggle />
        </div>
        <div className={`${fade} ${hasFile ? showSide : hideSide}`}>
          <OverlayButton />
        </div>
      </div>
    </div>
  );
};

export default ActionControls;
