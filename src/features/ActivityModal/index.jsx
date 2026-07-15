import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import { X, Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import LoadingActivityItem from "./LoadingActivityItem";
import {
  formatFirestoreTime,
  formatTimeAgo,
  getAvatarOrFallback,
  imageFallback,
} from "@/utils";
import ReactDOM from "react-dom";
import SearchInput from "@/components/uikit/Input/SearchInput";

export const ActivityModal = ({
  show,
  onClose,
  activity,
  isLoading,
  pollCounts,
  activeTooltip,
  setActiveTooltip,
}) => {
  const { t, i18n } = useTranslation("features");
  const [showModal, setShowModal] = useState(false);
  const [animate, setAnimate] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    document.body.style.overflow = showModal ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [showModal]);

  useEffect(() => {
    if (show) {
      setShowModal(true);
      setTimeout(() => setAnimate(true), 10);
    } else {
      setAnimate(false);
      setTimeout(() => setShowModal(false), 300);
    }
  }, [show]);

  const viewerCount = activity.filter((i) => i.viewedAt).length;
  const reactorCount = activity.filter((i) => i.reactions?.length > 0).length;

  const filteredActivity = useMemo(() => {
    if (!searchTerm.trim()) return activity;

    const keyword = searchTerm.toLowerCase();

    return activity.filter((item) => {
      const fullName =
        `${item.user?.firstName || ""} ${item.user?.lastName || ""}`.toLowerCase();

      const username = (item.user?.username || "").toLowerCase();

      return (
        fullName.includes(keyword) ||
        username.includes(keyword) ||
        (item.user?.uid || "").toLowerCase().includes(keyword)
      );
    });
  }, [activity, searchTerm]);

  if (!showModal) return null;

  return ReactDOM.createPortal(
    <div
      className={clsx(
        "fixed inset-0 z-60 flex items-end bg-base-100/30 backdrop-blur-[4px] transition-all duration-500",
        {
          "opacity-100": animate,
          "opacity-0 pointer-events-none": !animate,
        },
      )}
      onClick={onClose}
    >
      <div
        className={clsx(
          "relative flex h-2/3 w-full transform flex-col rounded-t-3xl border-t border-base-300 bg-base-100 p-4 text-base-content shadow-lg transition-transform duration-500 z-[62]",
          {
            "translate-y-0": animate,
            "translate-y-full": !animate,
          },
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 border-b border-base-300">
          <div className="relative flex items-center">
            <h2 className="flex-1 text-center text-lg font-bold">{t("activity.title")}</h2>
            <button
              onClick={onClose}
              className="absolute right-0 btn btn-circle p-1 btn-sm"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="my-3">
            <SearchInput
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              isFocused={isFocused}
              setIsFocused={setIsFocused}
              placeholder={t("activity.search_placeholder")}
            />
          </div>

          {pollCounts?.isPoll && (
            <div className="flex items-center justify-center mb-2">
              <div className="flex items-center rounded-4xl border border-base-300 bg-base-200 p-2 shadow-sm">
                <div className="flex flex-row items-center">
                  <span className="text-2xl">{pollCounts.leftEmoji}</span>
                  <span className="ml-1 text-lg font-bold tabular-nums">
                    {pollCounts.leftCount}
                  </span>
                </div>
                <div className="h-8 mx-2 w-px bg-base-300" />
                <div className="flex flex-row items-center">
                  <span className="text-2xl">{pollCounts.rightEmoji}</span>
                  <span className="ml-1 text-lg font-bold tabular-nums">
                    {pollCounts.rightCount}
                  </span>
                </div>
              </div>
            </div>
          )}

          {!isLoading && activity.length > 0 && (
            <div className="space-y-1 text-sm">
              <p>
                - 👁️ {t("activity.total_viewers")}:{" "}
                <span className="font-semibold">{viewerCount}</span>
              </p>
              <p>
                - 💖 {t("activity.total_reactions")}:{" "}
                <span className="font-semibold">{reactorCount}</span>
              </p>
            </div>
          )}
        </div>

        <div className="mt-1 flex-1 overflow-y-auto">
          {isLoading ? (
            <ul className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <LoadingActivityItem key={i} />
              ))}
            </ul>
          ) : filteredActivity.length > 0 ? (
            <ul className="space-y-2">
              {filteredActivity.map((item) => (
                <li
                  key={item?.user?.uid}
                  className="relative flex items-center gap-3"
                >
                  <img
                    src={getAvatarOrFallback(
                      item?.user?.profilePic || item?.user?.profilePicture,
                    )}
                    alt={item?.user?.firstName}
                    className="h-12 w-12 rounded-full border-[2.5px] border-amber-400 p-0.5"
                    onError={imageFallback()}
                  />
                  <div className="flex flex-1 flex-col">
                    <span className="text-base font-semibold">
                      {item.user?.firstName} {item.user?.lastName}
                    </span>
                    {item.reaction ? (
                      <span className="text-sm">
                        {t("activity.reacted", { emoji: item.reaction.emoji })}{" "}
                        {formatTimeAgo(item.reaction.createdAt)}
                      </span>
                    ) : item.viewedAt ? (
                      <span className="text-sm">
                        ✨ {t("activity.viewed")} {formatFirestoreTime(item.viewedAt)}
                      </span>
                    ) : null}
                  </div>

                  <div className="relative">
                    <button
                      onClick={() =>
                        setActiveTooltip(
                          activeTooltip === item?.user?.uid
                            ? null
                            : item?.user?.uid,
                        )
                      }
                      className="rounded-full p-2 transition-colors hover:bg-base-200"
                    >
                      <Info className="h-5 w-5 text-base-content/60" />
                    </button>

                    {activeTooltip === item?.user?.uid && (
                      <div className="absolute right-6 top-full z-50 mt-2 w-64 rounded-lg border border-base-300 bg-base-200 p-3 shadow-xl">
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2 border-b border-base-300 pb-2">
                            <img
                              src={
                                item?.user?.profilePic ||
                                item?.user?.profilePicture
                              }
                              alt={item?.user?.firstName}
                              className="h-10 w-10 rounded-full"
                            />
                            <div>
                              <p className="font-semibold truncate max-w-[180px]">
                                {item.user?.firstName} {item.user?.lastName}
                              </p>
                              <p className="text-xs text-base-content/60">
                                @{item.user?.username || "N/A"}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <p className="text-xs text-base-content/70">
                              <span className="font-medium">User ID:</span>{" "}
                              {item.user?.uid}
                            </p>

                            {item.viewedAt && (
                              <p className="text-xs text-base-content/70">
                                <span className="font-medium">
                                  {t("activity.view_time")}
                                </span>
                                <br />
                                {formatFirestoreTime(item.viewedAt)}
                              </p>
                            )}

                            {item.reactions?.length > 0 && (
                              <div className="space-y-1">
                                <p className="text-xs font-medium text-base-content/70">
                                  {t("activity.reactions_title", { count: item.reactions.length })}
                                </p>
                                {item.reactions.map((r) => (
                                  <p
                                    key={r.id ?? `${r.emoji}-${r.createdAt}`}
                                    className="text-xs text-base-content/70"
                                  >
                                    {r.emoji} · {t("activity.intensity", { intensity: r.intensity || 0 })} ·{" "}
                                    {formatTimeAgo(r.createdAt)}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex h-full items-center justify-center italic text-base-content/60">
              {searchTerm
                ? t("activity.no_user_found")
                : t("activity.no_activity")}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};
