import React, { useState } from 'react';
import StorageBrandTransactionHub from './StorageBrandTransactionHub';
import StorageBrandJournalLogs from './StorageBrandJournalLogs';
import StorageBrandAccountsTab from './StorageBrandAccountsTab';
import StorageBrandCashBankTab from './StorageBrandCashBankTab';
import StorageBrandTrialBalanceTab from './StorageBrandTrialBalanceTab';
import StorageBrandIncomeStatementTab from './StorageBrandIncomeStatementTab';
import StorageBrandBalanceSheetTab from './StorageBrandBalanceSheetTab';
import { STORAGE_BRAND_ACCOUNTING_TABS } from './storageFacilityAccountingTabs';

export default function StorageBrandAccountingShell({
    brandId,
    brandName,
    customers,
    acctTab,
    onAcctTabChange,
}) {
    const [openLedgerAccountId, setOpenLedgerAccountId] = useState(null);

    return (
        <div className="sf-brand-accounting">
            <div className="sf-brand-accounting-head">
                <h2 className="sf-brand-accounting-title">Accounting</h2>
                <p className="sf-brand-accounting-sub">
                    {brandName ? `${brandName} — ` : ''}
                    Chart of accounts, cash, journals, and financial statements.
                </p>
            </div>
            <div className="sf-brand-tab-row sf-brand-tab-row--accounting">
                <span className="sf-brand-tab-row-label">Accounting</span>
                {STORAGE_BRAND_ACCOUNTING_TABS.map((t) => {
                    if (t.type === 'divider') {
                        return <span key={t.id} className="sf-brand-tab-divider" aria-hidden />;
                    }
                    const active = acctTab === t.id;
                    return (
                        <button
                            key={t.id}
                            type="button"
                            className={active ? 'sf-brand-tab sf-brand-tab--active' : 'sf-brand-tab'}
                            onClick={() => onAcctTabChange(t.id)}
                        >
                            {t.label}
                        </button>
                    );
                })}
            </div>
            <div className="sf-brand-acct-body">
                {acctTab === 'acct_hub' ? (
                    <StorageBrandTransactionHub brandId={brandId} customers={customers} />
                ) : null}
                {acctTab === 'acct_cash' ? (
                    <StorageBrandCashBankTab brandId={brandId} />
                ) : null}
                {acctTab === 'acct_accounts' ? (
                    <StorageBrandAccountsTab
                        brandId={brandId}
                        openAccountId={openLedgerAccountId}
                        onLedgerOpened={() => setOpenLedgerAccountId(null)}
                    />
                ) : null}
                {acctTab === 'acct_log_pay' ? (
                    <StorageBrandJournalLogs brandId={brandId} kind="payments" />
                ) : null}
                {acctTab === 'acct_log_rcpt' ? (
                    <StorageBrandJournalLogs brandId={brandId} kind="receipts" />
                ) : null}
                {acctTab === 'acct_log_je' ? (
                    <StorageBrandJournalLogs brandId={brandId} kind="journals" />
                ) : null}
                {acctTab === 'acct_tb' ? (
                    <StorageBrandTrialBalanceTab
                        brandId={brandId}
                        onAccountClick={(id) => {
                            setOpenLedgerAccountId(id);
                            onAcctTabChange('acct_accounts');
                        }}
                    />
                ) : null}
                {acctTab === 'acct_pl' ? (
                    <StorageBrandIncomeStatementTab brandId={brandId} />
                ) : null}
                {acctTab === 'acct_bs' ? (
                    <StorageBrandBalanceSheetTab brandId={brandId} />
                ) : null}
            </div>
        </div>
    );
}
