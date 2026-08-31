import { type FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
  MapPin,
  Search,
} from 'lucide-react'
import Layout from '../components/Layout'
import {
  searchScheduledGoods,
  type ScheduledAuctionItem,
  type ScheduledSearchParams,
  type ScheduledSortBy,
} from '../lib/auction-extra'
import { getKoreanErrorMessage } from '../lib/api'
import { formatMoney, getText } from '../lib/format'

const PAGE_SIZE = 50

function optionalNonNegative(value: string, minimum = 0) {
  if (!value.trim()) return undefined
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= minimum ? parsed : Number.NaN
}

function ScheduledCard({ item }: { item: ScheduledAuctionItem }) {
  const address = item.printed_address || item.road_address || item.lot_number_address
  const deadlineLabel = item.demand_deadline_date
    ? `${item.demand_deadline_date}${item.demand_deadline_passed ? ' (경과)' : ' (미경과)'}`
    : '미등록'

  return (
    <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-sm font-extrabold text-indigo-700">
            <span>{item.court_name}</span><span className="text-gray-300">/</span><span>{item.branch_name}</span>
            <span className="rounded-md bg-indigo-50 px-2 py-1">{item.case_number}</span>
          </div>
          <h2 className="mt-3 truncate text-lg font-extrabold text-slate-900">{getText(item.building_name || address, '주소 정보 없음')}</h2>
          <p className="mt-1 flex items-start gap-1 text-sm text-gray-500"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /> {getText(address)}</p>
          <div className="mt-3 flex flex-wrap gap-3 text-sm text-gray-600">
            <span>개시결정 {getText(item.commence_decision_date, '미등록')}</span>
            <span className="inline-flex items-center gap-1"><Clock3 className="h-4 w-4 text-gray-400" /> 배당요구종기 {deadlineLabel}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-gray-500"><span>{getText(item.goods_usage_name, '용도 미등록')}</span><span>{getText(item.goods_status_name, '상태 미등록')}</span><span>물건 {item.disposal_goods_sequence}</span></div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-xs text-gray-400">감정가</div><div className="font-extrabold text-slate-900">{formatMoney(item.appraisal_amount)}</div>
          <div className="mt-2 text-xs text-gray-400">청구금액</div><div className="font-extrabold text-slate-700">{formatMoney(item.claim_amount)}</div>
          <Link to={`/goods/${item.auction_goods_id}`} className="mt-3 inline-flex rounded-lg bg-indigo-600 px-3 py-2 text-sm font-extrabold text-white hover:bg-indigo-700">물건 상세</Link>
        </div>
      </div>
    </article>
  )
}

export default function ScheduledSearchPage() {
  const [query, setQuery] = useState('')
  const [courtCode, setCourtCode] = useState('')
  const [courtName, setCourtName] = useState('')
  const [region, setRegion] = useState('')
  const [auctionKind, setAuctionKind] = useState('')
  const [minYear, setMinYear] = useState('')
  const [maxYear, setMaxYear] = useState('')
  const [minClaim, setMinClaim] = useState('')
  const [maxClaim, setMaxClaim] = useState('')
  const [deadlineState, setDeadlineState] = useState<'all' | 'passed' | 'not-passed'>('all')
  const [sortBy, setSortBy] = useState<ScheduledSortBy>('commence_date_desc')
  const [appliedParams, setAppliedParams] = useState<ScheduledSearchParams>({ limit: PAGE_SIZE, offset: 0, sort_by: 'commence_date_desc' })
  const [items, setItems] = useState<ScheduledAuctionItem[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    let isActive = true
    queueMicrotask(() => {
      if (isActive) {
        setIsLoading(true)
        setErrorMessage('')
      }
    })

    searchScheduledGoods(appliedParams, controller.signal)
      .then((response) => {
        if (isActive) {
          setItems(response.items)
          setTotal(response.total)
        }
      })
      .catch((error: unknown) => {
        if (isActive && !controller.signal.aborted) {
          setItems([])
          setTotal(0)
          setErrorMessage(getKoreanErrorMessage(error, '예정물건 검색에 실패했습니다.'))
        }
      })
      .finally(() => {
        if (isActive) setIsLoading(false)
      })
    return () => {
      isActive = false
      controller.abort()
    }
  }, [appliedParams])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const parsedMinYear = optionalNonNegative(minYear, 1900)
    const parsedMaxYear = optionalNonNegative(maxYear, 1900)
    const parsedMinClaim = optionalNonNegative(minClaim)
    const parsedMaxClaim = optionalNonNegative(maxClaim)
    if ([parsedMinYear, parsedMaxYear, parsedMinClaim, parsedMaxClaim].some((value) => Number.isNaN(value))) {
      setErrorMessage('사건연도는 1900 이상, 청구금액은 0 이상의 정수로 입력해 주세요.')
      return
    }
    if ((parsedMinYear !== undefined && parsedMaxYear !== undefined && parsedMinYear > parsedMaxYear) || (parsedMinClaim !== undefined && parsedMaxClaim !== undefined && parsedMinClaim > parsedMaxClaim)) {
      setErrorMessage('최소값은 최대값보다 클 수 없습니다.')
      return
    }

    setAppliedParams({
      q: query.trim() || undefined,
      court_code: courtCode.trim() || undefined,
      court_name: courtName.trim() || undefined,
      region: region.trim() || undefined,
      auction_kind: auctionKind.trim() || undefined,
      min_case_year: parsedMinYear,
      max_case_year: parsedMaxYear,
      min_claim_amount: parsedMinClaim,
      max_claim_amount: parsedMaxClaim,
      demand_deadline_passed: deadlineState === 'all' ? undefined : deadlineState === 'passed',
      sort_by: sortBy,
      limit: PAGE_SIZE,
      offset: 0,
    })
  }

  const offset = appliedParams.offset || 0
  const movePage = (nextOffset: number) => setAppliedParams((current) => ({ ...current, offset: Math.max(0, nextOffset) }))

  return (
    <Layout>
      <div className="w-full flex-grow bg-slate-50 px-4 py-5">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
          <div><h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-900"><CalendarClock className="h-6 w-6 text-indigo-600" /> 첫 매각기일 미지정 물건</h1><p className="mt-1 text-sm text-gray-500">경매 사건과 물건은 등록됐지만 아직 매각일정과 한 번도 연결되지 않은 물건입니다. 미래 매각일이 확정됐다는 뜻은 아닙니다.</p></div>
          <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="통합 검색어" className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm" />
              <input value={courtCode} onChange={(event) => setCourtCode(event.target.value)} placeholder="법원 코드 (정확히 일치)" className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm" />
              <input value={courtName} onChange={(event) => setCourtName(event.target.value)} placeholder="법원·지원명" className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm" />
              <input value={region} onChange={(event) => setRegion(event.target.value)} placeholder="주소·건물명" className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm" />
              <input value={auctionKind} onChange={(event) => setAuctionKind(event.target.value)} placeholder="경매종류 (예: 임의경매)" className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm" />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <input inputMode="numeric" value={minYear} onChange={(event) => setMinYear(event.target.value)} placeholder="최소 사건연도" className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm" />
              <input inputMode="numeric" value={maxYear} onChange={(event) => setMaxYear(event.target.value)} placeholder="최대 사건연도" className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm" />
              <input inputMode="numeric" value={minClaim} onChange={(event) => setMinClaim(event.target.value)} placeholder="최소 청구금액" className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm" />
              <input inputMode="numeric" value={maxClaim} onChange={(event) => setMaxClaim(event.target.value)} placeholder="최대 청구금액" className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm" />
              <select value={deadlineState} onChange={(event) => setDeadlineState(event.target.value as typeof deadlineState)} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm"><option value="all">배당종기 전체</option><option value="not-passed">배당종기 미경과</option><option value="passed">배당종기 경과</option></select>
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value as ScheduledSortBy)} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm"><option value="commence_date_desc">개시결정 최신순</option><option value="commence_date_asc">개시결정 오래된순</option><option value="demand_deadline_asc">배당종기 빠른순</option><option value="demand_deadline_desc">배당종기 늦은순</option></select>
            </div>
            <button type="submit" className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-extrabold text-white hover:bg-indigo-700 sm:w-auto"><Search className="h-4 w-4" /> 예정물건 검색</button>
          </form>

          {isLoading && <div className="flex min-h-72 items-center justify-center rounded-xl border border-gray-200 bg-white"><Loader2 className="h-7 w-7 animate-spin text-indigo-600" /></div>}
          {!isLoading && errorMessage && <div className="rounded-xl border border-red-100 bg-red-50 p-5 text-sm font-bold text-red-700">{errorMessage}</div>}
          {!isLoading && !errorMessage && items.length === 0 && <div className="rounded-xl border border-gray-200 bg-white p-10 text-center"><p className="font-extrabold text-slate-900">조건에 맞는 첫 매각기일 미지정 물건이 없습니다.</p></div>}
          {!isLoading && !errorMessage && items.length > 0 && <><p className="text-sm font-bold text-gray-500">총 {total.toLocaleString('ko-KR')}개 물건</p><div className="grid gap-3">{items.map((item) => <ScheduledCard key={item.auction_goods_id} item={item} />)}</div></>}
          {!isLoading && !errorMessage && total > PAGE_SIZE && (
            <div className="flex items-center justify-center gap-3">
              <button type="button" onClick={() => movePage(offset - PAGE_SIZE)} disabled={offset === 0} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-bold disabled:text-gray-300"><ChevronLeft className="h-4 w-4" /> 이전</button>
              <span className="text-sm font-bold text-gray-500">{Math.floor(offset / PAGE_SIZE) + 1} / {Math.ceil(total / PAGE_SIZE)} 페이지</span>
              <button type="button" onClick={() => movePage(offset + PAGE_SIZE)} disabled={offset + items.length >= total} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-bold disabled:text-gray-300">다음 <ChevronRight className="h-4 w-4" /></button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
