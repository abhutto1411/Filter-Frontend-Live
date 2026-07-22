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


export default CashBankView;
