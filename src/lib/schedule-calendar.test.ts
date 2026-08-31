import { describe, expect, it } from 'vitest'
import {
  buildMonthCalendar,
  formatKoreanMonth,
  getMonthBounds,
  normalizeMonthKey,
  shiftMonth,
} from './schedule-calendar'

describe('schedule calendar month helpers', () => {
  it('윤년을 포함한 월의 시작일과 말일을 계산한다', () => {
    expect(getMonthBounds('2028-02')).toEqual({
      startDate: '2028-02-01',
      endDate: '2028-02-29',
    })
    expect(getMonthBounds('2027-02').endDate).toBe('2027-02-28')
  })

  it('연도 경계를 넘어 이전 달과 다음 달로 이동한다', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(formatKoreanMonth('2026-08')).toBe('2026년 8월')
  })

  it('잘못된 월은 전달한 기본 월로 정규화한다', () => {
    expect(normalizeMonthKey('2026-13', '2026-08')).toBe('2026-08')
    expect(normalizeMonthKey(null, '2026-08')).toBe('2026-08')
  })

  it('일요일부터 토요일까지 완전한 주 단위로 달력을 만든다', () => {
    const days = buildMonthCalendar('2026-08')

    expect(days).toHaveLength(42)
    expect(days[0]).toMatchObject({ date: '2026-07-26', weekday: 0, isCurrentMonth: false })
    expect(days.at(-1)).toMatchObject({ date: '2026-09-05', weekday: 6, isCurrentMonth: false })
    expect(days.filter((day) => day.isCurrentMonth)).toHaveLength(31)
  })
})
