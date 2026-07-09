/**
 * Gộp views + reactions + danh sách bạn bè → activity đầy đủ.
 * status: "reacted" | "viewed" | "not_viewed"
 */
import { getAllFriendDetails, getFriendDetail } from "@/cache/friendsDB";

const FALLBACK_AVATAR = "/images/default_profile.png";

export async function buildFullMomentActivity({
  views = [],
  reactions = [],
  myLocalId = null,
}) {
  const byUser = new Map();

  for (const view of views) {
    if (!view?.user) continue;
    if (myLocalId && view.user === myLocalId) continue;
    byUser.set(view.user, {
      userId: view.user,
      viewedAt: view.viewedAt || null,
      reaction: null,
      status: "viewed",
    });
  }

  for (const r of reactions) {
    if (!r?.user) continue;
    if (myLocalId && r.user === myLocalId) continue;
    const existing = byUser.get(r.user) || {
      userId: r.user,
      viewedAt: r.createdAt || null,
      reaction: null,
      status: "viewed",
    };
    existing.reaction = {
      emoji: r.emoji,
      intensity: r.intensity,
      createdAt: r.createdAt,
    };
    existing.status = "reacted";
    if (!existing.viewedAt) existing.viewedAt = r.createdAt || null;
    byUser.set(r.user, existing);
  }

  // Toàn bộ bạn bè chưa xem / chưa thả cảm xúc
  let friends = [];
  try {
    friends = (await getAllFriendDetails()) || [];
  } catch {
    friends = [];
  }

  for (const f of friends) {
    const uid = f?.uid || f?.localId || f?.user || f?.id;
    if (!uid) continue;
    if (myLocalId && uid === myLocalId) continue;
    if (byUser.has(uid)) continue;
    byUser.set(uid, {
      userId: uid,
      viewedAt: null,
      reaction: null,
      status: "not_viewed",
    });
  }

  const merged = await Promise.all(
    Array.from(byUser.values()).map(async (item) => {
      let userInfo = friends.find(
        (f) => (f?.uid || f?.localId || f?.user || f?.id) === item.userId
      );
      if (!userInfo) {
        try {
          userInfo = await getFriendDetail(item.userId);
        } catch {
          userInfo = null;
        }
      }
      return {
        user: userInfo || {
          uid: item.userId,
          firstName: "Bạn bè",
          lastName: "",
          profilePic: FALLBACK_AVATAR,
        },
        viewedAt: item.viewedAt,
        reaction: item.reaction,
        status: item.status,
      };
    })
  );

  // reacted → viewed → not_viewed; trong nhóm: mới nhất trước
  const rank = { reacted: 0, viewed: 1, not_viewed: 2 };
  merged.sort((a, b) => {
    const ra = rank[a.status] ?? 9;
    const rb = rank[b.status] ?? 9;
    if (ra !== rb) return ra - rb;
    const ta = a.viewedAt
      ? new Date(a.viewedAt).getTime()
      : a.reaction?.createdAt
        ? new Date(a.reaction.createdAt).getTime()
        : 0;
    const tb = b.viewedAt
      ? new Date(b.viewedAt).getTime()
      : b.reaction?.createdAt
        ? new Date(b.reaction.createdAt).getTime()
        : 0;
    return tb - ta;
  });

  return merged;
}

export function splitActivity(activity = []) {
  const reacted = activity.filter((i) => i.status === "reacted" || !!i.reaction);
  const viewedOnly = activity.filter(
    (i) =>
      !i.reaction &&
      (i.status === "viewed" || !!i.viewedAt)
  );
  const notViewed = activity.filter(
    (i) =>
      !i.reaction &&
      !i.viewedAt &&
      (i.status === "not_viewed" || i.status == null || i.status === "not_viewed")
  );
  // Dedup: notViewed only pure chưa xem
  const notViewedClean = activity.filter(
    (i) => i.status === "not_viewed" || (!i.reaction && !i.viewedAt && i.status !== "viewed" && i.status !== "reacted")
  );
  // chưa thả cảm xúc = mọi người không có reaction
  const noReaction = activity.filter((i) => !i.reaction);
  return {
    reacted,
    viewedOnly,
    notViewed: notViewedClean,
    noReaction,
    viewedAll: activity.filter(
      (i) =>
        i.status === "viewed" ||
        i.status === "reacted" ||
        !!i.viewedAt ||
        !!i.reaction
    ),
  };
}
