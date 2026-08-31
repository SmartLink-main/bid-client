import { getDongOptions } from './dong-filter-options'
import { DONG_VIEWPORT_ENTRIES } from './dong-viewports'
import {
  PROVINCE_SEARCH_TERMS,
  REGION_PROVINCES,
  SIGUNGU_BY_PROVINCE,
} from './search-filter-options'
import type { ReverseGeographicRegion } from './auction-extra'

export type MapRegionSelection = {
  province: string
  sigungu: string
  dong: string
}

const selectionByLegalDongCode = new Map<string, MapRegionSelection>()

for (const [selectionKey, entry] of Object.entries(DONG_VIEWPORT_ENTRIES)) {
  const [province, sigungu, dong] = selectionKey.split('|')
  if (
    !REGION_PROVINCES.includes(province) ||
    !SIGUNGU_BY_PROVINCE[province]?.includes(sigungu) ||
    !getDongOptions(province, sigungu).includes(dong)
  ) {
    continue
  }
  for (const code of entry.legalDongCodes) {
    selectionByLegalDongCode.set(code, { province, sigungu, dong })
  }
}

export function getMapRegionSelection(
  legalDongCode: string,
): MapRegionSelection | null {
  const normalizedCode = legalDongCode.trim()
  if (!/^(?:\d{8}|\d{10})$/.test(normalizedCode)) return null
  return selectionByLegalDongCode.get(normalizedCode.slice(0, 8)) ?? null
}

export function getMapRegionSelectionFromRegion(
  region: ReverseGeographicRegion,
): MapRegionSelection | null {
  const codeSelection = region.legal_dong_code
    ? getMapRegionSelection(region.legal_dong_code)
    : null
  if (codeSelection) return codeSelection

  const province = REGION_PROVINCES.find((candidate) => (
    candidate === region.province ||
    PROVINCE_SEARCH_TERMS[candidate] === region.province
  ))
  if (!province) return null

  const sigungu = (SIGUNGU_BY_PROVINCE[province] ?? [])
    .slice()
    .sort((left, right) => right.length - left.length)
    .find((candidate) => (
      candidate === region.sigungu ||
      region.sigungu.startsWith(`${candidate} `)
    )) ?? ''
  if (!sigungu) return { province, sigungu: '', dong: '' }

  const dongOptions = getDongOptions(province, sigungu)
  const exactDong = dongOptions.find((candidate) => candidate === region.dong)
  if (exactDong) return { province, sigungu, dong: exactDong }

  const dividedAdministrativeDong = region.dong.match(/^(.+?)\d+동$/)?.[1]
  const legalDong = dividedAdministrativeDong
    ? `${dividedAdministrativeDong}동`
    : ''
  return {
    province,
    sigungu,
    dong: legalDong && dongOptions.includes(legalDong) ? legalDong : '',
  }
}
