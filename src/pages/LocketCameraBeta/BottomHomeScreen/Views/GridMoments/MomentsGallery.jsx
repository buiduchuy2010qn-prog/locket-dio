import { useEffect, useState, useRef } from "react";
import { MdSlowMotionVideo } from "react-icons/md";
import { useSelectedStore } from "@/stores";
import { useTranslation } from "react-i18next";

/**
 * Lưới khoảnh khắc — không nút "Làm mới / Đang tải".
 * Feed tự pull ở BottomHomeScreen (socket + soft poll).
 */
const MomentsGallery = ({
  visibleCount,
  increaseVisibleCount,
  moments,
  loadMoreOlder,
  hasMore,
  loading,
}) => {
  const { t } = useTranslation("main");
  const setSelectedMoment = useSelectedStore((s) => s.setSelectedMoment);
  const setSelectedMomentId = useSelectedStore((s) => s.setSelectedMomentId);
  const selectedFriendUid = useSelectedStore((s) => s.selectedFriendUid);

  const [loadedItems, setLoadedItems] = useState([]);
  const lastElementRef = useRef(null);
  const observerRef = useRef(null);

  const visibleMoments = moments.slice(0, visibleCount);

  // Infinite scroll — tự load thêm khi chạm cuối
  useEffect(() => {
    if (!lastElementRef.current) return;

    observerRef.current?.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry.isIntersecting) return;

        if (visibleCount < moments.length) {
          increaseVisibleCount();
          return;
        }

        if (loadMoreOlder && hasMore) {
          loadMoreOlder(selectedFriendUid);
        }
      },
      {
        rootMargin: "300px",
        threshold: 0.1,
      },
    );

    observerRef.current.observe(lastElementRef.current);

    return () => observerRef.current?.disconnect();
  }, [
    visibleCount,
    moments.length,
    hasMore,
    loadMoreOlder,
    selectedFriendUid,
    increaseVisibleCount,
  ]);

  const handleLoaded = (id) => {
    setLoadedItems((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  if (moments.length === 0) {
    // Loading skeleton im lặng — không chữ "Đang tải"
    if (loading) {
      return (
        <div className="grid gap-1 grid-cols-3 md:grid-cols-6 md:gap-2 w-full">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={`empty-sk-${idx}`}
              className="aspect-square rounded-2xl skeleton"
            />
          ))}
        </div>
      );
    }
    return (
      <div className="grid grid-cols-3 md:grid-cols-6 md:gap-2 w-full h-full">
        <div className="aspect-square bg-base-300/40 rounded-2xl border border-dashed border-base-content/15" />
      </div>
    );
  }

  return (
    <div className="grid gap-1 grid-cols-3 md:grid-cols-6 md:gap-2">
      {visibleMoments.map((item, index) => {
        const isLoaded = loadedItems.includes(item.id);
        const isLastItem = index === visibleMoments.length - 1;

        return (
          <div
            key={item.id}
            ref={isLastItem ? lastElementRef : null}
            onClick={() => {
              setSelectedMoment(index);
              setSelectedMomentId(item.id);
            }}
            className="aspect-square overflow-hidden cursor-pointer rounded-2xl relative group"
          >
            {!isLoaded && (
              <div className="absolute inset-0 skeleton w-full h-full rounded-2xl z-10" />
            )}

            <img
              src={item.thumbnail_url || item.image_url || item.thumbnailUrl}
              alt=""
              className={`object-cover w-full h-full rounded-2xl transition-all duration-300 ${
                isLoaded ? "opacity-100" : "opacity-0"
              }`}
              onLoad={() => handleLoaded(item.id)}
              loading="lazy"
            />

            {(item.video_url || item.videoUrl) && (
              <div className="absolute top-2 right-2 bg-primary/30 rounded-full z-20 p-0.5">
                <MdSlowMotionVideo className="text-white" />
              </div>
            )}
          </div>
        );
      })}

      {loading &&
        Array.from({ length: 3 }).map((_, idx) => (
          <div
            key={`skeleton-${idx}`}
            className="aspect-square overflow-hidden rounded-2xl relative"
          >
            <div className="absolute inset-0 skeleton w-full h-full rounded-2xl" />
          </div>
        ))}
    </div>
  );
};

export default MomentsGallery;
