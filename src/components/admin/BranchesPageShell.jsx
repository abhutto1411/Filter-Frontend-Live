import React from 'react';
import { useOutletContext } from 'react-router-dom';
import ApprovalPageShell from './ApprovalPageShell';
import { brT } from '../../utils/branchesI18n';

/** Full-page shell for Branches create/edit (replaces modals). */
export default function BranchesPageShell({
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
    const resolvedBack = backLabel ?? brT(locale, 'shell.back');

    return (
        <div className="branches-form-page-wrap branches-form-page-wrap--full">
            <ApprovalPageShell
                title={title}
                onBack={onClose}
                backLabel={resolvedBack}
                backDisabled={backDisabled}
                footer={footer}
            >
                <div className="branches-route-panel">{children}</div>
            </ApprovalPageShell>
        </div>
    );
}
