import React, { useState } from "react";
import { getCaptionStyle } from "@/helpers/styleHelpers";
import IconRenderer from "@/components/Overlay/icons/IconRenderer";

/**
 * Badge thời tiết trên preview — gradient + icon SF, không lộ alt "Cover"
 * khi texture cloud_cover lỗi.
 */
const WeatherOverlay = ({ postOverlay }) => {
  const [coverOk, setCoverOk] = useState(true);
  const cloud =
    typeof postOverlay?.payload?.cloud_cover === "number"
      ? Math.min(1, Math.max(0, postOverlay.payload.cloud_cover))
      : 0.35;

  const text = postOverlay?.text || postOverlay?.caption || "";

  return (
    <div
      className="relative inline-flex items-center gap-1.5 py-1.5 pl-2.5 pr-3.5 rounded-full text-white font-semibold text-[15px] leading-none shadow-lg overflow-hidden select-none"
      style={{
        ...getCaptionStyle(postOverlay?.background, postOverlay?.text_color),
        backgroundImage:
          postOverlay?.background?.colors?.length >= 2
            ? undefined
            : "linear-gradient(135deg, #6BDCFF 0%, #2D9AFF 100%)",
      }}
    >
      {/* Texture mây mờ — chỉ hiện khi load được, alt rỗng để không hiện "Cover" */}
      {coverOk && cloud > 0.05 && (
        <img
          src="/images/cloud_cover.png"
          alt=""
          aria-hidden="true"
          draggable={false}
          onError={() => setCoverOk(false)}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          style={{ opacity: Math.min(0.55, cloud * 0.7) }}
        />
      )}

      <span className="relative z-[1] flex items-center justify-center w-5 h-5 shrink-0 [&>svg]:w-5 [&>svg]:h-5 [&>img]:w-5 [&>img]:h-5">
        <IconRenderer icon={postOverlay?.icon} />
      </span>
      <span className="relative z-[1] tracking-tight drop-shadow-sm">
        {text}
      </span>
    </div>
  );
};

export default WeatherOverlay;
