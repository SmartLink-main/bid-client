import { type FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, KeyRound, Link2, ShieldCheck, UserRound } from 'lucide-react'
import Layout from '../components/Layout'
import { ApiError, getApiUrl, getKoreanErrorMessage } from '../lib/api'
import {
  AUTH_METHOD,
  deleteMe,
  startKakaoAccountDeletion,
  startKakaoAccountLink,
  type AppUser,
} from '../lib/auth'
import { clearAuthSession } from '../lib/session'
import { useAuthSession } from '../hooks/useAuthSession'

const ACCESS_GROUP_LABELS: Record<AppUser['access_group'], string> = {
  general: '일반 회원',
  supporter: '서포터',
  legal_agent: '법률 대리인',
  admin: '관리자',
}

function formatPhoneNumber(phoneNumber: string | null) {
  if (!phoneNumber) {
    return '미등록'
  }
  if (/^\d{11}$/.test(phoneNumber)) {
    return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3, 7)}-${phoneNumber.slice(7)}`
  }
  return phoneNumber
}

function formatDateTime(value: string | null) {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('ko-KR', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date)
}

function isKakaoAuthorizationUrl(value: string) {
  try {
    const target = new URL(value)
    const apiOrigin = new URL(getApiUrl('/'), window.location.origin).origin
    const isOfficialKakaoAuthorization = (
      target.origin === 'https://kauth.kakao.com' &&
      target.pathname === '/oauth/authorize'
    )
    const isLoopbackE2eAuthorization = (
      import.meta.env.DEV &&
      ['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname) &&
      target.origin === apiOrigin &&
      target.pathname === '/__e2e__/kakao/authorize'
    )
    return (
      (isOfficialKakaoAuthorization || isLoopbackE2eAuthorization) &&
      !target.username &&
      !target.password
    )
  } catch {
    return false
  }
}

export default function AccountPage() {
  const session = useAuthSession()
  const user = session?.user as AppUser | undefined
  const externalAuthMethods = user?.auth_methods.filter(
    (method) => method !== AUTH_METHOD.PASSWORD,
  ) ?? []
  const hasKakao = externalAuthMethods.includes(AUTH_METHOD.KAKAO)
  const canDeleteWithKakao = (
    externalAuthMethods.length === 1 && hasKakao
  )
  const canDeleteWithPassword = Boolean(
    user?.has_password && externalAuthMethods.length === 0,
  )
  const [password, setPassword] = useState('')
  const [linkPassword, setLinkPassword] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [isLinkingKakao, setIsLinkingKakao] = useState(false)
  const [message, setMessage] = useState('')

  const handleDeleteAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage('')

    if (!password) {
      setMessage('현재 비밀번호를 입력해 주세요.')
      return
    }
    if (!window.confirm('회원 정보가 즉시 삭제되며 되돌릴 수 없습니다. 정말 탈퇴하시겠습니까?')) {
      return
    }

    setIsDeleting(true)
    try {
      await deleteMe({ password })
      clearAuthSession()
      window.location.replace('/')
    } catch (error) {
      if (
        error instanceof ApiError &&
        [401, 403].includes(error.status) &&
        ['invalid current password.', 'invalid login credentials.'].includes(
          error.message.trim().toLowerCase(),
        )
      ) {
        setMessage('현재 비밀번호가 올바르지 않습니다.')
      } else {
        setMessage(getKoreanErrorMessage(error, '회원 탈퇴에 실패했습니다.'))
      }
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteKakaoAccount = async () => {
    setMessage('')
    if (!window.confirm('카카오 재인증 후 서비스 연결과 회원 정보가 삭제됩니다. 계속할까요?')) {
      return
    }

    setIsDeleting(true)
    try {
      const response = await startKakaoAccountDeletion()
      if (!isKakaoAuthorizationUrl(response.authorization_url)) {
        throw new Error('카카오 재인증 주소를 확인할 수 없습니다.')
      }
      window.location.assign(response.authorization_url)
    } catch (error) {
      setMessage(getKoreanErrorMessage(error, '카카오 재인증 탈퇴를 시작하지 못했습니다.'))
      setIsDeleting(false)
    }
  }

  const handleStartKakaoLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage('')
    if (!linkPassword) {
      setMessage('현재 비밀번호를 입력해 주세요.')
      return
    }

    setIsLinkingKakao(true)
    try {
      const response = await startKakaoAccountLink({
        password: linkPassword,
        return_to: '/account',
      })
      if (!isKakaoAuthorizationUrl(response.authorization_url)) {
        throw new Error('카카오 인증 주소를 확인할 수 없습니다.')
      }
      window.location.assign(response.authorization_url)
    } catch (error) {
      if (
        error instanceof ApiError &&
        [401, 403].includes(error.status)
      ) {
        setMessage('현재 비밀번호가 올바르지 않습니다.')
      } else {
        setMessage(getKoreanErrorMessage(error, '카카오 연결을 시작하지 못했습니다.'))
      }
      setIsLinkingKakao(false)
    }
  }

  if (!session) {
    return (
      <Layout>
        <div className="flex w-full flex-grow items-center justify-center px-4 py-16">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <UserRound className="mx-auto h-10 w-10 text-blue-800" />
            <h1 className="mt-4 text-2xl font-extrabold text-slate-900">내 계정</h1>
            <p className="mt-2 text-sm text-gray-500">회원 정보를 확인하려면 로그인이 필요합니다.</p>
            <Link to="/login" className="mt-6 inline-flex rounded-xl bg-blue-800 px-6 py-3 text-sm font-bold text-white hover:bg-blue-700">
              로그인하기
            </Link>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="w-full flex-grow bg-slate-50 px-4 py-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-gray-100 bg-white p-2.5 shadow-sm">
              <UserRound className="h-6 w-6 text-blue-800" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900">내 계정</h1>
              <p className="mt-1 text-sm text-gray-500">서버에 저장된 최신 회원 정보를 확인합니다.</p>
            </div>
          </div>

          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm" aria-labelledby="profile-heading">
            <h2 id="profile-heading" className="flex items-center gap-2 text-lg font-extrabold text-slate-900">
              <ShieldCheck className="h-5 w-5 text-blue-700" /> 회원 정보
            </h2>

            {user && (
              <dl className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <div><dt className="text-xs font-bold text-gray-400">이름</dt><dd className="mt-1 font-semibold text-slate-800">{user.name || '-'}</dd></div>
                <div><dt className="text-xs font-bold text-gray-400">아이디</dt><dd className="mt-1 font-semibold text-slate-800">{user.login_id ?? '간편가입 계정'}</dd></div>
                <div><dt className="text-xs font-bold text-gray-400">휴대폰 번호</dt><dd className="mt-1 font-semibold text-slate-800">{formatPhoneNumber(user.phone_number)}</dd></div>
                <div><dt className="text-xs font-bold text-gray-400">회원 유형</dt><dd className="mt-1 font-semibold text-slate-800">{ACCESS_GROUP_LABELS[user.access_group]}</dd></div>
                <div><dt className="text-xs font-bold text-gray-400">가입 일시</dt><dd className="mt-1 font-semibold text-slate-800">{formatDateTime(user.created_at)}</dd></div>
                <div><dt className="text-xs font-bold text-gray-400">최근 로그인</dt><dd className="mt-1 font-semibold text-slate-800">{formatDateTime(user.last_login_at)}</dd></div>
              </dl>
            )}
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm" aria-labelledby="kakao-link-heading">
            <h2 id="kakao-link-heading" className="flex items-center gap-2 text-lg font-extrabold text-slate-900">
              <Link2 className="h-5 w-5 text-[#8A7600]" /> 카카오 로그인 연결
            </h2>
            {hasKakao ? (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-extrabold">카카오 로그인이 연결되어 있습니다.</p>
                  <p className="mt-1 leading-relaxed text-emerald-800">기존 계정 정보는 그대로 유지되며 카카오로도 로그인할 수 있습니다.</p>
                </div>
              </div>
            ) : user?.has_password ? (
              <>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                  현재 비밀번호로 본인 확인을 한 뒤 카카오 인증을 완료하면 이 계정에 카카오 로그인이 추가됩니다. 이름이나 같은 이름의 계정으로 자동 연결하지 않습니다.
                </p>
                <form className="mt-5 flex flex-col gap-3 sm:flex-row" onSubmit={handleStartKakaoLink}>
                  <div className="group relative min-w-0 flex-1">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                      <KeyRound className="h-4 w-4 text-gray-400" aria-hidden="true" />
                    </div>
                    <label htmlFor="kakao-link-current-password" className="sr-only">현재 비밀번호</label>
                    <input
                      id="kakao-link-current-password"
                      type="password"
                      value={linkPassword}
                      onChange={(event) => setLinkPassword(event.target.value)}
                      minLength={1}
                      maxLength={50}
                      autoComplete="current-password"
                      placeholder="현재 비밀번호"
                      disabled={isLinkingKakao || isDeleting}
                      className="w-full rounded-xl border border-gray-200 py-3 pl-11 pr-4 text-sm outline-none focus:border-[#B59B00] focus:ring-2 focus:ring-yellow-100 disabled:bg-gray-100"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isLinkingKakao || isDeleting || !linkPassword}
                    className="rounded-xl bg-[#FEE500] px-5 py-3 text-sm font-extrabold text-[#191919] hover:bg-[#F5DC00] disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
                  >
                    {isLinkingKakao ? '카카오로 이동 중' : '카카오 계정 연결'}
                  </button>
                </form>
              </>
            ) : (
              <p className="mt-3 rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-600">
                이 계정은 현재 비밀번호 재인증을 사용할 수 없어 카카오 연결을 시작할 수 없습니다.
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm" aria-labelledby="delete-heading">
            <h2 id="delete-heading" className="flex items-center gap-2 text-lg font-extrabold text-red-700">
              <AlertTriangle className="h-5 w-5" /> 회원 탈퇴
            </h2>
            {canDeleteWithKakao ? (
              <>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                  카카오에서 다시 로그인해 본인을 확인한 뒤, 카카오 서비스 연결을 해제하고 회원 정보를 삭제합니다.
                </p>
                <button
                  type="button"
                  onClick={() => void handleDeleteKakaoAccount()}
                  disabled={isDeleting || isLinkingKakao}
                  className="mt-5 rounded-xl bg-red-600 px-5 py-3 text-sm font-extrabold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  {isDeleting ? '카카오로 이동 중' : '카카오 재인증 후 탈퇴'}
                </button>
              </>
            ) : canDeleteWithPassword ? (
              <>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                  현재 비밀번호를 확인한 뒤 회원 레코드를 즉시 삭제합니다. 기존 로그인 토큰도 더 이상 사용할 수 없습니다.
                </p>
                <form className="mt-5 flex flex-col gap-3 sm:flex-row" onSubmit={handleDeleteAccount}>
                  <label htmlFor="delete-account-password" className="sr-only">현재 비밀번호</label>
                  <input
                    id="delete-account-password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    minLength={1}
                    maxLength={50}
                    autoComplete="current-password"
                    placeholder="현재 비밀번호"
                    disabled={isDeleting || isLinkingKakao}
                    className="min-w-0 flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 disabled:bg-gray-100"
                  />
                  <button
                    type="submit"
                    disabled={isDeleting || isLinkingKakao || !password}
                    className="rounded-xl bg-red-600 px-5 py-3 text-sm font-extrabold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    {isDeleting ? '탈퇴 처리 중' : '회원 탈퇴'}
                  </button>
                </form>
              </>
            ) : (
              <p className="mt-3 text-sm leading-relaxed text-gray-600">
                연결된 간편로그인을 안전하게 재인증할 수 없어 온라인 탈퇴를 진행할 수 없습니다. 고객지원에 문의해 주세요.
              </p>
            )}
          </section>

          {message && (
            <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-center text-sm font-bold text-red-700" role="alert">
              {message}
            </p>
          )}
        </div>
      </div>
    </Layout>
  )
}
