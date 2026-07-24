import React from 'react';
import Modal from '../Modal';
import ApprovalPageShell from './ApprovalPageShell';

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
    backLabel = 'Back to Approvals',
    backDisabled = false,
}) {
    if (asPage) {
        return (
            <ApprovalPageShell
                title={title}
                onBack={onClose}
                backLabel={backLabel}
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
