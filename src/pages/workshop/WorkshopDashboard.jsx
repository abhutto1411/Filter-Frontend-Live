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
import { wsDashT } from '../../utils/workshopDashboardI18n';
import {
    riyadhRangeToApiIso,
    fmtRiyadhRangeLabel,
} from '../../utils/riyadhBusinessRange';

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
        row?.opening_qty,
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
        row?.critical_stock_point,
    );
    return {
        id: master?.id ?? row?.id,
        name: pickItemName(master) || pickItemName(row) || '',
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
    locale: localeProp,
}) {
    const locale = localeProp || (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) || 'en';
    const t = useCallback((key, vars) => wsDashT(locale, key, vars), [locale]);

    const [dashboardData, setDashboardData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [rangeError, setRangeError] = useState('');
    const [lowStockProducts, setLowStockProducts] = useState([]);
    const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
    const [technicians, setTechnicians] = useState([]);
    const [techLoadError, setTechLoadError] = useState('');
    const [showAllTechnicians, setShowAllTechnicians] = useState(false);
    // Draft = inputs; applied = what the API uses. Empty = default (today / month).
    const [draftRangeFrom, setDraftRangeFrom] = useState('');
    const [draftRangeTo, setDraftRangeTo] = useState('');
    const [appliedRangeFrom, setAppliedRangeFrom] = useState('');
    const [appliedRangeTo, setAppliedRangeTo] = useState('');

    const rangeDirty =
        draftRangeFrom !== appliedRangeFrom || draftRangeTo !== appliedRangeTo;
    const hasAppliedRange = Boolean(appliedRangeFrom && appliedRangeTo);

    const loadDashboard = useCallback(async () => {
        setIsLoading(true);
        setLoadError('');
        try {
            const isAll = !selectedBranchId || selectedBranchId === 'all';
            const params = {};
            if (!isAll) params.branchId = String(selectedBranchId);
            if (appliedRangeFrom && appliedRangeTo) {
                const iso = riyadhRangeToApiIso(appliedRangeFrom, appliedRangeTo);
                params.startDate = iso.startDate;
                params.endDate = iso.endDate;
                params.dateFrom = iso.dateFrom;
                params.dateTo = iso.dateTo;
            }
            const path = `/workshop-staff/dashboard${qs(params)}`;
            const response = await apiFetch(path);
            if (response?.success) {
                setDashboardData(response);
                return;
            }
            throw new Error(t('error.invalid'));
        } catch (error) {
            setLoadError(error.message || t('error.load'));
        } finally {
            setIsLoading(false);
        }
    }, [selectedBranchId, appliedRangeFrom, appliedRangeTo, t]);

    const applyDateRange = useCallback(() => {
        setRangeError('');
        const from = String(draftRangeFrom || '').trim();
        const to = String(draftRangeTo || '').trim();
        if (!from && !to) {
            setAppliedRangeFrom('');
            setAppliedRangeTo('');
            return;
        }
        if (!from || !to) {
            setRangeError(t('error.rangeBoth'));
            return;
        }
        try {
            riyadhRangeToApiIso(from, to);
        } catch (e) {
            setRangeError(e?.message || t('error.rangeInvalid'));
            return;
        }
        setAppliedRangeFrom(from);
        setAppliedRangeTo(to);
    }, [draftRangeFrom, draftRangeTo, t]);

    const clearDateRange = useCallback(() => {
        setRangeError('');
        setDraftRangeFrom('');
        setDraftRangeTo('');
        setAppliedRangeFrom('');
        setAppliedRangeTo('');
    }, []);

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
                setTechLoadError(t('error.techLoad'));
                return;
            }
            const techList = unwrapWorkshopStaffList(techRes, 'technician').map((u) =>
                normalizeWorkshopEmployee(flattenWorkshopStaffRow(u, 'technician'), 'technician'),
            );
            setTechnicians(techList);
        } catch (error) {
            setTechnicians([]);
            setTechLoadError(error.message || t('error.techFail'));
        }
    }, [selectedBranchId, t]);

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
    const rawScope = dashboardData?.dataScopeLabel || '';
    const dataScopeLabel =
        !rawScope || /^all\s*branches$/i.test(String(rawScope).trim())
            ? t('layout.allBranches')
            : rawScope;
    const branchPerformance = dashboardData?.branchPerformance || [];

    const techniciansFiltered = useMemo(() => {
        if (!selectedBranchId || selectedBranchId === 'all') return technicians;
        const bn = branches.find((b) => String(b.id) === String(selectedBranchId))?.name;
        return technicians.filter(
            (tRow) =>
                String(tRow.branchId) === String(selectedBranchId) ||
                (bn && tRow.branch === bn),
        );
    }, [technicians, selectedBranchId, branches]);

    const techniciansByBranch = useMemo(() => {
        const m = new Map();
        for (const tech of techniciansFiltered) {
            const key =
                tech.branch && tech.branch !== '—'
                    ? tech.branch
                    : t('tech.unassigned');
            if (!m.has(key)) m.set(key, []);
            m.get(key).push(tech);
        }
        return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    }, [techniciansFiltered, t]);
    const technicianRows = useMemo(() => {
        const rows = [];
        for (const [branchLabel, list] of techniciansByBranch) {
            for (const tech of list) rows.push({ ...tech, branchLabel });
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

    const dutyLabel = (tech) => {
        if (tech.workshop_duty && tech.oncall_available) return t('tech.workshopOnCall');
        if (tech.workshop_duty) return t('tech.workshop');
        if (tech.oncall_available) return t('tech.onCall');
        return '—';
    };

    const kpis = [
        {
            label: hasAppliedRange ? t('kpi.salesInRange') : t('kpi.salesToday'),
            value: t('money.sar', { amount: todaySales.toLocaleString() }),
            sub: hasAppliedRange
                ? t('kpi.periodSub', {
                    from: fmtRiyadhRangeLabel(appliedRangeFrom),
                    to: fmtRiyadhRangeLabel(appliedRangeTo),
                })
                : undefined,
            iconClass: 'ws-kpi-icon--green',
            Icon: DollarSign,
        },
        {
            label: t('kpi.grossMargin'),
            value: t('money.sar', { amount: grossMarginProfit.toLocaleString() }),
            sub: hasAppliedRange
                ? t('kpi.grossMarginSubInclVatRange')
                : t('kpi.grossMarginSubInclVatMonth'),
            iconClass: 'ws-kpi-icon--blue',
            Icon: TrendingUp,
        },
        {
            label: t('kpi.pendingInvoices'),
            value: pendingInvoices,
            iconClass: 'ws-kpi-icon--orange',
            Icon: ShoppingCart,
        },
        {
            label: t('kpi.lowStock'),
            value: lowStockAlertsCount,
            sub: dataScopeLabel,
            iconClass: 'ws-kpi-icon--red',
            Icon: AlertTriangle,
        },
        {
            label: t('kpi.pendingApprovals'),
            value: pendingApprovalsCount,
            iconClass: 'ws-kpi-icon--purple',
            Icon: ClipboardCheck,
        },
    ];
    const quickActions = [
        { label: t('quick.employees'), tab: 'employees', Icon: Users },
        { label: t('quick.departments'), tab: 'departments', Icon: Package },
        { label: t('quick.approvals'), tab: 'approvals', badge: pendingApprovalsCount, Icon: ClipboardCheck },
        { label: t('quick.suppliers'), tab: 'suppliers', Icon: Wrench },
        { label: t('quick.reports'), tab: 'reports', Icon: TrendingUp },
        { label: t('quick.branches'), tab: 'branches', Icon: Building2 },
    ];
    return (
        <div>
            <div className="ws-page-header">
                <div>
                    <h2 className="ws-page-title">{t('title')}</h2>
                    <p className="ws-page-sub">{t('subtitle')}</p>
                </div>
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
                    <RefreshCw size={15}/> {isLoading ? t('refreshing') : t('refresh')}
                </button>
            </div>

            <div className="ws-reports-filters" style={{ marginBottom: 16 }}>
                <div className="ws-filter-group">
                    <div className="ws-date-input-group">
                        <input
                            type="datetime-local"
                            value={draftRangeFrom}
                            onChange={(e) => setDraftRangeFrom(e.target.value)}
                            step={60}
                            aria-label={t('label.fromDatetime')}
                            title="Asia/Riyadh"
                        />
                        <span className="ws-text-dim">{t('label.to')}</span>
                        <input
                            type="datetime-local"
                            value={draftRangeTo}
                            onChange={(e) => setDraftRangeTo(e.target.value)}
                            step={60}
                            aria-label={t('label.toDatetime')}
                            title="Asia/Riyadh"
                        />
                    </div>
                    {rangeDirty ? (
                        <button
                            type="button"
                            className="ws-btn-refresh"
                            onClick={applyDateRange}
                            disabled={isLoading}
                        >
                            {isLoading ? t('btn.loading') : t('btn.apply')}
                        </button>
                    ) : null}
                    {hasAppliedRange ? (
                        <button
                            type="button"
                            className="btn-portal"
                            onClick={clearDateRange}
                            disabled={isLoading}
                            style={{ padding: '6px 12px', fontSize: '0.8125rem' }}
                        >
                            {t('btn.clearRange')}
                        </button>
                    ) : null}
                </div>
                <div className="ws-text-dim" style={{ fontSize: '0.75rem', marginTop: 4 }}>
                    {t('hint.riyadhDatetime')}
                </div>
                {rangeError ? (
                    <div style={{ color: '#B91C1C', fontSize: 13, marginTop: 6 }}>{rangeError}</div>
                ) : null}
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
                    <p style={{ fontWeight: 700, margin: 0 }}>{t('tech.title')}</p>
                    <span className="ws-badge ws-badge--blue">
                        {techniciansFiltered.length === 1
                            ? t('tech.count', { count: techniciansFiltered.length })
                            : t('tech.countPlural', { count: techniciansFiltered.length })}
                        {selectedBranchId !== 'all' ? t('tech.filtered') : ''}
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
                    <p style={{ padding: 16, color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>{t('tech.empty')}</p>
                ) : (
                    <div style={{ padding: '0 16px 16px' }}>
                        {techniciansVisible.map((tech) => (
                            <div
                                key={`${tech.branchLabel}-${tech.id}`}
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
                                        {tech.name?.[0] || 'T'}
                                    </div>
                                    <div>
                                        <p style={{ margin: 0, fontWeight: 600, fontSize: '0.875rem' }}>{tech.name}</p>
                                        <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                            {tech.branchLabel} · {dutyLabel(tech)}
                                        </p>
                                    </div>
                                </div>
                                <span className={`ws-badge ${tech.status === 'active' ? 'ws-badge--green' : 'ws-badge--gray'}`}>
                                    {tech.status === 'active' ? t('tech.active') : t('tech.inactive')}
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
                                {showAllTechnicians
                                    ? t('tech.viewLess')
                                    : t('tech.viewMore', { count: technicianRows.length - 2 })}
                            </button>
                        )}
                    </div>
                )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
                <div className="ws-section">
                    <div style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <p style={{ fontWeight: 700, margin: 0 }}>{t('lowStock.title')}</p>
                        <span className="ws-badge ws-badge--red">{t('lowStock.alerts', { count: lowStockProducts.length })}</span>
                    </div>
                    {lowStockProducts.length === 0 ? (
                        <p style={{ padding: 16, color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>{t('lowStock.healthy')}</p>
                    ) : (
                        <div style={{ padding: '0 16px 16px' }}>
                            {lowStockProducts.slice(0, 4).map((p) => (
                                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--color-border-light)' }}>
                                    <p style={{ margin: 0, fontSize: '0.875rem' }}>{p.name || t('lowStock.unnamed')}</p>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{p.stock_qty} / {p.critical_level}</span>
                                        <span className="ws-badge ws-badge--red">{t('lowStock.badge')}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="ws-section">
                    <div style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <p style={{ fontWeight: 700, margin: 0 }}>
                            {hasAppliedRange ? t('branches.titleFiltered') : t('branches.title')}
                        </p>
                        <span className="ws-badge ws-badge--blue">{t('branches.count', { count: branchPerformance.length })}</span>
                    </div>
                    {branchPerformance.length === 0 ? (
                        <p style={{ padding: 16, color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>{t('branches.empty')}</p>
                    ) : (
                        <div style={{ padding: '0 16px 16px' }}>
                            {branchPerformance.slice(0, 5).map((branch) => (
                                <div key={branch.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--color-border-light)' }}>
                                    <div>
                                        <p style={{ margin: 0, fontWeight: 600, fontSize: '0.875rem' }}>{branch.name}</p>
                                        <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{branch.address || t('branches.noAddress')}</p>
                                    </div>
                                    <span className="ws-badge ws-badge--green">{t('money.sar', { amount: toNumber(branch.monthlySales).toLocaleString() })}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            <div className="ws-section">
                <p style={{ padding: '16px 16px 12px', fontWeight: 700, margin: 0 }}>{t('quick.title')}</p>
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
