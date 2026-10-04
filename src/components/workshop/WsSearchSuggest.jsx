import React, { useEffect, useId, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import './WsStaffPicker.css';

/**
 * Search box for paged tables. Suggestions come from every row (all pages);
 * the top match is highlighted while typing; ↑/↓ move (the list scrolls with the highlight),
 * Enter or a click picks one, Esc keeps the filtered table without picking.
 */
export default function WsSearchSuggest({
    value,
    onChange,
    matches,
    getKey,
    getLabel,
    getMeta,
    onPick,
    onClear,
    placeholder,
    emptyText = 'No matches',
    hint = '↑ ↓ to move, Enter to select, Esc to close',
    countText,
    maxShown = 200,
    picked = false,
    className = '',
}) {
    const [open, setOpen] = useState(false);
    const [highlight, setHighlight] = useState(-1);
    const listRef = useRef(null);
    const closeTimer = useRef(null);
    const listId = useId();

    const shown = matches.slice(0, maxShown);
    const showList = open && !picked && value.trim() !== '';

    useEffect(() => () => window.clearTimeout(closeTimer.current), []);

    useEffect(() => {
        if (!showList || highlight < 0 || !listRef.current) return;
        listRef.current.querySelector(`[data-idx="${highlight}"]`)?.scrollIntoView({ block: 'nearest' });
    }, [showList, highlight]);

    const pick = (item) => {
        onPick(item);
        setOpen(false);
        setHighlight(-1);
    };

    const onKeyDown = (e) => {
        if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && shown.length) {
            e.preventDefault();
            setOpen(true);
            const step = e.key === 'ArrowDown' ? 1 : -1;
            setHighlight((h) => (h < 0 ? (step > 0 ? 0 : shown.length - 1) : (h + step + shown.length) % shown.length));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (showList && highlight >= 0 && shown[highlight]) pick(shown[highlight]);
            else setOpen(false);
        } else if (e.key === 'Escape') {
            setOpen(false);
        }
    };

    return (
        <div className={`ws-staff-picker ws-search-suggest ${className}`.trim()}>
            <Search size={15} className="ws-staff-picker__icon" />
            <input
                type="text"
                className="form-input-field ws-staff-picker__input"
                value={value}
                placeholder={placeholder}
                onChange={(e) => {
                    onChange(e.target.value);
                    setHighlight(e.target.value.trim() ? 0 : -1);
                    setOpen(true);
                }}
                onFocus={() => {
                    window.clearTimeout(closeTimer.current);
                    setOpen(true);
                }}
                onBlur={() => {
                    closeTimer.current = window.setTimeout(() => setOpen(false), 150);
                }}
                onKeyDown={onKeyDown}
                role="combobox"
                aria-expanded={showList}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={showList && highlight >= 0 ? `${listId}-${highlight}` : undefined}
                autoComplete="off"
            />
            {value ? (
                <button
                    type="button"
                    className="ws-staff-picker__clear"
                    aria-label="Clear search"
                    title="Clear search"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                        onClear();
                        setHighlight(-1);
                    }}
                >
                    <X size={13} />
                </button>
            ) : null}
            {showList && (
                <div
                    ref={listRef}
                    className="ws-staff-picker__list"
                    id={listId}
                    role="listbox"
                    onMouseDown={(e) => e.preventDefault()}
                >
                    {shown.length === 0 ? (
                        <div className="ws-staff-picker__empty">
                            {emptyText} “{value.trim()}”
                        </div>
                    ) : (
                        <>
                            {shown.map((item, i) => (
                                <div
                                    key={getKey(item)}
                                    id={`${listId}-${i}`}
                                    data-idx={i}
                                    role="option"
                                    aria-selected={i === highlight}
                                    className={`ws-staff-picker__item${i === highlight ? ' is-active' : ''}`}
                                    onMouseEnter={() => setHighlight(i)}
                                    onClick={() => pick(item)}
                                >
                                    <div className="ws-staff-picker__name">{getLabel(item)}</div>
                                    {getMeta ? <div className="ws-staff-picker__meta">{getMeta(item)}</div> : null}
                                </div>
                            ))}
                            <div className="ws-staff-picker__footer">
                                {countText
                                    ? countText(shown.length, matches.length)
                                    : matches.length > shown.length
                                      ? `${shown.length} of ${matches.length} shown`
                                      : `${matches.length} match${matches.length === 1 ? '' : 'es'}`}
                                {` · ${hint}`}
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
