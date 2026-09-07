import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Send, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { qs } from '../../services/workshopStaffApi';

const fmtSar = (n) =>
    `SAR ${Number(n || 0).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

export default function DepositToBank() {
    const [accounts, setAccounts] = useState([]);
    const [overview, setOverview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState({
        cashBankAccountId: '',
        amount: '',
        reference: '',
        depositedAt: new Date().toISOString().slice(0, 10),
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(null);
    const [history, setHistory] = useState([]);

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
            setError(e?.message || 'Failed to load data');
        } finally {
            setLoading(false);
        }
    }, []);

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
            setError('Select a bank register');
            return;
        }
        if (!(amt > 0)) {
            setError('Amount must be greater than 0');
            return;
        }
        if (amt > lockerBalance + 0.01) {
            const ok = window.confirm(
                `Deposit amount ${fmtSar(amt)} is greater than locker vault balance ${fmtSar(
                    lockerBalance,
                )}. Continue anyway?`,
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
            if (res?.success === false) throw new Error(res?.message || 'Failed to deposit');
            setSuccess(res);
            setForm((f) => ({ ...f, amount: '', reference: '' }));
            await load();
        } catch (e) {
            setError(e?.message || 'Deposit failed');
        } finally {
            setSubmitting(false);
        }
    };

    const selectedAcc = useMemo(
        () => accounts.find((a) => String(a.id) === String(form.cashBankAccountId)),
        [accounts, form.cashBankAccountId],
    );

    return (
        <div className="wlk-page">
            <div className="wlk-topbar">
                <div>
                    <h2 className="wlk-title">Deposit to Bank</h2>
                    <p className="wlk-subtitle">
                        Move collected cash from the locker vault (1004) into a workshop
                        bank register. This posts the GL entry automatically.
                    </p>
                </div>
                <button className="btn-secondary" onClick={load} disabled={loading}>
                    <RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh
                </button>
            </div>

            <div className="wlk-grid wlk-grid--kpi">
                <div className="wlk-stat wlk-stat--info">
                    <div className="wlk-stat-icon"><Send size={18} /></div>
                    <div className="wlk-stat-body">
                        <div className="wlk-stat-label">Locker vault balance</div>
                        <div className="wlk-stat-value">{fmtSar(lockerBalance)}</div>
                        <div className="wlk-stat-hint">1004 Cash in Transit — Locker</div>
                    </div>
                </div>
            </div>

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
                        <CheckCircle size={14} /> Deposit recorded — JE #{success.journalId},
                        reference <code>{success.reference}</code>
                    </div>
                ) : null}
                <div className="wlk-grid wlk-grid--form">
                    <label>
                        <span>Bank register</span>
                        <select
                            value={form.cashBankAccountId}
                            onChange={(e) =>
                                setForm((f) => ({ ...f, cashBankAccountId: e.target.value }))
                            }
                            required
                        >
                            <option value="">Select bank register…</option>
                            {accounts.map((a) => (
                                <option key={a.id} value={a.id}>
                                    {a.name}
                                    {a.branch?.name ? ` — ${a.branch.name}` : ''}
                                    {a.currentBalance != null ? ` (${fmtSar(a.currentBalance)})` : ''}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        <span>Amount (SAR)</span>
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
                        <span>Deposit date</span>
                        <input
                            type="date"
                            value={form.depositedAt}
                            onChange={(e) =>
                                setForm((f) => ({ ...f, depositedAt: e.target.value }))
                            }
                        />
                    </label>
                    <label>
                        <span>Reference (optional)</span>
                        <input
                            value={form.reference}
                            onChange={(e) =>
                                setForm((f) => ({ ...f, reference: e.target.value }))
                            }
                            placeholder="Bank slip #, branch run, etc."
                        />
                    </label>
                </div>
                {selectedAcc ? (
                    <p className="wlk-stat-hint" style={{ marginTop: 8 }}>
                        Will credit <strong>{selectedAcc.name}</strong> ({selectedAcc.coaAccount?.code}) and clear locker vault by the same amount.
                    </p>
                ) : null}
                <div className="wlk-create-user-footer">
                    <button className="btn-primary" type="submit" disabled={submitting}>
                        <Send size={14} /> {submitting ? 'Posting…' : 'Deposit & Post GL'}
                    </button>
                </div>
            </form>

            <div className="wlk-section">
                <div className="wlk-section-header">
                    <h3>Recent locker → bank deposits<span className="wlk-count">{history.length}</span></h3>
                </div>
                <div className="wlk-section-body">
                    <table className="wlk-table">
                        <thead>
                            <tr>
                                <th>Reference</th>
                                <th>Register</th>
                                <th>Branch</th>
                                <th>Amount</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="wlk-empty">
                                        No deposits yet
                                    </td>
                                </tr>
                            ) : (
                                history.map((d) => (
                                    <tr key={d.id}>
                                        <td><code>{d.reference || '—'}</code></td>
                                        <td>{d.registerName}</td>
                                        <td>{d.branchName || '—'}</td>
                                        <td>{fmtSar(d.amount)}</td>
                                        <td>{new Date(d.entryDate).toLocaleString()}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
