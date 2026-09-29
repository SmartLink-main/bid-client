import { describe, expect, it } from 'vitest'
import type { GoodsDetailResponse, GoodsPhoto } from './goods'
import { getSearchResultPreview } from './search-result-preview'

function detailWithPhotos(urls: Array<string | null>, codes: Array<string | null> = []) {
  return {
    case_display_number: '2025타경123',
    photos: { available: true, items: urls.map((content_url, index) => ({ content_url, photo_division_code: codes[index] ?? null } as GoodsPhoto)) },
  } as GoodsDetailResponse
}

describe('검색 결과 대표 정보', () => {
  it.each([
    { name: '관련사진 우선 및 동일 유형의 원래 순서 유지', codes: ['000244', '000241', '000245', '000245'], selected: 3 },
    { name: '관련사진이 없으면 전경도', codes: ['000244', '000242', '000241'], selected: 3 },
    { name: '관련사진과 전경도가 없으면 위치도', codes: ['000242', '000244'], selected: 2 },
    { name: '우선 유형이 없으면 기존 첫 사진', codes: ['000242', null], selected: 1 },
  ])('$name', ({ codes, selected }) => {
    const detail = detailWithPhotos(codes.map((_, index) => `/api/v1/goods/1/photos/${index + 1}`), codes)
    const original = structuredClone(detail.photos.items)
    expect(getSearchResultPreview(detail, 1).photoUrl).toMatch(new RegExp(`/photos/${selected}$`))
    expect(detail.photos.items).toEqual(original)
  })

  it('상위 유형 사진의 URL이 잘못되면 다음 유형의 유효한 사진을 사용한다', () => {
    const detail = detailWithPhotos([
      '/api/v1/goods/2/photos/1', null, '/api/v1/goods/1/photos/3', '/api/v1/goods/1/photos/4',
    ], ['000245', '000245', '000244', '000241'])
    expect(getSearchResultPreview(detail, 1).photoUrl).toMatch(/\/photos\/4$/)
  })

  it('같은 물건의 표시 가능한 첫 사진 한 장을 고른다', () => {
    const preview = getSearchResultPreview(detailWithPhotos([
      null, '/api/v1/goods/99/photos/1', 'https://outside.example/photo.jpg',
      '/api/v1/goods/1/photos/2', '/api/v1/goods/1/photos/3',
    ]), 1)
    expect(preview.photoUrl).toMatch(/\/api\/v1\/goods\/1\/photos\/2$/)
    expect(preview.caseNumber).toBe('2025타경123')
  })

  it('사진이 없으면 다른 물건이나 외부 URL로 대신하지 않는다', () => {
    expect(getSearchResultPreview(detailWithPhotos([
      '/api/v1/goods/2/photos/1', '/api/v1/goods/1/photos/../2', 'data:image/png;base64,test',
    ]), 1).photoUrl).toBeNull()
    expect(getSearchResultPreview(detailWithPhotos([]), 1).photoUrl).toBeNull()
  })

  it('기존 응답에 사진 정보가 없더라도 사건번호는 표시한다', () => {
    const preview = getSearchResultPreview({ case_display_number: '2024타경10' } as GoodsDetailResponse, 1)
    expect(preview).toEqual({ caseNumber: '2024타경10', photoUrl: null })
  })

  it('사건번호의 빈 표시 대신 상세 사건번호를 사용하고 없는 번호는 만들지 않는다', () => {
    const detail = detailWithPhotos([])
    detail.case_display_number = '-'
    detail.case = { case_display_number: ' 2023타경9 ' } as GoodsDetailResponse['case']
    expect(getSearchResultPreview(detail, 1).caseNumber).toBe('2023타경9')
    detail.case.case_display_number = ' '
    expect(getSearchResultPreview(detail, 1).caseNumber).toBeNull()
  })
})
