import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  LockKeyhole,
  MapPin,
  TrainFront,
} from 'lucide-react'
import AuctionMap from '../components/AuctionMap'
import Layout from '../components/Layout'
import AutoSearchForm from '../components/AutoSearchForm'
import {
  getSubwayStationFacets,
  getGeographicSearchItemKey,
  searchGeographicSubwayGoods,
  searchSubwayStations,
  type GeographicSearchItem,
  type GeographicSubwaySearchParams,
  type SubwayStation,
  type SubwayStationCityFacet,
} from '../lib/auction-extra'
import { getKoreanErrorMessage } from '../lib/api'
import { formatAmountInput, formatMoney, formatNumber, getText, optionalAmount } from '../lib/format'
import {
  GOODS_USAGE_VALUES_BY_PROPERTY_TYPE,
  PROPERTY_TYPE_GROUPS,
} from '../lib/search-filter-options'

const PAGE_SIZE = 100
const DEFAULT_RADIUS_M = 500
const RADIUS_OPTIONS = [300, 500, 1000] as const

function SubwayResultCard({
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
  const itemKey = getGeographicSearchItemKey(item)
  const itemTitle = getText(item.building_name || address, `물건 ${item.auction_goods_id}`)

  return (
    <article className={`rounded-xl border bg-white p-4 shadow-sm transition ${selected ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-gray-200 hover:border-indigo-300'}`}>
      <button type="button" aria-label={`${itemTitle} 지도에서 선택`} aria-pressed={selected} onClick={() => onSelect(itemKey)} className="w-full text-left">
        <div className="flex flex-wrap items-center gap-2 text-xs font-extrabold text-indigo-700">
          <span>{getText(item.court_name)}</span>
          {item.branch_name && <span className="text-gray-400">{item.branch_name}</span>}
          {typeof item.distance_m === 'number' && (
            <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-700">직선거리 {formatNumber(item.distance_m, 'm')}</span>
          )}
        </div>
        <h2 className="mt-2 truncate text-base font-extrabold text-slate-900">
          {itemTitle}
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

export default function SubwaySearchPage() {
  const [stationFacets, setStationFacets] = useState<SubwayStationCityFacet[]>([])
  const [selectedCity, setSelectedCity] = useState('')
  const [selectedLine, setSelectedLine] = useState('')
  const [stations, setStations] = useState<SubwayStation[]>([])
  const [selectedStation, setSelectedStation] = useState<SubwayStation | null>(null)
  const [isFacetLoading, setIsFacetLoading] = useState(true)
  const [facetError, setFacetError] = useState('')
  const [isStationLoading, setIsStationLoading] = useState(false)
  const [stationError, setStationError] = useState('')
  const [stationNotice, setStationNotice] = useState('')
  const [radiusM, setRadiusM] = useState(DEFAULT_RADIUS_M)
  const [selectedPropertyType, setSelectedPropertyType] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [appliedParams, setAppliedParams] = useState<GeographicSubwaySearchParams | null>(null)
  const [items, setItems] = useState<GeographicSearchItem[]>([])
  const [total, setTotal] = useState(0)
  const [excludedCount, setExcludedCount] = useState(0)
  const [selectedItemKey, setSelectedItemKey] = useState<string | null>(null)
  const [responseStation, setResponseStation] = useState<(SubwayStation & { radius_m: number }) | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const stationRequestVersion = useRef(0)
  const searchRequestVersion = useRef(0)
  const cityTabRefs = useRef(new Map<string, HTMLButtonElement>())

  useEffect(() => {
    const controller = new AbortController()
    getSubwayStationFacets(controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return
        const cities = Array.isArray(response.cities) ? response.cities : []
        setStationFacets(cities)
        setFacetError(cities.length ? '' : '지역과 노선 정보가 없습니다.')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setStationFacets([])
        setFacetError(getKoreanErrorMessage(error, '지역과 노선 정보를 불러오지 못했습니다.'))
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsFacetLoading(false)
      })

    return () => controller.abort()
  }, [])

  useEffect(() => {
    const requestVersion = ++stationRequestVersion.current
    if (!selectedCity || !selectedLine) {
      queueMicrotask(() => {
        if (stationRequestVersion.current !== requestVersion) return
        setStations([])
        setStationError('')
        setStationNotice('')
        setIsStationLoading(false)
      })
      return
    }

    const controller = new AbortController()
    queueMicrotask(() => {
      if (controller.signal.aborted || stationRequestVersion.current !== requestVersion) return
      setIsStationLoading(true)
      setStationError('')
      setStationNotice('')
    })
    searchSubwayStations({
      city: selectedCity,
      line: selectedLine,
      limit: 500,
    }, controller.signal)
      .then((response) => {
        if (controller.signal.aborted || stationRequestVersion.current !== requestVersion) return
        setStations(response.items)
        setStationNotice(response.items.length < response.total
          ? `전체 ${formatNumber(response.total, '개 역')} 중 ${formatNumber(response.items.length, '개')}만 표시됐습니다. 조건을 다시 선택해 주세요.`
          : '')
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted && stationRequestVersion.current === requestVersion) {
          setStations([])
          setStationNotice('')
          setStationError(getKoreanErrorMessage(error, '역 목록을 불러오지 못했습니다.'))
        }
      })
      .finally(() => {
        if (!controller.signal.aborted && stationRequestVersion.current === requestVersion) setIsStationLoading(false)
      })

    return () => {
      controller.abort()
    }
  }, [selectedCity, selectedLine])

  useEffect(() => {
    if (!appliedParams) return
    const requestVersion = ++searchRequestVersion.current
    const controller = new AbortController()
    let isActive = true
    queueMicrotask(() => {
      if (isActive && searchRequestVersion.current === requestVersion) {
        setIsLoading(true)
        setErrorMessage('')
      }
    })

    searchGeographicSubwayGoods(appliedParams, controller.signal)
      .then((response) => {
        if (!isActive || searchRequestVersion.current !== requestVersion) return
        setItems(response.items)
        setTotal(response.total)
        setExcludedCount(response.coverage.excluded_unconvertible)
        setResponseStation(response.station)
        setSelectedItemKey(null)
      })
      .catch((error: unknown) => {
        if (!isActive || controller.signal.aborted || searchRequestVersion.current !== requestVersion) return
        setItems([])
        setTotal(0)
        setExcludedCount(0)
        setResponseStation(null)
        setSelectedItemKey(null)
        setErrorMessage(getKoreanErrorMessage(error, '역세권 물건을 불러오지 못했습니다.'))
      })
      .finally(() => {
        if (isActive && searchRequestVersion.current === requestVersion) setIsLoading(false)
      })

    return () => {
      isActive = false
      controller.abort()
    }
  }, [appliedParams])

  const mappedCount = useMemo(
    () => items.filter((item) => (
      typeof item.latitude === 'number' && Number.isFinite(item.latitude) &&
      typeof item.longitude === 'number' && Number.isFinite(item.longitude)
    )).length,
    [items],
  )

  const resetSearchResults = () => {
    searchRequestVersion.current += 1
    setAppliedParams(null)
    setItems([])
    setTotal(0)
    setExcludedCount(0)
    setSelectedItemKey(null)
    setResponseStation(null)
    setIsLoading(false)
    setErrorMessage('')
  }

  const selectStation = (station: SubwayStation) => {
    resetSearchResults()
    setSelectedStation(station)
  }

  const selectCity = (city: string) => {
    if (city === selectedCity) return
    stationRequestVersion.current += 1
    resetSearchResults()
    setSelectedCity(city)
    setSelectedLine('')
    setStations([])
    setSelectedStation(null)
    setStationError('')
    setStationNotice('')
    setIsStationLoading(false)
  }

  const handleCityTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) => {
    let nextIndex: number | null = null
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % stationFacets.length
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + stationFacets.length) % stationFacets.length
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = stationFacets.length - 1
    if (nextIndex === null) return

    event.preventDefault()
    const nextFacet = stationFacets[nextIndex]
    if (!nextFacet) return
    selectCity(nextFacet.city)
    cityTabRefs.current.get(nextFacet.city)?.focus()
  }

  const selectLine = (line: string) => {
    if (line === selectedLine) return
    stationRequestVersion.current += 1
    resetSearchResults()
    setSelectedLine(line)
    setStations([])
    setSelectedStation(null)
    setStationError('')
    setStationNotice('')
    setIsStationLoading(false)
  }

  const selectRadius = (radius: number) => {
    if (radius === radiusM) return
    resetSearchResults()
    setRadiusM(radius)
  }

  const buildParams = (offset: number): GeographicSubwaySearchParams | null => {
    if (!selectedStation) {
      setErrorMessage('검색할 지역과 노선, 역을 차례로 선택해 주세요.')
      return null
    }
    const parsedMinPrice = optionalAmount(minPrice)
    const parsedMaxPrice = optionalAmount(maxPrice)
    if (Number.isNaN(parsedMinPrice) || Number.isNaN(parsedMaxPrice)) {
      setErrorMessage('가격은 0 이상의 원 단위 숫자로 입력해 주세요.')
      return null
    }
    if (parsedMinPrice !== undefined && parsedMaxPrice !== undefined && parsedMinPrice > parsedMaxPrice) {
      setErrorMessage('최소 가격은 최대 가격보다 클 수 없습니다.')
      return null
    }
    return {
      station_id: selectedStation.station_id,
      radius_m: radiusM,
      goods_usage: selectedPropertyType
        ? GOODS_USAGE_VALUES_BY_PROPERTY_TYPE[selectedPropertyType]
        : undefined,
      min_lowest_sale_price: parsedMinPrice,
      max_lowest_sale_price: parsedMaxPrice,
      limit: PAGE_SIZE,
      offset,
    }
  }

  const handleSearch = () => {
    if (!selectedStation) return
    const params = buildParams(0)
    // Invalidate any previous response even when the new price range is invalid.
    searchRequestVersion.current += 1
    setAppliedParams(params)
    setItems([])
    setTotal(0)
    setExcludedCount(0)
    setSelectedItemKey(null)
    setResponseStation(null)
    setIsLoading(Boolean(params))
  }

  const movePage = (offset: number) => {
    setAppliedParams((current) => current ? { ...current, offset: Math.max(0, offset) } : current)
  }
  const currentOffset = appliedParams?.offset ?? 0
  const mapStation = responseStation ?? selectedStation
  const mapRadius = responseStation?.radius_m ?? radiusM
  const selectedCityFacet = stationFacets.find((facet) => facet.city === selectedCity) ?? null

  return (
    <Layout>
      <div className="w-full flex-grow bg-slate-50 py-5 sm:py-6">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 sm:px-6 md:px-10">
          <section className="flex flex-col gap-3 px-4 py-1 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8" aria-labelledby="subway-search-heading">
            <div className="text-left">
              <p className="mb-2 w-fit rounded-full bg-indigo-100 px-3 py-1 text-[11px] font-extrabold text-indigo-700">선택한 역 중심 직선거리 기준 · 자동 검색</p>
              <h1 id="subway-search-heading" className="flex items-center gap-2 text-2xl font-extrabold text-slate-900"><TrainFront className="h-6 w-6 text-indigo-600" /> 역세권 경매물건 찾기</h1>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">역을 선택하고 지정한 직선거리 반경 안의 물건을 지도와 거리순 목록으로 비교하세요.</p>
            </div>
          </section>

          <AutoSearchForm onSearch={handleSearch} className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/70">
              <div className="flex flex-col gap-2 border-b border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">역 선택</h2>
                  <p className="mt-1 text-xs text-slate-500">지역, 노선, 역을 순서대로 눌러 한 곳을 선택하세요.</p>
                </div>
                <ol className="flex flex-wrap gap-2 text-[11px] font-extrabold" aria-label="역 선택 단계">
                  <li className={selectedCity ? 'text-indigo-700' : 'text-slate-500'}>1 지역</li>
                  <li aria-hidden="true" className="text-slate-300">›</li>
                  <li className={selectedLine ? 'text-indigo-700' : 'text-slate-400'}>2 노선</li>
                  <li aria-hidden="true" className="text-slate-300">›</li>
                  <li className={selectedStation ? 'text-indigo-700' : 'text-slate-400'}>3 역</li>
                </ol>
              </div>

              {facetError && <div className="m-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700" role="alert">{facetError}</div>}
              {isFacetLoading && (
                <div className="flex min-h-32 items-center justify-center gap-2 text-sm font-bold text-slate-500" role="status">
                  <Loader2 className="h-5 w-5 animate-spin text-indigo-600" /> 지역과 노선을 불러오는 중입니다.
                </div>
              )}

              {!isFacetLoading && !facetError && (
                <>
                  <section className="border-b border-slate-200 p-3 sm:p-4" aria-labelledby="station-city-heading">
                    <h3 id="station-city-heading" className="text-xs font-extrabold text-slate-500">1. 지역</h3>
                    <div className="mt-2 grid grid-flow-col auto-cols-[minmax(6.5rem,1fr)] gap-1.5 overflow-x-auto pb-1 sm:grid-flow-row sm:grid-cols-5 sm:auto-cols-auto sm:gap-2 sm:overflow-visible sm:pb-0" role="tablist" aria-label="지역 선택">
                      {stationFacets.map((facet, index) => (
                        <button
                          key={facet.city}
                          ref={(node) => {
                            if (node) cityTabRefs.current.set(facet.city, node)
                            else cityTabRefs.current.delete(facet.city)
                          }}
                          type="button"
                          role="tab"
                          aria-selected={selectedCity === facet.city}
                          aria-controls="station-line-panel"
                          aria-label={`${facet.label} 지역`}
                          tabIndex={selectedCity === facet.city || (!selectedCity && index === 0) ? 0 : -1}
                          onClick={() => selectCity(facet.city)}
                          onKeyDown={(event) => handleCityTabKeyDown(event, index)}
                          className={`min-h-[52px] w-full rounded-lg border px-2 py-1.5 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400 ${selectedCity === facet.city ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50'}`}
                        >
                          <strong className="block text-xs font-extrabold">{facet.label}</strong>
                          <span className={`mt-0.5 block text-[9px] font-bold ${selectedCity === facet.city ? 'text-indigo-100' : 'text-slate-400'}`}>{formatNumber(facet.total, '개 역')}</span>
                        </button>
                      ))}
                    </div>
                  </section>

                  <section id="station-line-panel" role="tabpanel" className="border-b border-slate-200 p-3 sm:p-4" aria-labelledby="station-line-heading">
                    <h3 id="station-line-heading" className="text-xs font-extrabold text-slate-500">2. 노선</h3>
                    {!selectedCityFacet && <p className="mt-3 text-sm text-slate-400">지역을 먼저 선택해 주세요.</p>}
                    {selectedCityFacet && (
                      <div className="mt-2 grid grid-flow-col grid-rows-2 auto-cols-[minmax(7rem,1fr)] gap-1.5 overflow-x-auto pb-1 md:grid-flow-row md:grid-rows-none md:grid-cols-6 md:auto-cols-auto md:overflow-visible md:pb-0 lg:grid-cols-8 xl:grid-cols-10" aria-label="노선 선택">
                        {selectedCityFacet.lines.map((line) => (
                          <button
                            key={line.line}
                            type="button"
                            aria-pressed={selectedLine === line.line}
                            aria-label={`${line.line} 노선`}
                            onClick={() => selectLine(line.line)}
                            className={`inline-flex min-h-9 w-full flex-wrap items-center justify-center gap-1 rounded-lg border px-2 py-1 text-center text-[11px] font-extrabold leading-4 break-keep transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400 ${selectedLine === line.line ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:bg-indigo-50'}`}
                          >
                            {line.line} <span className={selectedLine === line.line ? 'text-indigo-100' : 'text-slate-400'}>{formatNumber(line.total)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="p-3 sm:p-4" aria-labelledby="station-choice-heading">
                    <div className="flex items-center justify-between gap-3">
                      <h3 id="station-choice-heading" className="text-xs font-extrabold text-slate-500">3. 역</h3>
                      {selectedLine && !isStationLoading && !stationError && <span className="text-[11px] font-bold text-slate-400">{formatNumber(stations.length, '개')}</span>}
                    </div>
                    {!selectedLine && <p className="mt-3 text-sm text-slate-400">노선을 선택하면 역 목록이 표시됩니다.</p>}
                    {isStationLoading && (
                      <div className="mt-3 flex min-h-24 items-center justify-center gap-2 text-sm font-bold text-slate-500" role="status">
                        <Loader2 className="h-5 w-5 animate-spin text-indigo-600" /> 역 목록을 불러오는 중입니다.
                      </div>
                    )}
                    {stationError && <div className="mt-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700" role="alert">{stationError}</div>}
                    {stationNotice && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800" role="status">{stationNotice}</div>}
                    {selectedLine && !isStationLoading && !stationError && stations.length === 0 && <p className="mt-3 text-sm text-slate-500" role="status">선택한 지역과 노선에 등록된 역이 없습니다.</p>}
                    {!isStationLoading && !stationError && stations.length > 0 && (
                      <div className="mt-2 grid max-h-64 content-start grid-cols-2 gap-1.5 overflow-y-auto overscroll-contain rounded-xl bg-white/70 p-1.5 pr-2 ring-1 ring-inset ring-slate-200 [scrollbar-gutter:stable] sm:max-h-72 sm:grid-cols-3 sm:gap-2 lg:grid-cols-4 xl:grid-cols-6" role="radiogroup" aria-label="역 선택">
                        {stations.map((station) => {
                          const isSelected = selectedStation?.station_id === station.station_id
                          const areaLabel = station.areas.join(' · ') || station.city
                          return (
                            <label
                              key={station.station_id}
                              className={`relative flex h-full min-h-[54px] cursor-pointer flex-col justify-center rounded-lg border px-2.5 py-2 text-left transition focus-within:ring-2 focus-within:ring-inset focus-within:ring-indigo-400 ${isSelected ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-100' : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50'}`}
                            >
                              <input
                                type="radio"
                                name="subway-station"
                                value={station.station_id}
                                checked={isSelected}
                                onChange={() => selectStation(station)}
                                aria-label={`${station.name} 선택 - ${areaLabel}`}
                                className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                              />
                              <span className="line-clamp-2 break-words text-xs leading-4 font-extrabold">{station.name}</span>
                              <span className={`mt-0.5 line-clamp-2 break-words text-[9px] leading-3 font-bold ${isSelected ? 'text-indigo-100' : 'text-slate-400'}`}>{areaLabel}</span>
                            </label>
                          )
                        })}
                      </div>
                    )}
                  </section>
                </>
              )}
            </div>

            {selectedStation && (
              <div className="mt-2 flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 ring-1 ring-indigo-100" role="status" aria-label="선택한 역">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-black text-white">역</span>
                <div className="min-w-0">
                  <span className="block text-[10px] font-bold text-indigo-500">선택 완료</span>
                  <strong className="block truncate text-sm text-slate-900">{selectedStation.name}</strong>
                  <span className="block truncate text-[11px] text-gray-600">{[selectedStation.city, ...selectedStation.areas, ...selectedStation.lines].join(' · ')}</span>
                </div>
              </div>
            )}

            <fieldset className="mt-3">
              <legend className="text-xs font-bold text-gray-500">검색 반경</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {RADIUS_OPTIONS.map((option) => (
                  <button key={option} type="button" data-auto-search aria-pressed={radiusM === option} onClick={() => selectRadius(option)} className={`rounded-full px-4 py-2 text-xs font-extrabold transition ${radiusM === option ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-indigo-50'}`}>
                    {option < 1000 ? `${option}m` : `${option / 1000}km`}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="mt-4 grid min-w-0 gap-3 md:grid-cols-[minmax(180px,0.7fr)_minmax(320px,1.2fr)]">
              <label className="min-w-0">
                <span className="sr-only">물건 용도</span>
                <select value={selectedPropertyType} onChange={(event) => setSelectedPropertyType(event.target.value)} aria-label="물건 용도" className="w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500">
                  <option value="">용도 전체</option>
                  {PROPERTY_TYPE_GROUPS.map((group) => (
                    <optgroup key={group.id} label={group.title}>
                      {group.items.map((item) => <option key={item} value={item}>{item}</option>)}
                    </optgroup>
                  ))}
                </select>
              </label>
              <fieldset className="min-w-0" aria-label="최저가 범위">
                <legend className="sr-only">최저가 범위</legend>
                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center rounded-xl border border-gray-200 bg-white focus-within:border-indigo-500">
                  <input inputMode="numeric" value={minPrice} onChange={(event) => setMinPrice(formatAmountInput(event.target.value, minPrice))} placeholder="최소 가격" aria-label="최저가 최소" className="w-full min-w-0 rounded-l-xl border-0 bg-transparent px-3 py-3 text-sm outline-none" />
                  <span className="px-1 text-sm font-extrabold text-slate-400" aria-hidden="true">~</span>
                  <input inputMode="numeric" value={maxPrice} onChange={(event) => setMaxPrice(formatAmountInput(event.target.value, maxPrice))} placeholder="최대 가격" aria-label="최저가 최대" className="w-full min-w-0 rounded-r-xl border-0 bg-transparent px-3 py-3 text-sm outline-none" />
                </div>
              </fieldset>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs text-gray-500">역·반경·용도를 선택하면 바로 검색합니다. 가격은 입력을 마치면 자동 반영됩니다.</p>

            </div>
          </AutoSearchForm>

          {errorMessage && <div className="rounded-xl border border-red-100 bg-red-50 px-5 py-4 text-sm font-bold text-red-700" role="alert">{errorMessage}</div>}

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-xs font-bold leading-5 text-indigo-800" role="note">
            <span>역세권 지도는 선택한 역 중심 {mapRadius.toLocaleString('ko-KR')}m 반경에 자동으로 맞춰집니다.</span>
            <span className="rounded-full bg-white px-3 py-1 text-[11px] text-indigo-700 ring-1 ring-indigo-200">확대·축소 및 이동 잠금</span>
          </div>

          <div className="grid min-h-[680px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm xl:grid-cols-[minmax(360px,0.8fr)_minmax(0,1.2fr)]">
            <div className="relative min-h-[420px] overflow-hidden border-b border-gray-200 sm:min-h-[520px] xl:border-b-0 xl:border-r">
              <div className="pointer-events-none absolute left-3 top-3 z-[800] inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-2 text-[11px] font-extrabold text-indigo-800 shadow-md ring-1 ring-indigo-200 backdrop-blur" aria-label="역세권 지도 상태">
                <LockKeyhole className="h-3.5 w-3.5" />
                {mapStation ? `${mapRadius.toLocaleString('ko-KR')}m 반경 자동 맞춤 · 지도 조작 잠금` : '역 선택 후 반경 자동 맞춤'}
              </div>
              <AuctionMap items={items} mode="station-radius-preview" station={mapStation} radiusM={mapRadius} viewportZoomSnap={0.25} selectedItemKey={selectedItemKey} onSelectItem={setSelectedItemKey} className="h-[420px] sm:h-[520px] xl:h-[680px]" />
            </div>
            <aside className="flex min-h-0 flex-col bg-slate-50/70">
              <div className="border-b border-gray-200 bg-white px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div><div className="text-xs font-bold text-gray-400">{mapStation ? `${mapStation.name} · ${mapRadius.toLocaleString('ko-KR')}m` : '역을 선택해 주세요'}</div><div className="mt-1 text-lg font-extrabold text-slate-900">{formatNumber(total, '개')}</div></div>
                  {items.length > 0 && <div className="text-right text-xs font-bold text-gray-500"><MapPin className="mr-1 inline h-4 w-4 text-indigo-600" />마커 {mappedCount}개</div>}
                </div>
                {excludedCount > 0 && <p className="mt-2 text-xs text-amber-700">현재 페이지 후보 중 좌표를 변환할 수 없는 {excludedCount}개 물건은 지도·목록에서 제외됐습니다.</p>}
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto p-3 xl:max-h-[550px]">
                {isLoading && <div className="flex min-h-52 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-indigo-600" /></div>}
                {!isLoading && !errorMessage && appliedParams && items.length === 0 && <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">선택한 역과 반경에 조건을 만족하는 물건이 없습니다.</div>}
                {!isLoading && !appliedParams && <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center"><TrainFront className="mx-auto h-7 w-7 text-gray-300" /><p className="mt-3 text-sm font-bold text-gray-600">역을 선택하면 반경 안 물건을 바로 검색합니다.</p></div>}
                {!isLoading && items.map((item) => {
                  const itemKey = getGeographicSearchItemKey(item)
                  return <SubwayResultCard key={itemKey} item={item} selected={itemKey === selectedItemKey} onSelect={setSelectedItemKey} />
                })}
              </div>
              {!isLoading && total > PAGE_SIZE && (
                <div className="flex items-center justify-center gap-3 border-t border-gray-200 bg-white p-3">
                  <button type="button" onClick={() => movePage(currentOffset - PAGE_SIZE)} disabled={currentOffset === 0} className="rounded-lg border border-gray-200 p-2 disabled:text-gray-300" aria-label="이전 페이지"><ChevronLeft className="h-5 w-5" /></button>
                  <span className="text-xs font-extrabold text-gray-500">{Math.floor(currentOffset / PAGE_SIZE) + 1} / {Math.ceil(total / PAGE_SIZE)}</span>
                  <button type="button" onClick={() => movePage(currentOffset + PAGE_SIZE)} disabled={currentOffset + PAGE_SIZE >= total} className="rounded-lg border border-gray-200 p-2 disabled:text-gray-300" aria-label="다음 페이지"><ChevronRight className="h-5 w-5" /></button>
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>
    </Layout>
  )
}
