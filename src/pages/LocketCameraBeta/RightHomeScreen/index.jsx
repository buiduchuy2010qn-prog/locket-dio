import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/context/AppContext";
import { markGroupAsRead, markReadMessage } from "@/services";
import { CONFIG } from "@/config";
import { useSocket } from "@/context/SocketContext";
import {
  useAuthStore,
  useGroupChatStore,
  useConversationsStore,
  useUserMessagesStore,
  useGroupMessagesStore,
  useMembersGroupStore,
} from "@/stores";
import HeaderConversation from "./Layout/HeaderConversation";
import ConversationWithUser from "./Views/ConversationWithUser";
import ConversationList from "./Views/ConversationList";
import clsx from "clsx";
import {
  useConversations,
  useGroupRelay,
  useConversationSocket,
  useHasGroup,
} from "@/hooks";
import { SonnerInfo } from "@/components/ui/SonnerToast";
import ConversationWithGroup from "./Views/ConversationWithGroup";
import ButtonCreateGroup from "./Layout/ButtonCreateGroup";
import CreateGroupModal from "./Modal/CreateGroupModal";

const INITIAL_DISPLAY_COUNT = CONFIG.ui.chat.initialVisible;

// ================= Component: RightHomeScreen =================
const RightHomeScreen = ({ setIsHomeOpen }) => {
  const { user } = useAuthStore();
  const { navigation } = useApp();
  const { isHomeOpen } = navigation;

  const { socket, isConnected } = useSocket();
  const [selectedChat, setSelectedChat] = useState(null);
  const [isOpenConvesation, setOpenConversation] = useState(false);
  const [displayCount, setDisplayCount] = useState(INITIAL_DISPLAY_COUNT);
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  const idToken = localStorage.getItem("idToken");

  // ── Stores ──
  const conversations = useConversations();
  const conversationsLoading = useConversationsStore((s) => s.loading);
  const getMessagesByUser = useUserMessagesStore((s) => s.getMessagesByUser);
  
  const fetchGroupMessages = useGroupMessagesStore((s) => s.fetchGroupMessages);
  const updateGroupState = useGroupChatStore((s) => s.updateGroupState);
  const upsertGroup = useGroupChatStore((s) => s.upsertGroup);
  const hydrateMembersFromGroups = useMembersGroupStore((s) => s.hydrateMembersFromGroups);
  const hasGroup = useHasGroup();

  // ── Derived state ──
  const conversationId = selectedChat?.type === "with-user" ? selectedChat?.id : null;
  const groupId = selectedChat?.type === "group" ? selectedChat?.id : null;

  // ── Socket hook: quản lý toàn bộ socket conversation ──
  useConversationSocket({
    socket,
    idToken,
    isHomeOpen,
    conversationId,
  });

  // ── Group WebSocket relay ──
  const { status: relayStatus, sendReconnect } = useGroupRelay(
    idToken,
    user?.uid,
    !!idToken && !!user?.uid && isConnected,
  );

  // ── Tin nhắn đang hiển thị theo conversation được chọn ──
  const userMessages = useUserMessagesStore((s) => s.messages[conversationId]?.items);
  const groupMessages = useGroupMessagesStore((s) => s.messages[groupId]?.items);
  const messagesByConversation = (selectedChat?.type === "group" ? groupMessages : userMessages) || [];

  // ── Reset displayCount khi đóng sidebar ──
  useEffect(() => {
    if (!isHomeOpen) {
      setDisplayCount(INITIAL_DISPLAY_COUNT);
    }
  }, [isHomeOpen]);

  // ── Chọn conversation ──
  const handleSelectChat = async (chat) => {
    setOpenConversation((prev) => !prev);
    setSelectedChat(chat);

    if (!chat) return;

    if (chat.type === "with-user") {
      await getMessagesByUser(chat.id);
      if (chat.isRead === false) {
        await markReadMessage(chat.id);
      }
    } else if (chat.type === "group") {
      await fetchGroupMessages(chat.id);
      if (chat.isRead === false) {
        const ts = Number(chat?.updatedAt) || Date.now();
        // Optimistic: reset unread local ngay để list ngoài hiện đã đọc.
        updateGroupState(chat.id, { unread_count: 0, last_read_at: ts });
        await markGroupAsRead({ groupId: chat.id, timestamp: ts });
      }
    }
  };

  const handleCreateGroup = useCallback((newGroup) => {
    if (!newGroup?.id) return;
    // Đảm bảo group mới luôn có last_updated_at để sort đúng và hiện lên đầu list
    const enriched = {
      ...newGroup,
      last_updated_at: newGroup.last_updated_at || Date.now(),
    };
    upsertGroup(enriched);
    // Hydrate members ngay để GroupConversationItem render đúng tên/avatar
    hydrateMembersFromGroups([enriched]);
  }, [upsertGroup, hydrateMembersFromGroups]);

  // ── Load more conversations ──
  const handleLoadMore = () => {
    setDisplayCount((prev) => prev + 10);
  };

  const displayedMessages = conversations.slice(0, displayCount);
  const remainingCount = conversations.length - displayCount;

  return (
    <>
      {/* ================= Conversation list ================= */}
      <div
        className={clsx(
          "fixed inset-0 flex flex-col transition-transform duration-500 bg-base-100 overflow-hidden",
          {
            "-translate-x-full": isHomeOpen && isOpenConvesation,
            "translate-x-0": isHomeOpen && !isOpenConvesation,
            "translate-x-full": !isHomeOpen,
          },
        )}
      >
        <HeaderConversation
          setIsHomeOpen={setIsHomeOpen}
          setSelectedChat={setSelectedChat}
          isConnected={isConnected}
          relayStatus={relayStatus}
          sendReconnect={sendReconnect}
        />
        <ConversationList
          onSelect={handleSelectChat}
          loading={conversationsLoading}
          conversations={displayedMessages}
          handleLoadMore={handleLoadMore}
          remainingCount={remainingCount}
          initDisplayCount={INITIAL_DISPLAY_COUNT}
        />
        <ButtonCreateGroup
          onClick={() => setShowCreateGroup(true)}
          hasUserGroup={hasGroup}
        />
      </div>

      {/* ================= Create Group Modal ================= */}
      <CreateGroupModal
        open={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
        onCreated={handleCreateGroup}
      />

      {/* ================= ConversationWithUser ================= */}
      <ConversationWithUser
        selectedChat={selectedChat?.type !== "group" ? selectedChat : null}
        isOpenConvesation={isOpenConvesation}
        setOpenConversation={setOpenConversation}
        messages={messagesByConversation}
        setSelectedChat={setSelectedChat}
      />

      {/* ================= ConversationWithGroup ================= */}
      <ConversationWithGroup
        selectedChat={selectedChat?.type === "group" ? selectedChat : null}
        isOpenConvesation={selectedChat?.type === "group" ? isOpenConvesation : false}
        setOpenConversation={setOpenConversation}
        messages={messagesByConversation}
        setSelectedChat={setSelectedChat}
      />
    </>
  );
};

export default RightHomeScreen;
