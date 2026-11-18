import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseCsv } from '../../lib/csv'
import { IMPORT_COLUMNS, missingColumns, templateCsv, type ImportKind } from './templates'

describe('import templates', () => {
  it.each(Object.keys(IMPORT_COLUMNS) as ImportKind[])('%s template parses and has every required column', (k) => {
    const p = parseCsv(templateCsv(k))
    expect(p.errors).toEqual([]); expect(missingColumns(k, p.headers)).toEqual([]); expect(p.rows).toHaveLength(1)
    expect(Object.keys(p.rows[0]).length).toBe(IMPORT_COLUMNS[k].example.length)
  })
  it('flags a file missing a required column', () => {
    expect(missingColumns('clients', ['gstin'])).toEqual(['company_name'])
    expect(missingColumns('opening_balances', ['client_code', 'amount_rupees'])).toEqual(['as_of'])
  })
  it('the good fixture has the clients columns, the bad one still parses for the server to judge', () => {
    expect(missingColumns('clients', parseCsv(readFileSync('src/features/imports/fixtures/clients-good.csv', 'utf8')).headers)).toEqual([])
    expect(missingColumns('clients', parseCsv(readFileSync('src/features/imports/fixtures/clients-bad.csv', 'utf8')).headers)).toEqual([])
  })
})
