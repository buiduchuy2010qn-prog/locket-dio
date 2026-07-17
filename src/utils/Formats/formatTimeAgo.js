import i18n from "@/i18n";

/**
 * Parse timestamp an toàn — tránh RangeError: Invalid time value.
 * Hỗ trợ: ms number, seconds (10 chữ số), ISO string, Firestore {_seconds}.
 * Không parse chuỗi locale vi-VN (dd/MM/yyyy) — sẽ invalid.
 */
function toValidDate(input, isSecondTimestamp = false) {
  if (input == null || input === "") return null;

  // Firestore Timestamp-like
  if (typeof input === "object") {
    const sec = input._seconds ?? input.seconds;
    if (typeof sec === "number" && Number.isFinite(sec)) {
      const d = new Date(sec * 1000);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    if (typeof input.toDate === "function") {
      try {
        const d = input.toDate();
        return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
      } catch {
        return null;
      }
    }
    return null;
  }

  let value = input;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    // pure digits → number
    if (/^\d{10,13}$/.test(trimmed)) {
      value = Number(trimmed);
    } else if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(trimmed)) {
      // Chuỗi đã format vi-VN — không parse được an toàn
      return null;
    } else {
      const d = new Date(trimmed);
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return null;
    // 13+ digits (>= 1e12) → already milliseconds. Never *1000 again
    // (old V2 forced seconds and turned ms into far-future → always "Vừa xong")
    let ms = value;
    if (value < 1e12) {
      // 10-digit epoch seconds (~2001–2286), or caller said seconds
      if (isSecondTimestamp || value > 1e9) {
        ms = value * 1000;
      }
    }
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
}

const getTimeAgo = (timestamp, isSecondTimestamp = false) => {
  const target = toValidDate(timestamp, isSecondTimestamp);
  if (!target) return "";

  const now = new Date();
  const year = target.getFullYear();

  const diffMs = now - target;
  if (!Number.isFinite(diffMs)) return "";

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

  try {
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
  } catch {
    return "";
  }
};

export const formatTimeAgo = (timestamp) => getTimeAgo(timestamp);

/** Auto-detect seconds vs ms (chat list may mix both). */
export const formatTimeAgoV2 = (timestamp) => getTimeAgo(timestamp, false);
