import React, { useEffect, useMemo, useState } from 'react';
import { marketingGetAnalyticsRoi } from '../../services/superAdminMarketingApi';
import './MarketingUniversal.css';

function formatSar(value) {
  const n = Number(value);

  if (!Number.isFinite(n)) return '0 SAR';

  return `${n.toLocaleString(undefined, {
    maximumFractionDigits: 0,
  })} SAR`;
}

function formatPercent(value) {
  const n = Number(value);

  if (!Number.isFinite(n)) return '0%';

  return `${Math.round(n)}%`;
}

function humanize(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function calcRoi(spent, revenue) {
  const s = Number(spent) || 0;
  const r = Number(revenue) || 0;

  if (s <= 0) return 0;

  return ((r - s) / s) * 100;
}

function normalizeCampaign(row) {
  const spent = Number(row.spend ?? row.budgetSpent ?? row.budgetSpent ?? 0);
  const revenue = Number(row.revenue ?? row.revenueGenerated ?? 0);

  return {
    id: String(row.id || ''),
    name: row.name || row.campaignName || 'Campaign',
    platform: row.platform || 'meta',
    spent,
    revenue,
    roi: Number(row.roiPercent ?? calcRoi(spent, revenue)),
    leads: Number(row.leads ?? row.leadsCount ?? 0),
    conversions: Number(row.conversions ?? row.conversionsCount ?? 0),
  };
}

function extractCampaigns(payload) {
  const rows = Array.isArray(payload?.campaigns)
    ? payload.campaigns
    : Array.isArray(payload?.data?.campaigns)
      ? payload.data.campaigns
      : [];

  return rows.map(normalizeCampaign);
}

const AnalyticsStatCard = ({ title, value, color }) => {
  return (
    <div className="mk-analytics-stat-card mk-roi-simple-card">
      <div className="mk-analytics-stat-title">{title}</div>

      <div className="mk-analytics-stat-value" style={{ color }}>
        {value}
      </div>
    </div>
  );
};

const RoiChart = ({ platforms }) => {
  const yTicks = [0, 1, 2, 3, 4];
  const platformRows = Array.isArray(platforms) && platforms.length > 0
    ? platforms
    : [{ platform: 'meta', roiPercent: 0 }];

  return (
    <section className="mk-card mk-analytics-chart-card mk-roi-chart-card">
      <h3 className="mk-card-title">ROI by Platform (%)</h3>

      <div className="mk-analytics-chart-wrap">
        <svg
          viewBox="0 0 1000 170"
          preserveAspectRatio="none"
          className="mk-analytics-chart-svg"
        >
          {yTicks.map((tick) => {
            const y = 12 + 128 - (tick / 4) * 128;

            return (
              <g key={tick}>
                <line
                  x1="45"
                  y1={y}
                  x2="985"
                  y2={y}
                  className={
                    tick === 0
                      ? 'mk-chart-axis-line'
                      : 'mk-chart-grid-line'
                  }
                />

                <text
                  x="36"
                  y={y + 4}
                  textAnchor="end"
                  className="mk-chart-tick-text"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          <line
            x1="45"
            y1="12"
            x2="45"
            y2="140"
            className="mk-chart-axis-vertical"
          />

          {platformRows.map((item, index) => {
            const x =
              platformRows.length === 1
                ? 515
                : 85 + index * (850 / Math.max(1, platformRows.length - 1));

            const roi = Math.max(0, Math.min(4, Number(item.roiPercent || 0)));
            const y = 12 + 128 - (roi / 4) * 128;

            return (
              <g key={item.platform || index}>
                <circle
                  cx={x}
                  cy={y}
                  r="4"
                  className="mk-roi-chart-dot"
                />

                <text
                  x={x}
                  y="158"
                  textAnchor="middle"
                  className="mk-chart-label-text"
                >
                  {String(item.platform || 'meta').replace(/_/g, ' ')}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
};

export const AnalyticsROI = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [summary, setSummary] = useState({
    totalSpend: 0,
    totalRevenue: 0,
    roiPercent: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError('');

      const res = await marketingGetAnalyticsRoi({
        status: 'all',
      });

      const rows = extractCampaigns(res);
      const apiSummary = res?.summary || {};

      setCampaigns(rows);
      setPlatforms(Array.isArray(res?.platforms) ? res.platforms : []);

      const totalSpend = Number(apiSummary.totalSpend ?? 0);
      const totalRevenue = Number(apiSummary.totalRevenue ?? 0);
      const roiPercent = Number(
        apiSummary.roiPercent ?? calcRoi(totalSpend, totalRevenue)
      );

      setSummary({
        totalSpend,
        totalRevenue,
        roiPercent,
      });
    } catch (err) {
      setError(err?.message || 'Failed to load ROI analytics.');
      setCampaigns([]);
      setPlatforms([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  const tableRows = useMemo(() => campaigns, [campaigns]);

  return (
    <div className="mk-page">
      {error ? <div className="mk-error-text">{error}</div> : null}

      <div className="mk-analytics-stats-grid mk-roi-three-stats">
        <AnalyticsStatCard
          title="Total Spent"
          value={formatSar(summary.totalSpend)}
          color="#EF4444"
        />

        <AnalyticsStatCard
          title="Total Revenue"
          value={formatSar(summary.totalRevenue)}
          color="#059669"
        />

        <AnalyticsStatCard
          title="Overall ROI"
          value={formatPercent(summary.roiPercent)}
          color="#059669"
        />
      </div>

      <RoiChart platforms={platforms} />

      <section className="mk-card mk-analytics-performance-card">
        <div className="mk-analytics-performance-header">
          <h3 className="mk-card-title">Campaign Performance</h3>
        </div>

        <table className="mk-table mk-analytics-table mk-roi-performance-table">
          <thead>
            <tr>
              <th>Campaign</th>
              <th>Platform</th>
              <th>Spent (SAR)</th>
              <th>Revenue (SAR)</th>
              <th>ROI %</th>
              <th>Leads</th>
              <th>Conversions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="mk-empty-table">
                  Loading analytics...
                </td>
              </tr>
            ) : tableRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="mk-empty-table">
                  No campaign performance found
                </td>
              </tr>
            ) : (
              tableRows.map((item) => (
                <tr key={item.id}>
                  <td className="mk-td-bold">{item.name}</td>
                  <td>{humanize(item.platform)}</td>
                  <td>{Number(item.spent || 0).toLocaleString()}</td>
                  <td>{Number(item.revenue || 0).toLocaleString()}</td>
                  <td className="mk-td-bold">{formatPercent(item.roi)}</td>
                  <td>{item.leads}</td>
                  <td>{item.conversions}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
};

export default AnalyticsROI;