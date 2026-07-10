import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import LoadingRing from "@/components/ui/Loading/ring";
import { MoonStar } from "lucide-react";
import { getAvatarOrFallback, imageFallback } from "@/utils";
import { useReactionStore } from "@/stores";

const ActivityButton = ({ activity, isLoading, onClick }) => {
  const { t } = useTranslation("main");
  const viewersWithReaction = activity.filter((i) => i.reactions?.length > 0);
  const displayUsers = viewersWithReaction.length
    ? viewersWithReaction
    : activity;

  const triggerReaction = useReactionStore((s) => s.triggerReaction);

  const reactionEmojis = useMemo(() => {
    return activity
      .flatMap((item) => item.reactions || [])
      .map((reaction) => reaction.emoji)
      .filter(Boolean);
  }, [activity]);

  useEffect(() => {
    if (!reactionEmojis.length) return;

    triggerReaction(reactionEmojis);
  }, [reactionEmojis, triggerReaction]);

  return (
    <>
      <div
        className="flex w-full cursor-pointer flex-row items-center justify-center gap-2 rounded-3xl bg-base-200 px-4 py-3.5 shadow-md"
        onClick={onClick}
      >
        <MoonStar className="h-6 w-6 text-base-content" />
        <span className="flex-1 pl-1 font-semibold text-base-content">
          {t("bottom.activity")}
        </span>

        <div className="absolute right-5 z-10 flex flex-row items-center justify-center -space-x-3">
          {isLoading ? (
            <LoadingRing size={28} stroke={3} />
          ) : (
            displayUsers
              .slice(0, 6)
              .map((item) => (
                <img
                  key={item?.user?.uid}
                  src={getAvatarOrFallback(
                    item?.user?.profilePic || item?.user?.profile_pic,
                  )}
                  alt={item?.user?.firstName}
                  onError={imageFallback()}
                  className="h-9 w-9 rounded-full border-2 border-base-100 object-cover"
                />
              ))
          )}
        </div>
      </div>
    </>
  );
};

export default ActivityButton;
