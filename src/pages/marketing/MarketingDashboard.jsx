import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  AlertCircle,
  DollarSign,
  Eye,
  Megaphone,
  MousePointerClick,
  Target,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { MarketingDashboardSkeleton } from './MarketingShimmer';
import {
  marketingGetDashboard,
  marketingGetDashboardAnalytics,
} from '../../services/superAdminMarketingApi';
import {
  formatMarketingMonthLabel,
  marketingT,
} from '../../utils/marketingI18n';

const DEFAULT_CURRENCY = 'SAR';

const PLATFORM_COLORS = [
  '#3B82F6',
  '#10B981',
  '#8B5CF6',
  '#F59E0B',
  '#EF4444',
  '#06B6D4',
  '#EC4899',
  '#14B8A6',
  '#6366F1',
  '#84CC16',
];

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

function formatSar(value, currency = DEFAULT_CURRENCY, locale = 'en') {
  const n = toNumber(value);
  const numberLocale = locale === 'ar' ? 'ar-SA' : undefined;

  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M ${currency}`;
  if (Math.abs(n) >= 1_000) return `${Math.round(n / 1_000)}K ${currency}`;

  return `${n.toLocaleString(numberLocale, {
    maximumFractionDigits: 0,
  })} ${currency}`;
}

function formatPlainNumber(value, locale = 'en') {
  return toNumber(value).toLocaleString(locale === 'ar' ? 'ar-SA' : undefined, {
    maximumFractionDigits: 0,
  });
}

const KpiCard = ({ title, value, icon: Icon, iconBg, iconColor }) => {
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

const ChartCard = ({ title, subtitle, children, height = 240 }) => (
  <div className="md-chart-card">
    <div className="md-chart-head">
      <div className="md-chart-title">{title}</div>
      {subtitle ? <div className="md-chart-sub">{subtitle}</div> : null}
    </div>

    <div style={{ width: '100%', height }}>{children}</div>
  </div>
);

export const MarketingDashboard = () => {
  const ctx = useOutletContext() || {};
  const marketingWorkshopId = ctx.marketingWorkshopId ?? '';
  const locale =
    ctx.locale ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('marketing-locale') : null) ||
    'en';
  const t = useCallback((key, vars) => marketingT(locale, key, vars), [locale]);

  const [dash, setDash] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(
    async (selectedBranchId = '') => {
      setLoading(true);
      setError('');

      const baseParams = marketingWorkshopId
        ? { workshopId: marketingWorkshopId }
        : {};

      try {
        const [dashRes, analyticsRes] = await Promise.all([
          marketingGetDashboard({ ...baseParams, activePromotionsLimit: 8 }),
          marketingGetDashboardAnalytics({
            ...baseParams,
            ...(selectedBranchId ? { branchId: selectedBranchId } : {}),
            months: 6,
          }),
        ]);

        if (dashRes?.success === false) {
          throw new Error(dashRes?.message || marketingT(locale, 'error.request'));
        }

        setDash(dashRes?.data || dashRes || {});
        setAnalytics(analyticsRes || {});

        setBranches((prev) => {
          if (prev.length > 0) return prev;
          const list = asArray(analyticsRes?.branchWise);
          return list
            .filter((b) => b && b.branchId)
            .map((b) => ({ id: String(b.branchId), name: b.branch }));
        });
      } catch (e) {
        setAnalytics(null);
        setError(e?.message || marketingT(locale, 'error.load'));
      } finally {
        setLoading(false);
      }
    },
    [marketingWorkshopId, locale],
  );

  useEffect(() => {
    loadDashboard(branchId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketingWorkshopId]);

  const handleBranchSelect = (id) => {
    setBranchId(id);
    loadDashboard(id);
  };

  const overview = useMemo(() => analytics?.overview || {}, [analytics]);

  const currency = overview.currencyCode || DEFAULT_CURRENCY;

  const cards = useMemo(() => {
    const response = dash || {};
    const c = response.cards || response.summary || {};

    const pendingRequests = firstNumber(
      response.pendingRequests,
      c.pendingRequests,
      response.pending_requests,
    );

    return { pendingRequests };
  }, [dash]);

  const trends = useMemo(() => {
    return asArray(analytics?.trends).map((row) => ({
      ...row,
      label: formatMarketingMonthLabel(locale, row.month),
    }));
  }, [analytics, locale]);

  const branchWise = useMemo(() => asArray(analytics?.branchWise), [analytics]);
  const workshopWise = useMemo(
    () => asArray(analytics?.workshopWise),
    [analytics],
  );
  const reachByPlatform = useMemo(
    () => asArray(analytics?.reachByPlatform),
    [analytics],
  );
  const topCampaigns = useMemo(
    () => asArray(analytics?.topCampaigns).slice(0, 6),
    [analytics],
  );

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

      {branches.length > 0 ? (
        <div className="md-branch-pills">
          <button
            type="button"
            className={`md-pill ${branchId === '' ? 'is-active' : ''}`}
            onClick={() => handleBranchSelect('')}
          >
            {t('branch.all')}
          </button>

          {branches.map((b) => (
            <button
              key={b.id}
              type="button"
              className={`md-pill ${branchId === b.id ? 'is-active' : ''}`}
              onClick={() => handleBranchSelect(b.id)}
            >
              {b.name || t('branch.n', { id: b.id })}
            </button>
          ))}
        </div>
      ) : null}

      <div className="marketing-stat-grid">
        <KpiCard
          title={t('kpi.walletBalance')}
          value={formatSar(overview.walletBalance, currency, locale)}
          icon={Wallet}
          iconBg="#FFFBEB"
          iconColor="#D97706"
        />
        <KpiCard
          title={t('kpi.activeCampaigns')}
          value={formatPlainNumber(overview.activeCampaigns, locale)}
          icon={Megaphone}
          iconBg="#EFF6FF"
          iconColor="#2563EB"
        />
        <KpiCard
          title={t('kpi.revenueGenerated')}
          value={formatSar(overview.revenue, currency, locale)}
          icon={TrendingUp}
          iconBg="#ECFDF5"
          iconColor="#10B981"
        />
        <KpiCard
          title={t('kpi.totalLeads')}
          value={formatPlainNumber(overview.leads, locale)}
          icon={Target}
          iconBg="#F5F3FF"
          iconColor="#8B5CF6"
        />
        <KpiCard
          title={t('kpi.impressions')}
          value={formatPlainNumber(overview.impressions, locale)}
          icon={Eye}
          iconBg="#ECFEFF"
          iconColor="#0891B2"
        />
        <KpiCard
          title={t('kpi.uniqueCustomers')}
          value={formatPlainNumber(overview.uniqueCustomers, locale)}
          icon={Users}
          iconBg="#FDF2F8"
          iconColor="#DB2777"
        />
        <KpiCard
          title={t('kpi.conversions')}
          value={formatPlainNumber(overview.conversions, locale)}
          icon={MousePointerClick}
          iconBg="#FEF2F2"
          iconColor="#EF4444"
        />
        <KpiCard
          title={t('kpi.overallRoi')}
          value={`${formatPlainNumber(overview.roiPercent, locale)}%`}
          icon={Zap}
          iconBg="#FEFCE8"
          iconColor="#CA8A04"
        />
      </div>

      <div className="md-roi-card">
        <div className="md-roi-block">
          <div className="md-roi-label">{t('roi.totalSpend')}</div>
          <div className="md-roi-value">
            {formatSar(overview.totalSpend, currency, locale)}
          </div>
          <div className="md-roi-sub">
            {t('roi.sub', {
              roas: toNumber(overview.roas).toFixed(2),
              rate: toNumber(overview.conversionRate).toFixed(1),
            })}
          </div>
        </div>

        <div className="md-pending-box">
          <div>{t('roi.pendingRequests')}</div>
          <strong>{formatPlainNumber(cards.pendingRequests, locale)}</strong>
        </div>
      </div>

      <div className="md-grid-2">
        <ChartCard title={t('chart.conversionTrends')} subtitle={t('chart.conversionTrendsSub')}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trends} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area
                type="monotone"
                dataKey="leads"
                name={t('series.leads')}
                stroke="#8B5CF6"
                fill="#8B5CF622"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="conversions"
                name={t('series.conversions')}
                stroke="#10B981"
                fill="#10B98122"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t('chart.revenueTrend')} subtitle={t('chart.revenueTrendSub')}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trends} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => formatSar(v, currency, locale)} />
              <Area
                type="monotone"
                dataKey="revenue"
                name={t('series.revenue')}
                stroke="#2563EB"
                fill="#2563EB22"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="md-grid-2">
        <ChartCard title={t('chart.customerGrowth')} subtitle={t('chart.customerGrowthSub')}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trends} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="customers" name={t('series.customers')} fill="#DB2777" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t('chart.reachByPlatform')} subtitle={t('chart.reachByPlatformSub')}>
          {reachByPlatform.length === 0 ? (
            <div className="md-empty-text">{t('empty.platform')}</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={reachByPlatform}
                  dataKey="revenue"
                  nameKey="platformLabel"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={(e) => e.platformLabel}
                  labelLine={false}
                >
                  {reachByPlatform.map((entry, index) => (
                    <Cell
                      key={entry.platform || index}
                      fill={PLATFORM_COLORS[index % PLATFORM_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatSar(v, currency, locale)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div className="md-chart-card">
        <div className="md-chart-head">
          <div className="md-chart-title">{t('chart.branchWise')}</div>
          <div className="md-chart-sub">{t('chart.branchWiseSub')}</div>
        </div>

        {branchWise.length === 0 ? (
          <div className="md-empty-text">{t('empty.branch')}</div>
        ) : (
          <>
            <div style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={branchWise}
                  margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="branch" tick={{ fontSize: 10 }} interval={0} angle={-12} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => formatSar(v, currency, locale)} />
                  <Bar dataKey="revenue" name={t('series.revenue')} fill="#10B981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="md-table-wrap">
              <table className="md-table">
                <thead>
                  <tr>
                    <th>{t('table.branch')}</th>
                    <th>{t('table.orders')}</th>
                    <th>{t('table.customers')}</th>
                    <th>{t('table.revenue')}</th>
                  </tr>
                </thead>
                <tbody>
                  {branchWise.map((b) => (
                    <tr key={b.branchId}>
                      <td>{b.branch}</td>
                      <td>{formatPlainNumber(b.orders, locale)}</td>
                      <td>{formatPlainNumber(b.customers, locale)}</td>
                      <td className="md-strong-green">
                        {formatSar(b.revenue, currency, locale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="md-grid-2">
        <ChartCard title={t('chart.workshopWise')} subtitle={t('chart.workshopWiseSub')}>
          {workshopWise.length === 0 ? (
            <div className="md-empty-text">{t('empty.workshop')}</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={workshopWise}
                layout="vertical"
                margin={{ top: 8, right: 12, left: 8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis
                  type="category"
                  dataKey="workshop"
                  tick={{ fontSize: 10 }}
                  width={110}
                />
                <Tooltip formatter={(v) => formatSar(v, currency, locale)} />
                <Bar dataKey="revenue" name={t('series.revenue')} fill="#6366F1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <div className="md-chart-card">
          <div className="md-chart-head">
            <div className="md-chart-title">{t('chart.topCampaigns')}</div>
            <div className="md-chart-sub">{t('chart.topCampaignsSub')}</div>
          </div>

          {topCampaigns.length === 0 ? (
            <div className="md-empty-text">{t('empty.campaigns')}</div>
          ) : (
            <div className="md-campaign-list">
              {topCampaigns.map((campaign, index) => (
                <div className="md-campaign-row" key={campaign.id || index}>
                  <div className="md-campaign-info">
                    <strong>{campaign.campaignName || campaign.name}</strong>
                    <span>
                      {campaign.platformLabel || campaign.platform} ·{' '}
                      {String(campaign.status || 'active').replaceAll('_', ' ')}
                    </span>
                  </div>

                  <div className="md-campaign-revenue">
                    <strong>{formatSar(campaign.revenue, currency, locale)}</strong>
                    <span>{t('campaign.roi', { pct: formatPlainNumber(campaign.roiPercent, locale) })}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>
        {`
          .marketing-dashboard-page {
            min-height: calc(100vh - 50px);
            background: #F3F4F6;
            padding: 18px;
            box-sizing: border-box;
            font-family: 'Poppins', sans-serif;
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

          .md-branch-pills {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-bottom: 14px;
          }

          .md-pill {
            border: 1px solid #E5E7EB;
            background: #FFFFFF;
            color: #475569;
            font-size: 11px;
            font-weight: 700;
            padding: 6px 12px;
            border-radius: 999px;
            cursor: pointer;
            transition: all 0.15s ease;
          }

          .md-pill:hover {
            border-color: #2563EB;
            color: #2563EB;
          }

          .md-pill.is-active {
            background: #111827;
            border-color: #111827;
            color: #FFFFFF;
          }

          .marketing-stat-grid {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 14px;
            margin-bottom: 14px;
          }

          .md-stat-card {
            height: 64px;
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
            width: 33px;
            height: 33px;
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
            letter-spacing: 1.4px;
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
            min-height: 80px;
            background: #111827;
            border-radius: 9px;
            padding: 15px 16px;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 18px;
            box-sizing: border-box;
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

          .md-grid-2 {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 14px;
            margin-bottom: 14px;
          }

          .md-chart-card {
            background: #FFFFFF;
            border: 1px solid #E5E7EB;
            border-radius: 9px;
            padding: 14px;
            box-sizing: border-box;
            box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
            margin-bottom: 14px;
          }

          .md-grid-2 .md-chart-card {
            margin-bottom: 0;
          }

          .md-chart-head {
            margin-bottom: 12px;
          }

          .md-chart-title {
            font-size: 13px;
            font-weight: 850;
            color: #111827;
          }

          .md-chart-sub {
            font-size: 10px;
            color: #94A3B8;
            font-weight: 600;
            margin-top: 3px;
          }

          .md-empty-text {
            color: #9CA3AF;
            font-size: 12px;
            padding: 24px 0;
            text-align: center;
          }

          .md-table-wrap {
            margin-top: 12px;
            overflow-x: auto;
          }

          .md-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
          }

          .md-table th {
            text-align: left;
            color: #64748B;
            font-weight: 800;
            text-transform: uppercase;
            font-size: 9px;
            letter-spacing: 0.6px;
            padding: 8px 10px;
            border-bottom: 1px solid #E5E7EB;
          }

          .md-table td {
            padding: 9px 10px;
            border-bottom: 1px solid #F1F5F9;
            color: #1F2937;
            font-weight: 600;
          }

          .md-strong-green {
            color: #059669;
            font-weight: 850;
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

            .md-grid-2 {
              grid-template-columns: 1fr;
            }

            .md-grid-2 .md-chart-card {
              margin-bottom: 0;
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
          }
        `}
      </style>
    </div>
  );
};

export default MarketingDashboard;
