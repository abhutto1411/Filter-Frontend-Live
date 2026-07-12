import React, { useState, useEffect, useMemo } from 'react';
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
import './workshop/Workshop.css';
import '../styles/admin/PlatformChat.css';
import '../styles/ThemeOnly.css';
import '../styles/RowActionsMenu.css';
import { ShimmerLine } from '../components/supplier/Shimmer';

export default function SupplierLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuth();
    
    // Determine active tab from URL: /supplier/TAB_NAME
    const getActiveTabFromUrl = () => {
        const parts = location.pathname.split('/').filter(Boolean);
        // If path is /supplier/accounting/cash-bank, parts are ['supplier', 'accounting', 'cash-bank']
        if (parts[1] === 'accounting' && parts[2]) {
            return `accounting_${parts[2]}`;
        }
        return parts[1] || 'dashboard';
    };

    const activeTab = getActiveTabFromUrl();
    const [expandedGroups, setExpandedGroups] = useState(['accounting']);
    
    const [arSummary, setArSummary] = useState(null);
    const [arSummaryError, setArSummaryError] = useState('');
    const [profileName, setProfileName] = useState(user?.name || 'Supplier Admin');
    const [profileRole, setProfileRole] = useState('Supplier Portal Manager');
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
        setExpandedGroups(prev => 
            prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
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
        if (storageBrandPortal) return undefined;
        let cancelled = false;
        const bootstrapSupplierData = async () => {
            try {
                const [profileRes, receivablesRes] = await Promise.all([
                    getSupplierProfile(),
                    getSupplierReceivables(),
                ].map(p => p.catch(e => { console.error(e); return null; })));
                
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
                    setArSummaryError('Error loading AR');
                }
            }
        };
        bootstrapSupplierData();
        return () => { cancelled = true; };
    }, [user?.name, storageBrandPortal]);

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
            return <SupplierAccountLedgerPage />;
        }

        if (activeTab.startsWith('accounting_')) {
            return <SupplierAccountingPage activeSubTab={activeTab} />;
        }

        switch (activeTab) {
            case 'platform-chat': return null;
            case 'dashboard': return <SupplierDashboard onTabChange={setActiveTab}/>;
            case 'order_queue': return <SupplierOrderQueue/>;
            case 'stock': return <SupplierStockInventory/>;
            case 'stock_alerts': return <SupplierWorkshopAlerts/>;
            case 'catalog': return <SupplierCatalog/>;
            case 'employees': return <SupplierEmployeesPage/>;
            case 'staff_app': return <SupplierStaffAppPage/>;
            case 'sales_invoices': return <SupplierSalesInvoices/>;
            case 'sales_returns': return <SupplierAffiliatedSalesReturns/>;
            case 'affiliated_workshops': return <SupplierAffiliatedWorkshops/>;
            case 'nonaffiliated_customers': return <SupplierNonAffiliatedCustomers/>;
            case 'workshop_purchase_invoices': return <SupplierWorkshopPurchaseInvoices/>;
            case 'purchase_invoices': return <SupplierPurchaseInvoices/>;
            case 'storage_facility': return <SupplierStorageFacility />;
            case 'cash_bank': return <SupplierCashBank/>;
            case 'expenses': return <SupplierExpenses/>;
            case 'accounting': return <SupplierAccountingPage activeSubTab="accounting_coa" />;
            default: return <SupplierDashboard onTabChange={setActiveTab}/>;
        }
    };

    const currentLabel = navGroupsForUser.flatMap(g => [g, ...(g.items || [])])
        .flatMap(i => [i, ...(i.subItems || [])])
        .find(i => i.id === activeTab)?.label || 'Dashboard';

    if (activeTab === 'platform-chat') {
        return (
            <div className="portal-layout--chat-fullscreen">
                <SupplierPlatformChatPage />
            </div>
        );
    }

    return (
        <div className="workshop-layout supplier-portal">
            <aside className="ws-sidebar">
                <div className="ws-logo">
                    <div className="ws-logo-icon"><Warehouse size={20}/></div>
                    <div><p className="ws-logo-title">Filter Supplier</p><p className="ws-logo-sub">Portal</p></div>
                </div>
                {!storageBrandPortal ? (
                    <div className="sp-sidebar-ar-summary">
                        <span className="sp-sidebar-ar-summary__text">
                            {arSummaryError ? (
                                <>AR: Error</>
                            ) : arSummary === null ? (
                                <>
                                    <span>AR:</span>
                                    <ShimmerLine height={14} width={72} rounded className="sp-shimmer-inline-block" />
                                </>
                            ) : (
                                <>AR: SAR {Number(arSummary).toLocaleString()}</>
                            )}
                        </span>
                    </div>
                ) : null}
                {canGoBackToAdmin ? (
                    <a className="ws-back-link" onClick={() => navigate('/admin/dashboard')} style={{cursor:'pointer'}}><ArrowLeft size={14}/> Back to Super Admin</a>
                ) : null}
                <nav className="ws-nav">
                    {navGroupsForUser.map((grp) => (
                        <div key={grp.label || 'nav'}>
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
                                            onClick={() => hasSub ? toggleGroup(item.id) : setActiveTab(item.id)}
                                        >
                                            <item.icon size={17} stroke="currentColor" />
                                            <span>{item.label}</span>
                                            {isPlatformChatNavId(item.id) && <PlatformChatNavBadge />}
                                            {item.badge > 0 && <span className="ws-nav-badge">{item.badge}</span>}
                                            {hasSub && (
                                                <div style={{ marginLeft: 'auto', opacity: 0.5 }}>
                                                    {isExpanded ? <ChevronDown size={14} stroke="currentColor" /> : <ChevronRight size={14} stroke="currentColor" />}
                                                </div>
                                            )}
                                        </button>

                                        <AnimatePresence>
                                            {hasSub && isExpanded && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.2, ease: "easeInOut" }}
                                                    className="ws-nav-submenu"
                                                    style={{ overflow: 'hidden' }}
                                                >
                                                    {item.subItems.map(sub => (
                                                        <button 
                                                            key={sub.id} 
                                                            className={`ws-nav-sub-btn ${activeTab === sub.id ? 'active' : ''}`}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setActiveTab(sub.id);
                                                            }}
                                                        >
                                                            <sub.icon size={14} stroke="currentColor" />
                                                            <span>{sub.label}</span>
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
                    <div className="ws-user-info"><div className="ws-user-avatar">SP</div><div><p className="ws-user-name">{profileName}</p><p className="ws-user-role">{profileRole}</p></div></div>
                    <button
                        type="button"
                        className="ws-logout-btn"
                        onClick={() => setLogoutConfirmOpen(true)}
                        aria-label="Log out"
                    >
                        <LogOut size={16}/>
                    </button>
                </div>
            </aside>
            <div className="ws-main">
                <header className="ws-topbar"><div><p className="ws-topbar-title">{currentLabel}</p><p className="ws-topbar-sub">Complete operations, stock, invoicing & accounting</p></div>
                    <div className="ws-topbar-right" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                       
                        <button type="button" className="btn-portal-outline" style={{ fontSize: '0.8125rem', padding: '8px 14px' }} onClick={() => setActiveTab('order_queue')}><ShoppingCart size={14}/> Order Queue</button>
                        <div className="ws-online-badge"><div className="ws-online-dot"/>Online</div>
                    </div>
                </header>
                <main className="ws-content">{renderContent()}</main>
            </div>

            {logoutConfirmOpen && (
                <Modal
                    title="Sign out?"
                    width="420px"
                    onClose={() => setLogoutConfirmOpen(false)}
                    footer={
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                className="btn-portal-outline"
                                onClick={() => setLogoutConfirmOpen(false)}
                            >
                                Cancel
                            </button>
                            <button type="button" className="btn-portal" onClick={performLogout}>
                                Log out
                            </button>
                        </div>
                    }
                >
                    <p style={{ margin: 0, fontSize: '0.9375rem', color: '#374151', lineHeight: 1.5 }}>
                        You will need to sign in again to access the supplier portal.
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
