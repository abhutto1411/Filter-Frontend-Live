import React from 'react';
import Modal from '../Modal';
import ApprovalPageShell from './ApprovalPageShell';
import { apT } from '../../utils/approvalsI18n';

function defaultBackLabel() {
    const locale = (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) || 'en';
    return apT(locale, 'btn.back');
}

/**
 * Renders approval UI either as a modal (legacy) or full page with back navigation.
 */
export default function ApprovalShell({
    asPage = false,
    title,
    onClose,
    width,
    footer,
    children,
    backLabel,
    backDisabled = false,
}) {
    const resolvedBackLabel = backLabel ?? defaultBackLabel();
    if (asPage) {
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

    return (
        <Modal
            title={title}
            onClose={backDisabled ? undefined : onClose}
            width={width}
            footer={footer}
        >
            {children}
        </Modal>
    );
}
