import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ShoppingCart, Plus, RefreshCw, Loader, AlertCircle, Eye } from 'lucide-react';
import WorkshopSubScreen from '../../components/workshop/WorkshopSubScreen';
import WorkshopAddSupplierScreen from './WorkshopAddSupplierScreen';
import { AnimatePresence } from 'framer-motion';
import WsTableScroll from '../../components/workshop/WsTableScroll';
import Modal from '../../components/Modal';
import { PI_INVENTORY_ITEMS } from './constants';
import { useAuth } from '../../context/AuthContext';

const SUPPLIER_TABS = [
    { id: 'suppliers', label: 'Suppliers',         permission: 'workshop.suppliers.list.view' },
    { id: 'purchases', label: 'Purchase History',  permission: 'workshop.suppliers.purchases.view' },
];
import {
    getWorkshopSuppliers,
    getRegisteredWorkshopSuppliers,
    listWorkshopSupplierPurchaseInvoices,
    getWorkshopSupplierPurchaseInvoice,
    branchScopeParams,
} from '../../services/workshopStaffApi';
import {
    normalizeWorkshopSupplierPurchaseInvoiceRow,
    unwrapWorkshopSupplierPurchaseInvoiceList,
    unwrapWorkshopStaffSupplierPurchaseInvoiceGet,
} from '../../services/workshopSupplierPurchaseInvoices';
import WorkshopPurchaseInvoiceView from '../../components/supplier/WorkshopPurchaseInvoiceView';

const SUPPLIERS_PAGE_LIMIT = 500;
const PURCHASES_PAGE_SIZE = 25;

function unwrapSuppliersResponse(res) {
    if (Array.isArray(res)) return res;
    if (!res || typeof res !== 'object') return [];
    const keys = ['suppliers', 'data', 'items'];
    for (const k of keys) {
        if (Array.isArray(res[k])) return res[k];
        if (Array.isArray(res?.data?.[k])) return res.data[k];
    }
    if (Array.isArray(res?.data)) return res.data;
    return [];
}

/** Top-level or nested pagination + workshop totals from GET /workshop-staff/suppliers. */
function pickListMeta(res) {
    if (!res || typeof res !== 'object') {
        return { total: null, limit: null, offset: null, outstanding: null, currencyCode: null };
    }
    const p = res.pagination;
    const total = res.total ?? p?.total ?? res.count ?? null;
    const limit = res.limit ?? p?.limit ?? null;
    const offset = res.offset ?? p?.offset ?? null;
    const outstanding = res.outstanding ?? res.totalOutstanding ?? null;
    const currencyCode = res.currencyCode ?? res.currency ?? null;
    return { total: total != null ? Number(total) : null, limit, offset, outstanding, currencyCode };
}

/** Align list rows with admin supplier screen + workshop API aliases. */
function normalizeSupplierRow(s) {
    const status =
        s.status === 'inactive' || s.status === 'active'
            ? s.status
            : s.isActive === false
              ? 'inactive'
              : 'active';
    const regType = s.registrationType ?? s.type ?? '';
    let category = s.category ?? regType ?? '—';
    if (regType === 'workshop_local' || category === 'workshop_local') {
        category = 'Workshop only';
    }
    return {
        id: String(s.id ?? s._id ?? ''),
        name: s.supplierName ?? s.name ?? '—',
        category,
        vatId: s.vatId ?? s.taxId ?? s.vat_id ?? '',
        crNumber: s.tradeLicenseNo ?? s.crNumber ?? s.cr_no ?? s.commercialRegistration ?? '',
        contactPerson: s.contactPerson ?? s.ownerName ?? '',
        phone: s.phone ?? s.mobile ?? s.contactPhone ?? '',
        email: s.email ?? '',
        status,
        raw: s,
    };
}

function purchaseInvoiceStatusBadgeClass(status) {
    const s = String(status || '').toLowerCase();
    if (['approved', 'received', 'completed', 'stock_applied'].includes(s)) return 'ws-badge--green';
    if (['rejected', 'cancelled'].includes(s)) return 'ws-badge--red';
    if (s === 'draft') return 'ws-badge--gray';
    return 'ws-badge--yellow';
}

function purchasePaymentBadgeClass(paymentStatus) {
    const s = String(paymentStatus || '').toLowerCase();
    if (s === 'paid') return 'ws-badge--green';
    if (s === 'partially_paid' || s === 'partial') return 'ws-badge--yellow';
    return 'ws-badge--red';
}

/** Paginated purchase history + full-page invoice view — remounted when branch changes (key on parent) so page resets. */
function SuppliersPurchaseHistoryPanel({ selectedBranchId }) {
    const [page, setPage] = useState(1);
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [viewRow, setViewRow] = useState(null);
    const [viewDetail, setViewDetail] = useState(null);
    const [viewLoading, setViewLoading] = useState(false);
    const [viewError, setViewError] = useState('');

    const offset = (page - 1) * PURCHASES_PAGE_SIZE;

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await listWorkshopSupplierPurchaseInvoices({
                limit: PURCHASES_PAGE_SIZE,
                offset,
                ...branchScopeParams(selectedBranchId),
            });
            const list = unwrapWorkshopSupplierPurchaseInvoiceList(res);
            const mapped = list.map(normalizeWorkshopSupplierPurchaseInvoiceRow).filter(Boolean);
            setRows(mapped);
            const tRaw = res?.total ?? res?.count;
            const t = tRaw != null ? Number(tRaw) : mapped.length;
            setTotal(Number.isFinite(t) ? t : mapped.length);
        } catch (e) {
            setRows([]);
            setTotal(null);
            setError(e.message || 'Could not load purchase history.');
        } finally {
            setLoading(false);
        }
    }, [selectedBranchId, offset]);

    useEffect(() => {
        load();
    }, [load]);

    const totalPages = Math.max(1, Math.ceil(((total ?? 0) || 0) / PURCHASES_PAGE_SIZE));

    const closeView = () => {
        setViewRow(null);
        setViewDetail(null);
        setViewError('');
        setViewLoading(false);
    };

    const openView = async (row) => {
        if (!row?.id) return;
        setViewRow(row);
        setViewDetail(null);
        setViewLoading(true);
        setViewError('');
        try {
            const res = await getWorkshopSupplierPurchaseInvoice(row.id);
            const inv = unwrapWorkshopStaffSupplierPurchaseInvoiceGet(res);
            setViewDetail(inv && typeof inv === 'object' ? inv : null);
            if (!inv) setViewError('Invoice response was empty.');
        } catch (e) {
            setViewError(e.message || 'Could not load invoice details.');
        } finally {
            setViewLoading(false);
        }
    };

    const rangeLabel =
        total != null && total > 0
            ? `${offset + 1}–${Math.min(offset + rows.length, total)} of ${total}`
            : rows.length > 0
              ? `${offset + 1}–${offset + rows.length}`
              : '0';

    if (viewRow) {
        return (
            <WorkshopSubScreen
                title={`Purchase invoice ${viewRow.invoice_number || viewRow.id}`}
                subtitle={viewRow.vendor_name || undefined}
                backLabel="Back to Purchase History"
                onBack={closeView}
                size="xl"
            >
                {viewError ? (
                    <div
                        style={{
                            marginBottom: 12,
                            padding: '10px 14px',
                            borderRadius: 8,
                            background: '#FEF2F2',
                            border: '1px solid #FECACA',
                            color: '#B91C1C',
                            fontSize: '0.875rem',
                        }}
                    >
                        {viewError}
                    </div>
                ) : null}
                {viewLoading ? (
                    <p style={{ marginBottom: 12, fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                        Loading full invoice…
                    </p>
                ) : null}
                {!viewLoading && viewDetail ? (
                    <WorkshopPurchaseInvoiceView detail={viewDetail} listRow={viewRow} />
                ) : null}
                {!viewLoading && !viewDetail && viewError ? (
                    <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Unable to display this invoice.</p>
                ) : null}
            </WorkshopSubScreen>
        );
    }

    return (
        <>
            <div className="ws-section">
                <div
                    style={{
                        padding: '12px 16px',
                        display: 'flex',
                        gap: 12,
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        borderBottom: '1px solid var(--color-border)',
                    }}
                >
                    <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', flex: 1, minWidth: 160 }}>
                        Workshop purchase invoices sent to suppliers
                        {selectedBranchId && selectedBranchId !== 'all' ? (
                            <>
                                {' '}
                                · Branch filter applies
                            </>
                        ) : (
                            <> · All branches</>
                        )}
                        {' · '}
                        <span style={{ fontWeight: 600, color: 'var(--color-text-body)' }}>{rangeLabel}</span>
                    </span>
                    <button
                        type="button"
                        className="mc-btn-ghost"
                        onClick={() => load()}
                        disabled={loading}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                        <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
                    </button>
                </div>
                {error && (
                    <div
                        style={{
                            padding: 12,
                            margin: '0 16px 12px',
                            borderRadius: 8,
                            border: '1px solid #FECACA',
                            background: '#FEF2F2',
                            color: '#991B1B',
                            fontSize: '0.8125rem',
                        }}
                    >
                        {error}
                    </div>
                )}
                <WsTableScroll>
                <table className="ws-table">
                    <thead>
                        <tr>
                            <th>Invoice #</th>
                            <th>Vendor</th>
                            <th>Grand Total</th>
                            <th>VAT</th>
                            <th>Status</th>
                            <th>Payment</th>
                            <th style={{ width: 88 }}> </th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={7} style={{ textAlign: 'center', padding: 32 }}>
                                    <Loader className="spin" size={24} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} />
                                    Loading purchase history…
                                </td>
                            </tr>
                        ) : (
                            rows.map((p) => (
                                <tr key={p.id}>
                                    <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                                        {p.invoice_number}
                                    </td>
                                    <td>{p.vendor_name || '—'}</td>
                                    <td>
                                        <strong>
                                            SAR{' '}
                                            {Number(p.grand_total || 0).toLocaleString(undefined, {
                                                minimumFractionDigits: 0,
                                                maximumFractionDigits: 2,
                                            })}
                                        </strong>
                                    </td>
                                    <td style={{ color: 'var(--color-text-muted)' }}>
                                        SAR{' '}
                                        {Number(p.vat_amount || 0).toLocaleString(undefined, {
                                            minimumFractionDigits: 0,
                                            maximumFractionDigits: 2,
                                        })}
                                    </td>
                                    <td>
                                        <span className={`ws-badge ${purchaseInvoiceStatusBadgeClass(p.status)}`}>
                                            {p.status}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`ws-badge ${purchasePaymentBadgeClass(p.payment_status)}`}>
                                            {p.payment_status}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        <button
                                            type="button"
                                            className="btn-portal"
                                            style={{ padding: '5px 10px', fontSize: '0.75rem' }}
                                            onClick={() => void openView(p)}
                                        >
                                            <Eye size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                                            View
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                        {!loading && rows.length === 0 && !error && (
                            <tr>
                                <td colSpan={7} style={{ textAlign: 'center', padding: 32 }}>
                                    No purchase invoices yet. Create them from the Purchases area or supplier actions.
                                </td>
                            </tr>
                        )}
                        {!loading && rows.length === 0 && error && (
                            <tr>
                                <td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-muted)' }}>
                                    Could not load rows — see message above.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
                </WsTableScroll>
                {!loading && total != null && total > PURCHASES_PAGE_SIZE ? (
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 12,
                            padding: '12px 16px',
                            borderTop: '1px solid var(--color-border)',
                            flexWrap: 'wrap',
                        }}
                    >
                        <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                            Page {page} of {totalPages}
                        </span>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button
                                type="button"
                                className="btn-secondary"
                                disabled={page <= 1}
                                onClick={() => setPage((x) => Math.max(1, x - 1))}
                            >
                                Previous
                            </button>
                            <button
                                type="button"
                                className="btn-secondary"
                                disabled={page >= totalPages}
                                onClick={() => setPage((x) => Math.min(totalPages, x + 1))}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                ) : null}
            </div>
        </>
    );
}

export default function WorkshopSuppliers({ selectedBranchId = 'all', branches = [], onTabChange }) {
    const branchLabel = useMemo(() => {
        if (!selectedBranchId || selectedBranchId === 'all') return 'All branches';
        return branches.find((b) => String(b.id) === String(selectedBranchId))?.name || 'Branch';
    }, [branches, selectedBranchId]);
    const { hasPermission } = useAuth();
    const visibleSupplierTabs = SUPPLIER_TABS.filter((t) => hasPermission(t.permission));
    const [activeTab, setActiveTab] = useState(() => visibleSupplierTabs[0]?.id ?? 'suppliers');
    useEffect(() => {
        if (visibleSupplierTabs.length === 0) return;
        if (!visibleSupplierTabs.some((t) => t.id === activeTab)) {
            setActiveTab(visibleSupplierTabs[0].id);
        }
    }, [visibleSupplierTabs, activeTab]);
    const [searchInput, setSearchInput] = useState('');
    const [suppliers, setSuppliers] = useState([]);
    const [listMeta, setListMeta] = useState({
        total: null,
        outstanding: null,
        currencyCode: null,
    });
    const [loading, setLoading] = useState(true);
    const [listError, setListError] = useState('');
    const [usingRegisteredFallback, setUsingRegisteredFallback] = useState(false);
    const [showAddSupplierScreen, setShowAddSupplierScreen] = useState(false);

    const [showPurchaseForm, setShowPurchaseForm] = useState(false);
    const [selectedSupplier, setSelectedSupplier] = useState(null);
    const [items, setItems] = useState([{ product_id: '', product_name: '', quantity: 1, unit: 'piece', unit_price: 0, total: 0 }]);
    const [notes, setNotes] = useState('');
    const products = PI_INVENTORY_ITEMS;

    const loadSuppliers = useCallback(async (queryForApi) => {
        setLoading(true);
        setListError('');
        setUsingRegisteredFallback(false);
        const q = String(queryForApi ?? '').trim();
        const baseParams = q ? { q } : {};
        try {
            let offset = 0;
            const merged = [];
            let lastMeta = { total: null, outstanding: null, currencyCode: null };
            let hardCap = 60;
            while (hardCap-- > 0) {
                const res = await getWorkshopSuppliers({
                    ...baseParams,
                    ...branchScopeParams(selectedBranchId),
                    limit: SUPPLIERS_PAGE_LIMIT,
                    offset,
                });
                const rows = unwrapSuppliersResponse(res).map(normalizeSupplierRow).filter((r) => r.id);
                merged.push(...rows);
                lastMeta = pickListMeta(res);
                const total = lastMeta.total;
                if (total != null && merged.length >= total) break;
                if (rows.length < SUPPLIERS_PAGE_LIMIT) break;
                offset += SUPPLIERS_PAGE_LIMIT;
            }
            setSuppliers(merged);
            setListMeta({
                total: lastMeta.total != null ? lastMeta.total : merged.length,
                outstanding: lastMeta.outstanding,
                currencyCode: lastMeta.currencyCode,
            });
        } catch (e) {
            const msg = String(e?.message || '');
            const missingWorkshopIdColumn =
                msg.includes('suppliers.workshop_id') || msg.includes('workshop_id');
            const unauthorized =
                /unauthorized|401|forbidden|403|jwt|token/i.test(msg);
            if (missingWorkshopIdColumn || unauthorized) {
                try {
                    const res = await getRegisteredWorkshopSuppliers({
                        ...(q ? { q } : {}),
                        limit: SUPPLIERS_PAGE_LIMIT,
                        offset: 0,
                    });
                    const rows = unwrapSuppliersResponse(res)
                        .map(normalizeSupplierRow)
                        .filter((r) => r.id);
                    const linkedOnly = rows.filter(
                        (r) =>
                            r?.raw?.isLinkedToWorkshop === true ||
                            r?.raw?.is_linked_to_workshop === true ||
                            r?.raw?.linkedToWorkshop === true,
                    );
                    setSuppliers(linkedOnly);
                    setListMeta({
                        total: linkedOnly.length,
                        outstanding: null,
                        currencyCode: null,
                    });
                    setUsingRegisteredFallback(true);
                    setListError(
                        missingWorkshopIdColumn
                            ? 'Loaded via fallback: /workshop-staff/suppliers currently fails due backend schema (missing suppliers.workshop_id).'
                            : 'Loaded via fallback: /workshop-staff/suppliers is not authorized for this session/token.',
                    );
                    return;
                } catch {
                    // fallthrough to standard error below
                }
            }
            setListError(e.message || 'Could not load suppliers.');
            setSuppliers([]);
            setListMeta({ total: null, outstanding: null, currencyCode: null });
        } finally {
            setLoading(false);
        }
    }, [selectedBranchId]);

    useEffect(() => {
        const t = setTimeout(() => {
            loadSuppliers(searchInput);
        }, 320);
        return () => clearTimeout(t);
    }, [searchInput, loadSuppliers]);

    const listSummaryLine = useMemo(() => {
        const parts = [];
        if (listMeta.total != null && suppliers.length > 0) {
            if (suppliers.length < listMeta.total) {
                parts.push(`${suppliers.length} of ${listMeta.total} suppliers`);
            } else {
                parts.push(`${suppliers.length} supplier${suppliers.length === 1 ? '' : 's'}`);
            }
        }
        if (listMeta.outstanding != null && listMeta.currencyCode) {
            parts.push(`Outstanding: ${listMeta.outstanding} ${listMeta.currencyCode}`);
        } else if (listMeta.outstanding != null) {
            parts.push(`Outstanding: ${listMeta.outstanding}`);
        }
        return parts.join(' · ');
    }, [suppliers.length, listMeta.total, listMeta.outstanding, listMeta.currencyCode]);

    const subtotal = items.reduce((s, i) => s + (i.total || 0), 0);
    const vat = subtotal * 0.15;
    const grandTotal = subtotal + vat;

    const updateItem = (idx, key, val) => {
        setItems((prev) =>
            prev.map((item, i) => {
                if (i !== idx) return item;
                const updated = { ...item, [key]: val };
                if (key === 'quantity' || key === 'unit_price') {
                    updated.total = (updated.quantity || 0) * (updated.unit_price || 0);
                }
                if (key === 'product_id') {
                    const prod = products.find((p) => p.id === val);
                    if (prod) {
                        updated.product_name = prod.name;
                        updated.unit_price = prod.price || 0;
                        updated.unit = prod.unit || 'piece';
                        updated.total = (updated.quantity || 1) * (prod.price || 0);
                    }
                }
                return updated;
            }),
        );
    };

    const submitPurchase = () => {
        if (!selectedSupplier) return;
        setShowPurchaseForm(false);
        setSelectedSupplier(null);
        setItems([{ product_id: '', product_name: '', quantity: 1, unit: 'piece', unit_price: 0, total: 0 }]);
        setNotes('');
    };

    if (showAddSupplierScreen) {
        return (
            <WorkshopAddSupplierScreen
                onBack={() => setShowAddSupplierScreen(false)}
                onSuccess={() => loadSuppliers(searchInput)}
            />
        );
    }

    if (showPurchaseForm && selectedSupplier) {
        return (
            <WorkshopSubScreen
                title={`Add Purchase Invoice — ${selectedSupplier.name}`}
                backLabel="Back to Suppliers"
                onBack={() => {
                    setShowPurchaseForm(false);
                    setSelectedSupplier(null);
                }}
                size="wide"
                footer={
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                        <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => {
                                setShowPurchaseForm(false);
                                setSelectedSupplier(null);
                            }}
                        >
                            Cancel
                        </button>
                        <button type="button" className="btn-submit" onClick={submitPurchase}>
                            Submit Purchase Invoice
                        </button>
                    </div>
                }
            >
                <div className="ws-section" style={{ padding: 20 }}>
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: 6 }}>
                            Items
                        </label>
                        {items.map((item, idx) => (
                            <div
                                key={idx}
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '2fr 80px 100px 80px 40px',
                                    gap: 8,
                                    alignItems: 'center',
                                    marginBottom: 8,
                                }}
                            >
                                <select
                                    value={item.product_id}
                                    onChange={(e) => updateItem(idx, 'product_id', e.target.value)}
                                    style={{
                                        padding: '8px 12px',
                                        borderRadius: 8,
                                        border: '1px solid var(--color-border)',
                                        fontSize: '0.8125rem',
                                    }}
                                >
                                    <option value="">Product</option>
                                    {products.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name}
                                        </option>
                                    ))}
                                </select>
                                <input
                                    type="number"
                                    placeholder="Qty"
                                    value={item.quantity}
                                    onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                                    style={{
                                        padding: '8px 12px',
                                        borderRadius: 8,
                                        border: '1px solid var(--color-border)',
                                    }}
                                />
                                <input
                                    type="number"
                                    placeholder="Unit Price"
                                    value={item.unit_price}
                                    onChange={(e) => updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                                    style={{
                                        padding: '8px 12px',
                                        borderRadius: 8,
                                        border: '1px solid var(--color-border)',
                                    }}
                                />
                                <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                                    SAR {(item.total || 0).toFixed(0)}
                                </span>
                                {items.length > 1 ? (
                                    <button
                                        type="button"
                                        onClick={() => setItems((i) => i.filter((_, ii) => ii !== idx))}
                                        style={{
                                            color: '#DC2626',
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        ×
                                    </button>
                                ) : null}
                            </div>
                        ))}
                        <button
                            type="button"
                            className="btn-secondary"
                            style={{ padding: '6px 12px' }}
                            onClick={() =>
                                setItems((i) => [
                                    ...i,
                                    {
                                        product_id: '',
                                        product_name: '',
                                        quantity: 1,
                                        unit: 'piece',
                                        unit_price: 0,
                                        total: 0,
                                    },
                                ])
                            }
                        >
                            <Plus size={14} /> Add Item
                        </button>
                    </div>
                    <div
                        style={{
                            background: 'var(--color-bg-muted)',
                            borderRadius: 10,
                            padding: 12,
                            marginBottom: 12,
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ color: 'var(--color-text-muted)' }}>Subtotal</span>
                            <span>SAR {subtotal.toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ color: 'var(--color-text-muted)' }}>VAT 15%</span>
                            <span>SAR {vat.toFixed(2)}</span>
                        </div>
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                fontWeight: 800,
                                paddingTop: 8,
                                borderTop: '1px solid var(--color-border)',
                            }}
                        >
                            <span>Grand Total</span>
                            <span>SAR {grandTotal.toFixed(2)}</span>
                        </div>
                    </div>
                    <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: 6 }}>
                            Notes
                        </label>
                        <input
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Optional notes…"
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                borderRadius: 8,
                                border: '1px solid var(--color-border)',
                            }}
                        />
                    </div>
                </div>
            </WorkshopSubScreen>
        );
    }

    return (
        <div>
            <div className="ws-page-header">
                <div>
                    <h2 className="ws-page-title">Suppliers & Purchases</h2>
                    <p className="ws-page-sub">
                        Manage vendors and purchase invoices · <strong>{branchLabel}</strong>
                    </p>
                </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {visibleSupplierTabs.map((t) => {
                    const active = activeTab === t.id;
                    return (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => setActiveTab(t.id)}
                            style={{
                                padding: '8px 16px',
                                borderRadius: 8,
                                background: active ? 'var(--color-text-dark)' : '#fff',
                                color: active ? 'var(--color-primary)' : 'var(--color-text-body)',
                                fontWeight: 700,
                                cursor: 'pointer',
                                border: active ? 'none' : '1px solid var(--color-border)',
                            }}
                        >
                            {t.label}
                        </button>
                    );
                })}
            </div>
            {activeTab === 'suppliers' && (
                <>
                    <div className="ws-section" style={{ marginBottom: 16 }}>
                        <div style={{ padding: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                            <input
                                placeholder="Search suppliers (name, phone, CR, VAT, category)…"
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                style={{
                                    flex: 1,
                                    minWidth: 200,
                                    maxWidth: 400,
                                    padding: '8px 14px',
                                    borderRadius: 8,
                                    border: '1px solid var(--color-border)',
                                    fontSize: '0.875rem',
                                }}
                            />
                            <button
                                type="button"
                                className="mc-btn-ghost"
                                onClick={() => loadSuppliers(searchInput)}
                                disabled={loading}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                            >
                                <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
                            </button>
                            <button
                                type="button"
                                className="btn-portal"
                                onClick={() => setShowAddSupplierScreen(true)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                            >
                                <Plus size={14} /> Add Supplier
                            </button>
                        </div>
                        {listSummaryLine && !listError ? (
                            <div
                                style={{
                                    padding: '0 16px 12px',
                                    fontSize: '0.8125rem',
                                    color: 'var(--color-text-body)',
                                    opacity: 0.85,
                                }}
                            >
                                {listSummaryLine}
                            </div>
                        ) : null}
                    </div>
                    {listError && (
                        <div
                            className="ws-section"
                            style={{
                                padding: 14,
                                marginBottom: 16,
                                borderRadius: 10,
                                background: usingRegisteredFallback ? '#FEFCE8' : '#FEF2F2',
                                border: usingRegisteredFallback ? '1px solid #FDE68A' : '1px solid #FECACA',
                                color: usingRegisteredFallback ? '#854D0E' : '#991B1B',
                                fontSize: '0.875rem',
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 10,
                            }}
                        >
                            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                            <div>
                                <strong>{listError}</strong>
                                <p style={{ margin: '6px 0 0', opacity: 0.9 }}>
                                    {usingRegisteredFallback ? (
                                        <>
                                            Showing only rows with <code>isLinkedToWorkshop=true</code> from{' '}
                                            <code style={{ fontSize: '0.8rem' }}>
                                                GET /workshop-staff/suppliers/registered
                                            </code>{' '}
                                            until backend query is migrated to <code>workshop_suppliers</code>.
                                        </>
                                    ) : (
                                        <>
                                            The workshop portal expects{' '}
                                            <code style={{ fontSize: '0.8rem' }}>GET /workshop-staff/suppliers</code> with the
                                            workshop JWT. Optional: <code>q</code> or <code>search</code>, <code>limit</code> (≤500),{' '}
                                            <code>offset</code>.
                                        </>
                                    )}
                                </p>
                            </div>
                        </div>
                    )}
                    <div className="ws-section">
                        <WsTableScroll>
                <table className="ws-table">
                            <thead>
                                <tr>
                                    <th>Supplier Name</th>
                                    <th>Contact</th>
                                    <th>CR No</th>
                                    <th>VAT ID</th>
                                    <th>Category</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} style={{ textAlign: 'center', padding: 32 }}>
                                            <Loader className="spin" size={24} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} />
                                            Loading suppliers…
                                        </td>
                                    </tr>
                                ) : suppliers.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} style={{ textAlign: 'center', padding: 32 }}>
                                            {listError
                                                ? 'Unable to load suppliers — see message above.'
                                                : searchInput.trim()
                                                  ? 'No suppliers match your search.'
                                                  : 'No suppliers registered yet.'}
                                        </td>
                                    </tr>
                                ) : (
                                    suppliers.map((s) => (
                                        <tr key={s.id}>
                                            <td>
                                                <strong>{s.name}</strong>
                                                {s.status === 'inactive' && (
                                                    <span className="ws-badge ws-badge--gray" style={{ marginLeft: 8 }}>
                                                        Inactive
                                                    </span>
                                                )}
                                            </td>
                                            <td>{s.phone || s.contactPerson || '—'}</td>
                                            <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                                                {s.crNumber || '—'}
                                            </td>
                                            <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                                                {s.vatId || '—'}
                                            </td>
                                            <td>
                                                <span className="ws-badge ws-badge--gray">{s.category}</span>
                                            </td>
                                            <td>
                                                <button
                                                    type="button"
                                                    className="btn-portal"
                                                    style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                                                    onClick={() => {
                                                        if (typeof onTabChange === 'function') {
                                                            onTabChange('purchases', {
                                                                autoOpenModal: true,
                                                                prefillSupplier: {
                                                                    id: s.id,
                                                                    name: s.name,
                                                                },
                                                            });
                                                            return;
                                                        }
                                                        setSelectedSupplier(s);
                                                        setShowPurchaseForm(true);
                                                    }}
                                                >
                                                    <ShoppingCart size={12} style={{ marginRight: 4 }} />
                                                    Add Purchase
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                        </WsTableScroll>
                    </div>
                </>
            )}
            {activeTab === 'purchases' && (
                <SuppliersPurchaseHistoryPanel key={String(selectedBranchId)} selectedBranchId={selectedBranchId} />
            )}
        </div>
    );
}
