import db from "./configDB";

const rollcallDB = db;

/**
 * Persist rollcall posts for a week (stale-while-revalidate).
 * Keeps original created_at / items / comments shape for UI.
 */
export async function saveRollcalls(raw = [], meta = {}) {
  if (!Array.isArray(raw) || !raw.length) return;

  const week = meta.week;
  const year = meta.year;
  const fetchedAt = Date.now();

  const data = raw.map((r) => ({
    ...r,
    uid: r.uid,
    user: r.user,
    week_of_year:
      r.week_of_year ??
      (typeof week === "number" ? week : r.week_of_year),
    year: year ?? r.year ?? null,
    // Keep Firestore-like created_at for display; also index-friendly ms
    create_time:
      typeof r.created_at === "number"
        ? r.created_at
        : r.created_at?._seconds
          ? r.created_at._seconds * 1000
          : fetchedAt,
    fetchedAt,
  }));

  await rollcallDB.rollcalls.bulkPut(data);
}

/**
 * Read cached rollcalls for week/year. Returns posts in API shape.
 */
export async function getRollcallsByWeek(week, year) {
  try {
    if (week == null) return [];

    let rows = await rollcallDB.rollcalls
      .where("week_of_year")
      .equals(week)
      .toArray();

    if (year != null) {
      rows = rows.filter((r) => r.year == null || r.year === year);
    }

    // Newest first
    rows.sort((a, b) => {
      const ta =
        a.create_time ||
        (a.created_at?._seconds ? a.created_at._seconds * 1000 : 0) ||
        a.fetchedAt ||
        0;
      const tb =
        b.create_time ||
        (b.created_at?._seconds ? b.created_at._seconds * 1000 : 0) ||
        b.fetchedAt ||
        0;
      return tb - ta;
    });

    return rows;
  } catch (err) {
    console.error("Failed to read rollcall cache:", err);
    return [];
  }
}

export async function getRollcallCacheMeta(week, year) {
  const rows = await getRollcallsByWeek(week, year);
  if (!rows.length) return null;
  const fetchedAt = Math.max(...rows.map((r) => r.fetchedAt || 0));
  return { count: rows.length, fetchedAt };
}
