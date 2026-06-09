import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Bot,
  RefreshCw,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import {
  marketingGetBudgetOptimizer,
  marketingOptimizeBudget,
} from '../../services/superAdminMarketingApi';
import './MarketingUniversal.css';

const emptySummary = {
  walletBalance: 0,
  availableBalance: 0,
  totalBudgetAllocated: 0,
  totalBudget: 0,
  totalSpent: 0,
  totalSpend: 0,
  totalRevenue: 0,
  totalLeads: 0,
  totalConversions: 0,
  overallRoi: 0,
  budgetUtilized: 0,
  costPerLead: 0,
  campaignsCount: 0,
};

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatSar(value) {
  return `${toNumber(value).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  })} SAR`;
}

function formatPercent(value) {
  return `${toNumber(value).toLocaleString(undefined, {
    maximumFractionDigits: 1,
  })}%`;
}

function humanize(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function asArray(payload, keys = []) {
  if (Array.isArray(payload)) return payload;

  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key];
    if (Array.isArray(payload?.data?.[key])) return payload.data[key];
  }

  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;

  return [];
}

function normalizeSummary(payload) {
  const root = payload?.data || payload || {};
  const source = root.summary || {};
  const wallet = root.wallet || {};

  const walletBalance = toNumber(
    source.walletBalance ??
      source.availableBalance ??
      wallet.balance ??
      wallet.availableBalance,
  );

  const totalSpent = toNumber(
    source.totalSpent ??
      source.totalSpend ??
      source.spent,
  );

  const totalBudgetAllocated = toNumber(
    source.totalBudgetAllocated ??
      source.totalBudget ??
      source.budgetAllocated,
  );

  return {
    walletBalance,
    availableBalance: walletBalance,
    totalBudgetAllocated,
    totalBudget: totalBudgetAllocated,
    totalSpent,
    totalSpend: totalSpent,
    totalRevenue: toNumber(source.totalRevenue ?? source.revenue),
    totalLeads: toNumber(source.totalLeads ?? source.leads),
    totalConversions: toNumber(source.totalConversions ?? source.conversions),
    overallRoi: toNumber(source.overallRoi ?? source.roi),
    budgetUtilized: toNumber(source.budgetUtilized),
    costPerLead: toNumber(source.costPerLead),
    campaignsCount: toNumber(
      source.campaignsCount ??
        root.meta?.totalCampaigns ??
        asArray(root, ['campaigns']).length,
    ),
  };
}

function normalizeWarning(item, summary) {
  const type = item?.type || 'warning';
  const isWalletLow = type === 'wallet_low';

  return {
    type,
    title: item?.title || humanize(type),
    message: isWalletLow
      ? `Current: ${Math.round(toNumber(summary.walletBalance))} (threshold: 5000)`
      : item?.message || '',
    severity: isWalletLow ? 'critical' : item?.severity || 'warning',
  };
}

function extractWarnings(payload, summary) {
  const root = payload?.data || payload || {};
  return asArray(root, ['warnings', 'alerts']).map((item) =>
    normalizeWarning(item, summary),
  );
}

function normalizeRecommendation(item, totalBudget = 0) {
  const recommendedBudget = toNumber(
    item?.recommendedBudget ??
      item?.amount ??
      item?.recommendedAmount,
  );

  const percentage =
    totalBudget > 0
      ? Math.round((recommendedBudget / totalBudget) * 10000) / 100
      : toNumber(item?.percentage);

  return {
    campaignId: item?.campaignId || item?.id || '',
    campaignName:
      item?.campaignName ||
      item?.name ||
      item?.channel ||
      humanize(item?.platform || 'Campaign'),
    platform: item?.platform || 'unknown',
    percentage,
    amount: recommendedBudget,
    currentBudget: toNumber(item?.currentBudget),
    currentSpent: toNumber(item?.currentSpent ?? item?.spent),
    revenue: toNumber(item?.revenue),
    roi: toNumber(item?.roi),
    leads: toNumber(item?.leads ?? item?.leadsCount),
    action: item?.action || 'keep',
    reason:
      item?.reason ||
      item?.recommendation ||
      'Keep monitoring campaign performance.',
  };
}

function extractRecommendations(payload, totalBudget = 0) {
  const root = payload?.data || payload || {};

  return asArray(root, [
    'optimizedBudgets',
    'recommendations',
    'campaigns',
  ]).map((item) => normalizeRecommendation(item, totalBudget));
}

const StatCard = ({ title, value, label, tone = 'dark' }) => (
  <div className="bo-stat-card">
    <div className="bo-stat-title">{title}</div>
    <div className={`bo-stat-value bo-tone-${tone}`}>{value}</div>
    {label ? <div className="bo-stat-label">{label}</div> : null}
  </div>
);

const WarningBanner = ({ warning, onClose }) => (
  <div className="bo-warning-banner">
    <AlertTriangle size={13} strokeWidth={2.1} />

    <div className="bo-warning-content">
      <strong>
        {warning.title}
        <span>{humanize(warning.severity)}</span>
      </strong>
      <p>{warning.message}</p>
    </div>

    <button type="button" onClick={onClose}>
      <X size={13} />
    </button>
  </div>
);

const RecommendationCard = ({ item }) => (
  <div className="bo-rec-card">
    <div className="bo-rec-head">
      <div>
        <h4>{item.campaignName}</h4>
        <p>
          {humanize(item.platform)} • {humanize(item.action)}
        </p>
      </div>

      <strong>{formatPercent(item.percentage)}</strong>
    </div>

    <div className="bo-rec-track">
      <span
        style={{
          width: `${Math.min(100, Math.max(0, item.percentage))}%`,
        }}
      />
    </div>

    <div className="bo-rec-meta">
      <div>
        <span>Recommended</span>
        <strong>{formatSar(item.amount)}</strong>
      </div>

      <div>
        <span>ROI</span>
        <strong>{formatPercent(item.roi)}</strong>
      </div>

      <div>
        <span>Leads</span>
        <strong>{item.leads}</strong>
      </div>
    </div>

    <p className="bo-rec-reason">{item.reason}</p>
  </div>
);

export const BudgetOptimizer = () => {
  const [summary, setSummary] = useState(emptySummary);
  const [recommendations, setRecommendations] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [dismissedWarnings, setDismissedWarnings] = useState([]);
  const [budget, setBudget] = useState('');

  const [loading, setLoading] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [error, setError] = useState('');

  const effectiveBudget = useMemo(() => {
    const typed = toNumber(budget);
    if (typed > 0) return typed;
    return toNumber(summary.walletBalance);
  }, [budget, summary.walletBalance]);

  const visibleWarnings = useMemo(
    () =>
      warnings.filter(
        (warning, index) => !dismissedWarnings.includes(`${warning.type}-${index}`),
      ),
    [warnings, dismissedWarnings],
  );

  const loadOptimizer = async () => {
    try {
      setLoading(true);
      setError('');

      const res = await marketingGetBudgetOptimizer({
        status: 'all',
        limit: 100,
        offset: 0,
      });

      const nextSummary = normalizeSummary(res);
      const nextWarnings = extractWarnings(res, nextSummary);
      const nextRecommendations = extractRecommendations(
        res,
        nextSummary.walletBalance || nextSummary.totalBudgetAllocated,
      );

      setSummary(nextSummary);
      setWarnings(nextWarnings);
      setRecommendations(nextRecommendations);
      setDismissedWarnings([]);

      if (nextSummary.walletBalance > 0 && !budget) {
        setBudget(String(Math.round(nextSummary.walletBalance)));
      }
    } catch (err) {
      setError(err?.message || 'Failed to load budget optimizer.');
      setSummary(emptySummary);
      setWarnings([]);
      setRecommendations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOptimizer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOptimize = async () => {
    const value = toNumber(effectiveBudget);

    if (value <= 0) {
      alert('Enter valid budget or fund marketing wallet first.');
      return;
    }

    try {
      setOptimizing(true);
      setError('');

      const res = await marketingOptimizeBudget({
        totalBudget: value,
        strategy: 'balanced',
        applyChanges: false,
      });

      const optimizedRecommendations = extractRecommendations(res, value);

      setRecommendations(optimizedRecommendations);
    } catch (err) {
      alert(err?.message || 'Failed to optimize budget.');
    } finally {
      setOptimizing(false);
    }
  };

  const handleManageAlerts = () => {
    setDismissedWarnings([]);
  };

  return (
    <div className="mk-page bo-page">
      {visibleWarnings.map((warning, index) => (
        <WarningBanner
          key={`${warning.type}-${index}`}
          warning={warning}
          onClose={() =>
            setDismissedWarnings((prev) => [...prev, `${warning.type}-${index}`])
          }
        />
      ))}

      <section className="bo-main-card">
        <div className="bo-main-head">
          <div className="bo-title-wrap">
            <div className="bo-icon">
              <Zap size={18} />
            </div>

            <div>
              <h2>AI Predictive Budget Optimizer</h2>
              <p>
                Analyzes campaign history and recommends optimal budget allocation
                to maximize ROI.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="bo-alert-btn"
            onClick={handleManageAlerts}
          >
            <Bell size={13} />
            Manage Alerts
            <span>{warnings.length}</span>
          </button>
        </div>

        {error ? <div className="mk-error-text">{error}</div> : null}

        <div className="bo-stat-grid">
          <StatCard
            title="Wallet"
            value={formatSar(summary.walletBalance)}
            label=""
            tone={summary.walletBalance <= 0 ? 'red' : 'dark'}
          />

          <StatCard
            title="Overall ROI"
            value={formatPercent(summary.overallRoi)}
            label=""
            tone={summary.overallRoi < 0 ? 'red' : 'green'}
          />

          <StatCard
            title="Budget Utilized"
            value={formatPercent(summary.budgetUtilized)}
            label=""
            tone="dark"
          />

          <StatCard
            title="Cost Per Lead"
            value={formatSar(summary.costPerLead)}
            label=""
            tone="dark"
          />
        </div>

        <div className="bo-budget-row">
          <div className="bo-budget-field">
            <label>Total Budget to Optimize (SAR)</label>
            <input
              type="number"
              min="0"
              value={budget}
              onChange={(event) => setBudget(event.target.value)}
              placeholder={`e.g. ${Math.round(summary.walletBalance || 0)} (wallet balance)`}
            />
            <small>Leave blank to use wallet balance</small>
          </div>

          <button
            type="button"
            className="bo-optimize-btn"
            onClick={handleOptimize}
            disabled={optimizing || loading}
          >
            <Sparkles size={14} />
            {optimizing ? 'Optimizing...' : 'Optimize Budget'}
          </button>

          <button
            type="button"
            className="bo-hidden-refresh"
            onClick={loadOptimizer}
            disabled={loading}
            title="Refresh"
          >
            <RefreshCw size={14} className={loading ? 'bo-spin' : ''} />
          </button>
        </div>
      </section>

      {recommendations.length > 0 ? (
        <section className="bo-results-card">
          <div className="bo-results-head">
            <h3>Recommended Allocation</h3>
            <span>{recommendations.length} recommendations</span>
          </div>

          <div className="bo-rec-grid">
            {recommendations.map((item) => (
              <RecommendationCard
                key={`${item.campaignId}-${item.platform}-${item.campaignName}`}
                item={item}
              />
            ))}
          </div>
        </section>
      ) : null}

      <style>
        {`
          .bo-page {
            padding: 18px 20px;
            min-height: calc(100vh - 60px);
            background: #f4f6f9;
          }

          .bo-warning-banner {
            min-height: 49px;
            margin-bottom: 16px;
            padding: 10px 12px;
            border-radius: 9px;
            border: 1px solid #fca5a5;
            background: #fff1f2;
            color: #ef4444;
            display: flex;
            align-items: flex-start;
            gap: 10px;
            box-sizing: border-box;
          }

          .bo-warning-banner > svg {
            margin-top: 3px;
            flex: 0 0 auto;
          }

          .bo-warning-content strong {
            display: flex;
            align-items: center;
            gap: 8px;
            color: #ef4444;
            font-size: 10px;
            font-weight: 850;
            margin-bottom: 3px;
          }

          .bo-warning-content strong span {
            height: 15px;
            padding: 0 6px;
            border-radius: 5px;
            background: #fee2e2;
            color: #ef4444;
            display: inline-flex;
            align-items: center;
            font-size: 8px;
            font-weight: 850;
          }

          .bo-warning-content p {
            margin: 0;
            color: #ef4444;
            font-size: 9px;
            font-weight: 650;
          }

          .bo-warning-banner button {
            margin-left: auto;
            width: 20px;
            height: 20px;
            border: 0;
            background: transparent;
            color: #ef4444;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            padding: 0;
          }

          .bo-main-card {
            background: #ffffff;
            border: 1px solid #dfe4ec;
            border-radius: 9px;
            padding: 15px;
            box-sizing: border-box;
          }

          .bo-main-head {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 16px;
          }

          .bo-title-wrap {
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .bo-icon {
            width: 36px;
            height: 36px;
            border-radius: 10px;
            background: #fff7ed;
            color: #d9ad18;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            flex: 0 0 auto;
          }

          .bo-title-wrap h2 {
            margin: 0 0 5px;
            color: #111827;
            font-size: 13px;
            font-weight: 900;
            line-height: 1.15;
          }

          .bo-title-wrap p {
            margin: 0;
            color: #64748b;
            font-size: 10px;
            font-weight: 650;
            line-height: 1.35;
          }

          .bo-alert-btn {
            height: 29px;
            border-radius: 7px;
            border: 1px solid #dbe1ea;
            background: #ffffff;
            color: #334155;
            padding: 0 10px;
            display: inline-flex;
            align-items: center;
            gap: 7px;
            font-size: 10px;
            font-weight: 800;
            cursor: pointer;
          }

          .bo-alert-btn span {
            min-width: 16px;
            height: 16px;
            border-radius: 6px;
            background: #eff6ff;
            color: #2563eb;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 8px;
            font-weight: 900;
          }

          .bo-stat-grid {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 8px;
            margin-bottom: 14px;
          }

          .bo-stat-card {
            min-height: 43px;
            background: #f8fafc;
            border-radius: 7px;
            padding: 8px 10px;
            text-align: center;
            box-sizing: border-box;
          }

          .bo-stat-title {
            font-size: 7px;
            font-weight: 900;
            letter-spacing: 1.5px;
            color: #94a3b8;
            text-transform: uppercase;
            margin-bottom: 5px;
          }

          .bo-stat-value {
            font-size: 13px;
            font-weight: 950;
            line-height: 1;
          }

          .bo-tone-dark {
            color: #111827;
          }

          .bo-tone-red {
            color: #ef4444;
          }

          .bo-tone-green {
            color: #059669;
          }

          .bo-stat-label {
            display: none;
          }

          .bo-budget-row {
            display: flex;
            align-items: end;
            gap: 10px;
          }

          .bo-budget-field {
            width: 240px;
          }

          .bo-budget-field label {
            display: block;
            color: #111827;
            font-size: 10px;
            font-weight: 800;
            margin-bottom: 5px;
          }

          .bo-budget-field input {
            width: 100%;
            height: 30px;
            border: 1px solid #dbe1ea;
            border-radius: 7px;
            padding: 0 10px;
            font-size: 10px;
            outline: none;
            box-sizing: border-box;
            background: #ffffff;
          }

          .bo-budget-field input:focus {
            border-color: #eab308;
            box-shadow: 0 0 0 1px rgba(234, 179, 8, 0.35);
          }

          .bo-budget-field small {
            display: block;
            margin-top: 5px;
            color: #94a3b8;
            font-size: 9px;
            font-weight: 650;
          }

          .bo-optimize-btn {
            height: 30px;
            border: 1px solid #d9ad18;
            background: #d9ad18;
            color: #ffffff;
            border-radius: 7px;
            padding: 0 14px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 7px;
            font-size: 10px;
            font-weight: 850;
            cursor: pointer;
          }

          .bo-optimize-btn:disabled {
            opacity: 0.65;
            cursor: not-allowed;
          }

          .bo-hidden-refresh {
            width: 30px;
            height: 30px;
            border: 1px solid #dbe1ea;
            border-radius: 7px;
            background: #ffffff;
            color: #64748b;
            display: none;
            align-items: center;
            justify-content: center;
            cursor: pointer;
          }

          .bo-results-card {
            margin-top: 14px;
            background: #ffffff;
            border: 1px solid #dfe4ec;
            border-radius: 9px;
            padding: 14px;
            box-sizing: border-box;
          }

          .bo-results-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 12px;
          }

          .bo-results-head h3 {
            margin: 0;
            color: #111827;
            font-size: 13px;
            font-weight: 900;
          }

          .bo-results-head span {
            color: #64748b;
            font-size: 10px;
            font-weight: 750;
          }

          .bo-rec-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
          }

          .bo-rec-card {
            border: 1px solid #e5e7eb;
            border-radius: 9px;
            padding: 12px;
            box-sizing: border-box;
          }

          .bo-rec-head {
            display: flex;
            justify-content: space-between;
            gap: 10px;
            margin-bottom: 9px;
          }

          .bo-rec-head h4 {
            margin: 0 0 3px;
            color: #111827;
            font-size: 12px;
            font-weight: 900;
          }

          .bo-rec-head p,
          .bo-rec-reason {
            margin: 0;
            color: #64748b;
            font-size: 10px;
            font-weight: 650;
          }

          .bo-rec-head strong {
            color: #d9ad18;
            font-size: 14px;
            font-weight: 950;
          }

          .bo-rec-track {
            height: 6px;
            border-radius: 999px;
            background: #eef2f7;
            overflow: hidden;
            margin-bottom: 10px;
          }

          .bo-rec-track span {
            display: block;
            height: 100%;
            background: #d9ad18;
            border-radius: inherit;
          }

          .bo-rec-meta {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
            margin-bottom: 9px;
          }

          .bo-rec-meta div {
            background: #f8fafc;
            border-radius: 7px;
            padding: 7px;
          }

          .bo-rec-meta span {
            display: block;
            color: #94a3b8;
            font-size: 8px;
            font-weight: 850;
            text-transform: uppercase;
            margin-bottom: 3px;
          }

          .bo-rec-meta strong {
            color: #111827;
            font-size: 11px;
            font-weight: 900;
          }

          .bo-spin {
            animation: bo-spin 1s linear infinite;
          }

          @keyframes bo-spin {
            to {
              transform: rotate(360deg);
            }
          }

          @media (max-width: 1000px) {
            .bo-stat-grid,
            .bo-rec-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }

          @media (max-width: 700px) {
            .bo-main-head,
            .bo-budget-row {
              flex-direction: column;
              align-items: stretch;
            }

            .bo-budget-field {
              width: 100%;
            }

            .bo-stat-grid,
            .bo-rec-grid {
              grid-template-columns: 1fr;
            }
          }
        `}
      </style>
    </div>
  );
};

export default BudgetOptimizer;