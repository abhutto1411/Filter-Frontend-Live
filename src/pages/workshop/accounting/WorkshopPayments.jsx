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


export default PaymentsView;
