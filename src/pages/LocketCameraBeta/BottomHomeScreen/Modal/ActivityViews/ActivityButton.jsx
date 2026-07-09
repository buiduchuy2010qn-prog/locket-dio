import LoadingRing from "@/components/ui/Loading/ring";
import { MoonStar } from "lucide-react";
import { splitActivity } from "@/utils/momentActivity";

const FALLBACK_AVATAR = "/images/default_profile.png";

/** Nút mở Hoạt động — avatar stack + “Hoạt động” kiểu Locket */
const ActivityButton = ({ activity = [], isLoading, onClick }) => {
  const parts = splitActivity(activity);
  const viewCount = parts.viewedAll.length;
  const avatars = parts.viewedAll.slice(0, 5);

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
      <MoonStar className="w-6 h-6 text-base-content shrink-0" strokeWidth={2} />
      <span className="flex-1 text-base-content font-semibold pl-0.5">
        Hoạt động
        {!isLoading && viewCount > 0 ? (
          <span className="text-base-content/50 font-medium"> · {viewCount}</span>
        ) : null}
      </span>

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
