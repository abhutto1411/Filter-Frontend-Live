import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
    Building2,
    BookOpen,
    ChevronDown,
    ClipboardList,
    LayoutDashboard,
    LogOut,
    Menu,
    Receipt,
    Settings,
    Sparkles,
    TrendingUp,
    Wallet,
    Wrench,
    X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { defaultHomePathForUser } from '../../utils/permissions';
import { connectScopeParams, getConnectScope } from '../../services/connectApi';
import '../../styles/connect/ConnectLayout.css';

const BRANCH_STORAGE_KEY = 'connect_selected_branch';
const WORKSHOP_STORAGE_KEY = 'connect_selected_workshop';

/** Only modules that actually work are listed. Dead nav items teach people to ignore the sidebar. */
const NAV_GROUPS = [
    {
        label: 'Home',
        items: [{ to: '/connect', end: true, icon: LayoutDashboard, label: 'Command Center' }],
    },
    {
        label: 'Work',
        items: [
            { to: '/connect/tasks', icon: ClipboardList, label: 'Tasks' },
            { to: '/connect/expenses', icon: Receipt, label: 'Expenses' },
            { to: '/connect/budget', icon: Wallet, label: 'Budget vs Actual' },
        ],
    },
    {
        label: 'Intelligence',
        items: [
            { to: '/connect/ai', icon: Sparkles, label: 'AI Assistant' },
            { to: '/connect/kb', icon: BookOpen, label: 'Knowledge base' },
            { to: '/connect/intel', icon: TrendingUp, label: 'Background intel' },
            { to: '/connect/settings', icon: Settings, label: 'AI settings' },
        ],
    },
];

/** Shown as plain text so the roadmap is visible without pretending the screens exist. */
const UPCOMING = ['Chat', 'CRM', 'Targets', 'Leaderboard'];

export default function ConnectLayout() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const isPlatformAdmin = user?.userType === 'platform_admin';

    const [scope, setScope] = useState(null);
    const [scopeError, setScopeError] = useState('');
    const [scopeRetry, setScopeRetry] = useState(0);
    const [workshopId, setWorkshopId] = useState(() => {
        if (!isPlatformAdmin) return '';
        return localStorage.getItem(WORKSHOP_STORAGE_KEY) || 'all';
    });
    const [branchId, setBranchId] = useState(
        () => localStorage.getItem(BRANCH_STORAGE_KEY) || '',
    );
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const scopeQuery = useMemo(
        () =>
            connectScopeParams({
                workshopId: isPlatformAdmin ? workshopId || 'all' : undefined,
                branchId: branchId || undefined,
            }),
        [isPlatformAdmin, workshopId, branchId],
    );

    useEffect(() => {
        let cancelled = false;
        let attempt = 0;

        const load = () => {
            getConnectScope(scopeQuery)
                .then((res) => {
                    if (cancelled) return;
                    setScope(res);
                    setScopeError('');

                    const storedBranch = localStorage.getItem(BRANCH_STORAGE_KEY) || '';
                    if (storedBranch && !res.branches?.some((b) => String(b.id) === storedBranch)) {
                        localStorage.removeItem(BRANCH_STORAGE_KEY);
                        setBranchId('');
                    } else if (res.allWorkshops && storedBranch) {
                        localStorage.removeItem(BRANCH_STORAGE_KEY);
                        setBranchId('');
                    }
                })
                .catch((e) => {
                    if (cancelled) return;
                    setScopeError(e?.message || 'Could not load your workshop.');
                    attempt += 1;
                    if (attempt <= 4) {
                        window.setTimeout(() => {
                            if (!cancelled) load();
                        }, Math.min(8000, 1000 * attempt));
                    }
                });
        };

        load();
        return () => {
            cancelled = true;
        };
    }, [scopeQuery, scopeRetry]);

    const handleWorkshopChange = useCallback((value) => {
        const next = value || 'all';
        setWorkshopId(next);
        localStorage.setItem(WORKSHOP_STORAGE_KEY, next);
        if (next === 'all') {
            localStorage.removeItem(BRANCH_STORAGE_KEY);
            setBranchId('');
        }
    }, []);

    const handleBranchChange = useCallback((value) => {
        setBranchId(value);
        if (value) localStorage.setItem(BRANCH_STORAGE_KEY, value);
        else localStorage.removeItem(BRANCH_STORAGE_KEY);
    }, []);

    const outletContext = useMemo(
        () => ({
            branchId: branchId || undefined,
            workshopId: isPlatformAdmin ? workshopId || 'all' : undefined,
            scope,
        }),
        [branchId, workshopId, isPlatformAdmin, scope],
    );

    const exitPath = defaultHomePathForUser(user);
    const initials = (scope?.user || user?.name || '?')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0])
        .join('')
        .toUpperCase();

    const showWorkshopPicker = Boolean(scope?.isPlatformAdmin && scope?.workshops?.length);
    const showBranchPicker = !scope?.allWorkshops && scope?.branches?.length > 1;

    return (
        <div className="cn-shell">
            <aside className={`cn-sidebar${sidebarOpen ? ' is-open' : ''}`}>
                <div className="cn-sidebar-head">
                    <div className="cn-logo">
                        <Sparkles size={17} />
                    </div>
                    <div className="cn-logo-text">
                        <strong>FILTER CONNECT</strong>
                        <span>Command Center</span>
                    </div>
                    <button
                        type="button"
                        className="cn-sidebar-close"
                        onClick={() => setSidebarOpen(false)}
                        aria-label="Close menu"
                    >
                        <X size={18} />
                    </button>
                </div>

                <nav className="cn-nav">
                    {NAV_GROUPS.map((group) => (
                        <div className="cn-nav-group" key={group.label}>
                            <span className="cn-nav-label">{group.label}</span>
                            {group.items.map((item) => (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    end={item.end}
                                    onClick={() => setSidebarOpen(false)}
                                    className={({ isActive }) =>
                                        `cn-nav-item${isActive ? ' is-active' : ''}`
                                    }
                                >
                                    <item.icon size={17} />
                                    <span>{item.label}</span>
                                </NavLink>
                            ))}
                        </div>
                    ))}

                    <div className="cn-nav-group cn-nav-group--upcoming">
                        <span className="cn-nav-label">Coming in later phases</span>
                        <ul className="cn-upcoming">
                            {UPCOMING.map((name) => (
                                <li key={name}>{name}</li>
                            ))}
                        </ul>
                    </div>
                </nav>

                <div className="cn-sidebar-foot">
                    <div className="cn-user">
                        <span className="cn-avatar">{initials}</span>
                        <div className="cn-user-text">
                            <strong>{scope?.user || user?.name || 'User'}</strong>
                            <span>{scope?.workshop || '—'}</span>
                        </div>
                    </div>
                    <button type="button" className="cn-exit" onClick={() => navigate(exitPath)}>
                        <LogOut size={15} />
                        Back to my portal
                    </button>
                </div>
            </aside>

            {sidebarOpen && (
                <button
                    type="button"
                    className="cn-scrim"
                    onClick={() => setSidebarOpen(false)}
                    aria-label="Close menu"
                />
            )}

            <div className="cn-main">
                <header className="cn-topbar">
                    <button
                        type="button"
                        className="cn-menu-btn"
                        onClick={() => setSidebarOpen(true)}
                        aria-label="Open menu"
                    >
                        <Menu size={19} />
                    </button>

                    {showWorkshopPicker && (
                        <label className="cn-branch cn-branch--workshop">
                            <Wrench size={15} />
                            <select
                                value={workshopId || 'all'}
                                onChange={(e) => handleWorkshopChange(e.target.value)}
                            >
                                <option value="all">
                                    All workshops ({scope.workshops.length})
                                </option>
                                {scope.workshops.map((w) => (
                                    <option key={w.id} value={w.id}>
                                        {w.name}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown size={14} className="cn-branch-caret" />
                        </label>
                    )}

                    {showBranchPicker && (
                        <label className="cn-branch">
                            <Building2 size={15} />
                            <select
                                value={branchId}
                                onChange={(e) => handleBranchChange(e.target.value)}
                            >
                                <option value="">All branches ({scope.branches.length})</option>
                                {scope.branches.map((b) => (
                                    <option key={b.id} value={b.id}>
                                        {b.name}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown size={14} className="cn-branch-caret" />
                        </label>
                    )}

                    {scope?.allWorkshops && (
                        <span className="cn-branch cn-branch--locked">
                            <Building2 size={15} />
                            All branches
                        </span>
                    )}

                    {!scope?.allWorkshops && scope?.branches?.length === 1 && (
                        <span className="cn-branch cn-branch--locked">
                            <Building2 size={15} />
                            {scope.branches[0].name}
                        </span>
                    )}

                    <span className="cn-topbar-spacer" />

                    {scope?.roleRestricted && (
                        <span className="cn-scope-note" title="Your role limits which branches you can see">
                            Limited to your branches
                        </span>
                    )}
                </header>

                {scopeError && (
                    <div className="cn-shell-error">
                        <span>{scopeError}</span>
                        <button type="button" className="cn-shell-retry" onClick={() => setScopeRetry((n) => n + 1)}>
                            Retry
                        </button>
                    </div>
                )}

                <div className="cn-content">
                    <Suspense fallback={<div className="cn-page-loading" />}>
                        <Outlet context={outletContext} />
                    </Suspense>
                </div>
            </div>
        </div>
    );
}
