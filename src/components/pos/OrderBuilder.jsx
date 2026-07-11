import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Search, Package, Plus, Minus, Trash2, Receipt, Tag, Check, Layers, Wrench, X, UserPlus } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { usePOS } from '../../context/POSContext';
import TechnicianAssignment from './TechnicianAssignment';

const PAYMENT_METHODS = ['Cash', 'Card', 'Bank Transfer', 'Tamara', 'Tabby', 'Monthly billing'];

export default function OrderBuilder({ orderInfo, department, createdOrderId, deptJobIds, onOrderCreated, onBack, onComplete, onAddDept }) {
    const { cart, setCart, markJobEdited, setActiveOrder, activeOrder } = usePOS();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchProduct, setSearchProduct] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [categories, setCategories] = useState(['All']);
    const [discount, setDiscount] = useState('');
    const [discountType, setDiscountType] = useState('amount');
    const [promoCode, setPromoCode] = useState('');
    const [promoApplied, setPromoApplied] = useState(0);
    const [promoLoading, setPromoLoading] = useState(false);
    const [showTechAssign, setShowTechAssign] = useState(false);
    const [assignedTechs, setAssignedTechs] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [invoiceStep, setInvoiceStep] = useState(null);
    const [paymentRows, setPaymentRows] = useState([{ method: 'Cash', amount: '' }]);
    const [invoiceData, setInvoiceData] = useState(null);
    const [orderId, setOrderId] = useState(createdOrderId || activeOrder?.id || null);
    const [jobId, setJobId] = useState(deptJobIds?.[department?.name] || null);
    const [deptJobApiStatus, setDeptJobApiStatus] = useState('pending');

    useEffect(() => {
        setLoading(true);
        apiFetch('/cashier/takeaway/products-catalog')
            .then(data => {
                const raw = data.departments || data.catalog || data.data || data || [];
                const allProds = [];
                const cats = new Set(['All']);

                (Array.isArray(raw) ? raw : []).forEach(dept => {
                    const deptName = (dept.name || dept.department || '').toLowerCase();
                    const targetName = (department?.name || '').toLowerCase();

                    if (department?.id === 'direct' || deptName.includes(targetName) || targetName.includes(deptName) || !targetName) {
                        (dept.categories || []).forEach(cat => {
                            cats.add(cat.name);
                            (cat.products || []).forEach(p => allProds.push({ ...p, _catName: cat.name }));
                        });
                        (dept.uncategorizedProducts || []).forEach(p => allProds.push(p));
                    }
                });

                setCategories(Array.from(cats));
                setProducts(allProds.map(p => ({
                    id: String(p.id), name: p.name,
                    price: parseFloat(p.price ?? p.salePrice ?? 0) || 0,
                    type: p.itemType || p.type || 'product',
                    unit: p.unit || 'pcs',
                    stock: p.qty_on_hand ?? p.qtyOnHand ?? 0,
                    category: p._catName || p.category || 'Uncategorized',
                    allowDecimalQty: !!p.allowDecimalQty,
                    allowMinusQty: !!(p.allowMinusQty ?? p.allow_minus_qty),
                })));
            })
            .catch(() => setProducts([]))
            .finally(() => setLoading(false));
    }, [department]);

    const filtered = useMemo(() => {
        return products.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(searchProduct.toLowerCase());
            const matchesCat = selectedCategory === 'All' || p.category === selectedCategory;
            return matchesSearch && matchesCat;
        });
    }, [products, searchProduct, selectedCategory]);

    const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);

    const itemDiscounts = cart.reduce((s, i) => {
        const itemSub = i.price * i.qty;
        const d = parseFloat(i.discount) || 0;
        const amt = i.discountType === 'percent' ? itemSub * (d / 100) : d;
        return s + amt;
    }, 0);

    const afterItemDisc = subtotal - itemDiscounts;
    const globalDiscAmt = discountType === 'percent' ? afterItemDisc * ((parseFloat(discount) || 0) / 100) : (parseFloat(discount) || 0);
    const totalDiscount = itemDiscounts + globalDiscAmt + promoApplied;

    const afterDisc = subtotal - totalDiscount;
    const vat = afterDisc * 0.15;
    const grandTotal = Math.max(0, afterDisc + vat);

    const toggleCart = (p) => {
        setCart(prev => {
            const ex = prev.find(i => i.id === p.id);
            if (ex) return prev.filter(i => i.id !== p.id);
            return [...prev, { ...p, qty: 1, discount: 0, discountType: 'amount', _deptId: department?.id, _deptName: department?.name }];
        });
    };

    const updateQty = (id, n) => {
        const item = cart.find(i => i.id === id);
        const step = item?.allowDecimalQty ? 0.5 : 1;
        const val = Math.max(step, parseFloat(n) || step);
        setCart(prev => prev.map(i => i.id === id ? { ...i, qty: val } : i));
    };

    const updateItemDiscount = (id, val, type) => {
        setCart(prev => prev.map(i => i.id === id ? { ...i, discount: val, discountType: type || i.discountType || 'amount' } : i));
    };

    const removeItem = (id) => setCart(prev => prev.filter(i => i.id !== id));

    const handleCreateInvoice = async () => {
        if (!orderId) {
            alert('No active order found. Please go back and place the order first before generating an invoice.');
            return;
        }
        setSubmitting(true);
        try {
            const payments = paymentRows.filter(r => parseFloat(r.amount) > 0).map(r => ({ method: r.method, amount: parseFloat(r.amount) || 0 }));
            // Reference payload shape — backend computes totals from job pricing
            const res = await apiFetch('/cashier/invoice/create', {
                method: 'POST',
                body: JSON.stringify({
                    orderId: String(orderId),
                    discountAmount: totalDiscount,
                    invoiceDate: new Date().toISOString().split('T')[0],
                    paymentMethod: paymentRows[0]?.method || 'Cash',
                    payments,
                }),
            });
            setInvoiceData(res);
            setInvoiceStep('done');
        } catch (e) {
            alert('Invoice error: ' + e.message);
        } finally {
            setSubmitting(false);
        }
    };

    // Transitions
    if (invoiceStep === 'payment') {
        return (
            <div style={{ width: '100%', display: 'flex', justifyContent: 'center', paddingTop: 40 }}>
                <div style={{ width: '100%', maxWidth: 500 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
                        <button onClick={() => setInvoiceStep(null)} style={iconBtn}><ArrowLeft size={18} /></button>
                        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900 }}>Payment Details</h2>
                    </div>

                    <div style={{ background: '#23262D', borderRadius: 24, padding: '32px 24px', textAlign: 'center', marginBottom: 28, boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>
                        <p style={{ margin: '0 0 8px', fontSize: '0.85rem', color: '#94a3b8', fontWeight: 700, letterSpacing: 1 }}>GRAND TOTAL</p>
                        <p style={{ margin: '0 0 4px', fontSize: '3.2rem', fontWeight: 900, color: '#FCC247' }}>SAR {grandTotal.toFixed(2)}</p>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>Including 15% VAT (SAR {vat.toFixed(2)})</p>
                    </div>

                    <div style={{ background: '#fff', borderRadius: 24, padding: 24, border: '1.5px solid #f1f5f9', marginBottom: 28 }}>
                        <p style={{ margin: '0 0 16px', fontWeight: 900, fontSize: '1rem', color: '#1E2124' }}>Select Payment Method</p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            {PAYMENT_METHODS.map(m => {
                                const isSelected = paymentRows[0]?.method === m;
                                return (
                                    <button key={m} onClick={() => setPaymentRows([{ method: m, amount: String(grandTotal.toFixed(2)) }])}
                                        style={{ padding: '16px 12px', borderRadius: 16, border: `2.5px solid ${isSelected ? '#FCC247' : '#f1f5f9'}`, background: isSelected ? '#FFF9EC' : '#fff', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 800, color: isSelected ? '#92400E' : '#64748b', transition: 'all 0.15s' }}>
                                        {m}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <button onClick={handleCreateInvoice} disabled={submitting}
                        style={{ width: '100%', height: 60, background: '#23262D', color: '#FCC247', border: 'none', borderRadius: 18, fontWeight: 900, fontSize: '1.1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }}>
                        <Receipt size={22} /> {submitting ? 'Generating Invoice...' : 'Generate Invoice'}
                    </button>
                </div>
            </div>
        );
    }

    if (invoiceStep === 'done') {
        return (
            <div style={{ width: '100%', textAlign: 'center', paddingTop: 80 }}>
                <div style={{ width: 100, height: 100, borderRadius: '50%', background: '#FCC247', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 32px', boxShadow: '0 20px 40px rgba(252,194,71,0.2)' }}>
                    <Check size={50} color="#23262D" strokeWidth={3} />
                </div>
                <h2 style={{ margin: '0 0 12px', fontSize: '2rem', fontWeight: 900, color: '#1E2124' }}>Success!</h2>
                <p style={{ margin: '0 0 8px', color: '#64748b', fontSize: '1.1rem' }}>Order #{orderId} has been invoiced.</p>
                {invoiceData?.invoiceNo && <p style={{ margin: '0 0 40px', fontWeight: 800, color: '#D4A017', fontSize: '1.2rem' }}>Invoice No: {invoiceData.invoiceNo}</p>}
                <button onClick={() => { setCart([]); setActiveOrder(null); onComplete(); }}
                    style={{ padding: '16px 48px', background: '#23262D', color: '#FCC247', border: 'none', borderRadius: 18, fontWeight: 900, fontSize: '1.05rem', cursor: 'pointer' }}>
                    Continue to Dashboard
                </button>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', gap: 0, height: 'calc(100vh - 104px)', margin: '-24px', overflow: 'hidden' }}>
            {/* LEFT: Product Selection */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: '#F8FAF9' }}>
                {/* Fixed Header */}
                <div style={{ padding: '0', background: '#fff', borderBottom: '1.5px solid #f1f5f9' }}>
                    {/* Job Info Banner */}
                    <div style={{ background: '#23262D', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Wrench size={16} color="#FCC247" />
                                <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 800, letterSpacing: 1 }}>TECHNICIAN:</span>
                                <span style={{ color: '#FCC247', fontSize: '0.85rem', fontWeight: 900 }}>{orderInfo?.technician?.name?.toUpperCase() || 'NOT ASSIGNED'}</span>
                            </div>
                            <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)' }} />
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Package size={16} color="#FCC247" />
                                <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 800, letterSpacing: 1 }}>DEPT:</span>
                                <span style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 900 }}>{department?.name?.toUpperCase() || 'GENERAL'}</span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 10px #10B981' }} />
                            <span style={{ color: '#10B981', fontSize: '0.7rem', fontWeight: 900 }}>LIVE SESSION</span>
                        </div>
                    </div>

                    <div style={{ padding: '20px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                            <button onClick={onBack} style={iconBtn}><ArrowLeft size={18} /></button>
                            <div style={{ flex: 1 }}>
                                <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#1E2124' }}>{orderInfo?.customer?.name || 'Walk-in Customer'}</h2>
                                <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>Plate: {orderInfo?.vehicle?.plateNumber || '–'} · {orderInfo?.vehicle?.make || ''} {orderInfo?.vehicle?.model || ''}</p>
                            </div>
                            <div style={{ position: 'relative', width: 300 }}>
                                <Search size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                <input type="text" placeholder="Search product or service..." value={searchProduct} onChange={e => setSearchProduct(e.target.value)}
                                    style={{ width: '100%', padding: '12px 14px 12px 42px', border: '1.5px solid #e5e7eb', borderRadius: 14, fontSize: '0.9rem', outline: 'none', fontFamily: 'inherit' }} />
                            </div>
                        </div>

                        {/* Category Scroll */}
                        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }} className="no-scrollbar">
                            {categories.map(cat => (
                                <button key={cat} onClick={() => setSelectedCategory(cat)}
                                    style={{
                                        padding: '10px 20px', borderRadius: 12, border: `2px solid ${selectedCategory === cat ? '#23262D' : '#f1f5f9'}`,
                                        background: selectedCategory === cat ? '#23262D' : '#fff',
                                        color: selectedCategory === cat ? '#FCC247' : '#64748b',
                                        fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer', whiteSpace: 'nowrap', transition: '0.15s'
                                    }}>
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Vertical Product List */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                    {loading ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {[1, 2, 3, 4, 5].map(i => <div key={i} style={{ height: 100, borderRadius: 20, background: '#fff', border: '1px solid #f1f5f9', animation: 'pulse 1.5s infinite' }} />)}
                        </div>
                    ) : filtered.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px 0', opacity: 0.4 }}>
                            <Package size={48} color="#94a3b8" style={{ marginBottom: 12 }} />
                            <p style={{ fontWeight: 800 }}>No products found in this category</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {filtered.map(p => {
                                const inCart = cart.find(i => i.id === p.id);
                                const outOfStock = !p.allowMinusQty && p.stock <= 0;
                                return (
                                    <div key={p.id} style={{
                                        background: '#fff', borderRadius: 20, padding: '16px 20px', border: `2px solid ${inCart ? '#FCC247' : '#f1f5f9'}`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 4px 12px rgba(0,0,0,0.02)', transition: '0.2s'
                                    }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                                                <p style={{ margin: 0, fontWeight: 800, fontSize: '0.95rem', color: '#1E2124' }}>{p.name}</p>
                                                {inCart && <Check size={16} color="#FCC247" strokeWidth={3} />}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '4px 10px', borderRadius: 8, background: outOfStock ? '#FEE2E2' : '#DCFCE7', color: outOfStock ? '#B91C1C' : '#15803D' }}>
                                                    {outOfStock ? 'Out of Stock' : `Available: ${p.stock}`}
                                                </span>
                                                <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 700 }}>Unit: {p.unit}</span>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                                            <div style={{ textAlign: 'right' }}>
                                                <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700 }}>PRICE / UNIT</p>
                                                <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#1E2124' }}>SAR {p.price.toFixed(2)}</p>
                                            </div>

                                            {inCart ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#23262D', borderRadius: 14, padding: '6px 14px', color: '#FCC247' }}>
                                                    <button onClick={() => updateQty(p.id, inCart.qty - (p.allowDecimalQty ? 0.5 : 1))} style={qtyBtnDark}><Minus size={14} /></button>
                                                    <span style={{ fontWeight: 900, minWidth: 24, textAlign: 'center' }}>{inCart.qty}</span>
                                                    <button onClick={() => updateQty(p.id, inCart.qty + (p.allowDecimalQty ? 0.5 : 1))} style={qtyBtnDark} disabled={!p.allowMinusQty && inCart.qty >= p.stock}><Plus size={14} /></button>
                                                </div>
                                            ) : (
                                                <button onClick={() => toggleCart(p)} disabled={outOfStock}
                                                    style={{ width: 48, height: 48, borderRadius: 14, background: outOfStock ? '#f1f5f9' : '#23262D', border: 'none', color: outOfStock ? '#cbd5e1' : '#FCC247', cursor: outOfStock ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <Plus size={22} strokeWidth={3} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* RIGHT: Live Invoicing Sidebar */}
            <div style={{ width: 380, background: '#fff', borderLeft: '1.5px solid #f1f5f9', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '24px', background: '#23262D', color: '#FCC247', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Receipt size={22} />
                    <span style={{ fontWeight: 900, fontSize: '1.05rem', letterSpacing: 1 }}>LIVE INVOICING</span>
                    {cart.length > 0 && <span style={{ marginLeft: 'auto', background: '#FCC247', color: '#23262D', padding: '2px 8px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 900 }}>{cart.length} ITEMS</span>}
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                    {cart.length === 0 ? (
                        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: '#94a3b8' }}>
                            <Layers size={48} style={{ opacity: 0.1, marginBottom: 16 }} />
                            <p style={{ fontWeight: 800 }}>Cart is empty</p>
                            <p style={{ fontSize: '0.75rem' }}>Select items to start building<br />the invoice for this job.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                            {cart.map(i => (
                                <div key={i.id} style={{ paddingBottom: 16, borderBottom: '1px solid #f1f5f9' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                                        <p style={{ margin: 0, fontWeight: 800, fontSize: '0.85rem', color: '#1E2124' }}>{i.name}</p>
                                        <button onClick={() => removeItem(i.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0, fontSize: '0.7rem', fontWeight: 700 }}>Remove</button>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>{i.qty} {i.unit} × {i.price.toFixed(2)}</p>
                                        <p style={{ margin: 0, fontWeight: 900, fontSize: '0.9rem', color: '#1E2124' }}>SAR {(i.qty * i.price).toFixed(2)}</p>
                                    </div>
                                    
                                    {/* Item Discount Input */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div style={{ position: 'relative', flex: 1 }}>
                                            <Tag size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                            <input type="number" placeholder="Disc" value={i.discount || ''} onChange={e => updateItemDiscount(i.id, e.target.value)}
                                                style={{ width: '100%', padding: '6px 8px 6px 26px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: '0.75rem', outline: 'none' }} />
                                        </div>
                                        <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: 8, padding: 2 }}>
                                            <button onClick={() => updateItemDiscount(i.id, i.discount, 'percent')} 
                                                style={{ padding: '4px 8px', border: 'none', borderRadius: 6, fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer', background: i.discountType === 'percent' ? '#23262D' : 'transparent', color: i.discountType === 'percent' ? '#FCC247' : '#64748b' }}>%</button>
                                            <button onClick={() => updateItemDiscount(i.id, i.discount, 'amount')} 
                                                style={{ padding: '4px 8px', border: 'none', borderRadius: 6, fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer', background: i.discountType === 'amount' ? '#23262D' : 'transparent', color: i.discountType === 'amount' ? '#FCC247' : '#64748b' }}>SAR</button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Invoice Footer */}
                <div style={{ padding: '24px', background: '#F9FAFB', borderTop: '1.5px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.85rem' }}>
                            <span style={{ fontWeight: 600 }}>SUBTOTAL</span>
                            <span style={{ fontWeight: 800, color: '#1E2124' }}>SAR {subtotal.toFixed(2)}</span>
                        </div>
                        
                        {/* Global Discount Row */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0' }}>
                            <div style={{ position: 'relative', flex: 1 }}>
                                <Tag size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                <input type="number" placeholder="Global Discount" value={discount} onChange={e => setDiscount(e.target.value)}
                                    style={{ width: '100%', padding: '8px 8px 8px 26px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: '0.8rem', outline: 'none' }} />
                            </div>
                            <div style={{ display: 'flex', background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 10, padding: 2 }}>
                                <button onClick={() => setDiscountType('percent')} 
                                    style={{ padding: '6px 10px', border: 'none', borderRadius: 8, fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', background: discountType === 'percent' ? '#23262D' : 'transparent', color: discountType === 'percent' ? '#FCC247' : '#64748b' }}>%</button>
                                <button onClick={() => setDiscountType('amount')} 
                                    style={{ padding: '6px 10px', border: 'none', borderRadius: 8, fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', background: discountType === 'amount' ? '#23262D' : 'transparent', color: discountType === 'amount' ? '#FCC247' : '#64748b' }}>SAR</button>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.85rem' }}>
                            <span style={{ fontWeight: 600 }}>VAT (15%)</span>
                            <span style={{ fontWeight: 800, color: '#1E2124' }}>SAR {vat.toFixed(2)}</span>
                        </div>
                        
                        {totalDiscount > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#B91C1C', fontSize: '0.85rem' }}>
                                <span style={{ fontWeight: 600 }}>TOTAL DISCOUNT</span>
                                <span style={{ fontWeight: 800 }}>- SAR {totalDiscount.toFixed(2)}</span>
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 16, borderTop: '2.5px dashed #e5e7eb', marginBottom: 24 }}>
                        <div>
                            <span style={{ display: 'block', fontWeight: 900, fontSize: '1rem', color: '#1E2124' }}>GRAND TOTAL</span>
                            <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 700 }}>Final Invoice Amount</span>
                        </div>
                        <span style={{ fontWeight: 900, fontSize: '1.25rem', color: '#23262D' }}>SAR {grandTotal.toFixed(2)}</span>
                    </div>

                    <button onClick={() => setInvoiceStep('payment')} disabled={cart.length === 0}
                        style={{ width: '100%', height: 52, background: cart.length === 0 ? '#f1f5f9' : '#FCC247', color: '#23262D', border: 'none', borderRadius: 14, fontWeight: 900, fontSize: '1rem', cursor: cart.length === 0 ? 'not-allowed' : 'pointer', boxShadow: cart.length > 0 ? '0 10px 20px rgba(252,194,71,0.3)' : 'none' }}>
                        PROCEED TO PAYMENT
                    </button>
                </div>
            </div>

            <style>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
            `}</style>
        </div>
    );
}

const iconBtn = { width: 44, height: 44, background: '#fff', border: '1.5px solid #f1f5f9', borderRadius: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' };
const qtyBtnDark = { background: 'none', border: 'none', color: '#FCC247', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4 };
