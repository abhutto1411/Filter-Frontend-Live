import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Building2, LogOut, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    NAV_ITEMS,
} from './workshop/constants';
import WorkshopDashboard from './workshop/WorkshopDashboard';
import WorkshopEmployees from './workshop/WorkshopEmployees';
import WorkshopDepartments from './workshop/WorkshopDepartments';
import WorkshopCatalogNew from './workshop/WorkshopCatalogNew';
import WorkshopPurchases from './workshop/WorkshopPurchases';
import WorkshopApprovals from './workshop/WorkshopApprovals';
import WorkshopSalesReturns from './workshop/WorkshopSalesReturns';
import WorkshopSuppliers from './workshop/WorkshopSuppliers';
import WorkshopReports from './workshop/WorkshopReports';
import WorkshopPosMonitoring from './workshop/WorkshopPosMonitoring';
import WorkshopLockerManagement from './workshop/WorkshopLockerManagement';
import WorkshopPromoCodes from './workshop/WorkshopPromoCodes';
import WorkshopCorporateManagement from './workshop/WorkshopCorporateManagement';
import WorkshopBranches from './workshop/WorkshopBranches';
import WorkshopCommissions from './workshop/WorkshopCommissions';
import WorkshopMyPettyCash from './workshop/WorkshopMyPettyCash';
import WorkshopInventory from './workshop/WorkshopInventory';
import WorkshopAccountingPage from './workshop/WorkshopAccountingPage';
import WorkshopAffiliatedSuppliers from './workshop/WorkshopAffiliatedSuppliers';
import WorkshopNonAffiliatedSuppliers from './workshop/WorkshopNonAffiliatedSuppliers';
import WorkshopSupplierLedger from './workshop/WorkshopSupplierLedger';
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
import './workshop/Workshop.css';
import '../styles/admin/AccountingPage.css';
import '../styles/admin/ApprovalsPage.css';

/** Tabs reachable by in-app navigation but not listed in the sidebar. */
const WORKSHOP_INTERNAL_TABS = new Set(['supplier-ledger']);

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
                    const visibleSubs = item.subItems.filter((s) => !s.permission || hasPermission(s.permission));
                    return visibleSubs.length > 0 ? { ...item, subItems: visibleSubs } : null;
                }
                if (item.permission && !hasPermission(item.permission)) return null;
                return item;
            })
            .filter(Boolean),
        [hasPermission],
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

        if (main === 'accounting' && sub) {
            const mapping = {
                'chart-of-accounts': 'acc-chart',
                'cash-bank': 'acc-cash',
                'transactions': 'acc-transactions',
                'journal-entries': 'acc-journal',
                'expenses': 'acc-expenses',
                'receipts': 'acc-receipts',
                'payments': 'acc-payments',
                'advances': 'acc-advances',
                'payroll': 'acc-payroll',
                'approvals': 'acc-approvals',
                'ledger': 'acc-ledger',
            };
            return mapping[sub] || 'acc-cash';
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
        setActiveTab(tabId);
        setTabState(state);
        
        if (tabId.startsWith('acc-')) {
            const reverseMapping = {
                'acc-chart': 'chart-of-accounts',
                'acc-cash': 'cash-bank',
                'acc-transactions': 'transactions',
                'acc-journal': 'journal-entries',
                'acc-expenses': 'expenses',
                'acc-receipts': 'receipts',
                'acc-payments': 'payments',
                'acc-advances': 'advances',
                'acc-payroll': 'payroll',
                'acc-approvals': 'approvals',
                'acc-ledger': 'ledger',
            };
            navigate(`/workshop/accounting/${reverseMapping[tabId]}`);
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

    const [openMenus, setOpenMenus] = useState({ accounting: activeTab.startsWith('acc-') });

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
            case 'acc-cash':          
            case 'acc-commissions':
            case 'acc-referral':
            case 'acc-transactions':  
            case 'acc-journal':       
            case 'acc-expenses':      
            case 'acc-receipts':      
            case 'acc-payments':      
            case 'acc-advances':      
            case 'acc-payroll':       
            case 'acc-approvals':     
            case 'acc-ledger':        return <WorkshopAccountingPage activeTab={activeTab} selectedBranchId={selectedBranch} branches={activeBranches} />;
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
            case 'employees':   return <WorkshopEmployees selectedBranchId={selectedBranch} branches={activeBranches} />;
            case 'departments': return <WorkshopDepartments selectedBranchId={selectedBranch} branches={activeBranches} />;
            case 'catalog':
                return <Navigate to="/workshop/departments" replace />;
            case 'purchases':   return (
                <WorkshopPurchases
                    tabState={tabState}
                    clearTabState={() => setTabState(null)}
                    selectedBranchId={selectedBranch}
                    branches={activeBranches}
                />
            );
            case 'approvals':   return (
                <WorkshopApprovals
                    selectedBranchId={selectedBranch}
                    branches={activeBranches}
                    branchLockedId={userBranchLock}
                />
            );
           
            case 'sales-returns': return <WorkshopSalesReturns selectedBranchId={selectedBranch} branches={activeBranches} />;
            case 'suppliers':   return <WorkshopSuppliers selectedBranchId={selectedBranch} branches={activeBranches} onTabChange={handleTabChange} />;
            case 'affiliated-suppliers':
                return (
                    <WorkshopAffiliatedSuppliers
                        selectedBranchId={selectedBranch}
                        branches={activeBranches}
                        onTabChange={handleTabChange}
                    />
                );
            case 'non-affiliated-suppliers':
                return (
                    <WorkshopNonAffiliatedSuppliers
                        selectedBranchId={selectedBranch}
                        branches={activeBranches}
                        onTabChange={handleTabChange}
                    />
                );
            case 'supplier-ledger':
                return (
                    <WorkshopSupplierLedger
                        tabState={tabState}
                        onTabChange={handleTabChange}
                    />
                );
            case 'reports':     return <WorkshopReports selectedBranchId={selectedBranch} branches={activeBranches} />;
            case 'pos-monitoring': return <WorkshopPosMonitoring selectedBranchId={selectedBranch} branches={activeBranches} />;
            case 'locker-management': return <WorkshopLockerManagement />;
            case 'catalog-new': return (
                <WorkshopCatalogNew
                    branches={activeBranches}
                    selectedBranchId={selectedBranch}
                    branchLockedId={userBranchLock}
                    allowAllBranches={hasFullBranchAccess}
                />
            );
            case 'promo-codes': return <WorkshopPromoCodes selectedBranchId={selectedBranch} branches={activeBranches} />;
            case 'corporate-management': return <WorkshopCorporateManagement selectedBranchId={selectedBranch} branches={activeBranches} />;
            case 'branches':    return <WorkshopBranches selectedBranchId={selectedBranch} />;
            case 'commissions': return <WorkshopCommissions selectedBranchId={selectedBranch} branches={activeBranches} />;
            case 'my-petty-cash': return <WorkshopMyPettyCash selectedBranchId={selectedBranch} />;
            case 'inventory': return (
                <WorkshopInventory
                    selectedBranchId={selectedBranch}
                    branches={activeBranches}
                    selectedProducts={selectedProducts}
                    onTabChange={handleTabChange}
                    updateProductStatus={updateProductStatus}
                />
            );
            default:            return (
                <WorkshopDashboard
                    onTabChange={handleTabChange}
                    selectedBranchId={selectedBranch}
                    branches={activeBranches}
                    onLowStockAlertsChange={setDashboardLowStockCount}
                />
            );
        }
    };

    const currentLabel =
        activeTab === 'supplier-ledger'
            ? 'Supplier Ledger'
            : NAV_ITEMS.flatMap(i => i.subItems ? [i, ...i.subItems] : [i]).find(n => n.id === activeTab)?.label || 'Dashboard';
    const topbarSubtitle = activeTab === 'catalog-new' ? 'Corporate master catalog' : selectedBranchName;

    return (
        <div className="workshop-layout">
            <aside className="ws-sidebar">
                <div className="ws-logo">
                    <div className="ws-logo-icon"><Building2 size={20}/></div>
                    <div><p className="ws-logo-title">Filter Admin Workshop</p><p className="ws-logo-sub">Portal</p></div>
                </div>
                {activeTab !== 'catalog-new' && activeBranches.length > 0 && (
                <div className="ws-branch-selector">
                    <select
                        className="ws-branch-select"
                        value={selectedBranch}
                        onChange={e => setSelectedBranch(e.target.value)}
                        disabled={!!userBranchLock}
                        title={userBranchLock ? 'You are scoped to a single branch by your role' : undefined}
                        style={{
                            opacity: userBranchLock ? 0.85 : 1,
                            cursor: userBranchLock ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {/* Hide "All Branches" when the user is locked to a single branch. */}
                        {!userBranchLock && !inventoryBranchOnly ? <option value="all">All Branches</option> : null}
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
                                    <span>{item.label}</span>
                                    {hasSub && (
                                        <span style={{ marginLeft: 'auto', opacity: 0.5 }}>
                                            {isOpen ? <ChevronDown size={14} stroke="currentColor" /> : <ChevronRight size={14} stroke="currentColor" />}
                                        </span>
                                    )}
                                    {item.badge && pendingApprovals > 0 && !hasSub && <span className="ws-nav-badge">{pendingApprovals}</span>}
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
                                                        {sub.label}
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
                    <div><p className="ws-topbar-title">{currentLabel}</p><p className="ws-topbar-sub">{topbarSubtitle}</p></div>
                    <div className="ws-topbar-right">
                        {dashboardLowStockCount > 0 && (
                            <button className="ws-alert-badge" onClick={() => setActiveTab('departments')}>
                                <AlertTriangle size={14}/> {dashboardLowStockCount} stock alert{dashboardLowStockCount > 1 ? 's' : ''}
                            </button>
                        )}
                        <div className="ws-online-badge"><div className="ws-online-dot"/> Online</div>
                    </div>
                </header>
                <main className="ws-content">
                    {apiLoading && (
                        <div className="ws-global-loader" role="status" aria-live="polite">
                            <div className="ws-global-loader__spinner" />
                            <span>Loading...</span>
                        </div>
                    )}
                    {renderContent()}
                </main>
            </div>
        </div>
    );
}
