import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Save, RefreshCw, Users } from 'lucide-react';
import {
    bulkCreateSalaryPayments,
    getSalaryPayments,
} from '../../../services/advancesApi';
import { listCashBankAccounts } from '../../../services/workshopAccountingApi';
import { getWorkshopEmployees } from '../../../services/workshopStaffApi';
import '../../../styles/admin/AccountingPage.css';

const fmt = (n) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return '0.00';
    return x.toLocaleString('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const defaultPeriod = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const emptyRow = () => ({
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    employeeId: '',
    employeeName: '',
    gross: '',
    deduction: '0',
    payFromAccountId: '',
    notes: '',
});

export default function WorkshopPayroll() {
    const [period, setPeriod] = useState(defaultPeriod());
    const [paymentDate, setPaymentDate] = useState(todayIso());
    const [rows, setRows] = useState([emptyRow()]);
    const [employees, setEmployees] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [recent, setRecent] = useState([]);
    const [loadingLookups, setLoadingLookups] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [msg, setMsg] = useState('');
    const [error, setError] = useState('');

    const loadLookups = useCallback(async () => {
        setLoadingLookups(true);
        try {
            const [empRes, cashRes, salRes] = await Promise.all([
                getWorkshopEmployees({ limit: 200 }).catch(() => ({ items: [] })),
                listCashBankAccounts({}).catch(() => ({ accounts: [] })),
                getSalaryPayments({ limit: 20 }).catch(() => []),
            ]);
            const empItems = empRes?.items ?? empRes?.employees ?? empRes ?? [];
            setEmployees(Array.isArray(empItems) ? empItems : []);
            setAccounts(cashRes?.accounts ?? cashRes?.items ?? []);
            setRecent(Array.isArray(salRes) ? salRes : (salRes?.items ?? []));
        } catch (e) {
            setError(e?.message || 'Could not load payroll data.');
        } finally {
            setLoadingLookups(false);
        }
    }, []);

    useEffect(() => { loadLookups(); }, [loadLookups]);

    const totals = useMemo(() => {
        const gross = rows.reduce((s, r) => s + (Number(r.gross) || 0), 0);
        const deduction = rows.reduce((s, r) => s + (Number(r.deduction) || 0), 0);
        return { gross, deduction, net: Math.max(gross - deduction, 0) };
    }, [rows]);

    const setRow = (idx, patch) => {
        setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
    };

    const addRow = () => setRows((prev) => [...prev, emptyRow()]);
    const removeRow = (idx) => setRows((prev) => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);

    const handleEmployeeChange = (idx, employeeId) => {
        const emp = employees.find((e) => String(e.id) === String(employeeId));
        setRow(idx, {
            employeeId,
            employeeName: emp?.name || emp?.fullName || emp?.email || '',
        });
    };

    const submit = async () => {
        setMsg('');
        setError('');
        const items = rows.filter((r) => r.employeeId && Number(r.gross) > 0);
        if (items.length === 0) {
            setError('Add at least one row with an employee and a gross amount.');
            return;
        }
        for (const r of items) {
            if (!r.payFromAccountId) {
                setError('Every row must have a Pay From account.');
                return;
            }
        }
        setSubmitting(true);
        try {
            const payload = {
                rows: items.map((r) => ({
                    employeeId: String(r.employeeId),
                    employeeName: r.employeeName,
                    period,
                    paymentDate,
                    grossSalary: Number(r.gross),
                    advanceDeduction: Number(r.deduction || 0),
                    payFromAccountId: String(r.payFromAccountId),
                    notes: r.notes?.trim() || undefined,
                })),
            };
            const res = await bulkCreateSalaryPayments(payload);
            setMsg(`Saved ${res?.saved ?? items.length} salary payment(s). Total SAR ${fmt(res?.total ?? totals.gross)}.`);
            setRows([emptyRow()]);
            await loadLookups();
        } catch (e) {
            setError(e?.message || 'Could not submit payroll.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="accounting-page module-container">
            <header className="cash-bank-header">
                <h2 className="cash-bank-title"><Users size={20} style={{ marginRight: 8 }} /> Payroll Run</h2>
                <p className="cash-bank-desc">
                    Process a payroll period in one shot. Each row posts a balanced journal entry to <code>6300 Salary Expense</code>,
                    credits the selected pay-from account, and FIFO-settles outstanding advances for that employee.
                </p>
            </header>

            {error ? <p className="form-help-text" style={{ color: '#B45309' }}>{error}</p> : null}
            {msg ? <p className="form-help-text" style={{ color: '#065F46' }}>{msg}</p> : null}

            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16, padding: 12, background: '#fafafa', borderRadius: 12, border: '1px solid #E2E8F0' }}>
                <div>
                    <label className="form-label">Period</label>
                    <input type="month" className="form-input-field" value={period} onChange={(e) => setPeriod(e.target.value)} />
                </div>
                <div>
                    <label className="form-label">Payment Date</label>
                    <input type="date" className="form-input-field" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button type="button" className="btn-portal-outline" disabled={loadingLookups} onClick={loadLookups}>
                        <RefreshCw size={14} style={{ marginRight: 6 }} /> Refresh lookups
                    </button>
                </div>
            </section>

            <section className="premium-table cash-bank-table" style={{ marginBottom: 16 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">Employee *</th>
                            <th className="table-th">Gross (SAR) *</th>
                            <th className="table-th">Advance Deduction</th>
                            <th className="table-th">Net (auto)</th>
                            <th className="table-th">Pay From *</th>
                            <th className="table-th">Notes</th>
                            <th className="table-th"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r, idx) => {
                            const net = Math.max((Number(r.gross) || 0) - (Number(r.deduction) || 0), 0);
                            return (
                                <tr key={r.key}>
                                    <td className="table-cell">
                                        <select className="form-input-field" value={r.employeeId} onChange={(e) => handleEmployeeChange(idx, e.target.value)}>
                                            <option value="">Select…</option>
                                            {employees.map((e) => (
                                                <option key={e.id} value={e.id}>{e.name || e.fullName || e.email}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="table-cell">
                                        <input type="number" min="0" step="0.01" className="form-input-field" value={r.gross} onChange={(e) => setRow(idx, { gross: e.target.value })} />
                                    </td>
                                    <td className="table-cell">
                                        <input type="number" min="0" step="0.01" className="form-input-field" value={r.deduction} onChange={(e) => setRow(idx, { deduction: e.target.value })} />
                                    </td>
                                    <td className="table-cell">SAR {fmt(net)}</td>
                                    <td className="table-cell">
                                        <select className="form-input-field" value={r.payFromAccountId} onChange={(e) => setRow(idx, { payFromAccountId: e.target.value })}>
                                            <option value="">Select account…</option>
                                            {accounts.map((a) => (
                                                <option key={a.id} value={a.id}>{a.name} {a.coaCode ? `· ${a.coaCode}` : ''}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="table-cell">
                                        <input type="text" className="form-input-field" value={r.notes} onChange={(e) => setRow(idx, { notes: e.target.value })} placeholder="Optional note" />
                                    </td>
                                    <td className="table-cell">
                                        <button type="button" className="btn-edit-zone" onClick={() => removeRow(idx)} disabled={rows.length <= 1}>
                                            <Trash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </section>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
                <button type="button" className="btn-portal-outline" onClick={addRow}>
                    <Plus size={14} style={{ marginRight: 6 }} /> Add row
                </button>
                <div style={{ marginLeft: 'auto', color: '#0F172A' }}>
                    <strong>Gross:</strong> SAR {fmt(totals.gross)}
                    {' · '}<strong>Deductions:</strong> SAR {fmt(totals.deduction)}
                    {' · '}<strong>Net:</strong> SAR {fmt(totals.net)}
                </div>
                <button type="button" className="btn-portal" disabled={submitting} onClick={submit}>
                    <Save size={14} style={{ marginRight: 6 }} /> {submitting ? 'Submitting…' : 'Submit Payroll Run'}
                </button>
            </div>

            <section className="premium-table cash-bank-table">
                <header style={{ padding: '12px 16px', borderBottom: '1px solid #E2E8F0' }}>
                    <strong>Recent Salary Payments</strong>
                </header>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">Date</th>
                            <th className="table-th">Employee</th>
                            <th className="table-th">Period</th>
                            <th className="table-th">Gross</th>
                            <th className="table-th">Deduction</th>
                            <th className="table-th">Net</th>
                            <th className="table-th">Pay From</th>
                        </tr>
                    </thead>
                    <tbody>
                        {recent.length === 0 ? (
                            <tr><td colSpan={7} className="table-cell table-empty">No salary payments yet.</td></tr>
                        ) : recent.map((s) => (
                            <tr key={s.id}>
                                <td className="table-cell">{s.paymentDate ? new Date(s.paymentDate).toLocaleDateString() : '—'}</td>
                                <td className="table-cell">{s.employeeName}</td>
                                <td className="table-cell">{s.period}</td>
                                <td className="table-cell">SAR {fmt(s.grossSalary)}</td>
                                <td className="table-cell">SAR {fmt(s.advanceDeduction)}</td>
                                <td className="table-cell">SAR {fmt(s.netSalary)}</td>
                                <td className="table-cell">{s.payFromAccountName ?? '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>
        </div>
    );
}
