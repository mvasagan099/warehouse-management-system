// All timestamps are stored in UTC (timestamptz) and displayed in India Standard Time.
export const APP_TIME_ZONE = 'Asia/Kolkata'

function localeFor(lang: string) {
  return lang === 'ta' ? 'ta-IN' : 'en-IN'
}

export function formatDateTime(value: string | Date | null | undefined, lang = 'en'): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat(localeFor(lang), {
    timeZone: APP_TIME_ZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(d)
}

export function formatDate(value: string | Date | null | undefined, lang = 'en'): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat(localeFor(lang), {
    timeZone: APP_TIME_ZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d)
}

export function formatNumber(value: number | null | undefined, lang = 'en', maxFractionDigits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat(localeFor(lang), { maximumFractionDigits: maxFractionDigits }).format(value)
}

export function formatTemperatureRange(min: number | null, max: number | null): string {
  if (min === null || max === null) return '—'
  return `${min} °C to ${max} °C`
}

export function percent(part: number, total: number): number {
  if (!total) return 0
  return Math.round((part / total) * 1000) / 10
}
