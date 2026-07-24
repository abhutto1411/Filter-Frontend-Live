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


export default ReceiptsView;
