import { useState, useEffect, useRef } from 'react';
import {
    ArrowLeft, Search, RotateCcw, User, Package, Check, X,
    Image as ImageIcon, Upload, AlertTriangle, Calendar,
} from 'lucide-react';
import { apiFetch } from '../../services/api';

// Reference (Flutter sales_return_view_model.dart:43) uses 4 options — matched exactly.
const RETURN_REASONS = [
    'Defective Product/Service',
    'Customer Cancellation',
    'Wrong Item / Service',
    'Other',
];

const MAX_PROOF_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB cap — backend usually enforces too

export default function SalesReturnScreen({ onBack }) {
    // Search flow
    const [search, setSearch] = useState('');
    const [customers, setCustomers] = useState([]);
    const [searching, setSearching] = useState(false);

    // Selected customer → invoices list
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [orders, setOrders] = useState([]);
    const [ordersLoading, setOrdersLoading] = useState(false);

    // Selected order → invoice detail
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [invoice, setInvoice] = useState(null);
    const [invoiceLoading, setInvoiceLoading] = useState(false);

    // Already-returned qty per salesOrderItemId (from prior /cashier/return/list calls).
    // We use this to subtract from each item's purchased qty so cashiers can't try to
    // return more than what's actually returnable — backend rejects double returns.
    const [returnedMap, setReturnedMap] = useState({}); // { salesOrderItemId: returnedQty }

    // Return rows (per item)
    const [returnRows, setReturnRows] = useState({}); // key → { qty, reason }

    // Proof image (optional)
    const [proofFile, setProofFile] = useState(null);
    const [proofPreview, setProofPreview] = useState(null);
    const fileInputRef = useRef(null);

    // Submit state
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState(false);
    const [submitError, setSubmitError] = useState(null);

    const debounceRef = useRef(null);

    // ── Customer search (GET with query params per reference contract) ──
    useEffect(() => {
        if (!search.trim()) { setCustomers([]); return; }
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setSearching(true);
            const trimmed = search.trim();
            const isDigits = /^\d+$/.test(trimmed);
            const qs = new URLSearchParams(
                isDigits ? { phone: trimmed, limit: '8' } : { name: trimmed, limit: '8' }
            ).toString();
            apiFetch(`/cashier/customers/search?${qs}`)
                .then(d => setCustomers(d.customers || d.data || []))
                .catch(() => setCustomers([]))
                .finally(() => setSearching(false));
        }, 350);
        return () => clearTimeout(debounceRef.current);
    }, [search]);

    const selectCustomer = (c) => {
        setSelectedCustomer(c);
        setSearch('');
        setCustomers([]);
        setOrdersLoading(true);
        apiFetch(`/cashier/orders/invoiced/${c.id}`)
            .then(d => setOrders(d.orders || d.data || []))
            .catch(() => setOrders([]))
            .finally(() => setOrdersLoading(false));
    };

    const openOrder = async (order) => {
        setSelectedOrder(order);
        setInvoice(null);
        setReturnRows({});
        setReturnedMap({});
        clearProof();
        setSubmitError(null);
        setInvoiceLoading(true);

        // Fetch the by-order invoice and any prior returns in parallel — past
        // returns let us hide / cap items that have already been refunded.
        const invoiceId = order.invoiceId || order.invoice_id || null;
        const [invoiceRes, returnsRes] = await Promise.allSettled([
            apiFetch('/cashier/invoice/by-order', {
                method: 'POST',
                body: JSON.stringify({ orderId: order.id }),
            }),
            invoiceId
                ? apiFetch(`/cashier/return/list?invoiceId=${encodeURIComponent(invoiceId)}&limit=200`)
                : Promise.resolve(null),
        ]);

        if (invoiceRes.status === 'fulfilled' && invoiceRes.value) {
            const v = invoiceRes.value;
            setInvoice(v.invoice || v.data || v);
        } else if (invoiceRes.status === 'rejected') {
            console.warn('by-order failed:', invoiceRes.reason);
        }

        if (returnsRes.status === 'fulfilled' && returnsRes.value) {
            const list = returnsRes.value.salesReturns || returnsRes.value.data || returnsRes.value.returns || [];
            const map = {};
            (Array.isArray(list) ? list : []).forEach(ret => {
                (ret.items || []).forEach(it => {
                    const id = it.salesOrderItemId || it.itemId || it.id;
                    if (!id) return;
                    map[id] = (map[id] || 0) + (parseFloat(it.qty) || 0);
                });
            });
            setReturnedMap(map);
        }

        setInvoiceLoading(false);
    };

    // ── Item selection / qty / reason ──
    // Reference defaults qty to 0 — user must explicitly bump up. This prevents
    // accidentally returning the whole purchased qty when the cashier only
    // meant to flag the item for review.
    const toggleItem = (item) => {
        const key = item.salesOrderItemId || item.id;
        setReturnRows(prev => {
            const next = { ...prev };
            if (next[key]) delete next[key];
            else next[key] = { qty: 0, reason: RETURN_REASONS[0] };
            return next;
        });
    };

    const setQty = (key, rawQty, maxQty) => {
        const parsed = parseFloat(rawQty);
        const clamped = isFinite(parsed)
            ? Math.max(0, Math.min(parsed, maxQty))
            : 0;
        setReturnRows(prev => (prev[key]
            ? { ...prev, [key]: { ...prev[key], qty: clamped } }
            : prev));
    };

    const setReason = (key, reason) => setReturnRows(prev => (prev[key]
        ? { ...prev, [key]: { ...prev[key], reason } }
        : prev));

    // ── Proof image picker ──
    const onPickProof = (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        if (!/^image\//.test(f.type)) {
            alert('Please pick an image file.');
            e.target.value = '';
            return;
        }
        if (f.size > MAX_PROOF_SIZE_BYTES) {
            alert('Image is too large (max 2 MB).');
            e.target.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            setProofFile(f);
            setProofPreview(reader.result); // data URL, used as proofUrl on submit
        };
        reader.readAsDataURL(f);
    };

    const clearProof = () => {
        setProofFile(null);
        setProofPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // ── Submit ──
    const selectedCount = Object.values(returnRows).filter(r => (r?.qty || 0) > 0).length;

    const handleSubmit = async () => {
        setSubmitError(null);
        const items = Object.entries(returnRows)
            .filter(([, v]) => (v?.qty || 0) > 0)
            .map(([salesOrderItemId, v]) => ({
                salesOrderItemId,
                qty: parseFloat(v.qty) || 0,
                reason: v.reason || RETURN_REASONS[0],
            }));
        if (items.length === 0) {
            setSubmitError('Bump the qty on at least one item before submitting.');
            return;
        }

        const invoiceId = invoice?.id || invoice?.invoiceId;
        if (!invoiceId) {
            setSubmitError('Invoice ID missing — reload the order and try again.');
            return;
        }

        if (!window.confirm(`Submit return for ${items.length} item(s)?`)) return;
        setSubmitting(true);
        try {
            // Reference payload (SubmitSalesReturnRequest.toJson):
            //   { invoiceId, orderId, customerId, proofUrl?, items[] }
            // Our prior code missed orderId + customerId — backend contract
            // expects them and will reject (or silently mis-attribute) without.
            const body = {
                invoiceId,
                orderId: selectedOrder?.id || invoice?.salesOrderId || invoice?.orderId || null,
                customerId: selectedCustomer?.id || invoice?.customerId || null,
                items,
                ...(proofPreview ? { proofUrl: proofPreview } : {}),
            };
            await apiFetch('/cashier/return/submit', {
                method: 'POST',
                body: JSON.stringify(body),
            });
            setDone(true);
        } catch (e) {
            setSubmitError(e.message || 'Failed to submit return');
        } finally {
            setSubmitting(false);
        }
    };

    const resetAll = () => {
        setSelectedCustomer(null);
        setOrders([]);
        setSelectedOrder(null);
        setInvoice(null);
        setReturnRows({});
        setDone(false);
        setSubmitError(null);
        clearProof();
    };

    if (done) {
        return (
            <div style={{ width: '100%', textAlign: 'center', paddingTop: 80, minHeight: '100%', background: '#F8FAF9', padding: 24, boxSizing: 'border-box' }}>
                <div style={{ width: 100, height: 100, borderRadius: '50%', background: '#FCC247', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 32px', boxShadow: '0 20px 40px rgba(252,194,71,0.2)' }}>
                    <Check size={50} color="#23262D" strokeWidth={3} />
                </div>
                <h2 style={{ margin: '0 0 12px', fontSize: '2.4rem', fontWeight: 900, color: '#1E2124' }}>Return Recorded</h2>
                <p style={{ margin: '0 0 40px', color: '#64748b', fontSize: '1.2rem', fontWeight: 600 }}>The sales return has been successfully submitted.</p>
                <button onClick={resetAll}
                    style={{ padding: '16px 48px', background: '#23262D', color: '#FCC247', border: 'none', borderRadius: 18, fontWeight: 900, fontSize: '1.1rem', cursor: 'pointer', boxShadow: '0 10px 20px rgba(35,38,45,0.1)' }}>
                    Process Another Return
                </button>
            </div>
        );
    }

    // Reference (Flutter SalesReturnViewModel.searchInvoice) reads items DIRECTLY from
    // the order returned by /cashier/orders/invoiced/:customerId — the by-order endpoint
    // is never called. The invoiced-order shape already carries `items: [{id, productName,
    // qty, unitPrice, lineTotal, ...}]`. We mirror that: prefer the order's own items,
    // and only fall through to the by-order invoice's nested arrays as a backup.
    const items = (() => {
        if (Array.isArray(selectedOrder?.items) && selectedOrder.items.length > 0) {
            return selectedOrder.items;
        }
        if (!invoice) return [];
        const depts = Array.isArray(invoice.departments) ? invoice.departments : [];
        if (depts.length > 0) {
            const fromDepts = depts.flatMap(d => Array.isArray(d.items) ? d.items : []);
            if (fromDepts.length > 0) return fromDepts;
        }
        const jobs = Array.isArray(invoice.jobs) ? invoice.jobs : [];
        if (jobs.length > 0) {
            const fromJobs = jobs.flatMap(j => Array.isArray(j.items) ? j.items : []);
            if (fromJobs.length > 0) return fromJobs;
        }
        if (Array.isArray(invoice.items) && invoice.items.length > 0) return invoice.items;
        if (Array.isArray(invoice.lineItems) && invoice.lineItems.length > 0) return invoice.lineItems;
        if (Array.isArray(invoice.invoiceItems) && invoice.invoiceItems.length > 0) return invoice.invoiceItems;
        if (Array.isArray(invoice.salesOrderItems) && invoice.salesOrderItems.length > 0) return invoice.salesOrderItems;
        return [];
    })();
    const invoiceNo = invoice?.invoiceNo || invoice?.invoice_no || invoice?.id?.slice?.(-8) || '';

    // Original invoice total + already-refunded amount → effective remaining payable.
    // After partial returns the cashier expects to see what's still on the invoice,
    // not the historic full total.
    const originalTotal = parseFloat(
        invoice?.totalAmount
        ?? selectedOrder?.grandTotal
        ?? selectedOrder?.totalAmount
        ?? 0
    ) || 0;
    const returnedAmount = items.reduce((sum, it) => {
        const key = it.salesOrderItemId || it.id;
        const ret = parseFloat(returnedMap[key] || 0);
        if (!ret) return sum;
        const unit = parseFloat(it.unitPrice ?? it.price ?? 0) || 0;
        return sum + (ret * unit);
    }, 0);
    const remainingTotal = Math.max(0, originalTotal - returnedAmount);
    const hasPartialReturns = returnedAmount > 0.01;

    return (
        <div style={{ width: '100%', minHeight: '100%', background: '#F8FAF9', padding: 24, boxSizing: 'border-box' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
                {onBack && <button onClick={onBack} style={iconBtn}><ArrowLeft size={18} /></button>}
                <div style={{ flex: 1 }}>
                    <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, color: '#1E2124' }}>Sales Return</h2>
                    <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>Locate invoices and process product returns efficiently</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 2fr)', gap: 32 }}>
                {/* LEFT — selection */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {/* Customer search */}
                    <div style={card}>
                        <SectionHead icon={User} title="Customer Selection" subtitle="Identify the account for the return" />
                        {!selectedCustomer ? (
                            <div style={{ position: 'relative' }}>
                                <Search size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                <input
                                    style={{ ...fieldInput, paddingLeft: 44 }}
                                    placeholder="Name or mobile..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    autoFocus
                                />
                                {searching && <div style={{ ...spinner, right: 14 }} />}

                                {customers.length > 0 && (
                                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: '#fff', borderRadius: 16, marginTop: 8, boxShadow: '0 12px 32px rgba(0,0,0,0.12)', border: '1.5px solid #f1f5f9', overflow: 'hidden' }}>
                                        {customers.map(c => (
                                            <div
                                                key={c.id}
                                                onClick={() => selectCustomer(c)}
                                                className="hover-row"
                                                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', transition: '0.15s' }}
                                            >
                                                <div style={avatar}><User size={18} color="#94a3b8" /></div>
                                                <div>
                                                    <p style={{ margin: 0, fontWeight: 800, fontSize: '0.85rem', color: '#1E2124' }}>{c.name || c.fullName}</p>
                                                    <p style={{ margin: '1px 0 0', fontSize: '0.72rem', color: '#94a3b8' }}>{c.mobile || c.phone}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {search.trim() && !searching && customers.length === 0 && (
                                    <p style={{ margin: '10px 0 0', fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
                                        No customers found for &quot;{search.trim()}&quot;
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F8FAF9', padding: 16, borderRadius: 16, border: '1.5px dashed #cbd5e1' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ ...avatar, background: '#23262D' }}><User size={18} color="#FCC247" /></div>
                                    <div>
                                        <p style={{ margin: 0, fontWeight: 900, fontSize: '0.9rem', color: '#1E2124' }}>{selectedCustomer.name || selectedCustomer.fullName}</p>
                                        <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>{selectedCustomer.mobile || selectedCustomer.phone}</p>
                                    </div>
                                </div>
                                <button onClick={resetAll} style={{ padding: '6px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#fff', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', cursor: 'pointer' }}>Change</button>
                            </div>
                        )}
                    </div>

                    {/* Invoiced orders */}
                    {selectedCustomer && !selectedOrder && (
                        <div style={{ ...card, flex: 1, overflowY: 'auto' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, color: '#1E2124' }}>Invoiced Orders</h3>
                                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8' }}>{orders.length} TOTAL</span>
                            </div>

                            {ordersLoading ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {[1, 2, 3].map(i => <div key={i} style={{ height: 100, borderRadius: 18, background: '#F8FAF9', animation: 'pulse 1.5s infinite' }} />)}
                                </div>
                            ) : orders.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                                    <RotateCcw size={32} style={{ opacity: 0.4, marginBottom: 12 }} />
                                    <p style={{ fontWeight: 800, fontSize: '0.85rem', margin: 0 }}>
                                        No invoices found for &quot;{selectedCustomer.name || selectedCustomer.mobile}&quot;
                                    </p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {orders.map(o => {
                                        const invNo = o.invoiceNo || o.invoice_no || o.invoiceId || o.id?.slice(-8);
                                        const cName = o.customerName || o.customer?.name || selectedCustomer.name;
                                        const dateStr = o.createdAt
                                            ? new Date(o.createdAt).toLocaleDateString('en-SA', { day: '2-digit', month: 'short', year: 'numeric' })
                                            : null;
                                        return (
                                            <div
                                                key={o.id}
                                                onClick={() => openOrder(o)}
                                                className="order-pill"
                                                style={{ padding: 16, background: '#fff', borderRadius: 18, border: '1.5px solid #f1f5f9', cursor: 'pointer', transition: '0.2s', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}
                                            >
                                                {dateStr && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                                                        <Calendar size={11} color="#94a3b8" />
                                                        <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700, letterSpacing: 0.3 }}>{dateStr}</span>
                                                    </div>
                                                )}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                                    <span style={{ fontWeight: 900, color: '#23262D', fontSize: '0.92rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {invNo ? `INV ${invNo}` : `#${o.orderNumber || o.id?.slice(-8)}`}
                                                    </span>
                                                    <span style={{ padding: '4px 10px', borderRadius: 20, background: 'rgba(16,185,129,0.08)', border: '1.5px solid rgba(16,185,129,0.3)', color: '#047857', fontSize: '0.75rem', fontWeight: 800, whiteSpace: 'nowrap' }}>
                                                        SAR {parseFloat(o.grandTotal ?? o.totalAmount ?? o.total ?? 0).toFixed(2)}
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                                                    <User size={13} color="#94a3b8" />
                                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cName || 'Walk-in Customer'}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* RIGHT — return details */}
                <div style={{ flex: 1 }}>
                    {!selectedOrder ? (
                        <div style={{ height: '100%', background: '#fff', borderRadius: 32, border: '2px dashed #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 60, textAlign: 'center' }}>
                            <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#F8FAF9', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                                <RotateCcw size={40} color="#cbd5e1" />
                            </div>
                            <h3 style={{ margin: '0 0 12px', fontSize: '1.5rem', fontWeight: 900, color: '#23262D' }}>Select an Invoice</h3>
                            <p style={{ margin: 0, maxWidth: 320, color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.6, fontWeight: 600 }}>
                                Search and select an invoice from the left to initiate its sales return process.
                            </p>
                        </div>
                    ) : (
                        <div style={{ background: '#fff', borderRadius: 32, padding: 0, border: '1.5px solid #f1f5f9', boxShadow: '0 10px 30px rgba(0,0,0,0.03)', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            {/* Dark summary header */}
                            <div style={{ background: 'linear-gradient(135deg, #1E2124 0%, #2C3036 100%)', padding: 20, color: '#fff', display: 'flex', alignItems: 'center', gap: 16 }}>
                                <div style={{ width: 50, height: 50, borderRadius: 12, background: 'rgba(252,194,71,0.15)', border: '1px solid rgba(252,194,71,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Package size={24} color="#FCC247" />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ margin: 0, fontWeight: 900, fontSize: '1.15rem', letterSpacing: -0.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {invoiceNo ? `INV ${invoiceNo}` : `Order #${selectedOrder.orderNumber || selectedOrder.id?.slice(-8)}`}
                                    </p>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>
                                        <User size={12} />
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
                                            {invoice?.customerName || selectedCustomer?.name || 'Walk-in Customer'}
                                        </span>
                                        {invoice?.invoiceDate && (
                                            <>
                                                <span>·</span>
                                                <Calendar size={12} />
                                                <span>{String(invoice.invoiceDate).split('T')[0]}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <p style={{ margin: 0, fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
                                        {hasPartialReturns ? 'Remaining' : 'Total'}
                                    </p>
                                    <p style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#FCC247', letterSpacing: -0.3 }}>
                                        SAR {remainingTotal.toFixed(2)}
                                    </p>
                                    {hasPartialReturns && (
                                        <p style={{ margin: '2px 0 0', fontSize: '0.62rem', color: 'rgba(255,255,255,0.45)', fontWeight: 700, textDecoration: 'line-through' }}>
                                            SAR {originalTotal.toFixed(2)}
                                        </p>
                                    )}
                                </div>
                                <button
                                    onClick={() => { setSelectedOrder(null); setInvoice(null); setReturnRows({}); clearProof(); setSubmitError(null); }}
                                    style={{ marginLeft: 8, padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(255,255,255,0.75)', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer' }}
                                >
                                    Change
                                </button>
                            </div>

                            {/* Scrollable body */}
                            <div style={{ flex: 1, overflowY: 'auto', padding: 24 }} className="hide-scroll">
                                {/* Items section */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                                    <div style={{ width: 3, height: 16, background: '#FCC247', borderRadius: 2 }} />
                                    <Package size={15} color="#64748b" />
                                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 900, color: '#1E2124' }}>Select Items to Return</h4>
                                    {selectedCount > 0 && (
                                        <span style={{ marginLeft: 'auto', padding: '4px 12px', borderRadius: 20, background: '#FCC247', color: '#23262D', fontSize: '0.72rem', fontWeight: 800 }}>
                                            {selectedCount} selected
                                        </span>
                                    )}
                                </div>

                                {invoiceLoading ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        {[1, 2, 3, 4].map(i => <div key={i} style={{ height: 80, borderRadius: 20, background: '#F8FAF9', animation: 'pulse 1.5s infinite' }} />)}
                                    </div>
                                ) : items.length === 0 ? (
                                    <p style={{ color: '#94a3b8', fontWeight: 600, textAlign: 'center', padding: 32 }}>This invoice has no line items to return.</p>
                                ) : (() => {
                                    const decorated = items.map(it => {
                                        const key = it.salesOrderItemId || it.id;
                                        const purchasedQty = parseFloat(it.qty ?? it.quantity ?? 1);
                                        const alreadyReturned = parseFloat(returnedMap[key] || 0);
                                        const remainingQty = Math.max(0, purchasedQty - alreadyReturned);
                                        return { it, key, purchasedQty, alreadyReturned, remainingQty };
                                    });
                                    const returnable = decorated.filter(d => d.remainingQty > 0);
                                    if (returnable.length === 0) {
                                        return (
                                            <p style={{ color: '#94a3b8', fontWeight: 600, textAlign: 'center', padding: 32, margin: 0 }}>
                                                All items on this invoice have already been returned.
                                            </p>
                                        );
                                    }
                                    return (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                            {returnable.map(({ it, key, purchasedQty, alreadyReturned, remainingQty }) => {
                                                const unitPrice = parseFloat(it.unitPrice ?? it.price ?? 0);
                                                const row = returnRows[key];
                                                const selected = !!row;
                                                const lineTotal = remainingQty * unitPrice;
                                                return (
                                                    <ReturnItemCard
                                                        key={key}
                                                        item={it}
                                                        selected={selected}
                                                        row={row}
                                                        maxQty={remainingQty}
                                                        purchasedQty={purchasedQty}
                                                        alreadyReturned={alreadyReturned}
                                                        unitPrice={unitPrice}
                                                        lineTotal={lineTotal}
                                                        onToggle={() => toggleItem(it)}
                                                        onQty={(v) => setQty(key, v, remainingQty)}
                                                        onReason={(v) => setReason(key, v)}
                                                    />
                                                );
                                            })}
                                        </div>
                                    );
                                })()}

                                {/* Proof section */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '28px 0 14px' }}>
                                    <div style={{ width: 3, height: 16, background: '#23262D', borderRadius: 2 }} />
                                    <ImageIcon size={15} color="#64748b" />
                                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 900, color: '#1E2124' }}>Return Proof</h4>
                                    <span style={{ padding: '3px 9px', borderRadius: 20, background: '#f1f5f9', color: '#64748b', fontSize: '0.65rem', fontWeight: 700 }}>Optional</span>
                                </div>

                                <ProofPicker
                                    fileInputRef={fileInputRef}
                                    proofFile={proofFile}
                                    proofPreview={proofPreview}
                                    onPick={onPickProof}
                                    onClear={clearProof}
                                />

                                {submitError && (
                                    <div style={{ marginTop: 16, padding: '12px 14px', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <AlertTriangle size={16} color="#b91c1c" />
                                        <span style={{ fontSize: '0.8rem', color: '#b91c1c', fontWeight: 700 }}>{submitError}</span>
                                    </div>
                                )}
                            </div>

                            {/* Action bar */}
                            <div style={{ padding: '14px 24px', borderTop: '1px solid #f1f5f9', background: '#fff', display: 'flex', gap: 12 }}>
                                <button
                                    onClick={() => { setSelectedOrder(null); setInvoice(null); setReturnRows({}); clearProof(); setSubmitError(null); }}
                                    disabled={submitting}
                                    style={{ padding: '14px 24px', borderRadius: 14, border: '2px solid #f1f5f9', background: '#fff', fontWeight: 900, fontSize: '0.88rem', color: '#64748b', cursor: submitting ? 'not-allowed' : 'pointer' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={submitting || selectedCount === 0}
                                    style={{
                                        flex: 1, padding: '14px', borderRadius: 14, border: 'none',
                                        background: selectedCount === 0 || submitting ? '#f1f5f9' : '#FCC247',
                                        color: selectedCount === 0 || submitting ? '#94a3b8' : '#23262D',
                                        fontWeight: 900, fontSize: '0.95rem',
                                        cursor: selectedCount === 0 || submitting ? 'not-allowed' : 'pointer',
                                        boxShadow: selectedCount === 0 || submitting ? 'none' : '0 10px 20px rgba(252,194,71,0.25)',
                                    }}
                                >
                                    {submitting
                                        ? 'PROCESSING...'
                                        : `SUBMIT RETURN${selectedCount > 0 ? ` (${selectedCount} ITEM${selectedCount > 1 ? 'S' : ''})` : ''}`}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                .hide-scroll::-webkit-scrollbar { display: none; }
                .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }
                @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
                @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
                .hover-row:hover { background: #F8FAF9 !important; }
                .order-pill:hover { border-color: #FCC247 !important; transform: translateY(-2px); }
            `}</style>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────

function SectionHead({ icon: Icon, title, subtitle }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: '#23262D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={20} color="#FCC247" />
            </div>
            <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, color: '#1E2124' }}>{title}</h3>
                {subtitle && <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>{subtitle}</p>}
            </div>
        </div>
    );
}

function ReturnItemCard({ item, selected, row, maxQty, purchasedQty, alreadyReturned, unitPrice, lineTotal, onToggle, onQty, onReason }) {
    const name = item.name || item.productName || item.description || 'Item';
    const hasPriorReturn = alreadyReturned > 0;
    return (
        <div
            style={{
                background: '#fff',
                borderRadius: 16,
                border: `2px solid ${selected ? '#FCC247' : '#f1f5f9'}`,
                boxShadow: selected ? '0 8px 20px rgba(252,194,71,0.12)' : '0 2px 6px rgba(0,0,0,0.02)',
                overflow: 'hidden',
                transition: 'border-color 0.2s, box-shadow 0.2s',
            }}
        >
            {/* Top row */}
            <div
                onClick={onToggle}
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 16, cursor: 'pointer' }}
            >
                <div
                    style={{
                        width: 26, height: 26, borderRadius: 7,
                        border: `2px solid ${selected ? '#FCC247' : '#cbd5e1'}`,
                        background: selected ? '#FCC247' : '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}
                >
                    {selected && <Check size={15} color="#23262D" strokeWidth={4} />}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <p style={{ margin: 0, fontWeight: 800, fontSize: '0.92rem', color: selected ? '#92400e' : '#1E2124', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {name}
                        </p>
                        {hasPriorReturn && (
                            <span style={{ flexShrink: 0, padding: '2px 7px', borderRadius: 6, background: '#fef3c7', color: '#92400e', fontSize: '0.6rem', fontWeight: 800, letterSpacing: 0.3 }}>
                                {alreadyReturned} RETURNED
                            </span>
                        )}
                    </div>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                        {hasPriorReturn
                            ? `${maxQty} of ${purchasedQty} returnable @ SAR ${unitPrice.toFixed(2)}`
                            : `${maxQty}x @ SAR ${unitPrice.toFixed(2)}`}
                    </p>
                </div>

                <span style={{ padding: '5px 11px', borderRadius: 10, background: selected ? 'rgba(252,194,71,0.12)' : '#F8FAF9', color: selected ? '#92400e' : '#1E2124', border: `1px solid ${selected ? 'rgba(252,194,71,0.25)' : '#f1f5f9'}`, fontSize: '0.82rem', fontWeight: 800 }}>
                    SAR {lineTotal.toFixed(2)}
                </span>
            </div>

            {/* Expanded config */}
            {selected && (
                <div style={{ borderTop: '1.5px solid #FCC247', background: '#FFFBF0', padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div>
                        <label style={fieldLabel}>RETURN QTY (0 – {maxQty})</label>
                        <div style={{ display: 'flex', alignItems: 'center', background: '#fff', borderRadius: 10, padding: 4, border: '1px solid #e2e8f0' }}>
                            <button
                                onClick={() => onQty(Math.max(0, (row?.qty || 0) - 1))}
                                disabled={(row?.qty || 0) <= 0}
                                style={{ ...qtyBtn, opacity: (row?.qty || 0) <= 0 ? 0.4 : 1 }}
                            >
                                −
                            </button>
                            <input
                                type="number"
                                min={0}
                                max={maxQty}
                                step={1}
                                value={row?.qty ?? 0}
                                onChange={e => onQty(e.target.value)}
                                onBlur={e => {
                                    const v = parseFloat(e.target.value);
                                    if (!isFinite(v) || v < 0) onQty(0);
                                    else if (v > maxQty) onQty(maxQty);
                                }}
                                style={{ flex: 1, border: 'none', background: 'transparent', textAlign: 'center', fontSize: '1rem', fontWeight: 900, color: '#23262D', outline: 'none', fontFamily: 'inherit', minWidth: 0 }}
                            />
                            <button
                                onClick={() => onQty(Math.min(maxQty, (row?.qty || 0) + 1))}
                                disabled={(row?.qty || 0) >= maxQty}
                                style={{ ...qtyBtn, opacity: (row?.qty || 0) >= maxQty ? 0.4 : 1 }}
                            >
                                +
                            </button>
                        </div>
                    </div>

                    <div>
                        <label style={fieldLabel}>REASON FOR RETURN</label>
                        <select
                            value={row?.reason || RETURN_REASONS[0]}
                            onChange={e => onReason(e.target.value)}
                            style={{ width: '100%', height: 42, borderRadius: 10, border: '2px solid #FCC247', background: '#fff', padding: '0 10px', fontSize: '0.82rem', fontWeight: 800, color: '#1E2124', outline: 'none', fontFamily: 'inherit' }}
                        >
                            {RETURN_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>
                </div>
            )}
        </div>
    );
}

function ProofPicker({ fileInputRef, proofFile, proofPreview, onPick, onClear }) {
    return (
        <div
            onClick={() => !proofPreview && fileInputRef.current?.click()}
            style={{
                height: 150,
                borderRadius: 18,
                border: `1.5px dashed ${proofPreview ? '#FCC247' : '#cbd5e1'}`,
                background: proofPreview ? '#fff' : '#FAFBFC',
                overflow: 'hidden',
                position: 'relative',
                cursor: proofPreview ? 'default' : 'pointer',
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={onPick}
            />
            {proofPreview ? (
                <>
                    <img src={proofPreview} alt="Return proof" style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }} />
                    <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 6 }}>
                        <button
                            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                            style={{ background: 'rgba(255,255,255,0.92)', border: 'none', padding: '6px 10px', borderRadius: 8, fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                            <Upload size={12} /> Replace
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onClear(); }}
                            style={{ background: 'rgba(239,68,68,0.95)', border: 'none', padding: '6px 10px', borderRadius: 8, color: '#fff', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                            <X size={12} /> Remove
                        </button>
                    </div>
                    {proofFile && (
                        <div style={{ position: 'absolute', bottom: 8, left: 8, padding: '4px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.92)', fontSize: '0.7rem', fontWeight: 700, color: '#1E2124', maxWidth: 'calc(100% - 16px)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {proofFile.name} · {(proofFile.size / 1024).toFixed(0)} KB
                        </div>
                    )}
                </>
            ) : (
                <div style={{ textAlign: 'center', color: '#64748b' }}>
                    <Upload size={30} color="#94a3b8" style={{ marginBottom: 8 }} />
                    <p style={{ margin: 0, fontWeight: 800, fontSize: '0.88rem', color: '#1E2124' }}>Attach a photo of the returned item</p>
                    <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>JPG / PNG · max 2 MB</p>
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────

const iconBtn = { width: 44, height: 44, background: '#fff', border: '1.5px solid #f1f5f9', borderRadius: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' };
const avatar = { width: 36, height: 36, borderRadius: 12, background: '#F8FAF9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };
const spinner = { width: 20, height: 20, border: '3px solid #f1f5f9', borderTopColor: '#FCC247', borderRadius: '50%', animation: 'spin 0.8s linear infinite', position: 'absolute', top: '50%', transform: 'translateY(-50%)' };
const fieldInput = { width: '100%', height: 48, padding: '0 16px', border: '1.5px solid #e5e7eb', borderRadius: 14, fontSize: '0.9rem', fontWeight: 700, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' };
const fieldLabel = { display: 'block', margin: '0 0 6px', fontSize: '0.68rem', fontWeight: 900, color: '#92400e', letterSpacing: 0.4 };
const qtyBtn = { width: 32, height: 32, borderRadius: 8, border: 'none', background: '#23262D', color: '#FCC247', fontWeight: 900, fontSize: '1.05rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };
const card = { background: '#fff', borderRadius: 24, padding: 24, border: '1.5px solid #f1f5f9', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' };
