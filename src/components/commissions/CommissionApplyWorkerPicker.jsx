import React, { useEffect, useMemo, useRef, useState } from 'react';
import { searchWorkshopCommissionRuleWorkers } from '../../services/workshopCommissionsApi';
import { commissionRoleLabel } from './commissionRuleApplyModel';
import {
    formatSelectedWorkerCount,
    presentApplyServerError,
    nextWorkerListGeneration,
    readCommissionWorkerPage,
    selectAllShownWorkers,
    shouldCloseOnFocusLeave,
    shouldCloseOnOutside,
    toggleWorkerSelection,
    workerListResponseIsCurrent,
    workerSearchParams,
} from './commissionApplyWorkers';

const SEARCH_DEBOUNCE_MS = 300;

/**
 * Searchable multi-select for one rule's workers.
 * A rule has one employeeRole, so ids share one id space and are keyed by id.
 * Empty selection means every worker the rule affects.
 */
export default function CommissionApplyWorkerPicker({
    ruleId,
    workshopId = '',
    t,
    selected = [],
    disabled = false,
    onChange,
}) {
    const [query, setQuery] = useState('');
    const [debounced, setDebounced] = useState('');
    const [rows, setRows] = useState([]);
    const [nextOffset, setNextOffset] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [capNotice, setCapNotice] = useState('');
    const [open, setOpen] = useState(false);
    const [highlight, setHighlight] = useState(0);
    const abortRef = useRef(null);
    const generationRef = useRef(0);
    const comboRef = useRef(null);
    const selectedIds = useMemo(() => selected.map((worker) => worker.id), [selected]);
    const labelId = `cx-workers-label-${ruleId}`;
    const listId = `cx-workers-list-${ruleId}`;
    const activeId = open && rows[highlight] ? `${listId}-opt-${rows[highlight].id}` : undefined;

    useEffect(() => {
        const id = window.setTimeout(() => setDebounced(query.trim()), SEARCH_DEBOUNCE_MS);
        return () => window.clearTimeout(id);
    }, [query]);

    useEffect(() => {
        if (disabled) setOpen(false);
    }, [disabled]);

    useEffect(() => {
        if (!open) return undefined;
        const onDoc = (event) => {
            // Label, hint, and chips sit outside comboRef, so a click there closes.
            // The tools row stays inside, so Select all / Clear / Load more do not.
            if (!shouldCloseOnOutside(comboRef.current, event.target)) return;
            setOpen(false);
        };
        document.addEventListener('pointerdown', onDoc);
        return () => document.removeEventListener('pointerdown', onDoc);
    }, [open]);

    useEffect(() => {
        if (!ruleId) return undefined;
        const request = nextWorkerListGeneration(generationRef.current, 'search');
        generationRef.current = request.generation;
        const generation = request.generation;
        const controller = new AbortController();
        abortRef.current?.abort();
        abortRef.current = controller;
        setRows([]);
        setNextOffset(null);
        setLoading(true);
        setLoadingMore(request.loadingMore);
        setLoadError('');
        (async () => {
            try {
                const page = readCommissionWorkerPage(await searchWorkshopCommissionRuleWorkers(
                    ruleId,
                    workerSearchParams({ q: debounced, offset: 0, workshopId }),
                    { signal: controller.signal },
                ));
                if (!workerListResponseIsCurrent(generationRef.current, generation) || controller.signal.aborted) return;
                setRows(page.workers);
                setNextOffset(page.nextOffset);
                setHighlight(0);
            } catch (err) {
                if (!workerListResponseIsCurrent(generationRef.current, generation) || controller.signal.aborted || err?.name === 'AbortError') return;
                setRows([]);
                setNextOffset(null);
                setLoadError(presentApplyServerError(err, t, t('apply.workersError')));
            } finally {
                if (workerListResponseIsCurrent(generationRef.current, generation) && !controller.signal.aborted) {
                    setLoading(false);
                }
            }
        })();
        return () => {
            abortRef.current?.abort();
        };
    }, [ruleId, workshopId, debounced, t]);

    useEffect(() => {
        setHighlight((index) => {
            if (!rows.length) return 0;
            return Math.min(index, rows.length - 1);
        });
    }, [rows]);

    const remember = (ids, capped) => {
        if (disabled) return;
        const byId = new Map();
        for (const worker of selected) byId.set(worker.id, worker);
        for (const worker of rows) byId.set(worker.id, worker);
        setCapNotice(capped ? t('apply.workersCap') : '');
        onChange?.(ids.map((id) => byId.get(id)).filter(Boolean));
    };

    const onToggle = (worker) => {
        if (disabled || !worker) return;
        const result = toggleWorkerSelection(selectedIds, worker.id);
        remember(result.ids, result.capped);
    };

    const onSelectShown = () => {
        if (disabled) return;
        const result = selectAllShownWorkers(selectedIds, rows);
        remember(result.ids, result.capped);
    };

    const onClear = () => {
        if (disabled) return;
        setCapNotice('');
        onChange?.([]);
    };

    const loadMore = async () => {
        if (disabled || nextOffset == null || loadingMore || !ruleId) return;
        const request = nextWorkerListGeneration(generationRef.current, 'more');
        const generation = request.generation;
        const controller = new AbortController();
        abortRef.current?.abort();
        abortRef.current = controller;
        setLoadingMore(true);
        setLoadError('');
        try {
            const page = readCommissionWorkerPage(await searchWorkshopCommissionRuleWorkers(
                ruleId,
                workerSearchParams({ q: debounced, offset: nextOffset, workshopId }),
                { signal: controller.signal },
            ));
            if (!workerListResponseIsCurrent(generationRef.current, generation) || controller.signal.aborted) return;
            setRows((current) => {
                const seen = new Set(current.map((worker) => worker.id));
                const extra = page.workers.filter((worker) => !seen.has(worker.id));
                return [...current, ...extra];
            });
            setNextOffset(page.nextOffset);
        } catch (err) {
            if (!workerListResponseIsCurrent(generationRef.current, generation) || controller.signal.aborted || err?.name === 'AbortError') return;
            setLoadError(presentApplyServerError(err, t, t('apply.workersError')));
        } finally {
            if (workerListResponseIsCurrent(generationRef.current, generation) && !controller.signal.aborted) {
                setLoadingMore(false);
            }
        }
    };

    const onKeyDown = (event) => {
        if (disabled) return;
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (!open) setOpen(true);
            setHighlight((index) => {
                if (!rows.length) return 0;
                if (!open) return 0;
                const next = event.key === 'ArrowDown' ? index + 1 : index - 1;
                return Math.max(0, Math.min(rows.length - 1, next));
            });
            return;
        }
        if (event.key === 'Escape') {
            if (!open) return;
            event.preventDefault();
            setOpen(false);
            return;
        }
        const toggleKey = event.key === 'Enter' || (event.key === ' ' && query.trim() === '');
        if (toggleKey && open && rows[highlight]) {
            event.preventDefault();
            onToggle(rows[highlight]);
        }
    };

    const onComboBlur = (event) => {
        // Null relatedTarget stays open: an option row is not focusable, and its
        // mousedown preventDefault must not dismiss the list between selections.
        if (!shouldCloseOnFocusLeave(comboRef.current, event.relatedTarget)) return;
        setOpen(false);
    };

    return (
        <div className="cx-workers">
            <span className="cx-workers__label" id={labelId}>{t('apply.workers')}</span>
            {selected.length === 0 ? (
                <span className="cx-workers__badge">{t('apply.workersAll')}</span>
            ) : (
                <span className="cx-workers__badge">{formatSelectedWorkerCount(selected.length, t)}</span>
            )}
            <p className="cx-workers__hint">{t('apply.workersHint')}</p>
            {selected.length > 0 ? (
                <ul className="cx-workers__chips">
                    {selected.map((worker) => (
                        <li key={worker.id} className="cx-workers__chip">
                            <span>{worker.name || worker.id}</span>
                            <button
                                type="button"
                                disabled={disabled}
                                aria-label={t('apply.workersRemove', { name: worker.name || worker.id })}
                                onClick={() => onToggle(worker)}
                            >
                                ×
                            </button>
                        </li>
                    ))}
                </ul>
            ) : null}
            <div className="cx-workers__combo" ref={comboRef} onBlur={onComboBlur}>
                <input
                    className="cx-workers__search"
                    type="search"
                    role="combobox"
                    aria-expanded={open}
                    aria-controls={listId}
                    aria-autocomplete="list"
                    aria-activedescendant={activeId}
                    aria-labelledby={labelId}
                    disabled={disabled}
                    maxLength={80}
                    value={query}
                    placeholder={t('apply.workersSearch')}
                    onFocus={() => { if (!disabled) setOpen(true); }}
                    onClick={() => { if (!disabled) setOpen(true); }}
                    onKeyDown={onKeyDown}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        if (!disabled) setOpen(true);
                    }}
                />
                {open ? (
                    <div
                        className="cx-workers__list"
                        id={listId}
                        role="listbox"
                        aria-multiselectable="true"
                        aria-labelledby={labelId}
                    >
                        {loading ? <p className="cx-workers__status">{t('apply.workersLoading')}</p> : null}
                        {!loading && rows.length === 0 ? (
                            <p className="cx-workers__status">{t('apply.workersEmpty')}</p>
                        ) : null}
                        {rows.map((worker, index) => {
                            const checked = selectedIds.includes(worker.id);
                            const role = commissionRoleLabel(worker.role, t);
                            return (
                                <div
                                    key={worker.id}
                                    id={`${listId}-opt-${worker.id}`}
                                    role="option"
                                    aria-selected={checked}
                                    className={`cx-workers__row${index === highlight ? ' is-active' : ''}`}
                                    onMouseEnter={() => setHighlight(index)}
                                    onMouseDown={(event) => {
                                        event.preventDefault();
                                        onToggle(worker);
                                    }}
                                >
                                    <span className="cx-workers__check" aria-hidden>{checked ? '✓' : ''}</span>
                                    <span>
                                        <span>{worker.name || t('emDash')}</span>
                                        <span className="cx-workers__meta">
                                            {role || t('emDash')}
                                            {' · '}
                                            {worker.branch || t('emDash')}
                                        </span>
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                ) : null}
                <div className="cx-workers__tools">
                    <button type="button" onClick={onSelectShown} disabled={disabled || !open || loading || rows.length === 0}>
                        {t('apply.workersSelectShown')}
                    </button>
                    <button type="button" onClick={onClear} disabled={disabled || selected.length === 0}>
                        {t('apply.workersClear')}
                    </button>
                    {open && nextOffset != null ? (
                        <button type="button" onClick={loadMore} disabled={disabled || loading || loadingMore}>
                            {loadingMore ? t('apply.workersLoading') : t('apply.workersLoadMore')}
                        </button>
                    ) : null}
                </div>
            </div>
            {capNotice ? <p className="cx-workers__cap">{capNotice}</p> : null}
            {loadError ? <p className="cx-workers__status cx-workers__status--err">{loadError}</p> : null}
        </div>
    );
}
