import {
    BarChart3, ClipboardList, DollarSign, CheckCircle2, Wrench, Radio, PlayCircle, Home, User,
} from 'lucide-react';

export const NAV_GROUPS = [
    { label: 'MAIN', items: [
        { id: 'home', label: 'Home', icon: Home },
        { id: 'overview', label: 'Overview', icon: BarChart3 },
        { id: 'active', label: 'Assigned Orders', icon: ClipboardList, showBadge: true },
        { id: 'commission', label: 'Commission', icon: DollarSign },
        { id: 'profile', label: 'Profile', icon: User },
    ]},
];

export const WORKFLOW_CONFIG = {
    assigned_pending_acceptance: { label: 'Assigned — Waiting Acceptance', badgeClass: 'ws-badge--yellow', borderClass: 'ws-border-yellow', action: { label: 'Accept Order', Icon: CheckCircle2, btnClass: 'ws-workflow-btn--accept', next: 'accepted_by_technician' } },
    accepted_by_technician: { label: 'Accepted — Ready to Start', badgeClass: 'ws-badge--blue', borderClass: 'ws-border-blue', action: { label: 'Start Task', Icon: PlayCircle, btnClass: 'ws-workflow-btn--start', next: 'task_in_progress' } },
    task_in_progress: { label: 'Task In-Progress', badgeClass: 'ws-badge--purple', borderClass: 'ws-border-purple', action: { label: 'Mark Task Completed', Icon: CheckCircle2, btnClass: 'ws-workflow-btn--complete', next: 'task_completed_by_technician' } },
    task_completed_by_technician: { label: 'Completed — Awaiting Cashier', badgeClass: 'ws-badge--green', borderClass: 'ws-border-green', action: null },
    invoice_generated: { label: 'Invoice Generated ✓', badgeClass: 'ws-badge--gray', borderClass: '', action: null },
};

export const MOCK_ORDERS = [
    { id: 1, order_number: 'ORD-2026-0142', customer_name: 'Safa Al-Makkah Corp', vehicle_plate: 'ABC 1234', department_name: 'Brakes', grand_total: 850, commission_amount: 85, workflow_status: 'assigned_pending_acceptance', order_status: 'pending', created_date: new Date().toISOString(), items: [{ product_name: 'Brake Pad Replacement', quantity: 1, total: 850 }] },
    { id: 2, order_number: 'ORD-2026-0138', customer_name: 'Walk-in', vehicle_plate: 'XYZ 5678', department_name: 'Lubrication', grand_total: 320, commission_amount: 32, workflow_status: 'task_in_progress', order_status: 'in_progress', created_date: new Date().toISOString(), items: [{ product_name: 'Engine Oil Change', quantity: 1, total: 180 }, { product_name: 'Air Filter', quantity: 1, total: 75 }, { product_name: 'Tire Rotation', quantity: 1, total: 65 }] },
    { id: 3, order_number: 'ORD-2026-0130', customer_name: 'Al-Nakheel Fleet', vehicle_plate: 'DEF 9012', department_name: 'Electrical', grand_total: 640, commission_amount: 64, workflow_status: 'invoice_generated', order_status: 'completed', created_date: new Date(Date.now() - 86400000).toISOString(), items: [{ product_name: 'Battery Replacement', quantity: 1, total: 640 }] },
    { id: 4, order_number: 'ORD-2026-0125', customer_name: 'Walk-in', vehicle_plate: 'GHI 3456', department_name: 'General', grand_total: 120, commission_amount: 12, workflow_status: 'invoice_generated', order_status: 'completed', created_date: new Date(Date.now() - 172800000).toISOString(), items: [{ product_name: 'Tire Rotation', quantity: 1, total: 120 }] },
];

export const MOCK_COMMISSIONS = [
    { id: 1, description: 'Commission — ORD-2026-0130 / Battery Replacement', entry_date: '2026-03-09', amount: 64, status: 'posted' },
    { id: 2, description: 'Commission — ORD-2026-0121 / Tire Rotation', entry_date: '2026-03-08', amount: 12, status: 'paid' },
    { id: 3, description: 'Commission — ORD-2026-0115 / Brake Pad Replacement', entry_date: '2026-03-07', amount: 85, status: 'paid' },
];

export const MOCK_TECH = { name: 'Ahmad Al-Rashid', role: 'Workshop Technician', branch: 'Main Branch — Riyadh' };
