import LoadingRing from "@/components/ui/Loading/ring";
import { Eye } from "lucide-react";

const FALLBACK_AVATAR = "/images/default_profile.png";

const ActivityButton = ({ activity = [], isLoading, onClick }) => {
  const viewCount = activity.length;
  const reactionCount = activity.filter((i) => i?.reaction).length;

  let label = "Chưa có ai xem";
  if (isLoading) {
    label = "Đang tải lượt xem…";
  } else if (viewCount > 0) {
    label =
      reactionCount > 0
        ? `${viewCount} đã xem · ${reactionCount} cảm xúc`
        : `${viewCount} người đã xem`;
  }

  return (
    <div
      className="relative flex flex-row justify-center w-full items-center gap-2 px-4 py-3.5 bg-base-200 rounded-3xl shadow-md cursor-pointer active:scale-[0.99] transition-transform"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick?.();
      }}
    >
      <div
        className={`flex items-center justify-center w-8 h-8 rounded-full ${
          viewCount > 0 ? "bg-primary/15 text-primary" : "bg-base-300 text-base-content/70"
        }`}
      >
        <Eye className="w-5 h-5" strokeWidth={2.25} />
      </div>
      <div className="flex-1 min-w-0 pl-0.5">
        <span className="block text-base-content font-semibold truncate">
          {label}
        </span>
        {!isLoading && viewCount > 0 && (
          <span className="block text-xs text-base-content/60 font-medium">
            Nhấn để xem chi tiết
          </span>
        )}
      </div>

      {/* Avatar stack */}
      <div className="flex -space-x-3 flex-row justify-center items-center shrink-0">
        {isLoading ? (
          <LoadingRing size={28} stroke={3} />
        ) : (
          activity.slice(0, 5).map((item, idx) => (
            <img
              key={item?.user?.uid || idx}
              src={item?.user?.profilePic || FALLBACK_AVATAR}
              alt={item?.user?.firstName || "viewer"}
              className="w-9 h-9 rounded-full border-2 border-base-100 object-cover bg-base-300"
              onError={(e) => {
                e.currentTarget.src = FALLBACK_AVATAR;
              }}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default ActivityButton;