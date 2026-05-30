import { useState, useEffect, useCallback } from 'react';
import { Clock, CheckCircle2, Receipt, RefreshCw, Package, Plus, Minus, Trash2, Check, X, Banknote, CreditCard, Building2 } from 'lucide-react';
import { apiFetch, clientUtcOffsetMinutes } from '../../services/api';

const WF_LABELS = {
    draft:              { label: 'Draft — Add items & proceed', color: '#f1f5f9', textColor: '#475569' },
    active:             { label: 'Active — In Progress',         color: '#fef9c3', textColor: '#854d0e' },
    in_progress:        { label: 'In Progress',                  color: '#e0f2fe', textColor: '#0369a1' },
    ready_for_invoice:  { label: 'Ready for Invoice',            color: '#dcfce7', textColor: '#15803d' },
    invoiced:           { label: 'Invoiced ✓',                   color: '#f1f5f9', textColor: '#64748b' },
    completed:          { label: 'Completed ✓',                  color: '#f1f5f9', textColor: '#64748b' },
};

const PAYMENT_METHODS = ['Cash', 'Card', 'Bank Transfer', 'Tamara', 'Tabby', 'Monthly billing'];

export default function ActiveOrdersManager() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [paymentOrder, setPaymentOrder] = useState(null);
    const [payMethod, setPayMethod] = useState('Cash');
    const [invoicing, setInvoicing] = useState(false);
    const [addItemsOrder, setAddItemsOrder] = useState(null);
    const [products, setProducts] = useState([]);
    const [addItems, setAddItems] = useState([]);

    const fetchOrders = useCallback(async (showRefresh = false) => {
        if (showRefresh) setRefreshing(true);
        else setLoading(true);
        try {
            const d = await apiFetch(
                `/cashier/orders?status=active&limit=50&offset=0&utcOffsetMinutes=${clientUtcOffsetMinutes()}`,
            );
            const raw = d.orders || d.data || [];
            const mapped = raw.map(o => ({
                id: o.id,
                orderNumber: o.orderNumber || o.order_number || o.id?.slice?.(-6) || o.id,
                customerName: o.customerName || o.customer?.name || o.guestName || 'Walk-in',
                plateNumber: o.plateNumber || o.vehicle?.plateNo || o.vehiclePlate || '—',
                status: o.status || 'active',
                total: parseFloat(o.grandTotal ?? o.totalAmount ?? o.total ?? 0) || 0,
                vatAmount: parseFloat(o.vatAmount ?? o.vat ?? 0) || 0,
                jobs: o.jobs || [],
                createdAt: o.createdAt,
            }));
            mapped.sort((a, b) => {
                try {
                    const ai = BigInt(String(a.id ?? '0'));
                    const bi = BigInt(String(b.id ?? '0'));
                    if (ai < bi) return -1;
                    if (ai > bi) return 1;
                    return 0;
                } catch {
                    return String(a.id ?? '').localeCompare(String(b.id ?? ''));
                }
            });
            setOrders(mapped);
        } catch {
            setOrders([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchOrders();
        // Fetch products for add-items
        apiFetch('/cashier/takeaway/products-catalog')
            .then(data => {
                const raw = data.departments || data.data || [];
                const all = [];
                (Array.isArray(raw) ? raw : []).forEach(dept => {
                    (dept.categories || []).forEach(cat => (cat.products || []).forEach(p => all.push({ id: p.id, name: p.name, price: parseFloat(p.price ?? p.salePrice ?? 0) || 0 })));
                    (dept.uncategorizedProducts || []).forEach(p => all.push({ id: p.id, name: p.name, price: parseFloat(p.price ?? p.salePrice ?? 0) || 0 }));
                });
                setProducts(all);
            })
            .catch(() => {});
    }, [fetchOrders]);

    // Auto-refresh every 15 seconds
    useEffect(() => {
        const interval = setInterval(() => fetchOrders(true), 15000);
        return () => clearInterval(interval);
    }, [fetchOrders]);

    const handleMarkComplete = async (order) => {
        const job = order.jobs?.[0];
        const jobId = job?.jobId || job?.id;
        if (!jobId) return;
        try {
            await apiFetch(`/cashier/job/${jobId}/complete-cashier`, { method: 'POST', body: JSON.stringify({}) });
            fetchOrders(true);
        } catch (e) {
            alert('Error: ' + e.message);
        }
    };

    const handleGenerateInvoice = async () => {
        if (!paymentOrder) return;
        setInvoicing(true);
        try {
            await apiFetch(`/cashier/order/${paymentOrder.id}/billing`, {
                method: 'PATCH',
                body: JSON.stringify({ customerName: paymentOrder.customerName }),
            }).catch(() => {});

            await apiFetch('/cashier/invoice/create', {
                method: 'POST',
                body: JSON.stringify({
                    orderId: String(paymentOrder.id),
                    discountAmount: 0,
                    invoiceDate: new Date().toISOString().split('T')[0],
                    paymentMethod: payMethod,
                    payments: [{ method: payMethod, amount: paymentOrder.total }],
                }),
            });
            setPaymentOrder(null);
            fetchOrders(true);
        } catch (e) {
            alert('Invoice error: ' + e.message);
        } finally {
            setInvoicing(false);
        }
    };

    const addItemToList = (product) => {
        setAddItems(prev => {
            const ex = prev.find(i => i.id === product.id);
            if (ex) return prev.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i);
            return [...prev, { ...product, qty: 1 }];
        });
    };

    if (loading) {
        return (
            <div style={{ marginTop: 24 }}>
                <div style={{ height: 20, background: '#f1f5f9', borderRadius: 8, width: 160, marginBottom: 16, animation: 'pulse 1.5s ease-in-out infinite' }} />
                {[1,2].map(i => <div key={i} style={{ height: 120, background: '#f1f5f9', borderRadius: 16, marginBottom: 12, animation: 'pulse 1.5s ease-in-out infinite' }} />)}
            </div>
        );
    }

    if (!orders.length) return null;

    return (
        <div style={{ marginTop: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Clock size={16} color="#D4A017" /> Active Orders ({orders.length})
                </h2>
                <button onClick={() => fetchOrders(true)} disabled={refreshing}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', padding: '4px 8px', borderRadius: 8 }}>
                    <RefreshCw size={13} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} /> Refresh
                </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {orders.map(order => {
                    const status = order.status;
                    const statusInfo = WF_LABELS[status] || { label: status, color: '#f1f5f9', textColor: '#475569' };
                    const canMarkComplete = status === 'active' || status === 'in_progress';
                    const canGenerateInvoice = status === 'ready_for_invoice' || status === 'active' || status === 'in_progress';

                    return (
                        <div key={order.id} style={{ background: '#fff', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                            {/* Status bar */}
                            <div style={{ height: 4, background: canGenerateInvoice ? '#059669' : canMarkComplete ? '#f59e0b' : '#e2e8f0' }} />
                            <div style={{ padding: '14px 18px' }}>
                                {/* Header row */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                                    <div>
                                        <p style={{ margin: 0, fontWeight: 800, fontSize: '0.9rem', color: '#0f172a' }}>#{order.orderNumber}</p>
                                        <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#64748b' }}>{order.customerName} · {order.plateNumber}</p>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <p style={{ margin: 0, fontWeight: 900, fontSize: '1rem', color: '#0f172a' }}>SAR {order.total.toFixed(2)}</p>
                                    </div>
                                </div>

                                {/* Status badge */}
                                <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 20, background: statusInfo.color, color: statusInfo.textColor, fontSize: '0.75rem', fontWeight: 700, marginBottom: 12 }}>
                                    {statusInfo.label}
                                </span>

                                {/* Actions */}
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    {canMarkComplete && (
                                        <button onClick={() => handleMarkComplete(order)}
                                            style={{ ...actionBtn, background: '#0d9488', color: '#fff', border: 'none' }}>
                                            <CheckCircle2 size={13} /> Mark Complete
                                        </button>
                                    )}
                                    {canGenerateInvoice && (
                                        <button onClick={() => { setPaymentOrder(order); setPayMethod('Cash'); }}
                                            style={{ ...actionBtn, background: '#059669', color: '#fff', border: 'none' }}>
                                            <Receipt size={13} /> Generate Invoice
                                        </button>
                                    )}
                                    <button onClick={() => { setAddItemsOrder(order); setAddItems([]); }}
                                        style={actionBtn}>
                                        <Plus size={13} /> Add Items
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Payment Dialog */}
            {paymentOrder && (
                <div style={overlay}>
                    <div style={modal}>
                        <div style={{ padding: '20px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1rem' }}>Payment — #{paymentOrder.orderNumber}</h3>
                            <button onClick={() => setPaymentOrder(null)} style={closeBtn}><X size={16} /></button>
                        </div>
                        <div style={{ padding: 24 }}>
                            <div style={{ textAlign: 'center', padding: '20px 0', background: '#f8fafc', borderRadius: 16, marginBottom: 20 }}>
                                <p style={{ margin: '0 0 4px', fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>TOTAL</p>
                                <p style={{ margin: 0, fontSize: '2.4rem', fontWeight: 900, color: '#0f172a' }}>SAR {paymentOrder.total.toFixed(2)}</p>
                                {paymentOrder.vatAmount > 0 && <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>Incl. VAT SAR {paymentOrder.vatAmount.toFixed(2)}</p>}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
                                {PAYMENT_METHODS.map(m => (
                                    <button key={m} onClick={() => setPayMethod(m)}
                                        style={{ padding: '12px 8px', borderRadius: 12, border: `2px solid ${payMethod === m ? '#059669' : '#e2e8f0'}`, background: payMethod === m ? '#f0fdf4' : '#fff', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, color: payMethod === m ? '#059669' : '#475569' }}>
                                        {m}
                                    </button>
                                ))}
                            </div>

                            <button onClick={handleGenerateInvoice} disabled={invoicing}
                                style={{ width: '100%', height: 48, background: invoicing ? '#e2e8f0' : '#059669', color: invoicing ? '#94a3b8' : '#fff', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: '0.95rem', cursor: invoicing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                <Receipt size={16} /> {invoicing ? 'Processing...' : 'Generate Invoice'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Items Dialog */}
            {addItemsOrder && (
                <div style={overlay}>
                    <div style={{ ...modal, maxWidth: 520 }}>
                        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                            <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1rem' }}>Add Items — #{addItemsOrder.orderNumber}</h3>
                            <button onClick={() => setAddItemsOrder(null)} style={closeBtn}><X size={16} /></button>
                        </div>
                        <div style={{ padding: 24, overflowY: 'auto', maxHeight: 500 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16, maxHeight: 220, overflowY: 'auto' }}>
                                {products.slice(0, 30).map(p => (
                                    <button key={p.id} onClick={() => addItemToList(p)}
                                        style={{ textAlign: 'left', padding: 10, borderRadius: 12, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: '0.82rem', transition: 'all 0.15s' }}
                                        onMouseEnter={e => e.currentTarget.style.borderColor = '#D4A017'}
                                        onMouseLeave={e => e.currentTarget.style.borderColor = '#e2e8f0'}>
                                        <p style={{ margin: '0 0 2px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</p>
                                        <p style={{ margin: 0, color: '#64748b' }}>SAR {p.price.toFixed(2)}</p>
                                    </button>
                                ))}
                            </div>

                            {addItems.length > 0 && (
                                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 16 }}>
                                    <p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: '0.82rem', color: '#475569' }}>Items to add:</p>
                                    {addItems.map(item => (
                                        <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                            <p style={{ flex: 1, margin: 0, fontSize: '0.82rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</p>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <button onClick={() => setAddItems(prev => prev.map(i => i.id === item.id ? { ...i, qty: Math.max(0.5, i.qty - 0.5) } : i))} style={qtyBtnSm}><Minus size={10} /></button>
                                                <span style={{ fontSize: '0.8rem', minWidth: 24, textAlign: 'center' }}>{item.qty}</span>
                                                <button onClick={() => setAddItems(prev => prev.map(i => i.id === item.id ? { ...i, qty: i.qty + 0.5 } : i))} style={qtyBtnSm}><Plus size={10} /></button>
                                            </div>
                                            <p style={{ margin: 0, fontWeight: 800, fontSize: '0.82rem', width: 64, textAlign: 'right' }}>SAR {(item.price * item.qty).toFixed(2)}</p>
                                            <button onClick={() => setAddItems(prev => prev.filter(i => i.id !== item.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={13} /></button>
                                        </div>
                                    ))}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '0.9rem', borderTop: '1px solid #f1f5f9', paddingTop: 10, marginTop: 4 }}>
                                        <span>Extra Total</span>
                                        <span>SAR {addItems.reduce((s, i) => s + i.price * i.qty, 0).toFixed(2)}</span>
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                                <button onClick={() => setAddItemsOrder(null)} style={{ flex: 1, padding: '10px 0', border: '1px solid #e2e8f0', borderRadius: 10, background: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem', color: '#475569' }}>Cancel</button>
                                <button disabled={addItems.length === 0}
                                    style={{ flex: 1, padding: '10px 0', border: 'none', borderRadius: 10, background: addItems.length ? '#059669' : '#e2e8f0', color: addItems.length ? '#fff' : '#94a3b8', cursor: addItems.length ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: '0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                    <Check size={15} /> Save & Continue
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} } @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
        </div>
    );
}

const actionBtn = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, color: '#475569' };
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 };
const modal = { background: '#fff', borderRadius: 20, width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden' };
const closeBtn = { background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4, display: 'flex' };
const qtyBtnSm = { width: 20, height: 20, borderRadius: 4, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' };
