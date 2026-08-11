import { useCallback, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useIdleLogout } from '../hooks/useIdleLogout';

/**
 * Global idle timeout — enabled for every authenticated portal session.
 */
export default function IdleSessionWatcher() {
    const { isAuthenticated, loading, logout } = useAuth();

    const handleIdle = useCallback(() => {
        logout();
        if (typeof window !== 'undefined' && window.location.pathname !== '/') {
            window.location.replace('/');
        }
    }, [logout]);

    useIdleLogout({
        enabled: isAuthenticated && !loading,
        onIdle: handleIdle,
    });

    useEffect(() => {
        const onStorage = (e) => {
            if (e.key === 'filter_auth_token' && e.oldValue && !e.newValue) {
                logout();
                if (typeof window !== 'undefined' && window.location.pathname !== '/') {
                    window.location.replace('/');
                }
            }
        };

        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, [logout]);

    return null;
}
