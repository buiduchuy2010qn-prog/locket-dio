import { useState } from "react";
import NormalItemFriend from "./NormalItemFriend";
import { FaSearchPlus } from "react-icons/fa";
import SearchInput from "@/components/ui/Input/SearchInput";
import CelebItemFriend from "./CelebItemFriend";
import {
  SonnerInfo,
  SonnerPromiseV2,
  SonnerWarning,
} from "@/components/ui/SonnerToast";
import {
  FindFriendByUserName,
  getFriendshipStatus,
  SendRequestToCelebrity,
  SendRequestToFriend,
  shareHistoryWithFriend,
} from "@/services";
import BouncyLoader from "@/components/ui/Loading/Bouncy";
import { useFeatureVisible } from "@/hooks/useFeature";
import { useNavigate } from "react-router-dom";
import { useShareHistory } from "@/stores";
import { useTranslation } from "react-i18next";

const FindFriend = () => {
  const { t } = useTranslation("features");
  const navigate = useNavigate();
  const isSendRequest = useFeatureVisible("send_friend_request");

  const { shareHistoryOn, toggleShareHistoryOn } = useShareHistory();

  const [loading, setLoading] = useState(false);
  const [searchTermFind, setSearchTermFind] = useState("");
  const [foundUser, setFoundUser] = useState(null);
  const [isFocusedFind, setIsFocusedFind] = useState(null);
  const [sending, setSending] = useState(false); // 👉 NEW

  const [friendshipStatus, setFriendshipStatus] = useState("NONE");

  const handleFindFriend = async (username) => {
    if (!username) return;

    setLoading(true);
    setFoundUser(null);

    try {
      const result = await SonnerPromiseV2(FindFriendByUserName(username), {
        loading: t("friends.find.searching_user"),
        success: t("friends.find.user_found"),
        error: (err) => {
          if (err?.message === t("friends.find.user_not_exist") || err?.message === "Người dùng không tồn tại") {
            return err.message;
          }

          return t("friends.find.error_try_again");
        },
      });

      if (result?.success) {
        setFoundUser(result.data);

        const status = await getFriendshipStatus(result.data.uid);
        setFriendshipStatus(status);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddFriend = async () => {
    if (!foundUser || sending) return;

    if (!isSendRequest) {
      SonnerWarning(
        t("friends.find.feature_locked_title"),
        t("friends.find.feature_locked_desc"),
        {
          action: {
            label: t("friends.find.upgrade_label"),
            onClick: () => navigate("/pricing"),
          },
        },
      );
      return;
    }

    try {
      setSending(true);

      if (foundUser?.celebrity) {
        const res = await SonnerPromiseV2(
          SendRequestToCelebrity(foundUser.uid),
          {
            loading: t("friends.find.sending_request"),
            success: t("friends.find.send_success"),
            error: (err) => err?.message || t("friends.find.send_failed"),
          },
        );

        if (res?.success) {
          setFriendshipStatus("OUTGOING");

          setFoundUser((prev) => ({
            ...prev,
            friendship_status: "outgoing-follow-request",
          }));
        }

        return;
      }

      const res = await SonnerPromiseV2(SendRequestToFriend(foundUser.uid), {
        loading: t("friends.find.sending_request"),
        success: t("friends.find.send_success"),
        error: (err) => err?.message || t("friends.find.send_failed"),
      });

      if (res?.status === "real-user") {
        setFriendshipStatus("OUTGOING");

        if (shareHistoryOn) {
          SonnerInfo(t("friends.find.history_share_info"));

          await shareHistoryWithFriend(foundUser.uid);
        }
      }
    } catch (error) {
      // SonnerPromise đã hiện lỗi rồi
      console.error(error);
    } finally {
      setSending(false);
    }
  };

  const isCelebrity = foundUser?.celebrity === true;

  return (
    <div>
      <h2 className="flex items-center gap-2 text-md font-semibold mb-1">
        <FaSearchPlus size={22} /> {t("friends.find.search_title")}
      </h2>
      <p className="text-sm">{t("friends.find.anti_spam")}</p>

      <div className="flex items-center justify-between py-3">
        <div className="flex items-center gap-3">
          <div>
            <p className="font-medium">{t("friends.find.share_history_title")}</p>
            <p className="text-sm text-base-content/60">
              {t("friends.find.share_history_desc")}
            </p>
          </div>
        </div>

        <input
          type="checkbox"
          checked={shareHistoryOn}
          onChange={toggleShareHistoryOn}
          className="toggle toggle-secondary"
        />
      </div>

      <div className="flex gap-2 items-center">
        <SearchInput
          searchTerm={searchTermFind}
          setSearchTerm={setSearchTermFind}
          isFocused={isFocusedFind}
          setIsFocused={setIsFocusedFind}
          placeholder={t("friends.find.add_friend_placeholder")}
        />

        {searchTermFind && (
          <button
            disabled={loading}
            className="btn btn-base-200 text-base flex items-center gap-2 rounded-full disabled:opacity-50"
            onClick={() => handleFindFriend(searchTermFind)}
          >
            {loading ? (
              <>
                <BouncyLoader size={25} /> {t("friends.find.wait")}
              </>
            ) : (
              t("friends.find.search_btn")
            )}
          </button>
        )}
      </div>

      <div className="w-full flex justify-center mt-2">
        {foundUser ? (
          isCelebrity ? (
            <CelebItemFriend
              friend={foundUser}
              handleAddFriend={handleAddFriend}
              loading={loading}
            />
          ) : (
            <NormalItemFriend
              friend={foundUser}
              handleAddFriend={handleAddFriend}
              loading={sending}
              disabled={sending}
              status={friendshipStatus}
            />
          )
        ) : (
          <p className="text-gray-400 h-[70px] text-center">
            {loading ? t("friends.find.searching") : t("friends.find.no_data")}
          </p>
        )}
      </div>
    </div>
  );
};

export default FindFriend;
