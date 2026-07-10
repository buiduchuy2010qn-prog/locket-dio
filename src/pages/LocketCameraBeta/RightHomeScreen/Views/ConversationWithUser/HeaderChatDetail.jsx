import { getAvatarOrFallback, imageFallback } from "@/utils";
import { ChevronLeft, Ellipsis } from "lucide-react";

const ChatDetailHeader = ({ selectedChat, onBack }) => {
  const avatar = getAvatarOrFallback(selectedChat?.friend?.profilePic);

  const fullName = selectedChat?.friend
    ? `${selectedChat.friend.firstName} ${selectedChat.friend.lastName}`
    : "Chi tiết cuộc trò";

  return (
    <div className="flex items-center justify-between shadow-lg px-4 py-2">
      <div className="flex items-center">
        <button
          onClick={onBack}
          className="btn p-1 border-0 rounded-full hover:bg-base-200 transition cursor-pointer"
        >
          <ChevronLeft size={30} />
        </button>
      </div>

      <div className="flex-1 flex justify-center items-center gap-3 text-center">
        <img
          src={avatar}
          alt="avatar"
          className="w-9 h-9 rounded-full"
          onError={imageFallback()}
        />

        <h2 className="text-lg font-bold truncate">{fullName}</h2>
      </div>

      <div className="flex items-center gap-2">
        <button className="btn p-1 border-0 rounded-full hover:bg-base-200 transition cursor-pointer">
          <Ellipsis size={30} />
        </button>
      </div>
    </div>
  );
};

export default ChatDetailHeader;
