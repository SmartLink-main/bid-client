export function formatMoney(value: unknown) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '-'
  }

  return `${value.toLocaleString('ko-KR')}원`
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
