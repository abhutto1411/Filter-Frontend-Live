import React from 'react';
import ApprovalPageShell from './ApprovalPageShell';

/** Full-page shell for Branches create/edit (replaces modals). */
export default function BranchesPageShell({
    title,
    onClose,
    backLabel = 'Back to Branches',
    children,
    footer = null,
    backDisabled = false,
}) {
    return (
        <div className="branches-form-page-wrap branches-form-page-wrap--full">
            <ApprovalPageShell
                title={title}
                onBack={onClose}
                backLabel={backLabel}
                backDisabled={backDisabled}
                footer={footer}
            >
                <div className="branches-route-panel">{children}</div>
            </ApprovalPageShell>
        </div>
    );
}
