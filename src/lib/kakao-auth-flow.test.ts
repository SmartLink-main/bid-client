import { describe, expect, it } from 'vitest'
import { ApiError } from './api'
import {
  getKakaoAccountLinkFailureMessage,
  getUnavailableKakaoTicketMessage,
  isKakaoAccountLinkRequiredError,
  isUnavailableSmsChallenge,
} from './kakao-auth-flow'

describe('Kakao authentication flow errors', () => {
  it('marks an expired one-time ticket as unavailable', () => {
    expect(getUnavailableKakaoTicketMessage(
      new ApiError(400, 'Kakao login ticket expired.', null),
    )).toContain('만료')
  })

  it('marks a consumed or invalid one-time ticket as unavailable', () => {
    expect(getUnavailableKakaoTicketMessage(
      new ApiError(400, 'Kakao login ticket is invalid.', null),
    )).toContain('다시 시작')
  })

  it('marks a browser-bound ticket mismatch as unavailable', () => {
    expect(getUnavailableKakaoTicketMessage(
      new ApiError(400, 'Kakao ticket browser mismatch.', null),
    )).toContain('브라우저')
  })

  it('keeps retryable Kakao failures available', () => {
    expect(getUnavailableKakaoTicketMessage(
      new ApiError(503, 'Kakao auth is temporarily unavailable.', null),
    )).toBeNull()
  })

  it.each([
    'SMS challenge expired.',
    'SMS challenge expired or not found.',
    'SMS verification attempts exceeded.',
  ])('resets an unusable SMS challenge: %s', (message) => {
    expect(isUnavailableSmsChallenge(new ApiError(400, message, null))).toBe(true)
  })

  it.each([
    'Phone number is already registered.',
    'Kakao account link required.',
  ])('recognizes an explicit existing-account link transition: %s', (message) => {
    expect(isKakaoAccountLinkRequiredError(
      new ApiError(409, message, { detail: message }),
    )).toBe(true)
  })

  it('does not treat unrelated conflicts as the start of account linking', () => {
    expect(isKakaoAccountLinkRequiredError(
      new ApiError(409, 'Kakao identity already belongs to another account.', null),
    )).toBe(false)
  })

  it.each([401, 403, 409, 422])(
    'uses one generic message for account-link reauthentication status %s',
    (status) => {
      expect(getKakaoAccountLinkFailureMessage(
        new ApiError(status, 'Sensitive backend detail.', null),
      )).toBe('기존 계정 인증에 실패했습니다. 입력한 정보 또는 인증번호를 다시 확인해 주세요.')
    },
  )
})
