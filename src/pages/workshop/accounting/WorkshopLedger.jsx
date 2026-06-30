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


export default LedgerView;
