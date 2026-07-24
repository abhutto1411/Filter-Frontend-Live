import {
    LayoutDashboard,
    Clock,
    DollarSign,
    AlertTriangle,
    History,
    FileText,
    Wallet,
    Send,
    Coins,
    ClipboardList,
} from 'lucide-react';

const SUPERVISOR_NAV = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'pending', label: 'Pending Requests', icon: Clock },
    { id: 'record', label: 'Record Collection', icon: DollarSign },
    { id: 'approvals', label: 'Approvals', icon: AlertTriangle },
    { id: 'deposit_to_bank', label: 'Deposit to Bank', icon: Send },
    { id: 'issue_petty_cash', label: 'Issue Petty Cash', icon: Coins },
    { id: 'history', label: 'Collections History', icon: History },
    { id: 'differences', label: 'Differences Report', icon: FileText },
    { id: 'petty_cash', label: 'Petty Cash', icon: Wallet },
];

const COLLECTOR_NAV = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'assigned', label: 'Assigned Requests', icon: ClipboardList },
    { id: 'record', label: 'Record Collection', icon: DollarSign },
    { id: 'history', label: 'Collections History', icon: History },
    { id: 'differences', label: 'Differences Report', icon: FileText },
];

export function resolveLockerPortalRole(user) {
    if (String(user?.userType || '').toLowerCase() === 'workshop_owner') return 'supervisor';
    const role = String(user?.lockerPortalRole || '').toLowerCase();
    if (role === 'supervisor' || role === 'collector') return role;
    return 'supervisor';
}

export function getLockerNavItems(user) {
    const role = resolveLockerPortalRole(user);
    return role === 'collector' ? COLLECTOR_NAV : SUPERVISOR_NAV;
}

/** @deprecated use getLockerNavItems(user) */
export const NAV_ITEMS = SUPERVISOR_NAV;

export const MOCK_PENDING = [
    { id: 'LC-2026-0142', branch: 'Main — Riyadh', requested: '2026-03-10 08:00', expected: 'SAR 12,400', status: 'overdue', hoursOverdue: 4 },
    { id: 'LC-2026-0141', branch: 'North — Jeddah', requested: '2026-03-10 09:30', expected: 'SAR 8,200', status: 'pending' },
    { id: 'LC-2026-0140', branch: 'East — Dammam', requested: '2026-03-09 16:00', expected: 'SAR 15,800', status: 'overdue', hoursOverdue: 18 },
];

export const MOCK_HISTORY = [
    { id: 'LC-2026-0139', branch: 'Main — Riyadh', date: '2026-03-10 10:15', received: 'SAR 12,400', expected: 'SAR 12,400', difference: 0, status: 'collected' },
    { id: 'LC-2026-0138', branch: 'North — Jeddah', date: '2026-03-09 14:22', received: 'SAR 8,180', expected: 'SAR 8,200', difference: -20, status: 'collected' },
    { id: 'LC-2026-0137', branch: 'East — Dammam', date: '2026-03-09 11:00', received: 'SAR 15,800', expected: 'SAR 15,800', difference: 0, status: 'collected' },
];

export const MOCK_APPROVALS = [
    { id: 1, collectionId: 'LC-2026-0138', branch: 'North — Jeddah', type: 'short', amount: 20, reason: 'Counting variance', submittedBy: 'Cashier A', date: '2026-03-09' },
    { id: 2, collectionId: 'LC-2026-0135', branch: 'Main — Riyadh', type: 'over', amount: 50, reason: 'Extra notes found', submittedBy: 'Cashier B', date: '2026-03-08' },
];

export const MOCK_PETTY_CASH = [
    { id: 1, branch: 'Main — Riyadh', requested: '2026-03-10', amount: 500, purpose: 'Office supplies', status: 'pending' },
];
