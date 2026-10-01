import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
    DollarSign, ArrowLeft, Menu, X as CloseIcon
} from 'lucide-react';
import { 
    RM_NAV_ITEMS, ACCOUNTING_ITEMS, SYSTEM_ITEMS 
} from './referral-management/RM_Constants';
import RM_Dashboard from './referral-management/RM_Dashboard';
import RM_Referrers from './referral-management/RM_Referrers';
import RM_Referrals from './referral-management/RM_Referrals';
import RM_Commissions from './referral-management/RM_Commissions';
import RM_Payouts from './referral-management/RM_Payouts';
import RM_COA from './referral-management/RM_COA';
import RM_JournalEntries from './referral-management/RM_JournalEntries';
import RM_Ledger from './referral-management/RM_Ledger';
import RM_Settings from './referral-management/RM_Settings';

import './referral-management/ReferralManagement.css';

const Placeholder = ({ title, sub }) => (
    <div className="rm-content">
        <div style={{ paddingBottom: '2rem' }}>
            <h2 className="rm-topbar-title">{title}</h2>
            <p className="rm-topbar-sub">{sub}</p>
        </div>
        <div className="rm-card" style={{ textAlign: 'center', padding: '100px 0' }}>
            <p style={{ opacity: 0.3, fontStyle: 'italic' }}>This module is coming soon...</p>
        </div>
    </div>
);

export default function ReferralLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Sync activeTab with URL: /referral-management/TAB_NAME
    const getActiveTabFromUrl = () => {
        const parts = location.pathname.split('/').filter(Boolean);
        return parts[1] || 'dashboard';
    };

    const activeTab = getActiveTabFromUrl();
    const setActiveTab = (tab) => {
        navigate(`/referral-management/${tab}`);
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard': return <RM_Dashboard onTabChange={setActiveTab} />;
            case 'referrers': return <RM_Referrers />;
            case 'referrals': return <RM_Referrals />;
            case 'payouts': return <RM_Payouts />;
            case 'commissions': return <RM_Commissions />;
            case 'coa': return <RM_COA />;
            case 'journal_entries': return <RM_JournalEntries />;
            case 'ledger': return <RM_Ledger />;
            case 'settings': return <RM_Settings />;
            default: return <RM_Dashboard onTabChange={setActiveTab} />;
        }
    };

    const NavGroup = ({ title, items }) => (
        <div style={{ marginBottom: '1.5rem' }}>
            {title && <p className="rm-nav-group-title">{title}</p>}
            {items.map(item => (
                <button
                    key={item.id}
                    className={`rm-nav-btn ${activeTab === item.id ? 'active' : ''}`}
                    onClick={() => {
                        setActiveTab(item.id);
                        if (window.innerWidth <= 1024) setIsMobileMenuOpen(false);
                    }}
                >
                    <item.icon size={18} />
                    <span>{item.label}</span>
                </button>
            ))}
        </div>
    );

    return (
        <div className="rm-layout">
            <div 
                className={`rm-sidebar-overlay ${isMobileMenuOpen ? 'open' : ''}`} 
                onClick={() => setIsMobileMenuOpen(false)} 
            />
            <aside className={`rm-sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
                <div className="rm-logo-section">
                    <div className="rm-logo-icon"><DollarSign size={22} strokeWidth={3} /></div>
                    <div>
                        <p className="rm-logo-title">ReferralPro</p>
                        <p className="rm-logo-sub">COMMISSION SYSTEM</p>
                    </div>
                </div>

                <nav className="rm-nav">
                    <NavGroup items={RM_NAV_ITEMS} />
                    <NavGroup title="ACCOUNTING" items={ACCOUNTING_ITEMS} />
                    <NavGroup title="SYSTEM" items={SYSTEM_ITEMS} />
                </nav>


            </aside>

            <main className="rm-main">
                <header className="rm-topbar">
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <button 
                            className="rm-topbar-hamburger" 
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        >
                            {isMobileMenuOpen ? <CloseIcon size={24} /> : <Menu size={24} />}
                        </button>
                        <div>
                            <p className="rm-topbar-title">
                                {RM_NAV_ITEMS.find(n => n.id === activeTab)?.label || 
                                 ACCOUNTING_ITEMS.find(n => n.id === activeTab)?.label ||
                                 SYSTEM_ITEMS.find(n => n.id === activeTab)?.label || 'Dashboard'}
                            </p>
                            <p className="rm-topbar-sub">Overview of your referral & commission system</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                         <div className="ws-online-badge">
                            <div className="ws-online-dot" /> Online
                        </div>
                        <a className="ws-back-link" onClick={() => navigate('/admin/marketing')} style={{ cursor: 'pointer', margin: 0, padding: 0 }}>
                            <ArrowLeft size={14} /> Back to Marketing
                        </a>
                    </div>
                </header>
                <div className="rm-content-canvas">
                    {renderContent()}
                </div>
            </main>
        </div>
    );
}
