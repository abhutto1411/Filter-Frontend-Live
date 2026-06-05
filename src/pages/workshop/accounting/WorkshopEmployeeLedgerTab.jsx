import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, RefreshCw, ChevronDown } from 'lucide-react';
import { getWorkshopEmployeeLedger } from '../../../services/advancesApi';
import {
    parseWorkshopStaffSelectValue,
    workshopStaffSelectValue,
} from '../../../services/workshopStaffApi';

const fmt = (n) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return '0.00';
    return x.toLocaleString('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const defaultPeriod = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const TYPE_LABELS = {
    commission_accrued: 'Commission accrued',
    commission_paid: 'Commission paid',
    commission_settled: 'Commission settled',
    salary_payable: 'Basic salary',
    salary_paid: 'Salary payout',
    advance_issued: 'Advance issued',
    advance_deducted: 'Advance deducted',
    penalty: 'Penalty',
};

const TYPE_COLORS = {
    Earnings: { bg: '#ECFDF5', color: '#065F46' },
    Payment: { bg: '#EFF6FF', color: '#1D4ED8' },
    Advance: { bg: '#FFF7ED', color: '#C2410C' },
    Deduction: { bg: '#FEF2F2', color: '#B91C1C' },
    Settlement: { bg: '#F5F3FF', color: '#6D28D9' },
};

function CategoryBadge({ category }) {
    const style = TYPE_COLORS[category] ?? { bg: '#F1F5F9', color: '#475569' };
    return (
        <span style={{
            fontSize: 11,
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: 999,
            background: style.bg,
            color: style.color,
        }}>
            {category}
        </span>
    );
}

export default function WorkshopEmployeeLedgerTab({
    employees = [],
    employeeByRecordId = {},
    branchFilter = '',
}) {
    const [ledgerEmployeeId, setLedgerEmployeeId] = useState('');
    const [period, setPeriod] = useState(defaultPeriod());
    const [allPeriods, setAllPeriods] = useState(false);
    const [ledger, setLedger] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const loadLedger = useCallback(async () => {
        if (!ledgerEmployeeId) {
            setLedger(null);
            return;
        }
        setLoading(true);
        setError('');
        try {
            const parsed = parseWorkshopStaffSelectValue(ledgerEmployeeId);
            const emp = employeeByRecordId[ledgerEmployeeId];
            const res = await getWorkshopEmployeeLedger(parsed.id, {
                ...(allPeriods ? {} : { period }),
                recordType: parsed.recordType,
                userId: emp?.userId || undefined,
                ...(branchFilter ? { branchId: branchFilter } : {}),
            });
            setLedger(res);
        } catch (e) {
            setError(e?.message || 'Could not load employee ledger');
            setLedger(null);
        } finally {
            setLoading(false);
        }
    }, [ledgerEmployeeId, period, allPeriods, branchFilter, employeeByRecordId]);

    useEffect(() => { loadLedger(); }, [loadLedger]);

    useEffect(() => {
        if (!ledgerEmployeeId) return undefined;
        const timer = setInterval(loadLedger, 45000);
        return () => clearInterval(timer);
    }, [ledgerEmployeeId, loadLedger]);

    const summary = ledger?.summary ?? null;
    const rows = ledger?.rows ?? [];

    const employeeOptions = useMemo(
        () => [...employees].sort((a, b) => (a.name || '').localeCompare(b.name || '')),
        [employees],
    );

    return (
        <div style={{ padding: '8px 0' }}>
            <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 12,
                alignItems: 'flex-end',
                marginBottom: 16,
                padding: 14,
                background: '#F8FAFC',
                borderRadius: 12,
                border: '1px solid #E2E8F0',
            }}>
                <div style={{ minWidth: 240, flex: 1 }}>
                    <label className="form-label">Employee / Technician</label>
                    <div className="ps-select-wrapper">
                        <select
                            className="form-input-field"
                            value={ledgerEmployeeId}
                            onChange={(e) => setLedgerEmployeeId(e.target.value)}
                        >
                            <option value="">Select employee…</option>
                            {employeeOptions.map((e) => {
                                const selectKey = workshopStaffSelectValue(e);
                                return (
                                <option key={selectKey} value={selectKey}>
                                    {e.name}{e.branch?.name ? ` — ${e.branch.name}` : ''}
                                </option>
                                );
                            })}
                        </select>
                        <ChevronDown size={16} className="ps-select-icon" />
                    </div>
                </div>
                <div>
                    <label className="form-label">Period (month)</label>
                    <input
                        type="month"
                        className="form-input-field"
                        value={period}
                        disabled={allPeriods}
                        onChange={(e) => setPeriod(e.target.value)}
                    />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, paddingBottom: 8 }}>
                    <input
                        type="checkbox"
                        checked={allPeriods}
                        onChange={(e) => setAllPeriods(e.target.checked)}
                    />
                    All periods
                </label>
                <button type="button" className="btn-portal-outline" disabled={loading || !ledgerEmployeeId} onClick={loadLedger}>
                    <RefreshCw size={14} style={{ marginRight: 6 }} />
                    {loading ? 'Loading…' : 'Refresh'}
                </button>
            </div>

            <p className="form-help-text" style={{ marginBottom: 14, fontSize: 13 }}>
                <BookOpen size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                Live ledger — commissions accrue automatically when invoices post. Refreshes every 45s.
            </p>

            {error ? <p className="form-help-text" style={{ color: '#B45309', marginBottom: 12 }}>{error}</p> : null}

            {!ledgerEmployeeId ? (
                <div style={{ textAlign: 'center', color: '#94A3B8', padding: 48 }}>
                    Select an employee to view their full transaction ledger
                </div>
            ) : loading && !ledger ? (
                <div style={{ textAlign: 'center', color: '#64748B', padding: 48 }}>Loading ledger…</div>
            ) : (
                <>
                    {summary ? (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                            gap: 10,
                            marginBottom: 16,
                        }}>
                            {[
                                { label: 'Earnings', value: summary.totalEarnings, color: '#065F46' },
                                { label: 'Deductions', value: summary.totalDeductions, color: '#B91C1C' },
                                { label: 'Paid out', value: summary.totalPaid, color: '#1D4ED8' },
                                { label: 'Advance due', value: summary.advanceOutstanding, color: '#C2410C' },
                                { label: 'Comm. pending', value: summary.commissionPending, color: '#7C3AED' },
                                { label: 'Net payable', value: summary.netPayable, color: '#0F172A' },
                            ].map((k) => (
                                <div key={k.label} style={{
                                    padding: '10px 12px',
                                    background: '#fff',
                                    border: '1px solid #E2E8F0',
                                    borderRadius: 10,
                                }}>
                                    <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>{k.label}</div>
                                    <div style={{ fontSize: 16, fontWeight: 800, color: k.color }}>SAR {fmt(k.value)}</div>
                                </div>
                            ))}
                        </div>
                    ) : null}

                    {!ledger?.hasUserAccount ? (
                        <p className="form-help-text" style={{ marginBottom: 12, color: '#64748B' }}>
                            Commissions shown by employee record. Link a user account to include salary &amp; advance transactions.
                        </p>
                    ) : null}

                    <section className="premium-table cash-bank-table">
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr className="table-header-row">
                                    <th className="table-th">DATE</th>
                                    <th className="table-th">TYPE</th>
                                    <th className="table-th">DESCRIPTION</th>
                                    <th className="table-th">PERIOD</th>
                                    <th className="table-th">EARNINGS</th>
                                    <th className="table-th">DEDUCTIONS</th>
                                    <th className="table-th">PAID</th>
                                    <th className="table-th">ADVANCE</th>
                                    <th className="table-th">STATUS</th>
                                    <th className="table-th">NET POS.</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.length === 0 ? (
                                    <tr>
                                        <td colSpan={10} className="table-cell table-empty">
                                            No transactions{allPeriods ? '' : ` for ${period}`}.
                                        </td>
                                    </tr>
                                ) : rows.map((r) => (
                                    <tr key={r.id} className="table-row">
                                        <td className="table-cell">{new Date(r.date).toLocaleDateString()}</td>
                                        <td className="table-cell">
                                            <CategoryBadge category={r.category} />
                                            <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                                                {TYPE_LABELS[r.type] ?? r.type}
                                            </div>
                                        </td>
                                        <td className="table-cell">
                                            {r.description}
                                            {r.reference ? (
                                                <div style={{ fontSize: 11, color: '#94A3B8' }}>{r.reference}</div>
                                            ) : null}
                                        </td>
                                        <td className="table-cell">{r.period ?? '—'}</td>
                                        <td className="table-cell" style={{ color: r.earnings > 0 ? '#065F46' : undefined, fontWeight: r.earnings > 0 ? 600 : 400 }}>
                                            {r.earnings > 0 ? `SAR ${fmt(r.earnings)}` : '—'}
                                        </td>
                                        <td className="table-cell" style={{ color: r.deductions > 0 ? '#B91C1C' : undefined, fontWeight: r.deductions > 0 ? 600 : 400 }}>
                                            {r.deductions > 0 ? `SAR ${fmt(r.deductions)}` : '—'}
                                        </td>
                                        <td className="table-cell" style={{ color: r.paid > 0 ? '#1D4ED8' : undefined, fontWeight: r.paid > 0 ? 600 : 400 }}>
                                            {r.paid > 0 ? `SAR ${fmt(r.paid)}` : '—'}
                                        </td>
                                        <td className="table-cell" style={{ color: r.advance > 0 ? '#C2410C' : undefined, fontWeight: r.advance > 0 ? 600 : 400 }}>
                                            {r.advance > 0 ? `SAR ${fmt(r.advance)}` : '—'}
                                        </td>
                                        <td className="table-cell">
                                            {r.status ? (
                                                <span className={`status-badge ${r.status === 'paid' || r.status === 'settled' ? 'approved' : 'pending'}`}>
                                                    {r.status}
                                                </span>
                                            ) : '—'}
                                        </td>
                                        <td className="table-cell" style={{ fontWeight: 700 }}>
                                            SAR {fmt(r.netPosition)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </section>
                </>
            )}
        </div>
    );
}
