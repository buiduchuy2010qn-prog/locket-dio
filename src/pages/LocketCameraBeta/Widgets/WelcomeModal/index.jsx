import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import {
  Bell,
  BookOpen,
  Camera,
  ChevronLeft,
  ChevronRight,
  Eye,
  Flame,
  Image,
  Scissors,
  Send,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { subscribePush } from "@/services";
import { SonnerInfo, SonnerSuccess } from "@/components/uikit/SonnerToast";
import clsx from "clsx";
import { useTranslation } from "react-i18next";

const STORAGE_KEY = "huylocket-welcome-seen";

// ─── Dữ liệu các slide giới thiệu ──────────────────────────────────────────
const SLIDES_TEMPLATES = [
  {
    id: "welcome",
    icon: <Sparkles className="w-14 h-14 text-yellow-400 drop-shadow-glow" />,
    emoji: "👋",
    titleKey: "home.welcome.title",
    descKey: "home.welcome.desc",
    tips: [
      {
        icon: "📌",
        textKey: "home.welcome.tip_personal_project",
      },
      {
        icon: "⚡",
        textKey: "home.welcome.tip_contribution",
      },
      {
        icon: "🤝",
        textKey: "home.welcome.tip_membership",
      },
      {
        icon: "🚀",
        textKey: "home.welcome.tip_explore_next",
      },
    ],
  },
  {
    id: "post",
    icon: <Image className="w-14 h-14 text-blue-400" />,
    emoji: "🖼️",
    titleKey: "home.welcome.post_title",
    descKey: "home.welcome.post_desc",
    tips: [
      {
        icon: <Image className="w-4 h-4" />,
        textKey: "home.welcome.post_tip_formats",
      },
      {
        icon: <Camera className="w-4 h-4" />,
        textKey: "home.welcome.post_tip_camera",
      },
      {
        icon: <Scissors className="w-4 h-4" />,
        textKey: "home.welcome.post_tip_crop",
      },
    ],
  },
  {
    id: "features",
    icon: <Sparkles className="w-14 h-14 text-pink-400" />,
    emoji: "⚡",
    titleKey: "home.welcome.features_title",
    descKey: "home.welcome.features_desc",
    tips: [
      {
        icon: <Sparkles className="w-4 h-4" />,
        textKey: "home.welcome.features_tip_hidden",
      },
      {
        icon: <Send className="w-4 h-4" />,
        textKey: "home.welcome.features_tip_invite",
      },
      {
        icon: <Users className="w-4 h-4" />,
        textKey: "home.welcome.features_tip_search",
      },
      {
        icon: <Flame className="w-4 h-4" />,
        textKey: "home.welcome.features_tip_streak",
      },
      {
        icon: <Eye className="w-4 h-4" />,
        textKey: "home.welcome.features_tip_anonymous",
      },
      { icon: <Users className="w-4 h-4" />, textKey: "home.welcome.features_tip_groups" },
      {
        icon: <Send className="w-4 h-4" />,
        textKey: "home.welcome.features_tip_private",
      },
    ],
  },
  {
    id: "community",
    icon: <Users className="w-14 h-14 text-purple-400" />,
    emoji: "🏘️",
    titleKey: "home.welcome.community_title",
    descKey: "home.welcome.community_desc",
    communities: [
      {
        name: "Discord",
        url: "https://discord.com/invite/47buy9nMGc",
        color: "btn-secondary",
        icon: "💬",
      },
      {
        name: "Messenger",
        url: "https://m.me/cm/AbYPtgRiGe2fInEf",
        color: "btn-primary",
        icon: "📩",
      },
      {
        name: "Telegram Channel",
        url: "https://t.me/nthuylocket",
        color: "btn-info",
        icon: "📣",
      },
    ],
  },
  {
    id: "notification",
    icon: <Bell className="w-14 h-14 text-orange-400" />,
    emoji: "🔔",
    titleKey: "home.welcome.notif_title",
    descKey: "home.welcome.notif_desc",
    isNotification: true,
  },
];

// ─── Component chính ─────────────────────────────────────────────────────────
const WelcomeModal = () => {
  const { t } = useTranslation("main");
  const [open, setOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [animate, setAnimate] = useState(false);
  const [step, setStep] = useState(0);

  // Permission state
  const [permission, setPermission] = useState("default");
  const [subscribed, setSubscribed] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);

  // Kiểm tra lần đầu
  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY);
    if (!seen) {
      // Delay nhỏ để page load xong
      const t = setTimeout(() => setOpen(true), 2000);
      return () => clearTimeout(t);
    }
  }, []);

  // Kiểm tra permission hiện tại
  useEffect(() => {
    if ("Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  // Animate khi open thay đổi
  useEffect(() => {
    document.body.style.overflow = showModal ? "hidden" : "";
    return () => (document.body.style.overflow = "");
  }, [showModal]);

  useEffect(() => {
    if (open) {
      setShowModal(true);
      setTimeout(() => setAnimate(true), 10);
    } else {
      setAnimate(false);
      setTimeout(() => setShowModal(false), 350);
    }
  }, [open]);

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setOpen(false);
  };

  const handleNext = () => {
    if (step < SLIDES_TEMPLATES.length - 1) setStep((s) => s + 1);
    else handleDismiss();
  };

  const handlePrev = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  const handleSubscribeNotif = async () => {
    if (permission === "denied") {
      SonnerInfo(
        t("home.welcome.notif_blocked_alert"),
      );
      return;
    }
    setNotifLoading(true);
    try {
      if (!("Notification" in window) || !("serviceWorker" in navigator)) {
        SonnerInfo(t("home.welcome.notif_unsupported_alert"));
        return;
      }
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") return;
      await subscribePush();
      setSubscribed(true);
      SonnerSuccess(t("home.welcome.notif_enabled_alert"), t("home.welcome.notif_enabled_alert_desc"));
    } catch (e) {
      console.error(e);
    } finally {
      setNotifLoading(false);
    }
  };

  if (!showModal) return null;

  const slide = SLIDES_TEMPLATES[step];
  const isLast = step === SLIDES_TEMPLATES.length - 1;

  return ReactDOM.createPortal(
    <div
      className={clsx(
        "fixed inset-0 bg-base-100/30 backdrop-blur-[4px] transition-opacity duration-500 z-[60] overflow-hidden",
        {
          "opacity-100": animate,
          "opacity-0 pointer-events-none": !animate,
        },
      )}
      onClick={handleDismiss}
    >
      {/* Sheet */}
      <div
        className={clsx(
          "fixed h-4/5 border-t border-base-300 bottom-0 left-0 w-full bg-base-100 rounded-t-4xl shadow-lg transition-all duration-500 ease-in-out z-[63] flex flex-col text-base-content",
          {
            "translate-y-0": animate,
            "translate-y-full": !animate,
          },
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-2">
          {/* Step dots */}
          <div className="flex gap-1.5">
            {SLIDES_TEMPLATES.map((_, i) => (
              <span
                key={i}
                onClick={() => setStep(i)}
                className={`block h-2 rounded-full transition-all duration-300 cursor-pointer ${
                  i === step
                    ? "w-6 bg-yellow-400"
                    : "w-2 bg-base-300 hover:bg-base-content/30"
                }`}
              />
            ))}
          </div>

          <button
            onClick={handleDismiss}
            className="btn btn-ghost btn-sm btn-circle bg-base-300 hover:bg-base-200"
          >
            <X size={18} />
          </button>
        </div>

        {/* Slide Content */}
        <div
          key={step}
          className="flex flex-col items-center px-6 pt-4 pb-6 gap-4 flex-1 overflow-y-auto"
          style={{ animation: "slideIn 0.3s ease" }}
        >
          {/* Icon */}
          <div className="flex items-center justify-center w-20 h-20 rounded-full bg-base-200 shadow-inner p-4 select-none">
            {slide.icon}
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold text-center text-base-content leading-tight">
            {slide.emoji} {t(slide.titleKey)}
          </h2>

          {/* Description */}
          <p className="text-sm text-base-content/70 text-center leading-relaxed max-w-sm">
            {t(slide.descKey)}
          </p>

          {/* Tips */}
          {slide.tips && (
            <div className="w-full flex flex-col gap-2 mt-1">
              {slide.tips.map((tip, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 bg-base-200 rounded-2xl px-4 py-3"
                >
                  <span className="text-base-content/70">{tip.icon}</span>
                  <span className="text-sm text-base-content">{t(tip.textKey)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Communities */}
          {slide.communities && (
            <div className="w-full flex flex-col gap-3 mt-1">
              {slide.communities.map((c, i) => (
                <a
                  key={i}
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`btn w-full rounded-2xl gap-2 ${c.color}`}
                >
                  <span className="text-lg">{c.icon}</span>
                  {c.name}
                </a>
              ))}
              <p className="text-xs text-center text-base-content/40 mt-1">
                {t("home.welcome.community_join_tip")}
              </p>
            </div>
          )}

          {/* Notification slide */}
          {slide.isNotification && (
            <div className="w-full flex flex-col gap-3 mt-1">
              {permission === "granted" && subscribed ? (
                <div className="flex flex-col items-center gap-2 p-4 bg-green-500/10 rounded-2xl border border-green-500/20">
                  <Bell className="w-8 h-8 text-green-400" />
                  <p className="text-sm font-semibold text-green-500 text-center">
                    {t("home.welcome.notif_enabled")}
                  </p>
                  <p className="text-xs text-base-content/60 text-center">
                    {t("home.welcome.notif_enabled_desc")}
                  </p>
                </div>
              ) : permission === "denied" ? (
                <div className="flex flex-col items-center gap-2 p-4 bg-warning/10 rounded-2xl border border-warning/20">
                  <p className="text-sm text-warning font-medium text-center">
                    {t("home.welcome.notif_blocked")}
                  </p>
                  <p className="text-xs text-base-content/60 text-center">
                    {t("home.welcome.notif_blocked_desc")}
                  </p>
                </div>
              ) : (
                <button
                  className="btn btn-warning btn-lg rounded-2xl w-full gap-2 font-semibold"
                  disabled={notifLoading}
                  onClick={handleSubscribeNotif}
                >
                  {notifLoading ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : (
                    <Bell className="w-5 h-5" />
                  )}
                  {t("home.welcome.notif_allow")}
                </button>
              )}

              <p className="text-xs text-center text-base-content/40">
                {t("home.welcome.notif_change_anytime")}
              </p>
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div className="px-5 pb-6 pt-2 flex gap-3">
          {step > 0 && (
            <button
              onClick={handlePrev}
              className="btn btn-outline rounded-2xl flex-1 gap-1"
            >
              <ChevronLeft size={18} /> {t("home.welcome.nav_prev")}
            </button>
          )}

          <button
            onClick={handleNext}
            className="btn btn-neutral rounded-2xl flex-1 gap-2 text-base font-semibold"
          >
            {isLast ? (
              <>
                <BookOpen size={18} /> {t("home.welcome.nav_start")}
              </>
            ) : (
              <>
                {t("home.welcome.nav_next")} <ChevronRight size={18} />
              </>
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>,
    document.body,
  );
};

export default WelcomeModal;
