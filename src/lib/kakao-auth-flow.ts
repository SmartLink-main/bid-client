import { ApiError } from './api'

function normalizeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message.trim().toLowerCase() : ''
}

export function getUnavailableKakaoTicketMessage(error: unknown) {
  if (!(error instanceof ApiError)) {
    return null
  }

  const message = normalizeErrorMessage(error)
  if (
    message.includes('kakao login ticket expired') ||
    message.includes('kakao login ticket is invalid')
  ) {
    return '카카오 로그인 정보가 만료되었습니다. 카카오 로그인을 다시 시작해 주세요.'
  }
  if (message.includes('kakao ticket browser mismatch')) {
    return '카카오 로그인을 시작한 브라우저 정보를 확인할 수 없습니다. 카카오 로그인을 다시 시작해 주세요.'
  }

  return null
}

export function isUnavailableSmsChallenge(error: unknown) {
  if (!(error instanceof ApiError)) {
    return false
  }

  const message = normalizeErrorMessage(error)
  return (
    message.includes('challenge expired') ||
    (message.includes('sms challenge') && message.includes('not found')) ||
    message.includes('verification attempts exceeded')
  )
}

export function isKakaoAccountLinkRequiredError(error: unknown) {
  if (!(error instanceof ApiError) || error.status !== 409) {
    return false
  }

  const message = normalizeErrorMessage(error)
  return (
    message.includes('account link required') ||
    message.includes('account linking is required') ||
    message.includes('phone number is already registered')
  )
}

export function getKakaoAccountLinkFailureMessage(error: unknown) {
  if (
    error instanceof ApiError &&
    [401, 403, 409, 422].includes(error.status)
  ) {
    return '기존 계정 인증에 실패했습니다. 입력한 정보 또는 인증번호를 다시 확인해 주세요.'
  }

  return null
}
