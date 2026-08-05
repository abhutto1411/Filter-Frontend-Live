import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  Bot,
  Download,
  FileText,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  Table2,
  X,
  Sparkles,
  AlertTriangle,
  Lightbulb,
  Target,
  Loader2,
} from 'lucide-react';
import {
  marketingGetCampaignReport,
  marketingGetAiCampaignReport,
} from '../../services/superAdminMarketingApi';
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

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function downloadPdf(campaigns, summary, periodLabel) {
  const generatedAt = new Date().toLocaleString();

  const summaryRows = [
    ['Budget Allocated', `${toNumber(summary.totalBudget).toLocaleString()} SAR`],
    ['Total Spent', `${toNumber(summary.totalSpent).toLocaleString()} SAR`],
    ['Revenue', `${toNumber(summary.totalRevenue).toLocaleString()} SAR`],
    ['ROI', `${toNumber(summary.roiPercent).toFixed(2)}%`],
    ['Leads', toNumber(summary.totalLeads).toLocaleString()],
    ['Conversions', toNumber(summary.totalConversions).toLocaleString()],
    ['Impressions', toNumber(summary.totalImpressions).toLocaleString()],
    ['Clicks', toNumber(summary.totalClicks).toLocaleString()],
  ]
    .map(
      ([k, v]) =>
        `<tr><td class="lbl">${escapeHtml(k)}</td><td class="val">${escapeHtml(v)}</td></tr>`,
    )
    .join('');

  const bodyRows = campaigns
    .map(
      (item) => `
      <tr>
        <td>${escapeHtml(item.name)}</td>
        <td>${escapeHtml(humanize(item.platform))}</td>
        <td class="num">${toNumber(item.budget).toLocaleString()}</td>
        <td class="num">${toNumber(item.spent).toLocaleString()}</td>
        <td class="num">${toNumber(item.revenue).toLocaleString()}</td>
        <td class="num">${toNumber(item.roiPercent).toFixed(1)}%</td>
        <td class="num">${toNumber(item.leads).toLocaleString()}</td>
        <td class="num">${toNumber(item.conversions).toLocaleString()}</td>
        <td>${escapeHtml(humanize(item.status))}</td>
      </tr>`,
    )
    .join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8" />
  <title>Campaign Report</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #1e293b; margin: 24px; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    .meta { color: #64748b; font-size: 12px; margin-bottom: 18px; }
    h2 { font-size: 14px; margin: 18px 0 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; }
    th { background: #f1f5f9; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
    td.num, td.val { text-align: right; }
    .summary-table { width: 320px; margin-bottom: 8px; }
    .summary-table td.lbl { color: #64748b; }
    @media print { body { margin: 12mm; } }
  </style></head><body>
    <h1>Campaign Performance Report</h1>
    <div class="meta">Period: ${escapeHtml(periodLabel)} &nbsp;|&nbsp; Generated: ${escapeHtml(generatedAt)} &nbsp;|&nbsp; ${campaigns.length} campaigns</div>
    <h2>Summary</h2>
    <table class="summary-table">${summaryRows}</table>
    <h2>Campaigns</h2>
    <table>
      <thead><tr>
        <th>Campaign</th><th>Platform</th><th>Budget</th><th>Spent</th>
        <th>Revenue</th><th>ROI</th><th>Leads</th><th>Conv.</th><th>Status</th>
      </tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
    <script>window.onload = function () { window.print(); };</script>
  </body></html>`;

  const win = window.open('', '_blank');
  if (!win) {
    alert('Please allow pop-ups to export the PDF.');
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
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

const TrendIcon = ({ trend }) => {
  if (trend === 'up') return <TrendingUp size={14} className="mk-ai-trend-up" />;
  if (trend === 'down')
    return <TrendingDown size={14} className="mk-ai-trend-down" />;
  return <Minus size={14} className="mk-ai-trend-flat" />;
};

function scoreColor(score) {
  if (score >= 70) return '#16a34a';
  if (score >= 40) return '#d97706';
  return '#dc2626';
}

function aiReportToHtml(report, meta) {
  const km = report.keyMetrics || {};
  const list = (arr, render) => (arr || []).map(render).join('');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <title>${escapeHtml(report.title || 'Campaign Report')}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color:#1e293b; margin:28px; line-height:1.5; }
    h1 { font-size:22px; margin:0 0 2px; }
    h2 { font-size:15px; margin:22px 0 8px; border-bottom:2px solid #e2e8f0; padding-bottom:4px; }
    .meta { color:#64748b; font-size:12px; margin-bottom:6px; }
    .summary { background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px; font-size:13px; }
    .km { display:flex; flex-wrap:wrap; gap:10px; margin-top:10px; }
    .km div { border:1px solid #e2e8f0; border-radius:8px; padding:8px 12px; min-width:120px; }
    .km span { display:block; color:#64748b; font-size:10px; text-transform:uppercase; letter-spacing:.5px; }
    .km b { font-size:15px; }
    table { width:100%; border-collapse:collapse; font-size:12px; margin-top:4px; }
    th,td { border:1px solid #e2e8f0; padding:6px 9px; text-align:left; vertical-align:top; }
    th { background:#f1f5f9; }
    .pill { font-size:10px; font-weight:700; padding:2px 7px; border-radius:10px; text-transform:uppercase; }
    .hi { background:#fee2e2; color:#b91c1c; } .med{ background:#fef3c7;color:#b45309;} .low{background:#dbeafe;color:#1d4ed8;}
    @media print { body { margin:12mm; } }
  </style></head><body>
    <h1>${escapeHtml(report.title || 'Campaign Performance Report')}</h1>
    <div class="meta">Period: ${escapeHtml(report.period || '')} &nbsp;|&nbsp; Generated: ${escapeHtml(new Date(meta.generatedAt || Date.now()).toLocaleString())} &nbsp;|&nbsp; ${meta.llmUsed ? 'AI (LLM) analysis' : 'Data-driven analysis'} &nbsp;|&nbsp; Health score: ${report.healthScore ?? '-'} /100</div>
    <h2>Executive Summary</h2>
    <div class="summary">${escapeHtml(report.executiveSummary || '')}</div>
    <div class="km">
      <div><span>Budget</span><b>${toNumber(km.budgetAllocated).toLocaleString()} SAR</b></div>
      <div><span>Spent</span><b>${toNumber(km.totalSpent).toLocaleString()} SAR</b></div>
      <div><span>Revenue</span><b>${toNumber(km.totalRevenue).toLocaleString()} SAR</b></div>
      <div><span>ROI</span><b>${toNumber(km.roi)}%</b></div>
      <div><span>Leads</span><b>${toNumber(km.leads)}</b></div>
      <div><span>Conversions</span><b>${toNumber(km.conversions)}</b></div>
      <div><span>Cost / Lead</span><b>${toNumber(km.costPerLead)} SAR</b></div>
    </div>
    <h2>Performance Analysis</h2>
    <table><tbody>${list(report.performanceAnalysis, (a) => `<tr><td style="width:160px"><b>${escapeHtml(a.title)}</b></td><td>${escapeHtml(a.detail)}</td></tr>`)}</tbody></table>
    <h2>Platform Insights</h2>
    <table><tbody>${list(report.platformInsights, (p) => `<tr><td style="width:140px"><b>${escapeHtml(humanize(p.platform))}</b></td><td>${escapeHtml(p.detail)}</td></tr>`)}</tbody></table>
    <h2>Predictions (Next Period)</h2>
    <table><thead><tr><th>Metric</th><th>Current</th><th>Projected</th><th>Trend</th><th>Rationale</th></tr></thead>
    <tbody>${list(report.predictions, (p) => `<tr><td><b>${escapeHtml(p.metric)}</b></td><td>${escapeHtml(String(p.current))}</td><td>${escapeHtml(String(p.projectedNextPeriod))}</td><td>${escapeHtml(p.trend)}</td><td>${escapeHtml(p.rationale)}</td></tr>`)}</tbody></table>
    <h2>Recommendations</h2>
    <table><thead><tr><th>Priority</th><th>Action</th><th>Expected Impact</th></tr></thead>
    <tbody>${list(report.recommendations, (r) => `<tr><td><span class="pill ${r.priority === 'high' ? 'hi' : r.priority === 'medium' ? 'med' : 'low'}">${escapeHtml(r.priority)}</span></td><td><b>${escapeHtml(r.title)}</b><br/>${escapeHtml(r.action)}</td><td>${escapeHtml(r.expectedImpact || '')}</td></tr>`)}</tbody></table>
    ${(report.risks || []).length ? `<h2>Risk Alerts</h2><table><thead><tr><th>Severity</th><th>Risk</th></tr></thead><tbody>${list(report.risks, (r) => `<tr><td><span class="pill ${r.severity === 'high' ? 'hi' : 'med'}">${escapeHtml(r.severity)}</span></td><td><b>${escapeHtml(r.title)}</b><br/>${escapeHtml(r.message)}</td></tr>`)}</tbody></table>` : ''}
    <script>window.onload=function(){window.print();};</script>
  </body></html>`;
  const win = window.open('', '_blank');
  if (!win) {
    alert('Please allow pop-ups to export the PDF.');
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

const AiReportModal = ({ data, loading, error, onClose, onRetry }) => {
  const report = data?.report;
  const km = report?.keyMetrics || {};

  return (
    <div className="mk-ai-overlay" role="dialog" aria-modal="true">
      <div className="mk-ai-modal">
        <div className="mk-ai-head">
          <div className="mk-ai-head-title">
            <Sparkles size={18} />
            <div>
              <h2>AI Campaign Report</h2>
              <span>
                {loading
                  ? 'Analyzing your marketing data...'
                  : data
                    ? `${report?.period || ''} · ${data.llmUsed ? 'AI (LLM) analysis' : 'Data-driven analysis'}`
                    : 'Professional analysis & recommendations'}
              </span>
            </div>
          </div>
          <div className="mk-ai-head-actions">
            {report ? (
              <button
                type="button"
                className="mk-ai-pdf-btn"
                onClick={() =>
                  aiReportToHtml(report, {
                    generatedAt: data.generatedAt,
                    llmUsed: data.llmUsed,
                  })
                }
              >
                <FileText size={14} /> PDF
              </button>
            ) : null}
            <button type="button" className="mk-ai-close" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="mk-ai-body">
          {loading ? (
            <div className="mk-ai-loading">
              <Loader2 size={34} className="mk-ai-spin" />
              <p>Reading configuration & analyzing performance...</p>
            </div>
          ) : error ? (
            <div className="mk-ai-error">
              <AlertTriangle size={24} />
              <p>{error}</p>
              <button type="button" className="mk-report-ai-btn" onClick={onRetry}>
                Retry
              </button>
            </div>
          ) : report ? (
            <>
              {data?.note ? <div className="mk-ai-note">{data.note}</div> : null}

              <div className="mk-ai-top">
                <div
                  className="mk-ai-score"
                  style={{ borderColor: scoreColor(report.healthScore) }}
                >
                  <div
                    className="mk-ai-score-num"
                    style={{ color: scoreColor(report.healthScore) }}
                  >
                    {report.healthScore ?? '-'}
                  </div>
                  <div className="mk-ai-score-label">Health Score</div>
                </div>
                <div className="mk-ai-summary">
                  <h3>Executive Summary</h3>
                  <p>{report.executiveSummary}</p>
                </div>
              </div>

              <div className="mk-ai-kpis">
                {[
                  ['Budget', `${toNumber(km.budgetAllocated).toLocaleString()} SAR`],
                  ['Spent', `${toNumber(km.totalSpent).toLocaleString()} SAR`],
                  ['Revenue', `${toNumber(km.totalRevenue).toLocaleString()} SAR`],
                  ['ROI', `${toNumber(km.roi)}%`],
                  ['Leads', toNumber(km.leads).toLocaleString()],
                  ['Conversions', toNumber(km.conversions).toLocaleString()],
                  ['CPL', `${toNumber(km.costPerLead)} SAR`],
                  ['Conv. Rate', `${toNumber(km.conversionRate)}%`],
                ].map(([label, value]) => (
                  <div key={label} className="mk-ai-kpi">
                    <span>{label}</span>
                    <b>{value}</b>
                  </div>
                ))}
              </div>

              {report.performanceAnalysis?.length ? (
                <section className="mk-ai-section">
                  <h3>
                    <Target size={15} /> Performance Analysis
                  </h3>
                  <div className="mk-ai-rows">
                    {report.performanceAnalysis.map((a, i) => (
                      <div key={i} className="mk-ai-row">
                        <b>{a.title}</b>
                        <span>{a.detail}</span>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {report.platformInsights?.length ? (
                <section className="mk-ai-section">
                  <h3>Platform Insights</h3>
                  <div className="mk-ai-rows">
                    {report.platformInsights.map((p, i) => (
                      <div key={i} className="mk-ai-row">
                        <b>{humanize(p.platform)}</b>
                        <span>{p.detail}</span>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {(report.topPerformers?.length ||
                report.underperformers?.length) ? (
                <div className="mk-ai-two-col">
                  {report.topPerformers?.length ? (
                    <section className="mk-ai-section">
                      <h3 className="mk-ai-good">Top Performers</h3>
                      {report.topPerformers.map((t, i) => (
                        <div key={i} className="mk-ai-perf">
                          <b>{t.name}</b>
                          <span>{t.reason}</span>
                        </div>
                      ))}
                    </section>
                  ) : null}
                  {report.underperformers?.length ? (
                    <section className="mk-ai-section">
                      <h3 className="mk-ai-bad">Underperformers</h3>
                      {report.underperformers.map((t, i) => (
                        <div key={i} className="mk-ai-perf">
                          <b>{t.name}</b>
                          <span>{t.reason}</span>
                        </div>
                      ))}
                    </section>
                  ) : null}
                </div>
              ) : null}

              {report.predictions?.length ? (
                <section className="mk-ai-section">
                  <h3>
                    <TrendingUp size={15} /> Predictions — Next Period
                  </h3>
                  <div className="mk-ai-pred-grid">
                    {report.predictions.map((p, i) => (
                      <div key={i} className="mk-ai-pred">
                        <div className="mk-ai-pred-head">
                          <span>{p.metric}</span>
                          <TrendIcon trend={p.trend} />
                        </div>
                        <div className="mk-ai-pred-vals">
                          <span>{toNumber(p.current).toLocaleString()}</span>
                          <span className="mk-ai-arrow">→</span>
                          <b>{toNumber(p.projectedNextPeriod).toLocaleString()}</b>
                        </div>
                        <p>{p.rationale}</p>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {report.recommendations?.length ? (
                <section className="mk-ai-section">
                  <h3>
                    <Lightbulb size={15} /> Recommendations
                  </h3>
                  {report.recommendations.map((r, i) => (
                    <div key={i} className="mk-ai-rec">
                      <span className={`mk-ai-pri mk-ai-pri-${r.priority}`}>
                        {r.priority}
                      </span>
                      <div>
                        <b>{r.title}</b>
                        <p>{r.action}</p>
                        {r.expectedImpact ? (
                          <em>Impact: {r.expectedImpact}</em>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </section>
              ) : null}

              {report.risks?.length ? (
                <section className="mk-ai-section">
                  <h3 className="mk-ai-bad">
                    <AlertTriangle size={15} /> Risk Alerts
                  </h3>
                  {report.risks.map((r, i) => (
                    <div key={i} className={`mk-ai-risk sev-${r.severity}`}>
                      <b>{r.title}</b>
                      <span>{r.message}</span>
                    </div>
                  ))}
                </section>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

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
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [compareTo, setCompareTo] = useState('none');
  const [viewMode, setViewMode] = useState('chart');
  const [scheduleOn, setScheduleOn] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReportOpen, setAiReportOpen] = useState(false);
  const [aiReport, setAiReport] = useState(null);
  const [aiError, setAiError] = useState('');

  const loadReports = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const dateRange =
        period === 'custom'
          ? {
              startDate: customStart || undefined,
              endDate: customEnd || undefined,
              dateFrom: customStart || undefined,
              dateTo: customEnd || undefined,
            }
          : getDateRange(period);

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
  }, [campaignFilter, period, compareTo, customStart, customEnd]);

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

  const periodLabel = useMemo(() => {
    const map = {
      all_time: 'All Time',
      today: 'Today',
      this_week: 'This Week',
      this_month: 'This Month',
      last_month: 'Last Month',
    };
    return map[period] || humanize(period);
  }, [period]);

  const exportCsv = () => {
    if (campaigns.length === 0) {
      alert('No report data available to export.');
      return;
    }

    downloadCsv(campaigns);
  };

  const exportPdf = () => {
    if (campaigns.length === 0) {
      alert('No report data available to export.');
      return;
    }

    downloadPdf(campaigns, summary, periodLabel);
  };

  const runAiReport = async () => {
    setAiReportOpen(true);
    setAiLoading(true);
    setAiError('');
    setAiReport(null);

    try {
      const dateRange =
        period === 'custom'
          ? {
              startDate: customStart || undefined,
              endDate: customEnd || undefined,
              dateFrom: customStart || undefined,
              dateTo: customEnd || undefined,
            }
          : getDateRange(period);

      const res = await marketingGetAiCampaignReport({
        status: 'all',
        campaignId: campaignFilter,
        period,
        compareTo,
        limit: 500,
        offset: 0,
        ...dateRange,
      });

      if (!res?.report) {
        throw new Error('No report returned by the server.');
      }

      setAiReport(res);
    } catch (err) {
      setAiError(err?.message || 'Failed to generate AI report.');
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
              { value: 'custom', label: 'Custom Range' },
            ]}
          />

          {period === 'custom' ? (
            <>
              <div className="mk-report-filter">
                <label className="mk-report-filter-label">From</label>
                <input
                  type="date"
                  className="mk-input mk-report-select"
                  value={customStart}
                  max={customEnd || undefined}
                  onChange={(e) => setCustomStart(e.target.value)}
                />
              </div>

              <div className="mk-report-filter">
                <label className="mk-report-filter-label">To</label>
                <input
                  type="date"
                  className="mk-input mk-report-select"
                  value={customEnd}
                  min={customStart || undefined}
                  onChange={(e) => setCustomEnd(e.target.value)}
                />
              </div>
            </>
          ) : null}

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
              active={false}
              title="Export PDF"
              onClick={exportPdf}
              disabled={campaigns.length === 0}
            >
              <FileText size={13} />
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

          .mk-ai-overlay {
            position: fixed;
            inset: 0;
            background: rgba(15, 23, 42, 0.55);
            display: flex;
            align-items: flex-start;
            justify-content: center;
            z-index: 1200;
            padding: 28px 16px;
            overflow-y: auto;
          }

          .mk-ai-modal {
            background: #f8fafc;
            border-radius: 14px;
            width: 100%;
            max-width: 860px;
            box-shadow: 0 24px 60px rgba(2, 6, 23, 0.35);
            overflow: hidden;
          }

          .mk-ai-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 20px;
            background: linear-gradient(120deg, #1e3a8a, #7c3aed);
            color: #fff;
          }

          .mk-ai-head-title {
            display: flex;
            align-items: center;
            gap: 11px;
          }

          .mk-ai-head-title h2 {
            margin: 0;
            font-size: 16px;
            font-weight: 850;
          }

          .mk-ai-head-title span {
            font-size: 11px;
            opacity: 0.85;
          }

          .mk-ai-head-actions {
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .mk-ai-pdf-btn {
            border: 0;
            background: rgba(255, 255, 255, 0.18);
            color: #fff;
            border-radius: 7px;
            padding: 6px 11px;
            font-size: 12px;
            font-weight: 700;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            cursor: pointer;
          }

          .mk-ai-pdf-btn:hover {
            background: rgba(255, 255, 255, 0.28);
          }

          .mk-ai-close {
            border: 0;
            background: transparent;
            color: #fff;
            cursor: pointer;
            display: inline-flex;
          }

          .mk-ai-body {
            padding: 20px;
            max-height: calc(100vh - 130px);
            overflow-y: auto;
          }

          .mk-ai-loading,
          .mk-ai-error {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 12px;
            padding: 60px 20px;
            color: #64748b;
            text-align: center;
          }

          .mk-ai-error svg { color: #dc2626; }

          .mk-ai-spin { animation: mk-report-spin 1s linear infinite; color: #7c3aed; }

          .mk-ai-note {
            background: #fffbeb;
            border: 1px solid #fde68a;
            color: #92400e;
            border-radius: 8px;
            padding: 9px 12px;
            font-size: 12px;
            margin-bottom: 14px;
          }

          .mk-ai-top {
            display: flex;
            gap: 16px;
            margin-bottom: 16px;
          }

          .mk-ai-score {
            flex: 0 0 110px;
            border: 3px solid #16a34a;
            border-radius: 12px;
            background: #fff;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 12px;
          }

          .mk-ai-score-num { font-size: 34px; font-weight: 900; line-height: 1; }
          .mk-ai-score-label { font-size: 10px; color: #64748b; font-weight: 700; margin-top: 4px; text-transform: uppercase; }

          .mk-ai-summary {
            flex: 1;
            background: #fff;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 14px 16px;
          }

          .mk-ai-summary h3 { margin: 0 0 6px; font-size: 13px; font-weight: 850; color: #0f172a; }
          .mk-ai-summary p { margin: 0; font-size: 13px; color: #334155; line-height: 1.55; }

          .mk-ai-kpis {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 10px;
            margin-bottom: 18px;
          }

          .mk-ai-kpi {
            background: #fff;
            border: 1px solid #e2e8f0;
            border-radius: 9px;
            padding: 9px 11px;
          }

          .mk-ai-kpi span { display: block; font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; }
          .mk-ai-kpi b { font-size: 15px; color: #0f172a; }

          .mk-ai-section {
            background: #fff;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 14px 16px;
            margin-bottom: 14px;
          }

          .mk-ai-section h3 {
            margin: 0 0 10px;
            font-size: 13px;
            font-weight: 850;
            color: #0f172a;
            display: inline-flex;
            align-items: center;
            gap: 7px;
          }

          .mk-ai-good { color: #16a34a; }
          .mk-ai-bad { color: #dc2626; }

          .mk-ai-rows { display: grid; gap: 9px; }
          .mk-ai-row b { display: block; font-size: 12px; color: #0f172a; }
          .mk-ai-row span { font-size: 12px; color: #475569; }

          .mk-ai-two-col {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 14px;
          }

          .mk-ai-perf { margin-bottom: 9px; }
          .mk-ai-perf b { display: block; font-size: 12px; color: #0f172a; }
          .mk-ai-perf span { font-size: 11px; color: #64748b; }

          .mk-ai-pred-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 10px;
          }

          .mk-ai-pred {
            border: 1px solid #e2e8f0;
            border-radius: 9px;
            padding: 10px 12px;
            background: #f8fafc;
          }

          .mk-ai-pred-head { display: flex; align-items: center; justify-content: space-between; font-size: 11px; font-weight: 800; color: #334155; text-transform: uppercase; }
          .mk-ai-pred-vals { display: flex; align-items: baseline; gap: 7px; margin: 6px 0; }
          .mk-ai-pred-vals span { color: #94a3b8; font-size: 13px; }
          .mk-ai-pred-vals b { color: #0f172a; font-size: 17px; }
          .mk-ai-arrow { color: #cbd5e1; }
          .mk-ai-pred p { margin: 0; font-size: 11px; color: #64748b; line-height: 1.45; }

          .mk-ai-trend-up { color: #16a34a; }
          .mk-ai-trend-down { color: #dc2626; }
          .mk-ai-trend-flat { color: #94a3b8; }

          .mk-ai-rec {
            display: flex;
            gap: 11px;
            padding: 10px 0;
            border-top: 1px solid #f1f5f9;
          }

          .mk-ai-rec:first-of-type { border-top: 0; }
          .mk-ai-rec b { font-size: 12.5px; color: #0f172a; }
          .mk-ai-rec p { margin: 3px 0; font-size: 12px; color: #475569; }
          .mk-ai-rec em { font-size: 11px; color: #16a34a; font-style: normal; font-weight: 600; }

          .mk-ai-pri {
            flex: 0 0 auto;
            height: fit-content;
            font-size: 9px;
            font-weight: 800;
            text-transform: uppercase;
            padding: 3px 8px;
            border-radius: 10px;
            letter-spacing: .5px;
          }

          .mk-ai-pri-high { background: #fee2e2; color: #b91c1c; }
          .mk-ai-pri-medium { background: #fef3c7; color: #b45309; }
          .mk-ai-pri-low { background: #dbeafe; color: #1d4ed8; }

          .mk-ai-risk {
            border-radius: 8px;
            padding: 9px 12px;
            margin-bottom: 8px;
            border-left: 4px solid #f59e0b;
            background: #fffbeb;
          }

          .mk-ai-risk.sev-high { border-left-color: #dc2626; background: #fef2f2; }
          .mk-ai-risk b { display: block; font-size: 12px; color: #0f172a; }
          .mk-ai-risk span { font-size: 11.5px; color: #64748b; }

          @media (max-width: 760px) {
            .mk-ai-kpis { grid-template-columns: repeat(2, 1fr); }
            .mk-ai-pred-grid { grid-template-columns: 1fr; }
            .mk-ai-two-col { grid-template-columns: 1fr; }
            .mk-ai-top { flex-direction: column; }
          }
        `}
      </style>

      {aiReportOpen ? (
        <AiReportModal
          data={aiReport}
          loading={aiLoading}
          error={aiError}
          onClose={() => setAiReportOpen(false)}
          onRetry={runAiReport}
        />
      ) : null}
    </div>
  );
};

export default CampaignReports;