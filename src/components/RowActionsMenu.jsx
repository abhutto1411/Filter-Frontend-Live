import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical } from 'lucide-react';

/**
 * Three-dot row actions menu — text options in a dropdown.
 *
 * @param {Array<{
 *   id?: string,
 *   label: string,
 *   onClick: () => void,
 *   disabled?: boolean,
 *   hidden?: boolean,
 *   danger?: boolean,
 *   title?: string,
 * }>} items
 */
export default function RowActionsMenu({
    items = [],
    disabled = false,
    ariaLabel = 'Row actions',
    stopPropagation = true,
}) {
    const menuId = useId();
    const triggerRef = useRef(null);
    const menuRef = useRef(null);
    const [open, setOpen] = useState(false);
    const [menuStyle, setMenuStyle] = useState({ top: 0, left: 0 });

    const visibleItems = items.filter((item) => item && !item.hidden && String(item.label || '').trim());

    const close = useCallback(() => setOpen(false), []);

    const updatePosition = useCallback(() => {
        const trigger = triggerRef.current;
        const menu = menuRef.current;
        if (!trigger || !menu) return;

        const rect = trigger.getBoundingClientRect();
        const menuRect = menu.getBoundingClientRect();
        const gap = 4;
        const pad = 8;

        let top = rect.bottom + gap;
        if (top + menuRect.height > window.innerHeight - pad) {
            top = Math.max(pad, rect.top - menuRect.height - gap);
        }

        let left = rect.right - menuRect.width;
        if (left < pad) left = pad;
        if (left + menuRect.width > window.innerWidth - pad) {
            left = window.innerWidth - menuRect.width - pad;
        }

        setMenuStyle({ top, left });
    }, []);

    useLayoutEffect(() => {
        if (!open) return;
        updatePosition();
    }, [open, visibleItems.length, updatePosition]);

    useEffect(() => {
        if (!open) return undefined;

        const onPointerDown = (event) => {
            const t = event.target;
            if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
            close();
        };
        const onKeyDown = (event) => {
            if (event.key === 'Escape') close();
        };
        const onScrollOrResize = () => close();

        document.addEventListener('mousedown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        window.addEventListener('scroll', onScrollOrResize, true);
        window.addEventListener('resize', onScrollOrResize);

        return () => {
            document.removeEventListener('mousedown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('scroll', onScrollOrResize, true);
            window.removeEventListener('resize', onScrollOrResize);
        };
    }, [open, close]);

    const toggleOpen = (event) => {
        if (stopPropagation) event.stopPropagation();
        if (disabled || visibleItems.length === 0) return;
        setOpen((prev) => !prev);
    };

    const onItemClick = (event, item) => {
        event.stopPropagation();
        if (item.disabled) return;
        item.onClick();
        close();
    };

    const menu =
        open && visibleItems.length > 0
            ? createPortal(
                  <div
                      ref={menuRef}
                      id={menuId}
                      role="menu"
                      className="row-actions-menu"
                      style={{ top: menuStyle.top, left: menuStyle.left }}
                  >
                      {visibleItems.map((item, index) => (
                          <button
                              key={item.id || `${item.label}-${index}`}
                              type="button"
                              role="menuitem"
                              className={`row-actions-menu__item${
                                  item.danger ? ' row-actions-menu__item--danger' : ''
                              }`}
                              disabled={Boolean(item.disabled)}
                              title={item.title || item.label}
                              onClick={(event) => onItemClick(event, item)}
                          >
                              {item.label}
                          </button>
                      ))}
                  </div>,
                  document.body,
              )
            : null;

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                className="row-actions-menu__trigger"
                aria-label={ariaLabel}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={open ? menuId : undefined}
                disabled={disabled || visibleItems.length === 0}
                onClick={toggleOpen}
            >
                <MoreVertical size={16} strokeWidth={2.25} aria-hidden />
            </button>
            {menu}
        </>
    );
}
