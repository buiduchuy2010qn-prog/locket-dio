/**
 * Real backend API client for Locket Dio production server.
 */
import { http, setAuthToken, getAuthToken } from './http.js'

export async function loginUser({ email, password }) {
  const data = await http('/api/auth/login', { method: 'POST', body: { email, password } })
  if (data.token) setAuthToken(data.token)
  return data.user
}

export async function signUpUser({ email, password, displayName, username }) {
  const data = await http('/api/auth/signup', {
    method: 'POST',
    body: { email, password, displayName, username },
  })
  if (data.token) setAuthToken(data.token)
  return data.user
}

export async function logoutUser() {
  try {
    await http('/api/auth/logout', { method: 'POST', body: {} })
  } finally {
    setAuthToken(null)
  }
  return { ok: true }
}

export async function fetchCurrentUser() {
  if (!getAuthToken()) {
    try {
      const data = await http('/api/auth/me')
      return data.user
    } catch {
      return null
    }
  }
  try {
    const data = await http('/api/auth/me')
    return data.user
  } catch {
    setAuthToken(null)
    return null
  }
}

export async function forgotPassword({ email }) {
  return http('/api/auth/forgot-password', { method: 'POST', body: { email } })
}

export async function resetPassword({ token, password }) {
  return http('/api/auth/reset-password', { method: 'POST', body: { token, password } })
}

export async function verifyEmail({ token }) {
  return http('/api/auth/verify-email', { method: 'POST', body: { token } })
}

export async function updateProfile(patch) {
  const data = await http('/api/users/me', { method: 'PATCH', body: patch })
  return data.user
}

export async function fetchFeed(params = {}) {
  const q = new URLSearchParams(params).toString()
  const data = await http(`/api/moments/feed${q ? `?${q}` : ''}`)
  return data.moments || []
}

export async function fetchGallery(filter = 'all') {
  const data = await http(`/api/moments/gallery?filter=${encodeURIComponent(filter)}`)
  return data.moments || []
}

export async function uploadMoment({
  file,
  mediaUrl,
  caption,
  source = 'camera',
  durationSec,
  visibility,
  type,
  syncOfficial = false,
}) {
  // Prefer already-cropped data URL (square 1:1 from client)
  if (mediaUrl && !file) {
    const data = await http('/api/moments', {
      method: 'POST',
      body: {
        mediaBase64: mediaUrl,
        caption,
        source,
        durationSec,
        visibility,
        type,
        syncOfficial,
      },
    })
    return { ...data.moment, officialSync: data.officialSync }
  }
  const fd = new FormData()
  if (file) fd.append('file', file)
  if (caption) fd.append('caption', caption)
  fd.append('source', source)
  if (durationSec != null) fd.append('durationSec', String(durationSec))
  if (visibility) fd.append('visibility', visibility)
  if (syncOfficial) fd.append('syncOfficial', 'true')
  const data = await http('/api/moments', { method: 'POST', body: fd, headers: {} })
  return { ...data.moment, officialSync: data.officialSync }
}

export async function deleteMoment(id) {
  return http(`/api/moments/${id}`, { method: 'DELETE' })
}

export async function reactToMoment(id, emoji) {
  const data = await http(`/api/moments/${id}/react`, { method: 'POST', body: { emoji } })
  return data.moment
}

export async function markSeen(id) {
  return http(`/api/moments/${id}/seen`, { method: 'POST', body: {} })
}

export async function fetchInsights(id) {
  return http(`/api/moments/${id}/insights`)
}

export async function fetchFriends() {
  const data = await http('/api/friends')
  return data.friends || []
}

export async function searchUsers(q) {
  const data = await http(`/api/users/search?q=${encodeURIComponent(q)}`)
  return data.users || []
}

export async function addFriend(username) {
  return http('/api/friends/request', { method: 'POST', body: { username } })
}

export async function fetchFriendRequests() {
  const data = await http('/api/friends/requests')
  return data.requests || []
}

export async function acceptFriendRequest(id) {
  return http(`/api/friends/requests/${id}/accept`, { method: 'POST', body: {} })
}

export async function declineFriendRequest(id) {
  return http(`/api/friends/requests/${id}/decline`, { method: 'POST', body: {} })
}

export async function removeFriend(id) {
  return http(`/api/friends/${id}`, { method: 'DELETE' })
}

export async function blockUser(id) {
  return http(`/api/friends/${id}/block`, { method: 'POST', body: {} })
}

export async function fetchNotifications() {
  const data = await http('/api/notifications')
  return data.notifications || []
}

export async function markNotificationAsRead(id = 'all') {
  return http('/api/notifications/read', { method: 'POST', body: { id } })
}

export async function fetchStreaks() {
  const data = await http('/api/streaks')
  return data.streaks || []
}

export async function restoreStreak(friendId) {
  return http(`/api/streaks/${friendId}/restore`, { method: 'POST', body: {} })
}

export async function fetchGoldStatus() {
  return http('/api/gold/status')
}

export async function upgradeToGold({ plan = 'monthly' } = {}) {
  const data = await http('/api/gold/activate', { method: 'POST', body: { plan } })
  return data.user
}

export async function cancelGoldSubscription() {
  const data = await http('/api/gold/cancel', { method: 'POST', body: {} })
  return data.user
}

export async function restoreGoldPurchase() {
  return upgradeToGold({ plan: 'yearly' })
}

export async function updateGoldCustomization(patch) {
  const data = await http('/api/gold/customization', { method: 'PATCH', body: patch })
  return data.user
}

export async function updateGoldBadge(style) {
  return updateGoldCustomization({ badgeId: style })
}

export async function updateCameraTheme(theme) {
  return updateGoldCustomization({ cameraThemeId: theme })
}

export async function updateAppIcon(icon) {
  return updateGoldCustomization({ appIconId: icon })
}

export async function updateProfileTheme({ profileFrame, profileBg }) {
  return updateGoldCustomization({ profileFrame, profileBg })
}

export async function fetchLocketConnectionStatus() {
  return http('/api/locket/status')
}

export async function connectLocketAccount(payload = {}) {
  return http('/api/locket/connect', { method: 'POST', body: payload })
}

export async function disconnectLocketAccount() {
  return http('/api/locket/disconnect', { method: 'POST', body: {} })
}

export async function syncWithLocketOfficialAPI() {
  return http('/api/locket/sync', { method: 'POST', body: {} })
}

export async function syncMomentToOfficialLocket(momentId) {
  return http('/api/locket/sync', { method: 'POST', body: { momentId } })
}

export async function logLocketExport({ momentId, action, meta }) {
  return http('/api/locket/export-log', { method: 'POST', body: { momentId, action, meta } })
}

export async function fetchServerStatus() {
  return http('/api/status')
}

export async function fetchConversations() {
  const data = await http('/api/messages/conversations')
  return data.conversations || []
}

export async function fetchMessages(peerId) {
  const data = await http(`/api/messages?peerId=${encodeURIComponent(peerId)}`)
  return data.messages || []
}

export async function sendMessage(peerId, body) {
  const data = await http('/api/messages', { method: 'POST', body: { peerId, body } })
  return data.message || data
}
