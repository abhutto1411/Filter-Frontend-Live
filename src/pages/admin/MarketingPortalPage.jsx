import React, { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useOutletContext } from 'react-router-dom';
import { Plus } from 'lucide-react';
import '../../styles/admin/MarketingPortalPage.css';
import '../marketing/Marketing.css';
import { useMarketingState } from '../marketing/MarketingUtils';
import { getWorkshops } from '../../services/superAdminApi';
import { useAuth } from '../../context/AuthContext';
import { marketingT } from '../../utils/marketingI18n';

function normalizeWorkshopsPayload(payload) {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.workshops)) return payload.workshops;
    if (Array.isArray(payload.items)) return payload.items;
    if (Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload.data?.workshops)) return payload.data.workshops;
    return [];
}

const SUB_TABS = [
    { id: 'dashboard',            labelKey: 'tab.dashboard',            path: 'dashboard',            permission: 'marketing.dashboard.view' },
    { id: 'promotions',           labelKey: 'tab.promotions',           path: 'promotions',           permission: 'marketing.promotions.view' },
    { id: 'promo-codes',          labelKey: 'tab.promoCodes',           path: 'promo-codes',          permission: 'marketing.promo-codes.view' },
    { id: 'referral-management',  labelKey: 'tab.referralManagement',   path: 'referral-management',  permission: 'marketing.referral-management.view' },
    { id: 'marketing-wallet',     labelKey: 'tab.marketingWallet',      path: 'marketing-wallet',     permission: 'marketing.referral-management.view' },
    { id: 'budget-optimizer',     labelKey: 'tab.budgetOptimizer',      path: 'budget-optimizer',     permission: 'marketing.dashboard.view' },
    { id: 'expenses',             labelKey: 'tab.expenses',             path: 'expenses',             permission: 'marketing.expenses.view' },
    { id: 'tier-management',      labelKey: 'tab.tierManagement',       path: 'tier-management',      permission: 'marketing.loyalty-programs.view' },
    { id: 'customer-insights',    labelKey: 'tab.customerInsights',     path: 'customer-insights',    permission: 'marketing.customer-insights.view' },
];

export default function MarketingPortalPage() {
    const location = useLocation();
    const outletCtx = useOutletContext() || {};
    const locale =
        outletCtx.locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => marketingT(locale, key, vars), [locale]);

    const { hasPermission } = useAuth();
    const visibleSubTabs = SUB_TABS.filter((tab) => hasPermission(tab.permission));
    const [showAddModal, setShowAddModal] = useState(false);
    const [workshops, setWorkshops] = useState([]);
    const [marketingWorkshopId, setMarketingWorkshopId] = useState('');

    useEffect(() => {
        getWorkshops({ limit: '200', offset: '0' })
            .then((data) => setWorkshops(normalizeWorkshopsPayload(data)))
            .catch(() => setWorkshops([]));
    }, []);

    const {
        promotions, setPromotions,
        promoCodes, setPromoCodes,
        referrers, setReferrers,
        referralCodes, setReferralCodes,
        loyaltyTiers, setLoyaltyTiers,
        loyaltyProgram, setLoyaltyProgram
    } = useMarketingState();

    const currentTab = SUB_TABS.find((tab) => location.pathname.endsWith(tab.path)) || visibleSubTabs[0] || SUB_TABS[0];
    const activeLabel = t(currentTab.labelKey);
    const isDashboard = currentTab.id === 'dashboard';
    const isInsights = currentTab.id === 'customer-insights';

    return (
        <div className="marketing-portal-page module-container">
            <div className="marketing-sub-nav">
                {visibleSubTabs.map((tab) => (
                    <NavLink
                        key={tab.id}
                        to={tab.path.startsWith('/') ? tab.path : `/admin/marketing/${tab.path}`}
                        className={({ isActive }) => `marketing-sub-tab ${isActive ? 'active' : ''}`}
                        onClick={() => setShowAddModal(false)}
                    >
                        {t(tab.labelKey)}
                    </NavLink>
                ))}
                {visibleSubTabs.length === 0 && (
                    <div style={{ padding: 20, color: '#94a3b8', fontSize: '0.875rem' }}>
                        {t('header.noPermission')}
                    </div>
                )}
            </div>

            <header className="marketing-page-header">
                <div>
                    <h1 className="marketing-title">{activeLabel}</h1>
                    <p className="marketing-subtitle">{t('header.subtitle')}</p>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                    <label className="marketing-workshop-scope" style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.72rem', fontWeight: 700, color: '#64748b' }}>
                        {t('header.workshopScope')}
                        <select
                            className="form-input-field"
                            style={{ minWidth: 200, height: 40, fontWeight: 600 }}
                            value={marketingWorkshopId}
                            onChange={(e) => setMarketingWorkshopId(e.target.value)}
                        >
                            <option value="">{t('header.allWorkshops')}</option>
                            {workshops.map((w) => {
                                const id = w.id ?? w._id ?? w.workshopId;
                                if (id == null) return null;
                                return (
                                    <option key={String(id)} value={String(id)}>
                                        {w.name || w.workshopName || t('header.workshopN', { id })}
                                    </option>
                                );
                            })}
                        </select>
                    </label>
                    {!isDashboard && !isInsights && currentTab.id !== 'referral-codes' && currentTab.id !== 'referral-management' && currentTab.id !== 'marketing-wallet' && currentTab.id !== 'expenses' && currentTab.id !== 'referral-types-rules' && currentTab.id !== 'promotions' && currentTab.id !== 'promo-codes' && currentTab.id !== 'loyalty-programs' && (
                        <button
                            type="button"
                            className="btn-portal"
                            onClick={() => setShowAddModal(true)}
                        >
                            <Plus size={16} /> {t('header.add', { label: activeLabel.replace(/s$/, '') })}
                        </button>
                    )}
                </div>
            </header>

            <div className="marketing-content">
                <Outlet context={{
                    showAddModal, setShowAddModal,
                    promotions, setPromotions,
                    promoCodes, setPromoCodes,
                    referrers, setReferrers,
                    referralCodes, setReferralCodes,
                    loyaltyTiers, setLoyaltyTiers,
                    loyaltyProgram, setLoyaltyProgram,
                    marketingWorkshopId,
                    setMarketingWorkshopId,
                    workshops,
                    locale,
                }} />
            </div>
        </div>
    );
}
