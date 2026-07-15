import React, { useCallback, useEffect, useMemo, useState } from "react";
import PlanBadge from "@/components/ui/PlanBadge/PlanBadge";
import { RefreshCw } from "lucide-react";
import { getMaxUploads, FREE_FOR_ALL } from "@/hooks/useFeature";
import { SonnerInfo } from "@/components/ui/SonnerToast";

export const UserPlanCard = React.memo(
  ({ userPlan, uploadStats: uploadStatsProp, onRefresh, loading }) => {
  const { maxImageSizeMB, maxVideoSizeMB, storage_limit_mb } = getMaxUploads();
  const [timeLeft, setTimeLeft] = useState("");

  const user = userPlan?.user;
  // Free-for-all: luôn hiện Premium
  const plan = FREE_FOR_ALL
    ? {
        ...(userPlan?.plan || {}),
        id: "premium",
        name: "Premium",
        badge: "premium",
      }
    : userPlan?.plan;
  const subscription = FREE_FOR_ALL
    ? {
        ...(userPlan?.subscription || {}),
        is_active: true,
        is_expired: false,
        expires_at: null,
      }
    : userPlan?.subscription;
  const limits = userPlan?.limits;
  // Prefer explicit prop (auth store) then plan payload; normalize field names
  const rawStats = uploadStatsProp || userPlan?.upload_stats || {};
  const uploadStats = {
    image_uploaded:
      Number(
        rawStats.image_uploaded ??
          rawStats.image_uploads ??
          rawStats.images ??
          0,
      ) || 0,
    video_uploaded:
      Number(
        rawStats.video_uploaded ??
          rawStats.video_uploads ??
          rawStats.videos ??
          0,
      ) || 0,
    total_storage_used_mb:
      Number(
        rawStats.total_storage_used_mb ??
          rawStats.storage_used_mb ??
          0,
      ) || 0,
    error_count: Number(rawStats.error_count ?? rawStats.errors ?? 0) || 0,
  };

  const isFree = !FREE_FOR_ALL && plan?.id === "free";
  const isActive = FREE_FOR_ALL || subscription?.is_active;
  const isExpired = !FREE_FOR_ALL && subscription?.is_expired;

  // ===============================
  // COUNTDOWN TIME
  // ===============================
  const calculateTimeLeft = useCallback(() => {
    if (!subscription?.expires_at) {
      setTimeLeft("Vĩnh viễn");
      return;
    }

    const endDate = new Date(subscription.expires_at);
    const now = new Date();
    const diff = endDate - now;

    if (diff <= 0) {
      setTimeLeft("Đã hết hạn");
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) {
      setTimeLeft(`${days} ngày ${hours} giờ`);
    } else {
      setTimeLeft(`${hours} giờ`);
    }
  }, [subscription?.expires_at]);

  useEffect(() => {
    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 60000);
    return () => clearInterval(timer);
  }, [calculateTimeLeft]);

  const formatDate = (dateString) => {
    if (!dateString) return "∞";
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `ngày ${day} thg ${month},${year}`;
  };

  // ===============================
  // ACTION BUTTON CONFIG
  // ===============================
  const actionConfig = useMemo(() => {
    // Free-for-all: Premium vĩnh viễn — không gia hạn / mua
    if (FREE_FOR_ALL) {
      return {
        text: "✓ Premium vĩnh viễn — miễn phí",
        className:
          "bg-gradient-to-r from-purple-500 to-pink-500 cursor-default opacity-95",
        disabled: true,
      };
    }

    if (isFree) {
      return {
        text: "🚀 Nâng cấp ngay",
        className: "bg-purple-600 hover:bg-purple-700",
        disabled: false,
      };
    }

    if (isExpired) {
      return {
        text: "🔄 Gia hạn ngay",
        className: "bg-red-500 hover:bg-red-600",
        disabled: false,
      };
    }

    return {
      text: "⏳ Gia hạn thêm",
      className: "bg-blue-500 hover:bg-blue-600",
      disabled: false,
    };
  }, [isFree, isExpired]);

  // ===============================
  // RENDER
  // ===============================
  return (
    <div className="max-w-2xl p-4 mx-auto bg-gradient-to-br from-white via-purple-50 to-purple-100 border border-purple-200 rounded-3xl shadow-xl overflow-hidden">
      {/* HEADER */}
      <div className="relative flex items-center justify-center">
        <div className="absolute top-1 left-1 flex flex-col items-start gap-1">
          <span className="text-base font-semibold">
            #{user?.customer_code}
          </span>
        </div>

        <div className="flex flex-col items-center justify-center gap-2">
          <div className="relative">
            <img
              src={user.profile_picture || "/images/default_profile.png"}
              alt="Avatar"
              className="w-18 h-18 lg:w-18 lg:h-18 rounded-full object-cover p-[2px] outline-accent outline-3 shadow-lg"
            />
            <img
              src="https://cdn.locket-dio.com/v1/caption/caption-icon/locket_gold_badge.png"
              alt="Gold Badge"
              className="absolute -bottom-0.5 -right-0.5 w-6 h-6 p-0.5 bg-base-100 rounded-full"
            />
          </div>
          <div>
            <h2 className="text-2xl font-bold">{user?.display_name}</h2>
          </div>
        </div>

        <div className="absolute top-1 right-1 flex items-center gap-2">
          <PlanBadge plan={plan} />
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-2 rounded-full bg-gray-200 hover:bg-gray-300 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* BODY */}
      <div className="mt-2 space-y-4">
        {/* DATE INFO */}
        <div className="bg-amber-50 border-3 border-amber-300 rounded-2xl p-4 space-y-2">
          {isFree ? (
            <div className="flex items-center justify-between">
              <span className="font-semibold text-amber-600">
                🌟 Huy Locket Membership
              </span>
              <span className="text-sm font-medium text-amber-500">
                Gói miễn phí
              </span>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-amber-600">
                  💎 Premium vĩnh viễn
                </span>
                <span className="text-sm font-medium text-purple-600">
                  {FREE_FOR_ALL ? "Vĩnh viễn" : timeLeft}
                </span>
              </div>

              <div className="flex flex-col text-sm gap-3 text-gray-700">
                <span>
                  Bắt đầu:
                  <b className="ml-1">{formatDate(subscription?.start_at)}</b>
                </span>

                <span>
                  Hết hạn:
                  <b className="ml-1">
                    {FREE_FOR_ALL || !subscription?.expires_at
                      ? "∞ Vĩnh viễn"
                      : formatDate(subscription?.expires_at)}
                  </b>
                </span>
              </div>
            </>
          )}
        </div>

        {/* UPLOAD STATS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Thống kê upload */}
          <div className="bg-white rounded-2xl p-3 lg:p-4 shadow-sm border border-purple-100">
            <h4 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
              <span className="text-base lg:text-lg">📊</span>
              <span className="text-sm lg:text-base">
                Thống kê tải lên
              </span>{" "}
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center">
                <div className="bg-blue-50 rounded-xl p-2 lg:p-3 mb-2">
                  <span className="text-blue-500 text-xl lg:text-2xl">🖼️</span>
                </div>
                <p className="text-xs text-gray-500 mb-1">Ảnh đã tải</p>
                <p className="font-bold text-blue-600 text-sm lg:text-base">
                  {uploadStats.image_uploaded}
                </p>
              </div>

              <div className="text-center">
                <div className="bg-red-50 rounded-xl p-2 lg:p-3 mb-2">
                  <span className="text-red-500 text-xl lg:text-2xl">🎥</span>
                </div>
                <p className="text-xs text-gray-500 mb-1">Video đã tải</p>
                <p className="font-bold text-red-600 text-sm lg:text-base">
                  {uploadStats.video_uploaded}
                </p>
              </div>

              <div className="text-center">
                <div className="bg-green-50 rounded-xl p-2 lg:p-3 mb-2">
                  <span className="text-green-500 text-xl lg:text-2xl">💾</span>
                </div>
                <p className="text-xs text-gray-500 mb-1">Dung lượng</p>
                <p className="font-bold text-green-600 text-sm lg:text-base">
                  {uploadStats.total_storage_used_mb} MB
                </p>
              </div>

              <div className="text-center">
                <div className="bg-yellow-50 rounded-xl p-2 lg:p-3 mb-2">
                  <span className="text-yellow-500 text-xl lg:text-2xl">
                    ⚠️
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-1">Bị lỗi</p>
                <p className="font-bold text-yellow-600 text-sm lg:text-base">
                  {uploadStats.error_count}
                </p>
              </div>
            </div>
            {/* <span className="text-xs text-gray-500">{uploadStats?.updatedAt}</span> */}
          </div>

          {/* LIMIT INFO */}

          <div className="bg-white rounded-2xl p-3 lg:p-4 shadow-sm border border-purple-100">
            <h4 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
              <span className="text-base lg:text-lg">📁</span>
              <span className="text-sm lg:text-base">Giới hạn tải lên</span>
            </h4>
            <div className="space-y-2 lg:space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base lg:text-lg">🖼️</span>
                  <span className="text-xs lg:text-sm font-medium text-gray-600">
                    Ảnh tối đa
                  </span>
                </div>
                <span className="text-xs lg:text-sm font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded-lg">
                  {maxImageSizeMB ? `${maxImageSizeMB} MB` : "Không giới hạn"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base lg:text-lg">🎥</span>
                  <span className="text-xs lg:text-sm font-medium text-gray-600">
                    Video tối đa
                  </span>
                </div>
                <span className="text-xs lg:text-sm font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded-lg">
                  {maxVideoSizeMB ? `${maxVideoSizeMB} MB` : "Không giới hạn"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base lg:text-lg">💾</span>
                  <span className="text-xs lg:text-sm font-medium text-gray-600">
                    Dung lượng tối đa
                  </span>
                </div>
                <span className="text-xs lg:text-sm font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded-lg">
                  {storage_limit_mb === -1
                    ? "Không giới hạn"
                    : `${storage_limit_mb} MB`}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* STATUS */}

        {/* Status bar với countdown */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-3 lg:p-4 border border-green-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-green-700 font-medium text-xs lg:text-sm">
                {FREE_FOR_ALL
                  ? "Premium đang hoạt động"
                  : isFree
                    ? "Gói miễn phí"
                    : isActive
                      ? "Đang hoạt động"
                      : "Đã hết hạn"}
              </span>
            </div>
            <span className="text-green-600 text-xs lg:text-sm font-medium">
              {FREE_FOR_ALL || isFree ? "Vĩnh viễn" : timeLeft}
            </span>
          </div>
        </div>

        {/* ACTION BUTTON */}
        <button
          type="button"
          disabled={actionConfig.disabled}
          onClick={() => {
            if (actionConfig.disabled) return;
            SonnerInfo("Sắp ra mắt!");
          }}
          className={`w-full text-white font-semibold py-2 rounded-xl transition ${actionConfig.className} ${
            actionConfig.disabled ? "cursor-default" : ""
          }`}
        >
          {actionConfig.text}
        </button>
      </div>
    </div>
  );
});
