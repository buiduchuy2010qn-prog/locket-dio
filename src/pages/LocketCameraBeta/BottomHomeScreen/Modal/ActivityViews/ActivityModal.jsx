import { useMemo, useState } from "react";
import { X, Info, Ban } from "lucide-react";
import LoadingActivityItem from "./LoadingActivityItem";
import { formatTimeAgo } from "@/utils";
import ActivityButton from "./ActivityButton";
import PrivateButton from "./PrivateButton";
import { splitActivity } from "@/utils/momentActivity";

const FALLBACK = "/images/default_profile.png";

function ActivityRow({ item, activeTooltip, setActiveTooltip }) {
  const uid = item?.user?.uid || item?.user?.localId;
  const isBlocked = item.status === "blocked";

  const statusLabel = (() => {
    if (isBlocked) {
      return <>🚫 bị chặn · không xem được bài này</>;
    }
    if (item.reaction) {
      return (
        <>
          đã xem · {item.reaction.emoji}{" "}
          {item.reaction.createdAt
            ? formatTimeAgo(item.reaction.createdAt)
            : ""}
        </>
      );
    }
    return (
      <>✨ đã xem {item.viewedAt ? formatTimeAgo(item.viewedAt) : ""}</>
    );
  })();

  const border = isBlocked
    ? "border-error/60"
    : item.reaction
      ? "border-pink-400"
      : "border-amber-400";

  return (
    <li
      className={`flex items-center gap-3 relative py-1 ${
        isBlocked ? "opacity-80" : ""
      }`}
    >
      <img
        src={item?.user?.profilePic || FALLBACK}
        alt={item?.user?.firstName || "user"}
        className={`w-12 h-12 rounded-full border-[2.5px] p-0.5 ${border} object-cover bg-base-300 ${
          isBlocked ? "grayscale" : ""
        }`}
        onError={(e) => {
          e.currentTarget.src = FALLBACK;
        }}
      />
      <div className="flex flex-col flex-1 min-w-0">
        <span className="text-base text-base-content font-semibold truncate">
          {item.user?.firstName || "Bạn bè"} {item.user?.lastName || ""}
        </span>
        <span
          className={`text-sm ${
            isBlocked ? "text-error/90" : "text-base-content/80"
          }`}
        >
          {statusLabel}
        </span>
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() =>
            setActiveTooltip(activeTooltip === uid ? null : uid)
          }
          className="p-2 rounded-full hover:bg-base-200 transition-colors"
        >
          {isBlocked ? (
            <Ban className="w-5 h-5 text-error/70" />
          ) : (
            <Info className="w-5 h-5 text-base-content/60" />
          )}
        </button>

        {activeTooltip === uid && (
          <div className="absolute right-6 top-full mt-2 w-64 bg-base-200 rounded-lg shadow-xl p-3 z-50 border border-base-300">
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 pb-2 border-b border-base-300">
                <img
                  src={item?.user?.profilePic || FALLBACK}
                  alt=""
                  className="w-10 h-10 rounded-full object-cover"
                />
                <div>
                  <p className="font-semibold">
                    {item.user?.firstName} {item.user?.lastName}
                  </p>
                  <p className="text-xs text-base-content/60">
                    @{item.user?.username || "N/A"}
                  </p>
                </div>
              </div>
              <p className="text-xs text-base-content/70">
                <span className="font-medium">User ID:</span> {uid}
              </p>
              {isBlocked ? (
                <p className="text-xs text-error">
                  Không nhận được / không xem được bài đăng này (chặn, ẩn, hoặc
                  không nằm trong danh sách gửi).
                </p>
              ) : (
                <>
                  {item.viewedAt && (
                    <p className="text-xs text-base-content/70">
                      <span className="font-medium">Xem:</span>{" "}
                      {new Date(item.viewedAt).toLocaleString("vi-VN")}
                    </p>
                  )}
                  {item.reaction && (
                    <p className="text-xs text-base-content/70">
                      <span className="font-medium">Cảm xúc:</span>{" "}
                      {item.reaction.emoji}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </li>
  );
}

function Section({ title, count, children, tone = "default" }) {
  if (!count) return null;
  return (
    <div className="mb-4">
      <h3
        className={`text-sm font-bold mb-2 sticky top-0 bg-base-100 py-1 ${
          tone === "danger" ? "text-error" : "text-base-content/80"
        }`}
      >
        {title}{" "}
        <span
          className={`font-semibold ${
            tone === "danger" ? "text-error" : "text-primary"
          }`}
        >
          ({count})
        </span>
      </h3>
      <ul className="space-y-1">{children}</ul>
    </div>
  );
}

export const ActivityModal = ({
  show,
  onClose,
  activity = [],
  isLoading,
  activeTooltip,
  setActiveTooltip,
}) => {
  const parts = useMemo(() => splitActivity(activity), [activity]);

  return (
    <div
      className={`fixed inset-0 z-60 flex items-end bg-black/50 duration-300 transition-all ${
        show ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      <div
        className={`relative w-full h-[70vh] bg-base-100 rounded-t-3xl shadow-lg p-4 transform transition-transform duration-300 ${
          show ? "translate-y-0" : "translate-y-full"
        } flex flex-col`}
      >
        <div className="sticky top-0 z-10 border-b border-base-300 pb-3 bg-base-100">
          <div className="relative flex items-center">
            <h2 className="text-lg font-bold text-center flex-1 text-base-content">
              Người đã xem
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="absolute right-0 p-2 rounded-full text-base-content"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {!isLoading && (
            <div className="mt-2 text-sm text-base-content space-y-0.5">
              <p>
                👁️ Đã xem:{" "}
                <span className="font-semibold">{parts.viewedAll.length}</span>
                {parts.reacted.length > 0 && (
                  <>
                    {" · "}
                    💖 Cảm xúc:{" "}
                    <span className="font-semibold">
                      {parts.reacted.length}
                    </span>
                  </>
                )}
              </p>
              {parts.blocked.length > 0 && (
                <p className="text-error/90">
                  🚫 Không xem được (bị chặn):{" "}
                  <span className="font-semibold">{parts.blocked.length}</span>
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto pt-2">
          {isLoading ? (
            <ul className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <LoadingActivityItem key={i} />
              ))}
            </ul>
          ) : parts.viewedAll.length === 0 && parts.blocked.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-base-content/60 italic">
              Chưa có ai xem
            </div>
          ) : (
            <>
              <Section title="👁️ Đã xem" count={parts.viewedAll.length}>
                {parts.viewedAll.map((item, idx) => (
                  <ActivityRow
                    key={item?.user?.uid || `v-${idx}`}
                    item={item}
                    activeTooltip={activeTooltip}
                    setActiveTooltip={setActiveTooltip}
                  />
                ))}
              </Section>

              {/* Luôn ở cuối */}
              <Section
                title="🚫 Bị chặn · không xem được"
                count={parts.blocked.length}
                tone="danger"
              >
                {parts.blocked.map((item, idx) => (
                  <ActivityRow
                    key={item?.user?.uid || `b-${idx}`}
                    item={item}
                    activeTooltip={activeTooltip}
                    setActiveTooltip={setActiveTooltip}
                  />
                ))}
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default function ActivitySection({ isPublic, activity, isLoading }) {
  const [showModal, setShowModal] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState(null);

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
        activeTooltip={activeTooltip}
        setActiveTooltip={setActiveTooltip}
      />
    </div>
  );
}
