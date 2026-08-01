import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useOutletContext } from 'react-router-dom';
import {
    Book,
    ChevronLeft,
    ChevronRight,
    FileSpreadsheet,
    FileText,
    Filter,
    RefreshCw,
} from 'lucide-react';
import SearchableEntityCombobox from '../../../components/SearchableEntityCombobox';
import Modal from '../../../components/Modal';
import InvoiceDetailsModal from '../../../components/pos/modern/InvoiceDetailsModal';
import {
    getAccounts,
    getAccountLedger,
    listCorporateArCustomers,
    getCorporateArLedger,
} from '../../../services/accountsApi';
import {
    listJournalEntries,
    getJournalEntry,
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
    exportWorkshopGlLedgerExcel,
    exportWorkshopGlLedgerPdf,
} from '../../../utils/workshopLedgerExport';
import {
    exportCorporateArLedgerExcel,
    exportCorporateArLedgerPdf,
} from '../../../utils/corporateArLedgerExport';
import {
    exportSupplierLedgerExcel,
    exportSupplierLedgerPdf,
} from '../../../utils/supplierLedgerExport';
import {
    downloadPosInvoicePdf,
    isClickableInvoiceRef,
} from '../../../utils/posInvoiceActions';
import { formatPlateLettersFirst } from '../../../utils/formatPlate';
import { parseWorkshopLedgerAccountIdFromPath } from '../workshopCoaAccountRouting';
import '../../../styles/admin/AccountingPage.css';

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];
const CORP_ALL = 'all';
const CORP_OVERAGE = 'overage';
const CORP_SHORTAGE = 'shortage';
const CORP_PREFIX = 'corp:';
const AP_ALL = 'all';
const AP_PREFIX = 'sup:'; // sup:affiliated:ID | sup:local:ID
const AP_AFFILIATED_CODE = '2001';
const AP_LOCAL_CODE = '2010';

const fmt = (n) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return '0.00';
    return x.toLocaleString('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

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

function apTypeForAccount(account) {
    if (isApAffiliatedAccount(account)) return 'affiliated';
    if (isApLocalAccount(account)) return 'local';
    return null;
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

export default function WorkshopLedgerView() {
    const outletCtx = useOutletContext() || {};
    const { workshop } = useAuth() || {};
    const location = useLocation();
    const locale =
        outletCtx.locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => accT(locale, key, vars), [locale]);

    const pathAccountId = parseWorkshopLedgerAccountIdFromPath(location.pathname);
    const workshopId = workshop?.id != null ? String(workshop.id) : '';

    const [accounts, setAccounts] = useState([]);
    const [accountId, setAccountId] = useState(() => pathAccountId || '');
    const [accountDisplay, setAccountDisplay] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [ledger, setLedger] = useState(null);
    const [loadingAccounts, setLoadingAccounts] = useState(true);
    const [loadingLedger, setLoadingLedger] = useState(false);
    const [error, setError] = useState('');

    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);

    const [corpParty, setCorpParty] = useState(CORP_ALL);
    const [corpPartyDisplay, setCorpPartyDisplay] = useState('');
    const [corpCustomers, setCorpCustomers] = useState([]);
    const [corpCustomersLoading, setCorpCustomersLoading] = useState(false);
    const [corpCustomerLines, setCorpCustomerLines] = useState(null);
    const [corpLedgerRaw, setCorpLedgerRaw] = useState(null);
    const [corpOpeningBalance, setCorpOpeningBalance] = useState(0);
    const [corpCustomerLoading, setCorpCustomerLoading] = useState(false);

    const [apParty, setApParty] = useState(AP_ALL);
    const [apPartyDisplay, setApPartyDisplay] = useState('');
    const [apSuppliers, setApSuppliers] = useState([]);
    const [apSuppliersLoading, setApSuppliersLoading] = useState(false);
    const [apSupplierLines, setApSupplierLines] = useState(null);
    const [apLedgerRaw, setApLedgerRaw] = useState(null);
    const [apOpeningBalance, setApOpeningBalance] = useState(0);
    const [apSupplierLoading, setApSupplierLoading] = useState(false);

    const [exporting, setExporting] = useState(false);
    const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
    const [invoiceModalData, setInvoiceModalData] = useState(null);
    const [entryLoadingKey, setEntryLoadingKey] = useState('');
    const [jeModalOpen, setJeModalOpen] = useState(false);
    const [selectedJE, setSelectedJE] = useState(null);
    const [returnModalOpen, setReturnModalOpen] = useState(false);
    const [returnDetail, setReturnDetail] = useState(null);
    const [piModalOpen, setPiModalOpen] = useState(false);
    const [piDetail, setPiDetail] = useState(null);

    const selectedAccount = useMemo(
        () => (accounts || []).find((a) => String(a.id) === String(accountId)) || ledger?.account || null,
        [accounts, accountId, ledger],
    );
    const showCorpPartyFilter = isCorporateArAccount(selectedAccount);
    const showApPartyFilter = isApControlAccount(selectedAccount);
    const apSupplierType = apTypeForAccount(selectedAccount);

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
        if (pathAccountId) setAccountId(pathAccountId);
    }, [pathAccountId]);

    const accountOptions = useMemo(
        () =>
            (accounts || []).map((a) => {
                const code = a.code || '';
                const name = a.name || '';
                const heading = a.hasChildren || a.isHeading;
                return {
                    id: String(a.id),
                    label: `${code} · ${name}`,
                    subtitle: heading
                        ? `${a.type || 'Account'} · Heading`
                        : String(a.type || 'Account'),
                    searchText: `${code} ${name} ${a.type || ''} ${a.subType || ''}`,
                };
            }),
        [accounts],
    );

    const clearLedgerResults = useCallback(() => {
        setLedger(null);
        setCorpCustomerLines(null);
        setCorpLedgerRaw(null);
        setCorpOpeningBalance(0);
        setApSupplierLines(null);
        setApLedgerRaw(null);
        setApOpeningBalance(0);
        setPage(1);
    }, []);

    // Changing any filter clears results until the user clicks Apply again.
    useEffect(() => {
        clearLedgerResults();
    }, [accountId, dateFrom, dateTo, corpParty, apParty, clearLedgerResults]);

    // Reset corporate party filter when leaving 1110 (filter UI only — no ledger fetch).
    useEffect(() => {
        if (!showCorpPartyFilter) {
            setCorpParty(CORP_ALL);
            setCorpPartyDisplay('');
            setCorpCustomers([]);
        }
    }, [showCorpPartyFilter]);

    // Reset AP supplier filter when leaving AP accounts or switching affiliated ↔ local.
    useEffect(() => {
        if (!showApPartyFilter) {
            setApParty(AP_ALL);
            setApPartyDisplay('');
            setApSuppliers([]);
            return;
        }
        setApParty(AP_ALL);
        setApPartyDisplay('');
    }, [showApPartyFilter, apSupplierType]);

    const loadCorpCustomers = useCallback(async () => {
        if (!showCorpPartyFilter) {
            setCorpCustomers([]);
            return;
        }
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
    }, [showCorpPartyFilter, workshopId]);

    useEffect(() => { loadCorpCustomers(); }, [loadCorpCustomers]);

    const loadApSuppliers = useCallback(async () => {
        if (!showApPartyFilter || !apSupplierType) {
            setApSuppliers([]);
            return;
        }
        setApSuppliersLoading(true);
        try {
            const res = apSupplierType === 'affiliated'
                ? await listAffiliatedSuppliers({})
                : await listLocalSuppliers({});
            const list = res?.suppliers ?? res?.data?.suppliers ?? [];
            setApSuppliers(Array.isArray(list) ? list : []);
        } catch {
            setApSuppliers([]);
        } finally {
            setApSuppliersLoading(false);
        }
    }, [showApPartyFilter, apSupplierType]);

    useEffect(() => { loadApSuppliers(); }, [loadApSuppliers]);

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
                limit: 10000,
            });
            setLedger(res);
            setPage(1);

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
                        setCorpLedgerRaw(corpRes);
                        setCorpCustomerLines(mapCorporateArLinesToGl(corpRes));
                        setCorpOpeningBalance(Number(corpRes?.summary?.openingBalance ?? 0) || 0);
                    } catch (e) {
                        setCorpCustomerLines([]);
                        setCorpLedgerRaw(null);
                        setCorpOpeningBalance(0);
                        setError(e?.message || t('ledger.loadFailed'));
                    } finally {
                        setCorpCustomerLoading(false);
                    }
                }
            } else {
                setCorpCustomerLines(null);
                setCorpLedgerRaw(null);
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
                    setApLedgerRaw(apRes);
                    setApSupplierLines(mapSupplierApLinesToGl(apRes));
                    setApOpeningBalance(Number(apRes?.openingBalance ?? 0) || 0);
                } catch (e) {
                    setApSupplierLines([]);
                    setApLedgerRaw(null);
                    setApOpeningBalance(0);
                    setError(e?.message || t('ledger.loadFailed'));
                } finally {
                    setApSupplierLoading(false);
                }
            } else {
                setApSupplierLines(null);
                setApLedgerRaw(null);
                setApOpeningBalance(0);
            }
        } catch (e) {
            clearLedgerResults();
            setError(e?.message || t('ledger.loadFailed'));
        } finally {
            setLoadingLedger(false);
        }
    }, [accountId, dateFrom, dateTo, corpParty, apParty, clearLedgerResults, t]);

    const corpPartyOptions = useMemo(() => {
        const special = [
            {
                id: CORP_ALL,
                label: t('ledger.corp.all'),
                subtitle: t('ledger.corp.allSub'),
                searchText: 'all corporate ar',
            },
            {
                id: CORP_OVERAGE,
                label: t('ledger.corp.overage'),
                subtitle: t('ledger.corp.overageSub'),
                searchText: 'corporate overage closing variance',
            },
            {
                id: CORP_SHORTAGE,
                label: t('ledger.corp.shortage'),
                subtitle: t('ledger.corp.shortageSub'),
                searchText: 'corporate shortage closing variance',
            },
        ];
        const customers = (corpCustomers || []).map((c) => ({
            id: `${CORP_PREFIX}${c.corporateAccountId}`,
            label: c.companyName || c.customerName || '—',
            subtitle: [
                c.vatNumber ? `VAT ${c.vatNumber}` : null,
                `Due SAR ${fmt(c.dueBalance)}`,
            ].filter(Boolean).join(' · '),
            trailing: c.dueBalance > 0 ? `SAR ${fmt(c.dueBalance)}` : undefined,
            searchText: `${c.companyName} ${c.customerName} ${c.vatNumber} ${c.contactPerson} ${c.mobile}`,
        }));
        return [...special, ...customers];
    }, [corpCustomers, t]);

    const apPartyOptions = useMemo(() => {
        const special = [{
            id: AP_ALL,
            label: t('ledger.ap.all'),
            subtitle: t('ledger.ap.allSub'),
            searchText: 'all suppliers payable',
        }];
        const seen = new Set();
        const suppliers = [];
        for (const s of apSuppliers || []) {
            const isAff = apSupplierType === 'affiliated';
            const sid = isAff ? String(s.supplierId) : String(s.id);
            if (!sid || seen.has(sid)) continue;
            seen.add(sid);
            const id = isAff ? `${AP_PREFIX}affiliated:${sid}` : `${AP_PREFIX}local:${sid}`;
            const name = isAff ? (s.supplierName || '—') : (s.name || '—');
            const phone = isAff ? s.mobile : s.phone;
            const vat = s.vatId || '';
            suppliers.push({
                id,
                label: name,
                subtitle: [
                    vat ? `VAT ${vat}` : null,
                    phone || null,
                    s.branchName || null,
                    `Due SAR ${fmt(s.finalBalance)}`,
                ].filter(Boolean).join(' · '),
                trailing: Number(s.finalBalance) !== 0 ? `SAR ${fmt(s.finalBalance)}` : undefined,
                searchText: `${name} ${vat} ${phone || ''} ${s.email || ''} ${s.contactPerson || ''}`,
            });
        }
        return [...special, ...suppliers];
    }, [apSuppliers, apSupplierType, t]);

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

    const totalPages = Math.max(1, Math.ceil(filteredLines.length / pageSize) || 1);

    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [page, totalPages]);

    const pageLines = useMemo(() => {
        const start = (page - 1) * pageSize;
        return filteredLines.slice(start, start + pageSize);
    }, [filteredLines, page, pageSize]);

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
        if (filteredLines.length === 0) {
            const usingPartyFilter =
                (showCorpPartyFilter && corpParty !== CORP_ALL)
                || (showApPartyFilter && apParty !== AP_ALL);
            if (!usingPartyFilter) {
                return Number(ledger?.totals?.closingBalance ?? ledger?.closingRunningBalance ?? statementOpening) || 0;
            }
            return statementOpening;
        }
        return Number(filteredLines[filteredLines.length - 1]?.runningBalance ?? statementOpening) || 0;
    }, [filteredLines, ledger, corpParty, showCorpPartyFilter, apParty, showApPartyFilter, statementOpening]);

    const openingPeriodLabel = useMemo(() => {
        if (dateFrom) {
            try {
                return t('ledger.openingAsOf', {
                    date: new Date(`${dateFrom}T00:00:00`).toLocaleDateString(),
                });
            } catch {
                return t('ledger.openingAsOf', { date: dateFrom });
            }
        }
        return t('ledger.openingBalance');
    }, [dateFrom, t]);

    const isCorpCustomerView = showCorpPartyFilter && corpParty.startsWith(CORP_PREFIX);
    const isApSupplierView = showApPartyFilter && Boolean(parseApParty(apParty));
    const showVehicleCol = isCorpCustomerView;
    const colSpan = showVehicleCol ? 9 : 8;
    const showPartyFilter = showCorpPartyFilter || showApPartyFilter;

    const partyLabel = useMemo(() => {
        if (showCorpPartyFilter) {
            const opt = corpPartyOptions.find((o) => o.id === corpParty);
            return opt?.label || '';
        }
        if (showApPartyFilter) {
            const opt = apPartyOptions.find((o) => o.id === apParty);
            return opt?.label || '';
        }
        return '';
    }, [showCorpPartyFilter, corpPartyOptions, corpParty, showApPartyFilter, apPartyOptions, apParty]);

    const selectedCorpProfile = useMemo(() => {
        if (!isCorpCustomerView) return null;
        const fromLedger = corpLedgerRaw?.corporateAccount;
        if (fromLedger) {
            return {
                companyName: fromLedger.companyName || partyLabel || '',
                customerName: fromLedger.customerName || '',
                vatNumber: fromLedger.vatNumber || '',
                phone: fromLedger.customerMobile || fromLedger.mobile || '',
                contactPerson: fromLedger.contactPerson || '',
            };
        }
        const corpId = corpParty.startsWith(CORP_PREFIX) ? corpParty.slice(CORP_PREFIX.length) : '';
        const fromList = (corpCustomers || []).find(
            (c) => String(c.corporateAccountId) === String(corpId),
        );
        if (!fromList) return partyLabel ? { companyName: partyLabel, customerName: '', vatNumber: '', phone: '', contactPerson: '' } : null;
        return {
            companyName: fromList.companyName || partyLabel || '',
            customerName: fromList.customerName || '',
            vatNumber: fromList.vatNumber || '',
            phone: fromList.mobile || '',
            contactPerson: fromList.contactPerson || '',
        };
    }, [isCorpCustomerView, corpLedgerRaw, corpParty, corpCustomers, partyLabel]);

    const selectedApProfile = useMemo(() => {
        if (!isApSupplierView) return null;
        const hdr = apLedgerRaw?.header;
        if (hdr) {
            return {
                companyName: hdr.supplierName || partyLabel || '',
                vatNumber: hdr.vatNumber || '',
                phone: hdr.phone || '',
                contactPerson: hdr.contactPerson || '',
                email: hdr.email || '',
                type: hdr.type,
                branchName: hdr.branchName || '',
            };
        }
        return partyLabel
            ? { companyName: partyLabel, vatNumber: '', phone: '', contactPerson: '', email: '', type: apSupplierType, branchName: '' }
            : null;
    }, [isApSupplierView, apLedgerRaw, partyLabel, apSupplierType]);

    const exportHeader = useMemo(() => ({
        companyName: selectedCorpProfile?.companyName
            || selectedApProfile?.companyName
            || (ledger?.account?.code
                ? `${ledger.account.code} — ${ledger.account.name}`
                : ledger?.account?.name)
            || workshop?.name
            || 'FILTER',
        workshopName: workshop?.name
            || corpLedgerRaw?.corporateAccount?.workshopName
            || apLedgerRaw?.header?.workshopName
            || '',
        accountCode: ledger?.account?.code,
        accountName: ledger?.account?.name,
        accountType: ledger?.account?.type,
        from: dateFrom || null,
        to: dateTo || null,
        currencyCode: 'SAR',
        partyLabel: partyLabel
            || selectedCorpProfile?.companyName
            || selectedApProfile?.companyName
            || undefined,
        vatNumber: selectedCorpProfile?.vatNumber || selectedApProfile?.vatNumber || undefined,
        phone: selectedCorpProfile?.phone || selectedApProfile?.phone || undefined,
        customerName: selectedCorpProfile?.customerName || undefined,
        contactPerson: selectedCorpProfile?.contactPerson || selectedApProfile?.contactPerson || undefined,
    }), [
        selectedCorpProfile, selectedApProfile, ledger, workshop?.name,
        corpLedgerRaw, apLedgerRaw, dateFrom, dateTo, partyLabel,
    ]);

    const buildCorpExportHeader = useCallback(() => ({
        companyName: selectedCorpProfile?.companyName
            || corpLedgerRaw?.corporateAccount?.companyName
            || partyLabel
            || '',
        vatNumber: selectedCorpProfile?.vatNumber
            || corpLedgerRaw?.corporateAccount?.vatNumber
            || '',
        phone: selectedCorpProfile?.phone
            || corpLedgerRaw?.corporateAccount?.customerMobile
            || '',
        customerName: selectedCorpProfile?.customerName
            || corpLedgerRaw?.corporateAccount?.customerName
            || '',
        contactPerson: selectedCorpProfile?.contactPerson
            || corpLedgerRaw?.corporateAccount?.contactPerson
            || '',
        workshopName: corpLedgerRaw?.corporateAccount?.workshopName || workshop?.name,
        accountCode: ledger?.account?.code,
        accountName: ledger?.account?.name,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
        generatedAt: new Date().toLocaleString(),
    }), [
        selectedCorpProfile, corpLedgerRaw, partyLabel, workshop?.name, ledger, dateFrom, dateTo,
    ]);

    const buildApExportPayload = useCallback(() => {
        const hdr = apLedgerRaw?.header || {};
        return {
            header: {
                ...hdr,
                supplierName: selectedApProfile?.companyName || hdr.supplierName || partyLabel,
                vatNumber: selectedApProfile?.vatNumber || hdr.vatNumber || '',
                phone: selectedApProfile?.phone || hdr.phone || '',
                contactPerson: selectedApProfile?.contactPerson || hdr.contactPerson || '',
                email: selectedApProfile?.email || hdr.email || '',
                accountCode: ledger?.account?.code,
                accountName: ledger?.account?.name,
                from: dateFrom || hdr.from || null,
                to: dateTo || hdr.to || null,
                workshopName: hdr.workshopName || workshop?.name,
            },
            openingBalance: Number(apLedgerRaw?.openingBalance ?? statementOpening) || 0,
            rows: apLedgerRaw?.rows ?? [],
            totals: apLedgerRaw?.totals ?? {
                totalDebit: totals.debit,
                totalCredit: totals.credit,
                closingBalance: statementClosing,
            },
        };
    }, [
        apLedgerRaw, selectedApProfile, partyLabel, ledger, dateFrom, dateTo,
        workshop?.name, statementOpening, statementClosing, totals,
    ]);

    const buildExportTotals = useCallback(() => ({
        totalDebit: Number(totals.debit.toFixed(2)),
        totalCredit: Number(totals.credit.toFixed(2)),
        closingBalance: Number(statementClosing),
    }), [totals, statementClosing]);

    const handleExportPdf = useCallback(async () => {
        if (!ledger?.account) return;
        setExporting(true);
        setError('');
        try {
            if (isCorpCustomerView && corpLedgerRaw) {
                await exportCorporateArLedgerPdf({
                    header: buildCorpExportHeader(),
                    summary: corpLedgerRaw.summary ?? {
                        openingBalance: statementOpening,
                        closingBalance: statementClosing,
                    },
                    lines: corpLedgerRaw.lines ?? [],
                });
            } else if (isApSupplierView && apLedgerRaw) {
                exportSupplierLedgerPdf(buildApExportPayload());
            } else {
                exportWorkshopGlLedgerPdf({
                    header: exportHeader,
                    openingBalance: statementOpening,
                    lines: filteredLines,
                    totals: buildExportTotals(),
                    includeVehicle: showVehicleCol,
                });
            }
        } catch (e) {
            setError(e?.message || t('ledger.exportPdfFailed'));
        } finally {
            setExporting(false);
        }
    }, [
        ledger, isCorpCustomerView, corpLedgerRaw, buildCorpExportHeader,
        isApSupplierView, apLedgerRaw, buildApExportPayload,
        statementOpening, statementClosing, exportHeader, filteredLines, buildExportTotals,
        showVehicleCol, t,
    ]);

    const handleExportExcel = useCallback(async () => {
        if (!ledger?.account) return;
        setExporting(true);
        setError('');
        try {
            if (isCorpCustomerView && corpLedgerRaw) {
                exportCorporateArLedgerExcel({
                    header: buildCorpExportHeader(),
                    summary: corpLedgerRaw.summary ?? {
                        openingBalance: statementOpening,
                        closingBalance: statementClosing,
                    },
                    lines: corpLedgerRaw.lines ?? [],
                });
            } else if (isApSupplierView && apLedgerRaw) {
                exportSupplierLedgerExcel(buildApExportPayload());
            } else {
                exportWorkshopGlLedgerExcel({
                    header: exportHeader,
                    openingBalance: statementOpening,
                    lines: filteredLines,
                    totals: buildExportTotals(),
                    includeVehicle: showVehicleCol,
                });
            }
        } catch (e) {
            setError(e?.message || t('ledger.exportExcelFailed'));
        } finally {
            setExporting(false);
        }
    }, [
        ledger, isCorpCustomerView, corpLedgerRaw, buildCorpExportHeader,
        isApSupplierView, apLedgerRaw, buildApExportPayload,
        statementOpening, statementClosing, exportHeader, filteredLines, buildExportTotals,
        showVehicleCol, t,
    ]);

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
        setInvoiceModalData(invoice);
        setInvoiceModalOpen(true);
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
        setReturnDetail(detail);
        setReturnModalOpen(true);
    }, [t]);

    const showJournalDetail = useCallback((entry) => {
        const fmtMoney = (n) => Number(n || 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
        setSelectedJE({
            code: entry.entryNumber,
            date: entry.date ? new Date(entry.date).toLocaleDateString() : '—',
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
        setJeModalOpen(true);
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
            setPiDetail({ kind: 'local', ...detail });
            setPiModalOpen(true);
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
            setPiDetail({ kind: 'affiliated', ...detail });
            setPiModalOpen(true);
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

    const busy = loadingLedger || corpCustomerLoading || apSupplierLoading || exporting;

    return (
        <div className="accounting-page module-container">
            <header className="cash-bank-header">
                <h2 className="cash-bank-title"><Book size={20} style={{ marginRight: 8 }} />{t('ledger.title')}</h2>
                <p className="cash-bank-desc">
                    {t('ledger.desc')} Select an account below to open its general ledger statement.
                </p>
            </header>

            {error ? <p className="form-help-text" style={{ color: '#B45309' }}>{error}</p> : null}

            <section style={{
                display: 'grid',
                gridTemplateColumns: showPartyFilter
                    ? 'minmax(240px, 1.4fr) minmax(240px, 1.4fr) repeat(auto-fit, minmax(140px, 1fr))'
                    : 'minmax(280px, 2fr) repeat(auto-fit, minmax(160px, 1fr))',
                gap: 12,
                marginBottom: 16,
                padding: 12,
                background: '#fafafa',
                borderRadius: 12,
                border: '1px solid #E2E8F0',
                alignItems: 'end',
            }}>
                <div>
                    <label className="form-label">{t('ledger.account')}</label>
                    <SearchableEntityCombobox
                        options={accountOptions}
                        value={accountId}
                        displayText={accountDisplay}
                        onDisplayTextChange={(text) => {
                            setAccountDisplay(text);
                            if (!text.trim()) {
                                setAccountId('');
                                setLedger(null);
                            }
                        }}
                        onSelect={(opt) => {
                            setAccountId(String(opt?.id || ''));
                            setAccountDisplay('');
                            setCorpParty(CORP_ALL);
                            setCorpPartyDisplay('');
                            setApParty(AP_ALL);
                            setApPartyDisplay('');
                            setPage(1);
                        }}
                        placeholder={t('ledger.accountSearchPh')}
                        entityLabel="account"
                        emptyHint={t('ledger.noMatch')}
                        loading={loadingAccounts}
                        disabled={loadingAccounts}
                        maxInitial={100}
                        maxFiltered={200}
                        menuMinWidth={360}
                    />
                </div>

                {showCorpPartyFilter ? (
                    <div>
                        <label className="form-label">{t('ledger.corp.party')}</label>
                        <SearchableEntityCombobox
                            options={corpPartyOptions}
                            value={corpParty}
                            displayText={corpPartyDisplay}
                            onDisplayTextChange={(text) => {
                                setCorpPartyDisplay(text);
                                if (!text.trim()) {
                                    setCorpParty(CORP_ALL);
                                    setPage(1);
                                }
                            }}
                            onSelect={(opt) => {
                                setCorpParty(String(opt?.id || CORP_ALL));
                                setCorpPartyDisplay('');
                                setPage(1);
                            }}
                            placeholder={t('ledger.corp.searchPh')}
                            entityLabel="party"
                            emptyHint={t('ledger.corp.noMatch')}
                            loading={corpCustomersLoading}
                            maxInitial={80}
                            maxFiltered={200}
                            menuMinWidth={340}
                        />
                    </div>
                ) : null}

                {showApPartyFilter ? (
                    <div>
                        <label className="form-label">{t('ledger.ap.party')}</label>
                        <SearchableEntityCombobox
                            options={apPartyOptions}
                            value={apParty}
                            displayText={apPartyDisplay}
                            onDisplayTextChange={(text) => {
                                setApPartyDisplay(text);
                                if (!text.trim()) {
                                    setApParty(AP_ALL);
                                    setPage(1);
                                }
                            }}
                            onSelect={(opt) => {
                                setApParty(String(opt?.id || AP_ALL));
                                setApPartyDisplay('');
                                setPage(1);
                            }}
                            placeholder={t('ledger.ap.searchPh')}
                            entityLabel="supplier"
                            emptyHint={t('ledger.ap.noMatch')}
                            loading={apSuppliersLoading}
                            maxInitial={80}
                            maxFiltered={200}
                            menuMinWidth={340}
                        />
                    </div>
                ) : null}

                <div>
                    <label className="form-label">{t('date.from')}</label>
                    <input type="date" className="form-input-field" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                </div>
                <div>
                    <label className="form-label">{t('date.to')}</label>
                    <input type="date" className="form-input-field" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button type="button" className="btn-portal" onClick={handleApply} disabled={busy || !accountId}>
                        <Filter size={14} style={{ marginRight: 6 }} /> {t('date.apply')}
                    </button>
                </div>
            </section>

            {ledger?.account ? (
                <div className="cash-bank-stats" style={{ marginBottom: 12 }}>
                    <div className="cash-bank-stat-card">
                        <div className="cash-bank-stat-icon"><Book size={24} /></div>
                        <div>
                            <p className="cash-bank-stat-label">{ledger.account.code} · {ledger.account.name}</p>
                            <p className="cash-bank-stat-value">SAR {fmt(statementClosing)}</p>
                            <p className="cash-bank-stat-meta">
                                {ledger.account.type} · {t('ledger.meta.normal')} {ledger.account.normalBalance}
                                {` · ${t('ledger.meta.showingPage', {
                                    shown: pageLines.length,
                                    total: filteredLines.length,
                                    page,
                                    pages: totalPages,
                                })}`}
                            </p>
                        </div>
                    </div>
                    <div className="cash-bank-stat-card">
                        <div className="cash-bank-stat-icon"><RefreshCw size={24} /></div>
                        <div>
                            <p className="cash-bank-stat-label">{openingPeriodLabel}</p>
                            <p className="cash-bank-stat-value">SAR {fmt(statementOpening)}</p>
                            <p className="cash-bank-stat-meta">
                                {dateFrom || dateTo
                                    ? t('ledger.periodRange', {
                                        from: dateFrom
                                            ? new Date(`${dateFrom}T00:00:00`).toLocaleDateString()
                                            : '—',
                                        to: dateTo
                                            ? new Date(`${dateTo}T00:00:00`).toLocaleDateString()
                                            : '—',
                                    })
                                    : t('ledger.periodAll')}
                            </p>
                        </div>
                    </div>
                    <div className="cash-bank-stat-card">
                        <div className="cash-bank-stat-icon"><RefreshCw size={24} /></div>
                        <div>
                            <p className="cash-bank-stat-label">{t('ledger.periodMovement')}</p>
                            <p className="cash-bank-stat-value">{t('ledger.dr', { n: fmt(totals.debit) })}</p>
                            <p className="cash-bank-stat-meta">{t('ledger.cr', { n: fmt(totals.credit) })}</p>
                        </div>
                    </div>
                </div>
            ) : null}

            <section className="premium-table cash-bank-table">
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <button
                            type="button"
                            className="btn-portal-outline"
                            disabled={!ledger?.account || busy || !accountId}
                            onClick={handleExportPdf}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                            title={t('ledger.exportPdfHint')}
                        >
                            <FileText size={15} /> {t('ledger.exportPdf')}
                        </button>
                        <button
                            type="button"
                            className="btn-portal-outline"
                            disabled={!ledger?.account || busy || !accountId}
                            onClick={handleExportExcel}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                            title={t('ledger.exportExcelHint')}
                        >
                            <FileSpreadsheet size={15} /> {t('ledger.exportExcel')}
                        </button>
                        <label className="form-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                            {t('ledger.pageSize')}
                            <select
                                className="form-input-field"
                                style={{ width: 'auto', minWidth: 80 }}
                                value={pageSize}
                                onChange={(e) => {
                                    setPageSize(Number(e.target.value) || 25);
                                    setPage(1);
                                }}
                            >
                                {PAGE_SIZE_OPTIONS.map((n) => (
                                    <option key={n} value={n}>{n}</option>
                                ))}
                            </select>
                        </label>
                        <span className="form-help-text" style={{ margin: 0 }}>
                            {t('ledger.pageOf', { page, pages: totalPages })}
                        </span>
                        <button
                            type="button"
                            className="btn-portal-outline"
                            disabled={page <= 1 || busy}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                            <ChevronLeft size={16} /> {t('ledger.prev')}
                        </button>
                        <button
                            type="button"
                            className="btn-portal-outline"
                            disabled={page >= totalPages || busy}
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                            {t('ledger.next')} <ChevronRight size={16} />
                        </button>
                    </div>
                </header>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">{t('ledger.th.date')}</th>
                            <th className="table-th">{t('ledger.th.entryNo')}</th>
                            <th className="table-th">{t('ledger.th.type')}</th>
                            {showVehicleCol ? (
                                <th className="table-th">{t('ledger.th.vehicle')}</th>
                            ) : null}
                            <th className="table-th">{t('ledger.th.description')}</th>
                            <th className="table-th">{t('ledger.th.source')}</th>
                            <th className="table-th" style={{ textAlign: 'right' }}>{t('ledger.th.debit')}</th>
                            <th className="table-th" style={{ textAlign: 'right' }}>{t('ledger.th.credit')}</th>
                            <th className="table-th" style={{ textAlign: 'right' }}>{t('ledger.th.running')}</th>
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
                                {page === 1 ? (
                                    <tr style={{ background: '#F8FAFC' }}>
                                        <td className="table-cell">{dateFrom ? new Date(`${dateFrom}T00:00:00`).toLocaleDateString() : '—'}</td>
                                        <td className="table-cell">—</td>
                                        <td className="table-cell">{t('ledger.openingType')}</td>
                                        {showVehicleCol ? <td className="table-cell">—</td> : null}
                                        <td className="table-cell" style={{ fontWeight: 600 }}>{openingPeriodLabel}</td>
                                        <td className="table-cell">—</td>
                                        <td className="table-cell" style={{ textAlign: 'right' }}>—</td>
                                        <td className="table-cell" style={{ textAlign: 'right' }}>—</td>
                                        <td className="table-cell" style={{ textAlign: 'right', fontWeight: 700 }}>
                                            SAR {fmt(statementOpening)}
                                        </td>
                                    </tr>
                                ) : null}
                                {pageLines.length === 0 ? (
                                    <tr><td colSpan={colSpan} className="table-cell table-empty">{t('ledger.noEntries')}</td></tr>
                                ) : pageLines.map((l) => {
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
                                            <td className="table-cell">
                                                {l.date ? new Date(l.date).toLocaleDateString() : '—'}
                                            </td>
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
                                                        {loadingThis ? t('loading') : entryNo}
                                                    </button>
                                                ) : (entryNo || '—')}
                                            </td>
                                            <td className="table-cell">{l.journalType || '—'}</td>
                                            {showVehicleCol ? (
                                                <td className="table-cell">{l.vehicleNo || '—'}</td>
                                            ) : null}
                                            <td className="table-cell" style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {l.lineDescription || l.journalDescription || '—'}
                                            </td>
                                            <td className="table-cell">{l.source ?? '—'}</td>
                                            <td className="table-cell" style={{ textAlign: 'right' }}>{l.debit ? `SAR ${fmt(l.debit)}` : '—'}</td>
                                            <td className="table-cell" style={{ textAlign: 'right' }}>{l.credit ? `SAR ${fmt(l.credit)}` : '—'}</td>
                                            <td className="table-cell" style={{ textAlign: 'right', fontWeight: 600 }}>SAR {fmt(l.runningBalance)}</td>
                                        </tr>
                                    );
                                })}
                            </>
                        )}
                    </tbody>
                </table>

                {accountId && ledger?.account ? (
                    <div style={{
                        padding: '14px 16px',
                        borderTop: '1px solid #E2E8F0',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                        gap: 12,
                        background: '#F8FAFC',
                    }}>
                        <div>
                            <div className="form-help-text" style={{ margin: 0 }}>{t('ledger.openingBalance')}</div>
                            <strong>SAR {fmt(statementOpening)}</strong>
                        </div>
                        <div>
                            <div className="form-help-text" style={{ margin: 0 }}>{t('ledger.totalDebit')}</div>
                            <strong>SAR {fmt(totals.debit)}</strong>
                        </div>
                        <div>
                            <div className="form-help-text" style={{ margin: 0 }}>{t('ledger.totalCredit')}</div>
                            <strong>SAR {fmt(totals.credit)}</strong>
                        </div>
                        <div>
                            <div className="form-help-text" style={{ margin: 0 }}>{t('ledger.closingBalance')}</div>
                            <strong style={{ fontSize: '1.05rem' }}>SAR {fmt(statementClosing)}</strong>
                        </div>
                    </div>
                ) : null}

                {filteredLines.length > pageSize ? (
                    <footer style={{
                        padding: '12px 16px',
                        borderTop: '1px solid #E2E8F0',
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: 8,
                        alignItems: 'center',
                    }}>
                        <span className="form-help-text" style={{ margin: 0 }}>
                            {t('ledger.pageOf', { page, pages: totalPages })}
                        </span>
                        <button
                            type="button"
                            className="btn-portal-outline"
                            disabled={page <= 1 || busy}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                        >
                            <ChevronLeft size={16} style={{ marginRight: 4 }} /> {t('ledger.prev')}
                        </button>
                        <button
                            type="button"
                            className="btn-portal-outline"
                            disabled={page >= totalPages || busy}
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        >
                            {t('ledger.next')} <ChevronRight size={16} style={{ marginLeft: 4 }} />
                        </button>
                    </footer>
                ) : null}
            </section>

            <InvoiceDetailsModal
                isOpen={invoiceModalOpen}
                onClose={() => {
                    setInvoiceModalOpen(false);
                    setInvoiceModalData(null);
                }}
                invoice={invoiceModalData}
                footerVariant="corporate"
                onPrint={async (inv) => {
                    try {
                        await downloadPosInvoicePdf(inv);
                    } catch (e) {
                        setError(e?.message || t('ledger.entryOpenFailed'));
                    }
                }}
            />

            {piModalOpen && piDetail ? (
                <Modal
                    title={t('ledger.piTitle', {
                        no: piDetail.invoiceNumber || piDetail.invoiceNo || piDetail.id || '—',
                    })}
                    onClose={() => {
                        setPiModalOpen(false);
                        setPiDetail(null);
                    }}
                    width={560}
                >
                    <div style={{ display: 'grid', gap: 10 }}>
                        <div><strong>{t('ledger.th.type')}:</strong> {piDetail.kind === 'local' ? t('ledger.ap.local') : t('ledger.ap.affiliated')}</div>
                        <div><strong>{t('ledger.th.entryNo')}:</strong> {piDetail.invoiceNumber || piDetail.invoiceNo || '—'}</div>
                        <div><strong>{t('ledger.th.date')}:</strong> {piDetail.issueDate ? new Date(piDetail.issueDate).toLocaleDateString() : '—'}</div>
                        <div><strong>Supplier:</strong> {piDetail.supplierName || piDetail.localSupplier?.name || piDetail.supplier?.name || '—'}</div>
                        <div><strong>Status:</strong> {piDetail.status || '—'}</div>
                        <div><strong>Total:</strong> SAR {fmt(piDetail.grandTotal ?? piDetail.totalAmount ?? piDetail.total)}</div>
                        {piDetail.journalId ? (
                            <button
                                type="button"
                                className="btn-portal"
                                onClick={() => openJournalById(piDetail.journalId).catch((e) => setError(e?.message || t('ledger.entryOpenFailed')))}
                            >
                                {t('ledger.openJournal')}
                            </button>
                        ) : null}
                    </div>
                </Modal>
            ) : null}

            {returnModalOpen && returnDetail ? (
                <Modal
                    title={t('ledger.returnTitle', {
                        no: returnDetail.creditNoteNo || returnDetail.returnNo || '—',
                    })}
                    onClose={() => {
                        setReturnModalOpen(false);
                        setReturnDetail(null);
                    }}
                    width={560}
                >
                    <div style={{ display: 'grid', gap: 10 }}>
                        <div><strong>{t('ledger.th.entryNo')}:</strong> {returnDetail.returnNo || returnDetail.creditNoteNo || '—'}</div>
                        <div><strong>{t('ledger.th.date')}:</strong> {returnDetail.returnDate ? new Date(returnDetail.returnDate).toLocaleDateString() : '—'}</div>
                        <div><strong>Invoice:</strong> {returnDetail.invoiceNo || '—'}</div>
                        <div><strong>{t('ledger.th.vehicle')}:</strong> {returnDetail.vehicleNo || returnDetail.plateNo || '—'}</div>
                        <div><strong>Customer:</strong> {returnDetail.customerName || '—'}</div>
                        <div><strong>Status:</strong> {returnDetail.status || '—'}</div>
                        <div><strong>Total:</strong> SAR {fmt(returnDetail.totalAmount)}</div>
                        {returnDetail.invoiceId || returnDetail.invoiceNo ? (
                            <button
                                type="button"
                                className="btn-portal"
                                onClick={() => openInvoiceByRef({
                                    invoiceId: returnDetail.invoiceId,
                                    invoiceNo: returnDetail.invoiceNo,
                                }).catch((e) => setError(e?.message || t('ledger.entryOpenFailed')))}
                            >
                                {t('ledger.openSourceInvoice')}
                            </button>
                        ) : null}
                    </div>
                </Modal>
            ) : null}

            {jeModalOpen && selectedJE ? (
                <Modal
                    title={t('gj.modal.title', { code: selectedJE.code })}
                    onClose={() => {
                        setJeModalOpen(false);
                        setSelectedJE(null);
                    }}
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
                            <p className="je-field-value">{selectedJE.description || '—'}</p>
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
                                        {(selectedJE.lines || []).map((line, idx) => (
                                            <tr key={idx}>
                                                <td className="font-bold">{line.account}</td>
                                                <td className="color-muted">{line.description}</td>
                                                <td className="text-right color-green-dark">{line.debit || '—'}</td>
                                                <td className="text-right color-blue-dark">{line.credit || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </Modal>
            ) : null}
        </div>
    );
}
