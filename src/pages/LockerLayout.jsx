import React, { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { DollarSign, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { lockerLogout } from '../services/authApi';
import { NAV_ITEMS } from './locker/constants';
import LockerDashboard from './locker/LockerDashboard';
import PendingRequests from './locker/PendingRequests';
import RecordCollection from './locker/RecordCollection';
import ApprovalsScreen from './locker/ApprovalsScreen';
import CollectionsHistory from './locker/CollectionsHistory';
import DifferencesReport from './locker/DifferencesReport';
import PettyCash from './locker/PettyCash';
import DepositToBank from './locker/DepositToBank';
import IssuePettyCash from './locker/IssuePettyCash';
import './workshop/Workshop.css';

function lockerRoleLabel(user) {
    const role = String(user?.lockerPortalRole || '').toLowerCase();
    if (role === 'supervisor') return 'Locker Supervisor';
    if (role === 'collector') return 'Collection Officer';
    if (user?.userType === 'workshop_owner') return 'Workshop Owner';
    return 'Locker Portal';
}

function userInitials(name) {
    const parts = String(name || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    if (!parts.length) return 'LK';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export default function LockerLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuth();

    const displayName = user?.name || user?.email || 'Locker User';
    const displayRole = useMemo(() => lockerRoleLabel(user), [user]);

    const handleLogout = async () => {
        const t = localStorage.getItem('filter_auth_token');
        try {
            if (t) await lockerLogout(t);
        } catch (e) {
            console.warn('[locker] logout API failed (session cleared locally anyway)', e);
        }
        logout();
        navigate('/', { replace: true });
    };

    // Sync activeTab with URL: /locker/TAB_NAME
    const getActiveTabFromUrl = () => {
        const parts = location.pathname.split('/').filter(Boolean);
        return parts[1] || 'dashboard';
    };

    const activeTab = getActiveTabFromUrl();
    const setActiveTab = (tab) => {
        navigate(`/locker/${tab}`);
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard': return <LockerDashboard onTabChange={setActiveTab}/>;
            case 'pending': return <PendingRequests onTabChange={setActiveTab}/>;
            case 'record': return <RecordCollection/>;
            case 'approvals': return <ApprovalsScreen/>;
            case 'deposit_to_bank': return <DepositToBank/>;
            case 'issue_petty_cash': return <IssuePettyCash/>;
            case 'history': return <CollectionsHistory/>;
            case 'differences': return <DifferencesReport/>;
            case 'petty_cash': return <PettyCash/>;
            default: return <LockerDashboard onTabChange={setActiveTab}/>;
        }
    };

    const currentLabel = NAV_ITEMS.find(n => n.id === activeTab)?.label || 'Dashboard';

    return (
        <div className="workshop-layout">
            <aside className="ws-sidebar">
                <div className="ws-logo"><div className="ws-logo-icon"><DollarSign size={20}/></div><div><p className="ws-logo-title">Filter Locker</p><p className="ws-logo-sub">Portal</p></div></div>
                <nav className="ws-nav">
                    {NAV_ITEMS.map(item => (
                        <button key={item.id} className={`ws-nav-btn ${activeTab === item.id ? 'active' : ''}`} onClick={() => setActiveTab(item.id)}>
                            <item.icon size={17}/><span>{item.label}</span>
                            {item.badge > 0 && <span className="ws-nav-badge">{item.badge}</span>}
                        </button>
                    ))}
                </nav>
                <div className="ws-user-footer">
                    <div className="ws-user-info">
                        <div className="ws-user-avatar">{userInitials(displayName)}</div>
                        <div>
                            <p className="ws-user-name">{displayName}</p>
                            <p className="ws-user-role">{displayRole}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="ws-logout-btn"
                        onClick={handleLogout}
                        title="Log out"
                    >
                        <LogOut size={16} />
                    </button>
                </div>
            </aside>
            <div className="ws-main">
                <header className="ws-topbar"><div><p className="ws-topbar-title">{currentLabel}</p><p className="ws-topbar-sub">Locker Management Portal</p></div><div className="ws-topbar-right"><div className="ws-online-badge"><div className="ws-online-dot"/>Online</div></div></header>
                <main className="ws-content">{renderContent()}</main>
            </div>
        </div>
    );
}
