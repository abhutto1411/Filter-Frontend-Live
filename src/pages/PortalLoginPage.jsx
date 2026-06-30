import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, ChevronRight, Loader } from 'lucide-react';
import '../styles/SignInPage.css';
import { adminLogin, corporateLogin, workshopLogin, cashierLogin, supplierLogin, technicianLogin, marketingLogin } from '../services/authApi';
import { workshopLandingPath } from '../utils/permissions';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../services/api';


const PORTAL_NAMES = {
    'locker': 'Filter Locker Portal',
    'workshop': 'Filter Admin Workshop Portal',
    'pos': 'Filter POS Portal',
    'technician': 'Filter Technician Portal',
    'corporate': 'Filter Corporate Portal',
    'supplier': 'Filter Supplier Portal',
    'referrer-portal': 'Filter Referrer Portal',
    'marketing': 'Filter Marketing Portal',
    'referral-management': 'Filter Referral Management Portal',
};

const PORTAL_SIGNUP_ALLOWED = new Set(['corporate', 'supplier', 'workshop']);

const PORTAL_USER_TYPES = {
    'corporate': 'corporate_user',
    'admin': 'admin',
    'workshop': 'workshop_owner',
    'pos': 'cashier_user',
    'technician': 'technician_user',
    // Locker users are workshop_user rows with `lockerPortalRole=supervisor|collector`.
    'locker': 'workshop_user',
    'supplier': 'supplier_user',
    'marketing': 'marketing_user',
    'referral-management': 'referral_user',
    'referrer-portal': 'referrer_user',
};

const PortalLoginPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { portalId: portalIdParam } = useParams();
    const portalId = portalIdParam || location.pathname.split('/').filter(Boolean)[0];
    const { logout, login, user, isAuthenticated } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [loading, setLoading] = useState(false);

    const portalName = PORTAL_NAMES[portalId] || 'Portal';
    const normalizeUserType = (value) => String(value || '').trim().toLowerCase();

    const hasPortalRoleAccess = (portal, currentType, authUser = null) => {
        const normalizedType = normalizeUserType(currentType);
        if (portal === 'workshop') {
            return normalizedType === 'workshop_owner' || normalizedType === 'workshop_user';
        }
        if (portal === 'technician') {
            if (normalizedType === normalizeUserType(PORTAL_USER_TYPES.technician)) return true;
            if (normalizedType === 'workshop_user' && authUser?.technician) return true;
            return false;
        }
        if (portal === 'locker') {
            // Locker portal accepts any workshop user whose lockerPortalRole is set
            // (collector or supervisor). Workshop owners are also welcome.
            const role = authUser?.lockerPortalRole;
            if (normalizedType === 'workshop_owner') return true;
            if (normalizedType === 'workshop_user' && (role === 'supervisor' || role === 'collector')) {
                return true;
            }
            return false;
        }
        if (portal === 'marketing') {
            if (normalizedType === 'marketing_user') return true;
            if (normalizedType === 'platform_admin') return true;
            return false;
        }
        return normalizedType === normalizeUserType(PORTAL_USER_TYPES[portal]);
    };

    // Handle force logout
    useEffect(() => {
        if (location.state?.forceLogout) {
            logout();
            // Clear the forceLogout flag so it doesn't block the redirect after login
            navigate(location.pathname, { 
                replace: true, 
                state: { ...location.state, forceLogout: false } 
            });
        }
    }, [location.state, logout, navigate, location.pathname]);

    useEffect(() => {
        setSuccessMessage(location.state?.signupSuccess || '');
    }, [location.state]);

    // Redirect if already authenticated WITH THE CORRECT ROLE
    useEffect(() => {
        if (isAuthenticated && !location.state?.forceLogout) {
            if (hasPortalRoleAccess(portalId, user?.userType || user?.type, user)) {
                const defaultLanding =
                    portalId === 'workshop'
                        ? workshopLandingPath(user)
                        : `/${portalId}`;
                const origin = location.state?.from?.pathname || defaultLanding;
                navigate(origin, { replace: true });
            }
        }
    }, [isAuthenticated, user, navigate, location, portalId]);

    const handleSignIn = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');
        setLoading(true);

        // DEMO LOGIN BYPASS
        if (email.toLowerCase() === 'demo@filtercars.com' && password === 'password123') {
            console.log('Demo login triggered for:', portalId);
            const demoUser = {
                id: 'demo-id-' + portalId,
                name: 'Demo ' + portalName.split(' ')[0],
                email: 'demo@filtercars.com',
                userType: PORTAL_USER_TYPES[portalId] || 'admin',
                isDemo: true
            };
            const demoToken = 'demo-token-' + Date.now();
            
            setTimeout(() => {
                login(demoUser, demoToken);
                setLoading(false);
            }, 1000);
            return;
        }

        try {
            let data;
            if (portalId === 'corporate') {
                data = await corporateLogin(email, password);
            } else if (portalId === 'pos') {
                data = await cashierLogin(email, password);
            } else if (portalId === 'workshop' || portalId === 'locker') {
                // Locker users are workshop_user rows; reuse the workshop login endpoint.
                data = await workshopLogin(email, password);
            } else if (portalId === 'technician') {
                data = await technicianLogin(email, password);
            } else if (portalId === 'supplier') {
                data = await supplierLogin(email, password);
            } else if (portalId === 'marketing') {
                data = await marketingLogin(email, password);
            } else {
                // Default fallback to admin login for other portals if they have APIs
                data = await adminLogin(email, password);
            }

            if (data && data.token) {
                const userData = data.user || data;
                const userToken = data.token;
                let effectiveUserType = userData.userType || userData.type || PORTAL_USER_TYPES[portalId] || 'admin';
                if (portalId === 'workshop' && !effectiveUserType) {
                    effectiveUserType = 'workshop_owner';
                }

                if (portalId === 'locker') {
                    const role = userData.lockerPortalRole;
                    const isOwner = effectiveUserType === 'workshop_owner';
                    if (!isOwner && role !== 'supervisor' && role !== 'collector') {
                        throw new Error(
                            'This account does not have locker portal access. Ask your workshop admin to create a locker user.',
                        );
                    }
                }

                const workshopMeta =
                    data.workshop ||
                    userData.workshop ||
                    null;

                login(
                    { ...userData, userType: effectiveUserType },
                    userToken,
                    { workshop: workshopMeta }
                );

                if (portalId === 'pos') {
                    apiFetch('/cashier/session/open', { method: 'POST' }).catch(() => {});
                }
                return;
            } else {
                throw new Error('Invalid response from server.');
            }
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
                         <span>FILTER</span><br />
                        {portalName.toUpperCase()}
                    </h1>
                    <p className="brand-subtitle">
                        Secure entry point for the Filter Services management ecosystem. Elite control, precision, and speed.
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
                    <div className="back-home-top">
                        <a
                            onClick={() => navigate('/')}
                            className="back-home-link"
                        >
                            <ChevronRight size={14} style={{ transform: 'rotate(180deg)' }} />
                            Back to Home
                        </a>
                    </div>

                    <div className="signin-header">
                        <h2>Portal Login</h2>
                        <p style={{ fontSize: '1.1rem', color: '#000', fontWeight: '600', marginTop: '4px' }}>
                            Sign in to {portalName}
                        </p>
                    </div>

                    {error && <div className="error-message">{error}</div>}
                    {successMessage && (
                        <div
                            style={{
                                background: '#F0FDF4',
                                color: '#166534',
                                padding: '12px',
                                borderRadius: '8px',
                                fontSize: '0.875rem',
                                marginBottom: '24px',
                                textAlign: 'center',
                                border: '1px solid #BBF7D0',
                            }}
                        >
                            {successMessage}
                        </div>
                    )}

                    <form onSubmit={handleSignIn}>
                        <div className="form-group">
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

                        <div className="form-group">
                            <label htmlFor="password">Password</label>
                            <div className="input-wrapper">
                                <Lock size={18} />
                                <input
                                    type="password"
                                    id="password"
                                    className="signin-input"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
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
                        {PORTAL_SIGNUP_ALLOWED.has(portalId) && (
                            <p style={{ marginTop: '10px', fontSize: '0.8125rem', color: '#6B7280' }}>
                                Don&apos;t have an account?{' '}
                                <a
                                    onClick={() => navigate(`/${portalId}/signup`)}
                                    style={{ color: '#111827', cursor: 'pointer', fontWeight: 700 }}
                                >
                                    Sign Up
                                </a>
                            </p>
                        )}
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default PortalLoginPage;
