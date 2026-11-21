import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import '../../i18n'
import { Select } from './Field'

const many = ['C001 · Vikram Foods', 'C002 · hari', 'C003 · sakthi', 'C004 · lak foods', 'C005 · Delta Cold', 'C006 · Murugan Ice', 'C007 · Saravana', 'C008 · Anand Traders']

describe('Select', () => {
  it('stays a plain select for short lists', () => {
    render(<Select aria-label="Client"><option value="">Select</option><option value="1">One</option><option value="2">Two</option></Select>)
    expect(screen.getByRole('combobox', { name: 'Client' }).tagName).toBe('SELECT')
  })
  it('gets a search box with suggestions for long lists and sets the real value', async () => {
    const seen: string[] = []
    render(<Select id="cl" aria-label="Client" onChange={(e) => seen.push(e.target.value)}><option value="">Select client</option>{many.map((m, i) => <option key={m} value={`id${i}`}>{m}</option>)}</Select>)
    await userEvent.click(screen.getByRole('button', { name: /select client/i }))
    expect(screen.getAllByRole('option').length).toBeGreaterThan(8)
    await userEvent.type(screen.getByPlaceholderText(/search/i), 'foods')
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['C001 · Vikram Foods', 'C004 · lak foods'])
    await userEvent.type(screen.getByPlaceholderText(/search/i), '{Enter}')
    expect(seen).toEqual(['id0'])
    expect(screen.getByRole('button', { name: /vikram foods/i })).toBeInTheDocument()
  })
  it('matches words in any order and says when nothing matches', async () => {
    render(<Select aria-label="Client"><option value="">Select</option>{many.map((m, i) => <option key={m} value={`id${i}`}>{m}</option>)}</Select>)
    await userEvent.click(screen.getByRole('button', { name: /select/i }))
    await userEvent.type(screen.getByPlaceholderText(/search/i), 'cold delta')
    expect(screen.getAllByRole('option')).toHaveLength(1)
    await userEvent.clear(screen.getByPlaceholderText(/search/i))
    await userEvent.type(screen.getByPlaceholderText(/search/i), 'zzz')
    expect(screen.queryAllByRole('option')).toHaveLength(0)
  })
})
