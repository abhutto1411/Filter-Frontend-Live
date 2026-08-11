import { 
    LayoutDashboard, UserPlus, Users, Wallet, 
    PieChart, Bell, Settings, LogOut, TrendingUp, Clock, CheckCircle, XCircle
} from 'lucide-react';

export const REFERRER_NAV_ITEMS = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'add_referral', label: 'Add Referral', icon: UserPlus },
    { id: 'my_referrals', label: 'My Referrals', icon: Users },
    { id: 'wallet', label: 'Wallet', icon: Wallet },
    { id: 'reports', label: 'Reports', icon: PieChart },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'settings', label: 'Settings', icon: Settings },
];

export const MOCK_REFERRER = {
    name: "Taha",
    id: "FR-001",
    type: "Franchise",
    avatar: "T"
};

export const MOCK_STATS = [
    { label: 'Total Earnings', value: '45,750', unit: 'SAR', icon: TrendingUp },
    { label: 'Available Balance', value: '12,300', unit: 'SAR', icon: Wallet },
    { label: 'Pending Commission', value: '8,450', unit: 'SAR', icon: Clock },
    { label: 'Paid Commission', value: '25,000', unit: 'SAR', icon: CheckCircle },
    { label: 'Total Referrals', value: '6', unit: '', icon: Users },
];

export const MOCK_REFERRALS = [
    { id: 'REF-001', name: 'Ahmed Hassan', service: 'Franchise', status: 'Converted', commission: '5,000 SAR', date: '2026-03-20' },
    { id: 'REF-002', name: 'Sara Al-Otaibi', service: 'Corporate', status: 'Pending', commission: '--', date: '2026-03-22' },
    { id: 'REF-003', name: 'Khalid Ibrahim', service: 'Individual', status: 'Converted', commission: '1,500 SAR', date: '2026-03-18' },
    { id: 'REF-004', name: 'Fatima Al-Zahrani', service: 'Franchise', status: 'Rejected', commission: '--', date: '2026-03-15' },
    { id: 'REF-005', name: 'Omar Mansour', service: 'Corporate', status: 'Converted', commission: '3,200 SAR', date: '2026-03-10' },
    { id: 'REF-006', name: 'Nora Al-Shehri', service: 'Individual', status: 'Pending', commission: '--', date: '2026-03-24' },
];

export const MOCK_NOTIFICATIONS = [
    { title: 'Commission Earned', text: 'You earned SAR 5,000 from Ahmed Hassan\'s franchise referral.', date: '2026-03-20' },
    { title: 'Referral Converted', text: 'Your referral for Khalid Ibrahim has been converted!', date: '2026-03-18' },
    { title: 'Payout Approved', text: 'Your payout request of SAR 10,000 has been approved.', date: '2026-02-01' },
];

export const MOCK_TRANSACTIONS = [
    { date: '2026-03-20', description: 'Commission - Ahmed Hassan (Franchise)', amount: '5,000 SAR', status: 'Paid' },
    { date: '2026-03-18', description: 'Commission - Khalid Ibrahim (Individual)', amount: '1,500 SAR', status: 'Paid' },
    { date: '2026-03-10', description: 'Commission - Omar Mansour (Corporate)', amount: '3,200 SAR', status: 'Paid' },
    { date: '2026-03-22', description: 'Commission - Sara Al-Otaibi (Corporate)', amount: '2,800 SAR', status: 'Pending' },
    { date: '2026-03-24', description: 'Commission - Nora Al-Shehri (Individual)', amount: '800 SAR', status: 'Pending' },
];

export const MOCK_PAYOUTS = [
    { date: '2026-03-01', amount: '10,000 SAR', status: 'Approved' },
    { date: '2026-02-15', amount: '8,000 SAR', status: 'Approved' },
    { date: '2026-03-15', amount: '5,000 SAR', status: 'Pending' },
];

export const CHART_DATA = [
    { name: 'Oct', earnings: 8000 },
    { name: 'Nov', earnings: 14000 },
    { name: 'Dec', earnings: 10000 },
    { name: 'Jan', earnings: 16000 },
    { name: 'Feb', earnings: 8000 },
    { name: 'Mar', earnings: 14500 },
];
