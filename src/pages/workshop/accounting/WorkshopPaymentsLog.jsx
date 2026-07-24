import React from 'react';
import WorkshopTransactionsLog from './WorkshopTransactionsLog';

export default function WorkshopPaymentsLog({ branches = [], selectedBranchId = 'all' }) {
    return (
        <WorkshopTransactionsLog
            direction="out"
            title="Payments Log"
            subtitle="Every outgoing payment across cash, bank, and petty-cash registers."
            emptyHint="No payments in this period."
            branches={branches}
            selectedBranchId={selectedBranchId}
        />
    );
}
