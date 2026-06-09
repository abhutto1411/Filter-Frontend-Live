import React from 'react';
import WorkshopTransactionsLog from './WorkshopTransactionsLog';

export default function WorkshopReceiptsLog({ branches = [], selectedBranchId = 'all' }) {
    return (
        <WorkshopTransactionsLog
            direction="in"
            title="Receipts Log"
            subtitle="Every receiving transaction across cash, bank, and petty-cash registers."
            emptyHint="No receipts in this period."
            branches={branches}
            selectedBranchId={selectedBranchId}
        />
    );
}
