import { useState, useEffect, useCallback } from 'react';
import { Navigate, useNavigate, useOutletContext } from 'react-router-dom';
import {
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
    CheckCircle2,
    ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { firstVisibleAdminPath } from '../../utils/permissions';
import '../../styles/ui.css';
import { getStats, getSalesOrders, getProducts } from '../../services/superAdminApi';
import { list as listApprovals } from '../../services/approvalsApi';
import { dashT } from '../../utils/dashboardI18n';

/** The four figures that define the platform's size — they get real cards. */
const PRIMARY_STATS = [
    { key: 'workshops', labelKey: 'stat.workshops', icon: Wrench },
    { key: 'branches', labelKey: 'stat.branches', icon: GitBranch },
    { key: 'users', labelKey: 'stat.users', icon: Users },
    { key: 'customers', labelKey: 'stat.customers', icon: UserCheck },
];

/** Everything else that deserves a number but not a card. */
const SECONDARY_STATS = [
    { key: 'technicians', labelKey: 'stat.technicians', icon: Wrench },
    { key: 'cashiers', labelKey: 'stat.cashiers', icon: Wallet },
    { key: 'suppliers', labelKey: 'stat.suppliers', icon: Truck },
    { key: 'products', labelKey: 'stat.products', icon: Package },
    { key: 'services', labelKey: 'stat.services', icon: FileText },
    { key: 'invoices', labelKey: 'stat.invoices', icon: Receipt },
    { key: 'salesOrders', labelKey: 'stat.salesOrders', icon: ShoppingCart },
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
    { labelKey: 'shortcuts.catalogues', icon: Package, path: '/admin/inventory/products-services' },
    { labelKey: 'shortcuts.corporate', icon: Building2, path: '/admin/customers/all-customers' },
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

/** Order status → the system's one pill vocabulary. */
function orderStatusTone(status) {
    const s = String(status ?? '').toLowerCase();
    if (['completed', 'paid', 'delivered', 'closed'].includes(s)) return 'ok';
    if (['cancelled', 'canceled', 'rejected'].includes(s)) return 'dang';
    if (['processing', 'in_progress', 'in-progress'].includes(s)) return 'info';
    if (['pending', 'draft', 'open'].includes(s)) return 'warn';
    return 'neutral';
}

/** One skeleton bar. */
function Sk({ shape = 'text', w, style }) {
    return <div className={`ui-sk ui-sk--${shape}${w ? ` ui-sk--w${w}` : ''}`} style={style} />;
}

function PanelEmpty({ icon: Icon, title, sub }) {
    return (
        <div className="ui-empty">
            <span className="ui-empty-icon">
                <Icon size={18} strokeWidth={1.6} />
            </span>
            <p className="ui-empty-title">{title}</p>
            {sub ? <p className="ui-empty-sub">{sub}</p> : null}
        </div>
    );
}

/** Panel shell — header with an optional count and a link, then a body. */
function Panel({ title, count, actionLabel, onAction, children }) {
    return (
        <section className="ui-panel">
            <div className="ui-panel-head">
                <span className="ui-panel-title">{title}</span>
                {count ? <span className="ui-tab-count">{count}</span> : null}
                <button type="button" className="ui-btn ui-btn--subtle ui-btn--sm ui-panel-end" onClick={onAction}>
                    {actionLabel}
                </button>
            </div>
            <div className="ui-panel-body">{children}</div>
        </section>
    );
}

/** Loading body for a panel: staggered rows rather than one blank block. */
function PanelSkeleton({ rows = 5 }) {
    return (
        <ul className="ui-list">
            {Array.from({ length: rows }, (_, i) => (
                <li className="ui-list-row ui-sk-row" key={i}>
                    <div className="ui-list-main">
                        <Sk shape="strong" w={i % 2 ? 55 : 70} />
                        <Sk shape="text" w={40} style={{ marginTop: 6 }} />
                    </div>
                    <Sk shape="pill" />
                </li>
            ))}
        </ul>
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

    const openPortal = (item) => {
        if (item.requiresLogout) {
            navigate(`${item.path}/login`, { state: { forceLogout: true } });
        } else {
            navigate(item.path);
        }
    };

    return (
        <div className="ui-root ui-root--flush">
            {/* Portals — the arrow marks the ones that need a separate session */}
            <div className="ui-band">
                <div className="ui-band-head">
                    <h2>{t('portals.title')}</h2>
                </div>
                <div className="ui-tiles">
                    {PORTAL_ACCESS_ITEMS.map((item) => {
                        const title = t(item.titleKey);
                        return (
                            <button
                                key={item.titleKey}
                                type="button"
                                className="ui-tile"
                                title={title}
                                onClick={() => openPortal(item)}
                            >
                                <span className="ui-tile-icon">
                                    <item.icon size={19} />
                                </span>
                                <span className="ui-tile-label">{title}</span>
                                {item.requiresLogout ? <ExternalLink size={11} className="ui-tile-ext" /> : null}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Headline figures */}
            <div className="ui-band">
                <div className="ui-kpis">
                    {PRIMARY_STATS.map((item) => (
                        <div key={item.key} className="ui-metric">
                            <span className="ui-metric-icon">
                                <item.icon size={62} strokeWidth={1.25} />
                            </span>
                            <p className="ui-metric-label">{t(item.labelKey)}</p>
                            {statsLoading ? (
                                <Sk shape="title" w={40} />
                            ) : (
                                <p className="ui-metric-value">{stats?.[item.key] ?? '0'}</p>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Supporting counts */}
            <div className="ui-band">
                <div className="ui-stat-strip">
                    {SECONDARY_STATS.map((item) => (
                        <div key={item.key} className="ui-stat">
                            <span className="ui-stat-icon">
                                <item.icon size={15} />
                            </span>
                            <span className="ui-stat-label">{t(item.labelKey)}</span>
                            {statsLoading ? (
                                <Sk shape="text" style={{ marginInlineStart: 'auto', width: 28 }} />
                            ) : (
                                <span className="ui-stat-value">{stats?.[item.key] ?? '0'}</span>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Working lists */}
            <div className="ui-band">
                <div className="ui-panels">
                    <Panel
                        title={t('panel.recentOrders')}
                        actionLabel={t('panel.viewAll')}
                        onAction={() => navigate('/admin/sales-orders')}
                    >
                        {panelLoading ? (
                            <PanelSkeleton />
                        ) : recentOrders.length === 0 ? (
                            <PanelEmpty icon={ShoppingCart} title={t('panel.noRecentOrders')} />
                        ) : (
                            <ul className="ui-list">
                                {recentOrders.map((o) => {
                                    const num = o.orderNumber ?? o.order_number ?? o.invoiceNumber ?? o.id ?? '—';
                                    const dt =
                                        o.createdAt ?? o.created_at ?? o.orderDate ?? o.invoiceDate ?? o.invoice_date;
                                    const total =
                                        o.grandTotal ?? o.grand_total ?? o.totalAmount ?? o.total_amount ?? o.total;
                                    const status = String(o.status ?? o.workflowStatus ?? 'pending').toLowerCase();
                                    return (
                                        <li key={o.id ?? num} className="ui-list-row">
                                            <div className="ui-list-main">
                                                <span className="ui-list-title">{num}</span>
                                                <span className="ui-list-meta">
                                                    {formatOrderDate(dt, locale)} · {formatSar(total, t)}
                                                </span>
                                            </div>
                                            <span className={`ui-pill ui-pill--${orderStatusTone(status)} ui-list-end`}>
                                                {status.replace(/_/g, ' ')}
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </Panel>

                    <Panel
                        title={t('panel.lowStock')}
                        count={panelLoading ? null : lowStock.length || null}
                        actionLabel={t('panel.manage')}
                        onAction={() => navigate('/admin/inventory/products-services')}
                    >
                        {panelLoading ? (
                            <PanelSkeleton />
                        ) : lowStock.length === 0 ? (
                            <PanelEmpty
                                icon={CheckCircle2}
                                title={t('panel.stockHealthy')}
                                sub={t('panel.stockHealthyHint')}
                            />
                        ) : (
                            <ul className="ui-list">
                                {lowStock.map((p) => {
                                    const name = p.name ?? p.productName ?? p.product_name ?? '—';
                                    const stock = Number(p.stockQty ?? p.stock_qty ?? p.stock ?? 0);
                                    const reorder = Number(
                                        p.reorderLevel ?? p.reorder_level ?? p.criticalLevel ?? p.critical_level ?? 0,
                                    );
                                    return (
                                        <li key={p.id ?? name} className="ui-list-row">
                                            <div className="ui-list-main">
                                                <span className="ui-list-title">{name}</span>
                                                <span className="ui-list-meta">
                                                    {t('panel.stockLeft', { stock, reorder })}
                                                </span>
                                            </div>
                                            <span className="ui-pill ui-pill--warn ui-list-end">{t('panel.low')}</span>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </Panel>

                    <Panel
                        title={t('panel.approvals')}
                        count={panelLoading ? null : pendingApprovals.length || null}
                        actionLabel={t('panel.reviewAll')}
                        onAction={() => navigate('/admin/approvals')}
                    >
                        {panelLoading ? (
                            <PanelSkeleton />
                        ) : pendingApprovals.length === 0 ? (
                            <PanelEmpty
                                icon={CheckCircle2}
                                title={t('panel.allClear')}
                                sub={t('panel.noPending')}
                            />
                        ) : (
                            <ul className="ui-list">
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
                                        <li key={`${a.entityType ?? type}-${a.id}`} className="ui-list-row">
                                            <div className="ui-list-main">
                                                <span className="ui-list-kind">{type}</span>
                                                <span className="ui-list-title">{desc}</span>
                                            </div>
                                            {amt != null && amt !== '' ? (
                                                <span className="ui-list-amount">{formatSar(amt, t)}</span>
                                            ) : null}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </Panel>
                </div>
            </div>

            {/* Jump straight to work */}
            <div className="ui-band">
                <div className="ui-band-head">
                    <h2>{t('quick.title')}</h2>
                </div>
                <div className="ui-actions">
                    {QUICK_ACTIONS.map((action) => (
                        <button
                            key={action.labelKey}
                            type="button"
                            className="ui-action"
                            onClick={() => navigate(action.path)}
                        >
                            <action.icon size={15} />
                            <span>{t(action.labelKey)}</span>
                            <ChevronRight size={14} className="ui-chev" />
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
