import React from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import WorkshopApprovalLimits from './accounting/WorkshopApprovalLimits';
import WorkshopReceiptsLog from './accounting/WorkshopReceiptsLog';
import WorkshopPaymentsLog from './accounting/WorkshopPaymentsLog';
import WorkshopExpensesLog from './accounting/WorkshopExpensesLog';
import WorkshopAdvances from './accounting/WorkshopAdvances';
import WorkshopLedgerView from './accounting/WorkshopLedgerView';
import WorkshopCOAPage from './accounting/WorkshopCOAPage';
import WorkshopCashBankPage from './accounting/WorkshopCashBankPage';
import WorkshopTransactionEntryPage from './accounting/WorkshopTransactionEntryPage';
import WorkshopGeneralJournalPage from './accounting/WorkshopGeneralJournalPage';
import WorkshopVatReport from './accounting/WorkshopVatReport';
import WorkshopPeriodClosingsPage from './accounting/WorkshopPeriodClosingsPage';
import '../../styles/admin/AccountingPage.css';

function resolveActiveSub(paramsSubTab, activeTab) {
    const raw = paramsSubTab || (activeTab ? activeTab.replace('acc-', '') : 'cash-bank');
    const mapping = {
        chart: 'chart-of-accounts',
        cash: 'cash-bank',
        journal: 'journal-entries',
        transactions: 'transactions',
        expenses: 'expenses',
        receipts: 'receipts',
        payments: 'payments',
        advances: 'advances',
        approvals: 'approvals',
        ledger: 'ledger',
        vat: 'vat',
        'period-closings': 'period-closings',
        // legacy bookmark: Payroll Run → Advances (Salary tab)
        payroll: 'advances',
    };
    return {
        activeSub: mapping[raw] || raw,
        openSalaryTab: raw === 'payroll',
    };
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
    const { activeSub, openSalaryTab } = resolveActiveSub(paramsSubTab, activeTab);

    return (
        <div className="accounting-page module-container">
            {activeSub === 'chart-of-accounts' && <WorkshopCOAPage locale={locale} />}
            {activeSub === 'period-closings' && <WorkshopPeriodClosingsPage locale={locale} />}
            {activeSub === 'cash-bank' && <WorkshopCashBankPage branches={branches} locale={locale} />}
            {activeSub === 'payments' && (
                <WorkshopPaymentsLog branches={branches} selectedBranchId={selectedBranchId} locale={locale} />
            )}
            {activeSub === 'transactions' && (
                <WorkshopTransactionEntryPage branches={branches} locale={locale} />
            )}
            {activeSub === 'journal-entries' && <WorkshopGeneralJournalPage locale={locale} />}
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
        </div>
    );
}
