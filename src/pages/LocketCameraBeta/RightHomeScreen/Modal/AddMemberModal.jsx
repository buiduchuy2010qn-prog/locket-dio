import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { Check, Users, X } from "lucide-react";
import SearchInput from "@/components/uikit/Input/SearchInput";
import clsx from "clsx";
import { useTranslation } from "react-i18next";

const AddMemberModal = ({
  open,
  onClose,
  availableFriends = [],
  onAddMember,
  loadingAction,
}) => {
  const { t } = useTranslation("main");
  const [showModal, setShowModal] = useState(false);
  const [animate, setAnimate] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const [selectedUid, setSelectedUid] = useState(null);

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
        setSelectedUid(null);
      }, 300);
    }
  }, [open]);

  const filteredFriends = availableFriends.filter((f) => {
    if (f.isCelebrity) return false;

    if (!searchQuery) return true;

    const q = searchQuery.toLowerCase();
    return (
      (f.firstName || "").toLowerCase().includes(q) ||
      (f.username || "").toLowerCase().includes(q)
    );
  });

  if (!showModal) return null;

  return ReactDOM.createPortal(
    <div
      className={clsx(
        "fixed inset-0 bg-base-100/30 backdrop-blur-[4px] transition-opacity duration-500 z-[60] overflow-hidden",
        {
          "opacity-100": animate,
          "opacity-0 pointer-events-none": !animate,
        },
      )}
      onClick={onClose}
    >
      <div
        className={clsx(
          "fixed h-[90%] border-t border-base-300 bottom-0 left-0 w-full pt-4 px-4 bg-base-100 rounded-t-4xl shadow-lg transition-all duration-500 ease-in-out z-[63] flex flex-col text-base-content",
          {
            "translate-y-0": animate,
            "translate-y-full": !animate,
          },
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-2 right-3">
          <X className="w-8 h-8 btn btn-circle p-1" />
        </button>
        <h3 className="text-xl font-semibold text-center mb-2">
          {t("right.add_to_group")}
        </h3>

        <p className="text-sm text-base-content/60 mb-3">
          {t("right.new_member_notice")}
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

        {/* list */}
        <div className="flex-1 overflow-y-auto pb-16">
          {filteredFriends.length === 0 ? (
            <p className="text-center text-sm text-base-content/40 mt-4">
              {t("right.no_matching_friends")}
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {filteredFriends.map((friend) => {
                const isSelected = selectedUid === friend.uid;
                const fullName =
                  `${friend?.firstName || ""} ${friend?.lastName || ""}`.trim() ||
                  friend?.username ||
                  "Unknown";

                const displayName =
                  fullName.length > 10
                    ? `${fullName.slice(0, 10)}...`
                    : fullName;
                return (
                  <div
                    key={friend.uid}
                    onClick={() => setSelectedUid(friend.uid)}
                    className={clsx(
                      "flex flex-col items-center gap-2 p-3 rounded-xl cursor-pointer transition hover:bg-base-200 hover:scale-105",
                      {
                        "opacity-100":
                          !selectedUid || selectedUid === friend.uid,
                        "opacity-50 blur-[0.3px]":
                          selectedUid && selectedUid !== friend.uid,
                      },
                    )}
                  >
                    <div
                      className={clsx("relative rounded-full p-[2px]", {
                        "ring-3 ring-yellow-400": isSelected,
                        "ring-0": !isSelected,
                      })}
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

                    {/* name */}
                    <span className="text-xs font-medium text-center line-clamp-1">
                      {displayName}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* footer */}
        <div className="fixed bottom-0 left-0 w-full z-[80] p-4">
          <button
            className="btn btn-lg text-base font-semibold rounded-3xl w-full btn-neutral px-6 flex items-center justify-center gap-2"
            disabled={!selectedUid || loadingAction}
            onClick={() => {
              if (!selectedUid) return;
              onAddMember(selectedUid);
            }}
          >
            {t("right.add_to_group")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default AddMemberModal;
