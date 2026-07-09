import { LayoutDashboard, UserPlus, Users, Wallet, BarChart3, Bell, Settings } from 'lucide-react';

export const NAV_ITEMS = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'add_referral', label: 'Add Referral', icon: UserPlus },
    { id: 'my_referrals', label: 'My Referrals', icon: Users },
    { id: 'wallet', label: 'Wallet', icon: Wallet },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'settings', label: 'Settings', icon: Settings },
];

export function genCode(prefix) {
    return `${prefix}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

export const MOCK_USER = {
    name: 'Mohammed Al-Rashidi',
    id: 'FR-001',
    category: 'Franchise',
    avatar: 'MA'
};

export const MOCK_STATS = {
    totalEarnings: 45750,
    availableBalance: 12300,
    pendingCommission: 8450,
    paidCommission: 25000,
    totalReferrals: 6
};

export const MOCK_TREND_DATA = [
    { month: 'Oct', earnings: 8000 },
    { month: 'Nov', earnings: 12500 },
    { month: 'Dec', earnings: 10000 },
    { month: 'Jan', earnings: 15500 },
    { month: 'Feb', earnings: 11000 },
    { month: 'Mar', earnings: 14500 },
];

export const MOCK_NOTIFICATIONS = [
    { id: 1, title: 'Commission Earned', desc: "You earned SAR 5,000 from Ahmed Hassan's franchise referral.", date: '2026-03-20', type: 'success' },
    { id: 2, title: 'Referral Converted', desc: "Your referral for Khalid Ibrahim has been converted!", date: '2026-03-18', type: 'info' },
    { id: 3, title: 'Payout Approved', desc: "Your payout request of SAR 10,000 has been approved.", date: '2026-03-01', type: 'approved' },
];

export const MOCK_REFERRALS = [
    { id: 'REF-001', customerName: 'Ahmed Hassan', serviceType: 'Franchise', status: 'Converted', commission: '5,000 SAR', date: '2026-03-20' },
    { id: 'REF-002', customerName: 'Sara Al-Otaibi', serviceType: 'Corporate', status: 'Pending', commission: '—', date: '2026-03-22' },
    { id: 'REF-003', customerName: 'Khalid Ibrahim', serviceType: 'Individual', status: 'Converted', commission: '1,500 SAR', date: '2026-03-18' },
    { id: 'REF-004', customerName: 'Fatima Al-Zahrani', serviceType: 'Franchise', status: 'Rejected', commission: '—', date: '2026-03-15' },
    { id: 'REF-005', customerName: 'Omar Mansour', serviceType: 'Corporate', status: 'Converted', commission: '3,200 SAR', date: '2026-03-10' },
    { id: 'REF-006', customerName: 'Nora Al-Shehri', serviceType: 'Individual', status: 'Pending', commission: '—', date: '2026-03-24' },
];
