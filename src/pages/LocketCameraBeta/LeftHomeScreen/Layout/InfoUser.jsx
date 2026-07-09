import LoadingRing from "@/components/ui/Loading/ring";
import { Copy, Link } from "lucide-react";
import React, { useEffect, useState } from "react";
import { getMyLocketId } from "@/utils/auth/getMyLocalId";
import { SonnerSuccess } from "@/components/ui/SonnerToast";
import { fetchUserById } from "@/services/LocketDioServices/FetchUserServices";

function InfoUser({ user, authTokens }) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [locketProfile, setLocketProfile] = useState(null);

  // Locket ID thật = Firebase localId (user_uid Locket)
  const locketId = getMyLocketId(user, authTokens);
  const email =
    user?.email ||
    localStorage.getItem("email") ||
    sessionStorage.getItem("email") ||
    "";

  // Lấy thêm profile từ API Locket (username, avatar chuẩn)
  useEffect(() => {
    if (!locketId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchUserById(locketId);
        if (!cancelled && data) setLocketProfile(data);
      } catch (e) {
        console.warn("fetchUserById failed", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [locketId]);

  const displayName =
    user?.displayName ||
    (locketProfile?.first_name
      ? `${locketProfile.first_name} ${locketProfile.last_name || ""}`.trim()
      : null) ||
    `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
    "Name";

  const username =
    user?.username ||
    locketProfile?.username ||
    locketProfile?.user_name ||
    null;

  const avatar =
    user?.profilePicture ||
    locketProfile?.profile_picture_url ||
    locketProfile?.profilePic ||
    "/images/default_profile.png";

  const copyLocketId = async () => {
    if (!locketId) return;
    try {
      await navigator.clipboard.writeText(locketId);
      SonnerSuccess("Đã copy Locket ID", locketId);
    } catch {
      prompt("Locket ID:", locketId);
    }
  };

  return (
    <div className="flex flex-row justify-between items-center px-4 pb-2 gap-3">
      <div className="flex flex-col items-start min-w-0 flex-1">
        <p className="text-xl font-semibold whitespace-nowrap truncate max-w-full">
          {displayName}
        </p>
        {username && (
          <a
            href={`https://locket.cam/${username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="link underline font-semibold flex items-center text-sm"
          >
            @{username} <Link className="ml-2" size={16} />
          </a>
        )}
        {email && (
          <p className="text-xs text-base-content/60 mt-0.5 truncate max-w-full">
            {email}
          </p>
        )}
        {locketId && (
          <button
            type="button"
            onClick={copyLocketId}
            className="mt-1.5 flex items-center gap-1.5 text-[11px] font-mono text-base-content/80 hover:text-primary max-w-full bg-base-200/80 px-2 py-1 rounded-lg border border-base-300"
            title="Locket ID thật (user_uid) — bấm copy"
          >
            <span className="opacity-60 shrink-0 font-sans font-semibold">
              Locket ID:
            </span>
            <span className="truncate select-all">{locketId}</span>
            <Copy className="w-3 h-3 shrink-0 opacity-70" />
          </button>
        )}
      </div>
      <div className="avatar w-16 h-16 disable-select flex-shrink-0">
        <div className="rounded-full shadow-md border-3 border-amber-400 p-0.5">
          {!imageLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <LoadingRing size={40} stroke={2} color="blue" />
            </div>
          )}
          <img
            src={avatar}
            alt="Profile"
            className={`w-16 h-16 rounded-full transition-opacity duration-300 ${
              imageLoaded ? "opacity-100" : "opacity-0"
            }`}
            onLoad={() => setImageLoaded(true)}
            onError={(e) => {
              e.currentTarget.src = "/images/default_profile.png";
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default InfoUser;
