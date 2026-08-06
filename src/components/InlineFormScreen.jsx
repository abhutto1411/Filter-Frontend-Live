import React from 'react';
import { ArrowLeft } from 'lucide-react';

/**
 * A full-width, in-flow form screen used instead of a modal/popup for big
 * forms (sales / purchase invoices). It renders inline within the page (no
 * overlay, no portal) and has a "Back" action instead of a close/cross button.
 *
 * API mirrors the parts of <Modal> we relied on: `title`, `footer`, `children`.
 * `onBack` is invoked by the Back button (same handler the old close used).
 */
export default function InlineFormScreen({
    title,
    onBack,
    backLabel = 'Back',
    footer,
    children,
    className = '',
    bodyClassName = '',
}) {
    return (
        <section className={`inline-form-screen ${className}`.trim()}>
            <div className="inline-form-screen__topbar">
                {onBack ? (
                    <button
                        type="button"
                        className="inline-form-screen__back"
                        onClick={onBack}
                    >
                        <ArrowLeft size={18} />
                        <span>{backLabel}</span>
                    </button>
                ) : null}
                {title ? (
                    <div className="inline-form-screen__title">{title}</div>
                ) : null}
            </div>
            <div className={`inline-form-screen__body ${bodyClassName}`.trim()}>
                {children}
            </div>
            {footer ? (
                <div className="inline-form-screen__footer">{footer}</div>
            ) : null}
        </section>
    );
}
