import React from 'react';
import { ArrowLeft } from 'lucide-react';

/**
 * Full-page shell for Users & Permissions create/edit screens (replaces modals).
 */
export default function PermissionsPageShell({
    title,
    onBack,
    backLabel = 'Back to Users & Permissions',
    children,
    footer = null,
    backDisabled = false,
    className = '',
}) {
    return (
        <div className={`permissions-page permissions-detail-page module-container ${className}`.trim()}>
            <button
                type="button"
                className="permissions-page-back"
                onClick={onBack}
                disabled={backDisabled}
            >
                <ArrowLeft size={16} strokeWidth={2} />
                {backLabel}
            </button>

            <div className="permissions-page-panel create-role-modal">
                {title ? (
                    <header className="permissions-page-header-bar">
                        <h1 className="permissions-page-panel-title">{title}</h1>
                    </header>
                ) : null}

                <div className="permissions-page-body">{children}</div>

                {footer ? (
                    <footer className="permissions-page-footer">{footer}</footer>
                ) : null}
            </div>
        </div>
    );
}
