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
  return config.goldVideoMaxSec || 60
}

export function maxUploadBytes(_user) {
  const mb = config.goldMaxUploadMb || 50
  return mb * 1024 * 1024
}

export function canUseCameraRoll(_user) {
  return true
}
