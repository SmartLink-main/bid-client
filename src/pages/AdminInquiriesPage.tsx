import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
  MessageSquareReply,
  Save,
  ShieldAlert,
} from 'lucide-react'
import Layout from '../components/Layout'
import { ApiError, getKoreanErrorMessage } from '../lib/api'
import {
  answerInquiry,
  getAdminInquiries,
  type AdminInquiry,
  type AdminInquiryListResponse,
} from '../lib/inquiries'

const PAGE_SIZE = 30

function formatDateTime(value: string | null) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function requesterName(inquiry: AdminInquiry) {
  return inquiry.user.name || inquiry.user.login_id || '이름 없음'
}

function AdminAnswerForm({
  inquiry,
  onUpdated,
}: {
  inquiry: AdminInquiry
  onUpdated: (inquiry: AdminInquiry) => void
}) {
  const [answer, setAnswer] = useState(inquiry.answer ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  const handleAnswer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedAnswer = answer.trim()
    setSaveMessage('')
    if (!normalizedAnswer) {
      setSaveMessage('답변 내용을 입력해 주세요.')
      return
    }

    setIsSaving(true)
    try {
      const updated = await answerInquiry(inquiry.id, normalizedAnswer)
      setAnswer(updated.answer ?? '')
      onUpdated(updated)
      setSaveMessage('답변을 저장했습니다.')
    } catch (error) {
      setSaveMessage(getKoreanErrorMessage(error, '답변을 저장하지 못했습니다.'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form className="border-t border-gray-100 pt-5" onSubmit={handleAnswer}>
      <div className="flex items-end justify-between gap-3">
        <label htmlFor="admin-inquiry-answer" className="text-sm font-extrabold text-slate-700">관리자 답변</label>
        {inquiry.answered_at && <span className="text-xs text-gray-500">최근 답변 {formatDateTime(inquiry.answered_at)}</span>}
      </div>
      <textarea
        id="admin-inquiry-answer"
        value={answer}
        onChange={(event) => setAnswer(event.target.value)}
        rows={8}
        maxLength={4000}
        placeholder="회원에게 전달할 답변을 입력해 주세요"
        className="mt-2 w-full resize-y rounded-xl border border-gray-200 px-4 py-3 text-sm leading-6 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
      />
      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-h-5">
          {saveMessage && <p className={`text-sm font-bold ${saveMessage === '답변을 저장했습니다.' ? 'text-emerald-700' : 'text-red-700'}`} role={saveMessage === '답변을 저장했습니다.' ? 'status' : 'alert'}>{saveMessage}</p>}
        </div>
        <div className="flex items-center justify-end gap-3">
          <span className="text-xs text-gray-400">{answer.length.toLocaleString('ko-KR')}/4,000</span>
          <button type="submit" disabled={isSaving} className="inline-flex items-center gap-2 rounded-xl bg-indigo-700 px-5 py-2.5 text-sm font-extrabold text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:bg-indigo-300">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {inquiry.answer ? '답변 수정' : '답변 등록'}
          </button>
        </div>
      </div>
    </form>
  )
}

export default function AdminInquiriesPage() {
  const [response, setResponse] = useState<AdminInquiryListResponse | null>(null)
  const [offset, setOffset] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [status, setStatus] = useState<number | null>(null)
  const [message, setMessage] = useState('')

  const selectedInquiry = useMemo(
    () => response?.items.find((item) => item.id === selectedId) ?? null,
    [response, selectedId],
  )

  const loadInquiries = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true)
    setStatus(null)
    setMessage('')
    try {
      const nextResponse = await getAdminInquiries({
        limit: PAGE_SIZE,
        offset,
        signal,
      })
      setResponse(nextResponse)
      setSelectedId((current) => (
        nextResponse.items.some((item) => item.id === current)
          ? current
          : (nextResponse.items[0]?.id ?? null)
      ))
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setStatus(error instanceof ApiError ? error.status : null)
      setMessage(getKoreanErrorMessage(error, '문의 목록을 불러오지 못했습니다.'))
      setResponse(null)
    } finally {
      if (!signal?.aborted) setIsLoading(false)
    }
  }, [offset])

  useEffect(() => {
    const controller = new AbortController()
    queueMicrotask(() => {
      if (!controller.signal.aborted) void loadInquiries(controller.signal)
    })
    return () => controller.abort()
  }, [loadInquiries])

  const updateInquiry = (updated: AdminInquiry) => {
    setResponse((current) => current ? {
      ...current,
      items: current.items.map((item) => item.id === updated.id ? updated : item),
    } : current)
  }

  const currentPage = Math.floor(offset / PAGE_SIZE) + 1
  const totalPages = response ? Math.max(1, Math.ceil(response.total / PAGE_SIZE)) : 1
  const hasPrevious = offset > 0
  const hasNext = Boolean(response && offset + response.items.length < response.total)

  return (
    <Layout>
      <div className="w-full flex-grow bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-7xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-indigo-100 bg-white p-2.5 shadow-sm">
                <MessageSquareReply className="h-6 w-6 text-indigo-700" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-slate-900">문의 관리</h1>
                <p className="mt-1 text-sm text-gray-500">관리자만 전체 문의 내용을 확인하고 답변할 수 있습니다.</p>
              </div>
            </div>
            {response && <p className="text-sm font-bold text-gray-500">전체 {response.total.toLocaleString('ko-KR')}건</p>}
          </div>

          {isLoading && (
            <div className="mt-6 flex min-h-72 items-center justify-center rounded-2xl border border-gray-200 bg-white" role="status">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-700" />
              <span className="sr-only">문의 목록을 불러오는 중</span>
            </div>
          )}

          {!isLoading && (status === 401 || status === 403) && (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-sm">
              <ShieldAlert className="mx-auto h-10 w-10 text-amber-600" />
              <h2 className="mt-4 text-xl font-extrabold text-slate-900">{status === 401 ? '로그인이 필요합니다' : '관리자 권한이 필요합니다'}</h2>
              <p className="mt-2 text-sm text-gray-600">관리자로 확인된 계정만 문의 내용과 답변 기능을 사용할 수 있습니다.</p>
            </div>
          )}

          {!isLoading && status !== 401 && status !== 403 && message && (
            <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 p-6 text-center">
              <p className="text-sm font-bold text-red-700" role="alert">{message}</p>
              <button type="button" onClick={() => void loadInquiries()} className="mt-4 rounded-xl bg-red-700 px-5 py-2.5 text-sm font-bold text-white">다시 시도</button>
            </div>
          )}

          {!isLoading && response && (
            <>
              <div className="mt-6 grid min-h-[34rem] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.2fr)]">
                <section className="border-b border-gray-200 lg:border-b-0 lg:border-r" aria-label="문의 목록">
                  {response.items.length === 0 ? (
                    <div className="flex min-h-64 items-center justify-center px-6 text-center text-sm text-gray-500">접수된 문의가 없습니다.</div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {response.items.map((inquiry) => {
                        const selected = inquiry.id === selectedId
                        return (
                          <button
                            key={inquiry.id}
                            type="button"
                            onClick={() => setSelectedId(inquiry.id)}
                            className={`w-full px-5 py-4 text-left transition ${selected ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
                            aria-pressed={selected}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className={`truncate text-sm font-extrabold ${selected ? 'text-indigo-800' : 'text-slate-900'}`}>{inquiry.title}</span>
                              <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-extrabold ${inquiry.status === 'answered' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{inquiry.status === 'answered' ? '답변 완료' : '답변 대기'}</span>
                            </div>
                            <p className="mt-2 truncate text-xs font-bold text-gray-600">{requesterName(inquiry)} <span className="font-normal text-gray-400">· {inquiry.user.login_id ?? '간편가입 계정'}</span></p>
                            <p className="mt-1 flex items-center gap-1 text-xs text-gray-400"><Clock3 className="h-3 w-3" />{formatDateTime(inquiry.created_at)}</p>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </section>

                <section className="min-w-0 p-5 sm:p-6" aria-label="문의 상세와 답변">
                  {!selectedInquiry ? (
                    <div className="flex min-h-64 items-center justify-center text-sm text-gray-500">확인할 문의를 선택해 주세요.</div>
                  ) : (
                    <div>
                      <div className="border-b border-gray-100 pb-5">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <h2 className="break-words text-xl font-extrabold text-slate-900">{selectedInquiry.title}</h2>
                          <span className="shrink-0 text-xs font-bold text-gray-500">{formatDateTime(selectedInquiry.created_at)}</span>
                        </div>
                        <p className="mt-2 text-sm text-gray-600">작성자 <strong className="text-slate-800">{requesterName(selectedInquiry)}</strong> · {selectedInquiry.user.login_id ?? '간편가입 계정'}</p>
                      </div>
                      <div className="py-5">
                        <h3 className="text-sm font-extrabold text-slate-700">문의 내용</h3>
                        <p className="mt-3 min-h-24 whitespace-pre-wrap break-words rounded-xl bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-700">{selectedInquiry.content}</p>
                      </div>
                      <AdminAnswerForm
                        key={selectedInquiry.id}
                        inquiry={selectedInquiry}
                        onUpdated={updateInquiry}
                      />
                    </div>
                  )}
                </section>
              </div>

              {response.total > PAGE_SIZE && (
                <div className="mt-5 flex items-center justify-center gap-4">
                  <button type="button" disabled={!hasPrevious} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))} className="rounded-lg border border-gray-200 bg-white p-2 text-gray-700 disabled:text-gray-300" aria-label="이전 페이지"><ChevronLeft className="h-5 w-5" /></button>
                  <span className="text-sm font-bold text-gray-600">{currentPage} / {totalPages}</span>
                  <button type="button" disabled={!hasNext} onClick={() => setOffset(offset + PAGE_SIZE)} className="rounded-lg border border-gray-200 bg-white p-2 text-gray-700 disabled:text-gray-300" aria-label="다음 페이지"><ChevronRight className="h-5 w-5" /></button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  )
}
