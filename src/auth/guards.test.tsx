import type { Session } from '@supabase/supabase-js'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import type { Profile } from '../lib/types'
import { AuthContext, type AuthState } from './AuthProvider'
import { RequireArea, RequireAuth } from './guards'

const profile = (o: Partial<Profile> = {}): Profile => ({
  id: 'u1', email: 'u@test.local', full_name: 'User', phone: null, role: 'STAFF', warehouse_id: 'w1',
  client_id: null, preferred_language: 'en', is_active: true, must_change_password: false, created_by: null,
  created_at: '', updated_at: '', deleted_at: null, ...o,
})

function renderAt(path: string, state: Partial<AuthState>) {
  const value: AuthState = {
    session: { user: { id: 'u1' } } as Session,
    profile: profile(),
    warehouseScope: ['w1'],
    loading: false,
    recovery: false,
    signOut: async () => {},
    refreshProfile: async () => {},
    ...state,
  }
  return render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/login" element={<div>LOGIN PAGE</div>} />
          <Route element={<RequireAuth />}>
            <Route path="/" element={<div>HOME</div>} />
            <Route path="/audit" element={<RequireArea area="audit"><div>AUDIT</div></RequireArea>} />
            <Route path="/account/password" element={<div>CHANGE PASSWORD</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('route guards', () => {
  it('redirects anonymous users to login', () => {
    renderAt('/', { session: null, profile: null })
    expect(screen.getByText('LOGIN PAGE')).toBeInTheDocument()
  })
  it('lets an active staff member in', () => {
    renderAt('/', {})
    expect(screen.getByText('HOME')).toBeInTheDocument()
  })
  it('blocks staff from the admin-only audit log', () => {
    renderAt('/audit', {})
    expect(screen.queryByText('AUDIT')).not.toBeInTheDocument()
    expect(screen.getByText('Not allowed')).toBeInTheDocument()
  })
  it('lets the admin open the audit log', () => {
    renderAt('/audit', { profile: profile({ role: 'SUPER_ADMIN', warehouse_id: null }) })
    expect(screen.getByText('AUDIT')).toBeInTheDocument()
  })
  it('shows a client login that is not linked to a client a no-access page', () => {
    renderAt('/', { profile: profile({ role: 'CLIENT', warehouse_id: null }) })
    expect(screen.getByText('No access yet')).toBeInTheDocument()
  })
  it('lets a linked client login in', () => {
    renderAt('/', { profile: profile({ role: 'CLIENT', warehouse_id: null, client_id: 'c1' }) })
    expect(screen.getByText('HOME')).toBeInTheDocument()
  })
  it('keeps a client out of the admin-only audit log', () => {
    renderAt('/audit', { profile: profile({ role: 'CLIENT', warehouse_id: null, client_id: 'c1' }) })
    expect(screen.queryByText('AUDIT')).not.toBeInTheDocument()
    expect(screen.getByText('Not allowed')).toBeInTheDocument()
  })
  it('shows deactivated users a message', () => {
    renderAt('/', { profile: profile({ is_active: false }) })
    expect(screen.getByText('Account deactivated')).toBeInTheDocument()
  })
  it('forces a password change when required', () => {
    renderAt('/', { profile: profile({ must_change_password: true }) })
    expect(screen.getByText('CHANGE PASSWORD')).toBeInTheDocument()
  })
})
