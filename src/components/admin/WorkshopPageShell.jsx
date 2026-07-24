import React from 'react';
import ApprovalPageShell from './ApprovalPageShell';

/** Full-page shell for Workshop admin screens (replaces modals). */
export default function WorkshopPageShell({
    title,
    onClose,
    backLabel = 'Back to Workshops',
    children,
    footer = null,
    backDisabled = false,
    fullWidth = true,
}) {
    return (
        <div className={`workshop-form-page-wrap${fullWidth ? ' workshop-form-page-wrap--full' : ''}`}>
            <ApprovalPageShell
                title={title}
                onBack={onClose}
                backLabel={backLabel}
                backDisabled={backDisabled}
                footer={footer}
            >
                <div className="workshop-route-panel">{children}</div>
            </ApprovalPageShell>
        </div>
    );
}
