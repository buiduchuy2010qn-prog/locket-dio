import React from "react";
import UploadFile from "./CameraControls/UploadFile";
import CameraButton from "./CameraControls/CameraButton";
import CameraToggle from "./CameraControls/CameraToggle";

import SendButton from "./MediaControls/SendButton";
import DelButton from "./MediaControls/DelButton";
import OverlayButton from "./MediaControls/OverlayButton";
import { usePostStore } from "@/stores";

/**
 * Capture row — 3 equal columns, shutter dead-center.
 * No glass pill bar; draft badge lives on Library icon.
 */
const ActionControls = () => {
  const selectedFile = usePostStore((s) => s.selectedFile);
  const preview = usePostStore((s) => s.preview);
  const hasFile = !!(selectedFile || preview);

  return (
    <div className="captureControls" data-action-controls="true">
      {/* Left: library | delete */}
      <div className="captureControlsCol" data-action-left="true">
        <div
          className={`captureSlot ${!hasFile ? "is-active" : "is-idle"}`}
          aria-hidden={hasFile}
        >
          <UploadFile />
        </div>
        <div
          className={`captureSlot ${hasFile ? "is-active" : "is-idle"}`}
          aria-hidden={!hasFile}
        >
          <DelButton />
        </div>
      </div>

      {/* Center: shutter | send */}
      <div
        className="captureControlsCol captureControlsColCenter"
        data-capture-center="true"
      >
        <div
          className={`captureSlot ${!hasFile ? "is-active" : "is-idle"}`}
          aria-hidden={hasFile}
        >
          <CameraButton />
        </div>
        <div
          className={`captureSlot ${hasFile ? "is-active" : "is-idle"}`}
          aria-hidden={!hasFile}
        >
          <SendButton />
        </div>
      </div>

      {/* Right: flip | effects */}
      <div className="captureControlsCol" data-action-right="true">
        <div
          className={`captureSlot ${!hasFile ? "is-active" : "is-idle"}`}
          aria-hidden={hasFile}
        >
          <CameraToggle />
        </div>
        <div
          className={`captureSlot ${hasFile ? "is-active" : "is-idle"}`}
          aria-hidden={!hasFile}
        >
          <OverlayButton />
        </div>
      </div>
    </div>
  );
};

export default ActionControls;
