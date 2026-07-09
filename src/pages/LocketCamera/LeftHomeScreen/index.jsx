import React, { lazy, useContext, useEffect, useState } from "react";
import { AuthContext } from "@/context/AuthLocket";
import { ChevronRight, Copy, Link } from "lucide-react";
import { useApp } from "@/context/AppContext";
import BadgePlan from "../ExtendPage/Badge";
import BottomStreak from "./BottomStreak";
const StreaksCalender = lazy(() => import("./Views/StreaksCalender"));
import LoadingRing from "@/components/ui/Loading/ring";
import { getMyLocalId } from "@/utils/auth/getMyLocalId";
import { loadAllMyPosts } from "@/utils/moment/loadMyPosts";
import { SonnerSuccess } from "@/components/ui/SonnerToast";

const LeftHomeScreen = () => {
  const { user, authTokens } = useContext(AuthContext);
  const { navigation, useloading, post } = useApp();
  const { isProfileOpen, setIsProfileOpen } = navigation;
  const { imageLoaded, setImageLoaded } = useloading;
  const { recentPosts, setRecentPosts } = post;
  const [loadingPosts, setLoadingPosts] = useState(false);

  const myId = getMyLocalId(user, authTokens);
  const email =
    user?.email ||
    localStorage.getItem("email") ||
    sessionStorage.getItem("email") ||
    "";

  useEffect(() => {
    document.body.classList.toggle("overflow-hidden", isProfileOpen);
    return () => document.body.classList.remove("overflow-hidden");
  }, [isProfileOpen]);

  useEffect(() => {
    if (!isProfileOpen || !myId) return;
    let cancelled = false;
    const fetchData = async () => {
      setLoadingPosts(true);
      try {
        const mine = await loadAllMyPosts(myId);
        if (!cancelled) setRecentPosts(mine);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoadingPosts(false);
      }
    };
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [isProfileOpen, myId, setRecentPosts]);

  const copyId = async () => {
    if (!myId) return;
    try {
      await navigator.clipboard.writeText(myId);
      SonnerSuccess("Đã copy Locket ID", myId);
    } catch {
      prompt("Locket ID:", myId);
    }
  };

  return (
    <div
      className={`fixed inset-0 flex flex-col transition-transform duration-500 z-50 bg-base-100 ${
        isProfileOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="sticky top-0 z-10 bg-base-100 shadow-lg">
        <div className="flex items-center justify-between px-4 py-2">
          <BadgePlan />
          <button
            onClick={() => setIsProfileOpen(false)}
            className="rounded-lg btn btn-square hover:bg-base-200 transition cursor-pointer"
          >
            <ChevronRight size={40} />
          </button>
        </div>

        <div className="overflow-hidden transition-all duration-300 ease-in-out">
          <div className="flex flex-row justify-between items-center px-4 pb-2 gap-3">
            <div className="flex flex-col items-start space-y-1 min-w-0 flex-1">
              <p className="text-2xl font-semibold whitespace-nowrap truncate max-w-full">
                {user?.displayName || "Name"}
              </p>
              {user?.username && (
                <a
                  href={`https://locket.cam/${user.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link underline font-semibold flex items-center"
                >
                  @{user.username} <Link className="ml-2" size={18} />
                </a>
              )}
              {email && (
                <p className="text-xs text-base-content/60 truncate max-w-full">
                  {email}
                </p>
              )}
              {myId && (
                <button
                  type="button"
                  onClick={copyId}
                  className="flex items-center gap-1 text-[11px] font-mono text-base-content/70 hover:text-primary max-w-full"
                  title="Copy User ID"
                >
                  <span className="opacity-60 shrink-0">ID:</span>
                  <span className="truncate">{myId}</span>
                  <Copy className="w-3 h-3 shrink-0" />
                </button>
              )}
            </div>
            <div className="avatar w-18 h-18 disable-select flex-shrink-0">
              <div className="rounded-full shadow-md border-4 border-amber-400 p-1">
                {!imageLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <LoadingRing size={40} stroke={2} color="blue" />
                  </div>
                )}
                <img
                  src={user?.profilePicture || "/prvlocket.png"}
                  alt="Profile"
                  className={`w-19 h-19 rounded-full transition-opacity duration-300 ${
                    imageLoaded ? "opacity-100" : "opacity-0"
                  }`}
                  onLoad={() => setImageLoaded(true)}
                />
              </div>
            </div>
          </div>
        </div>
        {loadingPosts && (
          <p className="text-center text-xs text-base-content/50 pb-1">
            Đang tải bài đăng…
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 bg-base-200">
        <p className="text-sm mb-2">
          Lưu ý: Chuỗi lấy từ máy chủ Locket. Số bài trên lịch là bài của bạn
          (web + cache).
        </p>
        <StreaksCalender recentPosts={recentPosts} />
        <BottomStreak recentPosts={recentPosts} />
      </div>
    </div>
  );
};

export default LeftHomeScreen;
