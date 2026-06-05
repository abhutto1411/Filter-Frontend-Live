import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    AlertCircle, Banknote, ClipboardList, Clock, FileText,
    Gift, Map, ShoppingCart, TrendingUp, UserCheck, UserPlus,
    Users, Wallet, Wrench, Box, Building, Car, Truck, Warehouse
} from 'lucide-react';
import '../../styles/admin/DashboardPage.css';
import { getStats, getSalesOrders, getProducts } from '../../services/superAdminApi';
import { list as listApprovals } from '../../services/approvalsApi';

const DashboardStatCard = ({ title, value, subtitle, icon: Icon }) => (
    <motion.div whileHover={{ y: -4 }} className="dashboard-stat-card">
        <div className="dashboard-stat-content">
            <p className="dashboard-stat-label">{title}</p>
            <h3 className="dashboard-stat-value">{value}</h3>
            <p className="dashboard-stat-subtitle">{subtitle}</p>
        </div>
        <div className="icon-wrapper">
            <Icon size={22} />
        </div>
    </motion.div>
);

const PORTAL_ACCESS_ITEMS = [
    { title: 'Filter Locker Portal', desc: 'Cash collection & locker operations', icon: Box, path: '/locker', requiresLogout: true },
    { title: 'Filter Admin Workshop Portal', desc: 'Multi-branch management & reporting', icon: Building, path: '/workshop', requiresLogout: true },
    { title: 'Filter POS Portal', desc: 'Point of sale & cashier operations', icon: ShoppingCart, path: '/pos', requiresLogout: true },
    { title: 'Filter Technician Portal', desc: 'Job cards, duty toggle & order workflow', icon: Wrench, path: '/technician', requiresLogout: true },
    { title: 'Filter Corporate Portal', desc: 'Fleet management, billing & wallet', icon: Car, path: '/corporate', requiresLogout: true },
    { title: 'Filter Supplier Portal', desc: 'Order queue, stock & finance', icon: Truck, path: '/supplier', requiresLogout: true },
    { title: 'Filter Warehouse Portal', desc: 'Stock management & transfers', icon: Warehouse, path: '/supplier', requiresLogout: false },
    { title: 'Filter Marketing Portal', desc: 'Promotions, loyalty & customer insights', icon: Gift, path: '/marketing/dashboard', requiresLogout: false },
    { title: 'Filter Referrer Portal', desc: 'Referrers, commissions & payouts', icon: UserPlus, path: '/referrer-portal', requiresLogout: true },
];

const QUICK_ACTIONS = [
    { label: 'Record Cash Collection', icon: Banknote },
    { label: 'Pending Approvals', icon: Clock },
    { label: 'Manage Petty Cash', icon: Wallet },
    { label: 'View Differences Report', icon: FileText },
    { label: 'Pending Workshop Approvals', icon: ClipboardList },
    { label: 'Pending Corporate Registrations', icon: UserCheck },
    { label: 'Manage All Technicians', icon: Users },
    { label: 'Manage Zones', icon: Map },
];

/** Format a date as "Mon DD, HH:MM AM/PM" — defensive against missing/invalid input. */
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

/** Friendly amount with SAR prefix; falls back to '—' for null/NaN. */
function formatSar(value) {
    if (value == null || value === '') return '—';
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    return `SAR ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function DashboardPage() {
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [recentOrders, setRecentOrders] = useState([]);
    const [lowStock, setLowStock] = useState([]);
    const [pendingApprovals, setPendingApprovals] = useState([]);
    const [panelLoading, setPanelLoading] = useState(true);

    useEffect(() => {
        getStats().then((d) => setStats(d?.totals ?? d)).catch(() => {});
    }, []);

    // Three independent fetches for the bottom-row panels. Don't block the
    // page if any single one fails — each catches and falls back to empty.
    useEffect(() => {
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
        ]).then(([orders, products, approvals]) => {
            if (cancelled) return;
            setRecentOrders(orders.slice(0, 5));
            // Pick rows where stockQty < reorderLevel (or criticalLevel as fallback).
            // Defensive against shape variations between super-admin product endpoints.
            const low = products
                .filter((p) => {
                    const stock = Number(p.stockQty ?? p.stock_qty ?? p.stock ?? 0);
                    const reorder = Number(p.reorderLevel ?? p.reorder_level ?? p.criticalLevel ?? p.critical_level ?? 0);
                    return reorder > 0 && stock <= reorder;
                })
                .slice(0, 5);
            setLowStock(low);
            setPendingApprovals(approvals.slice(0, 5));
        }).finally(() => {
            if (!cancelled) setPanelLoading(false);
        });
        return () => { cancelled = true; };
    }, []);

    return (
        <div className="dashboard-view">
            <section className="dashboard-section">
                <h2 className="dashboard-section-title">Portal Access</h2>
                <div className="portal-access-grid">
                    {PORTAL_ACCESS_ITEMS.map((item, i) => (
                        <motion.div
                            key={item.title}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.04 }}
                            className="portal-access-card"
                            onClick={() => {
                                if (item.requiresLogout) {
                                    navigate(`${item.path}/login`, { state: { forceLogout: true } });
                                } else {
                                    navigate(item.path);
                                }
                            }}
                            style={{ cursor: 'pointer' }}
                        >
                            <div className="portal-access-icon">
                                <item.icon size={24} />
                            </div>
                            <div className="portal-access-body">
                                <h3 className="portal-access-title">{item.title}</h3>
                                <p className="portal-access-desc">{item.desc}</p>
                                <button type="button" className="portal-access-open">
                                    Open <span className="chevron">›</span>
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </section>

            <div className="dashboard-alert" onClick={() => navigate('/admin/approvals')}>
                <AlertCircle size={20} />
                <div className="dashboard-alert-content">
                    <strong>{stats?.salesOrders ?? '—'} Sales Orders</strong> Across All Workshops
                    <p>Click to review approvals & registrations</p>
                </div>
                <span className="dashboard-alert-action">Review</span>
            </div>

            <div className="dashboard-stats-row">
                <DashboardStatCard title="Total Workshops" value={stats?.workshops ?? '—'} subtitle="Active workshops" icon={TrendingUp} />
                <DashboardStatCard title="Total Branches" value={stats?.branches ?? '—'} subtitle="Across all workshops" icon={Clock} />
                <DashboardStatCard title="Total Users" value={stats?.users ?? '—'} subtitle="All portal users" icon={FileText} />
                <DashboardStatCard title="Total Customers" value={stats?.customers ?? '—'} subtitle="Registered customers" icon={Wallet} />
            </div>

            <section className="dashboard-section locker-summary">
                <h3 className="dashboard-section-title-sm">Platform Overview</h3>
                <div className="locker-summary-grid">
                    <div className="locker-summary-item"><span className="locker-label">Technicians</span><span className="locker-val">{stats?.technicians ?? '0'}</span></div>
                    <div className="locker-summary-item"><span className="locker-label">Cashiers</span><span className="locker-val">{stats?.cashiers ?? '0'}</span></div>
                    <div className="locker-summary-item"><span className="locker-label">Suppliers</span><span className="locker-val">{stats?.suppliers ?? '0'}</span></div>
                    <div className="locker-summary-item"><span className="locker-label">Products</span><span className="locker-val">{stats?.products ?? '0'}</span></div>
                    <div className="locker-summary-item"><span className="locker-label">Services</span><span className="locker-val">{stats?.services ?? '0'}</span></div>
                    <div className="locker-summary-item"><span className="locker-label">Invoices</span><span className="locker-val">{stats?.invoices ?? '0'}</span></div>
                </div>
            </section>

            <section className="dashboard-section">
                <h3 className="dashboard-section-title-sm">Quick Actions</h3>
                <div className="quick-actions-row">
                    {QUICK_ACTIONS.map((action) => (
                        <button
                            key={action.label}
                            type="button"
                            className="quick-action-btn"
                            onClick={() => {
                                if (action.label.includes('Approvals') || action.label.includes('Pending')) navigate('/admin/approvals');
                                else if (action.label.includes('Cash') || action.label.includes('Petty') || action.label.includes('Differences')) navigate('/admin/accounting/cash-bank');
                                else if (action.label.includes('Technicians')) navigate('/admin/employees');
                                else if (action.label.includes('Zones')) navigate('/admin/zone-management');
                                else navigate('/admin/dashboard');
                            }}
                        >
                            <action.icon size={16} />
                            {action.label}
                        </button>
                    ))}
                </div>
            </section>

            <div className="dashboard-cards-row">
                <div className="dashboard-feature-card">
                    <h4 className="feature-card-title">Product Catalogues</h4>
                    <p className="feature-card-subtitle">From Suppliers & Warehouses</p>
                    <ul className="feature-card-list">
                        <li>Pending product approvals from suppliers</li>
                        <li>Product catalog management</li>
                        <li>Inventory synchronization</li>
                    </ul>
                    <button type="button" className="feature-card-link" onClick={() => navigate('/admin/inventory/products-services')}>Manage</button>
                </div>
                <div className="dashboard-feature-card">
                    <h4 className="feature-card-title">Corporate Customers</h4>
                    <p className="feature-card-subtitle">Wallet Options & Billing</p>
                    <ul className="feature-card-list">
                        <li>Manage wallet balances & top-ups</li>
                        <li>Configure auto top-up rules</li>
                        <li>View transaction history</li>
                    </ul>
                    <button type="button" className="feature-card-link" onClick={() => navigate('/admin/customers/all-customers')}>Manage</button>
                </div>
            </div>

            <div className="dashboard-bottom-grid">
                <div className="dashboard-panel">
                    <div className="dashboard-panel-header">
                        <h4>Recent Orders</h4>
                        <button type="button" className="panel-link" onClick={() => navigate('/admin/sales-orders')}>View All</button>
                    </div>
                    {panelLoading ? (
                        <p className="low-stock-message">Loading…</p>
                    ) : recentOrders.length === 0 ? (
                        <p className="low-stock-message">No recent orders yet.</p>
                    ) : (
                        recentOrders.map((o) => {
                            const num = o.orderNumber ?? o.order_number ?? o.invoiceNumber ?? o.id ?? '—';
                            const dt = o.createdAt ?? o.created_at ?? o.orderDate ?? o.invoiceDate ?? o.invoice_date;
                            const total = o.grandTotal ?? o.grand_total ?? o.totalAmount ?? o.total_amount ?? o.total;
                            const status = String(o.status ?? o.workflowStatus ?? 'pending').toLowerCase();
                            return (
                                <div key={o.id ?? num} className="recent-order-item">
                                    <div className="recent-order-id">{num}</div>
                                    <div className="recent-order-meta">
                                        {formatOrderDate(dt)} · {formatSar(total)}
                                    </div>
                                    <span className={`status-badge status-${status.replace(/[^a-z0-9_-]/g, '-')}`}>
                                        {status.replace(/_/g, ' ')}
                                    </span>
                                </div>
                            );
                        })
                    )}
                </div>
                <div className="dashboard-panel">
                    <div className="dashboard-panel-header">
                        <h4>Low Stock Alerts</h4>
                        <button type="button" className="panel-link" onClick={() => navigate('/admin/inventory/products-services')}>Manage</button>
                    </div>
                    {panelLoading ? (
                        <p className="low-stock-message">Loading…</p>
                    ) : lowStock.length === 0 ? (
                        <p className="low-stock-message">All stock levels are healthy</p>
                    ) : (
                        lowStock.map((p) => {
                            const name = p.name ?? p.productName ?? p.product_name ?? '—';
                            const stock = Number(p.stockQty ?? p.stock_qty ?? p.stock ?? 0);
                            const reorder = Number(p.reorderLevel ?? p.reorder_level ?? p.criticalLevel ?? p.critical_level ?? 0);
                            return (
                                <div key={p.id ?? name} className="recent-order-item">
                                    <div className="recent-order-id">{name}</div>
                                    <div className="recent-order-meta">
                                        Stock {stock} · reorder at {reorder}
                                    </div>
                                    <span className="status-badge status-low">low</span>
                                </div>
                            );
                        })
                    )}
                </div>
                <div className="dashboard-panel">
                    <div className="dashboard-panel-header">
                        <h4>Pending Approvals</h4>
                        <button type="button" className="panel-link" onClick={() => navigate('/admin/approvals')}>Review All</button>
                    </div>
                    {panelLoading ? (
                        <p className="low-stock-message">Loading…</p>
                    ) : pendingApprovals.length === 0 ? (
                        <p className="low-stock-message">No pending approvals.</p>
                    ) : (
                        pendingApprovals.map((a) => {
                            const type = String(a.entityType ?? a.type ?? 'item').replace(/_/g, ' ');
                            const desc = a.title ?? a.description ?? a.name ?? a.entityName ?? `${type} pending review`;
                            const amt = a.amount ?? a.total ?? a.grandTotal ?? a.grand_total;
                            return (
                                <div key={`${a.entityType ?? type}-${a.id}`} className="pending-approval-item">
                                    <span className="pending-approval-type">{type}</span>
                                    <p className="pending-approval-desc">{desc}</p>
                                    {amt != null && amt !== '' && (
                                        <span className="pending-approval-amount">{formatSar(amt)}</span>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
