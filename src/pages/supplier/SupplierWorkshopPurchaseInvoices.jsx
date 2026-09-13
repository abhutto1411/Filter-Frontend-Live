import React, { useCallback } from 'react';
import WorkshopPurchaseInvoicesSupplierPanel from './WorkshopPurchaseInvoicesSupplierPanel';
import { spiT } from '../../utils/supplierPurchaseInvoicesI18n';

export default function SupplierWorkshopPurchaseInvoices({ locale: localeProp } = {}) {
    const locale =
        localeProp ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => spiT(locale, key, vars), [locale]);

    return (
        <div>
            <div className="ws-page-header">
                <div>
                    <h2 className="ws-page-title">{t('workshopPurchases.title')}</h2>
                    <p className="ws-page-sub">
                        {t('workshopPurchases.subBefore')} <strong>{t('workshopPurchases.approve')}</strong>{' '}
                        {t('workshopPurchases.or')} <strong>{t('workshopPurchases.reject')}</strong>
                        {t('workshopPurchases.subMid')} <strong>{t('workshopPurchases.prepare')}</strong>{' '}
                        {t('workshopPurchases.subAfter')}
                    </p>
                </div>
            </div>
            <WorkshopPurchaseInvoicesSupplierPanel variant="page" locale={locale} />
        </div>
    );
}
