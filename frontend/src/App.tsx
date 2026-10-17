import { lazy, Suspense, type ComponentType, type ReactNode } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "./hooks/useAuth";
import { Layout } from "./components/Layout";
import { PortalLayout } from "./components/PortalLayout";
import { Spinner } from "./components/ui";
import { AcceptInvitePage, ForgotPasswordPage, LoginPage, RegisterPage, ResetPasswordPage, VerifyEmailPage } from "./pages/auth/AuthPages";
import { ErrorBoundary } from "./components/ErrorBoundary";

// Pages load on demand so the first screen downloads less JavaScript.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const page = <K extends string>(load: () => Promise<Record<K, ComponentType<any>>>, name: K) =>
  lazy(() => load().then((m) => ({ default: m[name] })));
const DashboardPage = page(() => import("./pages/DashboardPage"), "DashboardPage");
const PropertiesPage = page(() => import("./pages/PropertiesPage"), "PropertiesPage");
const PropertyDetailPage = page(() => import("./pages/PropertyDetailPage"), "PropertyDetailPage");
const TenantsPage = page(() => import("./pages/TenantsPage"), "TenantsPage");
const TenantDetailPage = page(() => import("./pages/TenantsPage"), "TenantDetailPage");
const LeasesPage = page(() => import("./pages/LeasesPage"), "LeasesPage");
const LeaseNewPage = page(() => import("./pages/LeasesPage"), "LeaseNewPage");
const LeaseDetailPage = page(() => import("./pages/LeaseDetailPage"), "LeaseDetailPage");
const PaymentsPage = page(() => import("./pages/FinancePages"), "PaymentsPage");
const ExpensesPage = page(() => import("./pages/FinancePages"), "ExpensesPage");
const ReportsPage = page(() => import("./pages/FinancePages"), "ReportsPage");
const WorkOrdersPage = page(() => import("./pages/MaintenancePages"), "WorkOrdersPage");
const WorkOrderDetailPage = page(() => import("./pages/MaintenancePages"), "WorkOrderDetailPage");
const DocumentsPage = page(() => import("./pages/DocumentsPage"), "DocumentsPage");
const SettingsPage = page(() => import("./pages/SettingsPage"), "SettingsPage");
const PortalHomePage = page(() => import("./pages/portal/PortalPages"), "PortalHomePage");
const PortalLeasePage = page(() => import("./pages/portal/PortalPages"), "PortalLeasePage");
const PortalPaymentsPage = page(() => import("./pages/portal/PortalPages"), "PortalPaymentsPage");
const PortalMaintenancePage = page(() => import("./pages/portal/PortalPages"), "PortalMaintenancePage");
const PortalWorkOrderPage = page(() => import("./pages/portal/PortalPages"), "PortalWorkOrderPage");
const PortalDocumentsPage = page(() => import("./pages/portal/PortalPages"), "PortalDocumentsPage");
const LegalPage = page(() => import("./pages/LegalPages"), "LegalPage");

function wrap(routes: ReactNode) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<Spinner />}>{routes}</Suspense>
    </ErrorBoundary>
  );
}

function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="empty">
      <h3>{t("common.page_not_found")}</h3>
      <Link to="/">{t("common.go_home")}</Link>
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
      <Route path="/privacy" element={<LegalPage doc="privacy" />} />
      <Route path="/terms" element={<LegalPage doc="terms" />} />
    </>
  );

  if (!me) {
    return wrap(
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
    return wrap(
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
  return wrap(
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
