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
import { useAuth } from './auth/AuthProvider'

// feature pages are code-split
const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const WarehousesPage = lazy(() => import('./features/warehouses/WarehousesPage').then((m) => ({ default: m.WarehousesPage })))
const ZonesPage = lazy(() => import('./features/zones/ZonesPage').then((m) => ({ default: m.ZonesPage })))
const BrigadeTypesPage = lazy(() => import('./features/brigade-types/BrigadeTypesPage').then((m) => ({ default: m.BrigadeTypesPage })))
const SlotBuilderPage = lazy(() => import('./features/slots/SlotBuilderPage').then((m) => ({ default: m.SlotBuilderPage })))
const UsersPage = lazy(() => import('./features/users/UsersPage').then((m) => ({ default: m.UsersPage })))
const HiringPage = lazy(() => import('./features/hiring/HiringPage').then((m) => ({ default: m.HiringPage })))
const ClientsPage = lazy(() => import('./features/clients/ClientsPage').then((m) => ({ default: m.ClientsPage })))
const BookingsPage = lazy(() => import('./features/bookings/BookingsPage').then((m) => ({ default: m.BookingsPage })))
const GatePage = lazy(() => import('./features/gate/GatePage').then((m) => ({ default: m.GatePage })))
const GateDetailPage = lazy(() => import('./features/gate/GateDetailPage').then((m) => ({ default: m.GateDetailPage })))
const ReceivePage = lazy(() => import('./features/inward/ReceivePage').then((m) => ({ default: m.ReceivePage })))
const ReceiptsPage = lazy(() => import('./features/inward/ReceiptsPage').then((m) => ({ default: m.ReceiptsPage })))
const ReceiptDetailPage = lazy(() => import('./features/inward/ReceiptDetailPage').then((m) => ({ default: m.ReceiptDetailPage })))
const StockPage = lazy(() => import('./features/stock/StockPage').then((m) => ({ default: m.StockPage })))
const LabelsPage = lazy(() => import('./features/labels/LabelsPage').then((m) => ({ default: m.LabelsPage })))
const ScanPage = lazy(() => import('./features/scan/ScanPage').then((m) => ({ default: m.ScanPage })))
const DispatchPage = lazy(() => import('./features/dispatch/DispatchPage').then((m) => ({ default: m.DispatchPage })))
const DispatchDetailPage = lazy(() => import('./features/dispatch/DispatchDetailPage').then((m) => ({ default: m.DispatchDetailPage })))
const ChallansPage = lazy(() => import('./features/challans/ChallansPage').then((m) => ({ default: m.ChallansPage })))
const PortalHome = lazy(() => import('./features/portal/PortalHome').then((m) => ({ default: m.PortalHome })))
const AuditLogPage = lazy(() => import('./features/audit/AuditLogPage').then((m) => ({ default: m.AuditLogPage })))

/** Staff / managers / admins see the dashboard; a client login sees its own portal home. */
function HomeRoute() {
  const { profile } = useAuth()
  return profile?.role === 'CLIENT'
    ? <RequireArea area="portal"><PortalHome /></RequireArea>
    : <RequireArea area="dashboard"><DashboardPage /></RequireArea>
}

export function AppRoutes() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route index element={<HomeRoute />} />
            <Route path="warehouses" element={<RequireArea area="warehouses"><WarehousesPage /></RequireArea>} />
            <Route path="zones" element={<RequireArea area="zones"><ZonesPage /></RequireArea>} />
            <Route path="brigade-types" element={<RequireArea area="brigadeTypes"><BrigadeTypesPage /></RequireArea>} />
            <Route path="slots" element={<RequireArea area="slots"><SlotBuilderPage /></RequireArea>} />
            <Route path="users" element={<RequireArea area="users"><UsersPage /></RequireArea>} />
            <Route path="hiring" element={<RequireArea area="hiring"><HiringPage /></RequireArea>} />
            <Route path="audit" element={<RequireArea area="audit"><AuditLogPage /></RequireArea>} />
            <Route path="clients" element={<RequireArea area="clients"><ClientsPage /></RequireArea>} />
            <Route path="bookings" element={<RequireArea area="bookings"><BookingsPage /></RequireArea>} />
            <Route path="gate" element={<RequireArea area="gate"><GatePage /></RequireArea>} />
            <Route path="gate/:id" element={<RequireArea area="gate"><GateDetailPage /></RequireArea>} />
            <Route path="gate/:id/receive" element={<RequireArea area="gate"><ReceivePage /></RequireArea>} />
            <Route path="receipts" element={<RequireArea area="receipts"><ReceiptsPage /></RequireArea>} />
            <Route path="receipts/:id" element={<RequireArea area="receipts"><ReceiptDetailPage /></RequireArea>} />
            <Route path="stock" element={<RequireArea area="stock"><StockPage /></RequireArea>} />
            <Route path="dispatch" element={<RequireArea area="dispatch"><DispatchPage /></RequireArea>} />
            <Route path="dispatch/:id" element={<RequireArea area="dispatch"><DispatchDetailPage /></RequireArea>} />
            <Route path="challans" element={<RequireArea area="challans"><ChallansPage /></RequireArea>} />
            <Route path="labels" element={<RequireArea area="labels"><LabelsPage /></RequireArea>} />
            <Route path="scan" element={<RequireArea area="scan"><ScanPage /></RequireArea>} />
            <Route path="account/password" element={<ChangePasswordPage />} />
            {/* EXTENSION POINT (Phase 3+): rate cards, rent and labour calculation, invoices, GST amounts, payments, sensors */}
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
