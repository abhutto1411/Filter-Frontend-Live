import React from 'react';
import { useParams } from 'react-router-dom';
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

export default function WorkshopAccountingPage({ activeTab, branches = [], selectedBranchId = 'all' }) {
    const { subTab: paramsSubTab } = useParams();
    const { activeSub, openSalaryTab } = resolveActiveSub(paramsSubTab, activeTab);

    return (
        <div className="accounting-page module-container">
            {activeSub === 'chart-of-accounts' && <WorkshopCOAPage />}
            {activeSub === 'period-closings' && <WorkshopPeriodClosingsPage />}
            {activeSub === 'cash-bank' && <WorkshopCashBankPage branches={branches} />}
            {activeSub === 'payments' && <WorkshopPaymentsLog branches={branches} selectedBranchId={selectedBranchId} />}
            {activeSub === 'transactions' && <WorkshopTransactionEntryPage branches={branches} />}
            {activeSub === 'journal-entries' && <WorkshopGeneralJournalPage />}
            {activeSub === 'expenses' && <WorkshopExpensesLog branches={branches} selectedBranchId={selectedBranchId} />}
            {activeSub === 'receipts' && <WorkshopReceiptsLog branches={branches} selectedBranchId={selectedBranchId} />}
            {activeSub === 'advances' && (
                <WorkshopAdvances
                    branches={branches}
                    selectedBranchId={selectedBranchId}
                    initialTab={openSalaryTab ? 'Salary' : undefined}
                />
            )}
            {activeSub === 'approvals' && <WorkshopApprovalLimits />}
            {activeSub === 'ledger' && <WorkshopLedgerView />}
            {activeSub === 'vat' && <WorkshopVatReport />}
        </div>
    );
}
