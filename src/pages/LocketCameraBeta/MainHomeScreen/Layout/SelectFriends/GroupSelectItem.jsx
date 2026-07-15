import clsx from "clsx";
import { useGroupMembers } from "@/hooks";
import { GroupAvatarStack } from "@/components/uikit/ConversationItem/GroupAvatarStack";
import { GroupMembersLabel } from "@/components/uikit/ConversationItem/GroupMembersLabel";

const GroupSelectItem = ({ group, isSelected, onToggle }) => {
  const members = useGroupMembers(group.id);
  const visibleMembers = members.slice(0, 5);

  return (
    <div
      onClick={() => onToggle(group.id)}
      className={clsx(
        "flex flex-col items-center cursor-pointer transition-opacity hover:opacity-80 active:opacity-60 snap-center shrink-0",
        isSelected ? "opacity-100" : "opacity-60",
      )}
    >
      <div
        className={clsx(
          "flex p-0.5 flex-col items-center justify-center cursor-pointer rounded-full border-[2.5px] transition-all duration-300 transform",
          isSelected
            ? "border-amber-400 scale-100"
            : "border-gray-700 scale-95",
        )}
      >
        {group.image_url ? (
          <img
            src={group.image_url}
            alt={group.name}
            className="w-11 h-11 rounded-full object-cover"
          />
        ) : (
          <div className="w-11 h-11 rounded-full bg-base-300 flex items-center justify-center overflow-hidden">
            {visibleMembers.length > 0 ? (
              <GroupAvatarStack members={visibleMembers} />
            ) : (
              <span className="text-base-content/50 text-xs font-bold">
                {(group.name || "G").charAt(0).toUpperCase()}
              </span>
            )}
          </div>
        )}
      </div>
      <span className="text-xs mt-1 text-center max-w-[4rem] font-semibold truncate text-base-content transition-opacity duration-300">
        {group.name ? (
          group.name
        ) : (
          <GroupMembersLabel members={visibleMembers} />
        )}
      </span>
    </div>
  );
};

export default GroupSelectItem;
