import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, ChevronRight, Loader, Eye, EyeOff, LayoutGrid } from 'lucide-react';
import '../styles/SignInPage.css';
import {
    adminLogin,
    corporateLogin,
    workshopLogin,
    cashierLogin,
    supplierLogin,
    technicianLogin,
    marketingLogin,
} from '../services/authApi';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../services/api';
import { firstVisibleAdminPath, workshopLandingPath } from '../utils/permissions';

/**
 * Unified sign-in hub.
 *
 * One login form for every portal — the user picks a destination from the
 * dropdown and the form dispatches to the matching login API, then routes to
 * that portal's landing page. Mirrors the per-portal logic that still lives in
 * PortalLoginPage / SignInPage (those remain the `redirectTo` targets used by
 * ProtectedRoute), so behaviour stays consistent whichever entry point is used.
 */
const PORTAL_OPTIONS = [
    { id: 'admin', name: 'Filter ERP · Super Admin' },
    { id: 'workshop', name: 'Filter Admin Workshop Portal' },
    { id: 'pos', name: 'Filter POS Portal' },
    { id: 'corporate', name: 'Filter Corporate Portal' },
    { id: 'technician', name: 'Filter Technician Portal' },
    { id: 'locker', name: 'Filter Locker Portal' },
    { id: 'supplier', name: 'Filter Supplier Portal' },
    { id: 'marketing', name: 'Filter Marketing Portal' },
    { id: 'referrer-portal', name: 'Filter Referrer Portal' },
];

// Default userType assumed when the login response omits one (mirrors PortalLoginPage).
const PORTAL_USER_TYPES = {
    admin: 'admin',
    corporate: 'corporate_user',
    workshop: 'workshop_owner',
    pos: 'cashier_user',
    technician: 'technician_user',
    locker: 'workshop_user',
    supplier: 'supplier_user',
    marketing: 'marketing_user',
    'referrer-portal': 'referrer_user',
};

// Landing path after a successful login. `admin` resolves dynamically to the
// first sidebar page the user can view.
const PORTAL_LANDING = {
    workshop: '/workshop',
    pos: '/pos',
    corporate: '/corporate',
    technician: '/technician',
    locker: '/locker',
    supplier: '/supplier',
    marketing: '/marketing/dashboard',
    'referrer-portal': '/referrer-portal',
};

export default function PortalHubPage() {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [portalId, setPortalId] = useState('workshop');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const portalName =
        PORTAL_OPTIONS.find((p) => p.id === portalId)?.name || 'Portal';

    const loginFor = (portal, mail, pass) => {
        switch (portal) {
            case 'corporate':
                return corporateLogin(mail, pass);
            case 'pos':
                return cashierLogin(mail, pass);
            case 'workshop':
            case 'locker':
                // Locker users are workshop_user rows; reuse the workshop login endpoint.
                return workshopLogin(mail, pass);
            case 'technician':
                return technicianLogin(mail, pass);
            case 'supplier':
                return supplierLogin(mail, pass);
            case 'marketing':
                return marketingLogin(mail, pass);
            default:
                // admin + referrer-portal fall back to the admin endpoint.
                return adminLogin(mail, pass);
        }
    };

    const handleSignIn = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        // DEMO LOGIN BYPASS — same credentials accepted by the per-portal pages.
        if (email.toLowerCase() === 'demo@filtercars.com' && password === 'password123') {
            const demoUser = {
                id: 'demo-id-' + portalId,
                name: 'Demo ' + portalName.split(' ')[0],
                email: 'demo@filtercars.com',
                userType: PORTAL_USER_TYPES[portalId] || 'admin',
                isDemo: true,
            };
            const demoToken = 'demo-token-' + Date.now();
            setTimeout(() => {
                login(demoUser, demoToken);
                navigate(
                    portalId === 'admin'
                        ? firstVisibleAdminPath(demoUser)
                        : portalId === 'workshop'
                          ? workshopLandingPath(demoUser)
                          : PORTAL_LANDING[portalId] || `/${portalId}`,
                    { replace: true },
                );
                setLoading(false);
            }, 600);
            return;
        }

        try {
            const data = await loginFor(portalId, email, password);
            if (!data || !data.token) {
                throw new Error('Invalid response from server.');
            }

            const userData = data.user || data;
            const userToken = data.token;
            const effectiveUserType =
                userData.userType ||
                userData.type ||
                PORTAL_USER_TYPES[portalId] ||
                'admin';

            // Locker portal needs a supervisor/collector role (or workshop owner).
            if (portalId === 'locker') {
                const role = userData.lockerPortalRole;
                const isOwner = effectiveUserType === 'workshop_owner';
                if (!isOwner && role !== 'supervisor' && role !== 'collector') {
                    throw new Error(
                        'This account does not have locker portal access. Ask your workshop admin to create a locker user.',
                    );
                }
            }

            const workshopMeta = data.workshop || userData.workshop || null;

            login(
                { ...userData, userType: effectiveUserType },
                userToken,
                { workshop: workshopMeta },
            );

            if (portalId === 'pos') {
                apiFetch('/cashier/session/open', { method: 'POST' }).catch(() => {});
            }

            const sessionUser = { ...userData, userType: effectiveUserType };
            navigate(
                portalId === 'admin'
                    ? firstVisibleAdminPath(sessionUser)
                    : portalId === 'workshop'
                      ? workshopLandingPath(sessionUser)
                      : PORTAL_LANDING[portalId] || `/${portalId}`,
                { replace: true },
            );
        } catch (err) {
            console.error('Login error:', err);
            setError(err.message || 'Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="signin-container">
            {/* Left Side: Branding */}
            <div className="signin-branding">
                <motion.div
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8 }}
                >
                    <h1 className="brand-main-title">
                        FILTER <span>HUB</span>
                    </h1>
                    <p className="brand-subtitle">
                        One secure entry point for the Filter Services management ecosystem.
                        Choose your portal and sign in.
                    </p>

                    <div className="brand-stats" style={{ marginTop: '36px' }}>
                        <div className="stat-item"><h4>250+</h4><p>Global Hubs</p></div>
                        <div className="stat-item"><h4>1M+</h4><p>Services</p></div>
                        <div className="stat-item"><h4>99.9%</h4><p>Uptime</p></div>
                    </div>
                </motion.div>
            </div>

            {/* Right Side: Form */}
            <div className="signin-form-wrapper">
                <motion.div
                    className="signin-card"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                >
                    <div className="signin-header">
                        <h2>Welcome to Filter</h2>
                        <p>Select your portal and enter your credentials</p>
                    </div>

                    {error && <div className="error-message">{error}</div>}

                    <form onSubmit={handleSignIn}>
                        <div className="form-group" style={{ marginBottom: '16px' }}>
                            <label htmlFor="portal">Portal</label>
                            <div className="input-wrapper">
                                <LayoutGrid size={18} />
                                <select
                                    id="portal"
                                    className="signin-input"
                                    value={portalId}
                                    onChange={(e) => { setPortalId(e.target.value); setError(''); }}
                                    style={{ appearance: 'auto', cursor: 'pointer' }}
                                >
                                    {PORTAL_OPTIONS.map((p) => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: '26px' }}>
                            <label htmlFor="email">Email Address</label>
                            <div className="input-wrapper">
                                <Mail size={18} />
                                <input
                                    type="email"
                                    id="email"
                                    className="signin-input"
                                    placeholder="name@filtercars.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: '26px' }}>
                            <label htmlFor="password">Password</label>
                            <div className="input-wrapper" style={{ position: 'relative' }}>
                                <Lock size={18} />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    id="password"
                                    className="signin-input"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    style={{ paddingRight: 36 }}
                                />
                                <button
                                    type="button"
                                    className="password-toggle-btn"
                                    onClick={() => setShowPassword((v) => !v)}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    title={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <div className="form-options">
                            <label className="remember-me">
                                <input type="checkbox" />
                                Remember me
                            </label>
                            <a href="#" className="forgot-password">Forgot Password?</a>
                        </div>

                        <button type="submit" className="btn-signin" disabled={loading}>
                            {loading ? <Loader size={18} className="spin" /> : <><span>SIGN IN NOW</span> <ChevronRight size={18} /></>}
                        </button>
                    </form>

                    <div style={{ marginTop: '28px', textAlign: 'center' }}>
                        <p style={{ fontSize: '0.8125rem', color: '#666' }}>
                            Need technical support? <a href="#" style={{ color: '#000', fontWeight: '700' }}>Contact IT Hub</a>
                        </p>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
