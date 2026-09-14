import React from 'react';
import PermissionsPageShell from './PermissionsPageShell';
import { permT } from '../../utils/permissionsI18n';

/**
 * Permissions UI as a full page with back navigation (no floating modal).
 */
export default function PermissionsShell({
    asPage = true,
    title,
    onClose,
    className = '',
    footer,
    children,
    locale,
    backLabel,
    backDisabled = false,
}) {
    void asPage;
    const resolvedBackLabel = backLabel ?? permT(locale || 'en', 'shell.back');

    return (
        <PermissionsPageShell
            title={title}
            onBack={onClose}
            backLabel={resolvedBackLabel}
            footer={footer}
            backDisabled={backDisabled}
            className={className}
        >
            {children}
        </PermissionsPageShell>
    );
}
