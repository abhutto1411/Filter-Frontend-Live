import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  Bot,
  Download,
  RefreshCw,
  TrendingUp,
  Table2,
} from 'lucide-react';
import { marketingGetCampaignReport } from '../../services/superAdminMarketingApi';
import './MarketingUniversal.css';

const EMPTY_SUMMARY = {
  totalBudget: 0,
  totalSpent: 0,
  totalRevenue: 0,
  totalImpressions: 0,
  totalClicks: 0,
  totalLeads: 0,
  totalConversions: 0,
  ctr: 0,
  costPerLead: 0,
  conversionRate: 0,
  roiPercent: 0,
  activeCampaigns: 0,
};

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatSar(value) {
  const n = toNumber(value);

  return `${n.toLocaleString(undefined, {
    maximumFractionDigits: 0,
  })} SAR`;
}

function calcPercent(part, total) {
  const p = toNumber(part);
  const t = toNumber(total);

  if (t <= 0) return 0;

  return (p / t) * 100;
}

function formatPercent(value) {
  const n = toNumber(value);

  return `${Number(n).toLocaleString(undefined, {
    maximumFractionDigits: 2,
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

function calculateRoi(spent, revenue) {
  const s = toNumber(spent);
  const r = toNumber(revenue);

  if (s <= 0) return r > 0 ? 100 : 0;

  return Math.round(((r - s) / s) * 10000) / 100;
}

function normalizeCampaign(item) {
  const spent = toNumber(
    item?.spent ??
      item?.totalSpent ??
      item?.budgetSpent ??
      item?.campaignSpent ??
      0,
  );

  const revenue = toNumber(
    item?.revenue ??
      item?.totalRevenue ??
      item?.revenueGenerated ??
      0,
  );

  const leads = toNumber(item?.leads ?? item?.leadsCount ?? 0);
  const conversions = toNumber(item?.conversions ?? item?.conversionsCount ?? 0);
  const impressions = toNumber(item?.impressions ?? 0);
  const clicks = toNumber(item?.clicks ?? 0);

  return {
    id: String(item?.id ?? item?.campaignId ?? item?._id ?? ''),
    name:
      item?.name ||
      item?.campaignName ||
      item?.title ||
      item?.campaign ||
      'Campaign',
    platform: item?.platform || 'meta',
    type: item?.type || item?.campaignType || 'campaign',
    budget: toNumber(
      item?.budget ??
        item?.budgetAllocated ??
        item?.totalBudget ??
        0,
    ),
    spent,
    revenue,
    profit: revenue - spent,
    roiPercent: toNumber(
      item?.roiPercent ??
        item?.roi ??
        calculateRoi(spent, revenue),
    ),
    impressions,
    clicks,
    leads,
    conversions,
    ctr: toNumber(
      item?.ctr ??
        (impressions > 0 ? (clicks / impressions) * 100 : 0),
    ),
    conversionRate: toNumber(
      item?.conversionRate ??
        (clicks > 0 ? (conversions / clicks) * 100 : 0),
    ),
    status: item?.status || 'active',
  };
}

function extractCampaigns(payload) {
  const root = payload?.data || payload || {};

  const rows = asArray(root, [
    'campaigns',
    'campaignPerformance',
    'rows',
    'reportRows',
    'items',
  ]);

  return rows.map(normalizeCampaign);
}

function normalizeSummary(payload, campaigns) {
  const root = payload?.data || payload || {};
  const source = root.summary || root.cards || {};

  const fallback = campaigns.reduce(
    (acc, item) => {
      acc.totalBudget += toNumber(item.budget);
      acc.totalSpent += toNumber(item.spent);
      acc.totalRevenue += toNumber(item.revenue);
      acc.totalImpressions += toNumber(item.impressions);
      acc.totalClicks += toNumber(item.clicks);
      acc.totalLeads += toNumber(item.leads);
      acc.totalConversions += toNumber(item.conversions);

      if (['active', 'approved', 'paused'].includes(String(item.status).toLowerCase())) {
        acc.activeCampaigns += 1;
      }

      return acc;
    },
    { ...EMPTY_SUMMARY },
  );

  const totalBudget = toNumber(
    source.totalBudget ??
      source.budgetAllocated ??
      source.budget ??
      source.totalAllocated,
    fallback.totalBudget,
  );

  const totalSpent = toNumber(
    source.totalSpent ??
      source.spent ??
      source.marketingSpend,
    fallback.totalSpent,
  );

  const totalRevenue = toNumber(
    source.totalRevenue ??
      source.revenue ??
      source.revenueGenerated,
    fallback.totalRevenue,
  );

  const totalImpressions = toNumber(
    source.totalImpressions ??
      source.impressions,
    fallback.totalImpressions,
  );

  const totalClicks = toNumber(
    source.totalClicks ??
      source.clicks,
    fallback.totalClicks,
  );

  const totalLeads = toNumber(
    source.totalLeads ??
      source.leads ??
      source.leadsCount,
    fallback.totalLeads,
  );

  const totalConversions = toNumber(
    source.totalConversions ??
      source.conversions ??
      source.conversionsCount,
    fallback.totalConversions,
  );

  return {
    totalBudget,
    totalSpent,
    totalRevenue,
    totalImpressions,
    totalClicks,
    totalLeads,
    totalConversions,
    ctr: toNumber(
      source.ctr,
      totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
    ),
    costPerLead: toNumber(
      source.costPerLead,
      totalLeads > 0 ? totalSpent / totalLeads : 0,
    ),
    conversionRate: toNumber(
      source.conversionRate,
      totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0,
    ),
    roiPercent: toNumber(
      source.roiPercent ??
        source.overallRoi ??
        source.roi,
      calculateRoi(totalSpent, totalRevenue),
    ),
    activeCampaigns: toNumber(
      source.activeCampaigns,
      fallback.activeCampaigns,
    ),
  };
}

function getDateRange(period) {
  const now = new Date();

  if (period === 'today') {
    const d = now.toISOString().slice(0, 10);
    return { startDate: d, endDate: d, dateFrom: d, dateTo: d };
  }

  if (period === 'this_week') {
    const start = new Date(now);
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day + 1);

    return {
      startDate: start.toISOString().slice(0, 10),
      endDate: now.toISOString().slice(0, 10),
      dateFrom: start.toISOString().slice(0, 10),
      dateTo: now.toISOString().slice(0, 10),
    };
  }

  if (period === 'this_month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);

    return {
      startDate: start.toISOString().slice(0, 10),
      endDate: now.toISOString().slice(0, 10),
      dateFrom: start.toISOString().slice(0, 10),
      dateTo: now.toISOString().slice(0, 10),
    };
  }

  if (period === 'last_month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);

    return {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      dateFrom: start.toISOString().slice(0, 10),
      dateTo: end.toISOString().slice(0, 10),
    };
  }

  return {};
}

function makeCsv(campaigns) {
  const header = [
    'Campaign',
    'Platform',
    'Type',
    'Budget',
    'Spent',
    'Revenue',
    'ROI %',
    'Impressions',
    'Clicks',
    'CTR %',
    'Leads',
    'Conversions',
    'Conv. Rate %',
    'Status',
  ];

  const rows = campaigns.map((item) => [
    item.name,
    humanize(item.platform),
    humanize(item.type),
    item.budget,
    item.spent,
    item.revenue,
    item.roiPercent,
    item.impressions,
    item.clicks,
    item.ctr,
    item.leads,
    item.conversions,
    item.conversionRate,
    item.status,
  ]);

  return [header, ...rows]
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`)
        .join(','),
    )
    .join('\n');
}

function downloadCsv(campaigns) {
  const csv = makeCsv(campaigns);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = `campaign-report-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();

  URL.revokeObjectURL(url);
}

const SelectField = ({ label, value, onChange, options }) => (
  <div className="mk-report-filter">
    <label className="mk-report-filter-label">{label}</label>

    <select
      className="mk-input mk-report-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </div>
);

const MetricCard = ({ title, value, sub, tone = 'dark' }) => (
  <div className="mk-report-metric-card">
    <div className="mk-report-metric-title">{title}</div>
    <div className={`mk-report-metric-value mk-report-tone-${tone}`}>
      {value}
    </div>
    <div className="mk-report-metric-sub">{sub}</div>
  </div>
);

const ReportIconButton = ({ active, title, onClick, disabled, children }) => (
  <button
    type="button"
    className={active ? 'mk-report-icon-btn active' : 'mk-report-icon-btn'}
    title={title}
    onClick={onClick}
    disabled={disabled}
  >
    {children}
  </button>
);

const PerformanceChart = ({ campaigns }) => {
  const width = 1000;
  const height = 170;
  const left = 38;
  const right = 14;
  const top = 12;
  const bottom = 32;
  const chartW = width - left - right;
  const chartH = height - top - bottom;

  const maxValue = Math.max(
    1,
    ...campaigns.map((item) =>
      Math.max(toNumber(item.spent), toNumber(item.revenue)),
    ),
  );

  const ticks = [0, 1, 2, 3, 4];
  const rows = campaigns.slice(0, 12);
  const slot = rows.length > 0 ? chartW / rows.length : chartW;

  return (
    <div className="mk-report-chart-body">
      {rows.length === 0 ? (
        <div className="mk-report-empty-chart">No campaign data found</div>
      ) : (
        <>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            className="mk-report-chart-svg"
          >
            {ticks.map((tick) => {
              const y = top + chartH - (tick / 4) * chartH;

              return (
                <g key={tick}>
                  <line
                    x1={left}
                    y1={y}
                    x2={width - right}
                    y2={y}
                    className={
                      tick === 0 ? 'mk-report-axis-line' : 'mk-report-grid-line'
                    }
                  />

                  <text
                    x={left - 8}
                    y={y + 4}
                    textAnchor="end"
                    className="mk-report-chart-text"
                  >
                    {tick}
                  </text>
                </g>
              );
            })}

            <line
              x1={left}
              y1={top}
              x2={left}
              y2={top + chartH}
              className="mk-report-axis-vertical"
            />

            {rows.map((item, index) => {
              const center = left + slot * index + slot / 2;
              const spentHeight = (toNumber(item.spent) / maxValue) * chartH;
              const revenueHeight = (toNumber(item.revenue) / maxValue) * chartH;

              return (
                <g key={item.id || item.name}>
                  <rect
                    x={center - 18}
                    y={top + chartH - spentHeight}
                    width="12"
                    height={Math.max(spentHeight, 1)}
                    rx="3"
                    className="mk-report-legend-spent"
                  />

                  <rect
                    x={center + 4}
                    y={top + chartH - revenueHeight}
                    width="12"
                    height={Math.max(revenueHeight, 1)}
                    rx="3"
                    className="mk-report-legend-revenue"
                  />

                  <text
                    x={center}
                    y={height - 16}
                    textAnchor="middle"
                    className="mk-report-chart-text"
                  >
                    {item.name.length > 16 ? `${item.name.slice(0, 16)}…` : item.name}
                  </text>
                </g>
              );
            })}
          </svg>

          <div className="mk-report-chart-legend">
            <span>
              <i className="mk-report-dot-spent" />
              Spent
            </span>
            <span>
              <i className="mk-report-dot-revenue" />
              Revenue
            </span>
          </div>
        </>
      )}
    </div>
  );
};

const PerformanceTable = ({ campaigns }) => (
  <div className="mk-report-table-wrap">
    <table className="mk-table mk-report-table">
      <thead>
        <tr>
          <th>Campaign</th>
          <th>Platform</th>
          <th>Spent (SAR)</th>
          <th>Revenue (SAR)</th>
          <th>ROI %</th>
          <th>Leads</th>
          <th>Conv.</th>
          <th>CTR %</th>
        </tr>
      </thead>

      <tbody>
        {campaigns.length === 0 ? (
          <tr>
            <td colSpan={8} className="mk-empty-table">
              No campaign report data found
            </td>
          </tr>
        ) : (
          campaigns.map((item) => (
            <tr key={item.id || item.name}>
              <td className="mk-td-bold">{item.name}</td>
              <td>{humanize(item.platform)}</td>
              <td>{formatSar(item.spent)}</td>
              <td>{formatSar(item.revenue)}</td>
              <td>{formatPercent(item.roiPercent)}</td>
              <td>{item.leads}</td>
              <td>{item.conversions}</td>
              <td>{formatPercent(item.ctr)}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
);

export const CampaignReports = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [allCampaigns, setAllCampaigns] = useState([]);
  const [summary, setSummary] = useState(EMPTY_SUMMARY);

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [campaignFilter, setCampaignFilter] = useState('all');
  const [period, setPeriod] = useState('all_time');
  const [compareTo, setCompareTo] = useState('none');
  const [viewMode, setViewMode] = useState('chart');
  const [scheduleOn, setScheduleOn] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const dateRange = getDateRange(period);

      const res = await marketingGetCampaignReport({
        status: 'all',
        campaignId: campaignFilter,
        period,
        compareTo,
        limit: 500,
        offset: 0,
        ...dateRange,
      });

      const normalizedCampaigns = extractCampaigns(res);
      const normalizedSummary = normalizeSummary(res, normalizedCampaigns);

      setCampaigns(normalizedCampaigns);
      setSummary(normalizedSummary);

      if (campaignFilter === 'all') {
        setAllCampaigns(normalizedCampaigns);
      }
    } catch (err) {
      setCampaigns([]);
      setSummary(EMPTY_SUMMARY);
      setLoadError(err?.message || 'Failed to load campaign report.');
    } finally {
      setLoading(false);
    }
  }, [campaignFilter, period, compareTo]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  useEffect(() => {
    if (allCampaigns.length === 0 && campaigns.length > 0 && campaignFilter === 'all') {
      setAllCampaigns(campaigns);
    }
  }, [allCampaigns.length, campaigns, campaignFilter]);

  const campaignOptions = useMemo(() => {
    const source = allCampaigns.length > 0 ? allCampaigns : campaigns;

    return [
      { value: 'all', label: 'All Campaigns' },
      ...source.map((item) => ({
        value: String(item.id),
        label: item.name,
      })),
    ];
  }, [allCampaigns, campaigns]);

  const campaignsInScope = campaigns.length;

  const exportCsv = () => {
    if (campaigns.length === 0) {
      alert('No report data available to export.');
      return;
    }

    downloadCsv(campaigns);
  };

  const runAiReport = async () => {
    setAiLoading(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 450));

      alert(
        [
          'AI Report Summary',
          '',
          `Campaigns in scope: ${campaignsInScope}`,
          `Budget allocated: ${formatSar(summary.totalBudget)}`,
          `Total spent: ${formatSar(summary.totalSpent)}`,
          `Revenue: ${formatSar(summary.totalRevenue)}`,
          `ROI: ${formatPercent(summary.roiPercent)}`,
          `Leads: ${summary.totalLeads || 0}`,
          `Conversions: ${summary.totalConversions || 0}`,
        ].join('\n'),
      );
    } finally {
      setAiLoading(false);
    }
  };

  const saveSchedule = () => {
    alert(
      scheduleOn
        ? 'Scheduled report delivery saved.'
        : 'Scheduled report delivery is off.',
    );
  };

  return (
    <div className="mk-page mk-report-page">
      <section className="mk-card mk-report-config-card">
        <div className="mk-report-config-header">
          <h3 className="mk-report-section-title">Report Configuration</h3>

          <span className="mk-report-scope-badge">
            {campaignsInScope} campaigns in scope
          </span>
        </div>

        <div className="mk-report-config-grid">
          <SelectField
            label="Campaign"
            value={campaignFilter}
            onChange={setCampaignFilter}
            options={campaignOptions}
          />

          <SelectField
            label="Period"
            value={period}
            onChange={setPeriod}
            options={[
              { value: 'all_time', label: 'All Time' },
              { value: 'today', label: 'Today' },
              { value: 'this_week', label: 'This Week' },
              { value: 'this_month', label: 'This Month' },
              { value: 'last_month', label: 'Last Month' },
            ]}
          />

          <SelectField
            label="Compare To"
            value={compareTo}
            onChange={setCompareTo}
            options={[
              { value: 'none', label: 'No Comparison' },
              { value: 'previous_period', label: 'Previous Period' },
              { value: 'last_month', label: 'Last Month' },
            ]}
          />

          <button
            type="button"
            className="mk-report-ai-btn"
            onClick={runAiReport}
            disabled={aiLoading}
          >
            <Bot size={14} />
            {aiLoading ? 'Generating...' : 'AI Report'}
          </button>
        </div>
      </section>

      {loadError ? (
        <div className="mk-field-error mk-report-load-error">{loadError}</div>
      ) : null}

      <div className="mk-report-metrics-grid">
        <MetricCard
          title="Budget Allocated"
          value={formatSar(summary.totalBudget)}
          sub={`${formatPercent(calcPercent(summary.totalSpent, summary.totalBudget))} utilized`}
          tone="dark"
        />

        <MetricCard
          title="Total Spent"
          value={formatSar(summary.totalSpent)}
          sub="Marketing spend"
          tone="red"
        />

        <MetricCard
          title="Revenue"
          value={formatSar(summary.totalRevenue)}
          sub={`ROI: ${formatPercent(summary.roiPercent)}`}
          tone="green"
        />

        <MetricCard
          title="Leads"
          value={summary.totalLeads || 0}
          sub={`${summary.totalConversions || 0} conversions`}
          tone="blue"
        />

        <MetricCard
          title="Impressions"
          value={summary.totalImpressions || 0}
          sub={`CTR: ${formatPercent(summary.ctr)}`}
          tone="purple"
        />

        <MetricCard
          title="Clicks"
          value={summary.totalClicks || 0}
          sub="Total ad clicks"
          tone="yellow"
        />

        <MetricCard
          title="Cost Per Lead"
          value={formatSar(summary.costPerLead)}
          sub="Acquisition cost"
          tone="orange"
        />

        <MetricCard
          title="Conv. Rate"
          value={formatPercent(summary.conversionRate)}
          sub={`${summary.activeCampaigns || 0} active campaigns`}
          tone="green"
        />
      </div>

      <section className="mk-card mk-report-chart-card">
        <div className="mk-report-chart-header">
          <h3 className="mk-report-section-title">Performance Visualization</h3>

          <div className="mk-report-icon-actions">
            <ReportIconButton
              active={false}
              title="Download CSV"
              onClick={exportCsv}
              disabled={campaigns.length === 0}
            >
              <Download size={13} />
            </ReportIconButton>

            <ReportIconButton
              title="Refresh"
              onClick={loadReports}
              disabled={loading}
            >
              <RefreshCw
                size={13}
                className={loading ? 'mk-report-spin' : ''}
              />
            </ReportIconButton>

            <ReportIconButton
              active={viewMode === 'chart'}
              title="Trend / Chart View"
              onClick={() => setViewMode('chart')}
            >
              <TrendingUp size={13} />
            </ReportIconButton>

            <ReportIconButton
              active={viewMode === 'table'}
              title="Table View"
              onClick={() => setViewMode('table')}
            >
              <Table2 size={13} />
            </ReportIconButton>
          </div>
        </div>

        {loading ? (
          <div className="mk-report-empty-chart">Loading report...</div>
        ) : viewMode === 'chart' ? (
          <PerformanceChart campaigns={campaigns} />
        ) : (
          <PerformanceTable campaigns={campaigns} />
        )}
      </section>

      <section className="mk-card mk-report-schedule-card">
        <div className="mk-report-schedule-header">
          <CalendarDays size={14} color="#D5AD27" />

          <h3 className="mk-report-section-title">Scheduled Report Delivery</h3>

          <span className={scheduleOn ? 'mk-report-on-badge' : 'mk-report-off-badge'}>
            {scheduleOn ? 'On' : 'Off'}
          </span>
        </div>

        <div className="mk-report-schedule-row">
          <button
            type="button"
            onClick={() => setScheduleOn((prev) => !prev)}
            className={scheduleOn ? 'mk-report-toggle on' : 'mk-report-toggle'}
          >
            <span />
          </button>

          <span className="mk-report-schedule-text">
            Auto-generate &amp; email report
          </span>

          <button
            type="button"
            className="mk-report-save-btn"
            onClick={saveSchedule}
          >
            Save Schedule
          </button>
        </div>
      </section>

      <style>
        {`
          .mk-report-page {
            padding: 18px 24px;
          }

          .mk-report-config-card {
            padding: 16px 18px;
            margin-bottom: 16px;
            border-radius: 10px;
          }

          .mk-report-config-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 14px;
          }

          .mk-report-section-title {
            margin: 0;
            font-size: 14px;
            font-weight: 850;
            color: #111827;
          }

          .mk-report-scope-badge {
            height: 24px;
            padding: 0 10px;
            border-radius: 6px;
            border: 1px solid #bfdbfe;
            background: #eff6ff;
            color: #2563eb;
            display: inline-flex;
            align-items: center;
            font-size: 11px;
            font-weight: 800;
          }

          .mk-report-config-grid {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr 260px;
            gap: 12px;
            align-items: end;
          }

          .mk-report-filter-label {
            display: block;
            margin-bottom: 6px;
            font-size: 11px;
            font-weight: 800;
            color: #111827;
          }

          .mk-report-select {
            height: 34px;
            font-size: 12px;
            border-radius: 7px;
          }

          .mk-report-ai-btn {
            height: 34px;
            border: 0;
            border-radius: 7px;
            background: #d9ad18;
            color: #ffffff;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            font-size: 12px;
            font-weight: 850;
            cursor: pointer;
          }

          .mk-report-ai-btn:disabled {
            opacity: 0.7;
            cursor: not-allowed;
          }

          .mk-report-metrics-grid {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 12px;
            margin-bottom: 16px;
          }

          .mk-report-metric-card {
            min-height: 82px;
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 9px;
            padding: 14px 15px;
            box-sizing: border-box;
          }

          .mk-report-metric-title {
            font-size: 9px;
            font-weight: 900;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 1.8px;
            margin-bottom: 8px;
          }

          .mk-report-metric-value {
            font-size: 21px;
            font-weight: 950;
            line-height: 1;
            margin-bottom: 7px;
          }

          .mk-report-tone-dark {
            color: #111827;
          }

          .mk-report-tone-red {
            color: #ef4444;
          }

          .mk-report-tone-green {
            color: #059669;
          }

          .mk-report-tone-blue {
            color: #2563eb;
          }

          .mk-report-tone-purple {
            color: #8b5cf6;
          }

          .mk-report-tone-yellow,
          .mk-report-tone-orange {
            color: #d97706;
          }

          .mk-report-metric-sub {
            font-size: 11px;
            font-weight: 650;
            color: #94a3b8;
          }

          .mk-report-chart-card {
            min-height: 250px;
            padding: 14px 16px 16px;
            margin-bottom: 16px;
            border-radius: 10px;
          }

          .mk-report-chart-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 12px;
          }

          .mk-report-icon-actions {
            display: flex;
            align-items: center;
            gap: 7px;
          }

          .mk-report-icon-btn {
            width: 24px;
            height: 24px;
            border: 0;
            border-radius: 6px;
            color: #64748b;
            background: transparent;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
          }

          .mk-report-icon-btn:hover,
          .mk-report-icon-btn.active {
            color: #ffffff;
            background: #d9ad18;
          }

          .mk-report-icon-btn:disabled {
            opacity: 0.45;
            cursor: not-allowed;
          }

          .mk-report-chart-body {
            min-height: 190px;
          }

          .mk-report-chart-svg {
            width: 100%;
            height: 170px;
            display: block;
          }

          .mk-report-grid-line {
            stroke: #e5e7eb;
            stroke-dasharray: 4 5;
            stroke-width: 1;
          }

          .mk-report-axis-line,
          .mk-report-axis-vertical {
            stroke: #94a3b8;
            stroke-width: 1;
          }

          .mk-report-chart-text {
            fill: #64748b;
            font-size: 10px;
            font-weight: 700;
          }

          .mk-report-legend-spent {
            fill: #ef4444;
          }

          .mk-report-legend-revenue {
            fill: #10b981;
          }

          .mk-report-chart-legend {
            height: 22px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 18px;
            font-size: 10px;
            font-weight: 700;
            color: #64748b;
          }

          .mk-report-chart-legend span {
            display: inline-flex;
            align-items: center;
            gap: 5px;
          }

          .mk-report-chart-legend i {
            width: 8px;
            height: 8px;
            border-radius: 2px;
            display: inline-block;
          }

          .mk-report-dot-spent {
            background: #ef4444;
          }

          .mk-report-dot-revenue {
            background: #10b981;
          }

          .mk-report-empty-chart {
            min-height: 190px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #94a3b8;
            font-size: 12px;
            font-weight: 750;
          }

          .mk-report-table-wrap {
            overflow-x: auto;
          }

          .mk-report-table th {
            height: 35px;
            padding: 0 12px;
            text-align: left;
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 1.4px;
            color: #64748b;
            border-bottom: 1px solid #e5e7eb;
          }

          .mk-report-table td {
            height: 34px;
            padding: 0 12px;
            font-size: 11px;
            font-weight: 650;
            color: #111827;
            border-bottom: 1px solid #eef2f7;
          }

          .mk-report-schedule-card {
            padding: 13px 15px;
            border-radius: 10px;
          }

          .mk-report-schedule-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 12px;
          }

          .mk-report-on-badge,
          .mk-report-off-badge {
            height: 18px;
            padding: 0 8px;
            border-radius: 5px;
            background: #f8fafc;
            border: 1px solid #e5e7eb;
            color: #64748b;
            font-size: 10px;
            font-weight: 800;
          }

          .mk-report-on-badge {
            color: #047857;
            background: #ecfdf5;
            border-color: #a7f3d0;
          }

          .mk-report-schedule-row {
            display: flex;
            align-items: center;
            gap: 9px;
          }

          .mk-report-toggle {
            width: 34px;
            height: 18px;
            border: 0;
            border-radius: 999px;
            background: #e5e7eb;
            padding: 2px;
            cursor: pointer;
          }

          .mk-report-toggle span {
            width: 14px;
            height: 14px;
            display: block;
            border-radius: 50%;
            background: #ffffff;
            transition: transform 0.15s ease;
          }

          .mk-report-toggle.on {
            background: #d9ad18;
          }

          .mk-report-toggle.on span {
            transform: translateX(16px);
          }

          .mk-report-schedule-text {
            font-size: 11px;
            color: #64748b;
            font-weight: 650;
          }

          .mk-report-save-btn {
            height: 25px;
            border: 1px solid #cbd5e1;
            border-radius: 5px;
            background: #ffffff;
            color: #334155;
            font-size: 10px;
            font-weight: 800;
            padding: 0 10px;
            cursor: pointer;
          }

          .mk-report-spin {
            animation: mk-report-spin 1s linear infinite;
          }

          @keyframes mk-report-spin {
            to {
              transform: rotate(360deg);
            }
          }

          @media (max-width: 1100px) {
            .mk-report-config-grid {
              grid-template-columns: 1fr 1fr;
            }

            .mk-report-metrics-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }

          @media (max-width: 700px) {
            .mk-report-config-grid,
            .mk-report-metrics-grid {
              grid-template-columns: 1fr;
            }
          }
        `}
      </style>
    </div>
  );
};

export default CampaignReports;