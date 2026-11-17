import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { postNoncashPurchasesRepair } from '../../../services/booksHealthApi';
import {
    BOOKS_HEALTH_PAGE_SIZE,
    mapNoncashRepairCards,
    noncashPlannedFixKey,
    noncashProblemKey,
    slicePage,
} from '../../../utils/booksHealthDisplay';
import { formatSarAmount } from './workshopAccountingShared';
import { accT } from '../../../utils/accountingI18n';
import WsTableScroll from '../../../components/workshop/WsTableScroll';
import WsTablePagination from '../../../components/workshop/WsTablePagination';
import { useAuth } from '../../../context/AuthContext';

export default function WorkshopNoncashRepairPage({ locale: localeProp = 'en' }) {
    const locale = localeProp || 'en';
    const t = useCallback((key, vars) => accT(locale, key, vars), [locale]);
    const navigate = useNavigate();
    const { hasPermission } = useAuth();
    const canView =
        hasPermission('workshop.accounting.chart-of-accounts.view') ||
        hasPermission('accounting.chart-of-accounts.view');
    // Create reversals = admin-level repair (owner/accountant).
    const canCreateReversals =
        hasPermission('workshop.accounting.chart-of-accounts.view') ||
        hasPermission('accounting.chart-of-accounts.view');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [acting, setActing] = useState(false);
    const [page, setPage] = useState(1);
    const [actionMsg, setActionMsg] = useState(null);

    const runDry = useCallback(async () => {
        setLoading(true);
        setError(null);
        setActionMsg(null);
        setConfirmOpen(false);
        try {
            const res = await postNoncashPurchasesRepair({ dryRun: true });
            setResult({ ...res, checkedAt: new Date().toISOString() });
        } catch (err) {
            setError(err?.message || t('bh.error.load'));
            setResult(null);
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        if (!canView) return undefined;
        void runDry();
        return undefined;
    }, [canView, runDry]);

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') setConfirmOpen(false);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const mapped = useMemo(() => mapNoncashRepairCards(result), [result]);
    const paged = useMemo(
        () => slicePage(mapped.findings, page, BOOKS_HEALTH_PAGE_SIZE),
        [mapped.findings, page],
    );

    const createReversals = async () => {
        if (!canCreateReversals) return;
        setActing(true);
        setActionMsg(null);
        try {
            const res = await postNoncashPurchasesRepair({ dryRun: false });
            setResult({ ...res, checkedAt: new Date().toISOString() });
            setActionMsg(t('bh.noncash.createOk'));
            setConfirmOpen(false);
        } catch (err) {
            setActionMsg(err?.message || t('bh.noncash.createFail'));
        } finally {
            setActing(false);
        }
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
                <button
                    type="button"
                    onClick={() => navigate('/workshop/accounting/books-health')}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: '#64748B',
                        cursor: 'pointer',
                        padding: 0,
                        textDecoration: 'underline',
                    }}
                >
                    {t('bh.breadcrumb.accounting')}
                </button>
                <span aria-hidden="true"> / </span>
                <button
                    type="button"
                    onClick={() => navigate('/workshop/accounting/books-health')}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: '#64748B',
                        cursor: 'pointer',
                        padding: 0,
                        textDecoration: 'underline',
                    }}
                >
                    {t('bh.title')}
                </button>
                <span aria-hidden="true"> / </span>
                <span>{t('bh.noncash.breadcrumb')}</span>
            </nav>

            <h1 style={{ margin: 0, marginBlockEnd: 16, fontSize: '1.5rem', fontWeight: 700 }}>
                {t('bh.noncash.title')}
            </h1>

            {error ? (
                <div role="alert" style={{ marginBlockEnd: 12, color: '#B91C1C' }}>
                    {error}{' '}
                    <button type="button" className="btn-portal-outline" onClick={() => void runDry()}>
                        {t('bh.btn.retry')}
                    </button>
                </div>
            ) : null}

            <div className="acct-kpi-grid">
                <div className="acct-kpi-card">
                    <div className="acct-kpi-label">{t('bh.noncash.card.invalid')}</div>
                    <div className="acct-kpi-value">
                        {loading && !result ? '…' : String(mapped.invalidCount)}
                    </div>
                </div>
                <div className="acct-kpi-card">
                    <div className="acct-kpi-label">{t('bh.noncash.card.amount')}</div>
                    <div className="acct-kpi-value" style={{ textAlign: 'end' }}>
                        {loading && !result
                            ? '…'
                            : `SAR ${formatSarAmount(mapped.amountAffected)}`}
                    </div>
                </div>
                <div className="acct-kpi-card">
                    <div className="acct-kpi-label">{t('bh.noncash.card.voided')}</div>
                    <div className="acct-kpi-value">
                        {t('bh.noncash.card.voidedValue')}
                    </div>
                </div>
                <div className="acct-kpi-card">
                    <div className="acct-kpi-label">{t('bh.noncash.card.lastCheck')}</div>
                    <div className="acct-kpi-value" style={{ fontSize: '0.95rem' }}>
                        {mapped.lastCheck
                            ? String(mapped.lastCheck).slice(0, 19).replace('T', ' ')
                            : '—'}
                    </div>
                </div>
            </div>

            <WsTableScroll>
                <table className="ws-table">
                    <thead>
                        <tr>
                            <th className="table-th">{t('bh.noncash.col.journal')}</th>
                            <th className="table-th">{t('bh.noncash.col.date')}</th>
                            <th className="table-th">{t('bh.noncash.col.supplier')}</th>
                            <th className="table-th" style={{ textAlign: 'end' }}>
                                {t('bh.noncash.col.amount')}
                            </th>
                            <th className="table-th">{t('bh.noncash.col.problem')}</th>
                            <th className="table-th">{t('bh.noncash.col.fix')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paged.rows.length === 0 ? (
                            <tr>
                                <td className="table-cell" colSpan={6}>
                                    {loading ? t('loading') : t('bh.noncash.empty')}
                                </td>
                            </tr>
                        ) : (
                            paged.rows.map((f) => (
                                <tr key={String(f.journalId)}>
                                    <td className="table-cell">{String(f.journalId)}</td>
                                    <td className="table-cell">—</td>
                                    <td className="table-cell">—</td>
                                    <td className="table-cell" style={{ textAlign: 'end' }}>
                                        {formatSarAmount(f.amount)}
                                    </td>
                                    <td className="table-cell">{t(noncashProblemKey(f.reason))}</td>
                                    <td className="table-cell">{t(noncashPlannedFixKey(f.reason))}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </WsTableScroll>
            <WsTablePagination
                page={paged.page}
                pageCount={paged.pageCount}
                pageSize={BOOKS_HEALTH_PAGE_SIZE}
                pageSizes={[BOOKS_HEALTH_PAGE_SIZE]}
                total={paged.total}
                onPageChange={setPage}
                onPageSizeChange={() => {}}
            />

            {confirmOpen ? (
                <div
                    role="region"
                    aria-label={t('bh.noncash.confirmTitle')}
                    style={{
                        marginBlockStart: 12,
                        paddingBlock: 12,
                        paddingInline: 14,
                        borderRadius: 10,
                        border: '1px solid #FCA5A5',
                        background: '#FEF2F2',
                        color: '#991B1B',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 10,
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    }}
                >
                    <span>{t('bh.noncash.confirmBody')}</span>
                    <span style={{ display: 'flex', gap: 8 }}>
                        <button
                            type="button"
                            className="btn-submit btn-dark"
                            disabled={acting}
                            onClick={() => void createReversals()}
                        >
                            {t('bh.noncash.confirmYes')}
                        </button>
                        <button
                            type="button"
                            className="btn-portal-outline"
                            disabled={acting}
                            onClick={() => setConfirmOpen(false)}
                        >
                            {t('btn.cancel')}
                        </button>
                    </span>
                </div>
            ) : null}

            {actionMsg ? (
                <div role="status" style={{ marginBlockStart: 8, fontSize: '0.875rem' }}>
                    {actionMsg}
                </div>
            ) : null}

            <div
                style={{
                    marginBlockStart: 16,
                    paddingBlock: 12,
                    paddingInline: 14,
                    borderRadius: 10,
                    border: '1px solid #FDE68A',
                    background: '#FFFBEB',
                    color: '#92400E',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 12,
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}
            >
                <p style={{ margin: 0, fontSize: '0.875rem', flex: '1 1 240px' }}>
                    {t('bh.noncash.note')}
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                        type="button"
                        className="btn-portal-outline"
                        disabled={loading || acting}
                        onClick={() => void runDry()}
                    >
                        {t('bh.noncash.dryRun')}
                    </button>
                    {canCreateReversals ? (
                        <button
                            type="button"
                            className="btn-submit btn-dark"
                            disabled={loading || acting || mapped.invalidCount === 0}
                            onClick={() => setConfirmOpen(true)}
                        >
                            {t('bh.noncash.createReversals')}
                        </button>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
