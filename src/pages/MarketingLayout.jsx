import React, { useState, useEffect, useMemo } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import UserProfileMenu from '../components/UserProfileMenu';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard,
    Megaphone,
    Ticket,
    Users,
    FileText,
    Gift,
    LineChart,
    Menu,
    X,
    Shield,
    Wallet,
    Star,
    Eye,
    Tags,
    Award,
    Plug,
    MessageCircle,
    BadgeDollarSign,
    ChevronDown,
    ChevronRight,
    Globe,
} from 'lucide-react';

import '../styles/AdminLayout.css';
import '../styles/admin/PlatformChat.css';
import './marketing/Marketing.css';
import { useMarketingState } from './marketing/MarketingUtils';
import { getWorkshops } from '../services/superAdminApi';
import { marketingGetWallet } from '../services/superAdminMarketingApi';
import { useAuth } from '../context/AuthContext';
import MarketingPlatformChatPage from './marketing/MarketingPlatformChatPage';
import PlatformChatNavBadge from '../components/platform-chat/PlatformChatNavBadge';
import PlatformChatFab from '../components/platform-chat/PlatformChatFab';
import { isPlatformChatNavId } from '../utils/platformChatForUser';

function resolveSessionUserLabel(user) {
    if (!user) {
        return { name: 'User', role: '—', initial: 'U' };
    }
    const name =
        user.name ||
        user.fullName ||
        user.email ||
        user.username ||
        user.mobile ||
        'User';
    const role =
        user.role?.name ||
        (user.userType === 'platform_admin'
            ? 'Super Admin'
            : String(user.userType || 'User').replace(/_/g, ' '));
    const initial = String(name).trim().charAt(0).toUpperCase() || 'U';
    return { name, role, initial };
}

function normalizeWorkshopsPayload(payload) {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.workshops)) return payload.workshops;
    if (Array.isArray(payload.items)) return payload.items;
    if (Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload.data?.workshops)) return payload.data.workshops;
    return [];
}

function normalizeWalletPayload(payload) {
    const wallet =
        payload?.wallet ||
        payload?.data?.wallet ||
        payload?.marketingWallet ||
        payload?.data?.marketingWallet ||
        payload;

    const balance = Number(
        wallet?.balance ??
        payload?.balance ??
        payload?.data?.balance ??
        0
    );

    const currencyCode =
        wallet?.currencyCode ||
        wallet?.currency_code ||
        payload?.currencyCode ||
        payload?.currency_code ||
        'SAR';

    return {
        balance: Number.isFinite(balance) ? balance : 0,
        currencyCode,
    };
}

function formatWalletBalance(value, currency = 'SAR') {
    const amount = Number(value);

    if (!Number.isFinite(amount)) {
        return `0 ${currency}`;
    }

    return `${amount.toLocaleString(undefined, {
        maximumFractionDigits: 0,
    })} ${currency}`;
}

const PAGE_TITLES = {
    dashboard: 'Dashboard',
    campaigns: 'Campaigns',
    'campaign-requests': 'Campaign Requests',
    'referral-management': 'Marketing Wallet',
    expenses: 'Expenses',
    'referral-types-rules': 'Expenses',
    'analytics-roi': 'Analytics & ROI',
    'campaign-reports': 'Campaign Reports',
    'ad-platforms': 'Ad Platforms',
    'budget-optimizer': 'Budget Optimizer',
    integrations: 'Integrations & API Keys',
    'influencer-referrers': 'Influencer / Referrers',
    'customer-insights': 'Customer Insight',
    'referrer-management': 'Referrer Management',
    'marketing-promotions': 'Promotions',
    'promo-codes': 'Promo Codes',
    'tier-management': 'Tier Management',
    chat: 'Chat',
    'sales-reports': 'Sales Reports',
    'sales-orders': 'Sales Orders',
};

function getPageTitle(pathname) {
    const parts = pathname.split('/').filter(Boolean);
    const last = parts[parts.length - 1] || 'dashboard';
    const prev = parts[parts.length - 2] || '';

    if (last === 'new') {
        if (prev === 'promo-codes') return 'Generate Promo Code';
        if (prev === 'campaigns') return 'New Campaign';
        if (prev === 'marketing-promotions' || (prev === 'promotions' && parts.includes('marketing'))) return 'New Promotion';
        if (prev === 'expenses' || prev === 'referral-types-rules') return 'New Expense';
        if (prev === 'influencer-referrers') return 'Add Influencer';
        if (prev === 'referrers') return 'Add Referrer';
        if (prev === 'rules') return 'New Commission Rule';
        if (prev === 'payouts') return 'New Payout Request';
        if (last === 'budget-request' || prev === 'budget-request') return 'Request Budget Top-up';
        return 'New';
    }
    if (last === 'edit') {
        if (prev === 'campaigns') return 'Edit Campaign';
        if (prev === 'influencer-referrers') return 'Edit Influencer';
        if (prev === 'referrers') return 'Edit Referrer';
        if (prev === 'expenses' || prev === 'referral-types-rules') return 'Edit Expense';
        return 'Edit Promotion';
    }
    if (last === 'configure') return 'Configure Platform';
    if (last === 'budget-request') return 'Request Budget Top-up';

    return PAGE_TITLES[last] || 'Dashboard';
}

const NAV_CONFIG = [
    {
        section: null,
        items: [
            { label: 'Dashboard', path: 'dashboard', icon: LayoutDashboard },
            { label: 'My Wallet', path: 'my-wallet', icon: Wallet, walletRequired: true },
            { label: 'Chat', path: 'chat', icon: MessageCircle, navId: 'chat' },
        ],
    },
    {
        section: 'CAMPAIGNS',
        items: [
            { label: 'Campaigns', path: 'campaigns', icon: Megaphone },
            { label: 'Campaign Requests', path: 'campaign-requests', icon: Ticket },
        ],
    },
    {
        section: 'FINANCE',
        items: [
            { label: 'Marketing Wallet', path: 'referral-management', icon: Wallet },
            { label: 'Expenses', path: 'expenses', icon: FileText },
            {
                label: 'Sales',
                path: 'sales',
                icon: BadgeDollarSign,
                subItems: [
                    { label: 'Sales Reports', path: 'sales-reports' },
                    { label: 'Sales Orders', path: 'sales-orders' },
                ],
            },
        ],
    },
    {
        section: 'ANALYTICS',
        items: [
            { label: 'Analytics & ROI', path: 'analytics-roi', icon: LineChart },
            { label: 'Campaign Reports', path: 'campaign-reports', icon: FileText },
            { label: 'Ad Platforms', path: 'ad-platforms', icon: Shield },
            { label: 'Budget Optimizer', path: 'budget-optimizer', icon: Gift },
            { label: 'Influencer / Referrers', path: 'influencer-referrers', icon: Users },
            { label: 'Referrer Management', path: 'referrer-management', icon: Star },
            { label: 'Customer Insight', path: 'customer-insights', icon: Eye },
        ],
    },
    {
        section: 'PROMOTIONS',
        items: [
            { label: 'Promotions', path: 'marketing-promotions', icon: Tags },
            { label: 'Promo Codes', path: 'promo-codes', icon: Gift },
            { label: 'Tier Management', path: 'tier-management', icon: Award },
        ],
    },
    {
        section: 'SETTINGS',
        items: [
            { label: 'Integrations & API Keys', path: 'integrations', icon: Plug },
        ],
    },
];

const SidebarNavItem = ({ item, basePath }) => {
    const location = useLocation();
    const [open, setOpen] = useState(false);
    const hasSub = Array.isArray(item.subItems) && item.subItems.length > 0;
    const isParentActive = hasSub
        ? item.subItems.some((sub) => location.pathname.startsWith(`${basePath}/${sub.path}`))
        : location.pathname.startsWith(`${basePath}/${item.path}`);

    useEffect(() => {
        if (isParentActive) setOpen(true);
    }, [isParentActive]);

    if (hasSub) {
        return (
            <div className="nav-group">
                <div
                    className={`nav-link ${isParentActive ? 'active' : ''}`}
                    onClick={() => setOpen((v) => !v)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setOpen((v) => !v);
                        }
                    }}
                >
                    <div className="flex items-center gap-4">
                        <item.icon size={20} />
                        <span className="nav-label">{item.label}</span>
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
                            {item.subItems.map((sub) => (
                                <NavLink
                                    key={sub.path}
                                    to={`${basePath}/${sub.path}`}
                                    className={({ isActive }) =>
                                        `nav-sub-link ${isActive ? 'active' : ''}`
                                    }
                                >
                                    <span className="sub-nav-label">{sub.label}</span>
                                </NavLink>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    }

    return (
        <div className="nav-group">
            <NavLink
                to={`${basePath}/${item.path}`}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
                <item.icon size={20} />
                <span className="nav-label">{item.label}</span>
                {isPlatformChatNavId(item.navId || item.path) && <PlatformChatNavBadge />}
            </NavLink>
        </div>
    );
};

export default function MarketingLayout() {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const sessionUser = resolveSessionUserLabel(user);

    const [locale, setLocale] = useState(
        () => localStorage.getItem('marketing-locale') || 'en'
    );
    const [showAddModal, setShowAddModal] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [workshops, setWorkshops] = useState([]);
    const [marketingWorkshopId, setMarketingWorkshopId] = useState('');

    const [walletBalance, setWalletBalance] = useState(0);
    const [walletCurrency, setWalletCurrency] = useState('SAR');
    const [walletLoading, setWalletLoading] = useState(true);

    const {
        promotions,
        setPromotions,
        promoCodes,
        setPromoCodes,
        referrers,
        setReferrers,
        referralCodes,
        setReferralCodes,
        loyaltyTiers,
        setLoyaltyTiers,
        loyaltyProgram,
        setLoyaltyProgram,
    } = useMarketingState();

    useEffect(() => {
        getWorkshops({ limit: '200', offset: '0' })
            .then((data) => setWorkshops(normalizeWorkshopsPayload(data)))
            .catch(() => setWorkshops([]));
    }, []);

    useEffect(() => {
        let mounted = true;

        const loadWalletBalance = async () => {
            try {
                setWalletLoading(true);

                const data = await marketingGetWallet();
                const normalized = normalizeWalletPayload(data);

                if (!mounted) return;

                setWalletBalance(normalized.balance);
                setWalletCurrency(normalized.currencyCode);
            } catch (error) {
                if (!mounted) return;

                console.error('Failed to load marketing wallet balance:', error);
                setWalletBalance(0);
                setWalletCurrency('SAR');
            } finally {
                if (mounted) {
                    setWalletLoading(false);
                }
            }
        };

        loadWalletBalance();

        return () => {
            mounted = false;
        };
    }, [location.pathname]);

    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [location.pathname]);

    useEffect(() => {
        document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = locale === 'ar' ? 'ar' : 'en';
        localStorage.setItem('marketing-locale', locale);
    }, [locale]);

    const handleLogout = () => {
        localStorage.removeItem('portal-locale');
        localStorage.removeItem('marketing-locale');
        logout();
        navigate('/');
    };

    const pageTitle = getPageTitle(location.pathname);
    const marketingBasePath = location.pathname.startsWith('/admin/marketing')
        ? '/admin/marketing'
        : '/marketing';

    const visibleNavConfig = useMemo(
        () => NAV_CONFIG.map((sec) => ({
            ...sec,
            items: sec.items.filter((item) => {
                if (item.walletRequired) return Boolean(user?.walletEnabled);
                return true;
            }),
        })).filter((sec) => sec.items.length > 0),
        [user?.walletEnabled],
    );
    const isChatRoute = location.pathname.includes('/chat');

    if (isChatRoute) {
        return (
            <div className="admin-layout admin-layout--chat-fullscreen" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
                <MarketingPlatformChatPage />
            </div>
        );
    }

    return (
        <div
            className={`admin-layout marketing-layout ${isMobileMenuOpen ? 'mobile-menu-open' : ''}`}
            dir={locale === 'ar' ? 'rtl' : 'ltr'}
        >
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
                    <h2 className="logo-main">
                        FILTER <span className="logo-sub">ERP</span>
                    </h2>
                    <p className="logo-desc">Marketing &amp; Care Portal</p>
                </div>

                <div className="marketing-sidebar-wallet">
                    <div className="marketing-sidebar-wallet-label">Wallet Balance</div>
                    <div className="marketing-sidebar-wallet-value">
                        <Wallet size={16} strokeWidth={2} />
                        <span>
                            {walletLoading
                                ? 'Loading…'
                                : formatWalletBalance(walletBalance, walletCurrency)}
                        </span>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    {visibleNavConfig.map((sec, index) => (
                        <div key={sec.section || `main-${index}`}>
                            {sec.section ? (
                                <div className="sidebar-section-label">{sec.section}</div>
                            ) : null}
                            {sec.items.map((item) => (
                                <SidebarNavItem
                                    key={`${sec.section || 'main'}-${item.path}-${item.label}`}
                                    item={item}
                                    basePath={marketingBasePath}
                                />
                            ))}
                        </div>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div
                        className={`user-pill ${isUserMenuOpen ? 'menu-open' : ''}`}
                        onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    >
                        <div className="user-avatar">{sessionUser.initial}</div>
                        <div className="user-details">
                            <p className="user-name">{sessionUser.name}</p>
                            <p className="user-role">{sessionUser.role}</p>
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
                                <h1 className="page-title">{pageTitle.toUpperCase()}</h1>
                                <p className="page-subtitle">Marketing &amp; Care Portal</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-8">
                        <div className="header-lang-switcher">
                            <span className="lang-label"><Globe size={16} /></span>
                            <button
                                type="button"
                                className={`lang-btn ${locale === 'en' ? 'active' : ''}`}
                                onClick={() => setLocale('en')}
                            >
                                EN
                            </button>
                            <button
                                type="button"
                                className={`lang-btn lang-btn-ar ${locale === 'ar' ? 'active' : ''}`}
                                onClick={() => setLocale('ar')}
                            >
                                العربية
                            </button>
                        </div>
                    </div>
                </header>

                <Outlet
                    context={{
                        showAddModal,
                        setShowAddModal,
                        promotions,
                        setPromotions,
                        promoCodes,
                        setPromoCodes,
                        referrers,
                        setReferrers,
                        referralCodes,
                        setReferralCodes,
                        loyaltyTiers,
                        setLoyaltyTiers,
                        loyaltyProgram,
                        setLoyaltyProgram,
                        marketingWorkshopId,
                        setMarketingWorkshopId,
                        workshops,
                        locale,
                        setLocale,
                        walletBalance,
                        walletCurrency,
                    }}
                />
            </main>

            <PlatformChatFab
                hidden={isChatRoute}
                onClick={() => navigate(`${marketingBasePath}/chat`)}
            />
        </div>
    );
}