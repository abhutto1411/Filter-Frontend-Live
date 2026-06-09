import { LayoutDashboard, Building2, Car, Calendar, Tag, Receipt, Wallet, BarChart3, CreditCard, ClipboardCheck } from 'lucide-react';

export const NAV_GROUPS = [
    { label: 'MANAGEMENT', items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'profile', label: 'Profile', icon: Building2 },
        { id: 'vehicles', label: 'Vehicles', icon: Car },
        { id: 'bookings', label: 'Bookings', icon: Calendar },
        { id: 'booking-approvals', label: 'Booking approvals', icon: ClipboardCheck },
        { id: 'quotations', label: 'Quotations', icon: Tag },
    ]},
    { label: 'BILLING', items: [
        { id: 'billing', label: 'Monthly Billing', icon: Receipt },
        { id: 'wallet', label: 'Wallet', icon: Wallet },
        { id: 'reports', label: 'Reports', icon: BarChart3 },
    ]},
];

export const WALLET_BALANCE = 12450;

export const MOCK_BRANCHES_CORP = [
    { id: 'b1', name: 'Main — Riyadh', address: 'King Fahd Rd', status: 'active' },
    { id: 'b2', name: 'North — Jeddah', address: 'Al Madinah Rd', status: 'active' },
    { id: 'b3', name: 'East — Dammam', address: 'Prince Faisal St', status: 'active' },
];

export const MOCK_DEPARTMENTS_CORP = [
    { id: 'd1', name: 'Car Wash Services' }, { id: 'd2', name: 'Oil Change' },
    { id: 'd3', name: 'Lubrication' }, { id: 'd4', name: 'Brakes' }, { id: 'd5', name: 'Filters' },
    { id: 'd6', name: 'Tires' }, { id: 'd7', name: 'Electrical' }, { id: 'd8', name: 'Full Service' },
];

export const MOCK_PRODUCTS = [
    { id: 'p1', name: 'Car Wash Normal - Small', unit: 'service', sale_price: 25 },
    { id: 'p2', name: 'Car Wash Normal - Large', unit: 'service', sale_price: 45 },
    { id: 'p3', name: 'Castrol 10W30', unit: 'liter', sale_price: 15 },
    { id: 'p4', name: 'Oil Change - Standard', unit: 'service', sale_price: 120 },
    { id: 'p5', name: 'Brake Pads Front', unit: 'set', sale_price: 220 },
    { id: 'p6', name: 'Full Service Package', unit: 'service', sale_price: 850 },
];

export const MOCK_COMPANIES = [
    { id: 1, name: 'Safa Al-Makkah Corp', contact: 'Abdullah Al-Rashidi', mobile: '+966 55 111 2233', vat: '310123456700003', credit_limit: 50000, outstanding: 8400, tier: 'gold', branches: 3, vehicles: 8, allowed_branch_ids: ['b1', 'b2'] },
    { id: 2, name: 'Al-Nakheel Fleet Management', contact: 'Fatima Al-Zahrani', mobile: '+966 55 444 5566', vat: '300987654300001', credit_limit: 100000, outstanding: 12000, tier: 'gold', branches: 5, vehicles: 22, allowed_branch_ids: ['b1', 'b2', 'b3'] },
    { id: 3, name: 'Gulf Trading Co.', contact: 'Omar Suleiman', mobile: '+966 55 777 8899', vat: '310456789100002', credit_limit: 25000, outstanding: 2800, tier: 'silver', branches: 2, vehicles: 5, allowed_branch_ids: ['b1'] },
];

export const MOCK_VEHICLES = [
    { id: 1, company: 'Safa Al-Makkah Corp', plate: 'ABC 1234', make: 'Toyota', model: 'Land Cruiser', year: 2022, vin: '1HG-CM82633A', color: 'White', odometer: 45000 },
    { id: 2, company: 'Safa Al-Makkah Corp', plate: 'DEF 5678', make: 'Lexus', model: 'LX 570', year: 2021, vin: '2T1-BR32E04C', color: 'Black', odometer: 32000 },
    { id: 3, company: 'Al-Nakheel Fleet', plate: 'GHI 9012', make: 'GMC', model: 'Yukon', year: 2023, vin: '1GT-S2ZEJ2HZ', color: 'Silver', odometer: 12000 },
    { id: 4, company: 'Gulf Trading Co.', plate: 'JKL 3456', make: 'Ford', model: 'F-150', year: 2020, vin: '3FA-6P0KXEM', color: 'Red', odometer: 68000 },
];

export const MOCK_BOOKINGS = [
    { id: 'BK-2026-0142', company: 'Safa Al-Makkah Corp', vehicle: 'ABC 1234 — Toyota Land Cruiser', service: 'Full Service Package', date: '2026-03-12 09:00', branch: 'Main — Riyadh', status: 'confirmed', grand_total: 1250 },
    { id: 'BK-2026-0138', company: 'Al-Nakheel Fleet', vehicle: 'GHI 9012 — GMC Yukon', service: 'Oil Change + Tire Rotation', date: '2026-03-11 14:30', branch: 'North — Jeddah', status: 'pending', grand_total: 850 },
    { id: 'BK-2026-0130', company: 'Gulf Trading Co.', vehicle: 'JKL 3456 — Ford F-150', service: 'Brake Inspection', date: '2026-03-10 11:00', branch: 'Main — Riyadh', status: 'completed', grand_total: 420 },
];

export const MOCK_QUOTES = [
    { id: 'QT-2026-0042', company: 'Al-Nakheel Fleet', service: 'Annual Fleet Maintenance Package', validUntil: '2026-04-10', amount: 48000, discount: '15%', status: 'sent' },
    { id: 'QT-2026-0038', company: 'Safa Al-Makkah Corp', service: 'Q1 Service Bundle — 8 Vehicles', validUntil: '2026-03-31', amount: 24000, discount: '10%', status: 'accepted' },
];

export const MOCK_BILLS = [
    { id: 'MB-2026-03', company: 'All Clients', period: 'March 2026', period_month: 3, period_year: 2026, orders: 48, amount: 'SAR 28,400', total_amount: 28400, outstanding: 28400, status: 'pending', due: '2026-04-10' },
    { id: 'MB-2026-02', company: 'All Clients', period: 'February 2026', period_month: 2, period_year: 2026, orders: 52, total_amount: 31200, outstanding: 0, status: 'paid', due: '2026-03-10' },
    { id: 'MB-2026-01', company: 'All Clients', period: 'January 2026', period_month: 1, period_year: 2026, orders: 44, total_amount: 26800, outstanding: 0, status: 'paid', due: '2026-02-10' },
];

export const MOCK_CORP_ORDERS = [
    { id: 'o1', order_number: 'BK-2026-0142', created_date: '2026-03-12', grand_total: 1850, order_status: 'completed', company: 'Safa Al-Makkah Corp', vehicle: 'ABC 1234' },
    { id: 'o2', order_number: 'BK-2026-0138', created_date: '2026-03-11', grand_total: 680, order_status: 'in_progress', company: 'Al-Nakheel Fleet', vehicle: 'GHI 9012' },
    { id: 'o3', order_number: 'BK-2026-0130', created_date: '2026-03-10', grand_total: 420, order_status: 'completed', company: 'Gulf Trading Co.', vehicle: 'JKL 3456' },
    { id: 'o4', order_number: 'BK-2026-0122', created_date: '2026-03-05', grand_total: 2150, order_status: 'completed', company: 'Safa Al-Makkah Corp', vehicle: 'ABC 1234' },
    { id: 'o5', order_number: 'BK-2026-0118', created_date: '2026-02-28', grand_total: 920, order_status: 'completed', company: 'Al-Nakheel Fleet', vehicle: 'DEF 5678' },
];

export const WALLET_TXN = [
    { date: '2026-03-09', description: 'Top-up via Bank Transfer', type: 'credit', amount: 5000 },
    { date: '2026-03-08', description: 'Service Invoice #SI-2026-042', type: 'debit', amount: 850 },
    { date: '2026-03-07', description: 'Service Invoice #SI-2026-038', type: 'debit', amount: 1240 },
    { date: '2026-03-05', description: 'Top-up via Bank Transfer', type: 'credit', amount: 10000 },
];

export const PROMO_BANNERS = [
    { text: '🎉 20% off on Full Service – Valid till 28 Feb 2026', gradient: 'linear-gradient(90deg, #2563EB, #1E40AF)' },
    { text: '🚗 Free Car Wash on Oil Change – Corporate Special', gradient: 'linear-gradient(90deg, #059669, #047857)' },
    { text: '⚡ Priority Lane for Corporate Fleet – Book Now', gradient: 'linear-gradient(90deg, #7C3AED, #6D28D9)' },
];

export const WALLET_QUICK_AMOUNTS = [5000, 10000, 25000];

export const WALLET_PAYMENT_METHODS = [
    { val: 'bank_transfer', label: 'Bank Transfer', Icon: Building2 },
    { val: 'card', label: 'Credit/Debit Card', Icon: CreditCard },
];
