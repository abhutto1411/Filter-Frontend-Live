import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { apT } from '../../utils/approvalsI18n';

function defaultBackLabel() {
    const locale = (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) || 'en';
    return apT(locale, 'btn.back');
}

/**
 * Full-page shell for super-admin approval detail / action screens (replaces modals).
 */
export default function ApprovalPageShell({
    title,
    onBack,
    backLabel,
    children,
    footer = null,
    backDisabled = false,
}) {
    const resolvedBackLabel = backLabel ?? defaultBackLabel();
    return (
        <div className="approvals-page approvals-detail-page module-container">
            <button
                type="button"
                className="approval-page-back"
                onClick={onBack}
                disabled={backDisabled}
            >
                <ArrowLeft size={16} strokeWidth={2} />
                {resolvedBackLabel}
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
