import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  MapPin,
  ShieldCheck,
} from 'lucide-react'
import AuctionMap, { type MapPoint } from '../components/AuctionMap'
import Layout from '../components/Layout'
import {
  getGeographicSearchItemKey,
  reverseGeographicRegion,
  searchGeographicMapGoods,
  type GeographicBounds,
  type GeographicMapCluster,
  type GeographicMapSearchParams,
  type GeographicSearchItem,
} from '../lib/auction-extra'
import { getKoreanErrorMessage, isNetworkRequestError } from '../lib/api'
import { getDongOptions } from '../lib/dong-filter-options'
import { formatAmountInput, formatMoney, formatNumber, getText, optionalAmount } from '../lib/format'
import { getMapRegionSelectionFromRegion } from '../lib/map-region-selection'
import { getMapClusterLevel, getMapSearchBounds } from '../lib/map-search-viewport'
import {
  GOODS_USAGE_VALUES_BY_PROPERTY_TYPE,
  PROPERTY_TYPE_GROUPS,
  REGION_PROVINCES,
  SIGUNGU_BY_PROVINCE,
} from '../lib/search-filter-options'
import { getDongViewport } from '../lib/dong-viewports'
import { getRegionViewport } from '../lib/region-viewports'

const PAGE_SIZE = 100
const AUTO_SEARCH_DEBOUNCE_MS = 450
const CONNECTION_RETRY_DELAYS_MS = [1_000, 3_000, 10_000] as const

type SearchErrorKind = 'validation' | 'request' | 'connection'

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
  onSelect: (itemKey: string) => void
}) {
  const address = item.printed_address || item.road_address || item.lot_number_address
  const lowestPrice = item.current_lowest_sale_price ?? item.first_announcement_lowest_sale_price

  return (
    <article
      className={`rounded-xl border bg-white p-4 shadow-sm transition ${
        selected ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-gray-200 hover:border-indigo-300'
      }`}
    >
      <button type="button" onClick={() => onSelect(getGeographicSearchItemKey(item))} className="w-full text-left">
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
  const [selectedPropertyType, setSelectedPropertyType] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [viewportBounds, setViewportBounds] = useState<GeographicBounds | null>(null)
  const [viewportZoom, setViewportZoom] = useState(8)
  const [appliedParams, setAppliedParams] = useState<GeographicMapSearchParams | null>(null)
  const [items, setItems] = useState<GeographicSearchItem[]>([])
  const [clusters, setClusters] = useState<GeographicMapCluster[] | null>(null)
  const [total, setTotal] = useState(0)
  const [excludedCount, setExcludedCount] = useState(0)
  const [selectedItemKey, setSelectedItemKey] = useState<string | null>(null)
  const [isMapMoving, setIsMapMoving] = useState(false)
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
  const viewportZoomRef = useRef(8)
  const reverseRegionGenerationRef = useRef(0)
  const reverseRegionAbortRef = useRef<AbortController | null>(null)
  const searchAbortRef = useRef<AbortController | null>(null)
  const regionFocusRevisionRef = useRef(0)

  const markSearchDirty = useCallback(() => {
    requestGenerationRef.current += 1
    searchAbortRef.current?.abort()
    setSelectedItemKey(null)
    setItems([])
    setClusters(null)
    setTotal(0)
    setExcludedCount(0)
    setIsLoading(false)
    setIsViewportDirty(true)
    setErrorMessage('')
    setSearchErrorKind(null)
    setConnectionFailureCount(0)
  }, [])

  const handleBoundsChange = useCallback((bounds: GeographicBounds, zoom: number) => {
    setIsMapMoving(false)
    if (isSameBounds(viewportBoundsRef.current, bounds) && viewportZoomRef.current === zoom) return
    viewportBoundsRef.current = bounds
    viewportZoomRef.current = zoom
    setViewportBounds(bounds)
    setViewportZoom(zoom)
    markSearchDirty()
  }, [markSearchDirty])

  const cancelReverseRegionLookup = useCallback(() => {
    reverseRegionGenerationRef.current += 1
    reverseRegionAbortRef.current?.abort()
    reverseRegionAbortRef.current = null
    setIsResolvingMapRegion(false)
  }, [])

  const handleViewportChangeStart = useCallback(() => {
    cancelReverseRegionLookup()
    markSearchDirty()
    setIsMapMoving(true)
  }, [cancelReverseRegionLookup, markSearchDirty])

  const handleUserBoundsChange = useCallback((_bounds: GeographicBounds, center: MapPoint) => {
    reverseRegionGenerationRef.current += 1
    const requestGeneration = reverseRegionGenerationRef.current
    reverseRegionAbortRef.current?.abort()
    const controller = new AbortController()
    reverseRegionAbortRef.current = controller

    setIsResolvingMapRegion(true)
    setRegionFocusKey(null)
    setPendingViewportKey(null)
    setMapFocusMessage('지도 중심의 소재지를 확인합니다.')

    const { longitude, latitude } = center
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
    searchAbortRef.current = controller
    let isActive = true
    queueMicrotask(() => {
      if (isActive && requestGeneration === requestGenerationRef.current) {
        setIsLoading(true)
      }
    })

    searchGeographicMapGoods(appliedParams, controller.signal)
      .then((response) => {
        if (!isActive || requestGeneration !== requestGenerationRef.current) return
        setItems(response.items)
        setClusters(appliedParams.cluster_by ? response.clusters ?? null : null)
        setTotal(response.total)
        setExcludedCount(response.coverage.excluded_unconvertible)
        setSelectedItemKey(null)
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
        setClusters(null)
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
        if (isActive && requestGeneration === requestGenerationRef.current) setIsLoading(false)
      })

    return () => {
      isActive = false
      controller.abort()
      if (searchAbortRef.current === controller) searchAbortRef.current = null
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
    if (pendingViewportKey || isMapMoving || !viewportBounds) return

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
      const searchBounds = getMapSearchBounds(viewportBounds)
      if (!searchBounds) {
        appliedParamsGenerationRef.current = -1
        setAppliedParams(null)
        setIsViewportDirty(false)
        return
      }
      appliedParamsGenerationRef.current = requestGenerationRef.current
      setAppliedParams({
        ...searchBounds,
        cluster_by: getMapClusterLevel(viewportBounds, viewportZoom),
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
    isMapMoving,
    maxPrice,
    minPrice,
    pendingViewportKey,
    selectedPropertyType,
    viewportBounds,
    viewportZoom,
  ])

  const handleViewportTargetApplied = useCallback((key: string) => {
    setPendingViewportKey((current) => current === key ? null : current)
    const [, province, sigungu, dong] = key.split(':')
    if (province === 'korea') {
      setMapFocusMessage('전국 지도로 이동이 완료되었습니다.')
      return
    }
    const regionLabel = dong && dong !== 'all'
      ? `${province} ${sigungu} ${dong}`
      : sigungu === 'all' ? province : `${province} ${sigungu}`
    setMapFocusMessage(`${regionLabel} 지역으로 지도 이동이 완료되었습니다.`)
  }, [])

  const createRegionFocusKey = (province = '', sigungu = '', dong = '') => (
    ['region', province || 'korea', sigungu || 'all', dong || 'all', ++regionFocusRevisionRef.current].join(':')
  )

  const selectProvince = (province: string) => {
    const focusKey = createRegionFocusKey(province)
    cancelReverseRegionLookup()
    markSearchDirty()
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
    const focusKey = createRegionFocusKey(selectedProvince, sigungu)
    cancelReverseRegionLookup()
    markSearchDirty()
    setSelectedSigungu(sigungu)
    setSelectedDong('')
    setRegionFocusKey(focusKey)
    setPendingViewportKey(focusKey)
    setMapFocusMessage(sigungu
      ? `${selectedProvince} ${sigungu} 지역으로 지도를 이동합니다.`
      : `${selectedProvince} 전체 지역으로 지도를 이동합니다.`)
  }

  const selectDong = (dong: string) => {
    const focusKey = createRegionFocusKey(selectedProvince, selectedSigungu, dong)
    cancelReverseRegionLookup()
    markSearchDirty()
    setSelectedDong(dong)
    setRegionFocusKey(focusKey)
    setPendingViewportKey(focusKey)
    setMapFocusMessage(dong
      ? `${selectedProvince} ${selectedSigungu} ${dong} 지역으로 지도를 이동합니다.`
      : `${selectedProvince} ${selectedSigungu} 전체 지역으로 지도를 이동합니다.`)
  }

  const resetSelectionFilters = () => {
    const focusKey = createRegionFocusKey()
    cancelReverseRegionLookup()
    markSearchDirty()
    setSelectedProvince('')
    setSelectedSigungu('')
    setSelectedDong('')
    setSelectedPropertyType('')
    setMinPrice('')
    setMaxPrice('')
    setRegionFocusKey(focusKey)
    setPendingViewportKey(focusKey)
    setMapFocusMessage('선택 조건을 초기화하고 전국 지도로 이동합니다.')
  }

  const currentOffset = appliedParams?.offset ?? 0
  const clusterLabel = appliedParams?.cluster_by === 'sido' ? '시·도' : '시·군·구'
  const isSearchPending = isLoading || (isViewportDirty && !errorMessage)
  const movePage = (offset: number) => {
    setAppliedParams((current) => current ? { ...current, offset: Math.max(0, offset) } : current)
  }

  return (
    <Layout fullHeight>
      <div className="flex min-h-0 w-full flex-1 flex-col bg-slate-50 p-2 md:p-3">
        <div className="flex min-h-0 w-full flex-1 flex-col gap-2">
          <h1 className="sr-only">지도 영역 경매물건 찾기</h1>
          <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1.5fr)_minmax(min(50%,280px),1fr)] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm md:grid-cols-[minmax(0,1fr)_320px] md:grid-rows-1 xl:grid-cols-[minmax(0,1fr)_400px]">
            <div className="relative min-h-0 min-w-0 overflow-hidden border-b border-gray-200 md:border-b-0 md:border-r">
              <AuctionMap
                items={items}
                clusters={clusters}
                selectedItemKey={selectedItemKey}
                focusSelectedItem={false}
                viewportTarget={regionViewportTarget}
                viewportZoomSnap={0.1}
                minZoom={6}
                onViewportTargetApplied={handleViewportTargetApplied}
                onSelectItem={setSelectedItemKey}
                onViewportChangeStart={handleViewportChangeStart}
                onBoundsChange={handleBoundsChange}
                onUserBoundsChange={handleUserBoundsChange}
                className="h-full"
                fillContainer
              />
              {errorMessage && <div className="absolute bottom-8 left-3 right-3 z-[900] rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 shadow-sm" role="alert">{errorMessage}</div>}
              <fieldset
                aria-label="지도 소재지"
                aria-busy={isResolvingMapRegion}
                className="absolute left-14 top-3 z-[900] w-[calc(100%-4.5rem)] max-w-xl rounded-xl bg-white/95 p-2 shadow-lg ring-1 ring-gray-200 backdrop-blur"
              >
                <legend className="sr-only">지도 소재지</legend>
                <p className="mb-1 text-[10px] font-bold text-slate-500">{isResolvingMapRegion ? '지도 중심 소재지 확인 중' : '지도 중심 지역 · 선택하면 이동'}</p>
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

            <aside className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-slate-50/70" aria-label="현재 화면의 물건 목록">
              <div className="shrink-0 border-b border-gray-200 bg-white px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <div><div className="text-xs font-bold text-gray-400">현재 영역</div><div className="mt-1 text-lg font-extrabold text-slate-900">{searchErrorKind === 'connection' ? '연결 확인 중' : isSearchPending ? '검색 중' : formatNumber(total, '개')}</div></div>
                  <div className="flex flex-col items-end gap-1">
                    <Link
                      to="/data-licenses"
                      aria-label="지도 및 행정구역 데이터 출처와 이용조건 보기"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-500 hover:text-blue-700"
                    >
                      <ShieldCheck className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                      지도·데이터 출처
                    </Link>
                    {total > 0 && <div className="text-xs font-bold text-gray-500"><MapPin className="mr-1 inline h-3.5 w-3.5 text-indigo-600" />{clusters ? `${clusterLabel} 묶음 ${clusters.length}개` : `마커 ${mappedCount}개`}</div>}
                  </div>
                </div>
                <div className="mt-2 border-t border-gray-100 pt-2 md:mt-3 md:pt-3">
                  <div className="grid min-w-0 grid-cols-[minmax(90px,0.65fr)_minmax(0,1.35fr)] gap-2 md:grid-cols-1">
                    <label className="min-w-0">
                      <span className="mb-1 block text-xs font-extrabold text-slate-600">물건종류</span>
                      <select
                        aria-label="물건종류"
                        value={selectedPropertyType}
                        onChange={(event) => {
                          markSearchDirty()
                          setSelectedPropertyType(event.target.value)
                        }}
                        className="w-full min-w-0 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500"
                      >
                        <option value="">전체</option>
                        {PROPERTY_TYPE_GROUPS.map((group) => (
                          <optgroup key={group.id} label={group.title}>
                            {group.items.map((item) => <option key={item} value={item}>{item}</option>)}
                          </optgroup>
                        ))}
                      </select>
                    </label>
                    <fieldset className="min-w-0" aria-label="최저가 범위">
                      <legend className="px-1 text-xs font-extrabold text-slate-600">최저가 범위</legend>
                      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center rounded-xl border border-gray-200 bg-white focus-within:border-indigo-500">
                        <input inputMode="numeric" value={minPrice} onChange={(event) => {
                          const nextValue = formatAmountInput(event.target.value, minPrice)
                          if (nextValue === minPrice) return
                          markSearchDirty()
                          setMinPrice(nextValue)
                        }} placeholder="최소 가격" aria-label="최저가 최소" className="w-full min-w-0 rounded-l-xl border-0 bg-transparent px-2 py-1.5 text-xs outline-none" />
                        <span className="px-1 text-sm font-extrabold text-slate-400" aria-hidden="true">~</span>
                        <input inputMode="numeric" value={maxPrice} onChange={(event) => {
                          const nextValue = formatAmountInput(event.target.value, maxPrice)
                          if (nextValue === maxPrice) return
                          markSearchDirty()
                          setMaxPrice(nextValue)
                        }} placeholder="최대 가격" aria-label="최저가 최대" className="w-full min-w-0 rounded-r-xl border-0 bg-transparent px-2 py-1.5 text-xs outline-none" />
                      </div>
                    </fieldset>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <button type="button" onClick={resetSelectionFilters} disabled={!selectedProvince && !selectedPropertyType && !minPrice && !maxPrice} className="shrink-0 text-xs font-extrabold text-indigo-600 hover:text-indigo-800 disabled:cursor-not-allowed disabled:text-gray-300">조건 초기화</button>
                    <span className="text-right text-[11px] font-bold text-indigo-600" aria-live="polite">
                      {pendingViewportKey || isMapMoving
                        ? '지도 이동 중'
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
                {excludedCount > 0 && <p className="mt-2 text-xs text-amber-700">현재 페이지 후보 중 좌표를 변환할 수 없는 {excludedCount}개 물건은 지도·목록에서 제외됐습니다.</p>}
                {clusters && clusters.length > 0 && <p className="mt-2 text-[11px] text-slate-500">{clusterLabel} 묶음을 누르거나 지도를 확대하면 더 자세히 볼 수 있습니다.</p>}
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="region" aria-label="검색 결과 목록" tabIndex={0}>
                {isSearchPending && <div className="flex min-h-52 items-center justify-center" aria-label="현재 지도 물건 검색 중"><Loader2 className="h-7 w-7 animate-spin text-indigo-600" /></div>}
                {!isLoading && errorMessage && items.length === 0 && (
                  <div className="rounded-xl border border-dashed border-red-200 bg-white p-8 text-center text-sm text-red-600">
                    {searchErrorKind === 'connection'
                      ? '지도 검색 서비스 연결을 복구하는 동안 잠시 기다려 주세요.'
                      : searchErrorKind === 'validation'
                        ? '검색 조건을 확인하면 자동으로 다시 검색합니다.'
                        : '검색 결과를 불러오지 못했습니다.'}
                  </div>
                )}
                {!isSearchPending && !errorMessage && viewportBounds && items.length === 0 && <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">현재 지도와 조건에 맞는 물건이 없습니다.</div>}
                {!isSearchPending && items.map((item) => <MapResultCard key={getGeographicSearchItemKey(item)} item={item} selected={getGeographicSearchItemKey(item) === selectedItemKey} onSelect={setSelectedItemKey} />)}
              </div>

              {!isLoading && total > PAGE_SIZE && (
                <div className="flex shrink-0 items-center justify-center gap-3 border-t border-gray-200 bg-white p-1.5 md:p-3">
                  <button type="button" onClick={() => movePage(currentOffset - PAGE_SIZE)} disabled={isViewportDirty || currentOffset === 0} className="rounded-lg border border-gray-200 p-1.5 disabled:text-gray-300 md:p-2" aria-label="이전 페이지"><ChevronLeft className="h-4 w-4 md:h-5 md:w-5" /></button>
                  <span className="text-xs font-extrabold text-gray-500">{Math.floor(currentOffset / PAGE_SIZE) + 1} / {Math.ceil(total / PAGE_SIZE)}</span>
                  <button type="button" onClick={() => movePage(currentOffset + PAGE_SIZE)} disabled={isViewportDirty || currentOffset + PAGE_SIZE >= total} className="rounded-lg border border-gray-200 p-1.5 disabled:text-gray-300 md:p-2" aria-label="다음 페이지"><ChevronRight className="h-4 w-4 md:h-5 md:w-5" /></button>
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>
    </Layout>
  )
}
