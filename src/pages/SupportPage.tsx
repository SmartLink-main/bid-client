import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import {
  CheckCircle2,
  Clock3,
  Headphones,
  Loader2,
  MessageSquareText,
  Send,
} from 'lucide-react'
import Layout from '../components/Layout'
import { getKoreanErrorMessage } from '../lib/api'
import {
  createInquiry,
  getMyInquiries,
  type Inquiry,
} from '../lib/inquiries'

const PAGE_SIZE = 50

type InquiryLoadOptions = {
  append?: boolean
  offset?: number
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function StatusBadge({ status }: { status: Inquiry['status'] }) {
  const answered = status === 'answered'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-extrabold ${answered ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
      {answered ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
      {answered ? '답변 완료' : '답변 대기'}
    </span>
  )
}

export default function SupportPage() {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [items, setItems] = useState<Inquiry[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loadMessage, setLoadMessage] = useState('')
  const [formMessage, setFormMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const activeLoadController = useRef<AbortController | null>(null)
  const activeSubmitController = useRef<AbortController | null>(null)
  const loadGeneration = useRef(0)

  const cancelActiveLoad = useCallback(() => {
    loadGeneration.current += 1
    activeLoadController.current?.abort()
    activeLoadController.current = null
  }, [])

  const loadInquiries = useCallback(async ({
    append = false,
    offset = 0,
  }: InquiryLoadOptions = {}) => {
    cancelActiveLoad()
    const controller = new AbortController()
    const generation = loadGeneration.current
    activeLoadController.current = controller

    if (append) {
      setIsLoadingMore(true)
    } else {
      setIsLoading(true)
    }
    setLoadMessage('')
    try {
      const response = await getMyInquiries({
        limit: PAGE_SIZE,
        offset,
        signal: controller.signal,
      })
      if (controller.signal.aborted || generation !== loadGeneration.current) return

      setItems((current) => {
        if (!append) return response.items

        const knownIds = new Set(current.map((inquiry) => inquiry.id))
        return [
          ...current,
          ...response.items.filter((inquiry) => !knownIds.has(inquiry.id)),
        ]
      })
      setTotal(response.total)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      if (controller.signal.aborted || generation !== loadGeneration.current) return
      setLoadMessage(getKoreanErrorMessage(error, '문의 내역을 불러오지 못했습니다.'))
    } finally {
      if (generation === loadGeneration.current) {
        if (activeLoadController.current === controller) {
          activeLoadController.current = null
        }
        if (append) {
          setIsLoadingMore(false)
        } else {
          setIsLoading(false)
        }
      }
    }
  }, [cancelActiveLoad])

  useEffect(() => {
    let isActive = true
    queueMicrotask(() => {
      if (isActive) void loadInquiries()
    })
    return () => {
      isActive = false
      cancelActiveLoad()
      activeSubmitController.current?.abort()
      activeSubmitController.current = null
    }
  }, [cancelActiveLoad, loadInquiries])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedTitle = title.trim()
    const normalizedContent = content.trim()
    setFormMessage('')
    setSuccessMessage('')
    if (!normalizedTitle || !normalizedContent) {
      setFormMessage('제목과 문의 내용을 모두 입력해 주세요.')
      return
    }

    setIsSubmitting(true)
    const submitController = new AbortController()
    activeSubmitController.current?.abort()
    activeSubmitController.current = submitController
    try {
      const inquiry = await createInquiry({
        title: normalizedTitle,
        content: normalizedContent,
      }, submitController.signal)
      cancelActiveLoad()
      setIsLoading(false)
      setIsLoadingMore(false)
      setLoadMessage('')
      setItems((current) => (
        current.some((item) => item.id === inquiry.id)
          ? current.map((item) => item.id === inquiry.id ? inquiry : item)
          : [inquiry, ...current]
      ))
      setTotal((current) => current + 1)
      setTitle('')
      setContent('')
      setSuccessMessage('문의가 접수되었습니다. 이 화면에서 답변을 확인할 수 있습니다.')
      await loadInquiries()
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setFormMessage(getKoreanErrorMessage(error, '문의를 접수하지 못했습니다.'))
    } finally {
      if (activeSubmitController.current === submitController) {
        activeSubmitController.current = null
      }
      if (!submitController.signal.aborted) setIsSubmitting(false)
    }
  }

  const hasMore = items.length < total

  return (
    <Layout>
      <div className="w-full flex-grow bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-6xl">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-blue-100 bg-white p-2.5 shadow-sm">
              <Headphones className="h-6 w-6 text-blue-700" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900">1:1 문의</h1>
              <p className="mt-1 text-sm text-gray-500">궁금한 내용을 남기면 관리자가 확인한 뒤 답변합니다.</p>
            </div>
          </div>

          <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6" aria-labelledby="inquiry-form-heading">
              <div className="flex items-center gap-2">
                <MessageSquareText className="h-5 w-5 text-blue-700" />
                <h2 id="inquiry-form-heading" className="text-lg font-extrabold text-slate-900">문의 작성</h2>
              </div>
              <form className="mt-5 space-y-5" onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="inquiry-title" className="text-sm font-bold text-slate-700">제목</label>
                  <input
                    id="inquiry-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    maxLength={100}
                    placeholder="문의 제목을 입력해 주세요"
                    className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                  <p className="mt-1 text-right text-xs text-gray-400">{title.length}/100</p>
                </div>
                <div>
                  <label htmlFor="inquiry-content" className="text-sm font-bold text-slate-700">문의 내용</label>
                  <textarea
                    id="inquiry-content"
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    maxLength={4000}
                    rows={9}
                    placeholder="확인이 필요한 내용을 구체적으로 작성해 주세요"
                    className="mt-2 w-full resize-y rounded-xl border border-gray-200 px-4 py-3 text-sm leading-6 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                  <p className="mt-1 text-right text-xs text-gray-400">{content.length.toLocaleString('ko-KR')}/4,000</p>
                </div>

                {formMessage && <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700" role="alert">{formMessage}</p>}
                {successMessage && <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700" role="status">{successMessage}</p>}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-extrabold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-300"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {isSubmitting ? '접수 중' : '문의 접수'}
                </button>
              </form>
            </section>

            <section aria-labelledby="my-inquiries-heading">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h2 id="my-inquiries-heading" className="text-lg font-extrabold text-slate-900">내 문의</h2>
                  <p className="mt-1 text-sm text-gray-500">본인이 작성한 문의와 관리자 답변만 표시됩니다.</p>
                </div>
                {!isLoading && <span className="shrink-0 text-sm font-bold text-gray-500">전체 {total.toLocaleString('ko-KR')}건</span>}
              </div>

              {isLoading && (
                <div className="mt-4 flex min-h-60 items-center justify-center rounded-2xl border border-gray-200 bg-white" role="status">
                  <Loader2 className="h-7 w-7 animate-spin text-blue-700" />
                  <span className="sr-only">문의 내역을 불러오는 중</span>
                </div>
              )}

              {!isLoading && loadMessage && items.length === 0 && (
                <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-6 text-center">
                  <p className="text-sm font-bold text-red-700" role="alert">{loadMessage}</p>
                  <button type="button" onClick={() => void loadInquiries()} className="mt-4 rounded-xl bg-red-700 px-5 py-2.5 text-sm font-bold text-white">다시 시도</button>
                </div>
              )}

              {!isLoading && !loadMessage && items.length === 0 && (
                <div className="mt-4 rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
                  <MessageSquareText className="mx-auto h-9 w-9 text-gray-300" />
                  <p className="mt-3 font-bold text-slate-700">아직 접수한 문의가 없습니다.</p>
                  <p className="mt-1 text-sm text-gray-500">왼쪽 작성란에서 첫 문의를 남겨보세요.</p>
                </div>
              )}

              {!isLoading && items.length > 0 && (
                <div className="mt-4 space-y-4">
                  {items.map((inquiry) => (
                    <article key={inquiry.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                      <div className="flex flex-col gap-2 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <h3 className="break-words font-extrabold text-slate-900">{inquiry.title}</h3>
                          <p className="mt-1 text-xs text-gray-500">{formatDateTime(inquiry.created_at)}</p>
                        </div>
                        <StatusBadge status={inquiry.status} />
                      </div>
                      <div className="px-5 py-4">
                        <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{inquiry.content}</p>
                        <div className={`mt-4 rounded-xl px-4 py-3 ${inquiry.answer ? 'bg-blue-50' : 'bg-slate-50'}`}>
                          <p className={`text-xs font-extrabold ${inquiry.answer ? 'text-blue-700' : 'text-gray-500'}`}>관리자 답변</p>
                          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
                            {inquiry.answer || '답변을 준비하고 있습니다.'}
                          </p>
                          {inquiry.answered_at && <p className="mt-2 text-xs text-gray-500">{formatDateTime(inquiry.answered_at)}</p>}
                        </div>
                      </div>
                    </article>
                  ))}

                  {loadMessage && (
                    <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-center">
                      <p className="text-sm font-bold text-red-700" role="alert">{loadMessage}</p>
                    </div>
                  )}

                  {hasMore && (
                    <button
                      type="button"
                      disabled={isLoadingMore}
                      onClick={() => void loadInquiries({ append: true, offset: items.length })}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-5 py-3 text-sm font-extrabold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:text-blue-300"
                    >
                      {isLoadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                      {isLoadingMore
                        ? '이전 문의를 불러오는 중'
                        : `이전 문의 더 보기 (${items.length.toLocaleString('ko-KR')}/${total.toLocaleString('ko-KR')})`}
                    </button>
                  )}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </Layout>
  )
}
