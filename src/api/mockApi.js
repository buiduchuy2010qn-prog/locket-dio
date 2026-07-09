/**
 * Backend placeholder functions — currently mock + localStorage.
 * Swap implementations later without changing UI call sites.
 */
import { load, save, delay, uid } from '../utils/storage'
import {
  SEED_USERS, SEED_POSTS, SEED_FRIENDS, SEED_REQUESTS,
  SEED_NOTIFICATIONS, SEED_STREAKS,
} from '../data/mockData'
import { FREE_FRIEND_LIMIT, FREE_VIDEO_MAX_SEC, GOLD_VIDEO_MAX_SEC } from '../data/constants'

function ensureSeed() {
  if (!load('seeded')) {
    save('users', SEED_USERS)
    save('posts', SEED_POSTS)
    save('friends', SEED_FRIENDS)
    save('requests', SEED_REQUESTS)
    save('notifications', SEED_NOTIFICATIONS)
    save('streaks', SEED_STREAKS)
    save('seeded', true)
  }
}

function users() { ensureSeed(); return load('users', []) }
function setUsers(v) { save('users', v) }
function posts() { ensureSeed(); return load('posts', []) }
function setPosts(v) { save('posts', v) }
function friends() { ensureSeed(); return load('friends', []) }
function setFriends(v) { save('friends', v) }
function requests() { ensureSeed(); return load('requests', []) }
function setRequests(v) { save('requests', v) }
function notifications() { ensureSeed(); return load('notifications', []) }
function setNotifications(v) { save('notifications', v) }
function streaks() { ensureSeed(); return load('streaks', []) }
function setStreaks(v) { save('streaks', v) }

function publicUser(u) {
  if (!u) return null
  const { password, ...rest } = u
  return rest
}

function getSessionUserId() {
  return load('sessionUserId', null)
}

export async function loginUser({ email, password }) {
  await delay(500)
  const u = users().find(
    (x) =>
      (x.email?.toLowerCase() === email?.toLowerCase() || x.username === email) &&
      x.password === password,
  )
  if (!u) throw new Error('Email hoặc mật khẩu không đúng.')
  save('sessionUserId', u.id)
  return publicUser(u)
}

export async function signUpUser({ email, password, displayName, username }) {
  await delay(600)
  const all = users()
  if (all.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error('Email đã được sử dụng.')
  }
  if (all.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
    throw new Error('Username đã tồn tại.')
  }
  if (password.length < 6) throw new Error('Mật khẩu tối thiểu 6 ký tự.')
  const user = {
    id: uid('u'),
    email,
    password,
    username: username.replace(/\s/g, '').toLowerCase(),
    displayName: displayName || username,
    bio: '',
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(username)}`,
    isGold: false,
    goldSince: null,
    plan: null,
    badgeStyle: 'gold-star',
    badgeVisible: true,
    appIcon: 'classic',
    cameraTheme: 'soft-pink',
    profileFrame: 'none',
    profileBg: 'soft',
    adFree: false,
    darkMode: false,
    notifSettings: { moments: true, friends: true, streaks: true, gold: true },
    privacy: { friendsOnly: true, showActivity: true },
    createdAt: new Date().toISOString(),
  }
  setUsers([...all, user])
  save('sessionUserId', user.id)
  return publicUser(user)
}

export async function forgotPassword({ email }) {
  await delay(500)
  const u = users().find((x) => x.email.toLowerCase() === email.toLowerCase())
  if (!u) throw new Error('Không tìm thấy email này.')
  return { ok: true, message: `Đã gửi link đặt lại (mock) tới ${email}. Mật khẩu demo: demo123` }
}

export async function fetchCurrentUser() {
  await delay(200)
  const id = getSessionUserId()
  if (!id) return null
  return publicUser(users().find((u) => u.id === id) || null)
}

export async function logoutUser() {
  save('sessionUserId', null)
  return { ok: true }
}

export async function updateProfile(patch) {
  await delay(400)
  const id = getSessionUserId()
  const all = users()
  const i = all.findIndex((u) => u.id === id)
  if (i < 0) throw new Error('Chưa đăng nhập.')
  if (patch.username) {
    const taken = all.some(
      (u) => u.id !== id && u.username.toLowerCase() === patch.username.toLowerCase(),
    )
    if (taken) throw new Error('Username đã có người dùng.')
  }
  all[i] = { ...all[i], ...patch }
  setUsers(all)
  return publicUser(all[i])
}

export async function fetchFeed() {
  await delay(350)
  const me = getSessionUserId()
  const friendIds = new Set(friends().map((f) => f.userId))
  friendIds.add(me)
  const list = posts()
    .filter((p) => friendIds.has(p.userId))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  const allUsers = users()
  return list.map((p) => ({
    ...p,
    user: publicUser(allUsers.find((u) => u.id === p.userId)),
  }))
}

export async function uploadMoment({ mediaUrl, caption, type = 'image', durationSec }) {
  await delay(700)
  const me = getSessionUserId()
  if (!me) throw new Error('Chưa đăng nhập.')
  const user = users().find((u) => u.id === me)
  if (type === 'video') {
    const max = user?.isGold ? GOLD_VIDEO_MAX_SEC : FREE_VIDEO_MAX_SEC
    if (durationSec && durationSec > max) {
      throw new Error(`Video tối đa ${max}s${user?.isGold ? '' : ' (nâng Gold để dài hơn)'}.`)
    }
  }
  const post = {
    id: uid('p'),
    userId: me,
    type,
    mediaUrl,
    caption: caption || '',
    createdAt: new Date().toISOString(),
    privacy: 'friends',
    reactions: {},
    seenBy: [],
    durationSec: durationSec || null,
  }
  setPosts([post, ...posts()])
  // bump streaks lightly
  const st = streaks().map((s) => ({
    ...s,
    count: s.count + 1,
    lastPostAt: new Date().toISOString(),
    broken: false,
  }))
  setStreaks(st)
  return { ...post, user: publicUser(user) }
}

export async function uploadVideoMoment(payload) {
  return uploadMoment({ ...payload, type: 'video' })
}

export async function deleteMoment(postId) {
  await delay(300)
  const me = getSessionUserId()
  const p = posts().find((x) => x.id === postId)
  if (!p || p.userId !== me) throw new Error('Không thể xóa moment này.')
  setPosts(posts().filter((x) => x.id !== postId))
  return { ok: true }
}

export async function reactToMoment(postId, emoji) {
  await delay(200)
  const me = getSessionUserId()
  const all = posts()
  const i = all.findIndex((p) => p.id === postId)
  if (i < 0) throw new Error('Không tìm thấy moment.')
  const reactions = { ...(all[i].reactions || {}) }
  // remove me from all then add
  Object.keys(reactions).forEach((k) => {
    reactions[k] = (reactions[k] || []).filter((id) => id !== me)
    if (!reactions[k].length) delete reactions[k]
  })
  reactions[emoji] = [...(reactions[emoji] || []), me]
  all[i] = { ...all[i], reactions }
  // mark seen
  const seen = new Set(all[i].seenBy || [])
  seen.add(me)
  all[i].seenBy = [...seen]
  setPosts(all)
  return all[i]
}

export async function markSeen(postId) {
  const me = getSessionUserId()
  const all = posts()
  const i = all.findIndex((p) => p.id === postId)
  if (i < 0) return null
  const seen = new Set(all[i].seenBy || [])
  if (!seen.has(me)) {
    seen.add(me)
    all[i] = { ...all[i], seenBy: [...seen] }
    setPosts(all)
  }
  return all[i]
}

export async function fetchFriends() {
  await delay(250)
  const allUsers = users()
  return friends().map((f) => ({
    ...f,
    user: publicUser(allUsers.find((u) => u.id === f.userId)),
  }))
}

export async function searchUsers(q) {
  await delay(250)
  const me = getSessionUserId()
  const friendIds = new Set(friends().map((f) => f.userId))
  const qq = (q || '').toLowerCase().trim()
  if (!qq) return []
  return users()
    .filter(
      (u) =>
        u.id !== me &&
        (u.username.includes(qq) || u.displayName?.toLowerCase().includes(qq)),
    )
    .slice(0, 12)
    .map((u) => ({
      ...publicUser(u),
      isFriend: friendIds.has(u.id),
    }))
}

export async function addFriend(username) {
  await delay(400)
  const me = getSessionUserId()
  const user = users().find((u) => u.id === me)
  const target = users().find((u) => u.username.toLowerCase() === username.toLowerCase())
  if (!target) throw new Error('Không tìm thấy username này.')
  if (target.id === me) throw new Error('Không thể kết bạn với chính mình.')
  if (friends().some((f) => f.userId === target.id)) throw new Error('Đã là bạn bè.')
  if (!user.isGold && friends().length >= FREE_FRIEND_LIMIT) {
    throw new Error(`Gói Free tối đa ${FREE_FRIEND_LIMIT} bạn. Nâng Gold để thêm không giới hạn.`)
  }
  const reqs = requests()
  if (reqs.some((r) => r.fromUserId === me && r.toUserId === target.id && r.status === 'pending')) {
    throw new Error('Đã gửi lời mời rồi.')
  }
  // Instant accept for mock simplicity if reverse pending, else create request
  const reverse = reqs.find((r) => r.fromUserId === target.id && r.toUserId === me && r.status === 'pending')
  if (reverse) {
    return acceptFriendRequest(reverse.id)
  }
  const req = {
    id: uid('fr'),
    fromUserId: me,
    toUserId: target.id,
    createdAt: new Date().toISOString(),
    status: 'pending',
  }
  setRequests([req, ...reqs])
  // For demo: auto-add as friend for smoother UX
  setFriends([
    ...friends(),
    { userId: target.id, since: new Date().toISOString(), close: false, streak: 0, lastActive: new Date().toISOString() },
  ])
  setStreaks([...streaks(), { friendId: target.id, count: 0, lastPostAt: null, history: [0, 0, 0, 0, 0, 0, 0] }])
  return { ok: true, message: `Đã kết bạn với @${target.username}` }
}

export async function fetchFriendRequests() {
  await delay(250)
  const me = getSessionUserId()
  const allUsers = users()
  return requests()
    .filter((r) => r.toUserId === me && r.status === 'pending')
    .map((r) => ({
      ...r,
      fromUser: publicUser(allUsers.find((u) => u.id === r.fromUserId)),
    }))
}

export async function acceptFriendRequest(requestId) {
  await delay(300)
  const all = requests()
  const r = all.find((x) => x.id === requestId)
  if (!r) throw new Error('Không tìm thấy lời mời.')
  r.status = 'accepted'
  setRequests(all.map((x) => (x.id === requestId ? r : x)))
  if (!friends().some((f) => f.userId === r.fromUserId)) {
    setFriends([
      ...friends(),
      { userId: r.fromUserId, since: new Date().toISOString(), close: false, streak: 0, lastActive: new Date().toISOString() },
    ])
    setStreaks([...streaks(), { friendId: r.fromUserId, count: 0, lastPostAt: null, history: [0, 0, 0, 0, 0, 0, 0] }])
  }
  return { ok: true }
}

export async function declineFriendRequest(requestId) {
  await delay(250)
  setRequests(requests().map((r) => (r.id === requestId ? { ...r, status: 'declined' } : r)))
  return { ok: true }
}

export async function removeFriend(userId) {
  await delay(300)
  setFriends(friends().filter((f) => f.userId !== userId))
  setStreaks(streaks().filter((s) => s.friendId !== userId))
  return { ok: true }
}

export async function blockUser(userId) {
  await delay(300)
  await removeFriend(userId)
  const blocked = load('blocked', [])
  if (!blocked.includes(userId)) save('blocked', [...blocked, userId])
  return { ok: true }
}

export async function fetchNotifications() {
  await delay(250)
  return notifications().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

export async function markNotificationAsRead(id) {
  await delay(150)
  setNotifications(notifications().map((n) => (n.id === id || id === 'all' ? { ...n, read: true } : n)))
  return { ok: true }
}

export async function fetchGallery() {
  await delay(300)
  const me = getSessionUserId()
  const allUsers = users()
  const friendIds = new Set(friends().map((f) => f.userId))
  friendIds.add(me)
  return posts()
    .filter((p) => friendIds.has(p.userId))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((p) => ({ ...p, user: publicUser(allUsers.find((u) => u.id === p.userId)) }))
}

export async function fetchStreaks() {
  await delay(250)
  const allUsers = users()
  return streaks().map((s) => ({
    ...s,
    user: publicUser(allUsers.find((u) => u.id === s.friendId)),
  }))
}

export async function restoreStreak(friendId) {
  await delay(500)
  const me = users().find((u) => u.id === getSessionUserId())
  if (!me?.isGold) throw new Error('Chỉ thành viên Gold mới khôi phục streak.')
  const all = streaks()
  const i = all.findIndex((s) => s.friendId === friendId)
  if (i < 0) throw new Error('Không tìm thấy streak.')
  all[i] = {
    ...all[i],
    count: Math.max(1, all[i].count || 1),
    broken: false,
    lastPostAt: new Date().toISOString(),
    history: [1, 1, 1, 1, 1, 1, 1],
  }
  setStreaks(all)
  return all[i]
}

export async function fetchGoldStatus() {
  await delay(200)
  const u = await fetchCurrentUser()
  return {
    isGold: !!u?.isGold,
    plan: u?.plan || null,
    goldSince: u?.goldSince || null,
    adFree: !!u?.isGold || !!u?.adFree,
    friendLimit: u?.isGold ? null : FREE_FRIEND_LIMIT,
    friendCount: friends().length,
    videoMaxSec: u?.isGold ? GOLD_VIDEO_MAX_SEC : FREE_VIDEO_MAX_SEC,
  }
}

export async function upgradeToGold({ plan = 'monthly' } = {}) {
  await delay(800)
  const id = getSessionUserId()
  const all = users()
  const i = all.findIndex((u) => u.id === id)
  if (i < 0) throw new Error('Chưa đăng nhập.')
  all[i] = {
    ...all[i],
    isGold: true,
    adFree: true,
    plan,
    goldSince: new Date().toISOString(),
  }
  setUsers(all)
  setNotifications([
    {
      id: uid('n'),
      type: 'gold',
      title: 'Chào mừng Piclet Gold!',
      body: 'Đã kích hoạt toàn bộ tính năng premium.',
      read: false,
      createdAt: new Date().toISOString(),
    },
    ...notifications(),
  ])
  return publicUser(all[i])
}

export async function cancelGoldSubscription() {
  await delay(500)
  const id = getSessionUserId()
  const all = users()
  const i = all.findIndex((u) => u.id === id)
  if (i < 0) throw new Error('Chưa đăng nhập.')
  all[i] = { ...all[i], isGold: false, adFree: false, plan: null }
  setUsers(all)
  return publicUser(all[i])
}

export async function restoreGoldPurchase() {
  await delay(500)
  return upgradeToGold({ plan: 'yearly' })
}

export async function updateGoldBadge(style) {
  return updateProfile({ badgeStyle: style })
}

export async function updateCameraTheme(theme) {
  return updateProfile({ cameraTheme: theme })
}

export async function updateAppIcon(icon) {
  return updateProfile({ appIcon: icon })
}

export async function updateProfileTheme({ profileFrame, profileBg }) {
  return updateProfile({ profileFrame, profileBg })
}

export async function resetDemoData() {
  ;['seeded', 'users', 'posts', 'friends', 'requests', 'notifications', 'streaks', 'sessionUserId', 'blocked'].forEach(
    (k) => localStorage.removeItem(`piclet_gold_v1_${k}`),
  )
  ensureSeed()
  return { ok: true }
}

export function getFriendLimitInfo(user) {
  const count = friends().length
  if (user?.isGold) return { count, limit: null, unlimited: true }
  return { count, limit: FREE_FRIEND_LIMIT, unlimited: false, remaining: Math.max(0, FREE_FRIEND_LIMIT - count) }
}
