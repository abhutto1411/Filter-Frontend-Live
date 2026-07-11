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


export default GeneralJournalView;
