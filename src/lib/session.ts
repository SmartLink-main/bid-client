const AUTH_SESSION_KEY = 'bid_auth_session'
const LEGACY_ACCESS_TOKEN_KEY = 'bid_access_token'

export type AuthSessionPayload = {
  access_token: string
  expires_in: number
  refresh_expires_in: number
  user: object
}

export type StoredAuthSession = AuthSessionPayload & {
  access_expires_at: number
}

type SessionListener = () => void

const listeners = new Set<SessionListener>()
let currentSession: StoredAuthSession | null = null
let legacyRefreshToken: string | null = null

function isBrowser() {
  return typeof window !== 'undefined'
}

function removeItem(storage: Storage, key: string) {
  try {
    storage.removeItem(key)
  } catch {
    // Storage can be unavailable in privacy-restricted browsers.
  }
}

function purgeStoredCredentials(captureLegacyRefresh = false) {
  if (!isBrowser()) {
    return
  }

  for (const storage of [sessionStorage, localStorage]) {
    try {
      const rawSession = storage.getItem(AUTH_SESSION_KEY)
      if (captureLegacyRefresh && rawSession && legacyRefreshToken === null) {
        const parsed = JSON.parse(rawSession) as { refresh_token?: unknown }
        if (
          typeof parsed.refresh_token === 'string' &&
          parsed.refresh_token.length > 0
        ) {
          legacyRefreshToken = parsed.refresh_token
        }
      }
    } catch {
      // Invalid legacy state is discarded below.
    }
    removeItem(storage, AUTH_SESSION_KEY)
    removeItem(storage, LEGACY_ACCESS_TOKEN_KEY)
  }
}

function publishSessionChange() {
  listeners.forEach((listener) => listener())
}

function isSessionPayload(value: AuthSessionPayload) {
  return (
    typeof value.access_token === 'string' &&
    value.access_token.length > 0 &&
    typeof value.expires_in === 'number' &&
    value.expires_in > 0 &&
    typeof value.refresh_expires_in === 'number' &&
    value.refresh_expires_in > 0 &&
    typeof value.user === 'object' &&
    value.user !== null
  )
}

purgeStoredCredentials(true)

export function getAuthSessionSnapshot() {
  return currentSession
}

export function subscribeAuthSession(listener: SessionListener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function storeAuthSession(payload: AuthSessionPayload) {
  if (!isSessionPayload(payload)) {
    throw new Error('The authentication response has an invalid shape.')
  }

  currentSession = {
    ...payload,
    access_expires_at: Date.now() + payload.expires_in * 1000,
  }
  legacyRefreshToken = null
  purgeStoredCredentials()
  publishSessionChange()
}

export function replaceAuthSession(payload: AuthSessionPayload) {
  storeAuthSession(payload)
}

export function clearAuthSession() {
  currentSession = null
  legacyRefreshToken = null
  purgeStoredCredentials()
  publishSessionChange()
}

export function getStoredAccessToken() {
  return currentSession?.access_token ?? null
}

export function peekLegacyRefreshToken() {
  return legacyRefreshToken
}

export function clearLegacyRefreshToken() {
  legacyRefreshToken = null
}

export function isAccessTokenExpiring(bufferMilliseconds = 30_000) {
  return Boolean(
    currentSession &&
    currentSession.access_expires_at <= Date.now() + bufferMilliseconds,
  )
}
