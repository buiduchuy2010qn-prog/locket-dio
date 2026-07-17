import { Swiper, SwiperSlide } from "swiper/react";
import { EffectCards } from "swiper/modules";
import { useState, useEffect, useRef, useCallback, memo } from "react";
import "swiper/css";
import "swiper/css/effect-cards";
import { Loader2, SmilePlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  getRollcallMainUrl,
  getRollcallThumbnailUrl,
  isVideoMedia,
  isSignedUrlExpired,
  shouldLoadMediaIndex,
  preloadRollcallNeighbors,
  mediaIdOf,
  logRollcallNet,
} from "@/utils/rollcallMedia";

const LOAD_TIMEOUT_MS = 9000;
const MAX_RETRIES = 2;

function RollcallImages({ items, onActiveChange }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const total = items?.length || 0;

  // Progressive preload: current + next + prev only
  useEffect(() => {
    if (!items?.length) return;
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await preloadRollcallNeighbors(items, activeIndex, { concurrency: 2 });
    })();
    return () => {
      cancelled = true;
    };
  }, [activeIndex, items]);

  // Notify parent of initial active item once
  useEffect(() => {
    if (items?.[0]) onActiveChange?.(items[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount / items identity only
  }, [items]);

  if (!total) return null;

  return (
    <div className="w-full max-w-sm mx-auto overflow-hidden">
      <Swiper
        effect="cards"
        grabCursor
        modules={[EffectCards]}
        className="w-78 sm:w-78 aspect-[3/4]"
        cardsEffect={{
          rotate: true,
          perSlideOffset: 10,
          perSlideRotate: 1,
          slideShadows: false,
        }}
        onSlideChange={(swiper) => {
          const idx = swiper.activeIndex;
          setActiveIndex(idx);
          onActiveChange?.(items[idx]);
        }}
      >
        {items.map((item, index) => {
          const isActive = index === activeIndex;
          const load = shouldLoadMediaIndex(index, activeIndex);
          const priority =
            index === activeIndex
              ? "active"
              : load
                ? "neighbor"
                : "idle";

          return (
            <SwiperSlide key={item.uid || item.id || index}>
              <div className="relative w-full h-full overflow-hidden rounded-lg">
                <RollcallMedia
                  item={item}
                  index={index}
                  load={load}
                  priority={priority}
                  isActive={isActive}
                />

                {/* COUNTER – chỉ slide active */}
                {isActive && (
                  <div className="absolute font-semibold top-2 right-2 bg-base-300/80 backdrop-blur px-3 py-1 rounded-full text-sm">
                    {activeIndex + 1}/{total}
                  </div>
                )}

                {/* OPEN REACTION MODAL */}
                {isActive && (
                  <ReactionButton onClick={() => console.log("open modal")} />
                )}

                {/* LIST EMOJI REACTIONS */}
                {isActive && <ReactionList reactions={item.reactions} />}
              </div>
            </SwiperSlide>
          );
        })}
      </Swiper>
    </div>
  );
}

export default RollcallImages;

function ReactionButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="
        absolute bottom-2 right-2
        bg-base-100/80 backdrop-blur
        p-2 rounded-full
      "
    >
      <SmilePlus className="w-6 h-6" />
    </button>
  );
}

function ReactionList({ reactions = [] }) {
  if (!reactions.length) return null;

  return (
    <div className="absolute bottom-4 left-4 flex">
      {reactions.map((r) => (
        <span
          key={r.uid}
          style={{
            transform: `
              translate(${r.x * 10}px, ${r.y * 10}px)
              rotate(${r.rotation}rad)
              scale(${r.scale})
            `,
          }}
          className="text-2xl select-none"
        >
          {r.reaction}
        </span>
      ))}
    </div>
  );
}

/**
 * Loads media only when `load` is true (active ± 1).
 * Images: eager/high for active; lazy/low for neighbors.
 * Video: poster first, preload metadata only when active; no multi-autoplay.
 */
const RollcallMedia = memo(function RollcallMedia({
  item,
  index,
  load,
  priority,
  isActive,
}) {
  const { t } = useTranslation("main");
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [retryKey, setRetryKey] = useState(0);
  const loadStarted = useRef(0);
  const id = mediaIdOf(item, index);

  const mainUrl = getRollcallMainUrl(item);
  const thumbUrl = getRollcallThumbnailUrl(item);
  const video = isVideoMedia(item) || isVideoMedia(mainUrl);
  // Prefer raw main_url for expiry check (CDN rewrite keeps query)
  const expired = isSignedUrlExpired(item?.main_url || mainUrl);

  // Reset visual state when URL / retry / load window changes
  useEffect(() => {
    if (!load) {
      setLoaded(false);
      setFailed(false);
      setTimedOut(false);
      return;
    }
    setLoaded(false);
    setFailed(false);
    setTimedOut(false);
    loadStarted.current = performance.now();
  }, [load, mainUrl, retryKey]);

  // 8–10s timeout → show retry (does not block album)
  useEffect(() => {
    if (!load || loaded || failed) return;
    const timer = setTimeout(() => {
      setTimedOut(true);
      logRollcallNet({
        type: video ? "video_timeout" : "image_timeout",
        status: "timeout",
        ms: LOAD_TIMEOUT_MS,
        mediaKind: video ? "video" : "image",
        index,
      });
    }, LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [load, loaded, failed, retryKey, video, index]);

  const handleLoaded = useCallback(() => {
    setLoaded(true);
    setTimedOut(false);
    setFailed(false);
    logRollcallNet({
      type: video ? "video_ready" : "image_load",
      status: 200,
      ms: Math.round(performance.now() - (loadStarted.current || performance.now())),
      mediaKind: video ? "video" : "image",
      index,
    });
  }, [video, index]);

  const handleError = useCallback(() => {
    setFailed(true);
    setTimedOut(true);
    logRollcallNet({
      type: video ? "video_error" : "image_error",
      status: "error",
      ms: Math.round(performance.now() - (loadStarted.current || performance.now())),
      mediaKind: video ? "video" : "image",
      index,
    });
  }, [video, index]);

  const handleRetry = useCallback(() => {
    if (retryCount >= MAX_RETRIES) return;
    const next = retryCount + 1;
    setRetryCount(next);
    setFailed(false);
    setTimedOut(false);
    setLoaded(false);
    // Staggered backoff: 400ms, 1200ms
    const delay = next === 1 ? 400 : 1200;
    logRollcallNet({
      type: "media_retry",
      status: next,
      ms: delay,
      mediaKind: video ? "video" : "image",
      index,
    });
    setTimeout(() => setRetryKey((k) => k + 1), delay);
  }, [retryCount, video, index]);

  useEffect(() => {
    if (!load || !expired) return;
    logRollcallNet({
      type: "signed_url_expired",
      status: "expired",
      mediaKind: video ? "video" : "image",
      index,
    });
  }, [load, expired, video, index]);

  // Placeholder when not in load window — same frame, no network
  if (!load) {
    return <div className="relative w-full h-full bg-base-300" />;
  }

  if (!mainUrl) {
    return (
      <div className="relative w-full h-full bg-base-300 flex flex-col items-center justify-center gap-2">
        <span className="text-sm opacity-70">{t("left.image_loading")}</span>
      </div>
    );
  }

  const showOverlay = !loaded || timedOut || failed;

  return (
    <div className="relative w-full h-full">
      {showOverlay && (
        <div className="absolute inset-0 bg-base-300 flex flex-col items-center justify-center gap-2 z-[1]">
          {!failed && !timedOut && (
            <>
              <Loader2 className="w-6 h-6 animate-spin opacity-70" />
              <span className="text-sm opacity-70">{t("left.image_loading")}</span>
            </>
          )}
          {(timedOut || failed) && (
            <>
              <span className="text-sm opacity-70">
                {t("left.image_loading")}
              </span>
              {retryCount < MAX_RETRIES && (
                <button
                  type="button"
                  onClick={handleRetry}
                  className="text-sm text-blue-500 px-3 py-1"
                >
                  {t("left.retry", { defaultValue: "Thử lại" })}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {video ? (
        <video
          key={`${id}-v-${retryKey}`}
          src={mainUrl}
          poster={thumbUrl || undefined}
          preload={isActive ? "metadata" : "none"}
          playsInline
          controls={isActive}
          // Never autoplay multiple videos
          autoPlay={false}
          onLoadedData={handleLoaded}
          onLoadedMetadata={handleLoaded}
          onError={handleError}
          className={`
            w-full h-full object-cover
            transition-opacity duration-300
            ${loaded ? "opacity-100" : "opacity-0"}
          `}
        />
      ) : (
        <img
          key={`${id}-i-${retryKey}`}
          src={mainUrl}
          alt=""
          loading={priority === "active" ? "eager" : "lazy"}
          fetchPriority={priority === "active" ? "high" : "low"}
          decoding="async"
          onLoad={handleLoaded}
          onError={handleError}
          className={`
            w-full h-full object-cover
            transition-opacity duration-300
            ${loaded ? "opacity-100" : "opacity-0"}
          `}
          draggable={false}
        />
      )}
    </div>
  );
});
