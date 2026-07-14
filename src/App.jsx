import React, { Suspense, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
  Navigate,
  useNavigate,
} from "react-router-dom";

import { publicRoutes, authRoutes, locketRoutes } from "./routes";
import { ThemeProvider } from "./context/ThemeContext";
import { AppProvider } from "./context/AppContext";
import getLayout from "./layouts";
import NotFoundPage from "./components/pages/NotFoundPage";
import { Toaster } from "sonner";
import { SocketProvider } from "./context/SocketContext";
import {
  useAuthStore,
  useStreakStore,
  useUploadQueueStore,
  useFriendStoreV3,
  useConversationsStore,
  useGroupChatStore,
} from "./stores";
import { showDevWarning } from "./utils/logging/devConsole";
import LoadingPageMain from "./components/pages/LoadPageMain";
import LayoutWithSidebar from "./layouts/baseLayout";
import { useOverlayDataStore } from "./stores/OverlayStores";
import GlobalThemeEffects from "./components/Effects/GlobalThemeEffects";

function App() {
  return (
    <ThemeProvider>
      <SocketProvider>
        <AppProvider>
          <Router>
            <GlobalThemeEffects />
            <AppContent />
          </Router>
          <Toaster />
        </AppProvider>
      </SocketProvider>
    </ThemeProvider>
  );
}

function AppContent() {
  const navigate = useNavigate();
  const { loading, isAuth, user, hydrateAuth, initAuth } = useAuthStore();
  const syncStreak = useStreakStore((s) => s.syncStreak);
  const fetchCaptionOverlays = useOverlayDataStore((s) => s.fetchCaptionOverlays);
  const hydrateUploadQueue = useUploadQueueStore((s) => s.hydrateUploadQueue);
  const fetchAndSyncFriends = useFriendStoreV3((s) => s.fetchAndSyncFriends);

  const fetchConversations = useConversationsStore((s) => s.fetchConversations);
  const fetchAndSyncGroups = useGroupChatStore((s) => s.fetchAndSyncGroups);
  const location = useLocation();

  const allRoutes = [...publicRoutes, ...authRoutes, ...locketRoutes];
  const privateRoutes = [...authRoutes, ...locketRoutes];

  function setMeta(selector, content) {
    let el = document.querySelector(selector);
    if (el) el.setAttribute("content", content);
  }
  useEffect(() => {
    // Auth local trước — UI vào camera không chờ network
    hydrateAuth();
    initAuth();

    let cancelled = false;
    const idle =
      typeof window !== "undefined" && window.requestIdleCallback
        ? (cb, t) => window.requestIdleCallback(cb, { timeout: t ?? 2000 })
        : (cb) => setTimeout(cb, 600);

    // CSS animation / overlay / health — sau first paint (tránh tranh bandwidth mobile)
    const idleId = idle(() => {
      if (cancelled) return;
      import("./styles/animation.css");
      showDevWarning();
      fetchCaptionOverlays();
    }, 1800);

    // Health check nhẹ: 1 lần ngay + vài retry thưa (không spam 8 request)
    const wakeApi = async () => {
      const delays = [0, 3000, 8000, 15000];
      for (let i = 0; i < delays.length && !cancelled; i++) {
        if (delays[i]) await new Promise((r) => setTimeout(r, delays[i]));
        try {
          const r = await fetch("/dio-api/health", {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          });
          if (r.ok) return;
        } catch {
          /* cold start */
        }
      }
    };
    idle(() => {
      if (!cancelled) wakeApi();
    }, 1200);

    const keepAlive = setInterval(() => {
      if (document.hidden) return;
      fetch("/dio-api/health", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      }).catch(() => {});
    }, 12 * 60 * 1000);

    return () => {
      cancelled = true;
      clearInterval(keepAlive);
      if (typeof window !== "undefined" && window.cancelIdleCallback) {
        try {
          window.cancelIdleCallback(idleId);
        } catch {
          clearTimeout(idleId);
        }
      } else {
        clearTimeout(idleId);
      }
    };
  }, []);

  // Đã đăng nhập → luôn vào camera (không kẹt trang chủ / login)
  useEffect(() => {
    if (loading) return;
    if (!isAuth) return;

    const entryPaths = new Set(["/", "/login", "/home"]);
    if (entryPaths.has(location.pathname)) {
      navigate("/locket", { replace: true });
    }
  }, [isAuth, loading, location.pathname, navigate]);

  useEffect(() => {
    if (!user) return;
    // Sync nặng (friends/chat) sau idle — camera mở trước
    const run = () => {
      fetchAndSyncFriends(false, true);
      syncStreak();
      hydrateUploadQueue();
      fetchConversations();
      fetchAndSyncGroups();
    };
    let id;
    if (typeof window !== "undefined" && window.requestIdleCallback) {
      id = window.requestIdleCallback(run, { timeout: 2500 });
      return () => {
        try {
          window.cancelIdleCallback(id);
        } catch {
          /* ignore */
        }
      };
    }
    id = setTimeout(run, 700);
    return () => clearTimeout(id);
  }, [user]);

  useEffect(() => {
    const r = allRoutes.find((route) => route.path === location.pathname);
    document.title = r?.title || "Huy Locket - Đăng ảnh & Video lên Locket";

    const url = "https://locket-dio.com" + location.pathname;
    (
      document.querySelector("link[rel='canonical']") ||
      document.head.appendChild(
        Object.assign(document.createElement("link"), { rel: "canonical" }),
      )
    ).href = url;

    setMeta("meta[property='og:title']", document.title);
    setMeta("meta[property='og:url']", url);
    setMeta("meta[name='twitter:title']", document.title);
  }, [location.pathname]);

  // if (loading) return <LoadingPageMain isLoading={true} />;

  // OAuth callback luôn mount (kể cả khi đã login — không redirect)
  const alwaysPublicPaths = new Set(["/spotify/callback"]);

  return (
    <>
      <Suspense fallback={<LoadingPageMain isLoading={true} />}>
        <Routes>
          {(isAuth ? privateRoutes : publicRoutes).map(
            ({ path, component: Component }) => {
              const Layout = getLayout(path);
              return (
                <Route
                  key={path}
                  path={path}
                  element={
                    <LayoutWithSidebar Layout={Layout}>
                      <Component />
                    </LayoutWithSidebar>
                  }
                />
              );
            },
          )}

          {/* Route public luôn mở (Spotify OAuth callback…) — cả khi đã login */}
          {isAuth &&
            publicRoutes
              .filter(({ path }) => alwaysPublicPaths.has(path))
              .map(({ path, component: Component }) => {
                const Layout = getLayout(path);
                return (
                  <Route
                    key={`always-pub-${path}`}
                    path={path}
                    element={
                      <LayoutWithSidebar Layout={Layout}>
                        <Component />
                      </LayoutWithSidebar>
                    }
                  />
                );
              })}

          {/* Điều hướng khi chưa đăng nhập cố vào route cần auth */}
          {!loading &&
            !isAuth &&
            privateRoutes.map(({ path }) => (
              <Route
                key={path}
                path={path}
                element={<Navigate to="/login" replace />}
              />
            ))}

          {/* Đã login mà vào public (/) → camera */}
          {!loading &&
            isAuth &&
            publicRoutes
              .filter(
                ({ path }) =>
                  // Chỉ redirect entry public; route trùng auth (settings…) đã có ở privateRoutes
                  // Không redirect OAuth callback
                  !alwaysPublicPaths.has(path) &&
                  (path === "/" ||
                    path === "/login" ||
                    path === "/forgot-password"),
              )
              .map(({ path }) => (
                <Route
                  key={`pub-redir-${path}`}
                  path={path}
                  element={<Navigate to="/locket" replace />}
                />
              ))}

          {/* Catch-all: đã login → camera; chưa login → login */}
          <Route
            path="*"
            element={
              loading ? (
                <LoadingPageMain isLoading={true} />
              ) : isAuth ? (
                <Navigate to="/locket" replace />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
        </Routes>
      </Suspense>
      <LoadingPageMain isLoading={loading} />
    </>
  );
}

export default App;
