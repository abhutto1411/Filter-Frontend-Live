import React, { useMemo, useState } from 'react';
import { Package, Plus, Truck, ShoppingCart, Search, Send, Globe2 } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import { MOCK_CATALOG_ITEMS, MOCK_SUPPLIERS_CATALOG, UNIT_OPTIONS } from './constants';

export default function WorkshopCatalog({ selectedBranchId = 'all', branches = [] }) {
    const branchLabel = useMemo(() => {
        if (!selectedBranchId || selectedBranchId === 'all') return 'All branches';
        return branches.find((b) => String(b.id) === String(selectedBranchId))?.name || 'Branch';
    }, [selectedBranchId, branches]);
    const [search, setSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [selectedSupplier, setSelectedSupplier] = useState('all');
    const [showRequestForm, setShowRequestForm] = useState(false);
    const [orderItem, setOrderItem] = useState(null);
    const [orderSupplier, setOrderSupplier] = useState(null);
    const [catalogItems, setCatalogItems] = useState(MOCK_CATALOG_ITEMS);
    const [requests, setRequests] = useState([]);
    const [reqForm, setReqForm] = useState({ product_name: '', category: '', unit: 'piece', quantity_needed: 1, target_price: '', notes: '' });

    const zoneName = 'Central Zone';
    const categories = [...new Set(catalogItems.map(i => i.category).filter(Boolean))];
    const filtered = catalogItems.filter(item => {
        const matchesSearch = !search || (item.product_name || '').toLowerCase().includes(search.toLowerCase());
        const matchesCat = selectedCategory === 'all' || item.category === selectedCategory;
        const matchesSup = selectedSupplier === 'all' || item.supplier_id === selectedSupplier;
        return matchesSearch && matchesCat && matchesSup;
    });
    const getSupplier = (id) => MOCK_SUPPLIERS_CATALOG.find(s => s.id === id);

    const handlePlaceOrder = () => { if (orderItem) { alert(`Purchase order placed for ${orderItem.product_name} with ${orderSupplier?.name}`); setOrderItem(null); setOrderSupplier(null); } };
    const handleRequestProduct = () => {
        const form = { ...reqForm, product_name: reqForm.product_name || 'New Product', quantity_needed: reqForm.quantity_needed || 1, unit: reqForm.unit || 'piece', status: 'pending' };
        setRequests(prev => [...prev, { id: Date.now(), ...form }]);
        setShowRequestForm(false);
        setReqForm({ product_name: '', category: '', unit: 'piece', quantity_needed: 1, target_price: '', notes: '' });
    };

    return (
        <div>
            <div className="ws-page-header">
                <div>
                    <h2 className="ws-page-title" style={{display:'flex',alignItems:'center',gap:8}}><Package size={20} style={{color:'#2563EB'}}/> Product Catalog</h2>
                    <p className="ws-page-sub" style={{display:'flex',alignItems:'center',gap:6,marginTop:4}}>
                        <Globe2 size={14} style={{color:'#7C3AED'}}/> Branch: <strong>{branchLabel}</strong> · {zoneName} · {MOCK_SUPPLIERS_CATALOG.length} suppliers · {catalogItems.length} products
                    </p>
                </div>
                <button className="btn-portal" onClick={() => setShowRequestForm(true)}><Plus size={15}/> Request New Product</button>
            </div>

            <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:20}}>
                <div style={{position:'relative',flex:1,minWidth:200}}>
                    <Search size={16} style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'var(--color-text-muted)'}}/>
                    <input type="text" placeholder="Search products..." value={search} onChange={e=>setSearch(e.target.value)} style={{width:'100%',padding:'10px 12px 10px 40px',borderRadius:10,border:'1px solid var(--color-border)',fontSize:'0.875rem',outline:'none'}}/>
                </div>
                <select value={selectedCategory} onChange={e=>setSelectedCategory(e.target.value)} style={{padding:'10px 14px',borderRadius:10,border:'1px solid var(--color-border)',fontSize:'0.875rem',minWidth:160}}>
                    <option value="all">All Categories</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={selectedSupplier} onChange={e=>setSelectedSupplier(e.target.value)} style={{padding:'10px 14px',borderRadius:10,border:'1px solid var(--color-border)',fontSize:'0.875rem',minWidth:180}}>
                    <option value="all">All Suppliers</option>
                    {MOCK_SUPPLIERS_CATALOG.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
            </div>

            {filtered.length === 0 ? (
                <div style={{textAlign:'center',padding:48,color:'var(--color-text-muted)'}}>
                    <Package size={48} style={{opacity:0.3,margin:'0 auto 12px'}}/>
                    <p style={{margin:0,fontWeight:600}}>No products available yet.</p>
                    <p style={{margin:'4px 0 0',fontSize:'0.875rem'}}>Click "Request New Product" to notify suppliers.</p>
                </div>
            ) : (
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))',gap:16}}>
                    {filtered.map(item => {
                        const sup = getSupplier(item.supplier_id);
                        const inStock = (item.stock_qty || 0) > 0;
                        return (
                            <div key={item.id} style={{background:'#fff',border:'1px solid var(--color-border)',borderRadius:16,overflow:'hidden',display:'flex',flexDirection:'column',transition:'box-shadow 0.2s'}} className="ws-section">
                                <div style={{padding:16,flex:1}}>
                                    <p style={{fontWeight:700,fontSize:'0.9375rem',color:'var(--color-text-dark)',margin:'0 0 8px',lineHeight:1.4}}>{item.product_name}</p>
                                    {item.category && <span className="ws-badge ws-badge--gray" style={{marginBottom:8,display:'inline-block'}}>{item.category}</span>}
                                    <p style={{fontSize:'0.75rem',color:'var(--color-text-muted)',margin:'8px 0 0',display:'flex',alignItems:'center',gap:4}}><Truck size={12}/>{sup?.name || 'Unknown'}</p>
                                    {item.description && <p style={{fontSize:'0.75rem',color:'var(--color-text-muted)',margin:'6px 0 0',lineHeight:1.4}}>{item.description}</p>}
                                </div>
                                <div style={{padding:14,borderTop:'1px solid var(--color-border-light)'}}>
                                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                                        <div>
                                            <p style={{fontSize:'1rem',fontWeight:900,margin:0}}>SAR {(item.sale_price||0).toLocaleString()}</p>
                                            <p style={{fontSize:'0.6875rem',color:'var(--color-text-muted)',margin:'2px 0 0'}}>per {item.unit} · Min: {item.min_order_qty || 1}</p>
                                        </div>
                                        <span className={`ws-badge ${inStock ? 'ws-badge--green' : 'ws-badge--red'}`}>{inStock ? `${item.stock_qty} in stock` : 'Out'}</span>
                                    </div>
                                    <button className="btn-portal" style={{width:'100%',justifyContent:'center',padding:'8px'}} disabled={!inStock} onClick={() => { setOrderItem(item); setOrderSupplier(sup); }}>
                                        <ShoppingCart size={14}/> {inStock ? 'Place Order' : 'Out of Stock'}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {requests.length > 0 && (
                <div className="ws-section" style={{marginTop:24}}>
                    <div style={{padding:16}}>
                        <h3 style={{fontSize:'0.9375rem',fontWeight:700,color:'var(--color-text-dark)',margin:'0 0 12px',display:'flex',alignItems:'center',gap:8}}><Send size={16} style={{color:'#2563EB'}}/> My Product Requests</h3>
                        <div style={{display:'flex',flexDirection:'column',gap:8}}>
                            {requests.map(req => (
                                <div key={req.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:12,background:'var(--color-bg-muted)',borderRadius:10}}>
                                    <div><p style={{fontWeight:600,margin:0}}>{req.product_name}</p><p style={{fontSize:'0.75rem',color:'var(--color-text-muted)',margin:'2px 0 0'}}>Qty: {req.quantity_needed} {req.unit}</p></div>
                                    <span className={`ws-badge ${req.status==='pending' ? 'ws-badge--yellow' : req.status==='fulfilled' ? 'ws-badge--green' : 'ws-badge--blue'}`}>{req.status}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <AnimatePresence>
                {showRequestForm && (
                    <Modal title="Request New Product" onClose={()=>setShowRequestForm(false)} footer={<div style={{display:'flex',gap:10,justifyContent:'flex-end'}}><button className="btn-secondary" onClick={()=>setShowRequestForm(false)}>Cancel</button><button className="btn-submit" onClick={handleRequestProduct}>Submit Request</button></div>}>
                        <div className="ws-form-grid">
                            <div className="ws-field" style={{gridColumn:'1/-1'}}><label>Product Name *</label><input placeholder="e.g. 5W-30 Engine Oil 4L" value={reqForm.product_name} onChange={e=>setReqForm(f=>({...f,product_name:e.target.value}))}/></div>
                            <div className="ws-field"><label>Category</label><input placeholder="e.g. Oils, Parts" value={reqForm.category} onChange={e=>setReqForm(f=>({...f,category:e.target.value}))}/></div>
                            <div className="ws-field"><label>Unit</label><select value={reqForm.unit} onChange={e=>setReqForm(f=>({...f,unit:e.target.value}))}><option value="piece">piece</option>{UNIT_OPTIONS.filter(u=>u!='piece').map(u=><option key={u} value={u}>{u}</option>)}</select></div>
                            <div className="ws-field"><label>Quantity Needed</label><input type="number" value={reqForm.quantity_needed} onChange={e=>setReqForm(f=>({...f,quantity_needed:Math.max(1,+e.target.value||1)}))}/></div>
                            <div className="ws-field"><label>Target Price (SAR)</label><input type="number" placeholder="Optional" value={reqForm.target_price} onChange={e=>setReqForm(f=>({...f,target_price:e.target.value}))}/></div>
                            <div className="ws-field" style={{gridColumn:'1/-1'}}><label>Notes</label><input placeholder="Any specific requirements..." value={reqForm.notes} onChange={e=>setReqForm(f=>({...f,notes:e.target.value}))}/></div>
                        </div>
                    </Modal>
                )}
                {orderItem && (
                    <Modal title="Place Purchase Order" onClose={()=>{setOrderItem(null);setOrderSupplier(null)}} footer={<div style={{display:'flex',gap:10,justifyContent:'flex-end'}}><button className="btn-secondary" onClick={()=>{setOrderItem(null);setOrderSupplier(null)}}>Cancel</button><button className="btn-submit" onClick={handlePlaceOrder}>Place Order</button></div>}>
                        <div style={{padding:12,background:'var(--color-bg-muted)',borderRadius:10,marginBottom:16}}>
                            <p style={{fontWeight:700,margin:0}}>{orderItem.product_name}</p>
                            <p style={{fontSize:'0.75rem',color:'var(--color-text-muted)',margin:'4px 0 0'}}>Supplier: <strong>{orderSupplier?.name}</strong> · SAR {orderItem.sale_price?.toLocaleString()} / {orderItem.unit}</p>
                        </div>
                        <div className="ws-form-grid">
                            <div className="ws-field"><label>Quantity (min: {orderItem.min_order_qty || 1})</label><input type="number" defaultValue={orderItem.min_order_qty || 1}/></div>
                            <div className="ws-field"><label>Payment Account</label><select><option>Select account (optional)</option><option>Main Cash</option><option>Al-Rajhi Bank</option></select></div>
                            <div className="ws-field" style={{gridColumn:'1/-1'}}><label>Notes</label><input placeholder="Delivery instructions, urgency..."/></div>
                        </div>
                        <div style={{background:'rgba(59,130,246,0.08)',borderRadius:10,padding:14,marginTop:16,fontSize:'0.8125rem'}}>
                            <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}><span style={{color:'var(--color-text-muted)'}}>Subtotal (excl. VAT)</span><span>SAR {((orderItem.sale_price||0) * (orderItem.min_order_qty||1) / 1.15).toFixed(2)}</span></div>
                            <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}><span style={{color:'var(--color-text-muted)'}}>VAT (15%)</span><span>SAR {(((orderItem.sale_price||0) * (orderItem.min_order_qty||1) * 0.15 / 1.15).toFixed(2))}</span></div>
                            <div style={{display:'flex',justifyContent:'space-between',fontWeight:800,fontSize:'1rem',paddingTop:8,borderTop:'1px solid rgba(59,130,246,0.2)',marginTop:8}}><span>Total</span><span>SAR {((orderItem.sale_price||0) * (orderItem.min_order_qty||1)).toLocaleString()}</span></div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
}
