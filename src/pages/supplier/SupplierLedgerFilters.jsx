import React, { useEffect, useMemo, useState } from 'react';
import SearchableEntityCombobox from '../../components/SearchableEntityCombobox';
import { toRiyadhDateISO } from '../../utils/riyadhBusinessRange';
import './supplierLedgerFilters.css';

/**
 * Shared filter bar + totals for the supplier Sales Invoices and Purchase Invoices lists.
 * Dates are Asia/Riyadh business days. Every number comes from the server for the WHOLE
 * filtered range (not just the visible page).
 */

export const sarFmt = (n) =>
    (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const pad = (n) => String(n).padStart(2, '0');
const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

/** Quick ranges on the Riyadh calendar. */
export function quickRange(kind) {
    const today = toRiyadhDateISO();
    const [y, m] = today.split('-').map(Number);
    if (kind === 'today') return { dateFrom: today, dateTo: today };
    if (kind === 'month') return { dateFrom: ymd(y, m, 1), dateTo: today };
    if (kind === 'lastMonth') {
        const ly = m === 1 ? y - 1 : y;
        const lm = m === 1 ? 12 : m - 1;
        const last = new Date(Date.UTC(ly, lm, 0)).getUTCDate();
        return { dateFrom: ymd(ly, lm, 1), dateTo: ymd(ly, lm, last) };
    }
    if (kind === 'year') return { dateFrom: ymd(y, 1, 1), dateTo: today };
    return { dateFrom: '', dateTo: '' };
}

const QUICK = ['today', 'month', 'lastMonth', 'year', 'all'];

function activeQuick(f) {
    for (const k of QUICK) {
        const r = quickRange(k);
        if ((f.dateFrom || '') === r.dateFrom && (f.dateTo || '') === r.dateTo) return k;
    }
    return '';
}

/**
 * props:
 *   t(key, vars), value { dateFrom, dateTo, party, search }, onChange(next)
 *   parties [{ key, label, sub, amount }], partyLabel, partyPlaceholder, searchPlaceholder
 */
export function LedgerFilterBar({ t, value, onChange, parties = [], loading, partyLabel, partyPlaceholder, searchPlaceholder }) {
    const [draftSearch, setDraftSearch] = useState(value.search || '');
    const [partyText, setPartyText] = useState('');
    useEffect(() => setDraftSearch(value.search || ''), [value.search]);
    const options = useMemo(
        () =>
            parties.map((p) => ({
                id: p.key,
                label: p.label,
                subtitle: [p.sub, p.amountLabel].filter(Boolean).join('\n') || null,
                searchTokens: [p.label, p.sub].filter(Boolean),
            })),
        [parties],
    );
    const selected = parties.find((p) => p.key === value.party) || null;
    useEffect(() => {
        setPartyText(selected ? selected.label : '');
    }, [selected?.key]); // eslint-disable-line react-hooks/exhaustive-deps
    const badRange = value.dateFrom && value.dateTo && value.dateFrom > value.dateTo;
    const quick = activeQuick(value);
    const set = (patch) => onChange({ ...value, ...patch });

    return (
        <div className="slf-bar">
            <div className="slf-quick" role="group" aria-label={t('lf.quick')}>
                {QUICK.map((k) => (
                    <button
                        key={k}
                        type="button"
                        className={`slf-chip${quick === k ? ' slf-chip--on' : ''}`}
                        onClick={() => set(quickRange(k))}
                    >
                        {t(`lf.q.${k}`)}
                    </button>
                ))}
            </div>
            <div className="slf-row">
                <label className="slf-field">
                    <span>{t('lf.from')}</span>
                    <input type="date" value={value.dateFrom || ''} max={value.dateTo || undefined} onChange={(e) => set({ dateFrom: e.target.value })} />
                </label>
                <label className="slf-field">
                    <span>{t('lf.to')}</span>
                    <input type="date" value={value.dateTo || ''} min={value.dateFrom || undefined} onChange={(e) => set({ dateTo: e.target.value })} />
                </label>
                <div className="slf-field slf-field--grow">
                    <span>{partyLabel}</span>
                    <SearchableEntityCombobox
                        className="slf-combo"
                        menuMinWidth={420}
                        options={options}
                        value={value.party || ''}
                        displayText={partyText}
                        entityLabel="party"
                        loading={loading}
                        placeholder={partyPlaceholder}
                        emptyHint={t('lf.noParty')}
                        onDisplayTextChange={(text) => {
                            setPartyText(text);
                            if (!text.trim() && value.party) set({ party: '' });
                        }}
                        onSelect={(opt) => {
                            setPartyText(opt.label || '');
                            set({ party: String(opt.id) });
                        }}
                        onClear={() => {
                            setPartyText('');
                            set({ party: '' });
                        }}
                        clearLabel={t('lf.clear')}
                    />
                </div>
                <label className="slf-field slf-field--grow">
                    <span>{t('lf.search')}</span>
                    <input
                        type="search"
                        value={draftSearch}
                        placeholder={searchPlaceholder}
                        onChange={(e) => setDraftSearch(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') set({ search: draftSearch.trim() });
                        }}
                        onBlur={() => {
                            if ((draftSearch.trim() || '') !== (value.search || '')) set({ search: draftSearch.trim() });
                        }}
                    />
                </label>
                <button
                    type="button"
                    className="slf-reset"
                    onClick={() => onChange({ dateFrom: '', dateTo: '', party: '', search: '', view: value.view ? 'all' : undefined })}
                >
                    {t('lf.reset')}
                </button>
            </div>
            {badRange ? <div className="slf-err">{t('lf.badRange')}</div> : null}
            <div className="slf-scope">
                {value.dateFrom || value.dateTo
                    ? t('lf.scope', { from: value.dateFrom || '…', to: value.dateTo || '…' })
                    : t('lf.scopeAll')}
                {selected ? ` · ${selected.label}${selected.sub ? ` — ${selected.sub}` : ''}` : ''}
                {value.search ? ` · “${value.search}”` : ''}
            </div>
        </div>
    );
}

/** Row of KPI cards. cards: [{ key, label, value, hint, tone }] */
export function LedgerSummaryCards({ cards, loading }) {
    return (
        <div className="slf-cards">
            {cards.map((c) => (
                <div key={c.key} className={`slf-card${c.tone ? ` slf-card--${c.tone}` : ''}`}>
                    <div className="slf-card-label">{c.label}</div>
                    <div className="slf-card-value">{loading ? '…' : c.value}</div>
                    {c.hint ? <div className="slf-card-hint">{loading ? '' : c.hint}</div> : null}
                </div>
            ))}
        </div>
    );
}

/**
 * "Who / how much" table. rows: [{ key, label, sub, count, amount, extra, lastDate }]
 * Clicking a row filters the list to that customer / supplier.
 */
export function LedgerPartyTable({ t, title, rows, selectedKey, onPick, countLabel, amountLabel, extraLabel, collapsedCount = 8 }) {
    const [all, setAll] = useState(false);
    const shown = all ? rows : rows.slice(0, collapsedCount);
    const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
    if (!rows.length) return null;
    return (
        <div className="slf-party">
            <div className="slf-party-head">
                <h3>{title}</h3>
                <span>{t('lf.partyCount', { n: rows.length })}</span>
            </div>
            <div className="slf-party-wrap">
                <table className="slf-party-table">
                    <thead>
                        <tr>
                            <th>{t('lf.th.party')}</th>
                            <th className="num">{countLabel}</th>
                            <th className="num">{amountLabel}</th>
                            {extraLabel ? <th className="num">{extraLabel}</th> : null}
                            <th className="num">{t('lf.th.share')}</th>
                            <th>{t('lf.th.last')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {shown.map((r) => {
                            const share = total > 0 ? (Number(r.amount || 0) / total) * 100 : 0;
                            return (
                                <tr
                                    key={r.key}
                                    className={r.key === selectedKey ? 'is-on' : ''}
                                    tabIndex={0}
                                    onClick={() => onPick(r.key === selectedKey ? '' : r.key)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') onPick(r.key === selectedKey ? '' : r.key);
                                    }}
                                    title={t('lf.pickHint')}
                                >
                                    <td>
                                        <div className="slf-strong">{r.label}</div>
                                        {r.sub ? <div className="slf-muted">{r.sub}</div> : null}
                                    </td>
                                    <td className="num">{r.count}</td>
                                    <td className="num slf-strong">SAR {sarFmt(r.amount)}</td>
                                    {extraLabel ? <td className="num">{r.extra}</td> : null}
                                    <td className="num">
                                        <div className="slf-bar-cell">
                                            <span style={{ width: `${Math.min(100, share).toFixed(1)}%` }} />
                                            <em>{share.toFixed(1)}%</em>
                                        </div>
                                    </td>
                                    <td>{r.lastDate ? r.lastDate.split('-').reverse().join('/') : '—'}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td>{t('lf.total')}</td>
                            <td className="num">{rows.reduce((s, r) => s + Number(r.count || 0), 0)}</td>
                            <td className="num">SAR {sarFmt(total)}</td>
                            {extraLabel ? <td /> : null}
                            <td className="num">100%</td>
                            <td />
                        </tr>
                    </tfoot>
                </table>
            </div>
            {rows.length > collapsedCount ? (
                <button type="button" className="slf-more" onClick={() => setAll((v) => !v)}>
                    {all ? t('lf.showLess') : t('lf.showAll', { n: rows.length })}
                </button>
            ) : null}
        </div>
    );
}

/** Read / write the filter state in the URL so refresh and shared links keep the view. */
export function useLedgerFiltersFromUrl(keys = ['dateFrom', 'dateTo', 'party', 'search', 'view']) {
    const read = () => {
        const p = new URLSearchParams(window.location.search);
        const out = {};
        for (const k of keys) out[k] = p.get(k) || '';
        if (keys.includes('view') && !out.view) out.view = 'all';
        return out;
    };
    const [value, setValue] = useState(read);
    const update = (next) => {
        setValue(next);
        const p = new URLSearchParams(window.location.search);
        for (const k of keys) {
            const v = next[k];
            if (v && !(k === 'view' && v === 'all')) p.set(k, v);
            else p.delete(k);
        }
        const qs = p.toString();
        window.history.replaceState(window.history.state, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
    };
    return [value, update];
}
