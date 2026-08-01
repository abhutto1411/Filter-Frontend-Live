import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { DollarSign, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../services/api';
import { lockerLogout } from '../services/authApi';
import { getLockerNavItems, resolveLockerPortalRole } from './locker/constants';
import LockerDashboard from './locker/LockerDashboard';
import PendingRequests from './locker/PendingRequests';
import AssignedRequests from './locker/AssignedRequests';
import RecordCollection from './locker/RecordCollection';
import ApprovalsScreen from './locker/ApprovalsScreen';
import CollectionsHistory from './locker/CollectionsHistory';
import DifferencesReport from './locker/DifferencesReport';
import PettyCash from './locker/PettyCash';
import DepositToBank from './locker/DepositToBank';
import IssuePettyCash from './locker/IssuePettyCash';
import PettyCashIssueLog from './locker/PettyCashIssueLog';
import LockerExpenses from './locker/LockerExpenses';
import TransactionLog from './locker/TransactionLog';
import './workshop/Workshop.css';

function lockerRoleLabel(user) {
    const role = resolveLockerPortalRole(user);
    if (role === 'supervisor') {
        return user?.userType === 'workshop_owner' ? 'Workshop Admin' : 'Locker Supervisor';
    }
    if (role === 'collector') return 'Collection Officer';
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
    const portalRole = useMemo(() => resolveLockerPortalRole(user), [user]);
    const navItems = useMemo(() => getLockerNavItems(user), [user]);

    /** Hard lock when workshop admin assigned a branch on the locker user. */
    const userBranchLock = useMemo(() => {
        const id = user?.branchId;
        if (id == null || id === '' || id === 'all') return null;
        return String(id);
    }, [user?.branchId]);

    const [branches, setBranches] = useState([]);
    const [selectedBranch, setSelectedBranch] = useState(userBranchLock ?? 'all');

    const loadBranches = useCallback(async () => {
        try {
            const res = await apiFetch('/locker/branches');
            const list = Array.isArray(res?.branches) ? res.branches : [];
            setBranches(list);
            const assigned = res?.assignedBranchId ? String(res.assignedBranchId) : userBranchLock;
            if (assigned) {
                setSelectedBranch(assigned);
            }
        } catch (e) {
            console.warn('[locker] branches', e);
            setBranches([]);
        }
    }, [userBranchLock]);

    useEffect(() => {
        loadBranches();
    }, [loadBranches]);

    useEffect(() => {
        if (userBranchLock && selectedBranch !== userBranchLock) {
            setSelectedBranch(userBranchLock);
        }
    }, [userBranchLock, selectedBranch]);

    const activeBranches = useMemo(() => {
        if (userBranchLock) {
            return branches.filter((b) => String(b.id) === userBranchLock);
        }
        return branches;
    }, [branches, userBranchLock]);

    const selectedBranchName = useMemo(() => {
        if (selectedBranch === 'all') return 'All Branches';
        const b = activeBranches.find((x) => String(x.id) === String(selectedBranch));
        return b?.name || user?.branchName || 'Branch';
    }, [activeBranches, selectedBranch, user?.branchName]);

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

    const getActiveTabFromUrl = () => {
        const parts = location.pathname.split('/').filter(Boolean);
        return parts[1] || 'dashboard';
    };

    const activeTab = getActiveTabFromUrl();
    const setActiveTab = (tab) => {
        const [tabName, query = ''] = String(tab).split('?');
        navigate(query ? `/locker/${tabName}?${query}` : `/locker/${tabName}`);
    };

    const supervisorOnlyTabs = new Set([
        'pending',
        'approvals',
        'deposit_to_bank',
        'issue_petty_cash',
        'petty_cash_issue_log',
        'petty_cash',
    ]);

    useEffect(() => {
        if (portalRole === 'collector' && supervisorOnlyTabs.has(activeTab)) {
            navigate('/locker/assigned', { replace: true });
            return;
        }
        if (portalRole === 'supervisor' && activeTab === 'assigned') {
            navigate('/locker/pending', { replace: true });
        }
    }, [activeTab, portalRole, navigate]);

    const branchProps = {
        selectedBranchId: selectedBranch,
        branches: activeBranches,
        branchLockedId: userBranchLock,
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard':
                return (
                    <LockerDashboard
                        onTabChange={setActiveTab}
                        portalRole={portalRole}
                        {...branchProps}
                    />
                );
            case 'pending':
                return <PendingRequests onTabChange={setActiveTab} {...branchProps} />;
            case 'assigned':
                return <AssignedRequests onTabChange={setActiveTab} {...branchProps} />;
            case 'record':
                return <RecordCollection portalRole={portalRole} {...branchProps} />;
            case 'approvals':
                return <ApprovalsScreen {...branchProps} />;
            case 'deposit_to_bank':
                return <DepositToBank {...branchProps} />;
            case 'issue_petty_cash':
                return <IssuePettyCash {...branchProps} />;
            case 'petty_cash_issue_log':
                return <PettyCashIssueLog {...branchProps} />;
            case 'expenses':
                return <LockerExpenses {...branchProps} />;
            case 'transaction_log':
                return <TransactionLog {...branchProps} />;
            case 'history':
                return <CollectionsHistory {...branchProps} />;
            case 'differences':
                return <DifferencesReport {...branchProps} />;
            case 'petty_cash':
                return <PettyCash {...branchProps} />;
            default:
                return (
                    <LockerDashboard
                        onTabChange={setActiveTab}
                        portalRole={portalRole}
                        {...branchProps}
                    />
                );
        }
    };

    const currentLabel = navItems.find((n) => n.id === activeTab)?.label || 'Dashboard';

    return (
        <div className="workshop-layout">
            <aside className="ws-sidebar">
                <div className="ws-logo">
                    <div className="ws-logo-icon"><DollarSign size={20} /></div>
                    <div>
                        <p className="ws-logo-title">Filter Locker</p>
                        <p className="ws-logo-sub">Portal</p>
                    </div>
                </div>
                <div className="ws-branch-selector">
                    <select
                        className="ws-branch-select"
                        value={userBranchLock || selectedBranch}
                        disabled={Boolean(userBranchLock)}
                        onChange={(e) => setSelectedBranch(e.target.value)}
                        title={userBranchLock ? 'Branch locked by workshop admin' : 'Filter locker data by branch'}
                    >
                        {!userBranchLock ? (
                            <option value="all">All Branches</option>
                        ) : null}
                        {activeBranches.map((b) => (
                            <option key={b.id} value={String(b.id)}>{b.name}</option>
                        ))}
                    </select>
                </div>
                <nav className="ws-nav">
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            className={`ws-nav-btn ${activeTab === item.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(item.id)}
                        >
                            <item.icon size={17} />
                            <span>{item.label}</span>
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
                <header className="ws-topbar">
                    <div>
                        <p className="ws-topbar-title">{currentLabel}</p>
                        <p className="ws-topbar-sub">
                            Locker Management Portal
                            {selectedBranch !== 'all' ? ` · ${selectedBranchName}` : ''}
                        </p>
                    </div>
                    <div className="ws-topbar-right">
                        <div className="ws-online-badge">
                            <div className="ws-online-dot" />
                            Online
                        </div>
                    </div>
                </header>
                <main className="ws-content">{renderContent()}</main>
            </div>
        </div>
    );
}
