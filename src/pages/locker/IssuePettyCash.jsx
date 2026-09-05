import React, { useCallback, useEffect, useState } from 'react';
import { Coins, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { qs } from '../../services/workshopStaffApi';

const fmtSar = (n) =>
    `SAR ${Number(n || 0).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

export default function IssuePettyCash({
    selectedBranchId = 'all',
    branchLockedId = null,
} = {}) {
    const scopeBranch = branchLockedId || (selectedBranchId !== 'all' ? selectedBranchId : undefined);
    const [cashiers, setCashiers] = useState([]);
    const [overview, setOverview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState({
        cashierUserId: '',
        amount: '',
        reference: '',
        issuedAt: new Date().toISOString().slice(0, 10),
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(null);
    const [history, setHistory] = useState([]);

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
            setError(e?.message || 'Failed to load data');
        } finally {
            setLoading(false);
        }
    }, [scopeBranch]);

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
            setError('Select a cashier');
            return;
        }
        if (!(amt > 0)) {
            setError('Amount must be greater than 0');
            return;
        }
        if (amt > lockerBalance + 0.01) {
            const ok = window.confirm(
                `Issue amount ${fmtSar(amt)} is greater than locker vault balance ${fmtSar(
                    lockerBalance,
                )}. Continue anyway?`,
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
            if (res?.success === false) throw new Error(res?.message || 'Failed to issue');
            setSuccess(res);
            setForm((f) => ({ ...f, amount: '', reference: '' }));
            await load();
        } catch (e) {
            setError(e?.message || 'Issue failed');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="wlk-page">
            <div className="wlk-topbar">
                <div>
                    <h2 className="wlk-title">Issue Petty Cash to Cashier</h2>
                    <p className="wlk-subtitle">
                        Hand a petty-cash float from the locker vault (1004) to a cashier.
                        This credits their wallet and posts the GL entry automatically.
                    </p>
                </div>
                <button className="btn-secondary" onClick={load} disabled={loading}>
                    <RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh
                </button>
            </div>

            <div className="wlk-grid wlk-grid--kpi">
                <div className="wlk-stat wlk-stat--info">
                    <div className="wlk-stat-icon"><Coins size={18} /></div>
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
                        <CheckCircle size={14} /> Float issued — JE #{success.journalId}
                    </div>
                ) : null}
                <div className="wlk-grid wlk-grid--form">
                    <label>
                        <span>Cashier</span>
                        <select
                            value={form.cashierUserId}
                            onChange={(e) =>
                                setForm((f) => ({ ...f, cashierUserId: e.target.value }))
                            }
                            required
                        >
                            <option value="">Select cashier…</option>
                            {cashiers.map((c) => (
                                <option key={c.userId || c.id} value={c.userId || c.id}>
                                    {c.name || c.email || `Cashier ${c.userId || c.id}`}
                                    {c.branchName ? ` — ${c.branchName}` : ''}
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
                        <span>Issue date</span>
                        <input
                            type="date"
                            value={form.issuedAt}
                            onChange={(e) =>
                                setForm((f) => ({ ...f, issuedAt: e.target.value }))
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
                            placeholder="Weekly float, ad-hoc top-up, etc."
                        />
                    </label>
                </div>
                <div className="wlk-create-user-footer">
                    <button className="btn-primary" type="submit" disabled={submitting}>
                        <Coins size={14} /> {submitting ? 'Posting…' : 'Issue & Post GL'}
                    </button>
                </div>
            </form>

            <div className="wlk-section">
                <div className="wlk-section-header">
                    <h3>Recent petty cash floats issued<span className="wlk-count">{history.length}</span></h3>
                    <p className="wlk-subtitle" style={{ margin: 0 }}>
                        Full filtered log: open <strong>Petty Cash Issue Log</strong> in the sidebar.
                    </p>
                </div>
                <div className="wlk-section-body">
                    <table className="wlk-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Cashier</th>
                                <th>Branch</th>
                                <th>Amount</th>
                                <th>Reference</th>
                                <th>JE</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="wlk-empty">
                                        No floats issued yet
                                    </td>
                                </tr>
                            ) : (
                                history.map((p) => (
                                    <tr key={p.id}>
                                        <td>{p.date || (p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '—')}</td>
                                        <td>{p.cashierName || '—'}</td>
                                        <td>{p.branchName || '—'}</td>
                                        <td>{fmtSar(p.amount)}</td>
                                        <td>{p.description || '—'}</td>
                                        <td>{p.journalEntryNumber || '—'}</td>
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
