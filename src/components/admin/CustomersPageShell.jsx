import React from 'react';
import ApprovalPageShell from './ApprovalPageShell';

/**
 * Full-page shell for All Customers create/edit/detail screens (replaces modals).
 */
export default function CustomersPageShell({
    title,
    onClose,
    backLabel = 'Back to All Customers',
    children,
    footer = null,
    backDisabled = false,
    fullWidth = false,
}) {
    return (
        <div className={`customers-form-page-wrap${fullWidth ? ' customers-form-page-wrap--full' : ''}`}>
            <ApprovalPageShell
                title={title}
                onBack={onClose}
                backLabel={backLabel}
                backDisabled={backDisabled}
                footer={footer}
            >
                <div className="customers-route-panel">{children}</div>
            </ApprovalPageShell>
        </div>
    );
}
