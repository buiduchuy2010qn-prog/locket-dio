/**
 * Full-featured local backend (localStorage + IndexedDB media).
 * Works offline on static hosting without real API.
 */
import { load, save, delay, uid, remove } from '../utils/storage'
import { GOLD_VIDEO_MAX_SEC } from '../data/constants'
import { putMedia, getMediaUrl, deleteMedia, compressImageDataUrl } from '../utils/mediaStore'

const PREFIX = 'locket_dio_v4_'

function ensureSeed() {
  if (!load('seeded_v4')) {
    save('users', load('users', []) || [])
    save('posts', [])
    save('friends', [])
    save('requests', [])
    save('notifications', [])
    save('streaks', [])
    save('messages', [])
    save('seeded_v4', true)
  }
  if (load('messages') == null) save('messages', [])
}

function users() { ensureSeed(); return load('users', []) || [] }
function setUsers(v) { save('users', v) }
function posts() { ensureSeed(); return load('posts', []) || [] }
function setPosts(v) { save('posts', v) }
function friends() { ensureSeed(); return load('friends', []) || [] }
function setFriends(v) { save('friends', v) }
function requests() { ensureSeed(); return load('requests', []) || [] }
function setRequests(v) { save('requests', v) }
function notifications() { ensureSeed(); return load('notifications', []) || [] }
function setNotifications(v) { save('notifications', v) }
function streaks() { ensureSeed(); return load('streaks', []) || [] }
function setStreaks(v) { save('streaks', v) }
function messages() { ensureSeed(); return load('messages', []) || [] }
function setMessages(v) { save('messages', v) }

function publicUser(u) {
  if (!u) return null
  const { password, ...rest } = u
  return rest
}

function getSessionUserId() {
  return load('sessionUserId', null)
}

async function hydratePost(p) {
  if (!p) return p
  let mediaUrl = p.mediaUrl
  if (p.mediaId) {
    const url = await getMediaUrl(p.mediaId)
    if (url) mediaUrl = url
  } else if (mediaUrl && !mediaUrl.startsWith('http') && !mediaUrl.startsWith('data:') && !mediaUrl.startsWith('blob:')) {
    const url = await getMediaUrl(mediaUrl)
    if (url) mediaUrl = url
  }
  return { ...p, mediaUrl }
}

async function hydratePosts(list) {
  return Promise.all(list.map(hydratePost))
}

export async function loginUser({ email, password }) {
  await delay(300)
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
  await delay(400)
  const all = users()
  if (!email?.trim()) throw new Error('Nhập email.')
  if (!username?.trim()) throw new Error('Nhập username.')
  if (all.some((u) => u.email?.toLowerCase() === email.toLowerCase())) {
    throw new Error('Email đã được sử dụng.')
  }
  if (all.some((u) => u.username?.toLowerCase() === username.toLowerCase())) {
    throw new Error('Username đã tồn tại.')
  }
  if ((password || '').length < 6) throw new Error('Mật khẩu tối thiểu 6 ký tự.')
  const uname = username.replace(/\s/g, '').toLowerCase()
  const user = {
    id: uid('u'),
    email: email.trim(),
    password,
    username: uname,
    displayName: displayName || uname,
    bio: '',
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(uname)}`,
    isGold: true,
    adFree: true,
    goldSince: new Date().toISOString(),
    plan: 'full',
    badgeStyle: 'gold-star',
    badgeVisible: false,
    appIcon: 'classic',
    cameraTheme: 'soft-pink',
    profileFrame: 'none',
    profileBg: 'soft',
    darkMode: false,
    notifSettings: { moments: true, friends: true, streaks: true },
    privacy: { friendsOnly: true, showActivity: true },
    createdAt: new Date().toISOString(),
  }
  setUsers([...all, user])
  save('sessionUserId', user.id)
  return publicUser(user)
}

export async function forgotPassword({ email }) {
  await delay(300)
  const u = users().find((x) => x.email?.toLowerCase() === email?.toLowerCase())
  if (!u) throw new Error('Không tìm thấy email này.')
  return { ok: true, message: `Nếu email tồn tại, hướng dẫn đặt lại đã được gửi tới ${email}.` }
}

export async function fetchCurrentUser() {
  await delay(80)
  const id = getSessionUserId()
  if (!id) return null
  const u = users().find((x) => x.id === id)
  if (!u) {
    save('sessionUserId', null)
    return null
  }
  return publicUser(u)
}

export async function logoutUser() {
  save('sessionUserId', null)
  return { ok: true }
}

export async function updateProfile(patch) {
  await delay(200)
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
  await delay(150)
  const me = getSessionUserId()
  if (!me) return []
  const friendIds = new Set(friends().map((f) => f.userId))
  friendIds.add(me)
  const list = posts()
    .filter((p) => friendIds.has(p.userId))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  const allUsers = users()
  const hydrated = await hydratePosts(list)
  return hydrated.map((p) => ({
    ...p,
    user: publicUser(allUsers.find((u) => u.id === p.userId)),
  }))
}

export async function uploadMoment({ mediaUrl, caption, type = 'image', durationSec, visibility }) {
  await delay(400)
  const me = getSessionUserId()
  if (!me) throw new Error('Chưa đăng nhập.')
  if (!mediaUrl) throw new Error('Thiếu media.')
  const user = users().find((u) => u.id === me)
  if (type === 'video') {
    const max = GOLD_VIDEO_MAX_SEC
    if (durationSec && durationSec > max) {
      throw new Error(`Video tối đa ${max}s.`)
    }
  }

  let toStore = mediaUrl
  if (type === 'image' && typeof mediaUrl === 'string' && mediaUrl.startsWith('data:image')) {
    toStore = await compressImageDataUrl(mediaUrl, 1080, 0.8)
  }

  const mediaId = uid('m')
  const stored = await putMedia(mediaId, toStore, type === 'video' ? 'video/webm' : 'image/jpeg')

  const post = {
    id: uid('p'),
    userId: me,
    type: type === 'video' ? 'video' : 'image',
    mediaId: stored.external ? null : mediaId,
    mediaUrl: stored.external ? stored.url : mediaId, // resolve via hydrate
    caption: caption || '',
    createdAt: new Date().toISOString(),
    privacy: visibility || 'friends',
    reactions: {},
    seenBy: [me],
    durationSec: durationSec || null,
  }

  // Don't put huge data URLs into localStorage
  const metaPost = { ...post }
  if (!stored.external) {
    metaPost.mediaUrl = mediaId
  }

  try {
    setPosts([metaPost, ...posts()])
  } catch (e) {
    throw new Error('Không lưu được moment (bộ nhớ đầy). Xóa bớt moment cũ.')
  }

  const st = streaks().map((s) => ({
    ...s,
    count: (s.count || 0) + 1,
    lastPostAt: new Date().toISOString(),
    broken: false,
  }))
  setStreaks(st)

  return {
    ...post,
    mediaUrl: stored.url,
    user: publicUser(user),
  }
}

export async function uploadVideoMoment(payload) {
  return uploadMoment({ ...payload, type: 'video' })
}

export async function deleteMoment(postId) {
  await delay(150)
  const me = getSessionUserId()
  const p = posts().find((x) => x.id === postId)
  if (!p || p.userId !== me) throw new Error('Không thể xóa moment này.')
  if (p.mediaId) await deleteMedia(p.mediaId)
  else if (p.mediaUrl && !String(p.mediaUrl).startsWith('http')) await deleteMedia(p.mediaUrl)
  setPosts(posts().filter((x) => x.id !== postId))
  return { ok: true }
}

export async function reactToMoment(postId, emoji) {
  await delay(100)
  const me = getSessionUserId()
  if (!me) throw new Error('Chưa đăng nhập.')
  const all = posts()
  const i = all.findIndex((p) => p.id === postId)
  if (i < 0) throw new Error('Không tìm thấy moment.')
  const reactions = { ...(all[i].reactions || {}) }
  Object.keys(reactions).forEach((k) => {
    reactions[k] = (reactions[k] || []).filter((id) => id !== me)
    if (!reactions[k].length) delete reactions[k]
  })
  reactions[emoji] = [...(reactions[emoji] || []), me]
  all[i] = { ...all[i], reactions }
  const seen = new Set(all[i].seenBy || [])
  seen.add(me)
  all[i].seenBy = [...seen]
  setPosts(all)
  const hydrated = await hydratePost(all[i])
  return hydrated
}

export async function markSeen(postId) {
  const me = getSessionUserId()
  if (!me) return null
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
  await delay(100)
  const allUsers = users()
  return friends()
    .map((f) => ({
      ...f,
      user: publicUser(allUsers.find((u) => u.id === f.userId)),
    }))
    .filter((f) => f.user)
}

export async function searchUsers(q) {
  await delay(150)
  const me = getSessionUserId()
  const friendIds = new Set(friends().map((f) => f.userId))
  const qq = (q || '').toLowerCase().trim()
  if (!qq) return []
  return users()
    .filter(
      (u) =>
        u.id !== me &&
        (u.username?.includes(qq) || u.displayName?.toLowerCase().includes(qq) || u.email?.toLowerCase().includes(qq)),
    )
    .slice(0, 20)
    .map((u) => ({
      ...publicUser(u),
      isFriend: friendIds.has(u.id),
    }))
}

export async function addFriend(username) {
  await delay(250)
  const me = getSessionUserId()
  if (!me) throw new Error('Chưa đăng nhập.')
  const name = (username || '').replace(/^@/, '').trim().toLowerCase()
  if (!name) throw new Error('Nhập username.')
  const target = users().find((u) => u.username.toLowerCase() === name)
  if (!target) {
    throw new Error(
      'Không tìm thấy username này. Người đó cần đăng ký trên cùng thiết bị/trình duyệt (chế độ local).',
    )
  }
  if (target.id === me) throw new Error('Không thể kết bạn với chính mình.')
  if (friends().some((f) => f.userId === target.id)) throw new Error('Đã là bạn bè.')

  const reqs = requests()
  const reverse = reqs.find((r) => r.fromUserId === target.id && r.toUserId === me && r.status === 'pending')
  if (reverse) return acceptFriendRequest(reverse.id)

  const req = {
    id: uid('fr'),
    fromUserId: me,
    toUserId: target.id,
    createdAt: new Date().toISOString(),
    status: 'pending',
  }
  setRequests([req, ...reqs])
  // Instant friend in local mode
  setFriends([
    ...friends(),
    { userId: target.id, since: new Date().toISOString(), close: false, streak: 0, lastActive: new Date().toISOString() },
  ])
  if (!streaks().some((s) => s.friendId === target.id)) {
    setStreaks([...streaks(), { friendId: target.id, count: 0, lastPostAt: null, history: [0, 0, 0, 0, 0, 0, 0], broken: false }])
  }
  setNotifications([
    {
      id: uid('n'),
      type: 'friends',
      title: 'Kết bạn',
      body: `Đã kết bạn với @${target.username}`,
      read: false,
      createdAt: new Date().toISOString(),
    },
    ...notifications(),
  ])
  return { ok: true, message: `Đã kết bạn với @${target.username}` }
}

export async function fetchFriendRequests() {
  await delay(100)
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
  await delay(150)
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
    setStreaks([...streaks(), { friendId: r.fromUserId, count: 0, lastPostAt: null, history: [0, 0, 0, 0, 0, 0, 0], broken: false }])
  }
  return { ok: true }
}

export async function declineFriendRequest(requestId) {
  await delay(100)
  setRequests(requests().map((r) => (r.id === requestId ? { ...r, status: 'declined' } : r)))
  return { ok: true }
}

export async function removeFriend(userId) {
  await delay(150)
  setFriends(friends().filter((f) => f.userId !== userId))
  setStreaks(streaks().filter((s) => s.friendId !== userId))
  return { ok: true }
}

export async function blockUser(userId) {
  await delay(150)
  await removeFriend(userId)
  const blocked = load('blocked', []) || []
  if (!blocked.includes(userId)) save('blocked', [...blocked, userId])
  return { ok: true }
}

export async function fetchNotifications() {
  await delay(80)
  const me = getSessionUserId()
  if (!me) return []
  return (notifications() || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

export async function markNotificationAsRead(id) {
  await delay(50)
  setNotifications(
    notifications().map((n) => (n.id === id || id === 'all' ? { ...n, read: true } : n)),
  )
  return { ok: true }
}

export async function fetchGallery(filter = 'all') {
  await delay(120)
  const me = getSessionUserId()
  if (!me) return []
  const allUsers = users()
  const friendIds = new Set(friends().map((f) => f.userId))
  friendIds.add(me)
  let list = posts().filter((p) => friendIds.has(p.userId))
  if (filter === 'mine') list = list.filter((p) => p.userId === me)
  if (filter === 'friends') list = list.filter((p) => p.userId !== me)
  list = list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  const hydrated = await hydratePosts(list)
  return hydrated.map((p) => ({
    ...p,
    user: publicUser(allUsers.find((u) => u.id === p.userId)),
  }))
}

export async function fetchStreaks() {
  await delay(100)
  const allUsers = users()
  return streaks().map((s) => ({
    ...s,
    user: publicUser(allUsers.find((u) => u.id === s.friendId)),
  })).filter((s) => s.user)
}

export async function restoreStreak(friendId) {
  await delay(300)
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
  await delay(50)
  const u = await fetchCurrentUser()
  return {
    isGold: true,
    plan: 'full',
    goldSince: u?.goldSince || null,
    adFree: true,
    friendLimit: null,
    friendCount: friends().length,
    videoMaxSec: GOLD_VIDEO_MAX_SEC,
  }
}

export async function upgradeToGold({ plan = 'monthly' } = {}) {
  await delay(200)
  return updateProfile({ isGold: true, adFree: true, plan, goldSince: new Date().toISOString() })
}

export async function cancelGoldSubscription() {
  await delay(200)
  return updateProfile({ isGold: true, adFree: true, plan: 'full' })
}

export async function restoreGoldPurchase() {
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
  ;['seeded_v4', 'users', 'posts', 'friends', 'requests', 'notifications', 'streaks', 'sessionUserId', 'blocked', 'messages', 'theme'].forEach(
    (k) => {
      try {
        localStorage.removeItem(PREFIX + k)
        remove(k)
      } catch { /* ignore */ }
    },
  )
  ensureSeed()
  return { ok: true }
}

export async function fetchLocketConnectionStatus() {
  return {
    status: 'unavailable',
    available: false,
    officialAvailable: false,
    mode: 'export_only',
    message: 'Official Locket sync unavailable — use export download/share.',
  }
}

export async function connectLocketAccount() {
  return { ok: false, status: 'unavailable', error: 'No official Locket API.' }
}

export async function disconnectLocketAccount() {
  return { ok: true, status: 'disconnected' }
}

export async function syncWithLocketOfficialAPI() {
  return { ok: false, status: 'skipped_unavailable', message: 'Use manual export.' }
}

export async function syncMomentToOfficialLocket() {
  return syncWithLocketOfficialAPI()
}

export async function logLocketExport() {
  return { ok: true }
}

export async function verifyEmail() {
  return { ok: true }
}

export async function resetPassword() {
  return { ok: true, message: 'Local mode: đặt lại mật khẩu qua đăng ký mới nếu quên.' }
}

/** Local chat */
export async function fetchConversations() {
  await delay(100)
  const me = getSessionUserId()
  if (!me) return []
  const allUsers = users()
  const msgs = messages()
  const byPeer = new Map()
  msgs.forEach((m) => {
    const peer = m.fromId === me ? m.toId : m.fromId
    if (m.fromId !== me && m.toId !== me) return
    const prev = byPeer.get(peer)
    if (!prev || new Date(m.createdAt) > new Date(prev.createdAt)) byPeer.set(peer, m)
  })
  // Include friends with no messages yet
  friends().forEach((f) => {
    if (!byPeer.has(f.userId)) {
      byPeer.set(f.userId, { createdAt: f.since, body: '', fromId: me, toId: f.userId })
    }
  })
  return [...byPeer.entries()]
    .map(([peerId, last]) => ({
      peerId,
      user: publicUser(allUsers.find((u) => u.id === peerId)),
      lastMessage: last.body || '',
      lastAt: last.createdAt,
    }))
    .filter((c) => c.user)
    .sort((a, b) => new Date(b.lastAt || 0) - new Date(a.lastAt || 0))
}

export async function fetchMessages(peerId) {
  await delay(80)
  const me = getSessionUserId()
  return messages()
    .filter(
      (m) =>
        (m.fromId === me && m.toId === peerId) || (m.fromId === peerId && m.toId === me),
    )
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
}

export async function sendMessage(peerId, body) {
  await delay(100)
  const me = getSessionUserId()
  if (!me) throw new Error('Chưa đăng nhập.')
  if (!body?.trim()) throw new Error('Tin nhắn trống.')
  const msg = {
    id: uid('msg'),
    fromId: me,
    toId: peerId,
    body: body.trim(),
    createdAt: new Date().toISOString(),
  }
  setMessages([...messages(), msg])
  return msg
}

export function getFriendLimitInfo() {
  return { count: friends().length, limit: null, unlimited: true }
}
