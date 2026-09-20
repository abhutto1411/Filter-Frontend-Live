import React from 'react';
import { DollarSign, UserCheck, CreditCard, Bell } from 'lucide-react';

const NOTIFICATIONS = [
    { 
        id: 1, 
        type: 'commission', 
        title: 'Commission Earned', 
        text: 'You earned SAR 5,000 from Ahmed Hassan\'s franchise referral.', 
        date: '2026-03-20', 
        unread: true, 
        icon: DollarSign, 
        color: '#10b981' 
    },
    { 
        id: 2, 
        type: 'conversion', 
        title: 'Referral Converted', 
        text: 'Your referral for Khalid Ibrahim has been converted!', 
        date: '2026-03-18', 
        unread: true, 
        icon: UserCheck, 
        color: '#3b82f6' 
    },
    { 
        id: 3, 
        type: 'payout', 
        title: 'Payout Approved', 
        text: 'Your payout request of SAR 10,000 has been approved.', 
        date: '2026-03-01', 
        unread: false, 
        icon: CreditCard, 
        color: '#8b5cf6' 
    },
    { 
        id: 4, 
        type: 'commission', 
        title: 'Commission Earned', 
        text: 'You earned SAR 3,200 from Omar Mansour\'s corporate referral.', 
        date: '2026-03-10', 
        unread: false, 
        icon: DollarSign, 
        color: '#10b981' 
    },
];

export default function ReferrerNotifications() {
    return (
        <div className="rf-content">
            <header className="rf-header">
                <div className="rf-welcome">
                    <h1>Notifications</h1>
                    <p>Stay updated with your latest activities.</p>
                </div>
            </header>

            <div className="rf-notif-list" style={{ maxWidth: '800px' }}>
                {NOTIFICATIONS.map((notif) => (
                    <div 
                        key={notif.id} 
                        className="rf-card rf-notif-item" 
                        style={{ 
                            display: 'flex', 
                            gap: '1.25rem', 
                            padding: '1.5rem', 
                            marginBottom: '1rem',
                            borderLeft: notif.unread ? `4px solid ${notif.color}` : '1px solid var(--color-border-light)',
                            background: notif.unread ? `${notif.color}05` : '#fff'
                        }}
                    >
                        <div 
                            style={{ 
                                width: '48px', 
                                height: '48px', 
                                borderRadius: '12px', 
                                background: `${notif.color}15`, 
                                color: notif.color,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                            }}
                        >
                            <notif.icon size={22} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'center', marginBottom: '0.25rem' }}>
                                <h4 className="rf-notif-title" style={{ margin: 0, fontSize: '1rem' }}>{notif.title}</h4>
                                {notif.unread && <div style={{ marginLeft: 'auto', width: '8px', height: '8px', borderRadius: '50%', background: notif.color }} />}
                            </div>
                            <p className="rf-notif-text" style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>{notif.text}</p>
                            <p className="rf-notif-date" style={{ margin: 0 }}>{notif.date}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
