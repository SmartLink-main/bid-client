import { describe, expect, it } from 'vitest'

import {
  DONG_BY_REGION,
  DONG_FILTER_OPTIONS_METADATA,
  getDongOptions,
} from './dong-filter-options'
import {
  REGION_PROVINCES,
  SIGUNGU_BY_PROVINCE,
} from './search-filter-options'

describe('map search legal dong filter options', () => {
  it('covers every frontend province and sigungu selection without ri entries', () => {
    const expectedKeys = REGION_PROVINCES.flatMap((province) =>
      SIGUNGU_BY_PROVINCE[province].map(
        (sigungu) => `${province}|${sigungu}`,
      ),
    )

    expect(Object.keys(DONG_BY_REGION)).toEqual(expectedKeys)
    expect(DONG_FILTER_OPTIONS_METADATA).toMatchObject({
      snapshotDate: '2026-08-25',
      sourceStatus: '존재',
      sourceCurrentEmdCount: 5067,
      mappedRegionCount: expectedKeys.length,
    })
    expect(Object.values(DONG_BY_REGION).flat()).toHaveLength(5057)

    for (const key of expectedKeys) {
      const names = DONG_BY_REGION[key]
      expect(names.length, `${key} has no legal dong options`).toBeGreaterThan(0)
      expect(new Set(names).size, `${key} contains duplicate names`).toBe(
        names.length,
      )
      expect(names.some((name) => name.trim().length === 0), key).toBe(false)
      expect(names.some((name) => name.endsWith('리')), key).toBe(false)
    }
  })

  it('includes Pohang Buk-gu Jukdo-dong and keeps legacy Incheon choices usable', () => {
    expect(getDongOptions('경북', '포항시 북구')).toContain('죽도동')
    expect(getDongOptions('인천', '중구')).toContain('운서동')
    expect(getDongOptions('인천', '동구')).toContain('만석동')
    expect(getDongOptions('인천', '서구')).toContain('청라동')
    expect(getDongOptions('경기', '여주시')).toContain('대신면')
    expect(getDongOptions('없는 지역', '없는 시군구')).toEqual([])
  })
})
