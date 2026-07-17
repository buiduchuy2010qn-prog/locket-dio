import { useState } from "react";
import { ChevronDown, Download, Menu } from "lucide-react";
import HistorySelectFriend from "@/features/HistorySelectFriend";
import { useAuthStore, useFriendList } from "@/stores";
import { downloadBlob } from "@/services";
import { useTranslation } from "react-i18next";
import { useAutoDriveBackup } from "@/hooks/useAutoDriveBackup";
import AppUpdateButton from "@/components/AppUpdateButton";
import { SonnerInfo, SonnerWarning } from "@/components/uikit/SonnerToast";

/**
 * Camera header — 3-column grid:
 * left menu/rollcall · center friends pill · right avatar
 */
const HeaderHome = ({
  setIsHomeOpen,
  setIsProfileOpen,
  setFriendsTabOpen,
  setIsSidebarOpen,
  isBottomOpen,
  setFriendHistoryOpen,
  isFriendHistoryOpen,
  selectedFile,
}) => {
  const { t } = useTranslation("main");
  const { user } = useAuthStore();
  const friendList = useFriendList();

  useAutoDriveBackup(selectedFile);

  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [friendName, setFriendName] = useState("Mọi người");

  const toggleDropdown = () => {
    if (isBottomOpen) {
      if (!isVisible) {
        setIsVisible(true);
        setTimeout(() => setFriendHistoryOpen(true), 10);
      } else {
        setFriendHistoryOpen(false);
        setTimeout(() => setIsVisible(false), 500);
      }
      return;
    }
    setFriendsTabOpen(true);
  };

  const handleDownload = async () => {
    if (!selectedFile) return;
    try {
      SonnerInfo(t("home.preparing_download", { defaultValue: "Đang tải…" }));
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      let file = selectedFile;
      let fileName = `huylocket-${timestamp}.jpg`;

      if (String(selectedFile.type || "").startsWith("image/")) {
        const {
          applyLocketStyleWatermark,
          ensureJpegFileName,
          isSaveWatermarkEnabled,
        } = await import("@/utils/imageUtils/applyWatermark");
        if (isSaveWatermarkEnabled()) {
          file = await applyLocketStyleWatermark(selectedFile, {
            forceImage: true,
          });
        }
        fileName = ensureJpegFileName(`huylocket-${timestamp}.jpg`);
      } else {
        const extension = selectedFile.type?.split("/")[1] || "mp4";
        fileName = `huylocket-${timestamp}.${extension}`;
      }
      downloadBlob(file, fileName);
    } catch (err) {
      console.error("❌ Download error:", err);
      SonnerWarning(
        t("home.download_error", { defaultValue: "Không tải được ảnh" }),
      );
    }
  };

  if (selectedFile) {
    return (
      <header className="cameraHeader">
        <div className="cameraHeaderSide" />
        <div className="cameraHeaderCenter">
          <span className="text-lg font-semibold text-base-content">
            {t("home.send_to")}
          </span>
        </div>
        <div className="cameraHeaderSide">
          <button
            type="button"
            onClick={handleDownload}
            className="cameraHeaderBtn"
            aria-label={t("home.download", { defaultValue: "Tải xuống" })}
          >
            <Download size={22} strokeWidth={2} />
          </button>
        </div>
      </header>
    );
  }

  return (
    <header className="cameraHeader">
      {/* Left: menu / settings (rollcall lives in profile) */}
      <div className="cameraHeaderSide">
        <button
          type="button"
          onClick={() => setIsSidebarOpen(true)}
          className="cameraHeaderBtn"
          aria-label={t("home.menu", { defaultValue: "Menu" })}
        >
          <Menu size={22} strokeWidth={2} />
        </button>
      </div>

      {/* Center: friends pill — true center via equal side columns */}
      <div className="cameraHeaderCenter">
        <button
          type="button"
          className="cameraHeaderFriends"
          onClick={toggleDropdown}
        >
          {isBottomOpen ? (
            <>
              <span>
                {friendName === "Mọi người" ? t("home.everyone") : friendName}
              </span>
              <ChevronDown
                className={`w-5 h-5 shrink-0 transition-transform ${
                  isFriendHistoryOpen ? "rotate-180" : ""
                }`}
                strokeWidth={3}
              />
            </>
          ) : (
            <>
              <svg
                className="w-5 h-5 shrink-0"
                aria-hidden
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  fillRule="evenodd"
                  d="M12 6a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm-1.5 8a4 4 0 0 0-4 4 2 2 0 0 0 2 2h7a2 2 0 0 0 2-2 4 4 0 0 0-4-4h-3Zm6.82-3.096a5.51 5.51 0 0 0-2.797-6.293 3.5 3.5 0 1 1 2.796 6.292ZM19.5 18h.5a2 2 0 0 0 2-2 4 4 0 0 0-4-4h-1.1a5.503 5.503 0 0 1-.471.762A5.998 5.998 0 0 1 19.5 18ZM4 7.5a3.5 3.5 0 0 1 5.477-2.889 5.5 5.5 0 0 0-2.796 6.293A3.501 3.501 0 0 1 4 7.5ZM7.1 12H6a4 4 0 0 0-4 4 2 2 0 0 0 2 2h.5a5.998 5.998 0 0 1 3.071-5.238A5.505 5.505 0 0 1 7.1 12Z"
                  clipRule="evenodd"
                />
              </svg>
              <span>
                {t("home.friends_count", {
                  count: friendList.length || 0,
                })}
              </span>
            </>
          )}
        </button>
      </div>

      {/* Right: avatar → profile (+ update badge) */}
      <div className="cameraHeaderSide relative">
        <button
          type="button"
          onClick={() => setIsProfileOpen(true)}
          className="cameraHeaderBtn"
          aria-label={t("home.profile", { defaultValue: "Tài khoản" })}
        >
          {!isImageLoaded && (
            <div className="absolute w-4 h-4 border-2 border-t-transparent border-current rounded-full animate-spin opacity-50" />
          )}
          <img
            src={user?.profilePicture || "/images/default_profile.png"}
            alt=""
            onLoad={() => setIsImageLoaded(true)}
            onError={(e) => {
              e.currentTarget.src = "/images/default_profile.png";
            }}
            className={`cameraHeaderAvatar transition-opacity duration-300 ${
              isImageLoaded ? "opacity-100" : "opacity-0"
            }`}
          />
        </button>
        <div className="absolute -bottom-1 -right-1 scale-75 origin-bottom-right">
          <AppUpdateButton />
        </div>
      </div>

      <HistorySelectFriend
        isVisible={isVisible}
        setIsVisible={setIsVisible}
        setFriendName={setFriendName}
        onClick={toggleDropdown}
      />
    </header>
  );
};

export default HeaderHome;
