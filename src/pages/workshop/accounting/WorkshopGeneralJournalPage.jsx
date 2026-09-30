import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Search, RefreshCw, Eye, FileText, Book, CheckCircle, AlertTriangle, Printer, Trash2 } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../../components/Modal';
import { accT } from '../../../utils/accountingI18n';
import {
    listJournalEntries as listAcctJournalEntries,
    getJournalEntry as getAcctJournalEntry,
} from '../../../services/workshopAccountingApi';
import { useHqAdminBooksScope } from '../../../hooks/useHqAdminBooksScope';
import '../../../styles/admin/AccountingPage.css';

export default function WorkshopGeneralJournalPage() {
    const { isAdminHqBooks } = useHqAdminBooksScope();
    const outletCtx = useOutletContext() || {};
    const locale =
        outletCtx.locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => accT(locale, key, vars), [locale]);
    const [viewJEOpen, setViewJEOpen] = useState(false);
    const [selectedJE, setSelectedJE] = useState(null);
    const [entries, setEntries] = useState([]);
    const [summary, setSummary] = useState({ totalEntries: 0, postedCount: 0, balancedCount: 0, totalDebit: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('');

    const reload = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const params = { limit: 200 };
            if (search) params.q = search;
            if (typeFilter) params.type = typeFilter;
            const res = await listAcctJournalEntries(params);
            setEntries(res?.entries ?? []);
            setSummary({
                totalEntries: Number(res?.summary?.totalEntries ?? 0),
                postedCount: Number(res?.summary?.postedCount ?? 0),
                balancedCount: Number(res?.summary?.balancedCount ?? 0),
                totalDebit: Number(res?.summary?.totalDebit ?? 0),
            });
        } catch (e) {
            setError(e?.message || t('gj.loadFailed'));
            setEntries([]);
        } finally {
            setLoading(false);
        }
    }, [search, typeFilter, t]);

    useEffect(() => { reload(); }, [reload]);

    const fmtMoney = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtDate = (d) => { try { return new Date(d).toLocaleDateString(); } catch { return String(d || '—'); } };

    const toPrintShape = (entry) => ({
        code: entry.entryNumber,
        date: fmtDate(entry.date),
        type: entry.type,
        status: (entry.status || '').toUpperCase(),
        totalDebit: `SAR ${fmtMoney(entry.totalDebit)}`,
        totalCredit: `SAR ${fmtMoney(entry.totalCredit)}`,
        description: entry.description || '',
        lines: (entry.lines || []).map((l) => ({
            account: `${l.accountCode || ''}${l.accountCode ? ' — ' : ''}${l.accountName || ''}`,
            description: l.description || '',
            debit: l.debit ? fmtMoney(l.debit) : '',
            credit: l.credit ? fmtMoney(l.credit) : '',
        })),
    });

    const handleViewJE = async (entry) => {
        try {
            const full = await getAcctJournalEntry(entry.id);
            setSelectedJE(toPrintShape(full?.entry || entry));
            setViewJEOpen(true);
        } catch {
            setSelectedJE(toPrintShape(entry));
            setViewJEOpen(true);
        }
    };

    const handlePrintJE = (je) => {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>${t('gj.print.title', { code: je.code })}</title>
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
                            <h1>${t('gj.print.company')}</h1>
                            <p>${t('gj.print.tagline')}</p>
                        </div>
                        <div class="voucher-title-box">
                            <h2 class="voucher-title">${t('gj.print.voucher')}</h2>
                            <div class="voucher-id">${je.code}</div>
                        </div>
                    </div>

                    <div class="details-grid">
                        <div class="detail-item">
                            <span class="detail-label">${t('gj.print.entryDate')}</span>
                            <span class="detail-value">${je.date}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">${t('gj.print.entryType')}</span>
                            <span class="detail-value">${je.type}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">${t('gj.print.status')}</span>
                            <span class="detail-value">${je.status}</span>
                        </div>
                    </div>

                    <div class="description-box">
                        <span class="detail-label">${t('gj.print.descMemo')}</span>
                        <p class="description-text">${je.description}</p>
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th>${t('gj.print.accountName')}</th>
                                <th>${t('gj.print.description')}</th>
                                <th class="text-right">${t('gj.print.debitSar')}</th>
                                <th class="text-right">${t('gj.print.creditSar')}</th>
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
                                <td colspan="2">${t('gj.print.totals')}</td>
                                <td class="text-right debit-color">${je.totalDebit}</td>
                                <td class="text-right credit-color">${je.totalCredit}</td>
                            </tr>
                        </tfoot>
                    </table>

                    <div class="footer-signatures">
                        <div class="sig-line">${t('gj.print.preparedBy')}</div>
                        <div class="sig-line">${t('gj.print.approvedBy')}</div>
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

    return (
        <div className="general-journal-view">
            <header className="journal-header">
                <h2 className="journal-title">{t('gj.title')}</h2>
                <p className="journal-subtitle">
                    {isAdminHqBooks ? t('gj.sub.hq') : t('gj.sub.ws')}
                </p>
            </header>

            <div className="journal-stats">
                <div className="jr-stat-card">
                    <div className="jr-stat-icon-wrapper">
                        <div className="jr-stat-icon icon-purple"><Book size={18} /></div>
                    </div>
                    <div className="jr-stat-info">
                        <span className="jr-stat-label">{t('gj.stat.totalEntries')}</span>
                        <span className="jr-stat-value">{summary.totalEntries}</span>
                    </div>
                </div>
                <div className="jr-stat-card">
                    <div className="jr-stat-icon-wrapper">
                        <div className="jr-stat-icon icon-green-light"><CheckCircle size={18} /></div>
                    </div>
                    <div className="jr-stat-info">
                        <span className="jr-stat-label">{t('gj.stat.postedBalanced')}</span>
                        <span className="jr-stat-value">{summary.postedCount} / {summary.balancedCount}</span>
                    </div>
                </div>
                <div className="jr-stat-card">
                    <div className="jr-stat-icon-wrapper">
                        <div className="jr-stat-icon icon-blue-light"><FileText size={18} /></div>
                    </div>
                    <div className="jr-stat-info">
                        <span className="jr-stat-label">{t('gj.stat.totalDebit')}</span>
                        <span className="jr-stat-value">SAR {fmtMoney(summary.totalDebit)}</span>
                    </div>
                </div>
            </div>

            <div className="journal-filters-bar">
                <div className="jr-search-wrapper">
                    <Search size={18} className="search-icon" />
                    <input
                        type="text"
                        placeholder={t('gj.searchPh')}
                        className="jr-search-input"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="jr-filter-actions">
                    <select
                        className="jr-type-select"
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                    >
                        <option value="">{t('gj.allTypes')}</option>
                        <option value="counter_closing">{t('gj.type.counterClosing')}</option>
                        <option value="locker_pickup">{t('gj.type.lockerPickup')}</option>
                        <option value="locker_bank_deposit">{t('gj.type.lockerBank')}</option>
                        <option value="locker_petty_cash_issue">{t('gj.type.lockerPetty')}</option>
                        <option value="petty_cash_replenishment">{t('gj.type.pettyReplenish')}</option>
                        <option value="petty_cash_expense">{t('gj.type.pettyExpense')}</option>
                        <option value="internal_transfer">{t('gj.type.internalXfer')}</option>
                        <option value="sales">{t('gj.type.salesInvoice')}</option>
                        <option value="General">{t('gj.type.general')}</option>
                        <option value="Payment">{t('gj.type.payment')}</option>
                        <option value="Receipt">{t('gj.type.receipt')}</option>
                        <option value="OpeningBalance">{t('gj.type.openingBalance')}</option>
                        <option value="PurchaseInvoice">{t('gj.type.purchaseInvoice')}</option>
                        <option value="Sales">{t('gj.type.sales')}</option>
                        <option value="POS">{t('gj.type.pos')}</option>
                        <option value="Commission">{t('gj.type.commission')}</option>
                    </select>
                    <button className="btn-date-range" onClick={reload}>
                        <RefreshCw size={16} /> {t('gj.refresh')}
                    </button>
                </div>
            </div>

            {error && (
                <div style={{ padding: 10, color: '#B91C1C', fontWeight: 600 }}>{error}</div>
            )}

            <section className="premium-table journal-table">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">{t('gj.th.entryNo')}</th>
                            <th className="table-th">{t('gj.th.date')}</th>
                            <th className="table-th">{t('gj.th.type')}</th>
                            <th className="table-th">{t('gj.th.description')}</th>
                            <th className="table-th text-center">{t('gj.th.lines')}</th>
                            <th className="table-th">{t('gj.th.totalDr')}</th>
                            <th className="table-th">{t('gj.th.totalCr')}</th>
                            <th className="table-th text-center">{t('gj.th.balanced')}</th>
                            <th className="table-th">{t('gj.th.status')}</th>
                            <th className="table-th">{t('gj.th.actions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={10} className="table-cell table-empty">{t('gj.loading')}</td></tr>
                        ) : entries.length === 0 ? (
                            <tr><td colSpan={10} className="table-cell table-empty">{t('gj.empty')}</td></tr>
                        ) : (
                            entries.map((e) => (
                                <tr key={e.id} className="table-row">
                                    <td className="table-cell font-bold">{e.entryNumber}</td>
                                    <td className="table-cell">{fmtDate(e.date)}</td>
                                    <td className="table-cell"><span className="badge-type">{e.type}</span></td>
                                    <td className="table-cell color-muted truncate-text">{e.description || '—'}</td>
                                    <td className="table-cell text-center"><span className="badge-count">{e.lines?.length ?? 0}</span></td>
                                    <td className="table-cell color-green-dark font-bold">SAR {fmtMoney(e.totalDebit)}</td>
                                    <td className="table-cell color-blue-dark font-bold">SAR {fmtMoney(e.totalCredit)}</td>
                                    <td className="table-cell text-center">
                                        {e.isBalanced
                                            ? <CheckCircle size={16} className="color-green-light" />
                                            : <AlertTriangle size={16} style={{ color: '#B45309' }} />}
                                    </td>
                                    <td className="table-cell"><span className="badge-status-posted">{(e.status || '').toUpperCase()}</span></td>
                                    <td className="table-cell">
                                        <div className="jr-action-btns">
                                            <button className="jr-action-btn" onClick={() => handleViewJE(e)} title={t('gj.view')}><Eye size={16} /></button>
                                            <button className="jr-action-btn" onClick={() => handlePrintJE(toPrintShape(e))} title={t('gj.print')}><Printer size={16} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </section>

            <AnimatePresence>
                {viewJEOpen && selectedJE && (
                    <Modal
                        title={t('gj.modal.title', { code: selectedJE.code })}
                        onClose={() => setViewJEOpen(false)}
                        footer={
                            <div className="je-modal-footer">
                                <button className="btn-je-delete" onClick={() => setViewJEOpen(false)}>
                                    <Trash2 size={16} /> {t('gj.modal.delete')}
                                </button>
                            </div>
                        }
                    >
                        <div className="je-detail-modal">
                            <div className="je-detail-grid">
                                <div className="je-detail-field">
                                    <span className="je-field-label">{t('gj.modal.entryNo')}</span>
                                    <span className="je-field-value">{selectedJE.code}</span>
                                </div>
                                <div className="je-detail-field">
                                    <span className="je-field-label">{t('gj.modal.date')}</span>
                                    <span className="je-field-value">{selectedJE.date}</span>
                                </div>
                                <div className="je-detail-field">
                                    <span className="je-field-label">{t('gj.modal.type')}</span>
                                    <span className="je-field-value">{selectedJE.type}</span>
                                </div>
                                <div className="je-detail-field">
                                    <span className="je-field-label">{t('gj.modal.status')}</span>
                                    <span className="je-field-value font-bold">{selectedJE.status}</span>
                                </div>
                                <div className="je-detail-field">
                                    <span className="je-field-label">{t('gj.modal.totalDebit')}</span>
                                    <span className="je-field-value">{selectedJE.totalDebit}</span>
                                </div>
                                <div className="je-detail-field">
                                    <span className="je-field-label">{t('gj.modal.totalCredit')}</span>
                                    <span className="je-field-value">{selectedJE.totalCredit}</span>
                                </div>
                            </div>

                            <div className="je-detail-desc-box">
                                <span className="je-field-label">{t('gj.modal.description')}</span>
                                <p className="je-field-value">{selectedJE.description}</p>
                            </div>

                            <div className="je-lines-section">
                                <h4 className="je-section-title">{t('gj.modal.lines')}</h4>
                                <div className="je-lines-table-container">
                                    <table className="je-lines-table">
                                        <thead>
                                            <tr>
                                                <th>{t('gj.modal.account')}</th>
                                                <th>{t('gj.modal.description')}</th>
                                                <th className="text-right">{t('gj.modal.debitSar')}</th>
                                                <th className="text-right">{t('gj.modal.creditSar')}</th>
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
                                                <td colSpan="2">{t('gj.modal.totals')}</td>
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
