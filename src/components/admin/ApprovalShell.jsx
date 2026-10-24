import React from 'react';
import ApprovalPageShell from './ApprovalPageShell';
import { apT } from '../../utils/approvalsI18n';

function defaultBackLabel() {
    const locale = (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) || 'en';
    return apT(locale, 'btn.back');
}

/**
 * Approvals UI as a full page with back navigation (no floating modal).
 */
export default function ApprovalShell({
    asPage = true,
    title,
    onClose,
    width,
    footer,
    children,
    backLabel,
    backDisabled = false,
}) {
    void asPage;
    void width;
    const resolvedBackLabel = backLabel ?? defaultBackLabel();
    return (
        <ApprovalPageShell
            title={title}
            onBack={onClose}
            backLabel={resolvedBackLabel}
            footer={footer}
            backDisabled={backDisabled}
        >
            {children}
        </ApprovalPageShell>
    );
}
