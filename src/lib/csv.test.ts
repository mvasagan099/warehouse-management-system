import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseCsv, safeCell, toCsv } from './csv'

const fx = (n: string) => readFileSync(`src/features/imports/fixtures/${n}`, 'utf8')

describe('parseCsv', () => {
  it('reads a good file with a quoted comma', () => {
    const r = parseCsv(fx('clients-good.csv'))
    expect(r.errors).toEqual([]); expect(r.headers).toEqual(['company_name', 'gstin', 'phone', 'credit_limit_rupees'])
    expect(r.rows).toHaveLength(2); expect(r.rows[1].company_name).toBe('Delta, Cold Storage'); expect(r.rows[1].gstin).toBe('')
  })
  it('keeps doubled quotes and handles CRLF and a BOM', () => {
    const r = parseCsv('﻿a,b\r\n"x ""y""",2\r\n')
    expect(r.rows).toEqual([{ a: 'x "y"', b: '2' }])
  })
  it('reports a repeated heading, an unclosed quote and an empty file', () => {
    expect(parseCsv(fx('dup-heading.csv')).errors.join()).toMatch(/appears twice/)
    expect(parseCsv(fx('unclosed.csv')).errors.join()).toMatch(/not closed/)
    expect(parseCsv(fx('empty.csv')).errors.join()).toMatch(/empty/)
  })
  it('passes rows with bad values through for the server to judge', () => {
    const r = parseCsv(fx('clients-bad.csv'))
    expect(r.rows).toHaveLength(3); expect(r.rows[1].company_name).toBe(''); expect(r.rows[2].company_name).toBe('Epsilon Ice')
  })
  it('flags rows with more values than headings and caps the row count', () => {
    expect(parseCsv('a,b\n1,2,3\n').errors.join()).toMatch(/more values/)
    expect(parseCsv('a\n1\n2\n3\n', 2).errors.join()).toMatch(/At most 2 rows/)
  })
})

describe('toCsv', () => {
  it('quotes, escapes and defuses formulas', () => {
    expect(safeCell('=SUM(A1)')).toBe("'=SUM(A1)"); expect(safeCell('-12.5')).toBe('-12.5'); expect(safeCell('-abc')).toBe("'-abc"); expect(safeCell('a,b')).toBe('"a,b"')
    const csv = toCsv([{ key: 'n', label: 'Name' }, { key: 'v', label: 'Value' }], [{ n: 'Ice "cream"', v: 3 }, { n: '@x', v: null }])
    expect(csv).toBe('﻿Name,Value\r\n"Ice ""cream""",3\r\n\'@x,\r\n')
  })
})
