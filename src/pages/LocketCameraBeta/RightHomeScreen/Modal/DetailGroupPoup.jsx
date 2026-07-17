import React, { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import clsx from "clsx";
import {
  Bell,
  BellOff,
  Pencil,
  UserRoundPlus,
  Flag,
  MoreHorizontal,
  CircleMinus,
  UserRoundX,
  CircleQuestionMark,
  Undo2,
  X,
  Plus,
} from "lucide-react";
import { useFriendStoreV3, useGroupChatStore, useAuthStore, useMembersGroupStore } from "@/stores";
import {
  addGroupMember,
  removeGroupMember,
  updateGroupName,
  toggleGroupMute,
} from "@/services";
import {
  SonnerInfo,
  SonnerPromise,
  SonnerPromiseV2,
} from "@/components/uikit/SonnerToast";
import AddMemberModal from "./AddMemberModal";
import SearchInput from "@/components/uikit/Input/SearchInput";
import EditGroupPoup from "./EditGroupModal";
import ConfirmPoup from "@/features/PoupScreen/ConfirmPoup";
import { GroupAvatarStack } from "@/components/uikit/ConversationItem/GroupAvatarStack";
import { useAvailableFriends } from "@/hooks";
import { getAvatarOrFallback, imageFallback } from "@/utils";
import { useTranslation } from "react-i18next";

const DetailGroupPoup = ({
  open,
  onClose,
  group,
  members,
  loading = false,
}) => {
  const { t } = useTranslation("main");
  const [showModal, setShowModal] = useState(false);
  const [animate, setAnimate] = useState(false);
  const [openMenuUserId, setOpenMenuUserId] = useState(null);

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
      setTimeout(() => setShowModal(false), 300);
    }
  }, [open]);

  const myUser = useAuthStore((s) => s.user);
  const myUserId = myUser?.uid;
  const friendList = useFriendStoreV3((s) => s.friendList);
  const upsertGroup = useGroupChatStore((s) => s.upsertGroup);
  const removeGroups = useGroupChatStore((s) => s.removeGroups);
  const addMemberToGroup = useMembersGroupStore((s) => s.addMemberToGroup);
  const removeMemberFromGroup = useMembersGroupStore((s) => s.removeMemberFromGroup);

  const [showAddMember, setShowAddMember] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingAction, setLoadingAction] = useState(null);

  const [showEditGroup, setShowEditGroup] = useState(false);

  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);

  const [openLeaveModal, setOpenLeaveModal] = useState(false);

  const handleOpenRemoveMember = (userId) => {
    setSelectedMember({
      userId,
      name: getFriendName(userId),
    });

    setOpenDeleteModal(true);
  };

  const handleReportUser = (userId) => {
    SonnerInfo(t("right.user_report_submitted"));
    console.log("report user:", userId);
  };

  const handleToggleMute = () => {
    setLoadingAction("mute");

    const promise = toggleGroupMute({
      groupId: group.id,
      muted: !group.muted,
    });

    SonnerPromise(promise, {
      loading: t("right.updating"),
      success: () => {
        upsertGroup({ id: group.id, muted: !group.muted });
        return group.muted ? t("right.notifications_unmuted") : t("right.notifications_muted");
      },
      error: t("right.update_failed"),
    });

    promise.finally(() => setLoadingAction(null));
  };

  const availableFriends = useAvailableFriends(group?.id, searchQuery);

  const handleAddMember = (userId) => {
    const promise = addGroupMember({
      groupId: group.id,
      userId,
    });

    SonnerPromise(promise, {
      loading: t("right.adding_member"),
      success: (res) => {
        if (res) {
          upsertGroup(res);
          // Cập nhật groupMembersMap ngay, fetch profile nếu chưa có
          addMemberToGroup(group.id, userId);
        }
        return t("right.add_member_success");
      },
      error: t("right.add_member_failed"),
    });

    setLoadingAction(`add_${userId}`);

    promise.finally(() => {
      setLoadingAction(null);
    });
  };

  const handleRemoveMember = async () => {
    if (!selectedMember) return;

    setLoadingAction(`remove_${selectedMember.userId}`);

    try {
      const updated = await SonnerPromiseV2(
        removeGroupMember({
          groupId: group.id,
          userId: selectedMember.userId,
        }),
        {
          loading: t("right.removing_member"),
          success: t("right.remove_member_success", { name: selectedMember.name }),
          error: (err) => err?.message || t("right.remove_member_failed"),
        },
      );

      if (updated) {
        upsertGroup(updated);
        // Xoá member khỏi groupMembersMap ngay
        removeMemberFromGroup(group.id, selectedMember.userId);
      }

      setOpenDeleteModal(false);
      setSelectedMember(null);
    } finally {
      setLoadingAction(null);
    }
  };

  // Locket: group id is typically "{ownerUid}-…"; no transfer-ownership API in client
  const isGroupOwner = Boolean(
    myUserId && group?.id && String(group.id).startsWith(`${myUserId}-`),
  );

  const handleLeaveGroup = async () => {
    if (isGroupOwner) {
      SonnerInfo(t("right.owner_cannot_leave"));
      setOpenLeaveModal(false);
      return;
    }

    setLoadingAction("leave");

    try {
      await SonnerPromiseV2(
        removeGroupMember({
          groupId: group.id,
          userId: myUserId,
        }),
        {
          loading: t("right.leaving_group"),
          success: t("right.leave_group_success", { name: group.name }),
          error: (err) => err?.message || t("right.leave_group_failed"),
        },
      );

      removeGroups([group.id]);
      onClose?.();
    } finally {
      setLoadingAction(null);
    }
  };

  const handleAddFriend = async (uid) => {
    try {
      SonnerInfo(t("right.not_activated_yet"));
    } finally {
    }
  };

  const getFriendName = (userId) => {
    const info = members.find((m) => m.uid === userId);

    const fullName = `${info?.firstName || ""} ${info?.lastName || ""}`.trim();

    return fullName || userId?.slice(0, 8) || "Unknown";
  };
  const getStatus = (userId) => {
    const info = members.find((m) => m.uid === userId);

    const isfriend = info?.status === "friend";

    return isfriend;
  };

  const getFriendAvatar = (userId) => {
    return members.find((m) => m.uid === userId)?.profilePic || null;
  };

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
      onClick={!loading ? onClose : undefined}
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
        {/* Close button */}
        <button onClick={onClose} className="absolute top-2 right-3">
          <X className="w-8 h-8 btn btn-circle p-1" />
        </button>
        <div className="shrink-0 space-y-4 pb-3 border-b border-base-300">
          {/* Avatar + Name */}
          <div className="flex flex-col items-center gap-3">
            <div className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center bg-base-300">
              {group?.image_url ? (
                <img
                  src={group?.image_url}
                  alt={group?.name}
                  className="w-full h-full object-cover"
                  onError={imageFallback()}
                />
              ) : (
                <GroupAvatarStack members={members.slice(0, 5)} />
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold">
                {group?.name || t("right.chat_group")}
              </span>

              <button
                onClick={() => setShowEditGroup(true)}
                className="btn btn-ghost btn-xs btn-square text-secondary"
              >
                <Pencil size={18} />
              </button>
            </div>
          </div>

          <div className="p-3 bg-base-200 rounded-xl space-y-2">
            {/* Toggle mute */}
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-3">
                {group?.muted ? (
                  <BellOff size={18} className="text-base-content/60" />
                ) : (
                  <Bell size={18} />
                )}
                <span className="font-medium">{t("right.mute_notifications")}</span>
              </div>

              <input
                type="checkbox"
                checked={group?.muted}
                onChange={handleToggleMute}
                className="toggle toggle-secondary"
              />
            </div>

            <div className="divider my-0 opacity-30" />

            {/* Leave group — owner blocked (no transfer API on Locket client) */}
            <button
              onClick={() => {
                if (isGroupOwner) {
                  SonnerInfo(t("right.owner_cannot_leave"));
                  return;
                }
                setOpenLeaveModal(true);
              }}
              className="flex items-center gap-3 w-full py-2 hover:bg-error/10 rounded-lg transition-colors"
            >
              <Undo2 size={18} className="text-error" />
              <span className="font-medium text-error">
                {isGroupOwner
                  ? t("right.leave_group_owner_label")
                  : t("right.leave_group")}
              </span>
            </button>
            {isGroupOwner ? (
              <p className="text-[11px] text-base-content/50 px-1">
                {t("right.owner_cannot_leave_hint")}
              </p>
            ) : null}
          </div>

          {/* Search input */}
          <SearchInput
            searchTerm={searchQuery}
            setSearchTerm={setSearchQuery}
            isFocused={false}
            setIsFocused={() => {}}
            placeholder={t("right.search_members")}
          />

          {/* Member header */}
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-base-content/80">
              {t("right.members_count", { count: members.length })}
            </h4>

            <button
              onClick={() => setShowAddMember(true)}
              className="btn btn-secondary btn-sm rounded-full gap-1"
            >
              <UserRoundPlus size={16} />
              {t("right.add_member")}
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto space-y-5 pt-4">
          {/* Member list */}
          <div className="space-y-1">
            {/* SELF INFO */}
            <div
              className={clsx("flex items-center justify-between p-2", {
                hidden: searchQuery?.trim(),
              })}
            >
              <div className="flex items-center gap-3">
                <img
                  src={getAvatarOrFallback(myUser.profilePicture)}
                  className="w-9 h-9 rounded-full"
                  onError={(e) => {
                    e.currentTarget.src = "./images/default_profile.png";
                  }}
                />

                <div>
                  <p className="text-sm font-medium">{myUser?.displayName}</p>
                  <p className="text-[10px] text-base-content/40">{t("right.you")}</p>
                </div>
              </div>
            </div>
            {members
              .filter((m) => m.uid !== myUserId)
              .filter((m) => {
                if (!searchQuery) return true;
                const name = getFriendName(m.uid).toLowerCase();
                return name.includes(searchQuery.toLowerCase());
              })
              .map(({ uid }) => {
                const isSelf = uid === myUserId;
                const avatar = getFriendAvatar(uid);
                const name = getFriendName(uid);
                const isfriend = getStatus(uid);
                const isOpen = openMenuUserId === uid;

                return (
                  <div
                    key={uid}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-base-200 transition-colors relative"
                  >
                    {/* LEFT */}
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={getAvatarOrFallback(avatar)}
                        className="w-9 h-9 rounded-full"
                      />

                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{name}</p>
                        {isSelf && (
                          <p className="text-[10px] text-base-content/40">
                            {t("right.you")}
                          </p>
                        )}
                        {!isfriend && (
                          <p className="text-[10px] text-base-content/40">
                            {t("right.not_friends_yet")}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!isfriend && (
                        <button
                          onClick={() => handleAddFriend(uid)}
                          className="flex btn btn-sm items-center gap-1 px-3 py-1 rounded-full font-semibold bg-yellow-500 text-black hover:bg-yellow-400"
                        >
                          <Plus size={14} />
                          {t("right.add_friend")}
                        </button>
                      )}
                      {/* RIGHT - 3 DOT MENU */}
                      {!isSelf && (
                        <div className="relative">
                          <button
                            onClick={() =>
                              setOpenMenuUserId(isOpen ? null : uid)
                            }
                            className="btn btn-ghost btn-xs btn-circle"
                          >
                            <MoreHorizontal size={16} />
                          </button>

                          {/* DROPDOWN */}
                          {isOpen && (
                            <div className="absolute right-0 bottom-8 w-40 bg-base-100 shadow-lg rounded-xl border border-base-300 z-50 overflow-hidden">
                              {/* REMOVE */}
                              <button
                                onClick={() => {
                                  handleOpenRemoveMember(uid);
                                  setOpenMenuUserId(null);
                                }}
                                className="flex items-center gap-2 w-full px-3 py-2 hover:bg-base-200 text-error"
                              >
                                <CircleMinus size={18} />
                                {t("right.remove_from_group")}
                              </button>

                              {/* REPORT */}
                              <button
                                onClick={() => {
                                  handleReportUser(uid);
                                  setOpenMenuUserId(null);
                                }}
                                className="flex items-center gap-2 w-full px-3 py-2 hover:bg-base-200 text-warning"
                              >
                                <Flag size={18} />
                                {t("right.report")}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
        <AddMemberModal
          open={showAddMember}
          onClose={() => setShowAddMember(false)}
          availableFriends={availableFriends}
          onAddMember={handleAddMember}
          loadingAction={loadingAction}
        />
        <EditGroupPoup
          open={showEditGroup}
          onClose={() => setShowEditGroup(false)}
          group={group}
          onUpdated={(updated) => {
            upsertGroup(updated);
          }}
        />
        <ConfirmPoup
          open={openDeleteModal}
          onClose={() => {
            setOpenDeleteModal(false);
            setSelectedMember(null);
          }}
          onConfirm={handleRemoveMember}
          title={t("right.remove_member_title")}
          icon={<UserRoundX size={28} className="text-error" />}
          labelConfirm={t("right.remove_from_group")}
        >
          {selectedMember && (
            <>
              {t("right.remove_member_confirm", { name: selectedMember.name })}
              <br />
              {t("right.action_cannot_be_undone")}
            </>
          )}
        </ConfirmPoup>

        <ConfirmPoup
          open={openLeaveModal}
          onClose={() => setOpenLeaveModal(false)}
          onConfirm={handleLeaveGroup}
          title={t("right.leave_group_title")}
          icon={<CircleQuestionMark size={28} className="text-black" />}
          labelConfirm={t("right.leave_group")}
        >
          <>
            {t("right.leave_group_confirm")}
            <br />
            {t("right.action_cannot_be_undone")}
          </>
        </ConfirmPoup>
      </div>
    </div>,
    document.body,
  );
};

export default DetailGroupPoup;
