import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Loader2, ShieldAlert, UsersRound } from 'lucide-react'
import Layout from '../components/Layout'
import { getAdminUsers, type AdminUserListResponse } from '../lib/admin'
import { ApiError, getKoreanErrorMessage } from '../lib/api'

const PAGE_SIZE = 50

function formatDateTime(value: string | null) {
  if (!value) {
    return '-'
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('ko-KR', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(date)
}

function formatPhoneNumber(value: string | null) {
  if (!value) {
    return '-'
  }
  return /^\d{11}$/.test(value)
    ? `${value.slice(0, 3)}-${value.slice(3, 7)}-${value.slice(7)}`
    : value
}

export default function AdminUsersPage() {
  const [offset, setOffset] = useState(0)
  const [response, setResponse] = useState<AdminUserListResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<number | null>(null)

  const loadUsers = useCallback(async () => {
    setIsLoading(true)
    setMessage('')
    setStatus(null)
    try {
      const result = await getAdminUsers({ limit: PAGE_SIZE, offset })
      setResponse(result)
    } catch (error) {
      if (error instanceof ApiError) {
        setStatus(error.status)
      }
      setResponse(null)
      setMessage(getKoreanErrorMessage(error, '회원 목록을 불러오지 못했습니다.'))
    } finally {
      setIsLoading(false)
    }
  }, [offset])

  useEffect(() => {
    let isActive = true
    getAdminUsers({ limit: PAGE_SIZE, offset })
      .then((result) => {
        if (isActive) {
          setResponse(result)
        }
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return
        }
        if (error instanceof ApiError) {
          setStatus(error.status)
        }
        setResponse(null)
        setMessage(getKoreanErrorMessage(error, '회원 목록을 불러오지 못했습니다.'))
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false)
        }
      })

    return () => {
      isActive = false
    }
  }, [offset])

  const changeOffset = (nextOffset: number) => {
    setIsLoading(true)
    setMessage('')
    setStatus(null)
    setOffset(nextOffset)
  }

  const currentPage = response ? Math.floor(response.offset / response.limit) + 1 : Math.floor(offset / PAGE_SIZE) + 1
  const totalPages = response ? Math.max(1, Math.ceil(response.total / response.limit)) : 1
  const hasPrevious = offset > 0
  const hasNext = Boolean(response && response.offset + response.items.length < response.total)

  return (
    <Layout>
      <div className="w-full flex-grow bg-slate-50 px-4 py-8">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-gray-100 bg-white p-2.5 shadow-sm">
                <UsersRound className="h-6 w-6 text-indigo-700" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-slate-900">회원 관리</h1>
                <p className="mt-1 text-sm text-gray-500">현재 DB에서 확인된 관리자만 회원 목록을 조회할 수 있습니다.</p>
              </div>
            </div>
            {response && (
              <p className="text-sm font-bold text-gray-500">전체 {response.total.toLocaleString('ko-KR')}명</p>
            )}
          </div>

          {isLoading && (
            <div className="flex min-h-72 items-center justify-center rounded-2xl border border-gray-200 bg-white" role="status">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-700" />
              <span className="sr-only">회원 목록을 불러오는 중</span>
            </div>
          )}

          {!isLoading && (status === 401 || status === 403) && (
            <div className="rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-sm">
              <ShieldAlert className="mx-auto h-10 w-10 text-amber-600" />
              <h2 className="mt-4 text-xl font-extrabold text-slate-900">
                {status === 401 ? '로그인이 필요합니다' : '관리자 권한이 필요합니다'}
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                {status === 401
                  ? '관리자 계정으로 다시 로그인해 주세요.'
                  : '서버에서 현재 회원의 관리자 접근 권한을 확인하지 못했습니다.'}
              </p>
              {status === 401 && (
                <Link to="/login" className="mt-5 inline-flex rounded-xl bg-indigo-700 px-6 py-3 text-sm font-bold text-white hover:bg-indigo-800">
                  로그인하기
                </Link>
              )}
            </div>
          )}

          {!isLoading && status !== 401 && status !== 403 && message && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
              <p className="text-sm font-bold text-red-700" role="alert">{message}</p>
              <button type="button" onClick={() => void loadUsers()} className="mt-4 rounded-xl bg-red-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-800">
                다시 시도
              </button>
            </div>
          )}

          {!isLoading && response && (
            <>
              <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
                <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-5 py-3 font-extrabold">아이디 / 이름</th>
                      <th className="px-5 py-3 font-extrabold">휴대폰 번호</th>
                      <th className="px-5 py-3 font-extrabold">접근 그룹</th>
                      <th className="px-5 py-3 font-extrabold">가입 일시</th>
                      <th className="px-5 py-3 font-extrabold">최근 로그인</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {response.items.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50">
                        <td className="whitespace-nowrap px-5 py-4"><span className="font-bold text-slate-900">{user.login_id || '카카오 가입'}</span><span className="ml-2 text-gray-500">{user.name || '-'}</span></td>
                        <td className="whitespace-nowrap px-5 py-4 text-gray-700">{formatPhoneNumber(user.phone_number)}</td>
                        <td className="whitespace-nowrap px-5 py-4"><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-extrabold text-indigo-700">{user.access_group}</span></td>
                        <td className="whitespace-nowrap px-5 py-4 text-gray-600">{formatDateTime(user.created_at)}</td>
                        <td className="whitespace-nowrap px-5 py-4 text-gray-600">{formatDateTime(user.last_login_at)}</td>
                      </tr>
                    ))}
                    {response.items.length === 0 && (
                      <tr><td colSpan={5} className="px-5 py-12 text-center text-gray-500">표시할 회원이 없습니다.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-center gap-4">
                <button
                  type="button"
                  disabled={!hasPrevious}
                  onClick={() => changeOffset(Math.max(0, offset - PAGE_SIZE))}
                  className="rounded-lg border border-gray-200 bg-white p-2 text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-300"
                  aria-label="이전 페이지"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="text-sm font-bold text-gray-600">{currentPage} / {totalPages}</span>
                <button
                  type="button"
                  disabled={!hasNext}
                  onClick={() => changeOffset(offset + PAGE_SIZE)}
                  className="rounded-lg border border-gray-200 bg-white p-2 text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-300"
                  aria-label="다음 페이지"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  )
}
