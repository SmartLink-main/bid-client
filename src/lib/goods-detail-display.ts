import type { GoodsDetailResponse, GoodsSummary } from './goods'

/** 기존 저장 좌표만으로 링크를 만들며 지오코딩이나 지도 이미지를 요청하지 않는다. */
export function goodsLocationLinks(location: GoodsDetailResponse['location']) {
  if (!location || !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude) ||
    location.latitude < 32 || location.latitude > 39.5 || location.longitude < 124 || location.longitude > 132) return null
  const coordinates = `${location.latitude},${location.longitude}`
  return {
    map: `https://map.kakao.com/link/map/${coordinates}`,
    roadview: `https://map.kakao.com/link/roadview/${coordinates}`,
  }
}

/** 과거 기일 금액을 현재 입찰 조건으로 오해하지 않게 표시한다. */
export function goodsScheduleLabels(summary: GoodsSummary) {
  const past = summary.sale_schedule_status === 'past'
  return {
    date: past ? '최근 매각기일' : '다음 매각기일',
    price: past ? '당시 최저매각가격' : '최저매각가격',
    deposit: past ? '당시 입찰보증금' : '입찰보증금',
    notice: past
      ? '과거 매각기일의 조건입니다. 다음 매각기일과 최저가는 아직 확인되지 않았습니다.'
      : summary.sale_schedule_status === 'unconfirmed'
        ? '다음 매각기일과 입찰 조건을 확인할 수 없습니다.'
        : null,
  }
}
