import React, { useState, useMemo, useEffect } from 'react';
import { Search, X, Package, Tag, Layers, Check, Plus, Minus, RefreshCw, LayoutGrid, Receipt, Percent, Ticket, ShoppingCart } from 'lucide-react';
import { usePOS } from '../../../context/POSContext';

export default function ProductSelectionModal({ 
    job, 
    catalog, 
    jobData,
    onToggleProduct, 
    onUpdateQty,
    onUpdateItemField,
    onUpdateGlobalField,
    onConfirm,
    onClose,
    loading 
}) {
    const { refreshCatalog } = usePOS();
    const [search, setSearch] = useState('');
    const [selectedDeptId, setSelectedDeptId] = useState('All');
    const [selectedType, setSelectedType] = useState('All'); 
    const [selectedCat, setSelectedCat] = useState('All');

    const selectedProducts = jobData.products || [];

    useEffect(() => {
        if (!catalog || catalog.length === 0) refreshCatalog();
    }, [catalog, refreshCatalog]);

    useEffect(() => {
        if (job && catalog.length > 0) {
            const jobDeptName = (job.departmentName || job.department || '').toLowerCase().trim();
            const matchingDept = catalog.find(d => {
                const dName = (d.name || d.department || '').toLowerCase().trim();
                return dName === jobDeptName || dName.includes(jobDeptName) || jobDeptName.includes(dName);
            });
            if (matchingDept) setSelectedDeptId(matchingDept.id);
        }
    }, [job, catalog]);

    useEffect(() => {
        setSelectedCat('All');
    }, [selectedDeptId]);

    const { departments, categories, flatProducts } = useMemo(() => {
        const depts = [{ id: 'All', name: 'All Departments' }, ...catalog];
        const allCats = new Set(['All']);
        const allProducts = [];

        catalog.forEach(dept => {
            const processProduct = (p, cName = '', isSvc = false) => {
                const type = isSvc ? 'Services' : 'Products';
                const uniqueId = `${dept.id}-${cName}-${type}-${p.id}`;
                if (cName) allCats.add(cName);
                allProducts.push({ 
                    ...p, 
                    uniqueKey: uniqueId,
                    id: String(p.id),
                    deptId: String(dept.id), 
                    deptName: dept.name, 
                    categoryName: cName || 'Uncategorized', 
                    typeLabel: type,
                    isService: isSvc,
                    price: parseFloat(p.price ?? p.salePrice ?? p.sellingPrice ?? 0)
                });
            };
            (dept.categories || []).forEach(cat => {
                const categoryName = cat.name || 'Uncategorized';
                (cat.products || []).forEach(p => processProduct(p, categoryName, false));
                (cat.services || []).forEach(s => processProduct(s, categoryName, true));
            });
            (dept.uncategorizedProducts || []).forEach(p => processProduct(p, '', false));
            (dept.uncategorizedServices || []).forEach(s => processProduct(s, '', true));
        });

        return { departments: depts, categories: Array.from(allCats), flatProducts: allProducts };
    }, [catalog]);

    const filteredProducts = useMemo(() => {
        let list = flatProducts;
        if (selectedDeptId !== 'All') list = list.filter(p => String(p.deptId) === String(selectedDeptId));
        if (selectedType !== 'All') list = list.filter(p => p.typeLabel === selectedType);
        if (selectedCat !== 'All') list = list.filter(p => p.categoryName === selectedCat);
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            list = list.filter(p => (p.name || '').toLowerCase().includes(q) || (p.categoryName || '').toLowerCase().includes(q));
        }
        return list;
    }, [flatProducts, selectedDeptId, selectedType, selectedCat, search]);

    // Financial Calculations
    const subtotal = selectedProducts.reduce((sum, p) => sum + (p.price * p.qty), 0);
    const itemDiscounts = selectedProducts.reduce((sum, p) => {
        const itemTotal = p.price * p.qty;
        const disc = p.discountType === 'percentage' ? (itemTotal * (p.discountValue || 0) / 100) : (p.discountValue || 0);
        return sum + disc;
    }, 0);
    
    const afterItemDiscounts = subtotal - itemDiscounts;
    const globalDiscount = jobData.totalDiscountType === 'percentage' 
        ? (afterItemDiscounts * (jobData.totalDiscountValue || 0) / 100) 
        : (jobData.totalDiscountValue || 0);
    
    const totalBeforeVAT = Math.max(0, afterItemDiscounts - globalDiscount);
    const vatRate = jobData.VAT !== undefined && jobData.VAT !== null ? jobData.VAT : 15;
    const vatAmount = totalBeforeVAT * (vatRate / 100);
    const finalTotal = totalBeforeVAT + vatAmount;

    return (
        <div className="modal-overlay-modern" onClick={onClose}>
            <div className="modal-container-full product-selection-split-v3" onClick={e => e.stopPropagation()} style={{ width: '95vw', maxWidth: '1600px', height: '90vh' }}>
                <div className="split-modal-layout">
                    
                    {/* LEFT COLUMN: CATALOG BROWSER */}
                    <div className="catalog-column">
                        <div className="modal-header-premium">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                <div className="header-icon-box"><LayoutGrid size={24} /></div>
                                <div>
                                    <h2 className="modal-title">Select Items</h2>
                                    <p className="modal-subtitle">{job?.departmentName || 'Workshop'} Department</p>
                                </div>
                            </div>
                        </div>

                        <div className="catalog-filters">
                            <div className="search-and-type">
                                <div className="search-input-wrapper">
                                    <Search size={18} className="search-icon" />
                                    <input type="text" placeholder="Search catalog..." value={search} onChange={e => setSearch(e.target.value)} />
                                </div>
                                <div className="type-toggle">
                                    {['All', 'Products', 'Services'].map(t => (
                                        <button key={t} onClick={() => setSelectedType(t)} className={selectedType === t ? 'active' : ''}>{t}</button>
                                    ))}
                                </div>
                            </div>

                            <div className="dept-tabs no-scrollbar">
                                {departments.map(d => (
                                    <button key={d.id} onClick={() => setSelectedDeptId(d.id)} className={selectedDeptId === d.id ? 'active' : ''}>{d.name}</button>
                                ))}
                            </div>

                            {categories.length > 1 && (
                                <div className="cat-pills no-scrollbar">
                                    {categories.map(c => (
                                        <button key={c} onClick={() => setSelectedCat(c)} className={selectedCat === c ? 'active' : ''}>{c}</button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="catalog-grid-scroll custom-scrollbar">
                            {loading && flatProducts.length === 0 ? (
                                <div className="loading-state"><RefreshCw className="animate-spin" /></div>
                            ) : filteredProducts.length === 0 ? (
                                <div className="empty-state"><Package size={48} /><p>No items found</p></div>
                            ) : (
                                <div className="products-grid-modern">
                                    {filteredProducts.map(p => {
                                        const selItem = selectedProducts.find(sp => String(sp.id) === String(p.id));
                                        const allowsMinus = p.allowMinusQty === true || p.allow_minus_qty === true
                                            || String(p.allowMinusQty ?? '').toLowerCase() === 'true';
                                        const infinite = p.isInfiniteQty === true || p.is_infinite_qty === true
                                            || String(p.isInfiniteQty ?? '').toLowerCase() === 'true';
                                        // null qtyOnHand = infinite / unknown physical — treat as sellable when flagged
                                        const stockRaw = p.qtyOnHand;
                                        const stock = stockRaw == null || stockRaw === ''
                                            ? (infinite ? Infinity : 0)
                                            : Number(stockRaw) || 0;
                                        const inStock = p.isService || allowsMinus || infinite || stock > 0;
                                        const stockTag = p.isService
                                            ? 'Service'
                                            : infinite
                                                ? 'Infinite'
                                                : allowsMinus && stock <= 0
                                                    ? `Available: ${stock}`
                                                    : `Stock: ${Number.isFinite(stock) ? stock : 0}`;
                                        return (
                                            <div 
                                                key={p.uniqueKey} 
                                                className={`p-card-modern ${selItem ? 'selected' : ''} ${!inStock ? 'out-of-stock' : ''}`} 
                                                onClick={() => inStock && !selItem && onToggleProduct(p)}
                                            >
                                                <div className="p-card-content">
                                                    <div className="p-card-top">
                                                        <h4 className="p-name">{p.name}</h4>
                                                        {selItem && <div className="sel-badge"><Check size={14} /></div>}
                                                    </div>
                                                    <div className="p-card-mid">
                                                        <span className={`tag ${p.isService ? 'service' : 'product'}`}>{stockTag}</span>
                                                        <span className="unit">{p.unit || 'Unit'}</span>
                                                    </div>
                                                    <div className="p-card-bottom">
                                                        <span className="price">SAR {p.price.toFixed(2)}</span>
                                                        {selItem ? (
                                                            <div className="p-card-stepper" onClick={e => e.stopPropagation()}>
                                                                <button className="step-btn" onClick={() => onUpdateQty(p.id, -1)}>
                                                                    <Minus size={14} strokeWidth={3} />
                                                                </button>
                                                                <span className="step-qty">{selItem.qty}</span>
                                                                <button className="step-btn" onClick={() => onUpdateQty(p.id, 1)}>
                                                                    <Plus size={14} strokeWidth={3} />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button 
                                                                className="add-btn" 
                                                                onClick={(e) => { 
                                                                    e.stopPropagation(); 
                                                                    if (inStock) onToggleProduct(p);
                                                                }}
                                                            >
                                                                <Plus size={22} strokeWidth={3} style={{ display: 'block' }} />
                                                                {/* Fallback for icon rendering issues */}
                                                                <span className="fallback-plus" style={{ display: 'none' }}>+</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT COLUMN: LIVE INVOICING */}
                    <div className="invoice-column">
                        <div className="invoice-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <Receipt size={22} color="var(--pos-gold)" />
                                <h3 style={{ margin: 0, fontWeight: 900, color: '#fff' }}>Live Invoicing</h3>
                            </div>
                            <span className="items-count-badge">{selectedProducts.length} Items</span>
                        </div>

                        <div className="cart-items-list custom-scrollbar">
                            {selectedProducts.length === 0 ? (
                                <div className="empty-cart-state">
                                    <ShoppingCart size={48} color="#2E323A" />
                                    <p>Your cart is empty</p>
                                    <span>Select items from the catalog to build the invoice</span>
                                </div>
                            ) : (
                                selectedProducts.map(item => (
                                    <div key={item.id} className="cart-item-row">
                                        <div className="cart-item-header">
                                            <div className="item-title-grp">
                                                <h4 className="item-name">{item.name}</h4>
                                                <span className="item-price-label">SAR {item.price.toFixed(2)} / unit</span>
                                            </div>
                                            <button className="remove-item-btn" onClick={() => onUpdateQty(item.id, -999)} title="Remove Item"><X size={16} /></button>
                                        </div>

                                        <div className="item-controls-row">
                                            <div className="qty-stepper">
                                                <button onClick={() => onUpdateQty(item.id, -1)}><Minus size={14} /></button>
                                                <input type="number" value={item.qty} readOnly />
                                                <button onClick={() => onUpdateQty(item.id, 1)}><Plus size={14} /></button>
                                            </div>

                                            <div className="item-discount-group">
                                                <div className="discount-type-toggle">
                                                    <button className={item.discountType === 'percentage' ? 'active' : ''} onClick={() => onUpdateItemField(item.id, 'discountType', 'percentage')}><Percent size={12} /></button>
                                                    <button className={item.discountType === 'amount' ? 'active' : ''} onClick={() => onUpdateItemField(item.id, 'discountType', 'amount')}>SAR</button>
                                                </div>
                                                <input 
                                                    type="number" 
                                                    className="discount-input" 
                                                    placeholder="0"
                                                    value={item.discountValue || ''}
                                                    onChange={e => onUpdateItemField(item.id, 'discount', parseFloat(e.target.value) || 0)}
                                                />
                                            </div>
                                        </div>

                                        <div className="item-row-total">
                                            <span className="total-label">Subtotal</span>
                                            <strong className="total-amount">
                                                SAR {(() => {
                                                    const rowTotal = item.price * item.qty;
                                                    const rowDiscount = item.discountType === 'percentage' 
                                                        ? (rowTotal * (item.discountValue || 0) / 100) 
                                                        : (item.discountValue || 0);
                                                    return Math.max(0, rowTotal - rowDiscount).toFixed(2);
                                                })()}
                                            </strong>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="invoice-summary-panel">
                            <div className="global-discounts-row">
                                <div className="promo-input-wrapper">
                                    <Ticket size={16} />
                                    <input 
                                        type="text" 
                                        placeholder="Promo Code" 
                                        value={jobData.promoCode || ''}
                                        onChange={e => onUpdateGlobalField('promoCode', e.target.value)}
                                    />
                                </div>
                                <div className="total-discount-box">
                                    <div className="discount-label">Total Discount</div>
                                    <div className="discount-input-group">
                                        <select value={jobData.totalDiscountType} onChange={e => onUpdateGlobalField('totalDiscountType', e.target.value)}>
                                            <option value="amount">SAR</option>
                                            <option value="percentage">%</option>
                                        </select>
                                        <input 
                                            type="number" 
                                            value={jobData.totalDiscountValue || ''} 
                                            onChange={e => onUpdateGlobalField('totalDiscountValue', parseFloat(e.target.value) || 0)}
                                            placeholder="0"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="pricing-breakdown">
                                <div className="price-row"><span>Subtotal</span><span>SAR {subtotal.toFixed(2)}</span></div>
                                <div className="price-row"><span>Item Discounts</span><span className="negative">- SAR {itemDiscounts.toFixed(2)}</span></div>
                                <div className="price-row"><span>Global Discount</span><span className="negative">- SAR {globalDiscount.toFixed(2)}</span></div>
                                <div className="price-row"><span>VAT ({jobData.VAT !== undefined && jobData.VAT !== null ? jobData.VAT : 15}%)</span><span>SAR {vatAmount.toFixed(2)}</span></div>
                                <div className="price-total-row"><span>Final Total</span><span>SAR {finalTotal.toFixed(2)}</span></div>
                            </div>

                            <div className="invoice-actions">
                                <button className="btn-modern-secondary" onClick={onClose}>Cancel</button>
                                <button className="btn-modern-primary" onClick={onConfirm} disabled={loading}>
                                    {loading ? <RefreshCw className="animate-spin" size={18} /> : 'Save & Update Job'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <button className="modal-close-floating" onClick={onClose}><X size={20} /></button>
            </div>
        </div>
    );
}
