import React, {
  useState,
  useRef,
  useMemo,
  useLayoutEffect,
  useEffect,
} from "react";
import { useTranslation } from "react-i18next";
import HeaderGroupChatDetail from "./HeaderGroupChatDetail";
import clsx from "clsx";
import InputGroupChatDetail from "./InputGroupChatDetail";
import { useGroupMembers, useIsGroupMember } from "@/hooks";
import DetailGroupPoup from "../../Modal/DetailGroupPoup";
import GroupMessageItem from "./GroupMessageItem";

// ================= Component: ChatDetail =================
const ConversationWithGroup = ({
  selectedChat,
  isOpenConvesation,
  setOpenConversation,
  messages,
  setSelectedChat,
  isLoading,
}) => {
  const { t } = useTranslation("main");
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

  const [showInfoModal, setShowInfoModal] = useState(false);
  const members = useGroupMembers(selectedChat?.id);

  const isMember = useIsGroupMember(selectedChat?.id);

  if (!showModal) return null;

  return (
    <>
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
        <div className="sticky top-0 z-10">
          <HeaderGroupChatDetail
            selectedChat={selectedChat}
            members={members}
            onBack={() => setOpenConversation(false)}
            setShowInfoModal={setShowInfoModal}
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
              {t("right.no_messages_yet")}
            </div>
          ) : (
            [
              ...new Map(
                sortedMessages
                  .filter((msg) => msg && msg.id) // bỏ null/undefined
                  .map((m) => [m.id, m]), // dùng id làm key trong Map
              ).values(),
            ].map((msg) => (
              <GroupMessageItem
                key={msg.id}
                msg={msg}
                selectedChat={selectedChat}
              />
            ))
          )}
          <div className="h-16" />
        </div>

        {/* Footer */}
        <div className="fixed w-full bottom-4 z-10 py-2 px-4">
          <InputGroupChatDetail
            selectedChat={selectedChat}
            chat_disabled={!isMember}
          />
        </div>
      </div>

      <DetailGroupPoup
        open={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        group={selectedChat.raw}
        members={members}
        onConfirm={() => {
          setShowInfoModal(false);
          onBack();
        }}
      />
    </>
  );
};

export default ConversationWithGroup;
