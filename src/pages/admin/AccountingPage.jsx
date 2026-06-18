import React, { useState, useEffect, useRef } from 'react';
import { useParams, NavLink } from 'react-router-dom';
import { Plus, Shield, X, Wallet, Landmark, Banknote, Settings, Trash2, Calendar, FileText, ArrowLeftRight, Search, Filter, CreditCard, DollarSign, Book, CheckCircle, Eye, Printer, AlertTriangle, ChevronDown, ShoppingCart, Zap, Users, UserPlus, Clock, Activity, Coins, BookOpen, Save, Percent, Calculator } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import AccountDetailModal from '../../components/AccountDetailModal';
import ReferralCommissionsPage from './ReferralCommissionsPage';
import RM_Commissions from '../referral-management/RM_Commissions';
import { useAuth } from '../../context/AuthContext';
import '../../styles/admin/AccountingPage.css';

const SUB_TABS = [
    { path: 'chart-of-accounts',         label: 'Chart of Accounts',     permission: 'accounting.chart-of-accounts.view' },
    { path: 'cash-bank',                 label: 'Cash & Bank',           permission: 'accounting.cash-bank.view' },
    { path: 'commissions',               label: 'Commission',            permission: 'accounting.commissions.view' },
    { path: 'referral-commissions-rm',   label: 'Referral Commissions',  permission: 'accounting.referral-commissions-rm.view' },
    { path: 'transactions',              label: 'Transactions',          permission: 'accounting.transactions.view' },
    { path: 'journal-entries',           label: 'Journal Entries',       permission: 'accounting.journal-entries.view' },
    { path: 'purchases',                 label: 'Purchases',             permission: 'accounting.purchases.view' },
    { path: 'expenses',                  label: 'Expenses',              permission: 'accounting.expenses.view' },
    { path: 'receipts',                  label: 'Receipts',              permission: 'sales.receipts.view' },
    { path: 'payments',                  label: 'Payments',              permission: 'accounting.payments.view' },
    { path: 'advances',                  label: 'Advances',              permission: 'accounting.advances.view' },
    { path: 'ledger',                    label: 'Ledger',                permission: 'accounting.ledger.view' },
];

const CASH_BANK_TABS = ['All Accounts', 'Cash', 'Bank', 'Petty Cash'];

const COA_TABS = [
    { label: 'Chart of Accounts', permission: 'accounting.chart-of-accounts.coa.view' },
    { label: 'Trial Balance',     permission: 'accounting.chart-of-accounts.trial-balance.view' },
    { label: 'P&L',               permission: 'accounting.chart-of-accounts.profit-loss.view' },
    { label: 'Balance Sheet',     permission: 'accounting.chart-of-accounts.balance-sheet.view' },
];
const COA_SECTIONS = [
    { key: 'assets', label: 'Assets', labelPlural: 'Assets', balance: 'SAR 0.00', accounts: [{ code: 'AR-EAE767', name: 'Accounts Receivable — Safa Makkah', subtype: 'current asset', normalBal: 'debit', openingBal: 'SAR 0.00', currentBal: 'SAR 0.00', status: 'active', desc: 'Receivable from customer: Safa Makkah' }] },
    { key: 'liabilities', label: 'Liabilitys', labelPlural: 'Liabilitys', balance: 'SAR 0.00', accounts: [] },
    { key: 'equity', label: 'Equitys', labelPlural: 'Equitys', balance: 'SAR 0.00', accounts: [] },
    { key: 'revenue', label: 'Revenues', labelPlural: 'Revenues', balance: 'SAR 0.00', accounts: [] },
    { key: 'expenses', label: 'Expenses', labelPlural: 'Expenses', balance: 'SAR 0.00', accounts: [] },
];

function ChartOfAccountsView() {
    const { hasPermission } = useAuth();
    const visibleCoaTabs = COA_TABS.filter((t) => hasPermission(t.permission));
    const [coaTab, setCoaTab] = useState(() => visibleCoaTabs[0]?.label ?? 'Chart of Accounts');

    useEffect(() => {
        if (visibleCoaTabs.length === 0) return;
        if (!visibleCoaTabs.some((t) => t.label === coaTab)) {
            setCoaTab(visibleCoaTabs[0].label);
        }
    }, [visibleCoaTabs, coaTab]);

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
                {visibleCoaTabs.map((t) => (
                    <button key={t.label} type="button" className={`coa-tab ${coaTab === t.label ? 'active' : ''}`} onClick={() => setCoaTab(t.label)}>{t.label}</button>
                ))}
                {visibleCoaTabs.length === 0 && (
                    <div style={{ padding: 20, color: '#94a3b8', fontSize: '0.875rem' }}>
                        You don't have permission to view any Chart-of-Accounts reports.
                    </div>
                )}
            </div>
            {visibleCoaTabs.length === 0 ? null : coaTab === 'Chart of Accounts' && hasPermission('accounting.chart-of-accounts.coa.view') ? (
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
            ) : coaTab === 'Trial Balance' && hasPermission('accounting.chart-of-accounts.trial-balance.view') ? (
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
            ) : coaTab === 'P&L' && hasPermission('accounting.chart-of-accounts.profit-loss.view') ? (
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
            ) : coaTab === 'Balance Sheet' && hasPermission('accounting.chart-of-accounts.balance-sheet.view') ? (
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

function TransactionEntryView() {
    const [activeTab, setActiveTab] = useState('Payments');
    const [paymentsRows, setPaymentsRows] = useState([
        { id: 1, voucher: 'PE0001', date: '2026-06-03', type: 'Supplier', payee: '', account: '', amount: '0.00', ref: '', notes: '' },
        { id: 2, voucher: 'PE0002', date: '2026-06-03', type: 'Supplier', payee: '', account: '', amount: '0.00', ref: '', notes: '' }
    ]);
    const [receiptsRows, setReceiptsRows] = useState([
        { id: 1, voucher: 'RV0005', date: '2026-03-06', type: 'Customer', receivedFrom: '', account: '', amount: '0.00', ref: '', notes: '' },
        { id: 2, voucher: 'RV0006', date: '2026-03-06', type: 'Customer', receivedFrom: '', account: '', amount: '0.00', ref: '', notes: '' }
    ]);
    const [journalEntryRows, setJournalEntryRows] = useState([
        { id: 1, account: '', lineDescription: '', debit: '0.00', credit: '0.00' },
        { id: 2, account: '', lineDescription: '', debit: '0.00', credit: '0.00' },
        { id: 3, account: '', lineDescription: '', debit: '0.00', credit: '0.00' }
    ]);
    const [journalMemo, setJournalMemo] = useState('');

    const addRow = () => {
        if (activeTab === 'Payments') {
            setPaymentsRows((prev) => [...prev, { id: Date.now(), voucher: `PE${(prev.length + 1).toString().padStart(4, '0')}`, date: '2026-06-03', type: 'Supplier', payee: '', account: '', amount: '0.00', ref: '', notes: '' }]);
        } else if (activeTab === 'Receipts') {
            setReceiptsRows((prev) => [...prev, { id: Date.now(), voucher: `RV${(prev.length + 3).toString().padStart(4, '0')}`, date: '03/07/2026', type: 'Customer', receivedFrom: '', account: '', amount: '0.00', ref: '', notes: '' }]);
        } else {
            setJournalEntryRows((prev) => [...prev, { id: Date.now(), account: '', lineDescription: '', debit: '0.00', credit: '0.00' }]);
        }
    };

    const removeRow = (id) => {
        if (activeTab === 'Payments') {
            setPaymentsRows((prev) => prev.filter((r) => r.id !== id));
        } else if (activeTab === 'Receipts') {
            setReceiptsRows((prev) => prev.filter((r) => r.id !== id));
        } else {
            setJournalEntryRows((prev) => prev.filter((r) => r.id !== id));
        }
    };

    const calculateJournalTotals = () => {
        const debit = journalEntryRows.reduce((sum, row) => sum + parseFloat(row.debit || 0), 0);
        const credit = journalEntryRows.reduce((sum, row) => sum + parseFloat(row.credit || 0), 0);
        return { debit: debit.toFixed(2), credit: credit.toFixed(2) };
    };

    const journalTotals = calculateJournalTotals();

    return (
        <div className="transaction-entry-view">
            <header className="trans-entry-header">
                <div>
                    <h2 className="trans-entry-title">Transaction Entry</h2>
                    <p className="trans-entry-subtitle">Record payments, receipts, and journal entries</p>
                </div>
            </header>

            <div className="trans-entry-form-header">
                <div className="form-row-grid-trans">
                    <div className="form-group">
                        <label className="form-label">Date *</label>
                        <div className="input-with-icon">
                            <input type="date" className="form-input-field" defaultValue="2026-06-03" />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Branch</label>
                        <select className="form-input-field">
                            <option>Select branch</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">General Note</label>
                        <input type="text" className="form-input-field" placeholder="Optional note for all entries" />
                    </div>
                    <div className="form-group">
                        <label className="form-label">
                            <div className="label-with-settings">
                                <Settings size={14} className="settings-icon-label" />
                                <span>Paid From Account</span>
                            </div>
                        </label>
                        <select className="form-input-field">
                            <option>Select Cash / Bank / Petty Cash</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="trans-tabs-container">
                <button
                    className={`trans-tab-item ${activeTab === 'Payments' ? 'active' : ''}`}
                    onClick={() => setActiveTab('Payments')}
                >
                    <Banknote size={16} /> Payments
                </button>
                <button
                    className={`trans-tab-item ${activeTab === 'Receipts' ? 'active' : ''}`}
                    onClick={() => setActiveTab('Receipts')}
                >
                    <FileText size={16} /> Receipts
                </button>
                <button
                    className={`trans-tab-item ${activeTab === 'Journal Entry' ? 'active' : ''}`}
                    onClick={() => setActiveTab('Journal Entry')}
                >
                    <ArrowLeftRight size={16} /> Journal Entry
                </button>
            </div>

            <div className="trans-table-card">
                {activeTab === 'Journal Entry' && (
                    <div className="journal-memo-container">
                        <div className="journal-id-badge">Journal Entry • <small>JE0003</small> • <span className="memo-help">Tab on Credit field adds new line</span></div>
                        <input
                            type="text"
                            className="journal-memo-input"
                            placeholder="Journal entry description / memo"
                            value={journalMemo}
                            onChange={(e) => setJournalMemo(e.target.value)}
                        />
                    </div>
                )}
                <div className="trans-table-header-info">
                    {activeTab === 'Payments' && <span>Payments — Dr: Payable/Expense | Cr: Cash/Bank - <small>Tab on last field adds new row automatically</small></span>}
                    {activeTab === 'Receipts' && <span>Receipts — Dr: Cash/Bank | Cr: Receivable/Revenue <small>— Tab on last field adds new row automatically</small></span>}
                    {activeTab === 'Journal Entry' && null}
                </div>
                <div className="premium-table-container">
                    <table className="trans-entry-table">
                        <thead>
                            {activeTab === 'Journal Entry' ? (
                                <tr>
                                    <th style={{ width: '25%' }}>Account</th>
                                    <th>Line Description</th>
                                    <th style={{ width: '150px' }}>Debit (SAR)</th>
                                    <th style={{ width: '150px' }}>Credit (SAR)</th>
                                    <th style={{ width: '50px' }}></th>
                                </tr>
                            ) : (
                                <tr>
                                    <th style={{ width: '120px' }}>Voucher #</th>
                                    <th style={{ width: '150px' }}>Date</th>
                                    <th style={{ width: '150px' }}>Type</th>
                                    <th>{activeTab === 'Payments' ? 'Payee (To)' : 'Received From'}</th>
                                    <th>{activeTab === 'Payments' ? 'Account Dr — Payable/Expense' : 'Account Cr — Receivable/Revenue'}</th>
                                    <th style={{ width: '120px' }}>Amount (SAR)</th>
                                    <th>Reference</th>
                                    <th>Notes</th>
                                    <th style={{ width: '50px' }}></th>
                                </tr>
                            )}
                        </thead>
                        <tbody>
                            {activeTab === 'Payments' && paymentsRows.map((row) => (
                                <tr key={row.id}>
                                    <td><input type="text" className="table-input-field voucher-input" defaultValue={row.voucher} readOnly /></td>
                                    <td><input type="date" className="table-input-field" defaultValue={row.date} /></td>
                                    <td>
                                        <select className="table-input-field">
                                            <option>Supplier</option>
                                        </select>
                                    </td>
                                    <td>
                                        <select className="table-input-field">
                                            <option>Select supplier</option>
                                        </select>
                                    </td>
                                    <td>
                                        <select className="table-input-field">
                                            <option>Payable / Expense</option>
                                        </select>
                                    </td>
                                    <td><input type="number" className="table-input-field" defaultValue={row.amount} /></td>
                                    <td><input type="text" className="table-input-field" placeholder="Ref #" /></td>
                                    <td><input type="text" className="table-input-field" placeholder="Notes" /></td>
                                    <td>
                                        <button className="btn-row-delete" onClick={() => removeRow(row.id)}>
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {activeTab === 'Receipts' && receiptsRows.map((row) => (
                                <tr key={row.id}>
                                    <td><input type="text" className="table-input-field voucher-input receipt-voucher" defaultValue={row.voucher} readOnly /></td>
                                    <td>
                                        <div className="table-input-with-icon">
                                            <input type="text" className="table-input-field" defaultValue={row.date} />
                                            <Calendar size={14} className="input-field-icon" />
                                        </div>
                                    </td>
                                    <td>
                                        <div className="table-input-with-icon">
                                            <select className="table-input-field">
                                                <option>Customer</option>
                                            </select>
                                            <ChevronDown size={14} className="input-field-icon" />
                                        </div>
                                    </td>
                                    <td>
                                        <div className="table-input-with-icon">
                                            <select className="table-input-field">
                                                <option>Select customer</option>
                                            </select>
                                            <ChevronDown size={14} className="input-field-icon" />
                                        </div>
                                    </td>
                                    <td>
                                        <div className="table-input-with-icon">
                                            <select className="table-input-field">
                                                <option>Receivable / Revenue</option>
                                            </select>
                                            <ChevronDown size={14} className="input-field-icon" />
                                        </div>
                                    </td>
                                    <td><input type="number" className="table-input-field" defaultValue={row.amount} /></td>
                                    <td><input type="text" className="table-input-field" placeholder="Ref #" /></td>
                                    <td><input type="text" className="table-input-field" placeholder="Notes" /></td>
                                    <td>
                                        <button className="btn-row-delete" onClick={() => removeRow(row.id)}>
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {activeTab === 'Journal Entry' && (
                                <>
                                    {journalEntryRows.map((row) => (
                                        <tr key={row.id}>
                                            <td>
                                                <select className="table-input-field">
                                                    <option>Account</option>
                                                </select>
                                            </td>
                                            <td><input type="text" className="table-input-field" placeholder="Line description" /></td>
                                            <td><input type="number" className="table-input-field" defaultValue={row.debit} /></td>
                                            <td><input type="number" className="table-input-field" defaultValue={row.credit} /></td>
                                            <td>
                                                <button className="btn-row-delete" onClick={() => removeRow(row.id)}>
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    <tr className="totals-row">
                                        <td colSpan={2} className="totals-label">Totals</td>
                                        <td className="total-value">SAR {journalTotals.debit}</td>
                                        <td className="total-value">SAR {journalTotals.credit}</td>
                                        <td></td>
                                    </tr>
                                </>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="trans-table-footer">
                    <div className="trans-total-summary">
                        {activeTab === 'Payments' && `${paymentsRows.length} valid rows - Total: SAR 0.00`}
                        {activeTab === 'Receipts' && `0 valid rows - Total: SAR 0.00`}
                        {activeTab === 'Journal Entry' && null}
                    </div>
                    <button className="btn-save-all">
                        {activeTab === 'Journal Entry' ? <Book size={16} /> : activeTab === 'Receipts' ? <Shield size={16} /> : <Shield size={16} />}
                        {activeTab === 'Journal Entry' ? 'Post Journal Entry' : `Save All ${activeTab}`}
                    </button>
                </div>
            </div>


            <section className="recent-transactions">
                <h3 className="recent-trans-title">Recent {activeTab}</h3>
                <div className="recent-trans-placeholder">
                    {activeTab === 'Journal Entry' && (
                        <div className="recent-je-item">
                            <div className="je-item-info">
                                <span className="je-code">SI-JE-82608989</span>
                                <span className="je-date">Feb 28, 2026</span>
                            </div>
                            <div className="je-item-status">
                                <span className="je-amount">SAR 128.51</span>
                                <span className="je-posted-badge">Posted</span>
                            </div>
                        </div>
                    )}
                </div>
            </section>

        </div>
    );
}

function ReceiptsView() {
    return (
        <div className="receipts-view">
            <header className="receipts-header">
                <div>
                    <h2 className="receipts-title">Receipts</h2>
                    <p className="receipts-subtitle">Receipt transaction log — entries recorded via Transaction Entry</p>
                </div>
            </header>

            <div className="receipts-stats-grid">
                <div className="receipt-stat-card">
                    <div className="receipt-stat-info">
                        <span className="receipt-stat-label">Total Received</span>
                        <h3 className="receipt-stat-value">SAR 0</h3>
                    </div>
                    <div className="receipt-stat-icon-wrapper icon-green-light">
                        <ArrowLeftRight size={20} className="receipt-stat-icon rotate-45" />
                    </div>
                </div>
                <div className="receipt-stat-card">
                    <div className="receipt-stat-info">
                        <span className="receipt-stat-label">Cash</span>
                        <h3 className="receipt-stat-value">SAR 0</h3>
                    </div>
                    <div className="receipt-stat-icon-wrapper icon-green-light">
                        <DollarSign size={20} className="receipt-stat-icon" />
                    </div>
                </div>
                <div className="receipt-stat-card">
                    <div className="receipt-stat-info">
                        <span className="receipt-stat-label">Bank Transfer</span>
                        <h3 className="receipt-stat-value">SAR 0</h3>
                    </div>
                    <div className="receipt-stat-icon-wrapper icon-blue-light">
                        <Landmark size={20} className="receipt-stat-icon" />
                    </div>
                </div>
                <div className="receipt-stat-card">
                    <div className="receipt-stat-info">
                        <span className="receipt-stat-label">Card</span>
                        <h3 className="receipt-stat-value">SAR 0</h3>
                    </div>
                    <div className="receipt-stat-icon-wrapper icon-purple-light">
                        <CreditCard size={20} className="receipt-stat-icon" />
                    </div>
                </div>
            </div>

            <div className="receipts-filters-bar">
                <div className="receipts-search-wrapper">
                    <Search size={18} className="receipts-search-icon" />
                    <input type="text" placeholder="Search by payer or receipt #..." className="receipts-search-input" />
                </div>
                <div className="receipts-filter-actions">
                    <div className="receipts-type-chips">
                        <button className="receipt-chip active">All</button>
                        <button className="receipt-chip">Cash</button>
                        <button className="receipt-chip">Bank</button>
                        <button className="receipt-chip">Card</button>
                        <button className="receipt-chip">Cheque</button>
                    </div>
                    <button className="btn-receipt-filter">
                        <Filter size={16} /> Filters
                    </button>
                </div>
            </div>

            <div className="premium-table receipts-table-container">
                <table className="receipts-logs-table">
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">Receipt #</th>
                            <th className="table-th">Date</th>
                            <th className="table-th">Received From</th>
                            <th className="table-th">Description</th>
                            <th className="table-th">Method</th>
                            <th className="table-th">Amount (SAR)</th>
                            <th className="table-th">Status</th>
                            <th className="table-th">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td colSpan="8" className="table-empty-receipts">
                                No receipts found
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function LedgerView() {
    return (
        <div className="ledger-view">
            <header className="ledger-header">
                <h2 className="ledger-title">Ledger</h2>
                <p className="ledger-subtitle">General ledger and account history — view transactions by account</p>
            </header>
            <div className="ledger-filters">
                <div className="form-group ledger-filter-group">
                    <label className="form-label">Account</label>
                    <select className="form-input-field"><option>All Accounts</option><option>Accounts Receivable — Safa Makkah</option></select>
                </div>
                <div className="form-group ledger-filter-group">
                    <label className="form-label">From Date</label>
                    <input type="date" className="form-input-field" defaultValue="2026-01-01" />
                </div>
                <div className="form-group ledger-filter-group">
                    <label className="form-label">To Date</label>
                    <input type="date" className="form-input-field" defaultValue="2026-03-03" />
                </div>
                <button type="button" className="btn-portal ledger-apply-btn">Apply</button>
            </div>
            <section className="premium-table ledger-table">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">Date</th>
                            <th className="table-th">Reference</th>
                            <th className="table-th">Description</th>
                            <th className="table-th">Debit (SAR)</th>
                            <th className="table-th">Credit (SAR)</th>
                            <th className="table-th">Balance (SAR)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td colSpan={6} className="table-cell table-empty">No ledger entries for the selected period.</td></tr>
                    </tbody>
                </table>
            </section>
        </div>
    );
}

function AccountingModuleView({ title, subtitle, emptyMessage = 'No records found.' }) {
    return (
        <div className="accounting-module-view">
            <header className="cash-bank-header">
                <h2 className="cash-bank-title">{title}</h2>
                {subtitle && <p className="cash-bank-desc">{subtitle}</p>}
            </header>
            <section className="premium-table cash-bank-table">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">Date</th>
                            <th className="table-th">Reference</th>
                            <th className="table-th">Description</th>
                            <th className="table-th">Amount (SAR)</th>
                            <th className="table-th">Status</th>
                            <th className="table-th">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td colSpan={6} className="table-cell table-empty">{emptyMessage}</td></tr>
                    </tbody>
                </table>
            </section>
        </div>
    );
}

const INVENTORY_ITEMS = [
    { id: 1, name: 'Car Wash Normal - Small', price: 20, unit: 'service', type: 'Service', account: '4100 - Sales Revenue' },
    { id: 2, name: 'Castrol 10W30', price: 15, unit: 'liter', type: 'Stock', account: '4100 - Sales Revenue' },
    { id: 3, name: 'Oil Filter Premium', price: 45, unit: 'pcs', type: 'Stock', account: '4100 - Sales Revenue' },
    { id: 4, name: 'Brake Pad Replacement', price: 120, unit: 'service', type: 'Service', account: '4100 - Sales Revenue' },
    { id: 5, name: 'Tire Rotation', price: 50, unit: 'service', type: 'Service', account: '4100 - Sales Revenue' },
];

const ACCOUNT_OPTIONS = [
    { code: '5100', name: 'Cost of Goods Sold' },
    { code: '6100', name: 'Rent Expense' },
    { code: '6200', name: 'Utilities Expense' },
    { code: '6300', name: 'Salaries & Wages' },
    { code: '1410', name: 'Inventory Asset' },
    { code: '4100', name: 'Sales Revenue' },
];

function TaxCodesView({ taxes, setTaxes }) {
    const [newName, setNewName] = useState('');
    const [newPercent, setNewPercent] = useState('');
    const [showSuccess, setShowSuccess] = useState(false);

    const handleAddTax = (e) => {
        e.preventDefault();
        if (!newName || !newPercent) return;

        const newTax = {
            id: Date.now(),
            name: newName,
            percent: parseFloat(newPercent),
            code: newName, // Use name as code for simplicity in selection
            rate: parseFloat(newPercent) / 100
        };

        setTaxes([...taxes, newTax]);
        setNewName('');
        setNewPercent('');
    };

    const handleDeleteTax = (id) => {
        setTaxes(taxes.filter(t => t.id !== id));
    };

    const handleSaveAll = () => {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
    };

    return (
        <div className="tax-codes-view">
            <header className="tax-header">
                <div>
                    <h2 className="tax-title">Tax Configuration</h2>
                    <p className="tax-subtitle">Manage VAT and operational taxes</p>
                </div>
                <button
                    className={`tax-save-btn ${showSuccess ? 'tax-save-btn--success' : ''}`}
                    onClick={handleSaveAll}
                >
                    {showSuccess ? (
                        <><CheckCircle size={18} /> SETTINGS SAVED</>
                    ) : (
                        <><Save size={18} /> SAVE CONFIGURATION</>
                    )}
                </button>
            </header>

            <div className="tax-top-grid">
                <div className="tax-add-card">
                    <div className="tax-card-icon-row">
                        <div className="tax-icon-box tax-icon-box--blue">
                            <Percent size={24} />
                        </div>
                        <div>
                            <h3 className="tax-card-title">Tax Codes</h3>
                            <p className="tax-card-desc">Add or remove tax codes for transactions</p>
                        </div>
                    </div>

                    <form onSubmit={handleAddTax} className="tax-form">
                        <div className="tax-form-grid">
                            <div className="tax-field">
                                <label className="tax-field-label">Tax Name</label>
                                <input
                                    type="text"
                                    className="tax-field-input"
                                    placeholder="e.g. VAT 15%"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                />
                            </div>
                            <div className="tax-field">
                                <label className="tax-field-label">Percent (%)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="tax-field-input"
                                    placeholder="15"
                                    value={newPercent}
                                    onChange={(e) => setNewPercent(e.target.value)}
                                />
                            </div>
                        </div>
                        <button type="submit" className="tax-add-btn">
                            <Plus size={18} /> ADD TAX CODE
                        </button>
                    </form>
                </div>

                <div className="tax-preview-card">
                    <div className="tax-card-icon-row">
                        <div className="tax-icon-box tax-icon-box--dark">
                            <Calculator size={24} />
                        </div>
                        <div>
                            <h3 className="tax-preview-heading">Live Preview</h3>
                            <p className="tax-preview-subheading">Total calculation for SAR 1,000.00</p>
                        </div>
                    </div>
                    <div className="tax-preview-rows">
                        <div className="tax-preview-row">
                            <span className="tax-preview-label">Subtotal</span>
                            <span className="tax-preview-value">SAR 1,000.00</span>
                        </div>
                        {taxes.map(t => (
                            <div key={t.id} className="tax-preview-row">
                                <span className="tax-preview-label">{t.name} ({t.percent}%)</span>
                                <span className="tax-preview-value tax-preview-value--green">+ SAR {(1000 * t.percent / 100).toFixed(2)}</span>
                            </div>
                        ))}
                        <div className="tax-preview-divider"></div>
                        <div className="tax-preview-row tax-preview-row--total">
                            <span className="tax-preview-grand-label">Grand Total</span>
                            <span className="tax-preview-grand-val">
                                SAR {(1000 + taxes.reduce((acc, t) => acc + (1000 * t.percent / 100), 0)).toFixed(2)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="premium-table tax-table">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">Tax Name</th>
                            <th className="table-th">Rate</th>
                            <th className="table-th">Status</th>
                            <th className="table-th" style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {taxes.map((t) => (
                            <tr key={t.id} className="table-row">
                                <td className="table-cell">
                                    <div className="tax-row-name">
                                        <span className="tax-dot"></span>
                                        <span className="cell-main-text">{t.name}</span>
                                    </div>
                                </td>
                                <td className="table-cell">
                                    <span className="tax-rate-badge">{t.percent}%</span>
                                </td>
                                <td className="table-cell">
                                    <span className="status-badge status-completed">Active</span>
                                </td>
                                <td className="table-cell" style={{ textAlign: 'right' }}>
                                    <button onClick={() => handleDeleteTax(t.id)} className="tax-delete-btn">
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {taxes.length === 0 && (
                            <tr><td colSpan={4} className="table-cell table-empty">No tax codes configured yet.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function PurchasesView({ taxes }) {
    const [modalOpen, setModalOpen] = useState(false);
    const [showLineNum, setShowLineNum] = useState(false);
    const [showDesc, setShowDesc] = useState(false);
    const [showDiscount, setShowDiscount] = useState(false);

    // Dynamic Due Date State
    const [issueDate, setIssueDate] = useState('2026-03-08');
    const [dueDateType, setDueDateType] = useState('Net');
    const [netDays, setNetDays] = useState(30);
    const [customDueDate, setCustomDueDate] = useState('2026-04-07');

    // [NEW] Line Items State
    const [lineItems, setLineItems] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);

    const handleSearch = (query) => {
        setSearchQuery(query);
        if (query.trim()) {
            const filtered = INVENTORY_ITEMS.filter(item =>
                item.name.toLowerCase().includes(query.toLowerCase())
            );
            setSearchResults(filtered);
            setShowDropdown(true);
            setSelectedIndex(0);
        } else {
            setSearchResults([]);
            setShowDropdown(false);
        }
    };

    const updateLineItem = (id, field, value) => {
        setLineItems(prev => prev.map(line => {
            if (line.id === id) {
                const updatedLine = { ...line, [field]: value };

                // Recalculate if qty, price, or taxCode changed
                if (field === 'qty' || field === 'price' || field === 'taxCode') {
                    const qty = parseFloat(field === 'qty' ? value : line.qty) || 0;
                    const price = parseFloat(field === 'price' ? value : line.price) || 0;
                    const taxCodeStr = field === 'taxCode' ? value : line.taxCode;

                    const subtotal = qty * price;
                    const taxRate = taxes.find(t => (t.code === taxCodeStr || t.name === taxCodeStr))?.rate || 0;
                    const taxAmt = subtotal * taxRate;

                    updatedLine.taxAmt = taxAmt.toFixed(2);
                    updatedLine.totalFinal = (subtotal + taxAmt).toFixed(2);
                }

                return updatedLine;
            }
            return line;
        }));
    };

    const getSummary = () => {
        const subtotal = lineItems.reduce((acc, line) => acc + (parseFloat(line.qty) * parseFloat(line.price) || 0), 0);
        const totalTax = lineItems.reduce((acc, line) => acc + parseFloat(line.taxAmt || 0), 0);
        const grandTotal = subtotal + totalTax;

        return {
            subtotal: subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            totalTax: totalTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            grandTotal: grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        };
    };

    const summary = getSummary();

    const addItemToLines = (item) => {
        const newLine = {
            id: Date.now(),
            item: item.name,
            account: item.type === 'Stock' ? '1410 - Inventory Asset' : '5100 - Cost of Goods Sold',
            description: '',
            uom: item.unit,
            qty: 1,
            price: item.price,
            discount: 0,
            taxCode: 'VAT 15%',
            taxAmt: (item.price * 0.15).toFixed(2),
            totalFinal: (item.price * 1.15).toFixed(2)
        };
        setLineItems(prev => [...prev, newLine]);
        setSearchQuery('');
        setShowDropdown(false);
    };

    const handleKeyDown = (e) => {
        if (!showDropdown) return;

        if (e.key === 'ArrowDown') {
            setSelectedIndex(prev => (prev < searchResults.length - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
        } else if (e.key === 'Enter' && selectedIndex >= 0) {
            addItemToLines(searchResults[selectedIndex]);
        } else if (e.key === 'Escape') {
            setShowDropdown(false);
        }
    };

    const evalMath = (expr) => {
        const str = String(expr).trim();
        if (!str) return '';
        // Only allow safe characters: digits, decimal, operators, spaces, parentheses
        if (!/^[\d\s\+\-\*\/\.\(\)]+$/.test(str)) return str;
        // If it's a plain number, return as-is
        if (/^\d+(\.\d+)?$/.test(str)) return str;
        try {
            // eslint-disable-next-line no-new-func
            const result = Function('return (' + str + ')')();
            if (typeof result === 'number' && isFinite(result)) {
                return parseFloat(result.toFixed(6)).toString();
            }
        } catch {
            // invalid expression — return as-is
        }
        return str;
    };

    const handleMathKeyDown = (e, lineId, field) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const evaluated = evalMath(e.target.value);
            updateLineItem(lineId, field, evaluated);
            e.target.value = evaluated;
        }
    };

    const handleMathBlur = (e, lineId, field) => {
        const evaluated = evalMath(e.target.value);
        if (evaluated !== e.target.value) {
            updateLineItem(lineId, field, evaluated);
        }
    };

    const calculateDueDate = () => {
        const issue = new Date(issueDate);
        if (isNaN(issue.getTime())) return '—';

        let due = new Date(issue);

        if (dueDateType === 'Net') {
            due.setDate(issue.getDate() + parseInt(netDays || 0));
        } else if (dueDateType === 'Custom') {
            return customDueDate;
        } else if (dueDateType === 'EOM') {
            // End of Month: Last day of the current month
            due = new Date(issue.getFullYear(), issue.getMonth() + 1, 0);
        }

        const year = due.getFullYear();
        const month = String(due.getMonth() + 1).padStart(2, '0');
        const day = String(due.getDate()).padStart(2, '0');

        return `${year}-${month}-${day}`;
    };

    const calculatedDueDate = calculateDueDate();

    const getGridColumns = () => {
        let cols = [];
        if (showLineNum) cols.push("40px");
        cols.push("2fr", "1.5fr"); // Item, Account
        if (showDesc) cols.push("2fr");
        cols.push("0.8fr", "0.8fr", "1fr"); // UOM, Qty, Price
        if (showDiscount) cols.push("1fr");
        cols.push("1fr", "1fr", "1fr", "1fr"); // Total(pre), TaxCode, TaxAmt, Total(final)
        return cols.join(" ");
    };

    return (
        <div className="purchases-view">
            <header className="purchases-header-row">
                <div className="pi-header-left">
                    <h2 className="cash-bank-title">Purchases</h2>
                    <p className="cash-bank-desc">Track purchase orders and bills.</p>
                </div>
                <button className="btn-save-all" onClick={() => setModalOpen(true)}>
                    <Plus size={18} /> New Purchase Invoice
                </button>
            </header>

            <section className="premium-table cash-bank-table">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">Date</th>
                            <th className="table-th">Reference</th>
                            <th className="table-th">Description</th>
                            <th className="table-th">Amount (SAR)</th>
                            <th className="table-th">Status</th>
                            <th className="table-th">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td colSpan={6} className="table-cell table-empty">No purchase invoices found.</td></tr>
                    </tbody>
                </table>
            </section>

            <AnimatePresence>
                {modalOpen && (
                    <Modal
                        title={
                            <div className="pi-modal-title">
                                <span className="pi-breadcrumb">Purchase Invoices › <span className="pi-b-active">New</span></span>
                                <div className="pi-title-main">
                                    <ShoppingCart className="pi-icon-orange" size={24} />
                                    <span>Purchase Invoice</span>
                                </div>
                            </div>
                        }
                        onClose={() => setModalOpen(false)}
                        width="1350px"
                        contentClassName="modal-content-purchase"
                        footer={
                            <div className="pi-modal-footer">
                                <div className="pi-footer-left">
                                    <button className="btn-pi-cancel" onClick={() => setModalOpen(false)}>Cancel</button>
                                </div>
                                <div className="pi-footer-right">
                                    <button className="btn-pi-draft">Save as Draft</button>
                                    <button className="btn-pi-create" onClick={() => setModalOpen(false)}>Create Purchase Invoice</button>
                                </div>
                            </div>
                        }
                    >
                        <div className="pi-form-container">
                            <div className="pi-header-grid">
                                <div className="pi-field">
                                    <label>Issue date</label>
                                    <div className="pi-input-with-icon">
                                        <input
                                            type="date"
                                            value={issueDate}
                                            onChange={(e) => setIssueDate(e.target.value)}
                                        />
                                        <Calendar size={16} />
                                    </div>
                                </div>
                                <div className="pi-field">
                                    <label>Due date</label>
                                    <div className={`pi-due-grid ${dueDateType === 'EOM' ? 'pi-due-eom' : ''}`}>
                                        <select value={dueDateType} onChange={(e) => setDueDateType(e.target.value)}>
                                            <option value="Net">Net</option>
                                            <option value="Custom">Custom</option>
                                            <option value="EOM">EOM</option>
                                        </select>
                                        {dueDateType === 'Net' && (
                                            <div className="pi-days-input">
                                                <input
                                                    type="number"
                                                    value={netDays}
                                                    onChange={(e) => setNetDays(e.target.value)}
                                                />
                                                <span>days</span>
                                            </div>
                                        )}
                                        {dueDateType === 'Custom' && (
                                            <div className="pi-date-input-small">
                                                <input
                                                    type="date"
                                                    value={customDueDate}
                                                    onChange={(e) => setCustomDueDate(e.target.value)}
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <span className="pi-sub-label">Due: {calculatedDueDate}</span>
                                </div>
                                <div className="pi-field">
                                    <label>Ref # (Optional)</label>
                                    <input type="text" placeholder="Vendor inv #" />
                                </div>
                            </div>

                            <div className="pi-field pi-full-width">
                                <label>Supplier / Vendor *</label>
                                <input type="text" placeholder="Type or select vendor" />
                            </div>

                            <div className="pi-field pi-full-width">
                                <label>Description</label>
                                <input type="text" placeholder="Invoice description (optional)" />
                            </div>

                            <div className="pi-lines-section">
                                <div className="pi-lines-header" style={{ gridTemplateColumns: getGridColumns() }}>
                                    {showLineNum && <div className="pi-col-hash">#</div>}
                                    <div className="pi-col-item">Item</div>
                                    <div className="pi-col-acc">Account</div>
                                    {showDesc && <div className="pi-col-desc">Description</div>}
                                    <div className="pi-col-uom">UOM</div>
                                    <div className="pi-col-qty">Qty</div>
                                    <div className="pi-col-price">Unit price</div>
                                    {showDiscount && <div className="pi-col-disc">Discount</div>}
                                    <div className="pi-col-total">Total</div>
                                    <div className="pi-col-tax">Tax Code</div>
                                    <div className="pi-col-tamt">Tax Amt</div>
                                    <div className="pi-col-total">Total</div>
                                </div>

                                {lineItems.map((line, idx) => (
                                    <div key={line.id} className="pi-lines-header pi-line-data-row" style={{ gridTemplateColumns: getGridColumns() }}>
                                        {showLineNum && <div className="pi-col-hash">{idx + 1}</div>}
                                        <div className="pi-col-item">
                                            <input
                                                type="text"
                                                value={line.item}
                                                className="pi-row-input"
                                                onChange={(e) => updateLineItem(line.id, 'item', e.target.value)}
                                                autoFocus={idx === lineItems.length - 1}
                                            />
                                        </div>
                                        <div className="pi-col-acc">
                                            <select
                                                className="pi-row-input"
                                                value={line.account}
                                                onChange={(e) => updateLineItem(line.id, 'account', e.target.value)}
                                            >
                                                {ACCOUNT_OPTIONS.map(opt => (
                                                    <option key={opt.code} value={`${opt.code} - ${opt.name}`}>
                                                        {opt.code} - {opt.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        {showDesc && <div className="pi-col-desc"><input type="text" defaultValue={line.description} className="pi-row-input" /></div>}
                                        <div className="pi-col-uom">{line.uom}</div>
                                        <div className="pi-col-qty">
                                            <input
                                                type="text"
                                                defaultValue={line.qty}
                                                key={`qty-${line.id}`}
                                                className="pi-row-input-num pi-math-input"
                                                onChange={(e) => updateLineItem(line.id, 'qty', e.target.value)}
                                                onKeyDown={(e) => handleMathKeyDown(e, line.id, 'qty')}
                                                onBlur={(e) => handleMathBlur(e, line.id, 'qty')}
                                            />
                                        </div>
                                        <div className="pi-col-price">
                                            <input
                                                type="text"
                                                defaultValue={line.price}
                                                key={`price-${line.id}`}
                                                className="pi-row-input-num pi-math-input"
                                                onChange={(e) => updateLineItem(line.id, 'price', e.target.value)}
                                                onKeyDown={(e) => handleMathKeyDown(e, line.id, 'price')}
                                                onBlur={(e) => handleMathBlur(e, line.id, 'price')}
                                            />
                                        </div>
                                        {showDiscount && <div className="pi-col-disc"><input type="number" defaultValue={line.discount} className="pi-row-input-num" /></div>}
                                        <div className="pi-col-total">SAR {(parseFloat(line.qty) * parseFloat(line.price) || 0).toFixed(2)}</div>
                                        <div className="pi-col-tax">
                                            <select
                                                className="pi-row-input"
                                                value={line.taxCode}
                                                onChange={(e) => updateLineItem(line.id, 'taxCode', e.target.value)}
                                            >
                                                {taxes.map(t => (
                                                    <option key={t.code} value={t.code}>{t.code}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="pi-col-tamt">SAR {line.taxAmt}</div>
                                        <div className="pi-col-total">SAR {line.totalFinal}</div>
                                    </div>
                                ))}

                                <div className="pi-line-row">
                                    <div className="pi-search-box-wrapper" style={{ position: 'relative', flex: 1 }}>
                                        <div className="pi-search-box">
                                            <Search size={16} />
                                            <input
                                                type="text"
                                                placeholder="Search product to add"
                                                value={searchQuery}
                                                onChange={(e) => handleSearch(e.target.value)}
                                                onKeyDown={handleKeyDown}
                                                onFocus={() => searchQuery.trim() && setShowDropdown(true)}
                                            />
                                        </div>

                                        {showDropdown && searchResults.length > 0 && (
                                            <div className="pi-search-results">
                                                {searchResults.map((item, index) => (
                                                    <div
                                                        key={item.id}
                                                        className={`pi-result-item ${selectedIndex === index ? 'selected' : ''}`}
                                                        onClick={() => addItemToLines(item)}
                                                        onMouseEnter={() => setSelectedIndex(index)}
                                                    >
                                                        <div className="pi-result-info">
                                                            <div className="pi-item-name">{item.name}</div>
                                                            <div className="pi-item-meta">
                                                                <span className="pi-item-type">{item.type}</span>
                                                                <span>• {item.unit}</span>
                                                            </div>
                                                        </div>
                                                        <div className="pi-item-price">
                                                            <div className="pi-price-val">SAR {item.price}</div>
                                                            <div className="pi-price-unit">per {item.unit}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <button className="btn-add-line" onClick={() => (searchQuery ? handleSearch('') : null)}><Plus size={16} /> Add line</button>
                                </div>
                                <div className="pi-hint">
                                    <Zap size={14} /> Tip: Type to search, use ↑↓ arrows, Enter to select. Price fields support math (e.g. 12*5)
                                </div>
                            </div>

                            <div className="pi-config-row">
                                <label className="pi-checkbox">
                                    <input type="checkbox" checked={showLineNum} onChange={(e) => setShowLineNum(e.target.checked)} /> <span>Column — Line number</span>
                                </label>
                                <label className="pi-checkbox">
                                    <input type="checkbox" checked={showDesc} onChange={(e) => setShowDesc(e.target.checked)} /> <span>Column — Description</span>
                                </label>
                                <label className="pi-checkbox">
                                    <input type="checkbox" checked={showDiscount} onChange={(e) => setShowDiscount(e.target.checked)} /> <span>Column — Discount</span>
                                </label>
                                <label className="pi-checkbox">
                                    <input type="checkbox" /> <span>Amounts are tax inclusive</span>
                                </label>
                            </div>

                            <div className="pi-footer-grid">
                                <div className="pi-footer-column">
                                    <div className="pi-field-inline">
                                        <label>Freight-in (SAR)</label>
                                        <input type="text" defaultValue="0" />
                                    </div>
                                    <div className="pi-field-inline">
                                        <label>Invoice Discount</label>
                                        <div className="pi-discount-group">
                                            <input type="text" defaultValue="0" />
                                            <select>
                                                <option>Fixed (S.. )</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="pi-field pi-full-width">
                                        <label>Notes</label>
                                        <textarea placeholder="Internal notes" rows={4}></textarea>
                                    </div>
                                </div>

                                <div className="pi-footer-column pi-summary-column">
                                    <div className="pi-summary-card">
                                        <div className="pi-summary-row">
                                            <span>Subtotal:</span>
                                            <span>SAR {summary.subtotal}</span>
                                        </div>
                                        <div className="pi-summary-row">
                                            <span>Total Tax (VAT):</span>
                                            <span>SAR {summary.totalTax}</span>
                                        </div>
                                        <div className="pi-summary-row pi-grand-total">
                                            <span>Grand Total:</span>
                                            <span>SAR {summary.grandTotal}</span>
                                        </div>
                                    </div>

                                    <div className="pi-ap-alert">
                                        <span>Creates <strong>Accounts Payable</strong>. After goods received, click "Update Stock" in the list.</span>
                                    </div>

                                    <label className="pi-checkbox pi-price-update">
                                        <input type="checkbox" defaultChecked />
                                        <span>Update last purchase price for all products on save</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
}
function CashBankView() {
    const [accountTab, setAccountTab] = useState('All Accounts');
    const [accounts, setAccounts] = useState([]);
    const [newAccountOpen, setNewAccountOpen] = useState(false);
    const [editAccountOpen, setEditAccountOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState(null);

    const handleSaveNew = () => {
        setAccounts((prev) => [...prev, { id: Date.now(), name: 'New Account', type: 'Cash', branch: '', coaLink: '', openingBalance: '0', currentBalance: '0', status: 'active' }]);
        setNewAccountOpen(false);
    };
    const openEdit = (a) => {
        setEditingAccount({ ...a });
        setEditAccountOpen(true);
    };
    const handleSaveEdit = () => {
        if (editingAccount) {
            setAccounts((prev) => prev.map((a) => (a.id === editingAccount.id ? { ...editingAccount } : a)));
            setEditAccountOpen(false);
            setEditingAccount(null);
        }
    };

    return (
        <div className="cash-bank-view">
            <header className="cash-bank-header">
                <h2 className="cash-bank-title">Cash, Bank & Petty Cash</h2>
                <p className="cash-bank-desc">Manage all financial accounts and balances — linked to Chart of Accounts</p>
            </header>
            <div className="cash-bank-stats">
                <div className="cash-bank-stat-card">
                    <div className="cash-bank-stat-icon"><Banknote size={24} /></div>
                    <div>
                        <p className="cash-bank-stat-label">Cash on Hand</p>
                        <p className="cash-bank-stat-value">SAR 0</p>
                        <p className="cash-bank-stat-meta">{accounts.filter((a) => a.type === 'Cash').length} accounts</p>
                    </div>
                </div>
                <div className="cash-bank-stat-card">
                    <div className="cash-bank-stat-icon"><Landmark size={24} /></div>
                    <div>
                        <p className="cash-bank-stat-label">Bank Balance</p>
                        <p className="cash-bank-stat-value">SAR 0</p>
                        <p className="cash-bank-stat-meta">{accounts.filter((a) => a.type === 'Bank').length} accounts</p>
                    </div>
                </div>
                <div className="cash-bank-stat-card">
                    <div className="cash-bank-stat-icon"><Wallet size={24} /></div>
                    <div>
                        <p className="cash-bank-stat-label">Petty Cash</p>
                        <p className="cash-bank-stat-value">SAR 0</p>
                        <p className="cash-bank-stat-meta">{accounts.filter((a) => a.type === 'Petty Cash').length} accounts</p>
                    </div>
                </div>
            </div>
            <div className="cash-bank-tabs">
                {CASH_BANK_TABS.map((t) => (
                    <button key={t} type="button" className={`cash-bank-tab ${accountTab === t ? 'active' : ''}`} onClick={() => setAccountTab(t)}>{t}</button>
                ))}
            </div>
            <div className="cash-bank-actions">
                <button type="button" className="btn-portal" onClick={() => setNewAccountOpen(true)}><Plus size={16} /> New Account</button>
            </div>
            <section className="premium-table cash-bank-table">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">Account</th>
                            <th className="table-th">Type</th>
                            <th className="table-th">Branch</th>
                            <th className="table-th">COA Link</th>
                            <th className="table-th">Opening Balance</th>
                            <th className="table-th">Current Balance</th>
                            <th className="table-th">Status</th>
                            <th className="table-th">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {accounts.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="table-cell table-empty">No accounts found</td>
                            </tr>
                        ) : (
                            accounts.map((a) => (
                                <tr key={a.id}>
                                    <td className="table-cell cell-main-text">{a.name}</td>
                                    <td className="table-cell">{a.type}</td>
                                    <td className="table-cell">{a.branch}</td>
                                    <td className="table-cell">{a.coaLink}</td>
                                    <td className="table-cell">SAR {a.openingBalance}</td>
                                    <td className="table-cell">SAR {a.currentBalance}</td>
                                    <td className="table-cell"><span className="status-badge status-completed">{a.status}</span></td>
                                    <td className="table-cell"><button type="button" className="btn-edit-zone" onClick={() => openEdit(a)}>Edit</button></td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </section>

            <AnimatePresence>
                {newAccountOpen && (
                    <Modal
                        title="New Cash / Bank Account"
                        onClose={() => setNewAccountOpen(false)}
                        footer={
                            <>
                                <button type="button" className="btn-secondary" onClick={() => setNewAccountOpen(false)}>Cancel</button>
                                <button type="button" className="btn-submit btn-dark" onClick={handleSaveNew}>Create Account</button>
                            </>
                        }
                    >
                        <div className="modal-form-grid">
                            <div className="form-group">
                                <label className="form-label">Account Name *</label>
                                <input type="text" className="form-input-field" placeholder="e.g. Main Cash" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Type *</label>
                                <select className="form-input-field">
                                    <option value="Cash">Cash</option>
                                    <option value="Bank">Bank</option>
                                    <option value="Petty Cash">Petty Cash</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Branch</label>
                                <select className="form-input-field">
                                    <option>Select branch</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Opening Balance (SAR)</label>
                                <input type="number" className="form-input-field" defaultValue="0" />
                            </div>
                            <div className="form-group form-group-full">
                                <label className="form-label">Link to Chart of Account (Current Asset)</label>
                                <select className="form-input-field">
                                    <option>Auto-create if not selected</option>
                                </select>
                                <p className="form-help-text">Leave blank to auto-create a new Current Asset account in COA</p>
                            </div>
                            <div className="form-group form-group-full">
                                <label className="form-label">Status</label>
                                <select className="form-input-field">
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                </select>
                            </div>
                        </div>
                    </Modal>
                )}

                {editAccountOpen && editingAccount && (
                    <Modal
                        title="Edit Account"
                        onClose={() => { setEditAccountOpen(false); setEditingAccount(null); }}
                        footer={
                            <>
                                <button type="button" className="btn-secondary" onClick={() => { setEditAccountOpen(false); setEditingAccount(null); }}>Cancel</button>
                                <button type="button" className="btn-submit" onClick={handleSaveEdit}>Save Changes</button>
                            </>
                        }
                    >
                        <div className="form-group">
                            <label className="form-label">Account Name</label>
                            <input type="text" className="form-input-field" value={editingAccount.name} onChange={(e) => setEditingAccount((p) => ({ ...p, name: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Type</label>
                            <select className="form-input-field" value={editingAccount.type} onChange={(e) => setEditingAccount((p) => ({ ...p, type: e.target.value }))}>
                                <option value="Cash">Cash</option><option value="Bank">Bank</option><option value="Petty Cash">Petty Cash</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Branch</label>
                            <input type="text" className="form-input-field" value={editingAccount.branch} onChange={(e) => setEditingAccount((p) => ({ ...p, branch: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">COA Link</label>
                            <input type="text" className="form-input-field" value={editingAccount.coaLink} onChange={(e) => setEditingAccount((p) => ({ ...p, coaLink: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Opening Balance (SAR)</label>
                            <input type="text" className="form-input-field" value={editingAccount.openingBalance} onChange={(e) => setEditingAccount((p) => ({ ...p, openingBalance: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Status</label>
                            <select className="form-input-field" value={editingAccount.status} onChange={(e) => setEditingAccount((p) => ({ ...p, status: e.target.value }))}>
                                <option value="active">Active</option><option value="inactive">Inactive</option>
                            </select>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
}

function ExpensesView() {
    const [filter, setFilter] = useState('All');
    const [showSubmitModal, setShowSubmitModal] = useState(false);
    const [showNewAccountModal, setShowNewAccountModal] = useState(false);

    return (
        <div className="expenses-view">
            <header className="expenses-header">
                <div className="expenses-header-info">
                    <h2 className="expenses-title">Expenses</h2>
                    <p className="expenses-subtitle">Track and manage business expenses</p>
                </div>
                <div className="expenses-header-actions">
                    <button className="btn-portal-outline" onClick={() => setShowNewAccountModal(true)}>
                        <Book size={16} /> New Expense Account
                    </button>
                    <button className="btn-portal-dark" onClick={() => setShowSubmitModal(true)}>
                        <Plus size={16} /> Add Expense
                    </button>
                </div>
            </header>

            <div className="expenses-stats">
                <div className="exp-stat-card">
                    <div className="exp-stat-info">
                        <span className="exp-stat-label">Total Approved</span>
                        <span className="exp-stat-value">SAR 0</span>
                    </div>
                    <div className="exp-stat-icon icon-green"><Wallet size={20} /></div>
                </div>
                <div className="exp-stat-card">
                    <div className="exp-stat-info">
                        <span className="exp-stat-label">Pending Approval</span>
                        <span className="exp-stat-value">SAR 0</span>
                    </div>
                    <div className="exp-stat-icon icon-orange"><DollarSign size={20} /></div>
                </div>
                <div className="exp-stat-card">
                    <div className="exp-stat-info">
                        <span className="exp-stat-label">This Month</span>
                        <span className="exp-stat-value">0</span>
                        <span className="exp-stat-subtext">Total submissions</span>
                    </div>
                    <div className="exp-stat-icon icon-blue"><CreditCard size={20} /></div>
                </div>
            </div>

            <div className="expenses-filters-bar">
                <div className="exp-search-wrapper">
                    <Search size={18} className="search-icon" />
                    <input type="text" placeholder="Search expenses..." className="exp-search-input" />
                </div>
                <div className="exp-filter-actions">
                    <select className="exp-category-select">
                        <option>All Categories</option>
                        <option>Utilities</option>
                        <option>Repairs</option>
                        <option>Supplies</option>
                        <option>Rent</option>
                        <option>Salaries</option>
                        <option>Petty Cash</option>
                        <option>Transport</option>
                        <option>Maintenance</option>
                        <option>Marketing</option>
                        <option>Admin</option>
                        <option>Other</option>
                    </select>
                    <div className="exp-filter-tabs">
                        {['All', 'Pending', 'Approved', 'Rejected'].map((f) => (
                            <button
                                key={f}
                                className={`exp-filter-btn ${filter === f ? 'active' : ''}`}
                                onClick={() => setFilter(f)}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="expenses-empty-card">
                <p>No expenses found</p>
            </div>

            {/* Submit Expense Modal */}
            <AnimatePresence>
                {showSubmitModal && (
                    <Modal
                        title="Submit Expense"
                        onClose={() => setShowSubmitModal(false)}
                        footer={
                            <div className="jr-action-btns">
                                <button className="btn-portal-outline" onClick={() => setShowSubmitModal(false)}>Cancel</button>
                                <button className="btn-dark" style={{ minWidth: '160px' }}>Submit for Approval</button>
                            </div>
                        }
                    >
                        <div className="modal-form-body">
                            <div className="form-group-full">
                                <label className="form-label">Expense Account *</label>
                                <select className="form-select select-highlight">
                                    <option>Select account from Chart of Accounts</option>
                                </select>
                            </div>

                            <div className="modal-form-grid">
                                <div className="form-group">
                                    <label className="form-label">Category *</label>
                                    <select className="form-select">
                                        <option>Utilities</option>
                                        <option>Repairs</option>
                                        <option>Supplies</option>
                                        <option>Rent</option>
                                        <option>Salaries</option>
                                        <option>Petty Cash</option>
                                        <option>Transport</option>
                                        <option>Maintenance</option>
                                        <option>Marketing</option>
                                        <option>Admin</option>
                                        <option defaultValue>Other</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Amount (SAR) *</label>
                                    <input type="number" className="form-input" placeholder="0" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Date *</label>
                                    <input type="date" className="form-input" defaultValue="2026-03-06" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Payment Method</label>
                                    <select className="form-select">
                                        <option>Cash</option>
                                        <option>Bank Transfer</option>
                                        <option>Credit Card</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-group-full">
                                <label className="form-label">Branch</label>
                                <select className="form-select">
                                    <option>Select branch</option>
                                </select>
                            </div>

                            <div className="form-group-full">
                                <label className="form-label">Description</label>
                                <textarea className="form-textarea" placeholder="Describe the expense..."></textarea>
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>

            {/* New Expense Account Modal */}
            <AnimatePresence>
                {showNewAccountModal && (
                    <Modal
                        title="New Expense Account"
                        onClose={() => setShowNewAccountModal(false)}
                        footer={
                            <div className="jr-action-btns">
                                <button className="btn-portal-outline" onClick={() => setShowNewAccountModal(false)}>Cancel</button>
                                <button className="btn-dark">Create Account</button>
                            </div>
                        }
                    >
                        <div className="modal-form-body">
                            <div className="modal-form-grid">
                                <div className="form-group">
                                    <label className="form-label">Account Name *</label>
                                    <input type="text" className="form-input input-highlight" placeholder="e.g. Office Supplies" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Account Code</label>
                                    <input type="text" className="form-input" placeholder="e.g. EXP-001" />
                                </div>
                            </div>

                            <div className="form-group-full">
                                <label className="form-label">Category</label>
                                <select className="form-select">
                                    <option>Utilities</option>
                                    <option>Repairs</option>
                                    <option>Supplies</option>
                                    <option>Rent</option>
                                    <option>Salaries</option>
                                    <option>Petty Cash</option>
                                    <option>Transport</option>
                                    <option>Maintenance</option>
                                    <option>Marketing</option>
                                    <option>Admin</option>
                                    <option defaultValue>Other</option>
                                </select>
                            </div>

                            <div className="form-group-full">
                                <label className="form-label">Monthly Budget (SAR)</label>
                                <input type="number" className="form-input" placeholder="Optional" />
                            </div>

                            <div className="form-group-full">
                                <label className="form-label">Description</label>
                                <textarea className="form-textarea" placeholder=""></textarea>
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
}

function GeneralJournalView() {
    const [viewJEOpen, setViewJEOpen] = useState(false);
    const [selectedJE, setSelectedJE] = useState(null);

    const handleViewJE = (je) => {
        setSelectedJE(je);
        setViewJEOpen(true);
    };

    const handlePrintJE = (je) => {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Journal Voucher - ${je.code}</title>
                    <style>
                        body { font-family: 'Poppins', sans-serif; padding: 40px; color: #1e293b; line-height: 1.5; }
                        .voucher-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; }
                        .company-info h1 { margin: 0; font-size: 24px; font-weight: 900; color: #0f172a; }
                        .company-info p { margin: 4px 0; color: #64748b; font-size: 14px; }
                        .voucher-title-box { text-align: right; }
                        .voucher-title { font-size: 20px; font-weight: 800; color: #0f172a; margin: 0; text-transform: uppercase; }
                        .voucher-id { font-size: 14px; font-weight: 700; color: #3b82f6; margin-top: 4px; }
                        
                        .details-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 40px; }
                        .detail-item { display: flex; flex-direction: column; }
                        .detail-label { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
                        .detail-value { font-size: 14px; font-weight: 600; color: #334155; }
                        
                        .description-box { background: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 40px; border: 1px solid #f1f5f9; }
                        .description-text { margin: 0; font-size: 14px; color: #475569; }

                        table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
                        th { background: #f8fafc; padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 700; color: #64748b; border-bottom: 1px solid #e2e8f0; }
                        td { padding: 14px 16px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
                        .text-right { text-align: right; }
                        
                        .totals-row td { background: #f8fafc; font-weight: 800; font-size: 14px; border-top: 2px solid #e2e8f0; border-bottom: none; }
                        .debit-color { color: #059669; }
                        .credit-color { color: #2563eb; }
                        
                        .footer-signatures { display: grid; grid-template-columns: repeat(2, 1fr); gap: 100px; margin-top: 100px; }
                        .sig-line { border-top: 1px solid #cbd5e1; padding-top: 8px; text-align: center; font-size: 12px; color: #64748b; font-weight: 600; }
                        
                        @media print {
                            body { padding: 0; }
                            .no-print { display: none; }
                        }
                    </style>
                </head>
                <body>
                    <div class="voucher-header">
                        <div class="company-info">
                            <h1>Filter Pos Panels</h1>
                            <p>Premium Automotive Services Portal</p>
                        </div>
                        <div class="voucher-title-box">
                            <h2 class="voucher-title">Journal Voucher</h2>
                            <div class="voucher-id">${je.code}</div>
                        </div>
                    </div>

                    <div class="details-grid">
                        <div class="detail-item">
                            <span class="detail-label">Entry Date</span>
                            <span class="detail-value">${je.date}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Entry Type</span>
                            <span class="detail-value">${je.type}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Status</span>
                            <span class="detail-value">${je.status}</span>
                        </div>
                    </div>

                    <div class="description-box">
                        <span class="detail-label">Description / Memo</span>
                        <p class="description-text">${je.description}</p>
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th>Account Name</th>
                                <th>Description</th>
                                <th class="text-right">Debit (SAR)</th>
                                <th class="text-right">Credit (SAR)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${je.lines.map(line => `
                                <tr>
                                    <td style="font-weight: 700;">${line.account}</td>
                                    <td style="color: #64748b;">${line.description}</td>
                                    <td class="text-right debit-color">${line.debit || '—'}</td>
                                    <td class="text-right credit-color">${line.credit || '—'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr class="totals-row">
                                <td colspan="2">Totals</td>
                                <td class="text-right debit-color">${je.totalDebit}</td>
                                <td class="text-right credit-color">${je.totalCredit}</td>
                            </tr>
                        </tfoot>
                    </table>

                    <div class="footer-signatures">
                        <div class="sig-line">Prepared By</div>
                        <div class="sig-line">Approved By</div>
                    </div>

                    <script>
                        window.onload = function() {
                            window.print();
                        }
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    const dummyJE = {
        code: 'SI-JE-82608989',
        date: '28 Feb 2026',
        type: 'General',
        status: 'Posted',
        totalDebit: 'SAR 128.51',
        totalCredit: 'SAR 128.51',
        description: 'Sales Invoice — Safa Makkah — INV-82453822',
        lines: [
            { account: 'Accounts Receivable — Safa Makkah', description: 'Due from Safa Makkah', debit: '128.51', credit: '' },
            { account: 'Workshop Revenue', description: 'Sale — INV-82453822', debit: '', credit: '128.51' }
        ]
    };

    return (
        <div className="general-journal-view">
            <header className="journal-header">
                <h2 className="journal-title">General Journal</h2>
                <p className="journal-subtitle">General journal transaction log — entries recorded via Transaction Entry</p>
            </header>

            <div className="journal-stats">
                <div className="jr-stat-card">
                    <div className="jr-stat-icon-wrapper">
                        <div className="jr-stat-icon icon-purple"><Book size={18} /></div>
                    </div>
                    <div className="jr-stat-info">
                        <span className="jr-stat-label">Total Entries</span>
                        <span className="jr-stat-value">1</span>
                    </div>
                </div>
                <div className="jr-stat-card">
                    <div className="jr-stat-icon-wrapper">
                        <div className="jr-stat-icon icon-green-light"><CheckCircle size={18} /></div>
                    </div>
                    <div className="jr-stat-info">
                        <span className="jr-stat-label">Posted / Balanced</span>
                        <span className="jr-stat-value">1 / 1</span>
                    </div>
                </div>
                <div className="jr-stat-card">
                    <div className="jr-stat-icon-wrapper">
                        <div className="jr-stat-icon icon-blue-light"><FileText size={18} /></div>
                    </div>
                    <div className="jr-stat-info">
                        <span className="jr-stat-label">Total Debit</span>
                        <span className="jr-stat-value">SAR 128.51</span>
                    </div>
                </div>
            </div>

            <div className="journal-filters-bar">
                <div className="jr-search-wrapper">
                    <Search size={18} className="search-icon" />
                    <input type="text" placeholder="Search entry # or description..." className="jr-search-input" />
                </div>
                <div className="jr-filter-actions">
                    <select className="jr-type-select">
                        <option>All Types</option>
                    </select>
                    <button className="btn-date-range">
                        <Filter size={16} /> Date Range
                    </button>
                </div>
            </div>

            <section className="premium-table journal-table">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">Entry #</th>
                            <th className="table-th">Date</th>
                            <th className="table-th">Type</th>
                            <th className="table-th">Description</th>
                            <th className="table-th text-center">Lines</th>
                            <th className="table-th">Total Dr</th>
                            <th className="table-th">Total Cr</th>
                            <th className="table-th text-center">Balanced</th>
                            <th className="table-th">Status</th>
                            <th className="table-th">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="table-row">
                            <td className="table-cell font-bold">SI-JE-82608989</td>
                            <td className="table-cell">28 Feb 2026</td>
                            <td className="table-cell"><span className="badge-type">General</span></td>
                            <td className="table-cell color-muted truncate-text">Sales Invoice — Safa Makkah — INV-82453822</td>
                            <td className="table-cell text-center"><span className="badge-count">2</span></td>
                            <td className="table-cell color-green-dark font-bold">SAR 128.51</td>
                            <td className="table-cell color-blue-dark font-bold">SAR 128.51</td>
                            <td className="table-cell text-center"><CheckCircle size={16} className="color-green-light" /></td>
                            <td className="table-cell"><span className="badge-status-posted">Posted</span></td>
                            <td className="table-cell">
                                <div className="jr-action-btns">
                                    <button className="jr-action-btn" onClick={() => handleViewJE(dummyJE)}><Eye size={16} /></button>
                                    <button className="jr-action-btn" onClick={() => handlePrintJE(dummyJE)}><Printer size={16} /></button>
                                    <button className="jr-action-btn btn-delete-row"><Trash2 size={16} /></button>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </section>

            <AnimatePresence>
                {viewJEOpen && selectedJE && (
                    <Modal
                        title={`Journal Entry — ${selectedJE.code}`}
                        onClose={() => setViewJEOpen(false)}
                        footer={
                            <div className="je-modal-footer">
                                <button className="btn-je-delete" onClick={() => setViewJEOpen(false)}>
                                    <Trash2 size={16} /> Delete
                                </button>
                            </div>
                        }
                    >
                        <div className="je-detail-modal">
                            <div className="je-detail-grid">
                                <div className="je-detail-field">
                                    <span className="je-field-label">Entry #</span>
                                    <span className="je-field-value">{selectedJE.code}</span>
                                </div>
                                <div className="je-detail-field">
                                    <span className="je-field-label">Date</span>
                                    <span className="je-field-value">{selectedJE.date}</span>
                                </div>
                                <div className="je-detail-field">
                                    <span className="je-field-label">Type</span>
                                    <span className="je-field-value">{selectedJE.type}</span>
                                </div>
                                <div className="je-detail-field">
                                    <span className="je-field-label">Status</span>
                                    <span className="je-field-value font-bold">{selectedJE.status}</span>
                                </div>
                                <div className="je-detail-field">
                                    <span className="je-field-label">Total Debit</span>
                                    <span className="je-field-value">{selectedJE.totalDebit}</span>
                                </div>
                                <div className="je-detail-field">
                                    <span className="je-field-label">Total Credit</span>
                                    <span className="je-field-value">{selectedJE.totalCredit}</span>
                                </div>
                            </div>

                            <div className="je-detail-desc-box">
                                <span className="je-field-label">Description</span>
                                <p className="je-field-value">{selectedJE.description}</p>
                            </div>

                            <div className="je-lines-section">
                                <h4 className="je-section-title">Journal Lines</h4>
                                <div className="je-lines-table-container">
                                    <table className="je-lines-table">
                                        <thead>
                                            <tr>
                                                <th>Account</th>
                                                <th>Description</th>
                                                <th className="text-right">Debit (SAR)</th>
                                                <th className="text-right">Credit (SAR)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedJE.lines.map((line, idx) => (
                                                <tr key={idx}>
                                                    <td className="font-bold">{line.account}</td>
                                                    <td className="color-muted">{line.description}</td>
                                                    <td className="text-right color-green-dark">{line.debit}</td>
                                                    <td className="text-right color-blue-dark">{line.credit}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="je-totals-row">
                                                <td colSpan="2">Totals</td>
                                                <td className="text-right color-green-dark">SAR {selectedJE.totalDebit.replace('SAR ', '')}</td>
                                                <td className="text-right color-blue-dark">SAR {selectedJE.totalCredit.replace('SAR ', '')}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
}

function PaymentsView() {
    const [filter, setFilter] = useState('All');

    return (
        <div className="payments-log-view">
            <header className="payments-header">
                <h2 className="payments-title">Payments</h2>
                <p className="payments-subtitle">Payment transaction log — entries recorded via Transaction Entry</p>
            </header>

            <div className="payments-stats">
                <div className="pay-stat-card">
                    <div className="pay-stat-info">
                        <span className="pay-stat-label">Total Approved</span>
                        <span className="pay-stat-value">SAR 0</span>
                    </div>
                    <div className="pay-stat-icon icon-green"><DollarSign size={20} /></div>
                </div>
                <div className="pay-stat-card">
                    <div className="pay-stat-info">
                        <span className="pay-stat-label">Pending Approval</span>
                        <span className="pay-stat-value">SAR 0</span>
                    </div>
                    <div className="pay-stat-icon icon-orange"><CreditCard size={20} /></div>
                </div>
                <div className="pay-stat-card">
                    <div className="pay-stat-info">
                        <span className="pay-stat-label">This Month</span>
                        <span className="pay-stat-value">0</span>
                        <span className="pay-stat-subtext">Approved payments</span>
                    </div>
                    <div className="pay-stat-icon icon-blue"><DollarSign size={20} /></div>
                </div>
            </div>

            <div className="payments-filters-bar">
                <div className="pay-search-wrapper">
                    <Search size={18} className="search-icon" />
                    <input type="text" placeholder="Search by payee or reference..." className="pay-search-input" />
                </div>
                <div className="pay-filter-actions">
                    <div className="pay-filter-tabs">
                        {['All', 'Pending', 'Approved', 'Rejected'].map((f) => (
                            <button
                                key={f}
                                className={`pay-filter-btn ${filter === f ? 'active' : ''}`}
                                onClick={() => setFilter(f)}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                    <button className="btn-advanced-filters">
                        <Filter size={16} /> Filters
                    </button>
                </div>
            </div>

            <section className="premium-table payments-table">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">Date</th>
                            <th className="table-th">Payee</th>
                            <th className="table-th">Type</th>
                            <th className="table-th">Method</th>
                            <th className="table-th">Reference</th>
                            <th className="table-th">Amount (SAR)</th>
                            <th className="table-th">Status</th>
                            <th className="table-th">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td colSpan={8} className="table-cell table-empty">No payments found</td>
                        </tr>
                    </tbody>
                </table>
            </section>
        </div>
    );
}

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

export default function AccountingPage() {
    const { subTab } = useParams();
    const { hasPermission } = useAuth();
    const visibleSubTabs = SUB_TABS.filter((t) => hasPermission(t.permission));
    const activeSub = subTab || 'cash-bank';

    const [taxes, setTaxes] = useState([
        { id: 1, name: 'VAT 15%', percent: 15, code: 'VAT 15%', rate: 0.15 },
        { id: 2, name: 'VAT 5%', percent: 5, code: 'VAT 5%', rate: 0.05 },
        { id: 3, name: 'VAT 0%', percent: 0, code: 'VAT 0%', rate: 0.00 },
        { id: 4, name: 'Exempt', percent: 0, code: 'Exempt', rate: 0.00 },
    ]);

    return (
        <div className="accounting-page module-container">
            <div className="accounting-sub-nav">
                {visibleSubTabs.map((t) => (
                    <NavLink
                        key={t.path}
                        to={`/admin/accounting/${t.path}`}
                        className={({ isActive }) => `accounting-sub-tab ${isActive ? 'active' : ''}`}
                    >
                        {localStorage.getItem('portal-locale') === 'ar' && (t.path === 'commissions' || t.path === 'referral-commissions') ? 'العمولات' : t.label}
                    </NavLink>
                ))}
            </div>

            {activeSub === 'chart-of-accounts' && <ChartOfAccountsView />}
            {activeSub === 'cash-bank' && <CashBankView />}
            {activeSub === 'commissions' && <ReferralCommissionsPage />}
            {activeSub === 'referral-commissions' && <ReferralCommissionsPage />}
            {activeSub === 'referral-commissions-rm' && <RM_Commissions />}
            {activeSub === 'payments' && <PaymentsView />}
            {activeSub === 'transactions' && <TransactionEntryView />}
            {activeSub === 'journal-entries' && <GeneralJournalView />}
            {activeSub === 'purchases' && <PurchasesView taxes={taxes} />}
            {activeSub === 'expenses' && <ExpensesView />}
            {activeSub === 'receipts' && <ReceiptsView />}
            {activeSub === 'advances' && <EmployeeAdvancesView />}
            {activeSub === 'ledger' && <LedgerView />}
        </div>
    );
}
