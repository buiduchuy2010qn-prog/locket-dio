import { getCaptionStyle } from "@/helpers/styleHelpers";

/** Caption Lockets — pill vàng + ♥ + tổng số Locket */
const LocketCountOverlay = ({ postOverlay }) => {
  return (
    <div
      className="flex items-center gap-1 py-2 px-4 rounded-4xl font-bold text-md"
      style={{
        ...getCaptionStyle(postOverlay.background, postOverlay.text_color),
      }}
    >
      <img src="/icons/suit_heart_fill.png" alt="" className="w-5 h-5 mr-0.5" />
      <span>{postOverlay.text || postOverlay.caption}</span>
    </div>
  );
};

export default LocketCountOverlay;
