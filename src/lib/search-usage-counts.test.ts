import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from './api'
import { getSearchUsageKey, loadSearchUsageCounts } from './search-usage-counts'

vi.mock('./api', async importOriginal => ({
  ...await importOriginal<typeof import('./api')>(), apiRequest: vi.fn(),
}))
const requestMock = vi.mocked(apiRequest)

beforeEach(() => vi.resetAllMocks())

describe('검색 전체의 용도별 건수', () => {
  it('용도와 페이지가 달라도 같은 집계를 사용하고 법원·가격·검색모드는 구분한다', () => {
    const base = 'court_name=서울&max_lowest_sale_price=100000000&search_type=special&special_type=유치권'
    expect(getSearchUsageKey(`${base}&goods_usage=아파트&offset=50&limit=50&sort_by=lowest_desc`))
      .toBe(getSearchUsageKey(`${base}&goods_usage=상가&offset=0`))
    for (const changed of [base.replace('서울', '부산'), base.replace('100000000', '200000000'), base.replace('special&', 'comprehensive&')]) {
      expect(getSearchUsageKey(changed)).not.toBe(getSearchUsageKey(base))
    }
  })

  it('검색 범위와 특수조건을 한 번의 집계 요청에 전달하고 건수순으로 표시한다', async () => {
    const counts = { total: 225, missing: 25, items: [
      { value: '공장', count: 80 }, { value: '상가,오피스텔,근린시설', count: 60 }, { value: '아파트', count: 60 },
    ] }
    requestMock.mockResolvedValue({ ...counts, items: [...counts.items].reverse() })
    const controller = new AbortController()
    const result = await loadSearchUsageCounts({
      q: '도곡동', court_code: 'B000210', special_type: ['유치권', '법정지상권'], match_mode: 'all',
      goods_usage: ['아파트'], sort_by: 'lowest_desc', limit: 50, offset: 100,
    }, 'special', controller.signal)
    expect(result).toEqual(counts)
    expect(requestMock).toHaveBeenCalledOnce()
    const [path, init] = requestMock.mock.calls[0]
    const url = new URL(path, 'http://localhost')
    expect(url.pathname).toBe('/api/v1/search/usage-counts')
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      q: '도곡동', court_code: 'B000210', search_type: 'special', match_mode: 'all',
    })
    expect(url.searchParams.getAll('special_type')).toEqual(['유치권', '법정지상권'])
    expect(['goods_usage', 'sort_by', 'limit', 'offset'].some(key => url.searchParams.has(key))).toBe(false)
    expect(init?.signal).toBe(controller.signal)
  })

  it('집계 오류를 0건이나 전체 목록 조회로 바꾸지 않는다', async () => {
    requestMock.mockRejectedValue(new Error('Unavailable'))
    await expect(loadSearchUsageCounts({}, 'standard', new AbortController().signal)).rejects.toThrow('Unavailable')
    expect(requestMock).toHaveBeenCalledOnce()
  })

  it('취소된 조건의 집계는 요청을 시작하지 않는다', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(loadSearchUsageCounts({}, 'standard', controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(requestMock).not.toHaveBeenCalled()
  })
})
