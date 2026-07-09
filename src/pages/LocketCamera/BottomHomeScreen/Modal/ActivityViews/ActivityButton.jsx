import LoadingRing from "@/components/ui/Loading/ring";
import { Eye } from "lucide-react";
import { splitActivity } from "@/utils/momentActivity";

const FALLBACK_AVATAR = "/images/default_profile.png";

const ActivityButton = ({ activity = [], isLoading, onClick }) => {
  const parts = splitActivity(activity);
  const viewCount = parts.viewedAll.length;
  const reactionCount = parts.reacted.length;
  const noReactCount = parts.noReaction.length;

  let label = "Chưa có ai xem";
  let sub = "Nhấn để xem bạn bè · chưa thả cảm xúc";
  if (isLoading) {
    label = "Đang tải lượt xem…";
    sub = "";
  } else if (viewCount > 0 || noReactCount > 0) {
    label = `${viewCount} đã xem · ${reactionCount} cảm xúc`;
    sub = `${noReactCount} chưa thả cảm xúc · nhấn xem full`;
  }

  // Avatar ưu tiên người đã xem/reaction
  const avatars = (parts.viewedAll.length ? parts.viewedAll : activity).slice(
    0,
    5
  );

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
        className={`flex items-center justify-center w-8 h-8 rounded-full shrink-0 ${
          viewCount > 0
            ? "bg-primary/15 text-primary"
            : "bg-base-300 text-base-content/70"
        }`}
      >
        <Eye className="w-5 h-5" strokeWidth={2.25} />
      </div>
      <div className="flex-1 min-w-0 pl-0.5">
        <span className="block text-base-content font-semibold truncate">
          {label}
        </span>
        {sub && (
          <span className="block text-xs text-base-content/60 font-medium truncate">
            {sub}
          </span>
        )}
      </div>

      <div className="flex -space-x-3 flex-row justify-center items-center shrink-0">
        {isLoading ? (
          <LoadingRing size={28} stroke={3} />
        ) : (
          avatars.map((item, idx) => (
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
