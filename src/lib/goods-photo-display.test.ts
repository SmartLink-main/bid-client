import { afterEach, describe, expect, it, vi } from 'vitest'
import { type GoodsDetailResponse, type GoodsPhoto, getGoodsPhotoUrl } from './goods'
import { getRepresentativeGoodsPhoto, orderGoodsPhotos } from './goods-photo-display'
import { getSearchResultPreview } from './search-result-preview'

function photo(sequence: number, code: string | null, overrides: Partial<GoodsPhoto> = {}): GoodsPhoto {
  return {
    photo_id: sequence, photo_sequence: sequence, photo_division_code: code,
    photo_title: null, content_url: `/api/v1/goods/1/photos/${sequence}`,
    content_type: 'image/jpeg', content_hash: null, file_size_bytes: null, collected_at: null,
    cdn_path: `/g/${sequence.toString(16).padStart(24, '0')}.jpg`,
    ...overrides,
  }
}

afterEach(() => vi.unstubAllEnvs())

describe('검색과 상세의 공통 대표사진 순서', () => {
  it('대표만 맨 앞으로 옮기고 다른 유형과 같은 유형의 남은 순서를 모두 보존한다', () => {
    // 같은 분류 전체를 정렬하면 4번 사진이 앞으로 이동하므로 허용하지 않는다.
    const photos = Object.freeze([
      photo(1, '000244'), photo(2, '000241'), photo(3, '000245'), photo(4, '000245'), photo(5, '000242'),
    ].map(item => Object.freeze(item)))
    const ordered = orderGoodsPhotos(photos, 1)
    expect(ordered.map(item => item.photo_sequence)).toEqual([3, 1, 2, 4, 5])
    expect(photos.map(item => item.photo_sequence)).toEqual([1, 2, 3, 4, 5])
    expect(ordered[0]).toBe(photos[2])
    expect(new Set(ordered).size).toBe(photos.length)
  })

  it.each([
    { name: '관련사진이 이미 첫 번째', codes: ['000245', '000241', '000245'], expected: [1, 2, 3] },
    { name: '관련사진이 없으면 전경도', codes: ['000244', '000242', '000241'], expected: [3, 1, 2] },
    { name: '전경도도 없으면 위치도', codes: ['000242', '000244', '000243'], expected: [2, 1, 3] },
    { name: '알려진 우선 유형이 없으면 첫 사진', codes: [null, '000242', '000243'], expected: [1, 2, 3] },
  ])('$name', ({ codes, expected }) => {
    expect(orderGoodsPhotos(codes.map((code, i) => photo(i + 1, code)), 1)
      .map(item => item.photo_id)).toEqual(expected)
  })

  it('유효한 후보만 대표로 선택하고 표시 불가 항목도 원본 순서에 남긴다', () => {
    vi.stubEnv('VITE_PHOTO_CDN_BASE_URL', 'https://photos.example.test')
    const photos = [
      photo(1, '000245', { content_url: '/api/v1/goods/99/photos/1' }),
      photo(2, '000245', { content_url: '/api/v1/goods/1/photos/../2' }),
      photo(3, '000245', { content_url: null }),
      photo(4, '000241'), photo(5, '000244'),
    ]
    expect(getRepresentativeGoodsPhoto(photos, 1)).toBe(photos[3])
    expect(orderGoodsPhotos(photos, 1).map(item => item.photo_id)).toEqual([4, 1, 2, 3, 5])
  })

  it.each(['', 'https://photos.example.test'])('목록과 상세 첫 사진은 같은 캐시 URL을 쓴다 (CDN: %s)', cdn => {
    vi.stubEnv('VITE_PHOTO_CDN_BASE_URL', cdn)
    const photos = [photo(1, '000241'), photo(2, '000244'), photo(3, '000245')]
    const detail = { photos: { items: photos } } as GoodsDetailResponse
    const first = orderGoodsPhotos(photos, 1)[0]
    expect(first).toBe(photos[2])
    expect(getSearchResultPreview(detail, 1).photoUrl)
      .toBe(getGoodsPhotoUrl(first.content_url, first.cdn_path))
  })

  it('사진이 없거나 유효한 후보가 없으면 순서를 유지한다', () => {
    expect(getRepresentativeGoodsPhoto([], 1)).toBeUndefined()
    expect(orderGoodsPhotos([], 1)).toEqual([])
    const photos = [photo(1, '000245', { content_url: null }), photo(2, '000241', { content_url: null })]
    expect(getRepresentativeGoodsPhoto(photos, 1)).toBeUndefined()
    expect(orderGoodsPhotos(photos, 1)).toEqual(photos)
  })
})
