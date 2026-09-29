import { describe, expect, it } from 'vitest'
import {
  KAKAO_CONSENT_RECORD_VERSION,
  LEGAL_POLICY_DOCUMENT_VERSION,
  LEGAL_POLICY_RELEASE_CHECKS,
  LEGAL_POLICIES,
  PRIVACY_PROCESSING_TABLE,
  PRIVACY_PROCESSORS,
  REQUIRED_PRIVACY_SECTION_TITLES,
  SIGNUP_COLLECTION_SUMMARY,
} from './legal-policies'

describe('legal policy registry', () => {
  it('distinguishes the document version from the Kakao-only consent record identifier', () => {
    expect(LEGAL_POLICY_DOCUMENT_VERSION).toBe('v1.0')
    expect(KAKAO_CONSENT_RECORD_VERSION).toBe('2026-08-12')
    expect(LEGAL_POLICIES.every(
      (policy) => policy.documentVersion === LEGAL_POLICY_DOCUMENT_VERSION &&
        policy.kakaoConsentRecordVersion === KAKAO_CONSENT_RECORD_VERSION,
    )).toBe(true)
  })

  it('keeps unresolved production facts visible instead of inventing them', () => {
    expect(LEGAL_POLICY_RELEASE_CHECKS).toHaveLength(4)
    expect(LEGAL_POLICY_RELEASE_CHECKS.some((item) => item.includes('비회원'))).toBe(true)
    expect(LEGAL_POLICY_RELEASE_CHECKS.some((item) => item.includes('접속로그'))).toBe(true)
    expect(LEGAL_POLICY_RELEASE_CHECKS.some((item) => item.includes('법원 공개자료'))).toBe(true)
  })

  it('describes the signup minimum, retention and refusal-relevant fields', () => {
    expect(SIGNUP_COLLECTION_SUMMARY.some((row) => row.items.includes('휴대폰 번호'))).toBe(true)
    expect(SIGNUP_COLLECTION_SUMMARY.some((row) => row.items.includes('비밀번호'))).toBe(true)
    expect(SIGNUP_COLLECTION_SUMMARY.some((row) => row.items.includes('카카오 이용자 식별값'))).toBe(true)
    expect(SIGNUP_COLLECTION_SUMMARY.some((row) => row.category === 'SMS 인증 필수·단기')).toBe(true)
    expect(SIGNUP_COLLECTION_SUMMARY.every((row) => row.retention.length > 0)).toBe(true)
  })

  it('covers the required privacy policy topics and actual processors', () => {
    expect(REQUIRED_PRIVACY_SECTION_TITLES).toHaveLength(9)
    expect(PRIVACY_PROCESSING_TABLE.some((row) => row.category === '1:1 문의 이용 시')).toBe(true)
    expect(PRIVACY_PROCESSING_TABLE.some((row) => row.category === '법원경매 공개자료의 정보주체')).toBe(true)
    expect(PRIVACY_PROCESSORS.some((row) => row.company.includes('네이버클라우드'))).toBe(true)
  })
})
