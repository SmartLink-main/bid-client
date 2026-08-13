import { useEffect, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Heart, Loader2, MapPin, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import FavoriteToggleButton from '../components/FavoriteToggleButton'
import Layout from '../components/Layout'
import { getKoreanErrorMessage } from '../lib/api'
import {
  getFavorites,
  type FavoriteItem,
  type FavoriteListResponse,
} from '../lib/favorites'
import { formatMoney, formatNumber, getText } from '../lib/format'

const PAGE_SIZE = 20

function FavoriteCard({
  item,
  onRemove,
}: {
  item: FavoriteItem
  onRemove: (auctionGoodsId: number) => void
}) {
  const title = item.building_name || item.address || `물건 ${item.auction_goods_id}`

  return (
    <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs font-extrabold text-indigo-700">
            <span>{getText(item.court_name, '법원 미등록')}</span>
            {item.branch_name && <span className="text-gray-400">{item.branch_name}</span>}
            {item.case_number && <span className="rounded bg-indigo-50 px-2 py-1">{item.case_number}</span>}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold text-gray-500">
            {item.goods_usage_name && <span>{item.goods_usage_name}</span>}
            {item.goods_status_name && <span>{item.goods_status_name}</span>}
            {item.disposal_goods_sequence !== null && <span>물건 {item.disposal_goods_sequence}</span>}
            {item.failed_count !== null && <span>유찰 {formatNumber(item.failed_count, '회')}</span>}
          </div>
          <h2 className="mt-2 truncate text-xl font-extrabold text-slate-900">{title}</h2>
          <p className="mt-1 flex items-start gap-1 text-sm text-gray-500">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
            {getText(item.address, '주소 정보 없음')}
          </p>
          {item.auction_date && (
            <p className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-gray-500">
              <CalendarDays className="h-4 w-4" /> 매각기일 {item.auction_date}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-4 lg:min-w-72 lg:items-end">
          <div className="grid w-full grid-cols-2 gap-3 text-right">
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-xs text-gray-400">감정가</div>
              <div className="mt-1 font-extrabold text-slate-900">{formatMoney(item.appraisal_amount)}</div>
            </div>
            <div className="rounded-lg bg-blue-50 p-3">
              <div className="text-xs text-blue-500">현재 최저가</div>
              <div className="mt-1 font-extrabold text-blue-900">{formatMoney(item.current_lowest_sale_price)}</div>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <FavoriteToggleButton
              auctionGoodsId={item.auction_goods_id}
              initialIsFavorite
              shouldFetchStatus={false}
              onChange={(isFavorite) => {
                if (!isFavorite) onRemove(item.auction_goods_id)
              }}
            />
            <Link
              to={`/goods/${item.auction_goods_id}`}
              className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-indigo-700"
            >
              상세보기
            </Link>
          </div>
        </div>
      </div>
    </article>
  )
}

export default function FavoritesPage() {
  const [offset, setOffset] = useState(0)
  const [response, setResponse] = useState<FavoriteListResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        setIsLoading(true)
        setErrorMessage('')
      }
    })

    getFavorites({ limit: PAGE_SIZE, offset }, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setResponse(data)
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setErrorMessage(getKoreanErrorMessage(error, '관심물건을 불러오지 못했습니다.'))
          setResponse(null)
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => controller.abort()
  }, [offset, reloadKey])

  const handleRemove = (auctionGoodsId: number) => {
    setResponse((current) => current ? {
      ...current,
      total: Math.max(0, current.total - 1),
      items: current.items.filter((item) => item.auction_goods_id !== auctionGoodsId),
    } : current)

    if (response?.items.length === 1 && offset > 0) {
      setOffset(Math.max(0, offset - PAGE_SIZE))
    } else {
      // 현재 페이지를 다시 채워 다음 페이지의 첫 항목이 목록에서 사라지지 않게 한다.
      setReloadKey((value) => value + 1)
    }
  }

  const total = response?.total ?? 0
  const items = response?.items ?? []
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <Layout>
      <div className="w-full flex-grow bg-slate-50 px-4 py-8">
        <div className="mx-auto w-full max-w-6xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-900">
                <Heart className="h-6 w-6 fill-rose-500 text-rose-500" /> 관심물건
              </h1>
              <p className="mt-2 text-sm text-gray-500">저장한 경매물건의 가격과 일정을 한곳에서 다시 확인하세요.</p>
            </div>
            {!isLoading && !errorMessage && (
              <p className="text-sm font-bold text-gray-500">총 {total.toLocaleString('ko-KR')}건</p>
            )}
          </div>

          {isLoading && (
            <div className="mt-6 flex min-h-80 items-center justify-center rounded-xl border border-gray-200 bg-white" role="status">
              <Loader2 className="h-7 w-7 animate-spin text-indigo-600" />
              <span className="sr-only">관심물건을 불러오는 중</span>
            </div>
          )}

          {!isLoading && errorMessage && (
            <div className="mt-6 rounded-xl border border-red-100 bg-red-50 p-6 text-center" role="alert">
              <p className="text-sm font-bold text-red-700">{errorMessage}</p>
              <button type="button" onClick={() => setReloadKey((value) => value + 1)} className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-extrabold text-white hover:bg-red-800">
                다시 시도
              </button>
            </div>
          )}

          {!isLoading && !errorMessage && items.length === 0 && (
            <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
              <Heart className="mx-auto h-10 w-10 text-gray-300" />
              <h2 className="mt-4 text-lg font-extrabold text-slate-900">아직 저장한 관심물건이 없습니다.</h2>
              <p className="mt-2 text-sm text-gray-500">검색 결과나 물건 상세에서 관심 저장 버튼을 눌러보세요.</p>
              <Link to="/search" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-3 text-sm font-extrabold text-white hover:bg-indigo-700">
                <Search className="h-4 w-4" /> 물건 검색하기
              </Link>
            </div>
          )}

          {!isLoading && !errorMessage && items.length > 0 && (
            <div className="mt-6 grid gap-4">
              {items.map((item) => <FavoriteCard key={item.auction_goods_id} item={item} onRemove={handleRemove} />)}
            </div>
          )}

          {!isLoading && !errorMessage && total > PAGE_SIZE && (
            <div className="mt-6 flex items-center justify-center gap-3">
              <button type="button" onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))} disabled={offset === 0} aria-label="이전 페이지" className="rounded-lg border border-gray-200 bg-white p-2.5 text-slate-700 disabled:text-gray-300">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="text-sm font-extrabold text-gray-500">{currentPage} / {totalPages}</span>
              <button type="button" onClick={() => setOffset(offset + PAGE_SIZE)} disabled={offset + PAGE_SIZE >= total} aria-label="다음 페이지" className="rounded-lg border border-gray-200 bg-white p-2.5 text-slate-700 disabled:text-gray-300">
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
