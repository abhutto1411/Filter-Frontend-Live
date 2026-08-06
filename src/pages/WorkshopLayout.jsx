import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Building2, LogOut, AlertTriangle, ChevronDown, ChevronRight, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    NAV_ITEMS,
} from './workshop/constants';
import { STAFF_APP_TAB_SLUG, STAFF_APP_PERMISSION_FALLBACK, STAFF_APP_LEGACY_ROUTE_REDIRECTS } from './workshop/staff-app/constants';
import { staffAppT, NAV_LABEL_KEYS as STAFF_APP_NAV_LABEL_KEYS } from '../utils/staffAppI18n';
import { accT } from '../utils/accountingI18n';
import StaffAppPage from './workshop/staff-app/StaffAppPage';
import WorkshopEmployees from './workshop/WorkshopEmployees';
import WorkshopApprovals from './workshop/WorkshopApprovals';
import WorkshopMyPettyCash from './workshop/WorkshopMyPettyCash';
import WorkshopDashboard from './workshop/WorkshopDashboard';
import WorkshopDepartments from './workshop/WorkshopDepartments';
import WorkshopCatalogNew from './workshop/WorkshopCatalogNew';
import WorkshopPurchases from './workshop/WorkshopPurchases';
import WorkshopSalesReturns from './workshop/WorkshopSalesReturns';
import WorkshopPurchaseReturns from './workshop/WorkshopPurchaseReturns';
import WorkshopDiscounts from './workshop/WorkshopDiscounts';
import WorkshopSuppliers from './workshop/WorkshopSuppliers';
import WorkshopReports from './workshop/WorkshopReports';
import AdvancedReportsPage from './advanced-reports/AdvancedReportsPage';
import AdvancedReportDrilldownPage from './advanced-reports/AdvancedReportDrilldownPage';
import WorkshopPosMonitoring from './workshop/WorkshopPosMonitoring';
import WorkshopLogs from './workshop/WorkshopLogs';
import WorkshopLockerManagement from './workshop/WorkshopLockerManagement';
import WorkshopPromoCodes from './workshop/WorkshopPromoCodes';
import WorkshopCorporateManagement from './workshop/WorkshopCorporateManagement';
import WorkshopBranches from './workshop/WorkshopBranches';
import WorkshopCommissions from './workshop/WorkshopCommissions';
import WorkshopInventory from './workshop/WorkshopInventory';
import WorkshopAccountingPage from './workshop/WorkshopAccountingPage';
import WorkshopAccountLedgerPage from './workshop/accounting/WorkshopAccountLedgerPage';
import WorkshopAffiliatedSuppliers from './workshop/WorkshopAffiliatedSuppliers';
import WorkshopNonAffiliatedSuppliers from './workshop/WorkshopNonAffiliatedSuppliers';
import WorkshopSupplierLedger from './workshop/WorkshopSupplierLedger';
import WorkshopPlatformChatPage from './workshop/WorkshopPlatformChatPage';
import MyWalletPage from './admin/MyWalletPage';
import PlatformChatNavBadge from '../components/platform-chat/PlatformChatNavBadge';
import PlatformChatFab from '../components/platform-chat/PlatformChatFab';
import { isPlatformChatNavId } from '../utils/platformChatForUser';
import '../styles/admin/PlatformChat.css';
import { apiFetch } from '../services/api';
import { workshopLogout } from '../services/authApi';
import {
    qs,
    branchScopeParams,
    unwrapWorkshopBranchesResponse,
    filterPortalVisibleBranches,
    isWorkshopPortalBranchInactive,
} from '../services/workshopStaffApi';
import { useAuth } from '../context/AuthContext';
import { firstVisibleWorkshopPath, workshopTabToPath } from '../utils/permissions';
import { wsDashT } from '../utils/workshopDashboardI18n';
import './workshop/Workshop.css';
import '../styles/admin/AccountingPage.css';
import '../styles/admin/ApprovalsPage.css';

/** Tabs reachable by in-app navigation but not listed in the sidebar. */
const WORKSHOP_INTERNAL_TABS = new Set(['supplier-ledger', 'acc-ledger-statement', 'advanced-reports-drilldown']);

function parseLedgerTabStateFromSearch(search) {
    const params = new URLSearchParams(search || '');
    const type = params.get('type');
    const id = params.get('id');
    if (!type || !id) return null;
    const name = params.get('name');
    return {
        type,
        id,
        ...(name ? { name } : {}),
    };
}

export default function WorkshopLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const { logout, hasPermission, user } = useAuth();
    const [locale, setLocale] = useState(() => localStorage.getItem('portal-locale') || 'en');

    useEffect(() => {
        document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = locale === 'ar' ? 'ar' : 'en';
        localStorage.setItem('portal-locale', locale);
    }, [locale]);

    const lt = useCallback((key, vars) => wsDashT(locale, key, vars), [locale]);

    /**
     * Branch-restriction rules for the workshop portal (priority top-down):
     *   1. Custom role with exactly one `role.branchIds` entry → HARD LOCK to
     *      that branch (wins over the user's stored `branchId`).
     *   2. Custom role with multiple `role.branchIds` → scoped dropdown only.
     *   3. Custom role with no branch scope but `User.branchId` set → legacy
     *      single-branch lock.
     *   4. Owners / system roles / roleless users → full access.
     */
    const roleBranchIds = useMemo(() => {
        if (!user?.role || user.role.isSystem) return [];
        return (user.role.branchIds ?? []).map(String);
    }, [user?.role]);

    const userBranchLock = useMemo(() => {
        if (!user?.role || user.role.isSystem) return null;
        if (roleBranchIds.length === 1) return roleBranchIds[0];
        if (roleBranchIds.length > 1) return null;
        if (user.branchId) return String(user.branchId);
        return null;
    }, [user?.role, user?.branchId, roleBranchIds]);

    /** Allowed branches when the role scopes to more than one branch. */
    const roleBranchScope = useMemo(() => {
        if (userBranchLock) return null;
        if (!user?.role || user.role.isSystem) return null;
        if (roleBranchIds.length > 1) return new Set(roleBranchIds);
        return null;
    }, [user?.role, userBranchLock, roleBranchIds]);

    /** Owner / system role / no branch scope — full workshop branch picker. */
    const hasFullBranchAccess = !userBranchLock && !roleBranchScope;

    /**
     * Filter sidebar items by the current user's permissions.
     * Memoized on `hasPermission` so the auto-snap effect below doesn't see a
     * new array reference on every render (would cause needless setActiveTab).
     */
    const visibleNavItems = useMemo(
        () => NAV_ITEMS
            .map((item) => {
                if (item.subItems?.length) {
                    const visibleSubs = item.subItems.filter((s) => {
                        if (item.id === 'staff-app') {
                            const fallbacks = STAFF_APP_PERMISSION_FALLBACK[s.id] || [s.permission];
                            return fallbacks.some((code) => !code || hasPermission(code));
                        }
                        return !s.permission || hasPermission(s.permission);
                    });
                    return visibleSubs.length > 0 ? { ...item, subItems: visibleSubs } : null;
                }
                if (item.walletRequired) {
                    return user?.walletEnabled ? item : null;
                }
                if (item.permission && !hasPermission(item.permission)) return null;
                return item;
            })
            .filter(Boolean),
        [hasPermission, user?.walletEnabled],
    );

    const handleLogout = async () => {
        const t = localStorage.getItem('filter_auth_token');
        try {
            if (t) await workshopLogout(t);
        } catch (e) {
            console.warn('[workshop] logout API failed (session cleared locally anyway)', e);
        }
        logout();
        navigate('/', { replace: true });
    };

    const getActiveTabFromUrl = () => {
        const parts = location.pathname.split('/').filter(Boolean);
        const main = parts[1] || 'dashboard';
        const sub = parts[2];

        if (main === 'staff-app' && sub) {
            const tab = Object.entries(STAFF_APP_TAB_SLUG).find(([, slug]) => slug === sub)?.[0];
            return tab || 'sap-overview';
        }
        if (main === 'accounting' && sub) {
            if (sub === 'ledger' && parts[3]) {
                return 'acc-ledger-statement';
            }
            const mapping = {
                'chart-of-accounts': 'acc-chart',
                'period-closings': 'acc-period-closings',
                'cash-bank': 'acc-cash',
                'transactions': 'acc-transactions',
                'journal-entries': 'acc-journal',
                'expenses': 'acc-expenses',
                'receipts': 'acc-receipts',
                'payments': 'acc-payments',
                'advances': 'acc-advances',
                'approvals': 'acc-approvals',
                'ledger': 'acc-ledger',
                'vat': 'acc-vat',
            };
            return mapping[sub] || 'acc-cash';
        }
        if (main === 'advanced-reports' && sub === 'drilldown') {
            return 'advanced-reports-drilldown';
        }
        return main;
    };

    const [activeTab, setActiveTab] = useState(getActiveTabFromUrl());
    const [tabState, setTabState] = useState(() => {
        if (getActiveTabFromUrl() === 'supplier-ledger') {
            return parseLedgerTabStateFromSearch(window.location.search);
        }
        return null;
    });

    /** Resolve first visible tab id (top-level OR sub-item). Used for auto-snap. */
    const firstVisibleTabId = (() => {
        const first = visibleNavItems[0];
        if (!first) return null;
        if (first.subItems?.length) return first.subItems[0].id;
        return first.id;
    })();

    const canViewDashboard = hasPermission('workshop.dashboard.view');

    /** Legacy staff-app nested routes → restored top-level workshop pages */
    useEffect(() => {
        const parts = location.pathname.split('/').filter(Boolean);
        if (parts[0] !== 'workshop' || parts[1] !== 'staff-app' || !parts[2]) return;

        const legacyTarget = STAFF_APP_LEGACY_ROUTE_REDIRECTS[parts[2]];
        if (legacyTarget && location.pathname !== legacyTarget) {
            navigate(legacyTarget, { replace: true });
        }
    }, [location.pathname, navigate]);

    /** Legacy Payroll Run URL → Advances (Salary tab) */
    useEffect(() => {
        const parts = location.pathname.split('/').filter(Boolean);
        if (parts[0] === 'workshop' && parts[1] === 'accounting' && parts[2] === 'payroll') {
            navigate('/workshop/accounting/advances?tab=Salary', { replace: true });
        }
    }, [location.pathname, navigate]);

    /** `/workshop` and `/workshop/dashboard` default to dashboard — redirect restricted users. */
    useEffect(() => {
        const parts = location.pathname.split('/').filter(Boolean);
        if (parts[0] !== 'workshop') return;
        const segment = parts[1];
        const onDashboardRoute = !segment || segment === 'dashboard';
        if (!onDashboardRoute || canViewDashboard) return;
        const target = firstVisibleWorkshopPath(user);
        if (target && location.pathname !== target) {
            navigate(target, { replace: true });
        }
    }, [location.pathname, canViewDashboard, user, navigate]);

    /**
     * Auto-snap activeTab to the first visible tab if user lacks permission
     * for the current tab (e.g. legacy URL, role change mid-session).
     */
    useEffect(() => {
        if (!firstVisibleTabId) return;
        if (WORKSHOP_INTERNAL_TABS.has(activeTab)) return;
        const allVisible = visibleNavItems.flatMap((i) => i.subItems ? i.subItems.map((s) => s.id) : [i.id]);
        if (!allVisible.includes(activeTab)) {
            setActiveTab(firstVisibleTabId);
            const target = workshopTabToPath(firstVisibleTabId);
            if (location.pathname !== target) {
                navigate(target, { replace: true });
            }
        }
    }, [activeTab, firstVisibleTabId, visibleNavItems, location.pathname, navigate]);

    useEffect(() => {
        const tabFromUrl = getActiveTabFromUrl();
        setActiveTab(tabFromUrl);
        if (tabFromUrl === 'supplier-ledger') {
            const ledgerState = parseLedgerTabStateFromSearch(location.search);
            if (ledgerState) setTabState(ledgerState);
        }
    }, [location.pathname, location.search]);

    const handleTabChange = (tabId, state = null) => {
        setIsMobileMenuOpen(false);
        setActiveTab(tabId);
        setTabState(state);
        
        if (tabId.startsWith('acc-')) {
            const reverseMapping = {
                'acc-chart': 'chart-of-accounts',
                'acc-period-closings': 'period-closings',
                'acc-cash': 'cash-bank',
                'acc-transactions': 'transactions',
                'acc-journal': 'journal-entries',
                'acc-expenses': 'expenses',
                'acc-receipts': 'receipts',
                'acc-payments': 'payments',
                'acc-advances': 'advances',
                'acc-approvals': 'approvals',
                'acc-ledger': 'ledger',
                'acc-vat': 'vat',
            };
            navigate(`/workshop/accounting/${reverseMapping[tabId]}`);
        } else if (tabId === 'sap-users') {
            navigate('/workshop/employees');
        } else if (tabId === 'sap-approvals') {
            navigate('/workshop/approvals');
        } else if (tabId === 'sap-wallets') {
            navigate('/workshop/my-petty-cash');
        } else if (tabId === 'sap-approval-limits') {
            navigate('/workshop/accounting/approvals');
        } else if (tabId.startsWith('sap-')) {
            const slug = STAFF_APP_TAB_SLUG[tabId] || 'overview';
            navigate(`/workshop/staff-app/${slug}`);
        } else if (
            tabId === 'supplier-ledger' &&
            state?.type &&
            state?.id
        ) {
            const q = new URLSearchParams({
                type: String(state.type),
                id: String(state.id),
            });
            if (state.name) q.set('name', String(state.name));
            navigate(`/workshop/${tabId}?${q.toString()}`);
        } else {
            navigate(`/workshop/${tabId}`);
        }
    };

    const [openMenus, setOpenMenus] = useState({
        accounting: activeTab.startsWith('acc-'),
        'staff-app': activeTab.startsWith('sap-'),
    });
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [location.pathname, location.search]);

    const toggleMenu = (id) => {
        setOpenMenus(prev => ({ ...prev, [id]: !prev[id] }));
    };
    const [selectedBranch, setSelectedBranch] = useState(userBranchLock ?? 'all');
    const [branches, setBranches] = useState([]);
    const [selectedProducts, setSelectedProducts] = useState([]);

    const updateProductStatus = (productId, newStatus) => {
        setSelectedProducts(prev => prev.map(p => 
            p.id === productId ? { ...p, status: newStatus } : p
        ));
    };

    const [pendingApprovals, setPendingApprovals] = useState(0);
    const [dashboardLowStockCount, setDashboardLowStockCount] = useState(0);
    const [apiLoading, setApiLoading] = useState(false);

    const loadBranches = useCallback(async () => {
        try {
            const response = await apiFetch('/workshop-staff/branches');
            const rawList = unwrapWorkshopBranchesResponse(response);
            if (response?.success === false && rawList.length === 0) {
                setBranches([]);
                return;
            }
            const normalized = rawList.map((branch) => ({
                ...branch,
                id: branch.id ?? branch._id,
                name: branch.name ?? branch.branchName ?? 'Branch',
                status: branch.status || (branch.isActive === false ? 'inactive' : 'active'),
                code: branch.branchCode ?? branch.code ?? '',
            }));
            setBranches(normalized.filter((b) => b.id != null));
        } catch {
            setBranches([]);
        }
    }, []);

    useEffect(() => {
        loadBranches();
    }, [loadBranches]);

    useEffect(() => {
        const onBranchesChanged = () => {
            loadBranches();
        };
        window.addEventListener('workshop-branches-changed', onBranchesChanged);
        return () => window.removeEventListener('workshop-branches-changed', onBranchesChanged);
    }, [loadBranches]);

    const loadPendingApprovalsCount = useCallback(async () => {
        try {
            const branch = branchScopeParams(selectedBranch);
            const [pettyRes, supplierRes] = await Promise.all([
                apiFetch(
                    `/workshop-staff/petty-cash/requests${qs({
                        limit: 1,
                        offset: 0,
                        queue: 'all',
                        status: 'pending',
                        ...branch,
                    })}`,
                ),
                apiFetch(
                    `/workshop-staff/supplier-sales-invoices${qs({
                        limit: 1,
                        offset: 0,
                        ...branch,
                    })}`,
                ).catch(() => ({ success: false, total: 0 })),
            ]);
            const petty = pettyRes?.success ? Number(pettyRes.total) || 0 : 0;
            const sup = supplierRes?.success ? Number(supplierRes.total) || 0 : 0;
            setPendingApprovals(petty + sup);
        } catch {
            setPendingApprovals(0);
        }
    }, [selectedBranch]);

    useEffect(() => {
        loadPendingApprovalsCount();
    }, [loadPendingApprovalsCount]);

    useEffect(() => {
        const handleApprovalsUpdated = () => {
            loadPendingApprovalsCount();
        };

        window.addEventListener('workshop-approvals-updated', handleApprovalsUpdated);
        return () => {
            window.removeEventListener('workshop-approvals-updated', handleApprovalsUpdated);
        };
    }, [loadPendingApprovalsCount]);

    useEffect(() => {
        const handleApiLoading = (event) => {
            const pending = Number(event?.detail?.pending || 0);
            setApiLoading(pending > 0);
        };
        window.addEventListener('filter-api-loading', handleApiLoading);
        return () => window.removeEventListener('filter-api-loading', handleApiLoading);
    }, []);

    const activeBranches = useMemo(() => {
        const all = filterPortalVisibleBranches(branches);
        if (userBranchLock) {
            // Branch-locked users only see their own branch in the dropdown + data.
            return all.filter((b) => String(b.id) === userBranchLock);
        }
        if (roleBranchScope) {
            // Role with explicit branch scope — limit dropdown to that set.
            return all.filter((b) => roleBranchScope.has(String(b.id)));
        }
        return all;
    }, [branches, userBranchLock, roleBranchScope]);

    // If the loaded branch list never contains the user's locked branch (e.g.
    // pending data race), still keep selectedBranch pointed at the lock so all
    // downstream pages receive the correct scope.
    useEffect(() => {
        if (userBranchLock && selectedBranch !== userBranchLock) {
            setSelectedBranch(userBranchLock);
        }
    }, [userBranchLock, selectedBranch]);

    /** Sidebar + “All Branches” scope only include active branches; inactive stay manageable on Branches page. */
    useEffect(() => {
        if (userBranchLock) return; // never override a hard branch lock
        if (selectedBranch === 'all') return;
        const sel = branches.find((b) => String(b.id) === String(selectedBranch));
        // If the selected branch is now invalid (inactive, or outside this
        // user's role scope), snap back to "All Branches" within their scope.
        const outsideScope = roleBranchScope && !roleBranchScope.has(String(selectedBranch));
        if (!sel || isWorkshopPortalBranchInactive(sel) || outsideScope) {
            setSelectedBranch('all');
        }
    }, [branches, selectedBranch, userBranchLock, roleBranchScope]);

    useEffect(() => {
        if (userBranchLock) return;
        if (activeBranches.length > 0) return;
        if (selectedBranch !== 'all') setSelectedBranch('all');
    }, [activeBranches.length, selectedBranch, userBranchLock]);

    const selectedBranchName = useMemo(() => {
        if (selectedBranch === 'all') return 'All Branches';
        const b = activeBranches.find((branch) => String(branch.id) === String(selectedBranch));
        if (b) return b.name ?? 'Branch';
        const fromRole = user?.role?.branches?.find(
            (br) => String(br.id) === String(selectedBranch),
        );
        if (fromRole?.name) return fromRole.name;
        if (userBranchLock && user?.branchName) return user.branchName;
        return 'All Branches';
    }, [activeBranches, selectedBranch, userBranchLock, user?.branchName, user?.role?.branches]);

    useEffect(() => {
        if (activeTab !== 'dashboard') setDashboardLowStockCount(0);
    }, [activeTab]);

    /** Inventory is branch-scoped only: no workshop-wide union in the UI. */
    const inventoryBranchOnly = activeTab === 'inventory';
    useEffect(() => {
        if (!inventoryBranchOnly) return;
        const hasBranch = activeBranches.some((b) => String(b.id) === String(selectedBranch));
        if (selectedBranch !== 'all' && hasBranch) return;
        if (activeBranches.length > 0) {
            setSelectedBranch(String(activeBranches[0].id));
        }
    }, [inventoryBranchOnly, selectedBranch, activeBranches]);

    const renderContent = () => {
        switch (activeTab) {
            case 'acc-chart':
            case 'acc-period-closings':
            case 'acc-cash':
            case 'acc-transactions':
            case 'acc-journal':
            case 'acc-expenses':
            case 'acc-receipts':
            case 'acc-payments':
            case 'acc-advances':
            case 'acc-approvals':
            case 'acc-ledger':
            case 'acc-vat':
                return <WorkshopAccountingPage activeTab={activeTab} selectedBranchId={selectedBranch} branches={activeBranches} locale={locale} />;
            case 'acc-ledger-statement': return <WorkshopAccountLedgerPage locale={locale} />;
            case 'sap-overview':
            case 'sap-expenses':
            case 'sap-requests':
            case 'sap-purchase-orders':
            case 'sap-tasks':
            case 'sap-leave':
            case 'sap-salary-advances':
            case 'sap-chat':
            case 'sap-notifications':
            case 'sap-settings':
                return (
                    <StaffAppPage
                        activeTab={activeTab}
                        selectedBranchId={selectedBranch}
                        branches={activeBranches}
                        branchLockedId={userBranchLock}
                        onNavigate={handleTabChange}
                        locale={locale}
                    />
                );
            case 'platform-chat':
                return null;
            case 'my-wallet':
                return <MyWalletPage />;
            case 'employees':
                return (
                    <WorkshopEmployees
                        selectedBranchId={selectedBranch}
                        branches={activeBranches}
                        locale={locale}
                    />
                );
            case 'dashboard':
                if (!canViewDashboard) {
                    return (
                        <div style={{ padding: 24, color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                            You don&apos;t have permission to view the dashboard.
                        </div>
                    );
                }
                return (
                    <WorkshopDashboard
                        onTabChange={handleTabChange}
                        selectedBranchId={selectedBranch}
                        branches={activeBranches}
                        onLowStockAlertsChange={setDashboardLowStockCount}
                    />
                );
            case 'departments': return <WorkshopDepartments selectedBranchId={selectedBranch} branches={activeBranches} locale={locale} />;
            case 'catalog':
                return <Navigate to="/workshop/departments" replace />;
            case 'purchases':   return (
                <WorkshopPurchases
                    tabState={tabState}
                    clearTabState={() => setTabState(null)}
                    selectedBranchId={selectedBranch}
                    branches={activeBranches}
                    locale={locale}
                />
            );
            case 'approvals':
                return (
                    <WorkshopApprovals
                        selectedBranchId={selectedBranch}
                        branches={activeBranches}
                        branchLockedId={userBranchLock}
                        locale={locale}
                    />
                );
            case 'sales-returns': return <WorkshopSalesReturns selectedBranchId={selectedBranch} branches={activeBranches} locale={locale} />;
            case 'purchase-returns': return <WorkshopPurchaseReturns selectedBranchId={selectedBranch} branches={activeBranches} locale={locale} />;
            case 'discounts': return <WorkshopDiscounts selectedBranchId={selectedBranch} branches={activeBranches} locale={locale} />;
            case 'suppliers':   return <WorkshopSuppliers selectedBranchId={selectedBranch} branches={activeBranches} onTabChange={handleTabChange} locale={locale} />;
            case 'affiliated-suppliers':
                return (
                    <WorkshopAffiliatedSuppliers
                        selectedBranchId={selectedBranch}
                        branches={activeBranches}
                        onTabChange={handleTabChange}
                        locale={locale}
                    />
                );
            case 'non-affiliated-suppliers':
                return (
                    <WorkshopNonAffiliatedSuppliers
                        selectedBranchId={selectedBranch}
                        branches={activeBranches}
                        onTabChange={handleTabChange}
                        locale={locale}
                    />
                );
            case 'supplier-ledger':
                return (
                    <WorkshopSupplierLedger
                        tabState={tabState}
                        onTabChange={handleTabChange}
                    />
                );
            case 'reports':     return <WorkshopReports selectedBranchId={selectedBranch} branches={activeBranches} locale={locale} />;
            case 'advanced-reports':
                return <AdvancedReportsPage portal="workshop" selectedBranchId={selectedBranch} />;
            case 'advanced-reports-drilldown':
                return <AdvancedReportDrilldownPage portal="workshop" />;
            case 'pos-monitoring': return <WorkshopPosMonitoring selectedBranchId={selectedBranch} branches={activeBranches} locale={locale} />;
            case 'logs': return <WorkshopLogs selectedBranchId={selectedBranch} branches={activeBranches} locale={locale} />;
            case 'locker-management': return <WorkshopLockerManagement locale={locale} />;
            case 'catalog-new': return (
                <WorkshopCatalogNew
                    branches={activeBranches}
                    selectedBranchId={selectedBranch}
                    branchLockedId={userBranchLock}
                    allowAllBranches={hasFullBranchAccess}
                    locale={locale}
                />
            );
            case 'promo-codes': return <WorkshopPromoCodes selectedBranchId={selectedBranch} branches={activeBranches} locale={locale} />;
            case 'corporate-management': return <WorkshopCorporateManagement selectedBranchId={selectedBranch} branches={activeBranches} locale={locale} />;
            case 'branches':    return <WorkshopBranches selectedBranchId={selectedBranch} locale={locale} />;
            case 'commissions': return <WorkshopCommissions selectedBranchId={selectedBranch} branches={activeBranches} locale={locale} />;
            case 'my-petty-cash':
                return (
                    <WorkshopMyPettyCash
                        selectedBranchId={selectedBranch}
                        branches={activeBranches}
                        workshopId={user?.workshopId ? String(user.workshopId) : null}
                        locale={locale}
                    />
                );
            case 'inventory': return (
                <WorkshopInventory
                    selectedBranchId={selectedBranch}
                    branches={activeBranches}
                    selectedProducts={selectedProducts}
                    onTabChange={handleTabChange}
                    updateProductStatus={updateProductStatus}
                    locale={locale}
                />
            );
            default:            return (
                <WorkshopDashboard
                    onTabChange={handleTabChange}
                    selectedBranchId={selectedBranch}
                    branches={activeBranches}
                    onLowStockAlertsChange={setDashboardLowStockCount}
                    locale={locale}
                />
            );
        }
    };

    const navLabelFor = useCallback((id, fallback) => {
        if (id === 'dashboard') return lt('nav.dashboard');
        if (id === 'departments') return lt('nav.departments');
        if (id === 'catalog-new') return lt('nav.catalog');
        if (id === 'inventory') return lt('nav.inventory');
        if (id === 'purchases') return lt('nav.purchases');
        if (id === 'purchase-returns') return lt('nav.purchaseReturns');
        if (id === 'sales-returns') return lt('nav.salesReturns');
        if (id === 'discounts') return lt('nav.discounts');
        if (id === 'suppliers') return lt('nav.suppliers');
        if (id === 'affiliated-suppliers') return lt('nav.affiliatedSuppliers');
        if (id === 'non-affiliated-suppliers') return lt('nav.nonAffiliatedSuppliers');
        if (id === 'reports') return lt('nav.reports');
        if (id === 'pos-monitoring') return lt('nav.posMonitoring');
        if (id === 'logs') return lt('nav.logs');
        if (id === 'locker-management') return lt('nav.lockerManagement');
        if (id === 'employees') return lt('nav.employees');
        if (id === 'approvals') return lt('nav.approvals');
        if (id === 'my-petty-cash') return lt('nav.myPettyCash');
        if (id === 'staff-app') return lt('nav.staffApp');
        if (id === 'promo-codes') return lt('nav.promoCodes');
        if (id === 'corporate-management') return lt('nav.corporateManagement');
        if (id === 'commissions') return lt('nav.commissions');
        if (id === 'branches') return lt('nav.branches');
        if (id === 'accounting') return lt('nav.accounting');
        if (id === 'acc-chart') return accT(locale, 'tab.coa');
        if (id === 'acc-cash') return accT(locale, 'tab.cashBank');
        if (id === 'acc-transactions') return accT(locale, 'tab.transactions');
        if (id === 'acc-journal') return accT(locale, 'tab.journal');
        if (id === 'acc-expenses') return accT(locale, 'tab.expenses');
        if (id === 'acc-receipts') return accT(locale, 'tab.receipts');
        if (id === 'acc-payments') return accT(locale, 'tab.payments');
        if (id === 'acc-advances') return accT(locale, 'tab.advances');
        if (id === 'acc-payroll') return accT(locale, 'tab.payroll');
        if (id === 'acc-approvals') return accT(locale, 'tab.approvalLimits');
        if (id === 'acc-ledger') return accT(locale, 'tab.ledger');
        if (STAFF_APP_NAV_LABEL_KEYS[id]) return staffAppT(locale, STAFF_APP_NAV_LABEL_KEYS[id]);
        return fallback;
    }, [lt, locale]);

    const currentLabel =
        activeTab === 'supplier-ledger'
            ? lt('nav.supplierLedger')
            : activeTab === 'acc-ledger-statement'
                ? accT(locale, 'tab.ledger')
                : activeTab.startsWith('sap-')
                ? `${lt('nav.staffApp')} — ${navLabelFor(activeTab, '')}`
                : activeTab.startsWith('acc-')
                ? `${lt('nav.accounting')} — ${navLabelFor(activeTab, '')}`
                : navLabelFor(
                    activeTab,
                    NAV_ITEMS.flatMap(i => i.subItems ? [i, ...i.subItems] : [i]).find(n => n.id === activeTab)?.label || lt('nav.dashboard'),
                );
    const topbarSubtitle = activeTab === 'my-wallet'
        ? ''
        : activeTab === 'catalog-new'
            ? lt('nav.catalogSubtitle')
            : selectedBranchName;

    const isWalletTab = activeTab === 'my-wallet';

    if (activeTab === 'platform-chat') {
        return (
            <div className="portal-layout--chat-fullscreen" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
                <WorkshopPlatformChatPage />
            </div>
        );
    }

    return (
        <div
            className={`workshop-layout${isMobileMenuOpen ? ' mobile-menu-open' : ''}${isWalletTab ? ' workshop-layout--my-wallet' : ''}`}
            dir={locale === 'ar' ? 'rtl' : 'ltr'}
        >
            {isMobileMenuOpen && (
                <button
                    type="button"
                    className="ws-sidebar-overlay"
                    aria-label={lt('layout.closeNav')}
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}
            <aside className={`ws-sidebar${isMobileMenuOpen ? ' open' : ''}`}>
                <div className="ws-logo">
                    <div className="ws-logo-icon"><Building2 size={20}/></div>
                    <div>
                        <p className="ws-logo-title">{lt('layout.logoTitle')}</p>
                        <p className="ws-logo-sub">{lt('layout.logoSub')}</p>
                    </div>
                </div>
                {activeTab !== 'catalog-new' && !isWalletTab && activeBranches.length > 0 && (
                <div className="ws-branch-selector">
                    <select
                        className="ws-branch-select"
                        value={selectedBranch}
                        onChange={e => setSelectedBranch(e.target.value)}
                        disabled={!!userBranchLock}
                        title={userBranchLock ? lt('layout.branchScoped') : undefined}
                        style={{
                            opacity: userBranchLock ? 0.85 : 1,
                            cursor: userBranchLock ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {/* Hide "All Branches" when the user is locked to a single branch. */}
                        {!userBranchLock && !inventoryBranchOnly ? <option value="all">{lt('layout.allBranches')}</option> : null}
                        {activeBranches.map((branch) => (
                            <option key={branch.id} value={branch.id}>{branch.name}</option>
                        ))}
                    </select>
                </div>
                )}
                <nav className="ws-nav">
                    {visibleNavItems.map((item) => {
                        const hasSub = item.subItems?.length > 0;
                        const isOpen = openMenus[item.id];
                        const isActiveParent = activeTab === item.id || (hasSub && item.subItems.some(s => s.id === activeTab));
                        
                        return (
                            <div key={item.id} className="ws-nav-item-group">
                                <button 
                                    className={`ws-nav-btn ${isActiveParent ? 'active' : ''}`} 
                                    onClick={() => {
                                        if (hasSub) {
                                            toggleMenu(item.id);
                                        } else {
                                            handleTabChange(item.id);
                                        }
                                    }}
                                >
                                    <item.icon size={18} stroke="currentColor" />
                                    <span>{navLabelFor(item.id, item.label)}</span>
                                    {isPlatformChatNavId(item.id) && <PlatformChatNavBadge />}
                                    {hasSub && (
                                        <span style={{ marginLeft: 'auto', opacity: 0.5 }}>
                                            {isOpen ? <ChevronDown size={14} stroke="currentColor" /> : <ChevronRight size={14} stroke="currentColor" />}
                                        </span>
                                    )}
                                    {item.badge && pendingApprovals > 0 && (item.id === 'staff-app' || (!hasSub && item.badge)) && (
                                        <span className="ws-nav-badge">{pendingApprovals}</span>
                                    )}
                                </button>
                                {hasSub && (
                                    <AnimatePresence>
                                        {isOpen && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                style={{ overflow: 'hidden', paddingLeft: '28px', display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}
                                            >
                                                {item.subItems.map(sub => (
                                                    <button
                                                        key={sub.id}
                                                        className={`ws-nav-btn ws-nav-sub-btn ${activeTab === sub.id ? 'active' : ''}`}
                                                        onClick={() => handleTabChange(sub.id)}
                                                        style={{
                                                            padding: '10px 12px',
                                                            fontSize: '0.875rem',
                                                            textDecoration: activeTab === sub.id ? 'underline' : 'none',
                                                            border: 'none',
                                                            borderRadius: '6px',
                                                            textAlign: 'left',
                                                            cursor: 'pointer',
                                                            display: 'block',
                                                            opacity: activeTab === sub.id ? 1 : 0.7
                                                        }}
                                                    >
                                                        {navLabelFor(sub.id, sub.label)}
                                                    </button>
                                                ))}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                )}
                            </div>
                        );
                    })}
                    <div style={{ height: '40px', flexShrink: 0 }} />
                </nav>
                <div className="ws-user-footer">
                    <div className="ws-user-info">
                        <div className="ws-user-avatar">WA</div>
                        <div><p className="ws-user-name">Workshop Admin</p><p className="ws-user-role">Portal Manager</p></div>
                    </div>
                    <button type="button" className="ws-logout-btn" onClick={handleLogout} title="Log out">
                        <LogOut size={16} />
                    </button>
                </div>
            </aside>
            <div className="ws-main">
                <header className="ws-topbar">
                    <div className="ws-topbar-left">
                        <button
                            type="button"
                            className="ws-mobile-menu-toggle"
                            onClick={() => setIsMobileMenuOpen((open) => !open)}
                            aria-label={isMobileMenuOpen ? lt('layout.closeMenu') : lt('layout.openMenu')}
                            aria-expanded={isMobileMenuOpen}
                        >
                            {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
                        </button>
                        <div>
                            <p className="ws-topbar-title">{currentLabel}</p>
                            <p className="ws-topbar-sub">{topbarSubtitle}</p>
                        </div>
                    </div>
                    <div className="ws-topbar-right">
                        {dashboardLowStockCount > 0 && (
                            <button className="ws-alert-badge" onClick={() => setActiveTab('departments')}>
                                <AlertTriangle size={14}/>{' '}
                                {dashboardLowStockCount === 1
                                    ? lt('layout.stockAlert', { count: dashboardLowStockCount })
                                    : lt('layout.stockAlerts', { count: dashboardLowStockCount })}
                            </button>
                        )}
                        <div className="ws-lang-switcher" role="group" aria-label="Language">
                            <button
                                type="button"
                                className={`ws-lang-btn ${locale === 'en' ? 'active' : ''}`}
                                onClick={() => setLocale('en')}
                            >
                                EN
                            </button>
                            <button
                                type="button"
                                className={`ws-lang-btn ws-lang-btn-ar ${locale === 'ar' ? 'active' : ''}`}
                                onClick={() => setLocale('ar')}
                            >
                                العربية
                            </button>
                        </div>
                        <div className="ws-online-badge"><div className="ws-online-dot"/> {lt('layout.online')}</div>
                    </div>
                </header>
                {apiLoading && (
                    <div className="ws-global-loader" role="status" aria-live="polite">
                        <div className="ws-global-loader__inner">
                            <div className="ws-global-loader__spinner" aria-hidden="true" />
                            <span className="ws-global-loader__text">{lt('layout.loading')}</span>
                        </div>
                    </div>
                )}
                <main className={`ws-content${isWalletTab ? ' ws-content--my-wallet' : ''}`}>
                    {renderContent()}
                </main>
            </div>
            <PlatformChatFab
                hidden={activeTab === 'platform-chat'}
                onClick={() => handleTabChange('platform-chat')}
            />
        </div>
    );
}
