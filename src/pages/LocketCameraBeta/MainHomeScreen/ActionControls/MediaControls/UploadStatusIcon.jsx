import { Check, AlertTriangle } from "lucide-react";
import LoadingRing from "@/components/uikit/Loading/ring";
import "./styles.css";

/**
 * Paper plane — tight viewBox, geometric center ≈ (12,12).
 * Stroke only; no emoji/PNG. Optical nudge applied via .sendButtonIcon CSS.
 */
function PaperPlaneIcon({ className = "sendButtonIcon" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width={30}
      height={30}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      {/* Fuselage + wings as one path, fold crease as second */}
      <path
        d="M3.6 10.9 19.9 4.4c.85-.34 1.66.47 1.22 1.28L14.6 20.5c-.4.85-1.62.8-1.95-.08l-2.55-6.55-6.55-2.55c-.88-.34-.93-1.55-.05-1.92z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m10.2 13.5 10.1-8.7"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const UploadStatusIcon = ({
  loading = false,
  success = false,
  overLimit = false,
}) => {
  const showSend = !loading && !success && !overLimit;

  return (
    <div className="sendIconCenter" data-send-icon-center="true">
      {/* Over-limit */}
      <div
        className={`sendStatusLayer ${
          overLimit ? "is-visible" : "is-hidden"
        }`}
        aria-hidden={!overLimit}
      >
        <AlertTriangle size={28} strokeWidth={2} color="#fff" />
      </div>

      {/* Loading — spinner dead-center in circle */}
      <div
        className={`sendStatusLayer ${
          loading && !overLimit ? "is-visible" : "is-hidden"
        }`}
        aria-hidden={!(loading && !overLimit)}
      >
        <LoadingRing size={30} stroke={3} color="#ffffff" />
      </div>

      {/* Success */}
      <div
        className={`sendStatusLayer ${
          success && !overLimit ? "is-visible" : "is-hidden"
        }`}
        aria-hidden={!(success && !overLimit)}
      >
        <Check
          size={30}
          strokeWidth={2.25}
          color="#fff"
          style={{
            animation: success ? "checkmark-draw 0.6s ease-in-out" : "none",
          }}
        />
      </div>

      {/* Default send */}
      <div
        className={`sendStatusLayer ${
          showSend ? "is-visible" : "is-hidden"
        }`}
        aria-hidden={!showSend}
      >
        <PaperPlaneIcon />
      </div>
    </div>
  );
};

export default UploadStatusIcon;
