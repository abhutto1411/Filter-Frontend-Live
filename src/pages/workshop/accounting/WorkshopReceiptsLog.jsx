import React, { useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import WorkshopTransactionsLog from './WorkshopTransactionsLog';
import { accT } from '../../../utils/accountingI18n';

export default function WorkshopReceiptsLog({ branches = [], selectedBranchId = 'all', locale: localeProp }) {
    const outletCtx = useOutletContext() || {};
    const locale =
        localeProp ||
        outletCtx.locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => accT(locale, key, vars), [locale]);

    return (
        <WorkshopTransactionsLog
            direction="in"
            title={t('rcpt.receiptsLog')}
            subtitle={t('rcpt.receiptsSub')}
            emptyHint={t('rcpt.empty')}
            branches={branches}
            selectedBranchId={selectedBranchId}
            locale={locale}
        />
    );
}
