import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { AlertCircle, DollarSign, Megaphone, TrendingUp, Wallet } from 'lucide-react';
import { MarketingDashboardSkeleton } from './MarketingShimmer';
import { marketingGetDashboard } from '../../services/superAdminMarketingApi';

const DEFAULT_CURRENCY = 'SAR';

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function firstNumber(...values) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }

  return 0;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function formatSar(value, currency = DEFAULT_CURRENCY) {
  const n = toNumber(value);

  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M ${currency}`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K ${currency}`;

  return `${n.toLocaleString(undefined, {
    maximumFractionDigits: 0,
  })} ${currency}`;
}

function formatPlainNumber(value) {
  return toNumber(value).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  });
}

const StatCard = ({ title, value, icon: Icon, iconBg, iconColor }) => {
  return (
    <div className="md-stat-card">
      <div className="md-stat-icon" style={{ background: iconBg }}>
        <Icon size={18} color={iconColor} strokeWidth={2.2} />
      </div>

      <div className="md-stat-info">
        <div className="md-stat-title">{title}</div>
        <div className="md-stat-value">{value}</div>
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

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const res = await marketingGetDashboard({
        ...(marketingWorkshopId ? { workshopId: marketingWorkshopId } : {}),
        activePromotionsLimit: 8,
      });

      if (res?.success === false) {
        throw new Error(res?.message || 'Dashboard request failed.');
      }

      setDash(res?.data || res || {});
    } catch (e) {
      setDash(null);
      setError(e?.message || 'Failed to load marketing dashboard.');
    } finally {
      setLoading(false);
    }
  }, [marketingWorkshopId]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const data = useMemo(() => {
    const response = dash || {};
    const cards = response.cards || response.summary || {};
    const revenue = cards.revenue || {};
    const wallet = response.wallet || cards.wallet || {};

    const currency =
      revenue.currencyCode ||
      cards.currencyCode ||
      wallet.currencyCode ||
      response.currencyCode ||
      DEFAULT_CURRENCY;

    const walletBalance = firstNumber(
      cards.walletBalance,
      cards.balance,
      wallet.balance,
      wallet.currentBalance,
      wallet.current_balance,
      response.walletBalance,
      response.balance
    );

    const activeCampaigns = firstNumber(
      cards.activeCampaigns,
      cards.active_campaigns,
      response.activeCampaigns,
      response.active_campaigns,
      response.campaignsCount,
      cards.promotions
    );

    const totalSpent = firstNumber(
      cards.totalSpent,
      cards.totalSpend,
      cards.spend,
      response.totalSpent,
      response.totalSpend,
      response.spend
    );

    const revenueGenerated = firstNumber(
      revenue.currentMonth,
      revenue.current_month,
      revenue.total,
      cards.revenueGenerated,
      cards.totalRevenue,
      response.revenueGenerated,
      response.totalRevenue
    );

    const roiPercent = firstNumber(
      cards.roi,
      cards.roiPercent,
      cards.overallRoi,
      response.roi,
      response.roiPercent,
      response.overallRoi
    );

    const roiCampaignCount = firstNumber(
      cards.roiCampaignCount,
      response.roiCampaignCount,
      activeCampaigns
    );

    const roiExpenseCount = firstNumber(
      cards.roiExpenseCount,
      response.roiExpenseCount,
      response.expensesCount
    );

    const pendingRequests = firstNumber(
      response.pendingRequests,
      cards.pendingRequests,
      response.pending_requests,
      response.requests?.pending,
      response.pending?.requests
    );

    const topCampaigns = asArray(
      response.topCampaigns ||
        response.top_campaigns ||
        response.campaigns ||
        response.topPerformingCampaigns
    ).slice(0, 5);

    return {
      currency,
      walletBalance,
      activeCampaigns,
      totalSpent,
      revenueGenerated,
      roiPercent,
      roiCampaignCount,
      roiExpenseCount,
      pendingRequests,
      topCampaigns,
    };
  }, [dash]);

  if (loading) {
    return (
      <div className="marketing-dashboard-page">
        <MarketingDashboardSkeleton />
      </div>
    );
  }

  return (
    <div className="marketing-dashboard-page">
      {error ? (
        <div className="md-error-box">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="marketing-stat-grid">
        <StatCard
          title="Wallet Balance"
          value={formatSar(data.walletBalance, data.currency)}
          icon={Wallet}
          iconBg="#FFFBEB"
          iconColor="#D97706"
        />

        <StatCard
          title="Active Campaigns"
          value={formatPlainNumber(data.activeCampaigns)}
          icon={Megaphone}
          iconBg="#EFF6FF"
          iconColor="#2563EB"
        />

        <StatCard
          title="Total Spent"
          value={formatSar(data.totalSpent, data.currency)}
          icon={DollarSign}
          iconBg="#FEF2F2"
          iconColor="#EF4444"
        />

        <StatCard
          title="Revenue Generated"
          value={formatSar(data.revenueGenerated, data.currency)}
          icon={TrendingUp}
          iconBg="#ECFDF5"
          iconColor="#10B981"
        />
      </div>

      <div className="md-roi-card">
        <div>
          <div className="md-roi-label">Overall ROI</div>

          <div className="md-roi-value">
            {Number.isFinite(Number(data.roiPercent))
              ? `${Number(data.roiPercent).toFixed(0)}%`
              : '0%'}
          </div>

          <div className="md-roi-sub">
            Based on {formatPlainNumber(data.roiCampaignCount)} campaign
            {data.roiCampaignCount !== 1 ? 's' : ''} ·{' '}
            {formatPlainNumber(data.roiExpenseCount)} expense{' '}
            {data.roiExpenseCount !== 1 ? 'entries' : 'entry'}
          </div>
        </div>

        <div className="md-pending-box">
          <div>Pending Requests</div>
          <strong>{formatPlainNumber(data.pendingRequests)}</strong>
        </div>
      </div>

      <div className="md-campaign-card">
        <div className="md-card-title">Top Campaigns</div>

        {data.topCampaigns.length === 0 ? (
          <div className="md-empty-text">No campaigns found</div>
        ) : (
          <div className="md-campaign-list">
            {data.topCampaigns.map((campaign, index) => {
              const campaignName =
                campaign.campaignName ||
                campaign.name ||
                campaign.title ||
                `Campaign ${index + 1}`;

              const platform =
                campaign.platform ||
                campaign.type ||
                campaign.campaignType ||
                'Meta';

              const status = campaign.status || 'Active';

              const revenue = firstNumber(
                campaign.revenue,
                campaign.revenueGenerated,
                campaign.revenue_generated,
                campaign.totalRevenue
              );

              return (
                <div className="md-campaign-row" key={campaign.id || index}>
                  <div className="md-campaign-info">
                    <strong>{campaignName}</strong>
                    <span>
                      {platform} · {String(status).replaceAll('_', ' ')}
                    </span>
                  </div>

                  <div className="md-campaign-revenue">
                    <strong>{formatSar(revenue, data.currency)}</strong>
                    <span>Revenue</span>
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
            min-height: calc(100vh - 50px);
            background: #F3F4F6;
            padding: 18px;
            box-sizing: border-box;
            font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            color: #111827;
          }

          .md-error-box {
            min-height: 36px;
            padding: 9px 11px;
            margin-bottom: 14px;
            border-radius: 9px;
            background: #FEF2F2;
            border: 1px solid #FECACA;
            color: #991B1B;
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
            font-weight: 750;
          }

          .marketing-stat-grid {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 14px;
            margin-bottom: 14px;
          }

          .md-stat-card {
            height: 62px;
            background: #FFFFFF;
            border: 1px solid #E5E7EB;
            border-radius: 9px;
            padding: 0 13px;
            display: flex;
            align-items: center;
            gap: 13px;
            box-sizing: border-box;
            box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
          }

          .md-stat-icon {
            width: 31px;
            height: 31px;
            border-radius: 9px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }

          .md-stat-info {
            min-width: 0;
          }

          .md-stat-title {
            font-size: 8px;
            font-weight: 900;
            color: #64748B;
            text-transform: uppercase;
            letter-spacing: 1.7px;
            margin-bottom: 7px;
            line-height: 1;
            white-space: nowrap;
          }

          .md-stat-value {
            font-size: 15px;
            font-weight: 950;
            color: #0F172A;
            line-height: 1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .md-roi-card {
            min-height: 88px;
            background: #111827;
            border-radius: 9px;
            padding: 15px 13px;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 18px;
            box-sizing: border-box;
            box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
          }

          .md-roi-label {
            font-size: 8px;
            font-weight: 950;
            color: #FACC15;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            margin-bottom: 10px;
          }

          .md-roi-value {
            font-size: 24px;
            font-weight: 950;
            color: #FFFFFF;
            line-height: 1;
            margin-bottom: 8px;
          }

          .md-roi-sub {
            font-size: 10px;
            color: #CBD5E1;
            font-weight: 600;
            letter-spacing: 0.1px;
          }

          .md-pending-box {
            text-align: right;
            min-width: 130px;
          }

          .md-pending-box div {
            font-size: 9px;
            color: #94A3B8;
            margin-bottom: 10px;
            font-weight: 600;
          }

          .md-pending-box strong {
            font-size: 23px;
            font-weight: 950;
            color: #FACC15;
            line-height: 1;
          }

          .md-campaign-card {
            width: 100%;
            max-width: 555px;
            min-height: 176px;
            background: #FFFFFF;
            border: 1px solid #E5E7EB;
            border-radius: 9px;
            padding: 14px 13px 16px;
            box-sizing: border-box;
            box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
          }

          .md-card-title {
            font-size: 13px;
            font-weight: 850;
            color: #111827;
            margin-bottom: 14px;
          }

          .md-empty-text {
            color: #9CA3AF;
            font-size: 12px;
            padding: 4px 0;
          }

          .md-campaign-list {
            display: flex;
            flex-direction: column;
          }

          .md-campaign-row {
            min-height: 44px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 18px;
            padding: 9px 0;
            border-bottom: 1px solid #EEF2F7;
          }

          .md-campaign-row:last-child {
            border-bottom: 0;
          }

          .md-campaign-info {
            min-width: 0;
          }

          .md-campaign-info strong {
            display: block;
            font-size: 11px;
            font-weight: 850;
            color: #111827;
            line-height: 1.2;
            margin-bottom: 4px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .md-campaign-info span {
            display: block;
            font-size: 9px;
            color: #2563EB;
            line-height: 1.2;
            font-weight: 600;
            text-transform: capitalize;
          }

          .md-campaign-revenue {
            text-align: right;
            flex-shrink: 0;
          }

          .md-campaign-revenue strong {
            display: block;
            font-size: 11px;
            font-weight: 850;
            color: #059669;
            margin-bottom: 3px;
          }

          .md-campaign-revenue span {
            display: block;
            font-size: 8px;
            color: #9CA3AF;
            font-weight: 600;
          }

          @media (max-width: 1100px) {
            .marketing-stat-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }

          @media (max-width: 700px) {
            .marketing-dashboard-page {
              padding: 14px;
            }

            .marketing-stat-grid {
              grid-template-columns: 1fr;
            }

            .md-roi-card {
              flex-direction: column;
              align-items: flex-start;
            }

            .md-pending-box {
              width: 100%;
              text-align: left;
            }

            .md-campaign-card {
              max-width: none;
            }
          }
        `}
      </style>
    </div>
  );
};

export default MarketingDashboard;