import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Renders a dropdown anchored to an input, using a portal so it is never clipped by overflow:hidden parents.
 */
export default function StaffChatSuggestionsPortal({
    anchorRef,
    open,
    children,
    highlightIndex = -1,
    className = 'staff-chat-member-picker__suggestions staff-chat-member-picker__suggestions--portal',
    maxHeight = 260,
}) {
    const listRef = useRef(null);
    const [style, setStyle] = useState({ top: 0, left: 0, width: 0 });

    useEffect(() => {
        if (!open || !anchorRef?.current) return undefined;

        const updatePosition = () => {
            const el = anchorRef.current;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            const viewportH = window.innerHeight;
            const spaceBelow = viewportH - rect.bottom;
            const spaceAbove = rect.top;
            const preferBelow = spaceBelow >= 160 || spaceBelow >= spaceAbove;
            const dropdownH = Math.min(maxHeight, preferBelow ? spaceBelow - 12 : spaceAbove - 12);

            setStyle({
                position: 'fixed',
                left: rect.left,
                width: Math.max(rect.width, 280),
                zIndex: 10050,
                maxHeight: Math.max(dropdownH, 120),
                ...(preferBelow
                    ? { top: rect.bottom + 6 }
                    : { bottom: viewportH - rect.top + 6 }),
            });
        };

        updatePosition();
        window.addEventListener('scroll', updatePosition, true);
        window.addEventListener('resize', updatePosition);
        return () => {
            window.removeEventListener('scroll', updatePosition, true);
            window.removeEventListener('resize', updatePosition);
        };
    }, [anchorRef, open, maxHeight]);

    useEffect(() => {
        if (!open || highlightIndex < 0 || !listRef.current) return;
        const active = listRef.current.querySelector(
            `[data-suggestion-index="${highlightIndex}"]`,
        );
        active?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    }, [open, highlightIndex]);

    if (!open) return null;

    return createPortal(
        <ul ref={listRef} className={className} role="listbox" style={style}>
            {children}
        </ul>,
        document.body,
    );
}
