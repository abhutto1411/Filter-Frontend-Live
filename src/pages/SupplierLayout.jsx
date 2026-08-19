import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Warehouse,
    ArrowLeft,
    LogOut,
    ShoppingCart,
    ChevronDown,
    ChevronRight,
} from 'lucide-react';
import { NAV_GROUPS } from './supplier/constants';
import SupplierDashboard from './supplier/SupplierDashboard';
import SupplierOrderQueue from './supplier/SupplierOrderQueue';
import SupplierStockInventory from './supplier/SupplierStockInventory';
import SupplierWorkshopAlerts from './supplier/SupplierWorkshopAlerts';
import SupplierCatalog from './supplier/SupplierCatalog';
import SupplierEmployeesPage from './supplier/supplier_employees';
import SupplierSalesInvoices from './supplier/SupplierSalesInvoices';
import SupplierAffiliatedSalesReturns from './supplier/SupplierAffiliatedSalesReturns';
import SupplierPurchaseInvoices from './supplier/SupplierPurchaseInvoices';
import SupplierWorkshopPurchaseInvoices from './supplier/SupplierWorkshopPurchaseInvoices';
import SupplierAffiliatedWorkshops from './supplier/SupplierAffiliatedWorkshops';
import SupplierNonAffiliatedCustomers from './supplier/SupplierNonAffiliatedCustomers';
import SupplierCashBank from './supplier/SupplierCashBank';
import SupplierExpenses from './supplier/SupplierExpenses';
import SupplierAccountingPage from './supplier/SupplierAccountingPage';
import SupplierAccountLedgerPage from './supplier/accounting/SupplierAccountLedgerPage';
import SupplierStorageFacility from './supplier/storage-facility/SupplierStorageFacility';
import SupplierStaffAppPage from './supplier/SupplierStaffAppPage';
import SupplierPlatformChatPage from './supplier/SupplierPlatformChatPage';
import PlatformChatNavBadge from '../components/platform-chat/PlatformChatNavBadge';
import PlatformChatFab from '../components/platform-chat/PlatformChatFab';
import { isPlatformChatNavId } from '../utils/platformChatForUser';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { getSupplierProfile, getSupplierReceivables } from '../services/supplierApi';
import {
    spT,
    SP_NAV_LABEL_KEYS,
    SP_GROUP_LABEL_KEYS,
} from '../utils/supplierPortalI18n';
import './workshop/Workshop.css';
import '../styles/admin/PlatformChat.css';
import '../styles/ThemeOnly.css';
import '../styles/RowActionsMenu.css';
import { ShimmerLine } from '../components/supplier/Shimmer';

export default function SupplierLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuth();

    const [locale, setLocale] = useState(() => localStorage.getItem('portal-locale') || 'en');
    useEffect(() => {
        document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = locale === 'ar' ? 'ar' : 'en';
        localStorage.setItem('portal-locale', locale);
    }, [locale]);

    const t = useCallback((key, vars) => spT(locale, key, vars), [locale]);

    const getActiveTabFromUrl = () => {
        const parts = location.pathname.split('/').filter(Boolean);
        if (parts[1] === 'accounting' && parts[2]) {
            return `accounting_${parts[2]}`;
        }
        return parts[1] || 'dashboard';
    };

    const activeTab = getActiveTabFromUrl();
    const [expandedGroups, setExpandedGroups] = useState(['accounting']);

    const [arSummary, setArSummary] = useState(null);
    const [arSummaryError, setArSummaryError] = useState('');
    const [profileName, setProfileName] = useState(user?.name || '');
    const [profileRole, setProfileRole] = useState('');
    const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

    const storageBrandPortal = useMemo(() => {
        if (user?.supplier?.portalScope === 'storage_brand') {
            return user.supplier.storageBrandId ?? null;
        }
        try {
            const u = JSON.parse(localStorage.getItem('filter_auth_user') || '{}');
            if (u?.supplier?.portalScope === 'storage_brand') {
                return u?.supplier?.storageBrandId ?? null;
            }
        } catch {
            /* ignore */
        }
        return null;
    }, [user?.supplier?.portalScope, user?.supplier?.storageBrandId]);

    const navLabel = useCallback(
        (id, fallback) => {
            const key = SP_NAV_LABEL_KEYS[id];
            if (id === 'storage_facility' && storageBrandPortal) return t('nav.myStorage');
            return key ? t(key) : fallback;
        },
        [t, storageBrandPortal],
    );

    const setActiveTab = (tab) => {
        if (storageBrandPortal && tab !== 'storage_facility') return;
        if (tab.startsWith('accounting_')) {
            const sub = tab.replace('accounting_', '');
            navigate(`/supplier/accounting/${sub}`);
        } else if (tab === 'storage_facility' && storageBrandPortal) {
            navigate(
                `/supplier/storage_facility?brand=${encodeURIComponent(storageBrandPortal)}`,
            );
        } else {
            navigate(`/supplier/${tab}`);
        }
    };

    const toggleGroup = (id) => {
        setExpandedGroups((prev) =>
            prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id],
        );
    };

    const performLogout = () => {
        setLogoutConfirmOpen(false);
        logout();
        navigate('/', { replace: true });
    };

    const userType = String(user?.userType || user?.type || '').toLowerCase();
    const canGoBackToAdmin =
        userType === 'admin' ||
        userType === 'super_admin' ||
        userType === 'admin_user' ||
        userType === 'platform_admin';

    useEffect(() => {
        if (!profileName && user?.name) setProfileName(user.name);
        if (!profileRole) setProfileRole(t('layout.defaultRole'));
    }, [user?.name, profileName, profileRole, t]);

    useEffect(() => {
        if (storageBrandPortal) return undefined;
        let cancelled = false;
        const bootstrapSupplierData = async () => {
            try {
                const [profileRes, receivablesRes] = await Promise.all(
                    [getSupplierProfile(), getSupplierReceivables()].map((p) =>
                        p.catch((e) => {
                            console.error(e);
                            return null;
                        }),
                    ),
                );

                if (cancelled) return;

                if (receivablesRes && Array.isArray(receivablesRes.list)) {
                    const totalOutstanding = receivablesRes.list.reduce(
                        (sum, item) => sum + Number(item.outstanding || 0),
                        0,
                    );
                    setArSummary(totalOutstanding);
                } else if (receivablesRes && receivablesRes.data) {
                    setArSummary(receivablesRes.data.total_receivable || 0);
                }

                const supplierName =
                    profileRes?.supplier?.companyName ||
                    profileRes?.supplier?.name ||
                    user?.name;
                if (supplierName) setProfileName(supplierName);

                if (profileRes?.supplier?.role) setProfileRole(profileRes.supplier.role);
            } catch (error) {
                if (!cancelled) {
                    console.error('Supplier layout API bootstrap failed:', error);
                    setArSummaryError(t('layout.loadingAr'));
                }
            }
        };
        bootstrapSupplierData();
        return () => {
            cancelled = true;
        };
    }, [user?.name, storageBrandPortal, t]);

    useEffect(() => {
        if (!storageBrandPortal) return;
        const hubPath = `/supplier/storage_facility?brand=${encodeURIComponent(storageBrandPortal)}`;
        if (activeTab !== 'storage_facility') {
            navigate(hubPath, { replace: true });
            return;
        }
        const params = new URLSearchParams(location.search);
        if (params.get('brand') !== String(storageBrandPortal)) {
            navigate(hubPath, { replace: true });
        }
    }, [storageBrandPortal, activeTab, location.search, navigate]);

    const navGroupsForUser = storageBrandPortal
        ? [
              {
                  label: 'STORAGE',
                  items: [{ id: 'storage_facility', label: 'My storage', icon: Warehouse }],
              },
          ]
        : NAV_GROUPS;

    const renderContent = () => {
        if (/^\/supplier\/accounting\/ledger\/[^/]+/.test(location.pathname)) {
            return <SupplierAccountLedgerPage locale={locale} />;
        }

        if (activeTab.startsWith('accounting_')) {
            return <SupplierAccountingPage activeSubTab={activeTab} locale={locale} />;
        }

        switch (activeTab) {
            case 'platform-chat':
                return null;
            case 'dashboard':
                return <SupplierDashboard onTabChange={setActiveTab} locale={locale} />;
            case 'order_queue':
                return <SupplierOrderQueue locale={locale} />;
            case 'stock':
                return <SupplierStockInventory locale={locale} />;
            case 'stock_alerts':
                return <SupplierWorkshopAlerts locale={locale} />;
            case 'catalog':
                return <SupplierCatalog locale={locale} />;
            case 'employees':
                return <SupplierEmployeesPage locale={locale} />;
            case 'staff_app':
                return <SupplierStaffAppPage locale={locale} />;
            case 'sales_invoices':
                return <SupplierSalesInvoices locale={locale} />;
            case 'sales_returns':
                return <SupplierAffiliatedSalesReturns locale={locale} />;
            case 'affiliated_workshops':
                return <SupplierAffiliatedWorkshops locale={locale} />;
            case 'nonaffiliated_customers':
                return <SupplierNonAffiliatedCustomers locale={locale} />;
            case 'workshop_purchase_invoices':
                return <SupplierWorkshopPurchaseInvoices locale={locale} />;
            case 'purchase_invoices':
                return <SupplierPurchaseInvoices locale={locale} />;
            case 'storage_facility':
                return <SupplierStorageFacility locale={locale} />;
            case 'cash_bank':
                return <SupplierCashBank locale={locale} />;
            case 'expenses':
                return <SupplierExpenses locale={locale} />;
            case 'accounting':
                return <SupplierAccountingPage activeSubTab="accounting_coa" locale={locale} />;
            default:
                return <SupplierDashboard onTabChange={setActiveTab} locale={locale} />;
        }
    };

    const currentLabel =
        navLabel(
            activeTab,
            navGroupsForUser
                .flatMap((g) => [g, ...(g.items || [])])
                .flatMap((i) => [i, ...(i.subItems || [])])
                .find((i) => i.id === activeTab)?.label || t('nav.dashboard'),
        );

    if (activeTab === 'platform-chat') {
        return (
            <div className="portal-layout--chat-fullscreen" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
                <SupplierPlatformChatPage locale={locale} />
            </div>
        );
    }

    return (
        <div
            className="workshop-layout supplier-portal"
            dir={locale === 'ar' ? 'rtl' : 'ltr'}
        >
            <aside className="ws-sidebar">
                <div className="ws-logo">
                    <div className="ws-logo-icon">
                        <Warehouse size={20} />
                    </div>
                    <div>
                        <p className="ws-logo-title">{t('layout.logoTitle')}</p>
                        <p className="ws-logo-sub">{t('layout.logoSub')}</p>
                    </div>
                </div>
                {!storageBrandPortal ? (
                    <div className="sp-sidebar-ar-summary">
                        <span className="sp-sidebar-ar-summary__text">
                            {arSummaryError ? (
                                <>{t('layout.arError')}</>
                            ) : arSummary === null ? (
                                <>
                                    <span>{t('layout.ar')}:</span>
                                    <ShimmerLine
                                        height={14}
                                        width={72}
                                        rounded
                                        className="sp-shimmer-inline-block"
                                    />
                                </>
                            ) : (
                                <>
                                    {t('layout.arValue', {
                                        amount: Number(arSummary).toLocaleString(),
                                    })}
                                </>
                            )}
                        </span>
                    </div>
                ) : null}
                {canGoBackToAdmin ? (
                    <a
                        className="ws-back-link"
                        onClick={() => navigate('/admin/dashboard')}
                        style={{ cursor: 'pointer' }}
                    >
                        <ArrowLeft size={14} /> {t('layout.backAdmin')}
                    </a>
                ) : null}
                <nav className="ws-nav">
                    {navGroupsForUser.map((grp) => (
                        <div key={grp.label || 'nav'}>
                            {grp.label ? (
                                <div
                                    className="ws-nav-section-label"
                                    style={{
                                        fontSize: '0.65rem',
                                        fontWeight: 700,
                                        letterSpacing: '0.06em',
                                        opacity: 0.45,
                                        padding: '10px 12px 4px',
                                    }}
                                >
                                    {SP_GROUP_LABEL_KEYS[grp.label]
                                        ? t(SP_GROUP_LABEL_KEYS[grp.label])
                                        : grp.label}
                                </div>
                            ) : null}
                            {grp.items.map((item) => {
                                const hasSub = item.subItems && item.subItems.length > 0;
                                const isExpanded = expandedGroups.includes(item.id);
                                const isActive =
                                    activeTab === item.id ||
                                    (hasSub && activeTab.startsWith(`${item.id}_`));

                                return (
                                    <div key={item.id} className="ws-nav-group">
                                        <button
                                            className={`ws-nav-btn ${isActive ? 'active' : ''}`}
                                            onClick={() =>
                                                hasSub ? toggleGroup(item.id) : setActiveTab(item.id)
                                            }
                                        >
                                            <item.icon size={17} stroke="currentColor" />
                                            <span>{navLabel(item.id, item.label)}</span>
                                            {isPlatformChatNavId(item.id) && (
                                                <PlatformChatNavBadge />
                                            )}
                                            {item.badge > 0 && (
                                                <span className="ws-nav-badge">{item.badge}</span>
                                            )}
                                            {hasSub && (
                                                <div style={{ marginLeft: 'auto', opacity: 0.5 }}>
                                                    {isExpanded ? (
                                                        <ChevronDown size={14} stroke="currentColor" />
                                                    ) : (
                                                        <ChevronRight size={14} stroke="currentColor" />
                                                    )}
                                                </div>
                                            )}
                                        </button>

                                        <AnimatePresence>
                                            {hasSub && isExpanded && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                                                    className="ws-nav-submenu"
                                                    style={{ overflow: 'hidden' }}
                                                >
                                                    {item.subItems.map((sub) => (
                                                        <button
                                                            key={sub.id}
                                                            className={`ws-nav-sub-btn ${activeTab === sub.id ? 'active' : ''}`}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setActiveTab(sub.id);
                                                            }}
                                                        >
                                                            <sub.icon size={14} stroke="currentColor" />
                                                            <span>{navLabel(sub.id, sub.label)}</span>
                                                        </button>
                                                    ))}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </nav>
                <div className="ws-user-footer">
                    <div className="ws-user-info">
                        <div className="ws-user-avatar">SP</div>
                        <div>
                            <p className="ws-user-name">
                                {profileName || t('layout.defaultName')}
                            </p>
                            <p className="ws-user-role">
                                {profileRole || t('layout.defaultRole')}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="ws-logout-btn"
                        onClick={() => setLogoutConfirmOpen(true)}
                        aria-label={t('layout.logout')}
                    >
                        <LogOut size={16} />
                    </button>
                </div>
            </aside>
            <div className="ws-main">
                <header className="ws-topbar">
                    <div>
                        <p className="ws-topbar-title">{currentLabel}</p>
                        <p className="ws-topbar-sub">{t('layout.subtitle')}</p>
                    </div>
                    <div
                        className="ws-topbar-right"
                        style={{ display: 'flex', alignItems: 'center', gap: 10 }}
                    >
                        <div className="ws-lang-switcher" role="group" aria-label={t('layout.lang')}>
                            <button
                                type="button"
                                className={`ws-lang-btn ${locale === 'en' ? 'active' : ''}`}
                                onClick={() => setLocale('en')}
                            >
                                EN
                            </button>
                            <button
                                type="button"
                                className={`ws-lang-btn ws-lang-btn-ar ${locale === 'ar' ? 'active' : ''}`}
                                onClick={() => setLocale('ar')}
                            >
                                العربية
                            </button>
                        </div>
                        <button
                            type="button"
                            className="btn-portal-outline"
                            style={{ fontSize: '0.8125rem', padding: '8px 14px' }}
                            onClick={() => setActiveTab('order_queue')}
                        >
                            <ShoppingCart size={14} /> {t('layout.orderQueueBtn')}
                        </button>
                        <div className="ws-online-badge">
                            <div className="ws-online-dot" />
                            {t('layout.online')}
                        </div>
                    </div>
                </header>
                <main className="ws-content">{renderContent()}</main>
            </div>

            {logoutConfirmOpen && (
                <Modal
                    title={t('layout.logoutTitle')}
                    width="420px"
                    onClose={() => setLogoutConfirmOpen(false)}
                    footer={
                        <div
                            style={{
                                display: 'flex',
                                gap: 10,
                                justifyContent: 'flex-end',
                                flexWrap: 'wrap',
                            }}
                        >
                            <button
                                type="button"
                                className="btn-portal-outline"
                                onClick={() => setLogoutConfirmOpen(false)}
                            >
                                {t('layout.cancel')}
                            </button>
                            <button type="button" className="btn-portal" onClick={performLogout}>
                                {t('layout.logout')}
                            </button>
                        </div>
                    }
                >
                    <p
                        style={{
                            margin: 0,
                            fontSize: '0.9375rem',
                            color: '#374151',
                            lineHeight: 1.5,
                        }}
                    >
                        {t('layout.logoutBody')}
                    </p>
                </Modal>
            )}

            <PlatformChatFab
                hidden={activeTab === 'platform-chat'}
                onClick={() => setActiveTab('platform-chat')}
            />
        </div>
    );
}
