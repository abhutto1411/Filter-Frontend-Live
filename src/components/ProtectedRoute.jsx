import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, requiredType }) => {
    const { isAuthenticated, user, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-black text-white">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#FFD600]"></div>
            </div>
        );
    }

    if (!isAuthenticated) {
        // Always return to the unified sign-in hub — logout or session expiry
        // from ANY portal lands in the same place (not the per-portal login).
        // This also wins the race against the portal's own logout navigate().
        // The per-portal `/login` routes still exist for direct navigation.
        return <Navigate to="/" state={{ from: location }} replace />;
    }

    const normalizeUserType = (value) => String(value || '').trim().toLowerCase();
    const hasRequiredRole = (userType, required) => {
        const normalizedUserType = normalizeUserType(userType);
        const normalizedRequiredType = normalizeUserType(required);

        if (normalizedRequiredType === 'workshop_user' || normalizedRequiredType === 'workshop_owner') {
            return normalizedUserType === 'workshop_user' || normalizedUserType === 'workshop_owner';
        }

        if (normalizedRequiredType === 'technician_user') {
            if (normalizedUserType === 'technician_user') return true;
            if (normalizedUserType === 'workshop_user' && user?.technician) return true;
            return false;
        }

        if (normalizedRequiredType === 'supplier_user') {
            if (normalizedUserType === 'supplier_user' || normalizedUserType === 'supplier') {
                return true;
            }
            // Platform admins may open the supplier shell (sidebar "Back to Super Admin").
            if (
                normalizedUserType === 'admin' ||
                normalizedUserType === 'super_admin' ||
                normalizedUserType === 'admin_user' ||
                normalizedUserType === 'platform_admin'
            ) {
                return true;
            }
            return false;
        }

        if (normalizedRequiredType === 'locker_user') {
            // Locker portal: workshop_user with lockerPortalRole, or workshop_owner.
            if (normalizedUserType === 'workshop_owner') return true;
            if (normalizedUserType === 'workshop_user') {
                const role = String(user?.lockerPortalRole || '').toLowerCase();
                return role === 'supervisor' || role === 'collector';
            }
            return false;
        }

        if (normalizedRequiredType === 'marketing_user') {
            if (normalizedUserType === 'marketing_user') return true;
            if (normalizedUserType === 'platform_admin') return true;
            return false;
        }

        return normalizedUserType === normalizedRequiredType;
    };

    // If a specific type is required (e.g., 'admin')
    if (requiredType) {
        const userType = normalizeUserType(user?.userType || user?.type);
        const normalizedRequiredType = normalizeUserType(requiredType);
        
        // RELAXED ADMIN CHECK:
        // If we need an admin, and the user is NOT a known client role (like 'corporate_user')
        // OR the user has an explicit 'admin' or 'super_admin' role, then allow access.
        const isClient = userType === 'corporate_user' || userType === 'workshop_user' || userType === 'workshop_owner';
        const isAdmin = userType === 'admin' || userType === 'super_admin' || userType === 'admin_user' || userType === 'platform_admin';
        
        if (normalizedRequiredType === 'admin') {
            if (isClient && !isAdmin) {
                console.warn(`Admin access denied: User is a client (${userType})`);
                return <Navigate to="/" replace />;
            }
            // Otherwise, we allow it (trusting the authentication for Admin portal)
        } else if (!hasRequiredRole(userType, normalizedRequiredType)) {
            console.warn(`Portal access denied: Required ${normalizedRequiredType}, but user is ${userType}`);
            return <Navigate to="/" replace />;
        }
    }

    return children;
};

export default ProtectedRoute;
