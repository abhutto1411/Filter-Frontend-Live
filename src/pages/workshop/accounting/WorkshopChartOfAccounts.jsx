import React, { useState, useRef } from 'react';
import { useParams, NavLink } from 'react-router-dom';
import { Plus, Shield, X, Wallet, Landmark, Banknote, Settings, Trash2, Calendar, FileText, ArrowLeftRight, Search, Filter, CreditCard, DollarSign, Book, CheckCircle, Eye, Printer, AlertTriangle, ChevronDown, ShoppingCart, Zap, Users, UserPlus, Clock, Activity, Coins, BookOpen, Save, Percent, Calculator } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../../components/Modal';
import AccountDetailModal from '../../../components/AccountDetailModal';
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


function ChartOfAccountsView() {
    const [coaTab, setCoaTab] = useState('Chart of Accounts');
    const [newAccountOpen, setNewAccountOpen] = useState(false);
    const [fromDate, setFromDate] = useState('2026-01-01');
    const [toDate, setToDate] = useState('2026-03-08');
    const [asOfDate, setAsOfDate] = useState('2026-03-08');
    const [selectedAccountModal, setSelectedAccountModal] = useState(null);

    const reportRef = useRef(null);

    const trialBalanceData = [
        { code: 'AR-EAE767', name: 'Accounts Receivable — Safa Makkah', type: 'Asset', debit: '128.51', credit: '' },
    ];

    const handlePrint = () => {
        const content = reportRef.current;
        if (!content) return;

        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Financial Report - Print</title>
                    <style>
                        body { font-family: 'Poppins', sans-serif; padding: 40px; color: #111827; }
                        .report-header-centered { text-align: center; margin-bottom: 40px; }
                        .report-type-label { font-size: 10px; font-weight: 700; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px; }
                        .report-company-name { font-size: 24px; font-weight: 900; margin-bottom: 8px; }
                        .report-title { font-size: 18px; font-weight: 800; margin-bottom: 8px; }
                        .report-period { font-size: 12px; font-weight: 600; color: #6B7280; }
                        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
                        th { padding: 12px 0; text-align: left; font-size: 11px; font-weight: 800; color: #9CA3AF; text-transform: uppercase; border-bottom: 1px solid #F3F4F6; }
                        td { padding: 16px 0; font-size: 14px; border-bottom: 1px solid #F3F4F6; }
                        .cell-amount { text-align: right; font-weight: 600; }
                        .totals-row-premium td { font-weight: 900; padding: 20px 0; border-top: 2px solid #111827; border-bottom: none; }
                        .cell-amount-total { text-align: right; }
                        .out-of-balance-container { display: flex; justify-content: center; margin-top: 20px; }
                        .out-of-balance-warning { display: inline-flex; align-items: center; gap: 8px; background: #FFF5F5; padding: 8px 16px; border-radius: 8px; font-size: 12px; font-weight: 700; color: #DC2626; border: 1px solid #FEE2E2; }
                        .pnl-section-title { font-size: 11px; font-weight: 800; color: #9CA3AF; text-transform: uppercase; margin: 24px 0 12px 0; }
                        .pnl-subtotal-row { display: flex; justify-content: space-between; padding: 12px 16px; font-weight: 700; border-top: 1px solid #F3F4F6; margin-top: 8px; }
                        .pnl-highlight-row { display: flex; justify-content: space-between; padding: 20px 24px; background: #F9FAFB; font-weight: 900; margin: 20px 0; }
                        .pnl-final-row { display: flex; justify-content: space-between; padding: 24px; background: #0F172A; color: #10B981; font-weight: 900; margin-top: 32px; }
                        .pnl-final-label { color: #FFFFFF; }
                        .bs-columns-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
                        .bs-account-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 13px; }
                        .bs-highlight-row { display: flex; justify-content: space-between; padding: 16px 20px; font-weight: 900; margin-top: 12px; }
                        .assets-main-bg { background: #2563EB; color: #FFFFFF; }
                        .liabilities-main-bg { background: #FFF1F2; color: #9F1239; }
                        .equity-final-bg { background: #7C3AED; color: #FFFFFF; }
                        .bs-balanced-status { margin-top: 24px; text-align: center; color: #059669; font-weight: 700; font-size: 12px; }
                        .revenue-color { color: #059669; }
                        .cogs-color, .expense-color { color: #DC2626; }
                        @media print {
                            body { padding: 0; }
                            button { display: none; }
                        }
                    </style>
                </head>
                <body>
                    ${content.innerHTML}
                    <script>
                        window.onload = function() {
                            window.print();
                            // window.close(); // Optional: close after print
                        }
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    const handleSaveNew = () => {
        setNewAccountOpen(false);
    };
    return (
        <div className="chart-of-accounts-view">
            <header className="coa-header">
                <h2 className="coa-title">Accounting</h2>
                <p className="coa-subtitle">Filter Car Services — Chart of Accounts & Financial Reports</p>
            </header>
            <div className="coa-tabs">
                {COA_TABS.map((t) => (
                    <button key={t} type="button" className={`coa-tab ${coaTab === t ? 'active' : ''}`} onClick={() => setCoaTab(t)}>{t}</button>
                ))}
            </div>
            {coaTab === 'Chart of Accounts' ? (
                <>
                    <div className="coa-stats">
                        {COA_SECTIONS.map((s) => (
                            <div key={s.key} className="coa-stat-card">
                                <span className="coa-stat-label">{s.label}</span>
                                <span className="coa-stat-val">{s.balance}</span>
                            </div>
                        ))}
                    </div>
                    <div className="coa-actions">
                        <select className="coa-type-select"><option>All Types</option></select>
                        <button type="button" className="btn-portal" onClick={() => setNewAccountOpen(true)}><Plus size={16} /> New Account</button>
                    </div>
                    <div className="coa-sections">
                        {COA_SECTIONS.map((s) => (
                            <section key={s.key} className="coa-section">
                                <h3 className="coa-section-title">{s.label} {s.accounts.length} accounts</h3>
                                <div className="premium-table coa-table">
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr className="table-header-row">
                                                <th className="table-th">Code</th>
                                                <th className="table-th">Account Name</th>
                                                <th className="table-th">Subtype</th>
                                                <th className="table-th">Normal Bal.</th>
                                                <th className="table-th">Opening Bal.</th>
                                                <th className="table-th">Current Bal.</th>
                                                <th className="table-th">Status</th>
                                                <th className="table-th">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {s.accounts.length === 0 ? (
                                                <tr><td colSpan={8} className="table-cell table-empty">No {s.key} accounts</td></tr>
                                            ) : (
                                                s.accounts.map((a) => (
                                                    <tr key={a.code} className="table-row">
                                                        <td className="table-cell">{a.code}</td>
                                                        <td className="table-cell cell-main-text" onClick={() => setSelectedAccountModal(a)} style={{ cursor: 'pointer', color: '#2563eb' }}>{a.name}</td>
                                                        <td className="table-cell">{a.subtype}</td>
                                                        <td className="table-cell">{a.normalBal}</td>
                                                        <td className="table-cell">{a.openingBal}</td>
                                                        <td className="table-cell">{a.currentBal}</td>
                                                        <td className="table-cell"><span className="status-badge status-completed">{a.status}</span></td>
                                                        <td className="table-cell"><button type="button" className="btn-edit-zone">Edit</button></td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                        ))}
                    </div>
                </>
            ) : coaTab === 'Trial Balance' ? (
                <div className="trial-balance-report">
                    <div className="coa-report-filters">
                        <div className="form-group">
                            <label className="form-label">Date From</label>
                            <input type="date" className="form-input-field" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Date To</label>
                            <input type="date" className="form-input-field" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                        </div>
                        <button type="button" className="coa-print-btn" onClick={handlePrint}>
                            <Printer size={16} /> Print
                        </button>
                    </div>

                    <div className="report-container-premium" ref={reportRef}>
                        <div className="report-header-centered">
                            <p className="report-type-label">FINANCIAL REPORT</p>
                            <h2 className="report-company-name">Filter Car Services</h2>
                            <h3 className="report-title">Trial Balance</h3>
                            <p className="report-period">Period: {fromDate} — {toDate}</p>
                        </div>

                        <div className="premium-table-wrapper">
                            <table className="premium-report-table">
                                <thead>
                                    <tr>
                                        <th>Code</th>
                                        <th>Account Name</th>
                                        <th>Type</th>
                                        <th style={{ textAlign: 'right' }}>Debit (SAR)</th>
                                        <th style={{ textAlign: 'right' }}>Credit (SAR)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {trialBalanceData.map((row, idx) => (
                                        <tr key={idx}>
                                            <td className="cell-code">{row.code}</td>
                                            <td className="cell-name-premium" onClick={() => setSelectedAccountModal(row)} style={{ cursor: 'pointer', color: '#2563eb' }}>{row.name}</td>
                                            <td className="cell-type">{row.type}</td>
                                            <td className="cell-amount">{row.debit}</td>
                                            <td className="cell-amount">{row.credit}</td>
                                        </tr>
                                    ))}
                                    <tr className="totals-row-premium">
                                        <td colSpan={3} className="cell-totals-label">TOTALS</td>
                                        <td className="cell-amount-total">SAR 128.51</td>
                                        <td className="cell-amount-total">SAR 0.00</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div className="out-of-balance-container">
                            <div className="out-of-balance-warning">
                                <AlertTriangle size={14} /> Out of balance by SAR 128.51
                            </div>
                        </div>
                    </div>
                </div>
            ) : coaTab === 'P&L' ? (
                <div className="pnl-report">
                    <div className="coa-report-filters">
                        <div className="form-group">
                            <label className="form-label">Date From</label>
                            <input type="date" className="form-input-field" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Date To</label>
                            <input type="date" className="form-input-field" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                        </div>
                        <button type="button" className="coa-print-btn" onClick={handlePrint}>
                            <Printer size={16} /> Print
                        </button>
                    </div>

                    <div className="report-container-premium" ref={reportRef}>
                        <div className="report-header-centered">
                            <p className="report-type-label">FINANCIAL REPORT</p>
                            <h2 className="report-company-name">Filter Car Services</h2>
                            <h3 className="report-title">Profit & Loss Statement</h3>
                            <p className="report-period">Period: {fromDate} — {toDate}</p>
                        </div>

                        <div className="pnl-content">
                            {/* REVENUE */}
                            <div className="pnl-section">
                                <h4 className="pnl-section-title">REVENUE</h4>
                                <div className="pnl-accounts-list">
                                    <p className="pnl-no-accounts">No accounts</p>
                                </div>
                                <div className="pnl-subtotal-row revenue-color" onClick={() => setSelectedAccountModal({ code: '4000', name: 'Service Revenue', type: 'Revenue', currentBal: 'SAR 0.00' })} style={{ cursor: 'pointer' }}>
                                    <span className="pnl-total-label" style={{ textDecoration: 'underline' }}>Service Revenue (Total)</span>
                                    <span className="pnl-total-value">SAR 0.00</span>
                                </div>
                            </div>

                            {/* COST OF GOODS SOLD */}
                            <div className="pnl-section">
                                <h4 className="pnl-section-title">COST OF GOODS SOLD</h4>
                                <div className="pnl-accounts-list">
                                    <p className="pnl-no-accounts">No accounts</p>
                                </div>
                                <div className="pnl-subtotal-row cogs-color" onClick={() => setSelectedAccountModal({ code: '5000', name: 'Cost of Goods Sold', type: 'Expense', currentBal: 'SAR 0.00' })} style={{ cursor: 'pointer' }}>
                                    <span className="pnl-total-label" style={{ textDecoration: 'underline' }}>Total Cost of Goods Sold</span>
                                    <span className="pnl-total-value">SAR 0.00</span>
                                </div>
                            </div>

                            {/* GROSS PROFIT HIGHLIGHT */}
                            <div className="pnl-highlight-row gross-profit-bg">
                                <span className="pnl-highlight-label">Gross Profit</span>
                                <span className="pnl-highlight-value">SAR 0.00</span>
                            </div>

                            {/* OPERATING EXPENSES */}
                            <div className="pnl-section">
                                <h4 className="pnl-section-title">OPERATING EXPENSES</h4>
                                <div className="pnl-accounts-list">
                                    <p className="pnl-no-accounts">No accounts</p>
                                </div>
                                <div className="pnl-subtotal-row expense-color" onClick={() => setSelectedAccountModal({ code: '6000', name: 'Operating Expenses', type: 'Expense', currentBal: 'SAR 0.00' })} style={{ cursor: 'pointer' }}>
                                    <span className="pnl-total-label" style={{ textDecoration: 'underline' }}>Total Operating Expenses</span>
                                    <span className="pnl-total-value">SAR 0.00</span>
                                </div>
                            </div>

                            {/* OTHER EXPENSES */}
                            <div className="pnl-section">
                                <h4 className="pnl-section-title">OTHER EXPENSES</h4>
                                <div className="pnl-accounts-list">
                                    <p className="pnl-no-accounts">No accounts</p>
                                </div>
                                <div className="pnl-subtotal-row expense-color">
                                    <span className="pnl-total-label">Total Other Expenses</span>
                                    <span className="pnl-total-value">SAR 0.00</span>
                                </div>
                            </div>

                            {/* NET INCOME FINAL */}
                            <div className="pnl-final-row">
                                <span className="pnl-final-label">Net Income / (Loss)</span>
                                <span className="pnl-final-value">SAR 0.00</span>
                            </div>
                        </div>
                    </div>
                </div>
            ) : coaTab === 'Balance Sheet' ? (
                <div className="balance-sheet-report">
                    <div className="coa-report-filters">
                        <div className="form-group">
                            <label className="form-label">As of Date</label>
                            <input type="date" className="form-input-field" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} />
                        </div>
                        <button type="button" className="coa-print-btn" onClick={handlePrint}>
                            <Printer size={16} /> Print
                        </button>
                    </div>

                    <div className="bs-columns-grid" ref={reportRef}>
                        {/* LEFT COLUMN: ASSETS */}
                        <div className="report-container-premium bs-column">
                            <div className="report-header-centered bs-header-mini">
                                <p className="report-type-label">FINANCIAL REPORT</p>
                                <h2 className="report-company-name-mini">Filter Car Services</h2>
                                <h3 className="report-title-mini">Balance Sheet — Assets</h3>
                                <p className="report-period-mini">As of: {asOfDate}</p>
                            </div>

                            <div className="pnl-content">
                                <div className="pnl-section">
                                    <h4 className="pnl-section-title">CURRENT ASSETS</h4>
                                    <div className="pnl-accounts-list">
                                        <div className="bs-account-row" onClick={() => setSelectedAccountModal({ code: 'AR-EAE767', name: 'Accounts Receivable — Safa Makkah', subtype: 'current asset', currentBal: 'SAR 0.00' })} style={{ cursor: 'pointer', color: '#2563eb' }}>
                                            <span className="bs-account-name">Accounts Receivable — Safa Makkah <small className="bs-account-code">(AR-EAE767)</small></span>
                                            <span className="bs-account-val">SAR 0.00</span>
                                        </div>
                                    </div>
                                    <div className="pnl-subtotal-row bs-subtotal">
                                        <span className="pnl-total-label">Total Current Assets</span>
                                        <span className="pnl-total-value">SAR 0.00</span>
                                    </div>
                                </div>

                                <div className="pnl-section">
                                    <h4 className="pnl-section-title">FIXED ASSETS</h4>
                                    <div className="pnl-accounts-list">
                                        <p className="pnl-no-accounts">No accounts</p>
                                    </div>
                                    <div className="pnl-subtotal-row bs-subtotal">
                                        <span className="pnl-total-label">Total Fixed Assets</span>
                                        <span className="pnl-total-value">SAR 0.00</span>
                                    </div>
                                </div>

                                <div className="pnl-section">
                                    <h4 className="pnl-section-title">OTHER ASSETS</h4>
                                    <div className="pnl-accounts-list">
                                        <p className="pnl-no-accounts">No accounts</p>
                                    </div>
                                    <div className="pnl-subtotal-row bs-subtotal">
                                        <span className="pnl-total-label">Total Other Assets</span>
                                        <span className="pnl-total-value">SAR 0.00</span>
                                    </div>
                                </div>

                                <div className="bs-highlight-row assets-main-bg">
                                    <span className="bs-highlight-label">TOTAL ASSETS</span>
                                    <span className="bs-highlight-value">SAR 0.00</span>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: LIABILITIES & EQUITY */}
                        <div className="report-container-premium bs-column">
                            <div className="report-header-centered bs-header-mini">
                                <p className="report-type-label">FINANCIAL REPORT</p>
                                <h2 className="report-company-name-mini">Filter Car Services</h2>
                                <h3 className="report-title-mini">Balance Sheet — Liabilities & Equity</h3>
                                <p className="report-period-mini">As of: {asOfDate}</p>
                            </div>

                            <div className="pnl-content">
                                <div className="pnl-section">
                                    <h4 className="pnl-section-title">CURRENT LIABILITIES</h4>
                                    <div className="pnl-accounts-list">
                                        <p className="pnl-no-accounts">No accounts</p>
                                    </div>
                                    <div className="pnl-subtotal-row bs-subtotal liabilities-color">
                                        <span className="pnl-total-label">Total Current Liabilities</span>
                                        <span className="pnl-total-value">SAR 0.00</span>
                                    </div>
                                </div>

                                <div className="pnl-section">
                                    <h4 className="pnl-section-title">LONG-TERM LIABILITIES</h4>
                                    <div className="pnl-accounts-list">
                                        <p className="pnl-no-accounts">No accounts</p>
                                    </div>
                                    <div className="pnl-subtotal-row bs-subtotal liabilities-color">
                                        <span className="pnl-total-label">Total Long-term Liabilities</span>
                                        <span className="pnl-total-value">SAR 0.00</span>
                                    </div>
                                </div>

                                <div className="bs-highlight-row liabilities-main-bg">
                                    <span className="bs-highlight-label">Total Liabilities</span>
                                    <span className="bs-highlight-value">SAR 0.00</span>
                                </div>

                                <div className="pnl-section">
                                    <h4 className="pnl-section-title">EQUITY</h4>
                                    <div className="pnl-accounts-list">
                                        <p className="pnl-no-accounts">No accounts</p>
                                    </div>
                                    <div className="pnl-subtotal-row bs-subtotal equity-color">
                                        <span className="pnl-total-label">Total Equity</span>
                                        <span className="pnl-total-value">SAR 0.00</span>
                                    </div>
                                </div>

                                <div className="bs-highlight-row equity-final-bg text-white">
                                    <span className="bs-highlight-label">TOTAL LIABILITIES + EQUITY</span>
                                    <span className="bs-highlight-value">SAR 0.00</span>
                                </div>

                                <div className="bs-balanced-status">
                                    <CheckCircle size={14} /> Balance Sheet is balanced
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="placeholder-content">
                    <h3>{coaTab} Report</h3>
                    <p>The {coaTab} report is currently being generated. Check back soon for updates.</p>
                </div>
            )}

            <AnimatePresence>
                {newAccountOpen && (
                    <Modal
                        title="New Account"
                        onClose={() => setNewAccountOpen(false)}
                        className="modal-wide"
                        footer={
                            <>
                                <button type="button" className="btn-secondary" onClick={() => setNewAccountOpen(false)}>Cancel</button>
                                <button type="button" className="btn-submit" onClick={handleSaveNew}>Create Account</button>
                            </>
                        }
                    >
                        <div className="modal-form-grid">
                            <div className="form-group">
                                <label className="form-label">Account Code</label>
                                <input type="text" className="form-input-field" placeholder="e.g. 1001" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Account Name *</label>
                                <input type="text" className="form-input-field" placeholder="" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Account Type *</label>
                                <select className="form-input-field">
                                    <option>Asset</option>
                                    <option>Liability</option>
                                    <option>Equity</option>
                                    <option>Revenue</option>
                                    <option>Expense</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Subtype</label>
                                <select className="form-input-field">
                                    <option>Select subtype</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Normal Balance</label>
                                <select className="form-input-field">
                                    <option>Debit</option>
                                    <option>Credit</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Parent Account</label>
                                <select className="form-input-field">
                                    <option>None (top-level)</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Opening Balance (SAR)</label>
                                <input type="number" className="form-input-field" defaultValue="0" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Current Balance (SAR)</label>
                                <input type="number" className="form-input-field" defaultValue="0" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Status</label>
                                <select className="form-input-field">
                                    <option>Active</option>
                                    <option>Inactive</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Currency</label>
                                <input type="text" className="form-input-field" value="SAR" readOnly disabled />
                            </div>
                            <div className="form-group form-group-full">
                                <label className="form-label">Description</label>
                                <textarea className="form-input-field form-textarea" rows={3}></textarea>
                            </div>
                            <div className="form-group form-group-full">
                                <label className="form-checkbox-label">
                                    <input type="checkbox" className="form-checkbox" />
                                    <span>Control / Header Account</span>
                                </label>
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {selectedAccountModal && (
                    <AccountDetailModal 
                        account={selectedAccountModal} 
                        onClose={() => setSelectedAccountModal(null)} 
                    />
                )}
            </AnimatePresence>
        </div>
    );
}


export default ChartOfAccountsView;
