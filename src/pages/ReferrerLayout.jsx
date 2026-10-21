import React, { useCallback, useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation, NavLink } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Globe, Menu, Wallet, X } from 'lucide-react';
import { REFERRER_NAV_ITEMS } from './referrer-portal/ReferrerConstants';
import './referrer-portal/ReferrerPortal.css';
import '../styles/AdminLayout.css';
import { useAuth } from '../context/AuthContext';
import UserProfileMenu from '../components/UserProfileMenu';
import { rfT } from '../utils/referrerPortalI18n';
import { referrerPortalGetOverview } from '../services/referrerPortalApi';
import { referrerWalletFromOverview } from './referrer-portal/useReferrerPortal';

const PAGE_TITLE_KEYS = {
    dashboard: 'title.dashboard',
    my_referrals: 'title.myReferrals',
    wallet: 'title.wallet',
    reports: 'title.reports',
    notifications: 'title.notifications',
    settings: 'title.settings',
};

function readLocale() {
    if (typeof localStorage === 'undefined') return 'en';
    const stored =
        localStorage.getItem('portal-locale') ||
        localStorage.getItem('referrer-locale');
    return stored === 'ar' ? 'ar' : 'en';
}

export default function ReferrerLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuth();
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [locale, setLocale] = useState(readLocale);
    const [overview, setOverview] = useState(null);
    const [overviewError, setOverviewError] = useState('');
    const [overviewLoading, setOverviewLoading] = useState(true);

    const segment = location.pathname.split('/').filter(Boolean)[1] || 'dashboard';
    const pageTitle = rfT(locale, PAGE_TITLE_KEYS[segment] || 'title.dashboard');
    const isCommunity = Boolean(overview?.profile?.isCommunity);
    const navItems = REFERRER_NAV_ITEMS.filter((item) => !isCommunity || item.id !== 'wallet');

    const displayName =
        overview?.profile?.name || user?.name || user?.email || rfT(locale, 'layout.guest');
    const userRole = rfT(locale, isCommunity ? 'layout.communityRole' : 'layout.role');
    const initials = displayName
        .split(' ')
        .map((n) => n[0])
        .filter(Boolean)
        .join('')
        .toUpperCase()
        .substring(0, 2) || 'RF';

    const availableBalance = referrerWalletFromOverview(overview).unpaid.toLocaleString(
        locale === 'ar' ? 'ar-SA' : 'en-US',
        { minimumFractionDigits: 2, maximumFractionDigits: 2 },
    );

    const reloadOverview = useCallback(async () => {
        setOverviewLoading(true);
        try {
            const res = await referrerPortalGetOverview();
            setOverview(res);
            setOverviewError('');
        } catch (err) {
            setOverview(null);
            setOverviewError(err?.message || rfT(locale, 'set.noProfile'));
        } finally {
            setOverviewLoading(false);
        }
    }, [locale]);

    useEffect(() => {
        reloadOverview();
    }, [reloadOverview]);

    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [location.pathname]);

    useEffect(() => {
        if (!overviewLoading && isCommunity && segment === 'wallet') {
            navigate('/referrer-portal/dashboard', { replace: true });
        }
    }, [overviewLoading, isCommunity, segment, navigate]);

    useEffect(() => {
        document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = locale === 'ar' ? 'ar' : 'en';
        localStorage.setItem('portal-locale', locale);
        localStorage.setItem('referrer-locale', locale);
    }, [locale]);

    const handleLogout = () => {
        logout();
        navigate('/referrer-portal/login', { replace: true });
    };

    return (
        <div
            className={`admin-layout referrer-layout ${isMobileMenuOpen ? 'mobile-menu-open' : ''}`}
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
                    <p className="logo-desc">{rfT(locale, 'layout.logoDesc')}</p>
                </div>

                {!isCommunity ? (
                    <div className="rf-sidebar-wallet">
                        <div className="rf-sidebar-wallet-label">{rfT(locale, 'layout.available')}</div>
                        <div className="rf-sidebar-wallet-value">
                            <Wallet size={16} strokeWidth={2} />
                            <span>{availableBalance} SAR</span>
                        </div>
                    </div>
                ) : null}

                <nav className="sidebar-nav">
                    <div className="sidebar-section-label">{rfT(locale, 'layout.logoDesc')}</div>
                    {navItems.map((item) => (
                        <NavLink
                            key={item.id}
                            to={item.id === 'dashboard' ? '/referrer-portal/dashboard' : `/referrer-portal/${item.id}`}
                            end={item.id === 'dashboard'}
                            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                        >
                            <item.icon size={18} />
                            <span>{rfT(locale, item.labelKey)}</span>
                            {item.id === 'notifications' && Number(overview?.stats?.unreadNotifications || 0) > 0 ? (
                                <span className="rf-nav-badge">{Number(overview.stats.unreadNotifications)}</span>
                            ) : null}
                        </NavLink>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div
                        className={`user-pill ${isUserMenuOpen ? 'menu-open' : ''}`}
                        onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    >
                        <div className="user-avatar">{initials}</div>
                        <div className="user-details">
                            <p className="user-name">{displayName}</p>
                            <p className="user-role">{userRole}</p>
                        </div>
                        <ChevronDown className="user-menu-chevron" size={14} />
                        <UserProfileMenu
                            isOpen={isUserMenuOpen}
                            onClose={() => setIsUserMenuOpen(false)}
                            onLogout={handleLogout}
                            onSettings={() => navigate('/referrer-portal/settings')}
                            onProfile={() => navigate('/referrer-portal/settings?tab=profile')}
                            locale={locale}
                        />
                    </div>
                </div>
            </aside>

            <main className="main-content">
                <header className="top-bar">
                    <div className="header-info">
                        <div className="rf-topbar-start">
                            <button
                                type="button"
                                className="mobile-menu-toggle"
                                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            >
                                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                            </button>
                            <div>
                                <h1 className="page-title">{pageTitle}</h1>
                                <p className="page-subtitle">{rfT(locale, 'layout.logoDesc')}</p>
                            </div>
                        </div>
                    </div>
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
                </header>

                <Outlet
                    context={{
                        locale,
                        setLocale,
                        displayName,
                        overview,
                        overviewError,
                        overviewLoading,
                        reloadOverview,
                        isCommunity,
                    }}
                />
            </main>
        </div>
    );
}
