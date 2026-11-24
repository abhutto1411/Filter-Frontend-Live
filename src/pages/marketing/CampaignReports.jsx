import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
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
  BarChart3,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  marketingGetCampaignReport,
  marketingGetAiCampaignReport,
} from '../../services/superAdminMarketingApi';
import {
  mktCampReportT,
  mktCampReportMoney,
  mktCampReportPercent,
} from '../../utils/marketingCampaignReportsI18n';
import {
  mktCampPlatformLabel,
  mktCampStatusLabel,
  mktCampTypeLabel,
} from '../../utils/marketingCampaignsI18n';
import Modal from '../../components/Modal';
import UiPager from '../../components/UiPager';
import { usePagedRows } from '../../hooks/usePagedRows';
import { toRiyadhDateISO } from '../../utils/riyadhBusinessRange';
import '../../styles/ui.css';

/** Recharts takes literal colours; these are ui.css token values. */
const CHART = { spent: '#b42318', revenue: '#067647', grid: '#e4e7ec' };

/** A money axis reads 2.5M, not 2500000 — the tick is a scale, not a figure. */
function compactNumber(locale, value) {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  const loc = locale === 'ar' ? 'ar-SA' : undefined;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toLocaleString(loc, { maximumFractionDigits: 1 })}M`;
  if (abs >= 1_000) return `${(n / 1_000).toLocaleString(loc, { maximumFractionDigits: 0 })}K`;
  return n.toLocaleString(loc, { maximumFractionDigits: 0 });
}

function useMarketingLocale() {
  const outletCtx = useOutletContext() || {};
  return (
    outletCtx.locale ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('marketing-locale') : null) ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
    'en'
  );
}

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

function calcPercent(part, total) {
  const p = toNumber(part);
  const t = toNumber(total);

  if (t <= 0) return 0;

  return (p / t) * 100;
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

function normalizeCampaign(item, defaultName) {
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
      defaultName,
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

function extractCampaigns(payload, defaultName) {
  const root = payload?.data || payload || {};

  const rows = asArray(root, [
    'campaigns',
    'campaignPerformance',
    'rows',
    'reportRows',
    'items',
  ]);

  return rows.map((item) => normalizeCampaign(item, defaultName));
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

function makeCsv(campaigns, locale, t) {
  const header = [
    t('csv.campaign'),
    t('csv.platform'),
    t('csv.type'),
    t('csv.budget'),
    t('csv.spent'),
    t('csv.revenue'),
    t('csv.roi'),
    t('csv.impressions'),
    t('csv.clicks'),
    t('csv.ctr'),
    t('csv.leads'),
    t('csv.conversions'),
    t('csv.convRate'),
    t('csv.status'),
  ];

  const rows = campaigns.map((item) => [
    item.name,
    mktCampPlatformLabel(locale, item.platform),
    mktCampTypeLabel(locale, item.type),
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
    mktCampStatusLabel(locale, item.status),
  ]);

  return [header, ...rows]
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`)
        .join(','),
    )
    .join('\n');
}

function downloadCsv(campaigns, locale, t) {
  const csv = makeCsv(campaigns, locale, t);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = `campaign-report-${toRiyadhDateISO()}.csv`;
  link.click();

  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function downloadPdf(campaigns, summary, periodLabel, locale, t) {
  const generatedAt = new Date().toLocaleString(locale === 'ar' ? 'ar-SA' : undefined);

  const summaryRows = [
    [t('pdf.budgetAllocated'), mktCampReportMoney(locale, summary.totalBudget)],
    [t('pdf.totalSpent'), mktCampReportMoney(locale, summary.totalSpent)],
    [t('pdf.revenue'), mktCampReportMoney(locale, summary.totalRevenue)],
    [t('pdf.roi'), mktCampReportPercent(locale, summary.roiPercent)],
    [t('pdf.leads'), toNumber(summary.totalLeads).toLocaleString()],
    [t('pdf.conversions'), toNumber(summary.totalConversions).toLocaleString()],
    [t('pdf.impressions'), toNumber(summary.totalImpressions).toLocaleString()],
    [t('pdf.clicks'), toNumber(summary.totalClicks).toLocaleString()],
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
        <td>${escapeHtml(mktCampPlatformLabel(locale, item.platform))}</td>
        <td class="num">${toNumber(item.budget).toLocaleString()}</td>
        <td class="num">${toNumber(item.spent).toLocaleString()}</td>
        <td class="num">${toNumber(item.revenue).toLocaleString()}</td>
        <td class="num">${toNumber(item.roiPercent).toFixed(1)}%</td>
        <td class="num">${toNumber(item.leads).toLocaleString()}</td>
        <td class="num">${toNumber(item.conversions).toLocaleString()}</td>
        <td>${escapeHtml(mktCampStatusLabel(locale, item.status))}</td>
      </tr>`,
    )
    .join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8" />
  <title>${escapeHtml(t('pdf.title'))}</title>
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
    <h1>${escapeHtml(t('pdf.h1'))}</h1>
    <div class="meta">${escapeHtml(t('pdf.meta', { period: periodLabel, generated: generatedAt, count: campaigns.length }))}</div>
    <h2>${escapeHtml(t('pdf.summary'))}</h2>
    <table class="summary-table">${summaryRows}</table>
    <h2>${escapeHtml(t('pdf.campaigns'))}</h2>
    <table>
      <thead><tr>
        <th>${escapeHtml(t('pdf.th.campaign'))}</th><th>${escapeHtml(t('pdf.th.platform'))}</th><th>${escapeHtml(t('pdf.th.budget'))}</th><th>${escapeHtml(t('pdf.th.spent'))}</th>
        <th>${escapeHtml(t('pdf.th.revenue'))}</th><th>${escapeHtml(t('pdf.th.roi'))}</th><th>${escapeHtml(t('pdf.th.leads'))}</th><th>${escapeHtml(t('pdf.th.conv'))}</th><th>${escapeHtml(t('pdf.th.status'))}</th>
      </tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
    <script>window.onload = function () { window.print(); };</script>
  </body></html>`;

  const win = window.open('', '_blank');
  if (!win) {
    alert(t('pdf.popupBlocked'));
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

const SelectField = ({ id, label, value, onChange, options }) => (
  <div className="ui-field">
    <label htmlFor={id}>{label}</label>

    <select
      id={id}
      className="ui-select"
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

/** The card tones named seven colours; the system names what they mean. */
const METRIC_TONE = {
  dark: '',
  red: 'dang',
  green: 'ok',
  blue: 'info',
  purple: 'info',
  yellow: 'warn',
  orange: 'warn',
};

const MetricCard = ({ title, value, sub, tone = 'dark' }) => {
  const mapped = METRIC_TONE[tone] ?? '';
  return (
    <div className={`ui-metric${mapped ? ` ui-metric--${mapped}` : ''}`}>
      <div className="ui-metric-label">{title}</div>
      <div className="ui-metric-value">{value}</div>
      <div className="ui-metric-foot">{sub}</div>
    </div>
  );
};

const ReportIconButton = ({ active, title, onClick, disabled, children }) => (
  <button
    type="button"
    className="ui-btn ui-btn--default ui-btn--sm ui-btn--icon"
    aria-pressed={active === undefined ? undefined : Boolean(active)}
    title={title}
    aria-label={title}
    onClick={onClick}
    disabled={disabled}
  >
    {children}
  </button>
);

const TrendIcon = ({ trend }) => {
  if (trend === 'up') return <TrendingUp size={14} className="ui-trend--up" />;
  if (trend === 'down') return <TrendingDown size={14} className="ui-trend--down" />;
  return <Minus size={14} className="ui-trend--flat" />;
};

/** A health score reads as good, watch, or bad — not as three hex values. */
function scoreTone(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return 'neutral';
  if (n >= 70) return 'ok';
  if (n >= 40) return 'warn';
  return 'dang';
}

const PRIORITY_TONE = { high: 'dang', medium: 'warn', low: 'info' };

function aiReportToHtml(report, meta, locale, t) {
  const km = report.keyMetrics || {};
  const list = (arr, render) => (arr || []).map(render).join('');
  const analysis = meta.llmUsed ? t('ai.analysisLlm') : t('ai.analysisData');
  const generated = new Date(meta.generatedAt || Date.now()).toLocaleString(
    locale === 'ar' ? 'ar-SA' : undefined,
  );
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <title>${escapeHtml(report.title || t('ai.pdfTitle'))}</title>
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
    <h1>${escapeHtml(report.title || t('ai.pdfH1'))}</h1>
    <div class="meta">${escapeHtml(t('ai.pdfMeta', { period: report.period || '', generated, analysis, score: report.healthScore ?? '-' }))}</div>
    <h2>${escapeHtml(t('ai.execSummary'))}</h2>
    <div class="summary">${escapeHtml(report.executiveSummary || '')}</div>
    <div class="km">
      <div><span>${escapeHtml(t('ai.kpi.budget'))}</span><b>${escapeHtml(mktCampReportMoney(locale, km.budgetAllocated))}</b></div>
      <div><span>${escapeHtml(t('ai.kpi.spent'))}</span><b>${escapeHtml(mktCampReportMoney(locale, km.totalSpent))}</b></div>
      <div><span>${escapeHtml(t('ai.kpi.revenue'))}</span><b>${escapeHtml(mktCampReportMoney(locale, km.totalRevenue))}</b></div>
      <div><span>${escapeHtml(t('ai.kpi.roi'))}</span><b>${toNumber(km.roi)}%</b></div>
      <div><span>${escapeHtml(t('ai.kpi.leads'))}</span><b>${toNumber(km.leads)}</b></div>
      <div><span>${escapeHtml(t('ai.kpi.conversions'))}</span><b>${toNumber(km.conversions)}</b></div>
      <div><span>${escapeHtml(t('ai.kpi.cpl'))}</span><b>${escapeHtml(mktCampReportMoney(locale, km.costPerLead))}</b></div>
    </div>
    <h2>${escapeHtml(t('ai.perfAnalysis'))}</h2>
    <table><tbody>${list(report.performanceAnalysis, (a) => `<tr><td style="width:160px"><b>${escapeHtml(a.title)}</b></td><td>${escapeHtml(a.detail)}</td></tr>`)}</tbody></table>
    <h2>${escapeHtml(t('ai.platformInsights'))}</h2>
    <table><tbody>${list(report.platformInsights, (p) => `<tr><td style="width:140px"><b>${escapeHtml(mktCampPlatformLabel(locale, p.platform))}</b></td><td>${escapeHtml(p.detail)}</td></tr>`)}</tbody></table>
    <h2>${escapeHtml(t('ai.predictions'))}</h2>
    <table><thead><tr><th>${escapeHtml(t('ai.pred.metric'))}</th><th>${escapeHtml(t('ai.pred.current'))}</th><th>${escapeHtml(t('ai.pred.projected'))}</th><th>${escapeHtml(t('ai.pred.trend'))}</th><th>${escapeHtml(t('ai.pred.rationale'))}</th></tr></thead>
    <tbody>${list(report.predictions, (p) => `<tr><td><b>${escapeHtml(p.metric)}</b></td><td>${escapeHtml(String(p.current))}</td><td>${escapeHtml(String(p.projectedNextPeriod))}</td><td>${escapeHtml(p.trend)}</td><td>${escapeHtml(p.rationale)}</td></tr>`)}</tbody></table>
    <h2>${escapeHtml(t('ai.recommendations'))}</h2>
    <table><thead><tr><th>${escapeHtml(t('ai.rec.priority'))}</th><th>${escapeHtml(t('ai.rec.action'))}</th><th>${escapeHtml(t('ai.rec.impact'))}</th></tr></thead>
    <tbody>${list(report.recommendations, (r) => `<tr><td><span class="pill ${r.priority === 'high' ? 'hi' : r.priority === 'medium' ? 'med' : 'low'}">${escapeHtml(r.priority)}</span></td><td><b>${escapeHtml(r.title)}</b><br/>${escapeHtml(r.action)}</td><td>${escapeHtml(r.expectedImpact || '')}</td></tr>`)}</tbody></table>
    ${(report.risks || []).length ? `<h2>${escapeHtml(t('ai.risks'))}</h2><table><thead><tr><th>${escapeHtml(t('ai.risk.severity'))}</th><th>${escapeHtml(t('ai.risk.risk'))}</th></tr></thead><tbody>${list(report.risks, (r) => `<tr><td><span class="pill ${r.severity === 'high' ? 'hi' : 'med'}">${escapeHtml(r.severity)}</span></td><td><b>${escapeHtml(r.title)}</b><br/>${escapeHtml(r.message)}</td></tr>`)}</tbody></table>` : ''}
    <script>window.onload=function(){window.print();};</script>
  </body></html>`;
  const win = window.open('', '_blank');
  if (!win) {
    alert(t('pdf.popupBlocked'));
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

const AiReportModal = ({ data, loading, error, onClose, onRetry }) => {
  const locale = useMarketingLocale();
  const t = useCallback((key, vars) => mktCampReportT(locale, key, vars), [locale]);
  const report = data?.report;
  const km = report?.keyMetrics || {};
  const analysisLabel = data?.llmUsed ? t('ai.analysisLlm') : t('ai.analysisData');

  const subtitle = loading
    ? t('ai.analyzing')
    : data
      ? t('ai.subtitleMeta', {
          period: report?.period || '',
          analysis: analysisLabel,
        })
      : t('ai.subtitleDefault');

  return (
    <Modal
      title={t('ai.modalTitle')}
      onClose={onClose}
      width="min(900px, 96vw)"
      contentClassName="ui-tokens"
      footer={report ? (
        <>
          <button type="button" className="ui-btn ui-btn--default" onClick={onClose}>
            {t('ai.close')}
          </button>
          <button
            type="button"
            className="ui-btn ui-btn--primary"
            onClick={() =>
              aiReportToHtml(
                report,
                {
                  generatedAt: data.generatedAt,
                  llmUsed: data.llmUsed,
                },
                locale,
                t,
              )
            }
          >
            <FileText size={14} /> {t('ai.pdfBtn')}
          </button>
        </>
      ) : null}
    >
      <div className="ui-stack">
        <p className="ui-help">
          <Sparkles size={13} /> {subtitle}
        </p>

        {loading ? (
          <div className="ui-stack-sm" aria-busy="true">
            <p className="ui-help">{t('ai.loadingBody')}</p>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={`sk-${i}`} className="ui-sk-row">
                <div className="ui-sk ui-sk--text ui-sk--w90" />
              </div>
            ))}
          </div>
          ) : error ? (
            <div className="ui-stack-sm">
              <div className="ui-banner ui-banner--dang">
                <AlertTriangle size={14} />
                <span>{error}</span>
              </div>
              <div>
                <button type="button" className="ui-btn ui-btn--default" onClick={onRetry}>
                  {t('ai.retry')}
                </button>
              </div>
            </div>
          ) : report ? (
            <>
              {data?.note ? (
                <div className="ui-banner ui-banner--info">
                  <Sparkles size={14} />
                  <span>{data.note}</span>
                </div>
              ) : null}

              <div className="ui-row">
                <div className={`ui-metric ui-metric--${scoreTone(report.healthScore)}`}>
                  <div className="ui-metric-label">{t('ai.healthScore')}</div>
                  <div className="ui-metric-value">{report.healthScore ?? '-'}</div>
                </div>
                <div className="ui-field--grow">
                  <div className="ui-label">{t('ai.execSummary')}</div>
                  <p className="ui-help">{report.executiveSummary}</p>
                </div>
              </div>

              <div className="ui-kpis">
                {[
                  [t('ai.kpi.budget'), mktCampReportMoney(locale, km.budgetAllocated)],
                  [t('ai.kpi.spent'), mktCampReportMoney(locale, km.totalSpent)],
                  [t('ai.kpi.revenue'), mktCampReportMoney(locale, km.totalRevenue)],
                  [t('ai.kpi.roi'), `${toNumber(km.roi)}%`],
                  [t('ai.kpi.leads'), toNumber(km.leads).toLocaleString()],
                  [t('ai.kpi.conversions'), toNumber(km.conversions).toLocaleString()],
                  [t('ai.kpiShort.cpl'), mktCampReportMoney(locale, km.costPerLead)],
                  [t('ai.kpi.convRate'), `${toNumber(km.conversionRate)}%`],
                ].map(([label, value]) => (
                  <div key={label} className="ui-metric">
                    <div className="ui-metric-label">{label}</div>
                    <div className="ui-metric-value">{value}</div>
                  </div>
                ))}
              </div>

              {report.performanceAnalysis?.length ? (
                <section className="ui-subgroup">
                  <h3>
                    <Target size={15} /> {t('ai.perfAnalysis')}
                  </h3>
                  <div className="ui-stack-sm">
                    {report.performanceAnalysis.map((a, i) => (
                      <div key={i} className="ui-fieldro">
                        <b>{a.title}</b>
                        <span>{a.detail}</span>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {report.platformInsights?.length ? (
                <section className="ui-subgroup">
                  <h3>{t('ai.platformInsights')}</h3>
                  <div className="ui-stack-sm">
                    {report.platformInsights.map((p, i) => (
                      <div key={i} className="ui-fieldro">
                        <b>{mktCampPlatformLabel(locale, p.platform)}</b>
                        <span>{p.detail}</span>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {(report.topPerformers?.length ||
                report.underperformers?.length) ? (
                <div className="ui-panels">
                  {report.topPerformers?.length ? (
                    <section className="ui-subgroup">
                      <h3 className="ui-subgroup-title ui-money ui-money--in">{t('ai.topPerformers')}</h3>
                      {report.topPerformers.map((item, i) => (
                        <div key={i} className="ui-fieldro">
                          <b>{item.name}</b>
                          <span>{item.reason}</span>
                        </div>
                      ))}
                    </section>
                  ) : null}
                  {report.underperformers?.length ? (
                    <section className="ui-subgroup">
                      <h3 className="ui-subgroup-title ui-money ui-money--out">{t('ai.underperformers')}</h3>
                      {report.underperformers.map((item, i) => (
                        <div key={i} className="ui-fieldro">
                          <b>{item.name}</b>
                          <span>{item.reason}</span>
                        </div>
                      ))}
                    </section>
                  ) : null}
                </div>
              ) : null}

              {report.predictions?.length ? (
                <section className="ui-subgroup">
                  <h3>
                    <TrendingUp size={15} /> {t('ai.predictionsNext')}
                  </h3>
                  <div className="ui-kpis">
                    {report.predictions.map((p, i) => (
                      <div key={i} className="ui-metric">
                        <div className="ui-metric-label">
                          <span>{p.metric}</span>
                          <TrendIcon trend={p.trend} />
                        </div>
                        <div className="ui-metric-value">
                          <span>{toNumber(p.current).toLocaleString()}</span>
                          <span className="ui-help">→</span>
                          <b>{toNumber(p.projectedNextPeriod).toLocaleString()}</b>
                        </div>
                        <p>{p.rationale}</p>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {report.recommendations?.length ? (
                <section className="ui-subgroup">
                  <h3>
                    <Lightbulb size={15} /> {t('ai.recommendations')}
                  </h3>
                  {report.recommendations.map((r, i) => (
                    <div key={i} className="ui-list-row">
                      <span className={`ui-pill ui-pill--${PRIORITY_TONE[r.priority] || 'info'}`}>
                        {r.priority}
                      </span>
                      <div>
                        <b>{r.title}</b>
                        <p>{r.action}</p>
                        {r.expectedImpact ? (
                          <em>{t('ai.impact', { value: r.expectedImpact })}</em>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </section>
              ) : null}

              {report.risks?.length ? (
                <section className="ui-subgroup">
                  <h3 className="ui-subgroup-title ui-money ui-money--out">
                    <AlertTriangle size={15} /> {t('ai.risks')}
                  </h3>
                  {report.risks.map((r, i) => (
                    <div key={i} className="ui-list-row">
                      <span className={`ui-pill ui-pill--${r.severity === 'high' ? 'dang' : 'warn'}`}>
                        {r.severity}
                      </span>
                      <div className="ui-list-main">
                        <span className="ui-list-title">{r.title}</span>
                        <span className="ui-list-meta">{r.message}</span>
                      </div>
                    </div>
                  ))}
                </section>
              ) : null}
            </>
          ) : null}
      </div>
    </Modal>
  );
};

const PerformanceChart = ({ campaigns }) => {
  const locale = useMarketingLocale();
  const t = useCallback((key, vars) => mktCampReportT(locale, key, vars), [locale]);

  // Twelve bars is what the plot can carry before the names collide.
  const rows = useMemo(
    () =>
      campaigns.slice(0, 12).map((item) => ({
        name: item.name.length > 16 ? `${item.name.slice(0, 16)}\u2026` : item.name,
        spent: toNumber(item.spent),
        revenue: toNumber(item.revenue),
      })),
    [campaigns],
  );

  if (rows.length === 0) {
    return (
      <div className="ui-empty">
        <div className="ui-empty-icon"><BarChart3 size={18} /></div>
        <div className="ui-empty-title">{t('chart.empty')}</div>
      </div>
    );
  }

  return (
    <div className="ui-panel-pad">
      <div className="ui-chart">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
            <YAxis
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => compactNumber(locale, v)}
            />
            <Tooltip formatter={(v) => mktCampReportMoney(locale, v)} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="spent" name={t('chart.spent')} fill={CHART.spent} radius={[4, 4, 0, 0]} />
            <Bar dataKey="revenue" name={t('chart.revenue')} fill={CHART.revenue} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const PerformanceTable = ({ campaigns }) => {
  const locale = useMarketingLocale();
  const t = useCallback((key, vars) => mktCampReportT(locale, key, vars), [locale]);
  const { pagedRows, pagerProps } = usePagedRows(campaigns, {
    resetKey: String(campaigns.length),
  });

  return (
    <div className="ui-table-wrap ui-table-wrap--scroll ui-table-wrap--bare">
      <table className="ui-table">
        <thead>
          <tr>
            <th>{t('table.th.campaign')}</th>
            <th>{t('table.th.platform')}</th>
            <th>{t('table.th.spent')}</th>
            <th>{t('table.th.revenue')}</th>
            <th>{t('table.th.roi')}</th>
            <th>{t('table.th.leads')}</th>
            <th>{t('table.th.conv')}</th>
            <th>{t('table.th.ctr')}</th>
          </tr>
        </thead>

        <tbody>
          {pagedRows.length === 0 ? (
            <tr>
              <td colSpan={8}>
                <div className="ui-empty">
                  <div className="ui-empty-icon"><BarChart3 size={18} /></div>
                  <div className="ui-empty-title">{t('table.empty')}</div>
                </div>
              </td>
            </tr>
          ) : (
            pagedRows.map((item) => (
              <tr key={item.id || item.name}>
                <td data-label={t('table.th.campaign')} className="ui-strong">{item.name}</td>
                <td data-label={t('table.th.platform')}>
                  {mktCampPlatformLabel(locale, item.platform)}
                </td>
                <td data-label={t('table.th.spent')} className="ui-num ui-money ui-money--out">
                  {mktCampReportMoney(locale, item.spent)}
                </td>
                <td data-label={t('table.th.revenue')} className="ui-num ui-money ui-money--in">
                  {mktCampReportMoney(locale, item.revenue)}
                </td>
                <td data-label={t('table.th.roi')} className="ui-num ui-strong">
                  {mktCampReportPercent(locale, item.roiPercent)}
                </td>
                <td data-label={t('table.th.leads')} className="ui-num">{item.leads}</td>
                <td data-label={t('table.th.conv')} className="ui-num">{item.conversions}</td>
                <td data-label={t('table.th.ctr')} className="ui-num">
                  {mktCampReportPercent(locale, item.ctr)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <UiPager {...pagerProps} />
    </div>
  );
};

export const CampaignReports = () => {
  const locale = useMarketingLocale();
  const t = useCallback((key, vars) => mktCampReportT(locale, key, vars), [locale]);
  const defaultCampaignName = t('campaign.default');

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
  const [notice, setNotice] = useState('');

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

      const normalizedCampaigns = extractCampaigns(res, defaultCampaignName);
      const normalizedSummary = normalizeSummary(res, normalizedCampaigns);

      setCampaigns(normalizedCampaigns);
      setSummary(normalizedSummary);

      if (campaignFilter === 'all') {
        setAllCampaigns(normalizedCampaigns);
      }
    } catch (err) {
      setCampaigns([]);
      setSummary(EMPTY_SUMMARY);
      setLoadError(err?.message || t('err.load'));
    } finally {
      setLoading(false);
    }
  }, [campaignFilter, period, compareTo, customStart, customEnd, defaultCampaignName, t]);

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
      { value: 'all', label: t('config.allCampaigns') },
      ...source.map((item) => ({
        value: String(item.id),
        label: item.name,
      })),
    ];
  }, [allCampaigns, campaigns, t]);

  const campaignsInScope = campaigns.length;

  const periodLabel = useMemo(() => {
    const map = {
      all_time: t('config.period.all_time'),
      today: t('config.period.today'),
      this_week: t('config.period.this_week'),
      this_month: t('config.period.this_month'),
      last_month: t('config.period.last_month'),
    };
    return map[period] || humanize(period);
  }, [period, t]);

  const exportCsv = () => {
    if (campaigns.length === 0) {
      setLoadError(t('err.exportEmpty'));
      return;
    }

    downloadCsv(campaigns, locale, t);
  };

  const exportPdf = () => {
    if (campaigns.length === 0) {
      setLoadError(t('err.exportEmpty'));
      return;
    }

    downloadPdf(campaigns, summary, periodLabel, locale, t);
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
        throw new Error(t('err.aiEmpty'));
      }

      setAiReport(res);
    } catch (err) {
      setAiError(err?.message || t('err.aiFail'));
    } finally {
      setAiLoading(false);
    }
  };

  // NOTE: this has never persisted anything — there is no schedule endpoint,
  // and `scheduleOn` is local state that resets on reload. Kept exactly as it
  // behaved, with the confirmation moved out of a dialog and into the page.
  const saveSchedule = () => {
    setNotice(scheduleOn ? t('schedule.savedOn') : t('schedule.savedOff'));
  };

  return (
    <div className="ui-root ui-root--flush ui-stack">
      <section className="ui-panel">
        <div className="ui-panel-head">
          <span className="ui-panel-title">{t('config.title')}</span>
          <span className="ui-panel-end ui-pill ui-pill--neutral">
            {t('config.scope', { count: campaignsInScope })}
          </span>
        </div>

        <div className="ui-panel-pad ui-row ui-row--fields">
          <SelectField
            id="cr-campaign"
            label={t('config.campaign')}
            value={campaignFilter}
            onChange={setCampaignFilter}
            options={campaignOptions}
          />

          <SelectField
            id="cr-period"
            label={t('config.period')}
            value={period}
            onChange={setPeriod}
            options={[
              { value: 'all_time', label: t('config.period.all_time') },
              { value: 'today', label: t('config.period.today') },
              { value: 'this_week', label: t('config.period.this_week') },
              { value: 'this_month', label: t('config.period.this_month') },
              { value: 'last_month', label: t('config.period.last_month') },
              { value: 'custom', label: t('config.period.custom') },
            ]}
          />

          {period === 'custom' ? (
            <>
              <div className="ui-field">
                <label htmlFor="cr-from">{t('config.from')}</label>
                <input
                  id="cr-from"
                  type="date"
                  className="ui-input"
                  value={customStart}
                  max={customEnd || undefined}
                  onChange={(e) => setCustomStart(e.target.value)}
                />
              </div>

              <div className="ui-field">
                <label htmlFor="cr-to">{t('config.to')}</label>
                <input
                  id="cr-to"
                  type="date"
                  className="ui-input"
                  value={customEnd}
                  min={customStart || undefined}
                  onChange={(e) => setCustomEnd(e.target.value)}
                />
              </div>
            </>
          ) : null}

          <SelectField
            id="cr-compare"
            label={t('config.compareTo')}
            value={compareTo}
            onChange={setCompareTo}
            options={[
              { value: 'none', label: t('config.compare.none') },
              { value: 'previous_period', label: t('config.compare.previous_period') },
              { value: 'last_month', label: t('config.compare.last_month') },
            ]}
          />

          <div className="ui-toolbar-end">
            <button
              type="button"
              className="ui-btn ui-btn--primary"
              onClick={runAiReport}
              disabled={aiLoading}
            >
              {aiLoading ? <Loader2 size={14} className="ui-spin" /> : <Bot size={14} />}
              {aiLoading ? t('config.aiGenerating') : t('config.aiReport')}
            </button>
          </div>
        </div>
      </section>

      {loadError ? (
        <div className="ui-banner ui-banner--dang" role="alert">
          <AlertTriangle size={14} />
          <span>{loadError}</span>
        </div>
      ) : null}

      {notice ? (
        <div className="ui-banner ui-banner--info" role="status">
          <CalendarDays size={14} />
          <span>{notice}</span>
        </div>
      ) : null}

      <div className="ui-kpis">
        <MetricCard
          title={t('metric.budgetAllocated')}
          value={mktCampReportMoney(locale, summary.totalBudget)}
          sub={t('metric.utilized', {
            pct: mktCampReportPercent(
              locale,
              calcPercent(summary.totalSpent, summary.totalBudget),
            ),
          })}
          tone="dark"
        />

        <MetricCard
          title={t('metric.totalSpent')}
          value={mktCampReportMoney(locale, summary.totalSpent)}
          sub={t('metric.marketingSpend')}
          tone="red"
        />

        <MetricCard
          title={t('metric.revenue')}
          value={mktCampReportMoney(locale, summary.totalRevenue)}
          sub={t('metric.roiSub', {
            pct: mktCampReportPercent(locale, summary.roiPercent),
          })}
          tone="green"
        />

        <MetricCard
          title={t('metric.leads')}
          value={summary.totalLeads || 0}
          sub={t('metric.conversionsSub', { count: summary.totalConversions || 0 })}
          tone="blue"
        />

        <MetricCard
          title={t('metric.impressions')}
          value={summary.totalImpressions || 0}
          sub={t('metric.ctrSub', {
            pct: mktCampReportPercent(locale, summary.ctr),
          })}
          tone="purple"
        />

        <MetricCard
          title={t('metric.clicks')}
          value={summary.totalClicks || 0}
          sub={t('metric.totalClicks')}
          tone="yellow"
        />

        <MetricCard
          title={t('metric.costPerLead')}
          value={mktCampReportMoney(locale, summary.costPerLead)}
          sub={t('metric.acquisitionCost')}
          tone="orange"
        />

        <MetricCard
          title={t('metric.convRate')}
          value={mktCampReportPercent(locale, summary.conversionRate)}
          sub={t('metric.activeCampaigns', { count: summary.activeCampaigns || 0 })}
          tone="green"
        />
      </div>

      <section className="ui-panel">
        <div className="ui-panel-head">
          <span className="ui-panel-title">{t('viz.title')}</span>

          <div className="ui-panel-end ui-rowacts">
            <ReportIconButton
              active={false}
              title={t('viz.csv')}
              onClick={exportCsv}
              disabled={campaigns.length === 0}
            >
              <Download size={13} />
            </ReportIconButton>

            <ReportIconButton
              active={false}
              title={t('viz.pdf')}
              onClick={exportPdf}
              disabled={campaigns.length === 0}
            >
              <FileText size={13} />
            </ReportIconButton>

            <ReportIconButton
              title={t('viz.refresh')}
              onClick={loadReports}
              disabled={loading}
            >
              <RefreshCw size={13} className={loading ? 'ui-spin' : ''} />
            </ReportIconButton>

            <ReportIconButton
              active={viewMode === 'chart'}
              title={t('viz.chart')}
              onClick={() => setViewMode('chart')}
            >
              <TrendingUp size={13} />
            </ReportIconButton>

            <ReportIconButton
              active={viewMode === 'table'}
              title={t('viz.table')}
              onClick={() => setViewMode('table')}
            >
              <Table2 size={13} />
            </ReportIconButton>
          </div>
        </div>

        {loading ? (
          <div className="ui-panel-pad">
            <div className="ui-sk ui-chart" aria-busy="true" />
          </div>
        ) : viewMode === 'chart' ? (
          <PerformanceChart campaigns={campaigns} />
        ) : (
          <PerformanceTable campaigns={campaigns} />
        )}
      </section>

      <section className="ui-panel">
        <div className="ui-panel-head">
          <CalendarDays size={14} />
          <span className="ui-panel-title">{t('schedule.title')}</span>
          <span className={`ui-panel-end ui-pill ui-pill--${scheduleOn ? 'ok' : 'neutral'}`}>
            {scheduleOn ? t('schedule.on') : t('schedule.off')}
          </span>
        </div>

        <div className="ui-panel-pad ui-row">
          <label className="ui-switch">
            <input
              type="checkbox"
              checked={scheduleOn}
              onChange={() => setScheduleOn((prev) => !prev)}
            />
            <span className="ui-switch-track" />
            <span className="ui-switch-text">{t('schedule.auto')}</span>
          </label>

          <div className="ui-toolbar-end">
            <button type="button" className="ui-btn ui-btn--default" onClick={saveSchedule}>
              {t('schedule.save')}
            </button>
          </div>
        </div>
      </section>


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