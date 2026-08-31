import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  MapPin,
  Search,
  TrainFront,
} from 'lucide-react'
import AuctionMap from '../components/AuctionMap'
import Layout from '../components/Layout'
import {
  searchGeographicSubwayGoods,
  searchSubwayStations,
  type GeographicSearchItem,
  type GeographicSubwaySearchParams,
  type SubwayStation,
} from '../lib/auction-extra'
import { getKoreanErrorMessage } from '../lib/api'
import { formatMoney, formatNumber, getText } from '../lib/format'

const PAGE_SIZE = 100
const RADIUS_OPTIONS = [500, 1000, 2000, 3000, 5000]

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

function parseUsage(value: string) {
  const items = value.split(',').map((item) => item.trim()).filter(Boolean)
  return items.length ? items : undefined
}

function SubwayResultCard({
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
    <article className={`rounded-xl border bg-white p-4 shadow-sm transition ${selected ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-gray-200 hover:border-indigo-300'}`}>
      <button type="button" onClick={() => onSelect(item.auction_goods_id)} className="w-full text-left">
        <div className="flex flex-wrap items-center gap-2 text-xs font-extrabold text-indigo-700">
          <span>{getText(item.court_name)}</span>
          {item.branch_name && <span className="text-gray-400">{item.branch_name}</span>}
          {typeof item.distance_m === 'number' && (
            <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-700">직선거리 {formatNumber(item.distance_m, 'm')}</span>
          )}
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

export default function SubwaySearchPage() {
  const [stationQuery, setStationQuery] = useState('')
  const [stationCity, setStationCity] = useState('')
  const [stationLine, setStationLine] = useState('')
  const [suggestions, setSuggestions] = useState<SubwayStation[]>([])
  const [selectedStation, setSelectedStation] = useState<SubwayStation | null>(null)
  const [isStationLoading, setIsStationLoading] = useState(false)
  const [stationError, setStationError] = useState('')
  const [radiusM, setRadiusM] = useState(1000)
  const [region, setRegion] = useState('')
  const [goodsUsage, setGoodsUsage] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [appliedParams, setAppliedParams] = useState<GeographicSubwaySearchParams | null>(null)
  const [items, setItems] = useState<GeographicSearchItem[]>([])
  const [total, setTotal] = useState(0)
  const [excludedCount, setExcludedCount] = useState(0)
  const [selectedGoodsId, setSelectedGoodsId] = useState<number | null>(null)
  const [responseStation, setResponseStation] = useState<(SubwayStation & { radius_m: number }) | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const trimmedQuery = stationQuery.trim()
    if (!trimmedQuery || selectedStation?.name === trimmedQuery) {
      queueMicrotask(() => {
        setSuggestions([])
        setStationError('')
      })
      return
    }

    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => {
      setIsStationLoading(true)
      setStationError('')
      searchSubwayStations({
        q: trimmedQuery,
        city: stationCity.trim() || undefined,
        line: stationLine.trim() || undefined,
        limit: 20,
      }, controller.signal)
        .then((response) => setSuggestions(response.items))
        .catch((error: unknown) => {
          if (!controller.signal.aborted) {
            setSuggestions([])
            setStationError(getKoreanErrorMessage(error, '역 목록을 불러오지 못했습니다.'))
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsStationLoading(false)
        })
    }, 250)

    return () => {
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [selectedStation?.name, stationCity, stationLine, stationQuery])

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

    searchGeographicSubwayGoods(appliedParams, controller.signal)
      .then((response) => {
        if (!isActive) return
        setItems(response.items)
        setTotal(response.total)
        setExcludedCount(response.coverage.excluded_unconvertible)
        setResponseStation(response.station)
        setSelectedGoodsId(response.items[0]?.auction_goods_id ?? null)
      })
      .catch((error: unknown) => {
        if (!isActive || controller.signal.aborted) return
        setItems([])
        setTotal(0)
        setExcludedCount(0)
        setErrorMessage(getKoreanErrorMessage(error, '역세권 물건을 불러오지 못했습니다.'))
      })
      .finally(() => {
        if (isActive) setIsLoading(false)
      })

    return () => {
      isActive = false
      controller.abort()
    }
  }, [appliedParams])

  const mappedCount = useMemo(
    () => items.filter((item) => typeof item.latitude === 'number' && typeof item.longitude === 'number').length,
    [items],
  )

  const selectStation = (station: SubwayStation) => {
    setSelectedStation(station)
    setStationQuery(station.name)
    setSuggestions([])
    setStationError('')
  }

  const buildParams = (offset: number): GeographicSubwaySearchParams | null => {
    if (!selectedStation) {
      setErrorMessage('검색할 역을 자동완성 목록에서 선택해 주세요.')
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
      region: region.trim() || undefined,
      goods_usage: parseUsage(goodsUsage),
      min_lowest_sale_price: parsedMinPrice,
      max_lowest_sale_price: parsedMaxPrice,
      limit: PAGE_SIZE,
      offset,
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const params = buildParams(0)
    if (params) setAppliedParams(params)
  }

  const movePage = (offset: number) => {
    setAppliedParams((current) => current ? { ...current, offset: Math.max(0, offset) } : current)
  }
  const currentOffset = appliedParams?.offset ?? 0
  const mapStation = responseStation ?? selectedStation
  const mapRadius = responseStation?.radius_m ?? radiusM

  return (
    <Layout>
      <div className="w-full flex-grow bg-slate-50 px-4 py-5">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-900"><TrainFront className="h-6 w-6 text-indigo-600" /> 역세권 경매물건 찾기</h1>
              <p className="mt-1 text-sm text-gray-500">역을 선택하고 도보 생활권 반경 안의 물건을 지도와 거리순 목록으로 비교하세요.</p>
            </div>
            <div className="rounded-full bg-white px-4 py-2 text-xs font-bold text-gray-500 shadow-sm ring-1 ring-gray-200">OpenStreetMap · WGS84</div>
          </div>

          <form onSubmit={handleSubmit} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="grid gap-3 lg:grid-cols-[minmax(260px,1.4fr)_1fr_1fr]">
              <div className="relative">
                <label className="mb-1 block text-xs font-bold text-gray-500" htmlFor="station-search">역 이름</label>
                <div className="relative">
                  <TrainFront className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    id="station-search"
                    autoComplete="off"
                    value={stationQuery}
                    onChange={(event) => {
                      setStationQuery(event.target.value)
                      setSelectedStation(null)
                    }}
                    placeholder="예: 강남역, 서울역"
                    className="w-full rounded-xl border border-gray-200 py-3 pl-10 pr-10 text-sm outline-none focus:border-indigo-500"
                  />
                  {isStationLoading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-indigo-600" />}
                </div>
                {(suggestions.length > 0 || stationError) && (
                  <div className="absolute z-[600] mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white p-1 shadow-xl">
                    {stationError && <p className="p-3 text-sm font-bold text-red-700">{stationError}</p>}
                    {suggestions.map((station) => (
                      <button key={station.station_id} type="button" onClick={() => selectStation(station)} className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-3 text-left hover:bg-indigo-50">
                        <span><strong className="block text-sm text-slate-900">{station.name}</strong><span className="mt-1 block text-xs text-gray-500">{getText(station.city)}</span></span>
                        <span className="text-right text-xs font-bold text-indigo-700">{station.lines.join(' · ') || '노선 정보 없음'}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <label className="text-xs font-bold text-gray-500">도시권 필터<input value={stationCity} onChange={(event) => setStationCity(event.target.value)} placeholder="예: 서울, 부산" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm font-normal outline-none focus:border-indigo-500" /></label>
              <label className="text-xs font-bold text-gray-500">노선 필터<input value={stationLine} onChange={(event) => setStationLine(event.target.value)} placeholder="예: 2호선" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm font-normal outline-none focus:border-indigo-500" /></label>
            </div>

            <fieldset className="mt-4">
              <legend className="text-xs font-bold text-gray-500">검색 반경</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {RADIUS_OPTIONS.map((option) => (
                  <button key={option} type="button" onClick={() => setRadiusM(option)} className={`rounded-full px-4 py-2 text-xs font-extrabold transition ${radiusM === option ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-indigo-50'}`}>
                    {option < 1000 ? `${option}m` : `${option / 1000}km`}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <input value={region} onChange={(event) => setRegion(event.target.value)} placeholder="지역 (예: 강남구)" aria-label="지역" className="rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-indigo-500" />
              <input value={goodsUsage} onChange={(event) => setGoodsUsage(event.target.value)} placeholder="용도 (아파트, 상가)" aria-label="물건 용도" className="rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-indigo-500" />
              <input inputMode="numeric" value={minPrice} onChange={(event) => setMinPrice(formatAmountInput(event.target.value, minPrice))} placeholder="최저가 최소" aria-label="최저가 최소" className="rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-indigo-500" />
              <input inputMode="numeric" value={maxPrice} onChange={(event) => setMaxPrice(formatAmountInput(event.target.value, maxPrice))} placeholder="최저가 최대" aria-label="최저가 최대" className="rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-indigo-500" />
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs text-gray-500">역은 자동완성 결과에서 선택해야 정확한 역 ID와 좌표가 적용됩니다.</p>
              <button type="submit" disabled={!selectedStation || isLoading} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-extrabold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-300">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} 반경 안 물건 찾기
              </button>
            </div>
          </form>

          {errorMessage && <div className="rounded-xl border border-red-100 bg-red-50 px-5 py-4 text-sm font-bold text-red-700" role="alert">{errorMessage}</div>}

          <div className="grid min-h-[680px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.8fr)]">
            <div className="min-h-[520px] overflow-hidden border-b border-gray-200 xl:border-b-0 xl:border-r">
              <AuctionMap items={items} station={mapStation} radiusM={mapRadius} selectedGoodsId={selectedGoodsId} onSelectGoods={setSelectedGoodsId} className="h-[520px] xl:h-[680px]" />
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
                {!isLoading && appliedParams && items.length === 0 && <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">선택한 역과 반경에 조건을 만족하는 물건이 없습니다.</div>}
                {!isLoading && !appliedParams && <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center"><TrainFront className="mx-auto h-7 w-7 text-gray-300" /><p className="mt-3 text-sm font-bold text-gray-600">역을 선택한 다음 반경 검색을 시작하세요.</p></div>}
                {!isLoading && items.map((item) => <SubwayResultCard key={item.auction_goods_id} item={item} selected={item.auction_goods_id === selectedGoodsId} onSelect={setSelectedGoodsId} />)}
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
