import React from 'react';
import { useOutletContext } from 'react-router-dom';
import ApprovalPageShell from './ApprovalPageShell';
import { mcT } from '../../utils/masterCatalogI18n';
import '../../styles/ui.css';

/**
 * Full-page shell for Master Catalog create/edit/import screens (replaces modals).
 */
export default function MasterCatalogShell({
    title,
    onClose,
    backLabel,
    children,
    footer = null,
    backDisabled = false,
    className = '',
}) {
    const outletCtx = useOutletContext() || {};
    const locale =
        outletCtx.locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const resolvedBack = backLabel ?? mcT(locale, 'shell.back');

    return (
        <ApprovalPageShell
            onBack={onClose}
            backLabel={resolvedBack}
            backDisabled={backDisabled}
            footer={footer}
        >
            <div className={`ui-tokens ${className}`.trim()}>
                {title ? (
                    <div className="ui-subsection-head">
                        <h4>{title}</h4>
                    </div>
                ) : null}
                {children}
            </div>
        </ApprovalPageShell>
    );
}
