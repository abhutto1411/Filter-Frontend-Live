import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
    ArrowLeft,
    ArrowRightLeft,
    Building2,
    CheckCircle2,
    FileSpreadsheet,
    FileText,
    Loader,
    RefreshCw,
    Search,
    Trash2,
    Users,
    Printer,
} from 'lucide-react';
import ClickableInvoiceNo from '../accounting/ClickableInvoiceNo';
import CashierTaxInvoiceView from '../pos/modern/CashierTaxInvoiceView';
import '../pos/modern/CashierTaxInvoiceView.css';
import {
    getCorporateArLedger,
    listCorporateArCustomers,
    listCorporateGeneratedBills,
    getCorporateGeneratedBill,
    deleteCorporateGeneratedBill,
    deleteCorporateGeneratedBills,
} from '../../services/accountsApi';
import {
    generateCorporateBill,
    transferCorporateInvoice,
    previewCorporateHqRemittance,
    postCorporateHqRemittance,
} from '../../services/superAdminApi';
import { openInvoiceViewAndDownloadPdf } from '../../utils/posInvoiceActions';
import {
    exportCorporateArLedgerExcel,
    exportCorporateArLedgerPdf,
    exportCorporateGeneratedBillPdf,
    formatLedgerTypeShort,
    ledgerAmountCells,
    applyPostDiscountVatToLedgerStatement,
    platformSellerHeaderFields,
} from '../../utils/corporateArLedgerExport';
import { exportRowsToExcel, exportRowsToPdf } from '../../utils/tableExport';
import { startOfMonthISO, todayISO, loadSaAccountingDateRange, saveSaAccountingDateRange } from '../../pages/admin/saAccountingDateRange';
import { cbT } from '../../utils/corporateBillingI18n';
import CorporateGenerateBillPage from './CorporateGenerateBillPage';
import CorporateMarkBillPaidModal from './CorporateMarkBillPaidModal';
import CorporateBillDistributePanel from './CorporateBillDistributePanel';
import CorporateTransferInvoiceModal from './CorporateTransferInvoiceModal';
import AdminScreenShell from './AdminScreenShell';
import '../../styles/admin/AccountingPage.css';
import UiPager from '../UiPager';
import { usePagedRows } from '../../hooks/usePagedRows';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import '../../styles/ui.css';

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

const LEDGER_COL_COUNT = 14;

/** Which of the statement's figures double as a filter over its lines. */
const STATEMENT_FILTERS = [
    { id: 'invoices',  labelKey: 'stat.invoices',  pick: (s) => s.totalInvoiceAmount },
    { id: 'receipts',  labelKey: 'stat.receipts',  pick: (s) => s.totalReceipts },
    { id: 'discounts', labelKey: 'stat.discounts', pick: (s) => s.totalDiscounts },
    { id: 'returns',   labelKey: 'stat.returns',   pick: (s) => s.totalSalesReturns },
];

/** Products & services, in the reading locale with the other language under
 *  it. Arabic is laid out RTL even when it is the secondary line. */
function LedgerProductCell({ row, isAr }) {
    const en = row.productsServicesEn ?? row.productsServices;
    const ar = row.productsServicesAr;
    const primary = isAr ? (ar || en) : en;
    const secondary = isAr ? (en && ar ? en : '') : ar;
    return (
        <>
            <div>{primary}</div>
            {secondary ? (
                <div className="ui-meta" dir={isAr ? 'ltr' : 'rtl'}>{secondary}</div>
            ) : null}
        </>
    );
}

/** Gross / discount / taxable / VAT / total, in that order. Column 1 is the
 *  discount — shown in brackets, the way a statement shows a deduction. */
function LedgerAmountTds({ row, t }) {
    return ledgerAmountCells(row).map((v, i) => {
        const isDiscount = i === 1 && Number(v) > 0;
        return (
            <td
                key={i}
                className={`ui-num${isDiscount ? ' ui-money ui-money--out' : ''}${i === 4 ? ' ui-money' : ''}`}
            >
                {isDiscount ? `(${fmtCell(v, t)})` : fmtCell(v, t)}
            </td>
        );
    });
}

function InvoiceAdjustmentStatus({ adj, t, isAr, rowType }) {
    /** Badge over the reasons it carries — one shape for all three states. */
    const state = (tone, label, lines) => (
        <div className="ui-stack-sm">
            <span className={`ui-pill ui-pill--${tone}`}>{label}</span>
            <div className="ui-help">
                {lines.filter(Boolean).map((line, i) => <div key={i}>{line}</div>)}
            </div>
        </div>
    );

    if (adj?.status === 'Excluded') {
        const pos = Number(adj.originalInclusiveVat ?? 0);
        return state('dang', t('line.excluded'), [
            t('line.excludedHint'),
            t('line.posOriginal', { amount: fmt(pos) }),
            adj.adjustedByName && t('line.adjustedBy', { name: adj.adjustedByName }),
        ]);
    }
    if (adj?.status === 'Adjusted') {
        const pos = Number(adj.originalInclusiveVat ?? 0);
        const now = Number(adj.adjustedInclusiveVat ?? 0);
        const when = adj.adjustedAt
            ? new Date(adj.adjustedAt).toLocaleString(isAr ? 'ar-SA' : undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
            })
            : '';
        return state('warn', t('line.adjusted'), [
            t('line.posToBill', { pos: fmt(pos), now: fmt(now) }),
            t('line.posOriginal', { amount: fmt(pos) }),
            t('line.nowOnBill', { amount: fmt(now) }),
            t('line.posProof'),
            when,
            adj.adjustedByName && t('line.adjustedBy', { name: adj.adjustedByName }),
        ]);
    }
    if (String(rowType || '') === 'Invoice') {
        return state('neutral', t('line.onBill'), [t('line.posUnchanged')]);
    }
    return '—';
}

/** Calendar YYYY-MM-DD only — never local→UTC (that shifts the day, e.g. Jul 1 KSA → Jun 30). */
function billingPeriodDateParam(dateStr) {
    const s = String(dateStr || '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

function billStatusLabel(status, t, owner) {
    if (status === 'paid') return t('status.paid');
    if (status === 'partially_paid') return t('status.partiallyPaid');
    if (status === 'overpaid') return t('status.overPaid');
    if (status === 'awaiting_approval') return t('status.awaiting');
    if (status === 'pending_deletion') return t('status.pendingDeletion');
    if (status === 'rejected') return t('status.rejected');
    if (owner === 'hq' && (status === 'pending' || !status)) return t('status.assignedHq');
    return t('status.generated');
}

function billOwnerLabel(owner, t) {
    return owner === 'workshop' ? t('owner.workshop') : t('owner.hq');
}

function billStatusBadgeClass(status) {
    if (status === 'paid') return 'ui-pill ui-pill--ok';
    if (status === 'overpaid') return 'ui-pill ui-pill--info';
    if (status === 'rejected') return 'ui-pill ui-pill--dang';
    if (status === 'partially_paid'
        || status === 'awaiting_approval'
        || status === 'pending_deletion') return 'ui-pill ui-pill--warn';
    return 'ui-pill ui-pill--neutral';
}

function BilingualTh({ primaryKey, secondaryKey, t, className }) {
    return (
        <th className={className}>
            {t(primaryKey)}
            <span className="ui-th-sub">{t(secondaryKey)}</span>
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
    idBase = 'billing-range',
    applying = false,
}) {
    return (
        <div className="ui-row ui-row--fields" role="group" aria-label={t('label.dateRange')}>
            <div className="ui-field">
                <label htmlFor={`${idBase}-from`}>{t('label.from')}</label>
                <input
                    id={`${idBase}-from`}
                    type="date"
                    className="ui-input"
                    value={dateFrom || ''}
                    max={dateTo || undefined}
                    onChange={(e) => onFrom(e.target.value)}
                />
            </div>
            <div className="ui-field">
                <label htmlFor={`${idBase}-to`}>{t('label.to')}</label>
                <input
                    id={`${idBase}-to`}
                    type="date"
                    className="ui-input"
                    value={dateTo || ''}
                    min={dateFrom || undefined}
                    onChange={(e) => onTo(e.target.value)}
                />
            </div>
            {onApply ? (
                <button
                    type="button"
                    className="ui-btn ui-btn--primary"
                    onClick={onApply}
                    disabled={applying || !dateFrom || !dateTo}
                >
                    {t('btn.apply')}
                </button>
            ) : null}
            {(dateFrom || dateTo) ? (
                <button
                    type="button"
                    className="ui-btn ui-btn--default"
                    onClick={onClear}
                >
                    {t('btn.clearDates')}
                </button>
            ) : null}
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
    const debouncedSearch = useDebouncedValue(search, 350);
    const customersRequestRef = useRef(null);
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
    const [selectedBillIds, setSelectedBillIds] = useState(() => new Set());
    const [deletingBills, setDeletingBills] = useState(false);
    const [billDetail, setBillDetail] = useState(null);
    const [billDetailLoading, setBillDetailLoading] = useState(false);
    const [billPdfExporting, setBillPdfExporting] = useState(false);
    const [markPaidOpen, setMarkPaidOpen] = useState(false);
    const [billSnapshotView, setBillSnapshotView] = useState('adjusted');
    const [remitOpen, setRemitOpen] = useState(false);
    const [remitPreview, setRemitPreview] = useState(null);
    const [remitting, setRemitting] = useState(false);
    const [remitForm, setRemitForm] = useState({
        amount: '',
        date: todayISO(),
        hqCashBankAccountId: '',
        workshopCashBankAccountId: '',
    });

    const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
    const [invoiceModalData, setInvoiceModalData] = useState(null);
    const [invoiceLoadingId, setInvoiceLoadingId] = useState('');

    const [transferRow, setTransferRow] = useState(null);
    const [transferring, setTransferring] = useState(false);

    const loadCustomers = useCallback(async (range) => {
        const from = range?.dateFrom !== undefined ? range.dateFrom : dateFrom;
        const to = range?.dateTo !== undefined ? range.dateTo : dateTo;
        const q = range?.q !== undefined ? range.q : debouncedSearch;
        customersRequestRef.current?.abort();
        if (from && to && from > to) {
            setCustomers([]);
            setListSummary(null);
            setCustomersError(t('err.dateOrder'));
            setCustomersLoading(false);
            return;
        }
        const controller = new AbortController();
        customersRequestRef.current = controller;
        setCustomersLoading(true);
        setCustomersError('');
        persistDates(from, to);
        try {
            const res = await listCorporateArCustomers(
                {
                    q: q.trim() || undefined,
                    dateFrom: from || undefined,
                    dateTo: to || undefined,
                },
                { signal: controller.signal },
            );
            if (controller.signal.aborted) return;
            setCustomers(res?.customers ?? []);
            setListSummary(res?.summary ?? null);
        } catch (e) {
            if (controller.signal.aborted) return;
            setCustomers([]);
            setListSummary(null);
            setCustomersError(e?.message || t('err.loadCustomers'));
        } finally {
            if (!controller.signal.aborted) setCustomersLoading(false);
        }
    }, [debouncedSearch, dateFrom, dateTo, persistDates, t]);

    useEffect(() => () => customersRequestRef.current?.abort(), []);

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

    const workshopId = ledger?.corporateAccount?.workshopId;

    const loadRemitPreview = useCallback(async () => {
        if (!workshopId || !selectedAccountId) {
            setRemitPreview(null);
            return;
        }
        try {
            const res = await previewCorporateHqRemittance(workshopId, {
                corporateAccountId: selectedAccountId,
            });
            setRemitPreview(res);
            setRemitForm((prev) => ({
                ...prev,
                amount: prev.amount || String(res?.collectedNotRemitted ?? ''),
                hqCashBankAccountId: prev.hqCashBankAccountId || res?.hqCashBanks?.[0]?.id || '',
                workshopCashBankAccountId:
                    prev.workshopCashBankAccountId || res?.workshopCashBanks?.[0]?.id || '',
            }));
        } catch {
            setRemitPreview(null);
        }
    }, [workshopId, selectedAccountId]);

    const loadGeneratedBills = useCallback(async () => {
        if (!selectedAccountId) return;
        setBillsLoading(true);
        try {
            const res = await listCorporateGeneratedBills(selectedAccountId);
            setGeneratedBills(res?.bills ?? []);
            setSelectedBillIds(new Set());
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
        setBillSnapshotView('adjusted');
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

    useEffect(() => {
        if (selectedAccountId && workshopId) void loadRemitPreview();
    }, [selectedAccountId, workshopId, loadRemitPreview, generatedBills.length]);

    const handleRemit = async () => {
        if (!workshopId || remitting) return;
        setRemitting(true);
        setError('');
        try {
            const res = await postCorporateHqRemittance(workshopId, {
                hqCashBankAccountId: remitForm.hqCashBankAccountId,
                workshopCashBankAccountId: remitForm.workshopCashBankAccountId,
                amount: remitForm.amount,
                date: remitForm.date,
                corporateAccountId: selectedAccountId,
            });
            setRemitOpen(false);
            await loadRemitPreview();
            await loadGeneratedBills();
            alert(t('alert.remitted', { amount: fmt(res?.remitted ?? remitForm.amount) }));
        } catch (e) {
            setError(e?.message || t('err.remit'));
        } finally {
            setRemitting(false);
        }
    };

    const selectedCustomer = useMemo(
        () => customers.find((c) => c.corporateAccountId === selectedAccountId) ?? null,
        [customers, selectedAccountId],
    );

    const allLedgerLinesRaw = ledger?.lines ?? [];
    const ledgerDisplay = useMemo(
        () => applyPostDiscountVatToLedgerStatement(ledger),
        [ledger],
    );
    const allLedgerLines = ledgerDisplay?.lines ?? allLedgerLinesRaw;

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
            ...platformSellerHeaderFields(ledger.corporateAccount),
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

    const exportCustomersTable = useCallback((kind) => {
        if (!customers.length) return;
        const dueLabel = dateFrom && dateTo ? t('th.periodDue') : t('th.dueBalance');
        const headers = [
            t('th.company'),
            t('th.vat'),
            t('th.contact'),
            t('th.mobile'),
            t('th.workshop'),
            dueLabel,
        ];
        const rows = customers.map((c) => [
            c.companyName || '',
            c.vatNumber || '',
            c.contactPerson || '',
            c.mobile || '',
            c.workshopName || '',
            Number(c.dueBalance ?? 0).toFixed(2),
        ]);
        const periodBit =
            dateFrom && dateTo
                ? t('label.period', { from: dateFrom, to: dateTo })
                : '';
        const subtitle = [
            t('export.rows', { n: rows.length }),
            periodBit,
            listSummary?.totalDue != null
                ? t('money.sar', { amount: fmt(listSummary.totalDue) })
                : '',
        ]
            .filter(Boolean)
            .join(' · ');
        if (kind === 'pdf') {
            exportRowsToPdf({
                title: t('export.listTitle'),
                subtitle,
                headers,
                rows,
                filenameBase: 'corporate-billing-customers',
            });
        } else {
            exportRowsToExcel({
                sheetName: t('export.listSheet'),
                headers,
                rows,
                filenameBase: 'corporate-billing-customers',
            });
        }
    }, [customers, dateFrom, dateTo, listSummary, t]);

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

    const handleTransferInvoice = async ({ toCorporateAccountId, reason, toCompanyName }) => {
        if (!transferRow?.invoiceId || !toCorporateAccountId) return;
        setTransferring(true);
        setError('');
        try {
            const res = await transferCorporateInvoice({
                invoiceId: transferRow.invoiceId,
                toCorporateAccountId,
                reason,
            });
            const no = res?.transfer?.invoiceNo || transferRow.invoiceNo || '';
            const company = res?.transfer?.toCompanyName || toCompanyName || '';
            setTransferRow(null);
            await loadLedger();
            await loadCustomers();
            alert(t('alert.transferred', { no, company }));
        } catch (e) {
            setError(e?.message || t('err.transfer'));
        } finally {
            setTransferring(false);
        }
    };

    const handleGenerateBill = async (opts = {}) => {
        const lineOverrides = Array.isArray(opts?.lineOverrides)
            ? opts.lineOverrides
            : Array.isArray(opts)
              ? opts
              : [];
        const excludeInvoiceIds = Array.isArray(opts?.excludeInvoiceIds)
            ? opts.excludeInvoiceIds
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
                startDate: billingPeriodDateParam(dateFrom),
                endDate: billingPeriodDateParam(dateTo),
                dueDate: generateDueDate.trim(),
                lineOverrides,
                excludeInvoiceIds,
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

    const handleExportBillPdf = async (kind = 'adjusted') => {
        if (!billDetail) return;
        const original =
            billDetail.original && typeof billDetail.original === 'object'
                ? billDetail.original
                : null;
        const useOriginal = kind === 'original' && original;
        setBillPdfExporting(true);
        try {
            await exportCorporateGeneratedBillPdf({
                bill: {
                    ...billDetail,
                    ...(useOriginal && original.kpis ? { kpis: original.kpis } : {}),
                },
                statement: {
                    ...(useOriginal
                        ? { ...(billDetail.statement || {}), ...(original || {}), kpis: original.kpis || billDetail.statement?.kpis }
                        : (billDetail.statement || {})),
                    corporateAccount: {
                        ...(billDetail.statement?.corporateAccount || {}),
                        vatNumber:
                            billDetail.statement?.corporateAccount?.vatNumber ||
                            billDetail.ledgerStatement?.corporateAccount?.vatNumber ||
                            selectedCustomer?.vatNumber ||
                            '',
                        taxId:
                            billDetail.statement?.corporateAccount?.taxId ||
                            selectedCustomer?.vatNumber ||
                            '',
                    },
                },
                ledgerStatement: useOriginal
                    ? (original.ledgerStatement ?? billDetail.ledgerStatement)
                    : billDetail.ledgerStatement,
                snapshotKind: useOriginal ? 'original' : 'adjusted',
                // CORPORATE-FIX-02 F: workshop identity for workshop self-billed bills.
                workshop: {
                    name: billDetail.statement?.corporateAccount?.workshopName || '',
                    taxId: billDetail.statement?.corporateAccount?.workshopTaxId || '',
                },
            });
        } catch (e) {
            console.error(e);
            setError(e?.message || t('err.billPdf'));
        } finally {
            setBillPdfExporting(false);
        }
    };

    const confirmDeleteMessage = (bills) => {
        const list = Array.isArray(bills) ? bills : [];
        if (list.length === 1) {
            const b = list[0];
            const paidNote =
                b?.status === 'paid' ? `\n\n${t('confirm.deletePaidNote')}` : '';
            return `${t('confirm.deleteBill', { no: b.billNo || b.id })}${paidNote}`;
        }
        const paidCount = list.filter((b) => b.status === 'paid').length;
        const paidNote =
            paidCount > 0 ? `\n\n${t('confirm.deletePaidBulkNote', { n: paidCount })}` : '';
        return `${t('confirm.deleteBills', { n: list.length })}${paidNote}`;
    };

    const handleDeleteBills = async (ids) => {
        const idList = [...new Set((ids || []).map((id) => String(id)).filter(Boolean))];
        if (!idList.length) return;
        const targets = generatedBills.filter((b) => idList.includes(String(b.id)));
        if (!window.confirm(confirmDeleteMessage(targets.length ? targets : idList.map((id) => ({ id }))))) {
            return;
        }
        setDeletingBills(true);
        setError('');
        try {
            if (idList.length === 1) {
                await deleteCorporateGeneratedBill(idList[0]);
            } else {
                await deleteCorporateGeneratedBills({
                    billIds: idList,
                    corporateAccountId: selectedAccountId,
                });
            }
            if (idList.includes(String(selectedBillId))) {
                setSelectedBillId('');
                setBillDetail(null);
            }
            setSelectedBillIds((prev) => {
                const next = new Set(prev);
                idList.forEach((id) => next.delete(String(id)));
                return next;
            });
            await loadGeneratedBills();
            alert(
                idList.length === 1
                    ? t('alert.deletedBill', { no: targets[0]?.billNo || idList[0] })
                    : t('alert.deletedBills', { n: idList.length }),
            );
        } catch (e) {
            setError(e?.message || t('err.deleteBill'));
        } finally {
            setDeletingBills(false);
        }
    };

    const toggleBillSelect = (billId, e) => {
        e?.stopPropagation?.();
        const id = String(billId);
        setSelectedBillIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const originalBill = billDetail?.original && typeof billDetail.original === 'object'
        ? billDetail.original
        : null;
    const showOriginalBill = billSnapshotView === 'original' && originalBill;
    const billLedger = showOriginalBill
        ? (originalBill.ledgerStatement ?? billDetail?.ledgerStatement)
        : billDetail?.ledgerStatement;
    const billLedgerLines = billLedger?.lines ?? [];
    const billSum = billLedger?.summary ?? billDetail?.kpis ?? {};
    /** Frozen collection due — never follows Original/Adjusted table view. */
    const collectionDueBalance = Number(
        billDetail?.kpis?.balance ?? billDetail?.balance ?? 0,
    );
    const posOriginalDue = Number(
        billDetail?.posOriginalDue ??
            originalBill?.kpis?.balance ??
            billDetail?.originalKpis?.balance ??
            NaN,
    );

    const accountsPaging = usePagedRows(customers, { resetKey: search });
    const billsPaging = usePagedRows(generatedBills, { resetKey: selectedAccountId });
    const statementPaging = usePagedRows(filteredLines, {
        resetKey: `${selectedAccountId}|${ledgerFilter}|${dateFrom}|${dateTo}`,
    });
    const billLinesPaging = usePagedRows(billLedgerLines, {
        resetKey: `${selectedBillId}|${billSnapshotView}`,
    });

    const pageBillIds = () => billsPaging.pagedRows.map((b) => String(b.id));

    const allBillsSelected =
        billsPaging.pagedRows.length > 0 &&
        pageBillIds().every((id) => selectedBillIds.has(id));

    const toggleSelectAllBills = (e) => {
        e?.stopPropagation?.();
        const ids = pageBillIds();
        setSelectedBillIds((prev) => {
            const next = new Set(prev);
            if (allBillsSelected) ids.forEach((id) => next.delete(id));
            else ids.forEach((id) => next.add(id));
            return next;
        });
    };

    /** The `ar` pack already swaps these two, so the key order never changes. */
    const thPair = (primaryKey, secondaryKey) => ({ primaryKey, secondaryKey });

    if (!selectedAccountId) {
        return (
            <div className="ui-root ui-root--flush ui-stack">
                <div className="ui-row ui-row--fields">
                    <BillingDateRange
                        dateFrom={dateFrom}
                        dateTo={dateTo}
                        onFrom={onDateFrom}
                        onTo={onDateTo}
                        onClear={clearDates}
                        onApply={applyDateRange}
                        applying={customersLoading}
                        idBase="cb-list-range"
                        t={t}
                    />
                    <div className="ui-toolbar-end">
                        <button
                            type="button"
                            className="ui-btn ui-btn--default"
                            onClick={() => exportCustomersTable('pdf')}
                            disabled={customersLoading || customers.length === 0}
                        >
                            <FileText size={14} /> {t('btn.downloadPdf')}
                        </button>
                        <button
                            type="button"
                            className="ui-btn ui-btn--default"
                            onClick={() => exportCustomersTable('excel')}
                            disabled={customersLoading || customers.length === 0}
                        >
                            <FileSpreadsheet size={14} /> {t('btn.downloadExcel')}
                        </button>
                        <button
                            type="button"
                            className="ui-btn ui-btn--default"
                            onClick={() => loadCustomers()}
                            disabled={customersLoading}
                        >
                            <RefreshCw size={14} className={customersLoading ? 'ui-spin' : undefined} />
                            {' '}{t('btn.refresh')}
                        </button>
                    </div>
                </div>

                {listSummary ? (
                    <div className="ui-kpis">
                        <div className="ui-metric">
                            <span className="ui-metric-icon"><Building2 size={62} strokeWidth={1.1} /></span>
                            <div className="ui-metric-label">{t('stat.customers')}</div>
                            <div className="ui-metric-value">{listSummary.count}</div>
                        </div>
                        <div className="ui-metric">
                            <span className="ui-metric-icon"><Users size={62} strokeWidth={1.1} /></span>
                            <div className="ui-metric-label">
                                {dateFrom && dateTo ? t('stat.periodDue') : t('stat.totalDue')}
                            </div>
                            <div className="ui-metric-value">
                                {t('money.sar', { amount: fmt(listSummary.totalDue) })}
                            </div>
                            {(listSummary.dateFrom && listSummary.dateTo) || (dateFrom && dateTo) ? (
                                <div className="ui-metric-foot">
                                    {t('label.period', {
                                        from: listSummary.dateFrom || dateFrom,
                                        to: listSummary.dateTo || dateTo,
                                    })}
                                </div>
                            ) : null}
                        </div>
                    </div>
                ) : null}

                {customersError ? (
                    <div className="ui-banner ui-banner--dang" role="alert">{customersError}</div>
                ) : null}

                <div className="ui-table-wrap">
                    <div className="ui-toolbar">
                        <div className="ui-search">
                            <Search size={14} />
                            <input
                                type="text"
                                className="ui-input"
                                placeholder={t('search.placeholder')}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && loadCustomers({ q: search })}
                            />
                        </div>
                    </div>

                    {!customersLoading && customers.length === 0 ? (
                        <div className="ui-empty">
                            <div className="ui-empty-icon"><Building2 size={18} /></div>
                            <div className="ui-empty-title">{t('empty.accounts')}</div>
                            <div className="ui-empty-sub">
                                {search.trim() ? t('empty.accountsSearch') : t('empty.accountsHint')}
                            </div>
                        </div>
                    ) : (
                        <table className="ui-table ui-table--pick">
                            <thead>
                                <tr>
                                    <th>{t('th.company')}</th>
                                    <th>{t('th.vat')}</th>
                                    <th>{t('th.contact')}</th>
                                    <th>{t('th.workshop')}</th>
                                    <th className="ui-num">
                                        {dateFrom && dateTo ? t('th.periodDue') : t('th.dueBalance')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {customersLoading ? (
                                    Array.from({ length: 6 }).map((_, i) => (
                                        <tr key={`sk-${i}`} className="ui-sk-row">
                                            <td><div className="ui-sk ui-sk--strong ui-sk--w70" /></td>
                                            <td><div className="ui-sk ui-sk--text ui-sk--w55" /></td>
                                            <td><div className="ui-sk ui-sk--text ui-sk--w70" /></td>
                                            <td><div className="ui-sk ui-sk--text ui-sk--w90" /></td>
                                            <td><div className="ui-sk ui-sk--text ui-sk--w40" style={{ marginInlineStart: 'auto' }} /></td>
                                        </tr>
                                    ))
                                ) : accountsPaging.pagedRows.map((c) => (
                                    <tr
                                        key={c.corporateAccountId}
                                        onClick={() => openAccount(c.corporateAccountId)}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                openAccount(c.corporateAccountId);
                                            }
                                        }}
                                    >
                                        <td data-label={t('th.company')} className="ui-strong">{c.companyName}</td>
                                        <td data-label={t('th.vat')} className="ui-mono">{c.vatNumber || '—'}</td>
                                        <td data-label={t('th.contact')}>
                                            <div>{c.contactPerson || '—'}</div>
                                            {c.mobile ? <div className="ui-meta">{c.mobile}</div> : null}
                                        </td>
                                        <td data-label={t('th.workshop')}>{c.workshopName}</td>
                                        <td
                                            data-label={dateFrom && dateTo ? t('th.periodDue') : t('th.dueBalance')}
                                            className="ui-num ui-money"
                                        >
                                            {t('money.sar', { amount: fmt(c.dueBalance) })}
                                            {dateFrom
                                            && dateTo
                                            && Number(c.dueBalance ?? 0) <= 0.005
                                            && c.hasPeriodActivity ? (
                                                <div className="ui-meta">{t('label.periodPaid')}</div>
                                            ) : null}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                    <UiPager {...accountsPaging.pagerProps} />
                </div>
            </div>
        );
    }

    const corp = ledgerDisplay?.corporateAccount ?? ledger?.corporateAccount;
    const sum = ledgerDisplay?.summary ?? ledger?.summary ?? {};
    const displayName = corp?.companyName || selectedCustomer?.companyName || t('fallback.title');

    if (transferRow) {
        return (
            <CorporateTransferInvoiceModal
                open
                onClose={() => !transferring && setTransferRow(null)}
                t={t}
                invoiceNo={transferRow.invoiceNo}
                fromCompanyName={displayName}
                fromCorporateAccountId={selectedAccountId}
                submitting={transferring}
                submitError={error}
                onConfirm={handleTransferInvoice}
            />
        );
    }

    if (generateOpen) {
        return (
            <CorporateGenerateBillPage
                onClose={() => {
                    if (generating) return;
                    setError('');
                    setGenerateOpen(false);
                }}
                t={t}
                isAr={isAr}
                submitError={error}
                companyName={displayName}
                dateFrom={dateFrom}
                dateTo={dateTo}
                dueDate={generateDueDate}
                onDueDateChange={setGenerateDueDate}
                ledger={ledgerDisplay ?? ledger}
                generating={generating}
                onGenerate={handleGenerateBill}
                distributionCorporateAccountId={selectedAccountId}
            />
        );
    }

    if (remitOpen) {
        return (
            <div className="ui-card" data-testid="cb-remit-dialog" style={{ padding: 16, maxWidth: 520 }}>
                <h2 className="ui-card-title">{t('modal.remitTitle')}</h2>
                <p className="ui-help">{t('ic.collectedNotRemitted')}: {fmt(remitPreview?.collectedNotRemitted)}</p>
                <label className="ui-field">
                    <span>{t('modal.remitAmount')}</span>
                    <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={remitForm.amount}
                        onChange={(e) => setRemitForm((p) => ({ ...p, amount: e.target.value }))}
                    />
                </label>
                <label className="ui-field">
                    <span>{t('modal.remitDate')}</span>
                    <input
                        type="date"
                        value={remitForm.date}
                        onChange={(e) => setRemitForm((p) => ({ ...p, date: e.target.value }))}
                    />
                </label>
                <label className="ui-field">
                    <span>{t('modal.remitHqBank')}</span>
                    <select
                        value={remitForm.hqCashBankAccountId}
                        onChange={(e) => setRemitForm((p) => ({ ...p, hqCashBankAccountId: e.target.value }))}
                    >
                        {(remitPreview?.hqCashBanks || []).map((b) => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                </label>
                <label className="ui-field">
                    <span>{t('modal.remitWsBank')}</span>
                    <select
                        value={remitForm.workshopCashBankAccountId}
                        onChange={(e) => setRemitForm((p) => ({ ...p, workshopCashBankAccountId: e.target.value }))}
                    >
                        {(remitPreview?.workshopCashBanks || []).map((b) => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                </label>
                {error ? <p className="ui-help" style={{ color: '#B91C1C' }}>{error}</p> : null}
                <div className="ui-row" style={{ marginTop: 12, gap: 8 }}>
                    <button type="button" className="ui-btn ui-btn--default" disabled={remitting} onClick={() => setRemitOpen(false)}>
                        {t('btn.cancel')}
                    </button>
                    <button type="button" className="ui-btn ui-btn--primary" disabled={remitting} onClick={handleRemit}>
                        {remitting ? t('btn.remitting') : t('btn.remit')}
                    </button>
                </div>
            </div>
        );
    }

    if (markPaidOpen && billDetail) {
        return (
            <CorporateMarkBillPaidModal
                open={markPaidOpen}
                onClose={() => setMarkPaidOpen(false)}
                t={t}
                billId={billDetail.id || selectedBillId}
                billNo={billDetail.billNo}
                balanceDue={collectionDueBalance}
                onPaid={async () => {
                    setMarkPaidOpen(false);
                    await loadGeneratedBills();
                    const id = billDetail.id || selectedBillId;
                    if (id) await openBillDetail(id);
                    alert(t('alert.markedPaid', { no: billDetail.billNo }));
                }}
            />
        );
    }

    if (invoiceModalOpen && invoiceModalData) {
        const invoiceTitle = invoiceModalData.invoiceNo
            ? `${t('th.invNo')} ${invoiceModalData.invoiceNo}`
            : t('th.invNo');
        return (
            <AdminScreenShell
                title={invoiceTitle}
                onBack={() => {
                    setInvoiceModalOpen(false);
                    setInvoiceModalData(null);
                }}
                wide
                footer={
                    <button type="button" className="ui-btn ui-btn--default" onClick={() => window.print()}>
                        <Printer size={14} /> {t('btn.print')}
                    </button>
                }
            >
                <CashierTaxInvoiceView invoice={invoiceModalData} />
            </AdminScreenShell>
        );
    }

    const billKpis = [
        ['kpi.opening', billSum.openingBalance],
        ['kpi.invoices', billSum.totalInvoiceAmount],
        ['kpi.receipts', billSum.totalReceipts],
        ['kpi.discounts', billSum.totalDiscounts],
        ['kpi.returns', billSum.totalSalesReturns],
        ['kpi.closing', billSum.closingBalance],
    ];

    return (
        <div className="ui-root ui-root--flush ui-stack">
            <div>
                <button type="button" className="ui-btn ui-btn--subtle ui-btn--sm" onClick={backToList}>
                    <ArrowLeft size={14} /> {t('btn.back')}
                </button>
            </div>

            <div className="ui-head" style={{ marginBottom: 0 }}>
                <h1>{displayName}</h1>
                <p>
                    {t('label.vat', {
                        vat: corp?.vatNumber || selectedCustomer?.vatNumber || '—',
                        workshop: corp?.workshopName || selectedCustomer?.workshopName || '—',
                    })}
                </p>
            </div>

            <div className="ui-row ui-row--fields">
                <BillingDateRange
                    dateFrom={dateFrom}
                    dateTo={dateTo}
                    onFrom={onDateFrom}
                    onTo={onDateTo}
                    onClear={clearDates}
                    onApply={loadLedger}
                    applying={ledgerLoading}
                    idBase="cb-detail-range"
                    t={t}
                />
                <div className="ui-toolbar-end">
                    <button
                        type="button"
                        className="ui-btn ui-btn--primary"
                        disabled={!dateFrom || !dateTo || ledgerLoading || !ledger}
                        onClick={() => {
                            setError('');
                            setGenerateDueDate(dueDate || dateTo || '');
                            setGenerateOpen(true);
                        }}
                    >
                        <FileText size={14} /> {t('btn.generateBill')}
                    </button>
                    {viewMode === 'statement' ? (
                        <>
                            <button
                                type="button"
                                className="ui-btn ui-btn--default"
                                disabled={!ledger || ledgerLoading || pdfExporting}
                                onClick={handleExportPdf}
                            >
                                <FileText size={14} />
                                {' '}{pdfExporting ? t('btn.generating') : t('btn.downloadPdf')}
                            </button>
                            <button
                                type="button"
                                className="ui-btn ui-btn--default"
                                disabled={!ledger || ledgerLoading}
                                onClick={() =>
                                    exportCorporateArLedgerExcel({
                                        header: exportHeader,
                                        summary: sum,
                                        lines: allLedgerLines,
                                    })
                                }
                            >
                                <FileSpreadsheet size={14} /> {t('btn.downloadExcel')}
                            </button>
                        </>
                    ) : null}
                </div>
            </div>

            {/* One switch between the two views. "Generated Bills" used to sit
                here *and* in the action bar above, side by side. */}
            <div className="ui-tabs" role="tablist">
                <button
                    type="button"
                    role="tab"
                    aria-selected={viewMode === 'statement'}
                    className="ui-tab"
                    onClick={() => setViewMode('statement')}
                >
                    {t('btn.statement')}
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={viewMode === 'generated-bills'}
                    className="ui-tab"
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
                <div className="ui-banner ui-banner--dang" role="alert">
                    {ledgerError || error}
                </div>
            )}

            {dueDate && viewMode === 'statement' && (
                <div className="ui-banner ui-banner--info">
                    {t('label.dueBanner')} <strong>{dueDate}</strong>
                </div>
            )}

            {viewMode === 'generated-bills' ? (
                <>
                    <div className="ui-banner ui-banner--info" data-testid="cb-intercompany" style={{ marginBottom: 12 }}>
                        <strong>{t('ic.title')}</strong>
                        <div className="ui-help">
                            {t('ic.assignedOpen')}: {fmt(remitPreview?.assignedOpen)} · {t('ic.collectedNotRemitted')}: {fmt(remitPreview?.collectedNotRemitted)} · {t('ic.remitted')}: {fmt(remitPreview?.remitted)}
                        </div>
                    </div>
                    <div className="ui-table-wrap">
                        {/* The bulk bar only exists once something is selected — it used
                            to render an empty flex row above every bills table. */}
                        {selectedBillIds.size > 0 ? (
                            <div className="ui-toolbar">
                                <span>{t('btn.removeSelectedBills', { n: selectedBillIds.size })}</span>
                                <div className="ui-toolbar-end">
                                    <button
                                        type="button"
                                        className="ui-btn ui-btn--danger ui-btn--sm"
                                        disabled={deletingBills}
                                        onClick={() => handleDeleteBills([...selectedBillIds])}
                                    >
                                        <Trash2 size={14} />
                                        {' '}{deletingBills ? t('btn.deleting') : t('btn.removeBill')}
                                    </button>
                                </div>
                            </div>
                        ) : null}

                        {!billsLoading && generatedBills.length === 0 ? (
                            <div className="ui-empty">
                                <div className="ui-empty-icon"><FileText size={18} /></div>
                                <div className="ui-empty-title">{t('empty.bills')}</div>
                                <div className="ui-empty-sub">{t('empty.billsHint')}</div>
                            </div>
                        ) : (
                            <table className="ui-table ui-table--pick">
                                <thead>
                                    <tr>
                                        <th style={{ width: 36 }}>
                                            <input
                                                type="checkbox"
                                                checked={allBillsSelected}
                                                onChange={toggleSelectAllBills}
                                                aria-label={t('btn.selectAllBills')}
                                                disabled={!generatedBills.length || deletingBills}
                                            />
                                        </th>
                                        <th>{t('th.billNo')}</th>
                                        <th>{t('th.period')}</th>
                                        <th>{t('th.dueDate')}</th>
                                        <th>{t('th.status')}</th>
                                        <th className="ui-num">{t('th.dueBalance')}</th>
                                        <th>{t('th.created')}</th>
                                        <th aria-label={t('th.actions')} />
                                    </tr>
                                </thead>
                                <tbody>
                                    {billsLoading ? (
                                        Array.from({ length: 5 }).map((_, i) => (
                                            <tr key={`sk-${i}`} className="ui-sk-row">
                                                <td><div className="ui-sk ui-sk--text ui-sk--w25" /></td>
                                                <td><div className="ui-sk ui-sk--strong ui-sk--w70" /></td>
                                                <td><div className="ui-sk ui-sk--text ui-sk--w90" /></td>
                                                <td><div className="ui-sk ui-sk--text ui-sk--w55" /></td>
                                                <td><div className="ui-sk ui-sk--pill" /></td>
                                                <td><div className="ui-sk ui-sk--text ui-sk--w40" style={{ marginInlineStart: 'auto' }} /></td>
                                                <td><div className="ui-sk ui-sk--text ui-sk--w70" /></td>
                                                <td><div className="ui-sk ui-sk--btn" /></td>
                                            </tr>
                                        ))
                                    ) : billsPaging.pagedRows.map((b) => (
                                        <tr
                                            key={b.id}
                                            aria-selected={selectedBillId === b.id}
                                            onClick={() => openBillDetail(b.id)}
                                        >
                                            <td onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedBillIds.has(String(b.id))}
                                                    onChange={(e) => toggleBillSelect(b.id, e)}
                                                    aria-label={t('btn.selectBill', { no: b.billNo })}
                                                    disabled={deletingBills}
                                                />
                                            </td>
                                            <td data-label={t('th.billNo')} className="ui-strong">
                                                {b.billNo}
                                                {b.hasManualEdits ? (
                                                    <span className="ui-pill ui-pill--warn" style={{ marginInlineStart: 8 }}>
                                                        {t('bill.adjustedBadge')}
                                                    </span>
                                                ) : null}
                                            </td>
                                            <td data-label={t('th.period')} className="ui-nowrap">
                                                {b.periodStartDate} — {b.periodEndDate}
                                            </td>
                                            <td data-label={t('th.dueDate')} className="ui-nowrap">{b.dueDate}</td>
                                            <td data-label={t('th.status')}>
                                                <span className={billStatusBadgeClass(b.status)}>
                                                    {billStatusLabel(b.status, t, b.collectionOwner)}
                                                </span>
                                                <span className="ui-pill ui-pill--neutral" data-testid="cb-owner-chip" style={{ marginInlineStart: 6 }}>
                                                    {billOwnerLabel(b.collectionOwner, t)}
                                                </span>
                                            </td>
                                            <td data-label={t('th.dueBalance')} className="ui-num ui-money">
                                                {t('money.sar', { amount: fmt(b.kpis?.balance) })}
                                                {b.hasManualEdits
                                                && b.originalKpis?.balance != null
                                                && Math.abs(Number(b.originalKpis.balance) - Number(b.kpis?.balance ?? 0)) > 0.005 ? (
                                                    <div className="ui-meta">
                                                        {t('bill.posDue', { amount: fmt(b.originalKpis.balance) })}
                                                    </div>
                                                ) : null}
                                            </td>
                                            <td data-label={t('th.created')} className="ui-nowrap">
                                                {b.createdAt
                                                    ? new Date(b.createdAt).toLocaleString(isAr ? 'ar-SA' : undefined)
                                                    : '—'}
                                            </td>
                                            <td onClick={(e) => e.stopPropagation()}>
                                                {b.status === 'pending_deletion' ? (
                                                    <span className="ui-help">{t('status.pendingDeletion')}</span>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        className="ui-btn ui-btn--icon ui-btn--danger ui-btn--sm"
                                                        disabled={deletingBills}
                                                        title={t('btn.removeBill')}
                                                        aria-label={t('btn.removeBill')}
                                                        onClick={() => handleDeleteBills([b.id])}
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                        <UiPager {...billsPaging.pagerProps} />
                    </div>

                    {selectedBillId && (
                        <div className="ui-stack">
                            {billDetailLoading ? (
                                <div className="ui-stack" aria-label={t('loading.bill')} aria-busy="true">
                                    <div className="ui-sk ui-sk--title ui-sk--w25" />
                                    <div className="ui-kpis">
                                        {Array.from({ length: 6 }).map((_, i) => (
                                            <div key={`sk-${i}`} className="ui-metric ui-sk-row">
                                                <div className="ui-sk ui-sk--label ui-sk--w70" />
                                                <div className="ui-sk ui-sk--title ui-sk--w55" style={{ marginTop: 7 }} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : billDetail ? (
                                <>
                                    <div className="ui-row">
                                        <h2 className="ui-card-title">{billDetail.billNo}</h2>
                                        <span className={billStatusBadgeClass(billDetail.status)}>
                                            {billStatusLabel(billDetail.status, t, billDetail.collectionOwner)}
                                        </span>
                                        <span className="ui-pill ui-pill--neutral" data-testid="cb-owner-chip" style={{ marginInlineStart: 6 }}>
                                            {billOwnerLabel(billDetail.collectionOwner, t)}
                                        </span>
                                        {billDetail.hasManualEdits ? (
                                            <span className="ui-pill ui-pill--warn">{t('bill.adjustedBadge')}</span>
                                        ) : (
                                            <span className="ui-pill ui-pill--ok">{t('bill.matchesPosBadge')}</span>
                                        )}
                                        <span className="ui-help">
                                            {t('label.due')} <strong>{billDetail.dueDate}</strong>
                                        </span>
                                    </div>

                                    {/* Original vs adjusted is a view of the same bill, so it
                                        switches like one rather than reading as two actions. */}
                                    <div className="ui-row">
                                        <div className="ui-chips">
                                            <button
                                                type="button"
                                                className={`ui-chip${billSnapshotView === 'adjusted' ? ' ui-chip--on' : ''}`}
                                                aria-pressed={billSnapshotView === 'adjusted'}
                                                onClick={() => setBillSnapshotView('adjusted')}
                                            >
                                                {t('bill.viewAdjusted')}
                                            </button>
                                            <button
                                                type="button"
                                                className={`ui-chip${billSnapshotView === 'original' ? ' ui-chip--on' : ''}`}
                                                aria-pressed={billSnapshotView === 'original'}
                                                onClick={() => setBillSnapshotView('original')}
                                                disabled={!originalBill}
                                            >
                                                {t('bill.viewOriginal')}
                                            </button>
                                        </div>
                                        <div className="ui-toolbar-end">
                                            <button
                                                type="button"
                                                className="ui-btn ui-btn--default ui-btn--sm"
                                                disabled={billPdfExporting}
                                                onClick={() => handleExportBillPdf('adjusted')}
                                            >
                                                <FileText size={14} />
                                                {' '}{billPdfExporting ? t('btn.generating') : t('btn.downloadBillPdf')}
                                            </button>
                                            <button
                                                type="button"
                                                className="ui-btn ui-btn--default ui-btn--sm"
                                                disabled={billPdfExporting || !originalBill}
                                                onClick={() => handleExportBillPdf('original')}
                                            >
                                                <FileText size={14} /> {t('btn.downloadOriginalPdf')}
                                            </button>
                                            {billDetail.collectionOwner !== 'workshop'
                                            && billDetail.status !== 'paid'
                                            && billDetail.status !== 'overpaid'
                                            && billDetail.status !== 'awaiting_approval'
                                            && billDetail.status !== 'pending_deletion'
                                            && collectionDueBalance > 0.05 ? (
                                                <button
                                                    type="button"
                                                    className="ui-btn ui-btn--primary ui-btn--sm"
                                                    onClick={() => setMarkPaidOpen(true)}
                                                >
                                                    <CheckCircle2 size={14} /> {t('btn.markPaid')}
                                                </button>
                                            ) : null}
                                            {billDetail.collectionOwner !== 'workshop'
                                            && Number(remitPreview?.collectedNotRemitted || 0) > 0.05 ? (
                                                <button
                                                    type="button"
                                                    className="ui-btn ui-btn--default ui-btn--sm"
                                                    data-testid="cb-remit"
                                                    onClick={() => setRemitOpen(true)}
                                                >
                                                    {t('btn.remit')}
                                                </button>
                                            ) : null}
                                            {billDetail.collectionOwner === 'workshop' ? (
                                                <span className="ui-help">{t('hint.workshopOwnedCollect')}</span>
                                            ) : null}
                                            {billDetail.status !== 'pending_deletion' ? (
                                                <button
                                                    type="button"
                                                    className="ui-btn ui-btn--danger ui-btn--sm"
                                                    disabled={deletingBills}
                                                    onClick={() => handleDeleteBills([billDetail.id || selectedBillId])}
                                                >
                                                    <Trash2 size={14} />
                                                    {' '}{deletingBills ? t('btn.deleting') : t('btn.removeBill')}
                                                </button>
                                            ) : null}
                                        </div>
                                    </div>

                                    <div className={`ui-banner ui-banner--${billDetail.hasManualEdits ? 'warn' : 'info'}`}>
                                        <div>
                                            <strong>{t('bill.collectionDue', { amount: fmt(collectionDueBalance) })}</strong>
                                            {Number.isFinite(posOriginalDue) ? (
                                                <span style={{ marginInlineStart: 10 }}>
                                                    {t('bill.posDue', { amount: fmt(posOriginalDue) })}
                                                </span>
                                            ) : null}
                                            <p className="ui-help" style={{ marginTop: 6 }}>
                                                {billDetail.hasManualEdits
                                                    ? (showOriginalBill
                                                        ? t('bill.nowViewingOriginal', { due: fmt(collectionDueBalance) })
                                                        : t('bill.nowViewingAdjusted', {
                                                            original: Number.isFinite(posOriginalDue)
                                                                ? fmt(posOriginalDue)
                                                                : '—',
                                                        }))
                                                    : t('bill.sameAsPos')}
                                            </p>
                                            <p className="ui-help">
                                                {billDetail.hasManualEdits
                                                    ? (showOriginalBill ? t('bill.originalHint') : t('bill.adjustedHint'))
                                                    : t('bill.sameAsPosHint')}
                                            </p>
                                        </div>
                                    </div>

                                    {billDetail.collectionOwner !== 'workshop'
                                    && Array.isArray(billDetail.distribution)
                                    && billDetail.distribution.length > 0 ? (
                                        <CorporateBillDistributePanel
                                            billId={billDetail.id || selectedBillId}
                                            locale={locale}
                                        />
                                    ) : null}

                                    <div className="ui-kpis">
                                        {billKpis.map(([labelKey, val]) => (
                                            <div key={labelKey} className="ui-metric">
                                                <div className="ui-metric-label">{t(labelKey)}</div>
                                                <div className="ui-metric-value">
                                                    {t('money.sar', { amount: fmt(val) })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="ui-table-wrap ui-table-wrap--scroll">
                                        <table className="ui-table" style={{ minWidth: 1460 }}>
                                            <thead>
                                                <tr>
                                                    <th>{t('th.date')}</th>
                                                    <th>{t('th.invNo')}</th>
                                                    <th>{t('th.lineStatus')}</th>
                                                    <th>{t('th.vehicle')}</th>
                                                    <th>{t('th.products')}</th>
                                                    <th>{t('th.type')}</th>
                                                    <th className="ui-num">{t('th.grossExcl')}</th>
                                                    <th className="ui-num">{t('th.lessDiscount')}</th>
                                                    <th className="ui-num">{t('th.taxable')}</th>
                                                    <th className="ui-num">{t('th.vat15')}</th>
                                                    <th className="ui-num">{t('th.totalIncl')}</th>
                                                    <th className="ui-num">{t('th.returns')}</th>
                                                    <th className="ui-num">{t('th.receipts')}</th>
                                                    <th className="ui-num">{t('th.balance')}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr className="ui-row-sum ui-row-sum--open">
                                                    <td colSpan={LEDGER_COL_COUNT - 1}>{t('label.openingBalance')}</td>
                                                    <td className="ui-num">
                                                        {t('money.sar', { amount: fmt(billSum.openingBalance) })}
                                                    </td>
                                                </tr>
                                                {billLinesPaging.total === 0 ? (
                                                    <tr>
                                                        <td colSpan={LEDGER_COL_COUNT}>
                                                            <div className="ui-empty">
                                                                <div className="ui-empty-title">{t('empty.ledgerLines')}</div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    billLinesPaging.pagedRows.map((row) => (
                                                        <tr key={row.id}>
                                                            <td className="ui-nowrap">{row.date}</td>
                                                            <td>
                                                                <ClickableInvoiceNo
                                                                    invoiceId={row.invoiceId}
                                                                    invoiceNo={row.invoiceNo}
                                                                    workshopId={ledger?.corporateAccount?.workshopId}
                                                                    loadingId={invoiceLoadingId}
                                                                    onOpen={openInvoicePdf}
                                                                />
                                                            </td>
                                                            <td>
                                                                <InvoiceAdjustmentStatus adj={row.billAdjustment} t={t} isAr={isAr} rowType={row.type} />
                                                            </td>
                                                            <td>{row.vehicleNo}</td>
                                                            <td style={{ maxWidth: 240 }}>
                                                                <LedgerProductCell row={row} isAr={isAr} />
                                                            </td>
                                                            <td>{formatLedgerTypeShort(row.type)}</td>
                                                            <LedgerAmountTds row={row} t={t} />
                                                            <td className="ui-num ui-money ui-money--out">{fmtCell(row.salesReturns, t)}</td>
                                                            <td className="ui-num ui-money ui-money--in">{fmtCell(row.receipts, t)}</td>
                                                            <td className="ui-num ui-money">
                                                                {t('money.sar', { amount: fmt(row.runningBalance) })}
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                                <tr className="ui-row-sum ui-row-sum--close">
                                                    <td colSpan={LEDGER_COL_COUNT - 1}>{t('label.closingBalance')}</td>
                                                    <td className="ui-num">
                                                        {t('money.sar', { amount: fmt(billSum.closingBalance) })}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                        <UiPager {...billLinesPaging.pagerProps} />
                                    </div>
                                </>
                            ) : null}
                        </div>
                    )}
                </>
            ) : (
                <>
                    {/* Each figure except the opening balance is also the filter for
                        the lines behind it, so it reports and acts in one place. */}
                    <div className="ui-kpis">
                        <div className="ui-metric">
                            <div className="ui-metric-label">{t('stat.opening')}</div>
                            <div className="ui-metric-value">
                                {t('money.sar', { amount: fmt(sum.openingBalance) })}
                            </div>
                        </div>
                        {STATEMENT_FILTERS.map(({ id, labelKey, pick }) => (
                            <button
                                key={id}
                                type="button"
                                className="ui-metric"
                                aria-pressed={ledgerFilter === id}
                                onClick={() => setLedgerFilter((f) => (f === id ? 'all' : id))}
                            >
                                <div className="ui-metric-label">{t(labelKey)}</div>
                                <div className="ui-metric-value">
                                    {t('money.sar', { amount: fmt(pick(sum)) })}
                                </div>
                            </button>
                        ))}
                        <button
                            type="button"
                            className="ui-metric"
                            aria-pressed={ledgerFilter === 'all'}
                            onClick={() => setLedgerFilter('all')}
                        >
                            <div className="ui-metric-label">{t('stat.closing')}</div>
                            <div className="ui-metric-value">
                                {t('money.sar', { amount: fmt(sum.closingBalance) })}
                            </div>
                        </button>
                    </div>

                    <p className="ui-help">
                        {t('label.period', { from: dateFrom, to: dateTo })}
                        {ledger?.generatedAt
                            ? t('label.generated', {
                                when: new Date(ledger.generatedAt).toLocaleString(isAr ? 'ar-SA' : undefined),
                            })
                            : ''}
                    </p>

                    <div className="ui-table-wrap ui-table-wrap--scroll">
                        <table className="ui-table" style={{ minWidth: 1460 }}>
                            <thead>
                                <tr>
                                    <BilingualTh {...thPair('th.date', 'th.dateAr')} t={t} />
                                    <BilingualTh {...thPair('th.invNo', 'th.invNoAr')} t={t} />
                                    <BilingualTh {...thPair('th.lineStatus', 'th.lineStatusAr')} t={t} />
                                    <BilingualTh {...thPair('th.vehicle', 'th.vehicleAr')} t={t} />
                                    <BilingualTh {...thPair('th.products', 'th.productsAr')} t={t} />
                                    <BilingualTh {...thPair('th.type', 'th.typeAr')} t={t} />
                                    <BilingualTh {...thPair('th.grossExcl', 'th.grossExclAr')} t={t} className="ui-num" />
                                    <BilingualTh {...thPair('th.lessDiscount', 'th.lessDiscountAr')} t={t} className="ui-num" />
                                    <BilingualTh {...thPair('th.taxable', 'th.taxableAr')} t={t} className="ui-num" />
                                    <BilingualTh {...thPair('th.vat15', 'th.vat15Ar')} t={t} className="ui-num" />
                                    <BilingualTh {...thPair('th.totalIncl', 'th.totalInclAr')} t={t} className="ui-num" />
                                    <BilingualTh {...thPair('th.returns', 'th.returnsAr')} t={t} className="ui-num" />
                                    <BilingualTh {...thPair('th.receipts', 'th.receiptsAr')} t={t} className="ui-num" />
                                    <BilingualTh {...thPair('th.balance', 'th.balanceAr')} t={t} className="ui-num" />
                                </tr>
                            </thead>
                            <tbody>
                                {ledgerLoading ? (
                                    Array.from({ length: 6 }).map((_, i) => (
                                        <tr key={`sk-${i}`} className="ui-sk-row">
                                            {Array.from({ length: LEDGER_COL_COUNT }).map((__, j) => (
                                                <td key={j}><div className="ui-sk ui-sk--text ui-sk--w70" /></td>
                                            ))}
                                        </tr>
                                    ))
                                ) : (
                                    <>
                                        <tr className="ui-row-sum ui-row-sum--open">
                                            <td colSpan={LEDGER_COL_COUNT - 1}>{t('label.openingBalance')}</td>
                                            <td className="ui-num">
                                                {t('money.sar', { amount: fmt(sum.openingBalance) })}
                                            </td>
                                        </tr>
                                        {statementPaging.total === 0 ? (
                                            <tr>
                                                <td colSpan={LEDGER_COL_COUNT}>
                                                    <div className="ui-empty">
                                                        <div className="ui-empty-title">
                                                            {ledgerFilter !== 'all'
                                                                ? t('empty.periodFilter', { filter: ledgerFilter })
                                                                : t('empty.period')}
                                                        </div>
                                                        {ledgerFilter !== 'all' ? (
                                                            <button
                                                                type="button"
                                                                className="ui-btn ui-btn--default ui-btn--sm"
                                                                onClick={() => setLedgerFilter('all')}
                                                            >
                                                                {t('btn.showAllLines')}
                                                            </button>
                                                        ) : null}
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            statementPaging.pagedRows.map((row) => (
                                                <tr key={row.id}>
                                                    <td className="ui-nowrap">{row.date}</td>
                                                    <td>
                                                        <div className="ui-row" style={{ gap: 8 }}>
                                                            <ClickableInvoiceNo
                                                                invoiceId={row.invoiceId}
                                                                invoiceNo={row.invoiceNo}
                                                                workshopId={ledger?.corporateAccount?.workshopId}
                                                                loadingId={invoiceLoadingId}
                                                                onOpen={openInvoicePdf}
                                                            />
                                                            {row.type === 'Invoice' && row.invoiceId ? (
                                                                <button
                                                                    type="button"
                                                                    className="ui-btn ui-btn--subtle ui-btn--sm"
                                                                    onClick={() => {
                                                                        setError('');
                                                                        setTransferRow(row);
                                                                    }}
                                                                    title={t('btn.transfer')}
                                                                >
                                                                    <ArrowRightLeft size={12} /> {t('btn.transfer')}
                                                                </button>
                                                            ) : null}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <InvoiceAdjustmentStatus adj={row.billAdjustment} t={t} isAr={isAr} rowType={row.type} />
                                                    </td>
                                                    <td>{row.vehicleNo}</td>
                                                    <td style={{ maxWidth: 240 }}>
                                                        <LedgerProductCell row={row} isAr={isAr} />
                                                    </td>
                                                    <td>{formatLedgerTypeShort(row.type)}</td>
                                                    <LedgerAmountTds row={row} t={t} />
                                                    <td className="ui-num ui-money ui-money--out">{fmtCell(row.salesReturns, t)}</td>
                                                    <td className="ui-num ui-money ui-money--in">{fmtCell(row.receipts, t)}</td>
                                                    <td className="ui-num ui-money">
                                                        {t('money.sar', { amount: fmt(row.runningBalance) })}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                        <tr className="ui-row-sum ui-row-sum--close">
                                            <td colSpan={LEDGER_COL_COUNT - 1}>{t('label.closingBalance')}</td>
                                            <td className="ui-num">
                                                {t('money.sar', { amount: fmt(sum.closingBalance) })}
                                            </td>
                                        </tr>
                                    </>
                                )}
                            </tbody>
                        </table>
                        <UiPager {...statementPaging.pagerProps} />
                    </div>
                </>
            )}
        </div>
    );
}
