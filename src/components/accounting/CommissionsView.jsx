import React, { useEffect, useMemo, useState } from 'react';
import {
    AlertCircle,
    CheckCircle,
    ChevronDown,
    Download,
    Pencil,
    Plus,
    Search,
    Trash2,
    TrendingUp,
    UserCheck,
    X,
} from 'lucide-react';
import Modal from '../Modal';
import { apiFetch } from '../../services/api';
import { getAccounts as getCashBankAccounts } from '../../services/cashBankApi';
import {
    createCommissionRule,
    deleteCommissionRule,
    generatePayout,
    getCommissionRules,
    getCommissions,
    getServicesForRules,
    getStats,
    updateCommissionRule,
} from '../../services/commissionsApi';

const parseArr = (res) => {
    if (Array.isArray(res)) return res;
    if (res && Array.isArray(res.data)) return res.data;
    if (res && Array.isArray(res.list)) return res.list;
    if (res && Array.isArray(res.entries)) return res.entries;
    if (res && Array.isArray(res.items)) return res.items;
    if (res && typeof res === 'object') {
        return Object.values(res).filter(
            (v) => v !== null && typeof v === 'object' && !Array.isArray(v) && v.id,
        );
    }
    return [];
};

const gold = '#D4A017';

const box = {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    height: 40,
    padding: '0 12px',
    fontSize: 13,
    color: '#111827',
    outline: 'none',
};

export default function CommissionsView({ readOnly = false }) {
    const [activeTab, setActiveTab] = useState('ledger');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [stats, setStats] = useState({
        totalGenerated: 0,
        totalPaid: 0,
        outstanding: 0,
        totalRecords: 0,
        paidCount: 0,
        pendingCount: 0,
    });
    const [employees, setEmployees] = useState([]);
    const [commissions, setCommissions] = useState([]);
    const [rules, setRules] = useState([]);
    const [services, setServices] = useState([]);
    const [cashBankAccounts, setCashBankAccounts] = useState([]);

    const [employeeId, setEmployeeId] = useState('');
    const [status, setStatus] = useState('all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const [selectedIds, setSelectedIds] = useState(new Set());
    const [payoutOpen, setPayoutOpen] = useState(false);
    const [payoutAccountId, setPayoutAccountId] = useState('');
    const [payoutBusy, setPayoutBusy] = useState(false);

    const [ruleSearch, setRuleSearch] = useState('');
    const [ruleModalOpen, setRuleModalOpen] = useState(false);
    const [editingRule, setEditingRule] = useState(null);
    const [ruleSaving, setRuleSaving] = useState(false);
    const [serviceSearch, setServiceSearch] = useState('');
    const [serviceDropdownOpen, setServiceDropdownOpen] = useState(false);
    const [ruleForm, setRuleForm] = useState({
        serviceId: '',
        serviceName: '',
        employeeRole: 'Technician',
        commissionType: 'Percentage',
        value: '',
        priority: 1,
        status: 'active',
        notes: '',
    });

    const refreshLedger = async () => {
        const [statsRes, listRes, employeeRes, accountsRes] = await Promise.all([
            getStats(),
            getCommissions({
                employeeId: employeeId || undefined,
                status: status || undefined,
                dateFrom: dateFrom || undefined,
                dateTo: dateTo || undefined,
            }),
            apiFetch('/super-admin/users').catch(() => []),
            getCashBankAccounts().catch(() => []),
        ]);

        setStats(statsRes || {});
        setCommissions(parseArr(listRes?.list ?? listRes));
        setEmployees(parseArr(employeeRes?.users ?? employeeRes));
        setCashBankAccounts(parseArr(accountsRes));
    };

    const refreshRules = async () => {
        const [rulesRes, servicesRes] = await Promise.all([
            getCommissionRules({ search: ruleSearch || undefined }),
            getServicesForRules().catch(() => []),
        ]);
        setRules(parseArr(rulesRes?.list ?? rulesRes));
        setServices(parseArr(servicesRes));
    };

    const refreshAll = async () => {
        setLoading(true);
        setError('');
        try {
            await Promise.all([refreshLedger(), refreshRules()]);
        } catch (e) {
            setError(e.message || 'Failed to load commissions');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshAll();
    }, []);

    useEffect(() => {
        refreshLedger().catch(() => null);
    }, [employeeId, status, dateFrom, dateTo]);

    useEffect(() => {
        refreshRules().catch(() => null);
    }, [ruleSearch]);

    useEffect(() => {
        const handler = () => setServiceDropdownOpen(false);
        document.addEventListener('click', handler);
        return () => document.removeEventListener('click', handler);
    }, []);

    const accruedRows = useMemo(
        () => commissions.filter((c) => (c.status || '').toLowerCase() === 'accrued'),
        [commissions],
    );
    const selectedRows = useMemo(
        () => commissions.filter((c) => selectedIds.has(c.id)),
        [commissions, selectedIds],
    );
    const selectedTotal = selectedRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const allAccruedSelected = accruedRows.length > 0 && accruedRows.every((r) => selectedIds.has(r.id));

    const toggleRow = (id) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const selectAllAccrued = () => {
        if (allAccruedSelected) {
            setSelectedIds(new Set());
            return;
        }
        setSelectedIds(new Set(accruedRows.map((r) => r.id)));
    };

    const submitPayout = async () => {
        if (!payoutAccountId || selectedIds.size === 0) return;
        setPayoutBusy(true);
        try {
            await generatePayout({
                ids: Array.from(selectedIds),
                cashBankAccountId: payoutAccountId,
            });
            setPayoutOpen(false);
            setPayoutAccountId('');
            setSelectedIds(new Set());
            await refreshLedger();
        } catch (e) {
            setError(e.message || 'Failed to generate payout');
        } finally {
            setPayoutBusy(false);
        }
    };

    const startCreateRule = () => {
        setEditingRule(null);
        setServiceSearch('');
        setRuleForm({
            serviceId: '',
            serviceName: '',
            employeeRole: 'Technician',
            commissionType: 'Percentage',
            value: '',
            priority: 1,
            status: 'active',
            notes: '',
        });
        setRuleModalOpen(true);
    };

    const startEditRule = (rule) => {
        setEditingRule(rule);
        setServiceSearch(rule.serviceName || '');
        setRuleForm({
            serviceId: rule.serviceId || '',
            serviceName: rule.serviceName || '',
            employeeRole: rule.employeeRole || 'Technician',
            commissionType: rule.commissionType || 'Percentage',
            value: String(rule.value ?? ''),
            priority: Number(rule.priority || 1),
            status: rule.status || 'active',
            notes: rule.notes || '',
        });
        setRuleModalOpen(true);
    };

    const saveRule = async () => {
        if (!ruleForm.serviceName || !ruleForm.value) return;
        setRuleSaving(true);
        try {
            const body = {
                serviceId: ruleForm.serviceId || undefined,
                serviceName: ruleForm.serviceName,
                employeeRole: ruleForm.employeeRole,
                commissionType: ruleForm.commissionType,
                value: Number(ruleForm.value || 0),
                priority: Number(ruleForm.priority || 1),
                status: ruleForm.status,
                notes: ruleForm.notes || undefined,
            };
            if (editingRule?.id) await updateCommissionRule(editingRule.id, body);
            else await createCommissionRule(body);
            setRuleModalOpen(false);
            await refreshRules();
        } catch (e) {
            setError(e.message || 'Failed to save rule');
        } finally {
            setRuleSaving(false);
        }
    };

    const removeRule = async (id) => {
        if (readOnly) return;
        await deleteCommissionRule(id);
        await refreshRules();
    };

    return (
        <div style={{ background: '#fff', borderRadius: 14, padding: 16, border: '1px solid #f1f5f9' }}>
            <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#0f172a' }}>Commissions</div>
                <div style={{ color: '#64748b', marginTop: 3 }}>Track and manage employee commission accruals and payouts</div>
            </div>

            {error ? <div style={{ marginBottom: 12, color: '#dc2626', fontSize: 13 }}>{error}</div> : null}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
                <div style={{ border: '1px solid #dbeafe', background: '#eff6ff', borderRadius: 12, padding: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#1d4ed8', fontSize: 12 }}>
                        <TrendingUp size={15} />
                        Total Commission Generated
                    </div>
                    <div style={{ marginTop: 6, fontSize: 23, fontWeight: 800, color: '#1e3a8a' }}>SAR {Number(stats.totalGenerated || 0).toFixed(2)}</div>
                    <div style={{ color: '#2563eb', fontSize: 12 }}>{stats.totalRecords || 0} records</div>
                </div>
                <div style={{ border: '1px solid #dcfce7', background: '#f0fdf4', borderRadius: 12, padding: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#166534', fontSize: 12 }}>
                        <CheckCircle size={15} />
                        Total Paid
                    </div>
                    <div style={{ marginTop: 6, fontSize: 23, fontWeight: 800, color: '#16a34a' }}>SAR {Number(stats.totalPaid || 0).toFixed(2)}</div>
                    <div style={{ color: '#15803d', fontSize: 12 }}>{stats.paidCount || 0} paid</div>
                </div>
                <div style={{ border: '1px solid #fed7aa', background: '#fff7ed', borderRadius: 12, padding: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#9a3412', fontSize: 12 }}>
                        <AlertCircle size={15} />
                        Outstanding Commission
                    </div>
                    <div style={{ marginTop: 6, fontSize: 23, fontWeight: 800, color: '#f59e0b' }}>SAR {Number(stats.outstanding || 0).toFixed(2)}</div>
                    <div style={{ color: '#d97706', fontSize: 12 }}>{stats.pendingCount || 0} pending payout</div>
                </div>
            </div>

            <div style={{ display: 'flex', gap: 18, borderBottom: '1px solid #e5e7eb', marginBottom: 14 }}>
                {[
                    { id: 'ledger', label: 'Commission Ledger' },
                    { id: 'rules', label: 'Commission Rules' },
                ].map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setActiveTab(t.id)}
                        style={{
                            border: 'none',
                            background: 'transparent',
                            padding: '8px 0',
                            fontWeight: 700,
                            color: activeTab === t.id ? '#111827' : '#64748b',
                            borderBottom: activeTab === t.id ? `2px solid ${gold}` : '2px solid transparent',
                            cursor: 'pointer',
                        }}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>Loading commissions...</div>
            ) : activeTab === 'ledger' ? (
                <div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.8fr 0.7fr 0.7fr auto auto', gap: 8, marginBottom: 10 }}>
                        <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} style={box}>
                            <option value="">All Employees</option>
                            {employees.map((e) => (
                                <option key={String(e.id)} value={String(e.id)}>
                                    {e.name || e.fullName || `Employee ${e.id}`}
                                </option>
                            ))}
                        </select>
                        <select value={status} onChange={(e) => setStatus(e.target.value)} style={box}>
                            <option value="all">All</option>
                            <option value="accrued">Accrued</option>
                            <option value="paid">Paid</option>
                        </select>
                        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={box} />
                        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={box} />
                        <button
                            onClick={selectAllAccrued}
                            style={{ ...box, width: 120, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}
                        >
                            <UserCheck size={14} />
                            Select All
                        </button>
                        {!readOnly && (
                            <button
                                onClick={() => setPayoutOpen(true)}
                                disabled={selectedIds.size === 0}
                                style={{
                                    ...box,
                                    width: 230,
                                    border: 'none',
                                    background: selectedIds.size === 0 ? '#86efac' : '#16a34a',
                                    color: '#fff',
                                    cursor: selectedIds.size === 0 ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    justifyContent: 'center',
                                }}
                            >
                                <Download size={14} />
                                Generate Payout (All Accrued)
                            </button>
                        )}
                    </div>

                    <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#f8fafc' }}>
                                    {['', 'EMPLOYEE', 'DATE', 'JOB CARD', 'SERVICE', 'COMMISSION', 'STATUS', 'PAYOUT REF'].map((h, idx) => (
                                        <th key={h + idx} style={{ textAlign: 'left', padding: '10px 8px', fontSize: 12, color: '#334155', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {commissions.length === 0 ? (
                                    <tr><td colSpan={8} style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>No commission records found</td></tr>
                                ) : commissions.map((row) => {
                                    const isAccrued = (row.status || '').toLowerCase() === 'accrued';
                                    return (
                                        <tr key={row.id}>
                                            <td style={{ padding: '10px 8px', borderBottom: '1px solid #f1f5f9' }}>
                                                {!readOnly && isAccrued ? (
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedIds.has(row.id)}
                                                        onChange={() => toggleRow(row.id)}
                                                    />
                                                ) : (
                                                    <span style={{ opacity: 0.45 }}>-</span>
                                                )}
                                            </td>
                                            <td style={{ padding: '10px 8px', borderBottom: '1px solid #f1f5f9', fontSize: 12 }}>{row.employeeName}</td>
                                            <td style={{ padding: '10px 8px', borderBottom: '1px solid #f1f5f9', fontSize: 12 }}>
                                                {new Date(row.date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}
                                            </td>
                                            <td style={{ padding: '10px 8px', borderBottom: '1px solid #f1f5f9', fontSize: 12 }}>{row.jobCard || '—'}</td>
                                            <td style={{ padding: '10px 8px', borderBottom: '1px solid #f1f5f9', fontSize: 12 }}>{row.serviceName || '—'}</td>
                                            <td style={{ padding: '10px 8px', borderBottom: '1px solid #f1f5f9', fontSize: 12, fontWeight: 700 }}>SAR {Number(row.amount || 0).toFixed(2)}</td>
                                            <td style={{ padding: '10px 8px', borderBottom: '1px solid #f1f5f9' }}>
                                                <span
                                                    style={{
                                                        fontSize: 11,
                                                        padding: '4px 8px',
                                                        borderRadius: 999,
                                                        background: isAccrued ? '#fef3c7' : '#dcfce7',
                                                        color: isAccrued ? '#d97706' : '#16a34a',
                                                        fontWeight: 700,
                                                        textTransform: 'capitalize',
                                                    }}
                                                >
                                                    {row.status}
                                                </span>
                                            </td>
                                            <td style={{ padding: '10px 8px', borderBottom: '1px solid #f1f5f9', fontSize: 12, color: row.payoutRef ? gold : '#94a3b8', fontWeight: row.payoutRef ? 700 : 500 }}>
                                                {row.payoutRef || '—'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                            <Search size={16} style={{ position: 'absolute', left: 10, top: 12, color: '#94a3b8' }} />
                            <input
                                value={ruleSearch}
                                onChange={(e) => setRuleSearch(e.target.value)}
                                placeholder="Search by service..."
                                style={{ ...box, width: '100%', paddingLeft: 32 }}
                            />
                        </div>
                        {!readOnly && (
                            <button
                                onClick={startCreateRule}
                                style={{
                                    ...box,
                                    width: 120,
                                    border: 'none',
                                    background: gold,
                                    color: '#fff',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 6,
                                }}
                            >
                                <Plus size={14} />
                                Add Rule
                            </button>
                        )}
                    </div>

                    <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#f8fafc' }}>
                                    {['SERVICE', 'ROLE', 'TYPE', 'VALUE', 'PRIORITY', 'STATUS', 'ACTIONS'].map((h) => (
                                        <th key={h} style={{ textAlign: 'left', padding: '10px 8px', fontSize: 12, color: '#334155', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {rules.length === 0 ? (
                                    <tr><td colSpan={7} style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>No rules found</td></tr>
                                ) : rules.map((r) => (
                                    <tr key={r.id}>
                                        <td style={{ padding: '10px 8px', borderBottom: '1px solid #f1f5f9', fontSize: 12 }}>{r.serviceName}</td>
                                        <td style={{ padding: '10px 8px', borderBottom: '1px solid #f1f5f9', fontSize: 12 }}>
                                            <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999, background: '#fffbeb', color: '#a16207', fontWeight: 700 }}>{r.employeeRole}</span>
                                        </td>
                                        <td style={{ padding: '10px 8px', borderBottom: '1px solid #f1f5f9', fontSize: 12 }}>{r.commissionType}</td>
                                        <td style={{ padding: '10px 8px', borderBottom: '1px solid #f1f5f9', fontSize: 12, fontWeight: 700 }}>
                                            {r.commissionType === 'Percentage' ? `${Number(r.value || 0).toFixed(2)}%` : `SAR ${Number(r.value || 0).toFixed(2)}`}
                                        </td>
                                        <td style={{ padding: '10px 8px', borderBottom: '1px solid #f1f5f9', fontSize: 12 }}>{r.priority}</td>
                                        <td style={{ padding: '10px 8px', borderBottom: '1px solid #f1f5f9', fontSize: 12 }}>
                                            <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999, background: (r.status || '').toLowerCase() === 'active' ? '#dcfce7' : '#e5e7eb', color: (r.status || '').toLowerCase() === 'active' ? '#16a34a' : '#6b7280', fontWeight: 700 }}>
                                                {(r.status || '').toLowerCase() === 'active' ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '10px 8px', borderBottom: '1px solid #f1f5f9', fontSize: 12 }}>
                                            {!readOnly && (
                                                <div style={{ display: 'flex', gap: 8 }}>
                                                    <button onClick={() => startEditRule(r)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}><Pencil size={15} color="#334155" /></button>
                                                    <button onClick={() => removeRule(r.id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}><Trash2 size={15} color="#dc2626" /></button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {payoutOpen && !readOnly ? (
                <Modal
                    title="Confirm Commission Payout"
                    onClose={() => setPayoutOpen(false)}
                    width="560px"
                    footer={
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                            <button onClick={() => setPayoutOpen(false)} style={{ ...box, width: 100, cursor: 'pointer' }}>Cancel</button>
                            <button
                                onClick={submitPayout}
                                disabled={payoutBusy || !payoutAccountId}
                                style={{ ...box, width: 140, border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer' }}
                            >
                                {payoutBusy ? 'Saving...' : 'Confirm Payout'}
                            </button>
                        </div>
                    }
                >
                    <div style={{ padding: '6px 0' }}>
                        <div style={{ border: '1px solid #dbeafe', background: '#eff6ff', borderRadius: 10, padding: 10, marginBottom: 12 }}>
                            <div style={{ fontSize: 13, color: '#1d4ed8', fontWeight: 700 }}>{selectedRows.length} commission(s)</div>
                            <div style={{ fontSize: 16, color: '#1e3a8a', fontWeight: 800 }}>SAR {selectedTotal.toFixed(2)} total</div>
                        </div>
                        <div style={{ marginBottom: 12 }}>
                            <div style={{ marginBottom: 6, fontSize: 12, color: '#334155', fontWeight: 700 }}>Cash/Bank Account (Credit)</div>
                            <select value={payoutAccountId} onChange={(e) => setPayoutAccountId(e.target.value)} style={{ ...box, width: '100%' }}>
                                <option value="">Select account...</option>
                                {cashBankAccounts.map((a) => (
                                    <option key={String(a.id)} value={String(a.id)}>
                                        {a.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>
                            Dr Commission Payable / Cr {payoutAccountId ? (cashBankAccounts.find((a) => String(a.id) === payoutAccountId)?.name || 'Selected Account') : '[Selected Account]'}
                        </div>
                    </div>
                </Modal>
            ) : null}

            {ruleModalOpen && !readOnly ? (
                <Modal
                    title={editingRule ? 'Edit Commission Rule' : 'New Commission Rule'}
                    onClose={() => setRuleModalOpen(false)}
                    width="620px"
                    footer={
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                            <button onClick={() => setRuleModalOpen(false)} style={{ ...box, width: 100, cursor: 'pointer' }}>Cancel</button>
                            <button
                                onClick={saveRule}
                                disabled={ruleSaving || !ruleForm.serviceName || !ruleForm.value}
                                style={{ ...box, width: 120, border: 'none', background: gold, color: '#fff', cursor: 'pointer' }}
                            >
                                {ruleSaving ? 'Saving...' : 'Save Rule'}
                            </button>
                        </div>
                    }
                >
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        {/* Service * - Searchable */}
                        <div onClick={e => e.stopPropagation()} style={{ gridColumn: '1 / span 2' }}>
                          <div style={{ fontSize: 12, color: '#334155', fontWeight: 700, marginBottom: 6 }}>Service *</div>
                          <div style={{ position: 'relative' }}>
                            <input
                              value={serviceSearch}
                              onChange={(e) => {
                                setServiceSearch(e.target.value);
                                setServiceDropdownOpen(true);
                                setRuleForm((p) => ({ ...p, serviceId: '', serviceName: e.target.value }));
                              }}
                              onFocus={() => setServiceDropdownOpen(true)}
                              placeholder="Select service..."
                              style={{
                                width: '100%', padding: '10px 12px', border: `1px solid ${ruleForm.serviceName ? '#D4A017' : '#e5e7eb'}`,
                                borderRadius: 6, fontSize: 13, outline: 'none', boxSizing: 'border-box'
                              }}
                            />
                            <ChevronDown size={15} style={{ position: 'absolute', right: 10, top: 12, color: '#94a3b8', pointerEvents: 'none' }} />
                            {serviceDropdownOpen && (
                              <div style={{
                                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
                                background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6,
                                maxHeight: 220, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                              }}>
                                {services
                                  .filter(s => s.name.toLowerCase().includes(serviceSearch.toLowerCase()))
                                  .map(s => (
                                    <div
                                      key={s.id}
                                      onClick={() => {
                                        setRuleForm(p => ({ ...p, serviceId: s.id, serviceName: s.name }));
                                        setServiceSearch(s.name);
                                        setServiceDropdownOpen(false);
                                      }}
                                      style={{
                                        padding: '10px 14px', cursor: 'pointer', fontSize: 13,
                                        background: ruleForm.serviceId === s.id ? '#fef9ec' : '#fff',
                                        fontWeight: ruleForm.serviceId === s.id ? 700 : 400,
                                      }}
                                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                                      onMouseLeave={e => e.currentTarget.style.background = ruleForm.serviceId === s.id ? '#fef9ec' : '#fff'}
                                    >
                                      {s.name}
                                    </div>
                                  ))}
                                {services.filter(s => s.name.toLowerCase().includes(serviceSearch.toLowerCase())).length === 0 && (
                                  <div style={{ padding: '10px 14px', color: '#94a3b8', fontSize: 13 }}>No services found</div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <div>
                            <div style={{ fontSize: 12, color: '#334155', fontWeight: 700, marginBottom: 6 }}>Employee Role *</div>
                            <select value={ruleForm.employeeRole} onChange={(e) => setRuleForm((p) => ({ ...p, employeeRole: e.target.value }))} style={{ ...box, width: '100%', borderColor: gold }}>
                                <option value="Technician">Technician</option>
                                <option value="Advisor">Advisor</option>
                                <option value="Both">Both</option>
                            </select>
                        </div>
                        <div>
                            <div style={{ fontSize: 12, color: '#334155', fontWeight: 700, marginBottom: 6 }}>Commission Type *</div>
                            <select value={ruleForm.commissionType} onChange={(e) => setRuleForm((p) => ({ ...p, commissionType: e.target.value }))} style={{ ...box, width: '100%' }}>
                                <option value="Percentage">Percentage</option>
                                <option value="Fixed Amount">Fixed Amount</option>
                            </select>
                        </div>
                        <div>
                            <div style={{ fontSize: 12, color: '#334155', fontWeight: 700, marginBottom: 6 }}>
                                {ruleForm.commissionType === 'Percentage' ? 'Percentage (%)' : 'Fixed Amount (SAR)'}
                            </div>
                            <input
                                type="number"
                                value={ruleForm.value}
                                onChange={(e) => setRuleForm((p) => ({ ...p, value: e.target.value }))}
                                style={{ ...box, width: '100%' }}
                            />
                        </div>
                        <div>
                            <div style={{ fontSize: 12, color: '#334155', fontWeight: 700, marginBottom: 6 }}>Priority</div>
                            <input
                                type="number"
                                value={ruleForm.priority}
                                onChange={(e) => setRuleForm((p) => ({ ...p, priority: e.target.value }))}
                                style={{ ...box, width: '100%' }}
                            />
                        </div>
                        <div>
                            <div style={{ fontSize: 12, color: '#334155', fontWeight: 700, marginBottom: 6 }}>Status</div>
                            <select value={ruleForm.status} onChange={(e) => setRuleForm((p) => ({ ...p, status: e.target.value }))} style={{ ...box, width: '100%' }}>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>
                        <div style={{ gridColumn: '1 / span 2' }}>
                            <div style={{ fontSize: 12, color: '#334155', fontWeight: 700, marginBottom: 6 }}>Notes</div>
                            <textarea
                                value={ruleForm.notes}
                                onChange={(e) => setRuleForm((p) => ({ ...p, notes: e.target.value }))}
                                rows={3}
                                style={{ ...box, width: '100%', height: 'auto', padding: 10, resize: 'vertical' }}
                            />
                        </div>
                    </div>
                </Modal>
            ) : null}
        </div>
    );
}
