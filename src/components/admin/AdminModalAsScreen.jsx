import React from 'react';
import AdminScreenShell from './AdminScreenShell';

/**
 * Super Admin shell — always an in-page screen (no floating modal).
 * Drop-in for former Modal usages in the admin portal.
 */
export default function AdminScreenShellFromModal({
    title,
    onClose,
    children,
    footer,
    backLabel = 'Back',
    backDisabled = false,
    className = '',
    wide = false,
    size,
}) {
    return (
        <AdminScreenShell
            title={title}
            onBack={backDisabled ? undefined : onClose}
            backLabel={backLabel}
            footer={footer}
            backDisabled={backDisabled}
            className={className}
            wide={wide || size === 'large' || size === 'viewport'}
        >
            {children}
        </AdminScreenShell>
    );
}
