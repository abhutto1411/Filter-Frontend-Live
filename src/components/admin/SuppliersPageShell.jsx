import React from 'react';
import { useOutletContext } from 'react-router-dom';
import ApprovalPageShell from './ApprovalPageShell';
import { supT } from '../../utils/suppliersI18n';

/**
 * Full-page shell for admin Suppliers create/edit screens (replaces modals).
 */
export default function SuppliersPageShell({
    title,
    onClose,
    backLabel,
    children,
    footer = null,
    backDisabled = false,
}) {
    const outletCtx = useOutletContext() || {};
    const locale =
        outletCtx.locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const resolvedBack = backLabel ?? supT(locale, 'shell.back');

    return (
        <div className="suppliers-form-page-wrap suppliers-form-page-wrap--full">
            <ApprovalPageShell
                title={title}
                onBack={onClose}
                backLabel={resolvedBack}
                backDisabled={backDisabled}
                footer={footer}
            >
                <div className="suppliers-route-panel">{children}</div>
            </ApprovalPageShell>
        </div>
    );
}
