/**
 * Activity bài của mình:
 * - Chỉ hiện ai đã xem (views + reaction = đã xem)
 * - Cuối danh sách: ai bị chặn / không được xem bài
 */
import { getAllFriendDetails, getFriendDetail } from "@/cache/friendsDB";

const FALLBACK_AVATAR = "/images/default_profile.png";

function friendUid(f) {
  return f?.uid || f?.localId || f?.user || f?.id || null;
}

function normalizeIdList(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((x) => {
      if (x == null) return "";
      if (typeof x === "string" || typeof x === "number") return String(x);
      return String(x.uid || x.user || x.localId || x.id || "");
    })
    .filter(Boolean);
}

/** Lấy audience / recipients / excluded từ moment (nhiều field API) */
function getMomentAudienceMeta(moment) {
  if (!moment || typeof moment !== "object") {
    return { audience: "all", recipients: [], excluded: [], isPublic: true };
  }
  const opts = moment.optionsData || moment.options || moment.overlays || {};
  const audience =
    moment.audience ||
    opts.audience ||
    (moment.isPublic === false ? "private" : "all");

  const recipients = normalizeIdList(
    moment.recipients ||
      opts.recipients ||
      moment.allowed_users ||
      opts.allowed_users ||
      []
  );

  const excluded = normalizeIdList(
    moment.excluded_users ||
      moment.excludedUsers ||
      opts.excluded_users ||
      opts.blocked_users ||
      moment.blocked_users ||
      moment.blockedUsers ||
      []
  );

  const isPublic =
    moment.isPublic !== false &&
    audience !== "private" &&
    audience !== "selected";

  return { audience, recipients, excluded, isPublic: !!isPublic };
}

async function resolveUser(userId, friendsById) {
  let userInfo = friendsById.get(userId);
  if (!userInfo) {
    try {
      userInfo = await getFriendDetail(userId);
    } catch {
      userInfo = null;
    }
  }
  return (
    userInfo || {
      uid: userId,
      firstName: "Bạn bè",
      lastName: "",
      profilePic: FALLBACK_AVATAR,
    }
  );
}

/**
 * @returns {Promise<Array>} activity: status "viewed" | "reacted" | "blocked"
 */
export async function buildFullMomentActivity({
  views = [],
  reactions = [],
  myLocalId = null,
  moment = null,
}) {
  let friends = [];
  try {
    friends = (await getAllFriendDetails()) || [];
  } catch {
    friends = [];
  }

  const friendsById = new Map();
  for (const f of friends) {
    const id = friendUid(f);
    if (id) friendsById.set(id, f);
  }

  // ----- 1) Chỉ người đã xem -----
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

  // Reaction cũng = đã xem (có thể API không ghi riêng view)
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

  // ----- 2) Ai bị chặn / không được xem -----
  const { audience, recipients, excluded } = getMomentAudienceMeta(moment);
  const blockedIds = new Set(excluded);

  // Đăng chọn người: bạn bè không nằm trong recipients → không xem được
  if (audience === "selected" && recipients.length > 0) {
    const allow = new Set(recipients);
    for (const f of friends) {
      const id = friendUid(f);
      if (!id || (myLocalId && id === myLocalId)) continue;
      if (!allow.has(id)) blockedIds.add(id);
    }
  }

  // Riêng tư / isPublic false: mọi bạn bè không xem được
  if (audience === "private" || moment?.isPublic === false) {
    for (const f of friends) {
      const id = friendUid(f);
      if (!id || (myLocalId && id === myLocalId)) continue;
      blockedIds.add(id);
    }
  }

  // Friend flag hidden (nếu có)
  for (const f of friends) {
    const id = friendUid(f);
    if (!id) continue;
    if (f.hidden === true || f.isHidden === true || f.blocked === true) {
      blockedIds.add(id);
    }
  }

  // Không liệt kê blocked nếu họ đã xem (tránh trùng)
  for (const uid of byUser.keys()) {
    blockedIds.delete(uid);
  }
  if (myLocalId) blockedIds.delete(myLocalId);

  const viewers = await Promise.all(
    Array.from(byUser.values()).map(async (item) => ({
      user: await resolveUser(item.userId, friendsById),
      viewedAt: item.viewedAt,
      reaction: item.reaction,
      status: item.status,
    }))
  );

  // Mới xem trước
  viewers.sort((a, b) => {
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

  const blocked = await Promise.all(
    Array.from(blockedIds).map(async (uid) => ({
      user: await resolveUser(uid, friendsById),
      viewedAt: null,
      reaction: null,
      status: "blocked",
    }))
  );

  // Tên A→Z cho mục chặn
  blocked.sort((a, b) => {
    const na = `${a.user?.firstName || ""} ${a.user?.lastName || ""}`.trim();
    const nb = `${b.user?.firstName || ""} ${b.user?.lastName || ""}`.trim();
    return na.localeCompare(nb, "vi");
  });

  // Viewers trước, blocked ở cuối
  return [...viewers, ...blocked];
}

export function splitActivity(activity = []) {
  const viewedAll = activity.filter(
    (i) =>
      i.status === "viewed" ||
      i.status === "reacted" ||
      !!i.viewedAt ||
      !!i.reaction
  );
  const reacted = activity.filter((i) => i.status === "reacted" || !!i.reaction);
  const viewedOnly = activity.filter(
    (i) =>
      !i.reaction &&
      i.status !== "blocked" &&
      (i.status === "viewed" || !!i.viewedAt)
  );
  const blocked = activity.filter((i) => i.status === "blocked");

  return {
    reacted,
    viewedOnly,
    viewedAll,
    blocked,
    notViewed: [],
    noReaction: viewedOnly,
  };
}
