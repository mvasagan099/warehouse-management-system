import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthState } from '../auth/AuthProvider'
import i18n from '../i18n'
import { supabase } from '../lib/supabase'
import { LoginPage } from './LoginPage'

const auth: AuthState = {
  session: null, profile: null, warehouseScope: null, loading: false, recovery: false,
  signOut: async () => {}, refreshProfile: async () => {},
}

function renderLogin() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter><LoginPage /></MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

describe('LoginPage', () => {
  beforeEach(async () => {
    vi.restoreAllMocks()
    await i18n.changeLanguage('en')
  })

  it('validates required fields before calling Supabase', async () => {
    const spy = vi.spyOn(supabase.auth, 'signInWithPassword')
    renderLogin()
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findAllByText('This field is required')).toHaveLength(2)
    expect(spy).not.toHaveBeenCalled()
  })

  it('shows a friendly error for wrong credentials', async () => {
    vi.spyOn(supabase.auth, 'signInWithPassword').mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials' } as never,
    })
    renderLogin()
    await userEvent.type(screen.getByLabelText('Email'), 'admin@warehouse.local')
    await userEvent.type(screen.getByLabelText('Password'), 'wrong-password')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password')
  })

  it('renders in Tamil when the language is switched', async () => {
    await i18n.changeLanguage('ta')
    renderLogin()
    await waitFor(() => expect(screen.getByRole('heading', { name: 'உள்நுழைக' })).toBeInTheDocument())
  })
})
