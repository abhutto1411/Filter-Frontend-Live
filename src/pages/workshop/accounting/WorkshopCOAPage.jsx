import React from 'react';
import WorkshopCOAView from '../../../components/accounting/WorkshopCOAView';
import '../../../styles/admin/AccountingPage.css';

/**
 * Chart of Accounts (workshop). Financial reports live on separate routes:
 * /workshop/accounting/profit-loss|balance-sheet|trial-balance.
 */
export default function WorkshopCOAPage({ locale, selectedBranchId = 'all' }) {
    return (
        <div className="workshop-coa-page">
            <WorkshopCOAView locale={locale} selectedBranchId={selectedBranchId} />
        </div>
    );
}
