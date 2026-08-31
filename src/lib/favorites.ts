import { apiRequest, type ApiRequestInit } from './api'

export type FavoriteStatus = {
  auction_goods_id: number
  is_favorite: boolean
  created_at?: string | null
}

export type FavoriteStatusesResponse = {
  items: FavoriteStatus[]
}

export type FavoriteItem = {
  auction_goods_id: number
  created_at: string | null
  case_number: string | null
  case_name: string | null
  court_name: string | null
  branch_name: string | null
  disposal_goods_sequence: number | null
  goods_usage_name: string | null
  goods_status_name: string | null
  building_name: string | null
  address: string | null
  appraisal_amount: number | null
  current_lowest_sale_price: number | null
  auction_date: string | null
  failed_count: number | null
}

export type FavoriteListResponse = {
  total: number
  limit: number
  offset: number
  items: FavoriteItem[]
}

export type FavoriteListParams = {
  limit?: number
  offset?: number
}

function normalizeGoodsId(auctionGoodsId: number | string) {
  const value = Number(auctionGoodsId)
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error('올바른 경매 물건 ID가 필요합니다.')
  }
  return value
}

function bearerInit(init?: ApiRequestInit): ApiRequestInit {
  return { ...init, auth: 'bearer' }
}

export function getFavorites(
  { limit = 20, offset = 0 }: FavoriteListParams = {},
  signal?: AbortSignal,
) {
  const searchParams = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  })
  return apiRequest<FavoriteListResponse>(
    `/api/v1/favorites?${searchParams}`,
    bearerInit({ signal }),
  )
}

export function getFavoriteStatus(
  auctionGoodsId: number | string,
  signal?: AbortSignal,
) {
  const goodsId = normalizeGoodsId(auctionGoodsId)
  return apiRequest<FavoriteStatus>(
    `/api/v1/favorites/${goodsId}`,
    bearerInit({ signal }),
  )
}

export function getFavoriteStatuses(
  auctionGoodsIds: Array<number | string>,
  signal?: AbortSignal,
) {
  const normalizedIds = Array.from(new Set(auctionGoodsIds.map(normalizeGoodsId)))
  if (normalizedIds.length > 100) {
    throw new Error('관심 상태는 한 번에 100개까지 조회할 수 있습니다.')
  }
  if (normalizedIds.length === 0) {
    return Promise.resolve<FavoriteStatusesResponse>({ items: [] })
  }
  return apiRequest<FavoriteStatusesResponse>(
    '/api/v1/favorites/statuses',
    bearerInit({
      method: 'POST',
      body: JSON.stringify({ auction_goods_ids: normalizedIds }),
      signal,
    }),
  )
}

export function saveFavorite(auctionGoodsId: number | string) {
  const goodsId = normalizeGoodsId(auctionGoodsId)
  return apiRequest<FavoriteStatus>(
    `/api/v1/favorites/${goodsId}`,
    bearerInit({ method: 'PUT' }),
  )
}

export function removeFavorite(auctionGoodsId: number | string) {
  const goodsId = normalizeGoodsId(auctionGoodsId)
  return apiRequest<FavoriteStatus | null>(
    `/api/v1/favorites/${goodsId}`,
    bearerInit({ method: 'DELETE' }),
  )
}
