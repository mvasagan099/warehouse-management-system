// Small CSV reader / writer (RFC 4180 quoting). Used by the import tools and the report exports.

export interface ParsedCsv { headers: string[]; rows: Record<string, string>[]; errors: string[] }

export function parseCsv(text: string, maxRows = 5000): ParsedCsv {
  const src = text.replace(/^﻿/, '')
  const records: string[][] = []
  let field = ''; let row: string[] = []; let inQuotes = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (inQuotes) {
      if (ch === '"') { if (src[i + 1] === '"') { field += '"'; i++ } else inQuotes = false } else field += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === ',') { row.push(field); field = '' }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && src[i + 1] === '\n') i++; row.push(field); field = ''; if (row.some((c) => c.trim() !== '')) records.push(row); row = [] }
    else field += ch
  }
  row.push(field); if (row.some((c) => c.trim() !== '')) records.push(row)
  const errors: string[] = []
  if (inQuotes) errors.push('A quoted value is not closed (missing ")')
  if (records.length === 0) return { headers: [], rows: [], errors: [...errors, 'The file is empty'] }
  const headers = records[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'))
  const dup = headers.find((h, i) => h && headers.indexOf(h) !== i)
  if (dup) errors.push(`Column "${dup}" appears twice`)
  if (headers.some((h) => !h)) errors.push('A column has no heading')
  if (records.length - 1 > maxRows) errors.push(`At most ${maxRows} rows per file`)
  const rows = records.slice(1, maxRows + 1).map((r, idx) => {
    if (r.length > headers.length) errors.push(`Row ${idx + 1} has more values than headings`)
    return Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? '').trim()]))
  })
  return { headers, rows, errors }
}

/** Spreadsheet programs run text that starts with = + - @ as a formula; prefix such values so a report cannot carry one. */
export function safeCell(v: unknown): string {
  if (v === null || v === undefined) return ''
  let s = String(v)
  if (/^[=+@]/.test(s) || (/^-/.test(s) && !/^-?\d+(\.\d+)?$/.test(s))) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(columns: { key: string; label: string }[], rows: Record<string, unknown>[]): string {
  const head = columns.map((c) => safeCell(c.label)).join(',')
  return '﻿' + [head, ...rows.map((r) => columns.map((c) => safeCell(r[c.key])).join(','))].join('\r\n') + '\r\n'
}

export function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
