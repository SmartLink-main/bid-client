import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Landmark,
  Loader2,
  Search,
} from 'lucide-react'
import Layout from '../components/Layout'
import {
  getAuctionDetailPageUrl,
  getAuctionSchedules,
  type AuctionScheduleListItem,
  type AuctionScheduleQuery,
} from '../lib/auction-extra'
import { getKoreanErrorMessage } from '../lib/api'

const PAGE_SIZE = 20

function positivePage(value: string | null) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1
}

function queryFromParams(params: URLSearchParams): AuctionScheduleQuery {
  return {
    start_date: params.get('start_date') || undefined,
    end_date: params.get('end_date') || undefined,
    court_name: params.get('court_name') || undefined,
    branch_name: params.get('branch_name') || undefined,
  }
}

function ScheduleCard({ schedule }: { schedule: AuctionScheduleListItem }) {
  return (
    <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-sm font-extrabold text-indigo-700">
            <Landmark className="h-4 w-4" />
            <span>{schedule.court_name}</span>
            <span className="text-gray-300">/</span>
            <span>{schedule.branch_name}</span>
            <span className="rounded-md bg-indigo-50 px-2 py-1">경매 {schedule.division_number}계</span>
          </div>
          <div className="mt-3 flex items-center gap-2 text-lg font-extrabold text-slate-900">
            <CalendarDays className="h-5 w-5 text-slate-400" />
            <span>{schedule.auction_date}</span>
            <span className="text-sm text-gray-500">{schedule.auction_time || '시간 미정'}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={getAuctionDetailPageUrl(schedule.schedule_id)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            원문형 공고 <ExternalLink className="h-4 w-4" />
          </a>
          <Link
            to={`/schedules/${schedule.schedule_id}`}
            className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-extrabold text-white hover:bg-indigo-700"
          >
            공고 상세 <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </article>
  )
}

export default function SchedulePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const searchKey = searchParams.toString()
  const currentParams = useMemo(() => new URLSearchParams(searchKey), [searchKey])
  const scheduleQueryKey = useMemo(() => {
    const queryParams = new URLSearchParams(searchKey)
    queryParams.delete('page')
    return queryParams.toString()
  }, [searchKey])
  const scheduleQuery = useMemo(
    () => queryFromParams(new URLSearchParams(scheduleQueryKey)),
    [scheduleQueryKey],
  )
  const [startDate, setStartDate] = useState(currentParams.get('start_date') || '')
  const [endDate, setEndDate] = useState(currentParams.get('end_date') || '')
  const [courtName, setCourtName] = useState(currentParams.get('court_name') || '')
  const [branchName, setBranchName] = useState(currentParams.get('branch_name') || '')
  const [items, setItems] = useState<AuctionScheduleListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const page = positivePage(currentParams.get('page'))

  useEffect(() => {
    queueMicrotask(() => {
      setStartDate(scheduleQuery.start_date || '')
      setEndDate(scheduleQuery.end_date || '')
      setCourtName(scheduleQuery.court_name || '')
      setBranchName(scheduleQuery.branch_name || '')
    })
  }, [scheduleQuery])

  useEffect(() => {
    const controller = new AbortController()
    let isActive = true

    queueMicrotask(() => {
      if (isActive) {
        setIsLoading(true)
        setErrorMessage('')
      }
    })

    getAuctionSchedules(scheduleQuery, controller.signal)
      .then((response) => {
        if (isActive) {
          setItems(response.items)
        }
      })
      .catch((error: unknown) => {
        if (isActive && !controller.signal.aborted) {
          setItems([])
          setErrorMessage(getKoreanErrorMessage(error, '경매 일정 조회에 실패했습니다.'))
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false)
        }
      })

    return () => {
      isActive = false
      controller.abort()
    }
  }, [scheduleQuery])

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const visibleItems = items.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (startDate && endDate && startDate > endDate) {
      setErrorMessage('조회 시작일은 종료일보다 늦을 수 없습니다.')
      return
    }

    const next = new URLSearchParams()
    if (startDate) next.set('start_date', startDate)
    if (endDate) next.set('end_date', endDate)
    if (courtName.trim()) next.set('court_name', courtName.trim())
    if (branchName.trim()) next.set('branch_name', branchName.trim())
    setSearchParams(next)
  }

  const movePage = (nextPage: number) => {
    const next = new URLSearchParams(currentParams)
    if (nextPage <= 1) next.delete('page')
    else next.set('page', String(nextPage))
    setSearchParams(next)
  }

  return (
    <Layout>
      <div className="w-full flex-grow bg-slate-50 px-4 py-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">경매 공고 일정</h1>
            <p className="mt-1 text-sm text-gray-500">법원에 저장된 매각기일을 조회하고 연결된 공고와 물건을 확인합니다.</p>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-5">
            <label className="text-xs font-bold text-gray-500">
              시작일
              <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm" />
            </label>
            <label className="text-xs font-bold text-gray-500">
              종료일
              <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm" />
            </label>
            <label className="text-xs font-bold text-gray-500">
              법원 지역명 (정확히 일치)
              <input value={courtName} onChange={(event) => setCourtName(event.target.value)} placeholder="예: 서울" className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm" />
            </label>
            <label className="text-xs font-bold text-gray-500">
              지원명 (정확히 일치)
              <input value={branchName} onChange={(event) => setBranchName(event.target.value)} placeholder="예: 서울중앙지방법원" className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm" />
            </label>
            <button type="submit" className="mt-auto inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-indigo-700">
              <Search className="h-4 w-4" /> 일정 조회
            </button>
          </form>

          {isLoading && (
            <div className="flex min-h-72 items-center justify-center rounded-xl border border-gray-200 bg-white">
              <Loader2 className="h-7 w-7 animate-spin text-indigo-600" />
            </div>
          )}

          {!isLoading && errorMessage && (
            <div className="rounded-xl border border-red-100 bg-red-50 p-5 text-sm font-bold text-red-700">{errorMessage}</div>
          )}

          {!isLoading && !errorMessage && items.length === 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-10 text-center">
              <p className="font-extrabold text-slate-900">조회된 경매 일정이 없습니다.</p>
              <p className="mt-2 text-sm text-gray-500">날짜 또는 정확한 법원·지원명을 조정해 보세요.</p>
            </div>
          )}

          {!isLoading && !errorMessage && visibleItems.length > 0 && (
            <>
              <p className="text-sm font-bold text-gray-500">총 {items.length.toLocaleString('ko-KR')}개 일정</p>
              <div className="grid gap-3">{visibleItems.map((item) => <ScheduleCard key={item.schedule_id} schedule={item} />)}</div>
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3">
                  <button type="button" onClick={() => movePage(safePage - 1)} disabled={safePage <= 1} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-bold disabled:text-gray-300">
                    <ChevronLeft className="h-4 w-4" /> 이전
                  </button>
                  <span className="text-sm font-bold text-gray-500">{safePage} / {totalPages} 페이지</span>
                  <button type="button" onClick={() => movePage(safePage + 1)} disabled={safePage >= totalPages} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-bold disabled:text-gray-300">
                    다음 <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  )
}
