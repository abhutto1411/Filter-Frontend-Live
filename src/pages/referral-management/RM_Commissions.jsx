import React from 'react';
import { 
    Clock, CheckCircle, DollarSign, Search, Filter, BookOpen, Info, Users, ChevronDown
} from 'lucide-react';
import { MOCK_COMMISSIONS } from './RM_Constants';

const CommissionStatNew = ({ label, value, icon: Icon, color, bg }) => (
    <div className="rm-card" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '16px', padding: '1.25rem' }}>
        <div style={{ 
            width: '48px', 
            height: '48px', 
            borderRadius: '12px', 
            background: bg, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: color,
            flexShrink: 0
        }}>
            <Icon size={24} style={{ display: 'block' }} />
        </div>
        <div>
            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', marginBottom: '4px', margin: 0 }}>{label}</p>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>{value}</h3>
        </div>
    </div>
);

export default function RM_Commissions() {
    const isAr = localStorage.getItem('portal-locale') === 'ar';

    return (
        <div className="rm-content" style={{ padding: '2rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '2rem' }}>
                <div style={{ background: '#7c3aed', padding: '8px', borderRadius: '8px', color: '#fff' }}>
                    <DollarSign size={24} />
                </div>
                <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>Referral Commissions</h2>
                    <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '4px 0 0' }}>
                        View, pay, and track all referral commissions — Integrated with Chart of Accounts
                    </p>
                </div>
            </div>

            {/* KPI Stack */}
            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <CommissionStatNew 
                    label="Pending Commissions" 
                    value="SAR 0.00" 
                    icon={Clock} 
                    color="#f59e0b" 
                    bg="rgba(245, 158, 11, 0.1)" 
                />
                <CommissionStatNew 
                    label="Paid Commissions" 
                    value="SAR 0.00" 
                    icon={CheckCircle} 
                    color="#10b981" 
                    bg="rgba(16, 185, 129, 0.1)" 
                />
                <CommissionStatNew 
                    label="Total Referrals Tracked" 
                    value="0" 
                    icon={BookOpen} 
                    color="#6366f1" 
                    bg="rgba(99, 102, 241, 0.1)" 
                />
            </div>

            {/* Blue Info Box */}
            <div style={{ 
                background: '#eff6ff', 
                border: '1px solid #bfdbfe', 
                borderRadius: '12px', 
                padding: '12px 20px', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px',
                marginBottom: '2rem'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <BookOpen size={18} style={{ color: '#2563eb' }} />
                </div>
                <p style={{ fontSize: '0.8125rem', color: '#1e40af', margin: 0, fontWeight: 500 }}>
                    Payments are automatically posted to <strong style={{ fontWeight: 700 }}>Chart of Accounts — Referral Commission Payables</strong>. Each payment creates a journal entry (Debit: Referral Commission Payables / Credit: Cash or Bank Account) and sends an email notification to the referrer.
                </p>
            </div>

            {/* Filters Row */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '32px', cursor: 'pointer' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>All Types</span>
                    <ChevronDown size={16} style={{ opacity: 0.5 }} />
                </div>
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '32px', cursor: 'pointer' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>All Commissions</span>
                    <ChevronDown size={16} style={{ opacity: 0.5 }} />
                </div>
            </div>

            {/* Table or Empty State (as per screenshot) */}
            <div className="rm-card" style={{ textAlign: 'center', padding: '4rem 2rem', background: '#fff' }}>
                <DollarSign size={48} style={{ color: '#f3f4f6', marginBottom: '1rem' }} />
                <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0, fontWeight: 500 }}>No commission records found</p>
            </div>
        </div>
    );
}
