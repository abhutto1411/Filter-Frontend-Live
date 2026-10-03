import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { Building2, Wallet, Calendar, Tag, LogOut, Loader2 } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../components/Modal';
import {
    NAV_GROUPS,
} from './corporate/constants';
import CorporateDashboard from './corporate/CorporateDashboard';
import CorporateProfile from './corporate/CorporateProfile';
import CorporateVehicles from './corporate/CorporateVehicles';
import CorporateBookings from './corporate/CorporateBookings';
import CorporateBookingApprovals from './corporate/CorporateBookingApprovals';
import CorporateQuotations from './corporate/CorporateQuotations';
import QuotationModal from './corporate/QuotationModal';
import MonthlyBilling from './corporate/MonthlyBilling';
import CorporateWallet from './corporate/CorporateWallet';
import CorporateReports from './corporate/CorporateReports';
import CorporatePlatformChatPage from './corporate/CorporatePlatformChatPage';
import PlatformChatNavBadge from '../components/platform-chat/PlatformChatNavBadge';
import PlatformChatFab from '../components/platform-chat/PlatformChatFab';
import { isPlatformChatNavId } from '../utils/platformChatForUser';
import { apiFetch, BASE_URL } from '../services/api';
import { formatPlateLettersFirst } from '../utils/formatPlate';
import { fetchCorporateBranchCatalogPickerRows } from '../services/corporateBranchCatalog';
import { fetchCorporateBranches } from '../services/corporateBookingsApi';
import './workshop/Workshop.css';
import '../styles/admin/PlatformChat.css';

/** Map branch-catalog row → `departmentId` for order / booking lines. */
function resolveDepartmentIdForCatalogRow(row, selectedDeptIds, defaultDeptId) {
    const ids = (selectedDeptIds || []).map(String).filter(Boolean);
    if (!ids.length) return '';
    const rowDept = row?.departmentId != null && String(row.departmentId).trim() !== '' ? String(row.departmentId).trim() : '';
    if (rowDept && ids.includes(rowDept)) return rowDept;
    const d = defaultDeptId != null && String(defaultDeptId).trim() !== '' ? String(defaultDeptId).trim() : '';
    if (d && ids.includes(d)) return d;
    return ids[0];
}

const PAYMENT_METHOD_OPTIONS = [
    'Cash',
    'Card',
    'Wallet',
    'Bank Transfer',
    'Monthly Billing',
];

/** Review step: sum branch-catalog `salePrice` for selected services/products (same source as step-1 list). */
function estimateReviewTotalFromBranchCatalog(bookingForm, branchCatalogRows) {
    const rows = Array.isArray(branchCatalogRows) ? branchCatalogRows : [];
    const unitPrice = (itemType, id, deptId) => {
        const idStr = String(id);
        const deptStr = String(deptId ?? '').trim();
        const type = String(itemType || '').toLowerCase();
        const byDept = rows.find(
            (r) =>
                String(r.itemType || '').toLowerCase() === type &&
                String(r.id) === idStr &&
                String(r.departmentId || '').trim() === deptStr,
        );
        if (byDept) return Number(byDept.salePrice ?? 0);
        const any = rows.find(
            (r) => String(r.itemType || '').toLowerCase() === type && String(r.id) === idStr,
        );
        return any ? Number(any.salePrice ?? 0) : 0;
    };
    let sum = 0;
    for (const s of bookingForm.services || []) {
        sum += unitPrice('service', s.serviceId, s.departmentId);
    }
    for (const p of bookingForm.products || []) {
        const qty = Math.max(1, Math.floor(Number(p.qty) || 1));
        sum += unitPrice('product', p.productId, p.departmentId) * qty;
    }
    return Math.round(sum * 100) / 100;
}

export default function CorporateLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout, token } = useAuth();
    
    // Sync activeTab with URL: /corporate/TAB_NAME
    const getActiveTabFromUrl = () => {
        const parts = location.pathname.split('/').filter(Boolean);
        return parts[1] || 'dashboard';
    };

    const activeTab = getActiveTabFromUrl();
    /** Optional `opts` for billing: `{ month: 1-12, year }` opens Monthly billing on that invoice period. */
    const setActiveTab = (tab, opts) => {
        if (
            tab === 'billing' &&
            opts &&
            typeof opts === 'object' &&
            (opts.month != null || opts.year != null)
        ) {
            const p = new URLSearchParams();
            if (opts.month != null) p.set('month', String(opts.month));
            if (opts.year != null) p.set('year', String(opts.year));
            const s = p.toString();
            navigate({ pathname: `/corporate/${tab}`, ...(s ? { search: `?${s}` } : {}) });
            return;
        }
        navigate(`/corporate/${tab}`);
    };
    const [bookingOpen, setBookingOpen] = useState(false);
    const [quoteOpen, setQuoteOpen] = useState(false);
    const [vehicles, setVehicles] = useState([]);
    const [branches, setBranches] = useState([]);
    const [walletBalance, setWalletBalance] = useState(0);

    const refreshWalletBalance = useCallback(() => {
        apiFetch('/corporate/wallet')
            .then((data) =>
                setWalletBalance(
                    Number(data.balance ?? data.walletBalance ?? data.wallet_balance ?? data.amount ?? 0) || 0,
                ),
            )
            .catch(() => {});
    }, []);

    useEffect(() => {
        apiFetch('/corporate/vehicles')
            .then((data) => {
                if (!data.success || !Array.isArray(data.vehicles)) return;
                setVehicles(
                    data.vehicles.map((v) => {
                        const plate =
                            formatPlateLettersFirst(v.plateDisplay || v.plateNumber || v.plateNo) ||
                            v.plateNo;
                        return { ...v, plateNo: plate, plateDisplay: plate };
                    }),
                );
            })
            .catch(() => {});
        apiFetch('/corporate/profile')
            .then(data => {
                const allBranches = (data.workshops || []).flatMap(w => w.branches || []);
                const ids = data.corporateAccount?.selectedStoreIds || [];
                setBranches(ids.length ? allBranches.filter(b => ids.includes(String(b.id))) : allBranches);
            })
            .catch(() => {});
        refreshWalletBalance();
    }, [refreshWalletBalance]);

    const corporateRealtimeSocketRef = useRef(null);

    /**
     * Socket.IO `/realtime` — bookings, walk-in quotes, wallet (corporate portal only).
     * Connection is deferred (`setTimeout(0)`) so React 18 Strict Mode’s mount→immediate unmount
     * does not call `disconnect()` while the WebSocket is still handshaking (avoids console noise
     * and flaky first connect in dev).
     */
    useEffect(() => {
        if (!token || !user || user.userType !== 'corporate_user') return undefined;
        const base = String(BASE_URL || '').replace(/\/$/, '');
        const bumpBookings = () => {
            window.dispatchEvent(new Event('corporate-portal-bookings-refresh'));
        };
        const bumpDashboard = () => {
            window.dispatchEvent(new Event('corporate-portal-dashboard-refresh'));
        };
        const bumpBilling = () => {
            window.dispatchEvent(new Event('corporate-portal-billing-refresh'));
        };
        const onBooking = () => {
            bumpBookings();
            bumpDashboard();
            bumpBilling();
        };
        const onWalkIn = () => {
            bumpBookings();
            bumpDashboard();
        };
        const onWallet = (payload) => {
            const bal = Number(payload?.balance);
            if (!Number.isNaN(bal)) setWalletBalance(bal);
            window.dispatchEvent(new CustomEvent('corporate-portal-wallet-refresh', { detail: payload }));
            bumpDashboard();
            bumpBilling();
        };
        const onQuotations = () => {
            window.dispatchEvent(new Event('corporate-price-quotations-changed'));
        };

        const connectTimer = window.setTimeout(() => {
            const socket = io(`${base}/realtime`, {
                auth: { token },
                transports: ['websocket', 'polling'],
            });
            corporateRealtimeSocketRef.current = socket;
            socket.on('corporate.booking.updated', onBooking);
            socket.on('corporate.walk-in-order.updated', onWalkIn);
            socket.on('corporate.wallet.updated', onWallet);
            socket.on('corporate.quotations.updated', onQuotations);
        }, 0);

        return () => {
            window.clearTimeout(connectTimer);
            const socket = corporateRealtimeSocketRef.current;
            corporateRealtimeSocketRef.current = null;
            if (socket) {
                socket.removeAllListeners();
                socket.disconnect();
            }
        };
    }, [token, user]);
    const [bookingForm, setBookingForm] = useState({
        vehicle_id: '',
        branch_id: '',
        department_ids: [],
        booking_date: '',
        notes: '',
        payment_method: 'Cash',
        /** UI + API (MakePayment): { serviceId, departmentId, name } */
        services: [],
        /** UI + API: { productId, departmentId, qty, name } */
        products: [],
    });
    const [departments, setDepartments] = useState([]);
    const [depsLoading, setDepsLoading] = useState(false);
    const setBook = (k, v) => setBookingForm(f => ({ ...f, [k]: v }));
    const toggleDept = (id) => setBookingForm(f => ({ ...f, department_ids: f.department_ids.includes(id) ? f.department_ids.filter(d => d !== id) : [...f.department_ids, id] }));

    useEffect(() => {
        if (!bookingForm.branch_id) { setDepartments([]); return; }
        setDepsLoading(true);
        apiFetch(`/corporate/departments?branchId=${bookingForm.branch_id}`)
            .then(data => { if (data.success) setDepartments(data.departments); })
            .catch(() => setDepartments([]))
            .finally(() => setDepsLoading(false));
    }, [bookingForm.branch_id]);

    const [bookingStep, setBookingStep] = useState(1);
    const [bookingLoading, setBookingLoading] = useState(false);
    const [bookingError, setBookingError] = useState('');
    const [catalogSearch, setCatalogSearch] = useState('');
    const [validateResult, setValidateResult] = useState(null);
    const [defaultItemDepartmentId, setDefaultItemDepartmentId] = useState('');
    const [branchCatalogRows, setBranchCatalogRows] = useState([]);
    const [branchCatalogLoading, setBranchCatalogLoading] = useState(false);

    const reviewEstimatedTotalSar = useMemo(() => {
        if (bookingStep !== 2 || !validateResult) return 0;
        const root = validateResult?.data && typeof validateResult.data === 'object' ? validateResult.data : validateResult;
        const apiRaw =
            root?.totalAmount ??
            root?.grandTotal ??
            root?.grand_total ??
            root?.total ??
            root?.amount;
        if (apiRaw != null && apiRaw !== '' && Number.isFinite(Number(apiRaw))) {
            return Math.round(Number(apiRaw) * 100) / 100;
        }
        return estimateReviewTotalFromBranchCatalog(bookingForm, branchCatalogRows);
    }, [bookingStep, bookingForm, branchCatalogRows, validateResult]);
    /** `null` = not loaded yet (use profile `branches`); `[]` = API returned no branches (still fallback to profile). */
    const [bookingBranchOptions, setBookingBranchOptions] = useState(null);

    const EMPTY_BOOKING = {
        vehicle_id: '',
        branch_id: '',
        department_ids: [],
        booking_date: '',
        notes: '',
        payment_method: 'Cash',
        services: [],
        products: [],
    };
    const resetBooking = () => {
        setBookingStep(1);
        setBookingError('');
        setCatalogSearch('');
        setBookingForm(EMPTY_BOOKING);
        setValidateResult(null);
        setDefaultItemDepartmentId('');
        setBranchCatalogRows([]);
        setBranchCatalogLoading(false);
        setBookingBranchOptions(null);
    };
    const fmtDate = (dt) => (dt ? String(dt).replace('T', ' ') + ':00' : '');

    useEffect(() => {
        if (!bookingOpen) return undefined;
        const ac = new AbortController();
        fetchCorporateBranches({ signal: ac.signal })
            .then((list) => {
                if (!ac.signal.aborted && Array.isArray(list)) setBookingBranchOptions(list);
            })
            .catch(() => {
                if (!ac.signal.aborted) setBookingBranchOptions([]);
            });
        return () => ac.abort();
    }, [bookingOpen]);

    useEffect(() => {
        const ids = bookingForm.department_ids.map(String);
        const idSet = new Set(ids);
        setDefaultItemDepartmentId((prev) => {
            if (ids.length === 0) return '';
            if (prev && idSet.has(String(prev))) return String(prev);
            return ids[0];
        });
        setBookingForm((f) => ({
            ...f,
            services: f.services.filter((s) => idSet.has(String(s.departmentId))),
            products: f.products.filter((p) => idSet.has(String(p.departmentId))),
        }));
    }, [bookingForm.department_ids]);

    useEffect(() => {
        if (!bookingOpen || bookingStep !== 1 || !bookingForm.branch_id || bookingForm.department_ids.length === 0) {
            setBranchCatalogRows([]);
            setBranchCatalogLoading(false);
            return undefined;
        }
        const ac = new AbortController();
        (async () => {
            setBranchCatalogLoading(true);
            try {
                const rows = await fetchCorporateBranchCatalogPickerRows(bookingForm.branch_id, {
                    departmentIds: bookingForm.department_ids.map(String),
                    signal: ac.signal,
                });
                if (!ac.signal.aborted) setBranchCatalogRows(rows);
            } catch (e) {
                if (e?.name === 'AbortError') return;
                if (!ac.signal.aborted) setBranchCatalogRows([]);
            } finally {
                if (!ac.signal.aborted) setBranchCatalogLoading(false);
            }
        })();
        return () => ac.abort();
    }, [bookingOpen, bookingStep, bookingForm.branch_id, bookingForm.department_ids]);

    const makePaymentServicesPayload = () =>
        bookingForm.services.map(({ serviceId, departmentId }) => ({
            serviceId: String(serviceId),
            departmentId: String(departmentId),
        }));

    const makePaymentProductsPayload = () =>
        bookingForm.products.map(({ productId, departmentId, qty }) => ({
            productId: String(productId),
            departmentId: String(departmentId),
            qty: Math.max(1, Math.floor(Number(qty) || 1)),
        }));
    const isWalletPayment = bookingForm.payment_method === 'Wallet';

    const handleAddCatalogRow = (row) => {
        const deptId = resolveDepartmentIdForCatalogRow(row, bookingForm.department_ids, defaultItemDepartmentId);
        if (!deptId) return;
        if (row.itemType === 'service') {
            const serviceId = String(row.id);
            setBookingForm((f) => {
                if (f.services.some((s) => s.serviceId === serviceId && s.departmentId === deptId)) return f;
                return { ...f, services: [...f.services, { serviceId, departmentId: deptId, name: row.name }] };
            });
        } else {
            const productId = String(row.id);
            setBookingForm((f) => {
                const idx = f.products.findIndex((p) => p.productId === productId && p.departmentId === deptId);
                if (idx >= 0) return f;
                return { ...f, products: [...f.products, { productId, departmentId: deptId, qty: 1, name: row.name }] };
            });
        }
    };

    const handleValidate = async () => {
        if (!bookingForm.vehicle_id || !bookingForm.branch_id || !bookingForm.booking_date || bookingForm.department_ids.length === 0) return;
        setBookingLoading(true); setBookingError('');
        try {
            await apiFetch(`/corporate/branches/${bookingForm.branch_id}`, { method: 'POST' }).catch(() => {});
            /** PlaceOrderDto — validate only; services/products belong on `make_payment`. */
            const result = await apiFetch('/corporate/order', {
                method: 'POST',
                body: JSON.stringify({
                    branchId: String(bookingForm.branch_id),
                    vehicleId: String(bookingForm.vehicle_id),
                    departmentIds: bookingForm.department_ids.map(String),
                    bookedFor: fmtDate(bookingForm.booking_date),
                    payFromWallet: isWalletPayment,
                    notes: bookingForm.notes?.trim() ? bookingForm.notes.trim() : undefined,
                    services: makePaymentServicesPayload(),
                    products: makePaymentProductsPayload(),
                }),
            });
            setValidateResult(result);
            setBookingStep(2);
        } catch (err) {
            setBookingError(err.message || 'Validation failed');
        } finally {
            setBookingLoading(false);
        }
    };

    const handleConfirmBooking = async () => {
        setBookingLoading(true); setBookingError('');
        try {
            const body = {
                branchId: String(bookingForm.branch_id),
                departmentIds: bookingForm.department_ids.map(String),
                bookedFor: fmtDate(bookingForm.booking_date),
                payFromWallet: isWalletPayment,
                notes: bookingForm.notes?.trim() ? bookingForm.notes.trim() : undefined,
                paymentMethod: bookingForm.payment_method,
                partialWalletPayment: false,
                saveAsDraft: false,
                services: makePaymentServicesPayload(),
                products: makePaymentProductsPayload(),
            };
            if (bookingForm.vehicle_id) body.vehicleId = String(bookingForm.vehicle_id);
            await apiFetch('/corporate/bookings', { method: 'POST', body: JSON.stringify(body) });
            if (isWalletPayment) refreshWalletBalance();
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new Event('corporate-portal-bookings-refresh'));
                window.dispatchEvent(new Event('corporate-portal-dashboard-refresh'));
            }
            setBookingOpen(false);
            resetBooking();
        } catch (err) {
            setBookingError(err.message || 'Booking failed');
        } finally {
            setBookingLoading(false);
        }
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'platform-chat': return null;
            case 'dashboard': return <CorporateDashboard onTabChange={setActiveTab} setBookingOpen={setBookingOpen} setQuoteOpen={setQuoteOpen}/>;
            case 'profile': return <CorporateProfile onTabChange={setActiveTab}/>;
            case 'vehicles': return <CorporateVehicles vehicles={vehicles} setVehicles={setVehicles}/>;
            case 'bookings': return <CorporateBookings setBookingOpen={setBookingOpen} onTabChange={setActiveTab}/>;
            case 'booking-approvals': return <CorporateBookingApprovals />;
            case 'quotations': return <CorporateQuotations setQuoteOpen={setQuoteOpen}/>;
            case 'billing': return <MonthlyBilling onTabChange={setActiveTab} onWalletBalanceChange={refreshWalletBalance} />;
            case 'wallet': return <CorporateWallet onWalletBalanceChange={refreshWalletBalance} />;
            case 'reports': return <CorporateReports walletBalance={walletBalance}/>;
            default: return <CorporateDashboard onTabChange={setActiveTab} setBookingOpen={setBookingOpen} setQuoteOpen={setQuoteOpen}/>;
        }
    };

    const currentLabel = NAV_GROUPS.flatMap(g => g.items).find(i => i.id === activeTab)?.label || 'Dashboard';

    if (activeTab === 'platform-chat') {
        return (
            <div className="portal-layout--chat-fullscreen">
                <CorporatePlatformChatPage />
            </div>
        );
    }

    return (
        <div className="workshop-layout">
            <aside className="ws-sidebar">
                <div className="ws-logo"><div className="ws-logo-icon"><Building2 size={20}/></div><div><p className="ws-logo-title">Filter Corporate</p><p className="ws-logo-sub">Portal</p></div></div>
                <div style={{padding:'10px 14px',margin:'10px 12px',background:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.25)',borderRadius:10,fontSize:'0.75rem',fontWeight:700,color:'#111111',display:'flex',alignItems:'center',gap:8}}>
                    <Wallet size={14}/> Wallet: SAR {Number(walletBalance).toLocaleString()}
                </div>
                <nav className="ws-nav">
                    {NAV_GROUPS.map(grp => (
                        <div key={grp.label}>
                            <div style={{fontSize:'0.625rem',fontWeight:800,color:'rgba(255,255,255,0.28)',padding:'14px 14px 6px',textTransform:'uppercase',letterSpacing:'0.14em'}}>{grp.label}</div>
                            {grp.items.map(item => (
                                <button key={item.id} className={`ws-nav-btn ${activeTab===item.id?'active':''}`} onClick={() => setActiveTab(item.id)}>
                                    <item.icon size={17}/>
                                    <span>{item.label}</span>
                                    {isPlatformChatNavId(item.id) && <PlatformChatNavBadge />}
                                </button>
                            ))}
                        </div>
                    ))}
                </nav>
                <div className="ws-user-footer">
                    <div className="ws-user-info">
                        <div className="ws-user-avatar">
                            {user?.name?.charAt(0) || 'C'}
                        </div>
                        <div>
                            <p className="ws-user-name">{user?.name || 'Corporate Admin'}</p>
                            <p className="ws-user-role">{user?.corporateAccount?.companyName || 'Corporate Portal'}</p>
                        </div>
                    </div>
                    <button className="ws-logout-btn" onClick={() => {
                        logout();
                        navigate('/');
                    }}>
                        <LogOut size={16}/>
                    </button>
                </div>
            </aside>
            <div className="ws-main">
                <header className="ws-topbar"><div><p className="ws-topbar-title">{currentLabel}</p><p className="ws-topbar-sub">Corporate Client Portal</p></div>
                    <div className="ws-topbar-right">
                        <button className="btn-portal" onClick={() => setBookingOpen(true)}><Calendar size={14}/> New Booking</button>
                        <button className="btn-portal" onClick={() => setQuoteOpen(true)}><Tag size={14}/> Quotation</button>
                    </div>
                </header>
                <main className="ws-content">{renderContent()}</main>
            </div>

            <AnimatePresence>
                {bookingOpen && (() => {
                    const selV = vehicles.find(x => String(x.id) === String(bookingForm.vehicle_id));
                    const branchChoicesForBooking =
                        bookingBranchOptions != null && bookingBranchOptions.length > 0 ? bookingBranchOptions : branches;
                    const selB = branchChoicesForBooking.find((x) => String(x.id) === String(bookingForm.branch_id));
                    const selDepts = bookingForm.department_ids.map(did => departments.find(d => d.id === did)?.name).filter(Boolean).join(', ');
                    const step1Valid = bookingForm.vehicle_id && bookingForm.branch_id && bookingForm.booking_date && bookingForm.department_ids.length > 0;
                    const branchDeptFilter = new Set(bookingForm.department_ids.map(String));
                    const visibleBranchCatalogRows = branchCatalogRows.filter(
                        (r) => !r.departmentId || branchDeptFilter.has(String(r.departmentId)),
                    );
                    const q = String(catalogSearch || '').trim().toLowerCase();
                    const filteredBranchCatalogRows = !q
                        ? []
                        : visibleBranchCatalogRows.filter((r) =>
                              [
                                  r.name,
                                  r.departmentName,
                                  r.itemType,
                                  r.sku,
                                  r.brandName,
                                  r.code,
                              ]
                                  .filter(Boolean)
                                  .some((v) => String(v).toLowerCase().includes(q)),
                          );
                    const isRowAdded = (row) => {
                        const deptId = resolveDepartmentIdForCatalogRow(
                            row,
                            bookingForm.department_ids,
                            defaultItemDepartmentId,
                        );
                        if (!deptId) return false;
                        if (row.itemType === 'service') {
                            return bookingForm.services.some(
                                (s) => s.serviceId === String(row.id) && s.departmentId === String(deptId),
                            );
                        }
                        return bookingForm.products.some(
                            (p) => p.productId === String(row.id) && p.departmentId === String(deptId),
                        );
                    };
                    const getAddedProductQty = (row) => {
                        const deptId = resolveDepartmentIdForCatalogRow(
                            row,
                            bookingForm.department_ids,
                            defaultItemDepartmentId,
                        );
                        if (!deptId || row.itemType !== 'product') return null;
                        const found = bookingForm.products.find(
                            (p) => p.productId === String(row.id) && p.departmentId === String(deptId),
                        );
                        return found ? Math.max(1, Math.floor(Number(found.qty) || 1)) : null;
                    };
                    const setProductQtyFromSearch = (row, qty) => {
                        const deptId = resolveDepartmentIdForCatalogRow(
                            row,
                            bookingForm.department_ids,
                            defaultItemDepartmentId,
                        );
                        if (!deptId || row.itemType !== 'product') return;
                        const productId = String(row.id);
                        const nextQty = Math.max(1, Math.floor(Number(qty) || 1));
                        setBookingForm((f) => ({
                            ...f,
                            products: f.products.map((p) =>
                                p.productId === productId && p.departmentId === String(deptId)
                                    ? { ...p, qty: nextQty }
                                    : p,
                            ),
                        }));
                    };
                    return (
                        <Modal
                            title={bookingStep === 1 ? 'Book Service Appointment' : 'Review & Confirm'}
                            onClose={() => { setBookingOpen(false); resetBooking(); }}
                            footer={
                                <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
                                    {bookingStep === 1 ? (
                                        <>
                                            <button className="btn-portal-outline" onClick={() => { setBookingOpen(false); resetBooking(); }}>Cancel</button>
                                            <button className="btn-portal" style={{background:'#059669',color:'#fff',border:'none'}} disabled={!step1Valid || bookingLoading} onClick={handleValidate}>{bookingLoading ? 'Validating…' : 'Next: Review'}</button>
                                        </>
                                    ) : (
                                        <>
                                            <button className="btn-portal-outline" onClick={() => { setBookingStep(1); setBookingError(''); }}>Back</button>
                                            <button className="btn-portal" style={{background:'#059669',color:'#fff',border:'none'}} disabled={bookingLoading || (isWalletPayment && walletBalance < reviewEstimatedTotalSar && reviewEstimatedTotalSar > 0)} onClick={handleConfirmBooking}>{bookingLoading ? 'Processing…' : 'Confirm Booking'}</button>
                                        </>
                                    )}
                                </div>
                            }
                            width="500px"
                        >
                            {bookingStep === 1 ? (
                                <div style={{display:'flex',flexDirection:'column',gap:14}}>
                                    <div className="ws-field"><label>Vehicle *</label><select value={bookingForm.vehicle_id} onChange={e=>setBook('vehicle_id',e.target.value)} style={{width:'100%',padding:'10px 12px',borderRadius:9,border:'1px solid var(--color-border)'}}><option value="">Select vehicle</option>{vehicles.map(v=><option key={v.id} value={v.id}>{v.plateNo} – {v.make} {v.model}</option>)}</select></div>
                                    <div className="ws-field"><label>Branch *</label><select value={bookingForm.branch_id} onChange={e=>{ setCatalogSearch(''); setBookingForm(f=>({...f,branch_id:e.target.value,department_ids:[],services:[],products:[]})); }} style={{width:'100%',padding:'10px 12px',borderRadius:9,border:'1px solid var(--color-border)'}}><option value="">Select branch</option>{branchChoicesForBooking.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
                                    <div><label style={{display:'block',marginBottom:6,fontWeight:600}}>Departments (Services) * <span style={{fontWeight:400,color:'var(--color-text-muted)',fontSize:'0.75rem'}}>— select one or more</span></label>
                                        <div style={{border:'1px solid var(--color-border)',borderRadius:10,maxHeight:140,overflowY:'auto'}}>
                                            {!bookingForm.branch_id ? <p style={{margin:0,padding:'12px 14px',fontSize:'0.8rem',color:'var(--color-text-muted)'}}>Select a branch first</p>
                                            : depsLoading ? <p style={{margin:0,padding:'12px 14px',fontSize:'0.8rem',color:'var(--color-text-muted)'}}>Loading…</p>
                                            : departments.length === 0 ? <p style={{margin:0,padding:'12px 14px',fontSize:'0.8rem',color:'var(--color-text-muted)'}}>No departments available</p>
                                            : departments.map(d => (
                                                <label key={d.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',cursor:'pointer',borderBottom:'1px solid var(--color-border-light)'}}>
                                                    <input type="checkbox" checked={bookingForm.department_ids.includes(d.id)} onChange={() => toggleDept(d.id)} style={{accentColor:'#059669'}}/>
                                                    <span style={{fontSize:'0.875rem'}}>{d.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                        {bookingForm.department_ids.length > 0 && <p style={{fontSize:'0.75rem',color:'#059669',marginTop:4}}>{bookingForm.department_ids.length} department(s) selected</p>}
                                    </div>
                                    {bookingForm.department_ids.length > 0 && (
                                        <div style={{ border: '1px solid var(--color-border)', borderRadius: 12, padding: 12, background: 'var(--color-bg-muted)' }}>
                                            <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: '0.875rem' }}>Products &amp; services (optional)</label>
                                            <p style={{ margin: '0 0 10px 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                                Only items available on this branch for the departments you selected (from the workshop catalog — not the global master list). Search and click Add. If an item is already selected, it shows Added.
                                            </p>
                                            <div className="ws-field" style={{ marginBottom: 10 }}>
                                                <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Search products/services</label>
                                                <input
                                                    type="text"
                                                    value={catalogSearch}
                                                    onChange={(e) => setCatalogSearch(e.target.value)}
                                                    placeholder="Search by name, department, type..."
                                                    style={{ width: '100%', padding: '8px 10px', borderRadius: 9, border: '1px solid var(--color-border)', fontSize: '0.875rem' }}
                                                />
                                            </div>
                                            {bookingForm.department_ids.length > 1 && (
                                                <div className="ws-field" style={{ marginBottom: 10 }}>
                                                    <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Assign new lines to department</label>
                                                    <select
                                                        value={defaultItemDepartmentId}
                                                        onChange={(e) => setDefaultItemDepartmentId(e.target.value)}
                                                        style={{ width: '100%', padding: '8px 10px', borderRadius: 9, border: '1px solid var(--color-border)', fontSize: '0.875rem' }}
                                                    >
                                                        {bookingForm.department_ids.map((did) => (
                                                            <option key={did} value={String(did)}>
                                                                {departments.find((d) => String(d.id) === String(did))?.name || `Department ${did}`}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}
                                            <div style={{ marginBottom: 4 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-dark)' }}>On this branch</span>
                                                    {branchCatalogLoading && (
                                                        <Loader2 size={16} className="spin" style={{ color: 'var(--color-text-muted)' }} />
                                                    )}
                                                </div>
                                                <div
                                                    style={{
                                                        maxHeight: 200,
                                                        overflowY: 'auto',
                                                        border: '1px solid var(--color-border)',
                                                        borderRadius: 10,
                                                        background: '#fff',
                                                    }}
                                                >
                                                    {branchCatalogLoading ? (
                                                        <p style={{ margin: 0, padding: '10px 12px', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                                                            Loading branch catalog…
                                                        </p>
                                                    ) : filteredBranchCatalogRows.length === 0 ? (
                                                        <p style={{ margin: 0, padding: '10px 12px', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                                                            {q
                                                                ? 'No matching products/services found.'
                                                                : 'Search to find products/services from this branch catalog.'}
                                                        </p>
                                                    ) : (
                                                        filteredBranchCatalogRows.map((row) => {
                                                            const added = isRowAdded(row);
                                                            const addedQty = getAddedProductQty(row);
                                                            const isProduct = row.itemType === 'product';
                                                            return (
                                                            <div
                                                                key={`br-${row.itemType}-${row.id}-${row.departmentId || 'na'}`}
                                                                style={{
                                                                    width: '100%',
                                                                    textAlign: 'left',
                                                                    padding: '8px 12px',
                                                                    borderBottom: '1px solid var(--color-border-light)',
                                                                    background: '#fff',
                                                                    opacity: added ? 0.9 : 1,
                                                                    fontSize: '0.8125rem',
                                                                    display: 'flex',
                                                                    justifyContent: 'space-between',
                                                                    gap: 8,
                                                                    alignItems: 'center',
                                                                }}
                                                            >
                                                                <span style={{ minWidth: 0 }}>
                                                                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' }}>
                                                                        {row.itemType}
                                                                    </span>{' '}
                                                                    {row.name}
                                                                    {row.departmentName ? (
                                                                        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem' }}> · {row.departmentName}</span>
                                                                    ) : null}
                                                                </span>
                                                                <span style={{ flexShrink: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                                                    <span>SAR {Number(row.salePrice || 0).toFixed(2)}</span>
                                                                    {added && (
                                                                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#047857', background: '#D1FAE5', borderRadius: 999, padding: '2px 8px' }}>
                                                                            Added{addedQty != null ? ` (Qty ${addedQty})` : ''}
                                                                        </span>
                                                                    )}
                                                                    {isProduct && added ? (
                                                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                                            <button
                                                                                type="button"
                                                                                className="btn-portal-outline"
                                                                                style={{ padding: '2px 6px', fontSize: '0.75rem' }}
                                                                                onClick={() => setProductQtyFromSearch(row, (addedQty || 1) - 1)}
                                                                            >
                                                                                -
                                                                            </button>
                                                                            <input
                                                                                type="number"
                                                                                min={1}
                                                                                value={addedQty || 1}
                                                                                onChange={(e) => setProductQtyFromSearch(row, e.target.value)}
                                                                                style={{ width: 52, padding: '2px 6px', borderRadius: 6, border: '1px solid var(--color-border)' }}
                                                                            />
                                                                            <button
                                                                                type="button"
                                                                                className="btn-portal-outline"
                                                                                style={{ padding: '2px 6px', fontSize: '0.75rem' }}
                                                                                onClick={() => setProductQtyFromSearch(row, (addedQty || 1) + 1)}
                                                                            >
                                                                                +
                                                                            </button>
                                                                        </span>
                                                                    ) : (
                                                                        <button
                                                                            type="button"
                                                                            className="btn-portal-outline"
                                                                            style={{ padding: '2px 8px', fontSize: '0.7rem' }}
                                                                            onClick={() => !added && handleAddCatalogRow(row)}
                                                                            disabled={added}
                                                                        >
                                                                            {added ? 'Added' : 'Add'}
                                                                        </button>
                                                                    )}
                                                                </span>
                                                            </div>
                                                            );
                                                        })
                                                    )}
                                                </div>
                                            </div>
                                            {(bookingForm.services.length > 0 || bookingForm.products.length > 0) && (
                                                <div style={{ marginTop: 12 }}>
                                                    <p style={{ margin: '0 0 6px 0', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-dark)' }}>Selected</p>
                                                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.8125rem' }}>
                                                        {bookingForm.services.map((s, i) => (
                                                            <li key={`svc-${s.serviceId}-${s.departmentId}-${i}`} style={{ marginBottom: 6 }}>
                                                                <span>
                                                                    Service: {s.name}{' '}
                                                                    <span style={{ color: 'var(--color-text-muted)' }}>
                                                                        (dept {departments.find((d) => String(d.id) === String(s.departmentId))?.name || s.departmentId})
                                                                    </span>
                                                                </span>{' '}
                                                                <button
                                                                    type="button"
                                                                    className="btn-portal-outline"
                                                                    style={{ padding: '2px 8px', fontSize: '0.7rem', marginLeft: 6 }}
                                                                    onClick={() =>
                                                                        setBookingForm((f) => ({
                                                                            ...f,
                                                                            services: f.services.filter((_, j) => j !== i),
                                                                        }))
                                                                    }
                                                                >
                                                                    Remove
                                                                </button>
                                                            </li>
                                                        ))}
                                                        {bookingForm.products.map((p, i) => (
                                                            <li key={`prd-${p.productId}-${p.departmentId}-${i}`} style={{ marginBottom: 6, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                                                                <span>
                                                                    Product: {p.name}{' '}
                                                                    <span style={{ color: 'var(--color-text-muted)' }}>
                                                                        (dept {departments.find((d) => String(d.id) === String(p.departmentId))?.name || p.departmentId})
                                                                    </span>
                                                                </span>
                                                                <label style={{ fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                                    Qty
                                                                    <input
                                                                        type="number"
                                                                        min={1}
                                                                        value={p.qty}
                                                                        onChange={(e) => {
                                                                            const q = Math.max(1, Math.floor(Number(e.target.value) || 1));
                                                                            setBookingForm((f) => ({
                                                                                ...f,
                                                                                products: f.products.map((x, j) => (j === i ? { ...x, qty: q } : x)),
                                                                            }));
                                                                        }}
                                                                        style={{ width: 52, padding: '4px 6px', borderRadius: 6, border: '1px solid var(--color-border)' }}
                                                                    />
                                                                </label>
                                                                <button
                                                                    type="button"
                                                                    className="btn-portal-outline"
                                                                    style={{ padding: '2px 8px', fontSize: '0.7rem' }}
                                                                    onClick={() =>
                                                                        setBookingForm((f) => ({
                                                                            ...f,
                                                                            products: f.products.filter((_, j) => j !== i),
                                                                        }))
                                                                    }
                                                                >
                                                                    Remove
                                                                </button>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <div className="ws-field"><label>Date & Time *</label><input type="datetime-local" value={bookingForm.booking_date} onChange={e=>setBook('booking_date',e.target.value)} style={{width:'100%',padding:'10px 12px',borderRadius:9,border:'1px solid var(--color-border)'}}/></div>
                                    <div className="ws-field"><label>Notes</label><textarea value={bookingForm.notes} onChange={e=>setBook('notes',e.target.value)} rows={2} placeholder="Any special requirements…" style={{width:'100%',padding:'10px 12px',borderRadius:9,border:'1px solid var(--color-border)',resize:'vertical'}}/></div>
                                    <div style={{padding:14,borderRadius:14,background:'#FAF5FF',border:'1px solid #EDE9FE'}}>
                                        <div className="ws-field" style={{marginBottom:8}}>
                                            <label style={{color:'#6D28D9'}}>Payment Method *</label>
                                            <select
                                                value={bookingForm.payment_method}
                                                onChange={(e) => setBook('payment_method', e.target.value)}
                                                style={{width:'100%',padding:'10px 12px',borderRadius:9,border:'1px solid var(--color-border)'}}
                                            >
                                                {PAYMENT_METHOD_OPTIONS.map((m) => (
                                                    <option key={m} value={m}>{m}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <p style={{fontSize:'0.75rem',color:'#7C3AED',margin:0}}>
                                            Wallet Balance: SAR {Number(walletBalance).toLocaleString()}
                                        </p>
                                    </div>
                                    {bookingError && <p style={{margin:0,padding:'10px 14px',background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:9,fontSize:'0.8rem',color:'#DC2626'}}>{bookingError}</p>}
                                </div>
                            ) : (() => {
                                const orderTotal = reviewEstimatedTotalSar;
                                const insufficientBalance = isWalletPayment && walletBalance < orderTotal && orderTotal > 0;
                                return (
                                <div style={{display:'flex',flexDirection:'column',gap:14}}>
                                    <div style={{padding:16,background:'#F0FDF4',border:'1px solid #BBF7D0',borderRadius:12,display:'flex',flexDirection:'column',gap:8}}>
                                        <p style={{fontWeight:700,color:'#065F46',margin:'0 0 4px 0',fontSize:'0.9rem'}}>Booking Summary</p>
                                        {[
                                            ['Vehicle', selV ? `${selV.plateNo} — ${selV.make} ${selV.model}` : '—'],
                                            ['Branch', selB?.name || '—'],
                                            ['Departments', selDepts || '—'],
                                            [
                                                'Line services',
                                                bookingForm.services.length
                                                    ? bookingForm.services
                                                          .map(
                                                              (s) =>
                                                                  `${s.name} (${departments.find((d) => String(d.id) === String(s.departmentId))?.name || s.departmentId})`,
                                                          )
                                                          .join(' · ')
                                                    : '—',
                                            ],
                                            [
                                                'Line products',
                                                bookingForm.products.length
                                                    ? bookingForm.products
                                                          .map(
                                                              (p) =>
                                                                  `${p.name} ×${p.qty} (${departments.find((d) => String(d.id) === String(p.departmentId))?.name || p.departmentId})`,
                                                          )
                                                          .join(' · ')
                                                    : '—',
                                            ],
                                            ['Date', bookingForm.booking_date?.replace('T', ' ') || '—'],
                                            ['Payment', bookingForm.payment_method || 'Cash'],
                                        ].map(([k, val]) => (
                                            <div key={k} style={{display:'flex',gap:8,fontSize:'0.8rem'}}><span style={{color:'var(--color-text-muted)',minWidth:70}}>{k}:</span><span style={{fontWeight:600}}>{val}</span></div>
                                        ))}
                                        {bookingForm.notes && <div style={{display:'flex',gap:8,fontSize:'0.8rem'}}><span style={{color:'var(--color-text-muted)',minWidth:70}}>Notes:</span><span>{bookingForm.notes}</span></div>}
                                    </div>

                                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',background:'var(--color-bg-muted)',borderRadius:10}}>
                                        <span style={{fontSize:'0.85rem',color:'var(--color-text-muted)',fontWeight:600}}>Estimated Total</span>
                                        <span style={{fontWeight:800,fontSize:'1.0625rem',color:'var(--color-text-dark)'}}>
                                            SAR {orderTotal.toFixed(2)}
                                        </span>
                                    </div>

                                    {isWalletPayment && (
                                        <div style={{padding:'10px 14px',borderRadius:9,background: insufficientBalance ? '#FEF2F2' : '#F0FDF4', border:`1px solid ${insufficientBalance ? '#FECACA' : '#BBF7D0'}`,fontSize:'0.8rem'}}>
                                            <div style={{display:'flex',justifyContent:'space-between'}}>
                                                <span style={{color:'var(--color-text-muted)'}}>Wallet Balance</span>
                                                <span style={{fontWeight:700,color: insufficientBalance ? '#DC2626' : '#16A34A'}}>SAR {Number(walletBalance).toLocaleString()}</span>
                                            </div>
                                            {insufficientBalance && <p style={{margin:'4px 0 0 0',color:'#DC2626',fontWeight:600}}>⚠ Insufficient balance — please top up your wallet</p>}
                                        </div>
                                    )}

                                    {bookingError && <p style={{margin:0,padding:'10px 14px',background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:9,fontSize:'0.8rem',color:'#DC2626'}}>{bookingError}</p>}
                                    <p style={{padding:12,background:'#EFF6FF',borderRadius:10,fontSize:'0.75rem',color:'#1D4ED8',margin:0}}>📲 Booking will be sent to workshop for confirmation. Status: Pending Approval</p>
                                </div>
                                );
                            })()}
                        </Modal>
                    );
                })()}
                {quoteOpen && (
                    <QuotationModal
                        walletBalance={walletBalance}
                        onClose={() => setQuoteOpen(false)}
                        onSave={() => setQuoteOpen(false)}
                    />
                )}
            </AnimatePresence>
            <PlatformChatFab
                hidden={activeTab === 'platform-chat'}
                onClick={() => setActiveTab('platform-chat')}
            />
        </div>
    );
}
