import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import UserProfileMenu from '../components/UserProfileMenu';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard, Package, Users, BadgeDollarSign, DollarSign, BookOpen,
    Bell, Search, ChevronDown, ChevronRight,
    Shield, Map, Truck, Building, UserCheck, Receipt, ArrowLeftRight, FileSpreadsheet,
    Landmark, FileText, Car, Warehouse, Box, ShoppingCart, UserPlus, Globe, Megaphone,
    Menu, X, Percent, Wrench, GitBranch, Radio, BarChart2, ClipboardList, CreditCard,
    FlaskConical, Smartphone, MessageCircle, Wallet, CircleDollarSign, ScrollText,
} from 'lucide-react';
import '../styles/AdminLayout.css';
import '../styles/admin/PlatformChat.css';
import PlatformChatFab from '../components/platform-chat/PlatformChatFab';
import { usePlatformChatUnread } from '../context/PlatformChatUnreadContext';
import { loadSaAccountingScope, isHqAccountingScope } from './admin/saAccountingScope';

const ACCOUNTING_MONITOR_SUB_ITEMS = [
    { label: 'Chart of Accounts', path: 'chart-of-accounts', icon: FileSpreadsheet },
    { label: 'Trial Balance', path: 'trial-balance', icon: FileText },
    { label: 'Profit & Loss', path: 'pl', icon: FileText },
    { label: 'Balance Sheet', path: 'balance-sheet', icon: FileSpreadsheet },
    { label: 'Ledger', path: 'ledger', icon: BookOpen },
    { label: 'Journal Entries', path: 'journal-entries', icon: FileText },
    { label: 'Payments', path: 'payments', icon: BadgeDollarSign },
    { label: 'Receipts', path: 'receipts', icon: Receipt },
    { label: 'Activity Log', path: 'activity', icon: ArrowLeftRight },
    { label: 'Referral Commission', path: 'commissions', icon: DollarSign },
];

const ACCOUNTING_HQ_SUB_ITEMS = [
    { label: 'Chart of Accounts', path: 'chart-of-accounts', icon: FileSpreadsheet },
    { label: 'Cash & Bank', path: 'cash-bank', icon: Landmark },
    { label: 'Transactions', path: 'transactions', icon: ArrowLeftRight },
    { label: 'Journal Entries', path: 'journal-entries', icon: FileText },
    { label: 'Expenses', path: 'expenses', icon: Receipt },
    { label: 'Receipts', path: 'receipts', icon: Receipt },
    { label: 'Payments', path: 'payments', icon: BadgeDollarSign },
    { label: 'Advances', path: 'advances', icon: DollarSign },
    { label: 'Payroll Run', path: 'payroll', icon: BadgeDollarSign },
    { label: 'Ledger', path: 'ledger', icon: BookOpen },
    { label: 'Referral Commission', path: 'commissions', icon: DollarSign },
];

const TRANSLATIONS = {
    en: {
        section: { CONTROL: 'CONTROL', OPERATIONS: 'OPERATIONS', FINANCE: 'FINANCE', SPECIALIZED: 'SPECIALIZED' },
        nav: {
            dashboard: 'Dashboard', reports: 'Reporting', pos: 'POS / New Order', approvals: 'Approvals', 'zone-management': 'Zone Management', 'tax-codes': 'Tax Code', 'legal-pages': 'Legal Pages', 'mobile-app-menu': 'Mobile App Menu', permissions: 'Permissions', 'admin-wallets': 'Admin Wallets', 'my-wallet': 'My Wallet', 'tier-management': 'Tier Management',
            inventory: 'Inventory', 'master-catalog': 'Master Catalog', 'products-services': 'Products & Services', 'stock-movements': 'Stock Movements', categories: 'Categories', 'units-of-measure': 'Units of Measure',
            customers: 'Customers', 'all-customers': 'All Customers', 'corporate-billing': 'Corporate Billing',
            suppliers: 'Suppliers', 'storage-facility': 'Storage Facility', employees: 'Employees', branches: 'Branches', workshop: 'Workshop', 'staff-app': 'Staff App',
            sales: 'Sales', 'workshop-sales': 'Workshop Sales', 'suppliers-warehouse-sales': 'Suppliers & Warehouse Sales', receipts: 'Receipts',
            'referral-commissions': 'Referral Commission',
            commissions: 'Referral Commission',
            'referral-commissions-rm': 'Referral Commissions',
            accounting: 'Accounting',
            'chart-of-accounts': 'Chart of Accounts',
            'cash-bank': 'Cash & Bank',
            'sales-reports': 'Sales Reports', 'sales-orders': 'Sales Orders',
            'corporate-transactions': 'Corporate Transactions', 'sales-returns': 'Sales Returns',
            'demo-invoices': 'Demo Invoices',
            chat: 'Chat',
            transactions: 'Transactions', 'journal-entries': 'Journal Entries', purchases: 'Purchases', expenses: 'Expenses', payments: 'Payments', advances: 'Advances', payroll: 'Payroll Run', ledger: 'Ledger',
            'softpos-settlement': 'SoftPOS Settlement',
            marketing: 'Marketing',
            'fleet-management': 'Fleet Management', 'warehouse-portal': 'Warehouse Portal', 'locker-management': 'Locker Management',
            'workshop-portal': 'Filter Admin Workshop Portal', 'locker-portal': 'Filter Locker Portal', 'supplier-portal': 'Filter Supplier Portal', 'corporate-portal': 'Filter Corporate Portal', 'referrer-portal': 'Filter Referrer Portal', 'technician-app': 'Filter Technician Portal', 'pos-portal': 'Filter POS Portal'
        },
        logoDesc: 'FILTER ERP',
        pageSubtitle: 'Global operational control.',
        searchPlaceholder: 'Search resources...',
        userName: 'ASIF AL BHUTTO',
        userRole: 'SUPER ADMIN',
    },
    ar: {
        section: { CONTROL: 'التحكم', OPERATIONS: 'العمليات', FINANCE: 'المالية', SPECIALIZED: 'متخصص' },
        nav: {
            dashboard: 'لوحة التحكم', reports: 'التقارير', pos: 'نقطة البيع / طلب جديد', approvals: 'الموافقات', 'zone-management': 'إدارة المناطق', 'tax-codes': 'أكواد الضريبة', 'legal-pages': 'الصفحات القانونية', 'mobile-app-menu': 'قائمة تطبيق الجوال', permissions: 'الصلاحيات', 'admin-wallets': 'محافظ المشرفين', 'my-wallet': 'محفظتي', 'tier-management': 'إدارة الفئات',
            inventory: 'المخزون', 'master-catalog': 'الكتالوج الرئيسي', 'products-services': 'المنتجات والخدمات', 'stock-movements': 'حركة المخزون', categories: 'الفئات', 'units-of-measure': 'وحدات القياس',
            customers: 'العملاء', 'all-customers': 'جميع العملاء', 'corporate-billing': 'الفواتير المؤسسية',
            suppliers: 'الموردون', employees: 'الموظفون', branches: 'الفروع', workshop: 'الورشة',
            sales: 'المبيعات', 'workshop-sales': 'مبيعات الورشة', 'suppliers-warehouse-sales': 'الموردون ومبيعات المستودع', receipts: 'الإيصالات',
            'referral-commissions': 'العمولات',
            commissions: 'العمولات',
            'referral-commissions-rm': 'عمولات الإحالة',
            accounting: 'المحاسبة',
            'chart-of-accounts': 'دليل الحسابات',
            'cash-bank': 'النقد والبنك',
            'sales-reports': 'تقارير المبيعات', 'sales-orders': 'طلبات المبيعات',
            'corporate-transactions': 'معاملات الشركات', 'sales-returns': 'مرتجعات المبيعات',
            'demo-invoices': 'فواتير تجريبية',
            chat: 'المحادثة',
            transactions: 'المعاملات', 'journal-entries': 'قيد اليومية', purchases: 'المشتريات', expenses: 'المصروفات', payments: 'المدفوعات', advances: 'السلف', payroll: 'تشغيل الرواتب', ledger: 'دفتر الأستاذ',
            'softpos-settlement': 'تسوية SoftPOS',
            marketing: 'التسويق',
            'fleet-management': 'إدارة الأسطول', 'warehouse-portal': 'بوابة المستودع', 'locker-management': 'إدارة الخزائن',
            'workshop-portal': 'بوابة فلتر لورشة العمل', 'locker-portal': 'بوابة فلتر للخزائن', 'supplier-portal': 'بوابة فلتر للموردين', 'corporate-portal': 'بوابة فلتر للمؤسسات', 'referrer-portal': 'بوابة فلتر للإحالة', 'technician-app': 'بوابة فلتر للفنيين', 'pos-portal': 'بوابة فلتر لنقاط البيع'
        },
        logoDesc: 'فلتر ERP — وحدة المشرف الأعلى',
        pageSubtitle: 'التحكم التشغيلي العالمي.',
        searchPlaceholder: 'البحث في الموارد...',
        userName: 'آسف البوتو',
        userRole: 'مشرف أعلى',
    },
};

const NAV_CONFIG = [
    {
        section: 'CONTROL',
        items: [
            { label: 'Dashboard', path: 'dashboard', icon: LayoutDashboard },
            { label: 'Approvals', path: 'approvals', icon: FileText },
            { label: 'Zone Management', path: 'zone-management', icon: Map },
            { label: 'Tax Codes', path: 'tax-codes', icon: Percent },
            { label: 'Legal Pages', path: 'legal-pages', icon: ScrollText },
            { label: 'Mobile App Menu', path: 'mobile-app-menu', icon: Smartphone },
            { label: 'Marketing', path: 'marketing', icon: Megaphone },
            { label: 'Permissions', path: 'permissions', icon: Shield },
            { label: 'Admin Wallets', path: 'admin-wallets', icon: Wallet },
            { label: 'My Wallet', path: 'my-wallet', icon: CircleDollarSign, walletRequired: true },
            { label: 'Chat', path: 'chat', icon: MessageCircle },
            { label: 'Demo Invoices', path: 'demo-invoices', icon: FlaskConical },
        ],
    },
    {
        section: 'OPERATIONS',
        items: [
            {
                label: 'Inventory',
                path: 'inventory',
                icon: Package,
                subItems: [
                    { label: 'Master Catalog', path: 'master-catalog' },
                    { label: 'Stock Movements', path: 'stock-movements' },
                    { label: 'Units of Measure', path: 'units-of-measure' },
                ],
            },
            {
                label: 'Customers',
                path: 'customers',
                icon: Users,
                subItems: [
                    { label: 'All Customers', path: 'all-customers' },
                    { label: 'Corporate Billing', path: 'corporate-billing' },
                ],
            },
            { label: 'Suppliers', path: 'suppliers', icon: Truck },
            { label: 'Storage Facility', path: 'storage-facility', icon: Warehouse },
            { label: 'Employees', path: 'employees', icon: UserCheck },
            { label: 'Branches', path: 'branches', icon: Building },
            { label: 'Workshop', path: 'workshop', icon: Wrench },
            { label: 'Staff App', path: 'staff-app', icon: Smartphone },
        ],
    },
    {
        section: 'FINANCE',
        items: [
            {
                label: 'Sales',
                path: 'sales',
                icon: BadgeDollarSign,
                subItems: [
                    { label: 'Sales Reports', path: 'sales-reports' },
                    { label: 'Sales Orders', path: 'sales-orders' },
                    { label: 'Workshop Sales', path: 'workshop-sales' },
                    { label: 'Suppliers & Warehouse Sales', path: 'suppliers-warehouse-sales' },
                    { label: 'Corporate Transactions', path: 'corporate-transactions' },
                    { label: 'Sales Returns', path: 'sales-returns' },
                    { label: 'Receipts', path: 'receipts' },
                ],
            },
            {
                label: 'Accounting',
                path: 'accounting',
                icon: Landmark,
                subItems: ACCOUNTING_MONITOR_SUB_ITEMS,
            },
            { label: 'SoftPOS Settlement', path: 'softpos-settlement', icon: CreditCard },
        ],
    },
];

const getNavLabel = (path, locale) => TRANSLATIONS[locale]?.nav[path] ?? TRANSLATIONS.en.nav[path] ?? path;

/**
 * Permission code for a nav item (matches backend `<tabKey>.view`).
 *   Top-level item: `${path}.view`        e.g. dashboard.view
 *   Sub item:       `${parent}.${sub}.view` e.g. inventory.master-catalog.view
 *
 * Items not listed in the permissions tree (external portal shortcuts,
 * pages we haven't catalogued yet) return null and stay ungated.
 */
const PERMISSION_KEY_FOR = {
    // CONTROL
    dashboard: 'dashboard.view',
    approvals: 'approvals.view',
    'zone-management': 'zone-management.view',
    'tier-management': 'tier-management.view',
    'tax-codes': 'tax-codes.view',
    marketing: 'marketing.view',
    permissions: 'permissions.view',
    'admin-wallets': 'admin-wallets.view',
    chat: 'chat.view',
    'demo-invoices': 'demo-invoices.view',
    // OPERATIONS
    suppliers: 'suppliers.view',
    'storage-facility': 'storage-facility.view',
    employees: 'employees.view',
    branches: 'branches.view',
    workshop: 'workshop.view',
    'staff-app': 'workshop.staff-app.overview.view',
    // FINANCE top-level
    accounting: 'accounting.monitor.view',
    'softpos-settlement': 'softpos-settlement.view',
};

function permissionCodeFor(parentPath, subPath) {
    if (subPath) {
        return `${parentPath}.${subPath}.view`;
    }
    return PERMISSION_KEY_FOR[parentPath] ?? null;
}

const SidebarNavItem = ({ item, basePath, locale, hasPermission }) => {
    const [open, setOpen] = useState(false);
    const navigate = useNavigate();
    const { totalUnread } = usePlatformChatUnread();
    const parentPath = `${basePath}/${item.path}`;
    const isParentActive = useLocation().pathname.startsWith('/admin/' + item.path);
    const t = TRANSLATIONS[locale] || TRANSLATIONS.en;

    // Filter sub-items the user can't view.
    const visibleSubItems = (item.subItems ?? []).filter((sub) => {
        const code = permissionCodeFor(item.path, sub.path);
        return code ? hasPermission(code) : true;
    });
    const hasSub = visibleSubItems.length > 0;

    // For non-sub items, gate the whole item.
    if (!item.subItems?.length && !item.externalPath) {
        const code = permissionCodeFor(item.path);
        if (code && !hasPermission(code)) return null;
    }
    // If the item HAS subItems but all were filtered out → hide parent too.
    if (item.subItems?.length && !hasSub) return null;

    if (item.externalPath) {
        return (
            <div className="nav-group">
                <div className="nav-link" onClick={() => navigate(item.externalPath)} style={{ cursor: 'pointer' }}>
                    <item.icon size={20} />
                    <span className="nav-label">{getNavLabel(item.path, locale)}</span>
                    <span style={{ marginLeft: 'auto', fontSize: '0.625rem', background: 'rgba(0,0,0,0.08)', color: '#000000', padding: '2px 6px', borderRadius: 4, fontWeight: 800 }}>→</span>
                </div>
            </div>
        );
    }

    return (
        <div className="nav-group">
            {hasSub ? (
                <>
                    <div
                        className={`nav-link ${isParentActive ? 'active' : ''}`}
                        onClick={() => setOpen(!open)}
                    >
                        <div className="flex items-center gap-4">
                            <item.icon size={20} />
                            <span className="nav-label">{getNavLabel(item.path, locale)}</span>
                        </div>
                        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </div>
                    <AnimatePresence>
                        {open && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="nav-submenu"
                            >
                                {visibleSubItems.map((sub) => (
                                    <NavLink
                                        key={sub.path}
                                        to={`/admin/${item.path}/${sub.path}`}
                                        className={({ isActive }) => `nav-sub-link ${isActive ? 'active' : ''}`}
                                    >
                                        {sub.icon && <sub.icon size={16} className="sub-nav-icon" />}
                                        <span className="sub-nav-label">{getNavLabel(sub.path, locale)}</span>
                                    </NavLink>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </>
            ) : (
                <NavLink
                    to={`/admin/${item.path}`}
                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                >
                    <item.icon size={20} />
                    <span className="nav-label">{getNavLabel(item.path, locale)}</span>
                    {item.path === 'chat' && totalUnread > 0 && (
                        <span className="platform-chat-nav-badge platform-chat-nav-badge--sidebar">
                            {totalUnread > 9 ? '9+' : totalUnread}
                        </span>
                    )}
                </NavLink>
            )}
        </div>
    );
};

const getPageTitle = (pathname, locale) => {
    const segment = pathname.replace(/^\/admin\/?/, '').split('/').filter(Boolean);
    if (!segment[0]) return locale === 'ar' ? TRANSLATIONS.ar.nav.dashboard : 'Dashboard';
    if (segment[0] === 'storage-facility') {
        return getNavLabel('storage-facility', locale);
    }
    const last = segment[segment.length - 1];
    return getNavLabel(last, locale);
};

import { useAuth } from '../context/AuthContext';
import { AdminPageMetaProvider, useAdminPageMeta } from '../context/AdminPageMetaContext';

function AdminLayoutShell() {
    const location = useLocation();
    const navigate = useNavigate();
    const { logout, user, hasPermission } = useAuth();
    const { pageTitle: pageTitleOverride, clearPageTitle } = useAdminPageMeta();
    const [locale, setLocale] = useState(() => localStorage.getItem('portal-locale') || 'en');
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [accountingScope, setAccountingScope] = useState(loadSaAccountingScope);

    useEffect(() => {
        const onScopeChange = (e) => setAccountingScope(e.detail || loadSaAccountingScope());
        window.addEventListener('sa-accounting-scope-changed', onScopeChange);
        return () => window.removeEventListener('sa-accounting-scope-changed', onScopeChange);
    }, []);

    const navConfig = React.useMemo(() => {
        const hqMode =
            isHqAccountingScope(accountingScope) &&
            location.pathname.startsWith('/admin/accounting');
        return NAV_CONFIG.map((sec) => ({
            ...sec,
            items: sec.items.map((item) => {
                if (item.path !== 'accounting' || !item.subItems) return item;
                return {
                    ...item,
                    subItems: hqMode ? ACCOUNTING_HQ_SUB_ITEMS : ACCOUNTING_MONITOR_SUB_ITEMS,
                };
            }),
        }));
    }, [accountingScope, location.pathname]);

    // Close mobile menu on route change
    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [location.pathname]);

    useEffect(() => {
        if (!location.pathname.startsWith('/admin/storage-facility/')) {
            clearPageTitle();
        }
    }, [location.pathname, clearPageTitle]);

    useEffect(() => {
        const dir = locale === 'ar' ? 'rtl' : 'ltr';
        const lang = locale === 'ar' ? 'ar' : 'en';
        document.documentElement.dir = dir;
        document.documentElement.lang = lang;
        localStorage.setItem('portal-locale', locale);
    }, [locale]);

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    const pageTitle = pageTitleOverride || getPageTitle(location.pathname, locale);
    const t = TRANSLATIONS[locale] || TRANSLATIONS.en;

    const userDisplayName = user?.name || t.userName;
    const userDisplayRole = user?.adminRole ? user.adminRole.replace('_', ' ').toUpperCase() : t.userRole;
    const userInitials = userDisplayName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);

    const isChatFullscreen = location.pathname.startsWith('/admin/chat');

    if (isChatFullscreen) {
        return (
            <div className="admin-layout admin-layout--chat-fullscreen" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
                <Outlet />
            </div>
        );
    }

    return (
        <div className={`admin-layout ${isMobileMenuOpen ? 'mobile-menu-open' : ''}${location.pathname.startsWith('/admin/my-wallet') ? ' admin-layout--my-wallet' : ''}`} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="sidebar-overlay"
                        onClick={() => setIsMobileMenuOpen(false)}
                    />
                )}
            </AnimatePresence>

            <aside className={`sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
                <div className="sidebar-logo">
                    <h2 className="logo-main">FILTER <span className="logo-sub">ERP</span></h2>
                    <p className="logo-desc">{t.logoDesc}</p>
                </div>
                <nav className="sidebar-nav">
                    {navConfig.map((sec) => {
                        // Render section only if at least one visible item remains.
                        const visibleItems = sec.items.filter((item) => {
                            if (item.walletRequired && !user?.walletEnabled) return false;
                            if (item.externalPath) return true; // portal shortcuts ungated
                            if (item.subItems?.length) {
                                return item.subItems.some((sub) => {
                                    const code = permissionCodeFor(item.path, sub.path);
                                    return code ? hasPermission(code) : true;
                                });
                            }
                            const code = permissionCodeFor(item.path);
                            return code ? hasPermission(code) : true;
                        });
                        if (visibleItems.length === 0) return null;
                        return (
                            <div key={sec.section}>
                                <div className="sidebar-section-label">{t.section[sec.section]}</div>
                                {visibleItems.map((item) => (
                                    <SidebarNavItem
                                        key={item.path}
                                        item={item}
                                        basePath="/admin"
                                        locale={locale}
                                        hasPermission={hasPermission}
                                    />
                                ))}
                            </div>
                        );
                    })}
                </nav>
                <div className="sidebar-footer">
                    <div
                        className={`user-pill ${isUserMenuOpen ? 'menu-open' : ''}`}
                        onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    >
                        <div className="user-avatar">{userInitials}</div>
                        <div className="user-details">
                            <p className="user-name">{userDisplayName}</p>
                            <p className="user-role">{userDisplayRole}</p>
                        </div>
                        <ChevronDown className="user-menu-chevron" size={14} />

                        <UserProfileMenu
                            isOpen={isUserMenuOpen}
                            onClose={() => setIsUserMenuOpen(false)}
                            onLogout={handleLogout}
                            locale={locale}
                        />
                    </div>
                </div>
            </aside>
            <main className="main-content">
                <header className="top-bar">
                    <div className="header-info">
                        <div className="flex items-center gap-4">
                            <button
                                type="button"
                                className="mobile-menu-toggle"
                                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            >
                                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                            </button>
                            <div>
                                <h1 className="page-title">{locale === 'ar' ? pageTitle : pageTitle.toUpperCase()}</h1>
                                <p className="page-subtitle">{t.pageSubtitle}</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-8">
                        <div className="header-lang-switcher">
                            <span className="lang-label"><Globe size={16} /></span>
                            <button type="button" className={`lang-btn ${locale === 'en' ? 'active' : ''}`} onClick={() => setLocale('en')}>EN</button>
                            <button type="button" className={`lang-btn lang-btn-ar ${locale === 'ar' ? 'active' : ''}`} onClick={() => setLocale('ar')}>العربية</button>
                        </div>
                        <div className="top-bar-divider" />
                        <div className="notification-icon">
                            <span className="notification-dot" />
                            <Bell color="#6C757D" />
                        </div>
                    </div>
                </header>
                <Outlet />
            </main>
            {!location.pathname.startsWith('/admin/chat') && hasPermission('chat.view') && (
                <PlatformChatFab onClick={() => navigate('/admin/chat')} />
            )}
        </div>
    );
}

export default function AdminLayout() {
    return (
        <AdminPageMetaProvider>
            <AdminLayoutShell />
        </AdminPageMetaProvider>
    );
}
