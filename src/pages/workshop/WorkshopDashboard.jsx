import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DollarSign, ShoppingCart, AlertTriangle, ClipboardCheck, Users, Package, Wrench, TrendingUp, Building2, RefreshCw } from 'lucide-react';
import { apiFetch } from '../../services/api';
import {
    getWorkshopTechnicians,
    unwrapWorkshopStaffList,
    normalizeWorkshopEmployee,
    flattenWorkshopStaffRow,
    getWorkshopStaffBranchProducts,
    unwrapWorkshopBranchListResponse,
    getWorkshopStaffProducts,
    qs,
    branchScopeParams,
} from '../../services/workshopStaffApi';
import { getMyProducts, getBranchProducts } from '../../services/workshopCatalogApi';
import { ShimmerKpiGrid, ShimmerListRows } from '../../components/supplier/Shimmer';

/** Match WorkshopDepartments — branch and union handlers can return different wrapper shapes. */
function extractProducts(res) {
    return unwrapWorkshopBranchListResponse(res, 'products');
}

function pickNumber(...vals) {
    for (const v of vals) {
        if (v == null || v === '') continue;
        const n = Number(v);
        if (Number.isFinite(n)) return n;
    }
    return 0;
}

function firstFiniteNumber(values) {
    for (const v of values) {
        if (v == null || v === '') continue;
        const n = Number(v);
        if (Number.isFinite(n)) return n;
    }
    return null;
}

function pickItemName(obj) {
    if (!obj || typeof obj !== 'object') return '';
    const candidates = [
        obj.name,
        obj.title,
        obj.label,
        obj.productName,
        obj.product_name,
        obj.serviceName,
        obj.service_name,
        obj.itemName,
        obj.item_name,
    ];
    for (const c of candidates) {
        if (c != null && String(c).trim() !== '') return String(c).trim();
    }
    const sku = obj.sku ?? obj.SKU;
    if (sku != null && String(sku).trim() !== '') return String(sku).trim();
    return '';
}

/** Branch rows may nest overrides under `product`; BE may use camelCase or snake_case. */
function normalizeCatalogRowForStock(row) {
    const master = row?.product || row;
    const openingBaseline = pickNumber(
        row?.openingQty,
        master?.openingQty,
        row?.opening_qty,
        master?.opening_qty,
    );
    const onHand = firstFiniteNumber([
        row?.currentQty,
        master?.currentQty,
        row?.current_qty,
        master?.current_qty,
        row?.qtyOnHand,
        master?.qtyOnHand,
        row?.qty_on_hand,
        master?.qty_on_hand,
        row?.stockQty,
        master?.stockQty,
        row?.stock_qty,
        master?.stock_qty,
    ]);
    const stock_qty = onHand !== null ? onHand : openingBaseline;
    const critical_level = pickNumber(
        row?.criticalStockPoint,
        master?.criticalStockPoint,
        row?.critical_stock_point,
        master?.critical_stock_point,
    );
    return {
        id: master?.id ?? row?.id,
        name: pickItemName(master) || pickItemName(row) || 'Unnamed',
        stock_qty,
        critical_level,
    };
}

/** Union ∪ branch alerts by product id; branch-specific row wins when both agree it's low (better qty display). */
function mergeLowStockAlerts(unionLow, branchLow) {
    const m = new Map();
    for (const p of unionLow) m.set(String(p.id), p);
    for (const p of branchLow) m.set(String(p.id), p);
    return [...m.values()];
}

export default function WorkshopDashboard({
    onTabChange,
    selectedBranchId = 'all',
    branches = [],
    onLowStockAlertsChange,
}) {
    const [dashboardData, setDashboardData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [lowStockProducts, setLowStockProducts] = useState([]);
    const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
    const [technicians, setTechnicians] = useState([]);
    const [techLoadError, setTechLoadError] = useState('');
    const [showAllTechnicians, setShowAllTechnicians] = useState(false);

    const loadDashboard = useCallback(async () => {
        setIsLoading(true);
        setLoadError('');
        try {
            const isAll = !selectedBranchId || selectedBranchId === 'all';
            const path = isAll
                ? '/workshop-staff/dashboard'
                : `/workshop-staff/dashboard?branchId=${encodeURIComponent(String(selectedBranchId))}`;
            const response = await apiFetch(path);
            if (response?.success) {
                setDashboardData(response);
                return;
            }
            throw new Error('Workshop dashboard response was invalid.');
        } catch (error) {
            setLoadError(error.message || 'Failed to load workshop dashboard.');
        } finally {
            setIsLoading(false);
        }
    }, [selectedBranchId]);

    const loadTechnicians = useCallback(async () => {
        setTechLoadError('');
        try {
            const isAll = !selectedBranchId || selectedBranchId === 'all';
            const params = isAll
                ? { isActive: 'true' }
                : { branchId: String(selectedBranchId) };
            const techRes = await getWorkshopTechnicians(params).catch(() => null);
            if (techRes == null) {
                setTechnicians([]);
                setTechLoadError('Could not load technicians (check GET /workshop-staff/technicians).');
                return;
            }
            const techList = unwrapWorkshopStaffList(techRes, 'technician').map((u) =>
                normalizeWorkshopEmployee(flattenWorkshopStaffRow(u, 'technician'), 'technician'),
            );
            setTechnicians(techList);
        } catch (error) {
            setTechnicians([]);
            setTechLoadError(error.message || 'Could not load technicians.');
        }
    }, [selectedBranchId]);

    useEffect(() => {
        loadDashboard();
    }, [loadDashboard]);

    useEffect(() => {
        loadTechnicians();
    }, [loadTechnicians]);

    /**
     * Low-stock KPI + list:
     * - All branches → `getWorkshopStaffProducts({ allBranches: true })`, fallback `getMyProducts()`.
     * - One branch → `getWorkshopStaffBranchProducts(id)`, fallback `getBranchProducts(id)`.
     *   (Same branch-specific source as Dept & Products / Inventory.)
     */
    const loadLowStockProducts = useCallback(async () => {
        const applyLowStockFilter = (rawProducts) => {
            const normalized = rawProducts.map(normalizeCatalogRowForStock);
            return normalized.filter((p) => p.critical_level > 0 && p.stock_qty <= p.critical_level);
        };

        try {
            const isAll = !selectedBranchId || selectedBranchId === 'all';
            if (isAll) {
                let response = null;
                try {
                    response = await getWorkshopStaffProducts({ allBranches: true });
                } catch {
                    response = null;
                }
                let raw = extractProducts(response);
                if (raw.length === 0) {
                    response = await getMyProducts().catch(() => null);
                    raw = extractProducts(response);
                }
                setLowStockProducts(applyLowStockFilter(raw));
                return;
            }

            const bid = String(selectedBranchId);
            let rawBranch = [];
            const branchRes = await getWorkshopStaffBranchProducts(bid).catch(() => null);
            if (branchRes) rawBranch = extractProducts(branchRes);
            if (rawBranch.length === 0) {
                const catalogBranchRes = await getBranchProducts(bid).catch(() => null);
                rawBranch = catalogBranchRes ? extractProducts(catalogBranchRes) : [];
            }
            setLowStockProducts(applyLowStockFilter(rawBranch));
        } catch {
            setLowStockProducts([]);
        }
    }, [selectedBranchId]);

    useEffect(() => {
        loadLowStockProducts();
    }, [loadLowStockProducts]);

    useEffect(() => {
        onLowStockAlertsChange?.(lowStockProducts.length);
    }, [lowStockProducts, onLowStockAlertsChange]);

    const loadPendingApprovalsCount = useCallback(async () => {
        try {
            const branch = branchScopeParams(selectedBranchId);
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
            setPendingApprovalsCount(petty + sup);
        } catch {
            setPendingApprovalsCount(0);
        }
    }, [selectedBranchId]);

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

    const toNumber = (value) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    };

    const todaySales = useMemo(() => toNumber(dashboardData?.totalSalesToday), [dashboardData]);
    const pendingInvoices = useMemo(() => toNumber(dashboardData?.pendingInvoicesCount), [dashboardData]);
    const purchaseCostToday = useMemo(
        () =>
            toNumber(
                dashboardData?.purchaseCostToday
                ?? dashboardData?.todayPurchaseCost
                ?? dashboardData?.totalPurchaseCostToday
                ?? dashboardData?.costOfGoodsSoldToday,
            ),
        [dashboardData],
    );
    const grossMarginProfit = useMemo(() => {
        const explicit = Number(dashboardData?.grossMarginProfit ?? dashboardData?.grossProfitToday);
        if (Number.isFinite(explicit)) return explicit;
        return todaySales - purchaseCostToday;
    }, [dashboardData, todaySales, purchaseCostToday]);
    // KPI low-stock list: staff union (`allBranches`) or per-branch `branchId` + branch-path products.
    // BE `getDashboard` now runs the same rule for `lowStockAlertsCount` (other
    // consumers, mobile, etc.); the FE keeps the number derived from the list
    // so the card and the widget never disagree even if one request lags.
    const lowStockAlertsCount = lowStockProducts.length;
    const dataScopeLabel = dashboardData?.dataScopeLabel || 'All Branches';
    const branchPerformance = dashboardData?.branchPerformance || [];

    const techniciansFiltered = useMemo(() => {
        if (!selectedBranchId || selectedBranchId === 'all') return technicians;
        const bn = branches.find((b) => String(b.id) === String(selectedBranchId))?.name;
        return technicians.filter(
            (t) =>
                String(t.branchId) === String(selectedBranchId) ||
                (bn && t.branch === bn),
        );
    }, [technicians, selectedBranchId, branches]);

    const techniciansByBranch = useMemo(() => {
        const m = new Map();
        for (const t of techniciansFiltered) {
            const key = t.branch && t.branch !== '—' ? t.branch : 'Unassigned';
            if (!m.has(key)) m.set(key, []);
            m.get(key).push(t);
        }
        return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    }, [techniciansFiltered]);
    const technicianRows = useMemo(() => {
        const rows = [];
        for (const [branchLabel, list] of techniciansByBranch) {
            for (const t of list) rows.push({ ...t, branchLabel });
        }
        return rows;
    }, [techniciansByBranch]);
    const techniciansVisible = useMemo(
        () => (showAllTechnicians ? technicianRows : technicianRows.slice(0, 2)),
        [showAllTechnicians, technicianRows],
    );
    const hasMoreTechnicians = technicianRows.length > 2;

    useEffect(() => {
        setShowAllTechnicians(false);
    }, [selectedBranchId, technicians.length]);
    const kpis = [
        { label: 'Total Sales Today', value: `SAR ${todaySales.toLocaleString()}`, iconClass: 'ws-kpi-icon--green', Icon: DollarSign },
        { label: 'Gross Margin Profit', value: `SAR ${grossMarginProfit.toLocaleString()}`, sub: 'Sales - Purchase Cost', iconClass: 'ws-kpi-icon--blue', Icon: TrendingUp },
        { label: 'Pending Invoices', value: pendingInvoices, iconClass: 'ws-kpi-icon--orange', Icon: ShoppingCart },
        { label: 'Low Stock Alerts', value: lowStockAlertsCount, sub: dataScopeLabel, iconClass: 'ws-kpi-icon--red', Icon: AlertTriangle },
        { label: 'Pending Approvals', value: pendingApprovalsCount, iconClass: 'ws-kpi-icon--purple', Icon: ClipboardCheck },
    ];
    const quickActions = [
        { label: 'Employee Management', tab: 'employees', Icon: Users },
        { label: 'Dept & Products', tab: 'departments', Icon: Package },
        { label: 'Approvals Queue', tab: 'approvals', badge: pendingApprovalsCount, Icon: ClipboardCheck },
        { label: 'Suppliers & Purchases', tab: 'suppliers', Icon: Wrench },
        { label: 'Reports & Analytics', tab: 'reports', Icon: TrendingUp },
        { label: 'Manage Branches', tab: 'branches', Icon: Building2 },
    ];
    return (
        <div>
            <div className="ws-page-header">
                <div><h2 className="ws-page-title">Workshop Dashboard</h2><p className="ws-page-sub">Live operational overview — Filter Car Services</p></div>
                <button
                    className="btn-portal"
                    onClick={() => {
                        loadDashboard();
                        loadLowStockProducts();
                        loadPendingApprovalsCount();
                        loadTechnicians();
                    }}
                    disabled={isLoading}
                >
                    <RefreshCw size={15}/> {isLoading ? 'Refreshing...' : 'Refresh'}
                </button>
            </div>
            {loadError && (
                <div className="ws-section" style={{ marginBottom: 16, padding: 12, color: '#B91C1C', borderColor: '#FECACA' }}>
                    {loadError}
                </div>
            )}
            {isLoading && !dashboardData ? (
                <div style={{ marginBottom: 24 }}>
                    <ShimmerKpiGrid cards={kpis.length} />
                </div>
            ) : (
                <div className="ws-kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                    {kpis.map(k => (
                        <div key={k.label} className="ws-kpi-card">
                            <div><p className="ws-kpi-label">{k.label}</p><p className="ws-kpi-value">{k.value}</p>{k.sub && <p className="ws-kpi-sub">{k.sub}</p>}</div>
                            <div className={`ws-kpi-icon ${k.iconClass}`}><k.Icon size={22}/></div>
                        </div>
                    ))}
                </div>
            )}
            <div className="ws-section" style={{ marginBottom: 16 }}>
                <div style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
                    <p style={{ fontWeight: 700, margin: 0 }}>Technicians by branch</p>
                    <span className="ws-badge ws-badge--blue">
                        {techniciansFiltered.length} technician{techniciansFiltered.length === 1 ? '' : 's'}
                        {selectedBranchId !== 'all' ? ' (filtered)' : ''}
                    </span>
                </div>
                {techLoadError && (
                    <p style={{ padding: '0 16px 12px', margin: 0, color: '#B91C1C', fontSize: '0.8125rem' }}>{techLoadError}</p>
                )}
                {isLoading && techniciansFiltered.length === 0 ? (
                    <div style={{ padding: '0 16px 16px' }}>
                        <ShimmerListRows rows={4} />
                    </div>
                ) : techniciansFiltered.length === 0 && !techLoadError ? (
                    <p style={{ padding: 16, color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>No technicians for this selection.</p>
                ) : (
                    <div style={{ padding: '0 16px 16px' }}>
                        {techniciansVisible.map((t) => (
                            <div
                                key={`${t.branchLabel}-${t.id}`}
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '8px 0',
                                    borderBottom: '1px solid var(--color-border-light)',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div
                                        style={{
                                            width: 28,
                                            height: 28,
                                            borderRadius: '50%',
                                            background: 'var(--color-bg-muted)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '0.75rem',
                                            fontWeight: 700,
                                        }}
                                    >
                                        {t.name?.[0] || 'T'}
                                    </div>
                                    <div>
                                        <p style={{ margin: 0, fontWeight: 600, fontSize: '0.875rem' }}>{t.name}</p>
                                        <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                            {t.branchLabel} · {((t.workshop_duty ? 'Workshop' : '') + (t.oncall_available ? ' + On-Call' : '') || '—')}
                                        </p>
                                    </div>
                                </div>
                                <span className={`ws-badge ${t.status === 'active' ? 'ws-badge--green' : 'ws-badge--gray'}`}>
                                    {t.status === 'active' ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                        ))}
                        {hasMoreTechnicians && (
                            <button
                                type="button"
                                className="btn-portal"
                                style={{ marginTop: 10, padding: '6px 12px', fontSize: '0.75rem' }}
                                onClick={() => setShowAllTechnicians((v) => !v)}
                            >
                                {showAllTechnicians ? 'View less' : `View more (${technicianRows.length - 2})`}
                            </button>
                        )}
                    </div>
                )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
                <div className="ws-section">
                    <div style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}><p style={{ fontWeight: 700, margin: 0 }}>Low Stock Products</p><span className="ws-badge ws-badge--red">{lowStockProducts.length} alerts</span></div>
                    {lowStockProducts.length === 0 ? <p style={{ padding: 16, color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>All stock levels are healthy</p> : (
                        <div style={{ padding: '0 16px 16px' }}>{lowStockProducts.slice(0, 4).map(p => (
                            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--color-border-light)' }}>
                                <p style={{ margin: 0, fontSize: '0.875rem' }}>{p.name}</p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{p.stock_qty} / {p.critical_level}</span><span className="ws-badge ws-badge--red">Low</span></div>
                            </div>
                        ))}</div>
                    )}
                </div>
                <div className="ws-section">
                    <div style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <p style={{ fontWeight: 700, margin: 0 }}>All Branches</p>
                        <span className="ws-badge ws-badge--blue">{branchPerformance.length} branches</span>
                    </div>
                    {branchPerformance.length === 0 ? (
                        <p style={{ padding: 16, color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>No branch performance available</p>
                    ) : (
                        <div style={{ padding: '0 16px 16px' }}>
                            {branchPerformance.slice(0, 5).map((branch) => (
                                <div key={branch.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--color-border-light)' }}>
                                    <div>
                                        <p style={{ margin: 0, fontWeight: 600, fontSize: '0.875rem' }}>{branch.name}</p>
                                        <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{branch.address || 'No address available'}</p>
                                    </div>
                                    <span className="ws-badge ws-badge--green">SAR {toNumber(branch.monthlySales).toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            <div className="ws-section">
                <p style={{ padding: '16px 16px 12px', fontWeight: 700, margin: 0 }}>Quick Actions</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, padding: 16 }}>
                    {quickActions.map(a => (
                        <div key={a.tab} className="ws-quick-card" onClick={() => onTabChange(a.tab)} style={{ position: 'relative' }}>
                            {a.badge > 0 && <span style={{ position: 'absolute', top: 8, right: 8, background: '#EF4444', color: '#fff', fontSize: 10, fontWeight: 800, width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{a.badge}</span>}
                            <div className="ws-quick-icon"><a.Icon size={22}/></div>
                            <p className="ws-quick-label">{a.label}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
