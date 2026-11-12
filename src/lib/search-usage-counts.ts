import {
  getSearchUsageCounts,
  type AuctionGoodsUsageCounts,
  type AuctionSearchMode,
  type AuctionSearchParams,
} from './auction'

export type SearchUsageCounts = AuctionGoodsUsageCounts

// 용도 선택·정렬·페이지 변경은 같은 전체 검색 결과의 집계로 취급한다.
export function getSearchUsageKey(searchKey: string) {
  const params = new URLSearchParams(searchKey)
  for (const key of ['goods_usage', 'sort_by', 'limit', 'offset']) params.delete(key)
  params.sort()
  return params.toString()
}

// 목록 페이지를 다시 내려받지 않고 서버가 계산한 전체 건수를 표시한다.
export async function loadSearchUsageCounts(
  params: AuctionSearchParams,
  mode: AuctionSearchMode,
  signal: AbortSignal,
): Promise<SearchUsageCounts> {
  signal.throwIfAborted()
  const counts = await getSearchUsageCounts(params, mode, { signal })
  signal.throwIfAborted()
  return {
    ...counts,
    items: [...counts.items].sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, 'ko')),
  }
}
