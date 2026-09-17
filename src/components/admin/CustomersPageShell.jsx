import React from 'react';
import { useOutletContext } from 'react-router-dom';
import ApprovalPageShell from './ApprovalPageShell';
import { custT } from '../../utils/customersI18n';

/**
 * Full-page shell for All Customers create/edit/detail screens (replaces modals).
 */
export default function CustomersPageShell({
    title,
    onClose,
    backLabel,
    children,
    footer = null,
    backDisabled = false,
    fullWidth = false,
}) {
    const outletCtx = useOutletContext() || {};
    const locale =
        outletCtx.locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const resolvedBack = backLabel ?? custT(locale, 'shell.back');

    return (
        <div className={`customers-form-page-wrap${fullWidth ? ' customers-form-page-wrap--full' : ''}`}>
            <ApprovalPageShell
                title={title}
                onBack={onClose}
                backLabel={resolvedBack}
                backDisabled={backDisabled}
                footer={footer}
            >
                <div className="customers-route-panel">{children}</div>
            </ApprovalPageShell>
        </div>
    );
}
