import React, { Suspense, useCallback } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import SupplierCOAManager from './accounting/SupplierCOAManager';
import SupplierVatReport from './accounting/SupplierVatReport';
import SupplierTransactionHub from './accounting/SupplierTransactionHub';
import SupplierJournalLogs from './accounting/SupplierJournalLogs';
import SupplierAccountingReports from './accounting/SupplierAccountingReports';
import { SupplierArApReconPage } from '../../lazyPortalPages';
import SupplierJournalEntriesPage from './accounting/SupplierJournalEntriesPage';
import { ShimmerTable } from '../../components/supplier/Shimmer';
import '../../styles/admin/AccountingPage.css';
import './SupplierChartOfAccounts.css';
import { saccT } from '../../utils/supplierAccountingI18n';

function SupplierAdvancesTab({ locale: localeProp }) {
    const locale =
        localeProp ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => saccT(locale, key, vars), [locale]);
    return (
        <div className="ws-section" style={{ padding: 24, maxWidth: 560 }}>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                {t('page.advances.hint')}
            </p>
        </div>
    );
}

/**
 * SP-21 — legacy accounting sub-tabs that duplicated a surviving page now redirect to it
 * (one page per job, one URL). The old in-page copies were removed.
 */
const LEGACY_SUB_REDIRECTS = {
    'cash-bank': '/supplier/cash_accounts',
    transactions: '/supplier/cash_accounts',
    ledger: '/supplier/cash_accounts',
    'journal-entries': '/supplier/accounting/journals',
    purchases: '/supplier/purchase_invoices?tab=ssp_invoices',
    expenses: '/supplier/expenses',
    receipts: '/supplier/receipts',
    payments: '/supplier/payments',
};

export default function SupplierAccountingPage({ activeSubTab: propActiveTab, locale: localeProp }) {
    const locale =
        localeProp ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const { subTab } = useParams();

    const getActiveSub = () => {
        const raw = (propActiveTab || subTab || 'accounting_coa').replace('accounting_', '');
        const mapping = {
            coa: 'chart-of-accounts',
            hub: 'hub',
            logs_payments: 'logs-payments',
            logs_receipts: 'logs-receipts',
            logs_journals: 'logs-journals',
            journals: 'journal-entries-v2',
            vat: 'vat',
            reports_tb: 'reports-tb',
            reports_pl: 'reports-pl',
            reports_bs: 'reports-bs',
            reports_cf: 'reports-cf',
            reports_ar_ap: 'reports-ar-ap',
            cash_bank: 'cash-bank',
            journal: 'journal-entries',
            transactions: 'transactions',
            purchases: 'purchases',
            expenses: 'expenses',
            receipts: 'receipts',
            payments: 'payments',
            advances: 'advances',
            ledger: 'ledger',
        };
        return mapping[raw] || raw;
    };

    const activeSub = getActiveSub();
    const legacyTarget = LEGACY_SUB_REDIRECTS[activeSub];
    if (legacyTarget) return <Navigate to={legacyTarget} replace />;

    return (
        <div className="accounting-page module-container">
            {/* New accounting (v2) sub-tabs */}
            {activeSub === 'chart-of-accounts' && <SupplierCOAManager locale={locale} />}
            {activeSub === 'hub' && <SupplierTransactionHub locale={locale} />}
            {activeSub === 'logs-payments' && <SupplierJournalLogs initialTab="payments" locale={locale} />}
            {activeSub === 'logs-receipts' && <SupplierJournalLogs initialTab="receipts" locale={locale} />}
            {activeSub === 'logs-journals' && <SupplierJournalLogs initialTab="journals" locale={locale} />}
            {activeSub === 'journal-entries-v2' && <SupplierJournalEntriesPage locale={locale} />}
            {activeSub === 'vat' && <SupplierVatReport locale={locale} />}
            {activeSub === 'reports-tb' && <SupplierAccountingReports initialTab="tb" locale={locale} />}
            {activeSub === 'reports-pl' && <SupplierAccountingReports initialTab="pl" locale={locale} />}
            {activeSub === 'reports-bs' && <SupplierAccountingReports initialTab="bs" locale={locale} />}
            {activeSub === 'reports-cf' && <SupplierAccountingReports initialTab="cf" locale={locale} />}
            {activeSub === 'reports-ar-ap' && (
                <Suspense fallback={<ShimmerTable rows={8} columns={6} />}>
                    <SupplierArApReconPage locale={locale} />
                </Suspense>
            )}

            {/* Legacy sub-tab without a duplicate elsewhere (hint only) */}
            {activeSub === 'advances' && <SupplierAdvancesTab locale={locale} />}
        </div>
    );
}
