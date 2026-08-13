import { apiRequest } from './api'

export type LoginRequest = {
  login_id: string
  password: string
  remember_me: boolean
}

export type DeleteAccountRequest = {
  password: string
}

export type SignupRequest = {
  phone_number: string
  sms_verification_token: string
  login_id: string
  password: string
  name?: string
}

export type SignupSmsVerifyRequest = {
  phone_number: string
  code: string
  challenge_id: string
}

export type SignupSmsChallengeResponse = {
  challenge_id: string
  expires_in: number
  delivered: true
}

export type SignupSmsVerifyResponse = {
  sms_verification_token: string
  phone_number: string
  expires_in: number
  verified: true
}

export type AppUser = {
  id: string
  login_id: string | null
  phone_number: string | null
  name: string | null
  access_group: 'general' | 'supporter' | 'legal_agent' | 'admin'
  auth_methods: Array<'password' | 'kakao'>
  has_password: boolean
  created_at: string
  last_login_at: string | null
}

export type AuthResponse = {
  token_type: 'bearer'
  access_token: string
  expires_in: number
  refresh_expires_in: number
  user: AppUser
}

export type MeResponse = {
  user: AppUser
}

export type KakaoAuthExchangeRequest = {
  ticket: string
  terms_accepted: boolean
  terms_version: string
  privacy_accepted: boolean
  privacy_version: string
}

export type KakaoDeleteStartResponse = {
  authorization_url: string
}

export function requestSignupSmsCode(phoneNumber: string) {
  return apiRequest<SignupSmsChallengeResponse>('/api/v1/signup/sms', {
    method: 'POST',
    body: JSON.stringify({
      phone_number: phoneNumber,
    }),
  })
}

export function verifySignupSmsCode(payload: SignupSmsVerifyRequest) {
  return apiRequest<SignupSmsVerifyResponse>('/api/v1/signup/sms/verify', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function signup(payload: SignupRequest) {
  return apiRequest<AuthResponse>('/api/v1/signup', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function login(payload: LoginRequest) {
  return apiRequest<AuthResponse>('/api/v1/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function exchangeKakaoAuth(payload: KakaoAuthExchangeRequest) {
  return apiRequest<AuthResponse>('/api/v1/oauth/kakao/exchange', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function startKakaoAccountDeletion() {
  return apiRequest<KakaoDeleteStartResponse>('/api/v1/oauth/kakao/delete/start', {
    method: 'POST',
    auth: 'bearer',
    authErrorMode: 'access-token',
    body: JSON.stringify({}),
  })
}

export function getMe() {
  return apiRequest<MeResponse>('/api/v1/me', {
    auth: 'bearer',
  })
}

export function deleteMe(payload: DeleteAccountRequest) {
  return apiRequest<void>('/api/v1/me', {
    method: 'DELETE',
    auth: 'bearer',
    authErrorMode: 'access-token',
    body: JSON.stringify(payload),
  })
}

export function logout() {
  return apiRequest<void>('/api/v1/logout', {
    method: 'POST',
    keepalive: true,
    body: JSON.stringify({}),
  })
}
