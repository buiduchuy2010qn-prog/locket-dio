import { GroupAvatarStack } from "@/components/uikit/ConversationItem/GroupAvatarStack";
import { imageFallback } from "@/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

const HeaderGroupChatDetail = ({ selectedChat, members = [], onBack, setShowInfoModal }) => {
  const { t } = useTranslation("main");
  const avatar = selectedChat?.avatar;
  const visibleMembers = members.slice(0, 5);

  // Tên nhóm; fallback tên thành viên / số người nếu chưa đặt tên
  const memberLabel = members
    .slice(0, 2)
    .map((m) => m?.firstName || m?.username)
    .filter(Boolean)
    .join(", ");
  const fullName =
    (selectedChat?.name && String(selectedChat.name).trim()) ||
    memberLabel ||
    t("right.people_count", { count: members.length || 0 });

  return (
    <div className="flex items-center justify-between px-4 py-2 shadow-lg bg-base-100">
      <button
        type="button"
        onClick={onBack}
        className="btn btn-circle p-1 border-0 rounded-full hover:bg-base-200 transition cursor-pointer shrink-0"
      >
        <ChevronLeft size={24} />
      </button>

      <div className="flex flex-1 flex-col items-center min-w-0 px-2">
        <div className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center bg-base-300 shrink-0">
          {avatar ? (
            <img
              src={avatar}
              alt={fullName}
              className="w-full h-full object-cover"
              onError={imageFallback()}
            />
          ) : (
            <GroupAvatarStack members={visibleMembers} />
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowInfoModal(true)}
          className="-mt-2 flex items-center gap-1 rounded-xl bg-base-300 px-3 py-1 text-sm font-bold max-w-[min(220px,70vw)]"
        >
          <span className="truncate">{fullName}</span>
          <ChevronRight size={14} className="shrink-0" />
        </button>
      </div>

      <div className="w-10 shrink-0" />
    </div>
  );
};

export default HeaderGroupChatDetail;
