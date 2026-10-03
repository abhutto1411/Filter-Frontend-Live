import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import './WsStaffPicker.css';

/**
 * Searchable staff combobox: type any part of a name, phone, role, branch…,
 * move with ↑/↓, pick with Enter or a click. Every match is listed (scrolls).
 */
export default function WsStaffPicker({
    options,
    value,
    onChange,
    getKey,
    getLabel,
    getMeta,
    getSearchText,
    disabledKeys,
    disabledHint = 'Already added',
    placeholder = 'Search name, phone, role or branch…',
    emptyText = 'No staff match',
    disabled = false,
    countText = (matched, total, searching) => (searching ? `${matched} of ${total} match` : `${total} staff`),
    hint = '↑ ↓ to move, Enter to select, Esc to close',
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [highlight, setHighlight] = useState(-1);
    const inputRef = useRef(null);
    const listRef = useRef(null);
    const closeTimer = useRef(null);
    const listId = useId();

    useEffect(() => () => window.clearTimeout(closeTimer.current), []);

    const index = useMemo(
        () =>
            options.map((o) => ({
                o,
                key: getKey(o),
                name: String(getLabel(o) || '').toLowerCase(),
                hay: String(getSearchText(o) || '').toLowerCase(),
            })),
        [options, getKey, getLabel, getSearchText],
    );

    /** Every word must match somewhere; names starting with the query come first. */
    const matches = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return index;
        const words = q.split(/\s+/).filter(Boolean);
        const rank = (x) => (x.name.startsWith(q) ? 0 : x.name.includes(q) ? 1 : 2);
        return index
            .filter((x) => words.every((w) => x.hay.includes(w)))
            .sort((a, b) => rank(a) - rank(b));
    }, [index, query]);

    const selected = useMemo(() => index.find((x) => x.key === value) || null, [index, value]);
    const isDisabled = (x) => Boolean(disabledKeys?.has(x.key)) && x.key !== value;

    useEffect(() => {
        if (!open || highlight < 0 || !listRef.current) return;
        listRef.current
            .querySelector(`[data-idx="${highlight}"]`)
            ?.scrollIntoView({ block: 'nearest' });
    }, [open, highlight]);

    const nextEnabled = (from, step) => {
        const len = matches.length;
        let i = from < 0 ? (step > 0 ? -1 : 0) : from;
        for (let n = 0; n < len; n += 1) {
            i = (i + step + len) % len;
            if (!isDisabled(matches[i])) return i;
        }
        return -1;
    };

    const openList = () => {
        window.clearTimeout(closeTimer.current);
        if (open) return;
        setOpen(true);
        setQuery('');
        const at = selected ? index.indexOf(selected) : -1;
        setHighlight(at);
    };

    const close = () => {
        setOpen(false);
        setQuery('');
        setHighlight(-1);
    };

    const pick = (x) => {
        if (!x || isDisabled(x)) return;
        onChange(x.key, x.o);
        close();
    };

    const onKeyDown = (e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (!open) {
                openList();
                return;
            }
            if (matches.length) setHighlight((h) => nextEnabled(h, e.key === 'ArrowDown' ? 1 : -1));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (!open) openList();
            else if (highlight >= 0) {
                const x = matches[highlight];
                pick(x && isDisabled(x) ? matches[nextEnabled(highlight, 1)] : x);
            }
        } else if (e.key === 'Escape') {
            if (open) {
                e.preventDefault();
                close();
            }
        } else if (e.key === 'Tab') {
            close();
        }
    };

    const shownText = open ? query : selected ? getLabel(selected.o) : '';

    return (
        <div className={`ws-staff-picker${disabled ? ' is-disabled' : ''}`}>
            <Search size={15} className="ws-staff-picker__icon" />
            <input
                ref={inputRef}
                type="text"
                className="form-input-field ws-staff-picker__input"
                value={shownText}
                disabled={disabled}
                placeholder={selected && open ? getLabel(selected.o) : placeholder}
                title={selected ? `${getLabel(selected.o)} — ${getMeta(selected.o)}` : undefined}
                onChange={(e) => {
                    if (!open) setOpen(true);
                    setQuery(e.target.value);
                    setHighlight(e.target.value.trim() ? 0 : -1);
                }}
                onFocus={openList}
                onClick={openList}
                onBlur={() => {
                    closeTimer.current = window.setTimeout(close, 150);
                }}
                onKeyDown={onKeyDown}
                role="combobox"
                aria-expanded={open}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={open && highlight >= 0 ? `${listId}-${highlight}` : undefined}
                autoComplete="off"
            />
            {value && !disabled ? (
                <button
                    type="button"
                    className="ws-staff-picker__clear"
                    aria-label="Clear selection"
                    title="Clear selection"
                    tabIndex={-1}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                        onChange('', null);
                        close();
                        inputRef.current?.focus();
                    }}
                >
                    <X size={13} />
                </button>
            ) : (
                <ChevronDown size={15} className="ws-staff-picker__chevron" />
            )}
            {open && (
                <div
                    ref={listRef}
                    className="ws-staff-picker__list"
                    id={listId}
                    role="listbox"
                    onMouseDown={(e) => e.preventDefault()}
                >
                    {matches.length === 0 ? (
                        <div className="ws-staff-picker__empty">
                            {emptyText}
                            {query.trim() ? ` “${query.trim()}”` : ''}
                        </div>
                    ) : (
                        matches.map((x, i) => {
                            const off = isDisabled(x);
                            return (
                                <div
                                    key={x.key}
                                    id={`${listId}-${i}`}
                                    data-idx={i}
                                    role="option"
                                    aria-selected={x.key === value}
                                    aria-disabled={off || undefined}
                                    className={[
                                        'ws-staff-picker__item',
                                        i === highlight && !off ? 'is-active' : '',
                                        x.key === value ? 'is-selected' : '',
                                        off ? 'is-off' : '',
                                    ].filter(Boolean).join(' ')}
                                    onMouseEnter={() => !off && setHighlight(i)}
                                    onClick={() => pick(x)}
                                >
                                    <div className="ws-staff-picker__name">{getLabel(x.o)}</div>
                                    <div className="ws-staff-picker__meta">
                                        {getMeta(x.o)}
                                        {off ? ` · ${disabledHint}` : ''}
                                    </div>
                                </div>
                            );
                        })
                    )}
                    {matches.length > 0 ? (
                        <div className="ws-staff-picker__footer">
                            {countText(matches.length, options.length, Boolean(query.trim()))}
                            {` · ${hint}`}
                        </div>
                    ) : null}
                </div>
            )}
        </div>
    );
}
