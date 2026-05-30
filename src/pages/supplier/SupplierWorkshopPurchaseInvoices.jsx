import React from 'react';
import WorkshopPurchaseInvoicesSupplierPanel from './WorkshopPurchaseInvoicesSupplierPanel';

export default function SupplierWorkshopPurchaseInvoices() {
    return (
        <div>
            <div className="ws-page-header">
                <div>
                    <h2 className="ws-page-title">Workshop purchases</h2>
                    <p className="ws-page-sub">
                        Invoices workshops send you. Stock updates when you approve (lines with a product).
                    </p>
                </div>
            </div>
            <WorkshopPurchaseInvoicesSupplierPanel variant="page" />
        </div>
    );
}
