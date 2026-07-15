import SearchInput from "@/components/uikit/Input/SearchInput";
import { useApp } from "@/context/AppContext";
import { useAuthStore, useFriendObjects, useSelectedStore } from "@/stores";
import { getAvatarOrFallback, imageFallback } from "@/utils";
import clsx from "clsx";
import { ChevronRight } from "lucide-react";
import React, { useState } from "react";
import { FaUserFriends } from "react-icons/fa";
import { useTranslation } from "react-i18next";

function HistorySelectFriend({
  isVisible,
  setIsVisible,
  setFriendName,
  onClick,
}) {
  const { t } = useTranslation("features");
  const { navigation } = useApp();
  const { isBottomOpen, isFriendHistoryOpen, setFriendHistoryOpen } =
    navigation;

  const setSelectedFriendUid = useSelectedStore((state) => state.setSelectedFriendUid);
  const setSelectedMoment = useSelectedStore((state) => state.setSelectedMoment);
  const setSelectedQueue = useSelectedStore((state) => state.setSelectedQueue);

  const { user } = useAuthStore();

  const [searchTerm, setSearchTerm] = useState("");
  const [isFocusedFind, setIsFocusedFind] = useState(null);
  const friendObjects = useFriendObjects();

  const filteredFriends = friendObjects.filter((friend) => {
    const fullName = `${friend.firstName} ${friend.lastName}`.toLowerCase();
    const username = (friend.username || "").toLowerCase();
    const term = searchTerm.toLowerCase();

    return fullName.includes(term) || username.includes(term);
  });

  const handleSelectFriend = (friend) => {
    const fullName = `${friend.firstName || ""} ${
      friend.lastName || ""
    }`.trim();

    setSelectedFriendUid(friend.uid);

    setFriendName(truncateName(fullName, 15));

    setFriendHistoryOpen(false);
    setSelectedMoment(null);
    setSelectedQueue(null);
    setTimeout(() => setIsVisible(false), 500);
  };

  const handleSelectAll = () => {
    setSelectedFriendUid(null);

    setFriendName(t("history_select_friend.everyone"));

    setFriendHistoryOpen(false);
    setSelectedMoment(null);
    setSelectedQueue(null);
    setTimeout(() => setIsVisible(false), 500);
  };

  const handleSelectMe = () => {
    setSelectedFriendUid(user?.uid);

    setFriendName(t("history_select_friend.you"));

    setFriendHistoryOpen(false);
    setSelectedMoment(null);
    setSelectedQueue(null);
    setTimeout(() => setIsVisible(false), 500);
  };

  const isSearching = searchTerm.trim().length > 0;

  if (!isVisible) return null;

  return (
    <div
      onClick={onClick}
      className={clsx(
        "fixed inset-0 z-60 flex justify-center items-start backdrop-blur-[3px] px-4 bg-base-100/70 transition-opacity duration-500 ease-in-out",
        {
          "opacity-100 pointer-events-auto": isFriendHistoryOpen,
          "opacity-0 pointer-events-none": !isFriendHistoryOpen,
        },
      )}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={clsx(
          "bg-base-100 border border-base-300 rounded-3xl shadow-md py-3 overflow-hidden w-full max-w-xs sm:max-w-sm max-h-[500px] mt-14 transition-all duration-500 ease-in-out transform origin-top",
          {
            "opacity-100 scale-100": isFriendHistoryOpen,
            "opacity-0 scale-0": !isFriendHistoryOpen,
          },
        )}
      >
        <h3 className="font-semibold text-base px-4">{t("history_select_friend.title")}</h3>
        <div className="w-full px-4 border-b py-2 border-base-300">
          <SearchInput
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            isFocused={isFocusedFind}
            setIsFocused={setIsFocusedFind}
            placeholder={t("history_select_friend.search_placeholder")}
          />
        </div>
        <div className="space-y-1.5 max-h-90 overflow-y-auto pt-3 px-4">
          {!isSearching && (
            <>
              {/* Mọi người */}
              <div
                onClick={handleSelectAll}
                className="flex items-center bg-base-200 p-2 justify-between hover:bg-base-200 rounded-2xl transition cursor-pointer active:scale-97 select-none"
              >
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-base-300 flex items-center justify-center">
                    <FaUserFriends className="w-5 h-5" />
                  </div>
                  <span className="text-base font-medium">{t("history_select_friend.everyone")}</span>
                </div>
                <ChevronRight className="w-5 h-5 text-base-content" />
              </div>

              {/* Bạn */}
              <div
                onClick={handleSelectMe}
                className="flex bg-base-200 p-2 items-center justify-between hover:bg-base-200 rounded-2xl transition cursor-pointer active:scale-97 select-none"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={getAvatarOrFallback(user?.profilePicture)}
                    alt={t("history_select_friend.you")}
                    onError={imageFallback()}
                    className="w-10 h-10 rounded-full border-[2.5px] p-0.5 border-base-300 object-cover"
                  />
                  <span className="text-base font-medium">{t("history_select_friend.you")}</span>
                </div>
                <ChevronRight className="w-5 h-5 text-base-content" />
              </div>
            </>
          )}

          {/* Danh sách bạn bè */}
          {filteredFriends.length > 0 ? (
            filteredFriends.map((friend) => (
              <div
                key={friend.uid}
                onClick={() => handleSelectFriend(friend)}
                className="flex bg-base-200 p-2 items-center justify-between hover:bg-base-200 rounded-2xl transition cursor-pointer active:scale-97 select-none"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={getAvatarOrFallback(friend.profilePic)}
                    alt={friend.name || "avatar"}
                    className="w-10 h-10 rounded-full border-[2.5px] p-0.5 border-amber-400 object-cover"
                    onError={imageFallback}
                  />
                  <span className="text-base font-medium truncate max-w-[180px]">
                    {friend.firstName} {friend.lastName}
                  </span>
                </div>
                <ChevronRight className="w-5 h-5 text-base-content" />
              </div>
            ))
          ) : (
            <div className="text-gray-400 italic text-sm text-center mt-4">
              {t("history_select_friend.no_friends")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
export default HistorySelectFriend;

const truncateName = (name, length = 10) => {
  return name.length > length ? name.slice(0, length) + "..." : name;
};
