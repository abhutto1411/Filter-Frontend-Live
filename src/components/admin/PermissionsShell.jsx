import React from 'react';
import Modal from '../Modal';
import PermissionsPageShell from './PermissionsPageShell';
import { permT } from '../../utils/permissionsI18n';

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
    locale,
    backLabel,
    backDisabled = false,
}) {
    const resolvedBackLabel = backLabel ?? permT(locale || 'en', 'shell.back');

    if (asPage) {
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
