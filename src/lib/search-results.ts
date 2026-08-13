import type { SortBy } from './auction'

export const searchResultSortOptions: { value: SortBy; label: string }[] = [
  { value: 'auction_date_asc', label: '매각일 빠른순' },
  { value: 'auction_date_desc', label: '매각일 늦은순' },
  { value: 'case_old', label: '사건번호 오래된순' },
  { value: 'case_new', label: '사건번호 최신순' },
  { value: 'lowest_asc', label: '최저가 낮은순' },
  { value: 'lowest_desc', label: '최저가 높은순' },
  { value: 'appraisal_asc', label: '감정가 낮은순' },
  { value: 'appraisal_desc', label: '감정가 높은순' },
  { value: 'failed_count_asc', label: '유찰 적은순' },
  { value: 'failed_count_desc', label: '유찰 많은순' },
]

export const DEFAULT_SEARCH_RESULT_SORT_BY: SortBy = 'auction_date_asc'
export const DEFAULT_SEARCH_RESULT_LIMIT = 50
const MIN_SEARCH_RESULT_LIMIT = 1
const MAX_SEARCH_RESULT_LIMIT = 100
const allowedSortValues = new Set<SortBy>(
  searchResultSortOptions.map(({ value }) => value),
)

export function normalizeSearchResultSortBy(value: string | null): SortBy {
  return value && allowedSortValues.has(value as SortBy)
    ? value as SortBy
    : DEFAULT_SEARCH_RESULT_SORT_BY
}

export function normalizeSearchResultLimit(value: string | null) {
  if (value === null || value.trim() === '') {
    return DEFAULT_SEARCH_RESULT_LIMIT
  }

  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed)) {
    return DEFAULT_SEARCH_RESULT_LIMIT
  }

  return Math.min(
    MAX_SEARCH_RESULT_LIMIT,
    Math.max(MIN_SEARCH_RESULT_LIMIT, parsed),
  )
}

export function normalizeSearchResultOffset(
  value: string | null,
  limit: number,
) {
  if (value === null || value.trim() === '') {
    return 0
  }

  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed)) {
    return 0
  }

  const nonNegativeOffset = Math.max(0, parsed)
  return Math.floor(nonNegativeOffset / limit) * limit
}

export function normalizeSearchResultParams(searchParams: URLSearchParams) {
  const normalized = new URLSearchParams(searchParams)
  const rawSortBy = normalized.get('sort_by')
  const rawLimit = normalized.get('limit')
  const rawOffset = normalized.get('offset')
  const limit = normalizeSearchResultLimit(rawLimit)
  const offset = normalizeSearchResultOffset(rawOffset, limit)

  if (rawSortBy !== null && rawSortBy !== normalizeSearchResultSortBy(rawSortBy)) {
    normalized.set('sort_by', normalizeSearchResultSortBy(rawSortBy))
  }

  if (rawLimit !== null && rawLimit !== String(limit)) {
    normalized.set('limit', String(limit))
  }

  if (rawOffset !== null && rawOffset !== String(offset)) {
    normalized.set('offset', String(offset))
  }

  return normalized
}

export function getLastSearchResultOffset(total: number, limit: number) {
  return total > 0 ? Math.floor((total - 1) / limit) * limit : 0
}
