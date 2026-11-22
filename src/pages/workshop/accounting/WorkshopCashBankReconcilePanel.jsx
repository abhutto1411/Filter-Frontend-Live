import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PaginationControls } from '../../../components/PaginationControls';
import {
    discardBankReconciliationDraft,
    finishBankReconciliation,
    getBankReconciliation,
    getBankReconciliationHistory,
    listBankReconciliationLines,
    saveBankReconciliationDraft,
    tickBankReconciliationLines,
    undoBankReconciliation,
} from '../../../services/workshopStaffApi';
import { toRiyadhDateISO } from '../../../utils/riyadhBusinessRange';
import { workshopAccountingPath } from '../../../utils/workshopAccTabSlug';
import {
    formatMoneyString,
    isReconcileFinishEnabled,
    pageTickIds,
    reconcileErrorKey,
    reconcileUiState,
} from '../../../utils/cashBankScreen';

const BALANCE_RE = /^-?\d+(\.\d{1,2})?$/;
const PAGE_SIZE = 25;

function moneyTone(str) {
    const { text, isNegative } = formatMoneyString(str);
    return { text, color: isNegative ? '#dc2626' : undefined };
}

function diffTone(str) {
    const { text, isNegative } = formatMoneyString(str);
    const exactZero = String(str ?? '') === '0.00';
    return {
        text,
        color: isNegative ? '#dc2626' : exactZero ? '#16a34a' : '#d97706',
    };
}

/**
 * Live bank reconciliation panel (P-A21C). Parent keeps the BANK picker / Clear.
 */
export default function WorkshopCashBankReconcilePanel({
    bank,
    accounts = [],
    canView,
    canManage,
    t,
    onSelectBankId,
    onAccountsRefresh,
}) {
    const navigate = useNavigate();
    const bankId = bank?.id ? String(bank.id) : '';
    const reqTokenRef = useRef(0);

    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [errorCode, setErrorCode] = useState('');
    const [errorParams, setErrorParams] = useState({});
    const [retryFn, setRetryFn] = useState(null);
    const [state, setState] = useState(null);
    const [summary, setSummary] = useState(null);

    const [stmtDate, setStmtDate] = useState('');
    const [stmtBalance, setStmtBalance] = useState('');
    const [balanceError, setBalanceError] = useState('');
    const [savingDraft, setSavingDraft] = useState(false);

    const [lines, setLines] = useState([]);
    const [linesTotal, setLinesTotal] = useState(0);
    const [linesPage, setLinesPage] = useState(1);
    const [draftSearch, setDraftSearch] = useState('');
    const [appliedSearch, setAppliedSearch] = useState('');
    const [linesLoading, setLinesLoading] = useState(false);
    const [tickBusy, setTickBusy] = useState(false);

    const [confirmFinish, setConfirmFinish] = useState(false);
    const [confirmDiscard, setConfirmDiscard] = useState(false);
    const [actionBusy, setActionBusy] = useState(false);

    const [history, setHistory] = useState([]);
    const [historyTotal, setHistoryTotal] = useState(0);
    const [historyPage, setHistoryPage] = useState(1);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [undoId, setUndoId] = useState('');
    const [undoReason, setUndoReason] = useState('');

    const riyadhToday = toRiyadhDateISO(new Date());

    const mapErr = useCallback(
        (err, { onRetry } = {}) => {
            const mapped = reconcileErrorKey(err);
            setErrorCode(String(err?.code || '').toUpperCase());
            setErrorParams(mapped.params || {});
            setErrorMsg(t(mapped.key, mapped.params));
            setRetryFn(onRetry ? () => onRetry : null);
            return mapped;
        },
        [t],
    );

    const clearError = useCallback(() => {
        setErrorMsg('');
        setErrorCode('');
        setErrorParams({});
        setRetryFn(null);
    }, []);

    const resetLocal = useCallback(() => {
        clearError();
        setState(null);
        setSummary(null);
        setStmtDate('');
        setStmtBalance('');
        setBalanceError('');
        setLines([]);
        setLinesTotal(0);
        setLinesPage(1);
        setDraftSearch('');
        setAppliedSearch('');
        setConfirmFinish(false);
        setConfirmDiscard(false);
        setHistory([]);
        setHistoryTotal(0);
        setHistoryPage(1);
        setUndoId('');
        setUndoReason('');
    }, [clearError]);

    const loadHistory = useCallback(
        async (id, page, token) => {
            setHistoryLoading(true);
            try {
                const res = await getBankReconciliationHistory(id, {
                    page,
                    pageSize: PAGE_SIZE,
                });
                if (token !== reqTokenRef.current) return;
                setHistory(Array.isArray(res?.items) ? res.items : []);
                setHistoryTotal(Number(res?.total) || 0);
                setHistoryPage(Number(res?.page) || page);
            } catch (err) {
                if (token !== reqTokenRef.current) return;
                mapErr(err);
            } finally {
                if (token === reqTokenRef.current) setHistoryLoading(false);
            }
        },
        [mapErr],
    );

    const loadLines = useCallback(
        async (id, page, search, token) => {
            setLinesLoading(true);
            try {
                const res = await listBankReconciliationLines(id, {
                    page,
                    pageSize: PAGE_SIZE,
                    search: search || undefined,
                });
                if (token !== reqTokenRef.current) return;
                setLines(Array.isArray(res?.items) ? res.items : []);
                setLinesTotal(Number(res?.total) || 0);
                setLinesPage(Number(res?.page) || page);
                if (res?.summary) setSummary(res.summary);
            } catch (err) {
                if (token !== reqTokenRef.current) return;
                mapErr(err, {
                    onRetry: () => loadLines(id, page, search, reqTokenRef.current),
                });
            } finally {
                if (token === reqTokenRef.current) setLinesLoading(false);
            }
        },
        [mapErr],
    );

    const loadState = useCallback(
        async (id, { silent } = {}) => {
            const token = ++reqTokenRef.current;
            if (!silent) setLoading(true);
            clearError();
            try {
                const res = await getBankReconciliation(id);
                if (token !== reqTokenRef.current) return;
                setState(res);
                setSummary(res?.summary || null);
                const draft = res?.draft;
                if (draft) {
                    setStmtDate(String(draft.statementEndDate || ''));
                    setStmtBalance(String(draft.statementBalance || ''));
                    await loadLines(id, 1, '', token);
                } else {
                    setLines([]);
                    setLinesTotal(0);
                    setLinesPage(1);
                }
                await loadHistory(id, 1, token);
            } catch (err) {
                if (token !== reqTokenRef.current) return;
                if (String(err?.code || '').toUpperCase() === 'RECONCILE_NO_DRAFT') {
                    try {
                        const res = await getBankReconciliation(id);
                        if (token !== reqTokenRef.current) return;
                        setState(res);
                        setSummary(res?.summary || null);
                        clearError();
                    } catch (e2) {
                        if (token !== reqTokenRef.current) return;
                        mapErr(e2, { onRetry: () => loadState(id) });
                    }
                } else {
                    mapErr(err, { onRetry: () => loadState(id) });
                }
            } finally {
                if (token === reqTokenRef.current && !silent) setLoading(false);
            }
        },
        [clearError, loadHistory, loadLines, mapErr],
    );

    useEffect(() => {
        resetLocal();
        if (!bankId || !canView) return undefined;
        loadState(bankId);
        return () => {
            reqTokenRef.current += 1;
        };
    }, [bankId, canView]); // eslint-disable-line react-hooks/exhaustive-deps

    const uiMode = reconcileUiState({
        hasBank: Boolean(bankId),
        canView,
        loading,
        error: errorMsg && !state ? errorMsg : '',
        state,
    });

    const lastFinished = state?.lastFinished || null;
    const draft = state?.draft || null;
    const finishOk = isReconcileFinishEnabled(summary);

    const headerLine = useMemo(() => {
        if (!lastFinished) return t('cb.recon.never');
        const bal = formatMoneyString(lastFinished.statementBalance).text;
        return t('cb.recon.last', {
            date: lastFinished.statementEndDate,
            balance: bal,
        });
    }, [lastFinished, t]);

    const onSaveDraft = async () => {
        const balance = String(stmtBalance || '').trim();
        const date = String(stmtDate || '').trim();
        if (!BALANCE_RE.test(balance)) {
            setBalanceError(t('cb.recon.err.badBalance'));
            return;
        }
        setBalanceError('');
        setSavingDraft(true);
        clearError();
        const run = async () => {
            const res = await saveBankReconciliationDraft(bankId, {
                statementEndDate: date,
                statementBalance: balance,
            });
            setState((prev) => ({
                ...(prev || {}),
                draft: res?.draft || null,
                summary: res?.summary || prev?.summary,
            }));
            setSummary(res?.summary || null);
            await loadLines(bankId, 1, appliedSearch, reqTokenRef.current);
            await loadHistory(bankId, historyPage, reqTokenRef.current);
        };
        try {
            await run();
        } catch (err) {
            mapErr(err, { onRetry: () => onSaveDraft() });
        } finally {
            setSavingDraft(false);
        }
    };

    const applyTick = async (ids, ticked, snapshot) => {
        if (!ids.length || !canManage) return;
        setTickBusy(true);
        clearError();
        setLines((prev) =>
            prev.map((row) =>
                ids.includes(String(row.journalLineId))
                    ? { ...row, ticked }
                    : row,
            ),
        );
        try {
            const res = await tickBankReconciliationLines(bankId, {
                journalLineIds: ids,
                ticked,
            });
            if (res?.summary) setSummary(res.summary);
        } catch (err) {
            setLines(snapshot);
            const code = String(err?.code || '').toUpperCase();
            mapErr(err, {
                onRetry: () => applyTick(ids, ticked, snapshot),
            });
            if (
                code === 'RECONCILE_LINE_ALREADY_CLEARED' ||
                code === 'RECONCILE_LINE_INELIGIBLE'
            ) {
                loadLines(bankId, linesPage, appliedSearch, reqTokenRef.current);
            }
            if (code === 'RECONCILE_NO_DRAFT') {
                loadState(bankId, { silent: true });
            }
        } finally {
            setTickBusy(false);
        }
    };

    const onToggleRow = (row) => {
        const snapshot = lines;
        applyTick([String(row.journalLineId)], !row.ticked, snapshot);
    };

    const onTogglePage = (ticked) => {
        const ids = pageTickIds(lines, ticked);
        if (!ids.length) return;
        applyTick(ids, ticked, lines);
    };

    const pageAllTicked =
        lines.length > 0 && lines.every((r) => r.ticked);
    const pageSomeTicked = lines.some((r) => r.ticked);

    const doFinish = async () => {
        setActionBusy(true);
        clearError();
        try {
            await finishBankReconciliation(bankId);
            setConfirmFinish(false);
            await loadState(bankId, { silent: true });
            if (typeof onAccountsRefresh === 'function') onAccountsRefresh();
        } catch (err) {
            const code = String(err?.code || '').toUpperCase();
            if (code === 'RECONCILE_NO_DRAFT') {
                setConfirmFinish(false);
                await loadState(bankId, { silent: true });
            } else {
                mapErr(err, { onRetry: () => doFinish() });
            }
        } finally {
            setActionBusy(false);
        }
    };

    const doDiscard = async () => {
        setActionBusy(true);
        clearError();
        try {
            await discardBankReconciliationDraft(bankId);
            setConfirmDiscard(false);
            await loadState(bankId, { silent: true });
            if (typeof onAccountsRefresh === 'function') onAccountsRefresh();
        } catch (err) {
            const code = String(err?.code || '').toUpperCase();
            setConfirmDiscard(false);
            await loadState(bankId, { silent: true });
            if (code !== 'RECONCILE_NO_DRAFT') {
                mapErr(err);
            }
        } finally {
            setActionBusy(false);
        }
    };

    const doUndo = async () => {
        const reason = String(undoReason || '').trim();
        if (reason.length < 3 || reason.length > 300) return;
        setActionBusy(true);
        clearError();
        try {
            await undoBankReconciliation(bankId, undoId, { reason });
            setUndoId('');
            setUndoReason('');
            await loadState(bankId, { silent: true });
            if (typeof onAccountsRefresh === 'function') onAccountsRefresh();
        } catch (err) {
            const code = String(err?.code || '').toUpperCase();
            mapErr(err);
            if (code === 'RECONCILE_UNDO_ONLY_LATEST') {
                loadHistory(bankId, historyPage, reqTokenRef.current);
            }
        } finally {
            setActionBusy(false);
        }
    };

    const goTransactions = () => {
        navigate(workshopAccountingPath('acc-transactions'));
    };

    if (!canView) {
        return (
            <p role="status" style={{ color: '#6b7280' }}>
                {t('cb.recon.noAccess')}
            </p>
        );
    }

    if (!bankId) {
        return (
            <p role="status" style={{ color: '#6b7280' }}>
                {t('cb.recon.pickBank')}
            </p>
        );
    }

    if (uiMode === 'loading' && !state) {
        return (
            <p role="status" style={{ color: '#6b7280' }}>
                {t('cb.recon.loading')}
            </p>
        );
    }

    return (
        <div data-testid="cb-reconcile-panel">
            <p style={{ margin: '0 0 12px', fontWeight: 600 }}>{headerLine}</p>

            {errorMsg ? (
                <div
                    role="alert"
                    style={{
                        marginBottom: 12,
                        padding: '10px 12px',
                        border: '1px solid #fecaca',
                        background: '#fef2f2',
                        borderRadius: 8,
                        color: '#991b1b',
                    }}
                >
                    <span>{errorMsg}</span>
                    <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                        {errorCode === 'RECONCILE_BUSY' && retryFn ? (
                            <button
                                type="button"
                                className="btn-portal-outline"
                               
                                onClick={() => retryFn()}
                            >
                                {t('cb.recon.retry')}
                            </button>
                        ) : null}
                        {errorCode === 'RECONCILE_SHARED_COA' &&
                        errorParams.primaryRegisterId &&
                        accounts.some(
                            (a) => String(a.id) === String(errorParams.primaryRegisterId),
                        ) ? (
                            <button
                                type="button"
                                className="btn-portal-dark"
                               
                                onClick={() =>
                                    onSelectBankId?.(String(errorParams.primaryRegisterId))
                                }
                            >
                                {t('cb.recon.switchPrimary')}
                            </button>
                        ) : null}
                    </div>
                </div>
            ) : null}

            {canManage ? (
                <div
                    style={{
                        display: 'flex',
                        gap: 10,
                        alignItems: 'flex-end',
                        flexWrap: 'wrap',
                        marginBottom: 16,
                    }}
                >
                    <label className="coa-range-field">
                        <span>{t('cb.reconcile.stmtEnd')}</span>
                        <input
                            type="date"
                            value={stmtDate}
                            max={riyadhToday}
                            onChange={(e) => setStmtDate(e.target.value)}
                        />
                    </label>
                    <label className="coa-range-field">
                        <span>{t('cb.reconcile.stmtBalance')}</span>
                        <input
                            type="text"
                            inputMode="decimal"
                            value={stmtBalance}
                            onChange={(e) => setStmtBalance(e.target.value)}
                            placeholder="0.00"
                        />
                    </label>
                    <button
                        type="button"
                        className="btn-portal-dark"
                       
                        disabled={savingDraft || !stmtDate || !stmtBalance}
                        onClick={onSaveDraft}
                    >
                        {savingDraft ? t('cb.recon.saving') : t('cb.recon.saveDraft')}
                    </button>
                    {balanceError ? (
                        <span style={{ color: '#dc2626', fontSize: 13 }}>{balanceError}</span>
                    ) : null}
                </div>
            ) : (
                <div style={{ marginBottom: 16, color: '#6b7280', fontSize: 13 }}>
                    {stmtDate ? (
                        <span>
                            {t('cb.reconcile.stmtEnd')}: {stmtDate}
                            {' · '}
                            {t('cb.reconcile.stmtBalance')}: SAR{' '}
                            {formatMoneyString(stmtBalance).text}
                        </span>
                    ) : null}
                </div>
            )}

            {summary ? (
                <div
                    style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 12,
                        marginBottom: 16,
                    }}
                >
                    {[
                        {
                            label: t('cb.recon.summary.statement'),
                            ...moneyTone(summary.statementBalance),
                        },
                        {
                            label: t('cb.recon.summary.cleared'),
                            ...moneyTone(summary.clearedInBooks),
                        },
                        {
                            label: t('cb.recon.summary.difference'),
                            ...diffTone(summary.difference),
                        },
                        {
                            label: t('cb.recon.summary.ticked'),
                            text: String(summary.tickedCount ?? 0),
                            color: undefined,
                        },
                    ].map((card) => (
                        <div
                            key={card.label}
                            className="acct-kpi-card"
                            style={{ minWidth: 140 }}
                        >
                            <p className="acct-kpi-label">{card.label}</p>
                            <p
                                className="acct-kpi-value"
                                style={card.color ? { color: card.color } : undefined}
                            >
                                {card.label === t('cb.recon.summary.ticked')
                                    ? card.text
                                    : `SAR ${card.text}`}
                            </p>
                        </div>
                    ))}
                </div>
            ) : null}

            {draft ? (
                <>
                    <div
                        style={{
                            display: 'flex',
                            gap: 10,
                            flexWrap: 'wrap',
                            marginBottom: 12,
                            alignItems: 'center',
                        }}
                    >
                        <input
                            value={draftSearch}
                            onChange={(e) => setDraftSearch(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    setAppliedSearch(draftSearch);
                                    setLinesPage(1);
                                    loadLines(
                                        bankId,
                                        1,
                                        draftSearch,
                                        reqTokenRef.current,
                                    );
                                }
                            }}
                            placeholder={t('cb.recon.lines.searchPh')}
                            aria-label={t('cb.recon.lines.search')}
                            style={{
                                flex: 1,
                                minWidth: 180,
                                border: '1px solid #e5e7eb',
                                borderRadius: 8,
                                padding: '8px 12px',
                                fontSize: 14,
                            }}
                        />
                        <button
                            type="button"
                            className="btn-portal-dark"
                           
                            onClick={() => {
                                setAppliedSearch(draftSearch);
                                setLinesPage(1);
                                loadLines(
                                    bankId,
                                    1,
                                    draftSearch,
                                    reqTokenRef.current,
                                );
                            }}
                        >
                            {t('date.apply')}
                        </button>
                        <button
                            type="button"
                            className="btn-portal-outline"
                           
                            onClick={() => {
                                setDraftSearch('');
                                setAppliedSearch('');
                                setLinesPage(1);
                                loadLines(bankId, 1, '', reqTokenRef.current);
                            }}
                        >
                            {t('periodClos.filter.showAll')}
                        </button>
                    </div>

                    {linesLoading ? (
                        <p role="status">{t('cb.recon.loading')}</p>
                    ) : lines.length === 0 ? (
                        <p role="status" style={{ color: '#6b7280' }}>
                            {appliedSearch
                                ? t('cb.recon.lines.emptyFiltered')
                                : t('cb.recon.lines.empty')}
                        </p>
                    ) : (
                        <div style={{ overflowX: 'auto', marginBottom: 12 }}>
                            <table className="data-table" style={{ width: '100%' }}>
                                <thead>
                                    <tr>
                                        <th style={{ width: 44 }}>
                                            {canManage ? (
                                                <input
                                                    type="checkbox"
                                                    checked={pageAllTicked}
                                                    ref={(el) => {
                                                        if (el) {
                                                            el.indeterminate =
                                                                pageSomeTicked &&
                                                                !pageAllTicked;
                                                        }
                                                    }}
                                                    disabled={tickBusy}
                                                    aria-label={t('cb.recon.lines.selectPage')}
                                                    onChange={(e) =>
                                                        onTogglePage(e.target.checked)
                                                    }
                                                />
                                            ) : null}
                                        </th>
                                        <th>{t('cb.recon.th.date')}</th>
                                        <th>{t('cb.recon.th.reference')}</th>
                                        <th>{t('cb.recon.th.description')}</th>
                                        <th>{t('cb.recon.th.amount')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {lines.map((row) => {
                                        const amt = moneyTone(row.amount);
                                        return (
                                            <tr key={row.journalLineId}>
                                                <td>
                                                    {canManage ? (
                                                        <input
                                                            type="checkbox"
                                                            checked={Boolean(row.ticked)}
                                                            disabled={tickBusy}
                                                            onChange={() => onToggleRow(row)}
                                                        />
                                                    ) : row.ticked ? (
                                                        '✓'
                                                    ) : (
                                                        ''
                                                    )}
                                                </td>
                                                <td>{row.date}</td>
                                                <td>{row.reference}</td>
                                                <td>{row.description}</td>
                                                <td style={amt.color ? { color: amt.color } : undefined}>
                                                    SAR {amt.text}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            <PaginationControls
                                total={linesTotal}
                                limit={PAGE_SIZE}
                                offset={(linesPage - 1) * PAGE_SIZE}
                                onPageChange={(nextOffset) => {
                                    const nextPage =
                                        Math.floor(Number(nextOffset) / PAGE_SIZE) + 1;
                                    setLinesPage(nextPage);
                                    loadLines(
                                        bankId,
                                        nextPage,
                                        appliedSearch,
                                        reqTokenRef.current,
                                    );
                                }}
                                loading={linesLoading}
                            />
                        </div>
                    )}

                    {canManage ? (
                        <div
                            style={{
                                display: 'flex',
                                gap: 8,
                                flexWrap: 'wrap',
                                marginBottom: 16,
                                alignItems: 'center',
                            }}
                        >
                            <button
                                type="button"
                                className="btn-portal-dark"
                                disabled={!finishOk || actionBusy}
                                onClick={() => {
                                    setConfirmDiscard(false);
                                    setConfirmFinish(true);
                                }}
                            >
                                {t('cb.recon.finish')}
                            </button>
                            <button
                                type="button"
                                className="btn-portal-outline"
                                disabled={actionBusy}
                                onClick={() => {
                                    setConfirmFinish(false);
                                    setConfirmDiscard(true);
                                }}
                            >
                                {t('cb.recon.discard')}
                            </button>
                            <button
                                type="button"
                                className="btn-portal-outline"
                                onClick={goTransactions}
                            >
                                {t('cb.recon.addBankFee')}
                            </button>
                        </div>
                    ) : null}

                    {confirmFinish ? (
                        <div
                            style={{
                                marginBottom: 16,
                                padding: 12,
                                border: '1px solid #e5e7eb',
                                borderRadius: 8,
                            }}
                        >
                            <p style={{ margin: '0 0 8px' }}>
                                {t('cb.recon.finishConfirm', {
                                    date: draft.statementEndDate,
                                    n: summary?.tickedCount ?? 0,
                                })}
                            </p>
                            <button
                                type="button"
                                className="btn-portal-dark"
                                style={{ marginInlineEnd: 8 }}
                                disabled={actionBusy}
                                onClick={doFinish}
                            >
                                {t('cb.recon.confirm')}
                            </button>
                            <button
                                type="button"
                                className="btn-portal-outline"
                                disabled={actionBusy}
                                onClick={() => setConfirmFinish(false)}
                            >
                                {t('cb.recon.cancel')}
                            </button>
                        </div>
                    ) : null}

                    {confirmDiscard ? (
                        <div
                            style={{
                                marginBottom: 16,
                                padding: 12,
                                border: '1px solid #e5e7eb',
                                borderRadius: 8,
                            }}
                        >
                            <p style={{ margin: '0 0 8px' }}>
                                {t('cb.recon.discardConfirm')}
                            </p>
                            <button
                                type="button"
                                className="btn-portal-dark"
                                style={{ marginInlineEnd: 8 }}
                                disabled={actionBusy}
                                onClick={doDiscard}
                            >
                                {t('cb.recon.confirm')}
                            </button>
                            <button
                                type="button"
                                className="btn-portal-outline"
                                disabled={actionBusy}
                                onClick={() => setConfirmDiscard(false)}
                            >
                                {t('cb.recon.cancel')}
                            </button>
                        </div>
                    ) : null}
                </>
            ) : null}

            <h3 style={{ fontSize: 16, margin: '8px 0 12px' }}>{t('cb.recon.history')}</h3>
            {historyLoading ? (
                <p role="status">{t('cb.recon.loading')}</p>
            ) : history.length === 0 ? (
                <p role="status" style={{ color: '#6b7280' }}>
                    {t('cb.recon.history.empty')}
                </p>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <table className="data-table" style={{ width: '100%' }}>
                        <thead>
                            <tr>
                                <th>{t('cb.recon.th.date')}</th>
                                <th>{t('cb.recon.summary.statement')}</th>
                                <th>{t('cb.recon.summary.cleared')}</th>
                                <th>{t('cb.th.status')}</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {history.map((row) => {
                                const isLatest =
                                    lastFinished && String(row.id) === String(lastFinished.id);
                                const stmt = moneyTone(row.statementBalance);
                                const cleared = moneyTone(row.clearedBalance || '0.00');
                                return (
                                    <React.Fragment key={row.id}>
                                        <tr>
                                            <td>{row.statementEndDate}</td>
                                            <td style={stmt.color ? { color: stmt.color } : undefined}>
                                                SAR {stmt.text}
                                            </td>
                                            <td
                                                style={
                                                    cleared.color ? { color: cleared.color } : undefined
                                                }
                                            >
                                                SAR {cleared.text}
                                            </td>
                                            <td>
                                                {row.status === 'undone'
                                                    ? `${t('cb.recon.status.undone')}${
                                                          row.undoReason
                                                              ? ` — ${row.undoReason}`
                                                              : ''
                                                      }`
                                                    : t('cb.recon.status.finished')}
                                                {row.finishedAt ? (
                                                    <div style={{ fontSize: 12, color: '#6b7280' }}>
                                                        {String(row.finishedAt).slice(0, 19)}
                                                    </div>
                                                ) : null}
                                            </td>
                                            <td>
                                                {canManage && isLatest && row.status === 'finished' ? (
                                                    <button
                                                        type="button"
                                                        className="btn-portal-outline"
                                                       
                                                        onClick={() => {
                                                            setUndoId(String(row.id));
                                                            setUndoReason('');
                                                        }}
                                                    >
                                                        {t('cb.recon.undo')}
                                                    </button>
                                                ) : null}
                                            </td>
                                        </tr>
                                        {undoId === String(row.id) ? (
                                            <tr>
                                                <td colSpan={5}>
                                                    <div style={{ padding: '8px 0' }}>
                                                        <label className="form-label">
                                                            {t('cb.recon.undoReason')} (
                                                            {String(undoReason).trim().length}/300)
                                                        </label>
                                                        <textarea
                                                            value={undoReason}
                                                            maxLength={300}
                                                            rows={3}
                                                            placeholder={t('cb.recon.undoReasonPh')}
                                                            onChange={(e) =>
                                                                setUndoReason(e.target.value)
                                                            }
                                                            style={{
                                                                width: '100%',
                                                                boxSizing: 'border-box',
                                                                marginBottom: 8,
                                                            }}
                                                        />
                                                        <button
                                                            type="button"
                                                            className="btn-portal-dark"
                                                            style={{ marginInlineEnd: 8 }}
                                                            disabled={
                                                                actionBusy ||
                                                                String(undoReason).trim().length < 3
                                                            }
                                                            onClick={doUndo}
                                                        >
                                                            {t('cb.recon.confirm')}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn-portal-outline"
                                                            disabled={actionBusy}
                                                            onClick={() => {
                                                                setUndoId('');
                                                                setUndoReason('');
                                                            }}
                                                        >
                                                            {t('cb.recon.cancel')}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : null}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                    <PaginationControls
                        total={historyTotal}
                        limit={PAGE_SIZE}
                        offset={(historyPage - 1) * PAGE_SIZE}
                        onPageChange={(nextOffset) => {
                            const nextPage =
                                Math.floor(Number(nextOffset) / PAGE_SIZE) + 1;
                            setHistoryPage(nextPage);
                            loadHistory(bankId, nextPage, reqTokenRef.current);
                        }}
                        loading={historyLoading}
                    />
                </div>
            )}
        </div>
    );
}
