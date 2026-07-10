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
    import("./styles/animation.css");
    // Đánh thức API Render free (tránh 502 lần đầu)
    fetch("/dio-api/health", { method: "GET", credentials: "include" }).catch(
      () => {},
    );
    // Token local → coi như đã login ngay (không chờ API)
    hydrateAuth();
    initAuth();
    showDevWarning();
    fetchCaptionOverlays();
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
    if (user) {
      // loadFriendsV2();
      fetchAndSyncFriends();
      syncStreak();
      hydrateUploadQueue();
      fetchConversations();
      fetchAndSyncGroups();
    }
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
                  path === "/" ||
                  path === "/login" ||
                  path === "/forgot-password",
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
