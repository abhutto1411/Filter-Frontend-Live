import React, { Suspense } from 'react';
import { lazyWithRetry } from './utils/lazyWithRetry';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import SignInPage from './pages/SignInPage';
import AdminLayout from './pages/AdminLayout';
import DashboardPage from './pages/admin/DashboardPage';
import ApprovalsPage from './pages/admin/ApprovalsPage';
import ZoneManagementPage from './pages/admin/ZoneManagementPage';
import PermissionsPage from './pages/admin/PermissionsPage';
import AdminWalletsPage from './pages/admin/AdminWalletsPage';
import MyWalletPage from './pages/admin/MyWalletPage';
import DemoInvoicesPage from './pages/admin/DemoInvoicesPage';
import TierManagementPage from './pages/admin/TierManagementPage';
import TaxCodePage from './pages/admin/TaxCodePage';
import LegalPagesPage from './pages/admin/LegalPagesPage';
import MobileAppMenuPage from './pages/admin/MobileAppMenuPage';
// Lazy-loaded admin pages (heavy, not needed on initial load)
const InventoryPage = lazyWithRetry(() => import('./pages/admin/InventoryPage'));
const CustomersPage = lazyWithRetry(() => import('./pages/admin/CustomersPage'));
const SuppliersPage = lazyWithRetry(() => import('./pages/admin/SuppliersPage'));
const EmployeesPage = lazyWithRetry(() => import('./pages/admin/EmployeesPage'));
const BranchesPage = lazyWithRetry(() => import('./pages/admin/BranchesPage'));
const SalesPage = lazyWithRetry(() => import('./pages/admin/SalesPage'));
const AdvancedReportDrilldownPage = lazyWithRetry(() => import('./pages/advanced-reports/AdvancedReportDrilldownPage'));
const AccountingPage = lazyWithRetry(() => import('./pages/admin/AccountingPage'));
const MonitorAccountLedgerPage = lazyWithRetry(() => import('./pages/admin/MonitorAccountLedgerPage'));
const CorporateArControlPage = lazyWithRetry(() => import('./pages/admin/CorporateArControlPage'));
const BnplSettlementControlPage = lazyWithRetry(() => import('./pages/admin/BnplSettlementControlPage'));
const HqCashBankAccountPage = lazyWithRetry(() => import('./pages/admin/HqCashBankAccountPage'));
const FleetManagementPage = lazyWithRetry(() => import('./pages/admin/FleetManagementPage'));
const WarehousePortalPage = lazyWithRetry(() => import('./pages/admin/WarehousePortalPage'));
const AdminStorageFacilityPage = lazyWithRetry(() => import('./pages/admin/AdminStorageFacilityPage'));
const LockerManagementPage = lazyWithRetry(() => import('./pages/admin/LockerManagementPage'));
const PlatformChatPage = lazyWithRetry(() => import('./pages/admin/PlatformChatPage'));
const ReferralCommissionsPage = lazyWithRetry(() => import('./pages/admin/ReferralCommissionsPage'));
const SoftPosSettlement = lazyWithRetry(() => import('./pages/admin/SoftPosSettlement'));
const MarketingPortalPage = lazyWithRetry(() => import('./pages/admin/MarketingPortalPage'));
const WorkshopManagementPage = lazyWithRetry(() => import('./pages/admin/WorkshopManagementPage'));
const AdminStaffAppPage = lazyWithRetry(() => import('./pages/admin/AdminStaffAppPage'));
const ReportingPage = lazyWithRetry(() => import('./pages/admin/ReportingPage'));
import PortalLoginPage from './pages/PortalLoginPage';
import PortalSignupPage from './pages/PortalSignupPage';
import PortalHubPage from './pages/PortalHubPage';

import MarketingLayout from './pages/MarketingLayout';
import { MarketingDashboard } from './pages/marketing/MarketingDashboard';
import CampaignRequests from './pages/marketing/CampaignRequests';
import { PromoCodes } from './pages/marketing/PromoCodes';
import { ReferralManagement } from './pages/marketing/ReferralManagement';
import AnalyticsROI from './pages/marketing/AnalyticsROI';
import { CustomerInsights } from './pages/marketing/CustomerInsights';
import ReferralRules from './pages/marketing/ReferralRules';
import { MarketingProvider } from './pages/marketing/MarketingUtils';
import CampaignReports from './pages/marketing/CampaignReports';
import AdPlatforms from './pages/marketing/AdPlatforms';
import BudgetOptimizer from './pages/marketing/BudgetOptimizer';
import Integrations from './pages/marketing/Integrations';
import InfluencerReferrers from './pages/marketing/InfluencerReferrers';
import ReferrerManagement from './pages/marketing/ReferrerManagement';
import MarketingPromotions from './pages/marketing/MarketingPromotions';
import MarketingPromotionFormPage from './pages/marketing/MarketingPromotionFormPage';
import MarketingPromotionConfigurationViewPage from './pages/marketing/MarketingPromotionConfigurationViewPage';
import MarketingCampaigns from './pages/marketing/MarketingCampaigns';
import MarketingCampaignFormPage from './pages/marketing/MarketingCampaignFormPage';
import LegacyPromotionEditRedirect from './pages/marketing/LegacyPromotionEditRedirect';
import MarketingPromotionReportPage from './pages/marketing/MarketingPromotionReportPage';
import MarketingPromotionAutoReportPage from './pages/marketing/MarketingPromotionAutoReportPage';
import PromoCodeFormPage from './pages/marketing/PromoCodeFormPage';
import PromoCodeConfigurationViewPage from './pages/marketing/PromoCodeConfigurationViewPage';
import MarketingPromoCodeReportPage from './pages/marketing/MarketingPromoCodeReportPage';
import MarketingPromoCodeAutoReportPage from './pages/marketing/MarketingPromoCodeAutoReportPage';
import MarketingWalletBudgetRequestPage from './pages/marketing/MarketingWalletBudgetRequestPage';
import MarketingPlatformChatPage from './pages/marketing/MarketingPlatformChatPage';
import MarketingSalesReports from './pages/marketing/MarketingSalesReports';
import MarketingSalesOrders from './pages/marketing/MarketingSalesOrders';
import ExpenseFormPage from './pages/marketing/ExpenseFormPage';
import InfluencerReferrerFormPage from './pages/marketing/InfluencerReferrerFormPage';
import AdPlatformConfigurePage from './pages/marketing/AdPlatformConfigurePage';
import ReferrerFormPage from './pages/marketing/ReferrerFormPage';
import ReferrerCommissionRuleFormPage from './pages/marketing/ReferrerCommissionRuleFormPage';
import ReferrerPayoutFormPage from './pages/marketing/ReferrerPayoutFormPage';

const WorkshopLayout = lazyWithRetry(() => import('./pages/WorkshopLayout'));
const SupplierLayout = lazyWithRetry(() => import('./pages/SupplierLayout'));
import CorporateLayout from './pages/CorporateLayout';
import ReferralLayout from './pages/ReferralLayout';
import TechnicianLayout from './pages/TechnicianLayout';
import LockerLayout from './pages/LockerLayout';
import POSLayout from './pages/POSLayout';
import ReferrerLayout from './pages/ReferrerLayout';
import ReferrerDashboard from './pages/referrer-portal/ReferrerDashboard';
import AddReferral from './pages/referrer-portal/AddReferral';
import MyReferrals from './pages/referrer-portal/MyReferrals';
import ReferrerWallet from './pages/referrer-portal/ReferrerWallet';
import ReferrerReports from './pages/referrer-portal/ReferrerReports';
import ReferrerNotifications from './pages/referrer-portal/ReferrerNotifications';
import ReferrerSettings from './pages/referrer-portal/ReferrerSettings';

import { AuthProvider, useAuth } from './context/AuthContext';
import IdleSessionWatcher from './components/IdleSessionWatcher';
import { PlatformChatUnreadProvider } from './context/PlatformChatUnreadContext';
import { firstVisibleAdminPath } from './utils/permissions';
import AppErrorBoundary from './components/AppErrorBoundary';
import { PageLoadingFallback } from './components/PageLoadingFallback';

/** Index redirect for `/admin` — picks the first sidebar page the user can view. */
function AdminIndexRedirect() {
    const { user } = useAuth();
    return <Navigate to={firstVisibleAdminPath(user)} replace />;
}
import ProtectedRoute from './components/ProtectedRoute';
import PublicWpiVerifyPage from './pages/PublicWpiVerifyPage';
import PublicLegalPage from './pages/PublicLegalPage';
import AccountDeletionPage from './pages/AccountDeletionPage';
import PublicSinvVerifyPage from './pages/PublicSinvVerifyPage';
import PublicSspVerifyPage from './pages/PublicSspVerifyPage';
import PublicAprVerifyPage from './pages/PublicAprVerifyPage';

function RouteLoadingFallback() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#F5F5F7',
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          border: '3px solid #FCC245',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
    </div>
  );
}

function App() {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <MarketingProvider>
          <PlatformChatUnreadProvider>
            <Router>
              <IdleSessionWatcher />
              <Routes>
            <Route path="/" element={<PortalHubPage />} />

            <Route path="/verify/wpi/:id" element={<PublicWpiVerifyPage />} />
            <Route path="/verify/sinv/:id" element={<PublicSinvVerifyPage />} />
            <Route path="/verify/ssp/:id" element={<PublicSspVerifyPage />} />
            <Route path="/verify/apr/:qrToken" element={<PublicAprVerifyPage />} />

            <Route
              path="/privacy-policy"
              element={<PublicLegalPage slug="privacy-policy" />}
            />
            <Route
              path="/terms-and-conditions"
              element={<PublicLegalPage slug="terms-and-conditions" />}
            />
            <Route path="/account-deletion" element={<AccountDeletionPage />} />

            <Route path="/admin/login" element={<SignInPage />} />
            <Route path="/:portalId/login" element={<PortalLoginPage />} />
            <Route path="/:portalId/signup" element={<PortalSignupPage />} />

            <Route
              path="/admin"
              element={
                <ProtectedRoute requiredType="admin">
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<AdminIndexRedirect />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="approvals" element={<ApprovalsPage />} />
              <Route path="approvals/:entityType/:requestId" element={<ApprovalsPage />} />
              <Route path="zone-management" element={<ZoneManagementPage />} />
              <Route
                path="tier-management"
                element={<Navigate to="/admin/marketing/tier-management" replace />}
              />

              <Route path="marketing" element={<MarketingPortalPage />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<MarketingDashboard />} />
                <Route path="campaigns/new" element={<MarketingCampaignFormPage />} />
                <Route path="campaigns/:id/edit" element={<MarketingCampaignFormPage />} />
                <Route path="campaigns" element={<MarketingCampaigns />} />
                <Route path="campaign-requests" element={<CampaignRequests />} />
                <Route path="promotions/new" element={<Navigate to="/admin/marketing/marketing-promotions/new" replace />} />
                <Route path="promotions/:id/view" element={<MarketingPromotionReportPage />} />
                <Route path="promotions/:id/auto-report" element={<MarketingPromotionAutoReportPage />} />
                <Route path="promotions/:id/edit" element={<LegacyPromotionEditRedirect />} />
                <Route path="promotions" element={<Navigate to="/admin/marketing/marketing-promotions" replace />} />
                <Route path="marketing-promotions/new" element={<MarketingPromotionFormPage />} />
                <Route path="marketing-promotions/:id/details" element={<MarketingPromotionConfigurationViewPage />} />
                <Route path="marketing-promotions/:id/view" element={<MarketingPromotionReportPage />} />
                <Route path="marketing-promotions/:id/auto-report" element={<MarketingPromotionAutoReportPage />} />
                <Route path="marketing-promotions/:id/edit" element={<MarketingPromotionFormPage />} />
                <Route path="marketing-promotions" element={<MarketingPromotions />} />
                <Route path="promo-codes/new" element={<PromoCodeFormPage />} />
                <Route path="promo-codes/:id/details" element={<PromoCodeConfigurationViewPage />} />
                <Route path="promo-codes/:id/view" element={<MarketingPromoCodeReportPage />} />
                <Route path="promo-codes/:id/auto-report" element={<MarketingPromoCodeAutoReportPage />} />
                <Route path="promo-codes/:id/edit" element={<PromoCodeFormPage />} />
                <Route path="promo-codes" element={<PromoCodes />} />
                <Route path="referral-management/budget-request" element={<MarketingWalletBudgetRequestPage />} />
                <Route path="marketing-wallet/budget-request" element={<MarketingWalletBudgetRequestPage />} />
                <Route path="referral-management" element={<ReferralManagement />} />
                <Route path="marketing-wallet" element={<ReferralManagement />} />
                <Route path="budget-optimizer" element={<BudgetOptimizer />} />
                <Route path="expenses/new" element={<ExpenseFormPage />} />
                <Route path="expenses/:id/edit" element={<ExpenseFormPage />} />
                <Route path="expenses" element={<ReferralRules />} />
                <Route path="referral-types-rules/new" element={<ExpenseFormPage />} />
                <Route path="referral-types-rules/:id/edit" element={<ExpenseFormPage />} />
                <Route path="referral-types-rules" element={<ReferralRules />} />
                <Route path="analytics-roi" element={<AnalyticsROI />} />
                <Route path="loyalty-programs/*" element={<Navigate to="../tier-management" replace />} />
                <Route path="tier-management" element={<TierManagementPage />} />
                <Route path="customer-insights" element={<CustomerInsights />} />
                <Route path="campaign-reports" element={<CampaignReports />} />
                <Route path="ad-platforms/:platformKey/configure" element={<AdPlatformConfigurePage />} />
                <Route path="ad-platforms" element={<AdPlatforms />} />
                <Route path="integrations" element={<Integrations />} />
                <Route path="influencer-referrers/new" element={<InfluencerReferrerFormPage />} />
                <Route path="influencer-referrers/:id/edit" element={<InfluencerReferrerFormPage />} />
                <Route path="influencer-referrers" element={<InfluencerReferrers />} />
                <Route path="referrer-management/referrers/new" element={<ReferrerFormPage />} />
                <Route path="referrer-management/referrers/:id/edit" element={<ReferrerFormPage />} />
                <Route path="referrer-management/rules/new" element={<ReferrerCommissionRuleFormPage />} />
                <Route path="referrer-management/payouts/new" element={<ReferrerPayoutFormPage />} />
                <Route path="referrer-management" element={<ReferrerManagement />} />
                <Route path="my-wallet" element={<MyWalletPage />} />
              </Route>

              <Route path="tax-codes" element={<TaxCodePage />} />
              <Route path="legal-pages" element={<LegalPagesPage />} />
              <Route path="mobile-app-menu" element={<MobileAppMenuPage />} />
              <Route path="permissions" element={<PermissionsPage />} />
              <Route path="permissions/roles/new" element={<PermissionsPage />} />
              <Route path="permissions/roles/:roleId/edit" element={<PermissionsPage />} />
              <Route path="permissions/users/new" element={<PermissionsPage />} />
              <Route path="permissions/users/:userId/role" element={<PermissionsPage />} />
              <Route path="permissions/users/:userId/permissions" element={<PermissionsPage />} />
              <Route path="admin-wallets" element={<AdminWalletsPage />} />
              <Route path="my-wallet" element={<MyWalletPage />} />
              <Route path="demo-invoices" element={<DemoInvoicesPage />} />
              <Route path="demo-invoices/new" element={<DemoInvoicesPage />} />
              <Route path="demo-invoices/:invoiceId/edit" element={<DemoInvoicesPage />} />
              <Route path="demo-invoices/:invoiceId/view" element={<Suspense fallback={<PageLoadingFallback />}><DemoInvoicesPage /></Suspense>} />
              <Route path="chat" element={<Suspense fallback={<PageLoadingFallback />}><PlatformChatPage /></Suspense>} />

              <Route
                path="inventory"
                element={<Navigate to="/admin/inventory/master-catalog" replace />}
              />
              <Route
                path="inventory/products-services"
                element={<Navigate to="/admin/inventory/master-catalog" replace />}
              />
              <Route
                path="inventory/categories"
                element={<Navigate to="/admin/inventory/master-catalog" replace />}
              />
              <Route path="inventory/master-catalog/*" element={<Suspense fallback={<PageLoadingFallback />}><InventoryPage /></Suspense>} />
              <Route path="inventory/:subTab" element={<Suspense fallback={<PageLoadingFallback />}><InventoryPage /></Suspense>} />

              <Route
                path="customers"
                element={<Navigate to="/admin/customers/all-customers" replace />}
              />
              <Route path="customers/all-customers/*" element={<Suspense fallback={<PageLoadingFallback />}><CustomersPage /></Suspense>} />
              <Route path="customers/:subTab" element={<Suspense fallback={<PageLoadingFallback />}><CustomersPage /></Suspense>} />

              <Route path="suppliers/*" element={<Suspense fallback={<PageLoadingFallback />}><SuppliersPage /></Suspense>} />
              <Route path="storage-facility" element={<Suspense fallback={<PageLoadingFallback />}><AdminStorageFacilityPage /></Suspense>} />
              <Route path="storage-facility/:supplierId" element={<Suspense fallback={<PageLoadingFallback />}><AdminStorageFacilityPage /></Suspense>} />
              <Route path="employees/*" element={<Suspense fallback={<PageLoadingFallback />}><EmployeesPage /></Suspense>} />
              <Route path="branches/*" element={<Suspense fallback={<PageLoadingFallback />}><BranchesPage /></Suspense>} />
              <Route path="workshop/*" element={<Suspense fallback={<PageLoadingFallback />}><WorkshopManagementPage /></Suspense>} />
              <Route path="staff-app" element={<Suspense fallback={<PageLoadingFallback />}><AdminStaffAppPage /></Suspense>} />
              <Route path="staff-app/users" element={<Navigate to="/admin/employees" replace />} />
              <Route path="staff-app/approvals" element={<Navigate to="/admin/approvals" replace />} />
              <Route path="staff-app/wallets" element={<Navigate to="/admin/staff-app" replace />} />
              <Route path="staff-app/approval-limits" element={<Navigate to="/admin/accounting/expenses" replace />} />
              <Route path="staff-app/:subTab" element={<Suspense fallback={<PageLoadingFallback />}><AdminStaffAppPage /></Suspense>} />

              <Route
                path="sales"
                element={<Navigate to="/admin/sales/workshop-sales" replace />}
              />
              <Route
                path="sales/advanced-reports/drilldown"
                element={<Suspense fallback={<PageLoadingFallback />}><AdvancedReportDrilldownPage portal="admin" /></Suspense>}
              />
              <Route path="sales/:subTab" element={<Suspense fallback={<PageLoadingFallback />}><SalesPage /></Suspense>} />

              <Route
                path="accounting"
                element={<Navigate to="/admin/accounting/chart-of-accounts" replace />}
              />
              <Route path="accounting/ledger/:accountId" element={<Suspense fallback={<PageLoadingFallback />}><MonitorAccountLedgerPage /></Suspense>} />
              <Route path="accounting/corporate-ar/:corporateAccountId" element={<Suspense fallback={<PageLoadingFallback />}><CorporateArControlPage /></Suspense>} />
              <Route path="accounting/corporate-ar" element={<Suspense fallback={<PageLoadingFallback />}><CorporateArControlPage /></Suspense>} />
              <Route path="accounting/bnpl-settlement" element={<Suspense fallback={<PageLoadingFallback />}><BnplSettlementControlPage /></Suspense>} />
              <Route path="accounting/cash-bank/new" element={<Suspense fallback={<PageLoadingFallback />}><HqCashBankAccountPage /></Suspense>} />
              <Route path="accounting/cash-bank/:accountId/edit" element={<Suspense fallback={<PageLoadingFallback />}><HqCashBankAccountPage /></Suspense>} />
              <Route path="accounting/:subTab" element={<Suspense fallback={<PageLoadingFallback />}><AccountingPage /></Suspense>} />

              <Route path="softpos-settlement" element={<Suspense fallback={<PageLoadingFallback />}><SoftPosSettlement /></Suspense>} />
              <Route path="fleet-management" element={<Suspense fallback={<PageLoadingFallback />}><FleetManagementPage /></Suspense>} />
              <Route path="warehouse-portal" element={<Suspense fallback={<PageLoadingFallback />}><WarehousePortalPage /></Suspense>} />
              <Route path="locker-management" element={<Suspense fallback={<PageLoadingFallback />}><LockerManagementPage /></Suspense>} />
            </Route>

            <Route
              path="/marketing"
              element={
                <ProtectedRoute requiredType="marketing_user">
                  <MarketingLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<MarketingDashboard />} />
              <Route path="campaigns/new" element={<MarketingCampaignFormPage />} />
              <Route path="campaigns/:id/edit" element={<MarketingCampaignFormPage />} />
              <Route path="campaigns" element={<MarketingCampaigns />} />
              <Route path="campaign-requests" element={<CampaignRequests />} />
              <Route path="promotions/new" element={<Navigate to="/marketing/marketing-promotions/new" replace />} />
              <Route path="promotions/:id/view" element={<MarketingPromotionReportPage />} />
              <Route path="promotions/:id/auto-report" element={<MarketingPromotionAutoReportPage />} />
              <Route path="promotions/:id/edit" element={<LegacyPromotionEditRedirect />} />
              <Route path="promotions" element={<Navigate to="/marketing/marketing-promotions" replace />} />
              <Route path="marketing-promotions/new" element={<MarketingPromotionFormPage />} />
              <Route path="marketing-promotions/:id/details" element={<MarketingPromotionConfigurationViewPage />} />
              <Route path="marketing-promotions/:id/view" element={<MarketingPromotionReportPage />} />
              <Route path="marketing-promotions/:id/auto-report" element={<MarketingPromotionAutoReportPage />} />
              <Route path="marketing-promotions/:id/edit" element={<MarketingPromotionFormPage />} />
              <Route path="marketing-promotions" element={<MarketingPromotions />} />
              <Route path="promo-codes/new" element={<PromoCodeFormPage />} />
              <Route path="promo-codes/:id/details" element={<PromoCodeConfigurationViewPage />} />
              <Route path="promo-codes/:id/view" element={<MarketingPromoCodeReportPage />} />
              <Route path="promo-codes/:id/auto-report" element={<MarketingPromoCodeAutoReportPage />} />
              <Route path="promo-codes/:id/edit" element={<PromoCodeFormPage />} />
              <Route path="promo-codes" element={<PromoCodes />} />
              <Route path="referral-management/budget-request" element={<MarketingWalletBudgetRequestPage />} />
              <Route path="marketing-wallet/budget-request" element={<MarketingWalletBudgetRequestPage />} />
              <Route path="marketing-wallet" element={<ReferralManagement />} />
              <Route path="referral-management" element={<ReferralManagement />} />
              <Route path="expenses/new" element={<ExpenseFormPage />} />
              <Route path="expenses/:id/edit" element={<ExpenseFormPage />} />
              <Route path="expenses" element={<ReferralRules />} />
              <Route path="referral-types-rules/new" element={<ExpenseFormPage />} />
              <Route path="referral-types-rules/:id/edit" element={<ExpenseFormPage />} />
              <Route path="referral-types-rules" element={<ReferralRules />} />
              <Route path="budget-optimizer" element={<BudgetOptimizer />} />
              <Route path="analytics-roi" element={<AnalyticsROI />} />
              <Route path="loyalty-programs/*" element={<Navigate to="../tier-management" replace />} />
              <Route path="tier-management" element={<TierManagementPage />} />
              <Route path="customer-insights" element={<CustomerInsights />} />
              <Route path="campaign-reports" element={<CampaignReports />} />
              <Route path="influencer-referrers/new" element={<InfluencerReferrerFormPage />} />
              <Route path="influencer-referrers/:id/edit" element={<InfluencerReferrerFormPage />} />
              <Route path="influencer-referrers" element={<InfluencerReferrers />} />
              <Route path="ad-platforms/:platformKey/configure" element={<AdPlatformConfigurePage />} />
              <Route path="ad-platforms" element={<AdPlatforms />} />
              <Route path="integrations" element={<Integrations />} />
              <Route path="referrer-management/referrers/new" element={<ReferrerFormPage />} />
              <Route path="referrer-management/referrers/:id/edit" element={<ReferrerFormPage />} />
              <Route path="referrer-management/rules/new" element={<ReferrerCommissionRuleFormPage />} />
              <Route path="referrer-management/payouts/new" element={<ReferrerPayoutFormPage />} />
              <Route path="referrer-management" element={<ReferrerManagement />} />
              <Route path="my-wallet" element={<MyWalletPage />} />
              <Route path="chat" element={<MarketingPlatformChatPage />} />
              <Route path="sales-reports" element={<MarketingSalesReports />} />
              <Route path="sales-orders" element={<MarketingSalesOrders />} />
              <Route path="*" element={<Navigate to="dashboard" replace />} />
            </Route>

            <Route
              path="/pos/*"
              element={
                <ProtectedRoute requiredType="cashier_user">
                  <POSLayout />
                </ProtectedRoute>
              }
            />

            <Route
              path="/workshop/*"
              element={
                <ProtectedRoute requiredType="workshop_user">
                  <Suspense fallback={<RouteLoadingFallback />}>
                    <WorkshopLayout />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route path="/locker/login" element={<PortalLoginPage />} />
            <Route
              path="/locker/*"
              element={
                <ProtectedRoute requiredType="locker_user">
                  <LockerLayout />
                </ProtectedRoute>
              }
            />
            <Route
              path="/supplier/*"
              element={
                <ProtectedRoute requiredType="supplier_user">
                  <Suspense fallback={<RouteLoadingFallback />}>
                    <SupplierLayout />
                  </Suspense>
                </ProtectedRoute>
              }
            />

            <Route
              path="/corporate/*"
              element={
                <ProtectedRoute requiredType="corporate_user">
                  <CorporateLayout />
                </ProtectedRoute>
              }
            />

            <Route path="/referral-management/*" element={<ReferralLayout />} />

            <Route path="/technician/login" element={<PortalLoginPage />} />

            <Route
              path="/technician/*"
              element={
                <ProtectedRoute requiredType="technician_user">
                  <TechnicianLayout />
                </ProtectedRoute>
              }
            />

            <Route path="/referrer-portal" element={<ReferrerLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<ReferrerDashboard />} />
              <Route path="add_referral" element={<AddReferral />} />
              <Route path="my_referrals" element={<MyReferrals />} />
              <Route path="wallet" element={<ReferrerWallet />} />
              <Route path="reports" element={<ReferrerReports />} />
              <Route path="notifications" element={<ReferrerNotifications />} />
              <Route path="settings" element={<ReferrerSettings />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
        </PlatformChatUnreadProvider>
      </MarketingProvider>
      </AuthProvider>
    </AppErrorBoundary>
  );
}

export default App;