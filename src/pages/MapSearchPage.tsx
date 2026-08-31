import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  MapPinned,
  MapPin,
  ShieldCheck,
} from 'lucide-react'
import AuctionMap from '../components/AuctionMap'
import Layout from '../components/Layout'
import {
  reverseGeographicRegion,
  searchGeographicMapGoods,
  type GeographicBounds,
  type GeographicMapSearchParams,
  type GeographicSearchItem,
} from '../lib/auction-extra'
import { getKoreanErrorMessage, isNetworkRequestError } from '../lib/api'
import { getDongOptions } from '../lib/dong-filter-options'
import { formatMoney, formatNumber, getText } from '../lib/format'
import { getMapRegionSelectionFromRegion } from '../lib/map-region-selection'
import {
  GOODS_USAGE_VALUES_BY_PROPERTY_TYPE,
  PROPERTY_TYPE_GROUPS,
  PROVINCE_SEARCH_TERMS,
  REGION_PROVINCES,
  SIGUNGU_BY_PROVINCE,
} from '../lib/search-filter-options'
import { getDongViewport } from '../lib/dong-viewports'
import { getRegionViewport } from '../lib/region-viewports'

const PAGE_SIZE = 100
const AUTO_SEARCH_DEBOUNCE_MS = 450
const CONNECTION_RETRY_DELAYS_MS = [1_000, 3_000, 10_000] as const

type SearchErrorKind = 'validation' | 'request' | 'connection'
type LocationSelectionSource = 'filter' | 'map'

function optionalAmount(value: string) {
  if (!value.trim()) return undefined
  const parsed = Number(value.replaceAll(',', ''))
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : Number.NaN
}

function formatAmountInput(value: string, currentValue: string) {
  const digits = value.replaceAll(',', '')
  if (!/^\d*$/.test(digits)) return currentValue
  if (!digits) return ''
  const normalized = digits.replace(/^0+(?=\d)/, '')
  return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function isSameBounds(
  left: GeographicBounds | null,
  right: GeographicBounds,
) {
  return Boolean(
    left &&
    left.west === right.west &&
    left.south === right.south &&
    left.east === right.east &&
    left.north === right.north,
  )
}

function MapResultCard({
  item,
  selected,
  onSelect,
}: {
  item: GeographicSearchItem
  selected: boolean
  onSelect: (auctionGoodsId: number) => void
}) {
  const address = item.printed_address || item.road_address || item.lot_number_address
  const lowestPrice = item.current_lowest_sale_price ?? item.first_announcement_lowest_sale_price

  return (
    <article
      className={`rounded-xl border bg-white p-4 shadow-sm transition ${
        selected ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-gray-200 hover:border-indigo-300'
      }`}
    >
      <button type="button" onClick={() => onSelect(item.auction_goods_id)} className="w-full text-left">
        <div className="flex flex-wrap items-center gap-2 text-xs font-extrabold text-indigo-700">
          <span>{getText(item.court_name)}</span>
          {item.branch_name && <span className="text-gray-400">{item.branch_name}</span>}
          {item.case_number && <span className="rounded bg-indigo-50 px-2 py-1">{item.case_number}</span>}
        </div>
        <h2 className="mt-2 truncate text-base font-extrabold text-slate-900">
          {getText(item.building_name || address, `물건 ${item.auction_goods_id}`)}
        </h2>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-500">{getText(address, '주소 정보 없음')}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold text-gray-500">
          {item.goods_usage_name && <span>{item.goods_usage_name}</span>}
          {item.goods_status_name && <span>{item.goods_status_name}</span>}
          {typeof item.failed_count === 'number' && <span>유찰 {item.failed_count}회</span>}
          {item.auction_date && <span>매각 {item.auction_date}</span>}
        </div>
      </button>
      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-gray-100 pt-3 text-right">
        <div><div className="text-[11px] text-gray-400">감정가</div><div className="text-sm font-bold text-slate-700">{formatMoney(item.appraisal_amount)}</div></div>
        <div><div className="text-[11px] text-blue-500">현재 최저가</div><div className="text-sm font-extrabold text-blue-800">{formatMoney(lowestPrice)}</div></div>
      </div>
      <div className="mt-3 flex gap-2">
        {item.schedule_id && <Link to={`/schedules/${item.schedule_id}`} className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-center text-xs font-bold text-slate-700 hover:bg-slate-50">공고</Link>}
        <Link to={`/goods/${item.auction_goods_id}`} className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-center text-xs font-extrabold text-white hover:bg-indigo-700">상세 보기</Link>
      </div>
    </article>
  )
}

export default function MapSearchPage() {
  const [selectedProvince, setSelectedProvince] = useState('')
  const [selectedSigungu, setSelectedSigungu] = useState('')
  const [selectedDong, setSelectedDong] = useState('')
  const [locationSelectionSource, setLocationSelectionSource] = useState<LocationSelectionSource>('filter')
  const [selectedPropertyType, setSelectedPropertyType] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [viewportBounds, setViewportBounds] = useState<GeographicBounds | null>(null)
  const [appliedParams, setAppliedParams] = useState<GeographicMapSearchParams | null>(null)
  const [items, setItems] = useState<GeographicSearchItem[]>([])
  const [total, setTotal] = useState(0)
  const [excludedCount, setExcludedCount] = useState(0)
  const [selectedGoodsId, setSelectedGoodsId] = useState<number | null>(null)
  const [isViewportDirty, setIsViewportDirty] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [searchErrorKind, setSearchErrorKind] = useState<SearchErrorKind | null>(null)
  const [connectionFailureCount, setConnectionFailureCount] = useState(0)
  const [connectionRetryRevision, setConnectionRetryRevision] = useState(0)
  const [mapFocusMessage, setMapFocusMessage] = useState('')
  const [regionFocusKey, setRegionFocusKey] = useState<string | null>(null)
  const [pendingViewportKey, setPendingViewportKey] = useState<string | null>(null)
  const [isResolvingMapRegion, setIsResolvingMapRegion] = useState(false)
  const requestGenerationRef = useRef(0)
  const appliedParamsGenerationRef = useRef(-1)
  const viewportBoundsRef = useRef<GeographicBounds | null>(null)
  const reverseRegionGenerationRef = useRef(0)
  const reverseRegionAbortRef = useRef<AbortController | null>(null)

  const markSearchDirty = useCallback(() => {
    requestGenerationRef.current += 1
    setSelectedGoodsId(null)
    setIsViewportDirty(true)
    setErrorMessage('')
    setSearchErrorKind(null)
    setConnectionFailureCount(0)
  }, [])

  const handleBoundsChange = useCallback((bounds: GeographicBounds) => {
    if (isSameBounds(viewportBoundsRef.current, bounds)) return
    viewportBoundsRef.current = bounds
    setViewportBounds(bounds)
    markSearchDirty()
  }, [markSearchDirty])

  const cancelReverseRegionLookup = useCallback(() => {
    reverseRegionGenerationRef.current += 1
    reverseRegionAbortRef.current?.abort()
    reverseRegionAbortRef.current = null
    setIsResolvingMapRegion(false)
  }, [])

  const handleUserBoundsChange = useCallback((bounds: GeographicBounds) => {
    reverseRegionGenerationRef.current += 1
    const requestGeneration = reverseRegionGenerationRef.current
    reverseRegionAbortRef.current?.abort()
    const controller = new AbortController()
    reverseRegionAbortRef.current = controller

    setIsResolvingMapRegion(true)
    setLocationSelectionSource('map')
    setRegionFocusKey(null)
    setPendingViewportKey(null)
    setMapFocusMessage('지도 중심의 소재지를 확인합니다.')

    const longitude = (bounds.west + bounds.east) / 2
    const latitude = (bounds.south + bounds.north) / 2
    reverseGeographicRegion(longitude, latitude, controller.signal)
      .then((response) => {
        if (
          controller.signal.aborted ||
          requestGeneration !== reverseRegionGenerationRef.current
        ) return
        const selection = response.region
          ? getMapRegionSelectionFromRegion(response.region)
          : null
        if (!selection) {
          setSelectedProvince('')
          setSelectedSigungu('')
          setSelectedDong('')
          setMapFocusMessage('현재 지도 중심의 소재지를 확인할 수 없어 지도 범위만으로 검색합니다.')
          return
        }
        setSelectedProvince(selection.province)
        setSelectedSigungu(selection.sigungu)
        setSelectedDong(selection.dong)
        const selectionLabel = [
          selection.province,
          selection.sigungu,
          selection.dong,
        ].filter(Boolean).join(' ')
        setMapFocusMessage(
          `${selectionLabel} 소재지가 지도 중심에 맞춰 자동으로 변경되었습니다.`,
        )
      })
      .catch(() => {
        if (
          controller.signal.aborted ||
          requestGeneration !== reverseRegionGenerationRef.current
        ) return
        setSelectedProvince('')
        setSelectedSigungu('')
        setSelectedDong('')
        setMapFocusMessage('현재 지도 중심의 소재지를 확인할 수 없어 지도 범위만으로 검색합니다.')
      })
      .finally(() => {
        if (requestGeneration !== reverseRegionGenerationRef.current) return
        reverseRegionAbortRef.current = null
        setIsResolvingMapRegion(false)
      })
  }, [])

  useEffect(() => () => {
    reverseRegionGenerationRef.current += 1
    reverseRegionAbortRef.current?.abort()
  }, [])

  useEffect(() => {
    if (
      !appliedParams ||
      appliedParamsGenerationRef.current !== requestGenerationRef.current
    ) return
    const controller = new AbortController()
    const requestGeneration = appliedParamsGenerationRef.current
    let isActive = true
    queueMicrotask(() => {
      if (isActive) {
        setIsLoading(true)
      }
    })

    searchGeographicMapGoods(appliedParams, controller.signal)
      .then((response) => {
        if (!isActive || requestGeneration !== requestGenerationRef.current) return
        setItems(response.items)
        setTotal(response.total)
        setExcludedCount(response.coverage.excluded_unconvertible)
        setSelectedGoodsId(null)
        setIsViewportDirty(false)
        setErrorMessage('')
        setSearchErrorKind(null)
        setConnectionFailureCount(0)
      })
      .catch((error: unknown) => {
        if (
          !isActive ||
          controller.signal.aborted ||
          requestGeneration !== requestGenerationRef.current
        ) return
        setItems([])
        setTotal(0)
        setExcludedCount(0)
        if (isNetworkRequestError(error)) {
          setErrorMessage('지도 검색 서비스에 연결할 수 없습니다. 잠시 후 자동으로 다시 시도합니다.')
          setSearchErrorKind('connection')
          setConnectionFailureCount((count) => count + 1)
          return
        }
        setErrorMessage(getKoreanErrorMessage(error, '현재 지도 영역의 물건을 불러오지 못했습니다.'))
        setSearchErrorKind('request')
        setConnectionFailureCount(0)
      })
      .finally(() => {
        if (isActive) setIsLoading(false)
      })

    return () => {
      isActive = false
      controller.abort()
    }
  }, [appliedParams, connectionRetryRevision])

  useEffect(() => {
    if (connectionFailureCount === 0 || !appliedParams) return

    const delayIndex = Math.min(
      connectionFailureCount - 1,
      CONNECTION_RETRY_DELAYS_MS.length - 1,
    )
    const timer = window.setTimeout(() => {
      setConnectionRetryRevision((revision) => revision + 1)
    }, CONNECTION_RETRY_DELAYS_MS[delayIndex])

    return () => window.clearTimeout(timer)
  }, [appliedParams, connectionFailureCount])

  const mappedCount = useMemo(
    () => items.filter((item) => typeof item.latitude === 'number' && typeof item.longitude === 'number').length,
    [items],
  )
  const sigunguOptions = selectedProvince
    ? SIGUNGU_BY_PROVINCE[selectedProvince] || []
    : []
  const dongOptions = selectedProvince && selectedSigungu
    ? getDongOptions(selectedProvince, selectedSigungu)
    : []
  const exactDongViewport = selectedDong
    ? getDongViewport(selectedProvince, selectedSigungu, selectedDong)
    : null
  const regionViewportTarget = useMemo(() => {
    if (!regionFocusKey) return null
    if (selectedDong && !exactDongViewport) {
      throw new Error(
        `${selectedProvince} ${selectedSigungu} ${selectedDong}의 지도 경계가 없습니다.`,
      )
    }

    return {
      key: regionFocusKey,
      bounds: exactDongViewport
        ?? getRegionViewport(selectedProvince, selectedSigungu),
      maxZoom: selectedDong
        ? 18
        : selectedSigungu ? 12 : selectedProvince ? 10 : 8,
      padding: selectedDong ? 8 : 28,
    }
  }, [
    exactDongViewport,
    regionFocusKey,
    selectedDong,
    selectedProvince,
    selectedSigungu,
  ])

  useEffect(() => {
    if (pendingViewportKey || isResolvingMapRegion || !viewportBounds) return

    const timer = window.setTimeout(() => {
      const parsedMinPrice = optionalAmount(minPrice)
      const parsedMaxPrice = optionalAmount(maxPrice)
      if (Number.isNaN(parsedMinPrice) || Number.isNaN(parsedMaxPrice)) {
        setErrorMessage('가격은 0 이상의 원 단위 숫자로 입력해 주세요.')
        setSearchErrorKind('validation')
        setConnectionFailureCount(0)
        return
      }
      if (
        parsedMinPrice !== undefined &&
        parsedMaxPrice !== undefined &&
        parsedMinPrice > parsedMaxPrice
      ) {
        setErrorMessage('최소 가격은 최대 가격보다 클 수 없습니다.')
        setSearchErrorKind('validation')
        setConnectionFailureCount(0)
        return
      }

      setErrorMessage('')
      setSearchErrorKind(null)
      setConnectionFailureCount(0)
      appliedParamsGenerationRef.current = requestGenerationRef.current
      setAppliedParams({
        ...viewportBounds,
        sido: locationSelectionSource === 'filter' && selectedProvince
          ? PROVINCE_SEARCH_TERMS[selectedProvince]
          : undefined,
        sigungu: locationSelectionSource === 'filter' && selectedSigungu
          ? selectedSigungu
          : undefined,
        dong: locationSelectionSource === 'filter' && selectedDong
          ? selectedDong
          : undefined,
        goods_usage: selectedPropertyType
          ? GOODS_USAGE_VALUES_BY_PROPERTY_TYPE[selectedPropertyType]
          : undefined,
        min_lowest_sale_price: parsedMinPrice,
        max_lowest_sale_price: parsedMaxPrice,
        limit: PAGE_SIZE,
        offset: 0,
      })
    }, AUTO_SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timer)
  }, [
    isResolvingMapRegion,
    locationSelectionSource,
    maxPrice,
    minPrice,
    pendingViewportKey,
    selectedDong,
    selectedPropertyType,
    selectedProvince,
    selectedSigungu,
    viewportBounds,
  ])

  const handleViewportTargetApplied = useCallback((key: string) => {
    setPendingViewportKey((current) => current === key ? null : current)
    if (key === 'region:korea') {
      setMapFocusMessage('전국 지도로 이동이 완료되었습니다.')
      return
    }
    const [, province, sigungu, dong] = key.split(':')
    const regionLabel = dong && dong !== 'all'
      ? `${province} ${sigungu} ${dong}`
      : sigungu === 'all' ? province : `${province} ${sigungu}`
    setMapFocusMessage(`${regionLabel} 지역으로 지도 이동이 완료되었습니다.`)
  }, [])

  const selectProvince = (province: string) => {
    const focusKey = province ? `region:${province}:all` : 'region:korea'
    cancelReverseRegionLookup()
    markSearchDirty()
    setLocationSelectionSource('filter')
    setSelectedProvince(province)
    setSelectedSigungu('')
    setSelectedDong('')
    setRegionFocusKey(focusKey)
    setPendingViewportKey(focusKey)
    setMapFocusMessage(province
      ? `${province} 지역으로 지도를 이동합니다.`
      : '전국 지도로 이동합니다.')
  }

  const selectSigungu = (sigungu: string) => {
    const focusKey = `region:${selectedProvince}:${sigungu || 'all'}:all`
    cancelReverseRegionLookup()
    markSearchDirty()
    setLocationSelectionSource('filter')
    setSelectedSigungu(sigungu)
    setSelectedDong('')
    setRegionFocusKey(focusKey)
    setPendingViewportKey(focusKey)
    setMapFocusMessage(sigungu
      ? `${selectedProvince} ${sigungu} 지역으로 지도를 이동합니다.`
      : `${selectedProvince} 전체 지역으로 지도를 이동합니다.`)
  }

  const selectDong = (dong: string) => {
    const focusKey = `region:${selectedProvince}:${selectedSigungu}:${dong || 'all'}`
    cancelReverseRegionLookup()
    markSearchDirty()
    setLocationSelectionSource('filter')
    setSelectedDong(dong)
    setRegionFocusKey(focusKey)
    setPendingViewportKey(focusKey)
    setMapFocusMessage(dong
      ? `${selectedProvince} ${selectedSigungu} ${dong} 지역으로 지도를 이동합니다.`
      : `${selectedProvince} ${selectedSigungu} 전체 지역으로 지도를 이동합니다.`)
  }

  const resetSelectionFilters = () => {
    cancelReverseRegionLookup()
    markSearchDirty()
    setLocationSelectionSource('filter')
    setSelectedProvince('')
    setSelectedSigungu('')
    setSelectedDong('')
    setSelectedPropertyType('')
    setMinPrice('')
    setMaxPrice('')
    setRegionFocusKey('region:korea')
    setPendingViewportKey('region:korea')
    setMapFocusMessage('선택 조건을 초기화하고 전국 지도로 이동합니다.')
  }

  const currentOffset = appliedParams?.offset ?? 0
  const movePage = (offset: number) => {
    setAppliedParams((current) => current ? { ...current, offset: Math.max(0, offset) } : current)
  }

  return (
    <Layout>
      <div className="w-full flex-grow bg-slate-50 px-4 py-6">
        <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-2 w-fit rounded-full bg-blue-100 px-3 py-1 text-[11px] font-extrabold text-blue-700">현재 지도 화면 기준 · 자동검색</p>
              <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-900"><MapPinned className="h-6 w-6 text-blue-600" /> 지도 영역 경매물건 찾기</h1>
              <p className="mt-1 text-sm text-gray-500">지도를 움직이면 현재 화면 안의 물건을 자동으로 검색하고 마커와 목록을 함께 비교합니다.</p>
            </div>
            <Link
              to="/data-licenses"
              aria-label="지도 및 행정구역 데이터 출처와 이용조건 보기"
              className="inline-flex w-fit shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-white px-4 py-2 text-xs font-bold text-gray-600 shadow-sm ring-1 ring-gray-200 transition-colors hover:bg-slate-50 hover:text-blue-700"
            >
              <ShieldCheck className="h-4 w-4 text-blue-600" aria-hidden="true" />
              <span>지도·데이터 출처</span>
              <span className="hidden text-gray-400 sm:inline">OSM · 국토부 VWorld</span>
            </Link>
          </div>

          <div className="min-w-0 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(180px,0.7fr)_minmax(320px,1.3fr)]">
              <label className="min-w-0 rounded-xl border border-gray-200 bg-slate-50/70 p-3">
                <span className="mb-1 block text-xs font-extrabold text-slate-600">물건종류</span>
                <select
                  aria-label="물건종류"
                  value={selectedPropertyType}
                  onChange={(event) => {
                    markSearchDirty()
                    setSelectedPropertyType(event.target.value)
                  }}
                  className="w-full min-w-0 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500"
                >
                  <option value="">전체</option>
                  {PROPERTY_TYPE_GROUPS.map((group) => (
                    <optgroup key={group.id} label={group.title}>
                      {group.items.map((item) => <option key={item} value={item}>{item}</option>)}
                    </optgroup>
                  ))}
                </select>
              </label>
              <fieldset className="min-w-0 rounded-xl border border-gray-200 bg-slate-50/70 p-3" aria-label="최저가 범위">
                <legend className="px-1 text-xs font-extrabold text-slate-600">최저가 범위</legend>
                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center rounded-xl border border-gray-200 bg-white focus-within:border-indigo-500">
                  <input inputMode="numeric" value={minPrice} onChange={(event) => {
                    const nextValue = formatAmountInput(event.target.value, minPrice)
                    if (nextValue === minPrice) return
                    markSearchDirty()
                    setMinPrice(nextValue)
                  }} placeholder="최소 가격" aria-label="최저가 최소" className="w-full min-w-0 rounded-l-xl border-0 bg-transparent px-3 py-2.5 text-sm outline-none" />
                  <span className="px-1 text-sm font-extrabold text-slate-400" aria-hidden="true">~</span>
                  <input inputMode="numeric" value={maxPrice} onChange={(event) => {
                    const nextValue = formatAmountInput(event.target.value, maxPrice)
                    if (nextValue === maxPrice) return
                    markSearchDirty()
                    setMaxPrice(nextValue)
                  }} placeholder="최대 가격" aria-label="최저가 최대" className="w-full min-w-0 rounded-r-xl border-0 bg-transparent px-3 py-2.5 text-sm outline-none" />
                </div>
              </fieldset>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <p className="flex items-center gap-2 text-xs text-gray-500"><Filter className="h-4 w-4" /> 지도 이동과 조건 변경이 끝나면 현재 화면의 물건을 자동으로 검색합니다.</p>
                <button type="button" onClick={resetSelectionFilters} disabled={!selectedProvince && !selectedPropertyType && !minPrice && !maxPrice} className="text-xs font-extrabold text-indigo-600 hover:text-indigo-800 disabled:cursor-not-allowed disabled:text-gray-300">조건 초기화</button>
              </div>
              <span className="text-xs font-extrabold text-indigo-600" aria-live="polite">
                {pendingViewportKey
                  ? '지도 이동 중'
                  : isResolvingMapRegion
                    ? '지도 중심 소재지 확인 중'
                    : searchErrorKind === 'connection'
                    ? '지도 검색 서비스에 다시 연결 중'
                  : isLoading
                    ? '현재 지도 자동 검색 중'
                    : searchErrorKind === 'validation'
                      ? '자동 검색 조건을 확인해 주세요'
                    : searchErrorKind === 'request'
                      ? '자동 검색을 완료하지 못했습니다'
                    : isViewportDirty
                      ? '자동 검색 준비 중'
                      : '현재 지도 자동 검색 완료'}
              </span>
            </div>
          </div>

          {errorMessage && <div className="rounded-xl border border-red-100 bg-red-50 px-5 py-4 text-sm font-bold text-red-700" role="alert">{errorMessage}</div>}

          <div className="grid min-h-[680px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.8fr)]">
            <div className="relative min-h-[520px] overflow-hidden border-b border-gray-200 xl:border-b-0 xl:border-r">
              <AuctionMap
                items={items}
                selectedGoodsId={selectedGoodsId}
                focusSelectedItem={false}
                viewportTarget={regionViewportTarget}
                viewportZoomSnap={0.1}
                onViewportTargetApplied={handleViewportTargetApplied}
                onSelectGoods={setSelectedGoodsId}
                onBoundsChange={handleBoundsChange}
                onUserBoundsChange={handleUserBoundsChange}
                className="h-[520px] xl:h-[680px]"
              />
              <fieldset
                aria-label="지도 소재지"
                aria-busy={isResolvingMapRegion}
                className="absolute left-14 top-3 z-[900] w-[calc(100%-4.5rem)] max-w-xl rounded-xl bg-white/95 p-2 shadow-lg ring-1 ring-gray-200 backdrop-blur"
              >
                <legend className="sr-only">지도 소재지</legend>
                <div className="grid min-w-0 grid-cols-3 gap-1.5">
                  <label className="min-w-0">
                    <span className="sr-only">시·도</span>
                    <select
                      aria-label="시·도"
                      value={selectedProvince}
                      onChange={(event) => selectProvince(event.target.value)}
                      className="w-full min-w-0 rounded-lg border border-gray-200 bg-white px-2 py-2 text-xs font-bold text-slate-700 shadow-sm outline-none focus:border-indigo-500"
                    >
                      <option value="">시·도 전체</option>
                      {REGION_PROVINCES.map((province) => <option key={province} value={province}>{province}</option>)}
                    </select>
                  </label>
                  <label className="min-w-0">
                    <span className="sr-only">시·군·구</span>
                    <select
                      aria-label="시·군·구"
                      value={selectedSigungu}
                      onChange={(event) => selectSigungu(event.target.value)}
                      disabled={!selectedProvince}
                      className="w-full min-w-0 rounded-lg border border-gray-200 bg-white px-2 py-2 text-xs font-bold text-slate-700 shadow-sm outline-none focus:border-indigo-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      <option value="">시·군·구 전체</option>
                      {sigunguOptions.map((sigungu) => <option key={sigungu} value={sigungu}>{sigungu}</option>)}
                    </select>
                  </label>
                  <label className="min-w-0">
                    <span className="sr-only">읍·면·동</span>
                    <select
                      aria-label="읍·면·동"
                      value={selectedDong}
                      onChange={(event) => selectDong(event.target.value)}
                      disabled={!selectedSigungu}
                      className="w-full min-w-0 rounded-lg border border-gray-200 bg-white px-2 py-2 text-xs font-bold text-slate-700 shadow-sm outline-none focus:border-indigo-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      <option value="">읍·면·동 전체</option>
                      {dongOptions.map((dong) => <option key={dong} value={dong}>{dong}</option>)}
                    </select>
                  </label>
                </div>
              </fieldset>
              <p className="sr-only" role="status" aria-live="polite">{mapFocusMessage}</p>
            </div>

            <aside className="flex min-h-0 flex-col bg-slate-50/70">
              <div className="border-b border-gray-200 bg-white px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div><div className="text-xs font-bold text-gray-400">현재 영역</div><div className="mt-1 text-lg font-extrabold text-slate-900">{searchErrorKind === 'connection' ? '연결 확인 중' : formatNumber(total, '개')}</div></div>
                  {items.length > 0 && <div className="text-right text-xs font-bold text-gray-500"><MapPin className="mr-1 inline h-4 w-4 text-indigo-600" />마커 {mappedCount}개</div>}
                </div>
                {excludedCount > 0 && <p className="mt-2 text-xs text-amber-700">현재 페이지 후보 중 좌표를 변환할 수 없는 {excludedCount}개 물건은 지도·목록에서 제외됐습니다.</p>}
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-3 xl:max-h-[550px]">
                {isLoading && <div className="flex min-h-52 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-indigo-600" /></div>}
                {!isLoading && errorMessage && items.length === 0 && (
                  <div className="rounded-xl border border-dashed border-red-200 bg-white p-8 text-center text-sm text-red-600">
                    {searchErrorKind === 'connection'
                      ? '지도 검색 서비스 연결을 복구하는 동안 잠시 기다려 주세요.'
                      : searchErrorKind === 'validation'
                        ? '검색 조건을 확인하면 자동으로 다시 검색합니다.'
                        : '검색 결과를 불러오지 못했습니다.'}
                  </div>
                )}
                {!isLoading && !errorMessage && appliedParams && items.length === 0 && <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">현재 지도와 조건에 맞는 물건이 없습니다.</div>}
                {!isLoading && !appliedParams && <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center"><MapPin className="mx-auto h-7 w-7 text-gray-300" /><p className="mt-3 text-sm font-bold text-gray-600">현재 지도 범위의 물건을 자동으로 검색할 준비를 하고 있습니다.</p></div>}
                {!isLoading && items.map((item) => <MapResultCard key={item.auction_goods_id} item={item} selected={item.auction_goods_id === selectedGoodsId} onSelect={setSelectedGoodsId} />)}
              </div>

              {!isLoading && total > PAGE_SIZE && (
                <div className="flex items-center justify-center gap-3 border-t border-gray-200 bg-white p-3">
                  <button type="button" onClick={() => movePage(currentOffset - PAGE_SIZE)} disabled={isViewportDirty || currentOffset === 0} className="rounded-lg border border-gray-200 p-2 disabled:text-gray-300" aria-label="이전 페이지"><ChevronLeft className="h-5 w-5" /></button>
                  <span className="text-xs font-extrabold text-gray-500">{Math.floor(currentOffset / PAGE_SIZE) + 1} / {Math.ceil(total / PAGE_SIZE)}</span>
                  <button type="button" onClick={() => movePage(currentOffset + PAGE_SIZE)} disabled={isViewportDirty || currentOffset + PAGE_SIZE >= total} className="rounded-lg border border-gray-200 p-2 disabled:text-gray-300" aria-label="다음 페이지"><ChevronRight className="h-5 w-5" /></button>
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>
    </Layout>
  )
}
