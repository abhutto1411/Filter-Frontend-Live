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


export default TransactionEntryView;
