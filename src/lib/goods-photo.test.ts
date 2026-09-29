import { afterEach, describe, expect, it, vi } from 'vitest'
import { getGoodsPhotoUrl, type GoodsDetailResponse } from './goods'
import { getSearchResultPreview } from './search-result-preview'

const path = '/g/' + 'a'.repeat(24) + '.jpg'
const proxy = '/api/v1/goods/1/photos/1'
afterEach(() => vi.unstubAllEnvs())

describe('사진 비용을 줄이는 CDN URL', () => {
  it('CDN이 없으면 기존 proxy를 유지한다', () => {
    vi.stubEnv('VITE_PHOTO_CDN_BASE_URL', '')
    expect(getGoodsPhotoUrl(proxy, path)).toMatch(/\/api\/v1\/goods\/1\/photos\/1$/)
  })
  it('목록과 상세가 동일한 CDN 캐시 URL을 쓴다', () => {
    vi.stubEnv('VITE_PHOTO_CDN_BASE_URL', 'https://photos.example.test')
    const detail = { photos: { items: [{ content_url: proxy, cdn_path: path }] } } as GoodsDetailResponse
    expect(getGoodsPhotoUrl(proxy, path)).toBe('https://photos.example.test' + path)
    expect(getSearchResultPreview(detail, 1).photoUrl).toBe(getGoodsPhotoUrl(proxy, path))
  })
  it.each(['//outside.test/x', '/g/../raw/key', path + '?retry=1', path + '\n', '/g/' + 'a'.repeat(24) + '.svg'])('임의 CDN 경로는 허용하지 않는다: %s', invalid => {
    vi.stubEnv('VITE_PHOTO_CDN_BASE_URL', 'https://photos.example.test')
    expect(getGoodsPhotoUrl(proxy, invalid)).toMatch(/\/photos\/1$/)
  })
  it.each(['https://name:pass@photos.example.test', 'https://photos.example.test/path', 'http://remote.example.test', 'javascript:alert(1)'])('잘못된 CDN origin은 사용하지 않는다: %s', origin => {
    vi.stubEnv('VITE_PHOTO_CDN_BASE_URL', origin)
    expect(getGoodsPhotoUrl(proxy, path)).toMatch(/\/photos\/1$/)
  })
})
