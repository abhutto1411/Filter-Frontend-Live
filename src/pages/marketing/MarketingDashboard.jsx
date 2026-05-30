import React, { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Wallet, Megaphone, DollarSign, TrendingUp } from 'lucide-react';
import { MarketingDashboardSkeleton } from './MarketingShimmer';
import { marketingGetDashboard } from '../../services/superAdminMarketingApi';

function formatSar(n, currency = 'SAR') {
    const v = Number(n);
    if (!Number.isFinite(v)) return `0 ${currency}`;
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M ${currency}`;
    if (v >= 1_000) return `${Math.round(v / 1_000)}K ${currency}`;
    return `${v.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${currency}`;
}

const StatCard = ({ title, value, icon: Icon, iconBg, iconColor }) => {
    return (
        <div
            style={{
                height: 80,
                background: '#FFFFFF',
                border: '1px solid #E5E7EB',
                borderRadius: 10,
                padding: '0 18px',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                boxSizing: 'border-box',
            }}
        >
            <div
                style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: iconBg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                }}
            >
                <Icon size={18} color={iconColor} strokeWidth={2} />
            </div>

            <div style={{ minWidth: 0 }}>
                <div
                    style={{
                        fontSize: 10,
                        fontWeight: 800,
                        color: '#64748B',
                        textTransform: 'uppercase',
                        letterSpacing: '1.8px',
                        marginBottom: 8,
                        lineHeight: 1,
                        whiteSpace: 'nowrap',
                    }}
                >
                    {title}
                </div>

                <div
                    style={{
                        fontSize: 19,
                        fontWeight: 900,
                        color: '#0F172A',
                        lineHeight: 1,
                        whiteSpace: 'nowrap',
                    }}
                >
                    {value}
                </div>
            </div>
        </div>
    );
};

export const MarketingDashboard = () => {
    const ctx = useOutletContext() || {};
    const marketingWorkshopId = ctx.marketingWorkshopId ?? '';

    const [dash, setDash] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');

        try {
            const res = await marketingGetDashboard({
                ...(marketingWorkshopId ? { workshopId: marketingWorkshopId } : {}),
                activePromotionsLimit: 8,
            });

            setDash(res?.success === false ? null : res);
        } catch (e) {
            setDash(null);
            setError(e?.message || 'Failed to load marketing dashboard.');
        } finally {
            setLoading(false);
        }
    }, [marketingWorkshopId]);

    useEffect(() => {
        load();
    }, [load]);

    const cards = dash?.cards;
    const currency = cards?.revenue?.currencyCode || 'SAR';

    const topCampaigns = Array.isArray(dash?.topCampaigns) ? dash.topCampaigns : [];
    const pendingRequests = dash?.pendingRequests ?? 0;

    const walletBalance = formatSar(cards?.walletBalance ?? 0, currency);
    const activeCampaigns = cards?.activeCampaigns ?? cards?.promotions ?? 0;
    const totalSpent = formatSar(cards?.totalSpent ?? 0, currency);
    const revenueGenerated = formatSar(cards?.revenue?.currentMonth ?? 0, currency);

    const roiPercent = cards?.roi ?? 0;
    const roiCampaignCount = cards?.roiCampaignCount ?? activeCampaigns ?? 0;
    const roiExpenseCount = cards?.roiExpenseCount ?? 0;

    if (loading) {
        return (
            <div
                className="marketing-dashboard-page"
                style={{
                    background: '#F3F4F6',
                    minHeight: 'calc(100vh - 50px)',
                    padding: '24px',
                    boxSizing: 'border-box',
                }}
            >
                {error ? (
                    <p style={{ color: '#B91C1C', fontWeight: 700, marginBottom: 16 }}>
                        {error}
                    </p>
                ) : null}

                <MarketingDashboardSkeleton />
            </div>
        );
    }

    return (
        <div
            className="marketing-dashboard-page"
            style={{
                background: '#F3F4F6',
                minHeight: 'calc(100vh - 50px)',
                padding: '24px',
                boxSizing: 'border-box',
            }}
        >
            {error ? (
                <p style={{ color: '#B91C1C', fontWeight: 700, marginBottom: 16 }}>
                    {error}
                </p>
            ) : null}

            <div
                className="marketing-stat-grid"
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                    gap: 16,
                    marginBottom: 20,
                }}
            >
                <StatCard
                    title="Wallet Balance"
                    value={walletBalance}
                    icon={Wallet}
                    iconBg="#FFFBEB"
                    iconColor="#D97706"
                />

                <StatCard
                    title="Active Campaigns"
                    value={activeCampaigns}
                    icon={Megaphone}
                    iconBg="#EFF6FF"
                    iconColor="#2563EB"
                />

                <StatCard
                    title="Total Spent"
                    value={totalSpent}
                    icon={DollarSign}
                    iconBg="#FEF2F2"
                    iconColor="#EF4444"
                />

                <StatCard
                    title="Revenue Generated"
                    value={revenueGenerated}
                    icon={TrendingUp}
                    iconBg="#ECFDF5"
                    iconColor="#10B981"
                />
            </div>

            <div
                style={{
                    background: '#111827',
                    borderRadius: 10,
                    minHeight: 116,
                    padding: '20px 18px',
                    marginBottom: 20,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxSizing: 'border-box',
                }}
            >
                <div>
                    <div
                        style={{
                            fontSize: 10,
                            fontWeight: 900,
                            color: '#FACC15',
                            textTransform: 'uppercase',
                            letterSpacing: '1.8px',
                            marginBottom: 14,
                        }}
                    >
                        Overall ROI
                    </div>

                    <div
                        style={{
                            fontSize: 30,
                            fontWeight: 900,
                            color: '#FFFFFF',
                            lineHeight: 1,
                            marginBottom: 12,
                        }}
                    >
                        {Number.isFinite(Number(roiPercent))
                            ? `${Number(roiPercent).toFixed(0)}%`
                            : '0%'}
                    </div>

                    <div
                        style={{
                            fontSize: 12,
                            color: '#CBD5E1',
                            letterSpacing: '0.2px',
                        }}
                    >
                        Based on {roiCampaignCount} campaign
                        {roiCampaignCount !== 1 ? 's' : ''} · {roiExpenseCount} expense{' '}
                        {roiExpenseCount !== 1 ? 'entries' : 'entry'}
                    </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                    <div
                        style={{
                            fontSize: 11,
                            color: '#94A3B8',
                            marginBottom: 12,
                        }}
                    >
                        Pending Requests
                    </div>

                    <div
                        style={{
                            fontSize: 28,
                            fontWeight: 900,
                            color: '#FACC15',
                            lineHeight: 1,
                        }}
                    >
                        {pendingRequests}
                    </div>
                </div>
            </div>

            <div
                style={{
                    width: '100%',
                    maxWidth: 538,
                    minHeight: 116,
                    background: '#FFFFFF',
                    border: '1px solid #E5E7EB',
                    borderRadius: 10,
                    padding: '18px 16px 22px',
                    boxSizing: 'border-box',
                }}
            >
                <div
                    style={{
                        fontSize: 14,
                        fontWeight: 800,
                        color: '#111827',
                        marginBottom: 22,
                    }}
                >
                    Top Campaigns
                </div>

                {topCampaigns.length === 0 ? (
                    <div
                        style={{
                            color: '#9CA3AF',
                            fontSize: 12,
                            padding: '4px 0',
                        }}
                    >
                        No campaigns found
                    </div>
                ) : (
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 14,
                        }}
                    >
                        {topCampaigns.map((c, i) => {
                            const campaignName = c.name ?? c.title ?? '—';
                            const platform = c.platform ?? c.type ?? 'Meta';
                            const status = c.status ?? 'Active';

                            return (
                                <div
                                    key={c.id ?? i}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: 20,
                                    }}
                                >
                                    <div style={{ minWidth: 0 }}>
                                        <div
                                            style={{
                                                fontSize: 13,
                                                fontWeight: 800,
                                                color: '#111827',
                                                lineHeight: 1.2,
                                                marginBottom: 4,
                                            }}
                                        >
                                            {campaignName}
                                        </div>

                                        <div
                                            style={{
                                                fontSize: 11,
                                                color: '#2563EB',
                                                lineHeight: 1.2,
                                            }}
                                        >
                                            {platform} · {status}
                                        </div>
                                    </div>

                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                        <div
                                            style={{
                                                fontSize: 13,
                                                fontWeight: 800,
                                                color: '#10B981',
                                                marginBottom: 4,
                                            }}
                                        >
                                            {formatSar(c.revenue ?? 0, currency)}
                                        </div>

                                        <div
                                            style={{
                                                fontSize: 10,
                                                color: '#9CA3AF',
                                            }}
                                        >
                                            Revenue
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <style>
                {`
                    .marketing-dashboard-page {
                        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                    }

                    @media (max-width: 1100px) {
                        .marketing-stat-grid {
                            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
                        }
                    }

                    @media (max-width: 640px) {
                        .marketing-dashboard-page {
                            padding: 16px !important;
                        }

                        .marketing-stat-grid {
                            grid-template-columns: 1fr !important;
                        }
                    }
                `}
            </style>
        </div>
    );
};