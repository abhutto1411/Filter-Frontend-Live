import React from 'react';
import WorkshopPurchaseInvoicesSupplierPanel from './WorkshopPurchaseInvoicesSupplierPanel';

export default function SupplierWorkshopPurchaseInvoices() {
    return (
        <div>
            <div className="ws-page-header">
                <div>
                    <h2 className="ws-page-title">Workshop purchases</h2>
                    <p className="ws-page-sub">
                        Order requests from affiliated workshops. <strong>Approve</strong> or{' '}
                        <strong>Reject</strong>, then <strong>Prepare sales invoice</strong> — the same
                        stock, COA, AR, and timeline logic as Sales Invoices (AR) when you issue the invoice.
                    </p>
                </div>
            </div>
            <WorkshopPurchaseInvoicesSupplierPanel variant="page" />
        </div>
    );
}
