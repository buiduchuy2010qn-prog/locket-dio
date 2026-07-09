import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { FaUserFriends, FaLock } from "react-icons/fa";
import { useApp } from "@/context/AppContext";
import clsx from "clsx";
import { getToken } from "@/utils";
import FriendSelectItems from "./FriendSelectItems";
import { useFriendStore } from "@/stores/useFriendStore";
import { SonnerInfo, SonnerWarning } from "@/components/ui/SonnerToast";

const friendUid = (f) =>
  (f?.uid || f?.localId || f?.user || f?.id || "").toString().trim() || null;

const SelectFriendsList = ({}) => {
  const { friendDetails } = useFriendStore();
  const { post } = useApp();
  const { audience, setAudience, setSelectedRecipients } = post;

  const selectableFriends = useMemo(
    () =>
      (Array.isArray(friendDetails) ? friendDetails : []).filter(
        (f) => friendUid(f) && !f?.isCelebrity
      ),
    [friendDetails]
  );

  const allSelectableIds = useMemo(
    () => selectableFriends.map((f) => friendUid(f)).filter(Boolean),
    [selectableFriends]
  );

  const [selectedFriends, setSelectedFriends] = useState([]);

  /** Cập nhật audience + recipients đồng bộ (tránh race khi bấm đăng ngay). */
  const applyAudience = useCallback(
    (nextAudience, nextIds) => {
      const ids = Array.isArray(nextIds)
        ? [...new Set(nextIds.filter((id) => typeof id === "string" && id))]
        : [];
      setAudience(nextAudience);
      setSelectedFriends(ids);
      setSelectedRecipients(ids);
    },
    [setAudience, setSelectedRecipients]
  );

  // Audience "all" → đánh dấu hết bạn (UI); recipients gửi API vẫn [] + sent_to_all
  useEffect(() => {
    if (audience === "all" && allSelectableIds.length > 0) {
      setSelectedFriends(allSelectableIds);
      // Không ghi recipients đầy đủ khi all — payload dùng sent_to_all
      setSelectedRecipients([]);
    }
  }, [audience, allSelectableIds, setSelectedRecipients]);

  const handleToggle = (uid) => {
    if (!uid) return;
    const id = String(uid);

    // Đang "all" → chuyển selected với danh sách hiện tại (all trừ/thêm uid)
    const base =
      audience === "all"
        ? allSelectableIds
        : audience === "private"
          ? []
          : selectedFriends;

    let next = base.includes(id)
      ? base.filter((x) => x !== id)
      : [...base, id];

    // Bỏ hết → coi như private (an toàn hơn post all nhầm)
    if (next.length === 0) {
      const { localId } = getToken() || {};
      SonnerWarning(
        "Chưa chọn ai",
        "Đã chuyển sang Riêng tư. Chọn bạn bè để chia sẻ có chọn lọc."
      );
      applyAudience("private", localId ? [localId] : []);
      return;
    }

    // Chọn lại đủ tất cả → all
    if (
      next.length === allSelectableIds.length &&
      allSelectableIds.every((x) => next.includes(x))
    ) {
      applyAudience("all", []);
      setSelectedFriends(allSelectableIds);
      return;
    }

    applyAudience("selected", next);
  };

  const handleSelectAll = () => {
    if (audience === "all" || selectedFriends.length === allSelectableIds.length) {
      // Bỏ "Tất cả" → private (không để selected rỗng)
      const { localId } = getToken() || {};
      SonnerInfo("Chế độ riêng tư", "Bỏ chọn tất cả → chỉ mình xem.");
      applyAudience("private", localId ? [localId] : []);
    } else {
      applyAudience("all", []);
      setSelectedFriends(allSelectableIds);
    }
  };

  const handleSelectPrivate = () => {
    SonnerInfo("Lưu ý chế độ đăng bài", "Bạn đang chọn chế độ riêng tư!");
    const { localId } = getToken() || {};
    applyAudience("private", localId ? [localId] : []);
  };

  const isPrivateMode = () => {
    const { localId } = getToken() || {};
    return (
      audience === "private" ||
      (selectedFriends.length === 1 &&
        localId &&
        selectedFriends.includes(localId))
    );
  };

  const isSelectAll = () => {
    return (
      audience === "all" ||
      (allSelectableIds.length > 0 &&
        selectedFriends.length === allSelectableIds.length)
    );
  };

  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      const vw = window.innerWidth;
      const secondChild = scrollRef.current.children[1];
      if (secondChild) {
        const secondChildRect = secondChild.getBoundingClientRect();
        const offsetLeft = secondChild.offsetLeft;
        const offsetCenter = offsetLeft - vw / 2 + secondChildRect.width / 2;
        scrollRef.current.scrollLeft = offsetCenter;
      }
    }
  }, [friendDetails]);

  return (
    <div className={`w-full `}>
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory px-[47vw]"
      >
        {/* Mục "Riêng tư" */}
        <div
          className={clsx(
            "flex flex-col items-center justify-center snap-center shrink-0 transition-all duration-300",
            isPrivateMode() ? "opacity-100" : "opacity-60"
          )}
        >
          <div
            onClick={handleSelectPrivate}
            className={clsx(
              "flex p-0.5 flex-col items-center justify-center cursor-pointer rounded-full border-[2.5px] transition-all duration-300 transform",
              isPrivateMode()
                ? "border-amber-400 scale-100"
                : "border-gray-700 scale-95"
            )}
          >
            <div className="w-11 h-11 rounded-full bg-base-300 flex items-center justify-center text-xl font-bold text-primary">
              <FaLock className="w-5 h-5 text-base-content" />
            </div>
          </div>
          <span className="text-xs mt-1 text-base-content font-semibold">
            Riêng tư
          </span>
        </div>

        {/* Mục "Tất cả" */}
        <div
          className={clsx(
            "flex flex-col items-center justify-center snap-center shrink-0 transition-all duration-300",
            isSelectAll() ? "opacity-100" : "opacity-60"
          )}
        >
          <div
            onClick={handleSelectAll}
            className={clsx(
              "flex p-0.5 flex-col items-center justify-center cursor-pointer rounded-full border-[2.5px] transition-all duration-300 transform",
              isSelectAll()
                ? "border-amber-400 scale-100"
                : "border-gray-700 scale-95"
            )}
          >
            <div className="w-11 h-11 rounded-full bg-base-300 flex items-center justify-center text-xl font-bold text-primary">
              <FaUserFriends className="w-6 h-6 text-base-content" />
            </div>
          </div>
          <span className="text-xs mt-1 text-base-content font-semibold">
            Tất cả
          </span>
        </div>

        {/* Danh sách bạn bè */}
        {selectableFriends.map((friend) => {
          const uid = friendUid(friend);
          return (
            <FriendSelectItems
              key={uid}
              friend={friend}
              isSelected={
                audience === "all" ||
                (audience !== "private" && selectedFriends.includes(uid))
              }
              onToggle={handleToggle}
            />
          );
        })}
      </div>
    </div>
  );
};

export default SelectFriendsList;
