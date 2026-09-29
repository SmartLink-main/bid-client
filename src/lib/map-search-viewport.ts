import type { GeographicBounds, GeographicMapClusterLevel } from './auction-extra'

// 국내 경매 검색 API가 지원하는 범위. 축소 시 화면 밖 세계 영역은 조회하지 않는다.
const MAP_SEARCH_ENVELOPE: GeographicBounds = { west: 120, south: 30, east: 140, north: 45 }
// 세로 약 167km(위도 1.5도): 도 하나를 담는 정도의 화면부터 시도 단위로 묶는다.
const PROVINCE_MIN_LATITUDE_SPAN = 1.5
const DISTRICT_MAX_ZOOM = 11

export function getMapClusterLevel(viewport: GeographicBounds, zoom: number): GeographicMapClusterLevel | undefined {
  if (viewport.north - viewport.south >= PROVINCE_MIN_LATITUDE_SPAN) return 'sido'
  return zoom <= DISTRICT_MAX_ZOOM ? 'sigungu' : undefined
}

export function getMapSearchBounds(viewport: GeographicBounds): GeographicBounds | null {
  const bounds = {
    west: Math.max(viewport.west, MAP_SEARCH_ENVELOPE.west),
    south: Math.max(viewport.south, MAP_SEARCH_ENVELOPE.south),
    east: Math.min(viewport.east, MAP_SEARCH_ENVELOPE.east),
    north: Math.min(viewport.north, MAP_SEARCH_ENVELOPE.north),
  }
  return bounds.west < bounds.east && bounds.south < bounds.north ? bounds : null
}
