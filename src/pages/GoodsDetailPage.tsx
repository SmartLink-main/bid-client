import { useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  Gavel,
  Home,
  Loader2,
  MapPin,
  RefreshCw,
} from 'lucide-react'
import Layout from '../components/Layout'
import FavoriteToggleButton from '../components/FavoriteToggleButton'
import { getKoreanErrorMessage } from '../lib/api'
import { formatMoney, formatNumber } from '../lib/format'
import {
  getGoodsDetail,
  getGoodsPhotoUrl,
  type GoodsDetailResponse,
  type GoodsPhoto,
} from '../lib/goods'

const DETAIL_REQUEST_TIMEOUT_MILLISECONDS = 12_000
const PHOTO_REQUEST_TIMEOUT_MILLISECONDS = 15_000

type InfoItem = {
  label: string
  value: unknown
}

type GoodsRequestState<T> =
  | { auctionGoodsId: string | undefined; status: 'loading' }
  | { auctionGoodsId: string; status: 'success'; data: T }
  | { auctionGoodsId: string | undefined; status: 'error'; message: string }

function hasValue(value: unknown) {
  return value !== null && value !== undefined && value !== ''
}

function displayValue(value: unknown, fallback = '-') {
  if (typeof value === 'string' && value.trim()) {
    return value
  }
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value.toLocaleString('ko-KR')
  }
  if (typeof value === 'boolean') {
    return value ? '예' : '아니요'
  }
  return fallback
}

function displayAmount(text: string | null | undefined, amount: number | null | undefined) {
  return hasValue(text) ? displayValue(text) : formatMoney(amount)
}

function SectionCard({
  id,
  title,
  description,
  children,
}: {
  id?: string
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
      <div>
        <h2 className="text-lg font-extrabold text-slate-900">{title}</h2>
        {description && <p className="mt-1 text-sm leading-6 text-gray-500">{description}</p>}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  )
}

function InfoGrid({ items }: { items: InfoItem[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-xs font-bold text-gray-400">{item.label}</dt>
          <dd className="mt-1 break-words text-sm font-bold leading-6 text-slate-800">
            {displayValue(item.value)}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function EmptyMessage({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-200 bg-slate-50 px-4 py-8 text-center text-sm text-gray-500">
      {children}
    </div>
  )
}

function PhotoImage({
  source,
  title,
  onRetry,
}: {
  source: string
  title: string
  onRetry: () => void
}) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading')

  useEffect(() => {
    if (status !== 'loading') {
      return
    }

    const timeoutId = window.setTimeout(
      () => setStatus('error'),
      PHOTO_REQUEST_TIMEOUT_MILLISECONDS,
    )
    return () => window.clearTimeout(timeoutId)
  }, [status])

  if (status === 'error') {
    return (
      <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 bg-slate-100 px-6 text-center text-sm font-bold text-gray-500">
        <span>사진 저장소가 연결되지 않았거나 사진을 불러오지 못했습니다.</span>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className="h-3.5 w-3.5" /> 사진 다시 시도
        </button>
      </div>
    )
  }

  return (
    <div className="relative aspect-[4/3] bg-slate-100">
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center" role="status">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
          <span className="sr-only">사진을 불러오는 중</span>
        </div>
      )}
      <img
        src={source}
        alt={title}
        loading="lazy"
        decoding="async"
        onLoad={() => setStatus('loaded')}
        onError={() => setStatus('error')}
        className={`h-full w-full object-cover transition-opacity ${status === 'loaded' ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  )
}

function PhotoCard({ photo, index }: { photo: GoodsPhoto; index: number }) {
  const [attempt, setAttempt] = useState(0)
  const title = photo.photo_title || `사진 ${index + 1}`
  const baseSource = getGoodsPhotoUrl(photo.content_url)
  const source = baseSource
    ? `${baseSource}${baseSource.includes('?') ? '&' : '?'}retry=${attempt}`
    : null

  return (
    <article className="overflow-hidden rounded-lg border border-gray-200 bg-slate-50">
      {source ? (
        <PhotoImage
          key={source}
          source={source}
          title={title}
          onRetry={() => setAttempt((value) => value + 1)}
        />
      ) : (
        <div className="flex aspect-[4/3] items-center justify-center bg-slate-100 px-6 text-center text-sm font-bold text-gray-400">
          표시할 수 있는 사진 URL이 없습니다.
        </div>
      )}
      <div className="space-y-1 p-4">
        <h3 className="font-extrabold text-slate-900">{title}</h3>
        <p className="text-xs text-gray-400">
          {[photo.content_type, photo.file_size_bytes ? formatNumber(photo.file_size_bytes, ' bytes') : null]
            .filter(Boolean)
            .join(' · ') || '파일 정보 없음'}
        </p>
      </div>
    </article>
  )
}

function PhotoGrid({ photos }: { photos: GoodsPhoto[] }) {
  if (photos.length === 0) {
    return <EmptyMessage>등록된 사진 메타데이터가 없습니다.</EmptyMessage>
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {photos.map((photo, index) => (
        <PhotoCard
          key={photo.photo_id ?? `${photo.photo_sequence ?? 'photo'}-${index}`}
          photo={photo}
          index={index}
        />
      ))}
    </div>
  )
}

export default function GoodsDetailPage() {
  const { auctionGoodsId } = useParams()
  const [detailState, setDetailState] = useState<GoodsRequestState<GoodsDetailResponse>>({
    auctionGoodsId,
    status: 'loading',
  })
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    let isActive = true
    let didTimeout = false
    const controller = new AbortController()

    queueMicrotask(() => {
      if (!isActive) {
        return
      }

      if (!auctionGoodsId) {
        setDetailState({
          auctionGoodsId,
          status: 'error',
          message: '물건 ID를 확인할 수 없습니다.',
        })
        return
      }

      setDetailState({ auctionGoodsId, status: 'loading' })
    })

    if (!auctionGoodsId) {
      return () => {
        isActive = false
        controller.abort()
      }
    }

    const currentAuctionGoodsId = auctionGoodsId
    const timeoutId = window.setTimeout(() => {
      didTimeout = true
      controller.abort()
    }, DETAIL_REQUEST_TIMEOUT_MILLISECONDS)

    void getGoodsDetail(currentAuctionGoodsId, controller.signal).then(
      (data) => {
        if (isActive) {
          setDetailState({ auctionGoodsId: currentAuctionGoodsId, status: 'success', data })
        }
      },
      (error: unknown) => {
        if (isActive) {
          setDetailState({
            auctionGoodsId: currentAuctionGoodsId,
            status: 'error',
            message: didTimeout
              ? '상세 조회가 12초 안에 완료되지 않았습니다. 잠시 후 다시 시도해 주세요.'
              : getKoreanErrorMessage(error, '물건 상세 정보를 불러오지 못했습니다.'),
          })
        }
      },
    ).finally(() => window.clearTimeout(timeoutId))

    return () => {
      isActive = false
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [auctionGoodsId, retryKey])

  const detail = detailState.auctionGoodsId === auctionGoodsId && detailState.status === 'success'
    ? detailState.data
    : null
  const isLoading = detailState.auctionGoodsId !== auctionGoodsId || detailState.status === 'loading'
  const errorMessage = detailState.auctionGoodsId === auctionGoodsId && detailState.status === 'error'
    ? detailState.message
    : ''

  const summary = detail?.summary
  const caseSection = detail?.case
  const progress = detail?.progress
  const hearings = detail?.sale_hearings
  const appraisal = detail?.appraisal
  const building = detail?.building
  const tenants = detail?.tenants
  const registry = detail?.registry_rights
  const risks = detail?.risk_notices
  const nearbySales = detail?.nearby_sales
  const hasUsableResponse = Boolean(detail && summary)

  return (
    <Layout>
      <div className="w-full flex-grow bg-slate-50 px-4 py-6 md:py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
          <Link
            to="/search"
            className="inline-flex w-fit items-center gap-2 text-sm font-bold text-slate-600 hover:text-indigo-700"
          >
            <ArrowLeft className="h-4 w-4" />
            검색 결과로
          </Link>

          {isLoading && !hasUsableResponse && (
            <div className="flex min-h-96 items-center justify-center rounded-xl border border-gray-200 bg-white" role="status">
              <Loader2 className="h-7 w-7 animate-spin text-indigo-600" />
              <span className="sr-only">물건 상세 정보를 불러오는 중</span>
            </div>
          )}

          {!isLoading && !hasUsableResponse && (
            <div className="flex flex-col items-start gap-4 rounded-xl border border-red-100 bg-red-50 p-5 text-sm font-bold text-red-700" role="alert">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{errorMessage || '물건 상세 정보를 찾을 수 없습니다.'}</span>
              </div>
              {auctionGoodsId && (
                <button
                  type="button"
                  onClick={() => setRetryKey((value) => value + 1)}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-4 py-2 text-xs font-extrabold text-white hover:bg-red-800"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> 상세 다시 시도
                </button>
              )}
            </div>
          )}

          {hasUsableResponse && summary && detail && (
            <>
              <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-indigo-700">
                      <span>{displayValue(summary.court_name)}</span>
                      {hasValue(summary.branch_name) && <span className="text-gray-300">/</span>}
                      {hasValue(summary.branch_name) && <span>{summary.branch_name}</span>}
                      {hasValue(summary.goods_type_name) && (
                        <span className="rounded-md bg-indigo-50 px-2 py-1">{summary.goods_type_name}</span>
                      )}
                    </div>
                    <h1 className="mt-3 break-words text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">
                      {displayValue(summary.title, `물건 ${auctionGoodsId ?? ''}`)}
                    </h1>
                    <p className="mt-3 flex items-start gap-2 text-sm font-medium leading-6 text-gray-600">
                      <MapPin className="mt-1 h-4 w-4 shrink-0 text-gray-400" />
                      {displayValue(summary.address, '주소 정보 없음')}
                    </p>
                  </div>
                  <div className="flex min-w-0 flex-col items-stretch gap-3 md:min-w-80">
                    {auctionGoodsId && (
                      <FavoriteToggleButton auctionGoodsId={auctionGoodsId} className="w-full" />
                    )}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg bg-slate-50 p-4">
                        <div className="text-xs font-bold text-gray-400">감정가</div>
                        <div className="mt-1 text-lg font-extrabold text-slate-900">
                          {displayAmount(summary.appraisal_amount_text, summary.appraisal_amount)}
                        </div>
                      </div>
                      <div className="rounded-lg bg-blue-50 p-4">
                        <div className="text-xs font-bold text-blue-500">최저매각가격</div>
                        <div className="mt-1 text-lg font-extrabold text-blue-900">
                          {displayAmount(summary.lowest_sale_price_text, summary.lowest_sale_price)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                  <Gavel className="h-5 w-5 text-indigo-600" />
                  <div className="mt-3 text-sm font-bold text-gray-400">입찰 방식 · 상태</div>
                  <div className="mt-1 text-lg font-extrabold text-slate-900">
                    {displayValue(summary.bid_division_name)} · {displayValue(summary.goods_status_name)}
                  </div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                  <CalendarDays className="h-5 w-5 text-indigo-600" />
                  <div className="mt-3 text-sm font-bold text-gray-400">대표 매각기일</div>
                  <div className="mt-1 text-lg font-extrabold text-slate-900">
                    {displayValue(summary.sale_date_text || summary.sale_date)}
                  </div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                  <Home className="h-5 w-5 text-indigo-600" />
                  <div className="mt-3 text-sm font-bold text-gray-400">입찰보증금</div>
                  <div className="mt-1 text-lg font-extrabold text-slate-900">
                    {displayAmount(summary.bid_deposit_amount_text, summary.bid_deposit_amount)}
                  </div>
                  <p className="mt-1 text-xs font-bold text-gray-400">보증금률 {displayValue(summary.bid_deposit_rate_text)}</p>
                </div>
              </section>

              <SectionCard title="사건 기본정보" description="사건, 법원, 이해관계인과 관련 사건 정보입니다.">
                {caseSection ? (
                  <div className="space-y-6">
                    <InfoGrid
                      items={[
                        { label: '사건번호', value: caseSection.case_display_number },
                        { label: '물건번호', value: detail.disposal_goods_sequence },
                        { label: '사건명', value: caseSection.case_name },
                        { label: '법원', value: [caseSection.court_name, caseSection.branch_name].filter(Boolean).join(' ') },
                        { label: '진행상태', value: caseSection.progress_status_name },
                        { label: '결과', value: caseSection.result_division_name },
                        { label: '결과일', value: caseSection.result_date_text || caseSection.result_date },
                        { label: '청구금액', value: displayAmount(caseSection.claim_amount_text, caseSection.claim_amount) },
                        { label: '건물명', value: caseSection.building_name },
                        { label: '주소', value: caseSection.address },
                        { label: '도로명주소', value: caseSection.road_address },
                        { label: '물건 비고', value: caseSection.goods_remark },
                      ]}
                    />

                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900">이해관계인</h3>
                      {caseSection.parties.length > 0 ? (
                        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {caseSection.parties.map((party, index) => (
                            <div key={`${party.party_sequence ?? index}-${party.party_name ?? ''}`} className="rounded-lg bg-slate-50 p-4">
                              <p className="text-xs font-bold text-gray-400">{displayValue(party.party_division_name, '구분 없음')}</p>
                              <p className="mt-1 font-extrabold text-slate-800">{displayValue(party.party_name, '성명 정보 없음')}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-3"><EmptyMessage>등록된 이해관계인이 없습니다.</EmptyMessage></div>
                      )}
                    </div>

                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900">관련 사건</h3>
                      {caseSection.related_cases.length > 0 ? (
                        <ul className="mt-3 divide-y divide-gray-100 rounded-lg border border-gray-200">
                          {caseSection.related_cases.map((relatedCase, index) => (
                            <li key={`${relatedCase.related_case_display_number ?? index}`} className="flex flex-wrap justify-between gap-2 p-4 text-sm">
                              <span className="font-extrabold text-slate-800">{displayValue(relatedCase.related_case_display_number)}</span>
                              <span className="text-gray-500">
                                {[relatedCase.relation_type_name, relatedCase.related_court_name].filter(Boolean).join(' · ') || '-'}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="mt-3"><EmptyMessage>등록된 관련 사건이 없습니다.</EmptyMessage></div>
                      )}
                    </div>
                  </div>
                ) : <EmptyMessage>사건 기본정보가 없습니다.</EmptyMessage>}
              </SectionCard>

              <SectionCard title="진행 일정" description="접수·개시결정·배당요구종기와 담당계 일정, 사건 진행 내역입니다.">
                {progress ? (
                  <div className="space-y-6">
                    <InfoGrid
                      items={[
                        { label: '접수일', value: progress.receipt_date_text || progress.receipt_date },
                        { label: '개시결정일', value: progress.commence_decision_date_text || progress.commence_decision_date },
                        { label: '배당요구종기일', value: progress.demand_deadline_date_text || progress.demand_deadline_date },
                        { label: '일정 수', value: progress.schedules.length },
                      ]}
                    />
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900">담당계 매각 일정</h3>
                      {progress.schedules.length > 0 ? (
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          {progress.schedules.map((schedule) => (
                            <article key={schedule.schedule_id} className="rounded-lg border border-gray-200 p-4">
                              <p className="font-extrabold text-slate-900">
                                {displayValue(schedule.auction_date_text || schedule.auction_date)} {displayValue(schedule.auction_time, '')}
                              </p>
                              <p className="mt-1 text-sm text-gray-600">{displayValue(schedule.auction_place, '장소 정보 없음')}</p>
                              <p className="mt-2 text-xs font-bold text-gray-400">
                                {[schedule.division_name, schedule.division_phone].filter(Boolean).join(' · ') || '담당계 정보 없음'}
                              </p>
                            </article>
                          ))}
                        </div>
                      ) : <div className="mt-3"><EmptyMessage>등록된 담당계 일정이 없습니다.</EmptyMessage></div>}
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900">사건 진행 내역</h3>
                      {progress.case_events.length > 0 ? (
                        <ol className="mt-3 space-y-3 border-l-2 border-indigo-100 pl-5">
                          {progress.case_events.map((event, index) => (
                            <li key={`${event.event_date ?? 'event'}-${index}`} className="relative rounded-lg bg-slate-50 p-4">
                              <span className="absolute -left-[1.65rem] top-5 h-3 w-3 rounded-full border-2 border-indigo-600 bg-white" />
                              <p className="text-xs font-bold text-indigo-600">{displayValue(event.event_date_text || event.event_date)}</p>
                              <p className="mt-1 text-sm font-extrabold text-slate-900">{displayValue(event.event_detail)}</p>
                              <p className="mt-1 text-xs text-gray-500">
                                {[event.event_source, event.event_result].filter(Boolean).join(' · ') || '-'}
                              </p>
                            </li>
                          ))}
                        </ol>
                      ) : <div className="mt-3"><EmptyMessage>등록된 사건 진행 내역이 없습니다.</EmptyMessage></div>}
                    </div>
                  </div>
                ) : <EmptyMessage>진행 일정 정보가 없습니다.</EmptyMessage>}
              </SectionCard>

              <SectionCard title="매각기일 이력" description="기일별 최저가, 입찰기간과 결과를 확인할 수 있습니다.">
                {hearings && hearings.items.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left text-sm">
                      <thead className="border-b border-gray-200 text-xs font-bold text-gray-400">
                        <tr>
                          <th className="px-3 py-3">기일</th>
                          <th className="px-3 py-3">구분 · 장소</th>
                          <th className="px-3 py-3">최저가</th>
                          <th className="px-3 py-3">매각가</th>
                          <th className="px-3 py-3">결과</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {hearings.items.map((hearing, index) => (
                          <tr key={`${hearing.hearing_date}-${hearing.hearing_time ?? ''}-${index}`}>
                            <td className="px-3 py-4 font-bold text-slate-800">
                              {hearing.hearing_date_text} {displayValue(hearing.hearing_time, '')}
                              {(hearing.bid_begin_date_text || hearing.bid_end_date_text) && (
                                <div className="mt-1 text-xs font-medium text-gray-400">
                                  입찰 {displayValue(hearing.bid_begin_date_text, '')}~{displayValue(hearing.bid_end_date_text, '')}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-4 text-gray-600">
                              {displayValue(hearing.hearing_kind_name)}<br />
                              <span className="text-xs text-gray-400">{displayValue(hearing.hearing_place_name)}</span>
                            </td>
                            <td className="px-3 py-4 font-extrabold text-blue-800">
                              {displayAmount(hearing.lowest_sale_price_text, hearing.lowest_sale_price)}
                              <div className="mt-1 text-xs text-gray-400">{displayValue(hearing.lowest_sale_price_ratio_text)}</div>
                            </td>
                            <td className="px-3 py-4 font-bold text-slate-800">
                              {displayAmount(hearing.sale_amount_text, hearing.sale_amount)}
                            </td>
                            <td className="px-3 py-4 text-gray-600">
                              {[hearing.hearing_result_name, hearing.hearing_goods_status_name].filter(Boolean).join(' · ') || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <EmptyMessage>등록된 매각기일 이력이 없습니다.</EmptyMessage>}
              </SectionCard>

              <SectionCard title="감정평가" description="감정가와 감정평가요항표의 세부 내용을 표시합니다.">
                {appraisal ? (
                  <div className="space-y-5">
                    <InfoGrid
                      items={[
                        { label: '감정가', value: displayAmount(appraisal.appraisal_amount_text, appraisal.appraisal_amount) },
                        { label: '최초공고 최저가', value: displayAmount(appraisal.first_announcement_lowest_sale_price_text, appraisal.first_announcement_lowest_sale_price) },
                        { label: '특이사항', value: appraisal.goods_specific_remark },
                        { label: '감정 항목 수', value: appraisal.items.length },
                      ]}
                    />
                    {appraisal.items.length > 0 ? (
                      <div className="space-y-3">
                        {appraisal.items.map((item, index) => (
                          <article key={`${item.display_order ?? index}-${item.item_name ?? ''}`} className="rounded-lg border border-gray-200 p-4">
                            <p className="text-xs font-bold text-indigo-600">{displayValue(item.table_division_name, '감정평가 항목')}</p>
                            <h3 className="mt-1 font-extrabold text-slate-900">{displayValue(item.item_name)}</h3>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-600">{displayValue(item.content)}</p>
                          </article>
                        ))}
                      </div>
                    ) : <EmptyMessage>등록된 감정평가 항목이 없습니다.</EmptyMessage>}
                  </div>
                ) : <EmptyMessage>감정평가 정보가 없습니다.</EmptyMessage>}
              </SectionCard>

              <SectionCard title="건물·토지 정보" description="주소, 면적, 용도, 구조와 층별 현황입니다.">
                {building ? (
                  <div className="space-y-6">
                    <InfoGrid
                      items={[
                        { label: '건물명', value: building.building_name },
                        { label: '주용도', value: building.main_building_usage },
                        { label: '구조', value: building.building_structure_name },
                        { label: '상세', value: building.building_detail },
                        { label: '토지면적', value: building.land_area_pyeong_text || building.land_area_sqm_text },
                        { label: '건물면적', value: building.building_area_pyeong_text || building.building_area_sqm_text },
                        { label: '연면적', value: building.gross_floor_area_pyeong_text || building.gross_floor_area_sqm_text },
                        { label: '용적률 산정면적', value: building.floor_area_ratio_area_pyeong_text || building.floor_area_ratio_area_sqm_text },
                        { label: '건폐율', value: building.building_coverage_ratio_text },
                        { label: '용적률', value: building.floor_area_ratio_text },
                        { label: '층수', value: `지상 ${displayValue(building.ground_floor_count)}층 / 지하 ${displayValue(building.basement_floor_count)}층` },
                        { label: '사용승인일', value: building.use_approval_date_text || building.use_approval_date },
                      ]}
                    />
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900">층별 현황</h3>
                      {building.floors.length > 0 ? (
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          {building.floors.map((floor, index) => (
                            <article key={`${floor.display_order ?? index}-${floor.floor_name ?? ''}`} className="rounded-lg bg-slate-50 p-4">
                              <h4 className="font-extrabold text-slate-900">{displayValue(floor.floor_name, `층 ${index + 1}`)}</h4>
                              <p className="mt-1 text-sm text-gray-600">{[floor.usage_text, floor.structure_name].filter(Boolean).join(' · ') || '-'}</p>
                              <p className="mt-2 text-xs font-bold text-gray-400">
                                {floor.area_pyeong_text || floor.area_sqm_text || '면적 정보 없음'}
                              </p>
                            </article>
                          ))}
                        </div>
                      ) : <div className="mt-3"><EmptyMessage>등록된 층별 현황이 없습니다.</EmptyMessage></div>}
                    </div>
                  </div>
                ) : <EmptyMessage>건물·토지 정보가 없습니다.</EmptyMessage>}
              </SectionCard>

              <SectionCard title="임차인 현황" description="점유, 전입, 확정일자, 배당요구와 임대차 금액 정보입니다.">
                {tenants ? (
                  <div className="space-y-5">
                    <InfoGrid
                      items={[
                        { label: '말소기준권리', value: tenants.senior_right_base_text },
                        { label: '배당요구종기일', value: tenants.demand_deadline_date_text || tenants.demand_deadline_date },
                        { label: '임차인 수', value: tenants.items.length },
                      ]}
                    />
                    {tenants.items.length > 0 ? (
                      <div className="grid gap-4 md:grid-cols-2">
                        {tenants.items.map((tenant, index) => (
                          <article key={`${tenant.display_order ?? index}-${tenant.tenant_name ?? ''}`} className="rounded-lg border border-gray-200 p-4">
                            <h3 className="font-extrabold text-slate-900">{displayValue(tenant.tenant_name, `임차인 ${index + 1}`)}</h3>
                            <p className="mt-1 text-sm text-gray-600">{displayValue(tenant.occupancy_text, '점유 정보 없음')}</p>
                            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                              <div><span className="font-bold text-gray-400">전입일</span><p className="mt-1 font-bold text-slate-700">{displayValue(tenant.move_in_date_text || tenant.move_in_date)}</p></div>
                              <div><span className="font-bold text-gray-400">확정일자</span><p className="mt-1 font-bold text-slate-700">{displayValue(tenant.fixed_date_text || tenant.fixed_date)}</p></div>
                              <div><span className="font-bold text-gray-400">보증금</span><p className="mt-1 font-bold text-slate-700">{displayAmount(tenant.deposit_amount_text, tenant.deposit_amount)}</p></div>
                              <div><span className="font-bold text-gray-400">월세</span><p className="mt-1 font-bold text-slate-700">{displayAmount(tenant.monthly_rent_amount_text, tenant.monthly_rent_amount)}</p></div>
                            </div>
                            {(tenant.opposing_power_text || tenant.note || tenant.survey_note) && (
                              <p className="mt-4 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-xs leading-5 text-gray-600">
                                {[tenant.opposing_power_text, tenant.note, tenant.survey_note].filter(Boolean).join('\n')}
                              </p>
                            )}
                          </article>
                        ))}
                      </div>
                    ) : <EmptyMessage>등록된 임차인이 없습니다.</EmptyMessage>}
                  </div>
                ) : <EmptyMessage>임차인 정보가 없습니다.</EmptyMessage>}
              </SectionCard>

              <SectionCard title="등기부 권리" description="토지·건물 등기부 권리를 범위별로 묶어 표시합니다.">
                {registry && registry.available && registry.groups.length > 0 ? (
                  <div className="space-y-5">
                    {registry.groups.map((group) => (
                      <div key={group.registry_scope}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="font-extrabold text-slate-900">{group.registry_scope}</h3>
                          <span className="text-xs font-bold text-gray-500">총 채권액 {displayAmount(group.total_claim_amount_text, group.total_claim_amount)}</span>
                        </div>
                        <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200">
                          <table className="w-full min-w-[720px] text-left text-sm">
                            <thead className="bg-slate-50 text-xs font-bold text-gray-400">
                              <tr><th className="px-3 py-3">접수일</th><th className="px-3 py-3">권리</th><th className="px-3 py-3">권리자</th><th className="px-3 py-3">채권액</th><th className="px-3 py-3">인수·소멸</th><th className="px-3 py-3">비고</th></tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {group.items.map((right, index) => (
                                <tr key={`${right.display_order ?? index}-${right.registration_date ?? ''}`}>
                                  <td className="px-3 py-3">{displayValue(right.registration_date_text || right.registration_date)}</td>
                                  <td className="px-3 py-3 font-bold text-slate-800">
                                    {displayValue(right.right_type)}
                                    {right.is_extinction_basis && <span className="ml-2 rounded bg-red-50 px-2 py-1 text-[10px] text-red-700">말소기준</span>}
                                  </td>
                                  <td className="px-3 py-3">{displayValue(right.holder_name)}</td>
                                  <td className="px-3 py-3">{displayAmount(right.claim_amount_text, right.claim_amount)}</td>
                                  <td className="px-3 py-3">{displayValue(right.takeover_extinction_text)}</td>
                                  <td className="px-3 py-3">{displayValue(right.note)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <EmptyMessage>등록된 등기부 권리 정보가 없습니다.</EmptyMessage>}
              </SectionCard>

              <SectionCard title="권리·특수조건 주의사항" description="인수 가능 권리와 지상권, 선순위 권리, 특별매각조건 원문입니다.">
                {risks ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {[
                      ['인수권리', risks.rights_takeover_text],
                      ['지상권', risks.surface_existence_text],
                      ['선순위권리', risks.senior_right_text],
                      ['소멸되지 않는 등기부권리', risks.non_extinguished_registry_rights_text],
                      ['소멸되지 않는 지상권', risks.non_extinguished_superficies_text],
                      ['특별매각조건', risks.special_condition_text],
                    ].map(([label, value]) => (
                      <article key={label} className="rounded-lg border border-amber-100 bg-amber-50 p-4">
                        <h3 className="text-xs font-extrabold text-amber-700">{label}</h3>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{displayValue(value, '해당 사항 없음')}</p>
                      </article>
                    ))}
                  </div>
                ) : <EmptyMessage>권리 주의사항 정보가 없습니다.</EmptyMessage>}
              </SectionCard>

              <SectionCard title="인근 매각사례" description="같은 지역과 유사 용도의 최근 매각사례입니다.">
                {nearbySales && nearbySales.available && nearbySales.items.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {nearbySales.items.map((sale, index) => (
                      <article key={`${sale.raw_case_number ?? sale.exposed_case_number ?? index}-${sale.goods_sequence ?? ''}`} className="rounded-lg border border-gray-200 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="font-extrabold text-slate-900">{displayValue(sale.exposed_case_number || sale.raw_case_number)}</h3>
                          <span className="rounded bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{displayValue(sale.goods_type_name)}</span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-gray-600">{displayValue(sale.address_text)}</p>
                        <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                          <div><span className="font-bold text-gray-400">매각일</span><p className="mt-1 font-bold text-slate-700">{displayValue(sale.sale_date_text || sale.sale_date)}</p></div>
                          <div><span className="font-bold text-gray-400">감정가</span><p className="mt-1 font-bold text-slate-700">{displayAmount(sale.appraisal_amount_text, sale.appraisal_amount)}</p></div>
                          <div><span className="font-bold text-gray-400">매각가</span><p className="mt-1 font-extrabold text-blue-800">{displayAmount(sale.sale_price_text, sale.sale_price)}</p></div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : <EmptyMessage>조건에 맞는 인근 매각사례가 없습니다.</EmptyMessage>}
              </SectionCard>

              <SectionCard title="물건 사진" description="사진은 객체 저장소 경로를 공개하지 않는 앱 전용 경로로 안전하게 표시합니다.">
                <PhotoGrid photos={detail.photos.items} />
              </SectionCard>

              <SectionCard title="현재 제공되지 않는 분석" description="정규 데이터가 없어 API가 명시적으로 unavailable로 반환한 항목입니다.">
                {detail.unsupported_sections.length ? (
                  <div className="grid gap-3 md:grid-cols-3">
                    {detail.unsupported_sections.map((unsupported) => (
                      <article key={unsupported.section} className="rounded-lg border border-gray-200 bg-slate-50 p-4">
                        <h3 className="font-extrabold text-slate-900">{unsupported.section}</h3>
                        <p className="mt-2 text-sm leading-6 text-gray-600">{unsupported.reason}</p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <EmptyMessage>API가 보고한 미지원 항목이 없습니다.</EmptyMessage>
                )}
              </SectionCard>
            </>
          )}
        </div>
      </div>
    </Layout>
  )
}
