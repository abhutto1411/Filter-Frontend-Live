import { useState, useEffect, useMemo, useRef } from 'react';
import {
    Package, Search, ShoppingCart, Plus, Minus, Trash2, Receipt,
    CheckCircle2, RefreshCw, AlertTriangle, Tag as TagIcon, Edit3, Percent
} from 'lucide-react';
import { usePOS } from '../../context/POSContext';
import { apiFetch } from '../../services/api';
import InvoiceDetailsModal from './modern/InvoiceDetailsModal';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers (mirror the Flutter reference PosProduct model)
// ─────────────────────────────────────────────────────────────────────────────

const VAT_RATE = 0.15;
const PAYMENT_METHODS = ['Cash', 'Card', 'Bank Transfer', 'Tabby', 'Tamara'];
const DECIMAL_UNITS = new Set(['liter', 'litre', 'l', 'ml', 'kg', 'g', 'gallon', 'gal', 'oz']);

const r2 = (v) => Math.round((parseFloat(v) || 0) * 100) / 100;

// Reference PosProduct.fromJson: prefers salePriceBeforeVat / sellingPriceBeforeVat when
// the backend exposes it; otherwise derives from the VAT-inclusive salePrice.
const parsePrice = (p) => {
    const exclRaw = parseFloat(p.salePriceBeforeVat ?? p.sellingPriceBeforeVat ?? 0);
    const inclRaw = parseFloat(p.salePrice ?? p.sellingPrice ?? p.price ?? 0);
    if (exclRaw > 0) return { inclVat: r2(exclRaw * (1 + VAT_RATE)), exclVat: r2(exclRaw) };
    if (inclRaw > 0) return { inclVat: r2(inclRaw), exclVat: r2(inclRaw / (1 + VAT_RATE)) };
    return { inclVat: 0, exclVat: 0 };
};

const isService = (p) =>
    p?.type === 'service' || p?.typeLabel === 'Services' || p?.isService === true || p?.isServiceType === true;

// Reference _parseAllowDecimalQty: bool / "true"/"1"/"yes" / known UOM fallback.
const allowsDecimalQty = (p) => {
    const v = p?.allowDecimalQty ?? p?.allow_decimal_qty;
    if (v === true) return true;
    if (v === false) return false;
    if (typeof v === 'number') return v !== 0;
    if (typeof v === 'string') {
        const s = v.trim().toLowerCase();
        if (['true', '1', 'yes'].includes(s)) return true;
        if (['false', '0', 'no'].includes(s)) return false;
    }
    return DECIMAL_UNITS.has((p?.unit || '').toString().toLowerCase().trim());
};

const isPriceEditable = (p) => p?.isPriceEditable === true || p?.is_price_editable === true;

const getMinEditablePrice = (p) => {
    const raw = p?.minPriceEditable ?? p?.min_price_editable;
    const n = parseFloat(raw);
    return Number.isFinite(n) && n >= 0 ? n : 0;
};

// Respects backend's criticalStockPoint (per-product); falls back to 5 (reference default).
const getStockStatus = (p) => {
    if (isService(p)) return { label: 'Service', color: '#15803d', bg: '#dcfce7' };
    const stock = parseFloat(p?.qtyOnHand ?? p?.stock ?? p?.openingQty ?? 0) || 0;
    const critical = Math.max(parseFloat(p?.criticalStockPoint ?? 5) || 5, 0);
    if (stock <= 0) return { label: 'Out of Stock', color: '#b91c1c', bg: '#fee2e2', stock };
    if (stock <= critical) return { label: `Low (${stock})`, color: '#c2410c', bg: '#ffedd5', stock };
    return { label: `In Stock (${stock})`, color: '#15803d', bg: '#dcfce7', stock };
};

const getAvailableStock = (p) => {
    if (isService(p)) return Infinity;
    return parseFloat(p?.qtyOnHand ?? p?.stock ?? p?.openingQty ?? 0) || 0;
};

const getImageUrl = (p) => p?.imageUrl || p?.image_url || p?.image || null;
const getUnit = (p) => (p?.unit || '').toString().trim();

// ─────────────────────────────────────────────────────────────────────────────

export default function ProductsScreen() {
    const {
        catalog, catalogLoading, refreshCatalog,
        cart, setCart, addToCart, removeFromCart, clearCart
    } = usePOS();

    // Filtering / browse state
    const [selectedDeptId, setSelectedDeptId] = useState('All');
    const [selectedType, setSelectedType] = useState('All');
    const [selectedCat, setSelectedCat] = useState('All');
    const [search, setSearch] = useState('');

    // Load / error state
    const [loadError, setLoadError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    // Cart / invoice state
    const [expandedItemId, setExpandedItemId] = useState(null); // line whose discount input is open
    const [globalDiscount, setGlobalDiscount] = useState('');
    const [globalDiscountType, setGlobalDiscountType] = useState('amount'); // 'amount' | 'percent'
    const [promoCode, setPromoCode] = useState('');
    const [promoApplied, setPromoApplied] = useState(0); // fixed SAR from backend
    const [promoLoading, setPromoLoading] = useState(false);
    const [promoError, setPromoError] = useState(null);
    const [payMethod, setPayMethod] = useState('Cash');
    const [checkingOut, setCheckingOut] = useState(false);
    const [invoiceShowing, setInvoiceShowing] = useState(null);

    const didInitialLoad = useRef(false);

    // Initial load + error capture
    const runRefresh = async (isManual = false) => {
        if (isManual) setRefreshing(true);
        setLoadError(null);
        try {
            await refreshCatalog();
        } catch (e) {
            setLoadError(e?.message || 'Failed to load catalog');
        } finally {
            setRefreshing(false);
        }
    };

    useEffect(() => {
        if (didInitialLoad.current) return;
        didInitialLoad.current = true;
        if (catalog.length === 0) runRefresh(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Reset category when department changes
    useEffect(() => { setSelectedCat('All'); }, [selectedDeptId]);

    // ── Build filtered product list ──
    //
    // Backends commonly return the same product in overlapping shapes:
    //   • cat.products   AND  cat.subCategories[].products
    //     (older shape: cat.products = ALL products, incl. those in subcategories)
    //   • uncategorizedProducts  AND  a category entry
    //     (happens for out-of-stock items re-listed under the dept's "uncategorized" bucket)
    //
    // Flutter reference avoids this by preferring `productsWithoutSub` (the explicit
    // "not-in-subcategory" list) over `products`. We do the same and then add a
    // hard dedupe safety net so the same product can't appear twice for a given
    // department when the user navigates back into it.
    const { departments, categories, flatProducts } = useMemo(() => {
        const depts = [{ id: 'All', name: 'All Departments' }, ...catalog];
        const cats = new Set(['All']);
        const products = [];
        const seen = new Set(); // de-dupe key: `${deptId}::${productId}`

        catalog.forEach(dept => {
            const matchDept = selectedDeptId === 'All' || selectedDeptId === dept.id;

            const pushItem = (p, catName = '', forceService = false) => {
                if (!p) return;
                const id = p.id ?? p.productId ?? p.serviceId;
                if (id === undefined || id === null) return;
                const key = `${dept.id}::${id}`;
                if (seen.has(key)) return; // already captured this product for this dept
                const item = { ...p, type: forceService ? 'service' : (p.type || 'product') };
                const type = isService(item) ? 'Services' : 'Products';
                if (selectedType !== 'All' && selectedType !== type) return;
                if (!matchDept) return;
                seen.add(key);
                if (catName) cats.add(catName);
                products.push({
                    ...item,
                    deptId: dept.id,
                    deptName: dept.name,
                    categoryName: catName,
                    typeLabel: type,
                });
            };

            (dept.categories || []).forEach(cat => {
                // Prefer `productsWithoutSub` (reference pattern) — when absent, fall
                // back to `products`. Never read both, otherwise subcategory items get
                // duplicated.
                const directProducts = cat.productsWithoutSub ?? cat.products ?? [];
                const directServices = cat.servicesWithoutSub ?? cat.services ?? [];
                directProducts.forEach(p => pushItem(p, cat.name));
                directServices.forEach(s => pushItem(s, cat.name, true));

                (cat.subCategories || []).forEach(sub => {
                    (sub.products || []).forEach(p => pushItem(p, cat.name));
                    (sub.services || []).forEach(s => pushItem(s, cat.name, true));
                });
            });

            (dept.uncategorizedProducts || []).forEach(p => pushItem(p));
            (dept.uncategorizedServices || []).forEach(s => pushItem(s, '', true));
        });

        return { departments: depts, categories: Array.from(cats), flatProducts: products };
    }, [catalog, selectedDeptId, selectedType]);

    const filteredProducts = useMemo(() => {
        let list = flatProducts;
        if (selectedCat !== 'All') list = list.filter(p => p.categoryName === selectedCat);
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            list = list.filter(p =>
                (p.name || '').toLowerCase().includes(q) ||
                (p.categoryName || '').toLowerCase().includes(q) ||
                (p.unit || '').toLowerCase().includes(q)
            );
        }
        return list;
    }, [flatProducts, selectedCat, search]);

    // ── Cart-item helpers (write directly via setCart since we need per-line fields
    //    beyond POSContext's addToCart default shape) ──

    const getItemInCart = (id) => cart.find(item => item.product.id === id);

    const setItemQty = (productId, newQty) => {
        setCart(prev => prev.map(item => {
            if (item.product.id !== productId) return item;
            const decimal = allowsDecimalQty(item.product);
            const max = getAvailableStock(item.product);
            let q = parseFloat(newQty);
            if (!isFinite(q) || q <= 0) q = 0;
            if (!decimal) q = Math.floor(q);
            if (isFinite(max) && q > max) q = max; // don't exceed on-hand
            return { ...item, quantity: q };
        }).filter(i => i.quantity > 0));
    };

    const bumpItemQty = (productId, delta) => {
        const item = cart.find(i => i.product.id === productId);
        if (!item) return;
        // User request: increment/decrement by 1 regardless of unit
        const step = 1;
        setItemQty(productId, (item.quantity || 0) + delta * step);
    };

    const setItemDiscount = (productId, value, isPercent) => {
        setCart(prev => prev.map(item =>
            item.product.id === productId
                ? { ...item, discount: parseFloat(value) || 0, isDiscountPercent: !!isPercent }
                : item
        ));
    };

    const setLineUnitPrice = (productId, value, product) => {
        const parsed = parseFloat(value);
        if (Number.isFinite(parsed) && parsed > 0 && isPriceEditable(product)) {
            const min = getMinEditablePrice(product);
            if (parsed < min - 0.005) {
                alert(`Price cannot be below SAR ${min.toFixed(2)} for this product.`);
                return;
            }
        }
        setCart(prev => prev.map(item =>
            item.product.id === productId
                ? { ...item, serviceUnitPrice: parseFloat(value) || 0 }
                : item
        ));
    };

    // ── Cart calculations (match reference CartItem math) ──
    const cartLines = cart.map(item => {
        const p = item.product;
        const { exclVat, inclVat } = parsePrice(p);
        // Price override (when isPriceEditable), treat entered value as VAT-inclusive.
        const overrideIncl = (isPriceEditable(p) && item.serviceUnitPrice > 0)
            ? r2(item.serviceUnitPrice) : null;
        const effectiveIncl = overrideIncl ?? inclVat;
        const effectiveExcl = overrideIncl ? r2(overrideIncl / (1 + VAT_RATE)) : exclVat;

        const qty = parseFloat(item.quantity) || 0;
        const lineSubExcl = r2(effectiveExcl * qty);
        const itemDisc = item.isDiscountPercent
            ? r2(lineSubExcl * ((parseFloat(item.discount) || 0) / 100))
            : r2(parseFloat(item.discount) || 0);
        const lineAfterDisc = Math.max(0, r2(lineSubExcl - itemDisc));

        return {
            id: p.id,
            product: p,
            qty,
            unit: getUnit(p),
            effectiveIncl,
            effectiveExcl,
            lineSubExcl,
            itemDisc,
            lineAfterDisc,
        };
    });

    const subtotalExcl = cartLines.reduce((s, l) => s + l.lineSubExcl, 0);
    const itemDiscountsTotal = cartLines.reduce((s, l) => s + l.itemDisc, 0);
    const afterItemDisc = Math.max(0, r2(subtotalExcl - itemDiscountsTotal));

    const globalDiscAmount = (() => {
        const v = parseFloat(globalDiscount) || 0;
        if (v <= 0) return 0;
        return globalDiscountType === 'percent'
            ? r2(afterItemDisc * (v / 100))
            : r2(Math.min(v, afterItemDisc));
    })();

    const afterGlobalDisc = Math.max(0, r2(afterItemDisc - globalDiscAmount));
    const promoDiscAmount = Math.max(0, Math.min(r2(promoApplied), afterGlobalDisc));
    const taxable = Math.max(0, r2(afterGlobalDisc - promoDiscAmount));
    const vatAmount = r2(taxable * VAT_RATE);
    const grandTotal = r2(taxable + vatAmount);
    const totalDiscount = r2(itemDiscountsTotal + globalDiscAmount + promoDiscAmount);

    // ── Promo apply ──
    const handleApplyPromo = async () => {
        const code = promoCode.trim();
        if (!code) return;
        setPromoLoading(true);
        setPromoError(null);
        try {
            const productIds = cart
                .filter((item) => !isService(item.product))
                .map((item) => String(item.product.id));
            const serviceIds = cart
                .filter((item) => isService(item.product))
                .map((item) => String(item.product.id));
            const res = await apiFetch('/cashier/promo-code/apply', {
                method: 'POST',
                body: JSON.stringify({
                    code,
                    orderAmount: afterGlobalDisc,
                    productIds,
                    serviceIds,
                }),
            });
            if (res?.valid === false) {
                setPromoError(res?.message || 'Promo code is not valid for this order.');
                setPromoApplied(0);
                return;
            }
            const disc = parseFloat(
                res?.promoCode?.discountAmount
                ?? res?.discountAmount
                ?? res?.discount
                ?? res?.promo?.discount
                ?? res?.data?.discount
                ?? 0
            ) || 0;
            if (disc <= 0) {
                setPromoError(res?.message || 'Promo code is not valid for this order.');
                setPromoApplied(0);
            } else {
                setPromoApplied(disc);
            }
        } catch (e) {
            setPromoError(e?.message || 'Could not validate promo code');
            setPromoApplied(0);
        } finally {
            setPromoLoading(false);
        }
    };

    const clearPromo = () => { setPromoCode(''); setPromoApplied(0); setPromoError(null); };

    // ── Checkout (reference takeaway flow) ──
    const handleCheckout = async () => {
        if (cart.length === 0 || checkingOut) return;
        if (grandTotal <= 0) return;
        setCheckingOut(true);
        try {
            const items = cartLines.map(l => ({
                productId: l.product.id,
                quantity: l.qty,
                unitPrice: l.effectiveIncl, // VAT-inclusive, matches takeaway contract
                ...(l.itemDisc > 0
                    ? (cart.find(c => c.product.id === l.id)?.isDiscountPercent
                        ? { discount: cart.find(c => c.product.id === l.id)?.discount || 0, discountType: 'percent' }
                        : { discount: l.itemDisc, discountType: 'amount' })
                    : {}),
            }));
            const payload = {
                items,
                paymentMethod: payMethod,
                discount: globalDiscAmount + promoDiscAmount, // total top-level discount SAR
                promoCode: promoApplied > 0 ? promoCode.trim() : null,
                subtotal: r2(subtotalExcl),
                vat: vatAmount,
                totalAmount: grandTotal,
            };
            const res = await apiFetch('/cashier/takeaway/checkout', {
                method: 'POST',
                body: JSON.stringify(payload),
            });

            // Try to surface the invoice that was created, so the details modal can open.
            let invoice = res?.invoice || res?.data?.invoice || null;
            const orderId = res?.orderId || res?.order?.id || res?.data?.orderId;
            if (!invoice && orderId) {
                try {
                    const byOrder = await apiFetch('/cashier/invoice/by-order', {
                        method: 'POST',
                        body: JSON.stringify({ orderId }),
                    });
                    invoice = byOrder?.invoice || byOrder?.data?.invoice || byOrder?.data || byOrder;
                } catch (byErr) {
                    console.warn('Could not fetch invoice by-order:', byErr);
                }
            }

            // Wipe cart BEFORE opening the modal so a second checkout can't double-submit.
            clearCart();
            setGlobalDiscount('');
            setGlobalDiscountType('amount');
            clearPromo();
            setExpandedItemId(null);

            if (invoice) {
                setInvoiceShowing(invoice);
            } else {
                alert('Checkout successful. Invoice record not returned by backend.');
            }
        } catch (e) {
            alert('Checkout failed: ' + (e?.message || 'Unknown error'));
        } finally {
            setCheckingOut(false);
        }
    };

    // ── Render: full-screen loading ──
    if (catalogLoading && catalog.length === 0 && !loadError) {
        return (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 40, height: 40, border: '3px solid #e2e8f0', borderTopColor: '#FCC247', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: 16 }} />
                <p style={{ color: '#64748b', fontWeight: 600 }}>Loading catalog...</p>
                <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', gap: 20, height: '100%', minHeight: 0 }}>
            {/* ── Products column ── */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                {/* Search + Type toggle + Refresh */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <Search size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input
                            type="text"
                            placeholder="Search item or service..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{ width: '100%', padding: '12px 14px 12px 42px', border: '1.5px solid #e5e7eb', borderRadius: 12, fontSize: '0.875rem', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', background: '#fff' }}
                        />
                    </div>

                    <div style={{ display: 'flex', background: '#fff', padding: 4, borderRadius: 12, border: '1.5px solid #e5e7eb' }}>
                        {['All', 'Products', 'Services'].map(type => (
                            <button
                                key={type}
                                onClick={() => setSelectedType(type)}
                                style={{
                                    padding: '8px 16px', borderRadius: 8, border: 'none',
                                    background: selectedType === type ? '#FCC247' : 'transparent',
                                    color: selectedType === type ? '#23262D' : '#64748b',
                                    fontWeight: 800, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit'
                                }}
                            >
                                {type}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={() => runRefresh(true)}
                        disabled={refreshing || catalogLoading}
                        title="Refresh catalog"
                        style={{
                            width: 40, height: 40, borderRadius: 10, border: '1.5px solid #e5e7eb',
                            background: '#fff', cursor: refreshing ? 'wait' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#23262D'
                        }}
                    >
                        <RefreshCw size={16} style={{ animation: (refreshing || catalogLoading) ? 'spin 0.8s linear infinite' : 'none' }} />
                    </button>
                </div>

                {/* Departments */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 12, overflowX: 'auto', paddingBottom: 4, flexShrink: 0 }} className="no-scrollbar">
                    {departments.map(d => (
                        <button
                            key={d.id}
                            onClick={() => setSelectedDeptId(d.id)}
                            style={{
                                padding: '10px 20px', borderRadius: 12, border: `1.5px solid ${selectedDeptId === d.id ? '#23262D' : '#e5e7eb'}`,
                                background: selectedDeptId === d.id ? '#23262D' : '#fff',
                                color: selectedDeptId === d.id ? '#FCC247' : '#64748b',
                                fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit'
                            }}
                        >
                            {d.name}
                        </button>
                    ))}
                </div>

                {/* Categories */}
                {categories.length > 2 && (
                    <div style={{ display: 'flex', gap: 6, marginBottom: 20, overflowX: 'auto', paddingBottom: 4, flexShrink: 0 }} className="no-scrollbar">
                        {categories.map(c => (
                            <button
                                key={c}
                                onClick={() => setSelectedCat(c)}
                                style={{
                                    padding: '6px 16px', borderRadius: 20, border: `1.5px solid ${selectedCat === c ? '#FCC247' : '#e5e7eb'}`,
                                    background: selectedCat === c ? '#FFFBF0' : '#fff',
                                    color: selectedCat === c ? '#92400e' : '#64748b',
                                    fontWeight: selectedCat === c ? 800 : 600, fontSize: '0.72rem', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit'
                                }}
                            >
                                {c}
                            </button>
                        ))}
                    </div>
                )}

                {/* Grid / error / empty */}
                <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }} className="custom-scrollbar">
                    {loadError ? (
                        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
                            <AlertTriangle size={48} color="#ef4444" style={{ marginBottom: 12, opacity: 0.8 }} />
                            <p style={{ fontWeight: 800, color: '#1E2124', margin: '0 0 4px' }}>Failed to load catalog</p>
                            <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0 0 20px', maxWidth: 420, marginInline: 'auto' }}>{loadError}</p>
                            <button
                                onClick={() => runRefresh(true)}
                                style={{ padding: '10px 24px', borderRadius: 12, background: '#23262D', color: '#FCC247', border: 'none', fontWeight: 800, cursor: 'pointer' }}
                            >
                                Retry
                            </button>
                        </div>
                    ) : filteredProducts.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '100px 0', color: '#94a3b8' }}>
                            <Package size={48} style={{ opacity: 0.2, marginBottom: 12 }} />
                            <p style={{ fontWeight: 600 }}>No items match your filter</p>
                        </div>
                    ) : (
                        <div className="pos-product-grid">
                            {filteredProducts.map(p => (
                                <ProductCard
                                    key={`${p.deptId}-${p.id}`}
                                    product={p}
                                    cartItem={getItemInCart(p.id)}
                                    onAdd={() => addToCart(p)}
                                    onInc={() => bumpItemQty(p.id, +1)}
                                    onDec={() => bumpItemQty(p.id, -1)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Live Invoice column ── */}
            <div style={{ width: 360, background: '#fff', borderRadius: 20, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9' }}>
                <div style={{ padding: '20px', background: '#23262D', color: '#FCC247', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Receipt size={22} />
                    <span style={{ fontWeight: 900, fontSize: '1rem', letterSpacing: '0.02em' }}>LIVE INVOICE</span>
                    {cart.length > 0 && (
                        <>
                            <span style={{ marginLeft: 'auto', background: '#FCC247', color: '#23262D', borderRadius: 10, padding: '2px 8px', fontSize: '0.75rem', fontWeight: 900 }}>{cart.length}</span>
                            <button
                                onClick={() => { if (window.confirm('Clear the entire cart?')) { clearCart(); setExpandedItemId(null); clearPromo(); setGlobalDiscount(''); } }}
                                title="Clear cart"
                                style={{ background: 'transparent', border: 'none', color: 'rgba(252,194,71,0.8)', cursor: 'pointer', padding: 0 }}
                            >
                                <Trash2 size={16} />
                            </button>
                        </>
                    )}
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }} className="custom-scrollbar">
                    {cart.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
                            <ShoppingCart size={48} style={{ opacity: 0.1, marginBottom: 12 }} />
                            <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>Cart is empty</p>
                            <p style={{ fontSize: '0.75rem' }}>Select products to start building an invoice</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {cart.map(item => {
                                const p = item.product;
                                const line = cartLines.find(l => l.id === p.id);
                                const expanded = expandedItemId === p.id;
                                return (
                                    <CartLine
                                        key={p.id}
                                        item={item}
                                        line={line}
                                        expanded={expanded}
                                        onToggleExpand={() => setExpandedItemId(expanded ? null : p.id)}
                                        onInc={() => bumpItemQty(p.id, +1)}
                                        onDec={() => bumpItemQty(p.id, -1)}
                                        onSetQty={(v) => setItemQty(p.id, v)}
                                        onSetDiscount={(v, isPct) => setItemDiscount(p.id, v, isPct)}
                                        onSetServicePrice={(v) => setLineUnitPrice(p.id, v, p)}
                                        onRemove={() => removeFromCart(p.id)}
                                    />
                                );
                            })}
                        </div>
                    )}
                </div>

                {cart.length > 0 && (
                    <div style={{ padding: '18px 20px 20px', background: '#FBFBFD', borderTop: '1px solid #f1f5f9' }}>
                        {/* Global discount */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                            <div style={{ position: 'relative', flex: 1 }}>
                                <TagIcon size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                <input
                                    type="number"
                                    placeholder="Global discount"
                                    value={globalDiscount}
                                    onChange={e => setGlobalDiscount(e.target.value)}
                                    style={{ width: '100%', padding: '8px 8px 8px 28px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: '0.8rem', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                                />
                            </div>
                            <div style={{ display: 'flex', background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 10, padding: 2 }}>
                                {['percent', 'amount'].map(t => (
                                    <button
                                        key={t}
                                        onClick={() => setGlobalDiscountType(t)}
                                        style={{
                                            padding: '6px 10px', border: 'none', borderRadius: 8, fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer',
                                            background: globalDiscountType === t ? '#23262D' : 'transparent',
                                            color: globalDiscountType === t ? '#FCC247' : '#64748b',
                                            fontFamily: 'inherit'
                                        }}
                                    >
                                        {t === 'percent' ? '%' : 'SAR'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Promo code */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                            <div style={{ position: 'relative', flex: 1 }}>
                                <Percent size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                <input
                                    type="text"
                                    placeholder="Promo code"
                                    value={promoCode}
                                    onChange={e => { setPromoCode(e.target.value); if (promoApplied) setPromoApplied(0); }}
                                    disabled={promoApplied > 0}
                                    style={{ width: '100%', padding: '8px 8px 8px 28px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: '0.8rem', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', background: promoApplied > 0 ? '#f1f5f9' : '#fff' }}
                                />
                            </div>
                            {promoApplied > 0 ? (
                                <button onClick={clearPromo} style={{ padding: '8px 12px', background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: '0.72rem', cursor: 'pointer' }}>
                                    Remove
                                </button>
                            ) : (
                                <button onClick={handleApplyPromo} disabled={promoLoading || !promoCode.trim()} style={{ padding: '8px 12px', background: '#23262D', color: '#FCC247', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: '0.72rem', cursor: promoLoading ? 'wait' : 'pointer', opacity: promoLoading || !promoCode.trim() ? 0.55 : 1 }}>
                                    {promoLoading ? '...' : 'Apply'}
                                </button>
                            )}
                        </div>
                        {promoError && <p style={{ margin: '-6px 0 10px', fontSize: '0.7rem', color: '#b91c1c', fontWeight: 600 }}>{promoError}</p>}

                        {/* Payment method */}
                        <div style={{ marginBottom: 12 }}>
                            <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800, color: '#64748b', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 }}>Payment Method</label>
                            <select
                                value={payMethod}
                                onChange={e => setPayMethod(e.target.value)}
                                style={{ width: '100%', padding: '9px 10px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: '0.82rem', fontWeight: 700, color: '#1E2124', background: '#fff', outline: 'none', fontFamily: 'inherit' }}
                            >
                                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>

                        {/* Totals breakdown (reference style) */}
                        <TotalsRow label="Subtotal (Excl VAT)" value={subtotalExcl} />
                        {itemDiscountsTotal > 0 && <TotalsRow label="Item Discounts" value={-itemDiscountsTotal} negative />}
                        {globalDiscAmount > 0 && <TotalsRow label="Global Discount" value={-globalDiscAmount} negative />}
                        {promoDiscAmount > 0 && <TotalsRow label={`Promo (${promoCode.trim() || '—'})`} value={-promoDiscAmount} negative />}
                        <TotalsRow label="VAT (15%)" value={vatAmount} />
                        {totalDiscount > 0 && (
                            <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600, margin: '2px 0 8px', textAlign: 'right' }}>
                                Total Savings: SAR {totalDiscount.toFixed(2)}
                            </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, marginTop: 6, borderTop: '2px dashed #e2e8f0' }}>
                            <span style={{ fontWeight: 900, fontSize: '1rem', color: '#23262D' }}>GRAND TOTAL</span>
                            <span style={{ fontWeight: 900, fontSize: '1.2rem', color: '#23262D' }}>SAR {grandTotal.toFixed(2)}</span>
                        </div>

                        <button
                            onClick={handleCheckout}
                            disabled={checkingOut || grandTotal <= 0}
                            style={{
                                width: '100%', marginTop: 18, padding: '14px',
                                background: checkingOut || grandTotal <= 0 ? '#94a3b8' : '#23262D',
                                color: '#FCC247', border: 'none', borderRadius: 14,
                                fontWeight: 900, fontSize: '0.95rem',
                                cursor: checkingOut || grandTotal <= 0 ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontFamily: 'inherit'
                            }}
                        >
                            {checkingOut ? (
                                <><RefreshCw size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> Processing...</>
                            ) : (
                                <><Receipt size={18} /> Generate Invoice</>
                            )}
                        </button>
                    </div>
                )}
            </div>

            <InvoiceDetailsModal
                invoice={invoiceShowing}
                isOpen={!!invoiceShowing}
                onClose={() => setInvoiceShowing(null)}
            />

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Product card
// ─────────────────────────────────────────────────────────────────────────────

function ProductCard({ product, cartItem, onAdd, onInc, onDec }) {
    const { inclVat } = parsePrice(product);
    const stockInfo = getStockStatus(product);
    const imageUrl = getImageUrl(product);
    const unit = getUnit(product);
    const qty = cartItem?.quantity || 0;
    const inCart = qty > 0;
    const serviceFlag = isService(product);
    const outOfStock = !serviceFlag && (stockInfo.stock ?? 0) <= 0;
    const atMax = !serviceFlag && qty >= (stockInfo.stock ?? 0);
    const decimalAllowed = allowsDecimalQty(product);

    return (
        <div
            style={{
                background: '#fff', borderRadius: 16, padding: 14,
                border: `2px solid ${inCart ? '#FCC247' : '#f1f5f9'}`,
                boxShadow: inCart ? '0 8px 20px rgba(252,194,71,0.15)' : '0 2px 8px rgba(0,0,0,0.02)',
                display: 'flex', flexDirection: 'column', gap: 8,
                transition: 'all 0.2s ease', position: 'relative',
                opacity: outOfStock ? 0.7 : 1,
            }}
        >
            {inCart && (
                <CheckCircle2 size={18} color="#FCC247" fill="#23262D" style={{ position: 'absolute', top: -8, right: -8 }} />
            )}

            {/* Image (optional) */}
            {imageUrl && (
                <div style={{ width: '100%', height: 72, borderRadius: 10, overflow: 'hidden', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img
                        src={imageUrl}
                        alt={product.name}
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                </div>
            )}

            <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '0.85rem', color: '#1E2124', lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', minHeight: 36 }}>
                    {product.name}
                </p>
                {unit && (
                    <p style={{ margin: '2px 0 0', fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600 }}>
                        per {unit}
                    </p>
                )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ padding: '3px 8px', borderRadius: 6, background: stockInfo.bg, color: stockInfo.color, fontSize: '0.65rem', fontWeight: 800 }}>
                    {stockInfo.label}
                </span>
            </div>

            <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px dashed #f1f5f9' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                        <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#1E2124' }}>SAR</span>
                        <span style={{ fontSize: '1.05rem', fontWeight: 900, color: '#1E2124' }}>{inclVat.toFixed(2)}</span>
                    </div>
                    <span style={{ fontSize: '0.6rem', color: '#94a3b8', fontWeight: 600 }}>(Inc. VAT)</span>
                </div>

                {inCart ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', padding: 4, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                        <button onClick={onDec} style={qtyBtn} title="Decrease 1"><Minus size={12} /></button>
                        <span style={{ fontWeight: 900, fontSize: '0.82rem', minWidth: 26, textAlign: 'center' }}>
                            {decimalAllowed ? qty : Math.round(qty)}
                        </span>
                        <button onClick={onInc} style={qtyBtn} disabled={atMax} title={atMax ? 'No more stock' : 'Increase 1'}>
                            <Plus size={12} />
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={onAdd}
                        disabled={outOfStock}
                        style={{
                            background: outOfStock ? '#f1f5f9' : '#23262D',
                            color: outOfStock ? '#94a3b8' : '#FCC247',
                            border: 'none', borderRadius: 10,
                            padding: '8px 14px', cursor: outOfStock ? 'not-allowed' : 'pointer'
                        }}
                    >
                        <Plus size={16} />
                    </button>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Cart line
// ─────────────────────────────────────────────────────────────────────────────

function CartLine({
    item, line, expanded,
    onToggleExpand, onInc, onDec, onSetQty,
    onSetDiscount, onSetServicePrice, onRemove,
}) {
    const p = item.product;
    const decimalAllowed = allowsDecimalQty(p);
    const unit = getUnit(p);
    const priceEditable = isPriceEditable(p);
    const minEditablePrice = getMinEditablePrice(p);

    return (
        <div style={{ paddingBottom: 12, borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: '0.82rem', color: '#1E2124', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.name}
                    </p>

                    {/* Quantity stepper with inline editable qty */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f8fafc', padding: '2px 4px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                            <button onClick={onDec} style={qtyBtnSm}><Minus size={10} /></button>
                            <input
                                type="number"
                                step={1}
                                min={decimalAllowed ? 0.1 : 1}
                                value={item.quantity}
                                onChange={e => onSetQty(e.target.value)}
                                style={{ width: 44, border: 'none', background: 'transparent', fontWeight: 800, fontSize: '0.75rem', textAlign: 'center', outline: 'none', fontFamily: 'inherit' }}
                            />
                            <button onClick={onInc} style={qtyBtnSm}><Plus size={10} /></button>
                        </div>
                        {unit && <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700 }}>{unit}</span>}
                        <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                            × <b>{line?.effectiveExcl.toFixed(2)}</b> = <b style={{ color: '#1E2124' }}>{line?.lineAfterDisc.toFixed(2)}</b>
                        </span>
                    </div>

                    {!expanded && (
                        <button
                            onClick={onToggleExpand}
                            style={{ background: 'none', border: 'none', padding: 0, marginTop: 6, color: '#92400e', fontSize: '0.68rem', fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                            <Edit3 size={10} /> {priceEditable ? 'Set price / discount' : 'Add discount'}
                        </button>
                    )}

                    {expanded && (
                        <div style={{ marginTop: 8, padding: 10, background: '#fafbfd', borderRadius: 10, border: '1px dashed #e2e8f0', display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {priceEditable && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <label style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', minWidth: 80 }}>Unit price</label>
                                    <input
                                        type="number"
                                        placeholder="VAT inc."
                                        min={minEditablePrice}
                                        value={item.serviceUnitPrice ?? ''}
                                        onChange={e => onSetServicePrice(e.target.value)}
                                        style={{ flex: 1, padding: '5px 8px', border: '1.5px solid #e5e7eb', borderRadius: 6, fontSize: '0.72rem', outline: 'none', fontFamily: 'inherit' }}
                                    />
                                    <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 700 }}>SAR</span>
                                </div>
                            )}
                            {priceEditable && minEditablePrice > 0 && (
                                <span style={{ fontSize: '0.65rem', color: '#92400e', fontWeight: 700 }}>
                                    Minimum: SAR {minEditablePrice.toFixed(2)} (VAT inc.)
                                </span>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <label style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', minWidth: 80 }}>Discount</label>
                                <input
                                    type="number"
                                    placeholder="0"
                                    value={item.discount || ''}
                                    onChange={e => onSetDiscount(e.target.value, item.isDiscountPercent)}
                                    style={{ flex: 1, padding: '5px 8px', border: '1.5px solid #e5e7eb', borderRadius: 6, fontSize: '0.72rem', outline: 'none', fontFamily: 'inherit' }}
                                />
                                <div style={{ display: 'flex', background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 6, padding: 1 }}>
                                    {[false, true].map(pct => (
                                        <button
                                            key={pct ? 'pct' : 'amt'}
                                            onClick={() => onSetDiscount(item.discount || 0, pct)}
                                            style={{ padding: '3px 7px', border: 'none', borderRadius: 4, fontSize: '0.62rem', fontWeight: 800, cursor: 'pointer', background: item.isDiscountPercent === pct ? '#23262D' : 'transparent', color: item.isDiscountPercent === pct ? '#FCC247' : '#64748b', fontFamily: 'inherit' }}
                                        >
                                            {pct ? '%' : 'SAR'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {line?.itemDisc > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.66rem', color: '#b91c1c', fontWeight: 700 }}>
                                    <span>Line savings</span>
                                    <span>− SAR {line.itemDisc.toFixed(2)}</span>
                                </div>
                            )}
                            <button onClick={onToggleExpand} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', padding: 0, textAlign: 'right' }}>
                                Hide
                            </button>
                        </div>
                    )}
                </div>

                <button onClick={onRemove} style={{ background: 'none', border: 'none', color: '#ef4444', padding: 4, cursor: 'pointer', alignSelf: 'flex-start' }}>
                    <Trash2 size={14} />
                </button>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────

function TotalsRow({ label, value, negative }) {
    const displayed = Math.abs(value);
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 600 }}>{label}</span>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: negative ? '#b91c1c' : '#1E2124' }}>
                {negative ? '− ' : ''}SAR {displayed.toFixed(2)}
            </span>
        </div>
    );
}

const qtyBtn = {
    width: 24, height: 24, borderRadius: 6, border: 'none',
    background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
};

const qtyBtnSm = {
    padding: 0, width: 20, height: 20, borderRadius: 4, border: 'none',
    background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
};
