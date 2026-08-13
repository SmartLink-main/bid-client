import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import FavoriteToggleButton from '../components/FavoriteToggleButton'
import Layout from '../components/Layout'
import { useAuthSession } from '../hooks/useAuthSession'
import {
  searchGoods,
  type AuctionGoodsSearchItem,
  type AuctionSearchMode,
  type AuctionSearchParams,
} from '../lib/auction'
import { formatMoney, formatNumber, getText } from '../lib/format'
import { getApiUrl, getKoreanErrorMessage } from '../lib/api'
import { getFavoriteStatuses } from '../lib/favorites'
import {
  DEFAULT_SEARCH_RESULT_LIMIT,
  getLastSearchResultOffset,
  normalizeSearchResultLimit,
  normalizeSearchResultOffset,
  normalizeSearchResultParams,
  normalizeSearchResultSortBy,
  searchResultSortOptions,
} from '../lib/search-results'
import { ArrowUpDown, CalendarDays, ChevronLeft, ChevronRight, Loader2, MapPin, Search } from 'lucide-react'

function parseNumber(value: string | null) {
  if (!value) {
    return undefined
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function parseBoolean(value: string | null) {
  if (!value) {
    return undefined
  }

  return value === 'true' || value === '1'
}

function parseSearchMode(value: string | null): AuctionSearchMode {
  return value === 'comprehensive' || value === 'npl' || value === 'special'
    ? value
    : 'standard'
}

function parseMatchMode(value: string | null) {
  return value === 'any' || value === 'all' ? value : undefined
}

function paramsFromSearch(searchParams: URLSearchParams): AuctionSearchParams {
  const limit = normalizeSearchResultLimit(searchParams.get('limit'))
  return {
    q: searchParams.get('q') || undefined,
    start_date: searchParams.get('start_date') || undefined,
    end_date: searchParams.get('end_date') || undefined,
    court_code: searchParams.get('court_code') || undefined,
    court_name: searchParams.get('court_name') || undefined,
    branch_name: searchParams.get('branch_name') || undefined,
    division_name: searchParams.get('division_name') || undefined,
    region: searchParams.get('region') || undefined,
    sido: searchParams.get('sido') || undefined,
    sigungu: searchParams.get('sigungu') || undefined,
    dong: searchParams.get('dong') || undefined,
    case_year: parseNumber(searchParams.get('case_year')),
    case_serial: parseNumber(searchParams.get('case_serial')),
    auction_kind: searchParams.get('auction_kind') || undefined,
    interested_party_role: searchParams.get('interested_party_role') || undefined,
    interested_party_name: searchParams.get('interested_party_name') || undefined,
    min_appraisal_amount: parseNumber(searchParams.get('min_appraisal_amount')),
    max_appraisal_amount: parseNumber(searchParams.get('max_appraisal_amount')),
    status: searchParams.get('status') || undefined,
    half_price: parseBoolean(searchParams.get('half_price')),
    min_failed_count: parseNumber(searchParams.get('min_failed_count')),
    max_failed_count: parseNumber(searchParams.get('max_failed_count')),
    min_lowest_sale_price: parseNumber(searchParams.get('min_lowest_sale_price')),
    max_lowest_sale_price: parseNumber(searchParams.get('max_lowest_sale_price')),
    min_building_area_pyeong: parseNumber(searchParams.get('min_building_area_pyeong')),
    max_building_area_pyeong: parseNumber(searchParams.get('max_building_area_pyeong')),
    min_land_area_pyeong: parseNumber(searchParams.get('min_land_area_pyeong')),
    max_land_area_pyeong: parseNumber(searchParams.get('max_land_area_pyeong')),
    building_name: searchParams.get('building_name') || undefined,
    goods_usage: searchParams.getAll('goods_usage'),
    special_type: searchParams.getAll('special_type'),
    match_mode: parseMatchMode(searchParams.get('match_mode')),
    sort_by: normalizeSearchResultSortBy(searchParams.get('sort_by')),
    limit,
    offset: normalizeSearchResultOffset(searchParams.get('offset'), limit),
  }
}

function useFilterLabels(searchParams: URLSearchParams) {
  return useMemo(() => {
    const labels: string[] = []
    const namedParams = [
      ['q', '검색어'],
      ['court_name', '법원'],
      ['branch_name', '지원'],
      ['division_name', '경매계'],
      ['sido', '시/도'],
      ['sigungu', '시/군/구'],
      ['dong', '읍/면/동'],
      ['region', '지역'],
      ['building_name', '건물명'],
      ['status', '상태'],
    ] as const

    namedParams.forEach(([key, label]) => {
      const value = searchParams.get(key)
      if (value) {
        labels.push(`${label}: ${value}`)
      }
    })

    searchParams.getAll('goods_usage').forEach((item) => labels.push(`종류: ${item}`))
    searchParams.getAll('special_type').forEach((item) => labels.push(`특수유형: ${item}`))

    if (searchParams.get('search_type') === 'npl') {
      labels.unshift('NPL 후보 물건')
    }

    if (searchParams.get('search_type') === 'comprehensive') {
      labels.unshift('상세검색')
    }

    if (searchParams.get('half_price')) {
      labels.push('반값 이하')
    }

    if (searchParams.get('min_failed_count')) {
      labels.push(`유찰 ${searchParams.get('min_failed_count')}회 이상`)
    }

    return labels
  }, [searchParams])
}

function ResultCard({
  goods,
  isFavorite,
  isFavoriteStatusLoading,
  onFavoriteChange,
}: {
  goods: AuctionGoodsSearchItem
  isFavorite: boolean
  isFavoriteStatusLoading: boolean
  onFavoriteChange: (auctionGoodsId: number, isFavorite: boolean) => void
}) {
  const address = goods.printed_address || goods.road_address || goods.lot_number_address

  return (
    <article className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-[13px] font-bold text-indigo-700">
            <span>{getText(goods.court_name)}</span>
            <span className="text-gray-300">/</span>
            <span>{getText(goods.branch_name)}</span>
            {goods.division_name && <span className="rounded-md bg-indigo-50 px-2 py-1">{goods.division_name}</span>}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-extrabold text-slate-700">
              물건 {getText(goods.disposal_goods_sequence)}
            </span>
            <span className="text-sm font-bold text-indigo-700">{getText(goods.goods_usage_name)}</span>
            <span className="text-sm text-gray-500">{getText(goods.goods_status_name, '')}</span>
          </div>
          <h2 className="mt-2 truncate text-xl font-extrabold text-slate-900">
            {getText(goods.building_name || address, '주소 정보 없음')}
          </h2>
          {address && (
            <p className="mt-1 flex items-center gap-1 truncate text-sm text-gray-500">
              <MapPin className="h-4 w-4 shrink-0" />
              {address}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-3 text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <CalendarDays className="h-4 w-4 text-gray-400" />
              {getText(goods.auction_date)} {getText(goods.auction_time, '')}
            </span>
            <span>{getText(goods.auction_place, '매각장소 미정')}</span>
            {typeof goods.distance_m === 'number' && (
              <span>기준점에서 {formatNumber(goods.distance_m, 'm')}</span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-3 md:items-end">
          <div className="grid grid-cols-2 gap-3 text-right sm:grid-cols-3">
            <div>
              <div className="text-xs text-gray-400">감정가</div>
              <div className="text-sm font-extrabold text-slate-900">{formatMoney(goods.appraisal_amount)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400">최저가</div>
              <div className="text-sm font-extrabold text-blue-800">
                {formatMoney(goods.first_announcement_lowest_sale_price)}
              </div>
            </div>
            <div className="hidden sm:block">
              <div className="text-xs text-gray-400">유찰</div>
              <div className="text-sm font-extrabold text-slate-900">{formatNumber(goods.failed_count, '회')}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            <FavoriteToggleButton
              auctionGoodsId={goods.auction_goods_id}
              initialIsFavorite={isFavorite}
              shouldFetchStatus={false}
              isStatusLoading={isFavoriteStatusLoading}
              onChange={(nextIsFavorite) => onFavoriteChange(goods.auction_goods_id, nextIsFavorite)}
            />
            <Link
              to={`/schedules/${goods.schedule_id}`}
              className="rounded-lg border border-indigo-200 px-3 py-2 text-sm font-bold text-indigo-700 transition-colors hover:bg-indigo-50"
            >
              공고 상세
            </Link>
            {goods.page_url && (
              <a
                href={getApiUrl(goods.page_url)}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
              >
                공고 페이지
              </a>
            )}
            <Link
              to={`/goods/${goods.auction_goods_id}`}
              className="group inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-extrabold text-white transition-colors hover:bg-indigo-700"
            >
              상세보기
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </div>
    </article>
  )
}

export default function SearchResultsPage() {
  const authSession = useAuthSession()
  const sessionUser = authSession?.user as { id?: unknown; login_id?: unknown } | undefined
  const authenticatedUserKey = authSession
    ? typeof sessionUser?.id === 'string'
      ? sessionUser.id
      : typeof sessionUser?.login_id === 'string'
        ? sessionUser.login_id
        : 'authenticated-user'
    : null
  const isSignedIn = authenticatedUserKey !== null
  const [searchParams, setSearchParams] = useSearchParams()
  const searchKey = searchParams.toString()
  const normalizedSearchKey = useMemo(
    () => normalizeSearchResultParams(new URLSearchParams(searchKey)).toString(),
    [searchKey],
  )
  const currentSearchParams = useMemo(
    () => new URLSearchParams(normalizedSearchKey),
    [normalizedSearchKey],
  )
  const [items, setItems] = useState<AuctionGoodsSearchItem[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [retryKey, setRetryKey] = useState(0)
  const [favoriteStatuses, setFavoriteStatuses] = useState<Record<number, boolean>>({})
  const [isFavoriteStatusesLoading, setIsFavoriteStatusesLoading] = useState(false)
  const [favoriteStatusMessage, setFavoriteStatusMessage] = useState('')
  const [query, setQuery] = useState(currentSearchParams.get('q') || '')
  const filterLabels = useFilterLabels(currentSearchParams)
  const sortBy = normalizeSearchResultSortBy(currentSearchParams.get('sort_by'))
  const limit = normalizeSearchResultLimit(currentSearchParams.get('limit'))
  const offset = normalizeSearchResultOffset(currentSearchParams.get('offset'), limit)
  const searchMode = parseSearchMode(currentSearchParams.get('search_type'))
  const pageTitle = searchMode === 'npl'
    ? 'NPL 후보 물건 검색결과'
    : searchMode === 'special'
      ? '특수물건 검색결과'
      : searchMode === 'comprehensive'
        ? '상세검색 결과'
        : '검색 결과'

  useEffect(() => {
    if (normalizedSearchKey !== searchKey) {
      setSearchParams(currentSearchParams, { replace: true })
    }
  }, [currentSearchParams, normalizedSearchKey, searchKey, setSearchParams])

  useEffect(() => {
    queueMicrotask(() => setQuery(currentSearchParams.get('q') || ''))
  }, [currentSearchParams])

  useEffect(() => {
    const controller = new AbortController()
    let isActive = true
    let isRedirectingToLastPage = false
    const params = paramsFromSearch(currentSearchParams)

    queueMicrotask(() => {
      if (isActive && !controller.signal.aborted) {
        setIsLoading(true)
        setErrorMessage('')
      }
    })

    searchGoods(params, searchMode, { signal: controller.signal })
      .then((response) => {
        if (!isActive || controller.signal.aborted) return

        const requestedOffset = params.offset ?? 0
        if (requestedOffset > 0 && response.items.length === 0) {
          const lastOffset = getLastSearchResultOffset(
            response.total,
            params.limit ?? DEFAULT_SEARCH_RESULT_LIMIT,
          )
          if (lastOffset !== requestedOffset) {
            isRedirectingToLastPage = true
            const next = new URLSearchParams(currentSearchParams)
            next.set('offset', String(lastOffset))
            setSearchParams(next, { replace: true })
            return
          }
        }

        setItems(response.items)
        setTotal(response.total)
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setErrorMessage(getKoreanErrorMessage(error, '검색에 실패했습니다.'))
          setItems([])
          setTotal(0)
        }
      })
      .finally(() => {
        if (!controller.signal.aborted && !isRedirectingToLastPage) {
          setIsLoading(false)
        }
      })

    return () => {
      isActive = false
      controller.abort()
    }
  }, [currentSearchParams, retryKey, searchMode, setSearchParams])

  useEffect(() => {
    const controller = new AbortController()
    if (!authenticatedUserKey || items.length === 0) {
      queueMicrotask(() => {
        if (!controller.signal.aborted) {
          setFavoriteStatuses({})
          setIsFavoriteStatusesLoading(false)
          setFavoriteStatusMessage('')
        }
      })
      return () => controller.abort()
    }

    const goodsIds = items.map((item) => item.auction_goods_id)
    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        setIsFavoriteStatusesLoading(true)
        setFavoriteStatusMessage('')
      }
    })
    getFavoriteStatuses(goodsIds, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return
        const nextStatuses: Record<number, boolean> = Object.fromEntries(
          goodsIds.map((goodsId) => [goodsId, false]),
        )
        response.items.forEach((status) => {
          nextStatuses[status.auction_goods_id] = status.is_favorite
        })
        setFavoriteStatuses(nextStatuses)
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setFavoriteStatuses({})
          setFavoriteStatusMessage(getKoreanErrorMessage(error, '관심 상태를 불러오지 못했습니다.'))
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsFavoriteStatusesLoading(false)
      })

    return () => controller.abort()
  }, [authenticatedUserKey, items])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const next = new URLSearchParams(currentSearchParams)

    if (query.trim()) {
      next.set('q', query.trim())
    } else {
      next.delete('q')
    }

    next.set('offset', '0')
    setSearchParams(next)
  }

  const handleSortChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const next = new URLSearchParams(currentSearchParams)
    next.set('sort_by', event.target.value)
    next.set('offset', '0')
    setSearchParams(next)
  }

  const handleOffsetChange = (nextOffset: number) => {
    const next = new URLSearchParams(currentSearchParams)
    next.set('offset', String(Math.max(0, nextOffset)))
    setSearchParams(next)
  }

  return (
    <Layout>
      <div className="w-full flex-grow bg-slate-50 px-4 py-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
          <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
            <form onSubmit={handleSubmit} className="relative flex-grow">
              <label htmlFor="search-results-query" className="sr-only">경매 물건 검색어</label>
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                id="search-results-query"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full rounded-lg border border-gray-200 py-3 pl-11 pr-4 text-sm font-medium outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                placeholder="사건번호, 법원, 주소, 용도 검색"
              />
            </form>
            <div className="flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4 text-gray-400" />
              <label htmlFor="search-results-sort" className="sr-only">검색 결과 정렬 기준</label>
              <select
                id="search-results-sort"
                value={sortBy}
                onChange={handleSortChange}
                className="rounded-lg border border-gray-200 bg-white px-3 py-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500"
              >
                {searchResultSortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900">{pageTitle}</h1>
              <p className="mt-1 text-sm text-gray-500">
                현재 조건에서 {total.toLocaleString('ko-KR')}개의 물건이 검색되었습니다.
                {total > items.length && items.length > 0 && (
                  <span className="ml-1 text-gray-400">
                    {items.length.toLocaleString('ko-KR')}개 표시 중
                  </span>
                )}
              </p>
            </div>
            {filterLabels.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {filterLabels.map((label) => (
                  <span key={label} className="rounded-md bg-indigo-50 px-3 py-1.5 text-xs font-extrabold text-indigo-700">
                    {label}
                  </span>
                ))}
              </div>
            )}
          </div>

          {isLoading && (
            <div className="flex min-h-80 items-center justify-center rounded-lg border border-gray-200 bg-white" role="status">
              <Loader2 className="h-7 w-7 animate-spin text-indigo-600" />
              <span className="sr-only">검색 결과를 불러오는 중</span>
            </div>
          )}

          {!isLoading && errorMessage && (
            <div className="rounded-lg border border-red-100 bg-red-50 p-5 text-sm font-bold text-red-700" role="alert">
              <p>{errorMessage}</p>
              <button
                type="button"
                onClick={() => setRetryKey((value) => value + 1)}
                className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-extrabold text-white hover:bg-red-800"
              >
                다시 시도
              </button>
            </div>
          )}

          {!isLoading && !errorMessage && favoriteStatusMessage && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800" role="status">
              {favoriteStatusMessage} 관심 저장 버튼은 계속 사용할 수 있습니다.
            </div>
          )}

          {!isLoading && !errorMessage && items.length === 0 && (
            <div className="rounded-lg border border-gray-200 bg-white p-10 text-center">
              <p className="text-lg font-extrabold text-slate-900">조건에 맞는 물건이 없습니다.</p>
              <p className="mt-2 text-sm text-gray-500">검색어를 줄이거나 지역, 물건종류 조건을 조정해보세요.</p>
            </div>
          )}

          {!isLoading && !errorMessage && items.length > 0 && (
            <div className="grid gap-4">
              {items.map((goods) => (
                <ResultCard
                  key={`${goods.schedule_id}-${goods.auction_goods_id}`}
                  goods={goods}
                  isFavorite={favoriteStatuses[goods.auction_goods_id] ?? false}
                  isFavoriteStatusLoading={isSignedIn && isFavoriteStatusesLoading}
                  onFavoriteChange={(auctionGoodsId, isFavorite) => {
                    setFavoriteStatuses((current) => ({ ...current, [auctionGoodsId]: isFavorite }))
                  }}
                />
              ))}
            </div>
          )}

          {!isLoading && !errorMessage && total > limit && (
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => handleOffsetChange(offset - limit)}
                disabled={offset === 0}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-gray-300"
              >
                <ChevronLeft className="h-4 w-4" /> 이전
              </button>
              <span className="text-sm font-bold text-gray-500">
                {Math.floor(offset / limit) + 1} / {Math.ceil(total / limit)} 페이지
              </span>
              <button
                type="button"
                onClick={() => handleOffsetChange(offset + limit)}
                disabled={offset + items.length >= total}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-gray-300"
              >
                다음 <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
