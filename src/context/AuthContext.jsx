import React, { useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { clearLastActivityTimestamp, touchLastActivityTimestamp } from '../utils/sessionIdle';
import { BASE_URL, PERMISSION_DENIED_EVENT } from '../services/api';
import { createStableContext } from '../utils/stableContext';

const AuthContext = createStableContext('auth', null);

/**
 * Whether `user` has permission `code`.
 *
 * Bootstrap rules (mirror backend `RequirePermissionGuard`):
 *   1. platform_admin with no role / with system Super Admin role → full access
 *   2. User has no `permissions` field on session (legacy / non-admin portal login
 *      that doesn't send permissions yet) → full access (Phase-1 fallback)
 *   3. User has **no role assigned at all** (fresh signup, not yet given a role)
 *      → full access (new-signup default)
 *   4. User has a role assigned → strictly enforce that role's permission codes,
 *      even if the role's permission list is empty (admin can deliberately
 *      restrict a user to nothing)
 */
const WORKSHOP_CHAT_PERMISSION_ALIASES = {
    'workshop.platform-chat.view': ['chat.view'],
    'workshop.platform-chat.create': ['chat.create'],
};

const WALLET_IMPLICIT_PERMISSIONS = new Set([
    'workshop.my-wallet.view',
    'workshop.my-wallet.create',
    'workshop.platform-chat.view',
    'workshop.platform-chat.create',
    'chat.view',
    'chat.create',
]);

const MARKETING_WALLET_IMPLICIT_PERMISSIONS = new Set([
    'marketing.platform-chat.view',
    'marketing.platform-chat.create',
]);

function userHas(user, permissionSet, code) {
    if (!code) return true;
    if (!user) return false;

    // 1. Super-admin bypass (a per-user override is still enforced, like the API guard)
    if (
        user.userType === 'platform_admin'
        && user.permissionSource !== 'override'
        && (!user.role || user.role?.isSystem)
    ) {
        return true;
    }
    // 2. Legacy / pre-Phase-2 session — no permissions field at all
    if (!permissionSet) return true;
    // 3. Fresh signup — no role and no per-user override → default = everything visible
    if (!user.role && user.permissionSource !== 'override') return true;
    // 4. Wallet-enabled workshop users — My Wallet + Platform Chat
    if (user.walletEnabled && WALLET_IMPLICIT_PERMISSIONS.has(code)) {
        return true;
    }
    // 4b. Wallet-enabled marketing portal users — chat fund/expense actions
    if (
        user.walletEnabled
        && user.sessionPortal === 'marketing'
        && MARKETING_WALLET_IMPLICIT_PERMISSIONS.has(code)
    ) {
        return true;
    }
    // 5. Role or override assigned → strict check (an empty list blocks everything)
    if (permissionSet.has(code)) return true;
    const aliases = WORKSHOP_CHAT_PERMISSION_ALIASES[code];
    return Boolean(aliases?.some((alias) => permissionSet.has(alias)));
}

const SESSION_ACCESS_POLL_MS = 60 * 1000;
const SESSION_ACCESS_MIN_GAP_MS = 3 * 1000;
const SESSION_ACCESS_KEYS = [
    'role',
    'permissions',
    'permissionSource',
    'branchId',
    'branchName',
    'lockerPortalRole',
    'workshopStaffRole',
    'walletEnabled',
];

function comparableAccessValue(key, value) {
    if (key === 'permissions' && Array.isArray(value)) {
        return JSON.stringify([...value].map(String).sort());
    }
    return JSON.stringify(value ?? null);
}

/** Fields of the live `/auth/session-access` payload that differ from the stored session. */
function changedAccessFields(user, access) {
    const patch = {};
    for (const key of SESSION_ACCESS_KEYS) {
        if (!(key in access)) continue;
        if (comparableAccessValue(key, user?.[key]) !== comparableAccessValue(key, access[key])) {
            patch[key] = access[key];
        }
    }
    return Object.keys(patch).length ? patch : null;
}

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [workshop, setWorkshop] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('filter_auth_token'));
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Initialize user from localStorage if token exists
        const storedUser = localStorage.getItem('filter_auth_user');
        const storedWorkshop = localStorage.getItem('filter_auth_workshop');
        if (token && storedUser) {
            try {
                setUser(JSON.parse(storedUser));
                if (storedWorkshop) {
                    setWorkshop(JSON.parse(storedWorkshop));
                }
            } catch (err) {
                console.error('Failed to parse admin_user from localStorage', err);
                setUser(null);
                setWorkshop(null);
                setToken(null);
                localStorage.removeItem('filter_auth_token');
                localStorage.removeItem('filter_auth_user');
                localStorage.removeItem('filter_auth_workshop');
            }
        } else if (token || storedUser) {
            // Partial session data - clear everything
            setUser(null);
            setWorkshop(null);
            setToken(null);
            localStorage.removeItem('filter_auth_token');
            localStorage.removeItem('filter_auth_user');
            localStorage.removeItem('filter_auth_workshop');
        }
        setLoading(false);
    }, [token]);

    const login = (userData, userToken, sessionMeta = {}) => {
        setUser(userData);
        setToken(userToken);
        const workshopData = sessionMeta?.workshop || null;
        setWorkshop(workshopData);
        localStorage.setItem('filter_auth_token', userToken);
        localStorage.setItem('filter_auth_user', JSON.stringify(userData));
        if (workshopData) {
            localStorage.setItem('filter_auth_workshop', JSON.stringify(workshopData));
        } else {
            localStorage.removeItem('filter_auth_workshop');
        }
        touchLastActivityTimestamp();
    };

    const logout = () => {
        setUser(null);
        setWorkshop(null);
        setToken(null);
        localStorage.removeItem('filter_auth_token');
        localStorage.removeItem('filter_auth_user');
        localStorage.removeItem('filter_auth_workshop');
        clearLastActivityTimestamp();
    };

    const updateUser = (patch) => {
        setUser((prev) => {
            if (!prev) return prev;
            const next = { ...prev, ...patch };
            localStorage.setItem('filter_auth_user', JSON.stringify(next));
            return next;
        });
    };

    const userRef = useRef(user);
    useEffect(() => {
        userRef.current = user;
    }, [user]);

    const syncInFlightRef = useRef(false);
    const lastSyncAtRef = useRef(0);
    const permissionAware = Array.isArray(user?.permissions);

    /**
     * Pull the user's current role / permissions so menus follow role changes made
     * after login (otherwise the menu keeps showing pages the API now rejects).
     * Plain fetch on purpose: `apiFetch` counts as user activity and would defeat
     * the idle logout when polled.
     */
    const syncSessionAccess = useCallback(async () => {
        if (!token || !Array.isArray(userRef.current?.permissions)) return;
        const now = Date.now();
        if (syncInFlightRef.current || now - lastSyncAtRef.current < SESSION_ACCESS_MIN_GAP_MS) return;
        syncInFlightRef.current = true;
        lastSyncAtRef.current = now;
        try {
            const res = await fetch(`${BASE_URL}/auth/session-access`, {
                headers: { Accept: 'application/json', Authorization: `Bearer ${token.trim()}` },
            });
            if (!res.ok) return;
            const body = await res.json().catch(() => null);
            if (!body?.access || localStorage.getItem('filter_auth_token') !== token) return;
            const patch = changedAccessFields(userRef.current, body.access);
            if (!patch) return;
            setUser((prev) => {
                if (!prev) return prev;
                const next = { ...prev, ...patch };
                localStorage.setItem('filter_auth_user', JSON.stringify(next));
                return next;
            });
        } catch {
            // Offline or older API — keep the login snapshot.
        } finally {
            syncInFlightRef.current = false;
        }
    }, [token]);

    useEffect(() => {
        if (!token || !permissionAware) return undefined;
        syncSessionAccess();
        const timer = window.setInterval(() => {
            if (document.visibilityState === 'visible') syncSessionAccess();
        }, SESSION_ACCESS_POLL_MS);
        const onVisible = () => {
            if (document.visibilityState === 'visible') syncSessionAccess();
        };
        window.addEventListener('focus', syncSessionAccess);
        document.addEventListener('visibilitychange', onVisible);
        window.addEventListener(PERMISSION_DENIED_EVENT, syncSessionAccess);
        return () => {
            window.clearInterval(timer);
            window.removeEventListener('focus', syncSessionAccess);
            document.removeEventListener('visibilitychange', onVisible);
            window.removeEventListener(PERMISSION_DENIED_EVENT, syncSessionAccess);
        };
    }, [token, permissionAware, syncSessionAccess]);

    const permissions = useMemo(() => {
        const arr = Array.isArray(user?.permissions) ? user.permissions : null;
        if (!arr) return null; // session has no permissions field — legacy
        return new Set(arr.filter(Boolean).map(String));
    }, [user]);

    const hasPermission = useMemo(
        () => (code) => userHas(user, permissions, code),
        [user, permissions],
    );

    return (
        <AuthContext.Provider value={{
            user, workshop, token,
            isAuthenticated: !!token,
            login, logout, updateUser, loading,
            permissions, hasPermission,
        }}>
            {loading ? (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: '100vh',
                        background: '#F5F5F7',
                        color: '#111',
                    }}
                >
                    <div
                        style={{
                            width: 32,
                            height: 32,
                            border: '3px solid #FCC245',
                            borderTopColor: 'transparent',
                            borderRadius: '50%',
                            animation: 'spin 0.8s linear infinite',
                        }}
                    />
                </div>
            ) : (
                children
            )}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
