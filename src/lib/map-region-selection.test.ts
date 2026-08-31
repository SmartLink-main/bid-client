import { describe, expect, it } from 'vitest'

import {
  getMapRegionSelection,
  getMapRegionSelectionFromRegion,
} from './map-region-selection'

describe('map region legal-dong code selection', () => {
  it('maps Kakao 10-digit legal-dong codes to the selectable region hierarchy', () => {
    expect(getMapRegionSelection('1168010100')).toEqual({
      province: '서울',
      sigungu: '강남구',
      dong: '역삼동',
    })
    expect(getMapRegionSelection('2626010700')).toEqual({
      province: '부산',
      sigungu: '동래구',
      dong: '명륜동',
    })
  })

  it('maps every official code merged into a compatible selection', () => {
    expect(getMapRegionSelection('4159510300')).toEqual({
      province: '경기',
      sigungu: '화성시',
      dong: '능동',
    })
    expect(getMapRegionSelection('4159710100')).toEqual({
      province: '경기',
      sigungu: '화성시',
      dong: '능동',
    })
  })

  it('rejects malformed and unknown codes instead of guessing by bounding boxes', () => {
    expect(getMapRegionSelection('')).toBeNull()
    expect(getMapRegionSelection('11680')).toBeNull()
    expect(getMapRegionSelection('abcdefgh')).toBeNull()
    expect(getMapRegionSelection('9999999900')).toBeNull()
  })

  it('uses only catalog-backed names when a code provider is unavailable', () => {
    expect(getMapRegionSelectionFromRegion({
      legal_dong_code: null,
      province: '서울특별시',
      sigungu: '강남구',
      dong: '역삼1동',
    })).toEqual({ province: '서울', sigungu: '강남구', dong: '역삼동' })

    expect(getMapRegionSelectionFromRegion({
      legal_dong_code: null,
      province: '경기도',
      sigungu: '수원시 팔달구',
      dong: '행궁동',
    })).toEqual({ province: '경기', sigungu: '수원시', dong: '' })
  })
})
