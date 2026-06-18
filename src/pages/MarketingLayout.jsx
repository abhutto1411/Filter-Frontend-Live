import React, { useState, useEffect } from 'react';
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
    LogOut,
    Star,
    Eye,
    Tags,
    Trophy,
} from 'lucide-react';

import '../styles/AdminLayout.css';
import './marketing/Marketing.css';
import { useMarketingState } from './marketing/MarketingUtils';
import { getWorkshops } from '../services/superAdminApi';
import { marketingGetWallet } from '../services/superAdminMarketingApi';

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
    promotions: 'Campaigns',
    'campaign-requests': 'Campaign Requests',
    'referral-management': 'Marketing Wallet',
    'referral-types-rules': 'Expenses',
    'analytics-roi': 'Analytics & ROI',
    'loyalty-programs': 'Loyalty Programs',
    'campaign-reports': 'Campaign Reports',
    'ad-platforms': 'Ad Platforms',
    'budget-optimizer': 'Budget Optimizer',
    'influencer-referrers': 'Influencer / Referrers',
    'customer-insights': 'Customer Insight',
    'referrer-management': 'Referrer Management',
    'marketing-promotions': 'Promotions',
    'promo-codes': 'Promo Codes',
};

function getPageTitle(pathname) {
    const parts = pathname.split('/').filter(Boolean);
    const last = parts[parts.length - 1] || 'dashboard';
    return PAGE_TITLES[last] || 'Dashboard';
}

const NAV_CONFIG = [
    {
        section: null,
        items: [
            { label: 'Dashboard', path: 'dashboard', icon: LayoutDashboard },
        ],
    },
    {
        section: 'CAMPAIGNS',
        items: [
            { label: 'Campaigns', path: 'promotions', icon: Megaphone },
            { label: 'Campaign Requests', path: 'campaign-requests', icon: Ticket },
        ],
    },
    {
        section: 'FINANCE',
        items: [
            { label: 'Marketing Wallet', path: 'referral-management', icon: Wallet },
            { label: 'Expenses', path: 'referral-types-rules', icon: FileText },
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
            { label: 'Loyalty Programs', path: 'loyalty-programs', icon: Trophy },
        ],
    },
];

const SidebarNavItem = ({ item, basePath }) => {
    return (
        <div className="mk-sidebar-nav-item">
            <NavLink
                to={`${basePath}/${item.path}`}
                className={({ isActive }) =>
                    `mk-sidebar-link ${isActive ? 'active' : ''}`
                }
            >
                <item.icon size={12} strokeWidth={2} />
                <span>{item.label}</span>
            </NavLink>
        </div>
    );
};

export default function MarketingLayout() {
    const location = useLocation();
    const navigate = useNavigate();

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
        localStorage.removeItem('filter_auth_token');
        localStorage.removeItem('filter_auth_user');
        localStorage.removeItem('filter_auth_workshop');
        navigate('/');
    };

    const pageTitle = getPageTitle(location.pathname);

    return (
        <div
            className={`marketing-layout-root ${isMobileMenuOpen ? 'mobile-menu-open' : ''}`}
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

            <aside className={`marketing-yellow-sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
                <div className="marketing-brand-row">
                    <div className="marketing-brand-icon">
                        <Megaphone size={15} strokeWidth={2.2} />
                    </div>

                    <div className="marketing-brand-text">
                        <div className="marketing-brand-title">Marketing</div>
                        <div className="marketing-brand-sub">&amp; Care Portal</div>
                    </div>
                </div>

                <div className="marketing-wallet-card">
                    <div className="marketing-wallet-label">WALLET BALANCE</div>
                    <div className="marketing-wallet-value">
                        <Wallet size={12} strokeWidth={2} />
                        <span>
                            {walletLoading
                                ? 'Loading...'
                                : formatWalletBalance(walletBalance, walletCurrency)}
                        </span>
                    </div>
                </div>

                <nav className="marketing-sidebar-nav">
                    {NAV_CONFIG.map((sec, index) => (
                        <div key={sec.section || `main-${index}`} className="marketing-nav-section">
                            {sec.section ? (
                                <div className="marketing-section-label">{sec.section}</div>
                            ) : null}

                            {sec.items.map((item) => (
                                <SidebarNavItem
                                    key={`${sec.section || 'main'}-${item.path}-${item.label}`}
                                    item={item}
                                    basePath="/marketing"
                                />
                            ))}
                        </div>
                    ))}
                </nav>

                <div className="marketing-user-row">
                    <div className="marketing-user-left">
                        <div className="marketing-user-avatar">A</div>

                        <div className="marketing-user-meta">
                            <div className="marketing-user-name">abhutto85</div>
                            <div className="marketing-user-role">super_admin</div>
                        </div>
                    </div>

                    <button
                        type="button"
                        className="marketing-user-logout"
                        onClick={handleLogout}
                        title="Logout"
                    >
                        <LogOut size={12} strokeWidth={2} />
                    </button>

                    <UserProfileMenu
                        isOpen={isUserMenuOpen}
                        onClose={() => setIsUserMenuOpen(false)}
                        onLogout={handleLogout}
                        locale={locale}
                    />
                </div>
            </aside>

            <main className="marketing-main-content">
                <header className="marketing-simple-header">
                    <div className="marketing-header-left">
                        <button
                            type="button"
                            className="marketing-mobile-toggle"
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        >
                            {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
                        </button>

                        <span className="marketing-header-title">{pageTitle}</span>
                        <span className="marketing-header-subtitle">
                            Marketing &amp; Care Portal
                        </span>
                    </div>

                    <div className="marketing-header-right">
                        <span className="marketing-header-user">abhutto85</span>

                        <button
                            type="button"
                            onClick={handleLogout}
                            className="marketing-header-logout"
                        >
                            <LogOut size={14} strokeWidth={2} />
                            Logout
                        </button>
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

            <style>
                {`
                    .marketing-layout-root {
                        width: 100%;
                        min-height: 100vh;
                        display: flex;
                        background: #f3f4f6;
                        overflow: hidden;
                        font-family: 'Poppins', sans-serif;
                    }

                    .marketing-yellow-sidebar {
                        width: 225px;
                        flex: 0 0 225px;
                        height: 100vh;
                        background: #f7c600;
                        color: #111827;
                        display: flex;
                        flex-direction: column;
                        position: sticky;
                        top: 0;
                        left: 0;
                        z-index: 20;
                        overflow: hidden;
                        box-sizing: border-box;
                    }

                    .marketing-brand-row {
                        height: 52px;
                        display: flex;
                        align-items: center;
                        gap: 9px;
                        padding: 0 14px;
                        box-sizing: border-box;
                        flex-shrink: 0;
                    }

                    .marketing-brand-icon {
                        width: 32px;
                        height: 32px;
                        border-radius: 7px;
                        background: #111827;
                        color: #f7c600;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        flex-shrink: 0;
                    }

                    .marketing-brand-title {
                        font-size: 13px;
                        font-weight: 800;
                        color: #111827;
                        line-height: 1.05;
                    }

                    .marketing-brand-sub {
                        font-size: 9px;
                        font-weight: 500;
                        color: #1f2937;
                        line-height: 1.05;
                    }

                    .marketing-wallet-card {
                        margin: 6px 9px 12px;
                        height: 61px;
                        border-radius: 7px;
                        background: rgba(185, 139, 0, 0.18);
                        padding: 10px 12px;
                        box-sizing: border-box;
                        flex-shrink: 0;
                    }

                    .marketing-wallet-label {
                        font-size: 8px;
                        font-weight: 800;
                        color: #5b4600;
                        letter-spacing: 1.5px;
                        line-height: 1;
                        margin-bottom: 12px;
                    }

                    .marketing-wallet-value {
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        color: #111827;
                        font-size: 11px;
                        font-weight: 800;
                        line-height: 1;
                    }

                    .marketing-wallet-value span {
                        font-size: 10px;
                        font-weight: 500;
                    }

                    .marketing-sidebar-nav {
                        flex: 1;
                        min-height: 0;
                        overflow-y: auto;
                        overflow-x: hidden;
                        padding-bottom: 10px;
                        padding-right: 4px;
                        box-sizing: border-box;
                        scrollbar-width: thin;
                        scrollbar-color: #9ca3af transparent;
                    }

                    .marketing-sidebar-nav::-webkit-scrollbar {
                        width: 6px;
                    }

                    .marketing-sidebar-nav::-webkit-scrollbar-track {
                        background: transparent;
                    }

                    .marketing-sidebar-nav::-webkit-scrollbar-thumb {
                        background: #9ca3af;
                        border-radius: 30px;
                    }

                    .marketing-sidebar-nav::-webkit-scrollbar-thumb:hover {
                        background: #6b7280;
                    }

                    .marketing-nav-section {
                        margin-bottom: 11px;
                    }

                    .marketing-section-label {
                        padding: 0 14px;
                        margin-bottom: 5px;
                        font-size: 7.8px;
                        font-weight: 900;
                        letter-spacing: 1.7px;
                        color: rgba(17, 24, 39, 0.45);
                    }

                    .mk-sidebar-nav-item {
                        padding: 0 8px;
                        box-sizing: border-box;
                    }

                    .mk-sidebar-link {
                        height: 31px;
                        border-radius: 3px;
                        display: flex;
                        align-items: center;
                        gap: 9px;
                        padding: 0 8px;
                        color: #111827;
                        text-decoration: none;
                        font-size: 12px;
                        font-weight: 500;
                        box-sizing: border-box;
                        white-space: nowrap;
                    }

                    .mk-sidebar-link:hover {
                        background: rgba(0, 0, 0, 0.08);
                        color: #111827;
                    }

                    .mk-sidebar-link.active {
                        background: var(--sidebar-active-bg);
                        color: var(--sidebar-text-active);
                        font-weight: 600;
                        box-shadow: inset 4px 0 0 var(--color-primary);
                    }

                    .mk-sidebar-link svg {
                        width: 13px;
                        height: 13px;
                        flex-shrink: 0;
                    }

                    .mk-sidebar-link span {
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }

                    .marketing-user-row {
                        height: 50px;
                        border-top: 1px solid rgba(17, 24, 39, 0.08);
                        background: rgba(185, 139, 0, 0.10);
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        padding: 0 12px;
                        box-sizing: border-box;
                        flex-shrink: 0;
                    }

                    .marketing-user-left {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        min-width: 0;
                    }

                    .marketing-user-avatar {
                        width: 22px;
                        height: 22px;
                        border-radius: 50%;
                        background: #111827;
                        color: #f7c600;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 10px;
                        font-weight: 800;
                        flex-shrink: 0;
                    }

                    .marketing-user-meta {
                        min-width: 0;
                    }

                    .marketing-user-name {
                        font-size: 10px;
                        font-weight: 800;
                        color: #111827;
                        line-height: 1.05;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }

                    .marketing-user-role {
                        font-size: 8px;
                        color: rgba(17, 24, 39, 0.65);
                        line-height: 1.05;
                        margin-top: 2px;
                    }

                    .marketing-user-logout {
                        border: none;
                        background: transparent;
                        color: #111827;
                        cursor: pointer;
                        padding: 4px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        flex-shrink: 0;
                    }

                    .marketing-user-logout:hover {
                        background: rgba(0, 0, 0, 0.06);
                        border-radius: 4px;
                    }

                    .marketing-main-content {
                        flex: 1;
                        min-width: 0;
                        height: 100vh;
                        overflow-y: auto;
                        background: #f3f4f6;
                        padding: 0 !important;
                        margin: 0 !important;
                    }

                    .marketing-simple-header {
                        height: 54px;
                        background: #ffffff;
                        border-bottom: 1px solid #e5e7eb;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        padding: 0 26px;
                        box-sizing: border-box;
                        position: sticky;
                        top: 0;
                        z-index: 10;
                    }

                    .marketing-header-left,
                    .marketing-header-right {
                        display: flex;
                        align-items: center;
                    }

                    .marketing-header-left {
                        gap: 8px;
                    }

                    .marketing-header-right {
                        gap: 14px;
                    }

                    .marketing-header-title {
                        font-size: 16px;
                        font-weight: 800;
                        color: #111827;
                        line-height: 1;
                    }

                    .marketing-header-subtitle {
                        font-size: 13px;
                        font-weight: 400;
                        color: #94a3b8;
                        line-height: 1;
                    }

                    .marketing-header-user {
                        font-size: 14px;
                        font-weight: 800;
                        color: #111827;
                    }

                    .marketing-header-logout {
                        border: none;
                        background: transparent;
                        color: #6b7280;
                        display: flex;
                        align-items: center;
                        gap: 5px;
                        cursor: pointer;
                        font-size: 12px;
                        font-weight: 500;
                        padding: 0;
                    }

                    .marketing-mobile-toggle {
                        display: none;
                        border: none;
                        background: transparent;
                        padding: 0;
                        margin-right: 8px;
                        color: #111827;
                        cursor: pointer;
                    }

                    .sidebar-overlay {
                        position: fixed;
                        inset: 0;
                        background: rgba(15, 23, 42, 0.35);
                        z-index: 19;
                    }

                    .marketing-layout-root .top-bar {
                        display: none !important;
                    }

                    .marketing-layout-root .main-content {
                        padding: 0 !important;
                        margin: 0 !important;
                    }

                    @media (max-width: 900px) {
                        .marketing-layout-root {
                            display: block;
                        }

                        .marketing-yellow-sidebar {
                            position: fixed;
                            transform: translateX(-100%);
                            transition: transform 0.25s ease;
                        }

                        .marketing-yellow-sidebar.open {
                            transform: translateX(0);
                        }

                        .marketing-main-content {
                            width: 100%;
                            height: 100vh;
                        }

                        .marketing-mobile-toggle {
                            display: inline-flex;
                            align-items: center;
                            justify-content: center;
                        }

                        .marketing-simple-header {
                            padding: 0 16px;
                        }

                        .marketing-header-subtitle {
                            display: none;
                        }
                    }
                `}
            </style>
        </div>
    );
}