// Pure helpers for the cold-chain screens: tile status, gap handling (never draw a line across missing data), door intervals.
export type TileStatus = 'OK' | 'WARNING' | 'CRITICAL' | 'OFFLINE' | 'NO_SENSOR'

export interface OverviewRow {
  zone_id: string; zone_code: string; zone_name: string; temp_min: number | null; temp_max: number | null
  current_value: number | null; last_at: string | null; sensor_count: number; manual_only: boolean; offline_after_min: number
  open_alerts: number; worst_severity: string | null; spark: { t: string; v: number }[] | null
}

/** Manual-only zones are checked by hand a few times a day, so "stale" means 12 hours there. */
export const MANUAL_STALE_MIN = 12 * 60

export function tileStatus(r: Pick<OverviewRow, 'current_value' | 'last_at' | 'temp_min' | 'temp_max' | 'sensor_count' | 'manual_only' | 'offline_after_min' | 'worst_severity'>, nowMs: number): TileStatus {
  if (r.sensor_count === 0) return 'NO_SENSOR'
  if (r.worst_severity === 'CRITICAL') return 'CRITICAL'
  const staleAfter = (r.manual_only ? MANUAL_STALE_MIN : r.offline_after_min) * 60_000
  if (!r.last_at || nowMs - Date.parse(r.last_at) > staleAfter) return 'OFFLINE'
  if (r.worst_severity === 'WARNING') return 'WARNING'
  if (r.current_value !== null && ((r.temp_max !== null && r.current_value > r.temp_max) || (r.temp_min !== null && r.current_value < r.temp_min))) return 'WARNING'
  return 'OK'
}

export const STATUS_STYLE: Record<TileStatus, { ring: string; chip: string; dot: string }> = {
  OK: { ring: 'border-emerald-300', chip: 'bg-emerald-50 text-emerald-700', dot: '#10b981' },
  WARNING: { ring: 'border-amber-400', chip: 'bg-amber-50 text-amber-800', dot: '#f59e0b' },
  CRITICAL: { ring: 'border-red-500', chip: 'bg-red-50 text-red-700', dot: '#ef4444' },
  OFFLINE: { ring: 'border-slate-300', chip: 'bg-slate-100 text-slate-600', dot: '#94a3b8' },
  NO_SENSOR: { ring: 'border-slate-200 border-dashed', chip: 'bg-slate-50 text-slate-500', dot: '#cbd5e1' },
}

export interface Point { t: number; v: number | null }

/** Inserts an explicit "no data" point (v = null) wherever two readings are further apart than the gap, so charts break the line. */
export function breakAtGaps(points: { t: number; v: number }[], gapMs: number): Point[] {
  const out: Point[] = []
  points.forEach((p, i) => {
    if (i > 0 && p.t - points[i - 1].t > gapMs) out.push({ t: points[i - 1].t + gapMs / 2, v: null })
    out.push(p)
  })
  return out
}

/** Several polyline segments for a sparkline, split at gaps (an SVG path with M commands). */
export function sparkPath(points: { t: number; v: number }[], w: number, h: number, gapMs: number, lo?: number, hi?: number): string {
  if (points.length === 0) return ''
  const t0 = points[0].t, t1 = points[points.length - 1].t
  const vs = points.map((p) => p.v)
  const min = Math.min(...vs, lo ?? Infinity), max = Math.max(...vs, hi ?? -Infinity)
  const x = (t: number) => (t1 === t0 ? w / 2 : ((t - t0) / (t1 - t0)) * w)
  const y = (v: number) => (max === min ? h / 2 : h - ((v - min) / (max - min)) * h)
  return points.map((p, i) => `${i === 0 || p.t - points[i - 1].t > gapMs ? 'M' : 'L'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')
}

/** Door readings (1 = open) to open intervals; an interval still open ends at `endMs`. */
export function doorIntervals(readings: { t: number; v: number }[], endMs: number): { from: number; to: number }[] {
  const out: { from: number; to: number }[] = []
  let open: number | null = null
  for (const r of [...readings].sort((a, b) => a.t - b.t)) {
    if (r.v === 1 && open === null) open = r.t
    if (r.v === 0 && open !== null) { out.push({ from: open, to: r.t }); open = null }
  }
  if (open !== null) out.push({ from: open, to: endMs })
  return out
}

export const ageText = (iso: string | null, nowMs: number): string => {
  if (!iso) return '—'
  const m = Math.max(0, Math.round((nowMs - Date.parse(iso)) / 60_000))
  return m < 1 ? '<1 min' : m < 60 ? `${m} min` : m < 1440 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${Math.floor(m / 1440)} d`
}

export const RANGE_PRESETS = [{ key: '6h', ms: 6 * 3600_000 }, { key: '24h', ms: 24 * 3600_000 }, { key: '7d', ms: 7 * 86_400_000 }, { key: '30d', ms: 30 * 86_400_000 }] as const

/** Bucket size in minutes so a chart has at most ~300 points. */
export const bucketMinutes = (rangeMs: number): number => Math.max(1, Math.ceil(rangeMs / 60_000 / 300))

export const ALERT_TEMP_KINDS = ['TEMP_HIGH', 'TEMP_LOW']
export const isActiveAlert = (a: { status: string; recovered_at: string | null }) => a.status !== 'RESOLVED'
