import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

const AdminPageMetaContext = createContext({
    pageTitle: null,
    setPageTitle: () => {},
    clearPageTitle: () => {},
});

export function useAdminPageMeta() {
    return useContext(AdminPageMetaContext);
}

export function AdminPageMetaProvider({ children }) {
    const [pageTitle, setPageTitleState] = useState(null);

    const setPageTitle = useCallback((title) => {
        setPageTitleState(title ? String(title) : null);
    }, []);

    const clearPageTitle = useCallback(() => {
        setPageTitleState(null);
    }, []);

    const value = useMemo(
        () => ({ pageTitle, setPageTitle, clearPageTitle }),
        [pageTitle, setPageTitle, clearPageTitle],
    );

    return (
        <AdminPageMetaContext.Provider value={value}>
            {children}
        </AdminPageMetaContext.Provider>
    );
}
