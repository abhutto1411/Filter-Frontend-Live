import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
    Filter,
    RefreshCw,
    ArrowDownCircle,
    ArrowUpCircle,
    ChevronLeft,
    ChevronRight,
    Download,
} from 'lucide-react';
import {
    listCashBankTransactionsLog,
    listLogFilterUsers,
    listReceiptPaymentMethods,
} from '../../../services/accountingLogsApi';
import {
    getWorkshopRecentOrderPdf,
    workshopReportsAnalyticsParams,
} from '../../../services/workshopStaffApi';
import SearchableEntityCombobox from '../../../components/SearchableEntityCombobox';
import Modal from '../../../components/Modal';
import InvoiceDetailsModal from '../../../components/pos/modern/InvoiceDetailsModal';
import { ExportMenu } from '../../../components/admin/SalesExportControls';
import { exportRowsToPdf, exportRowsToExcel } from '../../../utils/tableExport';
import { downloadPosInvoicePdf } from '../../../utils/posInvoiceActions';
import { formatPlateLettersFirst } from '../../../utils/formatPlate';
import { accT } from '../../../utils/accountingI18n';
import '../../../styles/admin/AccountingPage.css';

const LEGACY_METHOD_VALUES = ['all', 'cash', 'bank', 'petty_cash'];
const PAGE_SIZE = 50;
const EXPORT_LIMIT = 10000;

const fmt = (n) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return '0.00';
    return x.toLocaleString('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

function sidebarBranchToFilter(selectedBranchId) {
    return selectedBranchId && selectedBranchId !== 'all' ? String(selectedBranchId) : '';
}

function formatFilterUserLabel(u) {
    const name = u.name || u.email || u.id;
    const role = u.role ? String(u.role).replace(/_/g, ' ') : '';
    return role ? `${name} (${role})` : name;
}

function methodChipColor(methodLabel, accountType) {
    const m = String(methodLabel || accountType || '').toLowerCase();
    if (m.includes('petty')) return { bg: '#F0FDF4', fg: '#166534' };
    if (m.includes('bank') || m.includes('card') || m.includes('transfer')) {
        return { bg: '#EFF6FF', fg: '#1E40AF' };
    }
    if (m.includes('tabby') || m.includes('tamara')) return { bg: '#FDF4FF', fg: '#86198F' };
    if (m.includes('corporate') || m.includes('monthly') || m.includes('pay monthly')) {
        return { bg: '#FFF7ED', fg: '#C2410C' };
    }
    if (m.includes('cash')) return { bg: '#FEF3C7', fg: '#92400E' };
    return { bg: '#F1F5F9', fg: '#334155' };
}

function formatEntryDateTime(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString();
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
        src.paymentMethod ||
        payments.map((p) => p?.method).filter(Boolean).join(', ') ||
        splitPayments.map((p) => p?.method).filter(Boolean).join(', ') ||
        'Unpaid';
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
            src.odometerReading ??
            salesOrder.odometerReading ??
            salesOrder.odometer ??
            vehicle.odometer ??
            null,
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

function buildExportTable(list, t, isReceipts) {
    const headers = [
        isReceipts ? t('txlog.th.dateTime') : t('txlog.th.date'),
        t('txlog.th.direction'),
        t('txlog.th.amount'),
        t('txlog.th.method'),
        t('txlog.th.account'),
        t('txlog.th.branch'),
        t('txlog.th.owner'),
        t('txlog.th.reference'),
        t('txlog.th.description'),
    ];
    const rows = list.map((r) => {
        const methodLabel = r.method
            || (r.account?.type === 'PETTY_CASH'
                ? t('txlog.pettyCashChip')
                : r.account?.type === 'BANK'
                    ? t('txlog.bank')
                    : r.account?.type === 'CASH'
                        ? t('txlog.cash')
                        : r.account?.type ?? '—');
        const pos = r.sourceType === 'pos_invoice' ? ' · POS' : '';
        return [
            isReceipts ? formatEntryDateTime(r.entryDate) : new Date(r.entryDate).toLocaleDateString(),
            r.direction === 'in' ? t('txlog.dir.in') : t('txlog.dir.out'),
            fmt(r.amount),
            `${methodLabel}${pos}`,
            [r.account?.name, r.account?.coaCode].filter(Boolean).join(' · ') || '—',
            r.account?.branchName ?? '—',
            r.account?.ownerUserName ?? '—',
            r.reference ?? r.sourceType ?? '—',
            r.description ?? '—',
        ];
    });
    return { headers, rows };
}

const emptyApplied = {
    method: 'all',
    branchId: '',
    userId: '',
    dateFrom: '',
    dateTo: '',
    search: '',
};

export default function WorkshopTransactionsLog({
    direction = 'all',
    title,
    subtitle,
    emptyHint,
    branches = [],
    selectedBranchId = 'all',
    locale: localeProp,
}) {
    const outletCtx = useOutletContext() || {};
    const locale =
        localeProp ||
        outletCtx.locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => accT(locale, key, vars), [locale]);
    const isReceipts = direction === 'in';
    const isPayments = direction === 'out';

    const methodLabel = useCallback((value) => {
        if (value === 'all') return t('txlog.allMethods');
        if (value === 'cash') return t('txlog.cash');
        if (value === 'bank') return t('txlog.bank');
        if (value === 'petty_cash') return t('txlog.pettyCash');
        return value;
    }, [t]);

    const methodChip = useCallback((row) => {
        const label = row.method
            || (row.account?.type === 'PETTY_CASH'
                ? t('txlog.pettyCashChip')
                : row.account?.type === 'BANK'
                    ? t('txlog.bank')
                    : row.account?.type === 'CASH'
                        ? t('txlog.cash')
                        : row.account?.type ?? '—');
        const color = methodChipColor(label, row.account?.type);
        const sys = row.account?.kind && row.account.kind !== 'OPERATING'
            ? ` · ${t('txlog.sys')}`
            : '';
        const pos = row.sourceType === 'pos_invoice' ? ' · POS' : '';
        return (
            <span style={{
                display: 'inline-flex',
                background: color.bg,
                color: color.fg,
                padding: '2px 10px',
                borderRadius: 12,
                fontSize: '0.7rem',
                fontWeight: 600,
            }}>
                {label}{pos}{sys}
            </span>
        );
    }, [t]);

    const [method, setMethod] = useState('all');
    const [methodDisplay, setMethodDisplay] = useState('');
    const [methodOptions, setMethodOptions] = useState([
        { id: 'all', label: 'All Methods' },
    ]);
    const [methodsLoading, setMethodsLoading] = useState(false);
    const [branchId, setBranchId] = useState(() => sidebarBranchToFilter(selectedBranchId));
    const [branchDisplay, setBranchDisplay] = useState('');
    const [userId, setUserId] = useState('');
    const [userDisplay, setUserDisplay] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [search, setSearch] = useState('');
    const [applied, setApplied] = useState(() => ({
        ...emptyApplied,
        branchId: sidebarBranchToFilter(selectedBranchId),
    }));
    const [page, setPage] = useState(1);
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [totalAmount, setTotalAmount] = useState(0);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState('');

    const [invoicePreview, setInvoicePreview] = useState(null);
    const [detailRow, setDetailRow] = useState(null);
    const [detailLoadingId, setDetailLoadingId] = useState(null);
    const [detailPdfBusy, setDetailPdfBusy] = useState(false);

    const resolvedEmpty = emptyHint ?? t('txlog.emptyDefault');
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE) || 1);

    const methodComboOptions = useMemo(() => {
        if (!isReceipts) {
            return LEGACY_METHOD_VALUES.map((value) => ({
                id: value,
                label: methodLabel(value),
            }));
        }
        return methodOptions.map((m) => ({
            id: String(m.id),
            label: m.id === 'all' ? t('txlog.allMethods') : (m.label || m.id),
        }));
    }, [isReceipts, methodOptions, methodLabel, t]);

    const branchComboOptions = useMemo(() => [
        { id: 'all', label: t('txlog.allBranches') },
        ...branches.map((b) => ({ id: String(b.id), label: b.name || String(b.id) })),
    ], [branches, t]);

    const userComboOptions = useMemo(() => [
        { id: 'all', label: t('txlog.allUsers') },
        ...users.map((u) => ({ id: String(u.id), label: formatFilterUserLabel(u) })),
    ], [users, t]);

    useEffect(() => {
        if (!isReceipts) return undefined;
        let cancelled = false;
        setMethodsLoading(true);
        listReceiptPaymentMethods()
            .then((res) => {
                if (cancelled) return;
                const list = Array.isArray(res?.methods) ? res.methods : [];
                setMethodOptions(list.length ? list : [{ id: 'all', label: 'All Methods' }]);
            })
            .catch(() => {
                if (!cancelled) {
                    setMethodOptions([
                        { id: 'all', label: 'All Methods' },
                        { id: 'Cash', label: 'Cash' },
                        { id: 'Card', label: 'Card' },
                        { id: 'Bank transfer', label: 'Bank transfer' },
                        { id: 'Tabby', label: 'Tabby' },
                        { id: 'tamara', label: 'tamara' },
                        { id: 'corporate credit', label: 'corporate credit' },
                        { id: 'Petty cash', label: 'Petty cash' },
                    ]);
                }
            })
            .finally(() => {
                if (!cancelled) setMethodsLoading(false);
            });
        return () => { cancelled = true; };
    }, [isReceipts]);

    const buildListParams = useCallback((filters, { limit, offset }) => ({
        direction,
        method: filters.method,
        branchId: filters.branchId || undefined,
        userId: filters.userId || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        search: filters.search.trim() || undefined,
        limit,
        offset,
    }), [direction]);

    const reload = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await listCashBankTransactionsLog(
                buildListParams(applied, {
                    limit: PAGE_SIZE,
                    offset: (page - 1) * PAGE_SIZE,
                }),
            );
            setRows(res?.items ?? []);
            setTotal(Number(res?.total ?? 0));
            const amountFromApi = Number(res?.totalAmount);
            if (Number.isFinite(amountFromApi)) {
                setTotalAmount(amountFromApi);
            } else {
                const pageSum = (res?.items ?? []).reduce((s, r) => s + Number(r.amount || 0), 0);
                setTotalAmount(pageSum);
            }
        } catch (e) {
            setError(e?.message || t('txlog.loadFailed'));
        } finally {
            setLoading(false);
        }
    }, [applied, page, buildListParams, t]);

    useEffect(() => {
        const nextBranch = sidebarBranchToFilter(selectedBranchId);
        setBranchId(nextBranch);
        setBranchDisplay('');
        setUserDisplay('');
        setApplied((prev) => ({ ...prev, branchId: nextBranch, userId: '' }));
        setUserId('');
        setPage(1);
    }, [selectedBranchId]);

    const branchScopeForUsers = branchId || undefined;

    useEffect(() => {
        listLogFilterUsers({
            branchId: branchScopeForUsers,
            // Receipts / Payments owner filter: cashiers + staff only (no technicians).
            ...(isReceipts || isPayments ? { excludeTechnicians: true } : {}),
        })
            .then((res) => {
                const nextUsers = res?.users ?? [];
                setUsers(nextUsers);
                setUserId((prev) => {
                    if (prev && nextUsers.some((u) => String(u.id) === String(prev))) return prev;
                    setUserDisplay('');
                    return '';
                });
            })
            .catch(() => {
                setUsers([]);
                setUserId('');
                setUserDisplay('');
            });
    }, [branchScopeForUsers, isReceipts, isPayments]);

    useEffect(() => { reload(); }, [reload]);

    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [page, totalPages]);

    const applyFilters = () => {
        setApplied({
            method,
            branchId,
            userId,
            dateFrom,
            dateTo,
            search,
        });
        setPage(1);
    };

    const runExport = useCallback(async (kind) => {
        setExporting(true);
        setError('');
        try {
            const res = await listCashBankTransactionsLog(
                buildListParams(applied, { limit: EXPORT_LIMIT, offset: 0 }),
            );
            const list = Array.isArray(res?.items) ? res.items : [];
            const { headers, rows: outRows } = buildExportTable(list, t, isReceipts);
            const subtitleLine = (applied.dateFrom || applied.dateTo)
                ? t('txlog.export.subtitleRange', {
                    n: outRows.length,
                    from: applied.dateFrom || '…',
                    to: applied.dateTo || '…',
                })
                : t('txlog.export.subtitle', { n: outRows.length });
            const fileBase = isReceipts ? 'receipts-log' : isPayments ? 'payments-log' : 'transactions-log';
            if (kind === 'pdf') {
                exportRowsToPdf({
                    title: title || t('txlog.export.title'),
                    subtitle: subtitleLine,
                    headers,
                    rows: outRows,
                    filenameBase: fileBase,
                });
            } else {
                exportRowsToExcel({
                    sheetName: t('txlog.export.sheet'),
                    headers,
                    rows: outRows,
                    filenameBase: fileBase,
                });
            }
            if (Number(res?.total ?? 0) > list.length) {
                setError(t('txlog.export.truncated', { n: list.length, total: res.total }));
            }
        } catch (e) {
            setError(e?.message || t('txlog.export.failed'));
        } finally {
            setExporting(false);
        }
    }, [applied, buildListParams, t, isReceipts, isPayments, title]);

    const openReference = useCallback(async (row) => {
        const ref = row?.reference || row?.sourceId;
        if (!ref && !row?.sourceId) return;
        setDetailLoadingId(String(row.id));
        setError('');
        try {
            if (row.sourceType === 'pos_invoice' && row.sourceId) {
                // Recent-order PDF requires branch scope (branchId or allBranches=true).
                const rowBranch =
                    row.account?.branchId != null && String(row.account.branchId).trim() !== ''
                        ? String(row.account.branchId)
                        : '';
                const scopeBranch =
                    rowBranch
                    || applied.branchId
                    || sidebarBranchToFilter(selectedBranchId)
                    || 'all';
                const params = workshopReportsAnalyticsParams(scopeBranch, {});
                const res = await getWorkshopRecentOrderPdf(row.sourceId, params);
                const payload =
                    res && typeof res === 'object' && res.data && typeof res.data === 'object'
                        ? res.data
                        : res;
                const invoiceObj = mapRecentPdfToInvoice(payload);
                if (!invoiceObj) throw new Error(t('txlog.detail.invalidInvoice'));
                setDetailRow(null);
                setInvoicePreview(invoiceObj);
            } else {
                setInvoicePreview(null);
                setDetailRow(row);
            }
        } catch (e) {
            setError(e?.message || t('txlog.detail.loadFailed'));
        } finally {
            setDetailLoadingId(null);
        }
    }, [t, applied.branchId, selectedBranchId]);

    const downloadDetailPdf = useCallback(async () => {
        if (!detailRow) return;
        setDetailPdfBusy(true);
        try {
            const { headers, rows: outRows } = buildExportTable([detailRow], t, isReceipts);
            exportRowsToPdf({
                title: t('txlog.detail.title'),
                subtitle: detailRow.reference || detailRow.sourceType || '',
                headers,
                rows: outRows,
                filenameBase: `receipt-${detailRow.reference || detailRow.id}`,
            });
        } finally {
            setDetailPdfBusy(false);
        }
    }, [detailRow, t, isReceipts]);

    const pageOutSum = useMemo(
        () => rows.filter((r) => r.direction === 'out').reduce((s, r) => s + Number(r.amount), 0),
        [rows],
    );
    const displayOutTotal = isPayments ? Number(totalAmount || 0) : pageOutSum;

    const dateInputType = isReceipts ? 'datetime-local' : 'date';
    const fromLabel = isReceipts ? t('txlog.fromDateTime') : t('date.from');
    const toLabel = isReceipts ? t('txlog.toDateTime') : t('date.to');

    return (
        <div className="accounting-page module-container">
            <header className="cash-bank-header">
                <h2 className="cash-bank-title">
                    {direction === 'in' ? <ArrowDownCircle size={20} style={{ marginRight: 8, color: '#16A34A' }} /> :
                        direction === 'out' ? <ArrowUpCircle size={20} style={{ marginRight: 8, color: '#DC2626' }} /> : null}
                    {title}
                </h2>
                {subtitle ? <p className="cash-bank-desc">{subtitle}</p> : null}
            </header>

            {error ? <p className="form-help-text" style={{ color: '#B45309' }}>{error}</p> : null}

            <section style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 12,
                marginBottom: 16,
                padding: 12,
                background: '#fafafa',
                borderRadius: 12,
                border: '1px solid #E2E8F0',
            }}>
                <div>
                    <label className="form-label">{t('txlog.method')}</label>
                    {isReceipts ? (
                        <SearchableEntityCombobox
                            options={methodComboOptions}
                            value={method}
                            displayText={methodDisplay}
                            onDisplayTextChange={setMethodDisplay}
                            onSelect={(opt) => {
                                setMethod(String(opt?.id || 'all'));
                                setMethodDisplay('');
                            }}
                            placeholder={t('txlog.methodSearchPh')}
                            entityLabel="method"
                            loading={methodsLoading}
                            maxInitial={80}
                            maxFiltered={120}
                            menuMinWidth={220}
                        />
                    ) : (
                        <select className="form-input-field" value={method} onChange={(e) => setMethod(e.target.value)}>
                            {LEGACY_METHOD_VALUES.map((value) => (
                                <option key={value} value={value}>{methodLabel(value)}</option>
                            ))}
                        </select>
                    )}
                </div>
                <div>
                    <label className="form-label">{t('txlog.branch')}</label>
                    <SearchableEntityCombobox
                        options={branchComboOptions}
                        value={branchId || 'all'}
                        displayText={branchDisplay}
                        onDisplayTextChange={setBranchDisplay}
                        onSelect={(opt) => {
                            const next = !opt?.id || opt.id === 'all' ? '' : String(opt.id);
                            setBranchId(next);
                            setBranchDisplay('');
                            setUserId('');
                            setUserDisplay('');
                        }}
                        placeholder={t('txlog.branchSearchPh')}
                        entityLabel="branch"
                        maxInitial={80}
                        maxFiltered={120}
                        menuMinWidth={220}
                    />
                </div>
                <div>
                    <label className="form-label">{t('txlog.userOwner')}</label>
                    <SearchableEntityCombobox
                        options={userComboOptions}
                        value={userId || 'all'}
                        displayText={userDisplay}
                        onDisplayTextChange={setUserDisplay}
                        onSelect={(opt) => {
                            const next = !opt?.id || opt.id === 'all' ? '' : String(opt.id);
                            setUserId(next);
                            setUserDisplay('');
                        }}
                        placeholder={t('txlog.userSearchPh')}
                        entityLabel="user"
                        maxInitial={80}
                        maxFiltered={120}
                        menuMinWidth={220}
                    />
                </div>
                <div>
                    <label className="form-label">{fromLabel}</label>
                    <input
                        type={dateInputType}
                        className="form-input-field"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                    />
                </div>
                <div>
                    <label className="form-label">{toLabel}</label>
                    <input
                        type={dateInputType}
                        className="form-input-field"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                    />
                </div>
                <div>
                    <label className="form-label">{t('txlog.search')}</label>
                    <input
                        type="text"
                        className="form-input-field"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                applyFilters();
                            }
                        }}
                        placeholder={t('txlog.searchPh')}
                    />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button type="button" className="btn-portal" onClick={applyFilters} disabled={loading}>
                        <Filter size={14} style={{ marginRight: 6 }} /> {t('txlog.apply')}
                    </button>
                </div>
            </section>

            <div className="cash-bank-stats" style={{ marginBottom: 12 }}>
                {direction !== 'out' ? (
                    <div className="cash-bank-stat-card">
                        <div className="cash-bank-stat-icon"><ArrowDownCircle size={24} color="#16A34A" /></div>
                        <div>
                            <p className="cash-bank-stat-label">{t('txlog.totalIn')}</p>
                            <p className="cash-bank-stat-value">SAR {fmt(totalAmount)}</p>
                        </div>
                    </div>
                ) : null}
                {direction !== 'in' ? (
                    <div className="cash-bank-stat-card">
                        <div className="cash-bank-stat-icon"><ArrowUpCircle size={24} color="#DC2626" /></div>
                        <div>
                            <p className="cash-bank-stat-label">{t('txlog.totalOut')}</p>
                            <p className="cash-bank-stat-value">SAR {fmt(displayOutTotal)}</p>
                        </div>
                    </div>
                ) : null}
                <div className="cash-bank-stat-card">
                    <div className="cash-bank-stat-icon"><Filter size={24} /></div>
                    <div>
                        <p className="cash-bank-stat-label">{t('txlog.rows')}</p>
                        <p className="cash-bank-stat-value">{rows.length} / {total}</p>
                    </div>
                </div>
            </div>

            <section className="premium-table cash-bank-table">
                <header style={{ padding: '12px 16px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <strong>
                        {loading
                            ? t('loading')
                            : t('txlog.pageEntries', {
                                shown: rows.length,
                                total,
                                page,
                                pages: totalPages,
                            })}
                    </strong>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <ExportMenu
                            locale={locale}
                            busy={exporting}
                            disabled={loading || total === 0}
                            onPdf={() => runExport('pdf')}
                            onExcel={() => runExport('excel')}
                        />
                        <button type="button" className="btn-portal-outline" onClick={reload} disabled={loading}>
                            <RefreshCw size={14} style={{ marginRight: 6 }} /> {t('txlog.refresh')}
                        </button>
                    </div>
                </header>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">{isReceipts ? t('txlog.th.dateTime') : t('txlog.th.date')}</th>
                            <th className="table-th">{t('txlog.th.direction')}</th>
                            <th className="table-th">{t('txlog.th.amount')}</th>
                            <th className="table-th">{t('txlog.th.method')}</th>
                            <th className="table-th">{t('txlog.th.account')}</th>
                            <th className="table-th">{t('txlog.th.branch')}</th>
                            <th className="table-th">{t('txlog.th.owner')}</th>
                            <th className="table-th">{t('txlog.th.reference')}</th>
                            <th className="table-th">{t('txlog.th.description')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr><td colSpan={9} className="table-cell table-empty">{loading ? t('loading') : resolvedEmpty}</td></tr>
                        ) : rows.map((r) => {
                            const refLabel = r.reference ?? r.sourceType ?? '—';
                            const canOpen = Boolean(r.reference || r.sourceId);
                            const busy = detailLoadingId === String(r.id);
                            return (
                                <tr key={r.id}>
                                    <td className="table-cell">
                                        {isReceipts
                                            ? formatEntryDateTime(r.entryDate)
                                            : new Date(r.entryDate).toLocaleDateString()}
                                    </td>
                                    <td className="table-cell" style={{ color: r.direction === 'in' ? '#16A34A' : '#DC2626' }}>
                                        {r.direction === 'in' ? t('txlog.dir.in') : t('txlog.dir.out')}
                                    </td>
                                    <td className="table-cell">SAR {fmt(r.amount)}</td>
                                    <td className="table-cell">{methodChip(r)}</td>
                                    <td className="table-cell">
                                        {r.account?.name || '—'}
                                        {r.account?.coaCode ? <span style={{ color: '#94A3B8' }}> · {r.account.coaCode}</span> : null}
                                    </td>
                                    <td className="table-cell">{r.account?.branchName ?? '—'}</td>
                                    <td className="table-cell">{r.account?.ownerUserName ?? '—'}</td>
                                    <td className="table-cell">
                                        {canOpen ? (
                                            <button
                                                type="button"
                                                onClick={() => openReference(r)}
                                                disabled={busy}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    padding: 0,
                                                    color: '#2563EB',
                                                    fontWeight: 600,
                                                    cursor: busy ? 'wait' : 'pointer',
                                                    textDecoration: 'underline',
                                                    textUnderlineOffset: 2,
                                                }}
                                                title={t('txlog.detail.openHint')}
                                            >
                                                {busy ? t('loading') : refLabel}
                                            </button>
                                        ) : refLabel}
                                    </td>
                                    <td className="table-cell" style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {r.description ?? '—'}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                <footer style={{
                    padding: '12px 16px',
                    borderTop: '1px solid #E2E8F0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                    flexWrap: 'wrap',
                }}>
                    <span style={{ color: '#64748B', fontSize: 13 }}>
                        {t('txlog.pageSizeHint', { n: PAGE_SIZE })}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                            type="button"
                            className="btn-portal-outline"
                            disabled={loading || page <= 1}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                        >
                            <ChevronLeft size={14} style={{ marginRight: 4 }} />
                            {t('txlog.prev')}
                        </button>
                        <span style={{ fontSize: 13, fontWeight: 600, minWidth: 90, textAlign: 'center' }}>
                            {t('txlog.pageOf', { page, pages: totalPages })}
                        </span>
                        <button
                            type="button"
                            className="btn-portal-outline"
                            disabled={loading || page >= totalPages}
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        >
                            {t('txlog.next')}
                            <ChevronRight size={14} style={{ marginLeft: 4 }} />
                        </button>
                    </div>
                </footer>
            </section>

            <InvoiceDetailsModal
                invoice={invoicePreview}
                isOpen={!!invoicePreview}
                onClose={() => setInvoicePreview(null)}
                onPrint={async (inv) => {
                    try {
                        await downloadPosInvoicePdf(inv);
                    } catch (e) {
                        setError(e?.message || t('txlog.detail.pdfFailed'));
                    }
                }}
            />

            {detailRow ? (
                <Modal
                    title={t('txlog.detail.title')}
                    onClose={() => setDetailRow(null)}
                    width={520}
                    footer={(
                        <>
                            <button
                                type="button"
                                className="btn-portal"
                                disabled={detailPdfBusy}
                                onClick={downloadDetailPdf}
                            >
                                <Download size={14} style={{ marginRight: 6 }} />
                                {detailPdfBusy ? t('loading') : t('txlog.detail.downloadPdf')}
                            </button>
                            <button type="button" className="btn-portal-outline" onClick={() => setDetailRow(null)}>
                                {t('txlog.detail.close')}
                            </button>
                        </>
                    )}
                >
                    <dl style={{ margin: 0, display: 'grid', gap: 10, fontSize: 14 }}>
                        {[
                            [t('txlog.th.dateTime'), formatEntryDateTime(detailRow.entryDate)],
                            [t('txlog.th.direction'), detailRow.direction === 'in' ? t('txlog.dir.in') : t('txlog.dir.out')],
                            [t('txlog.th.amount'), `SAR ${fmt(detailRow.amount)}`],
                            [t('txlog.th.method'), detailRow.method || detailRow.account?.type || '—'],
                            [t('txlog.th.account'), [detailRow.account?.name, detailRow.account?.coaCode].filter(Boolean).join(' · ') || '—'],
                            [t('txlog.th.branch'), detailRow.account?.branchName ?? '—'],
                            [t('txlog.th.owner'), detailRow.account?.ownerUserName ?? '—'],
                            [t('txlog.th.reference'), detailRow.reference ?? '—'],
                            [t('txlog.th.description'), detailRow.description ?? '—'],
                            [t('txlog.detail.source'), detailRow.sourceType ?? '—'],
                        ].map(([label, value]) => (
                            <div key={label} style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 8 }}>
                                <dt style={{ color: '#64748B', fontWeight: 600 }}>{label}</dt>
                                <dd style={{ margin: 0 }}>{value}</dd>
                            </div>
                        ))}
                    </dl>
                </Modal>
            ) : null}
        </div>
    );
}
