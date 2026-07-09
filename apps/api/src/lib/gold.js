/**
 * All camera / friends / video features unlocked for every user.
 * "Gold" UI remaining is cosmetic only — not a paywall.
 */
import { config } from '../config.js'

export function userIsGold(_user) {
  return true
}

export function requireGold(_user, _feature = 'feature') {
  // no-op — full access
}

export function friendLimit(_user) {
  return null // unlimited
}

export function videoMaxSec(_user) {
  // High cap so client is not blocked (was 10–60s on free plans)
  return config.goldVideoMaxSec || 300
}

export function maxUploadBytes(_user) {
  const mb = config.goldMaxUploadMb || 200
  return mb * 1024 * 1024
}

export function canUseCameraRoll(_user) {
  return true
}
