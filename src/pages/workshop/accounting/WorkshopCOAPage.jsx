import React from 'react';
import WorkshopCOAView from '../../../components/accounting/WorkshopCOAView';
import '../../../styles/admin/AccountingPage.css';

/**
 * Chart of Accounts + financial reports (Trial Balance, P&L, Balance Sheet)
 * live as tabs inside WorkshopCOAView.
 */
export default function WorkshopCOAPage({ locale, selectedBranchId = 'all' }) {
    return (
        <div className="workshop-coa-page">
            <p className="workshop-coa-reports-hint" style={{ margin: '0 0 12px', color: '#6b7280', fontSize: 13 }}>
                Chart of Accounts is split into Balance Sheet and Income Statement (P&amp;L).
                Folder controls (e.g. Cash on Hand 1000) expand to branch subaccounts. Reports stay in the tabs below.
            </p>
            <WorkshopCOAView locale={locale} selectedBranchId={selectedBranchId} />
        </div>
    );
}
