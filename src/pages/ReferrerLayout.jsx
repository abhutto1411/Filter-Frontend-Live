import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, DollarSign } from 'lucide-react';
import { REFERRER_NAV_ITEMS, MOCK_REFERRER } from './referrer-portal/ReferrerConstants';
import './referrer-portal/ReferrerPortal.css';

export default function ReferrerLayout() {
    const navigate = useNavigate();
    const location = useLocation();

    const activeTab = location.pathname.split('/').pop();

    return (
        <div className="rf-layout">
            <aside className="rf-sidebar">
                <div className="rf-logo-section">
                    <div className="rf-logo-icon">
                        <DollarSign size={24} strokeWidth={3} />
                    </div>
                    <div className="rf-logo-text">
                        <p className="rf-logo-title">Filter Referrer Portal</p>
                    </div>
                </div>

                <nav className="rf-nav">
                    {REFERRER_NAV_ITEMS.map((item) => (
                        <button
                            key={item.id}
                            className={`rf-nav-item ${activeTab === item.id || (activeTab === 'referrer-portal' && item.id === 'dashboard') ? 'active' : ''}`}
                            onClick={() => navigate(`/referrer-portal/${item.id}`)}
                        >
                            <item.icon size={20} />
                            <span>{item.label}</span>
                        </button>
                    ))}
                </nav>

                <div className="rf-sidebar-footer">
                    <div className="rf-user-card">
                        <div className="rf-user-avatar">{MOCK_REFERRER.avatar}</div>
                        <div className="rf-user-info">
                            <p className="rf-user-name">{MOCK_REFERRER.name}</p>
                            <p className="rf-user-id">{MOCK_REFERRER.id} • {MOCK_REFERRER.type}</p>
                        </div>
                    </div>
                    <button className="rf-logout-btn" onClick={() => navigate('/')}>
                        <LogOut size={18} />
                        <span>Logout</span>
                    </button>
                </div>
            </aside>

            <main className="rf-main">
                <Outlet />
            </main>
        </div>
    );
}
