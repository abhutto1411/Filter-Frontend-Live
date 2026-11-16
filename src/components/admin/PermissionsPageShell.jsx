import React from 'react';
import { ArrowLeft } from 'lucide-react';
import '../../styles/ui.css';

/**
 * Full-page shell for Users & Permissions create/edit screens (replaces modals).
 * The footer slot is laid out by `.ui-panel-foot`, so callers pass their
 * buttons wrapped in `.ui-panel-end` to push them to the trailing edge.
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
        <div className={`ui-root ui-root--flush ${className}`.trim()}>
            <button
                type="button"
                className="ui-btn ui-btn--default"
                onClick={onBack}
                disabled={backDisabled}
                style={{ marginBottom: 14 }}
            >
                <ArrowLeft size={15} />
                {backLabel}
            </button>

            <section className="ui-panel">
                {title ? (
                    <div className="ui-panel-head">
                        <h2 className="ui-panel-title">{title}</h2>
                    </div>
                ) : null}

                <div className="ui-panel-pad">{children}</div>

                {footer ? <div className="ui-panel-foot">{footer}</div> : null}
            </section>
        </div>
    );
}
