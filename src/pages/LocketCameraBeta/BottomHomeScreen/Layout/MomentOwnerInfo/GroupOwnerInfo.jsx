import { formatTimeAgo, getAvatarOrFallback, imageFallback } from "@/utils";

const GroupOwnerInfo = ({ group, user, isMe, date }) => {
  return (
    <div className="flex items-start gap-3 text-base-content">
      <div className="flex flex-row relative">
        <img
          src={group.image_url || "/images/default_group.png"}
          className="w-10 h-10 rounded-full object-cover border border-base-300"
        />

        <img
          src={getAvatarOrFallback(user?.profilePicture || user?.profilePic)}
          className="w-10 h-10 rounded-full object-cover border-2 border-base-100 -ml-3"
          onError={imageFallback()}
        />
      </div>

      <div className="flex flex-col min-w-0">
        <span className="font-semibold text-sm truncate">
          {group.name || "---"}
        </span>

        <span className="text-xs text-base-content/70 truncate">
          {isMe ? "Bạn" : (user?.firstName ?? "Người dùng")}
          {" ~ "}
          <span className="text-base-content/50">{formatTimeAgo(date)}</span>
        </span>

        <div className="flex items-center gap-2 mt-1">
          {user?.badge === "locket_gold" && (
            <img
              src="https://cdn.locket-dio.com/v1/caption/caption-icon/locket_gold_badge.png"
              className="w-4 h-4"
            />
          )}

          {user?.isCelebrity && (
            <img
              src="https://cdn.locket-dio.com/v1/caption/caption-icon/celebrity_badge.png"
              className="w-4 h-4"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default GroupOwnerInfo;
