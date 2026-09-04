import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Type-to-search product picker — dropdown rendered in portal (fixed to input).
 */
export default function ProductLineCombobox({
    products = [],
    value,
    searchText,
    onSearchChange,
    onSelect,
    onTabAdvance,
    inputRef,
    placeholder = 'Type name or SKU…',
    disabled = false,
    id,
}) {
    const [open, setOpen] = useState(false);
    const [highlightIdx, setHighlightIdx] = useState(0);
    const [menuStyle, setMenuStyle] = useState(null);
    const wrapRef = useRef(null);
    const listRef = useRef(null);
    const internalRef = useRef(null);
    const ref = inputRef || internalRef;

    const options = useMemo(() => {
        const list = products.filter((p) => p.isActive !== false);
        const q = (searchText || '').trim().toLowerCase();
        if (!q) return list.slice(0, 80);
        return list
            .filter(
                (p) =>
                    (p.name || '').toLowerCase().includes(q) ||
                    (p.sku || '').toLowerCase().includes(q),
            )
            .slice(0, 80);
    }, [products, searchText]);

    const updateMenuPosition = useCallback(() => {
        const wrap = wrapRef.current;
        if (!wrap) return;
        const rect = wrap.getBoundingClientRect();
        const gap = 4;
        const maxH = Math.min(260, window.innerHeight - rect.bottom - gap - 12);
        const openUp = maxH < 100 && rect.top > window.innerHeight / 2;
        const height = openUp
            ? Math.min(260, rect.top - gap - 12)
            : Math.max(100, maxH);

        setMenuStyle({
            position: 'fixed',
            left: rect.left,
            width: Math.max(rect.width, 320),
            maxWidth: Math.min(520, window.innerWidth - rect.left - 12),
            zIndex: 10050,
            ...(openUp
                ? { bottom: window.innerHeight - rect.top + gap, maxHeight: height }
                : { top: rect.bottom + gap, maxHeight: height }),
        });
    }, []);

    useEffect(() => {
        setHighlightIdx(0);
    }, [searchText, options.length]);

    useLayoutEffect(() => {
        if (!open || options.length === 0) {
            setMenuStyle(null);
            return undefined;
        }
        updateMenuPosition();
        const sync = () => updateMenuPosition();
        window.addEventListener('scroll', sync, true);
        window.addEventListener('resize', sync);
        return () => {
            window.removeEventListener('scroll', sync, true);
            window.removeEventListener('resize', sync);
        };
    }, [open, options.length, updateMenuPosition]);

    useEffect(() => {
        if (!open || !listRef.current) return;
        const el = listRef.current.querySelector('[data-highlight="true"]');
        if (!el) return;
        const parent = listRef.current;
        const elTop = el.offsetTop;
        const elBottom = elTop + el.offsetHeight;
        if (elTop < parent.scrollTop) parent.scrollTop = elTop;
        else if (elBottom > parent.scrollTop + parent.clientHeight) {
            parent.scrollTop = elBottom - parent.clientHeight;
        }
    }, [highlightIdx, open]);

    const pick = useCallback(
        (product, advance) => {
            if (!product?.id) return;
            onSelect?.(product);
            setOpen(false);
            setHighlightIdx(0);
            if (advance) window.setTimeout(() => onTabAdvance?.(), 0);
        },
        [onSelect, onTabAdvance],
    );

    const onKeyDown = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            setHighlightIdx((i) =>
                options.length === 0 ? 0 : Math.min(i + 1, options.length - 1),
            );
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightIdx((i) => Math.max(i - 1, 0));
            return;
        }
        if (e.key === 'Enter' && options.length > 0) {
            e.preventDefault();
            pick(options[highlightIdx] ?? options[0], false);
            return;
        }
        if (e.key === 'Tab' && !e.shiftKey && options.length > 0 && open) {
            const match =
                options.find((p) => String(p.id) === String(value)) ||
                options[highlightIdx] ||
                options[0];
            if (match && String(match.id) !== String(value)) {
                e.preventDefault();
                pick(match, true);
            }
        }
        if (e.key === 'Escape') setOpen(false);
    };

    const selected = useMemo(
        () => products.find((p) => String(p.id) === String(value)),
        [products, value],
    );

    const menu =
        open && options.length > 0 && menuStyle
            ? createPortal(
                  <ul
                      ref={listRef}
                      className="sf-entity-dropdown-portal sf-movement-picker"
                      style={menuStyle}
                      role="listbox"
                  >
                      {options.map((p, idx) => (
                          <li
                              key={p.id}
                              role="option"
                              data-highlight={idx === highlightIdx ? 'true' : 'false'}
                              aria-selected={idx === highlightIdx}
                              className={
                                  idx === highlightIdx
                                      ? 'sf-movement-picker-item active'
                                      : 'sf-movement-picker-item'
                              }
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => pick(p, false)}
                          >
                              <div className="sf-movement-picker-name">{p.name}</div>
                              <div className="sf-movement-picker-meta">
                                  SKU: {p.sku || '—'} · On hand: {p.qtyOnHand} {p.unit}
                              </div>
                          </li>
                      ))}
                  </ul>,
                  document.body,
              )
            : null;

    return (
        <>
            <div className="sf-bulk-combobox-wrap" ref={wrapRef}>
                <input
                    id={id}
                    ref={ref}
                    type="text"
                    className="sf-bulk-grid-input sf-bulk-combobox-input"
                    value={searchText}
                    disabled={disabled}
                    autoComplete="off"
                    placeholder={placeholder}
                    onChange={(e) => {
                        onSearchChange?.(e.target.value);
                        setOpen(true);
                    }}
                    onFocus={() => {
                        setOpen(true);
                        updateMenuPosition();
                    }}
                    onBlur={() => window.setTimeout(() => setOpen(false), 180)}
                    onKeyDown={onKeyDown}
                />
                {selected && !open ? (
                    <span className="sf-bulk-combobox-onhand" title="On hand">
                        {selected.qtyOnHand} {selected.unit}
                    </span>
                ) : null}
            </div>
            {menu}
        </>
    );
}
