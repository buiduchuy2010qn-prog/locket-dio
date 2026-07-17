import React, { useState, useEffect, useCallback, useRef } from "react";
import { getRollcallPosts } from "@/services";
import RollcallCard from "./RollcallCard";
import { saveRollcalls, getRollcallsByWeek } from "@/cache/rollcallDb";
import { getISOWeek, getWeekRange } from "@/utils";
import WeekNavigator from "./WeekNavigator";
import {
  logRollcallNet,
  getListFetchKey,
  getInflightListFetch,
  setInflightListFetch,
} from "@/utils/rollcallMedia";

function RollcallsPost({ active, posts, setPosts, isProfileOpen }) {
  const { week: currentWeek, year: currentYear } = getISOWeek();

  const [selectedWeek, setSelectedWeek] = useState(currentWeek);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [visibleCount, setVisibleCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  // reset visible khi đổi tab
  useEffect(() => {
    if (active === "lockets") setVisibleCount(5);
  }, [active]);

  // reset visible khi đổi tuần
  useEffect(() => {
    setVisibleCount(2);
  }, [selectedWeek, selectedYear, isProfileOpen]);

  /**
   * Stale-while-revalidate:
   * 1) paint cache immediately (cards + author frames)
   * 2) refresh list in background (deduped, abortable)
   * Does NOT block UI on per-user friend lookups.
   */
  const fetchPosts = useCallback(async () => {
    const week = selectedWeek;
    const year = selectedYear;
    const fetchKey = getListFetchKey(week, year);

    // Cancel previous week's in-flight work
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // 1) Cache first (or clear if no cache for this week)
    try {
      const cached = await getRollcallsByWeek(week, year);
      if (controller.signal.aborted || !mountedRef.current) return;
      if (cached?.length) {
        setPosts(cached);
        setLoading(false);
        logRollcallNet({
          type: "getRollcallPosts",
          status: "cache",
          ms: 0,
          count: cached.length,
          week,
          year,
          fromCache: true,
        });
      } else {
        // Avoid showing previous week's cards while fetching
        setPosts([]);
        setLoading(true);
      }
    } catch {
      if (mountedRef.current && !controller.signal.aborted) {
        setPosts([]);
        setLoading(true);
      }
    }

    // 2) Network (dedupe concurrent same week)
    const existing = getInflightListFetch(fetchKey);
    const run = existing || setInflightListFetch(
      fetchKey,
      (async () => {
        const t0 = performance.now();
        try {
          const data = await getRollcallPosts({
            selectWeek: week,
            selectYear: year,
          });
          const ms = Math.round(performance.now() - t0);
          if (!Array.isArray(data)) {
            logRollcallNet({
              type: "getRollcallPosts",
              status: "empty",
              ms,
              count: 0,
              week,
              year,
              fromCache: false,
            });
            // null = keep existing cache / UI; do not wipe
            return null;
          }
          logRollcallNet({
            type: "getRollcallPosts",
            status: 200,
            ms,
            count: data.length,
            week,
            year,
            fromCache: false,
          });
          // Persist without blocking paint
          saveRollcalls(data, { week, year }).catch(() => {});
          return data;
        } catch (err) {
          logRollcallNet({
            type: "getRollcallPosts",
            status: "error",
            ms: Math.round(performance.now() - t0),
            week,
            year,
            fromCache: false,
          });
          throw err;
        }
      })()
    );

    try {
      const list = await run;
      if (controller.signal.aborted || !mountedRef.current) return;
      // Only apply if still viewing this week and network returned data
      if (
        list != null &&
        week === selectedWeek &&
        year === selectedYear
      ) {
        setPosts(list);
      }
    } catch (err) {
      if (controller.signal.aborted || !mountedRef.current) return;
      console.error("Failed to load rollcall posts:", err);
    } finally {
      if (!controller.signal.aborted && mountedRef.current) {
        setLoading(false);
      }
    }
  }, [selectedWeek, selectedYear, setPosts]);

  // Fetch when week / year changes (and on mount)
  useEffect(() => {
    fetchPosts();
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchPosts]);

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollTop + clientHeight >= scrollHeight - 10) {
      setVisibleCount((prev) => Math.min(prev + 5, posts.length));
    }
  };

  return (
    <div
      className="h-full p-4 w-full flex flex-col gap-4 overflow-y-auto pb-24"
      onScroll={handleScroll}
    >
      {/* Week navigator */}
      <WeekNavigator
        week={selectedWeek}
        year={selectedYear}
        onChange={(w, y) => {
          setSelectedWeek(w);
          setSelectedYear(y);
        }}
      />

      <h2 className="text-xl font-bold">
        Rollcalls – {getWeekRange(selectedWeek, selectedYear)}
      </h2>

      {loading && !posts?.length && (
        <div className="opacity-60">Loading...</div>
      )}

      {posts
        .slice(0, visibleCount)
        .map((post) => (
          <RollcallCard key={post.uid} post={post} />
        ))}
    </div>
  );
}

export default RollcallsPost;
