import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * Reusable modal: title, body (children), footer (actions).
 * Renders into document.body via portal so it's never trapped by an
 * ancestor with `transform`, `filter`, `animation`, etc. — which would
 * otherwise break `position: fixed` and `backdrop-filter` blur.
 *
 * Overlay styles are inlined to win over ANY conflicting CSS rule.
 */
const overlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100vw',
    height: '100vh',
    background: 'rgba(15, 23, 42, 0.55)',
    WebkitBackdropFilter: 'blur(20px) saturate(140%)',
    backdropFilter: 'blur(20px) saturate(140%)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    overflow: 'hidden',
    animation: 'modal-overlay-fade 0.18s ease-out',
};

export default function Modal({
    title,
    onClose,
    children,
    footer,
    className = '',
    contentClassName = '',
    width,
    hideCloseButton = false,
    /** When true, backdrop click and header close do nothing (still render close for layout; disabled). */
    disableClose = false,
}) {
    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, []);

    useEffect(() => {
        if (disableClose || !onClose) return undefined;
        const onKey = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                onClose();
            }
        };
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, [disableClose, onClose]);

    const node = (
        <div
            className={`app-modal-overlay ${className}`}
            style={overlayStyle}
            onClick={disableClose ? undefined : onClose}
            role="presentation"
        >
            <div
                className={`app-modal-content ${contentClassName}`.trim()}
                style={width ? { width, maxWidth: 'none', position: 'relative', zIndex: 1 } : { position: 'relative', zIndex: 1 }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="app-modal-header">
                    <h3>{title}</h3>
                    {!hideCloseButton && (
                        <button
                            type="button"
                            className="app-modal-close-btn"
                            onClick={onClose}
                            aria-label="Close"
                            disabled={disableClose}
                        >
                            <X size={20} />
                        </button>
                    )}
                </div>
                <div className="app-modal-body">
                    {children}
                </div>
                {footer && <div className="app-modal-footer">{footer}</div>}
            </div>
        </div>
    );

    if (typeof document === 'undefined') return null;
    return createPortal(node, document.body);
}
