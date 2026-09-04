import React, { useCallback, useState, useEffect } from 'react';
import {
    Package,
    FileText,
    BarChart3,
    DollarSign,
    Warehouse,
    Eye,
    ShoppingCart,
    ChevronRight,
    Boxes,
} from 'lucide-react';
import {
    getSupplierDashboard,
    getSupplierReportsQuickSummary,
    listSupplierCashBankAccounts,
    listSupplierWorkshopPurchaseInvoices,
} from '../../services/supplierApi';
import { listStorageBrands } from '../../services/storageFacilityApi';
import {
    normalizeWorkshopSupplierPurchaseInvoiceRow,
    unwrapWorkshopSupplierPurchaseInvoiceList,
} from '../../services/workshopSupplierPurchaseInvoices';
import { ShimmerKpiGrid, ShimmerTable } from '../../components/supplier/Shimmer';
import { sdashT } from '../../utils/supplierDashboardI18n';

const ORDER_SUMMARY_STAGE_IDS = [
    'pending_acceptance',
    'accepted',
    'processing',
    'ready_to_dispatch',
    'dispatched',
    'delivered',
];

const STAGE_LABEL_KEYS = {
    pending_acceptance: 'stage.pending',
    accepted: 'stage.accepted',
    processing: 'stage.processing',
    ready_to_dispatch: 'stage.readyToDeliver',
    dispatched: 'stage.onTheWay',
    delivered: 'stage.delivered',
};

/** Workshop PI `status` → same pipeline bucket as branch POs (Order Queue). */
function wpiStatusToPipelineId(status) {
    const s = String(status || '').toLowerCase();
    if (s === 'pending') return 'pending_acceptance';
    if (s === 'approved') return 'accepted';
    if (s === 'processing') return 'processing';
    if (s === 'ready_to_dispatch') return 'ready_to_dispatch';
    if (s === 'on_the_way') return 'dispatched';
    if (s === 'delivered') return 'delivered';
    return null;
}

function workshopInvoiceStatusBadge(status) {
    const s = String(status || '').toLowerCase();
    if (s === 'rejected') return 'ws-badge--gray';
    if (s === 'pending') return 'ws-badge--yellow';
    if (s === 'delivered' || s === 'approved') return 'ws-badge--green';
    return 'ws-badge--yellow';
}

function workshopInvoiceStatusLabel(status, t) {
    const s = String(status || '').toLowerCase();
    if (s === 'on_the_way') return t('status.onTheWay');
    const key = `status.${s}`;
    const translated = t(key);
    if (translated !== key) return translated;
    return s.replace(/_/g, ' ');
}

export default function SupplierDashboard({ onTabChange, locale: localeProp }) {
    const locale =
        localeProp ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => sdashT(locale, key, vars), [locale]);

    const [loading, setLoading] = useState(true);
    const [apiError, setApiError] = useState('');
    const [dashboardData, setDashboardData] = useState(null);
    const [recentWorkshopInvoices, setRecentWorkshopInvoices] = useState([]);
    /** Normalized WPI rows for pipeline counts (up to API limit). */
    const [wpiRowsForPipeline, setWpiRowsForPipeline] = useState([]);
    const [cashTotal, setCashTotal] = useState(null);
    const [reportsPartialError, setReportsPartialError] = useState('');
    const [storageBrandCount, setStorageBrandCount] = useState(null);
    const [storageArTotal, setStorageArTotal] = useState(null);

    const formatCurrency = (amount) =>
        t('money.sar', {
            amount: Number(amount || 0).toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
            }),
        });

    const dataReady = !loading && !apiError && dashboardData != null;

    const totalAR = dataReady ? Number(dashboardData.receivables?.total ?? 0) : null;
    const totalAP = dataReady
        ? Number(dashboardData.reports?.summary?.totalPayables ?? 0)
        : null;

    const totalCash =
        dataReady && cashTotal != null ? Number(cashTotal) : dataReady ? 0 : null;

    const orderSummary = ORDER_SUMMARY_STAGE_IDS.map((id) => {
        const label = t(STAGE_LABEL_KEYS[id]);
        if (loading && !apiError) {
            return { id, label, count: t('ellipsis') };
        }
        if (apiError) {
            return { id, label, count: t('emdash') };
        }
        const source = dashboardData?.orderStatusSummary;
        const countMap = source
            ? {
                  pending_acceptance: Number(source.pending ?? 0),
                  accepted: Number(source.accepted ?? 0),
                  processing: Number(source.processing ?? 0),
                  ready_to_dispatch: Number(source.readyToDeliver ?? 0),
                  dispatched: Number(source.onTheWay ?? 0),
                  delivered: Number(source.delivered ?? 0),
              }
            : {
                  pending_acceptance: 0,
                  accepted: 0,
                  processing: 0,
                  ready_to_dispatch: 0,
                  dispatched: 0,
                  delivered: 0,
              };
        const po = countMap[id] ?? 0;
        const wpi = Array.isArray(wpiRowsForPipeline)
            ? wpiRowsForPipeline.filter((r) => wpiStatusToPipelineId(r?.status) === id).length
            : 0;
        return { id, label, count: po + wpi };
    });

    const criticalStock =
        dataReady && Array.isArray(dashboardData?.criticalStockAlerts?.alerts)
            ? dashboardData.criticalStockAlerts.alerts.map((alert) => ({
                  id: `${alert.supplierProductId}-${alert.supplierLocationId}`,
                  name: alert.productName,
                  qty: alert.current,
                  unit: alert.unit,
                  critical: alert.critical,
                  locationName: alert.locationName,
              }))
            : [];

    const formatKpiValue = (val) => {
        if (loading) return t('ellipsis');
        if (apiError) return t('emdash');
        if (val == null) return t('emdash');
        return typeof val === 'number' ? formatCurrency(val) : String(val);
    };

    const pendingAcceptanceDisplay =
        orderSummary.find((s) => s.id === 'pending_acceptance')?.count ?? t('emdash');

    /** Top-row KPIs aligned with supplier dashboard reference (4 cards only). */
    const kpis = [
        {
            key: 'new_pos',
            label: t('kpi.newPos'),
            value: pendingAcceptanceDisplay,
            sub: t('kpi.newPosSub'),
            subAction: () => onTabChange('order_queue'),
            icon: Package,
            c: 'ws-kpi-icon--dark',
        },
        {
            key: 'ar',
            label: t('kpi.ar'),
            value: formatKpiValue(totalAR),
            sub: t('kpi.arSub'),
            subAction: () => onTabChange('sales_invoices'),
            icon: FileText,
            c: 'ws-kpi-icon--dark',
        },
        {
            key: 'ap',
            label: t('kpi.ap'),
            value: formatKpiValue(totalAP),
            sub: t('kpi.apSub'),
            subAction: () => onTabChange('purchase_invoices'),
            icon: BarChart3,
            c: 'ws-kpi-icon--dark',
        },
        {
            key: 'cash',
            label: t('kpi.cash'),
            value: formatKpiValue(totalCash),
            sub: t('kpi.cashSub'),
            subAction: () => onTabChange('cash_bank'),
            icon: DollarSign,
            c: 'ws-kpi-icon--dark',
        },
    ];

    useEffect(() => {
        let cancelled = false;
        const loadDashboard = async () => {
            setLoading(true);
            setApiError('');
            setReportsPartialError('');
            try {
                const [dashResult, wpiResult, reportsResult, cashResult] = await Promise.allSettled([
                    getSupplierDashboard(),
                    listSupplierWorkshopPurchaseInvoices({ limit: 500, offset: 0 }),
                    getSupplierReportsQuickSummary(),
                    listSupplierCashBankAccounts(),
                ]);

                if (cancelled) return;

                if (dashResult.status === 'rejected') {
                    console.error('Supplier dashboard API failed:', dashResult.reason);
                    setApiError(dashResult.reason?.message || t('error.load'));
                    setDashboardData(null);
                    setRecentWorkshopInvoices([]);
                    setWpiRowsForPipeline([]);
                    setCashTotal(null);
                    return;
                }

                const dashboardRes = dashResult.value;
                const wpiRes = wpiResult.status === 'fulfilled' ? wpiResult.value : null;
                const reportsRes = reportsResult.status === 'fulfilled' ? reportsResult.value : null;
                const cashRes = cashResult.status === 'fulfilled' ? cashResult.value : null;

                if (reportsResult.status === 'rejected') {
                    setReportsPartialError(
                        reportsResult.reason?.message || t('error.reportsPartial'),
                    );
                }

                const accounts = Array.isArray(cashRes?.accounts) ? cashRes.accounts : [];
                const cashSum = accounts.reduce((s, a) => s + Number(a.balance ?? 0), 0);

                setCashTotal(Number.isFinite(cashSum) ? cashSum : 0);
                setDashboardData({
                    ...dashboardRes,
                    reports: reportsRes,
                });
                const wpiList = unwrapWorkshopSupplierPurchaseInvoiceList(wpiRes ?? {});
                const wpiNorm = wpiList.map(normalizeWorkshopSupplierPurchaseInvoiceRow).filter(Boolean);
                setWpiRowsForPipeline(wpiNorm);
                setRecentWorkshopInvoices(wpiNorm.slice(0, 10));

                listStorageBrands()
                    .then((sf) => {
                        const brands = sf?.brands ?? [];
                        setStorageBrandCount(brands.length);
                        const arSum = brands.reduce(
                            (s, b) => s + Number(b.arBalance ?? 0),
                            0,
                        );
                        setStorageArTotal(arSum);
                    })
                    .catch(() => {
                        setStorageBrandCount(0);
                        setStorageArTotal(0);
                    });
            } catch (err) {
                if (!cancelled) {
                    console.error('Supplier dashboard load failed:', err);
                    setApiError(err?.message || t('error.load'));
                    setDashboardData(null);
                    setRecentWorkshopInvoices([]);
                    setWpiRowsForPipeline([]);
                    setCashTotal(null);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        loadDashboard();
        return () => {
            cancelled = true;
        };
    }, [t]);

    const storageArFormatted = t('money.sar', {
        amount: Number(storageArTotal || 0).toLocaleString(),
    });

    return (
        <div>
            <div className="ws-page-header">
                <div>
                    <h2 className="ws-page-title">{t('title')}</h2>
                    <p className="ws-page-sub">{t('subtitle')}</p>
                </div>
            </div>
            {apiError ? (
                <div className="theme-alert">
                    <strong>{t('error.backend')}</strong> {apiError}
                </div>
            ) : null}
            {reportsPartialError && !apiError ? (
                <div className="theme-callout" style={{ marginBottom: 12 }}>
                    {reportsPartialError} {t('error.reportsHint')}
                </div>
            ) : null}
            {loading && !apiError ? (
                <ShimmerKpiGrid cards={4} />
            ) : (
                <>
                    <div
                        className="ws-kpi-grid"
                        style={{
                            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                            marginBottom: 20,
                            gap: 16,
                        }}
                    >
                        {kpis.map((k) => (
                            <div key={k.key} className="ws-kpi-card">
                                <div>
                                    <p className="ws-kpi-label">{k.label}</p>
                                    <p className="ws-kpi-value">{k.value}</p>
                                    {k.subAction ? (
                                        <button
                                            type="button"
                                            onClick={k.subAction}
                                            className="theme-link-btn"
                                            style={{ fontSize: '0.8125rem', marginTop: 4 }}
                                        >
                                            {k.sub}
                                        </button>
                                    ) : (
                                        <p className="ws-kpi-sub">{k.sub}</p>
                                    )}
                                </div>
                                <div className={`ws-kpi-icon ${k.c}`}>
                                    <k.icon size={22} />
                                </div>
                            </div>
                        ))}
                    </div>
                    {storageBrandCount != null && storageBrandCount > 0 ? (
                        <div
                            className="ws-section"
                            style={{
                                marginBottom: 16,
                                padding: '14px 18px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                flexWrap: 'wrap',
                                gap: 12,
                            }}
                        >
                            <div>
                                <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9375rem' }}>
                                    {t('storage.title')}
                                </p>
                                <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: '#64748b' }}>
                                    {storageBrandCount === 1
                                        ? t('storage.brandsAr', {
                                              count: storageBrandCount,
                                              amount: storageArFormatted,
                                          })
                                        : t('storage.brandsArPlural', {
                                              count: storageBrandCount,
                                              amount: storageArFormatted,
                                          })}
                                </p>
                            </div>
                            <button
                                type="button"
                                className="theme-action-btn theme-action-btn--dark"
                                onClick={() => onTabChange('storage_facility')}
                            >
                                {t('storage.manage')}
                            </button>
                        </div>
                    ) : null}
                </>
            )}
            {criticalStock.length > 0 && (
                <div className="ws-section" style={{ marginBottom: 20 }}>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '16px 20px',
                            borderBottom: '1px solid var(--color-border-light)',
                        }}
                    >
                        <p style={{ fontWeight: 600, fontSize: '1rem', color: '#DC2626', margin: 0 }}>
                            {t('critical.title', { count: criticalStock.length })}
                        </p>
                        <button
                            type="button"
                            className="theme-link-btn"
                            style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}
                            onClick={() => onTabChange('stock')}
                        >
                            {t('critical.viewInventory')} <ChevronRight size={14} />
                        </button>
                    </div>
                    <div>
                        {criticalStock.slice(0, 5).map((p, i) => (
                            <div
                                key={p.id}
                                style={{
                                    padding: '12px 20px',
                                    borderBottom:
                                        i < Math.min(5, criticalStock.length) - 1
                                            ? '1px solid var(--color-border-light)'
                                            : 'none',
                                }}
                            >
                                <p
                                    style={{
                                        fontWeight: 600,
                                        fontSize: '0.875rem',
                                        margin: 0,
                                        color: '#23262D',
                                    }}
                                >
                                    {p.name}
                                </p>
                                <p
                                    style={{
                                        fontSize: '0.75rem',
                                        color: 'var(--color-text-muted)',
                                        margin: '4px 0 0 0',
                                    }}
                                >
                                    {t('critical.detail', {
                                        qty: Number(p.qty ?? 0).toLocaleString(),
                                        unit: p.unit,
                                        critical: Number(p.critical ?? 0).toLocaleString(),
                                    })}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            <div className="ws-section" style={{ marginBottom: 0, padding: 12, borderRadius: 16 }}>
                <p
                    style={{
                        fontWeight: 600,
                        fontSize: '0.8125rem',
                        color: 'var(--color-text-muted)',
                        margin: '0 0 8px 4px',
                    }}
                >
                    {t('quick.title')}
                </p>
                <div
                    className="theme-quick-actions"
                    style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 8,
                    }}
                >
                    {[
                        { label: t('quick.orderQueue'), tab: 'order_queue', icon: Package },
                        { label: t('quick.stock'), tab: 'stock', icon: Warehouse },
                        { label: t('quick.salesInvoices'), tab: 'sales_invoices', icon: FileText },
                        { label: t('quick.purchaseInvoices'), tab: 'purchase_invoices', icon: ShoppingCart },
                        { label: t('quick.staff'), tab: 'employees', icon: Eye },
                        { label: t('quick.accounting'), tab: 'accounting', icon: BarChart3 },
                        { label: t('quick.storage'), tab: 'storage_facility', icon: Boxes },
                    ].map((a) => (
                        <button
                            key={a.tab}
                            type="button"
                            onClick={() => onTabChange(a.tab)}
                            className="btn-portal-outline theme-quick-actions__btn"
                            style={{
                                justifyContent: 'flex-start',
                                textAlign: 'left',
                                fontSize: '0.8125rem',
                                padding: '10px 18px',
                                height: 44,
                                borderRadius: 9999,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                            }}
                        >
                            <a.icon size={18} />
                            {a.label}
                        </button>
                    ))}
                </div>
            </div>
            <div className="ws-section" style={{ marginTop: 20 }}>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '16px 20px',
                        borderBottom: '1px solid var(--color-border-light)',
                    }}
                >
                    <p style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--color-text-dark)', margin: 0 }}>
                        {t('recent.title')}
                    </p>
                    <button
                        type="button"
                        onClick={() => onTabChange('workshop_purchase_invoices')}
                        className="theme-link-btn"
                        style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                        {t('recent.viewAll')} <ChevronRight size={14} />
                    </button>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    {loading && !apiError ? (
                        <ShimmerTable rows={6} columns={9} />
                    ) : apiError ? (
                        <p className="theme-alert" style={{ textAlign: 'center', padding: 32, margin: 0 }}>
                            {t('error.workshopOrders', { error: apiError })}
                        </p>
                    ) : (
                        <table className="ws-table">
                            <thead>
                                <tr>
                                    <th>{t('th.invoice')}</th>
                                    <th>{t('th.vendorRef')}</th>
                                    <th>{t('th.issueDate')}</th>
                                    <th>{t('th.product')}</th>
                                    <th>{t('th.qty')}</th>
                                    <th>{t('th.unit')}</th>
                                    <th>{t('th.unitPrice')}</th>
                                    <th>{t('th.total')}</th>
                                    <th>{t('th.status')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentWorkshopInvoices.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={9}
                                            style={{
                                                textAlign: 'center',
                                                padding: 32,
                                                color: 'var(--color-text-muted)',
                                            }}
                                        >
                                            {t('recent.empty')}
                                        </td>
                                    </tr>
                                ) : (
                                    recentWorkshopInvoices.map((r) => (
                                        <tr key={r.id}>
                                            <td>
                                                <strong className="theme-invoice-id">{r.invoice_number}</strong>
                                            </td>
                                            <td style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                                                {r.vendor_invoice_ref || t('emdash')}
                                            </td>
                                            <td style={{ fontSize: '0.8125rem' }}>{r.date || t('emdash')}</td>
                                            <td
                                                style={{
                                                    fontSize: '0.8125rem',
                                                    maxWidth: 240,
                                                    color: 'var(--color-text-muted)',
                                                    lineHeight: 1.35,
                                                }}
                                                title={r.product_label ?? t('emdash')}
                                            >
                                                {r.product_label ?? t('emdash')}
                                            </td>
                                            <td style={{ fontSize: '0.8125rem' }}>{r.quantity_label ?? t('emdash')}</td>
                                            <td style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                                                {r.unit_label ?? t('emdash')}
                                            </td>
                                            <td style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                                                {r.primary_unit_price != null &&
                                                Number.isFinite(Number(r.primary_unit_price)) ? (
                                                    t('money.sar', {
                                                        amount: Number(r.primary_unit_price).toLocaleString(
                                                            undefined,
                                                            {
                                                                minimumFractionDigits: 2,
                                                                maximumFractionDigits: 2,
                                                            },
                                                        ),
                                                    })
                                                ) : (
                                                    t('emdash')
                                                )}
                                            </td>
                                            <td>
                                                <strong>
                                                    {formatCurrency(r.grand_total ?? 0)}
                                                </strong>
                                            </td>
                                            <td>
                                                <span className={`ws-badge ${workshopInvoiceStatusBadge(r.status)}`}>
                                                    {workshopInvoiceStatusLabel(r.status, t)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
