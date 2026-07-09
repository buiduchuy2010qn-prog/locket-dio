import LoadingRing from "@/components/ui/Loading/ring";
import { Copy, Link } from "lucide-react";
import React from "react";
import { getMyLocalId } from "@/utils/auth/getMyLocalId";
import { SonnerSuccess } from "@/components/ui/SonnerToast";

function InfoUser({ user, authTokens }) {
  const [imageLoaded, setImageLoaded] = React.useState(false);
  const localId = getMyLocalId(user, authTokens);
  const email =
    user?.email ||
    localStorage.getItem("email") ||
    sessionStorage.getItem("email") ||
    "";

  const copyId = async () => {
    if (!localId) return;
    try {
      await navigator.clipboard.writeText(localId);
      SonnerSuccess("Đã copy User ID");
    } catch {
      prompt("User ID:", localId);
    }
  };

  return (
    <div className="flex flex-row justify-between items-center px-4 pb-2 gap-3">
      <div className="flex flex-col items-start min-w-0 flex-1">
        <p className="text-xl font-semibold whitespace-nowrap truncate max-w-full">
          {user?.displayName ||
            `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
            "Name"}
        </p>
        {user?.username && (
          <a
            href={`https://locket.cam/${user.username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="link underline font-semibold flex items-center text-sm"
          >
            @{user.username} <Link className="ml-2" size={16} />
          </a>
        )}
        {email && (
          <p className="text-xs text-base-content/60 mt-0.5 truncate max-w-full">
            {email}
          </p>
        )}
        {localId && (
          <button
            type="button"
            onClick={copyId}
            className="mt-1 flex items-center gap-1 text-[11px] font-mono text-base-content/70 hover:text-primary max-w-full"
            title="Bấm để copy User ID"
          >
            <span className="opacity-60 shrink-0">ID:</span>
            <span className="truncate">{localId}</span>
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
            src={user?.profilePicture || "/images/default_profile.png"}
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
