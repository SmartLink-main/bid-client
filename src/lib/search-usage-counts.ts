import {
  searchGoods,
  type AuctionGoodsSearchItem,
  type AuctionGoodsSearchResponse,
  type AuctionSearchMode,
  type AuctionSearchParams,
} from './auction'

export type SearchUsageCounts = {
  total: number
  missing: number
  items: Array<{ value: string; count: number }>
}

export type SearchUsageSeed = {
  key: string
  params: AuctionSearchParams
  response: AuctionGoodsSearchResponse
}

// 용도 선택·정렬·페이지 변경은 같은 전체 검색 결과의 집계로 취급한다.
export function getSearchUsageKey(searchKey: string) {
  const params = new URLSearchParams(searchKey)
  for (const key of ['goods_usage', 'sort_by', 'limit', 'offset']) params.delete(key)
  params.sort()
  return params.toString()
}

// 전체 페이지를 읽기 전에는 부분 집계를 반환하지 않는다.
export async function loadSearchUsageCounts(
  params: AuctionSearchParams,
  mode: AuctionSearchMode,
  signal: AbortSignal,
  seed?: SearchUsageSeed,
): Promise<SearchUsageCounts> {
  const pageSize = 100
  const counts = new Map<string, number>()
  let missing = 0
  const consume = (items: AuctionGoodsSearchItem[]) => {
    for (const item of items) {
      const usage = item.goods_usage_name
      if (!usage?.trim()) missing += 1
      else counts.set(usage, (counts.get(usage) ?? 0) + 1)
    }
  }
  const finish = (total: number): SearchUsageCounts => ({
    total,
    missing,
    items: [...counts].map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, 'ko')),
  })

  signal.throwIfAborted()
  if (seed && !seed.params.goods_usage?.length && !seed.params.offset &&
    seed.response.items.length === seed.response.total) {
    consume(seed.response.items)
    return finish(seed.response.total)
  }

  const query = { ...params, goods_usage: undefined, sort_by: 'auction_date_asc' as const, limit: pageSize }
  const first = await searchGoods({ ...query, offset: 0 }, mode, { signal })
  const total = first.total
  const checkPage = (response: AuctionGoodsSearchResponse, offset: number) => {
    signal.throwIfAborted()
    if (response.total !== total || response.items.length !== Math.min(pageSize, total - offset)) {
      throw new Error('검색 결과가 변경되었습니다. 용도별 건수를 다시 불러와 주세요.')
    }
  }
  checkPage(first, 0)
  consume(first.items)
  let nextOffset = pageSize
  const worker = async () => {
    while (nextOffset < total) {
      signal.throwIfAborted()
      const offset = nextOffset
      nextOffset += pageSize
      const response = await searchGoods({ ...query, offset }, mode, { signal })
      checkPage(response, offset)
      consume(response.items)
    }
  }
  // 검색 목록의 응답을 방해하지 않도록 추가 페이지는 최대 두 건씩 조회한다.
  await Promise.all([worker(), worker()])
  signal.throwIfAborted()
  return finish(total)
}
