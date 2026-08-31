export type CalendarDay = {
  date: string
  dayNumber: number
  isCurrentMonth: boolean
  weekday: number
}

const MONTH_KEY_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function monthParts(monthKey: string) {
  const match = MONTH_KEY_PATTERN.exec(monthKey)
  if (!match) return null

  return {
    year: Number(match[1]),
    month: Number(match[2]),
  }
}

export function getLocalDateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function getLocalMonthKey(date = new Date()) {
  return getLocalDateKey(date).slice(0, 7)
}

export function normalizeMonthKey(value: string | null | undefined, fallback = getLocalMonthKey()) {
  return value && monthParts(value) ? value : fallback
}

export function shiftMonth(monthKey: string, offset: number) {
  const parts = monthParts(monthKey)
  if (!parts) throw new Error('유효한 YYYY-MM 형식의 월이 필요합니다.')

  const shifted = new Date(parts.year, parts.month - 1 + offset, 1)
  return `${shifted.getFullYear()}-${pad(shifted.getMonth() + 1)}`
}

export function getMonthBounds(monthKey: string) {
  const parts = monthParts(monthKey)
  if (!parts) throw new Error('유효한 YYYY-MM 형식의 월이 필요합니다.')

  const lastDay = new Date(parts.year, parts.month, 0).getDate()
  return {
    startDate: `${monthKey}-01`,
    endDate: `${monthKey}-${pad(lastDay)}`,
  }
}

export function formatKoreanMonth(monthKey: string) {
  const parts = monthParts(monthKey)
  if (!parts) throw new Error('유효한 YYYY-MM 형식의 월이 필요합니다.')
  return `${parts.year}년 ${parts.month}월`
}

export function formatKoreanDate(dateKey: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey)
  if (!match) return dateKey
  return `${Number(match[2])}월 ${Number(match[3])}일`
}

export function buildMonthCalendar(monthKey: string): CalendarDay[] {
  const parts = monthParts(monthKey)
  if (!parts) throw new Error('유효한 YYYY-MM 형식의 월이 필요합니다.')

  const firstDay = new Date(parts.year, parts.month - 1, 1)
  const lastDayNumber = new Date(parts.year, parts.month, 0).getDate()
  const requiredCellCount = firstDay.getDay() + lastDayNumber
  const cellCount = Math.max(35, Math.ceil(requiredCellCount / 7) * 7)
  const gridStart = new Date(parts.year, parts.month - 1, 1 - firstDay.getDay())

  return Array.from({ length: cellCount }, (_, index) => {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index)
    const dateKey = getLocalDateKey(date)
    return {
      date: dateKey,
      dayNumber: date.getDate(),
      isCurrentMonth: dateKey.startsWith(`${monthKey}-`),
      weekday: date.getDay(),
    }
  })
}
