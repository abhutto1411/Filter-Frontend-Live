import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronsUpDown, Search, X } from 'lucide-react';
import { computeFixedComboMenuStyle, stepComboHighlightIdx } from './multiSelectMenuPlacement';
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
    maxInitial = 0,
    maxFiltered = 0,
    clearLabel = 'Clear',
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
        const cap = (list, max) => {
            const n = Number(max);
            if (!Number.isFinite(n) || n <= 0) return list;
            return list.slice(0, n);
        };
        if (!q) return cap(rows, maxInitial);
        const tokens = q.split(/\s+/).filter(Boolean);
        return cap(
            rows.filter((o) => {
                const hay = `${o.label || ''} ${o.searchText || ''} ${o.id || ''} ${o.value || ''}`
                    .toLowerCase()
                    .replace(/[-_]/g, '');
                return tokens.every((token) => hay.includes(token.replace(/[-_]/g, '')));
            }),
            maxFiltered,
        );
    }, [options, q, maxInitial, maxFiltered]);

    const updateMenu = useCallback(() => {
        const wrap = wrapRef.current;
        if (!wrap) return;
        const { openUp: _openUp, ...style } = computeFixedComboMenuStyle(
            wrap.getBoundingClientRect(),
            {
                menuMinWidth,
                viewportWidth: window.innerWidth,
                viewportHeight: window.innerHeight,
            },
        );
        setMenuStyle(style);
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

    const toggleGroup = (group) => {
        const ids = filtered
            .filter((o) => String(o.group || '') === String(group || ''))
            .map((o) => String(o.id ?? o.value));
        if (!ids.length) return;
        const allOn = ids.every((id) => selected.has(id));
        if (allOn) {
            onChange?.((value || []).filter((v) => !ids.includes(String(v))));
            return;
        }
        const keep = (value || []).filter((v) => !ids.includes(String(v)));
        onChange?.([...keep, ...ids]);
    };

    const moveHighlight = useCallback((delta) => {
        setHighlightIdx((i) => stepComboHighlightIdx(i, delta, filtered.length));
    }, [filtered.length]);

    const selectHighlighted = useCallback(() => {
        const row = filtered[highlightIdx];
        if (!row) return;
        toggle(row.id ?? row.value);
        setQuery('');
        inputRef.current?.focus();
    }, [filtered, highlightIdx, value, selected]);

    useEffect(() => {
        setHighlightIdx((i) => stepComboHighlightIdx(i, 0, filtered.length));
    }, [filtered.length]);

    useEffect(() => {
        if (!open) return undefined;
        const ownsFocus = () => {
            const active = document.activeElement;
            return Boolean(
                wrapRef.current?.contains(active) || menuRef.current?.contains(active),
            );
        };
        const onKey = (e) => {
            if (!ownsFocus()) return;
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                e.stopPropagation();
                moveHighlight(1);
                inputRef.current?.focus();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                e.stopPropagation();
                moveHighlight(-1);
                inputRef.current?.focus();
            } else if (e.key === 'Enter') {
                if (!filtered[highlightIdx]) return;
                e.preventDefault();
                e.stopPropagation();
                selectHighlighted();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                setOpen(false);
            }
        };
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, [open, moveHighlight, selectHighlighted, filtered, highlightIdx]);

    useLayoutEffect(() => {
        if (!open || !menuRef.current) return;
        const el = menuRef.current.querySelector(`[data-combo-idx="${highlightIdx}"]`);
        el?.scrollIntoView({ block: 'nearest' });
    }, [highlightIdx, open, filtered.length]);

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
                        <span key={String(o.id ?? o.value)} className="ms-combo__chip" title={o.label}>
                            {o.chipLabel || o.label}
                            <button
                                type="button"
                                className="ms-combo__chip-x"
                                tabIndex={-1}
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
                            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                                e.preventDefault();
                                if (!open) {
                                    setOpen(true);
                                    setHighlightIdx(0);
                                }
                            } else if (e.key === 'Backspace' && !query && selectedRows.length) {
                                toggle(selectedRows[selectedRows.length - 1].id ?? selectedRows[selectedRows.length - 1].value);
                            }
                        }}
                    />
                </div>
                {selectedRows.length ? (
                    <button
                        type="button"
                        className="ms-combo__clear"
                        tabIndex={-1}
                        onClick={(e) => {
                            e.stopPropagation();
                            onChange?.([]);
                            setQuery('');
                        }}
                    >
                        {clearLabel}
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
                                  const group = String(o.group || '');
                                  const prevGroup = idx > 0 ? String(filtered[idx - 1].group || '') : '';
                                  const showGroup = Boolean(group) && group !== prevGroup;
                                  const groupIds = group
                                      ? filtered
                                            .filter((row) => String(row.group || '') === group)
                                            .map((row) => String(row.id ?? row.value))
                                      : [];
                                  const groupAllOn =
                                      groupIds.length > 0 && groupIds.every((gid) => selected.has(gid));
                                  return (
                                      <li key={id}>
                                          {showGroup ? (
                                              <button
                                                  type="button"
                                                  tabIndex={-1}
                                                  className={`ms-combo__group${groupAllOn ? ' ms-combo__group--on' : ''}`}
                                                  onMouseDown={(e) => e.preventDefault()}
                                                  onClick={() => toggleGroup(group)}
                                              >
                                                  {group}
                                              </button>
                                          ) : null}
                                          <button
                                              type="button"
                                              role="option"
                                              tabIndex={-1}
                                              data-combo-idx={idx}
                                              aria-selected={on}
                                              className={`ms-combo__opt${on ? ' ms-combo__opt--on' : ''}${idx === highlightIdx ? ' ms-combo__opt--hi' : ''}`}
                                              onMouseEnter={() => setHighlightIdx(idx)}
                                              onMouseDown={(e) => e.preventDefault()}
                                              onClick={() => {
                                                  toggle(id);
                                                  setQuery('');
                                                  inputRef.current?.focus();
                                              }}
                                          >
                                              <span className={`ms-combo__check${on ? ' ms-combo__check--on' : ''}`}>
                                                  {on ? <Check size={12} /> : null}
                                              </span>
                                              <span className="ms-combo__opt-copy">
                                                  <span className="ms-combo__opt-label">{o.chipLabel || o.label}</span>
                                                  {o.hint ? (
                                                      <span className="ms-combo__opt-hint">{o.hint}</span>
                                                  ) : null}
                                              </span>
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
