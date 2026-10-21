import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronsUpDown, Search, X } from 'lucide-react';
import { computeFixedComboMenuStyle } from './multiSelectMenuPlacement';
import { useDocumentLang } from '../hooks/useDocumentLang';
import { tableUiText } from '../utils/tableUiI18n';
import './SearchableEntityCombobox.css';
import './MultiSelectSearchCombo.css';
import './SearchSelect.css';

function matchesQuery(option, tokens) {
    if (!tokens.length) return true;
    const hay = `${option.label ?? ''} ${option.hint ?? ''} ${option.searchText ?? ''}`.toLowerCase();
    return tokens.every((token) => hay.includes(token));
}

/**
 * Single-select searchable combobox — a drop-in replacement for a native `<select>`.
 * `options`: [{ value, label, hint?, searchText?, disabled?, placeholder? }]; `onChange(value, option)`.
 * A `placeholder` option stays pickable but shows greyed out when selected.
 * Type to filter · ↑↓ to move · Enter to pick · Esc to close. Unset texts follow the portal language.
 */
export default function SearchSelect({
    options = [],
    value,
    onChange,
    placeholder,
    emptyHint,
    disabled = false,
    required = false,
    clearable = false,
    clearValue = '',
    clearLabel,
    id,
    name,
    title,
    ariaLabel,
    size = 'md',
    menuMinWidth = 240,
    className = '',
    style,
    loading = false,
    loadingHint,
    maxVisible = 300,
    moreHint,
}) {
    const ui = tableUiText(useDocumentLang());
    const placeholderText = placeholder ?? ui.typeToSearch;
    const emptyText = emptyHint || ui.noMatches;
    const loadingText = loadingHint || ui.loading;
    const moreText = moreHint ?? ui.moreMatches;
    const clearText = clearLabel || ui.clear;
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [highlightIdx, setHighlightIdx] = useState(-1);
    const [menuStyle, setMenuStyle] = useState(null);
    const wrapRef = useRef(null);
    const menuRef = useRef(null);
    const inputRef = useRef(null);
    const listId = useId();

    const selected = useMemo(
        () => options.find((o) => String(o.value) === String(value ?? '')) ?? null,
        [options, value],
    );

    const filtered = useMemo(() => {
        const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
        return options.filter((o) => matchesQuery(o, tokens));
    }, [options, query]);
    const visible = useMemo(() => filtered.slice(0, maxVisible), [filtered, maxVisible]);

    const updateMenu = useCallback(() => {
        const wrap = wrapRef.current;
        if (!wrap) return;
        const { direction } = window.getComputedStyle(wrap);
        const { openUp: _openUp, ...style } = computeFixedComboMenuStyle(wrap.getBoundingClientRect(), {
            menuMinWidth,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            zIndex: 10050,
            rtl: direction === 'rtl',
        });
        setMenuStyle({ ...style, direction });
    }, [menuMinWidth]);

    useLayoutEffect(() => {
        if (!open) return undefined;
        updateMenu();
        window.addEventListener('resize', updateMenu);
        window.addEventListener('scroll', updateMenu, true);
        return () => {
            window.removeEventListener('resize', updateMenu);
            window.removeEventListener('scroll', updateMenu, true);
        };
    }, [open, updateMenu]);

    useEffect(() => {
        if (!open) return undefined;
        const onOutside = (e) => {
            if (wrapRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
            setOpen(false);
            setQuery('');
        };
        document.addEventListener('mousedown', onOutside);
        document.addEventListener('focusin', onOutside);
        return () => {
            document.removeEventListener('mousedown', onOutside);
            document.removeEventListener('focusin', onOutside);
        };
    }, [open]);

    useLayoutEffect(() => {
        if (!open || highlightIdx < 0 || !menuRef.current) return;
        menuRef.current.querySelector(`[data-ss-idx="${highlightIdx}"]`)?.scrollIntoView({ block: 'nearest' });
    }, [open, highlightIdx]);

    const openMenu = () => {
        if (disabled || open) return;
        setOpen(true);
        setQuery('');
        const selectedIdx = selected ? options.indexOf(selected) : -1;
        setHighlightIdx(
            selectedIdx >= 0 && selectedIdx < maxVisible
                ? selectedIdx
                : options.slice(0, maxVisible).findIndex((o) => !o.disabled),
        );
    };

    const close = () => {
        setOpen(false);
        setQuery('');
        setHighlightIdx(-1);
    };

    const pick = (option) => {
        if (!option || option.disabled) return;
        if (String(option.value) !== String(value ?? '')) onChange?.(option.value, option);
        close();
    };

    /** Next enabled option in `delta` direction; stays put at either end of the list. */
    const step = (from, delta) => {
        const len = visible.length;
        let i = from < 0 || from >= len ? (delta > 0 ? -1 : len) : from;
        for (;;) {
            i += delta;
            if (i < 0 || i >= len) return from;
            if (!visible[i].disabled) return i;
        }
    };

    const onKeyDown = (e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (!open) {
                openMenu();
                return;
            }
            setHighlightIdx((i) => step(i, e.key === 'ArrowDown' ? 1 : -1));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (!open) openMenu();
            else pick(visible[highlightIdx]);
        } else if (e.key === 'Escape') {
            if (open) {
                e.preventDefault();
                e.stopPropagation();
                close();
            }
        } else if (e.key === 'Tab') {
            close();
        }
    };

    const showClear = clearable && !disabled && selected && String(selected.value) !== String(clearValue);
    const shownLabel = selected && !selected.placeholder ? selected.label : '';
    const idlePlaceholder = selected?.placeholder ? selected.label : placeholderText;

    return (
        <div
            ref={wrapRef}
            className={`ss-combo ss-combo--${size}${disabled ? ' ss-combo--disabled' : ''} ${className}`.trim()}
            title={title}
            style={style}
        >
            <div
                className={`ss-combo__field${open ? ' ss-combo__field--open' : ''}`}
                onMouseDown={(e) => {
                    if (disabled || e.target === inputRef.current) return;
                    e.preventDefault();
                    inputRef.current?.focus();
                    openMenu();
                }}
            >
                <Search size={15} aria-hidden className="ss-combo__icon" />
                <input
                    ref={inputRef}
                    id={id}
                    type="text"
                    className="ss-combo__input"
                    value={open ? query : shownLabel}
                    placeholder={open && shownLabel ? shownLabel : idlePlaceholder}
                    disabled={disabled}
                    autoComplete="off"
                    spellCheck={false}
                    role="combobox"
                    aria-label={ariaLabel}
                    aria-expanded={open}
                    aria-controls={listId}
                    aria-autocomplete="list"
                    aria-activedescendant={open && highlightIdx >= 0 ? `${listId}-${highlightIdx}` : undefined}
                    onFocus={openMenu}
                    onClick={openMenu}
                    onChange={(e) => {
                        let next = e.target.value;
                        if (!open) {
                            // Closed, the field shows the selected label: keep only what was typed.
                            const label = shownLabel;
                            if (label && next.startsWith(label)) next = next.slice(label.length);
                            else if (label && label.startsWith(next)) next = '';
                            setOpen(true);
                        }
                        setQuery(next);
                        setHighlightIdx(0);
                    }}
                    onKeyDown={onKeyDown}
                />
                {showClear ? (
                    <button
                        type="button"
                        className="ss-combo__clear"
                        tabIndex={-1}
                        aria-label={clearText}
                        title={clearText}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => {
                            e.stopPropagation();
                            onChange?.(clearValue, null);
                            close();
                        }}
                    >
                        <X size={13} />
                    </button>
                ) : (
                    <ChevronsUpDown size={15} aria-hidden className="ss-combo__icon" />
                )}
            </div>
            {required ? (
                <input
                    className="ss-combo__required-proxy"
                    tabIndex={-1}
                    aria-hidden="true"
                    required
                    value={value ?? ''}
                    onChange={() => {}}
                    onFocus={() => inputRef.current?.focus()}
                />
            ) : null}
            {name ? <input type="hidden" name={name} value={value ?? ''} /> : null}
            {open && menuStyle
                ? createPortal(
                      <ul
                          ref={menuRef}
                          id={listId}
                          className="sf-entity-dropdown-portal ms-combo__menu ss-combo__menu"
                          style={menuStyle}
                          role="listbox"
                          onMouseDown={(e) => e.preventDefault()}
                      >
                          {loading && options.length === 0 ? (
                              <li className="ms-combo__empty">{loadingText}</li>
                          ) : filtered.length === 0 ? (
                              <li className="ms-combo__empty">{emptyText}</li>
                          ) : (
                              visible.map((o, idx) => {
                                  const on = selected != null && String(o.value) === String(selected.value);
                                  return (
                                      <li key={String(o.value)}>
                                          <button
                                              type="button"
                                              id={`${listId}-${idx}`}
                                              role="option"
                                              tabIndex={-1}
                                              data-ss-idx={idx}
                                              aria-selected={on}
                                              aria-disabled={o.disabled || undefined}
                                              disabled={o.disabled}
                                              className={[
                                                  'ms-combo__opt',
                                                  on ? 'ms-combo__opt--on' : '',
                                                  idx === highlightIdx && !o.disabled ? 'ms-combo__opt--hi' : '',
                                                  o.disabled ? 'ss-combo__opt--disabled' : '',
                                              ]
                                                  .filter(Boolean)
                                                  .join(' ')}
                                              onMouseEnter={() => !o.disabled && setHighlightIdx(idx)}
                                              onClick={() => pick(o)}
                                          >
                                              <span className="ms-combo__opt-copy">
                                                  <span className="ms-combo__opt-label">{o.label}</span>
                                                  {o.hint ? <span className="ms-combo__opt-hint">{o.hint}</span> : null}
                                              </span>
                                              {on ? <Check size={14} className="ss-combo__tick" aria-hidden /> : null}
                                          </button>
                                      </li>
                                  );
                              })
                          )}
                          {filtered.length > visible.length && moreText ? (
                              <li className="ms-combo__empty">{moreText}</li>
                          ) : null}
                      </ul>,
                      document.body,
                  )
                : null}
        </div>
    );
}
