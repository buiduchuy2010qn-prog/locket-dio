import React, {
  createContext,
  useEffect,
  useState,
  useMemo,
  useRef,
  useContext,
} from "react";
import PropTypes from "prop-types";
import * as utils from "@/utils";
import { GetUserData, updateUserInfo } from "@/services";
import { fetchStreak } from "@/utils/SyncData/streakUtils";
import { useFriendStore } from "@/stores/useFriendStore";
import { showDevWarning } from "@/utils/logging/devConsole";
import {
  clearMemberSession,
  saveMemberSession,
} from "@/utils/memberToken";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(utils.getUser());
  const [authTokens, setAuthTokens] = useState(() => utils.getToken());
  const [loading, setLoading] = useState(false);

  const hasFetchedPlan = useRef(false);

  const [friendDetails, setFriendDetails] = useState([]);

  const [userPlan, setUserPlan] = useState(null);
  const [uploadStats, setUploadStats] = useState(null);
  const [streak, setStreak] = useState(() =>
    JSON.parse(localStorage.getItem("streak") || "null")
  );

  const { loadFriends } = useFriendStore();

  useEffect(() => {
    showDevWarning();
    localStorage.removeItem("failedUploads");
    localStorage.removeItem("friendsList");
    localStorage.removeItem("uploadedMoments");
    localStorage.removeItem("uploadedPayloads");
  }, []);

  useEffect(() => {
    loadFriends(user, authTokens); // ✅ Tự load local + sync server
  }, [user, authTokens]);

  // 🔹 Fetch user plan
  useEffect(() => {
    if (!user || !authTokens?.idToken || !authTokens?.localId) return;

    const init = async () => {
      try {
        // Always refresh plan + member_token (required for storage/upload)
        const userData = await GetUserData();
        if (userData) {
          setUserPlan(userData);
          setUploadStats(userData?.upload_stats);
          if (userData?.session) saveMemberSession(userData.session);
          if (userData?.member_token) saveMemberSession(userData);
        }
        hasFetchedPlan.current = true;
        fetchStreak(setStreak);
      } catch (e) {
        console.error("GetUserData failed:", e);
      }
      await updateUserInfo(user);
    };

    init();
  }, [user, authTokens?.idToken, authTokens?.localId]);

  // 🔹 Reset context
  const resetAuthContext = () => {
    setUser(null);
    setAuthTokens(null);
    setFriendDetails([]);
    setUserPlan(null);
    setUploadStats(null);

    hasFetchedPlan.current = false;

    utils.removeUser();
    utils.removeToken();
    clearMemberSession();
    localStorage.removeItem("friendsList");
    localStorage.removeItem("userPlan");
    localStorage.removeItem("uploadStats");
  };

  const refreshStreak = (newStreak) => {
    setStreak(newStreak);
    localStorage.setItem("streak", JSON.stringify(newStreak));
  };

  const contextValue = useMemo(
    () => ({
      user,
      setUser,
      loading,
      friendDetails,
      setFriendDetails,
      userPlan,
      setUserPlan,
      authTokens,
      setAuthTokens,
      resetAuthContext,
      uploadStats,
      setUploadStats,
      streak,
      setStreak,
      fetchStreak,
      refreshStreak,
    }),
    [user, loading, friendDetails, userPlan, authTokens, uploadStats, streak]
  );

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export function useAuth() {
  return useContext(AuthContext);
}
