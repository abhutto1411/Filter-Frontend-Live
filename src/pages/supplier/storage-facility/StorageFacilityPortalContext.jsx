import React, { createContext, useContext, useMemo } from 'react';
import * as supplierStorageFacilityApi from '../../../services/storageFacilityApi';
import * as supplierStorageFacilityAccountingApi from '../../../services/storageFacilityAccountingApi';
import { createAdminStorageFacilityApi } from '../../../services/adminStorageFacilityApi';
import { createAdminStorageFacilityAccountingApi } from '../../../services/adminStorageFacilityAccountingApi';

const defaultValue = {
    routeBase: '/supplier/storage_facility',
    parentRoute: null,
    supplierName: null,
    isOwner: true,
    sfApi: supplierStorageFacilityApi,
    accountingApi: supplierStorageFacilityAccountingApi,
};

const StorageFacilityPortalContext = createContext(defaultValue);

export function useStorageFacilityPortal() {
    return useContext(StorageFacilityPortalContext);
}

export function useStorageFacilityApi() {
    return useStorageFacilityPortal().sfApi;
}

export function useStorageFacilityAccountingApi() {
    return useStorageFacilityPortal().accountingApi;
}

export function StorageFacilityPortalProvider({
    supplierId = null,
    supplierName = null,
    routeBase = '/supplier/storage_facility',
    parentRoute = null,
    isOwner = true,
    children,
}) {
    const sfApi = useMemo(
        () =>
            supplierId
                ? createAdminStorageFacilityApi(supplierId)
                : supplierStorageFacilityApi,
        [supplierId],
    );

    const accountingApi = useMemo(
        () =>
            supplierId
                ? createAdminStorageFacilityAccountingApi(supplierId)
                : supplierStorageFacilityAccountingApi,
        [supplierId],
    );

    const value = useMemo(
        () => ({ routeBase, parentRoute, supplierName, isOwner, sfApi, accountingApi }),
        [routeBase, parentRoute, supplierName, isOwner, sfApi, accountingApi],
    );

    return (
        <StorageFacilityPortalContext.Provider value={value}>
            {children}
        </StorageFacilityPortalContext.Provider>
    );
}
