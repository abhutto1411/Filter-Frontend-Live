import React from 'react';
import ApprovalPageShell from './ApprovalPageShell';

/** Full-page shell for Employees create/edit (replaces modals). */
export default function EmployeesPageShell({
    title,
    onClose,
    backLabel = 'Back to Employees',
    children,
    footer = null,
    backDisabled = false,
    fullWidth = true,
}) {
    return (
        <div className={`employees-form-page-wrap${fullWidth ? ' employees-form-page-wrap--full' : ''}`}>
            <ApprovalPageShell
                title={title}
                onBack={onClose}
                backLabel={backLabel}
                backDisabled={backDisabled}
                footer={footer}
            >
                <div className="employees-route-panel">{children}</div>
            </ApprovalPageShell>
        </div>
    );
}
