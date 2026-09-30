import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Wraps a wide table with synchronized horizontal scrollbars at top and bottom.
 */
export default function WsTableScroll({ children, className = '', style, bodyStyle, bodyClassName = '' }) {
    const topRef = useRef(null);
    const bodyRef = useRef(null);
    const innerRef = useRef(null);
    const spacerRef = useRef(null);
    const syncingRef = useRef(false);
    const [hasOverflow, setHasOverflow] = useState(false);

    const syncWidth = useCallback(() => {
        const inner = innerRef.current;
        const spacer = spacerRef.current;
        const body = bodyRef.current;
        if (!inner || !spacer || !body) return;
        const width = inner.scrollWidth;
        spacer.style.width = `${width}px`;
        setHasOverflow(width > body.clientWidth + 1);
    }, []);

    useEffect(() => {
        syncWidth();
        const inner = innerRef.current;
        const body = bodyRef.current;
        if (!inner) return undefined;
        const ro = new ResizeObserver(() => syncWidth());
        ro.observe(inner);
        if (body) ro.observe(body);
        window.addEventListener('resize', syncWidth);
        return () => {
            ro.disconnect();
            window.removeEventListener('resize', syncWidth);
        };
    }, [children, syncWidth]);

    const syncScroll = useCallback((from, to) => {
        if (syncingRef.current || !from.current || !to.current) return;
        syncingRef.current = true;
        to.current.scrollLeft = from.current.scrollLeft;
        requestAnimationFrame(() => {
            syncingRef.current = false;
        });
    }, []);

    const rootClass = [
        'ws-table-scroll',
        hasOverflow ? 'ws-table-scroll--overflow' : 'ws-table-scroll--fit',
        className,
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <div className={rootClass} style={style}>
            <div
                ref={topRef}
                className="ws-table-scroll__top"
                onScroll={() => syncScroll(topRef, bodyRef)}
                aria-hidden={!hasOverflow}
            >
                <div ref={spacerRef} className="ws-table-scroll__spacer" />
            </div>
            <div
                ref={bodyRef}
                className={`ws-table-scroll__body${bodyClassName ? ` ${bodyClassName}` : ''}`}
                style={bodyStyle}
                onScroll={() => syncScroll(bodyRef, topRef)}
            >
                <div ref={innerRef} className="ws-table-scroll__inner">
                    {children}
                </div>
            </div>
        </div>
    );
}
