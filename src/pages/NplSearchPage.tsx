import { type FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileSearch,
  Loader2,
  MapPin,
  Search,
  ShieldAlert,
} from 'lucide-react'
import Layout from '../components/Layout'
import {
  searchNplCandidates,
  type NplAnalysis,
  type NplCandidate,
  type NplCandidateSearchParams,
  type NplSortBy,
} from '../lib/auction-extra'
import { getKoreanErrorMessage } from '../lib/api'
import { formatMoney, getText } from '../lib/format'

const PAGE_SIZE = 30

type FilterDraft = {
  q: string
  courtCode: string
  region: string
  creditor: string
  minClaimAmount: string
  maxClaimAmount: string
  minAppraisalAmount: string
  maxAppraisalAmount: string
  minCoverageRatio: string
  maxCoverageRatio: string
  goodsUsage: string
  sortBy: NplSortBy
}

const INITIAL_FILTERS: FilterDraft = {
  q: '',
  courtCode: '',
  region: '',
  creditor: '',
  minClaimAmount: '',
  maxClaimAmount: '',
  minAppraisalAmount: '',
  maxAppraisalAmount: '',
  minCoverageRatio: '',
  maxCoverageRatio: '',
  goodsUsage: '',
  sortBy: 'confidence_desc',
}

const RISK_FLAG_LABELS: Record<string, string> = {
  availability_not_verified: '실제 채권 매입 가능 여부 미확인',
  not_tradable_inventory: '거래 가능한 NPL 재고로 검증되지 않음',
  registry_evidence_missing: '등기 권리 근거 없음',
  creditor_registry_holder_not_matched: '사건 채권자와 등기 권리자 이름 불일치',
  appraisal_amount_missing: '감정가 정보 없음',
  lowest_sale_price_missing: '현재 최저매각가격 정보 없음',
  claim_exceeds_appraisal: '청구액이 감정가를 초과함',
}

function displayRiskFlag(flag: string) {
  return RISK_FLAG_LABELS[flag] ?? flag
}

function optionalNonNegativeNumber(value: string) {
  if (!value.trim()) return undefined
  const parsed = Number(value.replaceAll(',', ''))
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : Number.NaN
}

function parseUsage(value: string) {
  const items = value.split(',').map((item) => item.trim()).filter(Boolean)
  return items.length ? items : undefined
}

function displayRatio(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-'
  return `${value.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}배`
}

function displayConfidence(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '산정 전'
  const normalized = Math.abs(value) <= 1 ? value * 100 : value
  return `${Math.max(0, Math.min(100, normalized)).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}%`
}

function analysisGradeClass(grade: string | null | undefined) {
  const normalized = grade?.toUpperCase()
  if (normalized === 'HIGH') return 'bg-emerald-100 text-emerald-800'
  if (normalized === 'MEDIUM') return 'bg-blue-100 text-blue-800'
  if (normalized === 'LOW') return 'bg-amber-100 text-amber-800'
  return 'bg-slate-100 text-slate-700'
}

function displayGrade(grade: NplAnalysis['grade']) {
  if (grade === 'high') return '높음'
  if (grade === 'medium') return '보통'
  return '낮음'
}

function AnalysisMetrics({ analysis }: { analysis: NplAnalysis }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-xl bg-slate-50 p-3"><div className="text-[11px] font-bold text-gray-400">채권액</div><div className="mt-1 text-sm font-extrabold text-slate-800">{formatMoney(analysis.claim_amount)}</div></div>
      <div className="rounded-xl bg-slate-50 p-3"><div className="text-[11px] font-bold text-gray-400">담보채권액</div><div className="mt-1 text-sm font-extrabold text-slate-800">{formatMoney(analysis.secured_claim_amount)}</div></div>
      <div className="rounded-xl bg-blue-50 p-3"><div className="text-[11px] font-bold text-blue-500">담보 커버리지 (감정가/청구액)</div><div className="mt-1 text-sm font-extrabold text-blue-900">{displayRatio(analysis.collateral_coverage_ratio)}</div></div>
      <div className="rounded-xl bg-indigo-50 p-3"><div className="text-[11px] font-bold text-indigo-500">입찰가 커버리지 (최저가/청구액)</div><div className="mt-1 text-sm font-extrabold text-indigo-900">{displayRatio(analysis.bid_coverage_ratio)}</div></div>
    </div>
  )
}

function NplCandidateCard({ candidate }: { candidate: NplCandidate }) {
  const { analysis } = candidate
  const title = candidate.building_name || candidate.address || `물건 ${candidate.auction_goods_id}`

  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs font-extrabold">
            <span className="text-indigo-700">{getText(candidate.court_name)}</span>
            {candidate.branch_name && <span className="text-gray-400">{candidate.branch_name}</span>}
            <span className="rounded bg-indigo-50 px-2 py-1 text-indigo-700">{candidate.case_number}</span>
            <span className={`rounded-full px-2.5 py-1 ${analysisGradeClass(analysis.grade)}`}>후보 가능성 {displayGrade(analysis.grade)}</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">신뢰도 {displayConfidence(analysis.confidence)}</span>
          </div>
          <h2 className="mt-3 truncate text-lg font-extrabold text-slate-900">{title}</h2>
          <p className="mt-1 flex items-start gap-1 text-sm text-gray-500"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /> {getText(candidate.address, '주소 정보 없음')}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-gray-500">
            {candidate.goods_usage_name && <span>{candidate.goods_usage_name}</span>}
            {candidate.goods_status_name && <span>{candidate.goods_status_name}</span>}
            {candidate.progress_status_name && <span>{candidate.progress_status_name}</span>}
            <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {candidate.auction_date} {candidate.auction_time}</span>
          </div>
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-x-5 gap-y-2 text-right lg:min-w-64">
          <div><div className="text-[11px] text-gray-400">감정가</div><div className="font-bold text-slate-700">{formatMoney(analysis.appraisal_amount)}</div></div>
          <div><div className="text-[11px] text-blue-500">최저매각가</div><div className="font-extrabold text-blue-900">{formatMoney(analysis.lowest_sale_price)}</div></div>
        </div>
      </div>

      <div className="mt-5"><AnalysisMetrics analysis={analysis} /></div>

      {analysis.creditor_names.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold text-gray-400">채권자</span>
          {analysis.creditor_names.map((name) => <span key={name} className="rounded-full bg-violet-50 px-2.5 py-1 font-bold text-violet-700">{name}</span>)}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-gray-500">
        <span className="rounded bg-slate-100 px-2.5 py-1">등기 권리 근거 {analysis.registry_right_count}건</span>
        {analysis.debtor_or_owner_names.map((name) => <span key={name} className="rounded bg-slate-100 px-2.5 py-1">채무자·소유자 {name}</span>)}
      </div>

      {analysis.risk_flags.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-center gap-2 text-xs font-extrabold text-amber-900"><ShieldAlert className="h-4 w-4" /> 확인할 위험 신호</div>
          <ul className="mt-2 grid gap-1 text-xs leading-5 text-amber-950 sm:grid-cols-2">
            {analysis.risk_flags.map((flag) => <li key={flag}>· {displayRiskFlag(flag)}</li>)}
          </ul>
        </div>
      )}

      <details className="group mt-4 rounded-xl border border-gray-200 bg-slate-50 p-3">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-extrabold text-slate-800">
          <span className="inline-flex items-center gap-2"><FileSearch className="h-4 w-4 text-indigo-600" /> 분석 근거 {analysis.evidence.length}건</span>
          <span className="text-xs text-gray-400 group-open:hidden">펼치기</span>
        </summary>
        {analysis.evidence.length > 0 ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {analysis.evidence.map((evidence, index) => (
              <div key={`${evidence.code}-${index}`} className="rounded-lg bg-white p-3 ring-1 ring-gray-200">
                <div className="flex items-center justify-between gap-2"><span className="text-xs font-extrabold text-indigo-700">{evidence.description}</span><span className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-extrabold text-indigo-700">+{evidence.score}점</span></div>
                <p className="mt-1 text-[10px] font-bold text-gray-400">{evidence.code}</p>
                {Object.keys(evidence.evidence).length > 0 && <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all rounded bg-slate-50 p-2 text-[10px] leading-4 text-slate-600">{JSON.stringify(evidence.evidence, null, 2)}</pre>}
              </div>
            ))}
          </div>
        ) : <p className="mt-3 text-xs text-gray-500">제공된 분석 근거가 없습니다. 원문과 등기 자료를 직접 확인하세요.</p>}
      </details>

      <div className="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className={`inline-flex items-center gap-2 text-xs font-bold ${analysis.availability_verified ? 'text-emerald-700' : 'text-amber-700'}`}>
          {analysis.availability_verified ? <BadgeCheck className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {analysis.availability_verified ? '채권 매입 가능성 확인됨' : '채권 매입 가능 여부 미검증 · 분석 후보'}
        </div>
        <div className="flex gap-2">
          <Link to={`/schedules/${candidate.schedule_id}`} className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">공고 보기</Link>
          <Link to={`/goods/${candidate.auction_goods_id}`} className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-indigo-700">물건 상세</Link>
        </div>
      </div>
    </article>
  )
}

export default function NplSearchPage() {
  const [filters, setFilters] = useState<FilterDraft>(INITIAL_FILTERS)
  const [appliedParams, setAppliedParams] = useState<NplCandidateSearchParams | null>(null)
  const [items, setItems] = useState<NplCandidate[]>([])
  const [total, setTotal] = useState(0)
  const [serverDisclaimer, setServerDisclaimer] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const updateFilter = <K extends keyof FilterDraft>(key: K, value: FilterDraft[K]) => {
    setFilters((current) => ({ ...current, [key]: value }))
  }

  useEffect(() => {
    if (!appliedParams) return
    const controller = new AbortController()
    let isActive = true
    queueMicrotask(() => {
      if (isActive) {
        setIsLoading(true)
        setErrorMessage('')
      }
    })

    searchNplCandidates(appliedParams, controller.signal)
      .then((response) => {
        if (!isActive) return
        setItems(response.items)
        setTotal(response.total)
        setServerDisclaimer(response.disclaimer)
      })
      .catch((error: unknown) => {
        if (!isActive || controller.signal.aborted) return
        setItems([])
        setTotal(0)
        setErrorMessage(getKoreanErrorMessage(error, 'NPL 후보를 불러오지 못했습니다.'))
      })
      .finally(() => {
        if (isActive) setIsLoading(false)
      })

    return () => {
      isActive = false
      controller.abort()
    }
  }, [appliedParams])

  const buildParams = (offset: number): NplCandidateSearchParams | null => {
    const values = {
      minClaimAmount: optionalNonNegativeNumber(filters.minClaimAmount),
      maxClaimAmount: optionalNonNegativeNumber(filters.maxClaimAmount),
      minAppraisalAmount: optionalNonNegativeNumber(filters.minAppraisalAmount),
      maxAppraisalAmount: optionalNonNegativeNumber(filters.maxAppraisalAmount),
      minCoverageRatio: optionalNonNegativeNumber(filters.minCoverageRatio),
      maxCoverageRatio: optionalNonNegativeNumber(filters.maxCoverageRatio),
    }
    if (Object.values(values).some(Number.isNaN)) {
      setErrorMessage('금액과 커버리지 비율은 0 이상의 숫자로 입력해 주세요.')
      return null
    }
    if (
      (values.minClaimAmount !== undefined && values.maxClaimAmount !== undefined && values.minClaimAmount > values.maxClaimAmount) ||
      (values.minAppraisalAmount !== undefined && values.maxAppraisalAmount !== undefined && values.minAppraisalAmount > values.maxAppraisalAmount) ||
      (values.minCoverageRatio !== undefined && values.maxCoverageRatio !== undefined && values.minCoverageRatio > values.maxCoverageRatio)
    ) {
      setErrorMessage('최소값은 같은 항목의 최대값보다 클 수 없습니다.')
      return null
    }
    return {
      q: filters.q.trim() || undefined,
      court_code: filters.courtCode.trim() || undefined,
      region: filters.region.trim() || undefined,
      creditor: filters.creditor.trim() || undefined,
      min_claim_amount: values.minClaimAmount,
      max_claim_amount: values.maxClaimAmount,
      min_appraisal_amount: values.minAppraisalAmount,
      max_appraisal_amount: values.maxAppraisalAmount,
      min_coverage_ratio: values.minCoverageRatio,
      max_coverage_ratio: values.maxCoverageRatio,
      goods_usage: parseUsage(filters.goodsUsage),
      sort_by: filters.sortBy,
      limit: PAGE_SIZE,
      offset,
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const params = buildParams(0)
    if (params) setAppliedParams(params)
  }

  const resetFilters = () => {
    setFilters(INITIAL_FILTERS)
    setErrorMessage('')
  }

  const currentOffset = appliedParams?.offset ?? 0
  const movePage = (offset: number) => {
    setAppliedParams((current) => current ? { ...current, offset: Math.max(0, offset) } : current)
  }

  return (
    <Layout>
      <div className="w-full flex-grow bg-slate-50 px-4 py-5">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-900"><BriefcaseBusiness className="h-6 w-6 text-indigo-600" /> NPL 후보 분석</h1>
            <p className="mt-1 text-sm text-gray-500">경매 사건의 채권·담보 데이터를 근거와 함께 비교해 검토할 후보를 좁힙니다.</p>
          </div>

          <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <p><strong>이 화면은 NPL 투자 권유나 매입 가능 채권 목록이 아닙니다.</strong> {serverDisclaimer || '후보 분석과 자동 산출 비율은 참고용이며, 권리관계·채권양도 가능성·원문 자료를 별도로 확인해야 합니다.'}</p>
          </div>

          <form onSubmit={handleSubmit} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <label className="lg:col-span-2"><span className="mb-1 block text-xs font-bold text-gray-500">통합 검색</span><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input value={filters.q} onChange={(event) => updateFilter('q', event.target.value)} placeholder="사건번호, 주소, 건물명" className="w-full rounded-xl border border-gray-200 py-3 pl-10 pr-3 text-sm outline-none focus:border-indigo-500" /></div></label>
              <label className="text-xs font-bold text-gray-500">법원 코드<input value={filters.courtCode} onChange={(event) => updateFilter('courtCode', event.target.value)} placeholder="법원 코드" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm font-normal outline-none focus:border-indigo-500" /></label>
              <label className="text-xs font-bold text-gray-500">지역<input value={filters.region} onChange={(event) => updateFilter('region', event.target.value)} placeholder="예: 서울 강남구" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm font-normal outline-none focus:border-indigo-500" /></label>
              <label className="text-xs font-bold text-gray-500">채권자<input value={filters.creditor} onChange={(event) => updateFilter('creditor', event.target.value)} placeholder="금융기관·채권자명" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm font-normal outline-none focus:border-indigo-500" /></label>
              <label className="text-xs font-bold text-gray-500">물건 용도<input value={filters.goodsUsage} onChange={(event) => updateFilter('goodsUsage', event.target.value)} placeholder="아파트, 상가 (쉼표 구분)" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm font-normal outline-none focus:border-indigo-500" /></label>
              <label className="text-xs font-bold text-gray-500">정렬<select value={filters.sortBy} onChange={(event) => updateFilter('sortBy', event.target.value as NplSortBy)} className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-normal outline-none focus:border-indigo-500"><option value="confidence_desc">분석 신뢰도 높은 순</option><option value="candidate_score_desc">후보 점수 높은 순</option><option value="coverage_ratio_asc">담보 커버리지 낮은 순</option><option value="coverage_ratio_desc">담보 커버리지 높은 순</option><option value="claim_amount_desc">채권액 높은 순</option><option value="appraisal_amount_desc">감정가 높은 순</option><option value="current_lowest_price_asc">현재 최저가 낮은 순</option><option value="auction_date_asc">매각기일 빠른 순</option><option value="auction_date_desc">매각기일 늦은 순</option></select></label>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              <fieldset className="rounded-xl bg-slate-50 p-3"><legend className="px-1 text-xs font-extrabold text-slate-600">채권액 (원)</legend><div className="mt-1 grid grid-cols-2 gap-2"><input inputMode="numeric" aria-label="최소 채권액" value={filters.minClaimAmount} onChange={(event) => updateFilter('minClaimAmount', event.target.value)} placeholder="최소" className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm" /><input inputMode="numeric" aria-label="최대 채권액" value={filters.maxClaimAmount} onChange={(event) => updateFilter('maxClaimAmount', event.target.value)} placeholder="최대" className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm" /></div></fieldset>
              <fieldset className="rounded-xl bg-slate-50 p-3"><legend className="px-1 text-xs font-extrabold text-slate-600">감정가 (원)</legend><div className="mt-1 grid grid-cols-2 gap-2"><input inputMode="numeric" aria-label="최소 감정가" value={filters.minAppraisalAmount} onChange={(event) => updateFilter('minAppraisalAmount', event.target.value)} placeholder="최소" className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm" /><input inputMode="numeric" aria-label="최대 감정가" value={filters.maxAppraisalAmount} onChange={(event) => updateFilter('maxAppraisalAmount', event.target.value)} placeholder="최대" className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm" /></div></fieldset>
              <fieldset className="rounded-xl bg-slate-50 p-3"><legend className="px-1 text-xs font-extrabold text-slate-600">담보 커버리지 (배수)</legend><div className="mt-1 grid grid-cols-2 gap-2"><input inputMode="decimal" aria-label="최소 담보 커버리지" value={filters.minCoverageRatio} onChange={(event) => updateFilter('minCoverageRatio', event.target.value)} placeholder="예: 0.8" className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm" /><input inputMode="decimal" aria-label="최대 담보 커버리지" value={filters.maxCoverageRatio} onChange={(event) => updateFilter('maxCoverageRatio', event.target.value)} placeholder="예: 1.5" className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm" /></div></fieldset>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <button type="button" onClick={resetFilters} className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50">조건 초기화</button>
              <button type="submit" disabled={isLoading} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-extrabold text-white hover:bg-indigo-700 disabled:bg-gray-300">{isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} 후보 분석하기</button>
            </div>
          </form>

          {errorMessage && <div className="rounded-xl border border-red-100 bg-red-50 p-5 text-sm font-bold text-red-700" role="alert">{errorMessage}</div>}
          {isLoading && <div className="flex min-h-72 items-center justify-center rounded-2xl border border-gray-200 bg-white"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>}
          {!isLoading && !appliedParams && <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center"><BriefcaseBusiness className="mx-auto h-9 w-9 text-gray-300" /><p className="mt-3 font-extrabold text-slate-800">조건을 입력하고 NPL 후보 분석을 시작하세요.</p><p className="mt-2 text-sm text-gray-500">조건을 비워 두면 신뢰도 순으로 전체 후보를 조회합니다.</p></div>}
          {!isLoading && appliedParams && items.length === 0 && !errorMessage && <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center"><p className="font-extrabold text-slate-800">조건을 만족하는 분석 후보가 없습니다.</p><p className="mt-2 text-sm text-gray-500">채권자·지역·금액 범위를 넓혀 다시 검색해 보세요.</p></div>}
          {!isLoading && items.length > 0 && (
            <>
              <div className="flex items-center justify-between gap-3"><p className="text-sm font-bold text-gray-500">분석 후보 총 {total.toLocaleString('ko-KR')}건</p><p className="text-xs font-bold text-amber-700">미검증 후보 여부를 카드별로 확인하세요.</p></div>
              <div className="grid gap-4">{items.map((candidate) => <NplCandidateCard key={`${candidate.case_id}-${candidate.auction_goods_id}`} candidate={candidate} />)}</div>
            </>
          )}
          {!isLoading && total > PAGE_SIZE && (
            <div className="flex items-center justify-center gap-3">
              <button type="button" onClick={() => movePage(currentOffset - PAGE_SIZE)} disabled={currentOffset === 0} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-bold disabled:text-gray-300"><ChevronLeft className="h-4 w-4" /> 이전</button>
              <span className="text-sm font-bold text-gray-500">{Math.floor(currentOffset / PAGE_SIZE) + 1} / {Math.ceil(total / PAGE_SIZE)} 페이지</span>
              <button type="button" onClick={() => movePage(currentOffset + PAGE_SIZE)} disabled={currentOffset + PAGE_SIZE >= total} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-bold disabled:text-gray-300">다음 <ChevronRight className="h-4 w-4" /></button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
