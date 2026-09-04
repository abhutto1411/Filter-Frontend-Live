import { useState, useEffect } from 'react';
import { FileText, Calendar, TrendingUp, Wallet, DollarSign, Car, CreditCard, BarChart3, ArrowLeft, ChevronRight, Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { coerceWalletFieldText, formatDateDescriptionBlob, formatWalletTxDate, normalizeWalletHistoryResponse } from '../../utils/walletHistory';

const REPORT_CATEGORIES = [
    { id: 'billing',    label: 'Monthly Billing Summary',       icon: FileText,   color: '#DBEAFE', textColor: '#1D4ED8' },
    { id: 'bookings',   label: 'Booking & Service History',     icon: Calendar,   color: '#D1FAE5', textColor: '#047857' },
    { id: 'quotations', label: 'Quotation History',             icon: TrendingUp, color: '#F3E8FF', textColor: '#7C3AED' },
    { id: 'wallet',     label: 'Wallet Transaction History',    icon: Wallet,     color: '#E0E7FF', textColor: '#4F46E5' },
    { id: 'savings',    label: 'Savings & Discount Report',     icon: DollarSign, color: '#FEF3C7', textColor: '#B45309' },
    { id: 'vehicles',   label: 'Vehicle-wise Usage Report',     icon: Car,        color: '#FFEDD5', textColor: '#C2410C' },
    { id: 'payments',   label: 'Payment History',               icon: CreditCard, color: '#FCE7F3', textColor: '#BE185D' },
];

const CUSTOM_REPORT_TYPES = [
    'Monthly billing Summary',
    'Booking and service history',
    'Quotation History',
    'Wallet Transaction History',
    'Savings and discount report',
    'Vehicle-wise usage Report',
    'Payment history',
];

function Spinner() {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Loader2 className="spin" size={28} style={{ color: 'var(--color-primary)' }}/></div>;
}

function useApi(path) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        apiFetch(path).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
    }, [path]);
    return { data, loading };
}

function KpiRow({ items }) {
    return (
        <div className="ws-kpi-grid" style={{ marginBottom: 20 }}>
            {items.map(k => (
                <div key={k.label} className="ws-kpi-card">
                    <div>
                        <p className="ws-kpi-label">{k.label}</p>
                        <p className="ws-kpi-value" style={{ color: k.color || 'var(--color-text-dark)' }}>{k.value}</p>
                        {k.sub && <p className="ws-kpi-sub">{k.sub}</p>}
                    </div>
                </div>
            ))}
        </div>
    );
}

function SectionHeader({ title }) {
    return <h3 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text-dark)', margin: '0 0 16px 0' }}>{title}</h3>;
}

function readMoneyValue(...values) {
    for (const value of values) {
        if (value == null || value === '') continue;
        const num = Number(value);
        if (Number.isFinite(num)) return num;
    }
    return null;
}

function resolveBookingInvoiceAmount(order) {
    return readMoneyValue(
        order?.salesOrder?.invoice?.totalAmount,
        order?.sales_order?.invoice?.totalAmount,
        order?.invoice?.totalAmount,
        order?.totalAmount,
        order?.grandTotal,
        order?.grand_total,
        order?.total,
        order?.amount,
    );
}

function formatSarAmount(amount) {
    return amount != null
        ? `SAR ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : '—';
}

// ─── BILLING ────────────────────────────────────────────────────────────────
function normalizePeriodsPayload(data) {
    if (!data || typeof data !== 'object') return [];
    if (Array.isArray(data.periods)) return data.periods;
    if (Array.isArray(data.data?.periods)) return data.data.periods;
    return [];
}

/** Match backend invoice month bucketing (UTC). */
function isUtcCalendarMonthNow(year, month) {
    const d = new Date();
    return year === d.getUTCFullYear() && month === d.getUTCMonth() + 1;
}

function BillingPeriodKpiGrid({ summary }) {
    const s = summary || {};
    const items = [
        { label: 'Total billed', value: `SAR ${Number(s.totalBilled ?? 0).toFixed(2)}`, Icon: DollarSign, iconClass: 'ws-kpi-icon--blue' },
        { label: 'Total paid', value: `SAR ${Number(s.totalPaid ?? 0).toFixed(2)}`, color: '#047857', Icon: CheckCircle2, iconClass: 'ws-kpi-icon--green' },
        { label: 'Outstanding', value: `SAR ${Number(s.outstandingBalance ?? 0).toFixed(2)}`, color: '#DC2626', Icon: AlertCircle, iconClass: 'ws-kpi-icon--red' },
        {
            label: 'Paid / partial / unpaid',
            value: `${s.paidCount ?? 0} / ${s.partialCount ?? 0} / ${s.unpaidCount ?? 0}`,
            Icon: BarChart3,
            iconClass: 'ws-kpi-icon--purple',
        },
    ];
    return (
        <div
            className="ws-kpi-grid"
            style={{
                margin: '16px 20px 12px',
                marginBottom: 4,
                gap: 16,
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            }}
        >
            {items.map((k) => {
                const Icon = k.Icon;
                return (
                    <div key={k.label} className="ws-kpi-card">
                        <div style={{ minWidth: 0 }}>
                            <p className="ws-kpi-label">{k.label}</p>
                            <p className="ws-kpi-value" style={k.color ? { color: k.color } : undefined}>
                                {k.value}
                            </p>
                        </div>
                        <div className={`ws-kpi-icon ${k.iconClass}`}>
                            <Icon size={24} strokeWidth={2} />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function BillingReportView() {
    const { data: periodsPayload, loading: pl } = useApi('/corporate/reports/monthly-billing-periods?limitMonths=60');

    const periods = normalizePeriodsPayload(periodsPayload);
    const hasCurrentUtcMonth = periods.some((p) => isUtcCalendarMonthNow(p.year, p.month));

    if (pl) return <Spinner/>;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SectionHeader title="Monthly billing by period" />
            <p style={{ margin: '-8px 0 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                Pay Monthly / Monthly Billing invoices grouped by invoice month (settlement: paid / partial / unpaid).
            </p>
            {periods.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 24, margin: 0, background: 'var(--color-bg-muted)', borderRadius: 12 }}>
                    No monthly-billing invoices yet.
                </p>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {periods.map((p, index) => {
                        const periodKey = `${p.year}-${p.month}`;
                        const isCurrentMonth = isUtcCalendarMonthNow(p.year, p.month);
                        const barStyle = {
                            padding: '14px 16px',
                            background: '#F8FAFC',
                            borderBottom: '1px solid var(--color-border-light)',
                            display: 'flex',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 10,
                        };
                        const headerInner = (
                            <>
                                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text-dark)' }}>{p.label || `Month ${p.month}/${p.year}`}</span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                    Due {p.dueDate || '—'} · {p.summary?.invoiceCount ?? 0} invoice(s)
                                </span>
                                <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                                    Billed SAR {Number(p.summary?.totalBilled ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · Outstanding{' '}
                                    <span style={{ color: '#DC2626' }}>
                                        SAR {Number(p.summary?.outstandingBalance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </span>
                            </>
                        );
                        const body = (
                            <div style={{ padding: '0 0 8px 0' }}>
                                <BillingPeriodKpiGrid summary={p.summary} />
                                <div style={{ overflow: 'auto', padding: '0 12px 12px' }}>
                                    <table className="ws-table">
                                        <thead>
                                            <tr>
                                                <th>Invoice #</th>
                                                <th>Date</th>
                                                <th>Booking</th>
                                                <th>Vehicle</th>
                                                <th>Branch</th>
                                                <th>Total</th>
                                                <th>Paid</th>
                                                <th>Due</th>
                                                <th>Settlement</th>
                                                <th>Invoice status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(p.invoices || []).map((inv) => (
                                                <tr key={inv.id}>
                                                    <td style={{ fontWeight: 600, color: '#2563EB' }}>{inv.invoiceNo}</td>
                                                    <td>{inv.date || '—'}</td>
                                                    <td>{inv.bookingCode || '—'}</td>
                                                    <td>{inv.vehicle || '—'}</td>
                                                    <td>{inv.branchName || '—'}</td>
                                                    <td>
                                                        <strong>SAR {Number(inv.totalAmount ?? 0).toFixed(2)}</strong>
                                                    </td>
                                                    <td>SAR {Number(inv.amountPaid ?? 0).toFixed(2)}</td>
                                                    <td>SAR {Number(inv.balanceDue ?? 0).toFixed(2)}</td>
                                                    <td>
                                                        <span
                                                            className={`ws-badge ${
                                                                inv.settlementStatus === 'paid'
                                                                    ? 'ws-badge--green'
                                                                    : inv.settlementStatus === 'partial'
                                                                      ? 'ws-badge--yellow'
                                                                      : 'ws-badge--gray'
                                                            }`}
                                                        >
                                                            {inv.settlementStatus || '—'}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span className="ws-badge ws-badge--blue">{inv.invoicePaymentStatus || '—'}</span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );

                        if (isCurrentMonth) {
                            return (
                                <section
                                    key={periodKey}
                                    className="ws-section"
                                    style={{ marginBottom: 0, padding: 0, borderRadius: 12, overflow: 'hidden' }}
                                    aria-label={`${p.label || periodKey} (current month)`}
                                >
                                    <div style={{ ...barStyle, cursor: 'default' }}>{headerInner}</div>
                                    {body}
                                </section>
                            );
                        }

                        return (
                            <details
                                key={periodKey}
                                className="ws-section"
                                style={{ marginBottom: 0, padding: 0, borderRadius: 12, overflow: 'hidden' }}
                                defaultOpen={!hasCurrentUtcMonth && index === 0}
                            >
                                <summary style={{ ...barStyle, cursor: 'pointer' }}>{headerInner}</summary>
                                {body}
                            </details>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ─── BOOKING HISTORY ─────────────────────────────────────────────────────────
function BookingHistoryView() {
    const [status, setStatus] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = () => {
        setLoading(true);
        const qs = new URLSearchParams({ limit: 100 });
        if (status) qs.set('status', status);
        if (startDate) qs.set('startDate', startDate);
        if (endDate) qs.set('endDate', endDate);
        apiFetch(`/corporate/bookings?${qs}`)
            .then((d) => setOrders(d.bookings || d.orders || d.data?.bookings || d.data || []))
            .catch(() => setOrders([]))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    const STATUS_BADGE = { submitted: 'ws-badge--blue', completed: 'ws-badge--green', in_progress: 'ws-badge--blue', cancelled: 'ws-badge--red', pending: 'ws-badge--yellow' };
    const completed = orders.filter(o => o.status === 'completed').length;
    const totalSpend = orders.reduce((s, o) => s + (resolveBookingInvoiceAmount(o) ?? 0), 0);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SectionHeader title="Booking & Service History"/>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div className="ws-field" style={{ margin: 0 }}><label>Status</label>
                    <select value={status} onChange={e => setStatus(e.target.value)} style={{ padding: '8px 10px' }}>
                        <option value="">All</option>
                        {['submitted','confirmed','in_progress','completed','cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                <div className="ws-field" style={{ margin: 0 }}><label>From</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ padding: '8px 10px' }}/></div>
                <div className="ws-field" style={{ margin: 0 }}><label>To</label><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ padding: '8px 10px' }}/></div>
                <button className="btn-portal" style={{ background: 'var(--color-text-dark)', color: '#fff', border: 'none' }} onClick={load}>Filter</button>
            </div>
            {loading ? <Spinner/> : (
                <>
                    <KpiRow items={[
                        { label: 'Total Bookings', value: orders.length },
                        { label: 'Completed',      value: completed, color: '#047857' },
                        { label: 'Other',          value: orders.length - completed },
                        { label: 'Total Spend',    value: `SAR ${totalSpend.toLocaleString()}`, color: '#2563EB' },
                    ]}/>
                    {orders.length === 0 ? <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 32 }}>No bookings found</p> : (
                        <div className="ws-section" style={{ marginBottom: 0, padding: 0, overflow: 'auto' }}>
                            <table className="ws-table"><thead><tr><th>Booking</th><th>Date</th><th>Vehicle</th><th>Branch</th><th>Status</th><th>Amount</th></tr></thead>
                            <tbody>
                                {orders.map((o, i) => (
                                    <tr key={o.id || i}>
                                        <td style={{ fontWeight: 600, color: '#2563EB' }}>{o.bookingCode || o.orderNumber || `#${o.id}`}</td>
                                        <td>{(() => {
                                            const raw = o.bookedFor || o.submittedAt || o.createdAt || o.created_at;
                                            return raw ? new Date(raw).toLocaleDateString('en-SA') : '—';
                                        })()}</td>
                                        <td>{o.vehicle?.plateNo || o.vehiclePlate || '—'}</td>
                                        <td>{o.branchName || o.branch?.name || '—'}</td>
                                        <td><span className={`ws-badge ${STATUS_BADGE[o.status] || 'ws-badge--gray'}`}>{(o.status || '—').replace(/_/g, ' ')}</span></td>
                                        <td>{formatSarAmount(resolveBookingInvoiceAmount(o))}</td>
                                    </tr>
                                ))}
                            </tbody></table>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

// ─── QUOTATIONS ──────────────────────────────────────────────────────────────
function normalizePriceQuotationsReportList(data) {
    if (!data || typeof data !== 'object') return [];
    if (Array.isArray(data.quotations)) return data.quotations;
    if (Array.isArray(data.items)) return data.items;
    return [];
}

function QuotationsReportView() {
    const { data: sumData, loading: sl } = useApi('/corporate/price-quotations/summary');
    const { data: listData, loading: ll } = useApi('/corporate/price-quotations?limit=50&offset=0');
    const s = sumData && typeof sumData === 'object' ? sumData : {};
    const quotes = normalizePriceQuotationsReportList(listData);
    const STATUS_STYLE = {
        approved: 'ws-badge--green',
        rejected: 'ws-badge--red',
        pending: 'ws-badge--yellow',
        sent: 'ws-badge--blue',
        draft: 'ws-badge--gray',
    };

    if (sl || ll) return <Spinner/>;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SectionHeader title="Price quotation history"/>
            <KpiRow items={[
                { label: 'Total', value: s.total ?? quotes.length },
                { label: 'Pending', value: s.pending ?? quotes.filter((q) => q.status === 'pending').length, color: '#D97706' },
                { label: 'Approved', value: s.approved ?? quotes.filter((q) => q.status === 'approved').length, color: '#047857' },
                { label: 'Rejected', value: s.rejected ?? quotes.filter((q) => q.status === 'rejected').length, color: '#DC2626' },
            ]}/>
            {quotes.length === 0 ? <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 32 }}>No quotation lines found</p> : (
                <div className="ws-section" style={{ marginBottom: 0, padding: 0, overflow: 'auto' }}>
                    <table className="ws-table"><thead><tr><th>ID</th><th>Submitted</th><th>Name</th><th>Quote</th><th>Status</th></tr></thead>
                    <tbody>
                        {quotes.map((q, i) => (
                            <tr key={q.id || i}>
                                <td style={{ fontWeight: 600, color: '#7C3AED' }}>#{q.id}</td>
                                <td>{q.submittedAt ? new Date(q.submittedAt).toLocaleDateString('en-SA') : '—'}</td>
                                <td>{q.name || '—'}</td>
                                <td>SAR {Number(q.quotationPrice ?? q.priceIncludingVat ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td><span className={`ws-badge ${STATUS_STYLE[String(q.status || '').toLowerCase()] || 'ws-badge--gray'}`}>{q.status || '—'}</span></td>
                            </tr>
                        ))}
                    </tbody></table>
                </div>
            )}
        </div>
    );
}

// ─── WALLET ──────────────────────────────────────────────────────────────────
function WalletReportView({ walletBalance }) {
    const { data: sumData, loading: sl } = useApi('/corporate/wallet/summary');
    const { data: histData, loading: hl } = useApi('/corporate/wallet/history?limit=50');
    const s = sumData?.summary || sumData || {};
    const txns = normalizeWalletHistoryResponse(histData);

    if (sl || hl) return <Spinner/>;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SectionHeader title="Wallet Transaction History"/>
            <KpiRow items={[
                { label: 'Current Balance', value: `SAR ${Number(walletBalance || s.balance || 0).toLocaleString()}`, color: '#6D28D9' },
                { label: 'Total Credits',   value: `SAR ${Number(s.totalCredits  ?? s.total_credits  ?? 0).toLocaleString()}`, color: '#047857' },
                { label: 'Total Debits',    value: `SAR ${Number(s.totalDebits   ?? s.total_debits   ?? 0).toLocaleString()}`, color: '#DC2626' },
                { label: 'Transactions',    value: s.count ?? s.totalTransactions ?? txns.length },
            ]}/>
            {txns.length === 0 ? <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 32 }}>No transactions found</p> : (
                <div className="ws-section" style={{ marginBottom: 0, padding: 0, overflow: 'auto' }}>
                    <table className="ws-table"><thead><tr><th>Date</th><th>Description</th><th>Amount</th><th>Type</th></tr></thead>
                    <tbody>
                        {txns.map((t, i) => {
                            const amount = parseFloat(t.amount ?? 0);
                            const typeLower = (t.type || '').toLowerCase();
                            // Backend sends invoice wallet usage as type "debit" with a positive amount; do not infer from amount alone.
                            const isCredit =
                                typeLower === 'credit' ||
                                (typeLower !== 'debit' && amount > 0);
                            const displayAbs = Math.abs(amount);
                            return (
                                <tr key={t.id || i}>
                                    <td>{formatWalletTxDate(t)}</td>
                                    <td>{coerceWalletFieldText(t.description ?? t.desc ?? t.note)}</td>
                                    <td style={{ fontWeight: 700, color: isCredit ? '#047857' : '#DC2626' }}>
                                        {isCredit ? '+' : '-'} SAR {displayAbs.toLocaleString()}
                                    </td>
                                    <td><span className={`ws-badge ${isCredit ? 'ws-badge--green' : 'ws-badge--red'}`}>{t.type || (isCredit ? 'credit' : 'debit')}</span></td>
                                </tr>
                            );
                        })}
                    </tbody></table>
                </div>
            )}
        </div>
    );
}

// ─── SAVINGS ─────────────────────────────────────────────────────────────────
function SavingsReportView() {
    const { data, loading } = useApi('/corporate/reports/savings');
    const d = data?.savings || data?.data || data || {};
    const byDept = d.byDepartment || d.departments || d.breakdown || [];

    if (loading) return <Spinner/>;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SectionHeader title="Savings & Discount Report"/>
            <KpiRow items={[
                { label: 'Normal Market Cost',  value: `SAR ${Number(d.normalCost  ?? d.normalTotal   ?? d.marketCost   ?? 0).toLocaleString()}` },
                { label: 'Your Corporate Cost', value: `SAR ${Number(d.yourCost    ?? d.corporateCost ?? d.totalSpent   ?? 0).toLocaleString()}`, color: '#1D4ED8' },
                { label: 'Total Savings',       value: `SAR ${Number(d.savings     ?? d.totalSavings  ?? 0).toLocaleString()}`, color: '#047857' },
                { label: 'Savings %',           value: `${Number(d.savingsPercent ?? d.percentage    ?? 0).toFixed(1)}%`, color: '#047857' },
            ]}/>
            {byDept.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {byDept.map((d, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, background: 'var(--color-bg-muted)', borderRadius: 10 }}>
                            <span style={{ fontWeight: 600 }}>{d.name || d.department || d.departmentName}</span>
                            <span style={{ fontWeight: 700, color: '#047857' }}>SAR {Number(d.saved || d.savings || d.amount || 0).toLocaleString()} saved</span>
                        </div>
                    ))}
                </div>
            )}
            {byDept.length === 0 && <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 16 }}>No breakdown data available</p>}
        </div>
    );
}

// ─── VEHICLES ────────────────────────────────────────────────────────────────
const VEHICLE_ORDER_STATUS_BADGE = {
    completed: 'ws-badge--green',
    invoiced: 'ws-badge--green',
    delivered: 'ws-badge--green',
    in_progress: 'ws-badge--blue',
    cancelled: 'ws-badge--red',
    draft: 'ws-badge--gray',
};

function VehicleUsageView() {
    const { data, loading } = useApi('/corporate/reports/vehicle-usage');
    const rawList = data?.vehicles ?? data?.data ?? data?.report;
    const vehicles = Array.isArray(rawList) ? rawList : [];

    const [detailOpen, setDetailOpen] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState('');
    const [detail, setDetail] = useState(null);

    const openVehicle = (id) => {
        if (id == null || id === '') return;
        setDetailOpen(true);
        setDetailLoading(true);
        setDetailError('');
        setDetail(null);
        apiFetch(`/corporate/reports/vehicle-usage/${encodeURIComponent(String(id))}`)
            .then(setDetail)
            .catch((e) => setDetailError(e.message || 'Failed to load orders'))
            .finally(() => setDetailLoading(false));
    };

    const closeDetail = () => {
        setDetailOpen(false);
        setDetail(null);
        setDetailError('');
    };

    if (loading) return <Spinner/>;
    const orders = detail?.orders || detail?.history || [];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SectionHeader title="Vehicle-wise Usage Report"/>
            <p style={{ margin: '-8px 0 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                Tap a vehicle card to see all orders (services) for that vehicle.
            </p>
            {vehicles.length === 0 ? <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 32 }}>No vehicle data found</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {vehicles.map((v, i) => {
                        const title =
                            (v.vehicleName && String(v.vehicleName).trim()) ||
                            `${v.make || ''} ${v.model || ''}`.trim() ||
                            'Vehicle';
                        const plate = v.plateNo || v.plate_no || v.plate || '—';
                        const lastLine = formatDateDescriptionBlob(v.lastService);
                        return (
                            <button
                                key={v.id || i}
                                type="button"
                                onClick={() => openVehicle(v.id)}
                                className="ws-section"
                                style={{
                                    marginBottom: 0,
                                    width: '100%',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    border: '1px solid var(--color-border)',
                                    background: '#fff',
                                    borderRadius: 16,
                                    padding: 14,
                                    transition: 'box-shadow 0.15s, border-color 0.15s',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.boxShadow = '0 4px 14px rgba(37,99,235,0.12)';
                                    e.currentTarget.style.borderColor = '#BFDBFE';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.boxShadow = 'none';
                                    e.currentTarget.style.borderColor = 'var(--color-border)';
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ width: 40, height: 40, borderRadius: 12, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Car size={20} style={{ color: '#2563EB' }}/></div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ fontWeight: 700, margin: 0, color: 'var(--color-text-dark)' }}>{title} — {plate}</p>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>
                                            {v.totalServices ?? v.serviceCount ?? v.services ?? 0} services · SAR {Number(v.totalSpend ?? v.totalSpent ?? v.spend ?? 0).toLocaleString()}
                                        </p>
                                    </div>
                                    {lastLine ? (
                                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textAlign: 'right', maxWidth: '42%', flexShrink: 0 }}>
                                            Last: {lastLine}
                                        </div>
                                    ) : (
                                        <ChevronRight size={18} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} aria-hidden />
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}

            {detailOpen && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="vehicle-orders-title"
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 1000,
                        background: 'rgba(15,23,42,0.45)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 16,
                    }}
                >
                    <div
                        className="ws-section"
                        style={{
                            maxWidth: 920,
                            width: '100%',
                            maxHeight: '90vh',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                            margin: 0,
                            padding: 0,
                            borderRadius: 16,
                            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '16px 18px', borderBottom: '1px solid var(--color-border-light)', background: '#F8FAFC' }}>
                            <div style={{ minWidth: 0 }}>
                                <h3 id="vehicle-orders-title" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text-dark)' }}>
                                    {detail?.vehicle?.vehicleName || 'Vehicle'} — {detail?.vehicle?.plateNo || '—'}
                                </h3>
                                {detail?.stats && (
                                    <p style={{ margin: '6px 0 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                                        {detail.stats.totalServices} orders · SAR {Number(detail.stats.totalSpend || 0).toLocaleString()} total
                                        {detail.stats.totalServices > 0 ? ` · avg SAR ${Number(detail.stats.averagePerService).toFixed(2)}` : ''}
                                    </p>
                                )}
                            </div>
                            <button type="button" onClick={closeDetail} aria-label="Close" style={{ border: 'none', background: '#E2E8F0', borderRadius: 10, padding: 8, cursor: 'pointer', lineHeight: 0, flexShrink: 0 }}>
                                <X size={18} />
                            </button>
                        </div>
                        <div style={{ padding: 12, overflow: 'auto', flex: 1 }}>
                            {detailLoading && <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><Loader2 className="spin" size={28} style={{ color: 'var(--color-primary)' }}/></div>}
                            {detailError && !detailLoading && <p style={{ color: '#DC2626', padding: 16, margin: 0 }}>{detailError}</p>}
                            {!detailLoading && !detailError && orders.length === 0 && (
                                <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 32, margin: 0 }}>No orders for this vehicle.</p>
                            )}
                            {!detailLoading && !detailError && orders.length > 0 && (
                                <div style={{ overflow: 'auto' }}>
                                    <table className="ws-table">
                                        <thead>
                                            <tr>
                                                <th>Date</th>
                                                <th>Booking</th>
                                                <th>Invoice #</th>
                                                <th>Branch</th>
                                                <th>Amount</th>
                                                <th>Status</th>
                                                <th>Items</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {orders.map((o, idx) => {
                                                const st = String(o.status || '').toLowerCase().replace(/\s+/g, '_');
                                                const badge = VEHICLE_ORDER_STATUS_BADGE[st] || 'ws-badge--yellow';
                                                return (
                                                    <tr key={o.id || idx}>
                                                        <td>{o.date ? new Date(o.date).toLocaleDateString('en-SA') : '—'}</td>
                                                        <td style={{ fontWeight: 600, color: '#2563EB' }}>
                                                            {o.bookingCode
                                                                ? o.bookingCode
                                                                : (o.source && String(o.source).startsWith('walk_in'))
                                                                    ? `Walk-in · SO-${o.id}`
                                                                    : `SO-${o.id}`}
                                                        </td>
                                                        <td>{o.invoiceNo || '—'}</td>
                                                        <td>{o.branch || '—'}</td>
                                                        <td><strong>SAR {Number(o.amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td>
                                                        <td><span className={`ws-badge ${badge}`}>{(o.status || '—').replace(/_/g, ' ')}</span></td>
                                                        <td style={{ fontSize: '0.8125rem', color: 'var(--color-text-body)', maxWidth: 220 }}>{o.description || o.service || '—'}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── PAYMENTS ────────────────────────────────────────────────────────────────
function PaymentsReportView() {
    const [method, setMethod] = useState('All');
    const [status, setStatus] = useState('All');
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = () => {
        setLoading(true);
        const qs = new URLSearchParams({ method, status });
        apiFetch(`/corporate/reports/payments?${qs}`)
            .then(d => setPayments(d.payments || d.data || d.history || []))
            .catch(() => setPayments([]))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SectionHeader title="Payment History"/>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div className="ws-field" style={{ margin: 0 }}><label>Method</label>
                    <select value={method} onChange={e => setMethod(e.target.value)} style={{ padding: '8px 10px' }}>
                        {['All','Wallet','Credit Card','Bank Transfer','Cash'].map(m => <option key={m}>{m}</option>)}
                    </select>
                </div>
                <div className="ws-field" style={{ margin: 0 }}><label>Status</label>
                    <select value={status} onChange={e => setStatus(e.target.value)} style={{ padding: '8px 10px' }}>
                        {['All','Paid','Success','Pending','Failed'].map(s => <option key={s}>{s}</option>)}
                    </select>
                </div>
                <button className="btn-portal" style={{ background: 'var(--color-text-dark)', color: '#fff', border: 'none' }} onClick={load}>Filter</button>
            </div>
            {loading ? <Spinner/> : payments.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 32 }}>No payments found</p>
            ) : (
                <div className="ws-section" style={{ marginBottom: 0, padding: 0, overflow: 'auto' }}>
                    <table className="ws-table"><thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Invoice #</th><th>Status</th></tr></thead>
                    <tbody>
                        {payments.map((p, i) => (
                            <tr key={p.id || i}>
                                <td>{p.date || p.createdAt ? new Date(p.date || p.createdAt).toLocaleDateString('en-SA') : '—'}</td>
                                <td><strong>SAR {Number(p.amount || 0).toLocaleString()}</strong></td>
                                <td>{p.method || p.paymentMethod || '—'}</td>
                                <td style={{ color: '#2563EB' }}>{p.invoiceNo || p.invoiceNumber || p.invoice || p.reference || '—'}</td>
                                <td><span className={`ws-badge ${['paid','success'].includes((p.status||'').toLowerCase()) ? 'ws-badge--green' : 'ws-badge--yellow'}`}>{p.status || '—'}</span></td>
                            </tr>
                        ))}
                    </tbody></table>
                </div>
            )}
        </div>
    );
}

// ─── CUSTOM REPORT ───────────────────────────────────────────────────────────
const SAR = (v) =>
    `SAR ${Number(v ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (raw) => {
    if (!raw) return '—';
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? String(raw) : d.toLocaleDateString('en-SA');
};
const titleCase = (s) =>
    String(s ?? '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());

/** Render custom report result as a typed table (replaces raw JSON dump). */
function CustomReportResult({ result }) {
    const rows = Array.isArray(result?.data) ? result.data : [];
    const empty = rows.length === 0;
    const cellTd = { padding: '10px 12px', verticalAlign: 'middle', fontSize: '0.8125rem' };
    const cellTh = { padding: '10px 12px', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' };

    const headerInfo = (
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            <strong style={{ fontSize: '0.9375rem', color: '#0f172a' }}>{result.type}</strong>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                {fmtDate(result.from)} → {fmtDate(result.to)} · {result.count ?? rows.length} {rows.length === 1 ? 'row' : 'rows'}
            </span>
        </div>
    );

    if (empty) {
        return (
            <div style={{ marginTop: 16, padding: 16, background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                {headerInfo}
                <p style={{ color: '#64748b', textAlign: 'center', padding: 24, margin: 0 }}>
                    No data found for this period.
                </p>
            </div>
        );
    }

    let cols;
    switch (result.type) {
        case 'Monthly billing Summary':
            cols = [
                { h: 'Invoice', r: (x) => <span style={{ fontWeight: 700, color: '#2563EB' }}>{x.invoiceNo}</span> },
                { h: 'Date', r: (x) => fmtDate(x.date) },
                { h: 'Vehicle', r: (x) => x.vehicle },
                { h: 'Description', r: (x) => x.description },
                { h: 'Subtotal', r: (x) => SAR(x.subtotal) },
                { h: 'VAT', r: (x) => SAR(x.vatAmount) },
                { h: 'Discount', r: (x) => SAR(x.discountAmount) },
                { h: 'Total', r: (x) => <strong>{SAR(x.totalAmount)}</strong> },
                { h: 'Status', r: (x) => <span className={`ws-badge ${x.paymentStatus === 'paid' ? 'ws-badge--green' : x.paymentStatus === 'partial' ? 'ws-badge--yellow' : 'ws-badge--gray'}`}>{titleCase(x.paymentStatus)}</span> },
            ];
            break;
        case 'Booking and service history':
            cols = [
                { h: 'Ref', r: (x) => <span style={{ fontWeight: 700, color: '#2563EB' }}>{x.id}</span> },
                { h: 'Date', r: (x) => fmtDate(x.date) },
                { h: 'Type', r: (x) => x.type },
                { h: 'Vehicle', r: (x) => x.vehicle },
                { h: 'Department', r: (x) => x.department },
                { h: 'Branch', r: (x) => x.branch },
                { h: 'Amount', r: (x) => <strong>{SAR(x.amount)}</strong> },
                { h: 'Status', r: (x) => <span className={`ws-badge ${['completed','invoiced','delivered','approved'].includes((x.status||'').toLowerCase()) ? 'ws-badge--green' : ['cancelled','rejected'].includes((x.status||'').toLowerCase()) ? 'ws-badge--red' : 'ws-badge--blue'}`}>{titleCase(x.status)}</span> },
            ];
            break;
        case 'Quotation History':
            cols = [
                { h: 'Quotation', r: (x) => <span style={{ fontWeight: 700, color: '#2563EB' }}>{x.quotationNo}</span> },
                { h: 'Date', r: (x) => fmtDate(x.date) },
                { h: 'Vehicle', r: (x) => x.vehicle },
                { h: 'Branch', r: (x) => x.branch },
                { h: 'Item', r: (x) => x.productService },
                { h: 'Quoted Price', r: (x) => <strong>{SAR(x.quotedPrice)}</strong> },
                { h: 'Status', r: (x) => <span className={`ws-badge ${x.status === 'APPROVED' ? 'ws-badge--green' : x.status === 'REJECTED' ? 'ws-badge--red' : 'ws-badge--yellow'}`}>{x.status}</span> },
            ];
            break;
        case 'Wallet Transaction History':
            cols = [
                { h: 'Date', r: (x) => fmtDate(x.date) },
                { h: 'Type', r: (x) => <span className={`ws-badge ${x.type === 'credit' ? 'ws-badge--green' : 'ws-badge--red'}`}>{titleCase(x.type)}</span> },
                { h: 'Amount', r: (x) => <strong style={{ color: x.type === 'credit' ? '#047857' : '#B91C1C' }}>{x.type === 'credit' ? '+' : '-'} {SAR(x.amount)}</strong> },
                { h: 'Description', r: (x) => x.description || '—' },
                { h: 'Reference', r: (x) => x.referenceId || '—' },
                { h: 'Status', r: (x) => <span className={`ws-badge ${x.status === 'completed' ? 'ws-badge--green' : 'ws-badge--yellow'}`}>{titleCase(x.status)}</span> },
            ];
            break;
        case 'Savings and discount report':
            cols = [
                { h: 'Invoice', r: (x) => <span style={{ fontWeight: 700, color: '#2563EB' }}>{x.invoiceNo}</span> },
                { h: 'Date', r: (x) => fmtDate(x.date) },
                { h: 'Vehicle', r: (x) => x.vehicle },
                { h: 'Market Price', r: (x) => SAR(x.marketPrice) },
                { h: 'Corporate Price', r: (x) => SAR(x.corporatePrice) },
                { h: 'Savings', r: (x) => <strong style={{ color: '#047857' }}>{SAR(x.savings)}</strong> },
            ];
            break;
        case 'Vehicle-wise usage Report':
            cols = [
                { h: 'Plate', r: (x) => <span style={{ fontWeight: 700 }}>{x.plateNo}</span> },
                { h: 'Make', r: (x) => x.make || '—' },
                { h: 'Model', r: (x) => x.model || '—' },
                { h: 'Services', r: (x) => x.usageCount ?? 0 },
                { h: 'Total Spent', r: (x) => <strong>{SAR(x.totalSpent)}</strong> },
            ];
            break;
        case 'Payment history':
            cols = [
                { h: 'Date', r: (x) => fmtDate(x.paidAt || x.date) },
                { h: 'Method', r: (x) => titleCase(x.method) },
                { h: 'Amount', r: (x) => <strong>{SAR(x.amount)}</strong> },
                { h: 'Reference', r: (x) => x.referenceNote || '—' },
            ];
            break;
        default:
            // Generic dump fallback for unknown shapes.
            return (
                <div style={{ marginTop: 16, padding: 16, background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                    {headerInfo}
                    <pre style={{ fontSize: '0.75rem', overflow: 'auto', maxHeight: 300, margin: 0 }}>{JSON.stringify(rows, null, 2)}</pre>
                </div>
            );
    }

    const summary = result.summary && typeof result.summary === 'object' ? result.summary : null;

    return (
        <div style={{ marginTop: 16, padding: 16, background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0' }}>
            {headerInfo}
            {summary ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
                    {Object.entries(summary).map(([k, v]) => (
                        <div key={k} style={{ padding: '8px 12px', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0', minWidth: 130 }}>
                            <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
                                {titleCase(k)}
                            </div>
                            <div style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
                                {typeof v === 'number' && k.toLowerCase().includes('spent') ? SAR(v) : String(v)}
                            </div>
                        </div>
                    ))}
                </div>
            ) : null}
            <div style={{ overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: 10 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>{cols.map((c) => <th key={c.h} style={cellTh}>{c.h}</th>)}</tr>
                    </thead>
                    <tbody>
                        {rows.map((row, i) => (
                            <tr key={row.id ?? i} style={{ borderTop: i === 0 ? 'none' : '1px solid #f1f5f9' }}>
                                {cols.map((c, j) => (
                                    <td key={`${c.h}-${j}`} style={cellTd}>{c.r(row)}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function CustomReportSection() {
    const [type, setType] = useState(CUSTOM_REPORT_TYPES[0]);
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const generate = async () => {
        if (!fromDate || !toDate) { setError('Please select both dates'); return; }
        setLoading(true); setError(''); setResult(null);
        try {
            const qs = new URLSearchParams({ fromDate, toDate, type });
            const data = await apiFetch(`/corporate/reports/custom?${qs}`);
            setResult(data);
        } catch (e) {
            setError(e.message || 'Failed to generate report');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="ws-section" style={{ marginTop: 20, borderStyle: 'dashed' }}>
            <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: 8 }}><BarChart3 size={16}/> Generate Custom Report</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                <select value={type} onChange={e => setType(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: '0.8125rem', minWidth: 200 }}>
                    {CUSTOM_REPORT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: '0.8125rem' }}/>
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: '0.8125rem' }}/>
                <button type="button" className="btn-portal" style={{ background: 'var(--color-text-dark)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: 6 }} onClick={generate} disabled={loading}>
                    {loading && <Loader2 size={14} className="spin"/>}<BarChart3 size={14}/> Generate
                </button>
            </div>
            {error && <p style={{ color: '#DC2626', fontSize: '0.8125rem', margin: '8px 0 0 0' }}>{error}</p>}
            {result ? <CustomReportResult result={result}/> : null}
        </div>
    );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function CorporateReports({ walletBalance = 0 }) {
    const [activeReport, setActiveReport] = useState('overview');
    const { data: summaryData, loading: summaryLoading } = useApi('/corporate/reports/summary');
    const s = summaryData?.summary || summaryData?.kpis || summaryData || {};

    if (activeReport !== 'overview') {
        return (
            <div>
                <button type="button" onClick={() => setActiveReport('overview')}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: '0.875rem', color: '#2563EB', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>
                    <ArrowLeft size={16}/> Back to Reports
                </button>
                {activeReport === 'billing'    && <BillingReportView/>}
                {activeReport === 'bookings'   && <BookingHistoryView/>}
                {activeReport === 'quotations' && <QuotationsReportView/>}
                {activeReport === 'wallet'     && <WalletReportView walletBalance={walletBalance}/>}
                {activeReport === 'savings'    && <SavingsReportView/>}
                {activeReport === 'vehicles'   && <VehicleUsageView/>}
                {activeReport === 'payments'   && <PaymentsReportView/>}
            </div>
        );
    }

    return (
        <div>
            <div className="ws-page-header" style={{ flexWrap: 'wrap', gap: 12 }}>
                <div><h2 className="ws-page-title">Reports & Analytics</h2><p className="ws-page-sub">Corporate account analytics</p></div>
            </div>

            {summaryLoading ? <Spinner/> : (
                <KpiRow items={[
                    { label: 'Total Spent (All time)', value: `SAR ${Number(s.totalSpent       ?? s.total_spent       ?? 0).toLocaleString()}`, color: '#2563EB' },
                    { label: 'This Month',             value: `SAR ${Number(s.thisMonthAmount  ?? s.thisMonth         ?? s.monthlyTotal ?? 0).toLocaleString()}` },
                    { label: 'Total Savings',          value: `SAR ${Number(s.totalSavings     ?? s.savings           ?? 0).toLocaleString()}`, color: '#047857' },
                    { label: 'Wallet Used',            value: `SAR ${Number(s.walletUsed       ?? s.wallet_used       ?? 0).toLocaleString()}`, color: '#7C3AED' },
                ]}/>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                {REPORT_CATEGORIES.map(r => (
                    <button key={r.id} type="button" onClick={() => setActiveReport(r.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 16, borderRadius: 12, border: '1px solid var(--color-border)', background: '#fff', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: r.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><r.icon size={20} style={{ color: r.textColor }}/></div>
                        <span style={{ flex: 1, fontWeight: 600, fontSize: '0.9375rem', color: 'var(--color-text-dark)' }}>{r.label}</span>
                        <ChevronRight size={18} style={{ color: 'var(--color-text-muted)' }}/>
                    </button>
                ))}
            </div>

            <CustomReportSection/>
        </div>
    );
}
