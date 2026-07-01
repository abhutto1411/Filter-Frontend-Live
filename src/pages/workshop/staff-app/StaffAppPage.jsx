import React from 'react';
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
import './StaffApp.css';

export default function StaffAppPage({
    activeTab = 'sap-overview',
    selectedBranchId = 'all',
    branches = [],
    branchLockedId = null,
    workshopId = null,
    onNavigate,
}) {
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
        <div className="staff-app-shell">
            <nav className="staff-app-subnav" aria-label="Staff App Management">
                {STAFF_APP_NAV_ITEMS.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        className={`staff-app-subnav__btn ${activeTab === item.id ? 'active' : ''}`}
                        onClick={() => onNavigate?.(item.id)}
                    >
                        {item.label}
                    </button>
                ))}
            </nav>
            <div className="staff-app-panel">
                <StaffAppPanelErrorBoundary resetKey={activeTab}>
                    {renderPanel()}
                </StaffAppPanelErrorBoundary>
            </div>
        </div>
    );
}
