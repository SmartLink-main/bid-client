import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  exchangeKakaoAuth,
  getKakaoSignupContext,
  linkKakaoAccount,
  requestKakaoAccountLinkSmsCode,
  startKakaoAccountLink,
  verifyKakaoAccountLinkSmsCode,
  type AuthResponse,
  type KakaoSignupContextResponse,
} from './auth'
import { clearAuthSession, storeAuthSession } from './session'

const signupContext: KakaoSignupContextResponse = {
  name: '홍길동',
  phone_number: '01012345678',
  phone_number_verified_by_kakao: true,
  account_link_required: false,
}

const authResponse: AuthResponse = {
  token_type: 'bearer',
  access_token: 'access-token',
  expires_in: 900,
  refresh_expires_in: 86_400,
  user: {
    id: '00000000-0000-0000-0000-000000000001',
    login_id: null,
    phone_number: '01012345678',
    name: '홍길동',
    access_group: 'general',
    auth_methods: ['kakao'],
    has_password: false,
    created_at: '2026-08-24T00:00:00Z',
    last_login_at: '2026-08-24T00:00:00Z',
  },
}

afterEach(() => {
  clearAuthSession()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Kakao signup API', () => {
  it('reads provider signup context through the browser-bound ticket request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(signupContext))
    vi.stubGlobal('fetch', fetchMock)

    await expect(getKakaoSignupContext('one-time-ticket')).resolves.toEqual(signupContext)

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toMatch(/\/api\/v1\/oauth\/kakao\/signup-context$/)
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('include')
    expect(JSON.parse(String(init.body))).toEqual({ ticket: 'one-time-ticket' })
  })

  it('exchanges an unchanged Kakao-verified phone without an SMS token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(authResponse))
    vi.stubGlobal('fetch', fetchMock)

    await expect(exchangeKakaoAuth({
      ticket: 'one-time-ticket',
      terms_accepted: true,
      privacy_accepted: true,
      name: signupContext.name ?? undefined,
      phone_number: signupContext.phone_number ?? undefined,
    })).resolves.toEqual(authResponse)

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(String(init.body))).toEqual({
      ticket: 'one-time-ticket',
      terms_accepted: true,
      privacy_accepted: true,
      name: '홍길동',
      phone_number: '01012345678',
    })
  })

  it('forwards the SMS verification token for a phone missing from Kakao context', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(authResponse))
    vi.stubGlobal('fetch', fetchMock)

    await exchangeKakaoAuth({
      ticket: 'one-time-ticket',
      terms_accepted: true,
      privacy_accepted: true,
      name: signupContext.name ?? undefined,
      phone_number: '01087654321',
      sms_verification_token: 'sms-verification-token',
    })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(String(init.body))).toMatchObject({
      phone_number: '01087654321',
      sms_verification_token: 'sms-verification-token',
    })
  })

  it('links the Kakao ticket only after sending explicit existing credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(authResponse))
    vi.stubGlobal('fetch', fetchMock)

    await expect(linkKakaoAccount({
      ticket: 'one-time-ticket',
      phone_number: '01012345678',
      login_id: 'existing-user',
      password: 'existing-password',
    })).resolves.toEqual(authResponse)

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toMatch(/\/api\/v1\/oauth\/kakao\/link$/)
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({
      ticket: 'one-time-ticket',
      phone_number: '01012345678',
      login_id: 'existing-user',
      password: 'existing-password',
    })
  })

  it('requires the existing login ID when linking with ticket-bound SMS proof', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(authResponse))
    vi.stubGlobal('fetch', fetchMock)

    await expect(linkKakaoAccount({
      ticket: 'one-time-ticket',
      phone_number: '01012345678',
      login_id: 'existing-user',
      sms_verification_token: 'link-verification-token',
    })).resolves.toEqual(authResponse)

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(String(init.body))).toEqual({
      ticket: 'one-time-ticket',
      phone_number: '01012345678',
      login_id: 'existing-user',
      sms_verification_token: 'link-verification-token',
    })
  })

  it('uses ticket-bound Kakao link SMS endpoints without a signup exchange', async () => {
    const challengeResponse = {
      challenge_id: 'link-challenge',
      expires_in: 180,
      delivered: true,
    }
    const verificationResponse = {
      sms_verification_token: 'link-verification-token',
      phone_number: '01012345678',
      expires_in: 300,
      verified: true,
    }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json(challengeResponse))
      .mockResolvedValueOnce(Response.json(verificationResponse))
    vi.stubGlobal('fetch', fetchMock)

    await expect(requestKakaoAccountLinkSmsCode({
      ticket: 'one-time-ticket',
      phone_number: '01012345678',
    })).resolves.toEqual(challengeResponse)
    await expect(verifyKakaoAccountLinkSmsCode({
      ticket: 'one-time-ticket',
      phone_number: '01012345678',
      challenge_id: 'link-challenge',
      code: '123456',
    })).resolves.toEqual(verificationResponse)

    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      expect.stringMatching(/\/api\/v1\/oauth\/kakao\/link\/sms$/),
      expect.stringMatching(/\/api\/v1\/oauth\/kakao\/link\/sms\/verify$/),
    ])
  })

  it('starts an authenticated account-settings link after current-password reauthentication', async () => {
    storeAuthSession(authResponse)
    const authorizationUrl = 'https://kauth.kakao.com/oauth/authorize?client_id=test'
    const fetchMock = vi.fn().mockResolvedValue(Response.json({
      authorization_url: authorizationUrl,
    }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(startKakaoAccountLink({
      password: 'current-password',
      return_to: '/account',
    })).resolves.toEqual({ authorization_url: authorizationUrl })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toMatch(/\/api\/v1\/oauth\/kakao\/link\/start$/)
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer access-token')
    expect(JSON.parse(String(init.body))).toEqual({
      password: 'current-password',
      return_to: '/account',
    })
  })
})
