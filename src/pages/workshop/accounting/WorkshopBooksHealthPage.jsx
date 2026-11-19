import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock, RefreshCw, ShieldAlert } from 'lucide-react';
import {
    getBooksHealthSummary,
    listBooksHealthOutbox,
    retryBooksHealthOutbox,
} from '../../../services/booksHealthApi';
import { writeBooksHealthAlertCache, booksHealthShouldShowAlert } from '../../../utils/booksHealthAlertCache';
import {
    BOOKS_HEALTH_PAGE_SIZE,
    canRetryOutboxRow,
    mapBooksHealthSummaryCards,
    mapOutboxRow,
    outboxStateChip,
    slicePage,
} from '../../../utils/booksHealthDisplay';
import { accT } from '../../../utils/accountingI18n';
import WsTableScroll from '../../../components/workshop/WsTableScroll';
import WsTablePagination from '../../../components/workshop/WsTablePagination';
import { useAuth } from '../../../context/AuthContext';

function fmtTime(iso) {
    if (!iso) return '—';
    const s = String(iso);
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
        return s.length >= 16 ? s.slice(0, 16).replace('T', ' ') : s.slice(0, 10);
    }
    return s;
}

const chipStyle = (tone) => {
    const map = {
        ok: { background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0' },
        warn: { background: '#FFFBEB', color: '#92400E', border: '1px solid #FDE68A' },
        bad: { background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA' },
        info: { background: '#EFF6FF', color: '#1E40AF', border: '1px solid #BFDBFE' },
        neutral: { background: '#F8FAFC', color: '#334155', border: '1px solid #E2E8F0' },
    };
    return {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        paddingBlock: 2,
        paddingInline: 8,
        borderRadius: 999,
        fontSize: '0.75rem',
        fontWeight: 600,
        ...(map[tone] || map.neutral),
    };
};

export default function WorkshopBooksHealthPage({ locale: localeProp = 'en' }) {
    const locale = localeProp || 'en';
    const t = useCallback((key, vars) => accT(locale, key, vars), [locale]);
    const navigate = useNavigate();
    const { hasPermission } = useAuth();
    const canView =
        hasPermission('workshop.accounting.chart-of-accounts.view') ||
        hasPermission('accounting.chart-of-accounts.view');
    const canRetry =
        hasPermission('workshop.accounting.chart-of-accounts.view') ||
        hasPermission('accounting.chart-of-accounts.view');

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [summary, setSummary] = useState(null);
    const [outboxRows, setOutboxRows] = useState([]);
    const [outboxTotal, setOutboxTotal] = useState(0);
    const [outboxPage, setOutboxPage] = useState(1);
    const [setupPage, setSetupPage] = useState(1);
    const [retryingId, setRetryingId] = useState(null);
    const [retryMsg, setRetryMsg] = useState(null);
    const [statusFilter, setStatusFilter] = useState('');
    const [draftStatus, setDraftStatus] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [sum, outbox] = await Promise.all([
                getBooksHealthSummary(),
                listBooksHealthOutbox({
                    page: outboxPage,
                    ...(statusFilter ? { status: statusFilter } : {}),
                }),
            ]);
            setSummary(sum || null);
            writeBooksHealthAlertCache(booksHealthShouldShowAlert(sum || {}));
            const rows = Array.isArray(outbox?.rows) ? outbox.rows.map(mapOutboxRow) : [];
            setOutboxRows(rows);
            setOutboxTotal(Number(outbox?.total ?? rows.length) || 0);
        } catch (err) {
            setError(err?.message || t('bh.error.load'));
            setSummary(null);
            setOutboxRows([]);
        } finally {
            setLoading(false);
        }
    }, [outboxPage, statusFilter, t]);

    useEffect(() => {
        if (!canView) return undefined;
        void load();
        return undefined;
    }, [canView, load]);

    const cards = useMemo(() => mapBooksHealthSummaryCards(summary), [summary]);

    // Setup-per-branch/cashier not on books-health API yet → empty table.
    const setupRows = useMemo(() => [], []);
    const setupPaged = useMemo(
        () => slicePage(setupRows, setupPage, BOOKS_HEALTH_PAGE_SIZE),
        [setupRows, setupPage],
    );

    const outboxPageCount = Math.max(
        1,
        Math.ceil(outboxTotal / BOOKS_HEALTH_PAGE_SIZE) || 1,
    );

    const onRetry = async (row) => {
        if (!canRetry || !row?.id) return;
        setRetryingId(row.id);
        setRetryMsg(null);
        try {
            await retryBooksHealthOutbox(row.id);
            setRetryMsg(t('bh.outbox.retryOk'));
            await load();
        } catch (err) {
            setRetryMsg(err?.message || t('bh.outbox.retryFail'));
        } finally {
            setRetryingId(null);
        }
    };

    const applyFilter = (e) => {
        e?.preventDefault?.();
        setOutboxPage(1);
        setStatusFilter(draftStatus);
    };

    const showAll = () => {
        setDraftStatus('');
        setStatusFilter('');
        setOutboxPage(1);
    };

    if (!canView) {
        return (
            <div className="module-container" role="alert">
                {t('bh.error.forbidden')}
            </div>
        );
    }

    return (
        <div className="module-container" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
            <nav style={{ fontSize: '0.8125rem', color: '#64748B', marginBlockEnd: 8 }}>
                <span>{t('bh.breadcrumb.accounting')}</span>
                <span aria-hidden="true"> / </span>
                <span>{t('bh.breadcrumb.home')}</span>
            </nav>

            <div
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    marginBlockEnd: 16,
                }}
            >
                <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>
                    {t('bh.title')}
                </h1>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                        type="button"
                        className="btn-portal-outline"
                        onClick={() => void load()}
                        disabled={loading}
                    >
                        <RefreshCw size={14} style={{ marginInlineEnd: 6 }} />
                        {t('btn.refresh')}
                    </button>
                    <button
                        type="button"
                        className="btn-portal-outline"
                        onClick={() => navigate('/workshop/accounting/books-health/noncash-repair')}
                    >
                        {t('bh.link.noncashRepair')}
                    </button>
                </div>
            </div>

            {error ? (
                <div role="alert" style={{ marginBlockEnd: 12, color: '#B91C1C' }}>
                    {error}{' '}
                    <button type="button" className="btn-portal-outline" onClick={() => void load()}>
                        {t('bh.btn.retry')}
                    </button>
                </div>
            ) : null}

            {loading && !summary ? (
                <p>{t('loading')}</p>
            ) : (
                <div className="acct-kpi-grid">
                    {cards.map((c) => (
                        <div key={c.key} className="acct-kpi-card">
                            <div className="acct-kpi-label" title={t(c.labelKey)}>{t(c.labelKey)}</div>
                            <div
                                className="acct-kpi-value"
                                title={String(c.value ?? '')}
                                style={
                                    c.tone === 'bad'
                                        ? { color: '#B91C1C' }
                                        : c.tone === 'warn'
                                          ? { color: '#B45309' }
                                          : undefined
                                }
                            >
                                {c.value}
                            </div>
                            {c.metaKey ? (
                                <div className="acct-kpi-meta">{t(c.metaKey)}</div>
                            ) : null}
                        </div>
                    ))}
                </div>
            )}

            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                    gap: 16,
                    alignItems: 'start',
                }}
            >
                {/* LEFT: Setup status */}
                <section>
                    <h2 style={{ fontSize: '1.05rem', marginBlockEnd: 10 }}>
                        {t('bh.setup.title')}
                    </h2>
                    <WsTableScroll>
                        <table className="ws-table">
                            <thead>
                                <tr>
                                    <th className="table-th">{t('bh.setup.col.branchCashier')}</th>
                                    <th className="table-th">{t('bh.setup.col.cash')}</th>
                                    <th className="table-th">{t('bh.setup.col.variance')}</th>
                                    <th className="table-th">{t('bh.setup.col.sales')}</th>
                                    <th className="table-th">{t('bh.setup.col.status')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {setupPaged.rows.length === 0 ? (
                                    <tr>
                                        <td className="table-cell" colSpan={5}>
                                            {t('bh.setup.needsBackend')}
                                        </td>
                                    </tr>
                                ) : (
                                    setupPaged.rows.map((row) => (
                                        <tr key={row.id}>
                                            <td className="table-cell">{row.label}</td>
                                            <td className="table-cell">{row.cash}</td>
                                            <td className="table-cell">{row.variance}</td>
                                            <td className="table-cell">{row.sales}</td>
                                            <td className="table-cell">
                                                <span style={chipStyle(row.tone)}>{row.status}</span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </WsTableScroll>
                    <WsTablePagination
                        page={setupPaged.page}
                        pageCount={setupPaged.pageCount}
                        pageSize={BOOKS_HEALTH_PAGE_SIZE}
                        pageSizes={[BOOKS_HEALTH_PAGE_SIZE]}
                        total={setupPaged.total}
                        onPageChange={setSetupPage}
                        onPageSizeChange={() => {}}
                    />
                </section>

                {/* RIGHT: POS posting queue */}
                <section>
                    <h2 style={{ fontSize: '1.05rem', marginBlockEnd: 10 }}>
                        {t('bh.outbox.title')}
                    </h2>

                    <form
                        className="acct-filter-bar"
                        onSubmit={applyFilter}
                        style={{
                            marginBlockEnd: 10,
                            padding: 10,
                            borderRadius: 8,
                            border: '1px solid #E2E8F0',
                            background: '#F8FAFC',
                        }}
                    >
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem' }}>
                            {t('bh.outbox.filter.status')}
                            <select
                                value={draftStatus}
                                onChange={(e) => setDraftStatus(e.target.value)}
                                style={{ minWidth: 140, padding: '6px 8px' }}
                            >
                                <option value="">{t('bh.outbox.filter.all')}</option>
                                <option value="pending">{t('bh.outbox.queued')}</option>
                                <option value="failed">{t('bh.outbox.filter.failed')}</option>
                                <option value="posted">{t('bh.outbox.posted')}</option>
                                <option value="dead">{t('bh.outbox.filter.dead')}</option>
                            </select>
                        </label>
                        <button type="submit" className="btn-submit btn-dark">
                            {t('date.apply')}
                        </button>
                        <button type="button" className="btn-portal-outline" onClick={showAll}>
                            {t('bh.btn.showAll')}
                        </button>
                    </form>

                    {retryMsg ? (
                        <div role="status" style={{ marginBlockEnd: 8, fontSize: '0.875rem' }}>
                            {retryMsg}
                        </div>
                    ) : null}

                    <WsTableScroll>
                        <table className="ws-table">
                            <thead>
                                <tr>
                                    <th className="table-th">{t('bh.outbox.col.source')}</th>
                                    <th className="table-th">{t('bh.outbox.col.ref')}</th>
                                    <th className="table-th">{t('bh.outbox.col.time')}</th>
                                    <th className="table-th">{t('bh.outbox.col.state')}</th>
                                    <th className="table-th">{t('bh.outbox.col.action')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {outboxRows.length === 0 ? (
                                    <tr>
                                        <td className="table-cell" colSpan={5}>
                                            {loading ? t('loading') : t('bh.outbox.empty')}
                                        </td>
                                    </tr>
                                ) : (
                                    outboxRows.map((row) => {
                                        const chip = outboxStateChip(row);
                                        const label =
                                            chip.key === 'bh.outbox.failed' && chip.reason
                                                ? `${t(chip.key)}: ${chip.reason}`
                                                : t(chip.key);
                                        return (
                                            <tr key={row.id}>
                                                <td className="table-cell">{row.source}</td>
                                                <td className="table-cell">{row.ref}</td>
                                                <td className="table-cell">{fmtTime(row.time)}</td>
                                                <td className="table-cell">
                                                    <span style={chipStyle(chip.tone)}>{label}</span>
                                                </td>
                                                <td className="table-cell">
                                                    {canRetry && canRetryOutboxRow(row) ? (
                                                        <button
                                                            type="button"
                                                            className="btn-portal-outline"
                                                            disabled={retryingId === row.id}
                                                            onClick={() => void onRetry(row)}
                                                        >
                                                            {t('bh.outbox.retry')}
                                                        </button>
                                                    ) : null}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </WsTableScroll>
                    <WsTablePagination
                        page={outboxPage}
                        pageCount={outboxPageCount}
                        pageSize={BOOKS_HEALTH_PAGE_SIZE}
                        pageSizes={[BOOKS_HEALTH_PAGE_SIZE]}
                        total={outboxTotal}
                        onPageChange={setOutboxPage}
                        onPageSizeChange={() => {}}
                    />
                    <p style={{ fontSize: '0.8125rem', color: '#64748B', marginBlockStart: 8 }}>
                        {t('bh.outbox.footerNote')}
                    </p>
                </section>
            </div>

            {/* Optional API extras (only when fields exist) — compact meta under panels */}
            {summary?.documentsWithoutJournal ||
            (Array.isArray(summary?.cashBankDrift) && summary.cashBankDrift.length > 0) ||
            summary?.unbalancedJournals > 0 ? (
                <div
                    style={{
                        marginBlockStart: 20,
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 12,
                        fontSize: '0.875rem',
                    }}
                >
                    {summary?.documentsWithoutJournal ? (
                        <span>
                            {t('bh.extra.docsWithoutJournal', {
                                invoices: String(summary.documentsWithoutJournal.invoices ?? 0),
                                returns: String(
                                    summary.documentsWithoutJournal.completedSalesReturns ?? 0,
                                ),
                                expenses: String(
                                    summary.documentsWithoutJournal.approvedExpenseRequests ?? 0,
                                ),
                            })}
                        </span>
                    ) : null}
                    {summary?.unbalancedJournals > 0 ? (
                        <span style={{ color: '#B91C1C' }}>
                            <AlertTriangle size={14} style={{ verticalAlign: 'middle' }} />{' '}
                            {t('bh.extra.unbalanced', {
                                n: String(summary.unbalancedJournals),
                            })}
                        </span>
                    ) : null}
                    {Array.isArray(summary?.cashBankDrift) && summary.cashBankDrift.length > 0 ? (
                        <span style={{ color: '#B45309' }}>
                            <ShieldAlert size={14} style={{ verticalAlign: 'middle' }} />{' '}
                            {t('bh.extra.drift', { n: String(summary.cashBankDrift.length) })}
                        </span>
                    ) : null}
                    {summary?.lastSweepAt ? (
                        <span>
                            <Clock size={14} style={{ verticalAlign: 'middle' }} />{' '}
                            {t('bh.extra.lastCheck', { at: fmtTime(summary.lastSweepAt) })}
                        </span>
                    ) : null}
                    <Link to="/workshop/accounting/books-health/noncash-repair">
                        {t('bh.link.noncashRepair')}
                    </Link>
                </div>
            ) : null}
        </div>
    );
}
