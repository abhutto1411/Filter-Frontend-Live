import React from 'react';
import { useOutletContext } from 'react-router-dom';
import ApprovalPageShell from './ApprovalPageShell';
import { wsT } from '../../utils/workshopI18n';

/** Full-page shell for Workshop admin screens (replaces modals). */
export default function WorkshopPageShell({
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
    const resolvedBack = backLabel ?? wsT(locale, 'shell.back');

    return (
        <div className={`workshop-form-page-wrap${fullWidth ? ' workshop-form-page-wrap--full' : ''}`}>
            <ApprovalPageShell
                title={title}
                onBack={onClose}
                backLabel={resolvedBack}
                backDisabled={backDisabled}
                footer={footer}
            >
                <div className="workshop-route-panel">{children}</div>
            </ApprovalPageShell>
        </div>
    );
}
