import { describe, expect, it } from 'vitest'

import { formatAmountInput, formatAreaPyeong, formatAuctionCountdown, formatMoney, formatMonthDay, formatNumber, getKoreanDateKey, optionalAmount } from './format'

describe('평 단위 면적 표시', () => {
  it('소수 둘째 자리까지 표시하고 누락·잘못된 면적은 0평으로 만들지 않는다', () => {
    expect(formatAreaPyeong(1234.567)).toBe('1,234.57평')
    expect(formatAreaPyeong(25)).toBe('25평')
    expect(formatAreaPyeong(0)).toBe('0평')
    for (const value of [null, undefined, '', -1, NaN, Infinity]) {
      expect(formatAreaPyeong(value)).toBe('-')
    }
  })
})

describe('입찰까지 남은 일수', () => {
  it('한국 자정 전후를 기준으로 오늘 날짜를 계산한다', () => {
    expect(getKoreanDateKey(new Date('2026-09-14T14:59:59Z'))).toBe('2026-09-14')
    expect(getKoreanDateKey(new Date('2026-09-14T15:00:00Z'))).toBe('2026-09-15')
  })

  it('미래·당일·과거와 연도·윤년 경계를 달력 일수로 표시한다', () => {
    for (const [target, today, expected] of [
      ['2026-09-17', '2026-09-14', '입찰 3일 전'],
      ['2026-09-14', '2026-09-14', '입찰 당일'],
      ['2026-09-12', '2026-09-14', '입찰 2일 경과'],
      ['2027-01-01', '2026-12-31', '입찰 1일 전'],
      ['2028-03-01', '2028-02-28', '입찰 2일 전'],
    ]) expect(formatAuctionCountdown(target, today)).toBe(expected)
  })

  it('날짜 누락과 잘못된 날짜에는 남은 일수를 만들지 않는다', () => {
    for (const value of [null, undefined, '', 'invalid', '2026-02-29']) {
      expect(formatAuctionCountdown(value, '2026-09-14')).toBe('기일 미정')
    }
  })
})

describe('월·일 표시', () => {
  it('연도와 앞자리 0을 제외하고 날짜가 없거나 잘못되면 빈 표시를 사용한다', () => {
    for (const [value, expected] of [
      ['2026-09-14', '9월 14일'], ['2027-01-01', '1월 1일'],
      ['2026-12-31', '12월 31일'], ['2028-02-29', '2월 29일'],
      ['2026-02-29', '-'], ['2026-04-31', '-'], ['2026-13-01', '-'],
      ['2026-00-01', '-'], ['2026-09-00', '-'], ['invalid', '-'], ['', '-'], [null, '-'], [undefined, '-'],
    ]) expect(formatMonthDay(value)).toBe(expected)
  })
})

describe('공통 가격 입력과 숫자 표시', () => {
  it('가격의 빈값·쉼표·0·안전 정수 경계를 유지한다', () => {
    const cases: Array<[string, number | undefined]> = [
      ['', undefined],
      ['  ', undefined],
      ['0', 0],
      ['000', 0],
      ['1,000', 1_000],
      [' 1,000 ', 1_000],
      ['9,007,199,254,740,991', Number.MAX_SAFE_INTEGER],
      ['9,007,199,254,740,992', Number.NaN],
      ['-1', Number.NaN],
      ['1.5', Number.NaN],
      ['가격', Number.NaN],
      ['Infinity', Number.NaN],
    ]

    for (const [value, expected] of cases) {
      expect(optionalAmount(value), value).toBe(expected)
    }
  })

  it('가격 타이핑은 쉼표와 앞자리 0을 정리하고 잘못된 입력은 이전 값으로 유지한다', () => {
    const cases: Array<[string, string]> = [
      ['', ''],
      ['0', '0'],
      ['0000', '0'],
      ['001234', '1,234'],
      ['1,234,567', '1,234,567'],
      ['9,007,199,254,740,992', '9,007,199,254,740,992'],
      ['1a', '12,000'],
      ['-1', '12,000'],
      ['1.5', '12,000'],
      [' ', '12,000'],
    ]

    for (const [value, expected] of cases) {
      expect(formatAmountInput(value, '12,000'), value).toBe(expected)
    }
  })

  it('금액과 일반 숫자의 기존 값 검사·단위·지역별 표시를 동일하게 유지한다', () => {
    for (const value of [undefined, null, '', '1000', Number.NaN, {}, false]) {
      expect(formatNumber(value)).toBe('-')
      expect(formatNumber(value, 'm')).toBe('-')
      expect(formatMoney(value)).toBe('-')
    }

    for (const value of [0, -1, 1_234_567, 1.5, Number.MAX_SAFE_INTEGER, Infinity, -Infinity]) {
      const formatted = value.toLocaleString('ko-KR')
      expect(formatNumber(value)).toBe(formatted)
      expect(formatNumber(value, 'm')).toBe(`${formatted}m`)
      expect(formatMoney(value)).toBe(`${formatted}원`)
    }
  })
})
