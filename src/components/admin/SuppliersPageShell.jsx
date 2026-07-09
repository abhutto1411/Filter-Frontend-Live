import React from 'react';
import ApprovalPageShell from './ApprovalPageShell';

/**
 * Full-page shell for admin Suppliers create/edit screens (replaces modals).
 */
export default function SuppliersPageShell({
    title,
    onClose,
    backLabel = 'Back to Suppliers',
    children,
    footer = null,
    backDisabled = false,
}) {
    return (
        <div className="suppliers-form-page-wrap suppliers-form-page-wrap--full">
            <ApprovalPageShell
                title={title}
                onBack={onClose}
                backLabel={backLabel}
                backDisabled={backDisabled}
                footer={footer}
            >
                <div className="suppliers-route-panel">{children}</div>
            </ApprovalPageShell>
        </div>
    );
}
