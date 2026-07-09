import { useMemo, useState } from "react";
import { X } from "lucide-react";
import LoadingActivityItem from "./LoadingActivityItem";
import ActivityButton from "./ActivityButton";
import PrivateButton from "./PrivateButton";
import { splitActivity } from "@/utils/momentActivity";

const FALLBACK = "/images/default_profile.png";

/** Lấy list emoji hiển thị bên phải (kiểu Locket) */
function getEmojis(item) {
  if (Array.isArray(item?.emojis) && item.emojis.length) {
    return item.emojis.slice(0, 6);
  }
  if (Array.isArray(item?.reactions) && item.reactions.length) {
    return item.reactions
      .map((r) => r?.emoji || r?.reaction)
      .filter(Boolean)
      .slice(0, 6);
  }
  if (item?.reaction?.emoji) return [item.reaction.emoji];
  return [];
}

function displayName(user) {
  const first = (user?.firstName || "").trim();
  const last = (user?.lastName || "").trim();
  const full = `${first} ${last}`.trim();
  if (full) return full;
  if (user?.username) return user.username;
  return "Bạn bè";
}

/**
 * 1 dòng giống app Locket:
 * [avatar] Tên
 *          Đã xem! ✨                    💛 🔥 😍
 */
function ActivityRow({ item }) {
  const isBlocked = item.status === "blocked";
  const emojis = isBlocked ? [] : getEmojis(item);
  const name = displayName(item?.user);

  return (
    <li
      className={`flex items-center gap-3 px-1 py-2.5 ${
        isBlocked ? "opacity-75" : ""
      }`}
    >
      <img
        src={item?.user?.profilePic || FALLBACK}
        alt={name}
        className={`w-12 h-12 rounded-full object-cover bg-neutral shrink-0 ${
          isBlocked ? "grayscale" : ""
        }`}
        onError={(e) => {
          e.currentTarget.src = FALLBACK;
        }}
      />

      <div className="flex flex-col flex-1 min-w-0 justify-center">
        <span className="text-[16px] font-semibold text-base-content truncate leading-tight">
          {name}
        </span>
        {isBlocked ? (
          <span className="text-[13px] text-error/80 mt-0.5 leading-tight">
            Không xem được
          </span>
        ) : (
          <span className="text-[13px] text-base-content/55 mt-0.5 leading-tight">
            Đã xem!{" "}
            <span className="inline-block" aria-hidden>
              ✨
            </span>
          </span>
        )}
      </div>

      {/* Emoji reaction bên phải — giống Locket */}
      {!isBlocked && emojis.length > 0 && (
        <div className="flex items-center gap-1.5 shrink-0 pl-1">
          {emojis.map((emoji, i) => (
            <span
              key={`${emoji}-${i}`}
              className="text-[22px] leading-none select-none drop-shadow-sm"
            >
              {emoji}
            </span>
          ))}
        </div>
      )}
    </li>
  );
}

export const ActivityModal = ({
  show,
  onClose,
  activity = [],
  isLoading,
}) => {
  const parts = useMemo(() => splitActivity(activity), [activity]);

  return (
    <div
      className={`fixed inset-0 z-60 flex items-end duration-300 transition-all ${
        show
          ? "opacity-100 bg-black/55"
          : "opacity-0 pointer-events-none bg-black/0"
      }`}
      onClick={onClose}
    >
      <div
        className={`relative w-full max-h-[78vh] rounded-t-[28px] shadow-2xl transform transition-transform duration-300 flex flex-col bg-base-200 text-base-content ${
          show ? "translate-y-0" : "translate-y-full"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle + title — style Locket */}
        <div className="pt-3 pb-2 px-4 shrink-0">
          <div className="w-10 h-1 rounded-full bg-base-content/25 mx-auto mb-3" />
          <div className="relative flex items-center justify-center">
            <h2 className="text-[18px] font-bold tracking-tight">
              Hoạt động
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="absolute right-0 p-1.5 rounded-full hover:bg-base-300/80 transition"
              aria-label="Đóng"
            >
              <X className="w-5 h-5 opacity-70" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-8 overscroll-contain">
          {isLoading ? (
            <ul className="space-y-1">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <LoadingActivityItem key={i} />
              ))}
            </ul>
          ) : parts.viewedAll.length === 0 && parts.blocked.length === 0 ? (
            <div className="flex items-center justify-center h-36 text-base-content/50 text-sm">
              Chưa có ai xem
            </div>
          ) : (
            <ul className="divide-y divide-base-content/5">
              {/* Chỉ người đã xem — giống screenshot Locket */}
              {parts.viewedAll.map((item, idx) => (
                <ActivityRow
                  key={item?.user?.uid || `v-${idx}`}
                  item={item}
                />
              ))}

              {/* Bị chặn — cuối danh sách */}
              {parts.blocked.length > 0 && (
                <>
                  <li className="pt-4 pb-1 px-1">
                    <p className="text-[12px] font-semibold uppercase tracking-wide text-base-content/40">
                      Không xem được ({parts.blocked.length})
                    </p>
                  </li>
                  {parts.blocked.map((item, idx) => (
                    <ActivityRow
                      key={item?.user?.uid || `b-${idx}`}
                      item={item}
                    />
                  ))}
                </>
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default function ActivitySection({ isPublic, activity, isLoading }) {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="w-full relative flex flex-col gap-2">
      {isPublic === false && (
        <div className="flex justify-center items-center w-full">
          <PrivateButton />
        </div>
      )}
      <ActivityButton
        activity={activity}
        isLoading={isLoading}
        onClick={() => setShowModal(true)}
      />
      <ActivityModal
        show={showModal}
        onClose={() => setShowModal(false)}
        activity={activity}
        isLoading={isLoading}
      />
    </div>
  );
}
