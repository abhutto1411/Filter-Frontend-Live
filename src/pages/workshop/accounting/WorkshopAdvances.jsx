import React, { useState, useRef } from 'react';
import { useParams, NavLink } from 'react-router-dom';
import { Plus, Shield, X, Wallet, Landmark, Banknote, Settings, Trash2, Calendar, FileText, ArrowLeftRight, Search, Filter, CreditCard, DollarSign, Book, CheckCircle, Eye, Printer, AlertTriangle, ChevronDown, ShoppingCart, Zap, Users, UserPlus, Clock, Activity, Coins, BookOpen, Save, Percent, Calculator } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../../components/Modal';
import '../../../styles/admin/AccountingPage.css';

const SUB_TABS = [
    { path: 'chart-of-accounts', label: 'Chart of Accounts' },
    { path: 'cash-bank', label: 'Cash & Bank' },
    { path: 'transactions', label: 'Transactions' },
    { path: 'journal-entries', label: 'Journal Entries' },
    { path: 'purchases', label: 'Purchases' },
    { path: 'expenses', label: 'Expenses' },
    { path: 'receipts', label: 'Receipts' },
    { path: 'payments', label: 'Payments' },
    { path: 'advances', label: 'Advances' },
    { path: 'ledger', label: 'Ledger' },
];

const CASH_BANK_TABS = ['All Accounts', 'Cash', 'Bank', 'Petty Cash'];

const COA_TABS = ['Chart of Accounts', 'Trial Balance', 'P&L', 'Balance Sheet'];
const COA_SECTIONS = [
    { key: 'assets', label: 'Assets', labelPlural: 'Assets', balance: 'SAR 0.00', accounts: [{ code: 'AR-EAE767', name: 'Accounts Receivable — Safa Makkah', subtype: 'current asset', normalBal: 'debit', openingBal: 'SAR 0.00', currentBal: 'SAR 0.00', status: 'active', desc: 'Receivable from customer: Safa Makkah' }] },
    { key: 'liabilities', label: 'Liabilitys', labelPlural: 'Liabilitys', balance: 'SAR 0.00', accounts: [] },
    { key: 'equity', label: 'Equitys', labelPlural: 'Equitys', balance: 'SAR 0.00', accounts: [] },
    { key: 'revenue', label: 'Revenues', labelPlural: 'Revenues', balance: 'SAR 0.00', accounts: [] },
    { key: 'expenses', label: 'Expenses', labelPlural: 'Expenses', balance: 'SAR 0.00', accounts: [] },
];


function EmployeeAdvancesView() {
    const [activeTab, setActiveTab] = useState('Advances');
    const [filter, setFilter] = useState('All');
    const [payAdvanceOpen, setPayAdvanceOpen] = useState(false);
    const [bulkAdvanceOpen, setBulkAdvanceOpen] = useState(false);
    const [bulkSalaryOpen, setBulkSalaryOpen] = useState(false);
    const [paySalaryOpen, setPaySalaryOpen] = useState(false);

    // Dynamic Row States
    const [bulkAdvanceRows, setBulkAdvanceRows] = useState([{ id: 1, employee: '', amount: '', date: '03/08/2026', from: '', reason: '' }]);
    const [bulkSalaryRows, setBulkSalaryRows] = useState([{ id: 1, employee: '', gross: '', deduction: '0', period: 'March 2026', date: '03/08/2026', from: '' }]);

    const salaryPayments = [
        { date: 'Feb 26, 2026', employee: 'Mohammed Al-Harbi', period: '2026-02', gross: 'SAR 5,000', deduction: '- SAR 600', net: 'SAR 4,400', method: 'Cash', status: 'Paid' },
        { date: 'Feb 26, 2026', employee: 'Saad Al-Ghamdi', period: '2026-02', gross: 'SAR 8,000', deduction: '- SAR 1,200', net: 'SAR 6,800', method: 'Petty_cash', status: 'Paid' },
        { date: 'Feb 26, 2026', employee: 'Ali Hassan', period: '2026-02', gross: 'SAR 6,000', deduction: '- SAR 300', net: 'SAR 5,700', method: 'Bank', status: 'Paid' },
        { date: 'Feb 26, 2026', employee: 'Omar Al-Zahrani', period: '2026-02', gross: 'SAR 6,500', deduction: '- SAR 500', net: 'SAR 6,000', method: 'Bank', status: 'Paid' }
    ];

    const addBulkAdvanceRow = () => {
        setBulkAdvanceRows([...bulkAdvanceRows, { id: Date.now(), employee: '', amount: '', date: '03/08/2026', from: '', reason: '' }]);
    };

    const removeBulkAdvanceRow = (id) => {
        if (bulkAdvanceRows.length > 1) {
            setBulkAdvanceRows(bulkAdvanceRows.filter(row => row.id !== id));
        }
    };

    const addBulkSalaryRow = () => {
        setBulkSalaryRows([...bulkSalaryRows, { id: Date.now(), employee: '', gross: '', deduction: '0', period: 'March 2026', date: '03/08/2026', from: '' }]);
    };

    const removeBulkSalaryRow = (id) => {
        if (bulkSalaryRows.length > 1) {
            setBulkSalaryRows(bulkSalaryRows.filter(row => row.id !== id));
        }
    };

    return (
        <div className="advances-view">
            <header className="advances-header">
                <div className="adv-header-left">
                    <h2 className="adv-title">Employee Advances & Payroll</h2>
                    <p className="adv-desc">Pay advances, process salaries, view ledger per employee</p>
                </div>
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
            </header>

            <div className="advances-stats">
                <div className="adv-stat-card">
                    <div className="adv-stat-icon-wrapper icon-blue">
                        <Wallet size={20} />
                    </div>
                    <div className="adv-stat-info">
                        <span className="adv-stat-label">Total Advances Paid</span>
                        <span className="adv-stat-value">SAR 0</span>
                    </div>
                </div>
                <div className="adv-stat-card">
                    <div className="adv-stat-icon-wrapper icon-red">
                        <DollarSign size={20} />
                    </div>
                    <div className="adv-stat-info">
                        <span className="adv-stat-label">Outstanding Balance</span>
                        <span className="adv-stat-value text-red">SAR 0</span>
                    </div>
                </div>
                <div className="adv-stat-card">
                    <div className="adv-stat-icon-wrapper icon-orange">
                        <Clock size={20} />
                    </div>
                    <div className="adv-stat-info">
                        <span className="adv-stat-label">Pending Advances</span>
                        <span className="adv-stat-value">0</span>
                    </div>
                </div>
            </div>

            <div className="adv-tabs-row">
                <div className="adv-pills">
                    {['Advances', 'Salary Payments', 'Employee Ledger'].map(tab => (
                        <button
                            key={tab}
                            className={`adv-pill ${activeTab === tab ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab)}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            <div className="adv-filters-bar">
                <div className="adv-search-wrapper">
                    <Search className="search-icon" size={16} />
                    <input type="text" placeholder="Search by employee..." />
                </div>
                <div className="adv-status-filters">
                    {['All', 'Pending', 'Approved', 'Repaid', 'Rejected'].map(f => (
                        <button
                            key={f}
                            className={`adv-status-btn ${filter === f ? 'active' : ''}`}
                            onClick={() => setFilter(f)}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            {activeTab === 'Employee Ledger' ? (
                <div style={{ padding: '24px', background: 'white', borderRadius: '16px', border: '1px solid #F1F5F9', minHeight: '300px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
                        <BookOpen size={20} color="#64748B" />
                        <span style={{ fontWeight: 600, color: '#1E293B' }}>Select Employee to View Ledger</span>
                        <div className="ps-select-wrapper" style={{ width: '280px' }}>
                            <select defaultValue="">
                                <option value="" disabled>Select employee...</option>
                                <option>Mohammed Al-Harbi</option>
                                <option>Saad Al-Ghamdi</option>
                                <option>Ali Hassan</option>
                                <option>Omar Al-Zahrani</option>
                            </select>
                            <ChevronDown size={16} className="ps-select-icon" />
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: '60px', color: '#94A3B8' }}>
                        <p>Select an employee to view their ledger account</p>
                    </div>
                </div>
            ) : (
                <section className="premium-table advances-table">
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr className="table-header-row">
                                {activeTab === 'Advances' ? (
                                    <>
                                        <th className="table-th">DATE</th>
                                        <th className="table-th">EMPLOYEE</th>
                                        <th className="table-th">REASON</th>
                                        <th className="table-th">PAID FROM</th>
                                        <th className="table-th">AMOUNT</th>
                                        <th className="table-th">REPAID</th>
                                        <th className="table-th">BALANCE</th>
                                        <th className="table-th">STATUS</th>
                                        <th className="table-th">ACTION</th>
                                    </>
                                ) : (
                                    <>
                                        <th className="table-th">DATE</th>
                                        <th className="table-th">EMPLOYEE</th>
                                        <th className="table-th">PERIOD</th>
                                        <th className="table-th">GROSS SALARY</th>
                                        <th className="table-th">ADVANCE DEDUCTED</th>
                                        <th className="table-th">NET PAID</th>
                                        <th className="table-th">METHOD</th>
                                        <th className="table-th">STATUS</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {activeTab === 'Advances' ? (
                                <tr>
                                    <td colSpan={9} className="table-cell table-empty">No advances found</td>
                                </tr>
                            ) : (
                                salaryPayments.map((p, idx) => (
                                    <tr key={idx} className="table-row">
                                        <td className="table-cell">{p.date}</td>
                                        <td className="table-cell" style={{ fontWeight: 700 }}>{p.employee}</td>
                                        <td className="table-cell">{p.period}</td>
                                        <td className="table-cell" style={{ fontWeight: 700 }}>{p.gross}</td>
                                        <td className="table-cell" style={{ color: '#EF4444' }}>{p.deduction}</td>
                                        <td className="table-cell" style={{ color: '#10B981', fontWeight: 700 }}>{p.net}</td>
                                        <td className="table-cell">{p.method}</td>
                                        <td className="table-cell">
                                            <span className="status-badge approved">Paid</span>
                                        </td>
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
                        title={
                            <div className="ps-modal-title">
                                <ArrowLeftRight className="ps-title-icon" size={18} />
                                <span>Pay Salary Advance</span>
                            </div>
                        }
                        onClose={() => setPayAdvanceOpen(false)}
                        width="500px"
                        contentClassName="modal-content-advance"
                        footer={
                            <div className="ps-modal-footer">
                                <button className="btn-ps-cancel" onClick={() => setPayAdvanceOpen(false)}>Cancel</button>
                                <button className="btn-ps-pay" onClick={() => setPayAdvanceOpen(false)}>Pay & Post Entries</button>
                            </div>
                        }
                    >
                        <div className="ps-form">
                            <div className="ps-field">
                                <label>Employee *</label>
                                <div className="ps-select-wrapper">
                                    <select defaultValue="">
                                        <option value="" disabled>Select employee</option>
                                        <option>John Doe</option>
                                        <option>Jane Smith</option>
                                    </select>
                                    <ChevronDown size={16} className="ps-select-icon" />
                                </div>
                            </div>

                            <div className="ps-row">
                                <div className="ps-field">
                                    <label>Amount (SAR) *</label>
                                    <input type="text" placeholder="0.00" />
                                </div>
                                <div className="ps-field">
                                    <label>Date *</label>
                                    <div className="ps-date-input">
                                        <input type="text" defaultValue="03/08/2026" />
                                        <Calendar size={16} />
                                    </div>
                                </div>
                            </div>

                            <div className="ps-field">
                                <label>Pay From (Cash / Bank Account) *</label>
                                <div className="ps-select-wrapper">
                                    <select defaultValue="">
                                        <option value="" disabled>Select cash/bank account</option>
                                        <option>Main Cash</option>
                                        <option>Bank Albilad</option>
                                    </select>
                                    <ChevronDown size={16} className="ps-select-icon" />
                                </div>
                            </div>

                            <div className="ps-field">
                                <label>Reason *</label>
                                <textarea placeholder="Purpose of advance..." rows={3}></textarea>
                            </div>

                            <div className="ps-entry-preview">
                                <p className="ps-entry-title">Accounting Entry:</p>
                                <p className="ps-entry-line dr">Dr: Employee Receivable — ...</p>
                                <p className="ps-entry-line cr">Cr: Cash/Bank Account</p>
                            </div>
                        </div>
                    </Modal>
                )}

                {bulkAdvanceOpen && (
                    <Modal
                        title={
                            <div className="ps-modal-title">
                                <Users className="ps-title-icon" size={18} />
                                <span>Bulk Pay Advances</span>
                            </div>
                        }
                        onClose={() => setBulkAdvanceOpen(false)}
                        width="1100px"
                        contentClassName="modal-content-bulk"
                        footer={
                            <div className="ps-modal-footer">
                                <button className="btn-ps-cancel" onClick={() => setBulkAdvanceOpen(false)}>Cancel</button>
                                <button className="btn-ps-pay btn-gold" onClick={() => setBulkAdvanceOpen(false)}>Pay {bulkAdvanceRows.length} Advance(s)</button>
                            </div>
                        }
                    >
                        <div className="bulk-form">
                            <div className="bulk-table-header">
                                <div className="bulk-col-emp">Employee *</div>
                                <div className="bulk-col-amt">Amount (SAR) *</div>
                                <div className="bulk-col-date">Date *</div>
                                <div className="bulk-col-from">Pay From *</div>
                                <div className="bulk-col-reason">Reason</div>
                                <div className="bulk-col-actions"></div>
                            </div>
                            <div className="bulk-table-rows">
                                {bulkAdvanceRows.map(row => (
                                    <div className="bulk-row" key={row.id}>
                                        <div className="ps-select-wrapper bulk-col-emp">
                                            <select defaultValue=""><option value="" disabled>Select...</option><option>John Doe</option></select>
                                            <ChevronDown size={14} className="ps-select-icon" />
                                        </div>
                                        <div className="bulk-col-amt">
                                            <input type="text" placeholder="0.00" />
                                        </div>
                                        <div className="bulk-col-date">
                                            <div className="ps-date-input">
                                                <input type="text" defaultValue={row.date} />
                                                <Calendar size={14} />
                                            </div>
                                        </div>
                                        <div className="ps-select-wrapper bulk-col-from">
                                            <select defaultValue=""><option value="" disabled>Select...</option><option>Main Cash</option></select>
                                            <ChevronDown size={14} className="ps-select-icon" />
                                        </div>
                                        <div className="bulk-col-reason">
                                            <input type="text" placeholder="Reason..." />
                                        </div>
                                        <div className="bulk-col-actions">
                                            <button className="btn-row-remove" onClick={() => removeBulkAdvanceRow(row.id)}><X size={14} /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button className="btn-add-row" onClick={addBulkAdvanceRow}><Plus size={14} /> Add Row</button>
                        </div>
                    </Modal>
                )}

                {bulkSalaryOpen && (
                    <Modal
                        title={
                            <div className="ps-modal-title">
                                <Users className="ps-title-icon text-green" size={18} />
                                <span>Bulk Pay Salaries</span>
                            </div>
                        }
                        onClose={() => setBulkSalaryOpen(false)}
                        width="1200px"
                        contentClassName="modal-content-bulk"
                        footer={
                            <div className="ps-modal-footer">
                                <button className="btn-ps-cancel" onClick={() => setBulkSalaryOpen(false)}>Cancel</button>
                                <button className="btn-ps-pay btn-green" onClick={() => setBulkSalaryOpen(false)}>Pay {bulkSalaryRows.length} Salary Payment(s)</button>
                            </div>
                        }
                    >
                        <div className="bulk-form">
                            <div className="bulk-table-header bulk-salary-grid">
                                <div className="bulk-col-emp">Employee *</div>
                                <div>Gross (SAR) *</div>
                                <div>Adv. Deduction</div>
                                <div>Net Salary</div>
                                <div>Period *</div>
                                <div>Date *</div>
                                <div>Pay From *</div>
                                <div></div>
                            </div>
                            <div className="bulk-table-rows">
                                {bulkSalaryRows.map(row => (
                                    <div className="bulk-row bulk-salary-grid items-center" key={row.id}>
                                        <div className="ps-select-wrapper">
                                            <select defaultValue=""><option value="" disabled>Select...</option></select>
                                            <ChevronDown size={14} className="ps-select-icon" />
                                        </div>
                                        <input type="text" placeholder="0.00" />
                                        <input type="text" defaultValue={row.deduction} />
                                        <span className="net-salary-val">SAR 0</span>
                                        <input type="text" defaultValue={row.period} />
                                        <div className="ps-date-input">
                                            <input type="text" defaultValue={row.date} />
                                            <Calendar size={14} />
                                        </div>
                                        <div className="ps-select-wrapper">
                                            <select defaultValue=""><option value="" disabled>Select...</option></select>
                                            <ChevronDown size={14} className="ps-select-icon" />
                                        </div>
                                        <button className="btn-row-remove" onClick={() => removeBulkSalaryRow(row.id)}><X size={14} /></button>
                                    </div>
                                ))}
                            </div>
                            <button className="btn-add-row" onClick={addBulkSalaryRow}><Plus size={14} /> Add Row</button>
                        </div>
                    </Modal>
                )}

                {paySalaryOpen && (
                    <Modal
                        title={
                            <div className="ps-modal-title">
                                <CheckCircle className="ps-title-icon text-green" size={18} />
                                <span>Pay Salary</span>
                            </div>
                        }
                        onClose={() => setPaySalaryOpen(false)}
                        width="500px"
                        contentClassName="modal-content-advance"
                        footer={
                            <div className="ps-modal-footer">
                                <button className="btn-ps-cancel" onClick={() => setPaySalaryOpen(false)}>Cancel</button>
                                <button className="btn-ps-pay btn-green" onClick={() => setPaySalaryOpen(false)}>Pay Salary & Post Entries</button>
                            </div>
                        }
                    >
                        <div className="ps-form">
                            <div className="ps-field">
                                <label>Employee *</label>
                                <div className="ps-select-wrapper">
                                    <select defaultValue="">
                                        <option value="" disabled>Select employee</option>
                                    </select>
                                    <ChevronDown size={16} className="ps-select-icon" />
                                </div>
                            </div>

                            <div className="ps-row">
                                <div className="ps-field">
                                    <label>Period (Month) *</label>
                                    <div className="ps-date-input">
                                        <input type="text" defaultValue="March 2026" />
                                        <Calendar size={16} />
                                    </div>
                                </div>
                                <div className="ps-field">
                                    <label>Payment Date *</label>
                                    <div className="ps-date-input">
                                        <input type="text" defaultValue="03/08/2026" />
                                        <Calendar size={16} />
                                    </div>
                                </div>
                            </div>

                            <div className="ps-row">
                                <div className="ps-field">
                                    <label>Gross Salary (SAR) *</label>
                                    <input type="text" placeholder="0.00" />
                                </div>
                                <div className="ps-field">
                                    <label>Pay From *</label>
                                    <div className="ps-select-wrapper">
                                        <select>
                                            <option>Cash/Bank Account</option>
                                        </select>
                                        <ChevronDown size={16} className="ps-select-icon" />
                                    </div>
                                </div>
                            </div>

                            <div className="salary-summary-box">
                                <div className="summary-row">
                                    <span className="label">Gross Salary</span>
                                    <span className="val">SAR 0</span>
                                </div>
                                <div className="summary-row text-red">
                                    <span className="label">Advance Deduction</span>
                                    <span className="val">- SAR 0</span>
                                </div>
                                <div className="summary-row grand text-green">
                                    <span className="label">Net Salary to Pay</span>
                                    <span className="val">SAR 0</span>
                                </div>
                            </div>

                            <div className="ps-entry-preview">
                                <p className="ps-entry-title">Accounting Entry:</p>
                                <p className="ps-entry-line dr">Dr: Salary Expense (gross)</p>
                                <p className="ps-entry-line cr">Cr: Employee Receivable (advance deduction)</p>
                                <p className="ps-entry-line cr">Cr: Cash/Bank (net salary paid)</p>
                            </div>

                            <div className="ps-field">
                                <label>Notes</label>
                                <textarea placeholder="Optional notes..." rows={2}></textarea>
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
}


export default EmployeeAdvancesView;
