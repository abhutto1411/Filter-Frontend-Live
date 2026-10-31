import { 
    LayoutDashboard, Users, Wallet, 
    PieChart, Bell, Settings
} from 'lucide-react';

export const REFERRER_NAV_ITEMS = [
    { id: 'dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard },
    { id: 'my_referrals', labelKey: 'nav.myReferrals', icon: Users },
    { id: 'wallet', labelKey: 'nav.wallet', icon: Wallet },
    { id: 'reports', labelKey: 'nav.reports', icon: PieChart },
    { id: 'notifications', labelKey: 'nav.notifications', icon: Bell },
    { id: 'settings', labelKey: 'nav.settings', icon: Settings },
];
