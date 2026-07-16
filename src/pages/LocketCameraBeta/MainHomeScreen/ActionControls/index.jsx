import React from "react";
import "./styles.css";
import UploadFile from "./CameraControls/UploadFile";
import CameraButton from "./CameraControls/CameraButton";
import CameraToggle from "./CameraControls/CameraToggle";

import SendButton from "./MediaControls/SendButton";
import DelButton from "./MediaControls/DelButton";
import OverlayButton from "./MediaControls/OverlayButton";
import DraftButton from "./MediaControls/DraftButton";
import { useMomentDraftStore, usePostStore } from "@/stores";

/**
 * Locket-style floating control pill.
 * Capture/Send is absolute-centered — side icons never shift it.
 */
const ActionControls = () => {
  const selectedFile = usePostStore((s) => s.selectedFile);
  const preview = usePostStore((s) => s.preview);
  const hasDraft = useMomentDraftStore((s) => s.hasDraft);
  const showRestoreModal = useMomentDraftStore((s) => s.showRestoreModal);

  const hasFile = !!(selectedFile || preview);
  const showDraftChip = !hasFile && hasDraft && !showRestoreModal;

  const fade = "transition-opacity duration-300 ease-in-out";

  return (
    <div
      className="w-full flex justify-center px-2"
      data-action-controls="true"
    >
      <div className="cameraControlPill" data-camera-control-pill="true">
        {/* Center capture — independent of left/right */}
        <div className="captureCenter" data-capture-center="true">
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

        {/* Left: library + draft  |  delete after capture */}
        <div className="leftControls" data-action-left="true">
          <div
            className={`${fade} flex items-center ${
              !hasFile ? "opacity-100" : "opacity-0 pointer-events-none absolute"
            }`}
          >
            <UploadFile />
            {showDraftChip ? <DraftButton /> : null}
          </div>
          <div
            className={`${fade} ${
              hasFile ? "opacity-100" : "opacity-0 pointer-events-none absolute"
            }`}
          >
            <DelButton />
          </div>
        </div>

        {/* Right: flip  |  overlay after capture */}
        <div className="rightControls" data-action-right="true">
          <div
            className={`${fade} ${
              !hasFile ? "opacity-100" : "opacity-0 pointer-events-none absolute"
            }`}
          >
            <CameraToggle />
          </div>
          <div
            className={`${fade} ${
              hasFile ? "opacity-100" : "opacity-0 pointer-events-none absolute"
            }`}
          >
            <OverlayButton />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActionControls;
