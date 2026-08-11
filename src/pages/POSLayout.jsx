import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Home, Package, FileText, Store, DollarSign, Tag, Users,
    RotateCcw, Clock, List, ShoppingBag, LogOut, Play, Loader2, MessageCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../services/api';
import '../styles/POSLayout.css';

import POSHome from '../components/pos/POSHome';
import AddNewOrder from '../components/pos/AddNewOrder';
import DepartmentSelect from '../components/pos/DepartmentSelect';
import OrderBuilder from '../components/pos/OrderBuilder';
import CorporateBookings from '../components/pos/CorporateBookings';
import OrdersScreen from '../components/pos/OrdersScreen';
import ProductsScreen from '../components/pos/ProductsScreen';
import SalesReturnScreen from '../components/pos/SalesReturnScreen';
import ReturnsListScreen from '../components/pos/ReturnsListScreen';
import PettyCashScreen from '../components/pos/PettyCashScreen';
import PromotionsScreen from '../components/pos/PromotionsScreen';
import TechnicianAssignment from '../components/pos/TechnicianAssignment';
import TakeawayScreen from '../components/pos/TakeawayScreen';
import CounterClosingScreen from '../components/pos/CounterClosingScreen';
import YourJobsView from '../components/pos/YourJobsView';
import CustomerHistory from '../components/pos/CustomerHistory';
import { POSProvider, usePOS } from '../context/POSContext';
import CashierPlatformChatPage from './pos/CashierPlatformChatPage';
import PlatformChatNavBadge from '../components/platform-chat/PlatformChatNavBadge';
import PlatformChatFab from '../components/platform-chat/PlatformChatFab';
import { isPlatformChatNavId } from '../utils/platformChatForUser';
import '../styles/admin/PlatformChat.css';

const NAV_ITEMS = [
    { id: 'home',          label: 'Home',          Icon: Home },
    { id: 'chat',          label: 'Chat',          Icon: MessageCircle },
    { id: 'products',      label: 'Products',      Icon: Package },
    { id: 'orders',        label: 'Orders',        Icon: FileText },
    { id: 'takeaway',      label: 'Takeaway',      Icon: ShoppingBag },
    { id: 'sales_return',  label: 'Sales Return',  Icon: RotateCcw },
    { id: 'returns_list',  label: 'Returns List',  Icon: List },
    { id: 'petty_cash',    label: 'Petty Cash',    Icon: DollarSign },
    { id: 'promotions',    label: 'Promo Codes',   Icon: Tag },
    { id: 'technicians',   label: 'Technicians',   Icon: Users },
    { id: 'store_closing', label: 'Store Closing', Icon: Store },
];

const SIDEBAR_IDS = NAV_ITEMS.map(n => n.id);

const SCREEN_LABELS = {
    add_order:           'New Walk-In',
    dept_select:         'Select Department',
    your_jobs:           'Manage Jobs',
    order_builder:       'Order Builder',
    corporate_bookings:  'Corporate Bookings',
    history_view:        'Customer History',
};

function BroadcastOverlay() {
    const { broadcasts, dismissBroadcast } = usePOS();
    if (broadcasts.length === 0) return null;

    return (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 10000, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 320 }}>
            {broadcasts.map(b => (
                <div key={b.id} style={{ background: '#fff', borderLeft: '4px solid #FCC247', borderRadius: 12, padding: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)', animation: 'slideIn 0.3s ease-out' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <p style={{ margin: 0, fontWeight: 900, color: '#23262D', fontSize: '0.9rem' }}>Technical Alert</p>
                        <button onClick={() => dismissBroadcast(b.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }}><Clock size={16} /></button>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b', lineHeight: 1.4 }}>{b.message || 'Urgent assistance requested in department.'}</p>
                    {b.department && <p style={{ margin: '8px 0 0', fontWeight: 800, fontSize: '0.75rem', color: '#FCC247' }}>DEPT: {b.department}</p>}
                </div>
            ))}
            <style>{`
                @keyframes slideIn { from { transform: translateX(100%); opacity: 0 } to { transform: translateX(0); opacity: 1 } }
            `}</style>
        </div>
    );
}

export default function POSLayout() {
    return (
        <POSProvider>
            <POSContent />
        </POSProvider>
    );
}

function POSContent() {
    const navigate  = useNavigate();
    const location  = useLocation();
    const { logout, user } = useAuth();

    // Sync screen with URL: /pos/SCREEN_ID
    const getScreenFromUrl = () => {
        const parts = location.pathname.split('/').filter(Boolean);
        return parts[1] || 'home';
    };

    const screen = getScreenFromUrl();
    const setScreen = (newScreen) => {
        navigate(`/pos/${newScreen}`);
    };
    const [sessionChecked, setSessionChecked] = useState(false);
    const [sessionActive, setSessionActive]   = useState(false);
    const [sessionOpening, setSessionOpening] = useState(false);
    // Walk-in sub-flow state
    const [orderInfo,          setOrderInfo]          = useState(null);
    const [selectedDepts,      setSelectedDepts]      = useState([]);
    const [activeDept,         setActiveDept]         = useState(null);
    const [assignedTech,       setAssignedTech]       = useState(null);
    const [prefilledCustomer,  setPrefilledCustomer]  = useState(null);
    const [selectedCustomer,   setSelectedCustomer]   = useState(null);
    const [createdOrderId,     setCreatedOrderId]     = useState(null);
    const [deptJobIds,         setDeptJobIds]         = useState({});

    const handleLogout = () => { logout(); navigate('/'); };

    useEffect(() => {
        apiFetch('/cashier/session/current')
            .then(d => {
                const sess = d.session || d.data || d;
                if (sess && (sess.id || sess.sessionId || sess.posSessionId)) {
                    setSessionActive(true); setSessionChecked(true);
                } else {
                    apiFetch('/cashier/session/open', { method: 'POST' })
                        .then(() => setSessionActive(true))
                        .catch(() => setSessionActive(false))
                        .finally(() => setSessionChecked(true));
                }
            })
            .catch(() => {
                apiFetch('/cashier/session/open', { method: 'POST' })
                    .then(() => setSessionActive(true))
                    .catch(() => setSessionActive(false))
                    .finally(() => setSessionChecked(true));
            });
    }, []);

    const openSession = async () => {
        setSessionOpening(true);
        try {
            await apiFetch('/cashier/session/open', { method: 'POST' });
            setSessionActive(true);
        } catch (e) {
            alert(e.message || 'Failed to open session');
        } finally {
            setSessionOpening(false);
        }
    };

    const goHome = () => {
        setScreen('home');
        setOrderInfo(null); setSelectedDepts([]); setActiveDept(null); setAssignedTech(null);
        setPrefilledCustomer(null); setSelectedCustomer(null); setCreatedOrderId(null); setDeptJobIds({});
    };

    const userName = user?.name || 'Cashier';
    const initials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const activeNavId = SIDEBAR_IDS.includes(screen) ? screen : 'home';

    if (!sessionChecked) {
        return (
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5F5F5' }}>
                <div style={{ width: 44, height: 44, border: '4px solid #e2e8f0', borderTopColor: '#FCC247', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
            </div>
        );
    }

    if (!sessionActive) {
        return (
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5F5F5' }}>
                <div style={{ background: '#fff', borderRadius: 24, padding: '40px 48px', textAlign: 'center', maxWidth: 400, boxShadow: '0 8px 40px rgba(0,0,0,0.12)' }}>
                    <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#FCC247', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                        <Play size={32} color="#23262D" />
                    </div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#23262D', margin: '0 0 8px' }}>Start Your Shift</h2>
                    <p style={{ color: '#64748b', margin: '0 0 32px', fontSize: '0.9rem' }}>No active POS session found. Open a session to begin taking orders.</p>
                    <button onClick={openSession} disabled={sessionOpening}
                        style={{ background: '#23262D', color: '#FCC247', border: 'none', borderRadius: 14, padding: '14px 32px', fontWeight: 800, fontSize: '1rem', cursor: sessionOpening ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        {sessionOpening ? <Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Play size={18} />}
                        {sessionOpening ? 'Opening…' : 'Open Session'}
                    </button>
                    <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.82rem', margin: '16px auto 0', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <LogOut size={13} /> Logout instead
                    </button>
                </div>
                <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
            </div>
        );
    }

    if (screen === 'chat') {
        return (
            <div className="portal-layout--chat-fullscreen">
                <CashierPlatformChatPage />
            </div>
        );
    }

    const renderScreen = () => {
        switch (screen) {
            case 'home':
                return (
                    <POSHome
                        onNewWalkIn={(customer) => { 
                            setPrefilledCustomer(customer || null); 
                            setScreen('add_order'); 
                        }}
                        onViewHistory={(customer) => {
                            setSelectedCustomer(customer);
                            setScreen('history_view');
                        }}
                        onCorporateBooking={() => setScreen('corporate_bookings')}
                    />
                );
            case 'history_view':
                return (
                    <CustomerHistory 
                        customer={selectedCustomer} 
                        onBack={() => setScreen('home')} 
                    />
                );
            case 'add_order':
                return (
                    <AddNewOrder
                        onBack={() => setScreen('home')}
                        prefilledCustomer={prefilledCustomer}
                        onProceed={(info) => { setOrderInfo(info); setScreen('dept_select'); }}
                    />
                );
            case 'dept_select':
                return (
                    <DepartmentSelect
                        orderInfo={orderInfo}
                        onBack={() => setScreen('add_order')}
                        onSelectDept={(dept) => { 
                            setSelectedDepts(prev => {
                                if (prev.find(d => d.id === dept.id)) return prev;
                                return [...prev, dept];
                            });
                            setScreen('your_jobs'); 
                        }}
                    />
                );
            case 'your_jobs':
                return (
                    <YourJobsView
                        selectedDepartments={selectedDepts}
                        orderInfo={orderInfo}
                        onRemoveDepartment={(id) => setSelectedDepts(prev => prev.filter(d => d.id !== id))}
                        onAssignTechnicians={(dept) => {
                            setActiveDept(dept);
                            setScreen('tech_select');
                        }}
                        onAddInventory={(dept) => {
                            setActiveDept(dept);
                            setScreen('order_builder');
                        }}
                        onSaveDraft={goHome}
                        onPlaceOrder={goHome}
                    />
                );
            case 'tech_select':
                return (
                    <TechnicianAssignment
                        standalone={false}
                        open={true}
                        departmentId={activeDept?.id}
                        orderInfo={{ ...orderInfo, department: activeDept?.name }}
                        onAssign={(tech) => { setAssignedTech(tech); setScreen('your_jobs'); }}
                        onClose={() => setScreen('your_jobs')}
                    />
                );
            case 'order_builder':
                return (
                    <OrderBuilder
                        orderInfo={{ ...orderInfo, technician: assignedTech }}
                        department={activeDept}
                        createdOrderId={createdOrderId}
                        deptJobIds={deptJobIds}
                        onOrderCreated={(orderId, jobIds) => { setCreatedOrderId(orderId); setDeptJobIds(jobIds); }}
                        onBack={() => setScreen('your_jobs')}
                        onComplete={() => setScreen('your_jobs')}
                        onAddDept={() => setScreen('dept_select')}
                    />
                );
            case 'corporate_bookings':
                return (
                    <CorporateBookings
                        onBack={goHome}
                        onApproveAndEdit={(booking) => {
                            setOrderInfo({ type: 'corporate', customer: { id: booking.customerId, name: booking.customerName, customer_type: 'corporate' }, vehicle: {} });
                            setSelectedDept({ id: 'direct', name: 'Booked Service' });
                            setScreen('order_builder');
                        }}
                    />
                );
            case 'chat':          return null;
            case 'products':      return <ProductsScreen />;
            case 'orders':        return <OrdersScreen />;
            case 'takeaway':      return <TakeawayScreen />;
            case 'sales_return':  return <SalesReturnScreen onBack={() => setScreen('home')} />;
            case 'returns_list':  return <ReturnsListScreen />;
            case 'petty_cash':    return <PettyCashScreen onBack={() => setScreen('home')} />;
            case 'promotions':    return <PromotionsScreen onBack={() => setScreen('home')} />;
            case 'technicians':   return <TechnicianAssignment standalone />;
            case 'store_closing': return <CounterClosingScreen onBack={() => setScreen('home')} onLogout={handleLogout} />;
            default:              return null;
        }
    };

    const topLabel = SCREEN_LABELS[screen] || NAV_ITEMS.find(n => n.id === screen)?.label || 'POS';

    return (
        <div style={{ display: 'flex', height: '100vh', background: '#F5F5F5', overflow: 'hidden' }}>
            {/* Left nav — always visible (workshop POS) */}
            <nav style={{
                width: 252,
                flexShrink: 0,
                background: '#23262D',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                minHeight: 0,
                overflowY: 'auto',
                boxShadow: '4px 0 24px rgba(0,0,0,0.12)',
            }}>
                {/* User header */}
                <div style={{ padding: '28px 24px 24px', flexShrink: 0, position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ width: 48, height: 48, borderRadius: 12, background: '#FCC247', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1rem', color: '#23262D', flexShrink: 0 }}>
                            {initials}
                        </div>
                        <div style={{ overflow: 'hidden' }}>
                            <p style={{ margin: 0, color: '#fff', fontWeight: 900, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</p>
                            <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.7)', fontSize: '0.78rem', fontWeight: 600 }}>Filter POS Portal</p>
                            {user?.branchName && (
                                <p style={{ margin: '3px 0 0', color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem', fontWeight: 500 }}>Branch: {user.branchName}</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Nav items */}
                <div style={{ flex: 1, padding: '0 16px 16px' }}>
                    {NAV_ITEMS.map(({ id, label, Icon }) => {
                        const sel = activeNavId === id;
                        return (
                            <button key={id} onClick={() => setScreen(id)}
                                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '11px 16px', marginBottom: 6, background: sel ? '#FCC247' : 'transparent', border: 'none', borderRadius: 12, cursor: 'pointer', transition: 'background 0.15s' }}>
                                <Icon size={20} color={sel ? '#000' : 'rgba(255,255,255,0.7)'} />
                                <span style={{ fontSize: '0.875rem', fontWeight: sel ? 800 : 500, color: sel ? '#000' : 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap' }}>
                                    {label}
                                </span>
                                {isPlatformChatNavId(id) && <PlatformChatNavBadge />}
                            </button>
                        );
                    })}
                    <button onClick={handleLogout}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '11px 16px', marginTop: 8, background: 'transparent', border: 'none', borderRadius: 12, cursor: 'pointer' }}>
                        <LogOut size={20} color="rgba(255,255,255,0.4)" />
                        <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'rgba(255,255,255,0.4)' }}>Logout</span>
                    </button>
                </div>

                {/* Footer */}
                <div style={{ padding: '20px 24px', flexShrink: 0 }}>
                    <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.2)', fontWeight: 600 }}>Version 1.0.0</span>
                </div>
            </nav>

            {/* Main content */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
                {/* Top bar — brand yellow (workshop / branch POS) */}
                <div style={{ height: 60, background: 'var(--color-primary, #FCC245)', flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 24px', gap: 12, borderBottom: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 1px 0 rgba(255,255,255,0.35) inset' }}>
                    <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#111827' }}>{topLabel}</span>
                    <div style={{ flex: 1 }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <span className="pos-header-date">
                            {new Date().toLocaleDateString('en-SA', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 4px 4px 12px', background: 'rgba(255,255,255,0.55)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.5)' }}>
                            <div style={{ textAlign: 'right' }}>
                                <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 800, color: '#1E293B' }}>{userName}</p>
                                <p style={{ margin: 0, fontSize: '0.65rem', fontWeight: 600, color: '#475569' }}>Cashier</p>
                            </div>
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.75rem', color: '#23262D', border: '1px solid rgba(0,0,0,0.06)' }}>
                                {initials}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Screen — extra top + left inset after drawer on Home & Products */}
                <div
                    className="pos-content"
                    style={{
                        flex: 1,
                        paddingTop: screen === 'home' || screen === 'products' ? 20 : undefined,
                        paddingLeft: screen === 'home' || screen === 'products' ? 20 : undefined,
                    }}
                >
                    {renderScreen()}
                </div>
            </div>

            <BroadcastOverlay />
            <style>{`
                @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
                .pos-header-date {
                    font-size: 0.85rem;
                    color: #374151;
                    font-weight: 700;
                    display: none;
                }
                @media (min-width: 768px) {
                    .pos-header-date {
                        display: block;
                    }
                }
            `}</style>
            <PlatformChatFab hidden={screen === 'chat'} onClick={() => setScreen('chat')} />
        </div>
    );
}
