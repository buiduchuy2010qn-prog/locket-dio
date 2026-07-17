import { useState, useEffect } from "react";
import { fetchUserById } from "@/services";
import { getFriendDetail } from "@/cache/friendsDB";
import { logRollcallNet } from "@/utils/rollcallMedia";

/** Dedupe concurrent fetchUserById by uid (shared across Rollcall cards). */
const userInflight = new Map();
const userMemCache = new Map();

async function loadUser(uid) {
  if (!uid) return null;

  if (userMemCache.has(uid)) {
    return userMemCache.get(uid);
  }

  // Local friend detail first (no network)
  try {
    const local = await getFriendDetail(uid);
    if (local) {
      userMemCache.set(uid, local);
      return local;
    }
  } catch {
    /* ignore */
  }

  if (userInflight.has(uid)) {
    return userInflight.get(uid);
  }

  const t0 = performance.now();
  const p = (async () => {
    try {
      const u = await fetchUserById(uid);
      logRollcallNet({
        type: "fetchUserById",
        status: u ? 200 : "empty",
        ms: Math.round(performance.now() - t0),
      });
      if (u) {
        userMemCache.set(uid, u);
        try {
          const db = (await import("@/cache/configDB")).default;
          await db.friendDetails.put({ ...u, uid: u.uid || uid });
        } catch {
          /* ignore persist errors */
        }
      }
      return u || null;
    } catch (err) {
      logRollcallNet({
        type: "fetchUserById",
        status: "error",
        ms: Math.round(performance.now() - t0),
      });
      throw err;
    } finally {
      userInflight.delete(uid);
    }
  })();

  userInflight.set(uid, p);
  return p;
}

/**
 * Hook để fetch thông tin user theo uid (cache-first, deduped).
 * @param {string} uid
 * @returns {object|null} user
 */
export function useUser(uid) {
  const [user, setUser] = useState(() =>
    uid && userMemCache.has(uid) ? userMemCache.get(uid) : null
  );

  useEffect(() => {
    if (!uid) return;

    let mounted = true;

    if (userMemCache.has(uid)) {
      setUser(userMemCache.get(uid));
    }

    loadUser(uid)
      .then((u) => {
        if (mounted && u) setUser(u);
      })
      .catch((err) => {
        console.error("Failed to fetch user:", err);
      });

    return () => {
      mounted = false;
    };
  }, [uid]);

  return user;
}
