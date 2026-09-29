import { apiRequest } from './api'

export type GoodsCommentAuthorRole = 'legal_agent' | 'admin'

export type GoodsComment = {
  id: string
  auction_goods_id: number
  content: string
  author: {
    label: '법무사' | '관리자'
    access_group: GoodsCommentAuthorRole
  }
  created_at: string
}

export type GoodsCommentListResponse = {
  total: number
  limit: number
  offset: number
  items: GoodsComment[]
}

export type GoodsCommentListParams = {
  limit?: number
  offset?: number
  signal?: AbortSignal
}

export function getNextGoodsCommentOffset(response: GoodsCommentListResponse) {
  return response.offset + response.items.length
}

function normalizedGoodsId(auctionGoodsId: number | string) {
  return encodeURIComponent(String(auctionGoodsId))
}

export function getGoodsComments(
  auctionGoodsId: number | string,
  {
    limit = 20,
    offset = 0,
    signal,
  }: GoodsCommentListParams = {},
) {
  const searchParams = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  })

  return apiRequest<GoodsCommentListResponse>(
    `/api/v1/goods/${normalizedGoodsId(auctionGoodsId)}/comments?${searchParams}`,
    { signal },
  )
}

export function createGoodsComment(
  auctionGoodsId: number | string,
  content: string,
  signal?: AbortSignal,
) {
  return apiRequest<GoodsComment>(
    `/api/v1/goods/${normalizedGoodsId(auctionGoodsId)}/comments`,
    {
      method: 'POST',
      auth: 'bearer',
      body: JSON.stringify({ content }),
      signal,
    },
  )
}
