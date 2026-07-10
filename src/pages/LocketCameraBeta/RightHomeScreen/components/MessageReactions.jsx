import clsx from "clsx";
import { useMemo } from "react";

function MessageReactions({ reactions = [], isMe, getName, onClick }) {
  const groupedReactions = useMemo(() => {
    const grouped = {};

    reactions.forEach((r) => {
      if (!r?.emoji) return;

      if (!grouped[r.emoji]) {
        grouped[r.emoji] = {
          count: 0,
          users: [],
        };
      }

      grouped[r.emoji].count++;
      grouped[r.emoji].users.push(r.user_id);
    });

    return Object.entries(grouped);
  }, [reactions]);

  if (!groupedReactions.length) return null;

  return (
    <div
      className={clsx("absolute -top-7 flex cursor-pointer z-10", {
        "-left-2": isMe,
        "-right-2": !isMe,
      })}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      {groupedReactions.length === 1 ? (
        <div className="p-1 bg-base-100 rounded-full">
          <div className="p-1 w-8 h-8 text-base bg-base-300 rounded-full shadow flex items-center justify-center">
            {groupedReactions[0][0]}
          </div>
        </div>
      ) : (
        <div className="flex items-center">
          {groupedReactions.slice(0, 2).map(([emoji, data], index) => (
            <div
              key={emoji}
              title={data.users
                .map((u) => getName?.(u))
                .filter(Boolean)
                .join(", ")}
              className={clsx("p-1 bg-base-100 rounded-full", {
                "-ml-3": index > 0,
              })}
            >
              <div className="p-1 w-8 h-8 text-base bg-base-300 rounded-full shadow flex items-center justify-center">
                {emoji}
              </div>
            </div>
          ))}

          {groupedReactions.length > 2 && (
            <div className="-ml-3 p-2 bg-base-300 rounded-full shadow border border-base-100">
              <div className="p-1 flex items-center justify-center text-[10px] font-semibold">
                +{groupedReactions.length - 2}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default MessageReactions;
