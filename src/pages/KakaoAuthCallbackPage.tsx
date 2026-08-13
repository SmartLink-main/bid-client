import { type FormEvent, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2, Loader2, MessageCircleWarning } from 'lucide-react'
import Layout from '../components/Layout'
import { ApiError, getKoreanErrorMessage, refreshAuthSession } from '../lib/api'
import { exchangeKakaoAuth } from '../lib/auth'
import { getSafeInternalReturnTo } from '../lib/navigation'
import { clearAuthSession, storeAuthSession } from '../lib/session'

type CallbackMode = 'login' | 'signup'

type CallbackPayload = {
  ticket: string
  returnTo: string
  mode: CallbackMode
  error: string
  termsVersion: string
  privacyVersion: string
  accountDeleted: boolean
}

const CALLBACK_PAYLOAD_HISTORY_KEY = '__bidKakaoCallbackPayload'

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
    typeof candidate.termsVersion !== 'string' ||
    typeof candidate.privacyVersion !== 'string' ||
    typeof candidate.accountDeleted !== 'boolean'
  ) {
    return null
  }

  return {
    ticket: candidate.ticket,
    returnTo: getSafeInternalReturnTo(candidate.returnTo),
    mode: candidate.mode,
    error: candidate.error,
    termsVersion: candidate.termsVersion,
    privacyVersion: candidate.privacyVersion,
    accountDeleted: candidate.accountDeleted,
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
  const termsVersion = fragment.get('terms_version')?.trim() ?? ''
  const privacyVersion = fragment.get('privacy_version')?.trim() ?? ''
  const accountDeleted = fragment.get('account_deleted') === '1'
  const payload = {
    ticket,
    returnTo,
    mode,
    error,
    termsVersion,
    privacyVersion,
    accountDeleted,
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
    default:
      return errorCode ? '카카오 인증을 완료하지 못했습니다.' : ''
  }
}

export default function KakaoAuthCallbackPage() {
  const navigate = useNavigate()
  const [payload] = useState(readAndScrubCallbackPayload)
  const [needsConsent, setNeedsConsent] = useState(payload.mode === 'signup')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [privacyAccepted, setPrivacyAccepted] = useState(false)
  const [isExchanging, setIsExchanging] = useState(false)
  const isDeletionError = (
    payload.error === 'account_delete_cancelled' ||
    payload.error === 'account_delete_failed'
  )
  const [isRestoringSession, setIsRestoringSession] = useState(isDeletionError)
  const [didRestoreSession, setDidRestoreSession] = useState(!isDeletionError)
  const [message, setMessage] = useState(
    payload.accountDeleted
      ? '카카오 연결 해제와 회원 탈퇴가 완료되었습니다.'
      : getCallbackErrorMessage(payload.error) || (
      !payload.ticket
        ? '카카오 로그인 정보를 찾을 수 없습니다.'
        : payload.mode === 'signup' && (!payload.termsVersion || !payload.privacyVersion)
          ? '약관 정보를 확인하지 못했습니다. 간편가입을 다시 시작해 주세요.'
          : ''
        ),
  )
  const automaticExchangeStarted = useRef(false)

  const exchangeTicket = async (hasConsent: boolean) => {
    if (
      !payload.ticket ||
      isExchanging ||
      (hasConsent && (!payload.termsVersion || !payload.privacyVersion))
    ) {
      return
    }

    setIsExchanging(true)
    setMessage('')
    try {
      const exchangePayload = {
        ticket: payload.ticket,
        terms_accepted: hasConsent,
        terms_version: payload.termsVersion,
        privacy_accepted: hasConsent,
        privacy_version: payload.privacyVersion,
      }
      const response = hasConsent
        ? await exchangeKakaoAuth(exchangePayload)
        : await exchangeKakaoTicketOnce(payload.ticket, exchangePayload)
      storeAuthSession(response)
      navigate(payload.returnTo, { replace: true })
    } catch (error) {
      if (error instanceof ApiError && error.status === 428) {
        setNeedsConsent(true)
        setMessage('처음 가입하시는 경우 필수 약관 동의가 필요합니다.')
      } else {
        setMessage(getKoreanErrorMessage(error, '카카오 로그인을 완료하지 못했습니다.'))
      }
    } finally {
      setIsExchanging(false)
    }
  }

  useEffect(() => {
    if (payload.accountDeleted) {
      clearAuthSession()
      window.location.replace('/')
      return
    }
    if (isDeletionError) {
      void refreshAuthSession()
        .then(() => setDidRestoreSession(true))
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
    if (!termsAccepted || !privacyAccepted) {
      setMessage('필수 약관 두 항목에 모두 동의해 주세요.')
      return
    }
    void exchangeTicket(true)
  }

  const canRetry = Boolean(
    payload.ticket &&
    !payload.error &&
    (payload.mode === 'login' || (payload.termsVersion && payload.privacyVersion)),
  )

  return (
    <Layout>
      <div className="flex w-full flex-grow items-center justify-center px-4 py-16">
        <div className="w-full max-w-md rounded-3xl border border-gray-100 bg-white p-8 shadow-[0_8px_30px_rgb(0,0,0,0.05)] md:p-10">
          <div className="text-center">
            {isExchanging ? (
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-[#B59B00]" aria-hidden="true" />
            ) : needsConsent ? (
              <CheckCircle2 className="mx-auto h-10 w-10 text-[#B59B00]" aria-hidden="true" />
            ) : (
              <MessageCircleWarning className="mx-auto h-10 w-10 text-amber-600" aria-hidden="true" />
            )}
            <h1 className="mt-4 text-2xl font-extrabold text-slate-900">
              {payload.accountDeleted
                ? '회원 탈퇴 완료'
                : isDeletionError
                  ? '회원 탈퇴 확인'
                  : needsConsent
                    ? '카카오 간편가입'
                    : '카카오 로그인 확인'}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-gray-500">
              {isExchanging
                ? '안전하게 로그인 정보를 확인하고 있습니다.'
                : payload.accountDeleted
                  ? '회원 정보를 정리하고 처음 화면으로 이동합니다.'
                  : isDeletionError
                    ? isRestoringSession
                      ? '기존 로그인 상태를 복원하고 있습니다.'
                      : '계정은 삭제되지 않았습니다.'
                    : needsConsent
                      ? '처음 한 번만 필수 약관에 동의하면 가입과 로그인이 완료됩니다.'
                      : '카카오 로그인 요청을 확인해 주세요.'}
            </p>
          </div>

          {needsConsent && canRetry && !isExchanging && (
            <form className="mt-7 space-y-4" onSubmit={handleConsentSubmit}>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 p-4 hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(event) => setTermsAccepted(event.target.checked)}
                  className="mt-0.5 h-5 w-5 rounded border-gray-300 text-blue-900 focus:ring-blue-900"
                />
                <span className="text-sm font-semibold leading-relaxed text-gray-700">
                  [필수] 서비스 이용약관에 동의합니다.
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
                  [필수] 개인정보 수집·이용에 동의합니다.
                </span>
              </label>
              <button
                type="submit"
                disabled={!termsAccepted || !privacyAccepted}
                className="w-full rounded-2xl bg-[#FEE500] px-5 py-4 font-bold text-[#191919] hover:bg-[#F5DC00] disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
              >
                동의하고 가입·로그인 완료
              </button>
            </form>
          )}

          {message && (
            <p className="mt-6 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-center text-sm font-semibold text-amber-800" role="alert">
              {message}
            </p>
          )}

          {!isExchanging && (!canRetry || (!needsConsent && message)) && (
            <div className="mt-6 flex justify-center gap-4 text-sm font-bold">
              {isDeletionError ? (
                isRestoringSession ? (
                  <span className="text-gray-500" role="status">로그인 상태 복원 중</span>
                ) : didRestoreSession ? (
                  <Link to="/account" replace className="text-blue-800 underline underline-offset-4">내 계정으로 돌아가기</Link>
                ) : (
                  <Link to="/login" replace className="text-blue-800 underline underline-offset-4">다시 로그인하기</Link>
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
