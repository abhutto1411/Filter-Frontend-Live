import { useState, useEffect, useCallback } from 'react';
import { Navigate, useNavigate, useOutletContext } from 'react-router-dom';
import {
    AlertCircle,
    Banknote,
    Building2,
    ClipboardList,
    Clock,
    FileText,
    Gift,
    GitBranch,
    Map,
    Package,
    Receipt,
    ShoppingCart,
    UserCheck,
    UserPlus,
    Users,
    Wallet,
    Wrench,
    Box,
    Building,
    Car,
    Truck,
    Warehouse,
    ChevronRight,
    AlertTriangle,
    CheckCircle2,
    ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { firstVisibleAdminPath } from '../../utils/permissions';
import { ShimmerKpiGrid, ShimmerListRows } from '../../components/supplier/Shimmer';
import '../../styles/admin/DashboardPage.css';
import { getStats, getSalesOrders, getProducts } from '../../services/superAdminApi';
import { list as listApprovals } from '../../services/approvalsApi';
import { dashT } from '../../utils/dashboardI18n';

const PRIMARY_STATS = [
    { key: 'workshops', labelKey: 'stat.workshops', icon: Wrench, tone: 'gold' },
    { key: 'branches', labelKey: 'stat.branches', icon: GitBranch, tone: 'blue' },
    { key: 'users', labelKey: 'stat.users', icon: Users, tone: 'violet' },
    { key: 'customers', labelKey: 'stat.customers', icon: UserCheck, tone: 'green' },
];

const SECONDARY_STATS = [
    { key: 'technicians', labelKey: 'stat.technicians', icon: Wrench },
    { key: 'cashiers', labelKey: 'stat.cashiers', icon: Wallet },
    { key: 'suppliers', labelKey: 'stat.suppliers', icon: Truck },
    { key: 'products', labelKey: 'stat.products', icon: Package },
    { key: 'services', labelKey: 'stat.services', icon: FileText },
    { key: 'invoices', labelKey: 'stat.invoices', icon: Receipt },
];

const PORTAL_ACCESS_ITEMS = [
    { titleKey: 'portal.locker', icon: Box, path: '/locker', requiresLogout: true },
    { titleKey: 'portal.workshop', icon: Building, path: '/workshop', requiresLogout: true },
    { titleKey: 'portal.pos', icon: ShoppingCart, path: '/pos', requiresLogout: true },
    { titleKey: 'portal.technician', icon: Wrench, path: '/technician', requiresLogout: true },
    { titleKey: 'portal.corporate', icon: Car, path: '/corporate', requiresLogout: true },
    { titleKey: 'portal.supplier', icon: Truck, path: '/supplier', requiresLogout: true },
    { titleKey: 'portal.warehouse', icon: Warehouse, path: '/supplier', requiresLogout: false },
    { titleKey: 'portal.marketing', icon: Gift, path: '/marketing/dashboard', requiresLogout: false },
    { titleKey: 'portal.referrer', icon: UserPlus, path: '/referrer-portal', requiresLogout: true },
];

const QUICK_ACTIONS = [
    { labelKey: 'quick.cashCollection', icon: Banknote, path: '/admin/accounting/cash-bank' },
    { labelKey: 'quick.approvals', icon: Clock, path: '/admin/approvals' },
    { labelKey: 'quick.pettyCash', icon: Wallet, path: '/admin/accounting/cash-bank' },
    { labelKey: 'quick.differences', icon: FileText, path: '/admin/accounting/cash-bank' },
    { labelKey: 'quick.workshopApprovals', icon: ClipboardList, path: '/admin/approvals' },
    { labelKey: 'quick.corporateSignups', icon: UserCheck, path: '/admin/approvals' },
    { labelKey: 'quick.technicians', icon: Users, path: '/admin/employees' },
    { labelKey: 'quick.zones', icon: Map, path: '/admin/zone-management' },
];

function formatOrderDate(raw, locale) {
    if (!raw) return '—';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US', {
        month: 'short',
        day: '2-digit',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
}

function formatSar(value, t) {
    if (value == null || value === '') return '—';
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    const amount = n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return t('money.sar', { amount });
}

function orderStatusClass(status) {
    const s = String(status ?? '').toLowerCase();
    if (['completed', 'paid', 'delivered', 'closed'].includes(s)) return 'status-completed';
    if (['pending', 'draft', 'open'].includes(s)) return 'status-pending';
    if (['cancelled', 'canceled', 'rejected'].includes(s)) return 'status-cancelled';
    if (['processing', 'in_progress', 'in-progress'].includes(s)) return 'status-processing';
    return 'status-neutral';
}

function PanelEmpty({ icon: Icon, message, hint }) {
    return (
        <div className="sa-dash-panel-empty">
            <Icon size={28} strokeWidth={1.25} />
            <p>{message}</p>
            {hint ? <span>{hint}</span> : null}
        </div>
    );
}

export default function DashboardPage() {
    const navigate = useNavigate();
    const outletCtx = useOutletContext() || {};
    const locale =
        outletCtx.locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => dashT(locale, key, vars), [locale]);
    const { user, hasPermission } = useAuth();
    const canView = hasPermission('dashboard.view');

    const [stats, setStats] = useState(null);
    const [statsLoading, setStatsLoading] = useState(true);
    const [recentOrders, setRecentOrders] = useState([]);
    const [lowStock, setLowStock] = useState([]);
    const [pendingApprovals, setPendingApprovals] = useState([]);
    const [panelLoading, setPanelLoading] = useState(true);

    useEffect(() => {
        if (!canView) return;
        setStatsLoading(true);
        getStats()
            .then((d) => setStats(d?.totals ?? d))
            .catch(() => setStats(null))
            .finally(() => setStatsLoading(false));
    }, [canView]);

    useEffect(() => {
        if (!canView) return;
        let cancelled = false;
        setPanelLoading(true);
        Promise.all([
            getSalesOrders({ limit: 5 })
                .then((r) => (Array.isArray(r) ? r : (r?.items ?? r?.data ?? r?.salesOrders ?? [])))
                .catch(() => []),
            getProducts({})
                .then((r) => (Array.isArray(r) ? r : (r?.items ?? r?.products ?? r?.data ?? [])))
                .catch(() => []),
            listApprovals({ status: 'pending', limit: 5 })
                .then((r) => (Array.isArray(r) ? r : (r?.items ?? r?.approvals ?? r?.data ?? [])))
                .catch(() => []),
        ])
            .then(([orders, products, approvals]) => {
                if (cancelled) return;
                setRecentOrders(orders.slice(0, 5));
                const low = products
                    .filter((p) => {
                        const stock = Number(p.stockQty ?? p.stock_qty ?? p.stock ?? 0);
                        const reorder = Number(
                            p.reorderLevel ?? p.reorder_level ?? p.criticalLevel ?? p.critical_level ?? 0,
                        );
                        return reorder > 0 && stock <= reorder;
                    })
                    .slice(0, 5);
                setLowStock(low);
                setPendingApprovals(approvals.slice(0, 5));
            })
            .finally(() => {
                if (!cancelled) setPanelLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [canView]);

    if (!canView) {
        return <Navigate to={firstVisibleAdminPath(user)} replace />;
    }

    const pendingCount = panelLoading ? null : pendingApprovals.length;

    return (
        <div className="sa-dashboard module-container">
            <section className="sa-card sa-portals-section">
                <div className="sa-portals-head">
                    <h3 className="sa-card-title">{t('portals.title')}</h3>
                    <span className="sa-portals-hint">{t('portals.hint')}</span>
                </div>
                <div className="sa-portal-tiles">
                    {PORTAL_ACCESS_ITEMS.map((item) => {
                        const title = t(item.titleKey);
                        return (
                            <button
                                key={item.titleKey}
                                type="button"
                                className="sa-portal-tile"
                                title={title}
                                onClick={() => {
                                    if (item.requiresLogout) {
                                        navigate(`${item.path}/login`, { state: { forceLogout: true } });
                                    } else {
                                        navigate(item.path);
                                    }
                                }}
                            >
                                <span className="sa-portal-tile-icon">
                                    <item.icon size={20} />
                                </span>
                                <span className="sa-portal-tile-label">{title}</span>
                                <ExternalLink size={11} className="sa-portal-tile-ext" />
                            </button>
                        );
                    })}
                </div>
            </section>

            {/* Metrics */}
            <section className="sa-metrics-board">
                {statsLoading ? (
                    <ShimmerKpiGrid cards={4} />
                ) : (
                    <div className="sa-metrics-primary">
                        {PRIMARY_STATS.map((item) => (
                            <div key={item.key} className={`sa-metric-card sa-metric-card--${item.tone}`}>
                                <span className={`sa-metric-icon sa-metric-icon--${item.tone}`}>
                                    <item.icon size={20} />
                                </span>
                                <div>
                                    <p className="sa-metric-label">{t(item.labelKey)}</p>
                                    <p className="sa-metric-value">{stats?.[item.key] ?? '0'}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="sa-metrics-secondary">
                    {SECONDARY_STATS.map((item) => (
                        <div key={item.key} className="sa-metric-mini">
                            <item.icon size={15} className="sa-metric-mini-icon" />
                            <span className="sa-metric-mini-label">{t(item.labelKey)}</span>
                            <span className="sa-metric-mini-value">
                                {statsLoading ? '—' : (stats?.[item.key] ?? '0')}
                            </span>
                        </div>
                    ))}
                </div>
            </section>

            {/* Alerts strip */}
            <div className="sa-alerts-strip">
                <button type="button" className="sa-alert-chip sa-alert-chip--orders" onClick={() => navigate('/admin/sales-orders')}>
                    <ShoppingCart size={16} />
                    <span>
                        <strong>{statsLoading ? '—' : (stats?.salesOrders ?? '0')}</strong> {t('alert.salesOrders')}
                    </span>
                </button>
                <button type="button" className="sa-alert-chip sa-alert-chip--approvals" onClick={() => navigate('/admin/approvals')}>
                    <AlertCircle size={16} />
                    <span>
                        <strong>{pendingCount ?? '—'}</strong> {t('alert.pendingApprovals')}
                    </span>
                    <ChevronRight size={14} />
                </button>
                {!panelLoading && lowStock.length > 0 ? (
                    <button
                        type="button"
                        className="sa-alert-chip sa-alert-chip--stock"
                        onClick={() => navigate('/admin/inventory/products-services')}
                    >
                        <AlertTriangle size={16} />
                        <span>
                            <strong>{lowStock.length}</strong> {t('alert.lowStock')}
                        </span>
                        <ChevronRight size={14} />
                    </button>
                ) : null}
            </div>

            {/* Activity panels — main focus */}
            <div className="sa-panels-grid">
                <div className="sa-dash-panel">
                    <div className="sa-dash-panel-head">
                        <div className="sa-dash-panel-title-wrap">
                            <span className="sa-dash-panel-icon sa-dash-panel-icon--orders">
                                <ShoppingCart size={17} />
                            </span>
                            <h4>{t('panel.recentOrders')}</h4>
                        </div>
                        <button type="button" className="sa-panel-link" onClick={() => navigate('/admin/sales-orders')}>
                            {t('panel.viewAll')}
                        </button>
                    </div>
                    {panelLoading ? (
                        <ShimmerListRows rows={5} />
                    ) : recentOrders.length === 0 ? (
                        <PanelEmpty icon={ShoppingCart} message={t('panel.noRecentOrders')} />
                    ) : (
                        <ul className="sa-panel-list">
                            {recentOrders.map((o) => {
                                const num = o.orderNumber ?? o.order_number ?? o.invoiceNumber ?? o.id ?? '—';
                                const dt = o.createdAt ?? o.created_at ?? o.orderDate ?? o.invoiceDate ?? o.invoice_date;
                                const total = o.grandTotal ?? o.grand_total ?? o.totalAmount ?? o.total_amount ?? o.total;
                                const status = String(o.status ?? o.workflowStatus ?? 'pending').toLowerCase();
                                return (
                                    <li key={o.id ?? num} className="sa-panel-row">
                                        <div className="sa-panel-row-main">
                                            <span className="sa-panel-row-title">{num}</span>
                                            <span className="sa-panel-row-meta">
                                                {formatOrderDate(dt, locale)} · {formatSar(total, t)}
                                            </span>
                                        </div>
                                        <span className={`sa-status-pill ${orderStatusClass(status)}`}>
                                            {status.replace(/_/g, ' ')}
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                <div className="sa-dash-panel">
                    <div className="sa-dash-panel-head">
                        <div className="sa-dash-panel-title-wrap">
                            <span className="sa-dash-panel-icon sa-dash-panel-icon--stock">
                                <AlertTriangle size={17} />
                            </span>
                            <h4>{t('panel.lowStock')}</h4>
                        </div>
                        <button
                            type="button"
                            className="sa-panel-link"
                            onClick={() => navigate('/admin/inventory/products-services')}
                        >
                            {t('panel.manage')}
                        </button>
                    </div>
                    {panelLoading ? (
                        <ShimmerListRows rows={5} />
                    ) : lowStock.length === 0 ? (
                        <PanelEmpty
                            icon={CheckCircle2}
                            message={t('panel.stockHealthy')}
                            hint={t('panel.stockHealthyHint')}
                        />
                    ) : (
                        <ul className="sa-panel-list">
                            {lowStock.map((p) => {
                                const name = p.name ?? p.productName ?? p.product_name ?? '—';
                                const stock = Number(p.stockQty ?? p.stock_qty ?? p.stock ?? 0);
                                const reorder = Number(
                                    p.reorderLevel ?? p.reorder_level ?? p.criticalLevel ?? p.critical_level ?? 0,
                                );
                                return (
                                    <li key={p.id ?? name} className="sa-panel-row">
                                        <div className="sa-panel-row-main">
                                            <span className="sa-panel-row-title">{name}</span>
                                            <span className="sa-panel-row-meta">
                                                {t('panel.stockLeft', { stock, reorder })}
                                            </span>
                                        </div>
                                        <span className="sa-status-pill status-low">{t('panel.low')}</span>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                <div className="sa-dash-panel">
                    <div className="sa-dash-panel-head">
                        <div className="sa-dash-panel-title-wrap">
                            <span className="sa-dash-panel-icon sa-dash-panel-icon--approvals">
                                <ClipboardList size={17} />
                            </span>
                            <h4>{t('panel.approvals')}</h4>
                        </div>
                        <button type="button" className="sa-panel-link" onClick={() => navigate('/admin/approvals')}>
                            {t('panel.reviewAll')}
                        </button>
                    </div>
                    {panelLoading ? (
                        <ShimmerListRows rows={5} />
                    ) : pendingApprovals.length === 0 ? (
                        <PanelEmpty
                            icon={CheckCircle2}
                            message={t('panel.allClear')}
                            hint={t('panel.noPending')}
                        />
                    ) : (
                        <ul className="sa-panel-list">
                            {pendingApprovals.map((a) => {
                                const type = String(a.entityType ?? a.type ?? 'item').replace(/_/g, ' ');
                                const desc =
                                    a.title ??
                                    a.description ??
                                    a.name ??
                                    a.entityName ??
                                    t('panel.typePending', { type });
                                const amt = a.amount ?? a.total ?? a.grandTotal ?? a.grand_total;
                                return (
                                    <li key={`${a.entityType ?? type}-${a.id}`} className="sa-approval-row">
                                        <span className="sa-approval-type">{type}</span>
                                        <p className="sa-approval-desc">{desc}</p>
                                        {amt != null && amt !== '' ? (
                                            <span className="sa-approval-amount">{formatSar(amt, t)}</span>
                                        ) : null}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </div>

            {/* Actions + shortcuts */}
            <div className="sa-lower-grid">
                <section className="sa-card sa-quick-section">
                    <h3 className="sa-card-title">{t('quick.title')}</h3>
                    <div className="sa-quick-grid">
                        {QUICK_ACTIONS.map((action) => (
                            <button
                                key={action.labelKey}
                                type="button"
                                className="sa-quick-btn"
                                onClick={() => navigate(action.path)}
                            >
                                <action.icon size={15} />
                                <span>{t(action.labelKey)}</span>
                            </button>
                        ))}
                    </div>
                </section>

                <section className="sa-card sa-shortcuts-section">
                    <h3 className="sa-card-title">{t('shortcuts.title')}</h3>
                    <button
                        type="button"
                        className="sa-shortcut-row"
                        onClick={() => navigate('/admin/inventory/products-services')}
                    >
                        <span className="sa-shortcut-icon sa-shortcut-icon--blue">
                            <Package size={18} />
                        </span>
                        <span className="sa-shortcut-text">
                            <strong>{t('shortcuts.catalogues')}</strong>
                            <span>{t('shortcuts.cataloguesHint')}</span>
                        </span>
                        <ChevronRight size={16} />
                    </button>
                    <button
                        type="button"
                        className="sa-shortcut-row"
                        onClick={() => navigate('/admin/customers/all-customers')}
                    >
                        <span className="sa-shortcut-icon sa-shortcut-icon--violet">
                            <Building2 size={18} />
                        </span>
                        <span className="sa-shortcut-text">
                            <strong>{t('shortcuts.corporate')}</strong>
                            <span>{t('shortcuts.corporateHint')}</span>
                        </span>
                        <ChevronRight size={16} />
                    </button>
                </section>
            </div>
        </div>
    );
}
