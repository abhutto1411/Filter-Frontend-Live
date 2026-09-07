import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Eye, FileText, Loader2, Plus, RotateCcw, Search } from 'lucide-react';
import InlineFormScreen from '../../components/InlineFormScreen';
import SearchableEntityCombobox from '../../components/SearchableEntityCombobox';
import WorkshopPurchaseReturnDetailView from '../../components/workshop/WorkshopPurchaseReturnDetailView';
import { ShimmerTable, ShimmerTextBlock } from '../../components/supplier/Shimmer';
import {
    approveSupplierAffiliatedSalesReturn,
    createSupplierAffiliatedSalesReturn,
    getSupplierAffiliatedSalesReturn,
    getSupplierInvoice,
    getSupplierProfile,
    listSupplierAffiliatedSalesReturns,
    listSupplierInvoiceReturns,
    listSupplierInvoices,
} from '../../services/supplierApi';
import { mapSupplierAffiliatedReturnForView } from '../../utils/mapAffiliatedReturnDetail';
import { supplierProfileFromApi } from '../../utils/supplierProfile';
import { ssrT } from '../../utils/supplierSalesReturnsI18n';
import '../../styles/admin/AccountingPage.css';

function sarFmt(v) {
    return Number(v ?? 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

/** Same list-row mapping as SupplierSalesInvoices.jsx */
function mapSupplierInvoicesListFromResponse(invRes) {
    if (!invRes || !Array.isArray(invRes.invoices)) return [];
    return invRes.invoices.map((inv) => ({
        id: inv.id,
        invoiceNo: inv.invoiceNo,
        branch: inv.branch?.name || '—',
        branchId: inv.branch?.id,
        workshopId: inv.workshop?.id ?? null,
        workshopName: inv.workshop?.name || inv.branch?.workshopName || '',
        date: inv.invoiceDate,
        dueDate: inv.dueDate || '—',
        amount: Number(inv.grandTotal || 0),
        paid: Number(inv.paid || 0),
        balance: Number(inv.outstanding || 0),
        productLabel: inv.productLabel ?? '—',
    }));
}

function salesInvoiceCustomerLabel(inv) {
    if (!inv || typeof inv !== 'object') return '—';
    if (inv.workshopName && inv.branch && inv.branch !== '—') {
        return `${inv.workshopName} — ${inv.branch}`;
    }
    if (inv.workshopName) return inv.workshopName;
    return inv.branch || 'Customer';
}

function salesInvoiceSelectedDisplay(inv) {
    if (!inv) return '';
    const customer = salesInvoiceCustomerLabel(inv);
    return customer && customer !== '—' ? `${inv.invoiceNo} · ${customer}` : String(inv.invoiceNo || '');
}

function salesInvoiceComboboxSubtitle(inv) {
    const lines = [];
    const customer = salesInvoiceCustomerLabel(inv);
    if (customer && customer !== '—') lines.push(customer);
    const detail = [];
    if (inv.productLabel && inv.productLabel !== '—') detail.push(inv.productLabel);
    if (inv.date) detail.push(`Issued ${formatMgrDate(inv.date)}`);
    if (detail.length) lines.push(detail.join(' · '));
    return lines.join('\n');
}

async function fetchAllSupplierSalesInvoices() {
    const pageSize = 100;
    let offset = 0;
    let total = Number.POSITIVE_INFINITY;
    const all = [];
    while (offset < total) {
        const res = await listSupplierInvoices({ limit: pageSize, offset });
        const rows = mapSupplierInvoicesListFromResponse(res);
        total = Number(res?.total ?? rows.length);
        all.push(...rows);
        if (!rows.length) break;
        offset += pageSize;
        if (all.length >= total) break;
    }
    return all;
}

function formatMgrDate(iso) {
    if (!iso || iso === '—') return '—';
    const [y, m, d] = String(iso).slice(0, 10).split('-');
    if (!y || !m || !d) return String(iso).slice(0, 10);
    return `${d}/${m}/${y}`;
}

function aggregateReturnedQtyByInvoiceLine(returns) {
    const m = new Map();
    for (const r of returns || []) {
        for (const line of r.lines || []) {
            const id = String(line.invoiceItemId);
            m.set(id, (m.get(id) || 0) + Number(line.qtyReturned || 0));
        }
    }
    return m;
}

function returnStatusBadge(status, row, t) {
    const s = String(status || 'pending').toLowerCase();
    if (s === 'approved' || s === 'posted') {
        return {
            label: s === 'posted' ? t('status.posted') : t('status.approved'),
            cls: 'mgr-si-status mgr-si-status--paid',
        };
    }
    if (s === 'rejected') {
        return { label: t('status.rejected'), cls: 'mgr-si-status mgr-si-status--overdue' };
    }
    if (row?.mode === 'workshop_initiated' || row?.linkedPurchaseReturn?.mode === 'workshop_initiated') {
        return { label: t('status.pendingSupplier'), cls: 'mgr-si-status mgr-si-status--pending' };
    }
    return { label: t('status.pendingWorkshop'), cls: 'mgr-si-status mgr-si-status--pending' };
}

function isWorkshopInitiatedReturn(row) {
    return (
        row?.mode === 'workshop_initiated' ||
        row?.linkedPurchaseReturn?.mode === 'workshop_initiated'
    );
}

function linkedPurchaseStatus(row, t) {
    const st = row?.linkedPurchaseReturn?.status;
    if (!st) return t('emdash');
    const badge = returnStatusBadge(st, row, t);
    return badge.label;
}

export default function SupplierAffiliatedSalesReturns({ locale: localeProp }) {
    const locale =
        localeProp ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => ssrT(locale, key, vars), [locale]);
    const [formOpen, setFormOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [invoiceLoading, setInvoiceLoading] = useState(false);
    const [error, setError] = useState('');
    const [formError, setFormError] = useState('');
    const [success, setSuccess] = useState('');
    const [returns, setReturns] = useState([]);
    const [invoices, setInvoices] = useState([]);
    const [invoicesLoading, setInvoicesLoading] = useState(false);
    const [listSearch, setListSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
    const [invoiceSearchDraft, setInvoiceSearchDraft] = useState('');
    const [invoiceDetail, setInvoiceDetail] = useState(null);
    const [returnHistory, setReturnHistory] = useState([]);
    const [lineQty, setLineQty] = useState({});
    const [lineReason, setLineReason] = useState({});
    const [returnDate, setReturnDate] = useState(new Date().toISOString().slice(0, 10));
    const [reference, setReference] = useState('');
    const [description, setDescription] = useState('');
    const [notes, setNotes] = useState('');
    const [viewReturnId, setViewReturnId] = useState(null);
    const [viewReturnDetail, setViewReturnDetail] = useState(null);
    const [viewReturnLoading, setViewReturnLoading] = useState(false);
    const [approvingId, setApprovingId] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const returnsRes = await listSupplierAffiliatedSalesReturns();
            setReturns(Array.isArray(returnsRes?.items) ? returnsRes.items : []);
        } catch (err) {
            setError(err.message || t('err.load'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    const loadSalesInvoicesForPicker = useCallback(async () => {
        setInvoicesLoading(true);
        try {
            const rows = await fetchAllSupplierSalesInvoices();
            setInvoices(rows);
        } catch (err) {
            setFormError(err.message || t('err.loadInvoices'));
            setInvoices([]);
        } finally {
            setInvoicesLoading(false);
        }
    }, [t]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        if (!formOpen || !selectedInvoiceId) {
            setInvoiceDetail(null);
            setReturnHistory([]);
            setLineQty({});
            setLineReason({});
            return;
        }
        let active = true;
        setInvoiceLoading(true);
        setFormError('');
        Promise.all([
            getSupplierInvoice(selectedInvoiceId),
            listSupplierInvoiceReturns(selectedInvoiceId).catch(() => ({ returns: [] })),
        ])
            .then(([invRes, histRes]) => {
                if (!active) return;
                const invoice = invRes?.invoice || invRes;
                setInvoiceDetail(invoice);
                const history = Array.isArray(histRes?.returns) ? histRes.returns : [];
                setReturnHistory(history);
                const nextQty = {};
                (invoice?.items || []).forEach((item) => {
                    nextQty[String(item.id)] = '';
                });
                setLineQty(nextQty);
                setLineReason({});
            })
            .catch((err) => {
                if (active) setFormError(err.message || t('err.loadInvoice'));
            })
            .finally(() => {
                if (active) setInvoiceLoading(false);
            });
        return () => {
            active = false;
        };
    }, [formOpen, selectedInvoiceId, t]);

    const filteredReturns = useMemo(() => {
        let rows = returns;
        if (statusFilter !== 'all') {
            rows = rows.filter((row) => String(row.status || '').toLowerCase() === statusFilter);
        }
        const q = listSearch.trim().toLowerCase();
        if (!q) return rows;
        return rows.filter((row) => {
            const hay = [
                row.returnNo,
                row.invoiceNo,
                row.workshopName,
                row.branchName,
                row.linkedPurchaseReturn?.returnNumber,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return hay.includes(q);
        });
    }, [returns, listSearch, statusFilter]);

    const returnedSoFar = useMemo(
        () => aggregateReturnedQtyByInvoiceLine(returnHistory),
        [returnHistory],
    );

    const totalSelected = useMemo(() => {
        return (invoiceDetail?.items || []).reduce((sum, item) => {
            const qty = Number(lineQty[String(item.id)] || 0);
            if (!(qty > 0)) return sum;
            const unitPrice = Number(item.unitPrice || 0);
            const vatRate = Number(item.vatRate || 0) / 100;
            return sum + qty * unitPrice * (1 + vatRate);
        }, 0);
    }, [invoiceDetail, lineQty]);

    const openForm = () => {
        setFormError('');
        setSuccess('');
        setSelectedInvoiceId('');
        setInvoiceSearchDraft('');
        setReference('');
        setDescription('');
        setNotes('');
        setReturnDate(new Date().toISOString().slice(0, 10));
        setFormOpen(true);
        void loadSalesInvoicesForPicker();
    };

    const closeForm = () => {
        if (saving) return;
        setFormOpen(false);
        setFormError('');
    };

    const closeViewReturn = useCallback(() => {
        setViewReturnId(null);
        setViewReturnDetail(null);
        setViewReturnLoading(false);
    }, []);

    const handleViewReturn = useCallback(async (row) => {
        if (!row?.id) return;
        setViewReturnId(String(row.id));
        setViewReturnLoading(true);
        setViewReturnDetail(null);
        try {
            const [profileRes, detailRes] = await Promise.all([
                getSupplierProfile().catch(() => null),
                getSupplierAffiliatedSalesReturn(row.id),
            ]);
            const detail = mapSupplierAffiliatedReturnForView(detailRes);
            const profile = supplierProfileFromApi(profileRes);
            if (detail && profile) {
                detail.supplier = profile;
            }
            setViewReturnDetail(detail);
        } catch (err) {
            setError(err?.message || t('err.loadDetail'));
            setViewReturnId(null);
        } finally {
            setViewReturnLoading(false);
        }
    }, [t]);

    const handleApproveReturn = useCallback(async (row) => {
        if (!row?.id || row.status !== 'pending' || !isWorkshopInitiatedReturn(row)) return;
        const ok = window.confirm(t('confirm.approve', { no: row.returnNo }));
        if (!ok) return;
        setApprovingId(String(row.id));
        setError('');
        try {
            await approveSupplierAffiliatedSalesReturn(row.id);
            setSuccess(t('success.approved', { no: row.returnNo }));
            await load();
        } catch (err) {
            setError(err?.message || t('err.approve'));
        } finally {
            setApprovingId(null);
        }
    }, [load, t]);

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!selectedInvoiceId) {
            setFormError(t('err.needInvoice'));
            return;
        }
        const lines = (invoiceDetail?.items || [])
            .map((item) => ({
                invoiceItemId: String(item.id),
                qtyReturned: Number(lineQty[String(item.id)] || 0),
                reason: lineReason[String(item.id)] || '',
            }))
            .filter((item) => item.qtyReturned > 0);
        if (!lines.length) {
            setFormError(t('err.needQty'));
            return;
        }
        setSaving(true);
        setFormError('');
        try {
            const res = await createSupplierAffiliatedSalesReturn({
                supplierInvoiceId: selectedInvoiceId,
                returnDate,
                reference,
                description,
                notes,
                lines,
            });
            setSuccess(
                t('success.created', {
                    returnNo: res?.supplierReturnNo || '',
                    purchaseReturnNo: res?.purchaseReturnNo || '',
                }).trim(),
            );
            setFormOpen(false);
            await load();
        } catch (err) {
            setFormError(err.message || t('err.create'));
        } finally {
            setSaving(false);
        }
    };

    const selectedInvoiceMeta = useMemo(
        () => invoices.find((row) => String(row.id) === String(selectedInvoiceId)) || null,
        [invoices, selectedInvoiceId],
    );

    const invoiceComboboxOptions = useMemo(
        () =>
            invoices.map((inv) => ({
                id: String(inv.id),
                label: inv.invoiceNo || t('emdash'),
                subtitle: salesInvoiceComboboxSubtitle(inv),
                trailing: t('money.sar', { amount: sarFmt(inv.amount) }),
                searchTokens: [
                    inv.invoiceNo,
                    salesInvoiceCustomerLabel(inv),
                    inv.productLabel,
                    inv.branch,
                    inv.workshopName,
                    inv.date,
                ].filter((tok) => tok && tok !== '—'),
            })),
        [invoices, t],
    );

    const lineGridCols = 'minmax(140px,2fr) 88px 104px 96px 112px minmax(120px,1fr)';

    return (
        <div className="mgr-si-page">
            {!formOpen && !viewReturnId ? (
                <>
                    <header className="mgr-si-header">
                        <div className="mgr-si-header-top">
                            <div className="mgr-si-breadcrumb">{t('page.breadcrumb')}</div>
                            <div className="mgr-si-toolbar-actions">
                                <button type="button" className="mgr-si-btn-new" onClick={openForm}>
                                    <Plus size={16} /> {t('btn.newReturn')}
                                </button>
                            </div>
                        </div>
                        <h2 className="mgr-si-title">{t('page.title')}</h2>
                        <p className="mgr-si-subtitle">{t('page.subtitle')}</p>
                    </header>

                    <div className="mgr-si-toolbar">
                        <div className="mgr-si-filter-bar">
                            <span className="mgr-si-filter-label">{t('label.status')}</span>
                            <select
                                className="mgr-si-filter-select"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                aria-label={t('aria.filterStatus')}
                            >
                                <option value="all">{t('opt.allReturns')}</option>
                                <option value="pending">{t('opt.pendingWorkshop')}</option>
                                <option value="approved">{t('opt.approved')}</option>
                                <option value="posted">{t('opt.posted')}</option>
                            </select>
                        </div>
                        <div className="mgr-si-search-wrap">
                            <div className="mgr-si-search-input-wrap">
                                <Search size={16} className="mgr-si-search-icon" aria-hidden />
                                <input
                                    type="search"
                                    className="mgr-si-search-input"
                                    placeholder={t('search.placeholder')}
                                    value={listSearch}
                                    onChange={(e) => setListSearch(e.target.value)}
                                    aria-label={t('aria.searchReturns')}
                                />
                            </div>
                            <button type="button" className="mgr-si-search-btn">
                                {t('btn.search')}
                            </button>
                        </div>
                    </div>

                    {error ? <div className="mgr-si-error">{error}</div> : null}
                    {success ? (
                        <div
                            style={{
                                marginBottom: 16,
                                padding: '12px 14px',
                                borderRadius: 10,
                                background: '#ECFDF5',
                                border: '1px solid #A7F3D0',
                                color: '#047857',
                                fontSize: '0.875rem',
                            }}
                        >
                            {success}
                        </div>
                    ) : null}

                    <div className="premium-table mgr-si-table-wrap">
                        <div style={{ overflowX: 'auto' }}>
                            {loading && filteredReturns.length === 0 ? (
                                <div style={{ padding: 16 }}>
                                    <ShimmerTable rows={8} columns={8} />
                                </div>
                            ) : (
                                <table className="mgr-si-table">
                                    <thead>
                                        <tr className="table-header-row">
                                            <th className="table-th">{t('th.returnDate')}</th>
                                            <th className="table-th">{t('th.returnNo')}</th>
                                            <th className="table-th">{t('th.salesInvoice')}</th>
                                            <th className="table-th">{t('th.workshopBranch')}</th>
                                            <th className="table-th">{t('th.amount')}</th>
                                            <th className="table-th">{t('th.supplierStatus')}</th>
                                            <th className="table-th">{t('th.workshopReturn')}</th>
                                            <th className="table-th">{t('th.workshopStatus')}</th>
                                            <th className="table-th" style={{ width: 72 }} />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {!loading && filteredReturns.length === 0 ? (
                                            <tr>
                                                <td colSpan={9} className="table-cell table-empty">
                                                    <FileText
                                                        size={36}
                                                        style={{
                                                            opacity: 0.25,
                                                            margin: '0 auto 12px',
                                                            display: 'block',
                                                        }}
                                                    />
                                                    <div style={{ fontWeight: 700, marginBottom: 8 }}>
                                                        {t('empty.title')}
                                                    </div>
                                                    <p style={{ margin: 0, color: '#64748B', fontSize: '0.875rem' }}>
                                                        {t('empty.hint')}
                                                    </p>
                                                    <button
                                                        type="button"
                                                        className="mgr-si-btn-new"
                                                        style={{ marginTop: 16 }}
                                                        onClick={openForm}
                                                    >
                                                        <Plus size={16} /> {t('btn.newReturn')}
                                                    </button>
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredReturns.map((row) => {
                                                const badge = returnStatusBadge(row.status, row, t);
                                                const canApprove =
                                                    row.status === 'pending' &&
                                                    isWorkshopInitiatedReturn(row);
                                                return (
                                                    <tr key={row.id} className="table-row">
                                                        <td className="table-cell">
                                                            {formatMgrDate(row.returnDate)}
                                                        </td>
                                                        <td className="table-cell" style={{ fontWeight: 600 }}>
                                                            {row.returnNo}
                                                        </td>
                                                        <td className="table-cell">{row.invoiceNo || t('emdash')}</td>
                                                        <td className="table-cell">
                                                            {row.workshopName
                                                                ? `${row.workshopName}${row.branchName ? ` — ${row.branchName}` : ''}`
                                                                : row.branchName || t('emdash')}
                                                        </td>
                                                        <td className="table-cell mgr-si-cell-amount">
                                                            {t('money.sar', { amount: sarFmt(row.grandTotal) })}
                                                        </td>
                                                        <td className="table-cell">
                                                            <span className={badge.cls}>{badge.label}</span>
                                                        </td>
                                                        <td className="table-cell">
                                                            {row.linkedPurchaseReturn?.returnNumber || t('emdash')}
                                                        </td>
                                                        <td className="table-cell">
                                                            {row.linkedPurchaseReturn ? (
                                                                <span
                                                                    className={
                                                                        returnStatusBadge(
                                                                            row.linkedPurchaseReturn.status,
                                                                            row,
                                                                            t,
                                                                        ).cls
                                                                    }
                                                                >
                                                                    {linkedPurchaseStatus(row, t)}
                                                                </span>
                                                            ) : (
                                                                t('emdash')
                                                            )}
                                                        </td>
                                                        <td className="table-cell">
                                                            <div style={{ display: 'flex', gap: 6 }}>
                                                                {canApprove ? (
                                                                    <button
                                                                        type="button"
                                                                        className="btn-portal"
                                                                        style={{ padding: '6px 10px' }}
                                                                        onClick={() => handleApproveReturn(row)}
                                                                        disabled={approvingId !== null}
                                                                        title={t('btn.approveTitle')}
                                                                    >
                                                                        <Check size={15} />
                                                                    </button>
                                                                ) : null}
                                                                <button
                                                                    type="button"
                                                                    className="btn-portal-outline"
                                                                    style={{ padding: '6px 10px' }}
                                                                    onClick={() => handleViewReturn(row)}
                                                                    title={t('btn.viewTitle')}
                                                                >
                                                                    <Eye size={15} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </>
            ) : null}

            {formOpen ? (
                <InlineFormScreen
                    title={
                        <div className="pi-modal-title">
                            <span className="pi-breadcrumb">
                                {t('form.breadcrumbParent')} ›{' '}
                                <span className="pi-b-active">{t('form.breadcrumbNewLeaf')}</span>
                            </span>
                            <div className="pi-title-main">
                                <RotateCcw size={24} />
                                <span>{t('form.title')}</span>
                            </div>
                        </div>
                    }
                    onBack={closeForm}
                    backLabel={t('btn.backList')}
                    bodyClassName="supplier-affiliated-return-form-body"
                    footer={
                        <div className="pi-modal-footer">
                            <div className="pi-footer-left">
                                <button
                                    type="button"
                                    className="btn-pi-cancel"
                                    onClick={closeForm}
                                    disabled={saving}
                                >
                                    {t('btn.cancel')}
                                </button>
                            </div>
                            <div className="pi-footer-right">
                                {formError ? (
                                    <div
                                        style={{
                                            flex: '1 1 100%',
                                            marginBottom: 8,
                                            padding: '8px 12px',
                                            borderRadius: 8,
                                            fontSize: '0.8125rem',
                                            color: '#B91C1C',
                                            border: '1px solid #FECACA',
                                            background: '#FEF2F2',
                                        }}
                                    >
                                        {formError}
                                    </div>
                                ) : null}
                                <button
                                    type="button"
                                    className="btn-pi-create"
                                    onClick={handleSubmit}
                                    disabled={saving || invoiceLoading}
                                >
                                    {saving ? (
                                        <span
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: 8,
                                            }}
                                        >
                                            <Loader2
                                                size={16}
                                                className="supplier-sales-last-sale-spinner"
                                                aria-hidden
                                            />
                                            {t('btn.creating')}
                                        </span>
                                    ) : (
                                        t('btn.createLinked')
                                    )}
                                </button>
                            </div>
                        </div>
                    }
                >
                    <form className="pi-form-container" onSubmit={handleSubmit}>
                        {invoiceLoading ? (
                            <div style={{ padding: '12px 0 24px' }}>
                                <ShimmerTextBlock lines={5} />
                                <div style={{ marginTop: 18 }}>
                                    <ShimmerTable rows={5} columns={6} />
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="pi-ap-alert" style={{ marginBottom: 24 }}>
                                    <span>{t('form.alert')}</span>
                                </div>

                                <div className="pi-header-grid">
                                    <div className="pi-field pi-full-width">
                                        <label>
                                            {t('form.salesInvoice')}{' '}
                                            <span style={{ fontWeight: 400, color: '#94A3B8' }}>
                                                {t('form.optional')}
                                            </span>
                                        </label>
                                        <SearchableEntityCombobox
                                            className="supplier-sales-invoice-return-combobox"
                                            menuMinWidth={520}
                                            portalClassName="supplier-invoice-combobox-menu"
                                            options={invoiceComboboxOptions}
                                            value={selectedInvoiceId}
                                            displayText={invoiceSearchDraft}
                                            entityLabel="invoice"
                                            loading={invoicesLoading}
                                            placeholder={t('form.invoicePlaceholder')}
                                            emptyHint={
                                                invoicesLoading
                                                    ? t('form.loadingInvoices')
                                                    : invoices.length === 0
                                                      ? t('form.noInvoices')
                                                      : t('form.noMatches')
                                            }
                                            disabled={saving}
                                            onDisplayTextChange={(text) => {
                                                setInvoiceSearchDraft(text);
                                                if (!text.trim()) {
                                                    setSelectedInvoiceId('');
                                                    return;
                                                }
                                                if (selectedInvoiceId && selectedInvoiceMeta) {
                                                    const selectedLabel = salesInvoiceSelectedDisplay(
                                                        selectedInvoiceMeta,
                                                    );
                                                    if (text.trim() !== selectedLabel.trim()) {
                                                        setSelectedInvoiceId('');
                                                    }
                                                }
                                            }}
                                            onSelect={(opt) => {
                                                const inv = invoices.find(
                                                    (row) => String(row.id) === String(opt.id),
                                                );
                                                setSelectedInvoiceId(String(opt.id));
                                                setInvoiceSearchDraft(
                                                    inv ? salesInvoiceSelectedDisplay(inv) : opt.label || '',
                                                );
                                            }}
                                        />
                                        {!invoicesLoading && invoices.length > 0 ? (
                                            <span className="pi-hint" style={{ marginTop: 6, display: 'block' }}>
                                                {t('form.invoiceHint', {
                                                    n: invoices.length,
                                                    s: invoices.length === 1 ? '' : 's',
                                                })}
                                            </span>
                                        ) : null}
                                    </div>
                                </div>

                                {invoiceDetail ? (
                                    <>
                                        <div className="pi-header-grid">
                                            <div className="pi-field">
                                                <label>{t('form.invoiceNo')}</label>
                                                <input readOnly value={invoiceDetail.invoiceNo || t('emdash')} />
                                            </div>
                                            <div className="pi-field">
                                                <label>{t('form.issueDate')}</label>
                                                <input
                                                    readOnly
                                                    value={invoiceDetail.invoiceDate?.slice(0, 10) || t('emdash')}
                                                />
                                            </div>
                                            <div className="pi-field">
                                                <label>{t('form.dueDate')}</label>
                                                <input
                                                    readOnly
                                                    value={invoiceDetail.dueDate?.slice(0, 10) || t('emdash')}
                                                />
                                            </div>
                                        </div>
                                        <div className="pi-header-grid">
                                            <div className="pi-field pi-full-width">
                                                <label>{t('form.customer')}</label>
                                                <input
                                                    readOnly
                                                    value={
                                                        selectedInvoiceMeta?.workshopName &&
                                                        selectedInvoiceMeta?.branch
                                                            ? `${selectedInvoiceMeta.workshopName} — ${selectedInvoiceMeta.branch}`
                                                            : selectedInvoiceMeta?.branch ||
                                                              selectedInvoiceMeta?.workshopName ||
                                                              t('emdash')
                                                    }
                                                />
                                            </div>
                                        </div>
                                        <div className="pi-header-grid">
                                            <div className="pi-field">
                                                <label>{t('form.grandTotal')}</label>
                                                <input
                                                    readOnly
                                                    value={t('money.sar', {
                                                        amount: sarFmt(invoiceDetail.grandTotal),
                                                    })}
                                                />
                                            </div>
                                            <div className="pi-field">
                                                <label>{t('form.paid')}</label>
                                                <input
                                                    readOnly
                                                    value={t('money.sar', {
                                                        amount: sarFmt(invoiceDetail.paid),
                                                    })}
                                                />
                                            </div>
                                            <div className="pi-field">
                                                <label>{t('form.balanceDue')}</label>
                                                <input
                                                    readOnly
                                                    style={{ fontWeight: 700, color: '#b91c1c' }}
                                                    value={t('money.sar', {
                                                        amount: sarFmt(invoiceDetail.outstanding),
                                                    })}
                                                />
                                            </div>
                                        </div>
                                    </>
                                ) : null}

                                <div className="pi-header-grid">
                                    <div className="pi-field">
                                        <label>{t('form.returnDate')}</label>
                                        <input
                                            type="date"
                                            value={returnDate}
                                            onChange={(e) => setReturnDate(e.target.value)}
                                            disabled={saving}
                                        />
                                    </div>
                                    <div className="pi-field">
                                        <label>{t('form.reference')}</label>
                                        <input
                                            value={reference}
                                            onChange={(e) => setReference(e.target.value)}
                                            placeholder={t('form.referencePh')}
                                            disabled={saving}
                                        />
                                    </div>
                                    <div className="pi-field">
                                        <label>{t('form.description')}</label>
                                        <input
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            placeholder={t('form.descriptionPh')}
                                            disabled={saving}
                                        />
                                    </div>
                                </div>

                                {returnHistory.length > 0 ? (
                                    <div
                                        style={{
                                            marginBottom: 20,
                                            padding: '12px 14px',
                                            background: '#F8FAFC',
                                            borderRadius: 10,
                                            border: '1px solid #E2E8F0',
                                            fontSize: '0.8125rem',
                                        }}
                                    >
                                        <div
                                            style={{
                                                fontSize: '0.75rem',
                                                fontWeight: 700,
                                                color: '#334155',
                                                marginBottom: 8,
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.04em',
                                            }}
                                        >
                                            {t('form.prevReturns', { n: returnHistory.length })}
                                        </div>
                                        <ul style={{ margin: 0, paddingLeft: 18, color: '#64748B' }}>
                                            {returnHistory.map((r) => (
                                                <li key={r.id} style={{ marginBottom: 6 }}>
                                                    <strong>{r.returnNo}</strong> ·{' '}
                                                    {r.returnDate?.slice(0, 10) || t('emdash')} ·{' '}
                                                    {t('money.sar', { amount: sarFmt(r.grandTotal) })}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ) : null}

                                <div className="pi-lines-section">
                                    <div
                                        className="pi-lines-header"
                                        style={{
                                            gridTemplateColumns: lineGridCols,
                                        }}
                                    >
                                        <div className="pi-col-item">{t('form.col.item')}</div>
                                        <div className="pi-col-qty">{t('form.col.invoiced')}</div>
                                        <div className="pi-col-qty">{t('form.col.returned')}</div>
                                        <div className="pi-col-qty">{t('form.col.left')}</div>
                                        <div className="pi-col-qty">{t('form.col.returnQty')}</div>
                                        <div className="pi-col-item">{t('form.col.reason')}</div>
                                    </div>
                                    {!selectedInvoiceId ? (
                                        <div
                                            className="pi-line-row"
                                            style={{
                                                justifyContent: 'center',
                                                color: '#64748B',
                                                fontSize: '0.875rem',
                                                margin: '8px',
                                                textAlign: 'center',
                                                padding: '20px 16px',
                                            }}
                                        >
                                            {t('form.noInvoiceLines')}
                                        </div>
                                    ) : (invoiceDetail?.items || []).length === 0 ? (
                                        <div
                                            className="pi-line-row"
                                            style={{
                                                justifyContent: 'center',
                                                color: '#64748B',
                                                fontSize: '0.875rem',
                                                margin: '8px',
                                            }}
                                        >
                                            {t('form.noLineItems')}
                                        </div>
                                    ) : (
                                        (invoiceDetail?.items || []).map((it) => {
                                            const id = String(it.id);
                                            const orig = Number(it.qty);
                                            const already = returnedSoFar.get(id) || 0;
                                            const remaining = Math.max(0, orig - already);
                                            return (
                                                <div
                                                    key={id}
                                                    className="pi-lines-header pi-line-data-row"
                                                    style={{
                                                        gridTemplateColumns: lineGridCols,
                                                        alignItems: 'center',
                                                    }}
                                                >
                                                    <div className="pi-col-item" style={{ minWidth: 0 }}>
                                                        <span style={{ fontWeight: 600 }}>
                                                            {it.productName || t('emdash')}
                                                        </span>
                                                        {it.unit ? (
                                                            <span
                                                                style={{
                                                                    display: 'block',
                                                                    fontSize: '0.75rem',
                                                                    color: '#94A3B8',
                                                                }}
                                                            >
                                                                {it.unit}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    <div className="pi-col-qty">{orig}</div>
                                                    <div className="pi-col-qty">{already}</div>
                                                    <div
                                                        className="pi-col-qty"
                                                        style={{
                                                            fontWeight: remaining <= 0 ? 600 : 500,
                                                            color: remaining <= 0 ? '#94A3B8' : '#0f172a',
                                                        }}
                                                    >
                                                        {remaining}
                                                    </div>
                                                    <div className="pi-col-qty">
                                                        {remaining <= 0 ? (
                                                            <span style={{ color: '#94A3B8' }}>{t('emdash')}</span>
                                                        ) : (
                                                            <input
                                                                type="text"
                                                                inputMode="decimal"
                                                                className="pi-row-input"
                                                                value={lineQty[id] ?? ''}
                                                                onChange={(e) =>
                                                                    setLineQty((prev) => ({
                                                                        ...prev,
                                                                        [id]: e.target.value,
                                                                    }))
                                                                }
                                                                placeholder="0"
                                                                disabled={saving}
                                                            />
                                                        )}
                                                    </div>
                                                    <div className="pi-col-item" style={{ minWidth: 0 }}>
                                                        <input
                                                            type="text"
                                                            className="pi-row-input"
                                                            value={lineReason[id] ?? ''}
                                                            onChange={(e) =>
                                                                setLineReason((prev) => ({
                                                                    ...prev,
                                                                    [id]: e.target.value,
                                                                }))
                                                            }
                                                            placeholder={t('form.reasonPh')}
                                                            disabled={saving || remaining <= 0}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                <div className="pi-footer-grid" style={{ marginTop: 8 }}>
                                    <div>
                                        <div className="pi-field pi-full-width">
                                            <label>{t('form.notes')}</label>
                                            <textarea
                                                rows={4}
                                                value={notes}
                                                onChange={(e) => setNotes(e.target.value)}
                                                disabled={saving}
                                                placeholder={t('form.notesPh')}
                                            />
                                        </div>
                                    </div>
                                    <div className="pi-footer-column pi-summary-column">
                                        <div className="pi-summary-card">
                                            <div className="pi-summary-row pi-grand-total">
                                                <span>{t('form.returnTotal')}</span>
                                                <span>
                                                    {t('money.sar', { amount: sarFmt(totalSelected) })}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="pi-ap-alert">
                                            <span>{t('form.footerAlert')}</span>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </form>
                </InlineFormScreen>
            ) : null}

            {viewReturnId ? (
                <InlineFormScreen
                    title={
                        <div className="pi-modal-title">
                            <span className="pi-breadcrumb">
                                {t('page.breadcrumb')} ›{' '}
                                <span className="pi-b-active">
                                    {viewReturnDetail?.returnNumber || t('fallback.return')}
                                </span>
                            </span>
                            <div className="pi-title-main">
                                <RotateCcw size={24} />
                                <span>{t('view.creditNote')}</span>
                            </div>
                        </div>
                    }
                    onBack={closeViewReturn}
                    backLabel={t('btn.backReturns')}
                    bodyClassName="supplier-affiliated-return-view-body"
                >
                    {viewReturnLoading ? (
                        <ShimmerTextBlock lines={12} />
                    ) : viewReturnDetail ? (
                        <WorkshopPurchaseReturnDetailView
                            detail={viewReturnDetail}
                            variant="supplier"
                            compact
                        />
                    ) : (
                        <p style={{ margin: 0, color: '#64748b' }}>{t('view.loadFailed')}</p>
                    )}
                </InlineFormScreen>
            ) : null}
        </div>
    );
}
