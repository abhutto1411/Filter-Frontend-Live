import { useState, useEffect, useRef } from 'react';
import { Search, Plus, Building2, User, Car } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import WalkInOrderModal from './modern/WalkInOrderModal';

export default function POSHome({ onNewWalkIn, onCorporateBooking, onViewHistory, onGoToOrders }) {
    const { user } = useAuth();
    const [search, setSearch]       = useState('');
    const [customers, setCustomers] = useState([]);
    const [searching, setSearching] = useState(false);
    const debounceRef = useRef(null);

    // Walk-in modal state
    const [showWalkInModal, setShowWalkInModal] = useState(false);
    const [walkInLoading, setWalkInLoading] = useState(false);

    // Departments for the modal
    const [departments, setDepartments] = useState([]);

    useEffect(() => {
        const posBranchId = user?.branchId || user?.branch_id;
        const path =
            posBranchId != null && posBranchId !== ''
                ? `/workshop-staff/departments?branchId=${encodeURIComponent(String(posBranchId))}`
                : '/workshop-staff/departments';
        apiFetch(path)
            .then(d => {
                const list = Array.isArray(d) ? d : (d.departments || d.data || []);
                setDepartments(list);
            })
            .catch(() => setDepartments([]));
    }, [user?.branchId, user?.branch_id]);

    useEffect(() => {
        if (!search.trim()) { setCustomers([]); return; }
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setSearching(true);
            const trimmed = search.trim();
            const qs = new URLSearchParams({
                q: trimmed,
                limit: '20',
                scope: 'all',
            }).toString();
            apiFetch(`/cashier/customers/search?${qs}`)
                .then(d => setCustomers(d.customers || d.data || []))
                .catch(() => setCustomers([]))
                .finally(() => setSearching(false));
        }, 350);
        return () => clearTimeout(debounceRef.current);
    }, [search]);

    const handleWalkInSubmit = async (data) => {
        setWalkInLoading(true);
        try {
            const res = await apiFetch('/cashier/walk-in-order', {
                method: 'POST',
                body: JSON.stringify(data)
            });
            setShowWalkInModal(false);
            // Extract the new order ID from the response
            const newOrderId = res?.order?.id || res?.orderId || res?.data?.id || res?.id || null;
            // Navigate to Orders tab with the new order ID so it auto-selects
            if (onGoToOrders) {
                onGoToOrders(newOrderId);
            }
        } catch (err) {
            alert("Failed to create walk-in order: " + err.message);
        } finally {
            setWalkInLoading(false);
        }
    };

    return (
        <div style={{ width: '100%' }}>
            {/* Title */}
            <div style={{ textAlign: 'center', marginBottom: 8 }}>
                <h1 style={{ margin: 0, fontSize: '2.1rem', fontWeight: 700, lineHeight: 1.2, letterSpacing: -0.5 }}>
                    <span style={{ color: '#FCC247' }}>Workshop </span>
                    <span style={{ color: '#23262D' }}>POS</span>
                </h1>
            </div>
            <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem', margin: '0 0 28px', lineHeight: 1.6 }}>
                Search by customer number, vehicle number,<br />phone number or customer name
            </p>

            {/* Search bar */}
            <div style={{ position: 'relative', marginBottom: 14 }}>
                <Search size={18} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                {searching && <div style={spinnerStyle} />}
                <input
                    type="text"
                    placeholder="Search customer no / vehicle / mobile / plate..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ width: '100%', padding: '14px 48px 14px 46px', border: '2px solid #e2e8f0', borderRadius: 14, fontSize: '0.9rem', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', background: '#fff', transition: 'border-color 0.15s' }}
                    onFocus={e => e.target.style.borderColor = '#FCC247'}
                    onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                />
            </div>

            {/* Action chips */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 28 }}>
                <button onClick={() => setShowWalkInModal(true)} style={chipBtn}>
                    <Plus size={16} color="#23262D" />
                    <span>New walk-in</span>
                </button>
                <button onClick={onCorporateBooking} style={chipBtn}>
                    <Building2 size={16} color="#23262D" />
                    <span>Corporate booking</span>
                </button>
            </div>

            {/* Search results */}
            {search && searching && (
                <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8' }}>
                    <div style={{ width: 36, height: 36, border: '3px solid #e2e8f0', borderTopColor: '#FCC247', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
                    <p style={{ margin: 0, fontSize: '0.875rem' }}>Searching…</p>
                </div>
            )}

            {search && !searching && customers.length === 0 && (
                <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8' }}>
                    <Search size={44} style={{ opacity: 0.2, marginBottom: 12 }} />
                    <p style={{ margin: 0, fontWeight: 600 }}>No results found</p>
                    <p style={{ margin: '4px 0 0', fontSize: '0.8rem' }}>Try a different name or number</p>
                </div>
            )}

            {customers.length > 0 && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: '#64748b' }}>
                            Recent Searches ({customers.length})
                        </p>
                    </div>
                    
                    <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
                        gap: 16 
                    }}>
                        {customers.map(c => {
                            const latestOrder = c.orders?.[0];
                            const vehicle = latestOrder?.vehicle;
                            return (
                                <div key={c.id}
                                    style={{ 
                                        background: '#fff', 
                                        borderRadius: 18, 
                                        padding: '18px', 
                                        border: '1px solid #e2e8f0', 
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                                        transition: 'all 0.2s ease',
                                        position: 'relative'
                                    }}
                                    onMouseEnter={e => { 
                                        e.currentTarget.style.borderColor = '#FCC247'; 
                                        e.currentTarget.style.boxShadow = '0 8px 24px rgba(252,194,71,0.12)'; 
                                    }}
                                    onMouseLeave={e => { 
                                        e.currentTarget.style.borderColor = '#e2e8f0'; 
                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.03)'; 
                                    }}>
                                    
                                    {/* Header: Vehicle & Plate */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                                <Car size={16} color="#FCC247" />
                                                <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#23262D' }}>
                                                    {vehicle ? `${vehicle.make} ${vehicle.model}` : 'No Vehicle Registered'}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                                                PLATE: <span style={{ color: '#23262D' }}>{vehicle?.plateNo || 'N/A'}</span>
                                            </div>
                                        </div>
                                        {c.customerType?.toLowerCase() === 'corporate' && (
                                            <span style={{ padding: '4px 10px', borderRadius: 8, background: '#eff6ff', color: '#2563eb', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase' }}>Corporate</span>
                                        )}
                                    </div>

                                    {/* Customer Info */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px', background: '#f8fafc', borderRadius: 12, marginBottom: 14 }}>
                                        <div style={{ width: 36, height: 36, borderRadius: 10, background: '#23262D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <User size={18} color="#FCC247" />
                                        </div>
                                        <div>
                                            <p style={{ margin: 0, fontWeight: 700, fontSize: '0.85rem', color: '#23262D' }}>{c.name || c.fullName}</p>
                                            <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>{c.mobile || c.phone}</p>
                                        </div>
                                    </div>

                                    {/* Footer Stats */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#94a3b8', marginBottom: 16 }}>
                                        <div>
                                            <p style={{ margin: '0 0 2px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Last Visit</p>
                                            <p style={{ margin: 0, color: '#23262D', fontWeight: 700 }}>{latestOrder ? new Date(latestOrder.createdAt).toLocaleDateString() : 'N/A'}</p>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <p style={{ margin: '0 0 2px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Last Service</p>
                                            <p style={{ margin: 0, color: '#FCC247', fontWeight: 800 }}>{latestOrder?.status?.toUpperCase() || 'N/A'}</p>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button 
                                            onClick={() => setShowWalkInModal(true)}
                                            style={{ flex: 1, padding: '10px', background: '#23262D', color: '#FCC247', border: 'none', borderRadius: 10, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                                            New Service
                                        </button>
                                        <button
                                            onClick={() => onViewHistory?.(c)}
                                            style={{ padding: '10px 14px', background: '#fff', color: '#23262D', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                                            History
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Walk-in Order Modal — same modal and API as Orders screen */}
            <WalkInOrderModal
                isOpen={showWalkInModal}
                onClose={() => setShowWalkInModal(false)}
                onSubmit={handleWalkInSubmit}
                departments={departments}
                loading={walkInLoading}
            />

            <style>{`
                @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
            `}</style>
        </div>
    );
}

const chipBtn = {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '10px 18px', background: '#fff',
    border: '1px solid #e2e8f0', borderRadius: 12, cursor: 'pointer',
    fontSize: '0.875rem', fontWeight: 600, color: '#23262D',
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)', fontFamily: 'inherit',
};

const spinnerStyle = {
    position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
    width: 18, height: 18, border: '2px solid #e2e8f0', borderTopColor: '#FCC247',
    borderRadius: '50%', animation: 'spin 0.8s linear infinite',
};
