import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useOutletContext } from 'react-router-dom';
import {
    ArrowDownLeft,
    ArrowUpRight,
    Book,
    Filter,
    Scale,
    X,
} from 'lucide-react';
import SearchableEntityCombobox from '../../../components/SearchableEntityCombobox';
import { PaginationControls } from '../../../components/PaginationControls';
import {
    getAccounts,
    getAccountLedger,
    listCorporateArCustomers,
    getCorporateArLedger,
} from '../../../services/accountsApi';
import {
    listJournalEntries,
    getJournalEntry,
    listPayees,
} from '../../../services/workshopAccountingApi';
import {
    getWorkshopRecentOrderPdf,
    getWorkshopRecentOrders,
    getWorkshopSalesReturns,
    getWorkshopSalesReturn,
    getWorkshopSupplierPurchaseInvoice,
    workshopReportsAnalyticsParams,
} from '../../../services/workshopStaffApi';
import {
    listAffiliatedSuppliers,
    listLocalSuppliers,
    getSupplierLedger,
    getWorkshopLocalPurchaseInvoice,
} from '../../../services/workshopSuppliersApi';
import { useAuth } from '../../../context/AuthContext';
import { accT } from '../../../utils/accountingI18n';
import {
    applyPickerSelection,
    buildLedgerPickerOptions,
    formatBusinessDate,
    formatSarLatn,
    LEDGER_PAGE_SIZE,
    mapLedgerLineAccount,
    mapLedgerLineRef,
    mapLedgerLineSource,
    mapLedgerSummaryCards,
} from '../../../utils/ledgerDisplay';
import {
    downloadPosInvoicePdf,
    isClickableInvoiceRef,
} from '../../../utils/posInvoiceActions';
import { formatPlateLettersFirst } from '../../../utils/formatPlate';
import { parseWorkshopLedgerAccountIdFromPath } from '../workshopCoaAccountRouting';
import WsTableScroll from '../../../components/workshop/WsTableScroll';
import '../../../styles/admin/AccountingPage.css';

const CORP_ALL = 'all';
const CORP_OVERAGE = 'overage';
const CORP_SHORTAGE = 'shortage';
const CORP_PREFIX = 'corp:';
const AP_ALL = 'all';
const AP_PREFIX = 'sup:'; // sup:affiliated:ID | sup:local:ID
const AP_AFFILIATED_CODE = '2001';
const AP_LOCAL_CODE = '2010';

const CARD_META = {
    opening: { labelKey: 'ledger.card.opening', Icon: Book },
    debit: { labelKey: 'ledger.card.debit', Icon: ArrowDownLeft },
    credit: { labelKey: 'ledger.card.credit', Icon: ArrowUpRight },
    closing: { labelKey: 'ledger.card.closing', Icon: Scale },
};

function moneySar(t, n) {
    return t('money.sar', { n: formatSarLatn(n) });
}

function isCorporateArAccount(account) {
    return String(account?.code ?? '').trim() === '1110';
}

function isApAffiliatedAccount(account) {
    return String(account?.code ?? '').trim() === AP_AFFILIATED_CODE;
}

function isApLocalAccount(account) {
    return String(account?.code ?? '').trim() === AP_LOCAL_CODE;
}

function isApControlAccount(account) {
    return isApAffiliatedAccount(account) || isApLocalAccount(account);
}

function parseApParty(apParty) {
    if (!String(apParty || '').startsWith(AP_PREFIX)) return null;
    const rest = String(apParty).slice(AP_PREFIX.length);
    const idx = rest.indexOf(':');
    if (idx < 0) return null;
    const type = rest.slice(0, idx);
    const id = rest.slice(idx + 1);
    if ((type !== 'affiliated' && type !== 'local') || !id) return null;
    return { type, id };
}

function mapSupplierApLinesToGl(apLedger) {
    return (apLedger?.rows ?? []).map((row) => {
        const desc = row.description || '—';
        const invMatch = String(desc).match(/\b((?:PI|WLPI|INV|SI|DN|CN|JE)-[\w-]+)/i);
        return {
            id: row.id,
            date: row.date,
            entryNumber: invMatch?.[1] || row.refType || '—',
            journalType: row.refType || '—',
            journalDescription: desc,
            lineDescription: desc,
            source: 'supplier_ap',
            debit: Number(row.debit) || 0,
            credit: Number(row.credit) || 0,
            runningBalance: Number(row.runningBalance) || 0,
            refType: row.refType || null,
            refId: row.refId || null,
            journalId: row.journalId || null,
        };
    });
}

function lineSearchBlob(l) {
    return [
        l.lineDescription,
        l.journalDescription,
        l.source,
        l.journalType,
        l.entryNumber,
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
}

function isCorporateOverageLine(l) {
    const blob = lineSearchBlob(l);
    return (
        blob.includes('corporate')
        && blob.includes('overage')
        && (String(l.source || '').toLowerCase() === 'counter_closing' || blob.includes('closing'))
    );
}

function isCorporateShortageLine(l) {
    const blob = lineSearchBlob(l);
    return (
        blob.includes('corporate')
        && blob.includes('shortage')
        && (String(l.source || '').toLowerCase() === 'counter_closing' || blob.includes('closing'))
    );
}

function recomputeRunning(lines, normalDebit = true, opening = 0) {
    let running = Number(opening) || 0;
    return (lines || []).map((l) => {
        const d = Number(l.debit) || 0;
        const c = Number(l.credit) || 0;
        running += normalDebit ? d - c : c - d;
        return { ...l, runningBalance: Number(running.toFixed(2)) };
    });
}

function mapCorporateArLinesToGl(corpLedger) {
    const lines = corpLedger?.lines ?? [];
    return lines.map((row) => {
        let dr = 0;
        let cr = 0;
        if (row.type === 'Invoice') {
            dr = Number(row.invoiceInclusiveVat) || 0;
        } else if (row.type === 'Sales Return') {
            cr = Number(row.salesReturns) || 0;
        } else if (row.type === 'Receipt') {
            cr = Number(row.receipts) || 0;
        }
        return {
            id: row.id,
            date: row.date,
            entryNumber: row.invoiceNo || '—',
            journalType: row.type || '—',
            journalDescription: row.productsServicesEn || row.productsServices || '—',
            lineDescription: row.productsServicesEn || row.productsServices || '—',
            source: 'corporate_ar',
            debit: dr,
            credit: cr,
            runningBalance: Number(row.runningBalance) || 0,
            vehicleNo: row.vehicleNo || '—',
            invoiceId: row.invoiceId || null,
        };
    });
}

function extractInvoiceRef(text) {
    const m = String(text || '').match(/\b((?:INV|RET)-\S+)/i);
    return m ? m[1] : '';
}

function isJournalEntryRef(text) {
    return /^JE[-_]/i.test(String(text || '').trim());
}

/** Map workshop-staff PDF/details payload → InvoiceDetailsModal shape. */
function mapRecentPdfToInvoice(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const src = raw?.invoice && typeof raw.invoice === 'object' ? raw.invoice : raw;
    const salesOrder = src.salesOrder && typeof src.salesOrder === 'object' ? src.salesOrder : {};
    const customer = salesOrder.customer && typeof salesOrder.customer === 'object' ? salesOrder.customer : {};
    const vehicle = salesOrder.vehicle && typeof salesOrder.vehicle === 'object' ? salesOrder.vehicle : {};
    const jobs = Array.isArray(salesOrder.jobs) ? salesOrder.jobs : (Array.isArray(src.jobs) ? src.jobs : []);
    const payments = Array.isArray(src.payments) ? src.payments : [];
    const departments = Array.isArray(src.departments) ? src.departments : [];
    const splitPayments = Array.isArray(src.splitPayments)
        ? src.splitPayments
        : payments.map((p) => ({ method: p?.method, amount: p?.amount }));
    const paymentMethod =
        src.paymentMethod
        || payments.map((p) => p?.method).filter(Boolean).join(', ')
        || splitPayments.map((p) => p?.method).filter(Boolean).join(', ')
        || 'Unpaid';
    return {
        ...src,
        invoiceId: src.invoiceId ?? src.id,
        invoiceNo: src.invoiceNo,
        invoiceDate: src.invoiceDate,
        issuedAt: src.issuedAt || src.dateTime || src.invoiceDate,
        customer,
        vehicle,
        branch: src.branch || salesOrder.branch,
        workshop: src.workshop || salesOrder.workshop,
        customerName: src.customerName || customer.name,
        customerMobile: src.phone || src.customerMobile || customer.mobile,
        customerTaxId: src.taxId ?? src.customerTaxId ?? customer.taxId ?? null,
        plateNo: formatPlateLettersFirst(
            src.vehicleNo || src.plateNo || src.plateDisplay || vehicle.plateDisplay || vehicle.plateNo || '',
        ),
        vehicleModel: src.model ?? src.vehicleModel ?? vehicle.model ?? null,
        vehicleYear: src.year ?? src.vehicleYear ?? vehicle.year ?? null,
        vehicleMake: src.make ?? src.vehicleMake ?? vehicle.make ?? null,
        vehicleVin: src.vin ?? src.vehicleVin ?? vehicle.vin ?? vehicle.carNo ?? null,
        odometerReading:
            src.odometerReading
            ?? salesOrder.odometerReading
            ?? salesOrder.odometer
            ?? vehicle.odometer
            ?? null,
        nextOilChangeKm: src.nextOilChangeKm ?? salesOrder.nextOilChangeKm ?? null,
        branchName: src.branchName || src.branch?.name || salesOrder.branch?.name,
        totalAmount: src.totalAmount ?? src.invoiceTotal,
        paymentMethod,
        maintenanceChecklist: src.maintenanceChecklist,
        departments,
        jobs,
        salesOrder,
        customerType: src.customerType,
        splitPayments,
        zatca: src.zatca || null,
    };
}

async function resolveWorkshopInvoiceIdByNo(invoiceNo) {
    const no = String(invoiceNo || '').trim();
    if (!no) return null;
    const params = workshopReportsAnalyticsParams('all', {});
    const res = await getWorkshopRecentOrders({
        ...params,
        search: no,
        limit: 50,
        offset: 0,
    });
    const rows = Array.isArray(res?.rows)
        ? res.rows
        : Array.isArray(res?.data?.rows)
          ? res.data.rows
          : [];
    const exact = rows.find(
        (r) => String(r.invoiceNo ?? '').trim().toUpperCase() === no.toUpperCase(),
    );
    const hit = exact || rows.find((r) =>
        String(r.invoiceNo ?? '').toUpperCase().includes(no.toUpperCase()),
    );
    const id = hit?.invoiceId ?? hit?.id ?? null;
    return id != null && String(id).trim() !== '' ? String(id) : null;
}

async function loadWorkshopInvoiceModal(invoiceId) {
    const params = workshopReportsAnalyticsParams('all', {});
    const res = await getWorkshopRecentOrderPdf(invoiceId, params);
    const payload =
        res && typeof res === 'object' && res.data && typeof res.data === 'object'
            ? res.data
            : res;
    const invoice = mapRecentPdfToInvoice(payload);
    if (!invoice) throw new Error('Invalid invoice response.');
    return invoice;
}

function LedgerInlineDetailPanel({
    detail,
    t,
    onClose,
    onOpenJournal,
    onOpenInvoice,
}) {
    if (!detail?.kind) return null;
    const panelStyle = {
        marginTop: 12,
        padding: 16,
        border: '1px solid #E2E8F0',
        borderRadius: 10,
        background: '#F8FAFC',
    };
    const headerRow = (title) => (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <strong>{title}</strong>
            <button type="button" className="btn-portal-outline" onClick={onClose} aria-label={t('ledger.inline.close')}>
                <X size={16} />
            </button>
        </div>
    );

    if (detail.kind === 'invoice') {
        const inv = detail.data || {};
        return (
            <div style={panelStyle}>
                {headerRow(inv.invoiceNo || t('ledger.openEntry'))}
                <div style={{ display: 'grid', gap: 8, fontSize: '0.875rem' }}>
                    <div><strong>{t('ledger.th.date')}:</strong> {formatBusinessDate(inv.invoiceDate || inv.issuedAt)}</div>
                    <div><strong>{t('ledger.th.accountCol')}:</strong> {inv.customerName || inv.customer?.name || '—'}</div>
                    <div><strong>{t('ledger.th.vehicle')}:</strong> {inv.plateNo || '—'}</div>
                    <div><strong>{t('ledger.th.balance')}:</strong> {moneySar(t, inv.totalAmount ?? inv.invoiceTotal)}</div>
                    <div><strong>{t('ledger.th.type')}:</strong> {inv.paymentMethod || '—'}</div>
                    <button
                        type="button"
                        className="btn-portal"
                        onClick={() => downloadPosInvoicePdf(inv).catch(() => {})}
                    >
                        PDF
                    </button>
                </div>
            </div>
        );
    }

    if (detail.kind === 'je') {
        const entry = detail.data || {};
        return (
            <div style={panelStyle} className="je-detail-modal">
                {headerRow(t('gj.modal.title', { code: entry.entryNumber || '—' }))}
                <div className="je-detail-grid">
                    <div className="je-detail-field">
                        <span className="je-field-label">{t('gj.modal.date')}</span>
                        <span className="je-field-value">{formatBusinessDate(entry.date)}</span>
                    </div>
                    <div className="je-detail-field">
                        <span className="je-field-label">{t('gj.modal.type')}</span>
                        <span className="je-field-value">{entry.type || '—'}</span>
                    </div>
                    <div className="je-detail-field">
                        <span className="je-field-label">{t('gj.modal.status')}</span>
                        <span className="je-field-value font-bold">{(entry.status || '').toUpperCase()}</span>
                    </div>
                    <div className="je-detail-field">
                        <span className="je-field-label">{t('gj.modal.totalDebit')}</span>
                        <span className="je-field-value">{moneySar(t, entry.totalDebit)}</span>
                    </div>
                    <div className="je-detail-field">
                        <span className="je-field-label">{t('gj.modal.totalCredit')}</span>
                        <span className="je-field-value">{moneySar(t, entry.totalCredit)}</span>
                    </div>
                </div>
                <div className="je-detail-desc-box">
                    <span className="je-field-label">{t('gj.modal.description')}</span>
                    <p className="je-field-value">{entry.description || '—'}</p>
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
                                {(entry.lines || []).map((line, idx) => (
                                    <tr key={idx}>
                                        <td className="font-bold">
                                            {`${line.accountCode || ''}${line.accountCode ? ' — ' : ''}${line.accountName || ''}`}
                                        </td>
                                        <td className="color-muted">{line.description || '—'}</td>
                                        <td className="text-right color-green-dark">
                                            {line.debit ? formatSarLatn(line.debit) : '—'}
                                        </td>
                                        <td className="text-right color-blue-dark">
                                            {line.credit ? formatSarLatn(line.credit) : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }

    if (detail.kind === 'return') {
        const row = detail.data || {};
        return (
            <div style={panelStyle}>
                {headerRow(t('ledger.returnTitle', { no: row.creditNoteNo || row.returnNo || '—' }))}
                <div style={{ display: 'grid', gap: 8, fontSize: '0.875rem' }}>
                    <div><strong>{t('ledger.th.date')}:</strong> {formatBusinessDate(row.returnDate)}</div>
                    <div><strong>{t('ledger.th.ref')}:</strong> {row.returnNo || row.creditNoteNo || '—'}</div>
                    <div><strong>{t('ledger.th.vehicle')}:</strong> {row.vehicleNo || row.plateNo || '—'}</div>
                    <div><strong>{t('ledger.th.balance')}:</strong> {moneySar(t, row.totalAmount)}</div>
                    {row.invoiceId || row.invoiceNo ? (
                        <button
                            type="button"
                            className="btn-portal"
                            onClick={() => onOpenInvoice({ invoiceId: row.invoiceId, invoiceNo: row.invoiceNo })}
                        >
                            {t('ledger.openSourceInvoice')}
                        </button>
                    ) : null}
                </div>
            </div>
        );
    }

    if (detail.kind === 'pi') {
        const pi = detail.data || {};
        return (
            <div style={panelStyle}>
                {headerRow(t('ledger.piTitle', {
                    no: pi.invoiceNumber || pi.invoiceNo || pi.id || '—',
                }))}
                <div style={{ display: 'grid', gap: 8, fontSize: '0.875rem' }}>
                    <div><strong>{t('ledger.th.type')}:</strong> {pi.kind === 'local' ? t('ledger.ap.local') : t('ledger.ap.affiliated')}</div>
                    <div><strong>{t('ledger.th.date')}:</strong> {formatBusinessDate(pi.issueDate)}</div>
                    <div><strong>{t('ledger.ap.party')}:</strong> {pi.supplierName || pi.localSupplier?.name || pi.supplier?.name || '—'}</div>
                    <div><strong>{t('ledger.th.balance')}:</strong> {moneySar(t, pi.grandTotal ?? pi.totalAmount ?? pi.total)}</div>
                    {pi.journalId ? (
                        <button type="button" className="btn-portal" onClick={() => onOpenJournal(pi.journalId)}>
                            {t('ledger.openJournal')}
                        </button>
                    ) : null}
                </div>
            </div>
        );
    }

    return null;
}

export default function WorkshopLedgerView({ locale: localeProp } = {}) {
    const outletCtx = useOutletContext() || {};
    const { workshop } = useAuth() || {};
    const location = useLocation();
    const locale =
        localeProp ||
        outletCtx.locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => accT(locale, key, vars), [locale]);
    const isRtl = String(locale).toLowerCase().startsWith('ar');

    const pathAccountId = parseWorkshopLedgerAccountIdFromPath(location.pathname);
    const workshopId = workshop?.id != null ? String(workshop.id) : '';

    const [accounts, setAccounts] = useState([]);
    const [accountId, setAccountId] = useState(() => pathAccountId || '');
    const [pickerId, setPickerId] = useState(() => (pathAccountId ? `acct:${pathAccountId}` : ''));
    const [pickerDisplay, setPickerDisplay] = useState('');
    const [employees, setEmployees] = useState([]);
    const [employeesLoading, setEmployeesLoading] = useState(false);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [ledger, setLedger] = useState(null);
    const [loadingAccounts, setLoadingAccounts] = useState(true);
    const [loadingLedger, setLoadingLedger] = useState(false);
    const [error, setError] = useState('');

    const [offset, setOffset] = useState(0);
    const [showMoreCols, setShowMoreCols] = useState(false);
    const tableTopRef = useRef(null);

    const [corpParty, setCorpParty] = useState(CORP_ALL);
    const [corpCustomers, setCorpCustomers] = useState([]);
    const [corpCustomersLoading, setCorpCustomersLoading] = useState(false);
    const [corpCustomerLines, setCorpCustomerLines] = useState(null);
    const [corpOpeningBalance, setCorpOpeningBalance] = useState(0);
    const [corpCustomerLoading, setCorpCustomerLoading] = useState(false);

    const [apParty, setApParty] = useState(AP_ALL);
    const [apAffiliatedSuppliers, setApAffiliatedSuppliers] = useState([]);
    const [apLocalSuppliers, setApLocalSuppliers] = useState([]);
    const [apSuppliersLoading, setApSuppliersLoading] = useState(false);
    const [apSupplierLines, setApSupplierLines] = useState(null);
    const [apOpeningBalance, setApOpeningBalance] = useState(0);
    const [apSupplierLoading, setApSupplierLoading] = useState(false);

    const [entryLoadingKey, setEntryLoadingKey] = useState('');
    const [inlineDetail, setInlineDetail] = useState(null);

    const selectedAccount = useMemo(
        () => (accounts || []).find((a) => String(a.id) === String(accountId)) || ledger?.account || null,
        [accounts, accountId, ledger],
    );
    const showCorpPartyFilter = isCorporateArAccount(selectedAccount);
    const showApPartyFilter = isApControlAccount(selectedAccount);

    const loadAccounts = useCallback(async () => {
        setLoadingAccounts(true);
        setError('');
        try {
            const list = await getAccounts({});
            setAccounts(Array.isArray(list) ? list : []);
        } catch (e) {
            setAccounts([]);
            setError(e?.message || t('ledger.loadAccountsFailed'));
        } finally {
            setLoadingAccounts(false);
        }
    }, [t]);

    useEffect(() => { loadAccounts(); }, [loadAccounts]);

    useEffect(() => {
        if (pathAccountId) {
            setAccountId(pathAccountId);
            setPickerId(`acct:${pathAccountId}`);
            setCorpParty(CORP_ALL);
            setApParty(AP_ALL);
        }
    }, [pathAccountId]);

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') setInlineDetail(null);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const clearLedgerResults = useCallback(() => {
        setLedger(null);
        setCorpCustomerLines(null);
        setCorpOpeningBalance(0);
        setApSupplierLines(null);
        setApOpeningBalance(0);
        setOffset(0);
        setInlineDetail(null);
    }, []);

    // Changing any filter clears results until the user clicks Apply again.
    useEffect(() => {
        clearLedgerResults();
    }, [accountId, dateFrom, dateTo, corpParty, apParty, clearLedgerResults]);

    const loadEmployees = useCallback(async () => {
        setEmployeesLoading(true);
        try {
            const res = await listPayees('employee', { includeInactive: 'true' });
            const list = res?.payees ?? res?.data?.payees ?? res?.data ?? res ?? [];
            setEmployees(Array.isArray(list) ? list : []);
        } catch {
            setEmployees([]);
        } finally {
            setEmployeesLoading(false);
        }
    }, []);

    useEffect(() => { loadEmployees(); }, [loadEmployees]);

    const loadCorpCustomers = useCallback(async () => {
        setCorpCustomersLoading(true);
        try {
            const res = await listCorporateArCustomers({ limit: 1000 });
            const list = res?.customers ?? res?.data?.customers ?? [];
            const scoped = workshopId
                ? list.filter((c) => String(c.workshopId) === workshopId)
                : list;
            setCorpCustomers(Array.isArray(scoped) ? scoped : []);
        } catch {
            setCorpCustomers([]);
        } finally {
            setCorpCustomersLoading(false);
        }
    }, [workshopId]);

    useEffect(() => { loadCorpCustomers(); }, [loadCorpCustomers]);

    const loadApSupplierLists = useCallback(async () => {
        setApSuppliersLoading(true);
        try {
            const [affRes, locRes] = await Promise.all([
                listAffiliatedSuppliers({}).catch(() => ({})),
                listLocalSuppliers({}).catch(() => ({})),
            ]);
            const affList = affRes?.suppliers ?? affRes?.data?.suppliers ?? [];
            const locList = locRes?.suppliers ?? locRes?.data?.suppliers ?? [];
            setApAffiliatedSuppliers(Array.isArray(affList) ? affList : []);
            setApLocalSuppliers(Array.isArray(locList) ? locList : []);
        } catch {
            setApAffiliatedSuppliers([]);
            setApLocalSuppliers([]);
        } finally {
            setApSuppliersLoading(false);
        }
    }, []);

    useEffect(() => { loadApSupplierLists(); }, [loadApSupplierLists]);

    const corpCustomersForPicker = useMemo(
        () =>
            (corpCustomers || [])
                .map((c) => ({
                    id: String(c.corporateAccountId ?? c.id ?? ''),
                    name: c.companyName || c.customerName || '—',
                }))
                .filter((c) => c.id),
        [corpCustomers],
    );

    const apAffiliatedForPicker = useMemo(() => {
        const seen = new Set();
        const rows = [];
        for (const s of apAffiliatedSuppliers || []) {
            const sid = String(s.supplierId ?? s.id ?? '');
            if (!sid || seen.has(sid)) continue;
            seen.add(sid);
            rows.push({ id: sid, name: s.supplierName || s.name || '—' });
        }
        return rows;
    }, [apAffiliatedSuppliers]);

    const apLocalForPicker = useMemo(() => {
        const seen = new Set();
        const rows = [];
        for (const s of apLocalSuppliers || []) {
            const sid = String(s.id ?? '');
            if (!sid || seen.has(sid)) continue;
            seen.add(sid);
            rows.push({ id: sid, name: s.name || '—' });
        }
        return rows;
    }, [apLocalSuppliers]);

    const pickerOptions = useMemo(() => {
        const core = buildLedgerPickerOptions({
            accounts,
            employees,
            corpCustomers: corpCustomersForPicker,
            apSuppliers: [],
            apType: null,
            t,
        });
        const aff = buildLedgerPickerOptions({
            accounts: [],
            employees: [],
            corpCustomers: [],
            apSuppliers: apAffiliatedForPicker,
            apType: 'affiliated',
            t,
        });
        const local = buildLedgerPickerOptions({
            accounts: [],
            employees: [],
            corpCustomers: [],
            apSuppliers: apLocalForPicker,
            apType: 'local',
            t,
        });
        return [...core, ...aff, ...local];
    }, [
        accounts,
        employees,
        corpCustomersForPicker,
        apAffiliatedForPicker,
        apLocalForPicker,
        t,
    ]);

    const applyPickerOption = useCallback((opt) => {
        const next = applyPickerSelection(opt);
        setPickerId(next.pickerId);
        setPickerDisplay('');
        setAccountId(next.accountId);
        setCorpParty(next.corpParty || CORP_ALL);
        setApParty(next.apParty || AP_ALL);
        setOffset(0);
    }, []);

    const handleShowAll = useCallback(() => {
        setPickerId('');
        setPickerDisplay('');
        setAccountId('');
        setCorpParty(CORP_ALL);
        setApParty(AP_ALL);
        setDateFrom('');
        setDateTo('');
        setError('');
        clearLedgerResults();
    }, [clearLedgerResults]);

    const handleApply = useCallback(async () => {
        if (!accountId) {
            clearLedgerResults();
            setError(t('ledger.pickAccount'));
            return;
        }
        setLoadingLedger(true);
        setCorpCustomerLoading(false);
        setApSupplierLoading(false);
        setError('');
        try {
            const res = await getAccountLedger(accountId, {
                dateFrom: dateFrom || undefined,
                dateTo: dateTo || undefined,
                limit: 100000,
            });
            setLedger(res);
            setOffset(0);
            if (res?.truncated) {
                setError(
                    t('ledger.truncated', {
                        returned: res.returnedLines ?? res.lines?.length ?? 0,
                        total: res.totalLines ?? 0,
                        defaultValue:
                            `Showing ${res.returnedLines ?? 0} of ${res.totalLines ?? 0} lines — narrow the date range to see the rest.`,
                    }),
                );
            }

            if (corpParty.startsWith(CORP_PREFIX)) {
                const corpId = corpParty.slice(CORP_PREFIX.length);
                if (corpId) {
                    setCorpCustomerLoading(true);
                    try {
                        const corpRes = await getCorporateArLedger({
                            corporateAccountId: corpId,
                            dateFrom: dateFrom || undefined,
                            dateTo: dateTo || undefined,
                        });
                        setCorpCustomerLines(mapCorporateArLinesToGl(corpRes));
                        setCorpOpeningBalance(Number(corpRes?.summary?.openingBalance ?? 0) || 0);
        } catch (e) {
                        setCorpCustomerLines([]);
                        setCorpOpeningBalance(0);
                        setError(e?.message || t('ledger.loadFailed'));
                    } finally {
                        setCorpCustomerLoading(false);
                    }
                }
            } else {
                setCorpCustomerLines(null);
                setCorpOpeningBalance(0);
            }

            const apSel = parseApParty(apParty);
            if (apSel) {
                setApSupplierLoading(true);
                try {
                    const apRes = await getSupplierLedger(apSel.type, apSel.id, {
                        from: dateFrom || undefined,
                        to: dateTo || undefined,
                    });
                    setApSupplierLines(mapSupplierApLinesToGl(apRes));
                    setApOpeningBalance(Number(apRes?.openingBalance ?? 0) || 0);
                } catch (e) {
                    setApSupplierLines([]);
                    setApOpeningBalance(0);
                    setError(e?.message || t('ledger.loadFailed'));
                } finally {
                    setApSupplierLoading(false);
                }
            } else {
                setApSupplierLines(null);
                setApOpeningBalance(0);
            }
        } catch (e) {
            clearLedgerResults();
            setError(e?.message || t('ledger.loadFailed'));
        } finally {
            setLoadingLedger(false);
        }
    }, [accountId, dateFrom, dateTo, corpParty, apParty, clearLedgerResults, t]);

    const normalDebit = String(ledger?.account?.normalBalance || 'debit').toLowerCase() === 'debit';

    const statementOpening = useMemo(() => {
        if (showCorpPartyFilter && corpParty.startsWith(CORP_PREFIX)) {
            return Number(corpOpeningBalance) || 0;
        }
        if (showCorpPartyFilter && (corpParty === CORP_OVERAGE || corpParty === CORP_SHORTAGE)) {
            return 0;
        }
        if (showApPartyFilter && parseApParty(apParty)) {
            return Number(apOpeningBalance) || 0;
        }
        return Number(ledger?.openingBalance ?? 0) || 0;
    }, [showCorpPartyFilter, corpParty, corpOpeningBalance, showApPartyFilter, apParty, apOpeningBalance, ledger]);

    const filteredLines = useMemo(() => {
        const raw = ledger?.lines ?? [];
        if (showCorpPartyFilter && corpParty.startsWith(CORP_PREFIX)) {
            return corpCustomerLines ?? [];
        }
        if (showCorpPartyFilter && corpParty === CORP_OVERAGE) {
            return recomputeRunning(raw.filter(isCorporateOverageLine), normalDebit, statementOpening);
        }
        if (showCorpPartyFilter && corpParty === CORP_SHORTAGE) {
            return recomputeRunning(raw.filter(isCorporateShortageLine), normalDebit, statementOpening);
        }
        if (showApPartyFilter && parseApParty(apParty)) {
            return apSupplierLines ?? [];
        }
        return raw;
    }, [
        ledger, showCorpPartyFilter, corpParty, corpCustomerLines,
        showApPartyFilter, apParty, apSupplierLines, normalDebit, statementOpening,
    ]);

    useEffect(() => {
        const maxOffset = Math.max(0, filteredLines.length - LEDGER_PAGE_SIZE);
        if (offset > maxOffset) setOffset(maxOffset);
    }, [offset, filteredLines.length]);

    const pageLines = useMemo(
        () => filteredLines.slice(offset, offset + LEDGER_PAGE_SIZE),
        [filteredLines, offset],
    );

    const totals = useMemo(() => {
        return filteredLines.reduce(
            (acc, l) => ({
                debit: acc.debit + (Number(l.debit) || 0),
                credit: acc.credit + (Number(l.credit) || 0),
            }),
            { debit: 0, credit: 0 },
        );
    }, [filteredLines]);

    const statementClosing = useMemo(() => {
        // 0 lines ⇒ closing equals opening on the same statement basis (never all-time).
        if (filteredLines.length === 0) {
            return Number(statementOpening) || 0;
        }
        const movement = Number(
            (
                (Number(statementOpening) || 0) +
                (normalDebit
                    ? (totals.debit || 0) - (totals.credit || 0)
                    : (totals.credit || 0) - (totals.debit || 0))
            ).toFixed(2),
        );
        return movement;
    }, [filteredLines.length, statementOpening, totals.debit, totals.credit, normalDebit]);

    const summaryCards = useMemo(
        () =>
            mapLedgerSummaryCards({
                opening: statementOpening,
                debit: totals.debit,
                credit: totals.credit,
                closing: statementClosing,
            }),
        [statementOpening, totals.debit, totals.credit, statementClosing],
    );

    const openingPeriodLabel = useMemo(() => {
        if (dateFrom) {
            return t('ledger.openingAsOf', { date: formatBusinessDate(dateFrom) });
        }
        return t('ledger.openingBalance');
    }, [dateFrom, t]);

    const colSpan = 7 + (showMoreCols ? 4 : 0);

    const openInvoiceByRef = useCallback(async ({ invoiceId, invoiceNo }) => {
        let resolvedId = invoiceId != null && String(invoiceId).trim() !== ''
            ? String(invoiceId)
            : null;
        if (!resolvedId && invoiceNo) {
            resolvedId = await resolveWorkshopInvoiceIdByNo(invoiceNo);
        }
        if (!resolvedId) {
            throw new Error(t('ledger.invoiceNotFound', { no: invoiceNo || '' }));
        }
        const invoice = await loadWorkshopInvoiceModal(resolvedId);
        setInlineDetail({ kind: 'invoice', data: invoice });
    }, [t]);

    const openSalesReturnByNo = useCallback(async (returnNo) => {
        const params = workshopReportsAnalyticsParams('all', {});
        const res = await getWorkshopSalesReturns({
            ...params,
            limit: 100,
            offset: 0,
        });
        const list = Array.isArray(res?.salesReturns) ? res.salesReturns : [];
        const match = list.find((r) => {
            const candidates = [r.returnNo, r.creditNoteNo, r.return_no];
            return candidates.some(
                (c) => String(c || '').trim().toUpperCase() === String(returnNo).trim().toUpperCase(),
            );
        });
        if (!match?.id) {
            throw new Error(t('ledger.returnNotFound', { no: returnNo }));
        }
        let detail = match;
        try {
            const full = await getWorkshopSalesReturn(match.id, params);
            if (full?.salesReturn) detail = full.salesReturn;
        } catch {
            /* keep list row */
        }
        setInlineDetail({ kind: 'return', data: detail });
    }, [t]);

    const showJournalDetail = useCallback((entry) => {
        setInlineDetail({ kind: 'je', data: entry });
    }, []);

    const openJournalByEntryNumber = useCallback(async (entryNumber) => {
        const res = await listJournalEntries({ q: entryNumber, limit: 20 });
        const list = res?.entries ?? [];
        const match = list.find(
            (e) => String(e.entryNumber || '').toUpperCase() === String(entryNumber).toUpperCase(),
        ) || list[0];
        if (!match?.id) {
            throw new Error(t('ledger.journalNotFound', { no: entryNumber }));
        }
        const full = await getJournalEntry(match.id);
        showJournalDetail(full?.entry || match);
    }, [t, showJournalDetail]);

    const openJournalById = useCallback(async (journalId) => {
        const full = await getJournalEntry(journalId);
        const entry = full?.entry;
        if (!entry) throw new Error(t('ledger.journalNotFound', { no: journalId }));
        showJournalDetail(entry);
    }, [t, showJournalDetail]);

    const openPurchaseInvoiceByRef = useCallback(async (line) => {
        const refType = String(line?.refType || '').toUpperCase();
        const refId = line?.refId;
        if (!refId) {
            if (line?.journalId) {
                await openJournalById(line.journalId);
                return;
            }
            throw new Error(t('ledger.entryNotOpenable', { no: line?.entryNumber || '' }));
        }
        if (refType === 'LOCAL_PI' || refType.includes('LOCAL')) {
            const res = await getWorkshopLocalPurchaseInvoice(refId);
            const detail = res?.invoice || res?.data || res;
            setInlineDetail({ kind: 'pi', data: { kind: 'local', ...detail } });
            return;
        }
        if (
            refType === 'WS_SI_APPROVE'
            || refType.includes('WS_SI')
            || refType.includes('AFFILIATED')
            || refType === 'WS_PI'
        ) {
            const res = await getWorkshopSupplierPurchaseInvoice(refId);
            const detail = res?.invoice || res?.data || res;
            setInlineDetail({ kind: 'pi', data: { kind: 'affiliated', ...detail } });
            return;
        }
        if (line?.journalId) {
            await openJournalById(line.journalId);
            return;
        }
        throw new Error(t('ledger.entryNotOpenable', { no: line?.entryNumber || refType }));
    }, [openJournalById, t]);

    const handleEntryClick = useCallback(async (line) => {
        const entryNo = String(line?.entryNumber || '').trim();
        if (!entryNo || entryNo === '—') return;
        const key = String(line.id || entryNo);
        setEntryLoadingKey(key);
        setError('');
        try {
            // Supplier AP sub-ledger rows (payable party filter)
            if (line.source === 'supplier_ap') {
                await openPurchaseInvoiceByRef(line);
                return;
            }
            // Corporate AR RET rows point invoiceId at the source invoice — open that first.
            if (/^RET-/i.test(entryNo)) {
                if (line.invoiceId) {
                    await openInvoiceByRef({ invoiceId: line.invoiceId, invoiceNo: entryNo });
                    return;
                }
                await openSalesReturnByNo(entryNo);
                return;
            }
            if (line.invoiceId || isClickableInvoiceRef(entryNo)) {
                await openInvoiceByRef({ invoiceId: line.invoiceId, invoiceNo: entryNo });
                return;
            }
            const fromDesc = extractInvoiceRef(line.lineDescription || line.journalDescription);
            if (fromDesc && isClickableInvoiceRef(fromDesc)) {
                await openInvoiceByRef({ invoiceNo: fromDesc });
                return;
            }
            if (isJournalEntryRef(entryNo)) {
                await openJournalByEntryNumber(entryNo);
                return;
            }
            if (line.journalId) {
                await openJournalById(line.journalId);
                return;
            }
            if (line.invoiceId) {
                await openInvoiceByRef({ invoiceId: line.invoiceId });
                return;
            }
            setError(t('ledger.entryNotOpenable', { no: entryNo }));
        } catch (e) {
            setError(e?.message || t('ledger.entryOpenFailed'));
        } finally {
            setEntryLoadingKey('');
        }
    }, [
        openInvoiceByRef, openSalesReturnByNo, openJournalByEntryNumber,
        openJournalById, openPurchaseInvoiceByRef, t,
    ]);

    const busy = loadingLedger || corpCustomerLoading || apSupplierLoading;
    const pickerLoading = loadingAccounts || employeesLoading || corpCustomersLoading || apSuppliersLoading;

    return (
        <div className="accounting-page module-container" dir={isRtl ? 'rtl' : 'ltr'}>
            <header className="cash-bank-header">
                <p className="form-help-text" style={{ marginBottom: 4 }}>
                    <Link to="/workshop/accounting">{t('pcw.crumb.accounting')}</Link>
                    {' / '}
                    <span>{t('ledger.crumb')}</span>
                </p>
                <h2 className="cash-bank-title">
                    <Book size={20} style={{ marginInlineEnd: 8 }} />
                    {t('ledger.title')}
                </h2>
                <p className="cash-bank-desc">{t('ledger.desc')}</p>
            </header>

            {error ? (
                <div
                    role="alert"
                    style={{
                        padding: 12,
                        marginBottom: 12,
                        color: '#B45309',
                        background: '#FFFBEB',
                        borderRadius: 8,
                        display: 'flex',
                        gap: 12,
                        flexWrap: 'wrap',
                        alignItems: 'center',
                    }}
                >
                    <span>{error}</span>
                    <button type="button" className="btn-portal-outline" onClick={handleApply}>
                        {t('adv.err.retry')}
                    </button>
                </div>
            ) : null}

            <section className="acct-filter-bar">
                <div>
                    <label className="form-label">{t('ledger.accountOrEmployee')}</label>
                    <SearchableEntityCombobox
                        options={pickerOptions}
                        value={pickerId}
                        displayText={pickerDisplay}
                        onDisplayTextChange={(text) => {
                            setPickerDisplay(text);
                            if (!text.trim()) {
                                applyPickerOption(null);
                            }
                        }}
                        onSelect={(opt) => applyPickerOption(opt)}
                        placeholder={t('ledger.accountSearchPh')}
                        entityLabel="account"
                        emptyHint={t('ledger.noMatch')}
                        loading={pickerLoading}
                        disabled={pickerLoading}
                        maxInitial={100}
                        maxFiltered={250}
                        menuMinWidth={360}
                    />
                </div>
                <div>
                    <label className="form-label">{t('date.from')}</label>
                    <input type="date" className="form-input-field" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                </div>
                <div>
                    <label className="form-label">{t('date.to')}</label>
                    <input type="date" className="form-input-field" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <button type="button" className="btn-submit btn-dark" onClick={handleApply} disabled={busy || !accountId}>
                        <Filter size={14} style={{ marginInlineEnd: 6 }} />
                        {t('date.apply')}
                    </button>
                    <button type="button" className="btn-portal-outline" onClick={handleShowAll} disabled={busy}>
                        {t('ledger.showAll')}
                    </button>
                </div>
            </section>

            {ledger?.account ? (
                <div className="acct-kpi-grid">
                    {summaryCards.map((c) => {
                        const meta = CARD_META[c.id] || CARD_META.opening;
                        const Icon = meta.Icon;
                        return (
                            <div key={c.id} className="acct-kpi-card acct-kpi-card--with-icon">
                                <div className="acct-kpi-icon cash-bank-stat-icon">
                                    <Icon size={24} />
                                </div>
                                <div className="acct-kpi-body">
                                    <p className="acct-kpi-label" title={t(meta.labelKey)}>{t(meta.labelKey)}</p>
                                    <p className="acct-kpi-value" title={moneySar(t, c.value)}>{moneySar(t, c.value)}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : null}

            <section className="premium-table cash-bank-table" ref={tableTopRef}>
                <header style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid #E2E8F0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                }}>
                    <strong>
                        {busy ? t('loading') :
                            !ledger ? t('ledger.applyToLoad') :
                            filteredLines.length
                                ? t('ledger.lines', { n: filteredLines.length })
                                : t('ledger.noData')}
                    </strong>
                    <button
                        type="button"
                        className="btn-portal-outline"
                        onClick={() => setShowMoreCols((v) => !v)}
                    >
                        {showMoreCols ? t('ledger.hideMoreCols') : t('ledger.moreCols')}
                    </button>
                </header>
                <WsTableScroll>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">{t('ledger.th.date')}</th>
                            {showMoreCols ? (
                                <>
                                    <th className="table-th">{t('ledger.th.entryNo')}</th>
                                    <th className="table-th">{t('ledger.th.type')}</th>
                                    <th className="table-th">{t('ledger.th.vehicle')}</th>
                                    <th className="table-th">{t('ledger.th.description')}</th>
                                </>
                            ) : null}
                            <th className="table-th">{t('ledger.th.ref')}</th>
                            <th className="table-th">{t('ledger.th.accountCol')}</th>
                            <th className="table-th">{t('ledger.th.source')}</th>
                            <th className="table-th" style={{ textAlign: 'right' }}>{t('ledger.th.debit')}</th>
                            <th className="table-th" style={{ textAlign: 'right' }}>{t('ledger.th.credit')}</th>
                            <th className="table-th" style={{ textAlign: 'right' }}>{t('ledger.th.balance')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {!accountId ? (
                            <tr><td colSpan={colSpan} className="table-cell table-empty">{t('ledger.pickAccount')}</td></tr>
                        ) : !ledger && !busy ? (
                            <tr><td colSpan={colSpan} className="table-cell table-empty">{t('ledger.applyToLoad')}</td></tr>
                        ) : busy && !ledger ? (
                            <tr><td colSpan={colSpan} className="table-cell table-empty">{t('loading')}</td></tr>
                        ) : (
                            <>
                                {offset === 0 ? (
                                    <tr style={{ background: '#F8FAFC' }}>
                                        <td className="table-cell">{formatBusinessDate(dateFrom)}</td>
                                        {showMoreCols ? (
                                            <>
                                                <td className="table-cell">—</td>
                                                <td className="table-cell">{t('ledger.openingType')}</td>
                                                <td className="table-cell">—</td>
                                                <td className="table-cell" style={{ fontWeight: 600 }}>{openingPeriodLabel}</td>
                                            </>
                                        ) : null}
                                        <td className="table-cell">—</td>
                                        <td className="table-cell">{mapLedgerLineAccount({}, selectedAccount)}</td>
                                        <td className="table-cell">—</td>
                                        <td className="table-cell" style={{ textAlign: 'right' }}>—</td>
                                        <td className="table-cell" style={{ textAlign: 'right' }}>—</td>
                                        <td className="table-cell" style={{ textAlign: 'right', fontWeight: 700 }}>
                                            {moneySar(t, statementOpening)}
                                        </td>
                                    </tr>
                                ) : null}
                                {pageLines.length === 0 ? (
                                    <tr><td colSpan={colSpan} className="table-cell table-empty">{t('ledger.noEntries')}</td></tr>
                                ) : pageLines.map((l) => {
                                    const refText = mapLedgerLineRef(l);
                                    const entryNo = String(l.entryNumber || '').trim();
                                    const clickable = Boolean(
                                        entryNo
                                        && entryNo !== '—'
                                        && (
                                            l.invoiceId
                                            || l.refId
                                            || l.journalId
                                            || l.source === 'supplier_ap'
                                            || isClickableInvoiceRef(entryNo)
                                            || isJournalEntryRef(entryNo)
                                            || extractInvoiceRef(l.lineDescription || l.journalDescription)
                                        ),
                                    );
                                    const loadingThis = entryLoadingKey === String(l.id || entryNo);
                                    return (
                                        <tr key={l.id}>
                                            <td className="table-cell">{formatBusinessDate(l.date)}</td>
                                            {showMoreCols ? (
                                                <>
                                                    <td className="table-cell" style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{entryNo || '—'}</td>
                                                    <td className="table-cell">{l.journalType || '—'}</td>
                                                    <td className="table-cell">{l.vehicleNo || '—'}</td>
                                                    <td className="table-cell" style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {l.lineDescription || l.journalDescription || '—'}
                                                    </td>
                                                </>
                                            ) : null}
                                            <td className="table-cell" style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                                {clickable ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleEntryClick(l)}
                                                        disabled={Boolean(entryLoadingKey)}
                                                        style={{
                                                            background: 'none',
                                                            border: 'none',
                                                            padding: 0,
                                                            color: '#2563EB',
                                                            textDecoration: 'underline',
                                                            cursor: entryLoadingKey ? 'wait' : 'pointer',
                                                            font: 'inherit',
                                                        }}
                                                        title={t('ledger.openEntry')}
                                                    >
                                                        {loadingThis ? t('loading') : refText}
                                                    </button>
                                                ) : refText}
                                            </td>
                                            <td className="table-cell">{mapLedgerLineAccount(l, selectedAccount)}</td>
                                            <td className="table-cell">{mapLedgerLineSource(l)}</td>
                                            <td className="table-cell" style={{ textAlign: 'right' }}>{l.debit ? moneySar(t, l.debit) : '—'}</td>
                                            <td className="table-cell" style={{ textAlign: 'right' }}>{l.credit ? moneySar(t, l.credit) : '—'}</td>
                                            <td className="table-cell" style={{ textAlign: 'right', fontWeight: 600 }}>{moneySar(t, l.runningBalance)}</td>
                                        </tr>
                                    );
                                })}
                            </>
                        )}
                    </tbody>
                </table>
                </WsTableScroll>

                <PaginationControls
                    total={filteredLines.length}
                    limit={LEDGER_PAGE_SIZE}
                    offset={offset}
                    loading={busy}
                    onPageChange={(nextOffset) => {
                        setOffset(nextOffset);
                        tableTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                />
            </section>

            <LedgerInlineDetailPanel
                detail={inlineDetail}
                t={t}
                onClose={() => setInlineDetail(null)}
                onOpenJournal={(journalId) => {
                    openJournalById(journalId).catch((e) => setError(e?.message || t('ledger.entryOpenFailed')));
                }}
                onOpenInvoice={(args) => {
                    openInvoiceByRef(args).catch((e) => setError(e?.message || t('ledger.entryOpenFailed')));
                }}
            />
        </div>
    );
}
