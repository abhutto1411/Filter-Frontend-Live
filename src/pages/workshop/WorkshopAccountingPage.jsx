import React from 'react';
import { lazyPage } from '../../utils/lazyPage';
import { useLocation, useOutletContext, useParams } from 'react-router-dom';
import { WORKSHOP_ACC_TAB_SLUG } from '../../utils/workshopAccTabSlug';
import WorkshopApprovalLimits from './accounting/WorkshopApprovalLimits';
import WorkshopReceiptsLog from './accounting/WorkshopReceiptsLog';
import WorkshopPaymentsLog from './accounting/WorkshopPaymentsLog';
import WorkshopExpensesLog from './accounting/WorkshopExpensesLog';
import WorkshopAdvances from './accounting/WorkshopAdvances';
import WorkshopLedgerView from './accounting/WorkshopLedgerView';
import WorkshopCOAPage from './accounting/WorkshopCOAPage';
import WorkshopCashBankPage from './accounting/WorkshopCashBankPage';
import WorkshopPendingCashPostsPage from './accounting/WorkshopPendingCashPostsPage';
import WorkshopTransactionEntryPage from './accounting/WorkshopTransactionEntryPage';
import WorkshopBulkTransactionGridPage from './accounting/WorkshopBulkTransactionGridPage';
import WorkshopBulkCsvImportPage from './accounting/WorkshopBulkCsvImportPage';
import WorkshopTransactionBatchesPage from './accounting/WorkshopTransactionBatchesPage';
import WorkshopBatchDetailGate from './accounting/WorkshopBatchDetailGate';
import WorkshopNoncashPurchasesQueuePage from './accounting/WorkshopNoncashPurchasesQueuePage';
import WorkshopNoncashPurchaseDetailPage from './accounting/WorkshopNoncashPurchaseDetailPage';
import WorkshopPlatformExpensesPage from './accounting/WorkshopPlatformExpensesPage';
import WorkshopGeneralJournalPage from './accounting/WorkshopGeneralJournalPage';
import WorkshopAccountingAuditLogPage from './accounting/WorkshopAccountingAuditLogPage';
import WorkshopVatReport from './accounting/WorkshopVatReport';
import WorkshopCashierVariancePage from './accounting/WorkshopCashierVariancePage';
import WorkshopSuppliersApPage from './accounting/WorkshopSuppliersApPage';
import WorkshopSupplierApStatementPage from './accounting/WorkshopSupplierApStatementPage';
import WorkshopExpensePurposesPage from './accounting/WorkshopExpensePurposesPage';
import WorkshopPettyCashWalletsPage from './accounting/WorkshopPettyCashWalletsPage';
import WorkshopPeriodClosingsPage from './accounting/WorkshopPeriodClosingsPage';
import WorkshopBooksHealthPage from './accounting/WorkshopBooksHealthPage';
import WorkshopAccountingSettingsPage from './accounting/WorkshopAccountingSettingsPage';
import WorkshopOpeningBalancePage from './accounting/WorkshopOpeningBalancePage';
import WorkshopAccountingRolesAccessPage from './accounting/WorkshopAccountingRolesAccessPage';
import WorkshopLockerCitOverviewPage from './accounting/WorkshopLockerCitOverviewPage';
import WorkshopOfficerWalletPage from './accounting/WorkshopOfficerWalletPage';
import WorkshopLockerCitRecordPage from './accounting/WorkshopLockerCitRecordPage';
import ProfitLossPage from '../../components/accounting/reports/ProfitLossPage';
import BalanceSheetPage from '../../components/accounting/reports/BalanceSheetPage';
import TrialBalancePage from '../../components/accounting/reports/TrialBalancePage';
import '../../styles/admin/AccountingPage.css';

const WorkshopReportProofPage = lazyPage(() =>
    import('./accounting/WorkshopReportProofPage'),
);

function resolveActiveSub(paramsSubTab, activeTab) {
    if (activeTab === 'acc-transactions-batch-new') {
        return { activeSub: 'transactions-batch-new', openSalaryTab: false };
    }
    if (activeTab === 'acc-transactions-batch-import') {
        return { activeSub: 'transactions-batch-import', openSalaryTab: false };
    }
    if (activeTab === 'acc-transactions-batch') {
        return { activeSub: 'transactions-batch', openSalaryTab: false };
    }
    if (activeTab === 'acc-transactions-batches') {
        return { activeSub: 'transactions-batches', openSalaryTab: false };
    }
    if (activeTab === 'acc-noncash') {
        return { activeSub: 'noncash-purchases', openSalaryTab: false };
    }
    if (activeTab === 'acc-noncash-detail') {
        return { activeSub: 'noncash-purchases-detail', openSalaryTab: false };
    }
    if (activeTab === 'acc-platform-expenses') {
        return { activeSub: 'platform-expenses', openSalaryTab: false };
    }
    if (activeTab === 'acc-opening-balance') {
        return { activeSub: 'opening-balance', openSalaryTab: false };
    }
    if (activeTab === 'acc-cash-pending') {
        return { activeSub: 'cash-bank-pending', openSalaryTab: false };
    }
    if (activeTab === 'acc-report-proof') {
        return { activeSub: 'report-proof', openSalaryTab: false };
    }
    // Prefer URL slug; else map layout tab id via WORKSHOP_ACC_TAB_SLUG
    // (acc-roles → roles-access, not "roles").
    const raw =
        paramsSubTab ||
        (activeTab && WORKSHOP_ACC_TAB_SLUG[activeTab]) ||
        (activeTab ? activeTab.replace('acc-', '') : 'cash-bank');
    const mapping = {
        chart: 'chart-of-accounts',
        cash: 'cash-bank',
        journal: 'journal-entries',
        'audit-log': 'audit-log',
        audit: 'audit-log',
        transactions: 'transactions',
        expenses: 'expenses',
        receipts: 'receipts',
        payments: 'payments',
        advances: 'advances',
        approvals: 'approvals',
        ledger: 'ledger',
        vat: 'vat',
        'period-closings': 'period-closings',
        'profit-loss': 'profit-loss',
        'balance-sheet': 'balance-sheet',
        'trial-balance': 'trial-balance',
        'books-health': 'books-health',
        settings: 'settings',
        books: 'settings', // legacy /settings/books bookmark
        'opening-balance': 'opening-balance',
        // Layout tab id is acc-roles → strip gives "roles" (not "roles-access").
        roles: 'roles-access',
        'roles-access': 'roles-access',
        'cashier-variance': 'cashier-variance',
        suppliers: 'suppliers',
        'suppliers-statement': 'suppliers-statement',
        'expense-purposes': 'expense-purposes',
        'petty-cash': 'petty-cash',
        // Layout tab id is acc-petty-wallets → strip gives "petty-wallets".
        'petty-wallets': 'petty-cash',
        'locker-cit': 'locker-cash-in-transit',
        'locker-cash-in-transit': 'locker-cash-in-transit',
        'locker-cit-wallet': 'locker-cit-wallet',
        'locker-cit-record': 'locker-cit-record',
        // legacy: /expenses/review → expense-purposes review tab
        'expenses-review': 'expense-purposes',
        // legacy bookmark: Payroll Run → Advances (Salary tab)
        payroll: 'advances',
    };
    // activeTab acc-suppliers-statement → suppliers-statement
    const fromTab =
        activeTab === 'acc-suppliers-statement'
            ? 'suppliers-statement'
            : activeTab === 'acc-locker-cit-wallet'
              ? 'locker-cit-wallet'
              : activeTab === 'acc-locker-cit-record'
                ? 'locker-cit-record'
                : activeTab === 'acc-roles'
                  ? 'roles-access'
                  : activeTab === 'acc-petty-wallets'
                    ? 'petty-cash'
                    : null;
    return {
        activeSub: fromTab || mapping[raw] || raw,
        openSalaryTab: raw === 'payroll',
    };
}

function officerIdFromPath(pathname) {
    const parts = String(pathname || '').split('/').filter(Boolean);
    const i = parts.indexOf('officers');
    if (i >= 0 && parts[i + 1]) return parts[i + 1];
    return null;
}

export default function WorkshopAccountingPage({
    activeTab,
    branches = [],
    selectedBranchId = 'all',
    locale: localeProp,
}) {
    const outletCtx = useOutletContext() || {};
    const locale =
        localeProp ||
        outletCtx.locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const { subTab: paramsSubTab } = useParams();
    const location = useLocation();
    const { activeSub, openSalaryTab } = resolveActiveSub(paramsSubTab, activeTab);
    const citOfficerId = officerIdFromPath(location.pathname);

    return (
        <div className="accounting-page module-container">
            {activeSub === 'books-health' && (
                <WorkshopBooksHealthPage locale={locale} />
            )}
            {activeSub === 'settings' && (
                <WorkshopAccountingSettingsPage locale={locale} />
            )}
            {activeSub === 'opening-balance' && (
                <WorkshopOpeningBalancePage locale={locale} />
            )}
            {activeSub === 'roles-access' && (
                <WorkshopAccountingRolesAccessPage
                    locale={locale}
                    branches={branches}
                    selectedBranchId={selectedBranchId}
                />
            )}
            {activeSub === 'chart-of-accounts' && (
                <WorkshopCOAPage locale={locale} selectedBranchId={selectedBranchId} />
            )}
            {activeSub === 'profit-loss' && (
                <ProfitLossPage locale={locale} selectedBranchId={selectedBranchId} />
            )}
            {activeSub === 'report-proof' && (
                <React.Suspense fallback={<div style={{ padding: 24 }}>{locale === 'ar' ? 'جاري التحميل…' : 'Loading…'}</div>}>
                    <WorkshopReportProofPage locale={locale} />
                </React.Suspense>
            )}
            {activeSub === 'balance-sheet' && (
                <BalanceSheetPage locale={locale} selectedBranchId={selectedBranchId} />
            )}
            {activeSub === 'trial-balance' && (
                <TrialBalancePage locale={locale} selectedBranchId={selectedBranchId} />
            )}
            {activeSub === 'period-closings' && <WorkshopPeriodClosingsPage locale={locale} />}
            {activeSub === 'cash-bank' && (
                <WorkshopCashBankPage
                    branches={branches}
                    selectedBranchId={selectedBranchId}
                    locale={locale}
                />
            )}
            {activeSub === 'cash-bank-pending' && (
                <WorkshopPendingCashPostsPage
                    selectedBranchId={selectedBranchId}
                    locale={locale}
                />
            )}
            {activeSub === 'payments' && (
                <WorkshopPaymentsLog branches={branches} selectedBranchId={selectedBranchId} locale={locale} />
            )}
            {activeSub === 'transactions' && (
                <WorkshopTransactionEntryPage
                    branches={branches}
                    selectedBranchId={selectedBranchId}
                    locale={locale}
                />
            )}
            {activeSub === 'transactions-batch-new' && (
                <WorkshopBulkTransactionGridPage
                    branches={branches}
                    selectedBranchId={selectedBranchId}
                    locale={locale}
                    mode="new"
                />
            )}
            {activeSub === 'transactions-batch-import' && (
                <WorkshopBulkCsvImportPage
                    selectedBranchId={selectedBranchId}
                    locale={locale}
                />
            )}
            {activeSub === 'transactions-batch' && (
                <WorkshopBatchDetailGate
                    branches={branches}
                    selectedBranchId={selectedBranchId}
                    locale={locale}
                />
            )}
            {activeSub === 'transactions-batches' && (
                <WorkshopTransactionBatchesPage
                    selectedBranchId={selectedBranchId}
                    locale={locale}
                />
            )}
            {activeSub === 'journal-entries' && (
                <WorkshopGeneralJournalPage
                    locale={locale}
                    branches={branches}
                    selectedBranchId={selectedBranchId}
                />
            )}
            {activeSub === 'audit-log' && <WorkshopAccountingAuditLogPage locale={locale} />}
            {activeSub === 'expenses' && (
                <WorkshopExpensesLog branches={branches} selectedBranchId={selectedBranchId} locale={locale} />
            )}
            {activeSub === 'receipts' && (
                <WorkshopReceiptsLog branches={branches} selectedBranchId={selectedBranchId} locale={locale} />
            )}
            {activeSub === 'advances' && (
                <WorkshopAdvances
                    branches={branches}
                    selectedBranchId={selectedBranchId}
                    locale={locale}
                    initialTab={openSalaryTab ? 'Salary' : undefined}
                />
            )}
            {activeSub === 'approvals' && <WorkshopApprovalLimits locale={locale} />}
            {activeSub === 'ledger' && <WorkshopLedgerView locale={locale} />}
            {activeSub === 'vat' && <WorkshopVatReport locale={locale} />}
            {activeSub === 'cashier-variance' && (
                <WorkshopCashierVariancePage
                    locale={locale}
                    branches={branches}
                    selectedBranchId={selectedBranchId}
                />
            )}
            {activeSub === 'suppliers' && (
                <WorkshopSuppliersApPage locale={locale} />
            )}
            {activeSub === 'suppliers-statement' && (
                <WorkshopSupplierApStatementPage locale={locale} />
            )}
            {activeSub === 'noncash-purchases' && (
                <WorkshopNoncashPurchasesQueuePage
                    branches={branches}
                    selectedBranchId={selectedBranchId}
                    locale={locale}
                />
            )}
            {activeSub === 'noncash-purchases-detail' && (
                <WorkshopNoncashPurchaseDetailPage locale={locale} />
            )}
            {activeSub === 'platform-expenses' && (
                <WorkshopPlatformExpensesPage
                    branches={branches}
                    selectedBranchId={selectedBranchId}
                    locale={locale}
                />
            )}
            {activeSub === 'expense-purposes' && (
                <WorkshopExpensePurposesPage
                    locale={locale}
                    selectedBranchId={selectedBranchId}
                />
            )}
            {activeSub === 'petty-cash' && (
                <WorkshopPettyCashWalletsPage
                    locale={locale}
                    selectedBranchId={selectedBranchId}
                    branches={branches}
                />
            )}
            {activeSub === 'locker-cash-in-transit' && (
                <WorkshopLockerCitOverviewPage
                    locale={locale}
                    branches={branches}
                    selectedBranchId={selectedBranchId}
                />
            )}
            {activeSub === 'locker-cit-wallet' && (
                <WorkshopOfficerWalletPage
                    locale={locale}
                    officerId={citOfficerId}
                />
            )}
            {activeSub === 'locker-cit-record' && (
                <WorkshopLockerCitRecordPage
                    locale={locale}
                    branches={branches}
                    selectedBranchId={selectedBranchId}
                />
            )}
        </div>
    );
}
