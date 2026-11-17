import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { RequireArea, RequireAuth } from './auth/guards'
import { AppLayout } from './components/layout/AppLayout'
import { FullPageSpinner } from './components/ui/Spinner'
import { ChangePasswordPage } from './pages/ChangePasswordPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { LoginPage } from './pages/LoginPage'
import { MessagePage } from './pages/MessagePage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'

// feature pages are code-split
const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const WarehousesPage = lazy(() => import('./features/warehouses/WarehousesPage').then((m) => ({ default: m.WarehousesPage })))
const ZonesPage = lazy(() => import('./features/zones/ZonesPage').then((m) => ({ default: m.ZonesPage })))
const BrigadeTypesPage = lazy(() => import('./features/brigade-types/BrigadeTypesPage').then((m) => ({ default: m.BrigadeTypesPage })))
const SlotBuilderPage = lazy(() => import('./features/slots/SlotBuilderPage').then((m) => ({ default: m.SlotBuilderPage })))
const UsersPage = lazy(() => import('./features/users/UsersPage').then((m) => ({ default: m.UsersPage })))
const HiringPage = lazy(() => import('./features/hiring/HiringPage').then((m) => ({ default: m.HiringPage })))
const AuditLogPage = lazy(() => import('./features/audit/AuditLogPage').then((m) => ({ default: m.AuditLogPage })))

export function AppRoutes() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route index element={<RequireArea area="dashboard"><DashboardPage /></RequireArea>} />
            <Route path="warehouses" element={<RequireArea area="warehouses"><WarehousesPage /></RequireArea>} />
            <Route path="zones" element={<RequireArea area="zones"><ZonesPage /></RequireArea>} />
            <Route path="brigade-types" element={<RequireArea area="brigadeTypes"><BrigadeTypesPage /></RequireArea>} />
            <Route path="slots" element={<RequireArea area="slots"><SlotBuilderPage /></RequireArea>} />
            <Route path="users" element={<RequireArea area="users"><UsersPage /></RequireArea>} />
            <Route path="hiring" element={<RequireArea area="hiring"><HiringPage /></RequireArea>} />
            <Route path="audit" element={<RequireArea area="audit"><AuditLogPage /></RequireArea>} />
            <Route path="account/password" element={<ChangePasswordPage />} />
            {/* EXTENSION POINT (Phase 2+): clients, contracts, rates, stock, lorry entry, inward, challans, invoices, sensors, payments */}
            <Route path="*" element={<MessagePage titleKey="auth.notFoundTitle" />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
