export function formatMoney(value: unknown) {
  return formatNumber(value, '원')
}

export function formatAreaPyeong(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return '-'
  return `${value.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}평`
}

function calendarDate(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const timestamp = Date.parse(`${value}T00:00:00Z`)
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) return null
  return { timestamp, month: Number(value.slice(5, 7)), day: Number(value.slice(8, 10)) }
}

export function formatMonthDay(value: unknown) {
  const date = calendarDate(value)
  return date ? `${date.month}월 ${date.day}일` : '-'
}

const koreanCalendar = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
})

export function getKoreanDateKey(now = new Date()) {
  return koreanCalendar.format(now)
}

export function formatAuctionCountdown(value: unknown, today: string) {
  const date = calendarDate(value)
  const current = calendarDate(today)
  if (!date || !current) return '기일 미정'
  const days = Math.round((date.timestamp - current.timestamp) / 86_400_000)
  if (days === 0) return '입찰 당일'
  return days > 0
    ? `입찰 ${days.toLocaleString('ko-KR')}일 전`
    : `입찰 ${Math.abs(days).toLocaleString('ko-KR')}일 경과`
}

export function formatNumber(value: unknown, unit = '') {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '-'
  }

  return `${value.toLocaleString('ko-KR')}${unit}`
}

export function getText(value: unknown, fallback = '-') {
  if (typeof value === 'string' && value.trim()) {
    return value
  }

  if (typeof value === 'number') {
    return value.toLocaleString('ko-KR')
  }

  return fallback
}

export function optionalAmount(value: string) {
  if (!value.trim()) return undefined
  const parsed = Number(value.replaceAll(',', ''))
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : Number.NaN
}

export function formatAmountInput(value: string, currentValue: string) {
  const digits = value.replaceAll(',', '')
  if (!/^\d*$/.test(digits)) return currentValue
  if (!digits) return ''
  const normalized = digits.replace(/^0+(?=\d)/, '')
  return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}
