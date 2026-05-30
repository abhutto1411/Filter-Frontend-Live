import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import SignInPage from './pages/SignInPage';
import AdminLayout from './pages/AdminLayout';
import DashboardPage from './pages/admin/DashboardPage';
import ApprovalsPage from './pages/admin/ApprovalsPage';
import ZoneManagementPage from './pages/admin/ZoneManagementPage';
import PermissionsPage from './pages/admin/PermissionsPage';
import TierManagementPage from './pages/admin/TierManagementPage';
import TaxCodePage from './pages/admin/TaxCodePage';
import InventoryPage from './pages/admin/InventoryPage';
import CustomersPage from './pages/admin/CustomersPage';
import SuppliersPage from './pages/admin/SuppliersPage';
import EmployeesPage from './pages/admin/EmployeesPage';
import BranchesPage from './pages/admin/BranchesPage';
import SalesPage from './pages/admin/SalesPage';
import AccountingPage from './pages/admin/AccountingPage';
import FleetManagementPage from './pages/admin/FleetManagementPage';
import WarehousePortalPage from './pages/admin/WarehousePortalPage';
import LockerManagementPage from './pages/admin/LockerManagementPage';
import ReferralCommissionsPage from './pages/admin/ReferralCommissionsPage';
import SoftPosSettlement from './pages/admin/SoftPosSettlement';
import MarketingPortalPage from './pages/admin/MarketingPortalPage';
import WorkshopManagementPage from './pages/admin/WorkshopManagementPage';
import ReportingPage from './pages/admin/ReportingPage';
import PortalLoginPage from './pages/PortalLoginPage';
import PortalSignupPage from './pages/PortalSignupPage';
import PortalHubPage from './pages/PortalHubPage';

import MarketingLayout from './pages/MarketingLayout';
import { MarketingDashboard } from './pages/marketing/MarketingDashboard';
import CampaignRequests from './pages/marketing/CampaignRequests';
import { Promotions } from './pages/marketing/Promotions';
import { PromoCodes } from './pages/marketing/PromoCodes';
import { ReferralPersons } from './pages/marketing/ReferralPersons';
import { ReferralManagement } from './pages/marketing/ReferralManagement';
import { LoyaltyPrograms } from './pages/marketing/LoyaltyPrograms';
import AnalyticsROI from './pages/marketing/AnalyticsROI';
import { CustomerInsights } from './pages/marketing/CustomerInsights';
import ReferralRules from './pages/marketing/ReferralRules';
import { MarketingProvider } from './pages/marketing/MarketingUtils';
import CampaignReports from './pages/marketing/CampaignReports';
import AdPlatforms from './pages/marketing/AdPlatforms';
import BudgetOptimizer from './pages/marketing/BudgetOptimizer';
import InfluencerReferrers from './pages/marketing/InfluencerReferrers';
import ReferrerManagement from './pages/marketing/ReferrerManagement';
import MarketingPromotions from './pages/marketing/MarketingPromotions';

import WorkshopLayout from './pages/WorkshopLayout';
import SupplierLayout from './pages/SupplierLayout';
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
import { firstVisibleAdminPath } from './utils/permissions';

/** Index redirect for `/admin` — picks the first sidebar page the user can view. */
function AdminIndexRedirect() {
    const { user } = useAuth();
    return <Navigate to={firstVisibleAdminPath(user)} replace />;
}
import ProtectedRoute from './components/ProtectedRoute';
import PublicWpiVerifyPage from './pages/PublicWpiVerifyPage';
import PublicSinvVerifyPage from './pages/PublicSinvVerifyPage';
import PublicSspVerifyPage from './pages/PublicSspVerifyPage';

function App() {
  return (
    <AuthProvider>
      <MarketingProvider>
        <Router>
          <Routes>
            <Route path="/" element={<PortalHubPage />} />

            <Route path="/verify/wpi/:id" element={<PublicWpiVerifyPage />} />
            <Route path="/verify/sinv/:id" element={<PublicSinvVerifyPage />} />
            <Route path="/verify/ssp/:id" element={<PublicSspVerifyPage />} />

            <Route path="/admin/login" element={<SignInPage />} />
            <Route path="/:portalId/login" element={<PortalLoginPage />} />
            <Route path="/:portalId/signup" element={<PortalSignupPage />} />

            <Route
              path="/admin"
              element={
                <ProtectedRoute requiredType="admin" redirectTo="/admin/login">
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<AdminIndexRedirect />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="approvals" element={<ApprovalsPage />} />
              <Route path="zone-management" element={<ZoneManagementPage />} />
              <Route path="tier-management" element={<TierManagementPage />} />

              <Route path="marketing" element={<MarketingPortalPage />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<MarketingDashboard />} />
                <Route path="promotions" element={<Promotions />} />
                <Route path="promo-codes" element={<PromoCodes />} />
                <Route path="referral-management" element={<ReferralManagement />} />
                <Route path="referral-types-rules" element={<ReferralRules />} />
                <Route path="analytics-roi" element={<AnalyticsROI />} />
                <Route path="loyalty-programs" element={<LoyaltyPrograms />} />
                <Route path="customer-insights" element={<CustomerInsights />} />
                <Route path="campaign-reports" element={<CampaignReports />} />
              </Route>

              <Route path="tax-codes" element={<TaxCodePage />} />
              <Route path="permissions" element={<PermissionsPage />} />

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
              <Route path="inventory/:subTab" element={<InventoryPage />} />

              <Route
                path="customers"
                element={<Navigate to="/admin/customers/all-customers" replace />}
              />
              <Route path="customers/:subTab" element={<CustomersPage />} />

              <Route path="suppliers" element={<SuppliersPage />} />
              <Route path="employees" element={<EmployeesPage />} />
              <Route path="branches" element={<BranchesPage />} />
              <Route path="workshop" element={<WorkshopManagementPage />} />

              <Route
                path="sales"
                element={<Navigate to="/admin/sales/workshop-sales" replace />}
              />
              <Route path="sales/:subTab" element={<SalesPage />} />

              <Route
                path="accounting"
                element={<Navigate to="/admin/accounting/cash-bank" replace />}
              />
              <Route path="accounting/:subTab" element={<AccountingPage />} />

              <Route path="softpos-settlement" element={<SoftPosSettlement />} />
              <Route path="fleet-management" element={<FleetManagementPage />} />
              <Route path="warehouse-portal" element={<WarehousePortalPage />} />
              <Route path="locker-management" element={<LockerManagementPage />} />
            </Route>

            <Route path="/marketing" element={<MarketingLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<MarketingDashboard />} />
              <Route path="promotions" element={<Promotions />} />
              <Route path="campaign-requests" element={<CampaignRequests />} />
              <Route path="promo-codes" element={<PromoCodes />} />
              <Route path="referral-management" element={<ReferralManagement />} />
              <Route path="referral-types-rules" element={<ReferralRules />} />
              <Route path="analytics-roi" element={<AnalyticsROI />} />
              <Route path="loyalty-programs" element={<LoyaltyPrograms />} />
              <Route path="customer-insights" element={<CustomerInsights />} />
              <Route path="campaign-reports" element={<CampaignReports />} />
              <Route path="ad-platforms" element={<AdPlatforms />} />
              <Route path="budget-optimizer" element={<BudgetOptimizer />} />
              <Route path="influencer-referrers" element={<InfluencerReferrers />} />
              <Route path="referrer-management" element={<ReferrerManagement />} />
              <Route path="marketing-promotions" element={<MarketingPromotions />} />
            </Route>

            <Route path="/pos/*" element={<POSLayout />} />

            <Route
              path="/workshop/*"
              element={
                <ProtectedRoute requiredType="workshop_user" redirectTo="/workshop/login">
                  <WorkshopLayout />
                </ProtectedRoute>
              }
            />
            <Route path="/locker/login" element={<PortalLoginPage />} />
            <Route
              path="/locker/*"
              element={
                <ProtectedRoute requiredType="locker_user" redirectTo="/locker/login">
                  <LockerLayout />
                </ProtectedRoute>
              }
            />
            <Route
              path="/supplier/*"
              element={
                <ProtectedRoute requiredType="supplier_user" redirectTo="/supplier/login">
                  <SupplierLayout />
                </ProtectedRoute>
              }
            />

            <Route
              path="/corporate/*"
              element={
                <ProtectedRoute requiredType="corporate_user" redirectTo="/corporate/login">
                  <CorporateLayout />
                </ProtectedRoute>
              }
            />

            <Route path="/referral-management/*" element={<ReferralLayout />} />

            <Route path="/technician/login" element={<PortalLoginPage />} />

            <Route
              path="/technician/*"
              element={
                <ProtectedRoute requiredType="technician_user" redirectTo="/technician/login">
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
      </MarketingProvider>
    </AuthProvider>
  );
}

export default App;