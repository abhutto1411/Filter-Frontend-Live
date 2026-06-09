import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';

const AuthContext = createContext(null);

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
function userHas(user, permissionSet, code) {
    if (!code) return true;
    if (!user) return false;

    // 1. Super-admin bypass
    if (user.userType === 'platform_admin' && (!user.role || user.role?.isSystem)) {
        return true;
    }
    // 2. Legacy / pre-Phase-2 session — no permissions field at all
    if (!permissionSet) return true;
    // 3. Fresh signup — no role assigned yet → default = everything visible
    if (!user.role) return true;
    // 4. Role assigned → strict check (empty role.permissions blocks everything)
    return permissionSet.has(code);
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
    };

    const logout = () => {
        setUser(null);
        setWorkshop(null);
        setToken(null);
        localStorage.removeItem('filter_auth_token');
        localStorage.removeItem('filter_auth_user');
        localStorage.removeItem('filter_auth_workshop');
    };

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
            login, logout, loading,
            permissions, hasPermission,
        }}>
            {!loading && children}
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
