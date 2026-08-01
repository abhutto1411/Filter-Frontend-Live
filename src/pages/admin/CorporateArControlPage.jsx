import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
    ArrowLeft,
    Building2,
    FileSpreadsheet,
    FileText,
    RefreshCw,
    Search,
    Users,
} from 'lucide-react';
import {
    getCorporateArLedger,
    listCorporateArCustomers,
} from '../../services/accountsApi';
import {
    exportCorporateArLedgerExcel,
    exportCorporateArLedgerPdf,
    formatLedgerTypeShort,
} from '../../utils/corporateArLedgerExport';
import {
    loadSaAccountingDateRange,
    startOfMonthISO,
    todayISO,
} from './saAccountingDateRange';
import '../../styles/admin/AccountingPage.css';

function fmt(n) {
    return Number(n ?? 0).toLocaleString('en-SA', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function fmtCell(v) {
    if (v == null || v === '') return '—';
    return `SAR ${fmt(v)}`;
}

export default function CorporateArControlPage() {
    const navigate = useNavigate();
    const { corporateAccountId } = useParams();
    const [searchParams] = useSearchParams();

    const [dateFrom, setDateFrom] = useState(
        () => searchParams.get('dateFrom') || loadSaAccountingDateRange().dateFrom || startOfMonthISO(),
    );
    const [dateTo, setDateTo] = useState(
        () => searchParams.get('dateTo') || loadSaAccountingDateRange().dateTo || todayISO(),
    );
    const [search, setSearch] = useState('');
    const [customers, setCustomers] = useState([]);
    const [customersLoading, setCustomersLoading] = useState(true);
    const [customersError, setCustomersError] = useState('');
    const [summary, setSummary] = useState(null);

    const [ledger, setLedger] = useState(null);
    const [ledgerLoading, setLedgerLoading] = useState(false);
    const [ledgerError, setLedgerError] = useState('');
    const [ledgerFilter, setLedgerFilter] = useState('all');

    const loadCustomers = useCallback(async () => {
        setCustomersLoading(true);
        setCustomersError('');
        try {
            const res = await listCorporateArCustomers({ q: search.trim() || undefined });
            setCustomers(res?.customers ?? []);
            setSummary(res?.summary ?? null);
        } catch (e) {
            setCustomers([]);
            setSummary(null);
            setCustomersError(e?.message || 'Could not load corporate customers.');
        } finally {
            setCustomersLoading(false);
        }
    }, [search]);

    const loadLedger = useCallback(async () => {
        if (!corporateAccountId) return;
        setLedgerLoading(true);
        setLedgerError('');
        try {
            const res = await getCorporateArLedger({
                corporateAccountId,
                dateFrom,
                dateTo,
            });
            setLedger(res);
        } catch (e) {
            setLedger(null);
            setLedgerError(e?.message || 'Could not load ledger.');
        } finally {
            setLedgerLoading(false);
        }
    }, [corporateAccountId, dateFrom, dateTo]);

    useEffect(() => {
        if (!corporateAccountId) loadCustomers();
    }, [corporateAccountId, loadCustomers]);

    useEffect(() => {
        if (corporateAccountId) loadLedger();
    }, [corporateAccountId, loadLedger]);

    const allLedgerLines = ledger?.lines ?? [];

    const filteredLines = useMemo(() => {
        const lines = allLedgerLines;
        if (ledgerFilter === 'invoices') return lines.filter((l) => l.type === 'Invoice');
        if (ledgerFilter === 'receipts') return lines.filter((l) => l.type === 'Receipt');
        if (ledgerFilter === 'discounts') return lines.filter((l) => (l.salesDiscounts ?? 0) > 0);
        if (ledgerFilter === 'returns') return lines.filter((l) => l.type === 'Sales Return');
        return lines;
    }, [allLedgerLines, ledgerFilter]);

    const exportHeader = useMemo(() => {
        if (!ledger) return null;
        return {
            companyName: ledger.corporateAccount?.companyName,
            vatNumber: ledger.corporateAccount?.vatNumber,
            workshopName: ledger.corporateAccount?.workshopName,
            dateFrom,
            dateTo,
            generatedAt: ledger.generatedAt
                ? new Date(ledger.generatedAt).toLocaleString()
                : new Date().toLocaleString(),
        };
    }, [ledger, dateFrom, dateTo]);

    const [pdfExporting, setPdfExporting] = useState(false);

    const handleExportPdf = async () => {
        if (!exportHeader || !ledger) return;
        setPdfExporting(true);
        try {
            await exportCorporateArLedgerPdf({
                header: exportHeader,
                summary: ledger.summary ?? {},
                lines: allLedgerLines,
            });
        } catch (e) {
            console.error(e);
        } finally {
            setPdfExporting(false);
        }
    };

    const openCustomer = (id) => {
        const qs = new URLSearchParams();
        if (dateFrom) qs.set('dateFrom', dateFrom);
        if (dateTo) qs.set('dateTo', dateTo);
        navigate(`/admin/accounting/corporate-ar/${encodeURIComponent(id)}?${qs.toString()}`);
    };

    const backToList = () => navigate(`/admin/accounting/corporate-ar?dateFrom=${dateFrom}&dateTo=${dateTo}`);
    const backToCoa = () => navigate('/admin/accounting/chart-of-accounts');

    if (!corporateAccountId) {
        return (
            <div className="corporate-ar-page">
                <header className="corporate-ar-header">
                    <button type="button" className="cash-bank-register-back" onClick={backToCoa}>
                        <ArrowLeft size={18} /> Back to Chart of Accounts
                    </button>
                    <div>
                        <h2 className="cash-bank-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Users size={22} /> [1110] Corporate AR — Control Account
                        </h2>
                        <p className="cash-bank-desc" style={{ margin: '4px 0 0' }}>
                            Select a corporate customer to open their AR ledger statement.
                        </p>
                    </div>
                </header>

                <div className="corporate-ar-toolbar">
                    <div className="pi-search-box-wrapper" style={{ flex: 1, maxWidth: 360 }}>
                        <div className="pi-search-box">
                            <Search size={16} />
                            <input
                                type="text"
                                placeholder="Search company, VAT, contact…"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && loadCustomers()}
                            />
                        </div>
                    </div>
                    <button type="button" className="btn-portal-outline" onClick={loadCustomers} disabled={customersLoading}>
                        <RefreshCw size={16} style={{ marginRight: 6 }} /> Refresh
                    </button>
                </div>

                {summary ? (
                    <div className="cash-bank-stats" style={{ marginBottom: 16 }}>
                        <div className="cash-bank-stat-card cash-bank-stat-card--muted">
                            <div className="cash-bank-stat-icon"><Building2 size={22} /></div>
                            <div>
                                <p className="cash-bank-stat-label">Corporate Customers</p>
                                <p className="cash-bank-stat-value">{summary.count}</p>
                            </div>
                        </div>
                        <div className="cash-bank-stat-card">
                            <div className="cash-bank-stat-icon"><Users size={22} /></div>
                            <div>
                                <p className="cash-bank-stat-label">Total Due Balance</p>
                                <p className="cash-bank-stat-value">SAR {fmt(summary.totalDue)}</p>
                            </div>
                        </div>
                    </div>
                ) : null}

                {customersError ? <p className="form-help-text" style={{ color: '#B45309' }}>{customersError}</p> : null}

                <section className="premium-table cash-bank-table">
                    <table className="ws-table" style={{ width: '100%' }}>
                        <thead>
                            <tr>
                                <th>Company</th>
                                <th>VAT No.</th>
                                <th>Contact</th>
                                <th>Workshop</th>
                                <th style={{ textAlign: 'right' }}>Due Balance</th>
                            </tr>
                        </thead>
                        <tbody>
                            {customersLoading ? (
                                <tr><td colSpan={5} className="table-cell table-empty">Loading…</td></tr>
                            ) : customers.length === 0 ? (
                                <tr><td colSpan={5} className="table-cell table-empty">No corporate customers found.</td></tr>
                            ) : (
                                customers.map((c) => (
                                    <tr
                                        key={c.corporateAccountId}
                                        className="cash-bank-account-row--clickable"
                                        onClick={() => openCustomer(c.corporateAccountId)}
                                    >
                                        <td className="table-cell cell-main-text">{c.companyName}</td>
                                        <td className="table-cell">{c.vatNumber || '—'}</td>
                                        <td className="table-cell">
                                            <div>{c.contactPerson || '—'}</div>
                                            <div style={{ fontSize: 12, color: '#64748b' }}>{c.mobile}</div>
                                        </td>
                                        <td className="table-cell">{c.workshopName}</td>
                                        <td className="table-cell" style={{ textAlign: 'right', fontWeight: 700 }}>
                                            SAR {fmt(c.dueBalance)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </section>
            </div>
        );
    }

    const corp = ledger?.corporateAccount;
    const sum = ledger?.summary ?? {};

    return (
        <div className="corporate-ar-page">
            <header className="corporate-ar-header">
                <button type="button" className="cash-bank-register-back" onClick={backToList}>
                    <ArrowLeft size={18} /> Back to corporate list
                </button>
                <div>
                    <h2 className="cash-bank-title" style={{ margin: 0 }}>{corp?.companyName || 'Corporate Ledger'}</h2>
                    <p className="cash-bank-desc" style={{ margin: '4px 0 0' }}>
                        VAT: {corp?.vatNumber || '—'} · {corp?.workshopName || '—'}
                    </p>
                </div>
            </header>

            <div className="cash-bank-register-filters">
                <label className="cash-bank-register-field">
                    <span>From</span>
                    <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                </label>
                <label className="cash-bank-register-field">
                    <span>To</span>
                    <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </label>
                <button type="button" className="btn-portal-outline" onClick={loadLedger} disabled={ledgerLoading}>
                    <RefreshCw size={16} style={{ marginRight: 6 }} /> Apply
                </button>
                <button
                    type="button"
                    className="btn-portal-outline cash-bank-register-export-btn"
                    disabled={!ledger || ledgerLoading || pdfExporting}
                    onClick={handleExportPdf}
                >
                    <FileText size={16} style={{ marginRight: 6 }} /> {pdfExporting ? 'Generating…' : 'Download PDF'}
                </button>
                <button
                    type="button"
                    className="btn-portal-outline cash-bank-register-export-btn"
                    disabled={!ledger || ledgerLoading}
                    onClick={() => exportCorporateArLedgerExcel({ header: exportHeader, summary: sum, lines: allLedgerLines })}
                >
                    <FileSpreadsheet size={16} style={{ marginRight: 6 }} /> Download Excel
                </button>
            </div>

            {ledgerError ? <p className="form-help-text" style={{ color: '#B45309' }}>{ledgerError}</p> : null}

            <div className="cash-bank-stats cash-bank-register-kpis">
                <div className="cash-bank-stat-card cash-bank-stat-card--muted">
                    <div><p className="cash-bank-stat-label">Opening Balance</p><p className="cash-bank-stat-value">SAR {fmt(sum.openingBalance)}</p></div>
                </div>
                <button
                    type="button"
                    className={`cash-bank-stat-card cash-bank-stat-card--clickable ${ledgerFilter === 'invoices' ? 'active' : ''}`}
                    onClick={() => setLedgerFilter((f) => (f === 'invoices' ? 'all' : 'invoices'))}
                >
                    <div><p className="cash-bank-stat-label">Total Invoice Amount</p><p className="cash-bank-stat-value">SAR {fmt(sum.totalInvoiceAmount)}</p></div>
                </button>
                <button
                    type="button"
                    className={`cash-bank-stat-card cash-bank-stat-card--clickable ${ledgerFilter === 'receipts' ? 'active' : ''}`}
                    onClick={() => setLedgerFilter((f) => (f === 'receipts' ? 'all' : 'receipts'))}
                >
                    <div><p className="cash-bank-stat-label">Total Receipts</p><p className="cash-bank-stat-value">SAR {fmt(sum.totalReceipts)}</p></div>
                </button>
                <button
                    type="button"
                    className={`cash-bank-stat-card cash-bank-stat-card--clickable ${ledgerFilter === 'discounts' ? 'active' : ''}`}
                    onClick={() => setLedgerFilter((f) => (f === 'discounts' ? 'all' : 'discounts'))}
                >
                    <div><p className="cash-bank-stat-label">Discounts</p><p className="cash-bank-stat-value">SAR {fmt(sum.totalDiscounts)}</p></div>
                </button>
                <button
                    type="button"
                    className={`cash-bank-stat-card cash-bank-stat-card--clickable ${ledgerFilter === 'returns' ? 'active' : ''}`}
                    onClick={() => setLedgerFilter((f) => (f === 'returns' ? 'all' : 'returns'))}
                >
                    <div><p className="cash-bank-stat-label">Sales Returns</p><p className="cash-bank-stat-value">SAR {fmt(sum.totalSalesReturns)}</p></div>
                </button>
                <button
                    type="button"
                    className={`cash-bank-stat-card cash-bank-stat-card--clickable ${ledgerFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setLedgerFilter('all')}
                >
                    <div><p className="cash-bank-stat-label">Closing Balance</p><p className="cash-bank-stat-value">SAR {fmt(sum.closingBalance)}</p></div>
                </button>
            </div>

            <p className="cash-bank-desc" style={{ margin: '0 0 8px' }}>
                Period: {dateFrom} — {dateTo}
                {ledger?.generatedAt ? ` · Generated ${new Date(ledger.generatedAt).toLocaleString()}` : ''}
            </p>

            <section className="premium-table cash-bank-table corporate-ar-ledger-table">
                <table className="ws-table" style={{ width: '100%', minWidth: 1200 }}>
                    <thead>
                        <tr>
                            <th><div>Date</div><div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>التاريخ</div></th>
                            <th><div>Inv No.</div><div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>رقم الفاتورة</div></th>
                            <th><div>Vehicle No.</div><div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>رقم المركبة</div></th>
                            <th><div>Products &amp; Services</div><div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>المنتجات والخدمات</div></th>
                            <th><div>Type</div><div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>النوع</div></th>
                            <th style={{ textAlign: 'right' }}><div>Inv Excl VAT</div><div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>بدون ضريبة</div></th>
                            <th style={{ textAlign: 'right' }}><div>VAT 15%</div><div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>ضريبة 15%</div></th>
                            <th style={{ textAlign: 'right' }}><div>Discounts</div><div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>الخصومات</div></th>
                            <th style={{ textAlign: 'right' }}><div>INV Incl VAT</div><div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>شامل الضريبة</div></th>
                            <th style={{ textAlign: 'right' }}><div>Returns</div><div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>المرتجعات</div></th>
                            <th style={{ textAlign: 'right' }}><div>Receipts</div><div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>المقبوضات</div></th>
                            <th style={{ textAlign: 'right' }}><div>Balance</div><div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>الرصيد</div></th>
                        </tr>
                    </thead>
                    <tbody>
                        {ledgerLoading ? (
                            <tr><td colSpan={12} className="table-cell table-empty">Loading ledger…</td></tr>
                        ) : (
                            <>
                                <tr className="cash-bank-register-opening-row">
                                    <td colSpan={11}><strong>Opening balance</strong></td>
                                    <td style={{ textAlign: 'right', fontWeight: 700 }}>SAR {fmt(sum.openingBalance)}</td>
                                </tr>
                                {filteredLines.length === 0 ? (
                                    <tr><td colSpan={12} className="table-cell table-empty">No lines in this period{ledgerFilter !== 'all' ? ` (${ledgerFilter})` : ''}.</td></tr>
                                ) : (
                                    filteredLines.map((row) => (
                                        <tr key={row.id}>
                                            <td>{row.date}</td>
                                            <td>{row.invoiceNo}</td>
                                            <td>{row.vehicleNo}</td>
                                            <td style={{ maxWidth: 240 }}>
                                                <div>{row.productsServicesEn ?? row.productsServices}</div>
                                                {row.productsServicesAr ? (
                                                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, direction: 'rtl', textAlign: 'left' }}>
                                                        {row.productsServicesAr}
                                                    </div>
                                                ) : null}
                                            </td>
                                            <td>{formatLedgerTypeShort(row.type)}</td>
                                            <td style={{ textAlign: 'right' }}>{fmtCell(row.invoiceExclVat)}</td>
                                            <td style={{ textAlign: 'right' }}>{fmtCell(row.vat15)}</td>
                                            <td style={{ textAlign: 'right' }}>{fmtCell(row.salesDiscounts)}</td>
                                            <td style={{ textAlign: 'right' }}>{fmtCell(row.invoiceInclusiveVat)}</td>
                                            <td style={{ textAlign: 'right', color: '#DC2626' }}>{fmtCell(row.salesReturns)}</td>
                                            <td style={{ textAlign: 'right', color: '#059669' }}>{fmtCell(row.receipts)}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 600 }}>SAR {fmt(row.runningBalance)}</td>
                                        </tr>
                                    ))
                                )}
                                <tr className="cash-bank-register-closing-row">
                                    <td colSpan={11}><strong>Closing balance</strong></td>
                                    <td style={{ textAlign: 'right', fontWeight: 700 }}>SAR {fmt(sum.closingBalance)}</td>
                                </tr>
                            </>
                        )}
                    </tbody>
                </table>
            </section>
        </div>
    );
}
