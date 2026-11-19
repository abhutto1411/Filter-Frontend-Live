import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import {
    AlertTriangle,
    Book,
    CheckCircle,
    Columns3,
    Printer,
    RefreshCw,
    RotateCcw,
} from 'lucide-react';
import { PaginationControls } from '../../../components/PaginationControls';
import SupplierAccountingCombobox from '../../supplier/accounting/SupplierAccountingCombobox';
import WsTableScroll from '../../../components/workshop/WsTableScroll';
import { useAuth } from '../../../context/AuthContext';
import { useHqAdminBooksScope } from '../../../hooks/useHqAdminBooksScope';
import {
    getJournalEntry as getAcctJournalEntry,
    listJournalEntries as listAcctJournalEntries,
    reverseJournalEntry,
    voidJournalEntry,
} from '../../../services/workshopAccountingApi';
import { accT } from '../../../utils/accountingI18n';
import { escapeHtml, printReportHtml } from '../../../utils/accountingReportDisplay';
import {
    JOURNAL_PAGE_SIZE,
    JOURNAL_SOURCE_OPTIONS,
    canShowReverse,
    canShowVoid,
    formatSarDisplay,
    formatWesternInt,
    formatWesternMoney,
    fmtBusinessYmd,
    isAccountingAdminActor,
    isForbiddenError,
    journalAmountValue,
    journalCardsFromSummary,
    journalSourceValue,
    journalTags,
    messageFromJournalError,
    showingRange,
    statusChipKind,
} from '../../../utils/journalAuditDisplay';
import { toRiyadhDateISO } from '../../../utils/riyadhBusinessRange';
import JournalReversePanel from './JournalReversePanel';
import '../../../styles/admin/AccountingPage.css';

const ALL_BRANCH = '';

function chipClass(kind) {
    if (kind === 'bad') return 'gj-chip gj-chip--bad';
    if (kind === 'warn') return 'gj-chip gj-chip--warn';
    if (kind === 'info') return 'gj-chip gj-chip--info';
    return 'gj-chip gj-chip--ok';
}

export default function WorkshopGeneralJournalPage({
    locale: localeProp,
    branches = [],
    selectedBranchId = 'all',
}) {
    const { isAdminHqBooks } = useHqAdminBooksScope();
    const { user, hasPermission } = useAuth();
    const outletCtx = useOutletContext() || {};
    const locale =
        localeProp ||
        outletCtx.locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => accT(locale, key, vars), [locale]);

    const canAdmin = isAccountingAdminActor(user)
        || hasPermission('workshop.accounting.journal-entries.approve');

    const defaultBranch = selectedBranchId && selectedBranchId !== 'all'
        ? String(selectedBranchId)
        : ALL_BRANCH;

    const emptyFilters = useMemo(
        () => ({ q: '', type: '', branchId: defaultBranch, dateFrom: '', dateTo: '' }),
        [defaultBranch],
    );
    const [draft, setDraft] = useState(emptyFilters);
    const [applied, setApplied] = useState(emptyFilters);
    const [offset, setOffset] = useState(0);
    const [entries, setEntries] = useState([]);
    const [total, setTotal] = useState(0);
    const [summary, setSummary] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [forbidden, setForbidden] = useState(false);
    const [moreCols, setMoreCols] = useState(false);
    const [searchParams] = useSearchParams();
    const [selectedId, setSelectedId] = useState('');
    const [detail, setDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState('');
    const [reverseOpen, setReverseOpen] = useState(false);
    const [voidOpen, setVoidOpen] = useState(false);
    const [actionBusy, setActionBusy] = useState(false);
    const [actionError, setActionError] = useState('');
    const [actionOk, setActionOk] = useState('');
    const reloadSeq = useRef(0);

    useEffect(() => {
        const fromUrl = String(searchParams.get('journal') || '').trim();
        if (fromUrl) setSelectedId(fromUrl);
    }, [searchParams]);

    useEffect(() => {
        setDraft((d) => ({ ...d, branchId: defaultBranch }));
        setApplied((a) => ({ ...a, branchId: defaultBranch }));
        setOffset(0);
    }, [defaultBranch]);

    const reload = useCallback(async () => {
        const seq = ++reloadSeq.current;
        setLoading(true);
        setError('');
        setForbidden(false);
        try {
            const params = {
                limit: JOURNAL_PAGE_SIZE,
                offset,
            };
            if (applied.q.trim()) params.q = applied.q.trim();
            if (applied.type) params.type = applied.type;
            if (applied.dateFrom) params.dateFrom = applied.dateFrom;
            if (applied.dateTo) params.dateTo = applied.dateTo;
            if (!isAdminHqBooks && applied.branchId) params.branchId = applied.branchId;
            const res = await listAcctJournalEntries(params);
            if (seq !== reloadSeq.current) return;
            setTotal(Number(res?.total ?? res?.summary?.totalEntries ?? 0));
            setEntries(Array.isArray(res?.entries) ? res.entries : []);
            setSummary(res?.summary && typeof res.summary === 'object' ? res.summary : {});
        } catch (e) {
            if (seq !== reloadSeq.current) return;
            if (isForbiddenError(e)) {
                setForbidden(true);
                setError(t('gj.noPermission'));
            } else {
                const mapped = messageFromJournalError(e, 'gj.loadFailed');
                setError(mapped.fallbackMessage || t(mapped.key, mapped.vars));
            }
            setEntries([]);
            setTotal(0);
            setSummary({});
        } finally {
            if (seq === reloadSeq.current) setLoading(false);
        }
    }, [applied, isAdminHqBooks, offset, t]);

    useEffect(() => { reload(); }, [reload]);

    const cards = useMemo(() => journalCardsFromSummary(summary), [summary]);
    const range = showingRange(total, JOURNAL_PAGE_SIZE, offset);

    const sourceOptions = useMemo(
        () => JOURNAL_SOURCE_OPTIONS.map((o) => ({ id: o.id, label: t(o.labelKey) })),
        [t],
    );
    const branchOptions = useMemo(() => {
        const rows = (branches || [])
            .map((b) => ({ id: String(b.id), label: b.name || b.code || String(b.id) }))
            .filter((b) => b.id && b.id !== 'all');
        return [{ id: ALL_BRANCH, label: t('gj.allBranches') }, ...rows];
    }, [branches, t]);

    useEffect(() => {
        if (!selectedId) {
            setDetail(null);
            setDetailError('');
            return undefined;
        }
        let cancelled = false;
        setDetailLoading(true);
        setDetailError('');
        getAcctJournalEntry(selectedId)
            .then((res) => {
                if (cancelled) return;
                setDetail(res?.entry || null);
            })
            .catch((e) => {
                if (cancelled) return;
                const mapped = messageFromJournalError(e, 'gj.loadFailed');
                setDetailError(isForbiddenError(e) ? t('gj.noPermission') : (mapped.fallbackMessage || t(mapped.key, mapped.vars)));
                const fallback = entries.find((r) => String(r.id) === String(selectedId));
                setDetail(fallback || null);
            })
            .finally(() => {
                if (!cancelled) setDetailLoading(false);
            });
        return () => { cancelled = true; };
    }, [selectedId, entries, t]);

    useEffect(() => {
        const onKey = (e) => {
            if (e.key !== 'Escape') return;
            if (reverseOpen) {
                setReverseOpen(false);
                return;
            }
            if (voidOpen) {
                setVoidOpen(false);
                return;
            }
            setSelectedId('');
            setActionOk('');
            setActionError('');
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [reverseOpen, voidOpen]);

    const applyFilters = (e) => {
        e?.preventDefault?.();
        setOffset(0);
        setApplied({ ...draft });
    };
    const showAll = () => {
        const cleared = { q: '', type: '', branchId: ALL_BRANCH, dateFrom: '', dateTo: '' };
        setDraft(cleared);
        setApplied(cleared);
        setOffset(0);
    };

    const printEntry = (entry) => {
        if (!entry) return;
        const lines = Array.isArray(entry.lines) ? entry.lines : [];
        const body = `
            <h1>${escapeHtml(t('gj.print.voucher'))} ${escapeHtml(entry.entryNumber || '')}</h1>
            <p>${escapeHtml(fmtBusinessYmd(entry.date))} · ${escapeHtml(journalSourceValue(entry))} · ${escapeHtml(String(entry.status || '').toUpperCase())}</p>
            <p>${escapeHtml(entry.description || '')}</p>
            <table>
                <thead><tr>
                    <th>${escapeHtml(t('gj.th.account'))}</th>
                    <th>${escapeHtml(t('gj.th.debit'))}</th>
                    <th>${escapeHtml(t('gj.th.credit'))}</th>
                </tr></thead>
                <tbody>
                    ${lines.map((l) => `<tr>
                        <td>${escapeHtml([l.accountCode, l.accountName].filter(Boolean).join(' — '))}</td>
                        <td>${escapeHtml(l.debit ? formatWesternMoney(l.debit) : '')}</td>
                        <td>${escapeHtml(l.credit ? formatWesternMoney(l.credit) : '')}</td>
                    </tr>`).join('')}
                </tbody>
            </table>
            <p class="total">${escapeHtml(t('gj.print.totals'))}: ${escapeHtml(formatSarDisplay(entry.totalDebit))} / ${escapeHtml(formatSarDisplay(entry.totalCredit))}</p>
        `;
        printReportHtml(t('gj.print.title', { code: entry.entryNumber || '' }), body);
    };

    const handleReverse = async ({ date, reason }) => {
        if (!detail?.id) return;
        setActionBusy(true);
        setActionError('');
        setActionOk('');
        try {
            const res = await reverseJournalEntry(detail.id, { reason, ...(date ? { date } : {}) });
            setReverseOpen(false);
            setActionOk(t('gj.reversedOk', { code: res?.entryNumber || '' }));
            await reload();
            const full = await getAcctJournalEntry(detail.id);
            setDetail(full?.entry || detail);
        } catch (e) {
            const mapped = messageFromJournalError(e, 'gj.reverse.failed');
            setActionError(isForbiddenError(e) ? t('gj.noPermission') : (mapped.fallbackMessage || t(mapped.key, mapped.vars)));
        } finally {
            setActionBusy(false);
        }
    };

    const handleVoid = async () => {
        if (!detail?.id) return;
        setActionBusy(true);
        setActionError('');
        setActionOk('');
        try {
            await voidJournalEntry(detail.id);
            setVoidOpen(false);
            setActionOk(t('gj.voidedOk'));
            await reload();
            const full = await getAcctJournalEntry(detail.id);
            setDetail(full?.entry || { ...detail, status: 'void' });
        } catch (e) {
            const mapped = messageFromJournalError(e, 'gj.voidFailed');
            setActionError(isForbiddenError(e) ? t('gj.noPermission') : (mapped.fallbackMessage || t(mapped.key, mapped.vars)));
        } finally {
            setActionBusy(false);
        }
    };

    const colCount = 5 + (moreCols ? 3 : 0);
    const em = '—';

    return (
        <div className="general-journal-view" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
            <header className="journal-header">
                <p className="gj-crumb">{t('gj.crumb')}</p>
                <h2 className="journal-title">{t('gj.title')}</h2>
            </header>

            <form className="gj-filter-bar acct-filter-bar" onSubmit={applyFilters}>
                <label className="gj-field">
                    <span>{t('gj.filter.search')}</span>
                    <input
                        type="search"
                        value={draft.q}
                        placeholder={t('gj.searchPh')}
                        onChange={(e) => setDraft((d) => ({ ...d, q: e.target.value }))}
                    />
                </label>
                <label className="gj-field gj-field--combo">
                    <span>{t('gj.filter.source')}</span>
                    <SupplierAccountingCombobox
                        className="acct-table-combobox acct-filter-combobox"
                        options={sourceOptions}
                        value={draft.type}
                        onChange={(id) => setDraft((d) => ({ ...d, type: String(id || '') }))}
                        placeholder={t('gj.allSources')}
                        entityLabel="source"
                        emptyHint={t('gj.empty')}
                        menuMinWidth={260}
                    />
                </label>
                {!isAdminHqBooks ? (
                    <label className="gj-field gj-field--combo">
                        <span>{t('gj.filter.branch')}</span>
                        <SupplierAccountingCombobox
                            className="acct-table-combobox acct-filter-combobox"
                            options={branchOptions}
                            value={draft.branchId}
                            onChange={(id) => setDraft((d) => ({ ...d, branchId: String(id || '') }))}
                            placeholder={t('gj.allBranches')}
                            entityLabel="branch"
                            emptyHint={t('gj.empty')}
                            menuMinWidth={260}
                        />
                    </label>
                ) : null}
                <label className="gj-field">
                    <span>{t('gj.filter.from')}</span>
                    <input
                        type="date"
                        value={draft.dateFrom}
                        onChange={(e) => setDraft((d) => ({ ...d, dateFrom: e.target.value }))}
                    />
                </label>
                <label className="gj-field">
                    <span>{t('gj.filter.to')}</span>
                    <input
                        type="date"
                        value={draft.dateTo}
                        onChange={(e) => setDraft((d) => ({ ...d, dateTo: e.target.value }))}
                    />
                </label>
                <div className="gj-filter-bar__actions">
                    <button type="submit" className="btn-submit btn-dark">{t('gj.filter.apply')}</button>
                    <button type="button" className="btn-portal-outline" onClick={showAll}>{t('gj.filter.showAll')}</button>
                </div>
            </form>

            {cards.length > 0 ? (
                <div className="journal-stats acct-kpi-grid" style={{ gridTemplateColumns: `repeat(${cards.length}, minmax(0, 1fr))` }}>
                    {cards.map((c) => (
                        <div key={c.id} className="acct-kpi-card acct-kpi-card--with-icon">
                    <div className="jr-stat-icon-wrapper">
                        <div className="jr-stat-icon icon-purple"><Book size={18} /></div>
                    </div>
                    <div className="jr-stat-info">
                                <span className="acct-kpi-label">{t(c.labelKey)}</span>
                                <span className="acct-kpi-value">
                                    {c.money ? formatSarDisplay(c.value) : formatWesternInt(c.value)}
                                </span>
                    </div>
                </div>
                    ))}
                </div>
            ) : null}

            {error ? (
                <div className="gj-alert" role="alert">
                    <span>{error}</span>
                    {!forbidden ? (
                        <button type="button" className="btn-portal-outline" onClick={reload}>
                            <RefreshCw size={14} /> {t('gj.retry')}
                        </button>
                    ) : null}
                </div>
            ) : null}

            <div className="gj-split">
                <section className="premium-table journal-table gj-split__list">
                    <div className="gj-list-toolbar">
                        <button
                            type="button"
                            className="btn-portal-outline"
                            onClick={() => setMoreCols((v) => !v)}
                        >
                            <Columns3 size={14} /> {moreCols ? t('gj.fewerColumns') : t('gj.moreColumns')}
                    </button>
                </div>
                <WsTableScroll>
                        <table className="ws-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="table-header-row">
                                    <th className="table-th">{t('gj.th.je')}</th>
                            <th className="table-th">{t('gj.th.date')}</th>
                                    <th className="table-th">{t('gj.th.source')}</th>
                                    <th className="table-th">{t('gj.th.memo')}</th>
                                    <th className="table-th" style={{ textAlign: 'end' }}>{t('gj.th.amount')}</th>
                                    {moreCols ? (
                                        <>
                            <th className="table-th text-center">{t('gj.th.lines')}</th>
                            <th className="table-th text-center">{t('gj.th.balanced')}</th>
                            <th className="table-th">{t('gj.th.status')}</th>
                                        </>
                                    ) : null}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                                    <tr><td colSpan={colCount} className="table-cell table-empty">{t('gj.loading')}</td></tr>
                        ) : entries.length === 0 ? (
                                    <tr><td colSpan={colCount} className="table-cell table-empty">{t('gj.empty')}</td></tr>
                                ) : (
                                    entries.map((e) => {
                                        const id = String(e.id);
                                        const tags = journalTags(e);
                                        const selected = selectedId === id;
                                        return (
                                            <tr
                                                key={id}
                                                className={`table-row${selected ? ' gj-row--selected' : ''}`}
                                                style={{ cursor: 'pointer' }}
                                                onClick={() => {
                                                    setSelectedId(id);
                                                    setReverseOpen(false);
                                                    setVoidOpen(false);
                                                    setActionOk('');
                                                    setActionError('');
                                                }}
                                            >
                                                <td className="table-cell font-bold">
                                                    {e.entryNumber || em}
                                                    {tags.map((tag) => (
                                                        <span key={tag.kind} className="gj-tag">
                                                            {tag.kind === 'reversalOf'
                                                                ? t('gj.tag.reversalOf', { code: tag.entryNumber || tag.sourceId || em })
                                                                : t('gj.tag.reversedBy', { code: tag.entryNumber || tag.id || em })}
                                                        </span>
                                                    ))}
                                                </td>
                                                <td className="table-cell">{fmtBusinessYmd(e.date)}</td>
                                                <td className="table-cell">{journalSourceValue(e) || em}</td>
                                                <td className="table-cell color-muted truncate-text">{e.description || em}</td>
                                                <td className="table-cell font-bold" style={{ textAlign: 'end' }}>
                                                    {journalAmountValue(e) == null ? em : formatWesternMoney(journalAmountValue(e))}
                                                </td>
                                                {moreCols ? (
                                                    <>
                                                        <td className="table-cell text-center">
                                                            <span className="badge-count">{e.lines?.length ?? 0}</span>
                                                        </td>
                                    <td className="table-cell text-center">
                                        {e.isBalanced
                                            ? <CheckCircle size={16} className="color-green-light" />
                                            : <AlertTriangle size={16} style={{ color: '#B45309' }} />}
                                    </td>
                                    <td className="table-cell">
                                                            <span className={chipClass(statusChipKind(e.status))}>
                                                                {String(e.status || 'posted').replace(/_/g, ' ')}
                                                            </span>
                                    </td>
                                                    </>
                                                ) : null}
                                </tr>
                                        );
                                    })
                        )}
                    </tbody>
                </table>
                </WsTableScroll>
                    {!loading && total > 0 ? (
                        <div className="gj-pager">
                            <p className="gj-showing">{t('gj.showing', { from: range.from, to: range.to, total: range.total })}</p>
                            <p className="gj-per-page">{t('gj.perPage', { n: JOURNAL_PAGE_SIZE })}</p>
                            <PaginationControls
                    total={total}
                                limit={JOURNAL_PAGE_SIZE}
                                offset={offset}
                                onPageChange={setOffset}
                                loading={loading}
                            />
                        </div>
                    ) : null}
            </section>

                <aside className="gj-side-panel">
                    {!selectedId ? (
                        <p className="gj-side-panel__empty">{t('gj.panel.empty')}</p>
                    ) : detailLoading && !detail ? (
                        <p className="gj-side-panel__empty">{t('gj.loading')}</p>
                    ) : !detail ? (
                        <div className="gj-alert" role="alert">
                            <span>{detailError || t('gj.loadFailed')}</span>
                            <button type="button" className="btn-portal-outline" onClick={() => setSelectedId(selectedId)}>
                                {t('gj.retry')}
                            </button>
                        </div>
                    ) : (
                        <>
                            <header className="gj-side-panel__head">
                                <h3>
                                    {detail.entryNumber || em}
                                    {' · '}
                                    {fmtBusinessYmd(detail.date)}
                                    {' · '}
                                    <span className={chipClass(statusChipKind(detail.status))}>
                                        {String(detail.status || 'posted').replace(/_/g, ' ')}
                                    </span>
                                </h3>
                                <button
                                    type="button"
                                    className="jr-action-btn"
                                    title={t('gj.print')}
                                    onClick={() => printEntry(detail)}
                                >
                                    <Printer size={16} />
                                </button>
                            </header>
                            {detailError ? <p className="gj-inline-err" role="alert">{detailError}</p> : null}
                            {journalTags(detail).map((tag) => (
                                <p key={tag.kind} className="gj-tag">
                                    {tag.kind === 'reversalOf'
                                        ? t('gj.tag.reversalOf', { code: tag.entryNumber || tag.sourceId || em })
                                        : t('gj.tag.reversedBy', { code: tag.entryNumber || tag.id || em })}
                                </p>
                            ))}
                            {actionOk ? <p className="gj-inline-ok">{actionOk}</p> : null}
                            {actionError ? <p className="gj-inline-err" role="alert">{actionError}</p> : null}

                            <table className="ws-table" style={{ width: '100%' }}>
                                        <thead>
                                            <tr>
                                        <th className="table-th">{t('gj.th.account')}</th>
                                        <th className="table-th" style={{ textAlign: 'end' }}>{t('gj.th.debit')}</th>
                                        <th className="table-th" style={{ textAlign: 'end' }}>{t('gj.th.credit')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                    {(detail.lines || []).length === 0 ? (
                                        <tr><td className="table-cell table-empty" colSpan={3}>{t('gj.noLines')}</td></tr>
                                    ) : (
                                        (detail.lines || []).map((l) => (
                                            <tr key={l.id || `${l.accountId}-${l.debit}-${l.credit}`}>
                                                <td className="table-cell">{[l.accountCode, l.accountName].filter(Boolean).join(' — ') || em}</td>
                                                <td className="table-cell" style={{ textAlign: 'end' }}>
                                                    {l.debit ? formatWesternMoney(l.debit) : ''}
                                                </td>
                                                <td className="table-cell" style={{ textAlign: 'end' }}>
                                                    {l.credit ? formatWesternMoney(l.credit) : ''}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                                    </table>
                            {detail.isBalanced ? (
                                <p className="gj-balanced"><CheckCircle size={16} /> {t('gj.balanced')}</p>
                            ) : null}

                            {detail.linkedTransaction ? (
                                <p className="gj-source-doc">
                                    {t('gj.sourceDoc')}: {detail.linkedTransaction.voucherNumber || detail.linkedTransaction.id}
                                </p>
                            ) : null}

                            <div className="gj-side-panel__actions">
                                {canAdmin && canShowReverse(detail) ? (
                                    reverseOpen ? null : (
                                        <button
                                            type="button"
                                            className="btn-submit btn-dark"
                                            onClick={() => { setVoidOpen(false); setReverseOpen(true); }}
                                        >
                                            <RotateCcw size={14} /> {t('gj.reverse')}
                                        </button>
                                    )
                                ) : null}
                                {canAdmin && canShowVoid(detail) ? (
                                    voidOpen ? null : (
                                        <button
                                            type="button"
                                            className="btn-portal-outline"
                                            onClick={() => { setReverseOpen(false); setVoidOpen(true); }}
                                        >
                                            {t('gj.void')}
                                        </button>
                                    )
                                ) : null}
                            </div>
                            <p className="gj-no-delete">{t('gj.noHardDelete')}</p>

                            {reverseOpen ? (
                                <JournalReversePanel
                                    t={t}
                                    defaultDate={toRiyadhDateISO(new Date())}
                                    busy={actionBusy}
                                    error=""
                                    onConfirm={handleReverse}
                                    onCancel={() => setReverseOpen(false)}
                                />
                            ) : null}
                            {voidOpen ? (
                                <div className="gj-reverse-panel">
                                    <p className="gj-reverse-panel__lead">{t('gj.voidSure')}</p>
                                    <div className="gj-reverse-panel__actions">
                                        <button type="button" className="btn-submit btn-dark" disabled={actionBusy} onClick={handleVoid}>
                                            {actionBusy ? t('gj.reverse.saving') : t('gj.reverse.confirm')}
                                        </button>
                                        <button type="button" className="btn-portal-outline" disabled={actionBusy} onClick={() => setVoidOpen(false)}>
                                            {t('gj.reverse.cancel')}
                                        </button>
                            </div>
                        </div>
                            ) : null}
                        </>
                )}
                </aside>
            </div>
        </div>
    );
}
