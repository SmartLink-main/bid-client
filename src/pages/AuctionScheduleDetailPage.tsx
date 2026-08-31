import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Gavel,
  Loader2,
  MapPin,
  Phone,
} from 'lucide-react'
import Layout from '../components/Layout'
import {
  getAuctionDetailPageUrl,
  getAuctionScheduleDetail,
  type AuctionScheduleDetail,
  type AuctionScheduleGoods,
} from '../lib/auction-extra'
import { getKoreanErrorMessage } from '../lib/api'
import { getText } from '../lib/format'

const GOODS_PAGE_SIZE = 10

function GoodsNoticeCard({ goods }: { goods: AuctionScheduleGoods }) {
  return (
    <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-indigo-50 px-2 py-1 text-xs font-extrabold text-indigo-700">물건 {goods.disposal_goods_sequence}</span>
            <span className="text-sm font-bold text-slate-600">{getText(goods.progress_status_name, '진행상태 미확인')}</span>
          </div>
          <h2 className="mt-3 text-lg font-extrabold text-slate-900">{getText(goods.case_name, '사건명 없음')}</h2>
          {(goods.result_division_name || goods.result_date) && (
            <p className="mt-1 text-sm text-gray-500">결과: {getText(goods.result_division_name)} · {getText(goods.result_date)}</p>
          )}
        </div>
        <Link to={`/goods/${goods.auction_goods_id}`} className="inline-flex shrink-0 items-center justify-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-extrabold text-white hover:bg-indigo-700">
          물건 상세 <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-4 border-t border-gray-100 pt-4">
        <h3 className="text-sm font-extrabold text-slate-800">정정·취하·변경 내역</h3>
        {goods.notice_changes.length === 0 ? (
          <p className="mt-2 text-sm text-gray-400">등록된 변경공고가 없습니다.</p>
        ) : (
          <ul className="mt-2 grid gap-2">
            {goods.notice_changes.map((notice, index) => (
              <li key={`${notice.notice_kind}-${notice.change_notice_date}-${index}`} className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950">
                <span className="font-extrabold">{notice.notice_kind}</span>
                <span className="mx-2 text-amber-300">|</span>
                <span>{notice.change_notice_date}</span>
                <p className="mt-1 text-amber-900">{notice.change_notice_detail}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  )
}

export default function AuctionScheduleDetailPage() {
  const { scheduleId } = useParams()
  const [detail, setDetail] = useState<AuctionScheduleDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    const controller = new AbortController()
    let isActive = true

    if (!scheduleId) {
      queueMicrotask(() => {
        if (isActive) {
          setDetail(null)
          setErrorMessage('공고 일정 ID를 확인할 수 없습니다.')
          setIsLoading(false)
        }
      })
      return () => {
        isActive = false
        controller.abort()
      }
    }

    queueMicrotask(() => {
      if (isActive) {
        setDetail(null)
        setPage(1)
        setIsLoading(true)
        setErrorMessage('')
      }
    })

    getAuctionScheduleDetail(scheduleId, controller.signal)
      .then((response) => {
        if (isActive) setDetail(response)
      })
      .catch((error: unknown) => {
        if (isActive && !controller.signal.aborted) {
          setErrorMessage(getKoreanErrorMessage(error, '상세공고 조회에 실패했습니다.'))
        }
      })
      .finally(() => {
        if (isActive) setIsLoading(false)
      })

    return () => {
      isActive = false
      controller.abort()
    }
  }, [scheduleId])

  const totalPages = Math.max(1, Math.ceil((detail?.goods.length || 0) / GOODS_PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const visibleGoods = detail?.goods.slice((safePage - 1) * GOODS_PAGE_SIZE, safePage * GOODS_PAGE_SIZE) || []

  return (
    <Layout>
      <div className="w-full flex-grow bg-slate-50 px-4 py-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
          <Link to="/schedules" className="inline-flex w-fit items-center gap-2 text-sm font-bold text-slate-600 hover:text-indigo-700">
            <ArrowLeft className="h-4 w-4" /> 경매 일정으로
          </Link>

          {isLoading && (
            <div className="flex min-h-96 items-center justify-center rounded-xl border border-gray-200 bg-white">
              <Loader2 className="h-7 w-7 animate-spin text-indigo-600" />
            </div>
          )}

          {!isLoading && errorMessage && (
            <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 p-5 text-sm font-bold text-red-700">
              <AlertCircle className="h-4 w-4" /> {errorMessage}
            </div>
          )}

          {!isLoading && !errorMessage && detail && (
            <>
              <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-sm font-extrabold text-indigo-700">
                      <Gavel className="h-4 w-4" />
                      <span>{detail.court_name}</span>
                      <span className="text-gray-300">/</span>
                      <span>{detail.branch_name}</span>
                      <span className="rounded-md bg-indigo-50 px-2 py-1">{getText(detail.division_name, '담당계 미정')}</span>
                    </div>
                    <h1 className="mt-3 text-2xl font-extrabold text-slate-900">{detail.auction_date} 상세공고</h1>
                    <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-600">
                      <span className="inline-flex items-center gap-1"><CalendarDays className="h-4 w-4 text-gray-400" /> {detail.auction_time || '시간 미정'}</span>
                      <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4 text-gray-400" /> {detail.auction_place}</span>
                    </div>
                    {(detail.division_phone || detail.execution_case_phone) && (
                      <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-500">
                        {detail.division_phone && <span className="inline-flex items-center gap-1"><Phone className="h-4 w-4" /> 담당계 {detail.division_phone}</span>}
                        {detail.execution_case_phone && <span>집행사건 {detail.execution_case_phone}</span>}
                      </div>
                    )}
                  </div>
                  <a href={getAuctionDetailPageUrl(detail.schedule_id)} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-extrabold text-slate-700 hover:bg-slate-50">
                    원문형 HTML 공고 <ExternalLink className="h-4 w-4" />
                  </a>
                </div>

                <dl className="mt-5 grid gap-3 border-t border-gray-100 pt-5 sm:grid-cols-4">
                  <div><dt className="text-xs font-bold text-gray-400">물건 수</dt><dd className="mt-1 font-extrabold text-slate-900">{detail.goods_count.toLocaleString('ko-KR')}건</dd></div>
                  <div><dt className="text-xs font-bold text-gray-400">변경공고</dt><dd className="mt-1 font-extrabold text-slate-900">{detail.notice_change_count.toLocaleString('ko-KR')}건</dd></div>
                  <div><dt className="text-xs font-bold text-gray-400">정정 공고 집계</dt><dd className="mt-1 font-extrabold text-slate-900">{detail.correction_notice_count.toLocaleString('ko-KR')}건</dd></div>
                  <div><dt className="text-xs font-bold text-gray-400">취소 공고 집계</dt><dd className="mt-1 font-extrabold text-slate-900">{detail.cancel_notice_count.toLocaleString('ko-KR')}건</dd></div>
                </dl>
              </section>

              {detail.goods.length === 0 ? (
                <div className="rounded-xl border border-gray-200 bg-white p-10 text-center">
                  <p className="font-extrabold text-slate-900">이 일정에 연결된 물건이 없습니다.</p>
                </div>
              ) : (
                <>
                  <div className="grid gap-3">{visibleGoods.map((goods) => <GoodsNoticeCard key={goods.schedule_goods_id} goods={goods} />)}</div>
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-3">
                      <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={safePage <= 1} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-bold disabled:text-gray-300"><ChevronLeft className="h-4 w-4" /> 이전</button>
                      <span className="text-sm font-bold text-gray-500">{safePage} / {totalPages} 페이지</span>
                      <button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={safePage >= totalPages} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-bold disabled:text-gray-300">다음 <ChevronRight className="h-4 w-4" /></button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  )
}
