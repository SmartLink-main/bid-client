import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  CheckCircle2,
  KeyRound,
  Link2,
  Loader2,
  MessageCircleWarning,
  ShieldCheck,
  Smartphone,
  User,
} from 'lucide-react'
import Layout from '../components/Layout'
import { ApiError, getKoreanErrorMessage, refreshAuthSession } from '../lib/api'
import {
  exchangeKakaoAuth,
  getKakaoSignupContext,
  linkKakaoAccount,
  requestKakaoAccountLinkSmsCode,
  requestSignupSmsCode,
  verifyKakaoAccountLinkSmsCode,
  verifySignupSmsCode,
  type KakaoSignupContextResponse,
} from '../lib/auth'
import { getSafeInternalReturnTo } from '../lib/navigation'
import { clearAuthSession, storeAuthSession } from '../lib/session'
import {
  getKakaoAccountLinkFailureMessage,
  getUnavailableKakaoTicketMessage,
  isKakaoAccountLinkRequiredError,
  isUnavailableSmsChallenge,
} from '../lib/kakao-auth-flow'
import { useCountdown } from '../hooks/useCountdown'

type CallbackMode = 'login' | 'signup'
type AccountLinkMethod = 'password' | 'sms'

type CallbackPayload = {
  ticket: string
  returnTo: string
  mode: CallbackMode
  error: string
  accountDeleted: boolean
  accountLinked: boolean
}

const CALLBACK_PAYLOAD_HISTORY_KEY = '__bidKakaoCallbackPayload'
const NAME_MAX_LENGTH = 50
const PHONE_NUMBER_LENGTH = 11
const VERIFICATION_CODE_LENGTH = 6

function formatCountdown(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function normalizeKoreanMobileNumber(value: string) {
  const digits = value.replace(/\D/g, '')
  const localDigits = digits.length === 12 && digits.startsWith('8210')
    ? `0${digits.slice(2)}`
    : digits
  return localDigits.slice(0, PHONE_NUMBER_LENGTH)
}

function isValidKoreanMobileNumber(value: string) {
  return value.length === PHONE_NUMBER_LENGTH && value.startsWith('010')
}

function canUseKakaoVerifiedPhone(
  context: KakaoSignupContextResponse | null,
  currentPhoneNumber: string,
) {
  if (!context?.phone_number_verified_by_kakao || !context.phone_number) {
    return false
  }
  const contextPhoneNumber = normalizeKoreanMobileNumber(context.phone_number)
  return (
    isValidKoreanMobileNumber(contextPhoneNumber) &&
    currentPhoneNumber === contextPhoneNumber
  )
}

function getCachedCallbackPayload(): CallbackPayload | null {
  const historyState = window.history.state
  if (typeof historyState !== 'object' || historyState === null) {
    return null
  }

  const value = (historyState as Record<string, unknown>)[CALLBACK_PAYLOAD_HISTORY_KEY]
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const candidate = value as Partial<CallbackPayload>
  if (
    typeof candidate.ticket !== 'string' ||
    typeof candidate.returnTo !== 'string' ||
    (candidate.mode !== 'login' && candidate.mode !== 'signup') ||
    typeof candidate.error !== 'string' ||
    typeof candidate.accountDeleted !== 'boolean' ||
    typeof candidate.accountLinked !== 'boolean'
  ) {
    return null
  }

  return {
    ticket: candidate.ticket,
    returnTo: getSafeInternalReturnTo(candidate.returnTo),
    mode: candidate.mode,
    error: candidate.error,
    accountDeleted: candidate.accountDeleted,
    accountLinked: candidate.accountLinked,
  }
}

function readAndScrubCallbackPayload(): CallbackPayload {
  const rawFragment = window.location.hash.replace(/^#/, '')
  if (!rawFragment) {
    const cachedPayload = getCachedCallbackPayload()
    if (cachedPayload) {
      return cachedPayload
    }
  }

  const fragment = new URLSearchParams(rawFragment)
  const ticket = fragment.get('ticket')?.trim() ?? ''
  const returnTo = getSafeInternalReturnTo(fragment.get('return_to'))
  const mode = fragment.get('mode') === 'signup' ? 'signup' : 'login'
  const error = fragment.get('error')?.trim() ?? ''
  const accountDeleted = fragment.get('account_deleted') === '1'
  const accountLinked = fragment.get('account_linked') === '1'
  const payload = {
    ticket,
    returnTo,
    mode,
    error,
    accountDeleted,
    accountLinked,
  } satisfies CallbackPayload
  const historyState = typeof window.history.state === 'object' && window.history.state !== null
    ? window.history.state as Record<string, unknown>
    : {}

  window.history.replaceState(
    { ...historyState, [CALLBACK_PAYLOAD_HISTORY_KEY]: payload },
    '',
    window.location.pathname,
  )
  return payload
}

function clearCachedCallbackPayload() {
  const historyState = window.history.state
  if (typeof historyState !== 'object' || historyState === null) {
    return
  }

  const nextHistoryState = {
    ...(historyState as Record<string, unknown>),
  }
  delete nextHistoryState[CALLBACK_PAYLOAD_HISTORY_KEY]
  window.history.replaceState(
    nextHistoryState,
    '',
    `${window.location.pathname}${window.location.search}`,
  )
}

const automaticExchangeRequests = new Map<string, ReturnType<typeof exchangeKakaoAuth>>()

function exchangeKakaoTicketOnce(
  ticket: string,
  payload: Parameters<typeof exchangeKakaoAuth>[0],
) {
  const existing = automaticExchangeRequests.get(ticket)
  if (existing) {
    return existing
  }

  const request = exchangeKakaoAuth(payload).finally(() => {
    if (automaticExchangeRequests.get(ticket) === request) {
      automaticExchangeRequests.delete(ticket)
    }
  })
  automaticExchangeRequests.set(ticket, request)
  return request
}

function getCallbackErrorMessage(errorCode: string) {
  switch (errorCode) {
    case 'access_denied':
      return '카카오 로그인이 취소되었습니다.'
    case 'state_expired':
    case 'invalid_state':
      return '카카오 로그인 요청이 만료되었습니다. 다시 시작해 주세요.'
    case 'provider_error':
      return '카카오 인증을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.'
    case 'kakao_login_cancelled':
      return '카카오 로그인이 취소되었습니다.'
    case 'kakao_login_failed':
      return '카카오 인증을 완료하지 못했습니다. 다시 시작해 주세요.'
    case 'account_delete_cancelled':
      return '카카오 재인증이 취소되어 회원 정보를 그대로 보존했습니다.'
    case 'account_delete_failed':
      return '회원 탈퇴를 완료하지 못했습니다. 계정은 삭제되지 않았습니다.'
    case 'account_link_cancelled':
      return '카카오 연결이 취소되어 기존 계정 정보를 그대로 유지했습니다.'
    case 'account_link_failed':
      return '카카오 연결을 완료하지 못했습니다. 기존 계정 정보는 변경되지 않았습니다.'
    default:
      return errorCode ? '카카오 인증을 완료하지 못했습니다.' : ''
  }
}

export default function KakaoAuthCallbackPage() {
  const navigate = useNavigate()
  const [payload] = useState(readAndScrubCallbackPayload)
  const [needsSignupCompletion, setNeedsSignupCompletion] = useState(
    payload.mode === 'signup',
  )
  const [needsAccountLink, setNeedsAccountLink] = useState(false)
  const [accountLinkMethod, setAccountLinkMethod] = useState<AccountLinkMethod>('password')
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [signupContext, setSignupContext] = useState<KakaoSignupContextResponse | null>(null)
  const [isLoadingSignupContext, setIsLoadingSignupContext] = useState(
    payload.mode === 'signup' && Boolean(payload.ticket) && !payload.error,
  )
  const [isTicketUnavailable, setIsTicketUnavailable] = useState(false)
  const [name, setName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [code, setCode] = useState('')
  const [challengeId, setChallengeId] = useState('')
  const [smsVerificationToken, setSmsVerificationToken] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [privacyAccepted, setPrivacyAccepted] = useState(false)
  const [isExchanging, setIsExchanging] = useState(false)
  const [isLinkingAccount, setIsLinkingAccount] = useState(false)
  const [isRequestingCode, setIsRequestingCode] = useState(false)
  const [isVerifyingCode, setIsVerifyingCode] = useState(false)
  const {
    seconds: challengeSeconds,
    startCountdown: startChallengeCountdown,
    stopCountdown: stopChallengeCountdown,
  } = useCountdown()
  const {
    seconds: verificationSeconds,
    startCountdown: startVerificationCountdown,
    stopCountdown: stopVerificationCountdown,
  } = useCountdown()
  const isDeletionError = (
    payload.error === 'account_delete_cancelled' ||
    payload.error === 'account_delete_failed'
  )
  const isAccountLinkError = (
    payload.error === 'account_link_cancelled' ||
    payload.error === 'account_link_failed'
  )
  const isKnownAuthenticatedCallback = isDeletionError || isAccountLinkError || payload.accountLinked
  // state가 만료되면 백엔드가 link/delete intent를 복원하지 못해 일반 오류로
  // 돌아올 수 있다. 모든 오류에서 refresh cookie를 한 번 확인해 기존 세션을 보존한다.
  const shouldRestoreSession = Boolean(payload.error) || payload.accountLinked
  const [isRestoringSession, setIsRestoringSession] = useState(shouldRestoreSession)
  const [didRestoreSession, setDidRestoreSession] = useState(!shouldRestoreSession)
  const [message, setMessage] = useState(
    payload.accountDeleted
      ? '카카오 연결 해제와 회원 탈퇴가 완료되었습니다.'
      : payload.accountLinked
        ? '카카오 로그인이 기존 계정에 안전하게 연결되었습니다.'
      : getCallbackErrorMessage(payload.error) || (
      !payload.ticket
        ? '카카오 로그인 정보를 찾을 수 없습니다.'
        : ''
        ),
  )
  const automaticExchangeStarted = useRef(false)
  const signupContextRequestStarted = useRef(false)
  const exchangeInFlight = useRef(false)
  const accountLinkInFlight = useRef(false)
  const smsRequestInFlight = useRef(false)
  const smsVerificationInFlight = useRef(false)
  const isKakaoNameProvided = signupContext?.name != null
  const isKakaoPhoneProvided = signupContext?.phone_number != null
  const isKakaoPhoneVerified = canUseKakaoVerifiedPhone(signupContext, phoneNumber)
  const isSmsCodeVerified = smsVerificationToken !== '' && verificationSeconds > 0

  const resetSmsVerification = useCallback(() => {
    setChallengeId('')
    stopChallengeCountdown()
    setCode('')
    setSmsVerificationToken('')
    stopVerificationCountdown()
  }, [stopChallengeCountdown, stopVerificationCountdown])

  const handleUnavailableTicket = useCallback((error: unknown) => {
    const unavailableMessage = getUnavailableKakaoTicketMessage(error)
    if (!unavailableMessage) {
      return false
    }

    clearCachedCallbackPayload()
    setIsTicketUnavailable(true)
    setMessage(unavailableMessage)
    return true
  }, [])

  const loadSignupContext = useCallback(async () => {
    if (!payload.ticket) {
      return
    }

    setIsLoadingSignupContext(true)
    setMessage('')
    try {
      const response = await getKakaoSignupContext(payload.ticket)
      setSignupContext(response)
      setNeedsAccountLink(response.account_link_required)
      setName(response.name?.slice(0, NAME_MAX_LENGTH) ?? '')
      setPhoneNumber(normalizeKoreanMobileNumber(response.phone_number ?? ''))
      resetSmsVerification()
      if (response.account_link_required) {
        setMessage('같은 휴대폰 번호로 가입된 기존 계정의 본인 확인이 필요합니다.')
      }
    } catch (error) {
      setSignupContext(null)
      setNeedsAccountLink(false)
      if (!handleUnavailableTicket(error)) {
        setMessage(getKoreanErrorMessage(error, '카카오 가입 정보를 불러오지 못했습니다.'))
      }
    } finally {
      setIsLoadingSignupContext(false)
    }
  }, [handleUnavailableTicket, payload.ticket, resetSmsVerification])

  const handleNameChange = (value: string) => {
    if (isKakaoNameProvided) {
      return
    }
    setName(value.slice(0, NAME_MAX_LENGTH))
  }

  const handlePhoneNumberChange = (value: string) => {
    if (isKakaoPhoneProvided) {
      return
    }
    setPhoneNumber(normalizeKoreanMobileNumber(value))
    resetSmsVerification()
  }

  const handleCodeChange = (value: string) => {
    setCode(value.replace(/\D/g, '').slice(0, VERIFICATION_CODE_LENGTH))
    setSmsVerificationToken('')
    stopVerificationCountdown()
  }

  const handleRequestCode = async () => {
    if (smsRequestInFlight.current) {
      return
    }
    setMessage('')
    if (!isValidKoreanMobileNumber(phoneNumber)) {
      setMessage('휴대폰 번호는 010으로 시작하는 숫자 11자리로 입력해 주세요.')
      return
    }

    smsRequestInFlight.current = true
    setIsRequestingCode(true)
    try {
      const response = needsAccountLink
        ? await requestKakaoAccountLinkSmsCode({
            ticket: payload.ticket,
            phone_number: phoneNumber,
          })
        : await requestSignupSmsCode(phoneNumber)
      setChallengeId(response.challenge_id)
      startChallengeCountdown(response.expires_in)
      setCode('')
      setSmsVerificationToken('')
      stopVerificationCountdown()
      setMessage('인증번호를 전송했습니다.')
    } catch (error) {
      if (!handleUnavailableTicket(error)) {
        setMessage(
          (needsAccountLink && getKakaoAccountLinkFailureMessage(error)) ||
          getKoreanErrorMessage(error),
        )
      }
    } finally {
      smsRequestInFlight.current = false
      setIsRequestingCode(false)
    }
  }

  const handleVerifyCode = async () => {
    if (smsVerificationInFlight.current) {
      return
    }
    setMessage('')
    if (!challengeId) {
      setMessage('휴대폰 인증번호를 먼저 받아주세요.')
      return
    }
    if (challengeSeconds === 0) {
      resetSmsVerification()
      setMessage('인증번호가 만료되었습니다. 인증번호를 다시 받아주세요.')
      return
    }
    if (code.length !== VERIFICATION_CODE_LENGTH) {
      setMessage('인증번호는 숫자 6자리로 입력해 주세요.')
      return
    }

    smsVerificationInFlight.current = true
    setIsVerifyingCode(true)
    try {
      const response = needsAccountLink
        ? await verifyKakaoAccountLinkSmsCode({
            ticket: payload.ticket,
            phone_number: phoneNumber,
            code,
            challenge_id: challengeId,
          })
        : await verifySignupSmsCode({
            phone_number: phoneNumber,
            code,
            challenge_id: challengeId,
          })
      setChallengeId('')
      stopChallengeCountdown()
      setSmsVerificationToken(response.sms_verification_token)
      startVerificationCountdown(response.expires_in)
      setMessage('인증번호가 확인되었습니다.')
    } catch (error) {
      if (isUnavailableSmsChallenge(error)) {
        resetSmsVerification()
      }
      if (!handleUnavailableTicket(error)) {
        setMessage(
          (needsAccountLink && getKakaoAccountLinkFailureMessage(error)) ||
          getKoreanErrorMessage(error, '인증번호 확인에 실패했습니다.'),
        )
      }
    } finally {
      smsVerificationInFlight.current = false
      setIsVerifyingCode(false)
    }
  }

  const exchangeTicket = async (hasConsent: boolean) => {
    if (
      !payload.ticket ||
      exchangeInFlight.current ||
      isTicketUnavailable ||
      (hasConsent && !signupContext)
    ) {
      return
    }

    exchangeInFlight.current = true
    setIsExchanging(true)
    setMessage('')
    try {
      const exchangePayload = {
        ticket: payload.ticket,
        terms_accepted: hasConsent,
        privacy_accepted: hasConsent,
        ...(hasConsent ? {
          name: name.trim() || undefined,
          phone_number: phoneNumber,
          sms_verification_token: isKakaoPhoneVerified
            ? undefined
            : smsVerificationToken || undefined,
        } : {}),
      }
      const response = hasConsent
        ? await exchangeKakaoAuth(exchangePayload)
        : await exchangeKakaoTicketOnce(payload.ticket, exchangePayload)
      clearCachedCallbackPayload()
      setIsTicketUnavailable(true)
      storeAuthSession(response)
      navigate(payload.returnTo, { replace: true })
    } catch (error) {
      if (isKakaoAccountLinkRequiredError(error)) {
        setNeedsSignupCompletion(true)
        setNeedsAccountLink(true)
        resetSmsVerification()
        setMessage('같은 휴대폰 번호로 가입된 기존 계정의 본인 확인이 필요합니다.')
      } else if (error instanceof ApiError && error.status === 428) {
        setNeedsSignupCompletion(true)
        setMessage('처음 가입하시는 경우 휴대폰 확인과 필수 약관 동의가 필요합니다.')
        if (!signupContext) {
          void loadSignupContext()
        }
      } else {
        if (handleUnavailableTicket(error)) {
          return
        }
        if (
          error instanceof ApiError &&
          error.message.toLowerCase().includes('verification token')
        ) {
          setSmsVerificationToken('')
          stopVerificationCountdown()
        }
        setMessage(getKoreanErrorMessage(error, '카카오 로그인을 완료하지 못했습니다.'))
      }
    } finally {
      exchangeInFlight.current = false
      setIsExchanging(false)
    }
  }

  useEffect(() => {
    if (
      payload.mode === 'signup' &&
      payload.ticket &&
      !payload.error &&
      !signupContextRequestStarted.current
    ) {
      signupContextRequestStarted.current = true
      void loadSignupContext()
    }
  }, [loadSignupContext, payload.error, payload.mode, payload.ticket])

  useEffect(() => {
    if (payload.accountDeleted) {
      clearAuthSession()
      window.location.replace('/')
      return
    }
    if (shouldRestoreSession) {
      void refreshAuthSession()
        .then(() => {
          setDidRestoreSession(true)
          if (payload.accountLinked) {
            navigate(payload.returnTo, { replace: true })
          }
        })
        .catch(() => setDidRestoreSession(false))
        .finally(() => setIsRestoringSession(false))
      return
    }
    if (
      payload.ticket &&
      !payload.error &&
      payload.mode === 'login' &&
      !automaticExchangeStarted.current
    ) {
      automaticExchangeStarted.current = true
      void exchangeTicket(false)
    }
  // history entry에서 복원한 콜백 값은 마운트 후 바뀌지 않는다.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleConsentSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage('')
    if (!signupContext) {
      setMessage('카카오 가입 정보를 먼저 불러와 주세요.')
      return
    }
    if (!isValidKoreanMobileNumber(phoneNumber)) {
      setMessage('휴대폰 번호는 010으로 시작하는 숫자 11자리로 입력해 주세요.')
      return
    }
    if (!isKakaoPhoneVerified && !smsVerificationToken) {
      setMessage('휴대폰 인증번호 확인을 완료해 주세요.')
      return
    }
    if (!isKakaoPhoneVerified && verificationSeconds === 0) {
      setSmsVerificationToken('')
      stopVerificationCountdown()
      setMessage('휴대폰 인증 확인이 만료되었습니다. 인증을 다시 진행해 주세요.')
      return
    }
    if (!termsAccepted || !privacyAccepted) {
      setMessage('필수 약관 두 항목에 모두 동의해 주세요.')
      return
    }
    void exchangeTicket(true)
  }

  const handleAccountLinkSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (
      accountLinkInFlight.current ||
      !payload.ticket ||
      isTicketUnavailable
    ) {
      return
    }

    setMessage('')
    if (!isValidKoreanMobileNumber(phoneNumber)) {
      setMessage('연결할 기존 계정의 휴대폰 번호를 확인할 수 없습니다. 카카오 로그인을 다시 시작해 주세요.')
      return
    }
    if (!loginId.trim()) {
      setMessage('기존 계정의 아이디를 입력해 주세요.')
      return
    }
    if (accountLinkMethod === 'password' && !password) {
      setMessage('기존 계정의 비밀번호를 입력해 주세요.')
      return
    }
    if (accountLinkMethod === 'sms' && (!smsVerificationToken || verificationSeconds === 0)) {
      setMessage('휴대폰 인증번호 확인을 완료해 주세요.')
      return
    }

    accountLinkInFlight.current = true
    setIsLinkingAccount(true)
    try {
      const response = await linkKakaoAccount({
        ticket: payload.ticket,
        phone_number: phoneNumber,
        login_id: loginId.trim(),
        ...(accountLinkMethod === 'password'
          ? {
              password,
            }
          : {
              sms_verification_token: smsVerificationToken,
            }),
      })
      clearCachedCallbackPayload()
      setIsTicketUnavailable(true)
      storeAuthSession(response)
      navigate(payload.returnTo, { replace: true })
    } catch (error) {
      if (handleUnavailableTicket(error)) {
        return
      }
      if (
        error instanceof ApiError &&
        error.message.toLowerCase().includes('verification token')
      ) {
        setSmsVerificationToken('')
        stopVerificationCountdown()
      }
      setMessage(
        getKakaoAccountLinkFailureMessage(error) ||
        getKoreanErrorMessage(error, '기존 계정 인증에 실패했습니다. 다시 확인해 주세요.'),
      )
    } finally {
      accountLinkInFlight.current = false
      setIsLinkingAccount(false)
    }
  }

  const hasUsableTicket = Boolean(
    payload.ticket && !payload.error && !isTicketUnavailable,
  )
  const isProcessing = isExchanging || isLinkingAccount || isLoadingSignupContext

  return (
    <Layout>
      <div className="flex w-full flex-grow items-center justify-center px-4 py-16">
        <div className={`w-full rounded-3xl border border-gray-100 bg-white p-8 shadow-[0_8px_30px_rgb(0,0,0,0.05)] md:p-10 ${needsSignupCompletion || needsAccountLink ? 'max-w-lg' : 'max-w-md'}`}>
          <div className="text-center">
            {isProcessing ? (
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-[#B59B00]" aria-hidden="true" />
            ) : needsAccountLink ? (
              <Link2 className="mx-auto h-10 w-10 text-blue-700" aria-hidden="true" />
            ) : needsSignupCompletion ? (
              <CheckCircle2 className="mx-auto h-10 w-10 text-[#B59B00]" aria-hidden="true" />
            ) : (
              <MessageCircleWarning className="mx-auto h-10 w-10 text-amber-600" aria-hidden="true" />
            )}
            <h1 className="mt-4 text-2xl font-extrabold text-slate-900">
              {payload.accountDeleted
                ? '회원 탈퇴 완료'
                : payload.accountLinked
                  ? '카카오 연결 완료'
                  : isAccountLinkError
                    ? '카카오 연결 확인'
                : isDeletionError
                  ? '회원 탈퇴 확인'
                  : needsAccountLink
                    ? '기존 계정과 카카오 연결'
                  : needsSignupCompletion
                    ? '카카오 간편가입'
                    : '카카오 로그인 확인'}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-gray-500">
              {isLoadingSignupContext
                ? '카카오에서 확인한 가입 정보를 안전하게 불러오고 있습니다.'
                : isExchanging || isLinkingAccount
                ? '안전하게 로그인 정보를 확인하고 있습니다.'
                : payload.accountDeleted
                  ? '회원 정보를 정리하고 처음 화면으로 이동합니다.'
                  : payload.accountLinked
                    ? isRestoringSession
                      ? '연결된 로그인 정보를 확인하고 있습니다.'
                      : '이제 기존 계정으로 카카오 로그인을 사용할 수 있습니다.'
                  : isAccountLinkError
                    ? isRestoringSession
                      ? '기존 로그인 상태를 복원하고 있습니다.'
                      : '기존 계정은 변경되지 않았습니다.'
                  : isDeletionError
                    ? isRestoringSession
                      ? '기존 로그인 상태를 복원하고 있습니다.'
                      : '계정은 삭제되지 않았습니다.'
                    : needsAccountLink
                      ? '기존 계정의 비밀번호 또는 휴대폰 인증으로 본인임을 확인해 주세요.'
                    : needsSignupCompletion
                      ? '카카오 정보와 휴대폰 번호를 확인하면 가입과 로그인이 완료됩니다.'
                      : '카카오 로그인 요청을 확인해 주세요.'}
            </p>
          </div>

          {isLoadingSignupContext && (
            <p className="mt-7 text-center text-sm font-semibold text-gray-500" role="status">
              가입 정보 확인 중
            </p>
          )}

          {needsSignupCompletion && !needsAccountLink && signupContext && hasUsableTicket && !isExchanging && !isLoadingSignupContext && (
            <form className="mt-8 space-y-5" onSubmit={handleConsentSubmit} noValidate>
              <div>
                <label htmlFor="kakao-signup-name" className="mb-1.5 ml-1.5 block text-sm font-semibold text-gray-700">
                  이름
                </label>
                <div className="group relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                    <User className="h-5 w-5 text-gray-400 transition-colors group-focus-within:text-blue-700" />
                  </div>
                  <input
                    id="kakao-signup-name"
                    type="text"
                    value={name}
                    onChange={(event) => handleNameChange(event.target.value)}
                    readOnly={isKakaoNameProvided}
                    aria-describedby="kakao-signup-name-help"
                    maxLength={NAME_MAX_LENGTH}
                    autoComplete="name"
                    disabled={isExchanging}
                    className="w-full rounded-2xl border border-gray-200 bg-white py-4 pl-12 pr-4 text-sm text-gray-800 shadow-inner outline-none transition-colors focus:border-blue-700 focus:ring-0 read-only:cursor-not-allowed read-only:bg-gray-50 disabled:bg-gray-50"
                    placeholder="이름을 입력해 주세요"
                  />
                </div>
                <p id="kakao-signup-name-help" className="mt-2 ml-1.5 text-xs text-gray-500">
                  {isKakaoNameProvided
                    ? '카카오에서 제공한 이름으로 수정할 수 없습니다.'
                    : '카카오에서 이름을 받지 못했습니다. 이름을 입력해 주세요.'}
                </p>
              </div>

              <div>
                <label htmlFor="kakao-signup-phone" className="mb-1.5 ml-1.5 block text-sm font-semibold text-gray-700">
                  휴대폰 번호
                </label>
                <div className="flex flex-col gap-2.5 sm:flex-row">
                  <div className="group relative flex-grow">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                      <Smartphone className="h-5 w-5 text-gray-400 transition-colors group-focus-within:text-blue-700" />
                    </div>
                    <input
                      id="kakao-signup-phone"
                      type="tel"
                      value={phoneNumber}
                      onChange={(event) => handlePhoneNumberChange(event.target.value)}
                      readOnly={isKakaoPhoneProvided}
                      aria-describedby="kakao-signup-phone-help"
                      required
                      inputMode="numeric"
                      minLength={PHONE_NUMBER_LENGTH}
                      maxLength={PHONE_NUMBER_LENGTH}
                      pattern="010[0-9]{8}"
                      autoComplete="tel"
                      disabled={isRequestingCode || isVerifyingCode || isExchanging}
                      className="w-full rounded-2xl border border-gray-200 bg-white py-4 pl-12 pr-4 text-sm text-gray-800 shadow-inner outline-none transition-colors focus:border-blue-700 focus:ring-0 read-only:cursor-not-allowed read-only:bg-gray-50 disabled:bg-gray-50"
                      placeholder="010으로 시작하는 휴대폰 번호"
                    />
                  </div>
                  {isKakaoPhoneVerified ? (
                    <div className="flex shrink-0 items-center justify-center gap-1.5 rounded-2xl border border-[#E5CC00] bg-[#FFF8BF] px-5 py-4 text-sm font-bold text-[#665A00]" role="status">
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      카카오 인증 완료
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleRequestCode()}
                      disabled={!isValidKoreanMobileNumber(phoneNumber) || isRequestingCode || isVerifyingCode || isExchanging}
                      className="shrink-0 rounded-2xl border border-blue-200 bg-blue-50 px-6 py-4 text-sm font-semibold text-blue-700 shadow-sm transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      {isRequestingCode ? '전송 중' : '인증번호 받기'}
                    </button>
                  )}
                </div>
                <p id="kakao-signup-phone-help" className="mt-2 ml-1.5 text-xs text-gray-500">
                  {isKakaoPhoneVerified
                    ? '카카오에서 확인된 번호로 수정할 수 없으며, 별도 SMS 인증이 필요하지 않습니다.'
                    : signupContext.phone_number
                      ? '카카오에서 제공한 번호로 수정할 수 없으며, SMS 인증이 필요합니다.'
                      : '카카오에서 휴대폰 번호를 받지 못해 SMS 인증이 필요합니다.'}
                </p>
              </div>

              {!isKakaoPhoneVerified && (
                <div>
                  <label htmlFor="kakao-signup-code" className="sr-only">인증번호</label>
                  <div className="flex flex-col gap-2.5 sm:flex-row">
                    <div className="group relative flex-grow">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                        <ShieldCheck className="h-5 w-5 text-gray-400 transition-colors group-focus-within:text-blue-700" />
                      </div>
                      <input
                        id="kakao-signup-code"
                        type="text"
                        value={code}
                        onChange={(event) => handleCodeChange(event.target.value)}
                        required
                        inputMode="numeric"
                        minLength={VERIFICATION_CODE_LENGTH}
                        maxLength={VERIFICATION_CODE_LENGTH}
                        pattern="[0-9]{6}"
                        disabled={!challengeId || isVerifyingCode || isSmsCodeVerified || isExchanging}
                        className="w-full rounded-2xl border border-gray-200 bg-white py-4 pl-12 pr-20 text-sm text-gray-800 shadow-inner outline-none transition-colors focus:border-blue-700 focus:ring-0 disabled:bg-gray-50"
                        placeholder="인증번호 6자리 입력"
                      />
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-5">
                        <span className={isSmsCodeVerified ? 'text-sm font-semibold text-blue-600' : 'text-sm font-semibold text-red-500'}>
                          {isSmsCodeVerified
                            ? `완료 ${formatCountdown(verificationSeconds)}`
                            : challengeId
                              ? formatCountdown(challengeSeconds)
                              : '--:--'}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleVerifyCode()}
                      disabled={!challengeId || challengeSeconds === 0 || code.length !== VERIFICATION_CODE_LENGTH || isSmsCodeVerified || isVerifyingCode || isExchanging}
                      className="shrink-0 rounded-2xl bg-blue-900 px-6 py-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      {isVerifyingCode ? '확인 중' : isSmsCodeVerified ? '확인 완료' : '인증번호 확인'}
                    </button>
                  </div>
                </div>
              )}

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 p-4 hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(event) => setTermsAccepted(event.target.checked)}
                  className="mt-0.5 h-5 w-5 rounded border-gray-300 text-blue-900 focus:ring-blue-900"
                />
                <span className="text-sm font-semibold leading-relaxed text-gray-700">
                  [필수]{' '}
                  <Link
                    to="/terms-of-service"
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) => event.stopPropagation()}
                    className="text-blue-800 underline underline-offset-4"
                  >
                    서비스 이용약관
                  </Link>
                  에 동의합니다.
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 p-4 hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={privacyAccepted}
                  onChange={(event) => setPrivacyAccepted(event.target.checked)}
                  className="mt-0.5 h-5 w-5 rounded border-gray-300 text-blue-900 focus:ring-blue-900"
                />
                <span className="text-sm font-semibold leading-relaxed text-gray-700">
                  [필수]{' '}
                  <Link
                    to="/privacy-policy#collection-consent"
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) => event.stopPropagation()}
                    className="text-blue-800 underline underline-offset-4"
                  >
                    개인정보 수집·이용 안내
                  </Link>
                  에 동의합니다.
                </span>
              </label>
              <button
                type="submit"
                disabled={isExchanging}
                className="w-full rounded-2xl bg-[#FEE500] px-5 py-4 font-bold text-[#191919] hover:bg-[#F5DC00] disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
              >
                카카오 간편가입 완료
              </button>
            </form>
          )}

          {needsAccountLink && signupContext && hasUsableTicket && !isProcessing && (
            <div className="mt-8 space-y-5">
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 text-sm leading-relaxed text-blue-950">
                <p className="font-extrabold">자동으로 계정을 합치지 않았습니다.</p>
                <p className="mt-1.5">
                  확인된 휴대폰 번호로 가입된 계정이 있습니다. 이름은 계정 연결 기준으로 사용하지 않으며, 아래 방법으로 본인 확인이 끝난 경우에만 연결합니다.
                </p>
              </div>

              <div>
                <label htmlFor="kakao-link-phone" className="mb-1.5 ml-1.5 block text-sm font-semibold text-gray-700">
                  연결 대상 휴대폰 번호
                </label>
                <div className="group relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                    <Smartphone className="h-5 w-5 text-gray-400" aria-hidden="true" />
                  </div>
                  <input
                    id="kakao-link-phone"
                    type="tel"
                    value={phoneNumber}
                    readOnly
                    aria-describedby="kakao-link-phone-help"
                    className="w-full cursor-not-allowed rounded-2xl border border-gray-200 bg-gray-50 py-4 pl-12 pr-4 text-sm text-gray-800 shadow-inner outline-none"
                  />
                </div>
                <p id="kakao-link-phone-help" className="mt-2 ml-1.5 text-xs text-gray-500">
                  이 번호와 일치하는 기존 계정만 연결할 수 있습니다.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 rounded-2xl bg-gray-100 p-1.5" aria-label="기존 계정 본인 확인 방법">
                <button
                  type="button"
                  aria-pressed={accountLinkMethod === 'password'}
                  onClick={() => {
                    setAccountLinkMethod('password')
                    setMessage('')
                  }}
                  className={`rounded-xl px-3 py-3 text-sm font-bold transition ${accountLinkMethod === 'password' ? 'bg-white text-blue-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                >
                  아이디·비밀번호
                </button>
                <button
                  type="button"
                  aria-pressed={accountLinkMethod === 'sms'}
                  onClick={() => {
                    setAccountLinkMethod('sms')
                    setMessage('')
                  }}
                  className={`rounded-xl px-3 py-3 text-sm font-bold transition ${accountLinkMethod === 'sms' ? 'bg-white text-blue-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                >
                  휴대폰 인증
                </button>
              </div>

              <form className="space-y-4" onSubmit={handleAccountLinkSubmit} noValidate>
                <div>
                  <label htmlFor="kakao-link-login-id" className="mb-1.5 ml-1.5 block text-sm font-semibold text-gray-700">
                    기존 계정 아이디
                  </label>
                  <div className="group relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                      <User className="h-5 w-5 text-gray-400 group-focus-within:text-blue-700" aria-hidden="true" />
                    </div>
                    <input
                      id="kakao-link-login-id"
                      type="text"
                      value={loginId}
                      onChange={(event) => setLoginId(event.target.value)}
                      autoComplete="username"
                      maxLength={50}
                      disabled={isLinkingAccount}
                      className="w-full rounded-2xl border border-gray-200 bg-white py-4 pl-12 pr-4 text-sm text-gray-800 shadow-inner outline-none focus:border-blue-700 disabled:bg-gray-50"
                      placeholder="기존 아이디"
                    />
                  </div>
                  <p className="mt-2 ml-1.5 text-xs text-gray-500">
                    두 본인 확인 방법 모두 연결할 기존 계정의 아이디가 필요합니다.
                  </p>
                </div>

                {accountLinkMethod === 'password' ? (
                  <div>
                      <label htmlFor="kakao-link-password" className="mb-1.5 ml-1.5 block text-sm font-semibold text-gray-700">
                        기존 계정 비밀번호
                      </label>
                      <div className="group relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                          <KeyRound className="h-5 w-5 text-gray-400 group-focus-within:text-blue-700" aria-hidden="true" />
                        </div>
                        <input
                          id="kakao-link-password"
                          type="password"
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          autoComplete="current-password"
                          maxLength={50}
                          disabled={isLinkingAccount}
                          className="w-full rounded-2xl border border-gray-200 bg-white py-4 pl-12 pr-4 text-sm text-gray-800 shadow-inner outline-none focus:border-blue-700 disabled:bg-gray-50"
                          placeholder="기존 비밀번호"
                        />
                      </div>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => void handleRequestCode()}
                      disabled={isRequestingCode || isVerifyingCode || isSmsCodeVerified || isLinkingAccount}
                      className="w-full rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm font-bold text-blue-800 hover:bg-blue-100 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      {isRequestingCode
                        ? '인증번호 전송 중'
                        : isSmsCodeVerified
                          ? '휴대폰 확인 완료'
                          : challengeId
                            ? '인증번호 다시 받기'
                            : '인증번호 받기'}
                    </button>
                    <div className="flex flex-col gap-2.5 sm:flex-row">
                      <div className="group relative flex-grow">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                          <ShieldCheck className="h-5 w-5 text-gray-400 group-focus-within:text-blue-700" aria-hidden="true" />
                        </div>
                        <label htmlFor="kakao-link-code" className="sr-only">인증번호</label>
                        <input
                          id="kakao-link-code"
                          type="text"
                          value={code}
                          onChange={(event) => handleCodeChange(event.target.value)}
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          minLength={VERIFICATION_CODE_LENGTH}
                          maxLength={VERIFICATION_CODE_LENGTH}
                          disabled={!challengeId || isVerifyingCode || isSmsCodeVerified || isLinkingAccount}
                          className="w-full rounded-2xl border border-gray-200 bg-white py-4 pl-12 pr-20 text-sm text-gray-800 shadow-inner outline-none focus:border-blue-700 disabled:bg-gray-50"
                          placeholder="인증번호 6자리"
                        />
                        <span className={`pointer-events-none absolute inset-y-0 right-0 flex items-center pr-5 text-sm font-semibold ${isSmsCodeVerified ? 'text-blue-600' : 'text-red-500'}`}>
                          {isSmsCodeVerified
                            ? `완료 ${formatCountdown(verificationSeconds)}`
                            : challengeId
                              ? formatCountdown(challengeSeconds)
                              : '--:--'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleVerifyCode()}
                        disabled={!challengeId || challengeSeconds === 0 || code.length !== VERIFICATION_CODE_LENGTH || isSmsCodeVerified || isVerifyingCode || isLinkingAccount}
                        className="shrink-0 rounded-2xl bg-blue-900 px-6 py-4 text-sm font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                      >
                        {isVerifyingCode ? '확인 중' : isSmsCodeVerified ? '확인 완료' : '인증번호 확인'}
                      </button>
                    </div>
                  </>
                )}

                <button
                  type="submit"
                  disabled={isLinkingAccount}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#FEE500] px-5 py-4 font-bold text-[#191919] hover:bg-[#F5DC00] disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
                >
                  <Link2 className="h-4 w-4" aria-hidden="true" />
                  {isLinkingAccount ? '계정 연결 중' : '본인 확인 후 카카오 연결'}
                </button>
              </form>
            </div>
          )}

          {needsSignupCompletion && !signupContext && hasUsableTicket && !isLoadingSignupContext && !isExchanging && (
            <button
              type="button"
              onClick={() => void loadSignupContext()}
              className="mt-6 w-full rounded-2xl border border-blue-200 bg-blue-50 px-5 py-3.5 text-sm font-bold text-blue-800 hover:bg-blue-100"
            >
              가입 정보 다시 불러오기
            </button>
          )}

          {!needsSignupCompletion && hasUsableTicket && message && !isExchanging && (
            <button
              type="button"
              onClick={() => void exchangeTicket(false)}
              className="mt-6 w-full rounded-2xl border border-blue-200 bg-blue-50 px-5 py-3.5 text-sm font-bold text-blue-800 hover:bg-blue-100"
            >
              카카오 로그인 다시 확인
            </button>
          )}

          {message && (
            <p className="mt-6 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-center text-sm font-semibold text-amber-800" role="alert">
              {message}
            </p>
          )}

          {!isProcessing && (
            shouldRestoreSession ||
            !hasUsableTicket ||
            (!needsSignupCompletion && Boolean(message)) ||
            (needsSignupCompletion && !signupContext && !isLoadingSignupContext)
          ) && (
            <div className="mt-6 flex justify-center gap-4 text-sm font-bold">
              {shouldRestoreSession ? (
                isRestoringSession ? (
                  <span className="text-gray-500" role="status">로그인 상태 복원 중</span>
                ) : didRestoreSession ? (
                  <Link to="/account" replace className="text-blue-800 underline underline-offset-4">내 계정으로 돌아가기</Link>
                ) : isKnownAuthenticatedCallback ? (
                  <Link to="/login" replace className="text-blue-800 underline underline-offset-4">다시 로그인하기</Link>
                ) : (
                  <>
                    <Link to="/login" replace className="text-blue-800 underline underline-offset-4">로그인으로 돌아가기</Link>
                    <Link to="/signup" replace className="text-blue-800 underline underline-offset-4">회원가입으로 돌아가기</Link>
                  </>
                )
              ) : (
                <>
                  <Link to="/login" replace className="text-blue-800 underline underline-offset-4">로그인으로 돌아가기</Link>
                  <Link to="/signup" replace className="text-blue-800 underline underline-offset-4">회원가입으로 돌아가기</Link>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
