import { useState, useEffect } from 'react';
import { X, Calendar, Receipt, ChevronRight, User, Package, Car } from 'lucide-react';
import { apiFetch } from '../../services/api';

export default function CustomerHistory({ customer, onBack }) {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!customer) return;
        setLoading(true);
        // Mocking the fetch for history, in real app call /cashier/customers/:id/history
        apiFetch(`/cashier/orders/invoiced/${customer.id}?scope=all`)
            .then(d => setOrders(d.orders || d.data || []))
            .catch(() => setOrders([]))
            .finally(() => setLoading(false));
    }, [customer]);

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, padding: '20px', background: '#fff', borderRadius: 24, border: '1px solid #e2e8f0' }}>
                <div style={{ width: 64, height: 64, borderRadius: 20, background: '#FFF9EC', border: '2px solid #FCC247', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <User size={32} color="#D4A017" />
                </div>
                <div style={{ flex: 1 }}>
                    <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, color: '#23262D' }}>{customer.name}</h2>
                    <p style={{ margin: '4px 0 0', color: '#94a3b8', fontWeight: 600 }}>{customer.mobile} • {customer.customerType?.toUpperCase()}</p>
                </div>
                <button onClick={onBack} style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}>
                    <X size={20} />
                </button>
            </div>

            {/* History List */}
            <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 20 }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '1.1rem', fontWeight: 800, color: '#23262D' }}>Visit History</h3>
                
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                        <div style={{ width: 32, height: 32, border: '3px solid #e2e8f0', borderTopColor: '#FCC247', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    </div>
                ) : orders.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px', background: '#fff', borderRadius: 24, border: '1px solid #e2e8f0' }}>
                        <Receipt size={48} style={{ opacity: 0.1, marginBottom: 16 }} />
                        <p style={{ margin: 0, fontWeight: 700, color: '#64748b' }}>No past orders found</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {orders.map(order => (
                            <div key={order.id} style={orderCardStyle}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div style={{ padding: '6px 12px', background: 'rgba(252,194,71,0.1)', borderRadius: 8, color: '#D4A017', fontSize: '0.75rem', fontWeight: 900 }}>
                                            INV: {order.invoiceNo || order.id}
                                        </div>
                                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#23262D' }}>SAR {order.totalAmount?.toFixed(2) || order.total?.toFixed(2)}</span>
                                    </div>
                                    <span style={statusBadgeStyle(order.status)}>{order.status?.toUpperCase()}</span>
                                </div>

                                <div style={{ display: 'flex', gap: 20, marginBottom: 12 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: '#64748b' }}>
                                        <Calendar size={14} />
                                        <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    {order.vehicle && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: '#64748b' }}>
                                            <Car size={14} />
                                            <span>{order.vehicle.make} {order.vehicle.model} ({order.vehicle.plateNo})</span>
                                        </div>
                                    )}
                                </div>

                                {order.items?.length > 0 && (
                                    <div style={{ padding: '12px', background: '#f8fafc', borderRadius: 12 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, color: '#23262D', fontWeight: 700, fontSize: '0.75rem' }}>
                                            <Package size={14} />
                                            <span>SERVICES & ITEMS</span>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            {order.items.slice(0, 3).map((item, idx) => (
                                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b' }}>
                                                    <span>{item.productName || item.name} x{item.quantity || item.qty}</span>
                                                    <span style={{ fontWeight: 600 }}>SAR {(item.price * (item.quantity || item.qty)).toFixed(2)}</span>
                                                </div>
                                            ))}
                                            {order.items.length > 3 && (
                                                <p style={{ margin: '4px 0 0', fontSize: '0.7rem', color: '#94a3b8', fontStyle: 'italic' }}>+ {order.items.length - 3} more items...</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
        </div>
    );
}

const orderCardStyle = {
    background: '#fff',
    borderRadius: 20,
    padding: '20px',
    border: '1px solid #e2e8f0',
};

const statusBadgeStyle = (status = '') => {
    const s = status.toLowerCase();
    let bg = '#eee';
    let color = '#666';
    if (s === 'completed' || s === 'invoiced') { bg = '#E7F7EF'; color = '#0D9488'; }
    else if (s === 'pending' || s === 'draft') { bg = '#FFF9EC'; color = '#D4A017'; }
    
    return {
        padding: '4px 10px',
        borderRadius: 8,
        background: bg,
        color: color,
        fontSize: '0.65rem',
        fontWeight: 900,
        textTransform: 'uppercase',
    };
};
