import React from 'react';
import { AlertTriangle, CheckCircle2, RotateCcw } from 'lucide-react';
import { startOfMonthISO, todayISO } from '../../accounting/SupplierAccountingShared';
import { useSfT } from '../useSfT';
import '../../../../styles/ui.css';

/**
 * The pieces every brand financial report is built from. Each root carries
 * `ui-tokens` of its own: these render inside whatever screen imports them,
 * and without an ancestor declaring the variables every `var(--ui-*)` would
 * resolve to nothing and take its whole declaration with it. They live here rather
 * than in each report so the three statements agree on where the dates sit,
 * what a failure looks like, and how a balanced book is announced.
 */

/** Period filters for the trial balance and the income statement. */
export function StorageBrandReportDateRange({ dateFrom, dateTo, onChange }) {
    const t = useSfT();
    return (
        <div className="ui-row ui-row--fields ui-tokens">
            <div className="ui-field">
                <label htmlFor="sf-rep-from">{t('acct.from')}</label>
                <input
                    id="sf-rep-from"
                    type="date"
                    className="ui-input"
                    value={dateFrom}
                    onChange={(e) => onChange({ dateFrom: e.target.value, dateTo })}
                />
            </div>
            <div className="ui-field">
                <label htmlFor="sf-rep-to">{t('acct.to')}</label>
                <input
                    id="sf-rep-to"
                    type="date"
                    className="ui-input"
                    value={dateTo}
                    onChange={(e) => onChange({ dateFrom, dateTo: e.target.value })}
                />
            </div>
            <div className="ui-toolbar-end">
                <button
                    type="button"
                    className="ui-btn ui-btn--default ui-btn--sm"
                    onClick={() => onChange({ dateFrom: '', dateTo: '' })}
                >
                    {t('acct.allTime')}
                </button>
                <button
                    type="button"
                    className="ui-btn ui-btn--default ui-btn--sm"
                    onClick={() => onChange({ dateFrom: startOfMonthISO(), dateTo: todayISO() })}
                >
                    {t('acct.thisMonth')}
                </button>
            </div>
        </div>
    );
}

/** A single as-of date, for the balance sheet. */
export function StorageBrandReportAsOf({ asOf, onChange }) {
    const t = useSfT();
    return (
        <div className="ui-row ui-row--fields ui-tokens">
            <div className="ui-field">
                <label htmlFor="sf-rep-asof">{t('acct.asOf')}</label>
                <input
                    id="sf-rep-asof"
                    type="date"
                    className="ui-input"
                    value={asOf}
                    onChange={(e) => onChange(e.target.value)}
                />
            </div>
        </div>
    );
}

/** Whether the statement ties out. Worth a banner, not a footnote. */
export function StorageBrandReportStatus({ ok, okLabel, badLabel }) {
    return (
        <div className={`ui-banner ui-banner--${ok ? 'ok' : 'warn'} ui-tokens`}>
            {ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
            <span>{ok ? okLabel : badLabel}</span>
        </div>
    );
}

/** A report that could not be fetched, with the way back. */
export function StorageBrandReportError({ title, onRetry }) {
    const t = useSfT();
    return (
        <div className="ui-empty ui-tokens">
            <div className="ui-empty-icon"><AlertTriangle size={18} /></div>
            <div className="ui-empty-title">{title}</div>
            <div className="ui-empty-sub">{t('acct.errSub')}</div>
            <button type="button" className="ui-btn ui-btn--default ui-btn--sm" onClick={onRetry}>
                <RotateCcw size={13} /> {t('acct.retry')}
            </button>
        </div>
    );
}

/**
 * One block of a statement — Revenue, Assets, Equity — as account lines above
 * their total. The total label is passed in whole rather than built from the
 * heading: "Total " + title only reads as English.
 */
export function StorageBrandStatementSection({ title, rows, totalLabel, total, emptyLabel, money }) {
    return (
        <section className="ui-panel ui-tokens">
            <div className="ui-panel-head">
                <span className="ui-panel-title">{title}</span>
            </div>
            <div className="ui-panel-pad">
                {rows.length === 0 ? (
                    <p className="ui-meta">{emptyLabel}</p>
                ) : (
                    <div className="ui-sum">
                        {rows.map((r) => (
                            <div key={r.id} className="ui-sum-row">
                                <span>
                                    <span className="ui-meta-ref">{r.code}</span> {r.name}
                                </span>
                                <span>{money(r.amount)}</span>
                            </div>
                        ))}
                    </div>
                )}
                <div className="ui-sum">
                    <div className="ui-sum-sep" />
                    <div className="ui-sum-row ui-sum-row--total">
                        <span>{totalLabel}</span>
                        <span>{money(total)}</span>
                    </div>
                </div>
            </div>
        </section>
    );
}

/** The skeleton of a statement: a few lines and a total. */
export function StorageBrandReportSkeleton({ sections = 2, lines = 4 }) {
    return (
        <div className="ui-stack ui-tokens" aria-busy="true">
            {Array.from({ length: sections }).map((_, s) => (
                <div key={`sk-sec-${s}`} className="ui-panel">
                    <div className="ui-panel-head">
                        <div className="ui-sk ui-sk--strong ui-sk--w25" />
                    </div>
                    <div className="ui-panel-pad">
                        {Array.from({ length: lines }).map((_, i) => (
                            <div key={`sk-ln-${i}`} className="ui-sum-row ui-sk-row">
                                <div className="ui-sk ui-sk--text ui-sk--w55" />
                                <div className="ui-sk ui-sk--text ui-sk--w25" />
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
