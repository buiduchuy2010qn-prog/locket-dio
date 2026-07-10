import i18n from "@/i18n";

const getTimeAgo = (timestamp, isSecondTimestamp = false) => {
  if (!timestamp) return "";

  if (isSecondTimestamp && String(timestamp).length === 10) {
    timestamp *= 1000;
  }

  const now = new Date();
  const target = new Date(timestamp);

  const year = target.getFullYear();

  const diffMs = now - target;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return i18n.t("common:time.just_now");
  }

  if (diffMinutes < 60) {
    return i18n.t("common:time.minutes_ago", {
      count: diffMinutes,
    });
  }

  if (diffHours < 24) {
    return i18n.t("common:time.hours_ago", {
      count: diffHours,
    });
  }

  if (diffDays < 3) {
    return i18n.t("common:time.days_ago", {
      count: diffDays,
    });
  }

  const localeMap = {
    vi: "vi-VN",
    en: "en-US",
    ko: "ko-KR",
    zh: "zh-CN",
  };

  return new Intl.DateTimeFormat(
    localeMap[i18n.language] || "en-US",
    year === now.getFullYear()
      ? {
          day: "numeric",
          month: "short",
        }
      : {
          day: "numeric",
          month: "short",
          year: "numeric",
        },
  ).format(target);
};

export const formatTimeAgo = (timestamp) => getTimeAgo(timestamp);

export const formatTimeAgoV2 = (timestamp) => getTimeAgo(timestamp, true);
