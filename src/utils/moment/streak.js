/** yyyymmdd theo local time (khớp client locket-dio.com) */
export function getTodayYyyymmdd() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  return Number(`${yyyy}${mm}${dd}`);
}

/**
 * true nếu đã có streak update hôm nay (đã đăng trong ngày).
 * @deprecated dùng getStreakDataForPost cho payload upload
 */
export const getStreakToday = () => {
  try {
    const streakRaw = localStorage.getItem("streak");
    if (!streakRaw) return false;

    const streak = JSON.parse(streakRaw);
    if (!streak.last_updated_yyyymmdd) return false;

    return streak.last_updated_yyyymmdd === getTodayYyyymmdd();
  } catch (err) {
    console.error("Error parsing streak from localStorage:", err);
    return false;
  }
};

/**
 * Official getTodayIfNotUpdated():
 * - nếu CHƯA đăng hôm nay → trả về số yyyymmdd (gắn optionsData.streakData)
 * - nếu ĐÃ đăng hôm nay → null (không gửi streakData)
 */
export function getStreakDataForPost() {
  try {
    const today = getTodayYyyymmdd();
    const streakRaw = localStorage.getItem("streak");
    if (!streakRaw) return today;

    const streak = JSON.parse(streakRaw);
    if (streak?.last_updated_yyyymmdd === today) return null;
    return today;
  } catch (err) {
    console.error("Error getStreakDataForPost:", err);
    return null;
  }
}
