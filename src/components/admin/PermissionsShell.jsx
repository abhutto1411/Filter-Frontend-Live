import React from 'react';
import Modal from '../Modal';
import PermissionsPageShell from './PermissionsPageShell';

/**
 * Renders permissions UI either as a modal (legacy) or full page with back navigation.
 */
export default function PermissionsShell({
    asPage = false,
    title,
    onClose,
    className = '',
    footer,
    children,
    backLabel = 'Back to Users & Permissions',
    backDisabled = false,
}) {
    if (asPage) {
        return (
            <PermissionsPageShell
                title={title}
                onBack={onClose}
                backLabel={backLabel}
                footer={footer}
                backDisabled={backDisabled}
                className={className}
            >
                {children}
            </PermissionsPageShell>
        );
    }

    return (
        <Modal
            title={title}
            onClose={backDisabled ? undefined : onClose}
            className={className}
            footer={footer}
        >
            {children}
        </Modal>
    );
}
