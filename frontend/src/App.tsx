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
const HelpPage = page(() => import("./pages/HelpPages"), "HelpPage");
const PublicHelpPage = page(() => import("./pages/MarketingPages"), "PublicHelpPage");
const LandingPage = page(() => import("./pages/MarketingPages"), "LandingPage");
const PricingPage = page(() => import("./pages/MarketingPages"), "PricingPage");
const OnboardingPage = page(() => import("./pages/OnboardingPage"), "OnboardingPage");
const AdminPage = page(() => import("./pages/AdminPage"), "AdminPage");
const InspectionPage = page(() => import("./pages/InspectionPage"), "InspectionPage");
const VendorsPage = page(() => import("./pages/VendorPages"), "VendorsPage");
const VendorDetailPage = page(() => import("./pages/VendorPages"), "VendorDetailPage");
const SchedulesPage = page(() => import("./pages/VendorPages"), "SchedulesPage");
const VacancyPage = page(() => import("./pages/VacancyPages"), "VacancyPage");
const ListingManagePage = page(() => import("./pages/VacancyPages"), "ListingManagePage");
const ApplicationPage = page(() => import("./pages/VacancyPages"), "ApplicationPage");
const MessagesPage = page(() => import("./pages/MessagesPages"), "MessagesPage");
const PortalMessagesPage = page(() => import("./pages/portal/PortalComms"), "PortalMessagesPage");
const PublicListingPage = page(() => import("./pages/ListingPublicPages"), "PublicListingPage");
const ApplicationStatusPage = page(() => import("./pages/ListingPublicPages"), "ApplicationStatusPage");

function ShareRedirect() {
  const slug = useLocation().pathname.split("/").pop() ?? "";
  return <Navigate to={`/listings/${slug}`} replace />;
}
const SignPage = page(() => import("./components/Signing"), "SignPage");
const PortalSignPage = page(() => import("./components/Signing"), "PortalSignPage");

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
      <Route path="/sign/:token" element={<SignPage />} />
      <Route path="/listings/:slug" element={<PublicListingPage />} />
      <Route path="/l/:slug" element={<ShareRedirect />} />
      <Route path="/application/:token" element={<ApplicationStatusPage />} />
    </>
  );

  if (!me) {
    return wrap(
      <Routes>
        {publicRoutes}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/" element={<LandingPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/help" element={<PublicHelpPage />} />
        <Route path="/help/:slug" element={<PublicHelpPage />} />
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
          <Route path="help" element={<HelpPage />} />
          <Route path="help/:slug" element={<HelpPage />} />
          <Route path="sign/:signerId" element={<PortalSignPage />} />
          <Route path="messages" element={<PortalMessagesPage />} />
          <Route path="messages/:id" element={<PortalMessagesPage />} />
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
      <Route path="/pricing" element={<Navigate to="/settings" replace />} />
      <Route element={<Layout />}>
        <Route index element={isMaintenance ? <Navigate to="/maintenance" replace /> : <DashboardPage />} />
        <Route path="properties" element={<PropertiesPage />} />
        <Route path="properties/:id" element={<PropertyDetailPage />} />
        <Route path="tenants" element={<TenantsPage />} />
        <Route path="tenants/:id" element={<TenantDetailPage />} />
        <Route path="leases" element={<LeasesPage />} />
        <Route path="leases/new" element={<LeaseNewPage />} />
        <Route path="leases/:id" element={<LeaseDetailPage />} />
        <Route path="leases/:id/inspections/:inspectionId" element={<InspectionPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="expenses" element={<ExpensesPage />} />
        <Route path="maintenance" element={<WorkOrdersPage />} />
        <Route path="maintenance/schedules" element={<SchedulesPage />} />
        <Route path="maintenance/:id" element={<WorkOrderDetailPage />} />
        <Route path="vendors" element={<VendorsPage />} />
        <Route path="messages" element={<MessagesPage />} />
        <Route path="messages/:id" element={<MessagesPage />} />
        <Route path="vacancy" element={<VacancyPage />} />
        <Route path="vacancy/applications/:id" element={<ApplicationPage />} />
        <Route path="vacancy/:id" element={<ListingManagePage />} />
        <Route path="vendors/:id" element={<VendorDetailPage />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="welcome" element={<OnboardingPage />} />
        <Route path="help" element={<HelpPage />} />
        <Route path="help/:slug" element={<HelpPage />} />
        {me.is_superadmin && <Route path="admin" element={<AdminPage />} />}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
