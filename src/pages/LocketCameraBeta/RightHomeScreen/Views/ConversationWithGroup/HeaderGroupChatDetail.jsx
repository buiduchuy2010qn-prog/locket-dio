import { GroupAvatarStack } from "@/components/uikit/ConversationItem/GroupAvatarStack";
import { imageFallback } from "@/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

const HeaderGroupChatDetail = ({ selectedChat, members = [], onBack, setShowInfoModal }) => {
  const { t } = useTranslation("main");
  const avatar = selectedChat?.avatar;
  const visibleMembers = members.slice(0, 5);

  const fullName = selectedChat?.name || t("right.people_count", { count: members.length });

  return (
    <div className="flex items-center justify-between px-4 py-2 shadow-lg">
      <button onClick={onBack} className="btn btn-circle p-1 border-0 rounded-full hover:bg-base-200 transition cursor-pointer">
        <ChevronLeft size={24} />
      </button>

      <div className="flex flex-1 flex-col items-center">
        <div className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center bg-base-300">
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
          onClick={() => setShowInfoModal(true)}
          className="-mt-2 flex items-center gap-1 rounded-xl bg-base-300 px-3 py-1 text-sm font-bold max-w-[220px]"
        >
          <span className="truncate">{fullName}</span>
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="w-10" />
    </div>
  );
};

export default HeaderGroupChatDetail;
