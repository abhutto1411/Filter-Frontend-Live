import React, { useEffect, useMemo } from 'react';
import {
    setAccountingWorkshopScopeId,
    setAccountingHqBooksMode,
} from '../utils/accountingWorkshopScope';

export function AccountingWorkshopScopeProvider({
    workshopId,
    hqBooks = false,
    children,
}) {
    // Set synchronously so the first child fetch (useEffect) already has scope.
    setAccountingWorkshopScopeId(workshopId);
    setAccountingHqBooksMode(hqBooks);

    useEffect(() => {
        setAccountingWorkshopScopeId(workshopId);
        setAccountingHqBooksMode(hqBooks);
        return () => {
            setAccountingWorkshopScopeId(null);
            setAccountingHqBooksMode(false);
        };
    }, [workshopId, hqBooks]);

    const value = useMemo(
        () => ({
            workshopId: workshopId ? String(workshopId) : null,
            hqBooks: Boolean(hqBooks),
        }),
        [workshopId, hqBooks],
    );

    return (
        <AccountingWorkshopScopeContext.Provider value={value}>
            {children}
        </AccountingWorkshopScopeContext.Provider>
    );
}

const AccountingWorkshopScopeContext = React.createContext({
    workshopId: null,
    hqBooks: false,
});

export function useAccountingWorkshopScope() {
    return React.useContext(AccountingWorkshopScopeContext);
}
