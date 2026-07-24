import React from 'react';
import ApprovalPageShell from './ApprovalPageShell';

/**
 * Full-page shell for Master Catalog create/edit/import screens (replaces modals).
 */
export default function MasterCatalogShell({
    title,
    onClose,
    backLabel = 'Back to Master Catalog',
    children,
    footer = null,
    backDisabled = false,
    className = '',
}) {
    return (
        <ApprovalPageShell
            onBack={onClose}
            backLabel={backLabel}
            backDisabled={backDisabled}
            footer={footer}
        >
            <div className={`master-catalog-route-panel ${className}`.trim()}>
                {title ? (
                    <div className="mc-page-route-title">{title}</div>
                ) : null}
                {children}
            </div>
        </ApprovalPageShell>
    );
}
