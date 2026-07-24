import React from 'react';
import { ArrowLeft } from 'lucide-react';

/**
 * Full-page shell for super-admin approval detail / action screens (replaces modals).
 */
export default function ApprovalPageShell({
    title,
    onBack,
    backLabel = 'Back to Approvals',
    children,
    footer = null,
    backDisabled = false,
}) {
    return (
        <div className="approvals-page approvals-detail-page module-container">
            <button
                type="button"
                className="approval-page-back"
                onClick={onBack}
                disabled={backDisabled}
            >
                <ArrowLeft size={16} strokeWidth={2} />
                {backLabel}
            </button>

            <div className="approval-page-panel">
                {title ? (
                    <header className="approval-page-header">
                        <h1 className="approval-page-title">{title}</h1>
                    </header>
                ) : null}

                <div className="approval-page-body">{children}</div>

                {footer ? (
                    <footer className="approval-page-footer">{footer}</footer>
                ) : null}
            </div>
        </div>
    );
}
