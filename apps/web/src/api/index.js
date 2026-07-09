/**
 * API facade: production API when healthy, local mock fallback for offline UI.
 */
import { checkApiHealth, shouldUseRealApiConfig } from '../services/http.js'
import * as real from '../services/realApi.js'
import * as mock from './mockApi.js'

let mode = null // 'real' | 'mock'

export async function resolveApiMode() {
  if (mode) return mode
  if (!shouldUseRealApiConfig()) {
    mode = 'mock'
    console.info('[Locket Dio] Forced local mode')
    return mode
  }
  const ok = await checkApiHealth()
  mode = ok ? 'real' : 'mock'
  if (mode === 'mock') {
    console.warn('[Locket Dio] API offline — local storage mode (full UI still works)')
  } else {
    console.info('[Locket Dio] Connected to Locket Dio API')
  }
  return mode
}

export function getApiMode() {
  return mode
}

export function forceMockMode() {
  mode = 'mock'
}

async function call(name, ...args) {
  await resolveApiMode()
  const impl = mode === 'real' ? real : mock
  if (typeof impl[name] !== 'function') {
    if (mode === 'real' && typeof mock[name] === 'function') return mock[name](...args)
    throw new Error(`API method missing: ${name}`)
  }
  try {
    return await impl[name](...args)
  } catch (e) {
    const isNet =
      e?.name === 'TypeError' ||
      e?.name === 'AbortError' ||
      /fetch|network|Failed to fetch|API URL/i.test(String(e?.message || ''))
    if (mode === 'real' && isNet && typeof mock[name] === 'function') {
      console.warn(`[Locket Dio] ${name} network fail → mock`, e.message)
      mode = 'mock'
      return mock[name](...args)
    }
    throw e
  }
}

export const loginUser = (...a) => call('loginUser', ...a)
export const signUpUser = (...a) => call('signUpUser', ...a)
export const logoutUser = (...a) => call('logoutUser', ...a)
export const fetchCurrentUser = (...a) => call('fetchCurrentUser', ...a)
export const forgotPassword = (...a) => call('forgotPassword', ...a)
export const verifyEmail = (...a) => call('verifyEmail', ...a)
export const resetPassword = (...a) => call('resetPassword', ...a)
export const updateProfile = (...a) => call('updateProfile', ...a)
export const fetchFeed = (...a) => call('fetchFeed', ...a)
export const fetchGallery = (...a) => call('fetchGallery', ...a)
export const uploadMoment = (...a) => call('uploadMoment', ...a)
export const uploadVideoMoment = (...a) => call('uploadVideoMoment', ...a)
export const deleteMoment = (...a) => call('deleteMoment', ...a)
export const reactToMoment = (...a) => call('reactToMoment', ...a)
export const markSeen = (...a) => call('markSeen', ...a)
export const fetchFriends = (...a) => call('fetchFriends', ...a)
export const searchUsers = (...a) => call('searchUsers', ...a)
export const addFriend = (...a) => call('addFriend', ...a)
export const fetchFriendRequests = (...a) => call('fetchFriendRequests', ...a)
export const acceptFriendRequest = (...a) => call('acceptFriendRequest', ...a)
export const declineFriendRequest = (...a) => call('declineFriendRequest', ...a)
export const removeFriend = (...a) => call('removeFriend', ...a)
export const blockUser = (...a) => call('blockUser', ...a)
export const fetchNotifications = (...a) => call('fetchNotifications', ...a)
export const markNotificationAsRead = (...a) => call('markNotificationAsRead', ...a)
export const fetchStreaks = (...a) => call('fetchStreaks', ...a)
export const restoreStreak = (...a) => call('restoreStreak', ...a)
export const fetchGoldStatus = (...a) => call('fetchGoldStatus', ...a)
export const upgradeToGold = (...a) => call('upgradeToGold', ...a)
export const cancelGoldSubscription = (...a) => call('cancelGoldSubscription', ...a)
export const restoreGoldPurchase = (...a) => call('restoreGoldPurchase', ...a)
export const updateGoldBadge = (...a) => call('updateGoldBadge', ...a)
export const updateCameraTheme = (...a) => call('updateCameraTheme', ...a)
export const updateAppIcon = (...a) => call('updateAppIcon', ...a)
export const updateProfileTheme = (...a) => call('updateProfileTheme', ...a)
export const fetchLocketConnectionStatus = (...a) => call('fetchLocketConnectionStatus', ...a)
export const connectLocketAccount = (...a) => call('connectLocketAccount', ...a)
export const disconnectLocketAccount = (...a) => call('disconnectLocketAccount', ...a)
export const syncWithLocketOfficialAPI = (...a) => call('syncWithLocketOfficialAPI', ...a)
export const syncMomentToOfficialLocket = (...a) => call('syncMomentToOfficialLocket', ...a)
export const logLocketExport = (...a) => call('logLocketExport', ...a)
export const resetDemoData = (...a) => call('resetDemoData', ...a)
export const fetchConversations = (...a) => call('fetchConversations', ...a)
export const fetchMessages = (...a) => call('fetchMessages', ...a)
export const sendMessage = (...a) => call('sendMessage', ...a)
