import { useState, useEffect, useCallback } from 'react';
import { Calendar, Plus, Eye, Loader2, Car, MapPin, Wrench, Clock, FileText, Package, Receipt } from 'lucide-react';
import { apiFetch } from '../../services/api';
import {
    fetchCorporateBookings,
    fetchCorporateBookingById,
    fetchCorporateBookingInvoice,
} from '../../services/corporateBookingsApi';
import Modal from '../../components/Modal';
import InvoiceDetailsModal from '../../components/pos/modern/InvoiceDetailsModal';

/**
 * Filter values for GET /corporate/bookings?status= — same strings as
 * `CorporateOrder.status` / linked `SalesOrder.status` (CB-* / SO-* rows).
 * Matches statuses used in the corporate portal list (e.g. submitted, approved, invoiced, cancelled).
 */
const BOOKING_STATUS_FILTER_OPTIONS = [
    { value: '', label: 'All statuses' },
    { value: 'draft', label: 'Draft' },
    { value: 'submitted', label: 'Submitted' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'invoiced', label: 'Invoiced' },
    { value: 'cancelled', label: 'Cancelled' },
];

/** Flatten `{ booking: { ... } }` so services/products sit on the object we read. */
function normalizeBookingDetailPayload(raw) {
    if (!raw || typeof raw !== 'object') return raw;
    const inner = raw.booking || raw.data?.booking;
    if (inner && typeof inner === 'object') {
        return { ...raw, ...inner };
    }
    return raw;
}

/** Matches backend monthly settlement (Pay Monthly / Monthly Billing, incl. `a|b` deferred snapshots). */
function isMonthlyBillingPaymentMethod(pm) {
    if (pm == null || typeof pm !== 'string') return false;
    const raw = pm.trim();
    if (!raw) return false;
    for (const part of raw.split('|')) {
        const n = part
            .trim()
            .toLowerCase()
            .replace(/_/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        if (
            n === 'pay monthly'
            || n === 'monthly billing'
            || n === 'monthly'
            || n === 'pay monthly billing'
        ) {
            return true;
        }
    }
    return false;
}

/** Invoice calendar month for Monthly billing tab (`?month=&year=`). */
function billingPeriodForMonthlyTab(o) {
    const inv = o.salesOrder?.invoice || o.sales_order?.invoice;
    const raw = inv?.invoiceDate ?? inv?.invoice_date;
    if (raw) {
        const dt = new Date(raw);
        if (!Number.isNaN(dt.getTime())) {
            return { month: dt.getUTCMonth() + 1, year: dt.getUTCFullYear() };
        }
    }
    const sub = o.submittedAt || o.submitted_at;
    if (sub) {
        const dt = new Date(sub);
        if (!Number.isNaN(dt.getTime())) {
            return { month: dt.getUTCMonth() + 1, year: dt.getUTCFullYear() };
        }
    }
    return null;
}

/** Newest bookings first; among same timestamp, monthly-billing rows sort slightly higher. */
function bookingSortTime(o) {
    const raw = o?.submittedAt ?? o?.submitted_at ?? o?.createdAt ?? o?.created_at ?? 0;
    const t = new Date(raw).getTime();
    return Number.isFinite(t) ? t : 0;
}

function sortBookingsForDisplay(rows) {
    if (!Array.isArray(rows) || rows.length === 0) return rows;
    return [...rows].sort((a, b) => {
        const bt = bookingSortTime(b);
        const at = bookingSortTime(a);
        if (bt !== at) return bt - at;
        const pin = (o) => {
            if (o?.isMonthlyBillingInvoiced === true) return 2;
            if (o?.isMonthlyBilling === true || isMonthlyBillingPaymentMethod(o?.paymentMethod)) return 1;
            return 0;
        };
        return pin(b) - pin(a);
    });
}

const STATUS_STYLES = {
    pending: { bg: '#FEF3C7', color: '#B45309' },
    draft: { bg: '#F1F5F9', color: '#475569' },
    submitted: { bg: '#DBEAFE', color: '#1D4ED8' },
    approved: { bg: '#D1FAE5', color: '#047857' },
    confirmed: { bg: '#DBEAFE', color: '#1D4ED8' },
    in_progress: { bg: '#EFF6FF', color: '#1D4ED8' },
    completed: { bg: '#D1FAE5', color: '#047857' },
    invoiced: { bg: '#EDE9FE', color: '#6D28D9' },
    cancelled: { bg: '#FEE2E2', color: '#B91C1C' },
    rejected: { bg: '#FEE2E2', color: '#B91C1C' },
    corporate_approved: { bg: '#D1FAE5', color: '#047857' },
    waiting_for_corporate_approval: { bg: '#FEF3C7', color: '#B45309' },
    rejected_by_corporate: { bg: '#FEE2E2', color: '#B91C1C' },
};

/** Service lines saved with the corporate booking (several API shapes). */
function pickBookingServiceLines(d) {
    if (!d || typeof d !== 'object') return [];
    const keys = [
        'bookingServices',
        'booking_services',
        'serviceLines',
        'service_lines',
        'catalogServices',
        'catalog_services',
        'selectedServices',
        'selected_services',
    ];
    for (const k of keys) {
        const v = d[k];
        if (Array.isArray(v) && v.length) return v;
    }
    if (Array.isArray(d.services) && d.services.length) {
        const first = d.services[0];
        if (first && (first.serviceId != null || first.service_id != null || first.departmentId != null || first.department_id != null)) {
            return d.services;
        }
    }
    return [];
}

/** Product lines with qty (several API shapes). */
function pickBookingProductLines(d) {
    if (!d || typeof d !== 'object') return [];
    const keys = [
        'bookingProducts',
        'booking_products',
        'productLines',
        'product_lines',
        'catalogProducts',
        'catalog_products',
        'selectedProducts',
        'selected_products',
    ];
    for (const k of keys) {
        const v = d[k];
        if (Array.isArray(v) && v.length) return v;
    }
    if (Array.isArray(d.products) && d.products.length) {
        const first = d.products[0];
        if (first && (first.productId != null || first.product_id != null || first.qty != null || first.quantity != null)) {
            return d.products;
        }
    }
    return [];
}

function serviceLineLabel(s) {
    const name = s.name || s.serviceName || s.service_name || s.title || '—';
    const dept = s.departmentName || s.department_name || s.department?.name || '';
    const sku = s.sku ? ` · ${s.sku}` : '';
    return dept ? `${name} (${dept})${sku}` : `${name}${sku}`;
}

function productLineLabel(p) {
    const name = p.name || p.productName || p.product_name || p.title || '—';
    const qty = p.qty ?? p.quantity ?? p.qtyOrdered ?? 1;
    const dept = p.departmentName || p.department_name || p.department?.name || '';
    const sku = p.sku ? ` · ${p.sku}` : '';
    const tail = dept ? ` — ${dept}` : '';
    return `${name} ×${qty}${tail}${sku}`;
}

/** When API only returns combined sales lines, split by item type / ids. */
function splitSalesOrderIntoServiceProduct(items) {
    if (!Array.isArray(items) || !items.length) return { services: [], products: [] };
    const services = [];
    const products = [];
    for (const line of items) {
        const t = String(line.itemType || line.item_type || line.type || line.kind || '').toLowerCase();
        const hasPrd = line.productId != null || line.product_id != null;
        const hasSvc = line.serviceId != null || line.service_id != null;
        if (hasPrd || t === 'product') products.push(line);
        else if (hasSvc || t === 'service') services.push(line);
        else products.push(line);
    }
    return { services, products };
}

function OrderDetailModal({ orderId, onClose }) {
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const ac = new AbortController();
        setLoading(true);
        setError('');
        (async () => {
            try {
                const d = await fetchCorporateBookingById(orderId, { signal: ac.signal });
                if (!ac.signal.aborted) setDetail(normalizeBookingDetailPayload(d));
            } catch {
                try {
                    const data = await apiFetch(`/corporate/orders/${orderId}`, { signal: ac.signal });
                    if (!ac.signal.aborted) setDetail(normalizeBookingDetailPayload(data.order || data.data || data));
                } catch (err) {
                    if (!ac.signal.aborted) setError(err.message || 'Failed to load');
                }
            } finally {
                if (!ac.signal.aborted) setLoading(false);
            }
        })();
        return () => ac.abort();
    }, [orderId]);

    const status = detail?.status || detail?.orderStatus || detail?.order_status || 'pending';
    const statusKey = String(status).toLowerCase().replace(/\s+/g, '_');
    const approvalLabelDetail = detail?.approvalStatusLabel || detail?.approval_status_label;
    let st = STATUS_STYLES[statusKey] || STATUS_STYLES.pending;
    if (approvalLabelDetail) {
        st = STATUS_STYLES.completed;
    }
    const badgeDetailText = approvalLabelDetail || String(status).replace(/_/g, ' ');

    const Row = ({ icon: Icon, label, value }) =>
        value ? (
            <div
                style={{
                    display: 'flex',
                    gap: 10,
                    alignItems: 'flex-start',
                    padding: '8px 0',
                    borderBottom: '1px solid var(--color-border-light)',
                }}
            >
                <Icon size={15} style={{ color: 'var(--color-text-muted)', marginTop: 2, flexShrink: 0 }} />
                <div>
                    <p
                        style={{
                            fontSize: '0.7rem',
                            color: 'var(--color-text-muted)',
                            margin: 0,
                            textTransform: 'uppercase',
                            fontWeight: 700,
                            letterSpacing: '0.05em',
                        }}
                    >
                        {label}
                    </p>
                    <p style={{ fontSize: '0.875rem', margin: '2px 0 0 0', fontWeight: 600 }}>{value}</p>
                </div>
            </div>
        ) : null;

    const salesItems =
        detail?.salesOrder?.items ||
        detail?.sales_order?.items ||
        detail?.salesOrder?.lines ||
        detail?.lineItems ||
        [];

    const explicitServices = detail ? pickBookingServiceLines(detail) : [];
    const explicitProducts = detail ? pickBookingProductLines(detail) : [];
    const splitFromSales = splitSalesOrderIntoServiceProduct(salesItems);
    const displayServices = explicitServices.length > 0 ? explicitServices : splitFromSales.services;
    const displayProducts = explicitProducts.length > 0 ? explicitProducts : splitFromSales.products;
    const showGenericSalesLines =
        displayServices.length === 0 &&
        displayProducts.length === 0 &&
        Array.isArray(salesItems) &&
        salesItems.length > 0;

    return (
        <Modal
            title={`Booking #${detail?.bookingCode || detail?.booking_code || orderId}`}
            onClose={onClose}
            width="520px"
            footer={
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="btn-portal-outline" onClick={onClose}>
                        Close
                    </button>
                </div>
            }
        >
            {loading && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
                    <Loader2 className="spin" size={32} style={{ color: 'var(--color-primary)' }} />
                </div>
            )}
            {error && (
                <p style={{ color: '#DC2626', padding: 16, margin: 0 }}>
                    {error}
                </p>
            )}
            {detail && !loading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <div>
                            <p style={{ fontWeight: 800, fontSize: '1.0625rem', margin: 0 }}>
                                {detail.bookingCode || detail.booking_code || detail.orderNumber || detail.order_number || `#${detail.id}`}
                            </p>
                            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>
                                {detail.createdAt || detail.created_at
                                    ? new Date(detail.createdAt || detail.created_at).toLocaleString('en-SA')
                                    : '—'}
                            </p>
                        </div>
                        <span
                            style={{
                                background: st.bg,
                                color: st.color,
                                padding: '5px 12px',
                                borderRadius: 8,
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                textTransform: approvalLabelDetail ? 'none' : 'capitalize',
                            }}
                        >
                            {badgeDetailText}
                        </span>
                    </div>

                    <Row
                        icon={Car}
                        label="Vehicle"
                        value={
                            detail.vehicle
                                ? `${detail.vehicle.plateNo || detail.vehicle.plate_no || ''} — ${detail.vehicle.make || ''} ${detail.vehicle.model || ''}`.trim()
                                : detail.vehiclePlate || detail.vehicle_plate
                        }
                    />
                    <Row icon={MapPin} label="Branch" value={detail.branch?.name || detail.branchName || detail.branch_name} />
                    <Row
                        icon={Wrench}
                        label="Workshop"
                        value={detail.workshop?.name || detail.workshopName || detail.workshop_name}
                    />
                    <Row
                        icon={Wrench}
                        label="Departments"
                        value={
                            Array.isArray(detail.departments)
                                ? detail.departments.map((d) => d.name || d.id).join(', ')
                                : typeof detail.departmentNames === 'string'
                                  ? detail.departmentNames
                                  : Array.isArray(detail.departmentNames)
                                    ? detail.departmentNames.join(', ')
                                    : ''
                        }
                    />
                    <Row icon={Clock} label="Booked For" value={detail.bookedFor || detail.booked_for} />
                    <Row icon={FileText} label="Notes" value={detail.notes} />
                    {detail.approvedBy?.name || detail.approved_by ? (
                        <Row
                            icon={FileText}
                            label="Approved by"
                            value={detail.approvedBy?.name || detail.approved_by?.name || String(detail.approvedBy || detail.approved_by)}
                        />
                    ) : null}

                    {(displayServices.length > 0 || displayProducts.length > 0) && (
                        <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid var(--color-border-light)' }}>
                            <p style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', margin: '0 0 8px 0' }}>
                                SERVICES &amp; PRODUCTS (BOOKED)
                            </p>
                            {displayServices.length > 0 && (
                                <div style={{ marginBottom: displayProducts.length ? 12 : 0 }}>
                                    <p style={{ fontSize: '0.68rem', fontWeight: 700, color: '#6B7280', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <Wrench size={14} /> Services
                                    </p>
                                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.8125rem' }}>
                                        {displayServices.map((s, i) => (
                                            <li key={s.id || s.serviceId || s.service_id || i} style={{ marginBottom: 4 }}>
                                                {serviceLineLabel(s)}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {displayProducts.length > 0 && (
                                <div>
                                    <p style={{ fontSize: '0.68rem', fontWeight: 700, color: '#6B7280', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <Package size={14} /> Products
                                    </p>
                                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.8125rem' }}>
                                        {displayProducts.map((p, i) => (
                                            <li key={p.id || p.productId || p.product_id || i} style={{ marginBottom: 4 }}>
                                                {productLineLabel(p)}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    {showGenericSalesLines && (
                        <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid var(--color-border-light)' }}>
                            <p style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', margin: '0 0 8px 0' }}>
                                ORDER LINES
                            </p>
                            <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.8125rem' }}>
                                {salesItems.map((line, i) => (
                                    <li key={line.id || i} style={{ marginBottom: 4 }}>
                                        {line.name || line.productName || line.serviceName || line.description || '—'}
                                        {line.qty != null ? ` ×${line.qty}` : ''}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div
                        style={{
                            marginTop: 14,
                            padding: 14,
                            background: 'var(--color-bg-muted)',
                            borderRadius: 10,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                        }}
                    >
                        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Total Amount</span>
                        <span style={{ fontWeight: 800, fontSize: '1.0625rem', color: 'var(--color-text-dark)' }}>
                            {(detail.amount ?? detail.grandTotal ?? detail.grand_total ?? detail.totalAmount ?? detail.total_amount ?? detail.total) != null
                                ? `SAR ${Number(detail.amount ?? detail.grandTotal ?? detail.grand_total ?? detail.totalAmount ?? detail.total_amount ?? detail.total).toFixed(2)}`
                                : 'Amount Pending'}
                        </span>
                    </div>

                    {detail.paymentMethod && (
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '8px 0 0 0' }}>
                            Payment: {detail.paymentMethod}
                            {detail.payFromWallet ? ' (Wallet)' : ''}
                            {detail.partialWalletPayment ? ' · partial wallet' : ''}
                        </p>
                    )}
                </div>
            )}
        </Modal>
    );
}

export default function CorporateBookings({ setBookingOpen, onTabChange }) {
    const [statusFilter, setStatusFilter] = useState('');
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewId, setViewId] = useState(null);
    const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
    const [invoiceLoadingId, setInvoiceLoadingId] = useState(null);
    const [invoiceError, setInvoiceError] = useState('');
    const [activeInvoice, setActiveInvoice] = useState(null);

    const load = useCallback(() => {
        setLoading(true);
        fetchCorporateBookings({
            limit: 250,
            offset: 0,
            ...(statusFilter.trim() ? { status: statusFilter.trim() } : {}),
        })
            .then(({ bookings }) => setOrders(sortBookingsForDisplay(bookings)))
            .catch(() => setOrders([]))
            .finally(() => setLoading(false));
    }, [statusFilter]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        const onSocket = () => load();
        window.addEventListener('corporate-portal-bookings-refresh', onSocket);
        return () => window.removeEventListener('corporate-portal-bookings-refresh', onSocket);
    }, [load]);

    const cancelOrder = async (id) => {
        try {
            try {
                await apiFetch(`/corporate/bookings/${id}/cancel`, { method: 'POST' });
            } catch {
                await apiFetch(`/corporate/orders/${id}/cancel`, { method: 'POST' });
            }
            setOrders((prev) => prev.map((o) => (String(o.id) === String(id) ? { ...o, status: 'cancelled' } : o)));
        } catch {
            /* ignore */
        }
    };

    const normalizeInvoiceForModal = (invoice) => {
        if (!invoice || typeof invoice !== 'object') return invoice;
        const srcOrder = invoice.salesOrder || invoice.sales_order || {};
        const srcCustomer = srcOrder.customer || invoice.customer || {};
        const srcVehicle = srcOrder.vehicle || invoice.vehicle || {};
        const srcJobs = Array.isArray(srcOrder.jobs) ? srcOrder.jobs : Array.isArray(invoice.jobs) ? invoice.jobs : [];
        return {
            ...invoice,
            order: { ...srcOrder, jobs: srcJobs },
            jobs: srcJobs,
            customer: srcCustomer,
            vehicle: srcVehicle,
            branch: invoice.branch || srcOrder.branch,
            workshop: invoice.workshop || srcOrder.workshop,
            paymentMethod: invoice.paymentMethod || invoice.payments?.[0]?.method,
        };
    };

    const openInvoice = async (booking) => {
        const bookingRef =
            booking?.bookingCode ||
            booking?.booking_code ||
            booking?.bookingId ||
            booking?.booking_id ||
            booking?.id;
        if (!bookingRef) return;
        const rowId = String(booking?.id ?? bookingRef);
        setInvoiceLoadingId(rowId);
        setInvoiceError('');
        try {
            const invoice = await fetchCorporateBookingInvoice(bookingRef);
            setActiveInvoice(normalizeInvoiceForModal(invoice));
            setInvoiceModalOpen(true);
        } catch (err) {
            setInvoiceError(err?.message || 'Failed to load invoice');
        } finally {
            setInvoiceLoadingId(null);
        }
    };

    return (
        <div>
            <div className="ws-page-header">
                <div>
                    <h2 className="ws-page-title">My Bookings</h2>
                    <p className="ws-page-sub">Corporate service bookings</p>
                </div>
                <button
                    className="btn-portal"
                    style={{ background: '#059669', color: '#fff', border: 'none' }}
                    onClick={() => setBookingOpen(true)}
                >
                    <Plus size={15} /> New Booking
                </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', marginBottom: 12 }}>
                <div className="ws-field" style={{ marginBottom: 0, minWidth: 220, flex: '0 1 300px' }}>
                    <label htmlFor="corporate-bookings-status-filter" style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                        Status
                    </label>
                    <select
                        id="corporate-bookings-status-filter"
                        className="form-input-field"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 9, fontSize: '0.875rem' }}
                    >
                        {BOOKING_STATUS_FILTER_OPTIONS.map((opt) => (
                            <option key={opt.value || 'all'} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
                    <Loader2 className="spin" size={36} style={{ color: 'var(--color-primary)' }} />
                </div>
            ) : orders.length === 0 ? (
                <div className="ws-section" style={{ textAlign: 'center', padding: 48 }}>
                    <Calendar size={48} style={{ opacity: 0.3, margin: '0 auto 16px', display: 'block' }} />
                    <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text-muted)' }}>
                        {statusFilter.trim() ? 'No bookings for this status.' : 'No bookings yet'}
                    </p>
                    <button
                        className="btn-portal"
                        style={{ marginTop: 16, background: '#059669', color: '#fff', border: 'none' }}
                        onClick={() => setBookingOpen(true)}
                    >
                        Book a Service
                    </button>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {orders.map((o) => {
                        const rawStatus = o.status || o.orderStatus || o.order_status || 'pending';
                        const status = String(rawStatus).toLowerCase();
                        const statusKey = status.replace(/\s+/g, '_');
                        const isWalkInQuote = o.bookingType === 'walk_in_quote';
                        const approvalLabel = o.approvalStatusLabel || o.approval_status_label;
                        let st = STATUS_STYLES[statusKey] || STATUS_STYLES.pending;
                        if (isWalkInQuote && approvalLabel) {
                            st = STATUS_STYLES.completed;
                        }
                        const canCancel = status === 'pending' || status === 'confirmed';
                        const isInvoiceLoading = invoiceLoadingId != null && String(invoiceLoadingId) === String(o.id);
                        const invSnap = o.salesOrder?.invoice || o.sales_order?.invoice;
                        const monthly =
                            o.isMonthlyBilling === true ||
                            isMonthlyBillingPaymentMethod(o.paymentMethod) ||
                            isMonthlyBillingPaymentMethod(invSnap?.deferredPaymentMethod);
                        const monthlyInvoiced =
                            o.isMonthlyBillingInvoiced === true ||
                            (monthly &&
                                (status === 'invoiced' || !!invSnap));
                        let badgeText =
                            isWalkInQuote && approvalLabel
                                ? approvalLabel
                                : String(rawStatus).replace(/_/g, ' ');
                        if (status === 'invoiced' && monthlyInvoiced) {
                            badgeText = 'Monthly invoiced';
                        }
                        return (
                            <div
                                key={o.bookingId || `${o.bookingType || 'booking'}-${o.id}`}
                                className="ws-section"
                                style={{ marginBottom: 0, padding: 20 }}
                            >
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                    <div>
                                        <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--color-text-dark)', margin: 0 }}>
                                            {o.bookingCode ||
                                                o.booking_code ||
                                                o.orderNumber ||
                                                o.order_number ||
                                                o.bookingId ||
                                                `#${o.id}`}
                                        </p>
                                        {monthly ? (
                                            <p style={{ margin: '6px 0 0 0', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                                                <span
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: 4,
                                                        fontSize: '0.68rem',
                                                        fontWeight: 700,
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '0.04em',
                                                        padding: '3px 8px',
                                                        borderRadius: 6,
                                                        background: '#ecfdf5',
                                                        color: '#047857',
                                                        border: '1px solid #a7f3d0',
                                                    }}
                                                >
                                                    <Receipt size={11} />
                                                    Monthly billing
                                                </span>
                                                {monthlyInvoiced ? (
                                                    <span
                                                        style={{
                                                            fontSize: '0.72rem',
                                                            fontWeight: 600,
                                                            color: '#0369a1',
                                                            background: '#e0f2fe',
                                                            padding: '3px 8px',
                                                            borderRadius: 6,
                                                            border: '1px solid #7dd3fc',
                                                        }}
                                                    >
                                                        Monthly invoiced
                                                        {o.invoiceNo || o.salesOrder?.invoice?.invoiceNo
                                                            ? ` · ${o.invoiceNo || o.salesOrder?.invoice?.invoiceNo}`
                                                            : ''}
                                                    </span>
                                                ) : null}
                                            </p>
                                        ) : null}
                                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>
                                            {o.vehicle ? `${o.vehicle.plateNo} · ${o.vehicle.make} ${o.vehicle.model}` : '—'} ·{' '}
                                            {o.branchName || o.branch?.name || '—'}
                                        </p>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>
                                            {o.bookedFor || o.booked_for ? new Date(o.bookedFor || o.booked_for).toLocaleString('en-SA') : '—'}
                                        </p>
                                        <p style={{ fontSize: '0.875rem', fontWeight: 600, margin: '6px 0 0 0', color: 'var(--color-text-dark)' }}>
                                            {(o.amount ?? o.grandTotal ?? o.grand_total ?? o.totalAmount ?? o.total_amount ?? o.total) != null
                                                ? `SAR ${Number(o.amount ?? o.grandTotal ?? o.grand_total ?? o.totalAmount ?? o.total_amount ?? o.total).toFixed(2)}`
                                                : 'Amount Pending'}
                                        </p>
                                    </div>
                                    <span
                                        style={{
                                            background: st.bg,
                                            color: st.color,
                                            padding: '4px 10px',
                                            borderRadius: 6,
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            textTransform: isWalkInQuote && approvalLabel ? 'none' : 'capitalize',
                                        }}
                                    >
                                        {badgeText}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                                    <button
                                        type="button"
                                        style={{
                                            padding: '6px 10px',
                                            borderRadius: 6,
                                            border: '1px solid var(--color-border)',
                                            background: '#fff',
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 6,
                                        }}
                                        onClick={() => setViewId(o.bookingId || o.id)}
                                    >
                                        <Eye size={14} /> View Details
                                    </button>
                                    {status === 'invoiced' && (
                                        <button
                                            type="button"
                                            style={{
                                                padding: '6px 10px',
                                                borderRadius: 6,
                                                border: '1px solid #BFDBFE',
                                                background: '#EFF6FF',
                                                color: '#1D4ED8',
                                                fontSize: '0.75rem',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                            }}
                                            onClick={() => openInvoice(o)}
                                            disabled={isInvoiceLoading}
                                        >
                                            {isInvoiceLoading ? 'Loading invoice…' : 'View Invoice'}
                                        </button>
                                    )}
                                    {monthlyInvoiced && typeof onTabChange === 'function' ? (
                                        <button
                                            type="button"
                                            style={{
                                                padding: '6px 10px',
                                                borderRadius: 6,
                                                border: '1px solid #99f6e4',
                                                background: '#f0fdfa',
                                                color: '#0f766e',
                                                fontSize: '0.75rem',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                            }}
                                            onClick={() =>
                                                onTabChange('billing', billingPeriodForMonthlyTab(o) || undefined)
                                            }
                                        >
                                            <Receipt size={14} style={{ verticalAlign: 'text-bottom', marginRight: 4 }} />
                                            Monthly billing — Pay from wallet
                                        </button>
                                    ) : null}
                                    {canCancel && (
                                        <button
                                            type="button"
                                            style={{
                                                padding: '6px 10px',
                                                borderRadius: 6,
                                                border: '1px solid #FECACA',
                                                background: '#FEF2F2',
                                                color: '#DC2626',
                                                fontSize: '0.75rem',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                            }}
                                            onClick={() => cancelOrder(o.id)}
                                        >
                                            Cancel
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {viewId && <OrderDetailModal orderId={viewId} onClose={() => setViewId(null)} />}
            {invoiceError && (
                <p style={{ marginTop: 10, color: '#DC2626', fontSize: '0.8rem' }}>{invoiceError}</p>
            )}
            <InvoiceDetailsModal
                invoice={activeInvoice}
                isOpen={invoiceModalOpen}
                footerVariant="corporate"
                onClose={() => {
                    setInvoiceModalOpen(false);
                    setActiveInvoice(null);
                }}
            />
        </div>
    );
}
