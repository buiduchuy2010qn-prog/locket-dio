import SearchInput from "@/components/ui/Input/SearchInput";
import LoadingRing from "@/components/ui/Loading/ring";
import { SonnerPromiseV2 } from "@/components/ui/SonnerToast";
import { removeFriend, toggleHiddenFriend } from "@/services";
import { useVirtualizer } from "@tanstack/react-virtual";
import { RefreshCcw } from "lucide-react";
import { useRef, useMemo, useState, useCallback } from "react";
import { FaUserFriends } from "react-icons/fa";
import FriendItem from "./FriendItem";
import { useFriendObjects } from "@/stores";
import { useTranslation } from "react-i18next";

// Mỗi FriendItem cao khoảng 76px (avatar 64px + padding py-2 = 8px top + 8px bottom)
const ITEM_HEIGHT = 80;
// Số item hiển thị ban đầu khi chưa mở rộng
const INITIAL_COUNT = 3;

const FriendList = ({
  loading,
  refreshFriendsData,
  removeFriendLocal,
  hiddenUserState,
  showAllFriends,
  setShowAllFriends,
}) => {
  const { t } = useTranslation("features");
  const friendObjects = useFriendObjects();
  const parentRef = useRef(null);

  const [lastUpdated, setLastUpdated] = useState(() =>
    localStorage.getItem("friendsUpdatedAt"),
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [isFocused, setIsFocused] = useState(null);

  // --------- handlers (memoized để tránh re-render FriendItem) ---------

  const handleRefreshFriends = useCallback(async () => {
    await SonnerPromiseV2(refreshFriendsData(), {
      loading: t("friends.list.syncing"),
      success: () => {
        const updatedAt = new Date().toISOString();
        localStorage.setItem("friendsUpdatedAt", updatedAt);
        setLastUpdated(updatedAt);
        return t("friends.list.sync_success");
      },
      error: (err) => err?.message || t("friends.list.sync_failed"),
    });
  }, [refreshFriendsData]);

  const handleDeleteFriend = useCallback(
    (uid) =>
      SonnerPromiseV2(
        removeFriend(uid).then((result) => {
          if (result !== uid) throw new Error("DELETE_FAILED");
          removeFriendLocal(uid);
          return result;
        }),
        {
          loading: t("friends.list.deleting"),
          success: t("friends.list.delete_success"),
          error: t("friends.list.error_retry"),
        },
      ),
    [removeFriendLocal],
  );

  const handleHiddenFriend = useCallback(
    (relation, uid) => {
      if (!relation) return;
      const prevHidden = relation.hidden ?? false;
      hiddenUserState(uid, !prevHidden);
      return SonnerPromiseV2(
        toggleHiddenFriend(uid).then((res) => {
          if (!res?.success) throw new Error("UPDATE_FAILED");
          return res;
        }),
        {
          loading: t("friends.list.updating_hidden"),
          success: t("friends.list.update_hidden_success"),
          error: () => {
            hiddenUserState(uid, prevHidden);
            return t("friends.list.update_hidden_failed");
          },
        },
      );
    },
    [hiddenUserState],
  );

  // --------- filter & slice ---------

  const filteredFriends = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return friendObjects.filter((friend) => {
      const fullName = `${friend.firstName} ${friend.lastName}`.toLowerCase();
      const username = (friend.username || "").toLowerCase();
      return fullName.includes(term) || username.includes(term);
    });
  }, [friendObjects, searchTerm]);

  // Khi chưa "Xem thêm" và không search → chỉ lấy INITIAL_COUNT items
  const listItems = useMemo(() => {
    if (searchTerm || showAllFriends) return filteredFriends;
    return filteredFriends.slice(0, INITIAL_COUNT);
  }, [filteredFriends, showAllFriends, searchTerm]);

  // --------- virtualizer (chỉ kích hoạt khi danh sách dài) ---------

  const shouldVirtualize =
    (showAllFriends || !!searchTerm) && listItems.length > INITIAL_COUNT;

  const rowVirtualizer = useVirtualizer({
    count: listItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ITEM_HEIGHT,
    overscan: 5, // render thêm 5 item ngoài viewport để scroll mượt
    enabled: shouldVirtualize,
  });

  return (
    <div>
      <h1 className="flex items-center gap-2 font-semibold text-md mb-1">
        <FaUserFriends size={25} className="scale-x-[-1]" /> {t("friends.list.title")}
      </h1>
      <div className="mt-1 space-y-1 text-sm text-base-content/80">
        <p>
          {t("friends.list.sync_tip")}
        </p>
        <p>
          {t("friends.list.premium_tip")}
        </p>
      </div>

      {/* Search + refresh */}
      <div className="flex gap-2 items-center mt-2">
        <SearchInput
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          isFocused={isFocused}
          setIsFocused={setIsFocused}
          placeholder={t("friends.list.search_placeholder")}
        />
        <button
          className={`btn btn-base-200 text-sm flex items-center gap-2 ${
            loading ? "opacity-50 cursor-not-allowed" : ""
          }`}
          onClick={handleRefreshFriends}
          disabled={loading}
        >
          {loading ? (
            <>
              <LoadingRing size={20} stroke={2} />
              <span>{t("friends.list.syncing_btn")}</span>
            </>
          ) : (
            <>
              <RefreshCcw className="w-5 h-5" />
              <span>{t("friends.list.sync_btn")}</span>
            </>
          )}
        </button>
      </div>

      {/* Last updated */}
      {lastUpdated && (
        <p className="text-xs text-gray-500 mt-1">
          {t("friends.list.last_updated", { time: new Date(lastUpdated).toLocaleString() })}
        </p>
      )}

      {/* List */}
      <div className="mt-4">
        {filteredFriends.length === 0 && (
          <p className="text-gray-400 text-center mt-10">
            {t("friends.list.no_friends_to_show")}
          </p>
        )}

        {shouldVirtualize ? (
          /* ---- VIRTUAL SCROLLING khi danh sách dài ---- */
          <div ref={parentRef} className="h-2/3 overflow-y-auto">
            <div
              style={{
                height: rowVirtualizer.getTotalSize(),
                position: "relative",
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const friend = listItems[virtualRow.index];
                return (
                  <div
                    key={friend.uid}
                    style={{
                      position: "absolute",
                      top: virtualRow.start,
                      left: 0,
                      right: 0,
                      height: virtualRow.size,
                    }}
                  >
                    <FriendItem
                      friend={friend}
                      onDelete={handleDeleteFriend}
                      onHidden={handleHiddenFriend}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* ---- NORMAL render khi ít item (≤ INITIAL_COUNT) ---- */
          listItems.map((friend) => (
            <FriendItem
              key={friend.uid}
              friend={friend}
              onDelete={handleDeleteFriend}
              onHidden={handleHiddenFriend}
            />
          ))
        )}

        {/* Expand / Collapse button */}
        {!searchTerm && filteredFriends.length > INITIAL_COUNT && (
          <div className="flex items-center gap-4 mt-4">
            <hr className="flex-grow border-t border-base-content" />
            <button
              onClick={() => setShowAllFriends(!showAllFriends)}
              className="bg-base-200 hover:bg-base-300 text-base-content font-semibold px-4 py-2 rounded-3xl"
            >
              {showAllFriends
                ? t("friends.list.collapse")
                : t("friends.list.expand", { count: filteredFriends.length - INITIAL_COUNT })}
            </button>
            <hr className="flex-grow border-t border-base-content" />
          </div>
        )}
      </div>
    </div>
  );
};

export default FriendList;
