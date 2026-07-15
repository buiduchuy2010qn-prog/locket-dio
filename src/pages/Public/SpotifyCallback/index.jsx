import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { completeSpotifyUserLogin } from "@/utils/spotifyUserAuth";
import { SonnerError, SonnerSuccess } from "@/components/uikit/SonnerToast";

/**
 * OAuth callback Spotify — /spotify/callback
 */
export default function SpotifyCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [msg, setMsg] = useState("Đang liên kết Spotify...");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await completeSpotifyUserLogin(params);
        if (cancelled) return;
        SonnerSuccess(
          "Đã liên kết Spotify",
          result?.profile?.display_name || "Chọn nhạc live trên caption",
        );
        setMsg("Thành công! Đang quay lại...");
        const to = result?.returnTo || "/locket";
        // Về camera + mở studio nếu user đang chụp
        setTimeout(() => {
          navigate(to.startsWith("/") ? to : "/locket", { replace: true });
        }, 600);
      } catch (e) {
        if (cancelled) return;
        console.error(e);
        SonnerError("Liên kết Spotify thất bại", e?.message || "Thử lại");
        setMsg(e?.message || "Thất bại");
        setTimeout(() => navigate("/locket", { replace: true }), 1500);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-base-200 px-6 text-center gap-3">
      <div className="loading loading-spinner loading-lg text-success" />
      <p className="font-semibold text-base-content">{msg}</p>
      <p className="text-xs text-base-content/50">
        Không đóng tab trong lúc liên kết
      </p>
    </div>
  );
}
