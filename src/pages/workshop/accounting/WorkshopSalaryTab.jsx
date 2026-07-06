import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, Save, RefreshCw, Users, Banknote } from 'lucide-react';
import {
    getRecentWorkshopSalaryPayroll,
    getSalaryPayrollPreview,
    postWorkshopSalaryPayroll,
} from '../../../services/advancesApi';
import { listCashBankAccounts } from '../../../services/workshopAccountingApi';
import {
    getWorkshopEmployees,
    indexWorkshopStaffBySelectValue,
    parseWorkshopStaffSelectValue,
    unwrapWorkshopEmployeesList,
    workshopStaffSelectValue,
} from '../../../services/workshopStaffApi';

const fmt = (n) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return '0.00';
    return x.toLocaleString('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const ackBadge = (status, ackAt) => {
    const s = String(status || 'pending').toLowerCase();
    if (s === 'accepted') {
        const when = ackAt ? new Date(ackAt).toLocaleString() : '';
        return (
            <span className="status-badge approved" title={when || undefined}>
                Accepted{when ? ` · ${when}` : ''}
            </span>
        );
    }
    if (s === 'rejected') {
        const when = ackAt ? new Date(ackAt).toLocaleString() : '';
        return (
            <span className="status-badge pending" style={{ background: '#FEE2E2', color: '#B91C1C' }} title={when || undefined}>
                Rejected{when ? ` · ${when}` : ''}
            </span>
        );
    }
    return <span className="status-badge pending">Awaiting technician</span>;
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const listBasicSalary = (emp) => {
    if (!emp) return '';
    const n = Number(emp.basicSalary ?? emp.basic_salary ?? 0);
    return Number.isFinite(n) && n > 0 ? String(n) : '';
};

/** Resolve employee id/type from row state (select key is source of truth for the dropdown). */
const resolveRowEmployee = (row) => {
    const parsed = parseWorkshopStaffSelectValue(row.employeeSelectKey);
    return {
        employeeRecordId: String(row.employeeRecordId || parsed.id || '').trim(),
        recordType: row.recordType || parsed.recordType || 'employee',
    };
};

const employeeBulkKey = (recordType, employeeRecordId) =>
    `${recordType || 'employee'}:${String(employeeRecordId)}`;

const defaultPeriod = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const emptyRow = () => ({
    key: `row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    employeeSelectKey: '',
    employeeRecordId: '',
    recordType: 'employee',
    userId: '',
    employeeName: '',
    basicSalary: '',
    rewardBonus: '0',
    advanceDue: 0,
    commissionPayable: 0,
    commissionLineIds: [],
    advanceDeduction: '0',
    penalties: '0',
    penaltyNotes: '',
    notes: '',
    previewLoading: false,
    previewLoaded: false,
});

function netPayable(row) {
    const basic = Number(row.basicSalary) || 0;
    const reward = Number(row.rewardBonus) || 0;
    const comm = Number(row.commissionPayable) || 0;
    const adv = Number(row.advanceDeduction) || 0;
    const pen = Number(row.penalties) || 0;
    return Math.max(basic + reward + comm - adv - pen, 0);
}

export default function WorkshopSalaryTab({ branchFilter = '' }) {
    const [period, setPeriod] = useState(defaultPeriod());
    const [paymentDate, setPaymentDate] = useState(todayIso());
    const [payFromAccountId, setPayFromAccountId] = useState('');
    const [rows, setRows] = useState([emptyRow()]);
    const [employees, setEmployees] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [recent, setRecent] = useState([]);
    const [recentLoading, setRecentLoading] = useState(false);
    const [loadingLookups, setLoadingLookups] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [msg, setMsg] = useState('');
    const [error, setError] = useState('');
    const previewSeqRef = useRef({});

    const branchParams = useMemo(
        () => (branchFilter ? { branchId: branchFilter } : {}),
        [branchFilter],
    );

    const staffBySelectKey = useMemo(
        () => indexWorkshopStaffBySelectValue(employees),
        [employees],
    );

    const sortedEmployees = useMemo(
        () => [...employees].sort((a, b) => (a.name || '').localeCompare(b.name || '')),
        [employees],
    );

    const loadRecentPayments = useCallback(async () => {
        setRecentLoading(true);
        try {
            const salRes = await getRecentWorkshopSalaryPayroll({ limit: 50 });
            setRecent(salRes?.list ?? []);
        } catch (e) {
            setError(e?.message || 'Could not refresh recent salary payments.');
        } finally {
            setRecentLoading(false);
        }
    }, []);

    const loadLookups = useCallback(async () => {
        setLoadingLookups(true);
        try {
            const [empRes, cashRes, salRes] = await Promise.all([
                getWorkshopEmployees({ ...branchParams, limit: 200 }).catch(() => ({ employees: [] })),
                listCashBankAccounts(branchParams).catch(() => ({ accounts: [] })),
                getRecentWorkshopSalaryPayroll({ limit: 50 }).catch(() => ({ list: [] })),
            ]);
            setEmployees(unwrapWorkshopEmployeesList(empRes));
            setAccounts(cashRes?.accounts ?? cashRes?.items ?? []);
            setRecent(salRes?.list ?? []);
        } catch (e) {
            setError(e?.message || 'Could not load salary data.');
        } finally {
            setLoadingLookups(false);
        }
    }, [branchParams]);

    useEffect(() => { loadLookups(); }, [loadLookups]);

    useEffect(() => {
        const refreshOnFocus = () => {
            if (document.visibilityState === 'visible') {
                loadRecentPayments();
            }
        };
        document.addEventListener('visibilitychange', refreshOnFocus);
        window.addEventListener('focus', refreshOnFocus);
        return () => {
            document.removeEventListener('visibilitychange', refreshOnFocus);
            window.removeEventListener('focus', refreshOnFocus);
        };
    }, [loadRecentPayments]);

    const loadPreview = async (idx, { id, recordType }) => {
        if (!id || !period) return;
        const seq = (previewSeqRef.current[idx] ?? 0) + 1;
        previewSeqRef.current[idx] = seq;
        setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, previewLoading: true } : r)));
        try {
            const preview = await getSalaryPayrollPreview({
                period,
                employeeRecordId: String(id),
                recordType,
                ...branchParams,
            });
            if (previewSeqRef.current[idx] !== seq) return;
            setRows((prev) => prev.map((r, i) => {
                if (i !== idx) return r;
                return {
                    ...r,
                    userId: preview.userId || r.userId || '',
                    recordType: preview.recordType || recordType || r.recordType,
                    employeeName: preview.employeeName || r.employeeName,
                    basicSalary: (() => {
                        const fromPreview = Number(preview.basicSalary);
                        if (Number.isFinite(fromPreview) && fromPreview > 0) {
                            return String(fromPreview);
                        }
                        return r.basicSalary || listBasicSalary(staffBySelectKey[r.employeeSelectKey]) || '';
                    })(),
                    advanceDue: Number(preview.advanceDue ?? 0),
                    commissionPayable: Number(preview.commissionPayable ?? 0),
                    commissionLineIds: [...(preview.commissionLineIds ?? [])],
                    advanceDeduction: String(
                        preview.suggestedAdvanceDeduction ?? preview.advanceDue ?? 0,
                    ),
                    previewLoading: false,
                    previewLoaded: true,
                };
            }));
        } catch (e) {
            if (previewSeqRef.current[idx] !== seq) return;
            setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, previewLoading: false } : r)));
            setError(e?.message || 'Could not load employee payroll preview.');
        }
    };

    const setRow = (idx, patch) => {
        setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
    };

    const handleEmployeeChange = (idx, selectKey) => {
        const parsed = parseWorkshopStaffSelectValue(selectKey);
        const emp = staffBySelectKey[selectKey];
        setRow(idx, {
            employeeSelectKey: selectKey,
            employeeRecordId: parsed.id,
            recordType: parsed.recordType,
            userId: emp?.userId || '',
            employeeName: emp?.name || '',
            previewLoaded: false,
            basicSalary: listBasicSalary(emp),
            rewardBonus: '0',
            advanceDue: 0,
            commissionPayable: 0,
            commissionLineIds: [],
            advanceDeduction: '0',
            penalties: '0',
            penaltyNotes: '',
        });
        if (parsed.id) {
            loadPreview(idx, parsed);
        }
    };

    useEffect(() => {
        rows.forEach((r, idx) => {
            const { employeeRecordId, recordType } = resolveRowEmployee(r);
            if (employeeRecordId && r.previewLoaded) {
                loadPreview(idx, { id: employeeRecordId, recordType });
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [period]);

    const addRow = () => setRows((prev) => [...prev, emptyRow()]);
    const removeRow = (idx) => setRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));

    const totals = useMemo(() => {
        let basic = 0;
        let rewardBonus = 0;
        let commission = 0;
        let advance = 0;
        let penalties = 0;
        let net = 0;
        for (const r of rows) {
            basic += Number(r.basicSalary) || 0;
            rewardBonus += Number(r.rewardBonus) || 0;
            commission += Number(r.commissionPayable) || 0;
            advance += Number(r.advanceDeduction) || 0;
            penalties += Number(r.penalties) || 0;
            net += netPayable(r);
        }
        return { basic, rewardBonus, commission, advance, penalties, net };
    }, [rows]);

    const submit = async () => {
        setMsg('');
        setError('');

        const prepared = rows
            .map((r) => {
                const { employeeRecordId, recordType } = resolveRowEmployee(r);
                return { ...r, employeeRecordId, recordType };
            })
            .filter((r) => r.employeeRecordId && (
                Number(r.basicSalary) > 0
                || Number(r.rewardBonus) > 0
                || Number(r.commissionPayable) > 0
            ));

        if (prepared.length === 0) {
            setError('Add at least one employee with salary, reward/bonus, or commission payable.');
            return;
        }

        const seen = new Set();
        for (const r of prepared) {
            const key = employeeBulkKey(r.recordType, r.employeeRecordId);
            if (seen.has(key)) {
                setError(`Duplicate employee in bulk payroll: ${r.employeeName || r.employeeRecordId}. Remove the duplicate row.`);
                return;
            }
            seen.add(key);
        }

        if (!payFromAccountId) {
            setError('Select a Pay From account (cash or bank).');
            return;
        }
        for (const r of prepared) {
            if (netPayable(r) <= 0) {
                setError(`Net payable must be greater than zero for ${r.employeeName || 'employee'}.`);
                return;
            }
            if (Number(r.penalties) > 0 && !r.penaltyNotes?.trim()) {
                setError(`Penalty reason is required for ${r.employeeName || 'employee'} when a penalty amount is entered.`);
                return;
            }
        }

        const payloadRows = prepared.map((r) => ({
            employeeRecordId: String(r.employeeRecordId),
            recordType: r.recordType || 'employee',
            userId: r.userId ? String(r.userId) : undefined,
            employeeName: r.employeeName,
            basicSalary: Number(r.basicSalary || 0),
            rewardBonus: Number(r.rewardBonus || 0),
            commissionAmount: Number(r.commissionPayable || 0),
            commissionLineIds: [...(r.commissionLineIds ?? [])],
            advanceDeduction: Number(r.advanceDeduction || 0),
            penalties: Number(r.penalties || 0),
            penaltyNotes: r.penaltyNotes?.trim() || undefined,
            notes: r.notes?.trim() || undefined,
        }));

        setSubmitting(true);
        try {
            const res = await postWorkshopSalaryPayroll({
                period,
                paymentDate,
                payFromAccountId: String(payFromAccountId),
                rows: payloadRows,
            });
            const saved = Number(res?.saved ?? payloadRows.length);
            const received = Number(res?.received ?? payloadRows.length);
            if (saved !== payloadRows.length || received !== payloadRows.length) {
                setError(
                    `Only ${saved} of ${payloadRows.length} salary payment(s) were posted (server received ${received}). Check recent payments and try again for missing employees.`,
                );
            } else {
                setMsg(`Posted ${saved} salary payment(s). Total net SAR ${fmt(res?.totalNet ?? totals.net)}. Journal entries created.`);
                setRows([emptyRow()]);
                await loadLookups();
                await loadRecentPayments();
            }
        } catch (e) {
            setError(e?.message || 'Could not post salary payroll.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div>
            {error ? <p className="form-help-text" style={{ color: '#B45309', marginBottom: 12 }}>{error}</p> : null}
            {msg ? <p className="form-help-text" style={{ color: '#065F46', marginBottom: 12 }}>{msg}</p> : null}

            <section style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 12,
                marginBottom: 16,
                padding: 14,
                background: '#F8FAFC',
                borderRadius: 12,
                border: '1px solid #E2E8F0',
            }}>
                <div>
                    <label className="form-label">Period (month) *</label>
                    <input type="month" className="form-input-field" value={period} onChange={(e) => setPeriod(e.target.value)} />
                </div>
                <div>
                    <label className="form-label">Payment date *</label>
                    <input type="date" className="form-input-field" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                </div>
                <div>
                    <label className="form-label">Pay from (cash / bank) *</label>
                    <select className="form-input-field" value={payFromAccountId} onChange={(e) => setPayFromAccountId(e.target.value)}>
                        <option value="">Select account…</option>
                        {accounts.map((a) => (
                            <option key={a.id} value={a.id}>{a.name}{a.coaCode ? ` · ${a.coaCode}` : ''}</option>
                        ))}
                    </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button type="button" className="btn-portal-outline" disabled={loadingLookups} onClick={loadLookups}>
                        <RefreshCw size={14} style={{ marginRight: 6 }} /> Refresh
                    </button>
                </div>
            </section>

            <p className="form-help-text" style={{ marginBottom: 12, fontSize: 13 }}>
                Select an employee to auto-load <strong>advance due</strong> and <strong>accrued commissions</strong> for the period.
                Posting creates journal entries: Dr Salary Expense · Dr Reward/Bonus Expense · Dr Commission Payable · Cr Advances · Cr Cash/Bank.
            </p>

            {rows.map((r, idx) => (
                <section
                    key={r.key}
                    style={{
                        marginBottom: 14,
                        padding: 14,
                        border: '1px solid #E2E8F0',
                        borderRadius: 12,
                        background: '#fff',
                    }}
                >
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                        <div>
                            <label className="form-label">Employee / Technician *</label>
                            <select
                                className="form-input-field"
                                value={r.employeeSelectKey}
                                onChange={(e) => handleEmployeeChange(idx, e.target.value)}
                            >
                                <option value="">Select…</option>
                                {sortedEmployees.map((e) => {
                                    const selectKey = workshopStaffSelectValue(e);
                                    return (
                                    <option key={selectKey} value={selectKey}>
                                        {e.name}{e.branch?.name ? ` (${e.branch.name})` : ''}
                                    </option>
                                    );
                                })}
                            </select>
                        </div>
                        {r.employeeSelectKey ? (
                            <>
                                <div>
                                    <label className="form-label">Basic salary (SAR)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className="form-input-field"
                                        value={r.basicSalary}
                                        disabled={r.previewLoading}
                                        onChange={(e) => setRow(idx, { basicSalary: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="form-label">Reward/Bonus (SAR)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className="form-input-field"
                                        value={r.rewardBonus}
                                        onChange={(e) => setRow(idx, { rewardBonus: e.target.value })}
                                        placeholder="0.00"
                                    />
                                </div>
                                <div>
                                    <label className="form-label">Advance due</label>
                                    <input type="text" className="form-input-field" readOnly value={`SAR ${fmt(r.advanceDue)}`} style={{ background: '#F8FAFC' }} />
                                </div>
                                <div>
                                    <label className="form-label">Commissions payable</label>
                                    <input type="text" className="form-input-field" readOnly value={`SAR ${fmt(r.commissionPayable)}`} style={{ background: '#F8FAFC' }} />
                                </div>
                                <div>
                                    <label className="form-label">Deduct from advance</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        max={r.advanceDue}
                                        className="form-input-field"
                                        value={r.advanceDeduction}
                                        onChange={(e) => setRow(idx, { advanceDeduction: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="form-label">Penalties (manual)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className="form-input-field"
                                        value={r.penalties}
                                        onChange={(e) => setRow(idx, { penalties: e.target.value })}
                                        placeholder="0.00"
                                    />
                                </div>
                                <div>
                                    <label className="form-label">
                                        Penalty reason
                                        {Number(r.penalties) > 0 ? ' *' : ''}
                                    </label>
                                    <input
                                        type="text"
                                        className="form-input-field"
                                        value={r.penaltyNotes}
                                        onChange={(e) => setRow(idx, { penaltyNotes: e.target.value })}
                                        placeholder="e.g. Late arrival — appears on penalty JE line"
                                    />
                                </div>
                                <div>
                                    <label className="form-label">Net payable</label>
                                    <input
                                        type="text"
                                        className="form-input-field"
                                        readOnly
                                        value={`SAR ${fmt(netPayable(r))}`}
                                        style={{ background: '#ECFDF5', fontWeight: 700, color: '#065F46' }}
                                    />
                                </div>
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <label className="form-label">Payroll notes (optional)</label>
                                    <input
                                        type="text"
                                        className="form-input-field"
                                        value={r.notes}
                                        onChange={(e) => setRow(idx, { notes: e.target.value })}
                                        placeholder="Internal note for this payout"
                                    />
                                </div>
                            </>
                        ) : null}
                    </div>
                    {rows.length > 1 ? (
                        <div style={{ marginTop: 10, textAlign: 'right' }}>
                            <button type="button" className="btn-edit-zone" onClick={() => removeRow(idx)}>
                                <Trash2 size={14} /> Remove row
                            </button>
                        </div>
                    ) : null}
                    {r.previewLoading ? (
                        <p className="form-help-text" style={{ marginTop: 8 }}>Loading advance & commission data…</p>
                    ) : null}
                </section>
            ))}

            <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                <button type="button" className="btn-portal-outline" onClick={addRow}>
                    <Plus size={14} style={{ marginRight: 6 }} /> Add employee (bulk)
                </button>
                <div style={{ marginLeft: 'auto', color: '#0F172A', fontSize: 13 }}>
                    <strong>Salary:</strong> SAR {fmt(totals.basic)}
                    {' · '}<strong>Reward/Bonus:</strong> SAR {fmt(totals.rewardBonus)}
                    {' · '}<strong>Commission:</strong> SAR {fmt(totals.commission)}
                    {' · '}<strong>Deductions:</strong> SAR {fmt(totals.advance + totals.penalties)}
                    {' · '}<strong>Net cash:</strong> SAR {fmt(totals.net)}
                </div>
                <button type="button" className="btn-portal" disabled={submitting || loadingLookups} onClick={submit}>
                    <Save size={14} style={{ marginRight: 6 }} />
                    {submitting ? 'Posting…' : 'Post Salary'}
                </button>
            </div>

            <section className="premium-table cash-bank-table">
                <header style={{ padding: '12px 16px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Banknote size={16} />
                    <strong>Recent Salary Payments</strong>
                    <button
                        type="button"
                        className="btn-portal-outline"
                        disabled={recentLoading}
                        onClick={loadRecentPayments}
                        style={{ marginLeft: 'auto', padding: '4px 10px', fontSize: 12 }}
                    >
                        <RefreshCw size={14} style={{ marginRight: 6 }} />
                        {recentLoading ? 'Refreshing…' : 'Refresh status'}
                    </button>
                </header>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">Date</th>
                            <th className="table-th">Employee</th>
                            <th className="table-th">Period</th>
                            <th className="table-th">Salary</th>
                            <th className="table-th">Reward/Bonus</th>
                            <th className="table-th">Commission</th>
                            <th className="table-th">Deductions</th>
                            <th className="table-th">Net paid</th>
                            <th className="table-th">Pay from</th>
                            <th className="table-th">Technician</th>
                        </tr>
                    </thead>
                    <tbody>
                        {recent.length === 0 ? (
                            <tr><td colSpan={9} className="table-cell table-empty">No salary payments yet.</td></tr>
                        ) : recent.map((s) => (
                            <tr key={s.id}>
                                <td className="table-cell">{s.paymentDate ? new Date(s.paymentDate).toLocaleDateString() : '—'}</td>
                                <td className="table-cell">{s.employeeName}</td>
                                <td className="table-cell">{s.period}</td>
                                <td className="table-cell">SAR {fmt(s.basicSalary ?? s.grossSalary)}</td>
                                <td className="table-cell">SAR {fmt(s.rewardBonus)}</td>
                                <td className="table-cell">SAR {fmt(s.commissionAmount)}</td>
                                <td className="table-cell">SAR {fmt(s.totalDeductions ?? (Number(s.advanceDeduction || 0) + Number(s.penalties || 0)))}</td>
                                <td className="table-cell" style={{ fontWeight: 700 }}>SAR {fmt(s.netSalary)}</td>
                                <td className="table-cell">{s.payFromAccountName ?? '—'}</td>
                                <td className="table-cell">{ackBadge(s.technicianAckStatus, s.technicianAckAt)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>
        </div>
    );
}
