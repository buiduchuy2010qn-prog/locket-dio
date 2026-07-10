import { clearAllDB } from "@/cache/configDB";
import {
  GetUserDataV2,
  GetUserLocket,
  logout,
  syncPushSubscription,
  updateUserInfo,
} from "@/services";
import {
  removeToken,
  saveMemberToken,
  clearMemberToken,
  saveUserCache,
  getUserCache,
  clearUserCache,
} from "@/utils";
import { create } from "zustand";
import { persist } from "zustand/middleware";

const ONE_DAY = 1000 * 60 * 60 * 24;

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      userPlan: null,
      uploadStats: null,
      isAuth: false,
      loading: true,

      lastSyncAt: 0,
      lastFetchPlanAt: 0,

      // =========================
      // HYDRATE
      // =========================
      hydrateAuth: () => {
        const token =
          localStorage.getItem("idToken") ||
          sessionStorage.getItem("idToken");

        if (!token) {
          set({
            user: null,
            isAuth: false,
            loading: false,
          });
          return;
        }

        // ⚡ Có token → đăng nhập ngay, vào camera không chờ API
        const cachedUser = get()?.user || null;
        set({
          isAuth: true,
          loading: false,
          ...(cachedUser ? { user: cachedUser } : {}),
        });
      },

      // =========================
      // INIT
      // =========================
      initAuth: async () => {
        const token = localStorage.getItem("idToken");
        if (!token) {
          set({
            user: null,
            userPlan: null,
            uploadStats: null,
            isAuth: false,
            loading: false,
          });
          return;
        }

        const now = Date.now();
        const { lastFetchPlanAt, lastSyncAt } = get();

        try {
          // =========================
          // 1. Fetch plan nếu quá TTL (không đá login nếu plan API lỗi)
          // =========================
          if (!lastFetchPlanAt || now - lastFetchPlanAt > 5 * 60 * 1000) {
            try {
              const planRes = await GetUserDataV2();
              if (planRes) {
                saveMemberToken(planRes?.session);
                set({
                  userPlan: planRes,
                  uploadStats: planRes?.upload_stats,
                  lastFetchPlanAt: now,
                });
              }
            } catch (planErr) {
              console.warn(
                "Plan fetch failed (login still kept):",
                planErr?.message || planErr,
              );
            }
          }

          // =========================
          // 2. Fetch user nếu chưa có
          // =========================
          let { user } = get();

          if (!user) {
            try {
              user = await GetUserLocket();
              if (user) set({ user });
            } catch (userErr) {
              console.warn(
                "GetUserLocket failed:",
                userErr?.message || userErr,
              );
            }
          }

          // =========================
          // 3. Background sync (1 ngày)
          // =========================
          if (!lastSyncAt || now - lastSyncAt > ONE_DAY) {
            if (user) updateUserInfo(user).catch(() => {});
            syncPushSubscription().catch(() => {});

            set({ lastSyncAt: now });
          }

          // Token còn → giữ session; plan/user lỗi không được đá ra login
          set({ isAuth: true, loading: false });
        } catch (err) {
          console.error("Auth init error:", err);
          // Chỉ clear session nếu token thực sự hỏng (401 do interceptor)
          const status = err?.status || err?.response?.status;
          if (status === 401) {
            set({
              user: null,
              userPlan: null,
              uploadStats: null,
              isAuth: false,
              loading: false,
            });
          } else {
            set({ isAuth: true, loading: false });
          }
        }
      },

      // =========================
      // FORCE REFRESH
      // =========================
      fetchUserData: async () => {
        try {
          set({ loading: true });

          const planRes = await GetUserDataV2();

          saveMemberToken(planRes?.session);

          set({
            userPlan: planRes,
            uploadStats: planRes?.upload_stats,
            lastFetchPlanAt: Date.now(),
            loading: false,
          });
        } catch (err) {
          console.error("fetchUserData error:", err);
          set({ loading: false });
        }
      },

      // =========================
      // LOGOUT
      // =========================
      clearAndlogout: async () => {
        // 1) Xóa token / storage TRƯỚC — tránh hydrateAuth set lại isAuth
        removeLocalStorage();
        removeToken();
        clearMemberToken();
        clearUserCache();

        // 2) Clear state ngay (sync) để route public mở được
        set({
          user: null,
          userPlan: null,
          uploadStats: null,
          isAuth: false,
          loading: false,
          lastSyncAt: 0,
          lastFetchPlanAt: 0,
        });

        // 3) Clear IndexedDB (không chặn UI)
        try {
          await clearAllDB();
        } catch (e) {
          console.warn("clearAllDB:", e?.message || e);
        }

        // 4) Gọi API logout — lỗi cũng bỏ qua (đã clear local)
        try {
          await logout();
        } catch (e) {
          console.warn("logout API:", e?.message || e);
        }
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        user: state.user,
        userPlan: state.userPlan,
        uploadStats: state.uploadStats,
        lastSyncAt: state.lastSyncAt,
        lastFetchPlanAt: state.lastFetchPlanAt,
      }),
    },
  ),
);

function removeLocalStorage() {
  localStorage.removeItem("friendsUpdatedAt");
  localStorage.removeItem("friendsLastSync");
  localStorage.removeItem("huylocket-welcome-seen");
  localStorage.removeItem("rememberMe");
  localStorage.removeItem("isFullview");
}