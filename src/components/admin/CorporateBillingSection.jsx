import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
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
import { startOfMonthISO, todayISO, loadSaAccountingDateRange, saveSaAccountingDateRange } from '../../pages/admin/saAccountingDateRange';
import { cbT } from '../../utils/corporateBillingI18n';
import CorporateGenerateBillModal from './CorporateGenerateBillModal';
import '../../styles/admin/AccountingPage.css';

function fmt(n) {
    return Number(n ?? 0).toLocaleString('en-SA', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function fmtCell(v, t) {
    if (v == null || v === '') return '—';
    return t('money.sar', { amount: fmt(v) });
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

function billStatusLabel(status, t) {
    if (status === 'paid') return t('status.paid');
    if (status === 'awaiting_approval') return t('status.awaiting');
    if (status === 'rejected') return t('status.rejected');
    return t('status.pending');
}

function BilingualTh({ primaryKey, secondaryKey, t, style }) {
    return (
        <th style={style}>
            <div>{t(primaryKey)}</div>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>{t(secondaryKey)}</div>
        </th>
    );
}

/** Shared From / To date range control for list + statement views. */
function BillingDateRange({
    dateFrom,
    dateTo,
    onFrom,
    onTo,
    onClear,
    onApply,
    t,
    compact = false,
    applying = false,
}) {
    return (
        <div
            className={`corporate-billing-date-range${compact ? ' corporate-billing-date-range--compact' : ''}`}
            role="group"
            aria-label={t('label.dateRange')}
        >
            <span className="corporate-billing-date-range__label">{t('label.dateRange')}</span>
            <div className="corporate-billing-date-range__inputs">
                <label className="billing-date-field">
                    <span>{t('label.from')}</span>
                    <input
                        type="date"
                        value={dateFrom || ''}
                        max={dateTo || undefined}
                        onChange={(e) => onFrom(e.target.value)}
                    />
                </label>
                <span className="corporate-billing-date-range__sep" aria-hidden="true">→</span>
                <label className="billing-date-field">
                    <span>{t('label.to')}</span>
                    <input
                        type="date"
                        value={dateTo || ''}
                        min={dateFrom || undefined}
                        onChange={(e) => onTo(e.target.value)}
                    />
                </label>
                {onApply ? (
                    <button
                        type="button"
                        className="btn-portal corporate-billing-date-range__apply"
                        onClick={onApply}
                        disabled={applying || !dateFrom || !dateTo}
                    >
                        {t('btn.apply')}
                    </button>
                ) : null}
                {(dateFrom || dateTo) ? (
                    <button
                        type="button"
                        className="btn-portal-outline corporate-billing-date-range__clear"
                        onClick={onClear}
                        title={t('btn.clearDates')}
                    >
                        {t('btn.clearDates')}
                    </button>
                ) : null}
            </div>
        </div>
    );
}

export default function CorporateBillingSection() {
    const outletCtx = useOutletContext() || {};
    const locale =
        outletCtx.locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => cbT(locale, key, vars), [locale]);
    const isAr = locale === 'ar';

    const [search, setSearch] = useState('');
    const [customers, setCustomers] = useState([]);
    const [customersLoading, setCustomersLoading] = useState(true);
    const [customersError, setCustomersError] = useState('');
    const [listSummary, setListSummary] = useState(null);

    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [dateFrom, setDateFrom] = useState(
        () => loadSaAccountingDateRange().dateFrom || startOfMonthISO(),
    );
    const [dateTo, setDateTo] = useState(
        () => loadSaAccountingDateRange().dateTo || todayISO(),
    );
    const [dueDate, setDueDate] = useState('');

    const persistDates = useCallback((from, to) => {
        saveSaAccountingDateRange({
            dateFrom: from || startOfMonthISO(),
            dateTo: to || todayISO(),
        });
    }, []);

    const onDateFrom = useCallback((v) => {
        setDateFrom(v);
    }, []);

    const onDateTo = useCallback((v) => {
        setDateTo(v);
    }, []);

    const clearDates = useCallback(() => {
        const from = startOfMonthISO();
        const to = todayISO();
        setDateFrom(from);
        setDateTo(to);
        persistDates(from, to);
    }, [persistDates]);

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

    const loadCustomers = useCallback(async (range) => {
        const from = range?.dateFrom !== undefined ? range.dateFrom : dateFrom;
        const to = range?.dateTo !== undefined ? range.dateTo : dateTo;
        if (from && to && from > to) {
            setCustomers([]);
            setListSummary(null);
            setCustomersError(t('err.dateOrder'));
            setCustomersLoading(false);
            return;
        }
        setCustomersLoading(true);
        setCustomersError('');
        persistDates(from, to);
        try {
            const res = await listCorporateArCustomers({
                q: search.trim() || undefined,
                dateFrom: from || undefined,
                dateTo: to || undefined,
            });
            setCustomers(res?.customers ?? []);
            setListSummary(res?.summary ?? null);
        } catch (e) {
            setCustomers([]);
            setListSummary(null);
            setCustomersError(e?.message || t('err.loadCustomers'));
        } finally {
            setCustomersLoading(false);
        }
    }, [search, dateFrom, dateTo, persistDates, t]);

    const applyDateRange = useCallback(() => {
        void loadCustomers({ dateFrom, dateTo });
    }, [loadCustomers, dateFrom, dateTo]);

    const loadLedger = useCallback(async () => {
        if (!selectedAccountId) return;
        if (dateFrom && dateTo && dateFrom > dateTo) {
            setLedger(null);
            setLedgerError(t('err.dateOrder'));
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
            setLedgerError(e?.message || t('err.loadLedger'));
        } finally {
            setLedgerLoading(false);
        }
    }, [selectedAccountId, dateFrom, dateTo, t]);

    const loadGeneratedBills = useCallback(async () => {
        if (!selectedAccountId) return;
        setBillsLoading(true);
        try {
            const res = await listCorporateGeneratedBills(selectedAccountId);
            setGeneratedBills(res?.bills ?? []);
        } catch (e) {
            setGeneratedBills([]);
            setError(e?.message || t('err.loadBills'));
        } finally {
            setBillsLoading(false);
        }
    }, [selectedAccountId, t]);

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
            setError(e?.message || t('err.loadBill'));
        } finally {
            setBillDetailLoading(false);
        }
    }, [t]);

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
                ? new Date(ledger.generatedAt).toLocaleString(isAr ? 'ar-SA' : undefined)
                : new Date().toLocaleString(isAr ? 'ar-SA' : undefined),
        };
    }, [ledger, dateFrom, dateTo, isAr]);

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
            setError(e?.message || t('err.openInvoice'));
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
            setError(e?.message || t('err.pdfExport'));
        } finally {
            setPdfExporting(false);
        }
    };

    const handleGenerateBill = async (opts = {}) => {
        const lineOverrides = Array.isArray(opts?.lineOverrides)
            ? opts.lineOverrides
            : Array.isArray(opts)
              ? opts
              : [];
        const includeOpeningBalance = opts?.includeOpeningBalance !== false;

        if (!selectedAccountId || !generateDueDate.trim()) return;
        if (!dateFrom || !dateTo) {
            setError(t('err.selectDates'));
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
                lineOverrides,
                includeOpeningBalance,
            });
            setDueDate(generateDueDate.trim());
            setGenerateOpen(false);
            setViewMode('generated-bills');
            await loadGeneratedBills();
            if (res?.bill?.id) {
                await openBillDetail(res.bill.id);
            }
            if (res?.bill?.billNo) {
                alert(t('alert.generated', { no: res.bill.billNo }));
            }
        } catch (e) {
            setError(e?.message || t('err.generate'));
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
            setError(e?.message || t('err.billPdf'));
        } finally {
            setBillPdfExporting(false);
        }
    };

    const billLedger = billDetail?.ledgerStatement;
    const billLedgerLines = billLedger?.lines ?? [];
    const billSum = billLedger?.summary ?? billDetail?.kpis ?? {};

    const thPair = (enKey, arKey) =>
        isAr
            ? { primaryKey: enKey, secondaryKey: arKey }
            : { primaryKey: enKey, secondaryKey: arKey };

    if (!selectedAccountId) {
        return (
            <div className="corporate-ar-page">
                <header className="corporate-billing-header corporate-ar-header">
                    <div>
                        <h1 className="corporate-billing-title">{t('page.title')}</h1>
                        <p className="corporate-billing-subtitle">
                            {t('page.subtitle')}
                        </p>
                    </div>
                </header>

                <div className="corporate-billing-list-toolbar">
                    <BillingDateRange
                        dateFrom={dateFrom}
                        dateTo={dateTo}
                        onFrom={onDateFrom}
                        onTo={onDateTo}
                        onClear={clearDates}
                        onApply={applyDateRange}
                        applying={customersLoading}
                        t={t}
                        compact
                    />
                    <div className="corporate-billing-list-toolbar__search">
                        <div className="pi-search-box">
                            <Search size={16} />
                            <input
                                type="text"
                                placeholder={t('search.placeholder')}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && loadCustomers()}
                            />
                        </div>
                    </div>
                    <button
                        type="button"
                        className="btn-portal-outline corporate-billing-list-toolbar__refresh"
                        onClick={loadCustomers}
                        disabled={customersLoading}
                    >
                        <RefreshCw size={16} /> {t('btn.refresh')}
                    </button>
                </div>

                {listSummary ? (
                    <div className="cash-bank-stats corporate-billing-list-stats">
                        <div className="cash-bank-stat-card cash-bank-stat-card--muted">
                            <div className="cash-bank-stat-icon"><Building2 size={22} /></div>
                            <div>
                                <p className="cash-bank-stat-label">{t('stat.customers')}</p>
                                <p className="cash-bank-stat-value">{listSummary.count}</p>
                            </div>
                        </div>
                        <div className="cash-bank-stat-card">
                            <div className="cash-bank-stat-icon"><Users size={22} /></div>
                            <div>
                                <p className="cash-bank-stat-label">
                                    {dateFrom && dateTo ? t('stat.periodDue') : t('stat.totalDue')}
                                </p>
                                <p className="cash-bank-stat-value">{t('money.sar', { amount: fmt(listSummary.totalDue) })}</p>
                                {dateFrom && dateTo ? (
                                    <p className="corporate-billing-list-stats__period">
                                        {t('label.period', { from: dateFrom, to: dateTo })}
                                    </p>
                                ) : null}
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
                                <th>{t('th.company')}</th>
                                <th>{t('th.vat')}</th>
                                <th>{t('th.contact')}</th>
                                <th>{t('th.workshop')}</th>
                                <th style={{ textAlign: 'right' }}>
                                    {dateFrom && dateTo ? t('th.periodDue') : t('th.dueBalance')}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {customersLoading ? (
                                <tr>
                                    <td colSpan={5} className="table-cell table-empty">
                                        <Loader size={18} className="spin" /> {t('loading')}
                                    </td>
                                </tr>
                            ) : customers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="table-cell table-empty">{t('empty.accounts')}</td>
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
                                            {t('money.sar', { amount: fmt(c.dueBalance) })}
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
    const displayName = corp?.companyName || selectedCustomer?.companyName || t('fallback.title');

    const billKpis = [
        ['kpi.opening', billSum.openingBalance],
        ['kpi.invoices', billSum.totalInvoiceAmount],
        ['kpi.receipts', billSum.totalReceipts],
        ['kpi.discounts', billSum.totalDiscounts],
        ['kpi.returns', billSum.totalSalesReturns],
        ['kpi.closing', billSum.closingBalance],
    ];

    return (
        <div className="corporate-ar-page corporate-billing-detail">
            <header className="corporate-ar-header">
                <button type="button" className="corporate-billing-back-btn cash-bank-register-back" onClick={backToList}>
                    <ArrowLeft size={18} /> {t('btn.back')}
                </button>
                <div>
                    <h2 className="cash-bank-title corporate-billing-title" style={{ margin: 0 }}>
                        {displayName}
                    </h2>
                    <p className="cash-bank-desc corporate-billing-detail-sub" style={{ margin: '4px 0 0' }}>
                        {t('label.vat', {
                            vat: corp?.vatNumber || selectedCustomer?.vatNumber || '—',
                            workshop: corp?.workshopName || selectedCustomer?.workshopName || '—',
                        })}
                    </p>
                </div>
            </header>

            <div className="cash-bank-register-filters corporate-billing-detail-actions">
                <BillingDateRange
                    dateFrom={dateFrom}
                    dateTo={dateTo}
                    onFrom={onDateFrom}
                    onTo={onDateTo}
                    onClear={clearDates}
                    t={t}
                />
                <button type="button" className="btn-portal-outline" onClick={loadLedger} disabled={ledgerLoading}>
                    <RefreshCw size={16} style={{ marginRight: 6 }} /> {t('btn.apply')}
                </button>
                <button
                    type="button"
                    className="btn-portal"
                    disabled={!dateFrom || !dateTo}
                    onClick={() => {
                        setGenerateDueDate(dueDate || dateTo || '');
                        setGenerateOpen(true);
                    }}
                >
                    <FileText size={16} style={{ marginRight: 6 }} /> {t('btn.generateBill')}
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
                    <FileText size={16} style={{ marginRight: 6 }} /> {t('btn.generatedBills')}
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
                            {pdfExporting ? t('btn.generating') : t('btn.downloadPdf')}
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
                            <FileSpreadsheet size={16} style={{ marginRight: 6 }} /> {t('btn.downloadExcel')}
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
                    {t('btn.statement')}
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
                    {t('btn.generatedBills')}
                </button>
            </div>

            {(ledgerError || error) && (
                <p className="billing-error form-help-text" style={{ color: '#B45309' }}>
                    {ledgerError || error}
                </p>
            )}

            {dueDate && viewMode === 'statement' && (
                <p className="billing-due-date-banner">
                    {t('label.dueBanner')} <strong>{dueDate}</strong>
                </p>
            )}

            {viewMode === 'generated-bills' ? (
                <>
                    <section className="premium-table cash-bank-table corporate-billing-ledger-table" style={{ marginBottom: 16 }}>
                        <table className="ws-table" style={{ width: '100%' }}>
                            <thead>
                                <tr>
                                    <th>{t('th.billNo')}</th>
                                    <th>{t('th.period')}</th>
                                    <th>{t('th.dueDate')}</th>
                                    <th>{t('th.status')}</th>
                                    <th style={{ textAlign: 'right' }}>{t('th.dueBalance')}</th>
                                    <th>{t('th.created')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {billsLoading ? (
                                    <tr>
                                        <td colSpan={6} className="table-cell table-empty">
                                            <Loader size={18} className="spin" /> {t('loading.bills')}
                                        </td>
                                    </tr>
                                ) : generatedBills.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="table-cell table-empty">{t('empty.bills')}</td>
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
                                            <td className="table-cell">{billStatusLabel(b.status, t)}</td>
                                            <td className="table-cell" style={{ textAlign: 'right', fontWeight: 700 }}>
                                                {t('money.sar', { amount: fmt(b.kpis?.balance) })}
                                            </td>
                                            <td className="table-cell">
                                                {b.createdAt
                                                    ? new Date(b.createdAt).toLocaleString(isAr ? 'ar-SA' : undefined)
                                                    : '—'}
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
                                <p className="table-cell table-empty"><Loader size={18} className="spin" /> {t('loading.bill')}</p>
                            ) : billDetail ? (
                                <>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>
                                            {billDetail.billNo}
                                        </h3>
                                        <span className="billing-due-date-banner" style={{ margin: 0 }}>
                                            {t('label.due')} <strong>{billDetail.dueDate}</strong>
                                        </span>
                                        <button
                                            type="button"
                                            className="btn-portal-outline"
                                            disabled={billPdfExporting}
                                            onClick={handleExportBillPdf}
                                        >
                                            <FileText size={16} style={{ marginRight: 6 }} />
                                            {billPdfExporting ? t('btn.generating') : t('btn.downloadBillPdf')}
                                        </button>
                                    </div>

                                    <div className="cash-bank-stats cash-bank-register-kpis billing-stats">
                                        {billKpis.map(([labelKey, val]) => (
                                            <div key={labelKey} className="cash-bank-stat-card billing-stat-card">
                                                <div>
                                                    <p className="cash-bank-stat-label billing-stat-label">{t(labelKey)}</p>
                                                    <p className="cash-bank-stat-value billing-stat-val">
                                                        {t('money.sar', { amount: fmt(val) })}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <section className="premium-table cash-bank-table corporate-ar-ledger-table corporate-billing-ledger-table">
                                        <table className="ws-table" style={{ width: '100%', minWidth: 1200 }}>
                                            <thead>
                                                <tr>
                                                    <th>{t('th.date')}</th>
                                                    <th>{t('th.invNo')}</th>
                                                    <th>{t('th.vehicle')}</th>
                                                    <th>{t('th.products')}</th>
                                                    <th>{t('th.type')}</th>
                                                    <th style={{ textAlign: 'right' }}>{t('th.exclVatShort')}</th>
                                                    <th style={{ textAlign: 'right' }}>{t('th.vat15')}</th>
                                                    <th style={{ textAlign: 'right' }}>{t('th.discounts')}</th>
                                                    <th style={{ textAlign: 'right' }}>{t('th.inclVatShort')}</th>
                                                    <th style={{ textAlign: 'right' }}>{t('th.returns')}</th>
                                                    <th style={{ textAlign: 'right' }}>{t('th.receipts')}</th>
                                                    <th style={{ textAlign: 'right' }}>{t('th.balance')}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr className="cash-bank-register-opening-row">
                                                    <td colSpan={11}><strong>{t('label.openingBalance')}</strong></td>
                                                    <td style={{ textAlign: 'right', fontWeight: 700 }}>
                                                        {t('money.sar', { amount: fmt(billSum.openingBalance) })}
                                                    </td>
                                                </tr>
                                                {billLedgerLines.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={12} className="table-cell table-empty">{t('empty.ledgerLines')}</td>
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
                                                                <div>{isAr ? (row.productsServicesAr || row.productsServicesEn || row.productsServices) : (row.productsServicesEn ?? row.productsServices)}</div>
                                                                {!isAr && row.productsServicesAr ? (
                                                                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, direction: 'rtl', textAlign: 'left' }}>
                                                                        {row.productsServicesAr}
                                                                    </div>
                                                                ) : null}
                                                                {isAr && (row.productsServicesEn ?? row.productsServices) && row.productsServicesAr ? (
                                                                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                                                                        {row.productsServicesEn ?? row.productsServices}
                                                                    </div>
                                                                ) : null}
                                                            </td>
                                                            <td>{formatLedgerTypeShort(row.type)}</td>
                                                            <td style={{ textAlign: 'right' }}>{fmtCell(row.invoiceExclVat, t)}</td>
                                                            <td style={{ textAlign: 'right' }}>{fmtCell(row.vat15, t)}</td>
                                                            <td style={{ textAlign: 'right' }}>{fmtCell(row.salesDiscounts, t)}</td>
                                                            <td style={{ textAlign: 'right' }}>{fmtCell(row.invoiceInclusiveVat, t)}</td>
                                                            <td style={{ textAlign: 'right', color: '#DC2626' }}>{fmtCell(row.salesReturns, t)}</td>
                                                            <td style={{ textAlign: 'right', color: '#059669' }}>{fmtCell(row.receipts, t)}</td>
                                                            <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                                                {t('money.sar', { amount: fmt(row.runningBalance) })}
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                                <tr className="cash-bank-register-closing-row">
                                                    <td colSpan={11}><strong>{t('label.closingBalance')}</strong></td>
                                                    <td style={{ textAlign: 'right', fontWeight: 700 }}>
                                                        {t('money.sar', { amount: fmt(billSum.closingBalance) })}
                                                    </td>
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
                        <p className="cash-bank-stat-label billing-stat-label">{t('stat.opening')}</p>
                        <p className="cash-bank-stat-value billing-stat-val">{t('money.sar', { amount: fmt(sum.openingBalance) })}</p>
                    </div>
                </div>
                <button
                    type="button"
                    className={`cash-bank-stat-card cash-bank-stat-card--clickable billing-stat-card ${ledgerFilter === 'invoices' ? 'active' : ''}`}
                    onClick={() => setLedgerFilter((f) => (f === 'invoices' ? 'all' : 'invoices'))}
                >
                    <div>
                        <p className="cash-bank-stat-label billing-stat-label">{t('stat.invoices')}</p>
                        <p className="cash-bank-stat-value billing-stat-val">{t('money.sar', { amount: fmt(sum.totalInvoiceAmount) })}</p>
                    </div>
                </button>
                <button
                    type="button"
                    className={`cash-bank-stat-card cash-bank-stat-card--clickable billing-stat-card ${ledgerFilter === 'receipts' ? 'active' : ''}`}
                    onClick={() => setLedgerFilter((f) => (f === 'receipts' ? 'all' : 'receipts'))}
                >
                    <div>
                        <p className="cash-bank-stat-label billing-stat-label">{t('stat.receipts')}</p>
                        <p className="cash-bank-stat-value billing-stat-val">{t('money.sar', { amount: fmt(sum.totalReceipts) })}</p>
                    </div>
                </button>
                <button
                    type="button"
                    className={`cash-bank-stat-card cash-bank-stat-card--clickable billing-stat-card ${ledgerFilter === 'discounts' ? 'active' : ''}`}
                    onClick={() => setLedgerFilter((f) => (f === 'discounts' ? 'all' : 'discounts'))}
                >
                    <div>
                        <p className="cash-bank-stat-label billing-stat-label">{t('stat.discounts')}</p>
                        <p className="cash-bank-stat-value billing-stat-val">{t('money.sar', { amount: fmt(sum.totalDiscounts) })}</p>
                    </div>
                </button>
                <button
                    type="button"
                    className={`cash-bank-stat-card cash-bank-stat-card--clickable billing-stat-card ${ledgerFilter === 'returns' ? 'active' : ''}`}
                    onClick={() => setLedgerFilter((f) => (f === 'returns' ? 'all' : 'returns'))}
                >
                    <div>
                        <p className="cash-bank-stat-label billing-stat-label">{t('stat.returns')}</p>
                        <p className="cash-bank-stat-value billing-stat-val">{t('money.sar', { amount: fmt(sum.totalSalesReturns) })}</p>
                    </div>
                </button>
                <button
                    type="button"
                    className={`cash-bank-stat-card cash-bank-stat-card--clickable billing-stat-card billing-stat-balance ${ledgerFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setLedgerFilter('all')}
                >
                    <div>
                        <p className="cash-bank-stat-label billing-stat-label">{t('stat.closing')}</p>
                        <p className="cash-bank-stat-value billing-stat-val">{t('money.sar', { amount: fmt(sum.closingBalance) })}</p>
                    </div>
                </button>
            </div>

            <p className="cash-bank-desc" style={{ margin: '0 0 8px' }}>
                {t('label.period', { from: dateFrom, to: dateTo })}
                {ledger?.generatedAt
                    ? t('label.generated', {
                        when: new Date(ledger.generatedAt).toLocaleString(isAr ? 'ar-SA' : undefined),
                    })
                    : ''}
            </p>

            <section className="premium-table cash-bank-table corporate-ar-ledger-table corporate-billing-ledger-table">
                <table className="ws-table" style={{ width: '100%', minWidth: 1200 }}>
                    <thead>
                        <tr>
                            <BilingualTh {...thPair('th.date', 'th.dateAr')} t={t} />
                            <BilingualTh {...thPair('th.invNo', 'th.invNoAr')} t={t} />
                            <BilingualTh {...thPair('th.vehicle', 'th.vehicleAr')} t={t} />
                            <BilingualTh {...thPair('th.products', 'th.productsAr')} t={t} />
                            <BilingualTh {...thPair('th.type', 'th.typeAr')} t={t} />
                            <BilingualTh {...thPair('th.exclVat', 'th.exclVatAr')} t={t} style={{ textAlign: 'right' }} />
                            <BilingualTh {...thPair('th.vat15', 'th.vat15Ar')} t={t} style={{ textAlign: 'right' }} />
                            <BilingualTh {...thPair('th.discounts', 'th.discountsAr')} t={t} style={{ textAlign: 'right' }} />
                            <BilingualTh {...thPair('th.inclVat', 'th.inclVatAr')} t={t} style={{ textAlign: 'right' }} />
                            <BilingualTh {...thPair('th.returns', 'th.returnsAr')} t={t} style={{ textAlign: 'right' }} />
                            <BilingualTh {...thPair('th.receipts', 'th.receiptsAr')} t={t} style={{ textAlign: 'right' }} />
                            <BilingualTh {...thPair('th.balance', 'th.balanceAr')} t={t} style={{ textAlign: 'right' }} />
                        </tr>
                    </thead>
                    <tbody>
                        {ledgerLoading ? (
                            <tr>
                                <td colSpan={12} className="table-cell table-empty">
                                    <Loader size={18} className="spin" /> {t('loading.ledger')}
                                </td>
                            </tr>
                        ) : (
                            <>
                                <tr className="cash-bank-register-opening-row">
                                    <td colSpan={11}><strong>{t('label.openingBalance')}</strong></td>
                                    <td style={{ textAlign: 'right', fontWeight: 700 }}>
                                        {t('money.sar', { amount: fmt(sum.openingBalance) })}
                                    </td>
                                </tr>
                                {filteredLines.length === 0 ? (
                                    <tr>
                                        <td colSpan={12} className="table-cell table-empty">
                                            {ledgerFilter !== 'all'
                                                ? t('empty.periodFilter', { filter: ledgerFilter })
                                                : t('empty.period')}
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
                                                <div>
                                                    {isAr
                                                        ? (row.productsServicesAr || row.productsServicesEn || row.productsServices)
                                                        : (row.productsServicesEn ?? row.productsServices)}
                                                </div>
                                                {!isAr && row.productsServicesAr ? (
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
                                                {isAr && (row.productsServicesEn ?? row.productsServices) && row.productsServicesAr ? (
                                                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                                                        {row.productsServicesEn ?? row.productsServices}
                                                    </div>
                                                ) : null}
                                            </td>
                                            <td>{formatLedgerTypeShort(row.type)}</td>
                                            <td style={{ textAlign: 'right' }}>{fmtCell(row.invoiceExclVat, t)}</td>
                                            <td style={{ textAlign: 'right' }}>{fmtCell(row.vat15, t)}</td>
                                            <td style={{ textAlign: 'right' }}>{fmtCell(row.salesDiscounts, t)}</td>
                                            <td style={{ textAlign: 'right' }}>{fmtCell(row.invoiceInclusiveVat, t)}</td>
                                            <td style={{ textAlign: 'right', color: '#DC2626' }}>{fmtCell(row.salesReturns, t)}</td>
                                            <td style={{ textAlign: 'right', color: '#059669' }}>{fmtCell(row.receipts, t)}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                                {t('money.sar', { amount: fmt(row.runningBalance) })}
                                            </td>
                                        </tr>
                                    ))
                                )}
                                <tr className="cash-bank-register-closing-row">
                                    <td colSpan={11}><strong>{t('label.closingBalance')}</strong></td>
                                    <td style={{ textAlign: 'right', fontWeight: 700 }}>
                                        {t('money.sar', { amount: fmt(sum.closingBalance) })}
                                    </td>
                                </tr>
                            </>
                        )}
                    </tbody>
                </table>
            </section>
                </>
            )}

            {generateOpen && (
                <CorporateGenerateBillModal
                    open={generateOpen}
                    onClose={() => !generating && setGenerateOpen(false)}
                    t={t}
                    companyName={displayName}
                    dateFrom={dateFrom}
                    dateTo={dateTo}
                    dueDate={generateDueDate}
                    onDueDateChange={setGenerateDueDate}
                    ledger={ledger}
                    generating={generating}
                    onGenerate={handleGenerateBill}
                />
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
