import { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
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

const PRIMARY_STATS = [
    { key: 'workshops', label: 'Workshops', icon: Wrench, tone: 'gold' },
    { key: 'branches', label: 'Branches', icon: GitBranch, tone: 'blue' },
    { key: 'users', label: 'Users', icon: Users, tone: 'violet' },
    { key: 'customers', label: 'Customers', icon: UserCheck, tone: 'green' },
];

const SECONDARY_STATS = [
    { key: 'technicians', label: 'Technicians', icon: Wrench },
    { key: 'cashiers', label: 'Cashiers', icon: Wallet },
    { key: 'suppliers', label: 'Suppliers', icon: Truck },
    { key: 'products', label: 'Products', icon: Package },
    { key: 'services', label: 'Services', icon: FileText },
    { key: 'invoices', label: 'Invoices', icon: Receipt },
];

const PORTAL_ACCESS_ITEMS = [
    { title: 'Locker', icon: Box, path: '/locker', requiresLogout: true },
    { title: 'Workshop', icon: Building, path: '/workshop', requiresLogout: true },
    { title: 'POS', icon: ShoppingCart, path: '/pos', requiresLogout: true },
    { title: 'Technician', icon: Wrench, path: '/technician', requiresLogout: true },
    { title: 'Corporate', icon: Car, path: '/corporate', requiresLogout: true },
    { title: 'Supplier', icon: Truck, path: '/supplier', requiresLogout: true },
    { title: 'Warehouse', icon: Warehouse, path: '/supplier', requiresLogout: false },
    { title: 'Marketing', icon: Gift, path: '/marketing/dashboard', requiresLogout: false },
    { title: 'Referrer', icon: UserPlus, path: '/referrer-portal', requiresLogout: true },
];

const QUICK_ACTIONS = [
    { label: 'Cash collection', icon: Banknote, path: '/admin/accounting/cash-bank' },
    { label: 'Approvals', icon: Clock, path: '/admin/approvals' },
    { label: 'Petty cash', icon: Wallet, path: '/admin/accounting/cash-bank' },
    { label: 'Differences', icon: FileText, path: '/admin/accounting/cash-bank' },
    { label: 'Workshop approvals', icon: ClipboardList, path: '/admin/approvals' },
    { label: 'Corporate signups', icon: UserCheck, path: '/admin/approvals' },
    { label: 'Technicians', icon: Users, path: '/admin/employees' },
    { label: 'Zones', icon: Map, path: '/admin/zone-management' },
];

function formatOrderDate(raw) {
    if (!raw) return '—';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-US', {
        month: 'short',
        day: '2-digit',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
}

function formatSar(value) {
    if (value == null || value === '') return '—';
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    return `SAR ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
                    <h3 className="sa-card-title">Portal access</h3>
                    <span className="sa-portals-hint">Opens in a separate portal session</span>
                </div>
                <div className="sa-portal-tiles">
                    {PORTAL_ACCESS_ITEMS.map((item) => (
                        <button
                            key={item.title}
                            type="button"
                            className="sa-portal-tile"
                            title={item.title}
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
                            <span className="sa-portal-tile-label">{item.title}</span>
                            <ExternalLink size={11} className="sa-portal-tile-ext" />
                        </button>
                    ))}
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
                                    <p className="sa-metric-label">{item.label}</p>
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
                            <span className="sa-metric-mini-label">{item.label}</span>
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
                        <strong>{statsLoading ? '—' : (stats?.salesOrders ?? '0')}</strong> sales orders
                    </span>
                </button>
                <button type="button" className="sa-alert-chip sa-alert-chip--approvals" onClick={() => navigate('/admin/approvals')}>
                    <AlertCircle size={16} />
                    <span>
                        <strong>{pendingCount ?? '—'}</strong> pending approvals
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
                            <strong>{lowStock.length}</strong> low stock items
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
                            <h4>Recent orders</h4>
                        </div>
                        <button type="button" className="sa-panel-link" onClick={() => navigate('/admin/sales-orders')}>
                            View all
                        </button>
                    </div>
                    {panelLoading ? (
                        <ShimmerListRows rows={5} />
                    ) : recentOrders.length === 0 ? (
                        <PanelEmpty icon={ShoppingCart} message="No recent orders" />
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
                                                {formatOrderDate(dt)} · {formatSar(total)}
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
                            <h4>Low stock</h4>
                        </div>
                        <button
                            type="button"
                            className="sa-panel-link"
                            onClick={() => navigate('/admin/inventory/products-services')}
                        >
                            Manage
                        </button>
                    </div>
                    {panelLoading ? (
                        <ShimmerListRows rows={5} />
                    ) : lowStock.length === 0 ? (
                        <PanelEmpty icon={CheckCircle2} message="Stock healthy" hint="Nothing below reorder point" />
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
                                                {stock} left · reorder {reorder}
                                            </span>
                                        </div>
                                        <span className="sa-status-pill status-low">low</span>
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
                            <h4>Approvals</h4>
                        </div>
                        <button type="button" className="sa-panel-link" onClick={() => navigate('/admin/approvals')}>
                            Review all
                        </button>
                    </div>
                    {panelLoading ? (
                        <ShimmerListRows rows={5} />
                    ) : pendingApprovals.length === 0 ? (
                        <PanelEmpty icon={CheckCircle2} message="All clear" hint="No pending approvals" />
                    ) : (
                        <ul className="sa-panel-list">
                            {pendingApprovals.map((a) => {
                                const type = String(a.entityType ?? a.type ?? 'item').replace(/_/g, ' ');
                                const desc = a.title ?? a.description ?? a.name ?? a.entityName ?? `${type} pending`;
                                const amt = a.amount ?? a.total ?? a.grandTotal ?? a.grand_total;
                                return (
                                    <li key={`${a.entityType ?? type}-${a.id}`} className="sa-approval-row">
                                        <span className="sa-approval-type">{type}</span>
                                        <p className="sa-approval-desc">{desc}</p>
                                        {amt != null && amt !== '' ? (
                                            <span className="sa-approval-amount">{formatSar(amt)}</span>
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
                    <h3 className="sa-card-title">Quick actions</h3>
                    <div className="sa-quick-grid">
                        {QUICK_ACTIONS.map((action) => (
                            <button
                                key={action.label}
                                type="button"
                                className="sa-quick-btn"
                                onClick={() => navigate(action.path)}
                            >
                                <action.icon size={15} />
                                <span>{action.label}</span>
                            </button>
                        ))}
                    </div>
                </section>

                <section className="sa-card sa-shortcuts-section">
                    <h3 className="sa-card-title">Shortcuts</h3>
                    <button
                        type="button"
                        className="sa-shortcut-row"
                        onClick={() => navigate('/admin/inventory/products-services')}
                    >
                        <span className="sa-shortcut-icon sa-shortcut-icon--blue">
                            <Package size={18} />
                        </span>
                        <span className="sa-shortcut-text">
                            <strong>Product catalogues</strong>
                            <span>Approvals, sync & inventory</span>
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
                            <strong>Corporate customers</strong>
                            <span>Wallets, billing & top-ups</span>
                        </span>
                        <ChevronRight size={16} />
                    </button>
                </section>
            </div>
        </div>
    );
}
