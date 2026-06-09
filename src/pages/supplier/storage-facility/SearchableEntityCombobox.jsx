import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search } from 'lucide-react';

/**
 * Searchable dropdown with portal menu (anchored to input, not page bottom).
 */
export default function SearchableEntityCombobox({
    options = [],
    value,
    displayText,
    onDisplayTextChange,
    onSelect,
    onTabAdvance,
    inputRef,
    placeholder = 'Search…',
    disabled = false,
    id,
    required = false,
    maxInitial = 100,
    maxFiltered = 200,
    emptyHint,
}) {
    const [open, setOpen] = useState(false);
    const [highlightIdx, setHighlightIdx] = useState(0);
    const [menuStyle, setMenuStyle] = useState(null);
    const wrapRef = useRef(null);
    const listRef = useRef(null);
    const internalRef = useRef(null);
    const ref = inputRef || internalRef;

    const filtered = useMemo(() => {
        const q = (displayText || '').trim().toLowerCase();
        if (!q) return options.slice(0, maxInitial);
        return options
            .filter(
                (o) =>
                    (o.label || '').toLowerCase().includes(q) ||
                    (o.subtitle || '').toLowerCase().includes(q),
            )
            .slice(0, maxFiltered);
    }, [options, displayText, maxInitial, maxFiltered]);

    const totalMatches = useMemo(() => {
        const q = (displayText || '').trim().toLowerCase();
        if (!q) return options.length;
        return options.filter(
            (o) =>
                (o.label || '').toLowerCase().includes(q) ||
                (o.subtitle || '').toLowerCase().includes(q),
        ).length;
    }, [options, displayText]);

    const updateMenuPosition = useCallback(() => {
        const wrap = wrapRef.current;
        if (!wrap) return;
        const rect = wrap.getBoundingClientRect();
        const gap = 4;
        const maxH = Math.min(280, window.innerHeight - rect.bottom - gap - 16);
        const openUp = maxH < 120 && rect.top > window.innerHeight / 2;
        const height = openUp
            ? Math.min(280, rect.top - gap - 16)
            : Math.max(120, maxH);

        setMenuStyle({
            position: 'fixed',
            left: rect.left,
            width: Math.max(rect.width, 280),
            maxWidth: Math.min(480, window.innerWidth - rect.left - 16),
            zIndex: 10050,
            ...(openUp
                ? { bottom: window.innerHeight - rect.top + gap, maxHeight: height }
                : { top: rect.bottom + gap, maxHeight: height }),
        });
    }, []);

    useEffect(() => {
        setHighlightIdx(0);
    }, [displayText, filtered.length]);

    useLayoutEffect(() => {
        if (!open) {
            setMenuStyle(null);
            return undefined;
        }
        updateMenuPosition();
        const onScrollOrResize = () => updateMenuPosition();
        window.addEventListener('scroll', onScrollOrResize, true);
        window.addEventListener('resize', onScrollOrResize);
        return () => {
            window.removeEventListener('scroll', onScrollOrResize, true);
            window.removeEventListener('resize', onScrollOrResize);
        };
    }, [open, filtered.length, updateMenuPosition]);

    useEffect(() => {
        if (!open || !listRef.current) return;
        const el = listRef.current.querySelector('[data-highlight="true"]');
        if (!el) return;
        const parent = listRef.current;
        const elTop = el.offsetTop;
        const elBottom = elTop + el.offsetHeight;
        if (elTop < parent.scrollTop) {
            parent.scrollTop = elTop;
        } else if (elBottom > parent.scrollTop + parent.clientHeight) {
            parent.scrollTop = elBottom - parent.clientHeight;
        }
    }, [highlightIdx, open]);

    const pick = useCallback(
        (opt, advance) => {
            if (!opt?.id) return;
            onSelect?.(opt);
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
                filtered.length === 0 ? 0 : Math.min(i + 1, filtered.length - 1),
            );
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightIdx((i) => Math.max(i - 1, 0));
            return;
        }
        if (e.key === 'Enter' && filtered.length > 0) {
            e.preventDefault();
            pick(filtered[highlightIdx] ?? filtered[0], false);
            return;
        }
        if (e.key === 'Tab' && !e.shiftKey && filtered.length > 0 && open) {
            const match =
                filtered.find((o) => String(o.id) === String(value)) ||
                filtered[highlightIdx] ||
                filtered[0];
            if (match) {
                e.preventDefault();
                pick(match, true);
            }
        }
        if (e.key === 'Escape') setOpen(false);
    };

    const selectedLabel = useMemo(() => {
        if (!value) return '';
        const o = options.find((x) => String(x.id) === String(value));
        return o?.label || '';
    }, [options, value]);

    const showValue = open ? displayText : displayText || selectedLabel;

    const menu =
        open && menuStyle
            ? createPortal(
                  <div
                      ref={listRef}
                      className="sf-entity-dropdown-portal pi-search-results"
                      style={menuStyle}
                      role="listbox"
                  >
                      {filtered.length === 0 ? (
                          <div className="sf-combobox-empty">
                              {emptyHint || 'No matches — try another name or SKU'}
                          </div>
                      ) : (
                          filtered.map((opt, idx) => (
                              <div
                                  key={opt.id}
                                  role="option"
                                  aria-selected={idx === highlightIdx}
                                  data-highlight={idx === highlightIdx ? 'true' : 'false'}
                                  className={`pi-result-item ${idx === highlightIdx ? 'selected' : ''}`}
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => pick(opt, false)}
                                  onMouseEnter={() => setHighlightIdx(idx)}
                              >
                                  <div className="pi-result-info">
                                      <div className="pi-item-name">{opt.label}</div>
                                      {opt.subtitle ? (
                                          <div className="pi-item-meta">{opt.subtitle}</div>
                                      ) : null}
                                  </div>
                              </div>
                          ))
                      )}
                      {filtered.length > 0 ? (
                          <div className="sf-combobox-footer">
                              {totalMatches > filtered.length
                                  ? `Showing ${filtered.length} of ${totalMatches} — keep typing to narrow`
                                  : `${totalMatches} product${totalMatches === 1 ? '' : 's'}`}
                          </div>
                      ) : null}
                  </div>,
                  document.body,
              )
            : null;

    return (
        <>
            <div className="pi-search-box-wrapper sf-entity-combobox-anchor" ref={wrapRef}>
                <div className="pi-search-box">
                    <Search size={16} aria-hidden />
                    <input
                        id={id}
                        ref={ref}
                        type="text"
                        value={showValue}
                        disabled={disabled}
                        required={required && !value}
                        autoComplete="off"
                        placeholder={placeholder}
                        onChange={(e) => {
                            onDisplayTextChange?.(e.target.value);
                            setOpen(true);
                        }}
                        onFocus={() => {
                            setOpen(true);
                            updateMenuPosition();
                        }}
                        onBlur={() => window.setTimeout(() => setOpen(false), 180)}
                        onKeyDown={onKeyDown}
                    />
                </div>
            </div>
            {menu}
        </>
    );
}
