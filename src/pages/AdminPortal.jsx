import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
    LayoutDashboard, Package, Users, BadgeDollarSign,
    Settings, Bell, Search, TrendingUp, Clock,
    Plus, Filter, Download, X, ChevronDown, ChevronRight,
    Shield, Map, Lock, Truck, Building, UserCheck, HardDrive,
    CreditCard, Landmark, FileText, ShoppingCart, Wallet,
    Car, Warehouse, Box, AlertCircle, Banknote,
    ClipboardList, Gift, UserPlus, Wrench
} from 'lucide-react';
import '../styles/AdminPortal.css';

const NewEntryModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="modal-content"
                onClick={e => e.stopPropagation()}
            >
                <div className="modal-header-content">
                    <h3>Create New Entry</h3>
                    <button className="close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>
                <div className="modal-body-content">
                    <div className="form-grid">
                        <div className="form-group">
                            <label className="form-label">Customer Name</label>
                            <input type="text" className="form-input-field" placeholder="Enter name..." />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Transaction Type</label>
                            <select className="form-input-field">
                                <option>Service Sale</option>
                                <option>Product Sale</option>
                                <option>Credit Note</option>
                            </select>
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Amount (SAR)</label>
                        <input type="number" className="form-input-field" placeholder="0.00" />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Description / Notes</label>
                        <textarea className="form-input-field" rows="3" placeholder="Additional details..."></textarea>
                    </div>
                </div>
                <div className="modal-footer-content">
                    <button className="btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn-submit">Process Transaction</button>
                </div>
            </motion.div>
        </div>
    );
};

const StatCard = ({ title, val, trend, icon: Icon }) => (
    <motion.div
        whileHover={{ y: -5 }}
        className="stat-card"
    >
        <div className="stat-info">
            <p className="stat-label">{title}</p>
            <h3 className="stat-value">{val}</h3>
            <div className="stat-trend">{trend} <span style={{ color: '#6c757d', fontSize: '9px' }}>vs last month</span></div>
        </div>
        <div className="icon-wrapper">
            <Icon size={24} />
        </div>
    </motion.div>
);

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
    { title: 'Locker Management', desc: 'Cash collection & locker operations', icon: Box },
    { title: 'Workshop Admin', desc: 'Multi-branch management & reporting', icon: Building },
    { title: 'Workshop POS', desc: 'Point of sale & cashier operations', icon: ShoppingCart },
    { title: 'Technician App', desc: 'Job cards & service tracking', icon: Wrench },
    { title: 'Corporate Customer', desc: 'Fleet management & billing', icon: Car },
    { title: 'Supplier Portal', desc: 'Orders, delivery & payments', icon: Truck },
    { title: 'Warehouse Portal', desc: 'Stock management & transfers', icon: Warehouse },
    { title: 'Marketing & Care', desc: 'Promotions, loyalty & customer insights', icon: Gift },
    { title: 'Referrer Portal', desc: 'Referrers, commissions & payouts', icon: UserPlus },
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

const DashboardView = ({ setActiveTab }) => {
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    return (
        <div className="dashboard-view">
            <header className="dashboard-header">
                <div className="dashboard-header-left">
                    <h1 className="dashboard-title">Operations Dashboard</h1>
                    <p className="dashboard-subtitle">{dateStr} · Real-time overview</p>
                </div>
                <Link to="/admin" className="btn-portal btn-new-order">
                    <ShoppingCart size={18} /> New Order (POS)
                </Link>
            </header>

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
                        >
                            <div className="portal-access-icon">
                                <item.icon size={24} />
                            </div>
                            <div className="portal-access-body">
                                <h3 className="portal-access-title">{item.title}</h3>
                                <p className="portal-access-desc">{item.desc}</p>
                                {item.title === 'Marketing & Care' ? (
                                    <Link to="/marketing/dashboard" className="portal-access-open">
                                        Open <ChevronRight size={14} />
                                    </Link>
                                ) : item.title === 'Referrer Portal' ? (
                                    <Link to="/referrer-portal" className="portal-access-open">
                                        Open <ChevronRight size={14} />
                                    </Link>
                                ) : (
                                    <button type="button" className="portal-access-open" onClick={() => setActiveTab('Approvals')}>
                                        Open <ChevronRight size={14} />
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </div>
            </section>

            <div className="dashboard-alert" onClick={() => setActiveTab('Approvals')}>
                <AlertCircle size={20} />
                <div className="dashboard-alert-content">
                    <strong>1 Pending Approval</strong> Require Attention
                    <p>Expenses, payments & advances awaiting review</p>
                </div>
                <span className="dashboard-alert-action">Review</span>
            </div>

            <div className="dashboard-stats-row">
                <DashboardStatCard title="Today Collected" value="SAR 0" subtitle="Cash collections" icon={TrendingUp} />
                <DashboardStatCard title="Pending Collections" value="0" subtitle="Awaiting pickup" icon={Clock} />
                <DashboardStatCard title="Pending Approvals" value="0" subtitle="Cash discrepancies" icon={FileText} />
                <DashboardStatCard title="Petty Cash Requests" value="0" subtitle="Pending disbursement" icon={Wallet} />
            </div>

            <section className="dashboard-section locker-summary">
                <h3 className="dashboard-section-title-sm">Locker Management Summary</h3>
                <div className="locker-summary-grid">
                    <div className="locker-summary-item"><span className="locker-label">Pending Collections</span><span className="locker-val">0</span></div>
                    <div className="locker-summary-item"><span className="locker-label">Approved Collections Today</span><span className="locker-val">0</span></div>
                    <div className="locker-summary-item"><span className="locker-label">Pending Approvals (Differences)</span><span className="locker-val">0</span></div>
                    <div className="locker-summary-item"><span className="locker-label">Pending Petty Cash Requests</span><span className="locker-val">0</span></div>
                    <div className="locker-summary-item"><span className="locker-label">Total Collected This Month</span><span className="locker-val">SAR 0</span></div>
                    <div className="locker-summary-item"><span className="locker-label">Cash Discrepancies</span><span className="locker-val">0</span></div>
                </div>
            </section>

            <section className="dashboard-section">
                <h3 className="dashboard-section-title-sm">Quick Actions</h3>
                <div className="quick-actions-row">
                    {QUICK_ACTIONS.map((action, i) => (
                        <button
                            key={action.label}
                            type="button"
                            className="quick-action-btn"
                            onClick={() => (action.label.includes('Approvals') || action.label.includes('Pending')) ? setActiveTab('Approvals') : setActiveTab('Dashboard')}
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
                    <button type="button" className="feature-card-link" onClick={() => setActiveTab('Inventory')}>Manage</button>
                </div>
                <div className="dashboard-feature-card">
                    <h4 className="feature-card-title">Corporate Customers</h4>
                    <p className="feature-card-subtitle">Wallet Options & Billing</p>
                    <ul className="feature-card-list">
                        <li>Manage wallet balances & top-ups</li>
                        <li>Configure auto top-up rules</li>
                        <li>View transaction history</li>
                    </ul>
                    <button type="button" className="feature-card-link" onClick={() => setActiveTab('Customers')}>Manage</button>
                </div>
            </div>

            <div className="dashboard-bottom-grid">
                <div className="dashboard-panel">
                    <div className="dashboard-panel-header">
                        <h4>Recent Orders</h4>
                        <button type="button" className="panel-link" onClick={() => setActiveTab('Sales')}>View All</button>
                    </div>
                    <div className="recent-order-item">
                        <div className="recent-order-id">ORD-82898441</div>
                        <div className="recent-order-meta">Feb 28, 12:48 PM · SAR 136.85</div>
                        <span className="status-badge status-completed">completed</span>
                    </div>
                </div>
                <div className="dashboard-panel">
                    <div className="dashboard-panel-header">
                        <h4>Low Stock Alerts</h4>
                        <button type="button" className="panel-link" onClick={() => setActiveTab('Inventory')}>Manage</button>
                    </div>
                    <p className="low-stock-message">All stock levels are healthy</p>
                </div>
                <div className="dashboard-panel">
                    <div className="dashboard-panel-header">
                        <h4>Pending Approvals</h4>
                        <button type="button" className="panel-link" onClick={() => setActiveTab('Approvals')}>Review All</button>
                    </div>
                    <div className="pending-approval-item">
                        <span className="pending-approval-type">promotion</span>
                        <p className="pending-approval-desc">New promotion: &quot;Eid15%&quot;</p>
                        <span className="pending-approval-amount">SAR 0.00</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ApprovalsView = ({ currentTab, setTab }) => {
    const tabs = ['Pending', 'Approved', 'Rejected', 'All'];
    return (
        <div className="module-container">
            <div className="tabs-container">
                {tabs.map(tab => (
                    <div
                        key={tab}
                        className={`tab-item ${currentTab === tab ? 'active' : ''}`}
                        onClick={() => setTab(tab)}
                    >
                        {tab}
                    </div>
                ))}
            </div>
            <div className="empty-state-card">
                <div className="empty-icon-wrapper">
                    <FileText size={48} color="#9CA3AF" />
                </div>
                <h3 className="empty-title">Approvals</h3>
                <p className="empty-desc">
                    This module is currently being populated with data from the legacy system. Powering up precision for your automotive network.
                </p>
                <p className="empty-status">0 pending approvals</p>
            </div>
        </div>
    );
};

const InventoryView = () => {
    const products = [
        { id: 'PRD-721', name: 'Shell Helix Ultra 5W-40', sku: 'SHL-HU-540-4L', type: 'Product', dept: 'Lubricants', unit: 'Liter', price: 'SAR 145.00', stock: 124, status: 'Active' },
        { id: 'SER-102', name: 'Computerized Wheel Alignment', sku: 'SRV-CWA-001', type: 'Service', dept: 'Workshop', unit: 'Unit', price: 'SAR 180.00', stock: '--', status: 'Active' },
        { id: 'PRD-805', name: 'BOSCH Brake Pads Front', sku: 'BSH-BPF-091', type: 'Product', dept: 'Spare Parts', unit: 'Set', price: 'SAR 285.00', stock: 12, status: 'Active' },
        { id: 'PRD-312', name: 'Michelin Pilot Sport 4S', sku: 'MCH-PS4S-19', type: 'Product', dept: 'Tires', unit: 'Unit', price: 'SAR 890.00', stock: 8, status: 'Warning' },
    ];

    return (
        <div className="module-container">
            <div className="module-header-actions">
                <div className="search-bar-mini">
                    <Search size={16} />
                    <input type="text" placeholder="Search products & services..." />
                </div>
                <button className="btn-portal"><Plus size={16} /> ADD PRODUCT</button>
            </div>

            <section className="premium-table">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">PRODUCT / SERVICE</th>
                            <th className="table-th">SKU</th>
                            <th className="table-th">TYPE</th>
                            <th className="table-th">UNIT</th>
                            <th className="table-th">SALE PRICE</th>
                            <th className="table-th">STOCK</th>
                            <th className="table-th">STATUS</th>
                        </tr>
                    </thead>
                    <tbody>
                        {products.map(p => (
                            <tr key={p.id} className="table-row">
                                <td className="table-cell">
                                    <div className="cell-main-text">{p.name}</div>
                                    <div className="cell-sub-text">{p.id}</div>
                                </td>
                                <td className="table-cell font-mono text-xs">{p.sku}</td>
                                <td className="table-cell">{p.type}</td>
                                <td className="table-cell">{p.unit}</td>
                                <td className="table-cell font-bold">{p.price}</td>
                                <td className="table-cell">
                                    <span className={p.stock < 10 ? 'text-warning' : ''}>{p.stock}</span>
                                </td>
                                <td className="table-cell">
                                    <span className={`status-badge ${p.status === 'Active' ? 'status-completed' : 'status-warning'}`}>
                                        {p.status.toUpperCase()}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>
        </div>
    );
};

const CustomersView = () => {
    const customers = [
        { name: 'Saudi Aramco Fleet', type: 'Corporate', mobile: '+966502222222', email: 'fleet@aramco.com', vat: '300111222333444', balance: 'SAR 0.00', status: 'Active' },
        { name: 'SABIC Transport', type: 'Corporate', mobile: '+966503333333', email: 'transport@sabic.com', vat: '300222333444555', balance: 'SAR 12,450.00', status: 'Active' },
        { name: 'Fatima Motors', type: 'Walk-in', mobile: '+966504444444', email: 'fatima@gmail.com', vat: '-', balance: 'SAR 0.00', status: 'Active' },
        { name: 'Riyadh Taxi Company', type: 'Corporate', mobile: '+966505555555', email: 'fleet@riyadhtaxi.com', vat: '300333444555666', balance: 'SAR 0.00', status: 'Active' },
        { name: 'Ahmed Al-Rashid', type: 'Walk-in', mobile: '+966501111111', email: 'ahmed@email.com', vat: '-', balance: 'SAR 420.00', status: 'Active' },
    ];

    return (
        <div className="module-container">
            <div className="stats-mini-grid">
                <div className="stat-mini-card">
                    <Users size={20} color="var(--color-primary)" />
                    <div>
                        <p className="mini-label">Total Customers</p>
                        <h4 className="mini-val">5</h4>
                    </div>
                </div>
                <div className="stat-mini-card">
                    <Building size={20} color="var(--color-primary)" />
                    <div>
                        <p className="mini-label">Corporate</p>
                        <h4 className="mini-val">3</h4>
                    </div>
                </div>
                <div className="stat-mini-card">
                    <Users size={20} color="var(--color-primary)" />
                    <div>
                        <p className="mini-label">Walk-in</p>
                        <h4 className="mini-val">2</h4>
                    </div>
                </div>
            </div>

            <div className="module-header-actions">
                <div className="search-bar-mini">
                    <Search size={16} />
                    <input type="text" placeholder="Search customers..." />
                </div>
                <button className="btn-portal"><Plus size={16} /> ADD CUSTOMER</button>
            </div>

            <section className="premium-table">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">CUSTOMER</th>
                            <th className="table-th">TYPE</th>
                            <th className="table-th">MOBILE</th>
                            <th className="table-th">EMAIL</th>
                            <th className="table-th">VAT NUMBER</th>
                            <th className="table-th">OUTSTANDING</th>
                            <th className="table-th">STATUS</th>
                        </tr>
                    </thead>
                    <tbody>
                        {customers.map((c, i) => (
                            <tr key={i} className="table-row">
                                <td className="table-cell">
                                    <div className="cell-main-text">{c.name}</div>
                                    <div className="cell-sub-text">{c.type === 'Corporate' ? 'Business Account' : 'Retail Client'}</div>
                                </td>
                                <td className="table-cell">
                                    <span className={`type-badge ${c.type.toLowerCase()}`}>{c.type}</span>
                                </td>
                                <td className="table-cell">{c.mobile}</td>
                                <td className="table-cell">{c.email}</td>
                                <td className="table-cell">{c.vat}</td>
                                <td className="table-cell font-bold">{c.balance}</td>
                                <td className="table-cell">
                                    <span className="status-badge status-completed">ACTIVE</span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>
        </div>
    );
};

const AccountingView = () => {
    return (
        <div className="module-container">
            <div className="accounting-header">
                <div className="form-row-grid">
                    <div className="form-group">
                        <label className="form-label">Date *</label>
                        <input type="date" className="form-input-field" defaultValue="2026-02-27" />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Branch</label>
                        <input type="text" className="form-input-field" placeholder="Select branch" />
                    </div>
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label className="form-label">General Note</label>
                        <input type="text" className="form-input-field" placeholder="Optional note for all entries" />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Paid From Account</label>
                        <input type="text" className="form-input-field" placeholder="Select Cash / Bank Account" />
                    </div>
                </div>
            </div>

            <div className="tabs-container-small">
                {['Payments', 'Receipts', 'Journal Entry'].map((t, i) => (
                    <div key={t} className={`tab-item-small ${i === 0 ? 'active' : ''}`}>{t}</div>
                ))}
            </div>

            <section className="accounting-table-wrapper">
                <table className="accounting-table">
                    <thead>
                        <tr>
                            <th>DATE</th>
                            <th>TYPE</th>
                            <th>PAYEE (TO)</th>
                            <th>ACCOUNT (DR)</th>
                            <th>AMOUNT (SAR)</th>
                            <th>REFERENCE</th>
                            <th>NOTES</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {[1, 2].map(i => (
                            <tr key={i}>
                                <td><input type="date" defaultValue="2026-02-27" className="table-input" /></td>
                                <td><select className="table-input"><option>Supplier</option></select></td>
                                <td><input type="text" className="table-input" placeholder="Select payee" /></td>
                                <td><input type="text" className="table-input" placeholder="Payable / Expense" /></td>
                                <td><input type="number" className="table-input" placeholder="0.00" /></td>
                                <td><input type="text" className="table-input" placeholder="Ref #" /></td>
                                <td><input type="text" className="table-input" placeholder="Notes" /></td>
                                <td><button className="row-delete-btn"><X size={14} /></button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="accounting-footer">
                    <button className="btn-add-row"><Plus size={14} /> ADD ROW</button>
                    <div className="total-indicator">0 valid rows • Total: SAR 0.00</div>
                    <button className="btn-save-accounting"><Shield size={16} /> SAVE ALL PAYMENTS</button>
                </div>
            </section>
        </div>
    );
};

const SidebarAccordion = ({ item, activeTab, setActiveTab, activeSubTab, setActiveSubTab }) => {
    const [isOpen, setIsOpen] = useState(false);
    const Icon = item.icon;
    const hasSubItems = item.subItems && item.subItems.length > 0;
    const isActive = activeTab === item.label;

    const handleClick = () => {
        if (hasSubItems) {
            setIsOpen(!isOpen);
        } else {
            setActiveTab(item.label);
            setActiveSubTab(null);
        }
    };

    return (
        <div className="nav-group">
            <div
                className={`nav-link ${isActive ? 'active' : ''}`}
                onClick={handleClick}
            >
                <div className="flex items-center gap-4">
                    <Icon size={20} />
                    <span className="nav-label">{item.label}</span>
                </div>
                {hasSubItems && (
                    isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                )}
            </div>

            <AnimatePresence>
                {isOpen && hasSubItems && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="nav-submenu"
                    >
                        {item.subItems.map(sub => (
                            <div
                                key={sub}
                                className={`nav-sub-link ${activeSubTab === sub ? 'active' : ''}`}
                                onClick={() => {
                                    setActiveTab(item.label);
                                    setActiveSubTab(sub);
                                }}
                            >
                                {sub}
                            </div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const AdminPortal = () => {
    const [activeTab, setActiveTab] = useState('Dashboard');
    const [activeSubTab, setActiveSubTab] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [approvalsTab, setApprovalsTab] = useState('Pending');

    const navigation = [
        {
            section: "CONTROL",
            items: [
                { label: 'Dashboard', icon: LayoutDashboard },
                { label: 'Approvals', icon: Clock },
                { label: 'Zone Management', icon: Map },
                { label: 'Permissions', icon: Shield },
            ]
        },
        {
            section: "OPERATIONS",
            items: [
                {
                    label: 'Inventory',
                    icon: Package,
                    subItems: ['Products & Services', 'Stock Movements', 'Categories', 'Units of Measure']
                },
                {
                    label: 'Customers',
                    icon: Users,
                    subItems: ['All Customers', 'Corporate Billing']
                },
                { label: 'Suppliers', icon: Truck },
                { label: 'Employees', icon: UserCheck },
                { label: 'Branches', icon: Building },
            ]
        },
        {
            section: "FINANCE",
            items: [
                {
                    label: 'Sales',
                    icon: BadgeDollarSign,
                    subItems: ['Workshop Sales', 'Suppliers & Warehouse Sales', 'Receipts']
                },
                {
                    label: 'Accounting',
                    icon: Landmark,
                    subItems: ['Chart of Accounts', 'Cash & Bank', 'Transactions', 'Journal Entries', 'Purchases', 'Expenses', 'Payments', 'Advances', 'Ledger']
                },
            ]
        }
    ];

    return (
        <div className="admin-layout">
            {/* Sidebar */}
            <aside className="sidebar">
                <div className="sidebar-logo">
                    <h2 className="logo-main">FILTER <span className="logo-sub">OS</span></h2>
                    <p className="logo-desc">SUPER ADMIN UNIT</p>
                </div>

                <nav className="sidebar-nav" style={{ overflowY: 'auto' }}>
                    {navigation.map(section => (
                        <div key={section.section}>
                            <div className="sidebar-section-label">{section.section}</div>
                            {section.items.map(item => (
                                <SidebarAccordion
                                    key={item.label}
                                    item={item}
                                    activeTab={activeTab}
                                    setActiveTab={setActiveTab}
                                    activeSubTab={activeSubTab}
                                    setActiveSubTab={setActiveSubTab}
                                />
                            ))}
                        </div>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div className="user-pill">
                        <div className="user-avatar text-black">AB</div>
                        <div className="user-details">
                            <p className="user-name">ASIF AL BHUTTO</p>
                            <p style={{ fontSize: '8px', color: '#6C757D', fontWeight: 800 }}>SUPER ADMIN</p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="main-content">
                <header className="top-bar">
                    <div className="header-info">
                        <h1 className="page-title">{activeTab.toUpperCase()}</h1>
                        <p style={{ color: '#6C757D', fontWeight: 500 }}>
                            {activeSubTab ? `> ${activeSubTab}` : 'Global operational control.'}
                        </p>
                    </div>

                    <div className="flex items-center gap-8">
                        <div className="search-container">
                            <Search className="search-icon" />
                            <input
                                type="text"
                                placeholder={`Search resources...`}
                                className="search-input"
                            />
                        </div>
                        <div style={{ width: '1px', height: '24px', backgroundColor: '#E5E7EB' }} />
                        <div style={{ position: 'relative', cursor: 'pointer' }}>
                            <div style={{ position: 'absolute', top: -2, right: -2, width: 8, height: 8, backgroundColor: '#FFD700', borderRadius: '50%' }} />
                            <Bell color="#6C757D" />
                        </div>
                    </div>
                </header>

                {activeTab === 'Dashboard' && <DashboardView setActiveTab={setActiveTab} />}

                {activeTab === 'Approvals' && <ApprovalsView currentTab={approvalsTab} setTab={setApprovalsTab} />}
                {activeTab === 'Inventory' && <InventoryView />}
                {activeTab === 'Customers' && <CustomersView />}
                {activeTab === 'Accounting' && <AccountingView />}

                {!['Dashboard', 'Approvals', 'Inventory', 'Customers', 'Accounting'].includes(activeTab) && (
                    <div style={{ background: '#FFF', borderRadius: '24px', padding: '64px', textAlign: 'center', boxShadow: 'var(--shadow-premium)' }}>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '16px' }}>{activeSubTab || activeTab}</h3>
                        <p style={{ color: '#6C757D', fontSize: '0.9375rem', maxWidth: '400px', margin: '0 auto' }}>
                            This module is currently being populated with data from the legacy system. Powering up precision for your automotive network.
                        </p>
                    </div>
                )}
            </main>

            <AnimatePresence>
                {isModalOpen && <NewEntryModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />}
            </AnimatePresence>
        </div>
    );
};

export default AdminPortal;
