import { describe, expect, it } from 'vitest'
import { getMapClusterLevel, getMapSearchBounds } from './map-search-viewport'

describe('화면 세로 범위별 지도 묶음', () => {
  it('도 하나를 담는 세로 범위부터 시도 단위로 묶는다', () => {
    expect(getMapClusterLevel({ west: 126, south: 35, east: 130, north: 36.5 }, 9)).toBe('sido')
    expect(getMapClusterLevel({ west: 126, south: 33, east: 130, north: 39 }, 8)).toBe('sido')
  })

  it('같은 줌에서도 화면 세로 범위에 맞춰 시군구와 시도를 나눈다', () => {
    expect(getMapClusterLevel({ west: 126, south: 35, east: 130, north: 36.49 }, 9)).toBe('sigungu')
    expect(getMapClusterLevel({ west: 126, south: 35, east: 130, north: 37 }, 9)).toBe('sido')
  })

  it('좁은 화면을 더 확대하면 개별 핀으로 전환한다', () => {
    const bounds = { west: 127, south: 35, east: 128, north: 35.3 }
    expect(getMapClusterLevel(bounds, 11)).toBe('sigungu')
    expect(getMapClusterLevel(bounds, 11.1)).toBeUndefined()
  })
})

describe('국내 지도 검색 범위', () => {
  it('국내 확대 화면의 정확한 경계를 그대로 사용한다', () => {
    const viewport = { west: 126.93, south: 37.48, east: 127.13, north: 37.63 }
    expect(getMapSearchBounds(viewport)).toEqual(viewport)
  })

  it('전국보다 축소한 화면은 지원 범위와의 교집합만 조회한다', () => {
    expect(getMapSearchBounds({ west: 110, south: 20, east: 150, north: 55 })).toEqual({
      west: 120, south: 30, east: 140, north: 45,
    })
    expect(getMapSearchBounds({ west: 118, south: 33, east: 129, north: 47 })).toEqual({
      west: 120, south: 33, east: 129, north: 45,
    })
  })

  it('지원 영역 밖이나 경계만 맞닿는 화면은 조회하지 않는다', () => {
    expect(getMapSearchBounds({ west: 100, south: 30, east: 120, north: 45 })).toBeNull()
    expect(getMapSearchBounds({ west: 120, south: 46, east: 140, north: 50 })).toBeNull()
  })
})
