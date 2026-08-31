import { describe, expect, it } from 'vitest'

import { DONG_BY_REGION } from './dong-filter-options'
import {
  DONG_VIEWPORT_ENTRIES,
  DONG_VIEWPORT_SOURCE,
  DONG_VIEWPORTS,
  getDongViewport,
} from '../../../bid-client/src/lib/dong-viewports'
import { getRegionViewport } from '../../../bid-client/src/lib/region-viewports'

const catalogKeys = Object.entries(DONG_BY_REGION).flatMap(
  ([regionKey, dongNames]) => dongNames.map((dong) => `${regionKey}|${dong}`),
)

describe('map search dong viewports', () => {
  it('maps every selectable legal dong to one official VWorld viewport', () => {
    expect(DONG_VIEWPORT_SOURCE).toMatchObject({
      provider: '국토교통부 VWorld',
      layer: 'LT_C_ADEMD_INFO',
      snapshotDate: '2026-08-25',
      coordinateSystem: 'EPSG:4326',
      license: '공공누리 제1유형 (출처표시)',
      sourceFeatureCount: 5067,
      sourceCurrentEmdCount: 5067,
      mappedViewportCount: 5057,
      unionedViewportCount: 10,
      missingCodeCount: 0,
      extraCodeCount: 0,
      coverageStrategy: 'official-legal-dong-code-join',
    })

    const viewportKeys = Object.keys(DONG_VIEWPORT_ENTRIES)
    expect([...viewportKeys].sort()).toEqual([...catalogKeys].sort())
    expect(Object.keys(DONG_VIEWPORTS)).toEqual(viewportKeys)
    expect(viewportKeys).toHaveLength(DONG_VIEWPORT_SOURCE.mappedViewportCount)

    const coveredCodes = new Set<string>()
    let coveredCodeReferences = 0
    for (const [key, entry] of Object.entries(DONG_VIEWPORT_ENTRIES)) {
      const [province, sigungu] = key.split('|')
      const parent = getRegionViewport(province, sigungu)
      const coordinates = [entry.west, entry.south, entry.east, entry.north]

      expect(coordinates.every(Number.isFinite), key).toBe(true)
      expect(entry.west, key).toBeGreaterThanOrEqual(124)
      expect(entry.east, key).toBeLessThanOrEqual(132)
      expect(entry.south, key).toBeGreaterThanOrEqual(33)
      expect(entry.north, key).toBeLessThanOrEqual(39)
      expect(entry.west, key).toBeLessThan(entry.east)
      expect(entry.south, key).toBeLessThan(entry.north)
      expect(entry, `${key} must not reuse its parent bounds`).not.toMatchObject(
        parent,
      )
      expect(entry.legalDongCodes.length, key).toBeGreaterThan(0)
      for (const code of entry.legalDongCodes) {
        coveredCodeReferences += 1
        expect(code, key).toMatch(/^\d{8}$/)
        coveredCodes.add(code)
      }
    }
    expect(coveredCodeReferences).toBe(DONG_VIEWPORT_SOURCE.sourceFeatureCount)
    expect(coveredCodes.size).toBe(DONG_VIEWPORT_SOURCE.sourceFeatureCount)
  })

  it('keeps all nine Dongnae-gu legal dongs distinct and tightly bounded', () => {
    const dongNames = DONG_BY_REGION['부산|동래구']
    expect(dongNames).toEqual([
      '낙민동',
      '명륜동',
      '명장동',
      '복천동',
      '사직동',
      '수안동',
      '안락동',
      '온천동',
      '칠산동',
    ])

    const parent = getRegionViewport('부산', '동래구')
    const parentArea = (parent.east - parent.west) * (parent.north - parent.south)
    const signatures = new Set<string>()
    for (const dong of dongNames) {
      const bounds = getDongViewport('부산', '동래구', dong)
      expect(bounds, dong).not.toBeNull()
      const area = (bounds!.east - bounds!.west) * (bounds!.north - bounds!.south)
      expect(area, dong).toBeLessThan(parentArea * 0.55)
      signatures.add(
        [bounds!.west, bounds!.south, bounds!.east, bounds!.north].join('|'),
      )
    }
    expect(signatures.size).toBe(dongNames.length)

    expect(getDongViewport('부산', '동래구', '온천동')).toEqual({
      west: 129.05079982916436,
      south: 35.20044133328316,
      east: 129.08725917963125,
      north: 35.22627321534536,
    })
    expect(getDongViewport('부산', '동래구', '복천동')).toEqual({
      west: 129.08330485241459,
      south: 35.20326108187168,
      east: 129.0926116049688,
      north: 35.21057633023696,
    })
  })

  it('returns null only for values outside the selectable catalog', () => {
    expect(getDongViewport('없는 지역', '없는 시군구', '없는 동')).toBeNull()
    expect(getDongViewport('', '', '')).toBeNull()
  })
})
