import React from 'react';
import { Search } from 'lucide-react';
import OrderTile from './OrderTile';

const TABS = ['All', 'Pending', 'Completed'];

export default function OrderList({ 
    orders, 
    tab, 
    setTab, 
    search, 
    setSearch, 
    selectedId, 
    setSelectedId, 
    loading 
}) {
    return (
        <div className="modern-order-list">
            <div className="modern-search-bar">
                <Search size={18} className="modern-search-icon" />
                <input 
                    type="text" 
                    placeholder="Search orders..." 
                    value={search} 
                    onChange={e => setSearch(e.target.value)} 
                    className="modern-search-input"
                />
            </div>

            <div className="modern-tabs">
                {TABS.map(t => (
                    <button 
                        key={t} 
                        onClick={() => setTab(t)} 
                        className={`modern-tab-btn ${tab === t ? 'active' : ''}`}
                    >
                        {t}
                    </button>
                ))}
            </div>

            <div className="modern-scroll-area">
                {loading && orders.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="order-tile-modern animate-pulse" style={{ height: 120, borderStyle: 'dashed' }} />
                        ))}
                    </div>
                ) : orders.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                        <p style={{ color: 'var(--pos-text-muted)', fontWeight: 600 }}>No orders found</p>
                    </div>
                ) : (
                    orders.map(order => (
                        <OrderTile 
                            key={order.id} 
                            order={order} 
                            isSelected={selectedId === order.id}
                            onClick={() => setSelectedId(order.id)}
                        />
                    ))
                )}
            </div>
        </div>
    );
}
