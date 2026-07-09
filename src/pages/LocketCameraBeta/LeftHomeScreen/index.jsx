import React, { useContext, useEffect, useState } from "react";
import { AuthContext } from "@/context/AuthLocket";
import { useApp } from "@/context/AppContext";
import HeaderOne from "./Layout/HeaderOne";
import InfoUser from "./Layout/InfoUser";
import SegmentedToggle from "./Layout/SegmentedToggle";
import RollcallsPost from "./Views/RollcallsPage";
import StreakLocket from "./Views/StreakLocket";
import { getMyLocalId } from "@/utils/auth/getMyLocalId";
import { loadAllMyPosts } from "@/utils/moment/loadMyPosts";

const LeftHomeScreen = ({ setIsProfileOpen }) => {
  const { user, authTokens } = useContext(AuthContext);
  const { navigation, post } = useApp();
  const { isProfileOpen } = navigation;
  const { recentPosts, setRecentPosts } = post;
  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(false);

  const [active, setActive] = useState("lockets"); // 'rollcall' | 'lockets'
  const myId = getMyLocalId(user, authTokens);

  // Tải TẤT CẢ bài của mình theo ngày khi mở profile
  useEffect(() => {
    if (!isProfileOpen || !myId) return;

    let cancelled = false;
    const fetchData = async () => {
      setLoadingPosts(true);
      try {
        const mine = await loadAllMyPosts(myId);
        if (!cancelled) setRecentPosts(mine);
      } catch (e) {
        console.error("Load my posts failed:", e);
      } finally {
        if (!cancelled) setLoadingPosts(false);
      }
    };
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [isProfileOpen, myId, setRecentPosts]);

  const handleToggle = (tab) => {
    setActive(tab);
  };

  return (
    <div
      className={`fixed inset-0 w-full grid grid-rows-[auto_1fr] z-50 bg-base-100 text-base-content transition-transform duration-500 overflow-hidden ${
        isProfileOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="relative shadow-md">
        <HeaderOne setIsProfileOpen={setIsProfileOpen} />
        <InfoUser user={user} authTokens={authTokens} />
        {loadingPosts && (
          <p className="text-center text-xs text-base-content/50 pb-1">
            Đang tải bài đăng…
          </p>
        )}
      </div>

      <div className="flex bg-base-200 overflow-y-auto">
        {active === "rollcall" && (
          <RollcallsPost
            active={active}
            posts={posts}
            setPosts={setPosts}
            isProfileOpen={isProfileOpen}
          />
        )}
        {active === "lockets" && <StreakLocket recentPosts={recentPosts} />}
      </div>

      <div className="fixed z-60 bottom-4 w-full select-none">
        <SegmentedToggle active={active} setActive={handleToggle} />
      </div>
    </div>
  );
};

export default LeftHomeScreen;
