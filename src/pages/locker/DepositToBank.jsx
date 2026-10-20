import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Send, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { qs } from '../../services/workshopStaffApi';
import SearchSelect from '../../components/SearchSelect';
import WsTableScroll from '../../components/workshop/WsTableScroll';
import { usePagedRows } from '../../hooks/usePagedRows';
import LockerTablePager from './LockerTablePager';
import { useLockerPortal } from './useLockerPortal';
import { toRiyadhDateISO } from '../../utils/riyadhBusinessRange';

export default function DepositToBank() {
    const { t, can, money, dateTime } = useLockerPortal();
    const canCreate = can('deposits.create');
    const [accounts, setAccounts] = useState([]);
    const [overview, setOverview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState({
        cashBankAccountId: '',
        amount: '',
        reference: '',
        depositedAt: toRiyadhDateISO(),
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(null);
    const [history, setHistory] = useState([]);
    const historyTopRef = useRef(null);
    const { pagedRows: pagedHistory, pagerProps: historyPager } = usePagedRows(history, {
        scrollRef: historyTopRef,
    });

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            // Locker users may not have workshop-staff role; try locker dashboard for
            // KPIs and fall back to the workshop-admin overview if available.
            const [regRes, adminOverview] = await Promise.all([
                apiFetch('/locker/bank-registers').catch(() => ({ registers: [] })),
                apiFetch(
                    `/workshop-staff/locker-management/overview${qs({ _t: Date.now() })}`,
                ).catch(() => null),
            ]);
            setAccounts(regRes?.registers || []);
            setOverview(adminOverview);
            setHistory(adminOverview?.recentBankDeposits || []);
        } catch (e) {
            setError(e?.message || t('err.load'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        load();
    }, [load]);

    const lockerBalance =
        overview?.kpis?.lockerVaultBalance ??
        overview?.lockerVaultBalance ??
        0;

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess(null);
        const amt = Number(form.amount);
        if (!form.cashBankAccountId) {
            setError(t('deposit.errSelectRegister'));
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
            const res = await apiFetch('/locker/deposit-to-bank', {
                method: 'POST',
                body: JSON.stringify({
                    cashBankAccountId: form.cashBankAccountId,
                    amount: amt,
                    reference: form.reference || undefined,
                    depositedAt: form.depositedAt || undefined,
                }),
            });
            if (res?.success === false) throw new Error(res?.message || t('deposit.errDeposit'));
            setSuccess(res);
            setForm((f) => ({ ...f, amount: '', reference: '' }));
            await load();
        } catch (e) {
            setError(e?.message || t('deposit.errDeposit'));
        } finally {
            setSubmitting(false);
        }
    };

    const selectedAcc = useMemo(
        () => accounts.find((a) => String(a.id) === String(form.cashBankAccountId)),
        [accounts, form.cashBankAccountId],
    );
    const accountOptions = useMemo(
        () =>
            accounts.map((a) => ({
                value: String(a.id),
                label: a.name,
                hint: [a.branch?.name, a.currentBalance != null ? money(a.currentBalance) : null]
                    .filter(Boolean)
                    .join(' · '),
            })),
        [accounts, money],
    );

    return (
        <div className="wlk-page">
            <div className="wlk-topbar">
                <div>
                    <h2 className="wlk-title">{t('deposit.title')}</h2>
                    <p className="wlk-subtitle">{t('deposit.sub')}</p>
                </div>
                <button className="btn-secondary" onClick={load} disabled={loading}>
                    <RefreshCw size={16} className={loading ? 'spin' : ''} /> {t('common.refresh')}
                </button>
            </div>

            <div className="wlk-grid wlk-grid--kpi">
                <div className="wlk-stat wlk-stat--info">
                    <div className="wlk-stat-icon"><Send size={18} /></div>
                    <div className="wlk-stat-body">
                        <div className="wlk-stat-label">{t('common.vaultBalance')}</div>
                        <div className="wlk-stat-value">{money(lockerBalance)}</div>
                        <div className="wlk-stat-hint">{t('common.vaultHint')}</div>
                    </div>
                </div>
            </div>

            {canCreate ? (
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
                            <CheckCircle size={14} /> {t('deposit.success', { je: success.journalId })}{' '}
                            <code>{success.reference}</code>
                        </div>
                    ) : null}
                    <div className="wlk-grid wlk-grid--form">
                        <label>
                            <span>{t('deposit.register')}</span>
                            <SearchSelect
                                options={accountOptions}
                                value={form.cashBankAccountId}
                                onChange={(v) => setForm((f) => ({ ...f, cashBankAccountId: String(v) }))}
                                required
                                ariaLabel={t('deposit.register')}
                                placeholder={t('deposit.selectRegister')}
                                emptyHint={t('common.noMatches')}
                                menuMinWidth={320}
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
                            <span>{t('deposit.date')}</span>
                            <input
                                type="date"
                                value={form.depositedAt}
                                onChange={(e) =>
                                    setForm((f) => ({ ...f, depositedAt: e.target.value }))
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
                                placeholder={t('deposit.refPh')}
                            />
                        </label>
                    </div>
                    {selectedAcc ? (
                        <p className="wlk-stat-hint" style={{ marginTop: 8 }}>
                            {t('deposit.willCreditBefore')} <strong>{selectedAcc.name}</strong> (
                            {selectedAcc.coaAccount?.code}) {t('deposit.willCreditAfter')}
                        </p>
                    ) : null}
                    <div className="wlk-create-user-footer">
                        <button className="btn-primary" type="submit" disabled={submitting}>
                            <Send size={14} /> {submitting ? t('common.posting') : t('deposit.submit')}
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
                    <h3>{t('deposit.recent')}<span className="wlk-count">{history.length}</span></h3>
                </div>
                <div className="wlk-section-body">
                    <WsTableScroll>
                    <table className="wlk-table">
                        <thead>
                            <tr>
                                <th>{t('common.reference')}</th>
                                <th>{t('deposit.th.register')}</th>
                                <th>{t('common.branch')}</th>
                                <th>{t('common.amount')}</th>
                                <th>{t('common.date')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="wlk-empty">
                                        {t('deposit.empty')}
                                    </td>
                                </tr>
                            ) : (
                                pagedHistory.map((d) => (
                                    <tr key={d.id}>
                                        <td><code>{d.reference || t('emdash')}</code></td>
                                        <td>{d.registerName}</td>
                                        <td>{d.branchName || t('emdash')}</td>
                                        <td>{money(d.amount)}</td>
                                        <td>{dateTime(d.entryDate)}</td>
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
