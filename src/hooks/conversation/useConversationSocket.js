import { useEffect, useCallback } from "react";
import { useConversationsStore, useUserMessagesStore } from "@/stores";

/**
 * Hook quản lý toàn bộ socket events liên quan đến conversations:
 * - Lắng nghe `new_on_list_message`: cập nhật danh sách hội thoại sidebar
 * - Lắng nghe `new_message_with_user`: thêm tin nhắn mới vào conversation cá nhân
 * - Emit `get_list_message` để lấy danh sách ban đầu
 * - Emit `get_messages_with_user` để lấy tin nhắn theo conversation đang chọn
 *
 * @param {Object} socket      - socket instance từ SocketContext
 * @param {string} idToken     - token xác thực
 * @param {boolean} isHomeOpen - trạng thái mở sidebar home
 * @param {string|null} conversationId - id conversation cá nhân đang xem (null nếu là nhóm hoặc chưa chọn)
 */
export const useConversationSocket = ({
  socket,
  idToken,
  isHomeOpen,
  conversationId,
}) => {
  const upsertConversation = useConversationsStore((s) => s.upsertConversation);
  const addMessages = useUserMessagesStore((s) => s.addMessages);

  // ── Lắng nghe cập nhật danh sách hội thoại ──
  useEffect(() => {
    if (isHomeOpen || !socket) return;

    const handleListMessage = (data) => {
      if (!Array.isArray(data) || !data.length) return;
      data.forEach(upsertConversation);
    };

    socket.on("new_on_list_message", handleListMessage);

    return () => {
      socket.off("new_on_list_message", handleListMessage);
    };
  }, [socket, upsertConversation]);

  // ── Emit lấy danh sách hội thoại ban đầu ──
  useEffect(() => {
    if (isHomeOpen || !idToken || !socket) return;

    socket.emit("get_list_message", { timestamp: null, token: idToken });
  }, [socket, idToken, isHomeOpen]);

  // ── Lắng nghe tin nhắn mới đến từ conversation cá nhân ──
  useEffect(() => {
    if (!socket) return;

    const handleNewMessageWithUser = (data) => {
      if (!data) return;
      const items = Array.isArray(data) ? data : [data];
      items.forEach((msg) => {
        const convId = msg.uid;
        if (!convId) return;
        addMessages(convId, msg);
      });
    };

    socket.on("new_message_with_user", handleNewMessageWithUser);

    // Emit để lấy tin nhắn mới nhất khi mở conversation cá nhân
    if (conversationId) {
      socket.emit("get_messages_with_user", {
        messageId: conversationId,
        timestamp: null,
        token: idToken,
      });
    }

    return () => {
      socket.off("new_message_with_user", handleNewMessageWithUser);
    };
  }, [socket, conversationId, addMessages, idToken]);
};
