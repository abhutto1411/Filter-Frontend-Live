import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, ChevronRight, TrendingUp, Users, Receipt, Wallet } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import PayoutModal from '../../components/PayoutModal';
import { rfT, rfStatusKey } from '../../utils/referrerPortalI18n';
import { formatRuleValue, referrerWalletFromOverview, rfBadgeClass, useReferrerPortal } from './useReferrerPortal';
import {
    referrerPortalCreatePayout,
    referrerPortalGetNotifications,
    referrerPortalGetReports,
    referrerPortalListReferrals,
} from '../../services/referrerPortalApi';

function formatSar(locale, value) {
    const n = Number(value);
    const amount = Number.isFinite(n) ? n.toFixed(2) : '0.00';
    return locale === 'ar' ? `ر.س ${amount}` : `SAR ${amount}`;
}

export default function ReferrerDashboard() {
    const navigate = useNavigate();
    const { locale, displayName, overview, reloadOverview, isCommunity } = useReferrerPortal();
    const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
    const [payoutAmount, setPayoutAmount] = useState('');
    const [payoutError, setPayoutError] = useState('');
    const [payoutSubmitting, setPayoutSubmitting] = useState(false);
    const [payoutSuccess, setPayoutSuccess] = useState('');
    const [referrals, setReferrals] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [monthly, setMonthly] = useState([]);
    const firstName = String(displayName || '').split(' ')[0] || '';
    const commission = overview?.commissionRule;
    const benefit = overview?.benefitRule;
    const iban = overview?.profile?.iban || '';
    const stats = overview?.stats || {};
    const wallet = referrerWalletFromOverview(overview);

    useEffect(() => {
        referrerPortalListReferrals()
            .then((res) => setReferrals(Array.isArray(res?.referrals) ? res.referrals.slice(0, 4) : []))
            .catch(() => setReferrals([]));
        referrerPortalGetNotifications()
            .then((res) => setNotifications(Array.isArray(res?.notifications) ? res.notifications.slice(0, 3) : []))
            .catch(() => setNotifications([]));
        referrerPortalGetReports()
            .then((res) => setMonthly(Array.isArray(res?.monthly) ? res.monthly : []))
            .catch(() => setMonthly([]));
    }, []);

    const submitPayout = async () => {
        const amount = Number(payoutAmount);
        if (!Number.isFinite(amount) || amount <= 0) {
            setPayoutError(rfT(locale, 'payout.amountRequired'));
            return;
        }
        if (amount > wallet.unpaid + 0.005) {
            setPayoutError(rfT(locale, 'payout.exceedsBalance', { amount: wallet.unpaid.toFixed(2) }));
            return;
        }
        setPayoutSubmitting(true);
        setPayoutError('');
        try {
            await referrerPortalCreatePayout({ amount, method: 'bank' });
            setIsPayoutModalOpen(false);
            setPayoutAmount('');
            setPayoutSuccess(rfT(locale, 'payout.success'));
            await reloadOverview?.();
        } catch (err) {
            setPayoutError(err?.message || rfT(locale, 'payout.error'));
        } finally {
            setPayoutSubmitting(false);
        }
    };

    const statCards = isCommunity
        ? [
            { labelKey: 'stat.discountTotal', value: formatSar(locale, stats.discountTotal), icon: TrendingUp },
            { labelKey: 'stat.invoiceTotal', value: formatSar(locale, stats.invoiceTotal), icon: Receipt },
            { labelKey: 'stat.referrals', value: String(stats.referrals || 0), icon: Users },
            { labelKey: 'stat.orders', value: String(stats.orders || 0), icon: Wallet },
        ]
        : [
            { labelKey: 'stat.commissionTotal', value: formatSar(locale, stats.commissionTotal), icon: TrendingUp },
            { labelKey: 'stat.invoiceTotal', value: formatSar(locale, stats.invoiceTotal), icon: Receipt },
            { labelKey: 'stat.referrals', value: String(stats.referrals || 0), icon: Users },
            { labelKey: 'stat.orders', value: String(stats.orders || 0), icon: Wallet },
        ];

    return (
        <div className="rf-page">
            <PayoutModal
                isOpen={isPayoutModalOpen}
                onClose={() => setIsPayoutModalOpen(false)}
                balance={wallet.unpaid.toFixed(2)}
                iban={iban}
                locale={locale}
                amount={payoutAmount}
                onAmountChange={setPayoutAmount}
                onSubmit={submitPayout}
                submitting={payoutSubmitting}
                error={payoutError}
            />

            <div className="rf-welcome-row">
                <div>
                    {payoutSuccess ? <p className="rf-page-lead">{payoutSuccess}</p> : null}
                    <h2>
                        {firstName
                            ? rfT(locale, 'dash.welcome', { name: firstName })
                            : rfT(locale, 'dash.welcomeGuest')}
                    </h2>
                    <p>{rfT(locale, isCommunity ? 'dash.subtitleCommunity' : 'dash.subtitle')}</p>
                </div>
                {!isCommunity ? (
                    <div className="rf-actions-bar">
                        <button
                            type="button"
                            className="rf-btn-outline"
                            onClick={() => {
                                setPayoutError('');
                                setIsPayoutModalOpen(true);
                            }}
                        >
                            <CreditCard size={16} />
                            {rfT(locale, 'dash.requestPayout')}
                        </button>
                    </div>
                ) : null}
            </div>

            <div className="rf-split-grid" style={{ marginBottom: 4 }}>
                {!isCommunity ? (
                    <div className="rf-card">
                        <div className="rf-card-header">
                            <h3 className="rf-card-title">{rfT(locale, 'dash.yourCommission')}</h3>
                        </div>
                        <p className="rf-stat-value" style={{ fontSize: '1.4rem' }}>
                            {commission ? formatRuleValue(commission, 'commission') : rfT(locale, 'dash.noRules')}
                        </p>
                    </div>
                ) : null}
                <div className="rf-card">
                    <div className="rf-card-header">
                        <h3 className="rf-card-title">{rfT(locale, 'dash.customerGets')}</h3>
                    </div>
                    <p className="rf-stat-value" style={{ fontSize: '1.4rem' }}>
                        {benefit ? formatRuleValue(benefit, 'benefit') : rfT(locale, 'dash.noRules')}
                    </p>
                    {benefit ? (
                        <p className="rf-muted">
                            {rfT(locale, 'set.minOrder')}: {Number(benefit.minOrderValue || 0).toFixed(2)} SAR
                            {benefit.oncePerCustomer ? ` · ${rfT(locale, 'set.once')}` : ''}
                        </p>
                    ) : null}
                </div>
            </div>

            <div className="rf-stats-grid">
                {statCards.map((stat) => (
                    <div key={stat.labelKey} className="rf-stat-card">
                        <div className="rf-stat-header">
                            <div className="rf-stat-icon">
                                <stat.icon size={20} />
                            </div>
                        </div>
                        <p className="rf-stat-value">{stat.value}</p>
                        <p className="rf-stat-label">{rfT(locale, stat.labelKey)}</p>
                    </div>
                ))}
            </div>

            <div className="rf-split-grid">
                <div className="rf-card">
                    <div className="rf-card-header">
                        <h3 className="rf-card-title">{rfT(locale, isCommunity ? 'dash.discountTrend' : 'dash.earningsTrend')}</h3>
                    </div>
                    <div className="rf-chart-container">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={monthly.length ? monthly : [{ month: '—', earnings: 0, discount: 0 }]}>
                                <defs>
                                    <linearGradient id="colorGold" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.18} />
                                        <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-light)" />
                                <XAxis
                                    dataKey="month"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 12, fill: 'var(--color-text-faint)' }}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 12, fill: 'var(--color-text-faint)' }}
                                />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: 'var(--shadow-premium)' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey={isCommunity ? 'discount' : 'earnings'}
                                    stroke="var(--color-primary)"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorGold)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="rf-card">
                    <div className="rf-card-header">
                        <h3 className="rf-card-title">{rfT(locale, 'dash.recentNotifs')}</h3>
                        <button
                            type="button"
                            className="rf-link"
                            onClick={() => navigate('/referrer-portal/notifications')}
                        >
                            {rfT(locale, 'dash.viewAll')}
                            <ChevronRight size={16} />
                        </button>
                    </div>
                    <div className="rf-notif-list">
                        {notifications.length === 0 ? (
                            <p className="rf-muted">{rfT(locale, 'notif.empty')}</p>
                        ) : (
                            notifications.map((notif) => (
                                <div key={notif.id} className="rf-notif-item">
                                    <p className="rf-notif-title">{rfT(locale, notif.titleKey)}</p>
                                    <p className="rf-notif-text">{rfT(locale, notif.textKey, notif.vars)}</p>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            <div className="rf-card">
                <div className="rf-card-header">
                    <h3 className="rf-card-title">{rfT(locale, 'dash.recentReferrals')}</h3>
                    <button
                        type="button"
                        className="rf-link"
                        onClick={() => navigate('/referrer-portal/my_referrals')}
                    >
                        {rfT(locale, 'dash.viewAll')}
                        <ChevronRight size={16} />
                    </button>
                </div>
                <div className="rf-table-container">
                    <table className="rf-table">
                        <thead>
                            <tr>
                                <th>{rfT(locale, 'table.customer')}</th>
                                <th>{rfT(locale, 'table.orders')}</th>
                                <th>{rfT(locale, 'table.status')}</th>
                                <th className="rf-num">{rfT(locale, isCommunity ? 'table.discount' : 'table.commission')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {referrals.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="rf-empty">{rfT(locale, 'list.empty')}</td>
                                </tr>
                            ) : (
                                referrals.map((ref) => (
                                    <tr
                                        key={ref.id}
                                        className="rf-row-click"
                                        onClick={() => navigate(`/referrer-portal/my_referrals/${ref.id}`)}
                                    >
                                        <td className="rf-name">{ref.name}</td>
                                        <td>{ref.orderCount || 0}</td>
                                        <td>
                                            <span className={rfBadgeClass(ref.status)}>
                                                {rfT(locale, rfStatusKey(ref.status) || ref.status)}
                                            </span>
                                        </td>
                                        <td className="rf-num">{formatSar(locale, isCommunity ? ref.discountTotal : ref.commissionTotal)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
