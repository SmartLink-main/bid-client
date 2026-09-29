import { apiRequest, getApiUrl, withQuery, type ApiRequestInit } from './api'

export type AuctionScheduleListItem = {
  schedule_id: string
  auction_date: string
  auction_time: string | null
  court_name: string
  branch_name: string
  division_number: number
}

export type AuctionScheduleListResponse = {
  total: number
  items: AuctionScheduleListItem[]
}

export type AuctionScheduleQuery = {
  start_date?: string
  end_date?: string
  court_name?: string
  branch_name?: string
}

export type AuctionNoticeChange = {
  notice_kind: string
  change_notice_date: string
  change_notice_detail: string
}

export type AuctionScheduleGoods = {
  schedule_goods_id: number
  auction_goods_id: number
  disposal_goods_sequence: number
  case_id: string
  case_name: string | null
  progress_status_name: string | null
  result_division_name: string | null
  result_date: string | null
  notice_changes: AuctionNoticeChange[]
}

export type AuctionScheduleDetail = {
  schedule_id: string
  auction_date: string
  auction_time: string | null
  auction_place: string
  court_name: string
  branch_name: string
  division_name: string | null
  division_phone: string | null
  execution_case_phone: string | null
  correction_notice_count: number
  cancel_notice_count: number
  goods_count: number
  notice_change_count: number
  goods: AuctionScheduleGoods[]
}

export type AuctionSearchResultItem = {
  schedule_goods_id: number
  schedule_id: string
  auction_date: string
  auction_time: string | null
  auction_place: string
  court_name: string
  branch_name: string
  division_name: string | null
  division_number: number
  correction_notice_count: number
  cancel_notice_count: number
  detail_url: string
  page_url: string
  auction_goods_id: number
  disposal_goods_sequence: number
  goods_status_name: string | null
  goods_usage_name: string | null
  bid_division_name: string | null
  failed_count: number
  appraisal_amount: number | null
  first_announcement_lowest_sale_price: number | null
  building_area_pyeong: number | null
  land_area_pyeong: number | null
  building_name: string | null
  lot_number_address: string | null
  road_address: string | null
  printed_address: string | null
  map_x: number | null
  map_y: number | null
  distance_m: number | null
  case_id: string
  case_name: string | null
  progress_status_name: string | null
  result_division_name: string | null
  result_date: string | null
}

export type GeographicSearchItem = Partial<AuctionSearchResultItem> & {
  auction_goods_id: number
  latitude: number | null
  longitude: number | null
  case_number?: string | null
  current_lowest_sale_price?: number | null
  price_ratio?: number | null
  thumbnail_url?: string | null
}

export function getGeographicSearchItemKey(item: GeographicSearchItem) {
  if (typeof item.schedule_goods_id === 'number') {
    return `schedule-goods:${item.schedule_goods_id}`
  }
  if (item.schedule_id) {
    return `schedule:${item.schedule_id}:goods:${item.auction_goods_id}`
  }
  return `goods:${item.auction_goods_id}`
}

export type GeographicBounds = {
  west: number
  south: number
  east: number
  north: number
}

export type GeographicCommonFilters = {
  q?: string
  start_date?: string
  end_date?: string
  court_code?: string
  court_name?: string
  region?: string
  sido?: string
  sigungu?: string
  dong?: string
  goods_usage?: string[]
  min_appraisal_amount?: number
  max_appraisal_amount?: number
  min_lowest_sale_price?: number
  max_lowest_sale_price?: number
  min_failed_count?: number
  max_failed_count?: number
  status?: string
  limit?: number
  offset?: number
}

export type GeographicMapClusterLevel = 'sido' | 'sigungu'

export type GeographicMapSearchParams = GeographicBounds & GeographicCommonFilters & {
  cluster_by?: GeographicMapClusterLevel
}

export type GeographicMapCluster = {
  key: string
  province: string | null
  sigungu: string | null
  count: number
  longitude: number
  latitude: number
  bounds: GeographicBounds
}

export type GeographicMapSearchResponse = PagedSearchResponse<GeographicSearchItem> & {
  search_type: 'map'
  coordinate_system: 'WGS84'
  bounds: GeographicBounds
  coverage: GeographicSearchCoverage
  excluded_items: GeographicExcludedItem[]
  clusters?: GeographicMapCluster[]
}

export type ReverseGeographicRegion = {
  legal_dong_code: string | null
  province: string
  sigungu: string
  dong: string
}

export type ReverseGeographicRegionResponse = {
  coordinate_system: 'WGS84'
  center: {
    longitude: number
    latitude: number
  }
  region: ReverseGeographicRegion | null
}

export type SubwayStation = {
  station_id: string
  name: string
  city: string
  areas: string[]
  lines: string[]
  latitude: number
  longitude: number
}

export type SubwayStationSearchParams = {
  q?: string
  city?: string
  line?: string
  limit?: number
}

export type SubwayStationSearchResponse = {
  coordinate_system: 'WGS84'
  total: number
  limit: number
  items: SubwayStation[]
}

export type SubwayStationLineFacet = {
  line: string
  total: number
}

export type SubwayStationCityFacet = {
  city: string
  label: string
  total: number
  lines: SubwayStationLineFacet[]
}

export type SubwayStationFacetResponse = {
  cities: SubwayStationCityFacet[]
}

export type GeographicSearchCoverage = {
  matched_total: number
  page_candidates: number
  page_items: number
  excluded_unconvertible: number
}

export type GeographicExcludedItem = {
  auction_goods_id: number | null
  schedule_goods_id: number | null
  reason: 'missing_source_coordinate' | 'coordinate_conversion_failed' | string
}

export type GeographicSubwaySearchParams = GeographicCommonFilters & {
  station_id: string
  radius_m: number
}

export type GeographicSubwaySearchResponse = PagedSearchResponse<GeographicSearchItem> & {
  search_type: 'subway'
  coordinate_system: 'WGS84'
  station: SubwayStation & { radius_m: number }
  coverage: GeographicSearchCoverage
  excluded_items: GeographicExcludedItem[]
}

export type PagedSearchResponse<T> = {
  total: number
  limit: number
  offset: number
  items: T[]
}

export type ScheduledSortBy =
  | 'commence_date_desc'
  | 'commence_date_asc'
  | 'demand_deadline_asc'
  | 'demand_deadline_desc'

export type ScheduledSearchParams = {
  q?: string
  court_code?: string
  court_name?: string
  region?: string
  auction_kind?: string
  min_case_year?: number
  max_case_year?: number
  min_claim_amount?: number
  max_claim_amount?: number
  demand_deadline_passed?: boolean
  sort_by?: ScheduledSortBy
  limit?: number
  offset?: number
}

export type ScheduledAuctionItem = {
  auction_goods_id: number
  detail_url: string
  disposal_goods_sequence: number
  goods_status_name: string | null
  goods_usage_name: string | null
  appraisal_amount: number | null
  building_name: string | null
  lot_number_address: string | null
  road_address: string | null
  printed_address: string | null
  map_x: number | null
  map_y: number | null
  demand_deadline_date: string | null
  demand_deadline_passed: boolean | null
  case_id: string
  case_year: number
  case_serial: number
  case_number: string
  case_name: string | null
  commence_decision_date: string | null
  claim_amount: number | null
  court_code: string
  court_name: string
  branch_name: string
}

export type ScheduledSearchResponse = PagedSearchResponse<ScheduledAuctionItem> & {
  search_type: 'scheduled'
}

function requestOptions(signal?: AbortSignal): ApiRequestInit | undefined {
  return signal ? { signal } : undefined
}

export function getAuctionSchedules(
  params: AuctionScheduleQuery = {},
  signal?: AbortSignal,
) {
  return apiRequest<AuctionScheduleListResponse>(
    withQuery('/api/v1/schedule', params),
    requestOptions(signal),
  )
}

export function getAuctionScheduleDetail(scheduleId: string, signal?: AbortSignal) {
  return apiRequest<AuctionScheduleDetail>(
    `/api/v1/auction-detail/${encodeURIComponent(scheduleId)}`,
    requestOptions(signal),
  )
}

export function getAuctionDetailPageUrl(scheduleId: string) {
  return getApiUrl(`/api/v1/auction-detail/${encodeURIComponent(scheduleId)}/page`)
}

export function searchGeographicMapGoods(
  params: GeographicMapSearchParams,
  signal?: AbortSignal,
) {
  return apiRequest<GeographicMapSearchResponse>(
    withQuery('/api/v1/geo/map', params),
    requestOptions(signal),
  )
}

export function reverseGeographicRegion(
  longitude: number,
  latitude: number,
  signal?: AbortSignal,
) {
  return apiRequest<ReverseGeographicRegionResponse>(
    withQuery('/api/v1/geo/reverse-region', { longitude, latitude }),
    requestOptions(signal),
  )
}

export function searchSubwayStations(
  params: SubwayStationSearchParams,
  signal?: AbortSignal,
) {
  return apiRequest<SubwayStationSearchResponse>(
    withQuery('/api/v1/geo/stations', params),
    requestOptions(signal),
  )
}

export function getSubwayStationFacets(signal?: AbortSignal) {
  return apiRequest<SubwayStationFacetResponse>(
    '/api/v1/geo/station-facets',
    requestOptions(signal),
  )
}

export function searchGeographicSubwayGoods(
  params: GeographicSubwaySearchParams,
  signal?: AbortSignal,
) {
  return apiRequest<GeographicSubwaySearchResponse>(
    withQuery('/api/v1/geo/subway', params),
    requestOptions(signal),
  )
}

export function searchScheduledGoods(
  params: ScheduledSearchParams = {},
  signal?: AbortSignal,
) {
  return apiRequest<ScheduledSearchResponse>(
    withQuery('/api/v1/search/scheduled', params),
    requestOptions(signal),
  )
}
