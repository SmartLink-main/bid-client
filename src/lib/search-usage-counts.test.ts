import { beforeEach, describe, expect, it, vi } from 'vitest'
import { searchGoods, type AuctionGoodsSearchItem } from './auction'
import { getSearchUsageKey, loadSearchUsageCounts } from './search-usage-counts'

vi.mock('./auction', () => ({ searchGoods: vi.fn() }))
const searchMock = vi.mocked(searchGoods)
const goods = (usage: string | null, id: number): AuctionGoodsSearchItem => ({
  schedule_id: `schedule-${id}`, auction_goods_id: id, goods_usage_name: usage,
})

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

  it('한 페이지에 모든 결과가 있으면 추가 요청 없이 복합 용도와 미등록을 정확히 센다', async () => {
    const items = [goods('아파트', 1), goods('상가,오피스텔,근린시설', 2), goods('아파트', 3), goods(null, 4), goods('  ', 5)]
    const result = await loadSearchUsageCounts({}, 'standard', new AbortController().signal, {
      key: '', params: { offset: 0 }, response: { total: 5, items },
    })
    expect(result).toEqual({ total: 5, missing: 2, items: [
      { value: '아파트', count: 2 }, { value: '상가,오피스텔,근린시설', count: 1 },
    ] })
    expect(searchMock).not.toHaveBeenCalled()
  })

  it('화면 밖의 모든 페이지도 최대 두 요청씩 읽어 전체 건수와 합계를 맞춘다', async () => {
    const items = Array.from({ length: 225 }, (_, index) => goods(index < 120 ? '아파트' : index < 200 ? '공장' : null, index))
    let active = 0
    let peak = 0
    searchMock.mockImplementation(async (params) => {
      active += 1
      peak = Math.max(peak, active)
      await Promise.resolve()
      active -= 1
      return { total: 225, items: items.slice(params.offset, (params.offset ?? 0) + 100) }
    })
    const controller = new AbortController()
    const result = await loadSearchUsageCounts({ court_code: 'TEST', half_price: true, goods_usage: ['아파트'], offset: 50 }, 'special', controller.signal)
    expect(result).toEqual({ total: 225, missing: 25, items: [{ value: '아파트', count: 120 }, { value: '공장', count: 80 }] })
    expect(peak).toBe(2)
    expect(searchMock.mock.calls.map(([params]) => params.offset).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([0, 100, 200])
    for (const [params, mode, init] of searchMock.mock.calls) {
      expect(params).toMatchObject({ court_code: 'TEST', half_price: true, limit: 100, goods_usage: undefined })
      expect(mode).toBe('special')
      expect(init?.signal).toBe(controller.signal)
    }
  })

  it('선택된 용도의 첫 응답을 전체 집계로 오인하지 않는다', async () => {
    searchMock.mockResolvedValue({ total: 2, items: [goods('아파트', 1), goods('공장', 2)] })
    const result = await loadSearchUsageCounts({}, 'standard', new AbortController().signal, {
      key: '', params: { goods_usage: ['아파트'] }, response: { total: 1, items: [goods('아파트', 1)] },
    })
    expect(result.total).toBe(2)
    expect(result.items).toHaveLength(2)
    expect(searchMock).toHaveBeenCalledOnce()
  })

  it.each(['changed-total', 'truncated-page', 'network-error'])('중간 페이지 오류(%s)를 부분 집계나 0건으로 반환하지 않는다', async (failure) => {
    searchMock.mockImplementation(async (params) => {
      if (params.offset === 0) return { total: 101, items: Array.from({ length: 100 }, (_, index) => goods('아파트', index)) }
      if (failure === 'network-error') throw new Error('Network unavailable')
      return { total: failure === 'changed-total' ? 102 : 101, items: [] }
    })
    await expect(loadSearchUsageCounts({}, 'standard', new AbortController().signal)).rejects.toThrow()
  })

  it('취소된 조건의 집계는 요청을 시작하지 않는다', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(loadSearchUsageCounts({}, 'standard', controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(searchMock).not.toHaveBeenCalled()
  })
})
