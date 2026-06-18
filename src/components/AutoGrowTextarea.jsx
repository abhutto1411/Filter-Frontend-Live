import React, { forwardRef, useLayoutEffect, useRef } from 'react';

/**
 * A single-line-looking textarea that grows in height to show its full
 * (wrapped) content. Used for product-name fields so a long selected product
 * name stays fully visible instead of being truncated inside a fixed input.
 *
 * Behaves like an <input> for the consumer: same value/onChange/onFocus/
 * onKeyDown props, and forwards a ref to the underlying <textarea>.
 */
const AutoGrowTextarea = forwardRef(function AutoGrowTextarea(
    { value, minRows = 1, style, className, ...props },
    forwardedRef,
) {
    const innerRef = useRef(null);

    const setRefs = (el) => {
        innerRef.current = el;
        if (typeof forwardedRef === 'function') forwardedRef(el);
        else if (forwardedRef) forwardedRef.current = el;
    };

    useLayoutEffect(() => {
        const el = innerRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
    }, [value]);

    return (
        <textarea
            ref={setRefs}
            rows={minRows}
            value={value}
            className={className}
            style={{
                resize: 'none',
                overflow: 'hidden',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                lineHeight: 1.35,
                ...style,
            }}
            {...props}
        />
    );
});

export default AutoGrowTextarea;
