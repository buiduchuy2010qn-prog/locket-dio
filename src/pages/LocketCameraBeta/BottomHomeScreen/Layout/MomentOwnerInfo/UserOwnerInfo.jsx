import { formatTimeAgo, getAvatarOrFallback, imageFallback } from "@/utils";

const UserOwnerInfo = ({ user, isMe, date }) => {
  const fullName = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim();

  return (
    <div className="flex items-center gap-2 text-md text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <img
          src={getAvatarOrFallback(user?.profilePicture || user?.profilePic)}
          onError={imageFallback()}
          alt={fullName}
          className="w-10 h-10 rounded-full object-cover"
        />

        <span className="truncate max-w-[100px] text-base text-base-content font-semibold">
          {isMe ? "Bạn" : (user?.firstName ?? "Người dùng")}
        </span>
      </div>

      {user?.badge === "locket_gold" && (
        <img
          src="https://cdn.locket-dio.com/v1/caption/caption-icon/locket_gold_badge.png"
          alt="Gold Badge"
          className="w-5 h-5"
        />
      )}

      {user?.isCelebrity && (
        <img
          src="https://cdn.locket-dio.com/v1/caption/caption-icon/celebrity_badge.png"
          alt="Celebrity"
          className="w-5 h-5"
        />
      )}

      <div className="text-base-content font-semibold">
        {formatTimeAgo(date)}
      </div>
    </div>
  );
};

export default UserOwnerInfo;
