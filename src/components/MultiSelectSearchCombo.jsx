import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronsUpDown, Search, X } from 'lucide-react';
import './SearchableEntityCombobox.css';
import './MultiSelectSearchCombo.css';

/**
 * First-class inline multi-select combo (chips + typeahead). Not a modal.
 */
export default function MultiSelectSearchCombo({
    options = [],
    value = [],
    onChange,
    placeholder = 'Search products…',
    emptyHint = 'No matching products',
    disabled = false,
    menuMinWidth = 320,
    maxInitial = 200,
    maxFiltered = 400,
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [highlightIdx, setHighlightIdx] = useState(0);
    const [menuStyle, setMenuStyle] = useState(null);
    const wrapRef = useRef(null);
    const menuRef = useRef(null);
    const inputRef = useRef(null);
    const selected = useMemo(
        () => new Set((value || []).map((v) => String(v))),
        [value],
    );
    const selectedRows = useMemo(
        () => (options || []).filter((o) => selected.has(String(o.id ?? o.value))),
        [options, selected],
    );
    const q = String(query || '').trim().toLowerCase();
    const filtered = useMemo(() => {
        const rows = options || [];
        if (!q) return rows.slice(0, Math.max(1, maxInitial));
        return rows
            .filter((o) => {
                const hay = `${o.label || ''} ${o.searchText || ''} ${o.id || ''}`.toLowerCase();
                return hay.includes(q);
            })
            .slice(0, Math.max(1, maxFiltered));
    }, [options, q, maxInitial, maxFiltered]);

    const updateMenu = useCallback(() => {
        const wrap = wrapRef.current;
        if (!wrap) return;
        const rect = wrap.getBoundingClientRect();
        const gap = 4;
        setMenuStyle({
            position: 'fixed',
            left: rect.left,
            top: rect.bottom + gap,
            width: Math.max(rect.width, menuMinWidth),
            zIndex: 80,
            maxHeight: Math.min(320, window.innerHeight - rect.bottom - 24),
        });
    }, [menuMinWidth]);

    useLayoutEffect(() => {
        if (!open) return undefined;
        updateMenu();
        const onWin = () => updateMenu();
        window.addEventListener('resize', onWin);
        window.addEventListener('scroll', onWin, true);
        return () => {
            window.removeEventListener('resize', onWin);
            window.removeEventListener('scroll', onWin, true);
        };
    }, [open, updateMenu, selectedRows.length, query]);

    useEffect(() => {
        if (!open) return undefined;
        const onDoc = (e) => {
            if (wrapRef.current?.contains(e.target)) return;
            if (menuRef.current?.contains(e.target)) return;
            setOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [open]);

    const toggle = (id) => {
        const key = String(id);
        const next = selected.has(key)
            ? (value || []).filter((v) => String(v) !== key)
            : [...(value || []), key];
        onChange?.(next);
    };

    return (
        <div className="ms-combo" ref={wrapRef}>
            <div
                className={`ms-combo__field${open ? ' ms-combo__field--open' : ''}${disabled ? ' ms-combo__field--disabled' : ''}`}
                onClick={() => {
                    if (disabled) return;
                    setOpen(true);
                    inputRef.current?.focus();
                }}
            >
                <Search size={16} aria-hidden />
                <div className="ms-combo__chips">
                    {selectedRows.map((o) => (
                        <span key={String(o.id ?? o.value)} className="ms-combo__chip">
                            {o.label}
                            <button
                                type="button"
                                className="ms-combo__chip-x"
                                aria-label={`Remove ${o.label}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggle(o.id ?? o.value);
                                }}
                            >
                                <X size={12} />
                            </button>
                        </span>
                    ))}
                    <input
                        ref={inputRef}
                        disabled={disabled}
                        value={query}
                        placeholder={selectedRows.length ? '' : placeholder}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setOpen(true);
                            setHighlightIdx(0);
                        }}
                        onFocus={() => setOpen(true)}
                        onKeyDown={(e) => {
                            if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                setHighlightIdx((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
                            } else if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                setHighlightIdx((i) => Math.max(i - 1, 0));
                            } else if (e.key === 'Enter' && filtered[highlightIdx]) {
                                e.preventDefault();
                                toggle(filtered[highlightIdx].id ?? filtered[highlightIdx].value);
                                setQuery('');
                            } else if (e.key === 'Backspace' && !query && selectedRows.length) {
                                toggle(selectedRows[selectedRows.length - 1].id ?? selectedRows[selectedRows.length - 1].value);
                            } else if (e.key === 'Escape') {
                                setOpen(false);
                            }
                        }}
                    />
                </div>
                {selectedRows.length ? (
                    <button
                        type="button"
                        className="ms-combo__clear"
                        onClick={(e) => {
                            e.stopPropagation();
                            onChange?.([]);
                            setQuery('');
                        }}
                    >
                        Clear
                    </button>
                ) : null}
                <ChevronsUpDown size={16} aria-hidden />
            </div>
            {open && menuStyle && typeof document !== 'undefined'
                ? createPortal(
                      <ul
                          ref={menuRef}
                          className="sf-entity-dropdown-portal ms-combo__menu"
                          style={menuStyle}
                          role="listbox"
                          aria-multiselectable="true"
                          onMouseDown={(e) => e.stopPropagation()}
                      >
                          {filtered.length === 0 ? (
                              <li className="ms-combo__empty">{emptyHint}</li>
                          ) : (
                              filtered.map((o, idx) => {
                                  const id = String(o.id ?? o.value);
                                  const on = selected.has(id);
                                  return (
                                      <li key={id}>
                                          <button
                                              type="button"
                                              role="option"
                                              aria-selected={on}
                                              className={`ms-combo__opt${on ? ' ms-combo__opt--on' : ''}${idx === highlightIdx ? ' ms-combo__opt--hi' : ''}`}
                                              onMouseEnter={() => setHighlightIdx(idx)}
                                              onClick={() => {
                                                  toggle(id);
                                                  setQuery('');
                                                  inputRef.current?.focus();
                                              }}
                                          >
                                              <span className={`ms-combo__check${on ? ' ms-combo__check--on' : ''}`}>
                                                  {on ? <Check size={12} /> : null}
                                              </span>
                                              <span>{o.label}</span>
                                          </button>
                                      </li>
                                  );
                              })
                          )}
                      </ul>,
                      document.body,
                  )
                : null}
        </div>
    );
}
