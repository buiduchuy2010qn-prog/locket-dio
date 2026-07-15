import React, { useMemo } from "react";
import { useAuthStore } from "@/stores";
import { FREE_FOR_ALL } from "@/hooks/useFeature";

const PREMIUM_BADGE = {
  text: "Premium",
  gradient: "linear-gradient(135deg, #a855f7, #ec4899)",
  highlight_color: "#ffffff",
};

const FREE_BADGE = {
  text: "Free",
  gradient: "linear-gradient(135deg, #94a3b8, #64748b)",
  highlight_color: "#ffffff",
};

function normalizeBadge(raw) {
  if (!raw) return null;
  if (typeof raw === "object" && raw.text) return raw;
  if (typeof raw === "string") {
    const key = raw.toLowerCase();
    if (key === "free") return FREE_BADGE;
    return {
      text: raw.charAt(0).toUpperCase() + raw.slice(1),
      gradient: PREMIUM_BADGE.gradient,
      highlight_color: "#ffffff",
    };
  }
  return null;
}

/**
 * @param {{ plan?: { badge?: any }, className?: string }} props
 */
const PlanBadge = ({ plan = null, className = "" }) => {
  const storeBadge = useAuthStore((s) => s.userPlan?.plan?.badge);

  const badge = useMemo(() => {
    if (FREE_FOR_ALL) return PREMIUM_BADGE;
    return (
      normalizeBadge(plan?.badge) ||
      normalizeBadge(storeBadge) ||
      null
    );
  }, [plan?.badge, storeBadge]);

  if (!badge) return null;

  const combinedClasses =
    "px-2.5 py-1.5 text-xs rounded-full font-semibold shadow-md ml-2 " +
    className;

  return (
    <span
      className={combinedClasses}
      style={{
        background: badge.gradient || PREMIUM_BADGE.gradient,
        color: badge.highlight_color || "#ffffff",
      }}
    >
      {badge.text || "Premium"}
    </span>
  );
};

export default PlanBadge;
