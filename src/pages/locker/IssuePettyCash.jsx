import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Coins, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { qs } from '../../services/workshopStaffApi';
import SearchSelect from '../../components/SearchSelect';
import WsTableScroll from '../../components/workshop/WsTableScroll';
import { usePagedRows } from '../../hooks/usePagedRows';
import LockerTablePager from './LockerTablePager';
import { useLockerPortal } from './useLockerPortal';
import { toRiyadhDateISO } from '../../utils/riyadhBusinessRange';

export default function IssuePettyCash({
    selectedBranchId = 'all',
    branchLockedId = null,
} = {}) {
    const { t, can, money, date } = useLockerPortal();
    const dash = t('emdash');
    const canIssue = can('pettyCash.issue');
    const scopeBranch = branchLockedId || (selectedBranchId !== 'all' ? selectedBranchId : undefined);
    const [cashiers, setCashiers] = useState([]);
    const [overview, setOverview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState({
        cashierUserId: '',
        amount: '',
        reference: '',
        issuedAt: toRiyadhDateISO(),
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(null);
    const [history, setHistory] = useState([]);
    const historyTopRef = useRef(null);
    const { pagedRows: pagedHistory, pagerProps: historyPager } = usePagedRows(history, {
        scrollRef: historyTopRef,
    });
    const cashierOptions = useMemo(
        () =>
            cashiers.map((c) => {
                const id = String(c.userId || c.id);
                return {
                    value: id,
                    label: c.name || c.email || t('common.cashierFallback', { id }),
                    hint: c.branchName || undefined,
                };
            }),
        [cashiers, t],
    );

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const branchQs = scopeBranch ? { branchId: scopeBranch } : {};
            const [cashRes, overRes, logRes] = await Promise.all([
                apiFetch('/locker/cashiers').catch(() => ({ cashiers: [] })),
                apiFetch(`/locker/dashboard${qs({ view: 'supervisor', ...branchQs })}`).catch(() => null),
                apiFetch(`/locker/petty-cash-issues${qs({ limit: 15, ...branchQs })}`).catch(() => ({ issues: [] })),
            ]);
            let list = cashRes?.cashiers || [];
            if (scopeBranch) {
                list = list.filter((c) => !c.branchId || String(c.branchId) === String(scopeBranch));
            }
            setCashiers(list);
            setOverview(overRes);
            setHistory(Array.isArray(logRes?.issues) ? logRes.issues : []);
        } catch (e) {
            setError(e?.message || t('err.load'));
        } finally {
            setLoading(false);
        }
    }, [scopeBranch, t]);

    useEffect(() => {
        load();
    }, [load]);

    const lockerBalance =
        overview?.kpis?.lockerVaultBalance ??
        overview?.lockerVaultBalance ??
        overview?.monthlyCollected ??
        0;

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess(null);
        const amt = Number(form.amount);
        if (!form.cashierUserId) {
            setError(t('err.selectCashier'));
            return;
        }
        if (!(amt > 0)) {
            setError(t('err.amountPositive'));
            return;
        }
        if (amt > lockerBalance + 0.01) {
            const ok = window.confirm(
                t('confirm.overVault', { amount: money(amt), balance: money(lockerBalance) }),
            );
            if (!ok) return;
        }
        setSubmitting(true);
        try {
            const res = await apiFetch('/locker/issue-petty-cash', {
                method: 'POST',
                body: JSON.stringify({
                    cashierUserId: form.cashierUserId,
                    amount: amt,
                    reference: form.reference || undefined,
                    issuedAt: form.issuedAt || undefined,
                }),
            });
            if (res?.success === false) throw new Error(res?.message || t('issue.errIssue'));
            setSuccess(res);
            setForm((f) => ({ ...f, amount: '', reference: '' }));
            await load();
        } catch (e) {
            setError(e?.message || t('issue.errIssue'));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="wlk-page">
            <div className="wlk-topbar">
                <div>
                    <h2 className="wlk-title">{t('issue.title')}</h2>
                    <p className="wlk-subtitle">{t('issue.sub')}</p>
                </div>
                <button className="btn-secondary" onClick={load} disabled={loading}>
                    <RefreshCw size={16} className={loading ? 'spin' : ''} /> {t('common.refresh')}
                </button>
            </div>

            <div className="wlk-grid wlk-grid--kpi">
                <div className="wlk-stat wlk-stat--info">
                    <div className="wlk-stat-icon"><Coins size={18} /></div>
                    <div className="wlk-stat-body">
                        <div className="wlk-stat-label">{t('common.vaultBalance')}</div>
                        <div className="wlk-stat-value">{money(lockerBalance)}</div>
                        <div className="wlk-stat-hint">{t('common.vaultHint')}</div>
                    </div>
                </div>
            </div>

            {canIssue ? (
                <form className="wlk-create-user" onSubmit={submit}>
                    {error ? (
                        <div className="wlk-error" style={{ marginBottom: 12 }}>
                            <AlertTriangle size={14} /> {error}
                        </div>
                    ) : null}
                    {success ? (
                        <div
                            className="wlk-error"
                            style={{
                                marginBottom: 12,
                                background: '#dcfce7',
                                color: '#15803d',
                                borderColor: '#bbf7d0',
                            }}
                        >
                            <CheckCircle size={14} /> {t('issue.success', { je: success.journalId })}
                        </div>
                    ) : null}
                    <div className="wlk-grid wlk-grid--form">
                        <label>
                            <span>{t('common.cashier')}</span>
                            <SearchSelect
                                options={cashierOptions}
                                value={form.cashierUserId}
                                onChange={(v) => setForm((f) => ({ ...f, cashierUserId: String(v) }))}
                                required
                                ariaLabel={t('common.cashier')}
                                placeholder={t('issue.selectCashier')}
                                emptyHint={t('common.noMatches')}
                                menuMinWidth={300}
                            />
                        </label>
                        <label>
                            <span>{t('common.amountSar')}</span>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={form.amount}
                                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                                required
                            />
                        </label>
                        <label>
                            <span>{t('issue.date')}</span>
                            <input
                                type="date"
                                value={form.issuedAt}
                                onChange={(e) =>
                                    setForm((f) => ({ ...f, issuedAt: e.target.value }))
                                }
                            />
                        </label>
                        <label>
                            <span>{t('common.referenceOptional')}</span>
                            <input
                                value={form.reference}
                                onChange={(e) =>
                                    setForm((f) => ({ ...f, reference: e.target.value }))
                                }
                                placeholder={t('issue.refPh')}
                            />
                        </label>
                    </div>
                    <div className="wlk-create-user-footer">
                        <button className="btn-primary" type="submit" disabled={submitting}>
                            <Coins size={14} /> {submitting ? t('common.posting') : t('issue.submit')}
                        </button>
                    </div>
                </form>
            ) : error ? (
                <div className="wlk-error" style={{ marginBottom: 12 }}>
                    <AlertTriangle size={14} /> {error}
                </div>
            ) : null}

            <div className="wlk-section" ref={historyTopRef}>
                <div className="wlk-section-header">
                    <h3>{t('issue.recent')}<span className="wlk-count">{history.length}</span></h3>
                    <p className="wlk-subtitle" style={{ margin: 0 }}>
                        {t('issue.fullLog')}
                    </p>
                </div>
                <div className="wlk-section-body">
                    <WsTableScroll>
                    <table className="wlk-table">
                        <thead>
                            <tr>
                                <th>{t('common.date')}</th>
                                <th>{t('common.cashier')}</th>
                                <th>{t('common.branch')}</th>
                                <th>{t('common.amount')}</th>
                                <th>{t('common.reference')}</th>
                                <th>{t('common.je')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="wlk-empty">
                                        {t('issue.empty')}
                                    </td>
                                </tr>
                            ) : (
                                pagedHistory.map((p) => (
                                    <tr key={p.id}>
                                        <td>{p.date || date(p.createdAt)}</td>
                                        <td>{p.cashierName || dash}</td>
                                        <td>{p.branchName || dash}</td>
                                        <td>{money(p.amount)}</td>
                                        <td>{p.description || dash}</td>
                                        <td>{p.journalEntryNumber || dash}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                    </WsTableScroll>
                    <LockerTablePager {...historyPager} />
                </div>
            </div>
        </div>
    );
}
