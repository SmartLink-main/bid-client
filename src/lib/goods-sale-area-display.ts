import type { GoodsSaleAreaComponent } from './goods'

const kindLabels: Record<string, string> = {
  land_parcel: '토지 필지',
  land_rights: '대지권',
  main_building: '본건 건물',
  shared_building: '공유 부분',
  extra_building: '제시외 건물',
  extra_facility: '제시외 시설',
}

// 계산기의 의미가 확인된 항목만 사용자 설명으로 옮긴다.
const qualifierNotes: Record<string, string> = {
  source_conflict: '원문 간 면적이 달라 확인 필요',
  building_scope_unknown: '매각 건물 범위 확인 필요',
  location_unknown: '소재불명 기재',
  land_overlap_unresolved: '토지·대지권 중복 여부 확인 필요',
  covered_by_land_parcel: '토지 합계에 이미 반영되어 중복 합산하지 않음',
  non_area_asset: '면적 없는 시설로 면적 합계에서 제외',
  listed_rooftop: '공부상 옥탑',
  unfinished_structure: '미완성 구조물 기재',
  remark_only: '비고에 기재된 항목',
  land_rights_unknown: '대지권 지분 확인 필요',
}

function isArea(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function formatComponentArea(value: unknown) {
  if (!isArea(value)) return '미확인'
  const sqm = value.toLocaleString('ko-KR', { maximumFractionDigits: 4 })
  const pyeong = (value * 0.3025).toLocaleString('ko-KR', { maximumFractionDigits: 2 })
  return `${sqm}㎡ (${pyeong}평)`
}

export function saleAreaComponentDisplay(component: GoodsSaleAreaComponent) {
  const numerator = component.share_numerator
  const denominator = component.share_denominator
  const validShare = isArea(numerator) && isArea(denominator)
    && numerator > 0 && denominator > 0 && numerator <= denominator
  const fraction = validShare
    ? `${numerator.toLocaleString('ko-KR', { maximumFractionDigits: 12 })}/${denominator.toLocaleString('ko-KR', { maximumFractionDigits: 12 })}`
    : '미확인'
  const flags = component.qualifiers ?? []
  const blockedArea = flags.some(flag => ['source_conflict', 'building_scope_unknown', 'share_unknown'].includes(flag))
  const saleArea = component.inclusion === 'excluded'
    ? '매각 제외'
    : component.inclusion !== 'included' || !validShare || blockedArea
      ? '미확인'
      : formatComponentArea(component.sale_area_sqm)
  const inclusion = component.inclusion === 'included'
    ? '포함'
    : component.inclusion === 'excluded' ? '제외' : '미확인'

  return {
    object: component.object_sequence == null ? '목록 미확인' : `목록 ${component.object_sequence}`,
    detail: component.detail_sequence == null || component.detail_sequence === ''
      ? null : `상세 ${component.detail_sequence}`,
    kind: kindLabels[component.area_kind ?? ''] ?? '구분 미확인',
    sourceArea: formatComponentArea(component.area_sqm),
    share: validShare && numerator === denominator ? `전체 (${fraction})` : fraction,
    saleArea,
    inclusion,
    notes: [...new Set(flags.flatMap(flag => qualifierNotes[flag] ? [qualifierNotes[flag]] : []))],
  }
}
