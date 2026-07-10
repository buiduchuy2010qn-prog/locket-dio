import { useEffect, useState } from "react";
import { checkIfRunningAsPWA } from "@/utils/logic/checkIfRunningAsPWA";

export const useNavigation = () => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isHomeOpen, setIsHomeOpen] = useState(false);
  const [isBottomOpen, setIsBottomOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isFriendsTabOpen, setFriendsTabOpen] = useState(false);
  const [isSettingTabOpen, setSettingTabOpen] = useState(false);
  const [isOptionModalOpen, setOptionModalOpen] = useState(false);
  const [isFriendHistoryOpen, setFriendHistoryOpen] = useState(false);

  const [isPWA, setIsPWA] = useState(() => {
    const saved = localStorage.getItem("isPWA");
    return saved === "true";
  });

  // Lưu vào localStorage khi isPWA thay đổi
  useEffect(() => {
    localStorage.setItem("isPWA", isPWA);
  }, [isPWA]);

  // Tự động phát hiện nếu đang chạy dưới dạng PWA
  useEffect(() => {
    const isPWA = checkIfRunningAsPWA();
    if (isPWA) {
      setIsPWA(true);
    }
  }, []);

  return {
    isProfileOpen,
    setIsProfileOpen,
    isHomeOpen,
    setIsHomeOpen,
    isSidebarOpen,
    setIsSidebarOpen,
    isFilterOpen,
    setIsFilterOpen,
    isBottomOpen,
    setIsBottomOpen,
    isFriendsTabOpen,
    setFriendsTabOpen,
    isOptionModalOpen, setOptionModalOpen,
    isSettingTabOpen,
    setSettingTabOpen,
    isPWA, setIsPWA,
    isFriendHistoryOpen, setFriendHistoryOpen
  };
};
