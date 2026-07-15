import React, { useEffect, useState, useMemo } from "react";
import ReactDOM from "react-dom";
import { X, Check } from "lucide-react";
import SearchInput from "@/components/uikit/Input/SearchInput";
import { useFriendStoreV3 } from "@/stores";
import { createGroup } from "@/services";
import { SonnerPromiseV2 } from "@/components/uikit/SonnerToast";
import { useTranslation } from "react-i18next";

const CreateGroupModal = ({ open, onClose, onCreated }) => {
  const { t } = useTranslation("main");
  const [showModal, setShowModal] = useState(false);
  const [animate, setAnimate] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [selectedUids, setSelectedUids] = useState(new Set());
  const [loading, setLoading] = useState(false);

  const friendList = useFriendStoreV3((s) => s.friendList);
  const friendDetailsMap = useFriendStoreV3((s) => s.friendDetailsMap);

  useEffect(() => {
    document.body.style.overflow = showModal ? "hidden" : "";
    return () => (document.body.style.overflow = "");
  }, [showModal]);

  useEffect(() => {
    if (open) {
      setShowModal(true);
      setTimeout(() => setAnimate(true), 10);
    } else {
      setAnimate(false);
      setTimeout(() => {
        setShowModal(false);
        setSelectedUids(new Set());
      }, 300);
    }
  }, [open]);

  const friends = useMemo(() => {
    return friendList
      .map((uid) => friendDetailsMap[uid])
      .filter(Boolean)
      .filter((f) => {
        if (f.isCelebrity) return false;
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
          (f.firstName || "").toLowerCase().includes(q) ||
          (f.lastName || "").toLowerCase().includes(q) ||
          (f.username || "").toLowerCase().includes(q)
        );
      });
  }, [friendList, friendDetailsMap, searchQuery]);

  const toggleUid = (uid) => {
    setSelectedUids((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const handleCreate = async () => {
    const uids = [...selectedUids];
    if (!uids.length) return;

    setLoading(true);
    const promise = createGroup({ userIds: uids, initialMessage: "Hello, this group was created on Huy Locket💛!" });

    SonnerPromiseV2(promise, {
      loading: t("right.creating_group"),
      success: (group) => {
        if (group) onCreated?.(group);
        onClose();
        console.log(group);
        
        return t("right.create_group_success");
      },
      error: t("right.create_group_failed"),
    });

    promise.finally(() => setLoading(false));
  };

  if (!showModal) return null;

  return ReactDOM.createPortal(
    <div
      className={`fixed inset-0 bg-base-100/30 backdrop-blur-[4px] transition-opacity duration-500 z-[70] ${
        animate ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      onClick={onClose}
    >
      <div
        className={`fixed h-[90%] border-t border-base-300 text-base-content bottom-0 left-0 w-full p-4 bg-base-100 rounded-t-4xl shadow-lg transition-all duration-500 z-[71] flex flex-col
        ${animate ? "translate-y-0" : "translate-y-full"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">{t("right.create_new_group")}</h3>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-sm btn-circle rounded-full bg-base-300"
          >
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-base-content/60 mb-3">
          {t("right.select_min_friends")}
        </p>

        <div className="mb-3">
          <SearchInput
            searchTerm={searchQuery}
            setSearchTerm={setSearchQuery}
            isFocused={isFocused}
            setIsFocused={setIsFocused}
            placeholder={t("right.search_friends")}
          />
        </div>

        <div className="flex-1 overflow-y-auto pb-20">
          {friends.length === 0 ? (
            <p className="text-center text-sm text-base-content/40 mt-4">
              {t("right.no_matching_friends")}
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {friends.map((friend) => {
                const isSelected = selectedUids.has(friend.uid);

                return (
                  <div
                    key={friend.uid}
                    onClick={() => toggleUid(friend.uid)}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl cursor-pointer transition
                      hover:bg-base-200 hover:scale-105
                      ${
                        selectedUids.size > 0
                          ? isSelected
                            ? "opacity-100"
                            : "opacity-50 blur-[0.3px]"
                          : "opacity-100"
                      }
                    `}
                  >
                    <div
                      className={`relative rounded-full p-[2px] transition
    ${isSelected ? "ring-3 ring-yellow-400" : "ring-0"}`}
                    >
                      {friend.profilePic ? (
                        <img
                          src={friend.profilePic}
                          className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-full object-cover border border-base-300"
                        />
                      ) : (
                        <img
                          src="./images/default_profile.png"
                          className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-full object-cover border border-base-300"
                        />
                      )}

                      {isSelected && (
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-yellow-400 border-2 border-base-100 flex items-center justify-center shadow-md">
                          <Check size={14} className="text-black stroke-[3]" />
                        </div>
                      )}
                    </div>

                    <span className="text-xs font-medium text-center line-clamp-1">
                      {friend?.firstName} {friend?.lastName}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="fixed bottom-0 left-0 w-full z-[80] p-4">
          <button
            className="btn btn-lg text-base font-semibold rounded-3xl w-full btn-neutral px-6 flex items-center justify-center gap-2"
            disabled={selectedUids.size < 2 || loading}
            onClick={handleCreate}
          >
            {loading ? (
              <span className="loading loading-spinner loading-sm" />
            ) : selectedUids.size < 2 ? (
              `${t("right.select_min_members")}${selectedUids.size === 1 ? t("right.one_more_needed") : ""}`
            ) : (
              t("right.create_group_btn", { count: selectedUids.size })
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default CreateGroupModal;
