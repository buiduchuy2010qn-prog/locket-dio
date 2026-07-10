import React, {
  useState,
  useRef,
  useMemo,
  useLayoutEffect,
  useEffect,
} from "react";
import ChatDetailHeader from "./HeaderChatDetail";
import InputChatDetail from "./InputChatDetail";
import MessageItem from "./MessageItem";
import clsx from "clsx";

// ================= Component: ChatDetail =================
const ConversationWithUser = ({
  selectedChat,
  isOpenConvesation,
  setOpenConversation,
  messages,
  setSelectedChat,
  isLoading,
}) => {
  const messagesContainerRef = useRef(null);

  const [showModal, setShowModal] = useState(false);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    document.body.style.overflow = showModal ? "hidden" : "";
    return () => (document.body.style.overflow = "");
  }, [showModal]);

  useEffect(() => {
    if (isOpenConvesation) {
      setShowModal(true);
      setTimeout(() => setAnimate(true), 10);
    } else {
      setAnimate(false);
      setTimeout(() => setShowModal(false), 300);
    }
  }, [isOpenConvesation]);

  // Sort tin nhắn theo thời gian tăng dần
  const sortedMessages = useMemo(() => {
    return [...messages].sort(
      (a, b) => Number(a.create_time) - Number(b.create_time),
    );
  }, [messages]);

  // Auto scroll xuống cuối khi mở hoặc khi có tin nhắn mới
  useLayoutEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight;
    }
  }, [sortedMessages, selectedChat]);

  if (!showModal) return null;

  return (
    <div
      className={clsx(
        "fixed inset-0 z-60 flex flex-col transition-transform duration-500 bg-base-100 text-base-content ",
        {
          "translate-x-0": animate,
          "translate-x-full": !animate,
        },
      )}
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-base-100">
        <ChatDetailHeader
          selectedChat={selectedChat}
          onBack={() => setOpenConversation(false)}
        />
      </div>

      {/* Danh sách tin nhắn */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto py-4 px-1 space-y-4 h-full"
      >
        {isLoading ? (
          // Loading skeleton
          <div className="flex flex-col space-y-4">
            {[...Array(5)].map((_, idx) => (
              <div
                key={idx}
                className="h-10 w-2/3 bg-base-300 rounded-lg animate-pulse"
              ></div>
            ))}
          </div>
        ) : sortedMessages.length === 0 ? (
          // Không có tin nhắn
          <div className="flex justify-center items-center h-full text-sm text-base-content/60">
            Chưa có tin nhắn nào
          </div>
        ) : (
          [
            ...new Map(
              sortedMessages
                .filter((msg) => msg && msg.id) // bỏ null/undefined
                .map((m) => [m.id, m]), // dùng id làm key trong Map
            ).values(),
          ].map((msg) => (
            <MessageItem key={msg.id} msg={msg} selectedChat={selectedChat} />
          ))
        )}
        <div className="h-16" />
      </div>

      {/* Footer */}
      <div className="fixed w-full bottom-4 z-10 py-2 px-4">
        <InputChatDetail selectedChat={selectedChat} />
      </div>
    </div>
  );
};

export default ConversationWithUser;
