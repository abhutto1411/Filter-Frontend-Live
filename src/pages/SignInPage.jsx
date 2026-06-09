import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, ChevronRight, Loader, Eye, EyeOff } from 'lucide-react';
import '../styles/SignInPage.css';
import { adminLogin } from '../services/authApi';
import { useAuth } from '../context/AuthContext';
import { firstVisibleAdminPath } from '../utils/permissions';

const MOCK_ROUTES = {
    'workshop@filtercars.com': '/workshop',
    'pos@filtercars.com': '/pos',
    'tech@filtercars.com': '/technician',
    'corporate@filtercars.com': '/corporate',
    'supplier@filtercars.com': '/supplier',
    'marketing@filtercars.com': '/marketing/dashboard',
    'referral@filtercars.com': '/referral',
    'lockers@filtercars.com': '/locker',
};

const SignInPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { login, user, isAuthenticated } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Redirect if already authenticated as Admin
    useEffect(() => {
        // PERMISSIVE CHECK on the Admin Login page:
        // If we are authenticated and on the admin login page, we should try to enter the dashboard.
        // We still check for 'admin' role if available, but we lean towards allowing the login.
        if (isAuthenticated) {
            // Check if the user is an admin - we now explicitly allow 'platform_admin'
            const isAdmin = user?.userType === 'admin' || user?.userType === 'platform_admin' || !user?.userType;
            
            if (isAdmin) {
                navigate(firstVisibleAdminPath(user), { replace: true });
            }
        }
    }, [isAuthenticated, user, navigate, location]);

    const handleSignIn = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        // UNIFIED DEMO LOGIN BYPASS
        if (email.toLowerCase() === 'demo@filtercars.com' && password === 'password123') {
            const demoUser = {
                id: 'demo-admin-id',
                name: 'Demo Admin',
                email: 'demo@filtercars.com',
                userType: 'admin',
                isDemo: true
            };
            const demoToken = 'demo-admin-token-' + Date.now();
            
            setTimeout(() => {
                login(demoUser, demoToken);
                navigate('/admin/dashboard', { replace: true });
                setLoading(false);
            }, 1000);
            return;
        }

        // MOCK ROUTE LOGINS (Functional)
        if (MOCK_ROUTES[email]) {
            const typeMap = {
                'tech@filtercars.com': 'technician_user',
                'pos@filtercars.com': 'cashier_user',
                'workshop@filtercars.com': 'workshop_user',
                'supplier@filtercars.com': 'supplier_user',
                'marketing@filtercars.com': 'marketing_user',
                'referral@filtercars.com': 'referral_user',
                'lockers@filtercars.com': 'admin',
            };
            
            const demoUser = {
                id: 'mock-id-' + email,
                name: email.split('@')[0].toUpperCase(),
                email: email,
                userType: typeMap[email] || 'corporate_user',
                isDemo: true
            };
            
            login(demoUser, 'mock-token-' + email);
            navigate(MOCK_ROUTES[email], { replace: true });
            setLoading(false);
            return;
        }

        // Try real backend login
        try {
            const data = await adminLogin(email, password);
            const userData = data.user || data;
            const userToken = data.token;
            
            if (userToken) {
                login(userData, userToken);
                // Always land on the first sidebar page the user can view —
                // ignore any prior URL the user was on before logout / session expiry.
                navigate(firstVisibleAdminPath(userData), { replace: true });
                return;
            }
        } catch (err) {
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
                        FILTER <span>POS</span><br />
                        PORTAL ACCESS
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
                        <h2>Welcome Back</h2>
                        <p>Enter your credentials to access your portal</p>
                    </div>

                    {error && <div className="error-message">{error}</div>}

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
};

export default SignInPage;
