import React, { useCallback } from 'react';
import StaffAppDevDocs from '../workshop/staff-app/StaffAppDevDocs';
import { spT } from '../../utils/supplierPortalI18n';

/**
 * Supplier portal mirror — supplier outdoor staff will use the same Flutter app pattern.
 * Full supplier-scoped staff ops APIs can extend this section later.
 */
export default function SupplierStaffAppPage({ locale: localeProp }) {
    const locale =
        localeProp ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => spT(locale, key, vars), [locale]);

    return (
        <div style={{ padding: 24 }}>
            <h1 style={{ marginTop: 0 }}>{t('staffApp.title')}</h1>
            <p style={{ color: '#666', maxWidth: 720 }}>{t('staffApp.body')}</p>
            <StaffAppDevDocs />
        </div>
    );
}
