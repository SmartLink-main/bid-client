import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import {
  BadgeCheck,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Send,
} from 'lucide-react'
import { useAuthSession } from '../hooks/useAuthSession'
import { getKoreanErrorMessage } from '../lib/api'
import type { AppUser } from '../lib/auth'
import {
  createGoodsComment,
  getGoodsComments,
  getNextGoodsCommentOffset,
  type GoodsComment,
  type GoodsCommentAuthorRole,
} from '../lib/goods-comments'

const PAGE_SIZE = 20
const COMMENT_MAX_LENGTH = 2_000

type CommentLoadOptions = {
  append?: boolean
  offset?: number
}

const ROLE_LABELS: Record<GoodsCommentAuthorRole, string> = {
  legal_agent: '법무사',
  admin: '관리자',
}

function canCreateComment(
  user: AppUser | undefined,
): user is AppUser & { access_group: GoodsCommentAuthorRole } {
  return user?.access_group === 'legal_agent' || user?.access_group === 'admin'
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function CommentCard({ comment }: { comment: GoodsComment }) {
  return (
    <article className="rounded-xl border border-gray-200 bg-slate-50 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-extrabold ${comment.author.access_group === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}>
            <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {comment.author.label}
          </span>
        </div>
        <time dateTime={comment.created_at} className="shrink-0 text-xs text-gray-500">
          {formatDateTime(comment.created_at)}
        </time>
      </div>
      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
        {comment.content}
      </p>
    </article>
  )
}

export default function GoodsCommentsSection({
  auctionGoodsId,
}: {
  auctionGoodsId: number | string
}) {
  const authSession = useAuthSession()
  const user = authSession?.user as AppUser | undefined
  const isWriter = canCreateComment(user)
  const [content, setContent] = useState('')
  const [comments, setComments] = useState<GoodsComment[]>([])
  const [total, setTotal] = useState(0)
  const [nextOffset, setNextOffset] = useState(0)
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

  const loadComments = useCallback(async ({
    append = false,
    offset = 0,
  }: CommentLoadOptions = {}) => {
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
      const response = await getGoodsComments(auctionGoodsId, {
        limit: PAGE_SIZE,
        offset,
        signal: controller.signal,
      })
      if (controller.signal.aborted || generation !== loadGeneration.current) return

      setComments((current) => {
        if (!append) return response.items

        const knownIds = new Set(current.map((comment) => comment.id))
        return [
          ...current,
          ...response.items.filter((comment) => !knownIds.has(comment.id)),
        ]
      })
      setTotal(response.total)
      setNextOffset(getNextGoodsCommentOffset(response))
    } catch (error) {
      if (controller.signal.aborted || generation !== loadGeneration.current) return
      setLoadMessage(getKoreanErrorMessage(error, '댓글을 불러오지 못했습니다.'))
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
  }, [auctionGoodsId, cancelActiveLoad])

  useEffect(() => {
    let isActive = true
    queueMicrotask(() => {
      if (isActive) void loadComments()
    })

    return () => {
      isActive = false
      cancelActiveLoad()
      activeSubmitController.current?.abort()
      activeSubmitController.current = null
    }
  }, [cancelActiveLoad, loadComments])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedContent = content.trim()
    setFormMessage('')
    setSuccessMessage('')

    if (!normalizedContent) {
      setFormMessage('댓글 내용을 입력해 주세요.')
      return
    }
    if (normalizedContent.length > COMMENT_MAX_LENGTH) {
      setFormMessage('댓글은 2,000자 이내로 작성해 주세요.')
      return
    }

    setIsSubmitting(true)
    const controller = new AbortController()
    activeSubmitController.current?.abort()
    activeSubmitController.current = controller

    try {
      const createdComment = await createGoodsComment(
        auctionGoodsId,
        normalizedContent,
        controller.signal,
      )
      if (controller.signal.aborted) return

      cancelActiveLoad()
      setIsLoading(false)
      setIsLoadingMore(false)
      setLoadMessage('')
      setComments((current) => [
        createdComment,
        ...current.filter((comment) => comment.id !== createdComment.id),
      ])
      setTotal((current) => current + 1)
      setContent('')
      setSuccessMessage('댓글이 등록되었습니다.')
      void loadComments()
    } catch (error) {
      if (controller.signal.aborted) return
      setFormMessage(getKoreanErrorMessage(error, '댓글을 등록하지 못했습니다.'))
    } finally {
      if (activeSubmitController.current === controller) {
        activeSubmitController.current = null
      }
      if (!controller.signal.aborted) {
        setIsSubmitting(false)
      }
    }
  }

  const hasMore = nextOffset < total
  const counterId = 'goods-comment-content-counter'

  return (
    <section
      aria-labelledby="goods-comments-heading"
      className="scroll-mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm md:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="goods-comments-heading" className="flex items-center gap-2 text-lg font-extrabold text-slate-900">
            <MessageSquareText className="h-5 w-5 text-indigo-700" aria-hidden="true" />
            전문가 댓글
          </h2>
          <p className="mt-1 text-sm leading-6 text-gray-500">
            인증된 법무사와 관리자가 이 물건에 관해 남긴 안내입니다.
          </p>
        </div>
        {!isLoading && (
          <span className="text-sm font-bold text-gray-500">
            전체 {total.toLocaleString('ko-KR')}건
          </span>
        )}
      </div>

      {isWriter && (
        <form className="mt-5 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 sm:p-5" onSubmit={handleSubmit}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="goods-comment-content" className="text-sm font-extrabold text-slate-800">
              댓글 내용
            </label>
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-extrabold text-indigo-700">
              {ROLE_LABELS[user.access_group as GoodsCommentAuthorRole]}
            </span>
          </div>
          <textarea
            id="goods-comment-content"
            aria-describedby={counterId}
            value={content}
            onChange={(event) => {
              setContent(event.target.value)
              setFormMessage('')
              setSuccessMessage('')
            }}
            maxLength={COMMENT_MAX_LENGTH}
            rows={5}
            placeholder="물건 확인에 도움이 되는 내용을 작성해 주세요"
            className="mt-3 w-full resize-y rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm leading-6 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
          <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
            <p id={counterId} className="text-xs text-gray-500">
              {content.length.toLocaleString('ko-KR')}/2,000자
            </p>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-700 px-5 py-2.5 text-sm font-extrabold text-white transition hover:bg-indigo-800 disabled:cursor-not-allowed disabled:bg-indigo-300"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
              {isSubmitting ? '등록 중' : '댓글 등록'}
            </button>
          </div>
          {formMessage && (
            <p className="mt-3 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700" role="alert">
              {formMessage}
            </p>
          )}
          {successMessage && (
            <p className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700" role="status">
              {successMessage}
            </p>
          )}
        </form>
      )}

      <div className="mt-5">
        {isLoading && comments.length === 0 && (
          <div className="flex min-h-32 items-center justify-center rounded-xl border border-gray-200 bg-slate-50" role="status">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-700" aria-hidden="true" />
            <span className="sr-only">댓글을 불러오는 중</span>
          </div>
        )}

        {!isLoading && loadMessage && comments.length === 0 && (
          <div className="rounded-xl border border-red-100 bg-red-50 p-5 text-center">
            <p className="text-sm font-bold text-red-700" role="alert">{loadMessage}</p>
            <button
              type="button"
              onClick={() => void loadComments()}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-red-700 px-4 py-2 text-xs font-extrabold text-white hover:bg-red-800"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> 댓글 다시 시도
            </button>
          </div>
        )}

        {!isLoading && !loadMessage && comments.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-300 bg-slate-50 px-5 py-10 text-center">
            <MessageSquareText className="mx-auto h-8 w-8 text-gray-300" aria-hidden="true" />
            <p className="mt-3 text-sm font-bold text-slate-700">아직 등록된 전문가 댓글이 없습니다.</p>
          </div>
        )}

        {comments.length > 0 && (
          <div className="space-y-3">
            {comments.map((comment) => (
              <CommentCard key={comment.id} comment={comment} />
            ))}

            {loadMessage && (
              <p className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700" role="alert">
                {loadMessage}
              </p>
            )}

            {hasMore && (
              <button
                type="button"
                disabled={isLoadingMore}
                onClick={() => void loadComments({ append: true, offset: nextOffset })}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-white px-5 py-3 text-sm font-extrabold text-indigo-700 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:text-indigo-300"
              >
                {isLoadingMore && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {isLoadingMore
                  ? '댓글을 더 불러오는 중'
                  : `댓글 더 보기 (${comments.length.toLocaleString('ko-KR')}/${total.toLocaleString('ko-KR')})`}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
