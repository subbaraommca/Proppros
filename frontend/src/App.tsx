import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { Layout } from "./components/Layout";
import { PortalLayout } from "./components/PortalLayout";
import { Spinner } from "./components/ui";
import { AcceptInvitePage, ForgotPasswordPage, LoginPage, RegisterPage, ResetPasswordPage, VerifyEmailPage } from "./pages/auth/AuthPages";
import { DashboardPage } from "./pages/DashboardPage";
import { PropertiesPage } from "./pages/PropertiesPage";
import { PropertyDetailPage } from "./pages/PropertyDetailPage";
import { TenantDetailPage, TenantsPage } from "./pages/TenantsPage";
import { LeaseNewPage, LeasesPage } from "./pages/LeasesPage";
import { LeaseDetailPage } from "./pages/LeaseDetailPage";
import { ExpensesPage, PaymentsPage, ReportsPage } from "./pages/FinancePages";
import { WorkOrderDetailPage, WorkOrdersPage } from "./pages/MaintenancePages";
import { DocumentsPage } from "./pages/DocumentsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { PortalDocumentsPage, PortalHomePage, PortalLeasePage, PortalMaintenancePage, PortalPaymentsPage, PortalWorkOrderPage } from "./pages/portal/PortalPages";

function NotFound() {
  return (
    <div className="empty">
      <h3>Page not found</h3>
      <Link to="/">Go home</Link>
    </div>
  );
}

export default function App() {
  const { me, org, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner />;

  // Routes that work signed in or out
  const publicRoutes = (
    <>
      <Route path="/invite" element={<AcceptInvitePage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
    </>
  );

  if (!me) {
    return (
      <Routes>
        {publicRoutes}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="*" element={<Navigate to="/login" replace state={{ from: location.pathname }} />} />
      </Routes>
    );
  }

  if (org?.role === "tenant") {
    return (
      <Routes>
        {publicRoutes}
        <Route path="/portal" element={<PortalLayout />}>
          <Route index element={<PortalHomePage />} />
          <Route path="leases/:id" element={<PortalLeasePage />} />
          <Route path="payments" element={<PortalPaymentsPage />} />
          <Route path="maintenance" element={<PortalMaintenancePage />} />
          <Route path="maintenance/:id" element={<PortalWorkOrderPage />} />
          <Route path="documents" element={<PortalDocumentsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/portal" replace />} />
      </Routes>
    );
  }

  const isMaintenance = org?.role === "maintenance";
  return (
    <Routes>
      {publicRoutes}
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/register" element={<Navigate to="/" replace />} />
      <Route path="/portal/*" element={<Navigate to="/" replace />} />
      <Route element={<Layout />}>
        <Route index element={isMaintenance ? <Navigate to="/maintenance" replace /> : <DashboardPage />} />
        <Route path="properties" element={<PropertiesPage />} />
        <Route path="properties/:id" element={<PropertyDetailPage />} />
        <Route path="tenants" element={<TenantsPage />} />
        <Route path="tenants/:id" element={<TenantDetailPage />} />
        <Route path="leases" element={<LeasesPage />} />
        <Route path="leases/new" element={<LeaseNewPage />} />
        <Route path="leases/:id" element={<LeaseDetailPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="expenses" element={<ExpensesPage />} />
        <Route path="maintenance" element={<WorkOrdersPage />} />
        <Route path="maintenance/:id" element={<WorkOrderDetailPage />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
