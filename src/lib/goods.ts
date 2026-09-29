import type { GoodsDocument } from './goods-documents'
import { apiRequest, getApiUrl } from './api'

export type Nullable<T> = T | null

export type GoodsSummary = {
  sale_schedule_status?: 'upcoming' | 'past' | 'unconfirmed'
  sale_date_source?: 'hearing' | 'schedule' | null
  title: string
  court_name: Nullable<string>
  branch_name: Nullable<string>
  division_name: Nullable<string>
  goods_type_name: Nullable<string>
  address: Nullable<string>
  appraisal_amount: Nullable<number>
  appraisal_amount_text: Nullable<string>
  lowest_sale_price: Nullable<number>
  lowest_sale_price_text: Nullable<string>
  goods_status_name: Nullable<string>
  sale_date: Nullable<string>
  sale_date_text: Nullable<string>
  bid_division_name: Nullable<string>
  bid_deposit_rate: Nullable<number>
  bid_deposit_rate_text: Nullable<string>
  bid_deposit_amount: Nullable<number>
  bid_deposit_amount_text: Nullable<string>
}

export type GoodsParty = {
  party_sequence: Nullable<number>
  party_division_name: Nullable<string>
  party_name: Nullable<string>
}

export type RelatedCase = {
  related_case_display_number: Nullable<string>
  relation_type_name: Nullable<string>
  related_court_name?: Nullable<string>
}

export type GoodsCaseSection = {
  case_name: Nullable<string>
  case_year: Nullable<number>
  case_serial: Nullable<number>
  case_display_number: string
  court_code: Nullable<string>
  court_name: Nullable<string>
  branch_name: Nullable<string>
  progress_status_name: Nullable<string>
  result_division_name: Nullable<string>
  result_date: Nullable<string>
  result_date_text: Nullable<string>
  claim_amount: Nullable<number>
  claim_amount_text: Nullable<string>
  address: Nullable<string>
  lot_number_address: Nullable<string>
  road_address: Nullable<string>
  building_name: Nullable<string>
  building_detail: Nullable<string>
  goods_remark: Nullable<string>
  parties: GoodsParty[]
  related_cases: RelatedCase[]
}

export type GoodsSchedule = {
  schedule_id: string
  auction_date: string
  auction_date_text: string
  auction_time: Nullable<string>
  auction_place: Nullable<string>
  division_name: Nullable<string>
  division_phone: Nullable<string>
}

export type CaseEvent = {
  event_source: Nullable<string>
  event_date: Nullable<string>
  event_date_text: Nullable<string>
  event_detail: Nullable<string>
  event_result: Nullable<string>
}

export type GoodsProgressSection = {
  receipt_date: Nullable<string>
  receipt_date_text: Nullable<string>
  commence_decision_date: Nullable<string>
  commence_decision_date_text: Nullable<string>
  demand_deadline_date: Nullable<string>
  demand_deadline_date_text: Nullable<string>
  schedules: GoodsSchedule[]
  case_events: CaseEvent[]
}

export type SaleHearing = {
  hearing_date: string
  hearing_date_text: string
  hearing_time: Nullable<string>
  hearing_kind_name: Nullable<string>
  hearing_result_name: Nullable<string>
  hearing_goods_status_name: Nullable<string>
  bid_begin_date: Nullable<string>
  bid_begin_date_text: Nullable<string>
  bid_end_date: Nullable<string>
  bid_end_date_text: Nullable<string>
  hearing_place_name: Nullable<string>
  lowest_sale_price: Nullable<number>
  lowest_sale_price_text: Nullable<string>
  lowest_sale_price_ratio: Nullable<number>
  lowest_sale_price_ratio_text: Nullable<string>
  sale_amount: Nullable<number>
  sale_amount_text: Nullable<string>
}

export type SaleHearingsSection = {
  items: SaleHearing[]
}

export type AppraisalItem = {
  display_order: Nullable<number>
  table_division_name: Nullable<string>
  item_name: Nullable<string>
  content: Nullable<string>
}

export type GoodsAppraisalSection = {
  appraisal_amount: Nullable<number>
  appraisal_amount_text: Nullable<string>
  first_announcement_lowest_sale_price: Nullable<number>
  first_announcement_lowest_sale_price_text: Nullable<string>
  goods_specific_remark: Nullable<string>
  items: AppraisalItem[]
}

export type BuildingFloor = {
  display_order: Nullable<number>
  floor_name: Nullable<string>
  structure_name: Nullable<string>
  usage_text: Nullable<string>
  area_sqm: Nullable<number>
  area_sqm_text: Nullable<string>
  area_pyeong: Nullable<number>
  area_pyeong_text: Nullable<string>
}

export type GoodsBuildingSection = {
  lot_number_address: Nullable<string>
  building_name: Nullable<string>
  road_address: Nullable<string>
  building_detail: Nullable<string>
  printed_address: Nullable<string>
  land_area_sqm: Nullable<number>
  land_area_sqm_text: Nullable<string>
  land_area_pyeong: Nullable<number>
  land_area_pyeong_text: Nullable<string>
  gross_floor_area_sqm: Nullable<number>
  gross_floor_area_sqm_text: Nullable<string>
  gross_floor_area_pyeong: Nullable<number>
  gross_floor_area_pyeong_text: Nullable<string>
  building_area_sqm: Nullable<number>
  building_area_sqm_text: Nullable<string>
  building_area_pyeong: Nullable<number>
  building_area_pyeong_text: Nullable<string>
  floor_area_ratio_area_sqm: Nullable<number>
  floor_area_ratio_area_sqm_text: Nullable<string>
  floor_area_ratio_area_pyeong: Nullable<number>
  floor_area_ratio_area_pyeong_text: Nullable<string>
  main_building_usage: Nullable<string>
  building_coverage_ratio: Nullable<number>
  building_coverage_ratio_text: Nullable<string>
  floor_area_ratio: Nullable<number>
  floor_area_ratio_text: Nullable<string>
  ground_floor_count: Nullable<number>
  basement_floor_count: Nullable<number>
  building_structure_name: Nullable<string>
  construction_started_date: Nullable<string>
  construction_started_date_text: Nullable<string>
  use_approval_date: Nullable<string>
  use_approval_date_text: Nullable<string>
  floors: BuildingFloor[]
}

export type GoodsTenant = {
  display_order: Nullable<number>
  tenant_name: Nullable<string>
  occupancy_text: Nullable<string>
  move_in_date: Nullable<string>
  move_in_date_text: Nullable<string>
  fixed_date: Nullable<string>
  fixed_date_text: Nullable<string>
  demand_date: Nullable<string>
  demand_date_text: Nullable<string>
  deposit_amount: Nullable<number>
  deposit_amount_text: Nullable<string>
  monthly_rent_amount: Nullable<number>
  monthly_rent_amount_text: Nullable<string>
  opposing_power_text: Nullable<string>
  note: Nullable<string>
  survey_note: Nullable<string>
}

export type GoodsTenantsSection = {
  senior_right_base_text: Nullable<string>
  demand_deadline_date: Nullable<string>
  demand_deadline_date_text: Nullable<string>
  items: GoodsTenant[]
}

export type RegistryRight = {
  registry_scope: Nullable<string>
  display_order: Nullable<number>
  registration_date: Nullable<string>
  registration_date_text: Nullable<string>
  right_type: Nullable<string>
  holder_name: Nullable<string>
  claim_amount: Nullable<number>
  claim_amount_text: Nullable<string>
  takeover_extinction_text: Nullable<string>
  note: Nullable<string>
  is_extinction_basis: Nullable<boolean>
  total_claim_amount: Nullable<number>
  total_claim_amount_text: Nullable<string>
}

export type RegistryRightGroup = {
  registry_scope: string
  total_claim_amount: Nullable<number>
  total_claim_amount_text: Nullable<string>
  items: RegistryRight[]
}

export type GoodsRegistryRightsSection = {
  available: boolean
  groups: RegistryRightGroup[]
}

export type GoodsRiskNoticesSection = {
  rights_takeover_text: Nullable<string>
  surface_existence_text: Nullable<string>
  senior_right_text: Nullable<string>
  non_extinguished_registry_rights_text: Nullable<string>
  non_extinguished_superficies_text: Nullable<string>
  special_condition_text: Nullable<string>
}

export type NearbySale = {
  raw_case_number: Nullable<string>
  exposed_case_number: Nullable<string>
  goods_sequence: Nullable<number>
  address_text: Nullable<string>
  goods_type_name: Nullable<string>
  appraisal_amount: Nullable<number>
  appraisal_amount_text: Nullable<string>
  sale_date: Nullable<string>
  sale_date_text: Nullable<string>
  sale_price: Nullable<number>
  sale_price_text: Nullable<string>
}

export type GoodsNearbySalesSection = {
  available: boolean
  items: NearbySale[]
}

export type UnsupportedGoodsSection = {
  section: string
  available: false
  reason: string
}

export type GoodsPhoto = {
  photo_id: Nullable<number>
  photo_sequence: Nullable<number>
  photo_division_code: Nullable<string>
  photo_title: Nullable<string>
  content_url: Nullable<string>
  content_type: Nullable<string>
  content_hash: Nullable<string>
  file_size_bytes: Nullable<number>
  collected_at: Nullable<string>
  cdn_path?: string | null
}

export type GoodsSaleAreaValue = {
  sqm: Nullable<number>
  pyeong: Nullable<number>
  sqm_text: Nullable<string>
  pyeong_text: Nullable<string>
  status: 'calculated' | 'partial' | 'unknown' | 'not_applicable'
  known_sqm: Nullable<number>
  known_pyeong: Nullable<number>
  verification_status: 'verified' | 'needs_review'
  issues: string[]
}

export type GoodsSaleAreasSection = {
  available: boolean
  basis: Nullable<'court_listed'>
  calculation_version: Nullable<string>
  collected_at: Nullable<string>
  land: GoodsSaleAreaValue
  land_parcel: GoodsSaleAreaValue
  land_rights: GoodsSaleAreaValue
  main_building: GoodsSaleAreaValue
  shared_building: GoodsSaleAreaValue
  extra_building: GoodsSaleAreaValue
  extra_facility: GoodsSaleAreaValue
  listed_total: GoodsSaleAreaValue
  components: GoodsSaleAreaComponent[]
}

/** 저장된 목록별 면적과 매각 지분. 원문 파일을 추가로 요청하지 않는다. */
export type GoodsSaleAreaComponent = {
  item_label?: Nullable<string>
  component_key: string
  object_sequence: Nullable<number>
  detail_sequence: Nullable<string>
  area_kind: string
  area_sqm: Nullable<number>
  share_numerator: Nullable<number>
  share_denominator: Nullable<number>
  sale_area_sqm: Nullable<number>
  inclusion: 'included' | 'excluded' | 'unknown'
  qualifiers: string[]
}

export type GoodsDetailResponse = {
  location?: { latitude: number; longitude: number } | null
  auction_goods_id: number
  case_id: string
  case_display_number: string
  disposal_goods_sequence: number
  summary: GoodsSummary
  case: GoodsCaseSection
  progress: GoodsProgressSection
  sale_hearings: SaleHearingsSection
  appraisal: GoodsAppraisalSection
  building: GoodsBuildingSection
  sale_areas?: GoodsSaleAreasSection
  tenants: GoodsTenantsSection
  registry_rights: GoodsRegistryRightsSection
  risk_notices: GoodsRiskNoticesSection
  nearby_sales: GoodsNearbySalesSection
  unsupported_sections: UnsupportedGoodsSection[]
  documents?: { available: boolean; items: GoodsDocument[] }
  photos: {
    available: boolean
    items: GoodsPhoto[]
  }
  links: {
    self_url: string
    legacy_homepage_url: string
  }
}

export type QuestionGoodsRequest = {
  question: string
  limit?: number
}

export type QuestionGoodsItem = {
  auction_goods_id: number
  disposal_goods_sequence: Nullable<number>
  case_id: string
  case_name: Nullable<string>
  progress_status_name: Nullable<string>
  result_division_name: Nullable<string>
  result_date: Nullable<string>
  court_name: Nullable<string>
  branch_name: Nullable<string>
  schedule_id: Nullable<string>
  auction_date: Nullable<string>
  auction_time: Nullable<string>
  address: Nullable<string>
  goods_status_name: Nullable<string>
  goods_usage_name: Nullable<string>
  appraisal_amount: Nullable<number>
  lowest_sale_price: Nullable<number>
  building_name: Nullable<string>
  main_building_usage: Nullable<string>
  score: number
  match_reasons: string[]
  detail_url: Nullable<string>
  page_url: Nullable<string>
}

export type QuestionGoodsResponse = {
  question: string
  parsed: {
    terms: string[]
    max_price: Nullable<number>
  }
  interpretation: {
    method: 'ai' | 'rules'
    fallback_used: boolean
  }
  total: number
  limit: number
  items: QuestionGoodsItem[]
}

function normalizedGoodsId(auctionGoodsId: number | string) {
  return encodeURIComponent(String(auctionGoodsId))
}

export function getGoodsPhotoUrl(contentUrl: string | null | undefined, cdnPath?: string | null) {
  // API가 검증한 이미지 해시 경로만 설정된 CDN origin으로 전달한다.
  const configured = import.meta.env.VITE_PHOTO_CDN_BASE_URL?.trim()
  if (configured && cdnPath && !/\s/.test(cdnPath) && /^\/g\/[a-f0-9]{24}\.(?:jpg|jpeg|png|webp|gif|avif|bmp)$/.test(cdnPath)) {
    try {
      const origin = new URL(configured)
      const localTest = import.meta.env.DEV && origin.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(origin.hostname)
      if ((origin.protocol === 'https:' || localTest) && !origin.username && !origin.password &&
        origin.pathname === '/' && !origin.search && !origin.hash) {
        return `${origin.origin}${cdnPath}`
      }
    } catch { /* CDN 설정이 없거나 잘못되면 기존 사진 proxy를 유지한다. */ }
  }
  if (!contentUrl || !/^\/api\/v1\/goods\/\d+\/photos\/\d+$/.test(contentUrl)) return null
  return getApiUrl(contentUrl)
}


export function getGoodsDetail(
  auctionGoodsId: number | string,
  signal?: AbortSignal,
) {
  return apiRequest<GoodsDetailResponse>(
    `/api/v1/goods/${normalizedGoodsId(auctionGoodsId)}`,
    signal ? { signal } : undefined,
  )
}

export function askGoodsQuestion(payload: QuestionGoodsRequest) {
  return apiRequest<QuestionGoodsResponse>('/api/v1/question/goods', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
