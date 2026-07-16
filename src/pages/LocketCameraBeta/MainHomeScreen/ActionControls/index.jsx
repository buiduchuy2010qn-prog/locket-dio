import React from "react";
import UploadFile from "./CameraControls/UploadFile";
import CameraButton from "./CameraControls/CameraButton";
import CameraToggle from "./CameraControls/CameraToggle";

import SendButton from "./MediaControls/SendButton";
import DelButton from "./MediaControls/DelButton";
import OverlayButton from "./MediaControls/OverlayButton";
import DraftButton from "./MediaControls/DraftButton";
import { useMomentDraftStore, usePostStore } from "@/stores";

const ActionControls = () => {
  const selectedFile = usePostStore((s) => s.selectedFile);
  const preview = usePostStore((s) => s.preview);
  const hasDraft = useMomentDraftStore((s) => s.hasDraft);
  const showRestoreModal = useMomentDraftStore((s) => s.showRestoreModal);

  // Có preview = đã chụp (kể cả lúc file blob chưa encode xong)
  const hasFile = !!(selectedFile || preview);
  // "Bản nháp" when draft exists and modal not open (incl. after "Để sau")
  const showDraftChip = !hasFile && hasDraft && !showRestoreModal;

  const baseBtn =
    "transition-all duration-300 ease-in-out transform active:scale-95";

  const showClass = "opacity-100 scale-100";
  const hideClass = "opacity-0 pointer-events-none absolute";

  const hideMainClass = "opacity-0 scale-75 pointer-events-none absolute";

  return (
    <div className="relative flex justify-center items-center w-full max-w-md px-2">
      {/*
        Three evenly spaced slots so Delete (left) is never flush against
        Send / Post (center). Extra horizontal padding helps fat-finger safety.
      */}
      <div className="relative w-full flex justify-between items-center gap-6 sm:gap-10">
        {/* SLOT 1 — left: Upload or Delete (far from center Send) */}
        <div className="relative flex items-center justify-center min-w-[3rem] shrink-0">
          <div
            className={`${baseBtn} ${!hasFile ? showClass : hideClass} flex items-center gap-3`}
          >
            <UploadFile />
            {showDraftChip ? <DraftButton /> : null}
          </div>

          <div className={`${baseBtn} ${hasFile ? showClass : hideClass}`}>
            <DelButton />
          </div>
        </div>

        {/* SLOT 2 — center main button */}
        <div className="relative flex items-center justify-center min-w-[4.5rem] shrink-0">
          <div className={`${baseBtn} ${!hasFile ? showClass : hideMainClass}`}>
            <CameraButton />
          </div>

          <div className={`${baseBtn} ${hasFile ? showClass : hideMainClass}`}>
            <SendButton />
          </div>
        </div>

        {/* SLOT 3 — right */}
        <div className="relative flex items-center justify-center min-w-[3rem] shrink-0">
          <div className={`${baseBtn} ${!hasFile ? showClass : hideClass}`}>
            <CameraToggle />
          </div>

          <div className={`${baseBtn} ${hasFile ? showClass : hideClass}`}>
            <OverlayButton />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActionControls;
