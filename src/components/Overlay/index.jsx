import { ColorPaletteOverlay } from "./overlays/ColorPaletteOverlay";
import BaseOverlay from "./overlays/BaseOverlay";
import ReviewOverlay from "./overlays/ReviewOverlay";
import MusicOverlay from "./overlays/MusicOverlay";
import PollOverlay from "./overlays/PollOverlay";

const OVERLAY_COMPONENTS = {
  caption: BaseOverlay,
  review: ReviewOverlay,
  music: MusicOverlay,
  color_palette: ColorPaletteOverlay,
  poll: PollOverlay,
};

/** Chuẩn hoá overlayData: object | array (Locket raw) → object phẳng */
function resolveOverlayData(overlayData) {
  if (!overlayData) return null;

  // Array from Locket post payload
  if (Array.isArray(overlayData)) {
    const first =
      overlayData.find((o) => o?.overlay_type || o?.data) || overlayData[0];
    if (!first) return null;
    const d = first.data || {};
    return {
      overlay_id: first.overlay_id || d.type,
      overlay_type: first.overlay_type,
      type: d.type || "caption",
      text: d.text || first.alt_text || "",
      text_color: d.text_color,
      icon: d.icon || {},
      payload: d.payload || {},
      background: d.background || {},
    };
  }

  // Nested { overlays: {...} }
  if (overlayData.overlays && typeof overlayData.overlays === "object") {
    return { ...overlayData.overlays, ...overlayData };
  }

  return overlayData;
}

export function OverlayRenderer({
  overlayData,
  momentId,
  isCaptionEditing = false,
  pollCounts = null,
  pollVariant = "friend",
}) {
  const data = resolveOverlayData(overlayData);
  if (!data) return null;

  const type = data?.type || "caption";

  const Component = OVERLAY_COMPONENTS[type];

  const overlay_id =
    data?.id || data?.overlay_id || "caption:standard";

  // Music: type / overlay_id / payload ISRC hoặc song_title
  const isMusic =
    type === "music" ||
    overlay_id === "caption:music" ||
    overlay_id === "music" ||
    Boolean(data?.payload?.isrc) ||
    Boolean(data?.payload?.song_title) ||
    Boolean(data?.payload?.spotify_url) ||
    Boolean(data?.payload?.apple_music_url);

  if (overlay_id === "caption:review" || type === "review")
    return <ReviewOverlay overlayData={data} />;

  if (overlay_id === "caption:color_palette" || type === "color_palette")
    return <ColorPaletteOverlay overlayData={data} />;

  if (isMusic)
    return <MusicOverlay overlayData={data} momentId={momentId} />;

  if (!Component) return <BaseOverlay overlayData={data} />;

  return (
    <Component
      overlayData={data}
      momentId={momentId}
      isCaptionEditing={isCaptionEditing}
      pollCounts={type === "poll" ? pollCounts : undefined}
      pollVariant={type === "poll" ? pollVariant : undefined}
    />
  );
}
