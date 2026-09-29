import { describe, expect, it } from 'vitest'

import type { GoodsSaleAreaComponent } from './goods'
import { saleAreaComponentDisplay } from './goods-sale-area-display'

const component = (overrides: Partial<GoodsSaleAreaComponent> = {}): GoodsSaleAreaComponent => ({
  component_key: 'land:1',
  object_sequence: 1,
  detail_sequence: null,
  area_kind: 'land_parcel',
  area_sqm: 100,
  share_numerator: 1,
  share_denominator: 2,
  sale_area_sqm: 50,
  inclusion: 'included',
  qualifiers: [],
  ...overrides,
})

describe('목록별 면적·지분 표시', () => {
  it('공부면적과 서버가 계산한 매각면적을 구분하며 지분을 중복 적용하지 않는다', () => {
    expect(saleAreaComponentDisplay(component({ detail_sequence: '2' }))).toMatchObject({
      object: '목록 1', detail: '상세 2', kind: '토지 필지',
      sourceArea: '100㎡ (30.25평)', share: '1/2', saleArea: '50㎡ (15.13평)', inclusion: '포함',
    })
    expect(saleAreaComponentDisplay(component({ share_denominator: 1 })).share).toBe('전체 (1/1)')
  })

  it('제외 행의 공부면적은 보존하고 후보 매각면적은 매각 제외로 표시한다', () => {
    expect(saleAreaComponentDisplay(component({ inclusion: 'excluded' }))).toMatchObject({
      sourceArea: '100㎡ (30.25평)', saleArea: '매각 제외', inclusion: '제외',
    })
  })

  it('포함 여부 미확인의 후보 면적을 확정 매각면적으로 표시하지 않는다', () => {
    expect(saleAreaComponentDisplay(component({ inclusion: 'unknown' }))).toMatchObject({
      sourceArea: '100㎡ (30.25평)', saleArea: '미확인', inclusion: '미확인',
    })
  })

  it('누락·잘못된 지분을 전체 지분으로 추정하지 않는다', () => {
    for (const [share_numerator, share_denominator] of [
      [null, null], [1, null], [null, 2], [1, 0], [0, 1], [-1, 2], [3, 2], [NaN, 2], [1, Infinity],
    ]) {
      expect(saleAreaComponentDisplay(component({ share_numerator, share_denominator }))).toMatchObject({
        share: '미확인', saleArea: '미확인',
      })
    }
  })

  it('면적 원문 충돌과 미확인 범위는 숫자가 있어도 확인이 필요한 상태로 보존한다', () => {
    for (const flag of ['source_conflict', 'building_scope_unknown', 'share_unknown']) {
      expect(saleAreaComponentDisplay(component({ qualifiers: [flag] })).saleArea).toBe('미확인')
    }
    expect(saleAreaComponentDisplay(component({ qualifiers: ['source_conflict'] })).notes)
      .toEqual(['원문 간 면적이 달라 확인 필요'])
  })

  it('누락·잘못된 면적을 0평으로 만들지 않으며 실제 0은 보존한다', () => {
    for (const area of [null, -1, NaN, Infinity]) {
      expect(saleAreaComponentDisplay(component({ area_sqm: area, sale_area_sqm: area }))).toMatchObject({
        sourceArea: '미확인', saleArea: '미확인',
      })
    }
    expect(saleAreaComponentDisplay(component({ area_sqm: 0, sale_area_sqm: 0 }))).toMatchObject({
      sourceArea: '0㎡ (0평)', saleArea: '0㎡ (0평)',
    })
  })

  it('목록과 구분의 누락을 밝히고 알려지지 않은 내부 키와 코드를 노출하지 않는다', () => {
    const row = saleAreaComponentDisplay(component({
      object_sequence: null, detail_sequence: '', area_kind: 'future_kind',
      qualifiers: ['covered_by_land_parcel', 'covered_by_land_parcel', 'internal_new_code'],
    }))
    expect(row).toMatchObject({ object: '목록 미확인', detail: null, kind: '구분 미확인' })
    expect(row.notes).toEqual(['토지 합계에 이미 반영되어 중복 합산하지 않음'])
    expect(JSON.stringify(row)).not.toMatch(/future_kind|internal_new_code|land:1/)
  })
})
