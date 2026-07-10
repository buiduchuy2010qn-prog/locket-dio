// streakUtils.js
// Centralized helper functions for streak calculations and rendering.

// Parse date safely, supporting multiple formats (ISO, HH:mm:ss DD/MM/YYYY, timestamp, Date)
export function parseCustomDate(str) {
  if (!str) return null;

  // If already a Date object
  if (str instanceof Date && !isNaN(str)) return str;

  // If timestamp number/string
  if (!isNaN(str) && String(str).length >= 10) {
    const d = new Date(Number(str));
    if (!isNaN(d)) return d;
  }

  // Clean comma and extra spaces
  str = String(str).replace(",", "").trim();

  // Try parsing ISO or standard date formats
  let d = new Date(str);
  if (!isNaN(d)) return d;

  // Regex matches: HH:mm:ss DD/MM/YYYY, DD/MM/YYYY, or HH:mm:ss
  let match;
  const timeDate = /^(\d{1,2}):(\d{1,2}):(\d{1,2})\s+(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/;
  const dateOnly = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/;
  const timeOnly = /^(\d{1,2}):(\d{1,2}):(\d{1,2})$/;

  if ((match = str.match(timeDate))) {
    const [, hh, mm, ss, day, month, year] = match.map(Number);
    return new Date(year, month - 1, day, hh, mm, ss);
  }

  if ((match = str.match(dateOnly))) {
    const [, day, month, year] = match.map(Number);
    return new Date(year, month - 1, day);
  }

  if ((match = str.match(timeOnly))) {
    const [, hh, mm, ss] = match.map(Number);
    const today = new Date();
    return new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      hh,
      mm,
      ss
    );
  }

  return null;
}

// Generate month key format YYYY-MM
export function getMonthKeyFromCustomDate(str) {
  const d = parseCustomDate(str);
  if (!d) return "unknown";
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}`;
}

// Get the last day of the given month/year
export function getLastDayOfMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

// Convert YYYYMMDD string/number to local Date object (midnight)
export function yyyymmddToDate(num) {
  if (!num) return null;
  const str = num.toString();
  if (str.length !== 8) return null;
  const year = +str.slice(0, 4);
  const month = +str.slice(4, 6) - 1;
  const day = +str.slice(6, 8);
  return new Date(year, month, day);
}

// Convert local Date object to YYYYMMDD number
export function dateToYYYYMMDD(date) {
  if (!date) return null;
  return Number(
    `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(
      date.getDate()
    ).padStart(2, "0")}`
  );
}

// Compare two Date objects for same day
export function isSameDay(a, b) {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Get { start, end, count } range for a streak object
export function getStreakRange(streak) {
  if (!streak?.count || !streak?.last_updated_yyyymmdd) return null;
  const end = yyyymmddToDate(streak.last_updated_yyyymmdd);
  if (!end) return null;
  const start = new Date(end);
  start.setDate(start.getDate() - (streak.count - 1));
  return {
    start,
    end,
    count: streak.count,
  };
}

// Get recovery window for current streak (if broken >= 2 days and recovery day is within 2 days of today)
export function getCurrentRecoverWindow(currentStreak, today) {
  if (!currentStreak || !currentStreak.end) return null;
  const last = new Date(currentStreak.end);
  last.setHours(0, 0, 0, 0);

  const refToday = new Date(today);
  refToday.setHours(0, 0, 0, 0);

  // Icon date is the day immediately after the streak ends
  const iconDate = new Date(last);
  iconDate.setDate(iconDate.getDate() + 1);

  // Limit date is today - 2 days (e.g. today is 26, limit is 24)
  const limitDate = new Date(refToday);
  limitDate.setDate(limitDate.getDate() - 2);

  // Check if iconDate is eligible for recovery (iconDate >= today - 2 days and iconDate < today)
  if (iconDate.getTime() < limitDate.getTime() || iconDate.getTime() >= refToday.getTime()) {
    return null; // Too far in the past or is today/future
  }

  return {
    start: iconDate,
    end: refToday,
    iconDate,
  };
}

// Get recovery window for past streak (constrained by currentStreak start date and 2 days limit)
export function getPastRecoverWindow(pastStreak, currentStreak, today) {
  if (!pastStreak || !pastStreak.end) return null;
  const pastEndDate = new Date(pastStreak.end);
  pastEndDate.setHours(0, 0, 0, 0);

  // Icon date is the day immediately after the past streak ends
  const iconDate = new Date(pastEndDate);
  iconDate.setDate(iconDate.getDate() + 1);

  const refToday = new Date(today);
  refToday.setHours(0, 0, 0, 0);

  // Limit date is today - 2 days (e.g. today is 26, limit is 24)
  const limitDate = new Date(refToday);
  limitDate.setDate(limitDate.getDate() - 2);

  // Check if iconDate is eligible for recovery (iconDate >= today - 2 days and iconDate < today)
  if (iconDate.getTime() < limitDate.getTime() || iconDate.getTime() >= refToday.getTime()) {
    return null; // Too far in the past or is today/future
  }

  // Calculate upper boundary of past recovery window (cannot overlap with currentStreak start)
  let pastRecoveryEnd;
  if (currentStreak && currentStreak.start) {
    const currentStart = new Date(currentStreak.start);
    currentStart.setHours(0, 0, 0, 0);
    pastRecoveryEnd = new Date(currentStart);
    pastRecoveryEnd.setDate(pastRecoveryEnd.getDate() - 1);
  } else {
    pastRecoveryEnd = refToday;
  }

  if (iconDate.getTime() <= pastRecoveryEnd.getTime()) {
    return {
      start: iconDate,
      end: pastRecoveryEnd,
      iconDate,
    };
  }
  return null;
}