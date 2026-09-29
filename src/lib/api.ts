import {
  clearAuthSession,
  clearLegacyRefreshToken,
  getAuthSessionSnapshot,
  getStoredAccessToken,
  isAccessTokenExpiring,
  peekLegacyRefreshToken,
  replaceAuthSession,
  type AuthSessionPayload,
} from './session'

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')

export type RequestAuth = 'none' | 'bearer'
export type AuthErrorMode = 'session' | 'request' | 'access-token'

export type ApiRequestInit = RequestInit & {
  auth?: RequestAuth
  /**
   * `session`은 만료된 access token을 refresh하고, 최종 401에서 세션을 폐기한다.
   * `request`는 현재 비밀번호 불일치처럼 인증된 요청 자체가 401을 사용할 때
   * 응답을 일반 API 오류로 전달한다.
   * `access-token`은 백엔드가 명시적인 access token 오류를 응답한 401에서만
   * refresh 후 한 번 재시도하고, 요청 자체의 인증 오류는 세션을 유지한다.
   */
  authErrorMode?: AuthErrorMode
}

export class ApiError extends Error {
  status: number
  data: unknown
  retryAfterSeconds: number | null

  constructor(
    status: number,
    message: string,
    data: unknown,
    retryAfterSeconds: number | null = null,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
    this.retryAfterSeconds = retryAfterSeconds
  }
}

function hasKorean(value: string) {
  return /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(value)
}

function normalizeMessage(value: string) {
  return value.trim().toLowerCase()
}

export function isNetworkRequestError(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }

  const normalized = normalizeMessage(error.message)
  return (
    normalized.includes('failed to fetch') ||
    normalized.includes('networkerror') ||
    normalized.includes('network error') ||
    normalized.includes('load failed')
  )
}

function getStatusFallback(status: number, fallback: string) {
  if (status === 400) {
    return '요청 내용을 확인해 주세요.'
  }

  if (status === 401) {
    return '로그인이 필요하거나 인증 정보가 올바르지 않습니다.'
  }

  if (status === 403) {
    return '접근 권한이 없습니다.'
  }

  if (status === 404) {
    return '요청한 정보를 찾을 수 없습니다.'
  }

  if (status === 409) {
    return '이미 처리된 정보이거나 중복된 요청입니다.'
  }

  if (status === 422) {
    return '입력한 정보를 다시 확인해 주세요.'
  }

  if (status === 429) {
    return '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.'
  }

  if (status >= 500) {
    return '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
  }

  return fallback
}

export function getKoreanErrorMessage(error: unknown, fallback = '요청 처리에 실패했습니다.') {
  if (!(error instanceof Error)) {
    return fallback
  }

  const message = error.message.trim()

  if (message && hasKorean(message)) {
    return message
  }

  const normalized = normalizeMessage(message)

  if (error instanceof ApiError && error.status === 429) {
    return error.retryAfterSeconds
      ? `${error.retryAfterSeconds}초 후 다시 시도해 주세요.`
      : getStatusFallback(error.status, fallback)
  }

  if (isNetworkRequestError(error)) {
    return '서비스에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.'
  }

  if (normalized.includes('aborted') || normalized.includes('aborterror')) {
    return '요청이 취소되었습니다.'
  }

  if (
    normalized.includes('sms challenge expired') ||
    normalized.includes('challenge expired') ||
    normalized.includes('challenge expired or not found') ||
    (normalized.includes('sms challenge') && normalized.includes('not found'))
  ) {
    return '인증번호가 만료되었거나 인증 요청 정보를 찾을 수 없습니다. 인증번호를 다시 받아주세요.'
  }

  if (
    normalized.includes('verification token expired') ||
    normalized.includes('sms verification token expired') ||
    normalized.includes('verification token') && normalized.includes('not found')
  ) {
    return '인증 확인 정보가 만료되었습니다. 인증번호 확인을 다시 진행해 주세요.'
  }

  if (
    normalized.includes('invalid sms code') ||
    normalized.includes('invalid verification code') ||
    normalized.includes('invalid sms verification code')
  ) {
    return '인증번호가 올바르지 않습니다.'
  }

  if (normalized.includes('sms verification attempts exceeded')) {
    return '인증번호 입력 횟수를 초과했습니다. 인증번호를 다시 받아주세요.'
  }

  if (
    normalized.includes('invalid credentials') ||
    normalized.includes('invalid login credentials') ||
    normalized.includes('incorrect username or password')
  ) {
    return '아이디 또는 비밀번호가 올바르지 않습니다.'
  }

  if (
    normalized.includes('signup request is already in progress') ||
    normalized.includes('verification token is already in use')
  ) {
    return '회원가입 요청을 처리하고 있습니다. 잠시 후 다시 시도해 주세요.'
  }

  if (normalized.includes('field required') || normalized.includes('required field') || normalized === 'required') {
    return '필수 입력값을 확인해 주세요.'
  }

  if (normalized.includes('not found')) {
    return '요청한 정보를 찾을 수 없습니다.'
  }

  if (normalized.includes('already exists') || normalized.includes('duplicate')) {
    return '이미 사용 중인 정보입니다.'
  }

  if (normalized.includes('invalid') || normalized.includes('not valid')) {
    return '입력한 정보를 다시 확인해 주세요.'
  }

  if (error instanceof ApiError) {
    return getStatusFallback(error.status, fallback)
  }

  return fallback
}

export function getApiUrl(path = '') {
  if (!path) {
    return API_BASE_URL
  }

  if (/^https?:\/\//i.test(path)) {
    return path
  }

  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

/** 빈 검색값은 생략하고 배열은 같은 키를 반복하는 API 쿼리로 직렬화한다. */
export function withQuery(path: string, params: object) {
  const query = new URLSearchParams()

  function appendValue(key: string, value: unknown) {
    if (value === undefined || value === null || value === '') return
    if (Array.isArray(value)) {
      value.forEach((item) => appendValue(key, item))
      return
    }
    query.append(key, String(value))
  }

  Object.entries(params).forEach(([key, value]) => appendValue(key, value))
  const suffix = query.toString()
  return suffix ? `${path}?${suffix}` : path
}

export function apiFetch(
  path: string,
  init?: RequestInit,
) {
  return fetch(getApiUrl(path), {
    ...init,
    credentials: init?.credentials ?? 'include',
  })
}

function getResponseMessage(data: unknown, fallback: string) {
  if (typeof data === 'object' && data !== null && 'detail' in data) {
    const detail = (data as { detail: unknown }).detail

    if (typeof detail === 'string') {
      return detail
    }

    if (Array.isArray(detail) && detail.length > 0) {
      const firstError = detail[0] as { msg?: unknown }
      if (typeof firstError.msg === 'string') {
        return firstError.msg
      }
    }
  }

  return fallback
}

function parseResponseBody(text: string) {
  if (!text) {
    return null
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

const REFRESHABLE_ACCESS_TOKEN_ERROR_DETAILS = new Set([
  'jwt token expired.',
  'invalid jwt token.',
  'invalid jwt token subject.',
])

function isAccessTokenError(data: unknown) {
  if (typeof data !== 'object' || data === null || !('detail' in data)) {
    return false
  }

  const detail = (data as { detail: unknown }).detail
  return (
    typeof detail === 'string' &&
    REFRESHABLE_ACCESS_TOKEN_ERROR_DETAILS.has(normalizeMessage(detail))
  )
}

const REFRESH_REQUEST_TIMEOUT_MILLISECONDS = 7_000
const SESSION_INITIALIZATION_TIMEOUT_MILLISECONDS = 2_500

type RefreshRequestPolicy = {
  retryTransientFailure: boolean
  timeoutMilliseconds: number
}

type RefreshExecution = {
  cancelled: boolean
  controller: AbortController | null
}

let refreshRequest: Promise<void> | null = null
let activeRefreshExecution: RefreshExecution | null = null

function requestRefreshedSession(
  policy: RefreshRequestPolicy,
  execution: RefreshExecution,
) {
  const legacyRefreshToken = peekLegacyRefreshToken()
  const attempt = () => {
    const controller = new AbortController()
    execution.controller = controller
    const timeout = setTimeout(
      () => controller.abort(),
      policy.timeoutMilliseconds,
    )

    return apiRequest<AuthSessionPayload>('/api/v1/refresh', {
      method: 'POST',
      signal: controller.signal,
      body: legacyRefreshToken
        ? JSON.stringify({ refresh_token: legacyRefreshToken })
        : undefined,
    }).finally(() => {
      clearTimeout(timeout)
      if (execution.controller === controller) {
        execution.controller = null
      }
    })
  }

  return attempt().catch((error: unknown) => {
    if (
      policy.retryTransientFailure &&
      !execution.cancelled &&
      (!(error instanceof ApiError) || error.status >= 500)
    ) {
      return attempt()
    }
    throw error
  })
}

function runAuthSessionRefresh(policy: RefreshRequestPolicy) {
  if (refreshRequest) {
    return refreshRequest
  }

  const sessionAtRequestStart = getAuthSessionSnapshot()
  const execution: RefreshExecution = {
    cancelled: false,
    controller: null,
  }
  activeRefreshExecution = execution

  const request = requestRefreshedSession(policy, execution)
    .then((response) => {
      if (getAuthSessionSnapshot() !== sessionAtRequestStart) {
        return
      }
      clearLegacyRefreshToken()
      replaceAuthSession(response)
    })
    .catch((error: unknown) => {
      if (
        getAuthSessionSnapshot() === sessionAtRequestStart &&
        error instanceof ApiError &&
        [400, 401, 422].includes(error.status)
      ) {
        clearAuthSession()
      }
      throw error
    })
    .finally(() => {
      if (activeRefreshExecution === execution) {
        activeRefreshExecution = null
      }
      if (refreshRequest === request) {
        refreshRequest = null
      }
    })

  refreshRequest = request
  return request
}

export function cancelAuthSessionRefresh() {
  if (!activeRefreshExecution) {
    return
  }
  activeRefreshExecution.cancelled = true
  activeRefreshExecution.controller?.abort()
}

export function refreshAuthSession() {
  return runAuthSessionRefresh({
    retryTransientFailure: true,
    timeoutMilliseconds: REFRESH_REQUEST_TIMEOUT_MILLISECONDS,
  })
}

export function initializeAuthSession() {
  return runAuthSessionRefresh({
    retryTransientFailure: false,
    timeoutMilliseconds: SESSION_INITIALIZATION_TIMEOUT_MILLISECONDS,
  })
}

async function resolveBearerToken() {
  if (!getStoredAccessToken() || isAccessTokenExpiring()) {
    await refreshAuthSession()
  }

  const accessToken = getStoredAccessToken()
  if (!accessToken) {
    throw new ApiError(401, '로그인이 필요합니다.', null)
  }
  return accessToken
}

async function performApiRequest<T>(
  path: string,
  init: ApiRequestInit | undefined,
  canRetryAuth: boolean,
): Promise<T> {
  const {
    auth = 'none',
    authErrorMode = 'session',
    ...requestInit
  } = init ?? {}
  if (auth === 'bearer' && /^https?:\/\//i.test(path)) {
    throw new Error('인증 요청 경로는 설정된 API의 상대 경로여야 합니다.')
  }
  const headers = new Headers(requestInit.headers)
  const hasBody = requestInit.body !== undefined

  if (hasBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json')
  }

  if (auth === 'bearer' && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${await resolveBearerToken()}`)
  }

  const response = await apiFetch(path, {
    ...requestInit,
    headers,
  })

  const text = await response.text()
  const data = parseResponseBody(text)

  const shouldHandleSessionAuthError = authErrorMode === 'session'
  const shouldHandleAccessTokenError = (
    authErrorMode === 'access-token' && isAccessTokenError(data)
  )

  if (
    response.status === 401 &&
    auth === 'bearer' &&
    (shouldHandleSessionAuthError || shouldHandleAccessTokenError) &&
    canRetryAuth
  ) {
    await refreshAuthSession()
    return performApiRequest<T>(path, init, false)
  }

  if (!response.ok) {
    if (
      response.status === 401 &&
      auth === 'bearer' &&
      (shouldHandleSessionAuthError || shouldHandleAccessTokenError)
    ) {
      clearAuthSession()
    }
    const retryAfterHeader = response.headers.get('Retry-After')
    const retryAfterSeconds = retryAfterHeader && /^\d+$/.test(retryAfterHeader)
      ? Number(retryAfterHeader)
      : null
    throw new ApiError(
      response.status,
      getResponseMessage(data, '요청 처리에 실패했습니다.'),
      data,
      retryAfterSeconds,
    )
  }

  return data as T
}

export function apiRequest<T>(path: string, init?: ApiRequestInit): Promise<T> {
  return performApiRequest(path, init, true)
}
