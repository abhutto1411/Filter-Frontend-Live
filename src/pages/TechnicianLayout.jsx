import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, LogOut, Bell, RefreshCw } from 'lucide-react';
import { NAV_GROUPS } from './technician/constants';
import TechnicianDashboard from './technician/TechnicianDashboard';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../services/api';
import Modal from '../components/Modal';
import '../styles/POSLayout.css';
import './workshop/Workshop.css';

const SIDEBAR_W = 252;

export default function TechnicianLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, workshop, logout } = useAuth();

    const getActiveTabFromUrl = () => {
        const parts = location.pathname.split('/').filter(Boolean);
        return parts[1] || 'home';
    };

    const activeTab = getActiveTabFromUrl();
    const setActiveTab = (tab) => {
        navigate(`/technician/${tab}`);
    };

    const [workshopDuty, setWorkshopDuty] = useState(false);
    const [onCallAvailable, setOnCallAvailable] = useState(false);
    const [toast, setToast] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const [assignedOrdersTotal, setAssignedOrdersTotal] = useState(0);
    const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

    const fetchAssignedOrdersTotal = useCallback(async () => {
        try {
            const qs = new URLSearchParams({ limit: '1', offset: '0' });
            const res = await apiFetch(`/technician/assigned-orders?${qs.toString()}`);
            if (res?.success && typeof res.total !== 'undefined') {
                setAssignedOrdersTotal(Number(res.total) || 0);
            } else {
                setAssignedOrdersTotal(0);
            }
        } catch {
            setAssignedOrdersTotal(0);
        }
    }, []);

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleRefresh = () => {
        setRefreshing(true);
        fetchAssignedOrdersTotal();
        setTimeout(() => setRefreshing(false), 1000);
    };

    useEffect(() => {
        fetchAssignedOrdersTotal();
    }, [fetchAssignedOrdersTotal, location.pathname]);

    useEffect(() => {
        const t = setInterval(() => {
            fetchAssignedOrdersTotal();
        }, 15000);
        return () => clearInterval(t);
    }, [fetchAssignedOrdersTotal]);

    const displayName = user?.name || 'Technician';
    const initials = useMemo(
        () => displayName.split(/\s+/).map((n) => n[0]).join('').toUpperCase().slice(0, 2),
        [displayName],
    );
    const workshopLabel = workshop?.name || user?.workshop?.name || 'Workshop';
    const branchLine = user?.branchName || user?.branch?.name;

    const renderContent = () => (
        <TechnicianDashboard
            activeSection={activeTab}
            workshopDuty={workshopDuty}
            setWorkshopDuty={setWorkshopDuty}
            onCallAvailable={onCallAvailable}
            setOnCallAvailable={setOnCallAvailable}
            showToast={showToast}
            onAssignedOrdersListChanged={fetchAssignedOrdersTotal}
        />
    );

    const currentLabel = NAV_GROUPS.flatMap(g => g.items).find(i => i.id === activeTab)?.label || 'Home';

    const navBtnBase = {
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '11px 16px',
        marginBottom: 6,
        border: 'none',
        borderRadius: 12,
        cursor: 'pointer',
        transition: 'background 0.15s',
        position: 'relative',
    };

    const frostedBtn = {
        background: 'rgba(255,255,255,0.45)',
        border: 'none',
        width: 38,
        height: 38,
        borderRadius: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        color: '#23262D',
    };

    return (
        <div style={{ display: 'flex', height: '100vh', background: '#F5F5F5', overflow: 'hidden' }}>
            {toast && (
                <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, padding: '12px 20px', borderRadius: 12, fontWeight: 700, fontSize: '0.875rem', background: toast.type === 'error' ? '#FEE2E2' : '#DCFCE7', color: toast.type === 'error' ? '#DC2626' : '#15803D', border: `1px solid ${toast.type === 'error' ? '#FCA5A5' : '#BBF7D0'}`, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
                    {toast.msg}
                </div>
            )}

            {logoutConfirmOpen && (
                <Modal
                    className="tech-logout-modal-overlay"
                    contentClassName="modal-content tech-logout-modal-content"
                    hideCloseButton
                    title="Log out?"
                    onClose={() => setLogoutConfirmOpen(false)}
                    width={400}
                    footer={(
                        <div className="tech-logout-modal-footer-inner">
                            <button type="button" className="btn-portal-outline" onClick={() => setLogoutConfirmOpen(false)}>
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn-portal tech-logout-confirm-btn"
                                onClick={() => {
                                    setLogoutConfirmOpen(false);
                                    logout();
                                    navigate('/technician/login');
                                }}
                            >
                                Log out
                            </button>
                        </div>
                    )}
                >
                    <p className="tech-logout-modal-body-text">
                        You will need to sign in again to access the technician portal.
                    </p>
                </Modal>
            )}

            <nav
                style={{
                    width: SIDEBAR_W,
                    flexShrink: 0,
                    background: '#23262D',
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    minHeight: 0,
                    overflowY: 'auto',
                    boxShadow: '4px 0 24px rgba(0,0,0,0.12)',
                }}
            >
                <div style={{ padding: '28px 24px 16px', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ width: 48, height: 48, borderRadius: 12, background: '#FCC247', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1rem', color: '#23262D', flexShrink: 0 }}>
                            {initials}
                        </div>
                        <div style={{ overflow: 'hidden', minWidth: 0 }}>
                            <p style={{ margin: 0, color: '#fff', fontWeight: 900, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</p>
                            <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.7)', fontSize: '0.78rem', fontWeight: 600 }}>Filter Technician Portal</p>
                            <p style={{ margin: '3px 0 0', color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{workshopLabel}</p>
                            {branchLine && (
                                <p style={{ margin: '2px 0 0', color: 'rgba(255,255,255,0.45)', fontSize: '0.7rem', fontWeight: 500 }}>Branch: {branchLine}</p>
                            )}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => navigate('/')}
                        style={{
                            marginTop: 14,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            background: 'none',
                            border: 'none',
                            color: 'rgba(255,255,255,0.45)',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            padding: 0,
                        }}
                    >
                        <ArrowLeft size={14} /> Portal hub
                    </button>
                </div>

                <div style={{ flex: 1, padding: '0 16px 16px', minHeight: 0, overflowY: 'auto' }}>
                    {NAV_GROUPS.map((grp) => (
                        <div key={grp.label}>
                            <div style={{ fontSize: '0.625rem', fontWeight: 800, color: 'rgba(255,255,255,0.35)', padding: '10px 14px 6px', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                                {grp.label}
                            </div>
                            {grp.items.map((item) => {
                                const sel = activeTab === item.id;
                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => setActiveTab(item.id)}
                                        style={{
                                            ...navBtnBase,
                                            background: sel ? '#FCC247' : 'transparent',
                                        }}
                                    >
                                        <item.icon size={20} color={sel ? '#000' : 'rgba(255,255,255,0.7)'} />
                                        <span style={{ fontSize: '0.875rem', fontWeight: sel ? 800 : 500, color: sel ? '#000' : 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap' }}>
                                            {item.label}
                                        </span>
                                        {item.showBadge && assignedOrdersTotal > 0 && (
                                            <span style={{ marginLeft: 'auto', background: '#EF4444', color: '#fff', fontSize: '0.625rem', fontWeight: 800, padding: '2px 7px', borderRadius: 999, minWidth: 20, textAlign: 'center' }}>
                                                {assignedOrdersTotal > 99 ? '99+' : assignedOrdersTotal}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                    <button
                        type="button"
                        onClick={() => setLogoutConfirmOpen(true)}
                        style={{
                            ...navBtnBase,
                            marginTop: 8,
                            background: 'transparent',
                        }}
                    >
                        <LogOut size={20} color="rgba(255,255,255,0.4)" />
                        <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'rgba(255,255,255,0.4)' }}>Logout</span>
                    </button>
                </div>

                <div style={{ padding: '20px 24px', flexShrink: 0 }}>
                    <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.2)', fontWeight: 600 }}>Version 1.0.0</span>
                </div>
            </nav>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
                <header
                    style={{
                        height: 60,
                        background: 'var(--color-primary, #FCC245)',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0 24px',
                        gap: 12,
                        borderBottom: '1px solid rgba(0,0,0,0.08)',
                        boxShadow: '0 1px 0 rgba(255,255,255,0.35) inset',
                    }}
                >
                    <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#111827' }}>{currentLabel}</span>
                    <div style={{ flex: 1 }} />
                    <button
                        type="button"
                        onClick={() => assignedOrdersTotal > 0 && showToast(`${assignedOrdersTotal} assigned order${assignedOrdersTotal === 1 ? '' : 's'}`)}
                        style={{ ...frostedBtn, position: 'relative' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.75)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.45)'; }}
                    >
                        <Bell size={18} />
                        {assignedOrdersTotal > 0 && (
                            <span style={{ position: 'absolute', top: 4, right: 4, minWidth: 14, height: 14, padding: '0 3px', background: '#EF4444', borderRadius: 999, color: '#fff', fontSize: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                                {assignedOrdersTotal > 9 ? '9+' : assignedOrdersTotal}
                            </span>
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={handleRefresh}
                        style={frostedBtn}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.75)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.45)'; }}
                    >
                        <RefreshCw size={18} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
                    </button>
                    <span className="pos-header-date tech-pos-header-date">
                        {new Date().toLocaleDateString('en-SA', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 4px 4px 12px', background: 'rgba(255,255,255,0.55)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.5)' }}>
                        <div style={{ textAlign: 'right' }}>
                            <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 800, color: '#1E293B' }}>{displayName}</p>
                            <p style={{ margin: 0, fontSize: '0.65rem', fontWeight: 600, color: '#475569' }}>Technician</p>
                        </div>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.75rem', color: '#23262D', border: '1px solid rgba(0,0,0,0.06)' }}>
                            {initials}
                        </div>
                    </div>
                </header>

                <main className="pos-content" style={{ flex: 1, padding: 20 }}>
                    {renderContent()}
                </main>
            </div>

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .tech-logout-modal-overlay { z-index: 10050 !important; }
                .tech-logout-modal-content .modal-header-content {
                    border-bottom: none;
                    justify-content: center;
                }
                .tech-logout-modal-content .modal-header-content h3 {
                    width: 100%;
                    text-align: center;
                    margin: 0;
                }
                .tech-logout-modal-content .modal-body-content {
                    border-top: none;
                    text-align: center;
                    padding-top: 8px;
                    padding-bottom: 8px;
                }
                .tech-logout-modal-body-text {
                    margin: 0;
                    font-size: 0.9rem;
                    color: #374151;
                    line-height: 1.5;
                    text-align: center;
                }
                .tech-logout-modal-content .modal-footer-content {
                    border-top: none;
                    justify-content: center;
                    padding-top: 16px;
                    padding-bottom: 20px;
                }
                .tech-logout-modal-footer-inner {
                    display: flex;
                    gap: 10px;
                    justify-content: center;
                    flex-wrap: wrap;
                    width: 100%;
                }
                .tech-logout-confirm-btn {
                    background: #FCC247 !important;
                    color: #23262D !important;
                    border: none !important;
                }
                .tech-logout-confirm-btn:hover {
                    background: #E5AE3A !important;
                    color: #23262D !important;
                }
                .tech-pos-header-date {
                    font-size: 0.85rem;
                    color: #374151;
                    font-weight: 700;
                    display: none;
                }
                @media (min-width: 768px) {
                    .tech-pos-header-date { display: block; }
                }
            `}</style>
        </div>
    );
}
