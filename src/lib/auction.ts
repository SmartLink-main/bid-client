import { apiRequest, withQuery, type ApiRequestInit } from './api'

export type ApiListResponse<T> = {
  total: number
  limit?: number
  offset?: number
  items: T[]
}

export type AuctionGoodsSearchItem = {
  schedule_goods_id?: number | null
  schedule_id: string
  auction_date?: string | null
  auction_time?: string | null
  auction_place?: string | null
  court_name?: string | null
  branch_name?: string | null
  division_name?: string | null
  division_number?: number | null
  correction_notice_count?: number | null
  cancel_notice_count?: number | null
  detail_url?: string | null
  page_url?: string | null
  auction_goods_id: number
  disposal_goods_sequence?: number | null
  goods_status_name?: string | null
  goods_usage_name?: string | null
  bid_division_name?: string | null
  failed_count?: number | null
  appraisal_amount?: number | null
  first_announcement_lowest_sale_price?: number | null
  building_area_pyeong?: number | null
  land_area_pyeong?: number | null
  building_name?: string | null
  lot_number_address?: string | null
  road_address?: string | null
  printed_address?: string | null
  map_x?: number | null
  map_y?: number | null
  distance_m?: number | null
  case_id?: string | null
  case_number?: string | null
  case_name?: string | null
  progress_status_name?: string | null
  result_division_name?: string | null
  result_date?: string | null
}

export type AuctionGoodsSearchResponse = ApiListResponse<AuctionGoodsSearchItem>
export type AuctionSearchMode = 'standard' | 'comprehensive' | 'special'

export type CourtDivisionOption = {
  division_number: number
  division_name: string | null
}

export type CourtDivisionOptionsResponse = {
  court_code: string
  items: CourtDivisionOption[]
}

export type SortBy =
  | 'auction_date_asc'
  | 'auction_date_desc'
  | 'case_old'
  | 'case_new'
  | 'appraisal_desc'
  | 'appraisal_asc'
  | 'lowest_desc'
  | 'lowest_asc'
  | 'failed_count_desc'
  | 'failed_count_asc'

export type AuctionSearchParams = {
  q?: string
  start_date?: string
  end_date?: string
  court_code?: string
  court_name?: string
  branch_name?: string
  division_name?: string
  region?: string
  sido?: string
  sigungu?: string
  dong?: string
  case_year?: number
  case_serial?: number
  auction_kind?: string
  interested_party_role?: string
  interested_party_name?: string
  min_appraisal_amount?: number
  max_appraisal_amount?: number
  min_lowest_sale_price?: number
  max_lowest_sale_price?: number
  half_price?: boolean
  min_failed_count?: number
  max_failed_count?: number
  min_building_area_pyeong?: number
  max_building_area_pyeong?: number
  min_land_area_pyeong?: number
  max_land_area_pyeong?: number
  building_name?: string
  status?: string
  goods_usage?: string[]
  special_type?: string[]
  match_mode?: 'any' | 'all'
  sort_by?: SortBy
  limit?: number
  offset?: number
}

export function searchGoods(
  params: AuctionSearchParams,
  mode: AuctionSearchMode = 'standard',
  init?: Pick<ApiRequestInit, 'signal'>,
) {
  const path = mode === 'standard'
    ? '/api/v1/search'
    : `/api/v1/search/${mode}`

  return apiRequest<AuctionGoodsSearchResponse>(
    withQuery(path, params),
    init,
  )
}

export function getSpecialGoodsTypes() {
  return apiRequest<{ items: string[] }>('/api/v1/search/special/types')
}

export function getCourtDivisionOptions(courtCode: string, signal?: AbortSignal) {
  return apiRequest<CourtDivisionOptionsResponse>(
    `/api/v1/search/options/courts/${encodeURIComponent(courtCode)}/divisions`,
    signal ? { signal } : undefined,
  )
}
