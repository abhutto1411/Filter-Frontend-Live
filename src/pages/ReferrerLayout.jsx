import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation, NavLink } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { REFERRER_NAV_ITEMS } from './referrer-portal/ReferrerConstants';
import './referrer-portal/ReferrerPortal.css';
import '../styles/AdminLayout.css';
import { useAuth } from '../context/AuthContext';
import UserProfileMenu from '../components/UserProfileMenu';

export default function ReferrerLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuth();
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/referrer-portal/login', { replace: true });
    };

    const displayName = user?.name || user?.email || 'Referrer User';
    const userRole = 'REFERRER PORTAL';
    const initials = displayName
        .split(' ')
        .map((n) => n[0])
        .filter(Boolean)
        .join('')
        .toUpperCase()
        .substring(0, 2) || 'RF';

    return (
        <div className="admin-layout" style={{ minHeight: '100vh', height: '100vh', overflow: 'hidden' }}>
            <aside className="sidebar">
                <div className="sidebar-logo">
                    <h2 className="logo-main">
                        FILTER <span className="logo-sub">ERP</span>
                    </h2>
                    <p className="logo-desc">FILTER ERP · REFERRER PORTAL</p>
                </div>

                <nav className="sidebar-nav">
                    <div className="sidebar-section-label">NAVIGATION</div>
                    {REFERRER_NAV_ITEMS.map((item) => (
                        <NavLink
                            key={item.id}
                            to={item.id === 'dashboard' ? '/referrer-portal/dashboard' : `/referrer-portal/${item.id}`}
                            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                        >
                            <item.icon size={18} />
                            <span>{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div
                        className={`user-pill ${isUserMenuOpen ? 'menu-open' : ''}`}
                        onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    >
                        <div className="user-avatar">{initials}</div>
                        <div className="user-details">
                            <p className="user-name">{displayName}</p>
                            <p className="user-role">{userRole}</p>
                        </div>
                        <ChevronDown className="user-menu-chevron" size={14} />

                        <UserProfileMenu
                            isOpen={isUserMenuOpen}
                            onClose={() => setIsUserMenuOpen(false)}
                            onLogout={handleLogout}
                            locale="en"
                        />
                    </div>
                </div>
            </aside>

            <main className="main-content" style={{ flex: 1, overflowY: 'auto', background: 'var(--color-bg-canvas)' }}>
                <Outlet />
            </main>
        </div>
    );
}


