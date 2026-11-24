/**
 * Lazy portal routes live in this .js module (not a React component file)
 * so Vite Fast Refresh cannot drop the helper binding and white-screen the app.
 */
import { lazyPage as lazyWithRetry } from './utils/lazyPage';

export const InventoryPage = lazyWithRetry(() => import('./pages/admin/InventoryPage'));
export const CustomersPage = lazyWithRetry(() => import('./pages/admin/CustomersPage'));
export const SuppliersPage = lazyWithRetry(() => import('./pages/admin/SuppliersPage'));
export const EmployeesPage = lazyWithRetry(() => import('./pages/admin/EmployeesPage'));
export const AdminHqStaffLinks = lazyWithRetry(() => import('./pages/admin/AdminHqStaffLinks'));
export const BranchesPage = lazyWithRetry(() => import('./pages/admin/BranchesPage'));
export const SalesPage = lazyWithRetry(() => import('./pages/admin/SalesPage'));
export const AdvancedReportDrilldownPage = lazyWithRetry(() => import('./pages/advanced-reports/AdvancedReportDrilldownPage'));
export const AccountingPage = lazyWithRetry(() => import('./pages/admin/AccountingPage'));
export const MonitorAccountLedgerPage = lazyWithRetry(() => import('./pages/admin/MonitorAccountLedgerPage'));
export const CorporateArControlPage = lazyWithRetry(() => import('./pages/admin/CorporateArControlPage'));
export const BnplSettlementControlPage = lazyWithRetry(() => import('./pages/admin/BnplSettlementControlPage'));
export const HqCashBankAccountPage = lazyWithRetry(() => import('./pages/admin/HqCashBankAccountPage'));
export const FleetManagementPage = lazyWithRetry(() => import('./pages/admin/FleetManagementPage'));
export const WarehousePortalPage = lazyWithRetry(() => import('./pages/admin/WarehousePortalPage'));
export const AdminStorageFacilityPage = lazyWithRetry(() => import('./pages/admin/AdminStorageFacilityPage'));
export const LockerManagementPage = lazyWithRetry(() => import('./pages/admin/LockerManagementPage'));
export const PlatformChatPage = lazyWithRetry(() => import('./pages/admin/PlatformChatPage'));
export const ReferralCommissionsPage = lazyWithRetry(() => import('./pages/admin/ReferralCommissionsPage'));
export const SoftPosSettlement = lazyWithRetry(() => import('./pages/admin/SoftPosSettlement'));
export const MarketingPortalPage = lazyWithRetry(() => import('./pages/admin/MarketingPortalPage'));
export const WorkshopManagementPage = lazyWithRetry(() => import('./pages/admin/WorkshopManagementPage'));
export const AdminStaffAppPage = lazyWithRetry(() => import('./pages/admin/AdminStaffAppPage'));
export const ReportingPage = lazyWithRetry(() => import('./pages/admin/ReportingPage'));
export const AiCameraPage = lazyWithRetry(() => import('./pages/admin/AiCameraPage'));
export const WorkshopLayout = lazyWithRetry(() => import('./pages/WorkshopLayout'));
export const SupplierLayout = lazyWithRetry(() => import('./pages/SupplierLayout'));
export const SupplierArApReconPage = lazyWithRetry(() => import('./pages/supplier/accounting/SupplierArApReconPage'));
export const SupplierPeriodClosePage = lazyWithRetry(() => import('./pages/supplier/accounting/SupplierPeriodClosePage'));
/** SP-18 — Goods Receipts (Operations › Inbound): list / receive / detail in one feature module. */
export const SupplierGoodsReceipts = lazyWithRetry(() => import('./pages/supplier/SupplierGoodsReceipts'));
/** SP-18 — the same link dialog, used by the purchase-invoice panel ("Link GRs"). */
export const SupplierGoodsReceiptLinkDialog = lazyWithRetry(() => import('./pages/supplier/SupplierGoodsReceipts'), 'GoodsReceiptLinkDialog');
export const ConnectLayout = lazyWithRetry(() => import('./pages/connect/ConnectLayout'));
export const ConnectHome = lazyWithRetry(() => import('./pages/connect/ConnectHome'));
export const ConnectAssistantPage = lazyWithRetry(() => import('./pages/connect/ConnectAssistantPage'));
export const ConnectSettingsPage = lazyWithRetry(() => import('./pages/connect/ConnectSettingsPage'));
export const ConnectKbPage = lazyWithRetry(() => import('./pages/connect/ConnectKbPage'));
export const ConnectIntelPage = lazyWithRetry(() => import('./pages/connect/ConnectIntelPage'));
export const ConnectTasksPage = lazyWithRetry(() => import('./pages/connect/ConnectTasksPage'));
export const ConnectTaskCreatePage = lazyWithRetry(() => import('./pages/connect/ConnectTaskCreatePage'));
export const ConnectTaskDetailPage = lazyWithRetry(() => import('./pages/connect/ConnectTaskDetailPage'));
export const ConnectExpensesPage = lazyWithRetry(() => import('./pages/connect/ConnectExpensesPage'));
export const ConnectExpenseDetailPage = lazyWithRetry(() => import('./pages/connect/ConnectExpenseDetailPage'));
export const ConnectBudgetPage = lazyWithRetry(() => import('./pages/connect/ConnectBudgetPage'));
