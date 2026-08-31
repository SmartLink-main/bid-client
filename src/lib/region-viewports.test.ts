import { describe, expect, it } from 'vitest'

import {
  PROVINCE_SEARCH_TERMS,
  REGION_PROVINCES,
  SIGUNGU_BY_PROVINCE,
} from './search-filter-options'
import {
  getRegionViewport,
  REGION_VIEWPORTS,
} from './region-viewports'

describe('map search region viewports', () => {
  it('covers every province and sigungu selection with valid Korean bounds', () => {
    const expectedKeys = REGION_PROVINCES.flatMap((province) => [
      province,
      ...SIGUNGU_BY_PROVINCE[province].map((sigungu) => `${province}|${sigungu}`),
    ])

    expect(Object.keys(PROVINCE_SEARCH_TERMS)).toEqual(REGION_PROVINCES)
    expect(Object.keys(REGION_VIEWPORTS)).toHaveLength(expectedKeys.length)

    for (const key of expectedKeys) {
      const bounds = REGION_VIEWPORTS[key]
      expect(bounds, `${key} viewport is missing`).toBeDefined()
      expect(bounds.west, key).toBeGreaterThanOrEqual(122)
      expect(bounds.east, key).toBeLessThanOrEqual(133)
      expect(bounds.south, key).toBeGreaterThanOrEqual(32)
      expect(bounds.north, key).toBeLessThanOrEqual(40)
      expect(bounds.west, key).toBeLessThan(bounds.east)
      expect(bounds.south, key).toBeLessThan(bounds.north)

      const [province, sigungu] = key.split('|')
      if (sigungu) {
        const parent = REGION_VIEWPORTS[province]
        expect(bounds.west, `${key} exceeds ${province} west`).toBeGreaterThanOrEqual(
          parent.west,
        )
        expect(bounds.south, `${key} exceeds ${province} south`).toBeGreaterThanOrEqual(
          parent.south,
        )
        expect(bounds.east, `${key} exceeds ${province} east`).toBeLessThanOrEqual(
          parent.east,
        )
        expect(bounds.north, `${key} exceeds ${province} north`).toBeLessThanOrEqual(
          parent.north,
        )
      }
    }
  })

  it('keeps duplicate district names scoped to their province', () => {
    expect(getRegionViewport('경북', '포항시 북구')).toEqual({
      west: 128.991849,
      south: 36.0140639,
      east: 129.505072,
      north: 36.3336305,
    })
    expect(getRegionViewport('부산', '북구')).not.toEqual(
      getRegionViewport('대구', '북구'),
    )
    expect(getRegionViewport('인천', '동구')).toEqual({
      west: 126.586181040542,
      south: 37.4683889828295,
      east: 126.674430577533,
      north: 37.4986669896015,
    })
    expect(getRegionViewport('인천', '서구')).not.toEqual(
      getRegionViewport('대전', '서구'),
    )
    expect(getRegionViewport('인천', '중구')).not.toEqual(
      getRegionViewport('서울', '중구'),
    )
  })
})
