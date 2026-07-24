import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search } from 'lucide-react';
import { countSearchMatches, filterSearchOptions } from '../utils/entitySearchUtils';
import './SearchableEntityCombobox.css';

/**
 * Searchable dropdown with portal menu (anchored to input, not page bottom).
 * Type to filter · ↑↓ to navigate · Enter to select.
 */
export default function SearchableEntityCombobox({
    options = [],
    value,
    displayText,
    onDisplayTextChange,
    onSelect,
    onTabAdvance,
    inputRef,
    placeholder = 'Type to search…',
    disabled = false,
    id,
    required = false,
    maxInitial = 100,
    maxFiltered = 200,
    emptyHint,
    entityLabel = 'item',
    className = '',
    loading = false,
    menuMinWidth = 280,
    portalClassName = '',
}) {
    const [open, setOpen] = useState(false);
    const [highlightIdx, setHighlightIdx] = useState(0);
    const [menuStyle, setMenuStyle] = useState(null);
    const wrapRef = useRef(null);
    const listRef = useRef(null);
    const portalRef = useRef(null);
    const internalRef = useRef(null);
    const ref = inputRef || internalRef;
    const blurTimerRef = useRef(null);

    const filtered = useMemo(
        () => filterSearchOptions(options, displayText, { maxInitial, maxFiltered }),
        [options, displayText, maxInitial, maxFiltered],
    );

    const totalMatches = useMemo(
        () => countSearchMatches(options, displayText),
        [options, displayText],
    );

    const updateMenuPosition = useCallback(() => {
        const wrap = wrapRef.current;
        if (!wrap) return;
        const rect = wrap.getBoundingClientRect();
        const gap = 4;
        const maxH = Math.min(320, window.innerHeight - rect.bottom - gap - 16);
        const openUp = maxH < 120 && rect.top > window.innerHeight / 2;
        const height = openUp
            ? Math.min(320, rect.top - gap - 16)
            : Math.max(120, maxH);

        setMenuStyle({
            position: 'fixed',
            left: rect.left,
            width: Math.max(rect.width, menuMinWidth),
            maxWidth: Math.min(Math.max(menuMinWidth, 480), window.innerWidth - rect.left - 16),
            zIndex: 10050,
            ...(openUp
                ? { bottom: window.innerHeight - rect.top + gap, maxHeight: height }
                : { top: rect.bottom + gap, maxHeight: height }),
        });
    }, [menuMinWidth]);

    const clearBlurTimer = useCallback(() => {
        if (blurTimerRef.current) {
            window.clearTimeout(blurTimerRef.current);
            blurTimerRef.current = null;
        }
    }, []);

    const scheduleClose = useCallback(() => {
        clearBlurTimer();
        blurTimerRef.current = window.setTimeout(() => setOpen(false), 160);
    }, [clearBlurTimer]);

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

    useEffect(() => () => clearBlurTimer(), [clearBlurTimer]);

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
            clearBlurTimer();
            setOpen(true);
            setHighlightIdx((i) =>
                filtered.length === 0 ? 0 : Math.min(i + 1, filtered.length - 1),
            );
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            clearBlurTimer();
            if (!open) setOpen(true);
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

    const emptyMessage = loading
        ? 'Loading employees…'
        : options.length === 0
          ? `No ${entityLabel}s loaded for this workshop`
          : emptyHint || 'No matches — try another search';

    const menu =
        open && menuStyle
            ? createPortal(
                  <div
                      ref={(node) => {
                          listRef.current = node;
                          portalRef.current = node;
                      }}
                      className={`sf-entity-dropdown-portal ${portalClassName}`.trim()}
                      style={menuStyle}
                      role="listbox"
                      onMouseDown={(e) => {
                          e.preventDefault();
                          clearBlurTimer();
                      }}
                  >
                      {filtered.length === 0 ? (
                          <div className="sf-combobox-empty">{emptyMessage}</div>
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
                                  {opt.trailing ? (
                                      <div className="pi-result-trailing">{opt.trailing}</div>
                                  ) : null}
                              </div>
                          ))
                      )}
                      {filtered.length > 0 ? (
                          <div className="sf-combobox-footer">
                              ↑↓ navigate · Enter select
                              {totalMatches > filtered.length
                                  ? ` · ${filtered.length} of ${totalMatches}`
                                  : ` · ${totalMatches} ${entityLabel}${totalMatches === 1 ? '' : 's'}`}
                          </div>
                      ) : null}
                  </div>,
                  document.body,
              )
            : null;

    return (
        <>
            <div
                className={`pi-search-box-wrapper sf-entity-combobox-anchor ${className}`.trim()}
                ref={wrapRef}
            >
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
                        spellCheck={false}
                        placeholder={placeholder}
                        onChange={(e) => {
                            onDisplayTextChange?.(e.target.value);
                            clearBlurTimer();
                            setOpen(true);
                            updateMenuPosition();
                        }}
                        onFocus={() => {
                            clearBlurTimer();
                            setOpen(true);
                            updateMenuPosition();
                        }}
                        onBlur={scheduleClose}
                        onKeyDown={onKeyDown}
                    />
                </div>
            </div>
            {menu}
        </>
    );
}
