import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Filter,
  Loader2,
  LocateFixed,
  MapPinned,
  MapPin,
  Search,
} from 'lucide-react'
import AuctionMap from '../components/AuctionMap'
import Layout from '../components/Layout'
import {
  searchGeographicMapGoods,
  type GeographicBounds,
  type GeographicMapSearchParams,
  type GeographicSearchItem,
} from '../lib/auction-extra'
import { getKoreanErrorMessage } from '../lib/api'
import { formatMoney, formatNumber, getText } from '../lib/format'

const PAGE_SIZE = 100

function optionalAmount(value: string) {
  if (!value.trim()) return undefined
  const parsed = Number(value.replaceAll(',', ''))
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : Number.NaN
}

function parseUsage(value: string) {
  const items = value.split(',').map((item) => item.trim()).filter(Boolean)
  return items.length ? items : undefined
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
  const [query, setQuery] = useState('')
  const [region, setRegion] = useState('')
  const [goodsUsage, setGoodsUsage] = useState('')
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

  const handleBoundsChange = useCallback((bounds: GeographicBounds) => {
    setViewportBounds(bounds)
    setIsViewportDirty(true)
  }, [])

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

    searchGeographicMapGoods(appliedParams, controller.signal)
      .then((response) => {
        if (!isActive) return
        setItems(response.items)
        setTotal(response.total)
        setExcludedCount(response.coverage.excluded_unconvertible)
        setSelectedGoodsId(null)
        setIsViewportDirty(false)
      })
      .catch((error: unknown) => {
        if (!isActive || controller.signal.aborted) return
        setItems([])
        setTotal(0)
        setExcludedCount(0)
        setErrorMessage(getKoreanErrorMessage(error, '현재 지도 영역의 물건을 불러오지 못했습니다.'))
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

  const applySearch = (offset: number) => {
    if (!viewportBounds) {
      setErrorMessage('지도가 준비된 뒤 다시 검색해 주세요.')
      return
    }
    const parsedMinPrice = optionalAmount(minPrice)
    const parsedMaxPrice = optionalAmount(maxPrice)
    if (Number.isNaN(parsedMinPrice) || Number.isNaN(parsedMaxPrice)) {
      setErrorMessage('가격은 0 이상의 원 단위 숫자로 입력해 주세요.')
      return
    }
    if (parsedMinPrice !== undefined && parsedMaxPrice !== undefined && parsedMinPrice > parsedMaxPrice) {
      setErrorMessage('최소 가격은 최대 가격보다 클 수 없습니다.')
      return
    }

    setAppliedParams({
      ...viewportBounds,
      q: query.trim() || undefined,
      region: region.trim() || undefined,
      goods_usage: parseUsage(goodsUsage),
      min_lowest_sale_price: parsedMinPrice,
      max_lowest_sale_price: parsedMaxPrice,
      limit: PAGE_SIZE,
      offset,
    })
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    applySearch(0)
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
              <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-900"><MapPinned className="h-6 w-6 text-indigo-600" /> 지도에서 경매물건 찾기</h1>
              <p className="mt-1 text-sm text-gray-500">지도를 움직인 뒤 현재 화면 안의 물건을 검색하고 마커와 목록을 함께 비교하세요.</p>
            </div>
            <div className="rounded-full bg-white px-4 py-2 text-xs font-bold text-gray-500 shadow-sm ring-1 ring-gray-200">
              OpenStreetMap · WGS84
            </div>
          </div>

          <form onSubmit={handleSubmit} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <label className="xl:col-span-2"><span className="sr-only">통합 검색어</span><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="사건번호, 건물명, 주소" className="w-full rounded-xl border border-gray-200 py-3 pl-10 pr-3 text-sm outline-none focus:border-indigo-500" /></div></label>
              <input value={region} onChange={(event) => setRegion(event.target.value)} placeholder="지역 (예: 강남구)" className="rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-indigo-500" />
              <input value={goodsUsage} onChange={(event) => setGoodsUsage(event.target.value)} placeholder="용도 (아파트,상가)" className="rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-indigo-500" />
              <input inputMode="numeric" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} placeholder="최저가 최소" className="rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-indigo-500" />
              <input inputMode="numeric" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} placeholder="최저가 최대" className="rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-indigo-500" />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-xs text-gray-500"><Filter className="h-4 w-4" /> 쉼표로 여러 용도를 함께 검색할 수 있습니다.</p>
              <button type="submit" disabled={!viewportBounds || isLoading} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-extrabold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-300">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
                {isViewportDirty ? '이 지도에서 검색' : '현재 영역 다시 검색'}
              </button>
            </div>
          </form>

          {errorMessage && <div className="rounded-xl border border-red-100 bg-red-50 px-5 py-4 text-sm font-bold text-red-700" role="alert">{errorMessage}</div>}

          <div className="grid min-h-[680px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.8fr)]">
            <div className="relative min-h-[520px] overflow-hidden border-b border-gray-200 xl:border-b-0 xl:border-r">
              <AuctionMap
                items={items}
                selectedGoodsId={selectedGoodsId}
                onSelectGoods={setSelectedGoodsId}
                onBoundsChange={handleBoundsChange}
                className="h-[520px] xl:h-[680px]"
              />
              {isViewportDirty && appliedParams && (
                <button type="button" onClick={() => applySearch(0)} className="absolute left-1/2 top-4 z-[500] inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-indigo-700 px-5 py-3 text-sm font-extrabold text-white shadow-xl hover:bg-indigo-800">
                  <LocateFixed className="h-4 w-4" /> 이 지도에서 다시 검색
                </button>
              )}
            </div>

            <aside className="flex min-h-0 flex-col bg-slate-50/70">
              <div className="border-b border-gray-200 bg-white px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div><div className="text-xs font-bold text-gray-400">현재 영역</div><div className="mt-1 text-lg font-extrabold text-slate-900">{formatNumber(total, '개')}</div></div>
                  {items.length > 0 && <div className="text-right text-xs font-bold text-gray-500"><MapPin className="mr-1 inline h-4 w-4 text-indigo-600" />마커 {mappedCount}개</div>}
                </div>
                {excludedCount > 0 && <p className="mt-2 text-xs text-amber-700">현재 페이지 후보 중 좌표를 변환할 수 없는 {excludedCount}개 물건은 지도·목록에서 제외됐습니다.</p>}
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-3 xl:max-h-[550px]">
                {isLoading && <div className="flex min-h-52 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-indigo-600" /></div>}
                {!isLoading && appliedParams && items.length === 0 && <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">현재 지도와 조건에 맞는 물건이 없습니다.</div>}
                {!isLoading && !appliedParams && <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center"><MapPin className="mx-auto h-7 w-7 text-gray-300" /><p className="mt-3 text-sm font-bold text-gray-600">관심 지역으로 지도를 이동한 뒤 검색하세요.</p></div>}
                {!isLoading && items.map((item) => <MapResultCard key={item.auction_goods_id} item={item} selected={item.auction_goods_id === selectedGoodsId} onSelect={setSelectedGoodsId} />)}
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
