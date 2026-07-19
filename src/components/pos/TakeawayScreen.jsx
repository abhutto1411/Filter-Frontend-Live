import { useState, useEffect, useMemo } from 'react';
import { ShoppingBag, Plus, Minus, Trash2, ShoppingCart, Check, Search, Tag, Receipt } from 'lucide-react';
import { apiFetch } from '../../services/api';

const VAT_RATE = 0.15;
const PAYMENT_METHODS = ['Cash', 'Card', 'Bank Transfer'];

const isPriceEditable = (p) =>
    p?.isPriceEditable === true ||
    p?.is_price_editable === true ||
    String(p?.isPriceEditable ?? '').toLowerCase() === 'true';

const getMinEditablePrice = (p) => {
    const n = parseFloat(p?.minPriceEditable ?? p?.min_price_editable);
    return Number.isFinite(n) && n >= 0 ? n : 0;
};

const catalogUnitPrice = (p) => parseFloat(p?.salePrice ?? p?.price ?? 0) || 0;

const lineUnitPrice = (entry) => {
    const override = parseFloat(entry?.unitPrice);
    if (Number.isFinite(override) && override > 0 && isPriceEditable(entry.product)) {
        return override;
    }
    return catalogUnitPrice(entry.product);
};

export default function TakeawayScreen() {
    const [catalog, setCatalog] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedDept, setSelectedDept] = useState('all');
    const [selectedCat, setSelectedCat] = useState('All');
    const [cart, setCart] = useState({});
    const [discount, setDiscount] = useState('');
    const [promoCode, setPromoCode] = useState('');
    const [payMethod, setPayMethod] = useState('Cash');
    const [checkingOut, setCheckingOut] = useState(false);
    const [done, setDone] = useState(false);

    useEffect(() => {
        apiFetch('/cashier/takeaway/products-catalog')
            .then(d => {
                const depts = d.departments || d.data || [];
                setCatalog(Array.isArray(depts) ? depts : []);
            })
            .catch(() => setCatalog([]))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { setSelectedCat('All'); }, [selectedDept]);

    const currentDept = selectedDept === 'all' ? null : catalog.find(d => d.id === selectedDept);

    const categories = useMemo(() => {
        if (!currentDept) return [];
        return ['All', ...(currentDept.categories || []).map(c => c.name)];
    }, [currentDept]);

    const products = useMemo(() => {
        let list = [];
        if (currentDept) {
            if (selectedCat === 'All') {
                list = [
                    ...(currentDept.categories || []).flatMap(c => (c.products || []).map(p => ({ ...p, catName: c.name }))),
                    ...(currentDept.uncategorizedProducts || []).map(p => ({ ...p, catName: '' })),
                ];
            } else {
                const cat = (currentDept.categories || []).find(c => c.name === selectedCat);
                list = (cat?.products || []).map(p => ({ ...p, catName: cat.name }));
            }
        } else {
            list = catalog.flatMap(d => [
                ...(d.categories || []).flatMap(c => (c.products || []).map(p => ({ ...p, catName: c.name, deptName: d.name }))),
                ...(d.uncategorizedProducts || []).map(p => ({ ...p, catName: '', deptName: d.name })),
            ]);
        }
        list = list.filter(p => p.isActive !== false);
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            list = list.filter(p => (p.name || '').toLowerCase().includes(q));
        }
        return list;
    }, [catalog, currentDept, selectedCat, search]);

    const addToCart = (p) => {
        setCart(prev => {
            const existing = prev[p.id];
            return {
                ...prev,
                [p.id]: {
                    product: p,
                    qty: (existing?.qty || 0) + 1,
                    unitPrice: existing?.unitPrice ?? catalogUnitPrice(p),
                },
            };
        });
    };
    const decToCart = (id) => {
        setCart(prev => {
            const next = { ...prev };
            if (next[id]?.qty > 1) next[id] = { ...next[id], qty: next[id].qty - 1 };
            else delete next[id];
            return next;
        });
    };
    const removeItem = (id) => setCart(prev => { const n = { ...prev }; delete n[id]; return n; });
    const setLineUnitPrice = (id, value) => {
        const product = cart[id]?.product;
        if (!product || !isPriceEditable(product)) return;
        const parsed = parseFloat(value);
        if (!Number.isFinite(parsed) || parsed <= 0) {
            setCart(prev => ({
                ...prev,
                [id]: { ...prev[id], unitPrice: catalogUnitPrice(product) },
            }));
            return;
        }
        const min = getMinEditablePrice(product);
        if (parsed < min - 0.005) {
            alert(`Price cannot be below SAR ${min.toFixed(2)} for this product.`);
            return;
        }
        setCart(prev => ({
            ...prev,
            [id]: { ...prev[id], unitPrice: Math.round(parsed * 100) / 100 },
        }));
    };

    const cartItems = Object.values(cart);
    const cartCount = cartItems.reduce((s, { qty }) => s + qty, 0);
    const subtotal = cartItems.reduce((s, entry) => s + lineUnitPrice(entry) * entry.qty, 0);
    const discountAmt = Math.max(0, Math.min(parseFloat(discount) || 0, subtotal));
    const afterDiscount = subtotal - discountAmt;
    const vat = afterDiscount * VAT_RATE;
    const grandTotal = afterDiscount + vat;

    const handleCheckout = async () => {
        if (cartItems.length === 0) return;
        setCheckingOut(true);
        try {
            const items = cartItems.map((entry) => {
                const unitPrice = lineUnitPrice(entry);
                return {
                    productId: entry.product.id,
                    qty: entry.qty,
                    unitPrice,
                };
            });
            await apiFetch('/cashier/takeaway/checkout', {
                method: 'POST',
                body: JSON.stringify({
                    customerName: 'Walk-in Customer',
                    customerMobile: '+966500000000',
                    items,
                    paymentMethod: payMethod,
                    discount: discountAmt,
                    promoCode: promoCode || null,
                    subtotal,
                    vat,
                    totalAmount: grandTotal,
                }),
            });
            setDone(true);
            setCart({});
            setDiscount('');
            setPromoCode('');
        } catch (e) {
            alert('Checkout failed: ' + (e.message || 'Unknown error'));
        } finally {
            setCheckingOut(false);
        }
    };

    if (done) {
        return (
            <div style={{ width: '100%', textAlign: 'center', paddingTop: 80 }}>
                <div style={{ width: 100, height: 100, borderRadius: '50%', background: '#FCC247', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 32px', boxShadow: '0 20px 40px rgba(252,194,71,0.2)' }}>
                    <Check size={50} color="#23262D" strokeWidth={3} />
                </div>
                <h2 style={{ margin: '0 0 12px', fontSize: '2rem', fontWeight: 900, color: '#1E2124' }}>Success!</h2>
                <p style={{ margin: '0 0 40px', color: '#64748b', fontSize: '1.1rem' }}>Takeaway invoice generated successfully.</p>
                <button onClick={() => setDone(false)}
                    style={{ padding: '16px 48px', background: '#23262D', color: '#FCC247', border: 'none', borderRadius: 18, fontWeight: 900, fontSize: '1.05rem', cursor: 'pointer' }}>
                    New Takeaway Order
                </button>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', gap: 0, height: '100%', overflow: 'hidden' }}>
            {/* LEFT: Product Selection */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: '#F8FAF9' }}>
                {/* Fixed Header */}
                <div style={{ padding: '24px', background: '#fff', borderBottom: '1.5px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                        <div style={{ flex: 1 }}>
                            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#1E2124' }}>Takeaway Order</h2>
                            <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>Browse catalog and add items for direct checkout</p>
                        </div>
                        <div style={{ position: 'relative', width: 300 }}>
                            <Search size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            <input type="text" placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)}
                                style={{ width: '100%', padding: '12px 14px 12px 42px', border: '1.5px solid #e5e7eb', borderRadius: 14, fontSize: '0.9rem', outline: 'none', fontFamily: 'inherit' }} />
                        </div>
                    </div>

                    {/* Department Tabs */}
                    {!loading && catalog.length > 0 && (
                        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }} className="no-scrollbar">
                            <button onClick={() => setSelectedDept('all')}
                                style={{
                                    padding: '10px 20px', borderRadius: 12, border: `2px solid ${selectedDept === 'all' ? '#23262D' : '#f1f5f9'}`,
                                    background: selectedDept === 'all' ? '#23262D' : '#fff',
                                    color: selectedDept === 'all' ? '#FCC247' : '#64748b',
                                    fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer', whiteSpace: 'nowrap', transition: '0.15s'
                                }}>
                                All Departments
                            </button>
                            {catalog.map(d => (
                                <button key={d.id} onClick={() => setSelectedDept(d.id)}
                                    style={{
                                        padding: '10px 20px', borderRadius: 12, border: `2px solid ${selectedDept === d.id ? '#23262D' : '#f1f5f9'}`,
                                        background: selectedDept === d.id ? '#23262D' : '#fff',
                                        color: selectedDept === d.id ? '#FCC247' : '#64748b',
                                        fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer', whiteSpace: 'nowrap', transition: '0.15s'
                                    }}>
                                    {d.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Product Grid */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                    {loading ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => <div key={i} style={{ height: 180, borderRadius: 20, background: '#fff', border: '1px solid #f1f5f9', animation: 'pulse 1.5s infinite' }} />)}
                        </div>
                    ) : products.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px 0', opacity: 0.4 }}>
                            <ShoppingBag size={48} color="#94a3b8" style={{ marginBottom: 12 }} />
                            <p style={{ fontWeight: 800 }}>No products available</p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                            {products.map(p => {
                                const inCart = cart[p.id]?.qty || 0;
                                const originalPrice = parseFloat(p.salePrice ?? p.price ?? 0);
                                const priceIncVat = (originalPrice * (1 + VAT_RATE));
                                const allowsMinus = p.allowMinusQty === true || p.allow_minus_qty === true
                                    || String(p.allowMinusQty ?? '').toLowerCase() === 'true'
                                    || String(p.allow_minus_qty ?? '').toLowerCase() === 'true';
                                const qty = Number(p.qtyOnHand ?? p.stock ?? 0) || 0;
                                const outOfStock = !allowsMinus && qty <= 0;
                                const stockLabel = allowsMinus
                                    ? (qty < 0 ? `Backorder: ${qty}` : `Available: ${qty}`)
                                    : (outOfStock ? 'No Stock' : `In Stock: ${qty}`);
                                
                                return (
                                    <div key={p.id} style={{ 
                                        background: '#fff', borderRadius: 20, padding: 16, border: `2px solid ${inCart ? '#FCC247' : '#f1f5f9'}`,
                                        display: 'flex', flexDirection: 'column', gap: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.02)', transition: '0.2s',
                                        position: 'relative'
                                    }}>
                                        <div style={{ height: 100, borderRadius: 14, background: '#F8FAF9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <ShoppingBag size={32} color="#cbd5e1" />
                                        </div>
                                        
                                        <div style={{ flex: 1 }}>
                                            <p style={{ margin: '0 0 6px', fontWeight: 800, fontSize: '0.9rem', color: '#1E2124', lineHeight: 1.4 }}>{p.name}</p>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '3px 8px', borderRadius: 6, background: outOfStock ? '#FEE2E2' : (allowsMinus && qty <= 0 ? '#EDE9FE' : '#DCFCE7'), color: outOfStock ? '#B91C1C' : (allowsMinus && qty <= 0 ? '#7C3AED' : '#15803D') }}>
                                                    {stockLabel}
                                                </span>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: 10 }}>
                                            <div style={{ textAlign: 'left' }}>
                                                <p style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#1E2124' }}>SAR {priceIncVat.toFixed(2)}</p>
                                                <p style={{ margin: 0, fontSize: '0.6rem', color: '#94a3b8', fontWeight: 700 }}>Incl. 15% VAT</p>
                                            </div>

                                            {inCart > 0 ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#23262D', borderRadius: 12, padding: '4px 10px', color: '#FCC247' }}>
                                                    <button onClick={() => decToCart(p.id)} style={qtyBtnDark}><Minus size={12} /></button>
                                                    <span style={{ fontWeight: 900, minWidth: 20, textAlign: 'center', fontSize: '0.85rem' }}>{inCart}</span>
                                                    <button onClick={() => addToCart(p)} style={qtyBtnDark} disabled={!allowsMinus && inCart >= qty}><Plus size={12} /></button>
                                                </div>
                                            ) : (
                                                <button onClick={() => addToCart(p)} disabled={outOfStock}
                                                    style={{ width: 40, height: 40, borderRadius: 12, background: outOfStock ? '#f1f5f9' : '#23262D', border: 'none', color: outOfStock ? '#cbd5e1' : '#FCC247', cursor: outOfStock ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <Plus size={18} strokeWidth={3} />
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

            {/* RIGHT: Live Invoice Sidebar */}
            <div style={{ width: 360, background: '#fff', borderLeft: '1.5px solid #f1f5f9', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '24px', background: '#23262D', color: '#FCC247', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Receipt size={22} />
                    <span style={{ fontWeight: 900, fontSize: '1.05rem', letterSpacing: 1 }}>TAKEAWAY CART</span>
                    {cartCount > 0 && <span style={{ marginLeft: 'auto', background: '#FCC247', color: '#23262D', padding: '2px 8px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 900 }}>{cartCount}</span>}
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                    {cartItems.length === 0 ? (
                        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: '#94a3b8' }}>
                            <ShoppingCart size={48} style={{ opacity: 0.1, marginBottom: 16 }} />
                            <p style={{ fontWeight: 800 }}>Cart is empty</p>
                            <p style={{ fontSize: '0.75rem' }}>Items will appear here once<br/>you add them to your order.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {cartItems.map((entry) => {
                                const { product, qty } = entry;
                                const unitPrice = lineUnitPrice(entry);
                                const editable = isPriceEditable(product);
                                const minPrice = getMinEditablePrice(product);
                                return (
                                    <div key={product.id} style={{ display: 'flex', gap: 12, paddingBottom: 14, borderBottom: '1px solid #f1f5f9' }}>
                                        <div style={{ flex: 1 }}>
                                            <p style={{ margin: '0 0 4px', fontWeight: 800, fontSize: '0.85rem', color: '#1E2124' }}>{product.name}</p>
                                            {editable ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b' }}>{qty} ×</span>
                                                        <input
                                                            type="number"
                                                            min={minPrice}
                                                            step="0.01"
                                                            value={entry.unitPrice ?? unitPrice}
                                                            onChange={(e) => setLineUnitPrice(product.id, e.target.value)}
                                                            style={{ width: 88, padding: '4px 6px', border: '1.5px solid #FCC247', borderRadius: 6, fontSize: '0.75rem', fontWeight: 800, outline: 'none', fontFamily: 'inherit' }}
                                                        />
                                                        <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 700 }}>SAR (VAT inc.)</span>
                                                    </div>
                                                    {minPrice > 0 && (
                                                        <span style={{ fontSize: '0.62rem', color: '#92400e', fontWeight: 700 }}>
                                                            Min SAR {minPrice.toFixed(2)}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>{qty} × SAR {unitPrice.toFixed(2)}</p>
                                            )}
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <p style={{ margin: 0, fontWeight: 900, fontSize: '0.9rem', color: '#1E2124' }}>SAR {(unitPrice * qty).toFixed(2)}</p>
                                            <button onClick={() => removeItem(product.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0, fontSize: '0.7rem', fontWeight: 700, marginTop: 4 }}>Remove</button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Checkout Footer */}
                <div style={{ padding: '24px', background: '#F9FAFB', borderTop: '1.5px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.85rem' }}>
                            <span style={{ fontWeight: 600 }}>SUBTOTAL</span>
                            <span style={{ fontWeight: 800, color: '#1E2124' }}>SAR {subtotal.toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.85rem' }}>
                            <span style={{ fontWeight: 600 }}>TAX (15%)</span>
                            <span style={{ fontWeight: 800, color: '#1E2124' }}>SAR {vat.toFixed(2)}</span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 16, borderTop: '2.5px dashed #e5e7eb', marginBottom: 24 }}>
                        <span style={{ fontWeight: 900, fontSize: '1rem', color: '#1E2124' }}>GRAND TOTAL</span>
                        <span style={{ fontWeight: 900, fontSize: '1.25rem', color: '#23262D' }}>SAR {grandTotal.toFixed(2)}</span>
                    </div>

                    {/* Payment Section */}
                    <div style={{ marginBottom: 20 }}>
                        <p style={{ margin: '0 0 10px', fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8' }}>PAYMENT METHOD</p>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {PAYMENT_METHODS.map(m => (
                                <button key={m} onClick={() => setPayMethod(m)}
                                    style={{ padding: '8px 12px', borderRadius: 10, border: `2px solid ${payMethod === m ? '#23262D' : '#e2e8f0'}`, background: payMethod === m ? '#23262D' : '#fff', color: payMethod === m ? '#FCC247' : '#64748b', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', transition: '0.15s' }}>
                                    {m}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button onClick={handleCheckout} disabled={cartCount === 0 || checkingOut}
                        style={{ width: '100%', height: 52, background: cartCount === 0 ? '#f1f5f9' : '#FCC247', color: '#23262D', border: 'none', borderRadius: 14, fontWeight: 900, fontSize: '1rem', cursor: cartCount === 0 ? 'not-allowed' : 'pointer' }}>
                        {checkingOut ? 'PROCESSING...' : 'GENERATE INVOICE'}
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

function Row({ label, value, color }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>{label}</span>
            <span style={{ fontWeight: 700, fontSize: '0.82rem', color: color || '#1E2124' }}>SAR {value.toFixed(2)}</span>
        </div>
    );
}
