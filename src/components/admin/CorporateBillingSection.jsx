import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ArrowLeft,
    Building2,
    FileSpreadsheet,
    FileText,
    Loader,
    RefreshCw,
    Search,
    Users,
} from 'lucide-react';
import Modal from '../Modal';
import ClickableInvoiceNo from '../accounting/ClickableInvoiceNo';
import InvoiceDetailsModal from '../pos/modern/InvoiceDetailsModal';
import { getCorporateArLedger, listCorporateArCustomers, listCorporateGeneratedBills, getCorporateGeneratedBill } from '../../services/accountsApi';
import { generateCorporateBill } from '../../services/superAdminApi';
import { openInvoiceViewAndDownloadPdf } from '../../utils/posInvoiceActions';
import {
    exportCorporateArLedgerExcel,
    exportCorporateArLedgerPdf,
    exportCorporateGeneratedBillPdf,
    formatLedgerTypeShort,
} from '../../utils/corporateArLedgerExport';
import { startOfMonthISO, todayISO } from '../../pages/admin/saAccountingDateRange';
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

function dateToIsoStart(dateStr) {
    if (!dateStr) return '';
    const d = new Date(`${dateStr}T00:00:00`);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

function dateToIsoEnd(dateStr) {
    if (!dateStr) return '';
    const d = new Date(`${dateStr}T23:59:59`);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

function billStatusLabel(status) {
    if (status === 'paid') return 'Paid';
    if (status === 'awaiting_approval') return 'Awaiting approval';
    if (status === 'rejected') return 'Rejected';
    return 'Pending payment';
}

export default function CorporateBillingSection() {
    const [search, setSearch] = useState('');
    const [customers, setCustomers] = useState([]);
    const [customersLoading, setCustomersLoading] = useState(true);
    const [customersError, setCustomersError] = useState('');
    const [listSummary, setListSummary] = useState(null);

    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [dateFrom, setDateFrom] = useState(startOfMonthISO());
    const [dateTo, setDateTo] = useState(todayISO());
    const [dueDate, setDueDate] = useState('');

    const [ledger, setLedger] = useState(null);
    const [ledgerLoading, setLedgerLoading] = useState(false);
    const [ledgerError, setLedgerError] = useState('');
    const [ledgerFilter, setLedgerFilter] = useState('all');
    const [pdfExporting, setPdfExporting] = useState(false);

    const [generateOpen, setGenerateOpen] = useState(false);
    const [generateDueDate, setGenerateDueDate] = useState('');
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState('');

    const [viewMode, setViewMode] = useState('statement');
    const [generatedBills, setGeneratedBills] = useState([]);
    const [billsLoading, setBillsLoading] = useState(false);
    const [selectedBillId, setSelectedBillId] = useState('');
    const [billDetail, setBillDetail] = useState(null);
    const [billDetailLoading, setBillDetailLoading] = useState(false);
    const [billPdfExporting, setBillPdfExporting] = useState(false);

    const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
    const [invoiceModalData, setInvoiceModalData] = useState(null);
    const [invoiceLoadingId, setInvoiceLoadingId] = useState('');

    const loadCustomers = useCallback(async () => {
        setCustomersLoading(true);
        setCustomersError('');
        try {
            const res = await listCorporateArCustomers({ q: search.trim() || undefined });
            setCustomers(res?.customers ?? []);
            setListSummary(res?.summary ?? null);
        } catch (e) {
            setCustomers([]);
            setListSummary(null);
            setCustomersError(e?.message || 'Could not load corporate customers.');
        } finally {
            setCustomersLoading(false);
        }
    }, [search]);

    const loadLedger = useCallback(async () => {
        if (!selectedAccountId) return;
        if (dateFrom && dateTo && dateFrom > dateTo) {
            setLedger(null);
            setLedgerError('From date must be on or before To date.');
            return;
        }
        setLedgerLoading(true);
        setLedgerError('');
        setError('');
        try {
            const res = await getCorporateArLedger({
                corporateAccountId: selectedAccountId,
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
    }, [selectedAccountId, dateFrom, dateTo]);

    const loadGeneratedBills = useCallback(async () => {
        if (!selectedAccountId) return;
        setBillsLoading(true);
        try {
            const res = await listCorporateGeneratedBills(selectedAccountId);
            setGeneratedBills(res?.bills ?? []);
        } catch (e) {
            setGeneratedBills([]);
            setError(e?.message || 'Could not load generated bills.');
        } finally {
            setBillsLoading(false);
        }
    }, [selectedAccountId]);

    const openBillDetail = useCallback(async (billId) => {
        if (!billId) {
            setSelectedBillId('');
            setBillDetail(null);
            return;
        }
        setSelectedBillId(billId);
        setBillDetailLoading(true);
        try {
            const res = await getCorporateGeneratedBill(billId);
            setBillDetail(res?.bill ?? null);
        } catch (e) {
            setBillDetail(null);
            setError(e?.message || 'Could not load bill detail.');
        } finally {
            setBillDetailLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!selectedAccountId) loadCustomers();
    }, [selectedAccountId, loadCustomers]);

    useEffect(() => {
        if (selectedAccountId && viewMode === 'statement') loadLedger();
    }, [selectedAccountId, viewMode, loadLedger]);

    useEffect(() => {
        if (selectedAccountId && viewMode === 'generated-bills') {
            void loadGeneratedBills();
        }
    }, [selectedAccountId, viewMode, loadGeneratedBills]);

    const selectedCustomer = useMemo(
        () => customers.find((c) => c.corporateAccountId === selectedAccountId) ?? null,
        [customers, selectedAccountId],
    );

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

    const openAccount = (corporateAccountId) => {
        if (!corporateAccountId) return;
        setSelectedAccountId(corporateAccountId);
        setDueDate('');
        setLedgerFilter('all');
        setLedgerError('');
        setError('');
        setViewMode('statement');
        setSelectedBillId('');
        setBillDetail(null);
    };

    const backToList = () => {
        setSelectedAccountId('');
        setLedger(null);
        setDueDate('');
        setLedgerError('');
        setError('');
        setViewMode('statement');
        setGeneratedBills([]);
        setSelectedBillId('');
        setBillDetail(null);
    };

    const openInvoicePdf = async (ctx) => {
        const key = ctx?.invoiceId || ctx?.invoiceNo;
        if (!key) return;
        setInvoiceLoadingId(String(key));
        setError('');
        try {
            const invoice = await openInvoiceViewAndDownloadPdf({
                ...ctx,
                workshopId: ctx?.workshopId || ledger?.corporateAccount?.workshopId,
            });
            setInvoiceModalData(invoice);
            setInvoiceModalOpen(true);
        } catch (e) {
            setError(e?.message || 'Could not open invoice PDF.');
        } finally {
            setInvoiceLoadingId('');
        }
    };

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
            setError(e?.message || 'PDF export failed.');
        } finally {
            setPdfExporting(false);
        }
    };

    const handleGenerateBill = async () => {
        if (!selectedAccountId || !generateDueDate.trim()) return;
        if (!dateFrom || !dateTo) {
            setError('Select From and To dates before generating a bill.');
            return;
        }
        setGenerating(true);
        setError('');
        try {
            const res = await generateCorporateBill({
                corporateAccountId: selectedAccountId,
                startDate: dateToIsoStart(dateFrom),
                endDate: dateToIsoEnd(dateTo),
                dueDate: generateDueDate.trim(),
            });
            setDueDate(generateDueDate.trim());
            setGenerateOpen(false);
            setViewMode('generated-bills');
            await loadGeneratedBills();
            if (res?.bill?.id) {
                await openBillDetail(res.bill.id);
            }
            if (res?.bill?.billNo) {
                alert(`Bill generated and sent to corporate portal: ${res.bill.billNo}`);
            }
        } catch (e) {
            setError(e?.message || 'Failed to generate bill.');
        } finally {
            setGenerating(false);
        }
    };

    const handleExportBillPdf = async () => {
        if (!billDetail) return;
        setBillPdfExporting(true);
        try {
            await exportCorporateGeneratedBillPdf({
                bill: billDetail,
                statement: billDetail.statement,
                ledgerStatement: billDetail.ledgerStatement,
                fetchLedger: (params) =>
                    getCorporateArLedger({
                        corporateAccountId: selectedAccountId,
                        ...params,
                    }),
            });
        } catch (e) {
            console.error(e);
            setError(e?.message || 'Bill PDF export failed.');
        } finally {
            setBillPdfExporting(false);
        }
    };

    const billLedger = billDetail?.ledgerStatement;
    const billLedgerLines = billLedger?.lines ?? [];
    const billSum = billLedger?.summary ?? billDetail?.kpis ?? {};
    if (!selectedAccountId) {
        return (
            <div className="corporate-ar-page">
                <header className="corporate-billing-header corporate-ar-header">
                    <div>
                        <h1 className="corporate-billing-title">Corporate Billing</h1>
                        <p className="corporate-billing-subtitle">
                            Select a corporate account to view the AR ledger statement
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
                    <button
                        type="button"
                        className="btn-portal-outline"
                        onClick={loadCustomers}
                        disabled={customersLoading}
                    >
                        <RefreshCw size={16} style={{ marginRight: 6 }} /> Refresh
                    </button>
                </div>

                {listSummary ? (
                    <div className="cash-bank-stats" style={{ marginBottom: 16 }}>
                        <div className="cash-bank-stat-card cash-bank-stat-card--muted">
                            <div className="cash-bank-stat-icon"><Building2 size={22} /></div>
                            <div>
                                <p className="cash-bank-stat-label">Corporate Customers</p>
                                <p className="cash-bank-stat-value">{listSummary.count}</p>
                            </div>
                        </div>
                        <div className="cash-bank-stat-card">
                            <div className="cash-bank-stat-icon"><Users size={22} /></div>
                            <div>
                                <p className="cash-bank-stat-label">Total Due Balance</p>
                                <p className="cash-bank-stat-value">SAR {fmt(listSummary.totalDue)}</p>
                            </div>
                        </div>
                    </div>
                ) : null}

                {customersError ? (
                    <p className="form-help-text" style={{ color: '#B45309' }}>{customersError}</p>
                ) : null}

                <section className="premium-table cash-bank-table corporate-billing-accounts-table">
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
                                <tr>
                                    <td colSpan={5} className="table-cell table-empty">
                                        <Loader size={18} className="spin" /> Loading…
                                    </td>
                                </tr>
                            ) : customers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="table-cell table-empty">No corporate accounts.</td>
                                </tr>
                            ) : (
                                customers.map((c) => (
                                    <tr
                                        key={c.corporateAccountId}
                                        className="cash-bank-account-row--clickable corporate-billing-account-row"
                                        onClick={() => openAccount(c.corporateAccountId)}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') openAccount(c.corporateAccountId);
                                        }}
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
    const displayName = corp?.companyName || selectedCustomer?.companyName || 'Corporate Billing';

    return (
        <div className="corporate-ar-page corporate-billing-detail">
            <header className="corporate-ar-header">
                <button type="button" className="corporate-billing-back-btn cash-bank-register-back" onClick={backToList}>
                    <ArrowLeft size={18} /> Back to corporate list
                </button>
                <div>
                    <h2 className="cash-bank-title corporate-billing-title" style={{ margin: 0 }}>
                        {displayName}
                    </h2>
                    <p className="cash-bank-desc corporate-billing-detail-sub" style={{ margin: '4px 0 0' }}>
                        VAT: {corp?.vatNumber || selectedCustomer?.vatNumber || '—'} ·{' '}
                        {corp?.workshopName || selectedCustomer?.workshopName || '—'}
                    </p>
                </div>
            </header>

            <div className="cash-bank-register-filters corporate-billing-detail-actions">
                <label className="cash-bank-register-field billing-date-field">
                    <span>From</span>
                    <input
                        type="date"
                        value={dateFrom}
                        max={dateTo || undefined}
                        onChange={(e) => setDateFrom(e.target.value)}
                    />
                </label>
                <label className="cash-bank-register-field billing-date-field">
                    <span>To</span>
                    <input
                        type="date"
                        value={dateTo}
                        min={dateFrom || undefined}
                        onChange={(e) => setDateTo(e.target.value)}
                    />
                </label>
                <button type="button" className="btn-portal-outline" onClick={loadLedger} disabled={ledgerLoading}>
                    <RefreshCw size={16} style={{ marginRight: 6 }} /> Apply
                </button>
                <button
                    type="button"
                    className="btn-portal"
                    disabled={!dateFrom || !dateTo}
                    onClick={() => {
                        setGenerateDueDate(dueDate || '');
                        setGenerateOpen(true);
                    }}
                >
                    <FileText size={16} style={{ marginRight: 6 }} /> Generate Bill
                </button>
                <button
                    type="button"
                    className={`btn-portal-outline ${viewMode === 'generated-bills' ? 'active' : ''}`}
                    onClick={() => {
                        setViewMode('generated-bills');
                        setSelectedBillId('');
                        setBillDetail(null);
                    }}
                >
                    <FileText size={16} style={{ marginRight: 6 }} /> Generated Bills
                </button>
                {viewMode === 'statement' ? (
                    <>
                        <button
                            type="button"
                            className="btn-portal-outline cash-bank-register-export-btn"
                            disabled={!ledger || ledgerLoading || pdfExporting}
                            onClick={handleExportPdf}
                        >
                            <FileText size={16} style={{ marginRight: 6 }} />
                            {pdfExporting ? 'Generating…' : 'Download PDF'}
                        </button>
                        <button
                            type="button"
                            className="btn-portal-outline cash-bank-register-export-btn"
                            disabled={!ledger || ledgerLoading}
                            onClick={() =>
                                exportCorporateArLedgerExcel({
                                    header: exportHeader,
                                    summary: sum,
                                    lines: allLedgerLines,
                                })
                            }
                        >
                            <FileSpreadsheet size={16} style={{ marginRight: 6 }} /> Download Excel
                        </button>
                    </>
                ) : null}
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <button
                    type="button"
                    className={`btn-portal-outline ${viewMode === 'statement' ? 'active' : ''}`}
                    onClick={() => setViewMode('statement')}
                >
                    Account Statement
                </button>
                <button
                    type="button"
                    className={`btn-portal-outline ${viewMode === 'generated-bills' ? 'active' : ''}`}
                    onClick={() => {
                        setViewMode('generated-bills');
                        setSelectedBillId('');
                        setBillDetail(null);
                    }}
                >
                    Generated Bills
                </button>
            </div>

            {(ledgerError || error) && (
                <p className="billing-error form-help-text" style={{ color: '#B45309' }}>
                    {ledgerError || error}
                </p>
            )}

            {dueDate && viewMode === 'statement' && (
                <p className="billing-due-date-banner">
                    Bill due date: <strong>{dueDate}</strong>
                </p>
            )}

            {viewMode === 'generated-bills' ? (
                <>
                    <section className="premium-table cash-bank-table corporate-billing-ledger-table" style={{ marginBottom: 16 }}>
                        <table className="ws-table" style={{ width: '100%' }}>
                            <thead>
                                <tr>
                                    <th>Bill No.</th>
                                    <th>Period</th>
                                    <th>Due Date</th>
                                    <th>Status</th>
                                    <th style={{ textAlign: 'right' }}>Balance Due</th>
                                    <th>Created</th>
                                </tr>
                            </thead>
                            <tbody>
                                {billsLoading ? (
                                    <tr>
                                        <td colSpan={6} className="table-cell table-empty">
                                            <Loader size={18} className="spin" /> Loading bills…
                                        </td>
                                    </tr>
                                ) : generatedBills.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="table-cell table-empty">No generated bills yet.</td>
                                    </tr>
                                ) : (
                                    generatedBills.map((b) => (
                                        <tr
                                            key={b.id}
                                            className={`cash-bank-account-row--clickable ${selectedBillId === b.id ? 'selected' : ''}`}
                                            onClick={() => openBillDetail(b.id)}
                                        >
                                            <td className="table-cell cell-main-text">{b.billNo}</td>
                                            <td className="table-cell">{b.periodStartDate} — {b.periodEndDate}</td>
                                            <td className="table-cell">{b.dueDate}</td>
                                            <td className="table-cell">{billStatusLabel(b.status)}</td>
                                            <td className="table-cell" style={{ textAlign: 'right', fontWeight: 700 }}>
                                                SAR {fmt(b.kpis?.balance)}
                                            </td>
                                            <td className="table-cell">
                                                {b.createdAt ? new Date(b.createdAt).toLocaleString() : '—'}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </section>

                    {selectedBillId && (
                        <div style={{ marginBottom: 16 }}>
                            {billDetailLoading ? (
                                <p className="table-cell table-empty"><Loader size={18} className="spin" /> Loading bill…</p>
                            ) : billDetail ? (
                                <>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>
                                            {billDetail.billNo}
                                        </h3>
                                        <span className="billing-due-date-banner" style={{ margin: 0 }}>
                                            Due: <strong>{billDetail.dueDate}</strong>
                                        </span>
                                        <button
                                            type="button"
                                            className="btn-portal-outline"
                                            disabled={billPdfExporting}
                                            onClick={handleExportBillPdf}
                                        >
                                            <FileText size={16} style={{ marginRight: 6 }} />
                                            {billPdfExporting ? 'Generating…' : 'Download Bill PDF'}
                                        </button>
                                    </div>

                                    <div className="cash-bank-stats cash-bank-register-kpis billing-stats">
                                        {[
                                            ['Opening', billSum.openingBalance],
                                            ['Invoices', billSum.totalInvoiceAmount],
                                            ['Receipts', billSum.totalReceipts],
                                            ['Discounts', billSum.totalDiscounts],
                                            ['Returns', billSum.totalSalesReturns],
                                            ['Closing', billSum.closingBalance],
                                        ].map(([label, val]) => (
                                            <div key={label} className="cash-bank-stat-card billing-stat-card">
                                                <div>
                                                    <p className="cash-bank-stat-label billing-stat-label">{label}</p>
                                                    <p className="cash-bank-stat-value billing-stat-val">SAR {fmt(val)}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <section className="premium-table cash-bank-table corporate-ar-ledger-table corporate-billing-ledger-table">
                                        <table className="ws-table" style={{ width: '100%', minWidth: 1200 }}>
                                            <thead>
                                                <tr>
                                                    <th>Date</th>
                                                    <th>Inv No.</th>
                                                    <th>Vehicle No.</th>
                                                    <th>Products &amp; Services</th>
                                                    <th>Type</th>
                                                    <th style={{ textAlign: 'right' }}>Excl VAT</th>
                                                    <th style={{ textAlign: 'right' }}>VAT</th>
                                                    <th style={{ textAlign: 'right' }}>Discounts</th>
                                                    <th style={{ textAlign: 'right' }}>Incl VAT</th>
                                                    <th style={{ textAlign: 'right' }}>Returns</th>
                                                    <th style={{ textAlign: 'right' }}>Receipts</th>
                                                    <th style={{ textAlign: 'right' }}>Balance</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr className="cash-bank-register-opening-row">
                                                    <td colSpan={11}><strong>Opening balance</strong></td>
                                                    <td style={{ textAlign: 'right', fontWeight: 700 }}>SAR {fmt(billSum.openingBalance)}</td>
                                                </tr>
                                                {billLedgerLines.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={12} className="table-cell table-empty">No ledger lines in snapshot.</td>
                                                    </tr>
                                                ) : (
                                                    billLedgerLines.map((row) => (
                                                        <tr key={row.id}>
                                                            <td>{row.date}</td>
                                                            <td>
                                                                <ClickableInvoiceNo
                                                                    invoiceId={row.invoiceId}
                                                                    invoiceNo={row.invoiceNo}
                                                                    workshopId={ledger?.corporateAccount?.workshopId}
                                                                    loadingId={invoiceLoadingId}
                                                                    onOpen={openInvoicePdf}
                                                                />
                                                            </td>
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
                                                    <td style={{ textAlign: 'right', fontWeight: 700 }}>SAR {fmt(billSum.closingBalance)}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </section>
                                </>
                            ) : null}
                        </div>
                    )}
                </>
            ) : (
                <>
            <div className="cash-bank-stats cash-bank-register-kpis billing-stats">
                <div className="cash-bank-stat-card cash-bank-stat-card--muted billing-stat-card">
                    <div>
                        <p className="cash-bank-stat-label billing-stat-label">Opening Balance</p>
                        <p className="cash-bank-stat-value billing-stat-val">SAR {fmt(sum.openingBalance)}</p>
                    </div>
                </div>
                <button
                    type="button"
                    className={`cash-bank-stat-card cash-bank-stat-card--clickable billing-stat-card ${ledgerFilter === 'invoices' ? 'active' : ''}`}
                    onClick={() => setLedgerFilter((f) => (f === 'invoices' ? 'all' : 'invoices'))}
                >
                    <div>
                        <p className="cash-bank-stat-label billing-stat-label">Total Invoice Amount</p>
                        <p className="cash-bank-stat-value billing-stat-val">SAR {fmt(sum.totalInvoiceAmount)}</p>
                    </div>
                </button>
                <button
                    type="button"
                    className={`cash-bank-stat-card cash-bank-stat-card--clickable billing-stat-card ${ledgerFilter === 'receipts' ? 'active' : ''}`}
                    onClick={() => setLedgerFilter((f) => (f === 'receipts' ? 'all' : 'receipts'))}
                >
                    <div>
                        <p className="cash-bank-stat-label billing-stat-label">Total Receipts</p>
                        <p className="cash-bank-stat-value billing-stat-val">SAR {fmt(sum.totalReceipts)}</p>
                    </div>
                </button>
                <button
                    type="button"
                    className={`cash-bank-stat-card cash-bank-stat-card--clickable billing-stat-card ${ledgerFilter === 'discounts' ? 'active' : ''}`}
                    onClick={() => setLedgerFilter((f) => (f === 'discounts' ? 'all' : 'discounts'))}
                >
                    <div>
                        <p className="cash-bank-stat-label billing-stat-label">Discounts</p>
                        <p className="cash-bank-stat-value billing-stat-val">SAR {fmt(sum.totalDiscounts)}</p>
                    </div>
                </button>
                <button
                    type="button"
                    className={`cash-bank-stat-card cash-bank-stat-card--clickable billing-stat-card ${ledgerFilter === 'returns' ? 'active' : ''}`}
                    onClick={() => setLedgerFilter((f) => (f === 'returns' ? 'all' : 'returns'))}
                >
                    <div>
                        <p className="cash-bank-stat-label billing-stat-label">Sales Returns</p>
                        <p className="cash-bank-stat-value billing-stat-val">SAR {fmt(sum.totalSalesReturns)}</p>
                    </div>
                </button>
                <button
                    type="button"
                    className={`cash-bank-stat-card cash-bank-stat-card--clickable billing-stat-card billing-stat-balance ${ledgerFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setLedgerFilter('all')}
                >
                    <div>
                        <p className="cash-bank-stat-label billing-stat-label">Closing Balance</p>
                        <p className="cash-bank-stat-value billing-stat-val">SAR {fmt(sum.closingBalance)}</p>
                    </div>
                </button>
            </div>

            <p className="cash-bank-desc" style={{ margin: '0 0 8px' }}>
                Period: {dateFrom} — {dateTo}
                {ledger?.generatedAt ? ` · Generated ${new Date(ledger.generatedAt).toLocaleString()}` : ''}
            </p>

            <section className="premium-table cash-bank-table corporate-ar-ledger-table corporate-billing-ledger-table">
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
                            <tr>
                                <td colSpan={12} className="table-cell table-empty">
                                    <Loader size={18} className="spin" /> Loading ledger…
                                </td>
                            </tr>
                        ) : (
                            <>
                                <tr className="cash-bank-register-opening-row">
                                    <td colSpan={11}><strong>Opening balance</strong></td>
                                    <td style={{ textAlign: 'right', fontWeight: 700 }}>SAR {fmt(sum.openingBalance)}</td>
                                </tr>
                                {filteredLines.length === 0 ? (
                                    <tr>
                                        <td colSpan={12} className="table-cell table-empty">
                                            No lines in this period{ledgerFilter !== 'all' ? ` (${ledgerFilter})` : ''}.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredLines.map((row) => (
                                        <tr key={row.id}>
                                            <td>{row.date}</td>
                                            <td>
                                                <ClickableInvoiceNo
                                                    invoiceId={row.invoiceId}
                                                    invoiceNo={row.invoiceNo}
                                                    workshopId={ledger?.corporateAccount?.workshopId}
                                                    loadingId={invoiceLoadingId}
                                                    onOpen={openInvoicePdf}
                                                />
                                            </td>
                                            <td>{row.vehicleNo}</td>
                                            <td style={{ maxWidth: 240 }}>
                                                <div>{row.productsServicesEn ?? row.productsServices}</div>
                                                {row.productsServicesAr ? (
                                                    <div
                                                        style={{
                                                            fontSize: 12,
                                                            color: '#64748b',
                                                            marginTop: 2,
                                                            direction: 'rtl',
                                                            textAlign: 'left',
                                                        }}
                                                    >
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
                </>
            )}

            {generateOpen && (
                <Modal
                    title="Generate Monthly Bill"
                    onClose={() => setGenerateOpen(false)}
                    footer={
                        <>
                            <button type="button" className="btn-secondary" onClick={() => setGenerateOpen(false)}>
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn-submit"
                                onClick={handleGenerateBill}
                                disabled={generating || !generateDueDate.trim()}
                            >
                                {generating ? (
                                    <>
                                        <Loader size={14} className="spin" /> Generating…
                                    </>
                                ) : (
                                    'Generate Bill'
                                )}
                            </button>
                        </>
                    }
                >
                    <p style={{ marginTop: 0, color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                        Period: <strong>{dateFrom} — {dateTo}</strong>
                        <br />
                        Company: <strong>{displayName}</strong>
                    </p>
                    <div className="form-group">
                        <label className="form-label">Due Date *</label>
                        <input
                            type="date"
                            className="form-input-field"
                            value={generateDueDate}
                            onChange={(e) => setGenerateDueDate(e.target.value)}
                            required
                        />
                    </div>
                </Modal>
            )}

            <InvoiceDetailsModal
                invoice={invoiceModalData}
                isOpen={invoiceModalOpen}
                onClose={() => {
                    setInvoiceModalOpen(false);
                    setInvoiceModalData(null);
                }}
                footerVariant="corporate"
            />
        </div>
    );
}
