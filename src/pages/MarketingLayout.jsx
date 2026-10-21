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
import { marketingT } from '../utils/marketingI18n';

function resolveSessionUserLabel(user, locale) {
    if (!user) {
        return {
            name: marketingT(locale, 'session.user'),
            role: '—',
            initial: 'U',
        };
    }
    const name =
        user.name ||
        user.fullName ||
        user.email ||
        user.username ||
        user.mobile ||
        marketingT(locale, 'session.user');
    const role =
        user.role?.name ||
        (user.userType === 'platform_admin'
            ? marketingT(locale, 'session.superAdmin')
            : String(user.userType || marketingT(locale, 'session.user')).replace(/_/g, ' '));
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

const PAGE_TITLE_KEYS = {
    dashboard: 'title.dashboard',
    campaigns: 'title.campaigns',
    'campaign-requests': 'title.campaignRequests',
    'referral-management': 'title.marketingWallet',
    expenses: 'title.expenses',
    'referral-types-rules': 'title.expenses',
    'analytics-roi': 'title.analyticsRoi',
    'campaign-reports': 'title.campaignReports',
    'ad-platforms': 'title.adPlatforms',
    'budget-optimizer': 'title.budgetOptimizer',
    integrations: 'title.integrations',
    'influencer-referrers': 'title.influencerReferrers',
    'customer-insights': 'title.customerInsights',
    'referrer-management': 'title.referrerManagement',
    'marketing-promotions': 'title.promotions',
    'promo-codes': 'title.promoCodes',
    'tier-management': 'title.tierManagement',
    chat: 'title.chat',
    'sales-reports': 'title.salesReports',
    'sales-orders': 'title.salesOrders',
};

function getPageTitle(pathname, locale) {
    const parts = pathname.split('/').filter(Boolean);
    const last = parts[parts.length - 1] || 'dashboard';
    const prev = parts[parts.length - 2] || '';

    if (last === 'new') {
        if (prev === 'promo-codes') return marketingT(locale, 'title.newPromoCode');
        if (prev === 'campaigns') return marketingT(locale, 'title.newCampaign');
        if (prev === 'marketing-promotions' || (prev === 'promotions' && parts.includes('marketing'))) {
            return marketingT(locale, 'title.newPromotion');
        }
        if (prev === 'expenses' || prev === 'referral-types-rules') {
            return marketingT(locale, 'title.newExpense');
        }
        if (prev === 'influencer-referrers') return marketingT(locale, 'title.addInfluencer');
        if (prev === 'referrers') return marketingT(locale, 'title.addReferrer');
        if (prev === 'rules') return marketingT(locale, 'title.newCommissionRule');
        if (prev === 'payouts') return marketingT(locale, 'title.newPayoutRequest');
        if (last === 'budget-request' || prev === 'budget-request') {
            return marketingT(locale, 'title.requestBudgetTopup');
        }
        return marketingT(locale, 'title.new');
    }
    if (last === 'edit') {
        if (prev === 'campaigns') return marketingT(locale, 'title.editCampaign');
        if (prev === 'influencer-referrers') return marketingT(locale, 'title.editInfluencer');
        if (prev === 'referrers') return marketingT(locale, 'title.editReferrer');
        if (prev === 'expenses' || prev === 'referral-types-rules') {
            return marketingT(locale, 'title.editExpense');
        }
        return marketingT(locale, 'title.editPromotion');
    }
    if (last === 'configure') return marketingT(locale, 'title.configurePlatform');
    if (last === 'budget-request') return marketingT(locale, 'title.requestBudgetTopup');

    const key = PAGE_TITLE_KEYS[last] || 'title.dashboard';
    return marketingT(locale, key);
}

const NAV_CONFIG = [
    {
        sectionKey: null,
        items: [
            { labelKey: 'nav.dashboard', path: 'dashboard', icon: LayoutDashboard },
            { labelKey: 'nav.myWallet', path: 'my-wallet', icon: Wallet, walletRequired: true },
            { labelKey: 'nav.chat', path: 'chat', icon: MessageCircle, navId: 'chat' },
        ],
    },
    {
        sectionKey: 'section.campaigns',
        items: [
            { labelKey: 'nav.campaigns', path: 'campaigns', icon: Megaphone },
            { labelKey: 'nav.campaignRequests', path: 'campaign-requests', icon: Ticket },
        ],
    },
    {
        sectionKey: 'section.finance',
        items: [
            { labelKey: 'nav.marketingWallet', path: 'referral-management', icon: Wallet },
            { labelKey: 'nav.expenses', path: 'expenses', icon: FileText },
            {
                labelKey: 'nav.sales',
                path: 'sales',
                icon: BadgeDollarSign,
                subItems: [
                    { labelKey: 'nav.salesReports', path: 'sales-reports' },
                    { labelKey: 'nav.salesOrders', path: 'sales-orders' },
                ],
            },
        ],
    },
    {
        sectionKey: 'section.analytics',
        items: [
            { labelKey: 'nav.analyticsRoi', path: 'analytics-roi', icon: LineChart },
            { labelKey: 'nav.campaignReports', path: 'campaign-reports', icon: FileText },
            { labelKey: 'nav.adPlatforms', path: 'ad-platforms', icon: Shield },
            { labelKey: 'nav.budgetOptimizer', path: 'budget-optimizer', icon: Gift },
            { labelKey: 'nav.influencerReferrers', path: 'influencer-referrers', icon: Users },
            { labelKey: 'nav.referrerManagement', path: 'referrer-management', icon: Star },
            { labelKey: 'nav.customerInsights', path: 'customer-insights', icon: Eye },
        ],
    },
    {
        sectionKey: 'section.promotions',
        items: [
            { labelKey: 'nav.promotions', path: 'marketing-promotions', icon: Tags },
            { labelKey: 'nav.promoCodes', path: 'promo-codes', icon: Gift },
            { labelKey: 'nav.tierManagement', path: 'tier-management', icon: Award },
        ],
    },
    {
        sectionKey: 'section.settings',
        items: [
            { labelKey: 'nav.integrations', path: 'integrations', icon: Plug },
        ],
    },
];

const SidebarNavItem = ({ item, basePath, locale }) => {
    const location = useLocation();
    const [open, setOpen] = useState(false);
    const hasSub = Array.isArray(item.subItems) && item.subItems.length > 0;
    const isParentActive = hasSub
        ? item.subItems.some((sub) => location.pathname.startsWith(`${basePath}/${sub.path}`))
        : location.pathname.startsWith(`${basePath}/${item.path}`);
    const label = marketingT(locale, item.labelKey);

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
                        <span className="nav-label">{label}</span>
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
                                    <span className="sub-nav-label">
                                        {marketingT(locale, sub.labelKey)}
                                    </span>
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
                <span className="nav-label">{label}</span>
                {isPlatformChatNavId(item.navId || item.path) && <PlatformChatNavBadge />}
            </NavLink>
        </div>
    );
};

export default function MarketingLayout() {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout } = useAuth();

    const [locale, setLocale] = useState(
        () => localStorage.getItem('marketing-locale') || 'en'
    );
    const sessionUser = resolveSessionUserLabel(user, locale);

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
        localStorage.setItem('portal-locale', locale);
    }, [locale]);

    const handleLogout = () => {
        localStorage.removeItem('portal-locale');
        localStorage.removeItem('marketing-locale');
        logout();
        navigate('/');
    };

    const pageTitle = getPageTitle(location.pathname, locale);
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
                    <p className="logo-desc">{marketingT(locale, 'layout.logoDesc')}</p>
                </div>

                <div className="marketing-sidebar-wallet">
                    <div className="marketing-sidebar-wallet-label">
                        {marketingT(locale, 'layout.walletBalance')}
                    </div>
                    <div className="marketing-sidebar-wallet-value">
                        <Wallet size={16} strokeWidth={2} />
                        <span>
                            {walletLoading
                                ? marketingT(locale, 'layout.loading')
                                : formatWalletBalance(walletBalance, walletCurrency)}
                        </span>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    {visibleNavConfig.map((sec, index) => (
                        <div key={sec.sectionKey || `main-${index}`}>
                            {sec.sectionKey ? (
                                <div className="sidebar-section-label">
                                    {marketingT(locale, sec.sectionKey)}
                                </div>
                            ) : null}
                            {sec.items.map((item) => (
                                <SidebarNavItem
                                    key={`${sec.sectionKey || 'main'}-${item.path}-${item.labelKey}`}
                                    item={item}
                                    basePath={marketingBasePath}
                                    locale={locale}
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
                                <p className="page-subtitle">{marketingT(locale, 'layout.logoDesc')}</p>
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
