import React from 'react';
import WorkshopCOAView from '../../../components/accounting/WorkshopCOAView';
import '../../../styles/admin/AccountingPage.css';

/**
 * Chart of Accounts + financial reports (Trial Balance, P&L, Balance Sheet)
 * live as tabs inside WorkshopCOAView.
 */
export default function WorkshopCOAPage() {
    return (
        <div className="workshop-coa-page">
            <p className="workshop-coa-reports-hint" style={{ margin: '0 0 12px', color: '#6b7280', fontSize: 13 }}>
                Folder controls (e.g. Cash on Hand 1000, Bank 1010) expand to branch subaccounts with sequential codes
                (1001, 1002…). Reports — Trial Balance, P&amp;L, Balance Sheet — are tabs below.
            </p>
            <WorkshopCOAView />
        </div>
    );
}
