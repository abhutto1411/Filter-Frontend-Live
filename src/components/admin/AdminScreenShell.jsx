import React from 'react';
import { ArrowLeft } from 'lucide-react';
import '../../styles/admin/AdminScreenShell.css';

/**
 * Full-page in-screen panel for Super Admin (replaces floating modals).
 * Same visual language as Approvals / Permissions page shells.
 */
export default function AdminScreenShell({
    title,
    onBack,
    backLabel = 'Back',
    children,
    footer = null,
    backDisabled = false,
    className = '',
    wide = false,
}) {
    return (
        <div
            className={[
                'admin-screen',
                'module-container',
                wide ? 'admin-screen--wide' : '',
                className,
            ]
                .filter(Boolean)
                .join(' ')}
        >
            {onBack ? (
                <button
                    type="button"
                    className="admin-screen-back"
                    onClick={onBack}
                    disabled={backDisabled}
                >
                    <ArrowLeft size={16} strokeWidth={2} />
                    {backLabel}
                </button>
            ) : null}

            <div className="admin-screen-panel">
                {title ? (
                    <header className="admin-screen-header">
                        <h1 className="admin-screen-title">{title}</h1>
                    </header>
                ) : null}

                <div className="admin-screen-body">{children}</div>

                {footer ? (
                    <footer className="admin-screen-footer">{footer}</footer>
                ) : null}
            </div>
        </div>
    );
}
