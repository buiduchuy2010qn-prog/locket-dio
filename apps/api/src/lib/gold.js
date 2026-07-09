import { isGoldActive } from '@locket-dio/shared'
import { config } from '../config.js'
import { AppError } from './errors.js'

export function userIsGold(user) {
  return isGoldActive(user?.goldSubscription)
}

export function requireGold(user, feature = 'Gold feature') {
  if (!userIsGold(user)) {
    throw new AppError(`${feature} requires Locket Dio Gold`, 403, 'GOLD_REQUIRED')
  }
}

export function friendLimit(user) {
  if (userIsGold(user)) return null
  return config.freeFriendLimit
}

export function videoMaxSec(user) {
  return userIsGold(user) ? config.goldVideoMaxSec : config.freeVideoMaxSec
}

export function maxUploadBytes(user) {
  const mb = userIsGold(user) ? config.goldMaxUploadMb : config.freeMaxUploadMb
  return mb * 1024 * 1024
}

export function canUseCameraRoll(user) {
  return userIsGold(user)
}
