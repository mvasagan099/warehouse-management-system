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
import { Navigate } from 'react-router-dom'
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
const InvoicesPage = lazy(() => import('./features/billing/InvoicesPage').then((m) => ({ default: m.InvoicesPage })))
const PaymentsPage = lazy(() => import('./features/billing/PaymentsPage').then((m) => ({ default: m.PaymentsPage })))
const LedgerPage = lazy(() => import('./features/billing/LedgerPage').then((m) => ({ default: m.LedgerPage })))
const RatesPage = lazy(() => import('./features/billing/RatesPage').then((m) => ({ default: m.RatesPage })))
const BillingReportsPage = lazy(() => import('./features/billing/BillingReportsPage').then((m) => ({ default: m.BillingReportsPage })))
const BillingSettingsPage = lazy(() => import('./features/billing/BillingSettingsPage').then((m) => ({ default: m.BillingSettingsPage })))
const LiveDashboard = lazy(() => import('./features/coldchain/LiveDashboard').then((m) => ({ default: m.LiveDashboard })))
const ZoneDetail = lazy(() => import('./features/coldchain/ZoneDetail').then((m) => ({ default: m.ZoneDetail })))
const ManualReadingPage = lazy(() => import('./features/coldchain/ManualReadingPage').then((m) => ({ default: m.ManualReadingPage })))
const AlertsPage = lazy(() => import('./features/coldchain/AlertsPage').then((m) => ({ default: m.AlertsPage })))
const SensorsPage = lazy(() => import('./features/coldchain/SensorsPage').then((m) => ({ default: m.SensorsPage })))
const RulesPage = lazy(() => import('./features/coldchain/RulesPage').then((m) => ({ default: m.RulesPage })))
const EquipmentPage = lazy(() => import('./features/coldchain/EquipmentPage').then((m) => ({ default: m.EquipmentPage })))
const ColdReportsPage = lazy(() => import('./features/coldchain/ColdReportsPage').then((m) => ({ default: m.ColdReportsPage })))
const CompaniesPage = lazy(() => import('./features/clients/CompaniesPage').then((m) => ({ default: m.CompaniesPage })))
const StaffPage = lazy(() => import('./features/staff/StaffPage').then((m) => ({ default: m.StaffPage })))
const AttendancePage = lazy(() => import('./features/attendance/AttendancePage').then((m) => ({ default: m.AttendancePage })))
const ImportsPage = lazy(() => import('./features/imports/ImportsPage').then((m) => ({ default: m.ImportsPage })))
const AdminOpsPage = lazy(() => import('./features/admin/AdminOpsPage').then((m) => ({ default: m.AdminOpsPage })))
const SupportPage = lazy(() => import('./features/portal/SupportPage').then((m) => ({ default: m.SupportPage })))
const ProfilePage = lazy(() => import('./features/portal/ProfilePage').then((m) => ({ default: m.ProfilePage })))
const DocumentsPage = lazy(() => import('./features/portal/DocumentsPage').then((m) => ({ default: m.DocumentsPage })))
const NoticesPage = lazy(() => import('./features/portal/NoticesPage').then((m) => ({ default: m.NoticesPage })))
const AuditLogPage = lazy(() => import('./features/audit/AuditLogPage').then((m) => ({ default: m.AuditLogPage })))

/** Staff / managers / admins see the dashboard; a client login sees its own portal home. */
function HomeRoute() {
  const { profile } = useAuth()
  if (profile?.role === 'ACCOUNTANT') return <Navigate to="/invoices" replace />
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
            <Route path="invoices" element={<RequireArea area="invoices"><InvoicesPage /></RequireArea>} />
            <Route path="payments" element={<RequireArea area="payments"><PaymentsPage /></RequireArea>} />
            <Route path="ledger" element={<RequireArea area="ledger"><LedgerPage /></RequireArea>} />
            <Route path="rates" element={<RequireArea area="rates"><RatesPage /></RequireArea>} />
            <Route path="billing-reports" element={<RequireArea area="billingReports"><BillingReportsPage /></RequireArea>} />
            <Route path="cold-chain" element={<RequireArea area="coldChain"><LiveDashboard /></RequireArea>} />
            <Route path="cold-chain/zones/:id" element={<RequireArea area="coldChain"><ZoneDetail /></RequireArea>} />
            <Route path="manual-reading" element={<RequireArea area="manualReading"><ManualReadingPage /></RequireArea>} />
            <Route path="alerts" element={<RequireArea area="alerts"><AlertsPage /></RequireArea>} />
            <Route path="sensors" element={<RequireArea area="sensors"><SensorsPage /></RequireArea>} />
            <Route path="alert-rules" element={<RequireArea area="alertRules"><RulesPage /></RequireArea>} />
            <Route path="equipment" element={<RequireArea area="equipment"><EquipmentPage /></RequireArea>} />
            <Route path="cold-reports" element={<RequireArea area="coldReports"><ColdReportsPage /></RequireArea>} />
            <Route path="companies" element={<RequireArea area="companies"><CompaniesPage /></RequireArea>} />
            <Route path="staff" element={<RequireArea area="staff"><StaffPage /></RequireArea>} />
            <Route path="attendance" element={<RequireArea area="attendance"><AttendancePage /></RequireArea>} />
            <Route path="import" element={<RequireArea area="imports"><ImportsPage /></RequireArea>} />
            <Route path="admin" element={<RequireArea area="ops"><AdminOpsPage /></RequireArea>} />
            <Route path="support" element={<RequireArea area="support"><SupportPage /></RequireArea>} />
            <Route path="profile" element={<RequireArea area="profile"><ProfilePage /></RequireArea>} />
            <Route path="documents" element={<RequireArea area="documents"><DocumentsPage /></RequireArea>} />
            <Route path="notices" element={<RequireArea area="notices"><NoticesPage /></RequireArea>} />
            <Route path="billing-settings" element={<RequireArea area="billingSettings"><BillingSettingsPage /></RequireArea>} />
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
