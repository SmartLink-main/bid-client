import { describe, expect, it } from 'vitest'
import { goodsLocationLinks, goodsScheduleLabels } from './goods-detail-display'
import type { GoodsSummary } from './goods'

describe('저장된 물건 위치', () => {
  it('위도·경도 순서로 공식 지도와 로드뷰 링크를 만든다', () => {
    expect(goodsLocationLinks({ latitude: 37.48, longitude: 126.94 })).toEqual({
      map: 'https://map.kakao.com/link/map/37.48,126.94',
      roadview: 'https://map.kakao.com/link/roadview/37.48,126.94',
    })
  })
  it.each([null, undefined, { latitude: 306528, longitude: 542548 }, { latitude: NaN, longitude: 126.9 }, { latitude: 0, longitude: 0 }])('미확인·투영좌표·비정상 좌표로 링크를 만들지 않는다: %j', value => {
    expect(goodsLocationLinks(value)).toBeNull()
  })
})

describe('매각기일 조건의 시점', () => {
  it('과거 입찰 조건에는 당시라는 표시와 다음 기일 미확인 안내를 붙인다', () => {
    expect(goodsScheduleLabels({ sale_schedule_status: 'past' } as GoodsSummary)).toMatchObject({
      date: '최근 매각기일', price: '당시 최저매각가격', deposit: '당시 입찰보증금',
      notice: expect.stringContaining('다음 매각기일과 최저가는 아직 확인되지 않았습니다'),
    })
  })
  it('확인되지 않은 기일을 다음 입찰 조건으로 확정하지 않는다', () => {
    expect(goodsScheduleLabels({ sale_schedule_status: 'unconfirmed' } as GoodsSummary).notice).toContain('확인할 수 없습니다')
    expect(goodsScheduleLabels({ sale_schedule_status: 'upcoming' } as GoodsSummary).notice).toBeNull()
  })
})
