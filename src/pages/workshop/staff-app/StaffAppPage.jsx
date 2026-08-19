import React, { useCallback, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { STAFF_APP_NAV_ITEMS } from './constants';
import StaffAppOverview from './StaffAppOverview';
import StaffAppExpenses from './StaffAppExpenses';
import StaffAppRequests from './StaffAppRequests';
import StaffAppPurchaseOrders from './StaffAppPurchaseOrders';
import StaffAppTasks from './StaffAppTasks';
import StaffAppLeave from './StaffAppLeave';
import StaffAppSalaryAdvances from './StaffAppSalaryAdvances';
import StaffAppChat from './StaffAppChat';
import StaffAppNotifications from './StaffAppNotifications';
import StaffAppSettings from './StaffAppSettings';
import StaffAppPanelErrorBoundary from './StaffAppPanelErrorBoundary';
import {
    StaffAppI18nContext,
    resolveStaffAppLocale,
    staffAppT,
} from '../../../utils/staffAppI18n';
import './StaffApp.css';

export default function StaffAppPage({
    activeTab = 'sap-overview',
    selectedBranchId = 'all',
    branches = [],
    branchLockedId = null,
    workshopId = null,
    onNavigate,
    locale: localeProp,
}) {
    const outletCtx = useOutletContext() || {};
    const locale = resolveStaffAppLocale(localeProp, outletCtx.locale);
    const t = useCallback((key, vars) => staffAppT(locale, key, vars), [locale]);
    const i18nValue = useMemo(() => ({ locale, t }), [locale, t]);

    const renderPanel = () => {
        switch (activeTab) {
            case 'sap-overview':
                return (
                    <StaffAppOverview
                        selectedBranchId={selectedBranchId}
                        onNavigate={onNavigate}
                    />
                );
            case 'sap-expenses':
                return <StaffAppExpenses selectedBranchId={selectedBranchId} branches={branches} />;
            case 'sap-requests':
                return <StaffAppRequests selectedBranchId={selectedBranchId} branches={branches} />;
            case 'sap-purchase-orders':
                return <StaffAppPurchaseOrders selectedBranchId={selectedBranchId} branches={branches} />;
            case 'sap-tasks':
                return <StaffAppTasks selectedBranchId={selectedBranchId} branches={branches} />;
            case 'sap-leave':
                return <StaffAppLeave selectedBranchId={selectedBranchId} branches={branches} />;
            case 'sap-salary-advances':
                return <StaffAppSalaryAdvances selectedBranchId={selectedBranchId} branches={branches} />;
            case 'sap-chat':
                return <StaffAppChat selectedBranchId={selectedBranchId} />;
            case 'sap-notifications':
                return <StaffAppNotifications selectedBranchId={selectedBranchId} />;
            case 'sap-settings':
                return <StaffAppSettings />;
            default:
                return (
                    <StaffAppOverview
                        selectedBranchId={selectedBranchId}
                        onNavigate={onNavigate}
                    />
                );
        }
    };

    return (
        <StaffAppI18nContext.Provider value={i18nValue}>
            <div className="staff-app-shell" dir={locale === 'ar' ? 'rtl' : undefined}>
                <nav className="staff-app-subnav" aria-label={t('nav.aria')}>
                    {STAFF_APP_NAV_ITEMS.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            className={`staff-app-subnav__btn ${activeTab === item.id ? 'active' : ''}`}
                            onClick={() => onNavigate?.(item.id)}
                        >
                            {item.labelKey ? t(item.labelKey) : item.label}
                        </button>
                    ))}
                </nav>
                <div className="staff-app-panel">
                    <StaffAppPanelErrorBoundary resetKey={activeTab} locale={locale} t={t}>
                        {renderPanel()}
                    </StaffAppPanelErrorBoundary>
                </div>
            </div>
        </StaffAppI18nContext.Provider>
    );
}
