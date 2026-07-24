import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Plus, Bell, Wallet, TrendingDown } from 'lucide-react';
import { listSalaryAdvances, createSalaryAdvance, updateSalaryAdvance } from '../../../services/staffAppApi';
import { useStaffAppScope, staffAppQueryParams } from '../../../context/StaffAppScopeContext';

function statusBadge(status) {
    const s = String(status || '').toLowerCase();
    let cls = 'staff-app-badge--pending';
    if (['finance approved', 'credited', 'settled'].includes(s)) cls = 'staff-app-badge--approved';
    if (s === 'rejected') cls = 'staff-app-badge--rejected';
    return <span className={`staff-app-badge ${cls}`}>{status || '—'}</span>;
}

const fmt = (n) => Number(n || 0).toLocaleString('en-SA', { minimumFractionDigits: 2 });

const ACTIVE_LOAN_STATUSES = new Set([
    'Pending',
    'Manager Approved',
    'Finance Approved',
    'Credited',
]);

export default function StaffAppSalaryAdvances() {
    const scope = useStaffAppScope();
    const [section, setSection] = useState('salary');
    const [rows, setRows] = useState([]);
    const [totalOutstanding, setTotalOutstanding] = useState(0);
    const [activeLoanCount, setActiveLoanCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [formOpen, setFormOpen] = useState(false);
    const [form, setForm] = useState({ requestedAmount: '', reason: '' });

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await listSalaryAdvances(staffAppQueryParams({ limit: 100 }, scope));
            setRows(res?.items ?? res?.data?.items ?? []);
            setTotalOutstanding(Number(res?.totalOutstanding ?? 0));
            setActiveLoanCount(Number(res?.activeLoanCount ?? 0));
        } catch (e) {
            setError(e?.message || 'Could not load salary advances.');
            setRows([]);
            setTotalOutstanding(0);
            setActiveLoanCount(0);
        } finally {
            setLoading(false);
        }
    }, [scope]);

    useEffect(() => { load(); }, [load]);

    const activeLoans = useMemo(
        () => rows.filter((r) => ACTIVE_LOAN_STATUSES.has(r.status) && Number(r.remainingBalance) > 0),
        [rows],
    );

    const handleCreate = async () => {
        const amt = Number(form.requestedAmount);
        if (!Number.isFinite(amt) || amt <= 0) {
            setError('Valid amount required.');
            return;
        }
        try {
            await createSalaryAdvance({
                requestedAmount: amt,
                reason: form.reason.trim() || 'Advance request',
            }, scope.scopeParams());
            setFormOpen(false);
            setForm({ requestedAmount: '', reason: '' });
            setSection('advances');
            await load();
        } catch (e) {
            setError(e?.message || 'Create failed.');
        }
    };

    const handleAction = async (id, action) => {
        try {
            await updateSalaryAdvance(id, { action }, scope.scopeParams());
            await load();
        } catch (e) {
            setError(e?.message || 'Action failed.');
        }
    };

    return (
        <div>
            <div className="staff-app-toolbar">
                <h2 style={{ margin: 0, fontSize: '1.125rem', flex: 1 }}>Salary &amp; Advances</h2>
                {section === 'advances' && (
                    <button type="button" className="staff-app-btn staff-app-btn--primary" onClick={() => setFormOpen(true)}>
                        <Plus size={14} /> New advance request
                    </button>
                )}
                <button type="button" className="staff-app-btn" onClick={load} disabled={loading}>
                    <RefreshCw size={14} />
                </button>
            </div>

            <div className="staff-app-inner-tabs" style={{ marginBottom: 16 }}>
                <button
                    type="button"
                    className={`staff-app-subnav__btn ${section === 'salary' ? 'active' : ''}`}
                    onClick={() => setSection('salary')}
                >
                    Salary
                </button>
                <button
                    type="button"
                    className={`staff-app-subnav__btn ${section === 'advances' ? 'active' : ''}`}
                    onClick={() => setSection('advances')}
                >
                    Advance / Loan
                </button>
            </div>

            {error && <p style={{ color: '#b91c1c', marginBottom: 8 }}>{error}</p>}

            {section === 'salary' && (
                <div className="staff-app-info-panel">
                    <div className="staff-app-info-panel__icon">
                        <Bell size={28} />
                    </div>
                    <div>
                        <h3 style={{ margin: '0 0 8px', fontSize: '1rem' }}>Your salary slip is not ready yet</h3>
                        <p style={{ margin: 0, color: '#4b5563', lineHeight: 1.55, fontSize: '0.9rem' }}>
                            When payroll is processed for this month, your salary details will appear here
                            (gross pay, deductions, and net amount). You will receive an in-app notification
                            as soon as your salary is ready to view.
                        </p>
                        <p style={{ margin: '12px 0 0', color: '#6b7280', fontSize: '0.8125rem' }}>
                            Workshop admins post salary from Accounting → Salary. Outdoor staff see the slip
                            in this tab after posting.
                        </p>
                    </div>
                </div>
            )}

            {section === 'advances' && (
                <>
                    <div className="staff-app-card-grid" style={{ marginBottom: 16 }}>
                        <div className="staff-app-stat-card">
                            <h3><Wallet size={14} style={{ marginRight: 6 }} />Outstanding loan balance</h3>
                            <p>{fmt(totalOutstanding)} <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>SAR</span></p>
                        </div>
                        <div className="staff-app-stat-card">
                            <h3><TrendingDown size={14} style={{ marginRight: 6 }} />Active advances</h3>
                            <p>{activeLoanCount}</p>
                        </div>
                    </div>

                    <div className="staff-app-info-panel staff-app-info-panel--compact" style={{ marginBottom: 16 }}>
                        <p style={{ margin: 0, fontSize: '0.875rem', color: '#4b5563', lineHeight: 1.5 }}>
                            <strong>How advance repayment works:</strong> After an advance is credited, each monthly
                            salary run deducts the agreed installment. The <em>Remaining balance</em> column shows
                            how much of the advance loan is still outstanding after deductions.
                        </p>
                    </div>

                    {formOpen && (
                        <div className="staff-app-table-wrap" style={{ padding: 16, marginBottom: 12 }}>
                            <h3 style={{ marginTop: 0 }}>Request salary advance</h3>
                            <input className="staff-app-btn" placeholder="Amount (SAR)" value={form.requestedAmount} onChange={(e) => setForm((f) => ({ ...f, requestedAmount: e.target.value }))} />
                            <textarea className="staff-app-btn" rows={2} style={{ marginTop: 8, width: '100%' }} placeholder="Reason" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
                            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                                <button type="button" className="staff-app-btn staff-app-btn--primary" onClick={handleCreate}>Submit request</button>
                                <button type="button" className="staff-app-btn" onClick={() => setFormOpen(false)}>Cancel</button>
                            </div>
                        </div>
                    )}

                    <div className="staff-app-table-wrap">
                        {loading ? (
                            <p className="staff-app-empty">Loading…</p>
                        ) : rows.length === 0 ? (
                            <p className="staff-app-empty">No advance requests yet. Staff can request an advance from the mobile app or you can create one above.</p>
                        ) : (
                            <table className="staff-app-table">
                                <thead>
                                    <tr>
                                        <th>Employee</th>
                                        <th>Requested</th>
                                        <th>Monthly deduction</th>
                                        <th>Remaining loan</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row) => (
                                        <tr key={row.id}>
                                            <td>{row.employeeName || '—'}</td>
                                            <td>{fmt(row.requestedAmount)}</td>
                                            <td>{Number(row.monthlyDeduction) > 0 ? fmt(row.monthlyDeduction) : '—'}</td>
                                            <td>
                                                <strong>{fmt(row.remainingBalance)}</strong>
                                                {ACTIVE_LOAN_STATUSES.has(row.status) && Number(row.remainingBalance) > 0 && (
                                                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>after salary deductions</div>
                                                )}
                                            </td>
                                            <td>{statusBadge(row.status)}</td>
                                            <td>
                                                {row.status === 'Pending' && (
                                                    <button type="button" className="staff-app-btn" onClick={() => handleAction(row.id, 'manager_approve')}>Manager OK</button>
                                                )}
                                                {row.status === 'Manager Approved' && (
                                                    <button type="button" className="staff-app-btn" onClick={() => handleAction(row.id, 'finance_approve')}>Finance OK</button>
                                                )}
                                                {row.status === 'Finance Approved' && (
                                                    <button type="button" className="staff-app-btn staff-app-btn--primary" onClick={() => handleAction(row.id, 'credit')}>Credit wallet</button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {!loading && activeLoans.length > 0 && (
                        <p style={{ marginTop: 12, fontSize: '0.8125rem', color: '#6b7280' }}>
                            {activeLoans.length} employee(s) currently have an outstanding advance loan totalling {fmt(totalOutstanding)} SAR.
                        </p>
                    )}
                </>
            )}
        </div>
    );
}
