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


export default ExpensesView;
