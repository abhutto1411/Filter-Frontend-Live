import React, { useEffect, useMemo, useState } from 'react';
import {
    Activity,
    ArrowLeftRight,
    BookOpen,
    Calendar,
    CheckCircle,
    ChevronDown,
    Clock,
    DollarSign,
    Plus,
    Search,
    Users,
    Wallet,
    X,
} from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../Modal';
import { apiFetch } from '../../services/api';
import { getAccounts as getCashBankAccounts } from '../../services/cashBankApi';
import {
    bulkCreateAdvances,
    bulkCreateSalaryPayments,
    createAdvance,
    createSalaryPayment,
    getAdvances,
    getEmployeeLedger,
    getSalaryPayments,
    getStats,
} from '../../services/advancesApi';

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

const makeAdvanceRow = () => ({ id: Date.now() + Math.random(), employeeId: '', amount: '', date: new Date().toISOString().slice(0, 10), payFromAccountId: '', reason: '' });
const makeSalaryRow = () => ({ id: Date.now() + Math.random(), employeeId: '', grossSalary: '', advanceDeduction: '0', period: 'March 2026', paymentDate: new Date().toISOString().slice(0, 10), payFromAccountId: '' });

export default function AdvancesView({ readOnly = false }) {
    const [activeTab, setActiveTab] = useState('Advances');
    const [filter, setFilter] = useState('All');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');

    const [payAdvanceOpen, setPayAdvanceOpen] = useState(false);
    const [bulkAdvanceOpen, setBulkAdvanceOpen] = useState(false);
    const [bulkSalaryOpen, setBulkSalaryOpen] = useState(false);
    const [paySalaryOpen, setPaySalaryOpen] = useState(false);

    const [stats, setStats] = useState({ totalAdvancesPaid: 0, outstandingBalance: 0, pendingCount: 0 });
    const [advances, setAdvances] = useState([]);
    const [salaryPayments, setSalaryPayments] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [cashBankAccounts, setCashBankAccounts] = useState([]);
    const [ledgerEmployeeId, setLedgerEmployeeId] = useState('');
    const [ledgerRows, setLedgerRows] = useState([]);

    const [advanceForm, setAdvanceForm] = useState({ employeeId: '', amount: '', date: new Date().toISOString().slice(0, 10), payFromAccountId: '', reason: '' });
    const [salaryForm, setSalaryForm] = useState({ employeeId: '', period: 'March 2026', paymentDate: new Date().toISOString().slice(0, 10), grossSalary: '', advanceDeduction: '0', payFromAccountId: '', notes: '' });
    const [bulkAdvanceRows, setBulkAdvanceRows] = useState([makeAdvanceRow()]);
    const [bulkSalaryRows, setBulkSalaryRows] = useState([makeSalaryRow()]);

    const employeeById = useMemo(() => Object.fromEntries(employees.map((e) => [String(e.id), e])), [employees]);

    const refresh = async () => {
        setLoading(true);
        setError('');
        try {
            const [s, a, sal, emps, cb] = await Promise.all([
                getStats(),
                getAdvances().catch(() => []),
                getSalaryPayments().catch(() => []),
                apiFetch('/super-admin/users').catch(() => []),
                getCashBankAccounts().catch(() => []),
            ]);
            setStats(s || { totalAdvancesPaid: 0, outstandingBalance: 0, pendingCount: 0 });
            setAdvances(parseArr(a?.list ?? a));
            setSalaryPayments(parseArr(sal));
            setEmployees(parseArr(emps?.users ?? emps));
            setCashBankAccounts(parseArr(cb));
        } catch (e) {
            setError(e.message || 'Failed to load advances data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { refresh(); }, []);

    useEffect(() => {
        if (!ledgerEmployeeId) {
            setLedgerRows([]);
            return;
        }
        getEmployeeLedger(ledgerEmployeeId).then((res) => setLedgerRows(res?.rows || [])).catch(() => setLedgerRows([]));
    }, [ledgerEmployeeId]);

    const filteredAdvances = useMemo(() => {
        const q = search.trim().toLowerCase();
        return advances.filter((a) => {
            const statusMatch = filter === 'All' ? true : (a.status || '').toLowerCase() === filter.toLowerCase();
            const searchMatch = !q || (a.employeeName || '').toLowerCase().includes(q) || (a.reason || '').toLowerCase().includes(q);
            return statusMatch && searchMatch;
        });
    }, [advances, filter, search]);

    const filteredSalary = useMemo(() => {
        const q = search.trim().toLowerCase();
        return salaryPayments.filter((p) => !q || (p.employeeName || '').toLowerCase().includes(q) || (p.period || '').toLowerCase().includes(q));
    }, [salaryPayments, search]);

    const submitAdvance = async () => {
        const emp = employeeById[String(advanceForm.employeeId)];
        await createAdvance({
            employeeId: String(advanceForm.employeeId),
            employeeName: emp?.name || emp?.fullName || 'Employee',
            amount: Number(advanceForm.amount || 0),
            date: advanceForm.date,
            payFromAccountId: advanceForm.payFromAccountId || undefined,
            reason: advanceForm.reason || undefined,
        });
        setPayAdvanceOpen(false);
        setAdvanceForm({ employeeId: '', amount: '', date: new Date().toISOString().slice(0, 10), payFromAccountId: '', reason: '' });
        await refresh();
    };

    const submitBulkAdvances = async () => {
        const rows = bulkAdvanceRows
            .filter((r) => r.employeeId && Number(r.amount) > 0 && r.payFromAccountId)
            .map((r) => {
                const emp = employeeById[String(r.employeeId)];
                return {
                    employeeId: String(r.employeeId),
                    employeeName: emp?.name || emp?.fullName || 'Employee',
                    amount: Number(r.amount || 0),
                    date: r.date,
                    payFromAccountId: r.payFromAccountId || undefined,
                    reason: r.reason || undefined,
                };
            });
        if (!rows.length) return;
        await bulkCreateAdvances({ rows });
        setBulkAdvanceOpen(false);
        setBulkAdvanceRows([makeAdvanceRow()]);
        await refresh();
    };

    const submitSalary = async () => {
        const emp = employeeById[String(salaryForm.employeeId)];
        await createSalaryPayment({
            employeeId: String(salaryForm.employeeId),
            employeeName: emp?.name || emp?.fullName || 'Employee',
            period: salaryForm.period,
            paymentDate: salaryForm.paymentDate,
            grossSalary: Number(salaryForm.grossSalary || 0),
            advanceDeduction: Number(salaryForm.advanceDeduction || 0),
            payFromAccountId: salaryForm.payFromAccountId || undefined,
            notes: salaryForm.notes || undefined,
        });
        setPaySalaryOpen(false);
        setSalaryForm({ employeeId: '', period: 'March 2026', paymentDate: new Date().toISOString().slice(0, 10), grossSalary: '', advanceDeduction: '0', payFromAccountId: '', notes: '' });
        await refresh();
    };

    const submitBulkSalary = async () => {
        const rows = bulkSalaryRows
            .filter((r) => r.employeeId && Number(r.grossSalary) > 0 && r.payFromAccountId)
            .map((r) => {
                const emp = employeeById[String(r.employeeId)];
                return {
                    employeeId: String(r.employeeId),
                    employeeName: emp?.name || emp?.fullName || 'Employee',
                    period: r.period,
                    paymentDate: r.paymentDate,
                    grossSalary: Number(r.grossSalary || 0),
                    advanceDeduction: Number(r.advanceDeduction || 0),
                    payFromAccountId: r.payFromAccountId || undefined,
                };
            });
        if (!rows.length) return;
        await bulkCreateSalaryPayments({ rows });
        setBulkSalaryOpen(false);
        setBulkSalaryRows([makeSalaryRow()]);
        await refresh();
    };

    return (
        <div className="advances-view">
            <header className="advances-header">
                <div className="adv-header-left">
                    <h2 className="adv-title">Employee Advances & Payroll</h2>
                    <p className="adv-desc">Pay advances, process salaries, view ledger per employee</p>
                </div>
                {!readOnly && (
                    <div className="adv-header-actions">
                        <button className="btn-adv-action btn-pay-salary" onClick={() => setPaySalaryOpen(true)}>
                            <Activity size={16} /> Pay Salary
                        </button>
                        <button className="btn-adv-action btn-bulk-salaries" onClick={() => setBulkSalaryOpen(true)}>
                            <Users size={16} /> Bulk Salaries
                        </button>
                        <button className="btn-adv-action btn-bulk-advances" onClick={() => setBulkAdvanceOpen(true)}>
                            <Users size={16} /> Bulk Advances
                        </button>
                        <button className="btn-adv-action btn-pay-advance btn-primary-adv" onClick={() => setPayAdvanceOpen(true)}>
                            <Plus size={16} /> Pay Advance
                        </button>
                    </div>
                )}
            </header>

            <div className="advances-stats">
                <div className="adv-stat-card">
                    <div className="adv-stat-icon-wrapper icon-blue"><Wallet size={20} /></div>
                    <div className="adv-stat-info"><span className="adv-stat-label">Total Advances Paid</span><span className="adv-stat-value">SAR {Number(stats.totalAdvancesPaid || 0).toFixed(2)}</span></div>
                </div>
                <div className="adv-stat-card">
                    <div className="adv-stat-icon-wrapper icon-red"><DollarSign size={20} /></div>
                    <div className="adv-stat-info"><span className="adv-stat-label">Outstanding Balance</span><span className="adv-stat-value text-red">SAR {Number(stats.outstandingBalance || 0).toFixed(2)}</span></div>
                </div>
                <div className="adv-stat-card">
                    <div className="adv-stat-icon-wrapper icon-orange"><Clock size={20} /></div>
                    <div className="adv-stat-info"><span className="adv-stat-label">Pending Advances</span><span className="adv-stat-value">{stats.pendingCount || 0}</span></div>
                </div>
            </div>

            <div className="adv-tabs-row">
                <div className="adv-pills">
                    {['Advances', 'Salary Payments', 'Employee Ledger'].map(tab => (
                        <button key={tab} className={`adv-pill ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>{tab}</button>
                    ))}
                </div>
            </div>

            <div className="adv-filters-bar">
                <div className="adv-search-wrapper">
                    <Search className="search-icon" size={16} />
                    <input type="text" placeholder="Search by employee..." value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <div className="adv-status-filters">
                    {['All', 'Pending', 'Approved', 'Repaid', 'Rejected'].map(f => (
                        <button key={f} className={`adv-status-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>{f}</button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>Loading...</div>
            ) : error ? (
                <div style={{ padding: 24, textAlign: 'center', color: '#dc2626' }}>{error}</div>
            ) : activeTab === 'Employee Ledger' ? (
                <div style={{ padding: '24px', background: 'white', borderRadius: '16px', border: '1px solid #F1F5F9', minHeight: '300px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                        <BookOpen size={20} color="#64748B" />
                        <span style={{ fontWeight: 600, color: '#1E293B' }}>Select Employee to View Ledger</span>
                        <div className="ps-select-wrapper" style={{ width: '280px' }}>
                            <select value={ledgerEmployeeId} onChange={(e) => setLedgerEmployeeId(e.target.value)}>
                                <option value="">Select employee...</option>
                                {employees.map((e) => <option key={String(e.id)} value={String(e.id)}>{e.name || e.fullName || `Employee ${e.id}`}</option>)}
                            </select>
                            <ChevronDown size={16} className="ps-select-icon" />
                        </div>
                    </div>
                    {!ledgerEmployeeId ? (
                        <div style={{ display: 'flex', justifyContent: 'center', color: '#94A3B8', paddingTop: 40 }}>Select an employee to view their ledger account</div>
                    ) : ledgerRows.length === 0 ? (
                        <div style={{ display: 'flex', justifyContent: 'center', color: '#94A3B8', paddingTop: 40 }}>No ledger entries found</div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead><tr><th className="table-th">DATE</th><th className="table-th">DESCRIPTION</th><th className="table-th">DEBIT</th><th className="table-th">CREDIT</th><th className="table-th">BALANCE</th></tr></thead>
                            <tbody>{ledgerRows.map((r, idx) => <tr key={idx} className="table-row"><td className="table-cell">{new Date(r.date).toLocaleDateString()}</td><td className="table-cell">{r.description}</td><td className="table-cell">SAR {Number(r.debit || 0).toFixed(2)}</td><td className="table-cell">SAR {Number(r.credit || 0).toFixed(2)}</td><td className="table-cell">SAR {Number(r.balance || 0).toFixed(2)}</td></tr>)}</tbody>
                        </table>
                    )}
                </div>
            ) : (
                <section className="premium-table advances-table">
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr className="table-header-row">
                                {activeTab === 'Advances' ? (
                                    <>
                                        <th className="table-th">DATE</th><th className="table-th">EMPLOYEE</th><th className="table-th">REASON</th><th className="table-th">PAID FROM</th><th className="table-th">AMOUNT</th><th className="table-th">REPAID</th><th className="table-th">BALANCE</th><th className="table-th">STATUS</th>
                                    </>
                                ) : (
                                    <>
                                        <th className="table-th">DATE</th><th className="table-th">EMPLOYEE</th><th className="table-th">PERIOD</th><th className="table-th">GROSS SALARY</th><th className="table-th">ADVANCE DEDUCTED</th><th className="table-th">NET PAID</th><th className="table-th">METHOD</th><th className="table-th">STATUS</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {activeTab === 'Advances' ? (
                                filteredAdvances.length === 0 ? <tr><td colSpan={8} className="table-cell table-empty">No advances found</td></tr> : filteredAdvances.map((a) => (
                                    <tr key={a.id} className="table-row">
                                        <td className="table-cell">{new Date(a.date).toLocaleDateString()}</td>
                                        <td className="table-cell" style={{ fontWeight: 700 }}>{a.employeeName}</td>
                                        <td className="table-cell">{a.reason || '-'}</td>
                                        <td className="table-cell">{a.payFromAccountName || '-'}</td>
                                        <td className="table-cell" style={{ fontWeight: 700 }}>SAR {Number(a.amount).toFixed(2)}</td>
                                        <td className="table-cell">SAR {Number(a.repaidAmount).toFixed(2)}</td>
                                        <td className="table-cell">SAR {Number(a.balance).toFixed(2)}</td>
                                        <td className="table-cell"><span className={`status-badge ${(a.status || '').toLowerCase() === 'approved' ? 'approved' : 'pending'}`}>{a.status}</span></td>
                                    </tr>
                                ))
                            ) : (
                                filteredSalary.length === 0 ? <tr><td colSpan={8} className="table-cell table-empty">No salary payments found</td></tr> : filteredSalary.map((p) => (
                                    <tr key={p.id} className="table-row">
                                        <td className="table-cell">{new Date(p.paymentDate).toLocaleDateString()}</td>
                                        <td className="table-cell" style={{ fontWeight: 700 }}>{p.employeeName}</td>
                                        <td className="table-cell">{p.period}</td>
                                        <td className="table-cell" style={{ fontWeight: 700 }}>SAR {Number(p.grossSalary).toFixed(2)}</td>
                                        <td className="table-cell" style={{ color: '#EF4444' }}>- SAR {Number(p.advanceDeduction).toFixed(2)}</td>
                                        <td className="table-cell" style={{ color: '#10B981', fontWeight: 700 }}>SAR {Number(p.netSalary).toFixed(2)}</td>
                                        <td className="table-cell">{p.method}</td>
                                        <td className="table-cell"><span className="status-badge approved">{p.status}</span></td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </section>
            )}

            <AnimatePresence>
                {payAdvanceOpen && (
                    <Modal
                        title={<div className="ps-modal-title"><ArrowLeftRight className="ps-title-icon" size={18} /><span>Pay Salary Advance</span></div>}
                        onClose={() => setPayAdvanceOpen(false)}
                        width="500px"
                        contentClassName="modal-content-advance"
                        footer={<div className="ps-modal-footer"><button className="btn-ps-cancel" onClick={() => setPayAdvanceOpen(false)}>Cancel</button><button className="btn-ps-pay" onClick={submitAdvance}>Pay & Post Entries</button></div>}
                    >
                        <div className="ps-form">
                            <div className="ps-field"><label>Employee *</label><div className="ps-select-wrapper"><select value={advanceForm.employeeId} onChange={(e) => setAdvanceForm({ ...advanceForm, employeeId: e.target.value })}><option value="">Select employee</option>{employees.map((e) => <option key={String(e.id)} value={String(e.id)}>{e.name || e.fullName || `Employee ${e.id}`}</option>)}</select><ChevronDown size={16} className="ps-select-icon" /></div></div>
                            <div className="ps-row">
                                <div className="ps-field"><label>Amount (SAR) *</label><input type="number" value={advanceForm.amount} onChange={(e) => setAdvanceForm({ ...advanceForm, amount: e.target.value })} placeholder="0.00" /></div>
                                <div className="ps-field"><label>Date *</label><div className="ps-date-input"><input type="date" value={advanceForm.date} onChange={(e) => setAdvanceForm({ ...advanceForm, date: e.target.value })} /><Calendar size={16} /></div></div>
                            </div>
                            <div className="ps-field"><label>Pay From (Cash / Bank Account) *</label><div className="ps-select-wrapper"><select value={advanceForm.payFromAccountId} onChange={(e) => setAdvanceForm({ ...advanceForm, payFromAccountId: e.target.value })}><option value="">Select cash/bank account</option>{cashBankAccounts.map((a) => <option key={String(a.id)} value={String(a.id)}>{a.name}</option>)}</select><ChevronDown size={16} className="ps-select-icon" /></div></div>
                            <div className="ps-field"><label>Reason *</label><textarea value={advanceForm.reason} onChange={(e) => setAdvanceForm({ ...advanceForm, reason: e.target.value })} placeholder="Purpose of advance..." rows={3} /></div>
                        </div>
                    </Modal>
                )}

                {bulkAdvanceOpen && (
                    <Modal
                        title={<div className="ps-modal-title"><Users className="ps-title-icon" size={18} /><span>Bulk Pay Advances</span></div>}
                        onClose={() => setBulkAdvanceOpen(false)}
                        width="1100px"
                        contentClassName="modal-content-bulk"
                        footer={<div className="ps-modal-footer"><button className="btn-ps-cancel" onClick={() => setBulkAdvanceOpen(false)}>Cancel</button><button className="btn-ps-pay btn-gold" onClick={submitBulkAdvances}>Pay {bulkAdvanceRows.length} Advance(s)</button></div>}
                    >
                        <div className="bulk-form">
                            <div className="bulk-table-header"><div className="bulk-col-emp">Employee *</div><div className="bulk-col-amt">Amount (SAR) *</div><div className="bulk-col-date">Date *</div><div className="bulk-col-from">Pay From *</div><div className="bulk-col-reason">Reason</div><div className="bulk-col-actions"></div></div>
                            <div className="bulk-table-rows">
                                {bulkAdvanceRows.map((row, idx) => (
                                    <div className="bulk-row" key={row.id}>
                                        <div className="ps-select-wrapper bulk-col-emp"><select value={row.employeeId} onChange={(e) => { const x = [...bulkAdvanceRows]; x[idx].employeeId = e.target.value; setBulkAdvanceRows(x); }}><option value="">Select...</option>{employees.map((e) => <option key={String(e.id)} value={String(e.id)}>{e.name || e.fullName || `Employee ${e.id}`}</option>)}</select><ChevronDown size={14} className="ps-select-icon" /></div>
                                        <div className="bulk-col-amt"><input type="number" value={row.amount} onChange={(e) => { const x = [...bulkAdvanceRows]; x[idx].amount = e.target.value; setBulkAdvanceRows(x); }} placeholder="0.00" /></div>
                                        <div className="bulk-col-date"><div className="ps-date-input"><input type="date" value={row.date} onChange={(e) => { const x = [...bulkAdvanceRows]; x[idx].date = e.target.value; setBulkAdvanceRows(x); }} /><Calendar size={14} /></div></div>
                                        <div className="ps-select-wrapper bulk-col-from"><select value={row.payFromAccountId} onChange={(e) => { const x = [...bulkAdvanceRows]; x[idx].payFromAccountId = e.target.value; setBulkAdvanceRows(x); }}><option value="">Select...</option>{cashBankAccounts.map((a) => <option key={String(a.id)} value={String(a.id)}>{a.name}</option>)}</select><ChevronDown size={14} className="ps-select-icon" /></div>
                                        <div className="bulk-col-reason"><input type="text" value={row.reason} onChange={(e) => { const x = [...bulkAdvanceRows]; x[idx].reason = e.target.value; setBulkAdvanceRows(x); }} placeholder="Reason..." /></div>
                                        <div className="bulk-col-actions"><button className="btn-row-remove" onClick={() => setBulkAdvanceRows(bulkAdvanceRows.length > 1 ? bulkAdvanceRows.filter((r) => r.id !== row.id) : bulkAdvanceRows)}><X size={14} /></button></div>
                                    </div>
                                ))}
                            </div>
                            <button className="btn-add-row" onClick={() => setBulkAdvanceRows([...bulkAdvanceRows, makeAdvanceRow()])}><Plus size={14} /> Add Row</button>
                        </div>
                    </Modal>
                )}

                {bulkSalaryOpen && (
                    <Modal
                        title={<div className="ps-modal-title"><Users className="ps-title-icon text-green" size={18} /><span>Bulk Pay Salaries</span></div>}
                        onClose={() => setBulkSalaryOpen(false)}
                        width="1200px"
                        contentClassName="modal-content-bulk"
                        footer={<div className="ps-modal-footer"><button className="btn-ps-cancel" onClick={() => setBulkSalaryOpen(false)}>Cancel</button><button className="btn-ps-pay btn-green" onClick={submitBulkSalary}>Pay {bulkSalaryRows.length} Salary Payment(s)</button></div>}
                    >
                        <div className="bulk-form">
                            <div className="bulk-table-header bulk-salary-grid"><div className="bulk-col-emp">Employee *</div><div>Gross (SAR) *</div><div>Adv. Deduction</div><div>Net Salary</div><div>Period *</div><div>Date *</div><div>Pay From *</div><div></div></div>
                            <div className="bulk-table-rows">
                                {bulkSalaryRows.map((row, idx) => {
                                    const net = Number(row.grossSalary || 0) - Number(row.advanceDeduction || 0);
                                    return <div className="bulk-row bulk-salary-grid items-center" key={row.id}>
                                        <div className="ps-select-wrapper"><select value={row.employeeId} onChange={(e) => { const x = [...bulkSalaryRows]; x[idx].employeeId = e.target.value; setBulkSalaryRows(x); }}><option value="">Select...</option>{employees.map((e) => <option key={String(e.id)} value={String(e.id)}>{e.name || e.fullName || `Employee ${e.id}`}</option>)}</select><ChevronDown size={14} className="ps-select-icon" /></div>
                                        <input type="number" value={row.grossSalary} onChange={(e) => { const x = [...bulkSalaryRows]; x[idx].grossSalary = e.target.value; setBulkSalaryRows(x); }} placeholder="0.00" />
                                        <input type="number" value={row.advanceDeduction} onChange={(e) => { const x = [...bulkSalaryRows]; x[idx].advanceDeduction = e.target.value; setBulkSalaryRows(x); }} />
                                        <span className="net-salary-val">SAR {Number(net || 0).toFixed(2)}</span>
                                        <input type="text" value={row.period} onChange={(e) => { const x = [...bulkSalaryRows]; x[idx].period = e.target.value; setBulkSalaryRows(x); }} />
                                        <div className="ps-date-input"><input type="date" value={row.paymentDate} onChange={(e) => { const x = [...bulkSalaryRows]; x[idx].paymentDate = e.target.value; setBulkSalaryRows(x); }} /><Calendar size={14} /></div>
                                        <div className="ps-select-wrapper"><select value={row.payFromAccountId} onChange={(e) => { const x = [...bulkSalaryRows]; x[idx].payFromAccountId = e.target.value; setBulkSalaryRows(x); }}><option value="">Select...</option>{cashBankAccounts.map((a) => <option key={String(a.id)} value={String(a.id)}>{a.name}</option>)}</select><ChevronDown size={14} className="ps-select-icon" /></div>
                                        <button className="btn-row-remove" onClick={() => setBulkSalaryRows(bulkSalaryRows.length > 1 ? bulkSalaryRows.filter((r) => r.id !== row.id) : bulkSalaryRows)}><X size={14} /></button>
                                    </div>;
                                })}
                            </div>
                            <button className="btn-add-row" onClick={() => setBulkSalaryRows([...bulkSalaryRows, makeSalaryRow()])}><Plus size={14} /> Add Row</button>
                        </div>
                    </Modal>
                )}

                {paySalaryOpen && (
                    <Modal
                        title={<div className="ps-modal-title"><CheckCircle className="ps-title-icon text-green" size={18} /><span>Pay Salary</span></div>}
                        onClose={() => setPaySalaryOpen(false)}
                        width="500px"
                        contentClassName="modal-content-advance"
                        footer={<div className="ps-modal-footer"><button className="btn-ps-cancel" onClick={() => setPaySalaryOpen(false)}>Cancel</button><button className="btn-ps-pay btn-green" onClick={submitSalary}>Pay Salary & Post Entries</button></div>}
                    >
                        <div className="ps-form">
                            <div className="ps-field"><label>Employee *</label><div className="ps-select-wrapper"><select value={salaryForm.employeeId} onChange={(e) => setSalaryForm({ ...salaryForm, employeeId: e.target.value })}><option value="">Select employee</option>{employees.map((e) => <option key={String(e.id)} value={String(e.id)}>{e.name || e.fullName || `Employee ${e.id}`}</option>)}</select><ChevronDown size={16} className="ps-select-icon" /></div></div>
                            <div className="ps-row">
                                <div className="ps-field"><label>Period (Month) *</label><div className="ps-date-input"><input type="text" value={salaryForm.period} onChange={(e) => setSalaryForm({ ...salaryForm, period: e.target.value })} /><Calendar size={16} /></div></div>
                                <div className="ps-field"><label>Payment Date *</label><div className="ps-date-input"><input type="date" value={salaryForm.paymentDate} onChange={(e) => setSalaryForm({ ...salaryForm, paymentDate: e.target.value })} /><Calendar size={16} /></div></div>
                            </div>
                            <div className="ps-row">
                                <div className="ps-field"><label>Gross Salary (SAR) *</label><input type="number" value={salaryForm.grossSalary} onChange={(e) => setSalaryForm({ ...salaryForm, grossSalary: e.target.value })} placeholder="0.00" /></div>
                                <div className="ps-field"><label>Pay From *</label><div className="ps-select-wrapper"><select value={salaryForm.payFromAccountId} onChange={(e) => setSalaryForm({ ...salaryForm, payFromAccountId: e.target.value })}><option value="">Cash/Bank Account</option>{cashBankAccounts.map((a) => <option key={String(a.id)} value={String(a.id)}>{a.name}</option>)}</select><ChevronDown size={16} className="ps-select-icon" /></div></div>
                            </div>
                            <div className="salary-summary-box">
                                <div className="summary-row"><span className="label">Gross Salary</span><span className="val">SAR {Number(salaryForm.grossSalary || 0).toFixed(2)}</span></div>
                                <div className="summary-row text-red"><span className="label">Advance Deduction</span><span className="val">- SAR {Number(salaryForm.advanceDeduction || 0).toFixed(2)}</span></div>
                                <div className="summary-row grand text-green"><span className="label">Net Salary to Pay</span><span className="val">SAR {Math.max(0, Number(salaryForm.grossSalary || 0) - Number(salaryForm.advanceDeduction || 0)).toFixed(2)}</span></div>
                            </div>
                            <div className="ps-field"><label>Notes</label><textarea value={salaryForm.notes} onChange={(e) => setSalaryForm({ ...salaryForm, notes: e.target.value })} placeholder="Optional notes..." rows={2} /></div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
}
