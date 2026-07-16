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
    <div className="relative flex justify-center items-center w-full max-w-md">
      <div className="relative w-full flex justify-evenly items-center">
        {/* SLOT 1 */}
        <div className="relative flex items-center justify-center">
          {/* Upload + optional draft entry when user chose "Để sau" */}
          <div
            className={`${baseBtn} ${!hasFile ? showClass : hideClass} flex items-center gap-3`}
          >
            <UploadFile />
            {showDraftChip ? <DraftButton /> : null}
          </div>

          {/* Delete */}
          <div className={`${baseBtn} ${hasFile ? showClass : hideClass}`}>
            <DelButton />
          </div>
        </div>

        {/* SLOT 2 (Center main button) */}
        <div className="relative flex items-center justify-center">
          {/* Camera */}
          <div className={`${baseBtn} ${!hasFile ? showClass : hideMainClass}`}>
            <CameraButton />
          </div>

          {/* Send */}
          <div className={`${baseBtn} ${hasFile ? showClass : hideMainClass}`}>
            <SendButton />
          </div>
        </div>

        {/* SLOT 3 */}
        <div className="relative flex items-center justify-center">
          {/* Toggle camera */}
          <div className={`${baseBtn} ${!hasFile ? showClass : hideClass}`}>
            <CameraToggle />
          </div>

          {/* Overlay */}
          <div className={`${baseBtn} ${hasFile ? showClass : hideClass}`}>
            <OverlayButton />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActionControls;
