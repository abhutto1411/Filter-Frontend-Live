import { ArrowLeft } from 'lucide-react';

/**
 * In-portal sub-view (replaces modal overlays). Parent swaps list ↔ screen; back returns to list.
 *
 * @param {'narrow' | 'form' | 'wide' | 'xl' | 'full'} size — pick per screen; default `form` (~600px).
 * @param {string} [maxWidth] — optional CSS max-width override (e.g. `"840px"`).
 */
export default function WorkshopSubScreen({
    title,
    subtitle,
    backLabel = 'Back',
    onBack,
    backDisabled = false,
    children,
    footer,
    className = '',
    size = 'form',
    maxWidth,
}) {
    const innerClass = [
        'ws-sub-screen-inner',
        size === 'narrow' ? 'ws-sub-screen-inner--narrow' : '',
        size === 'wide' ? 'ws-sub-screen-inner--wide' : '',
        size === 'xl' ? 'ws-sub-screen-inner--xl' : '',
        size === 'full' ? 'ws-sub-screen-inner--full' : '',
    ]
        .filter(Boolean)
        .join(' ');

    const innerStyle = maxWidth ? { maxWidth } : undefined;

    return (
        <div className={`ws-sub-screen ${className}`.trim()}>
            <div className={innerClass} style={innerStyle}>
                <button
                    type="button"
                    className="ws-sub-screen-back"
                    onClick={onBack}
                    disabled={backDisabled}
                >
                    <ArrowLeft size={16} aria-hidden />
                    {backLabel}
                </button>
                {(title || subtitle) && (
                    <header className="ws-sub-screen-header">
                        {title ? <h2 className="ws-page-title">{title}</h2> : null}
                        {subtitle ? <p className="ws-page-sub">{subtitle}</p> : null}
                    </header>
                )}
                <div className="ws-sub-screen-body">{children}</div>
                {footer ? <div className="ws-sub-screen-footer">{footer}</div> : null}
            </div>
        </div>
    );
}
