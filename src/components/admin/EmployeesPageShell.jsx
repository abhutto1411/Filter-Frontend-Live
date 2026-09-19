import React from 'react';
import { useOutletContext } from 'react-router-dom';
import ApprovalPageShell from './ApprovalPageShell';
import { empT } from '../../utils/employeesI18n';

/** Full-page shell for Employees create/edit (replaces modals). */
export default function EmployeesPageShell({
    title,
    onClose,
    backLabel,
    children,
    footer = null,
    backDisabled = false,
    fullWidth = true,
}) {
    const outletCtx = useOutletContext() || {};
    const locale =
        outletCtx.locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const resolvedBack = backLabel ?? empT(locale, 'shell.back');

    return (
        <div className={`employees-form-page-wrap${fullWidth ? ' employees-form-page-wrap--full' : ''}`}>
            <ApprovalPageShell
                title={title}
                onBack={onClose}
                backLabel={resolvedBack}
                backDisabled={backDisabled}
                footer={footer}
            >
                <div className="employees-route-panel">{children}</div>
            </ApprovalPageShell>
        </div>
    );
}
