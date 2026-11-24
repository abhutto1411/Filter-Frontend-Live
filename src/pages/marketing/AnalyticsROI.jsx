import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { AlertTriangle, BarChart3, Receipt, TrendingUp } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { marketingGetAnalyticsRoi } from '../../services/superAdminMarketingApi';
import {
  mktCampT,
  mktCampMoney,
  mktCampPlatformLabel,
} from '../../utils/marketingCampaignsI18n';
import UiPager from '../../components/UiPager';
import { usePagedRows } from '../../hooks/usePagedRows';
import '../../styles/ui.css';

/** Recharts takes literal colours; these are ui.css token values. */
const CHART = { bar: '#175cd3', loss: '#b42318', grid: '#e4e7ec' };

function formatPercent(locale, value) {
  const n = Number(value);
  const raw = Number.isFinite(n) ? Math.round(n) : 0;
  return mktCampT(locale, 'roi.percent', { value: raw });
}

function calcRoi(spent, revenue) {
  const s = Number(spent) || 0;
  const r = Number(revenue) || 0;

  if (s <= 0) return 0;

  return ((r - s) / s) * 100;
}

function normalizeCampaign(row, defaultName) {
  const spent = Number(row.spend ?? row.budgetSpent ?? 0);
  const revenue = Number(row.revenue ?? row.revenueGenerated ?? 0);

  return {
    id: String(row.id || ''),
    name: row.name || row.campaignName || defaultName,
    platform: row.platform || 'meta',
    spent,
    revenue,
    roi: Number(row.roiPercent ?? calcRoi(spent, revenue)),
    leads: Number(row.leads ?? row.leadsCount ?? 0),
    conversions: Number(row.conversions ?? row.conversionsCount ?? 0),
  };
}

function extractCampaigns(payload, defaultName) {
  const rows = Array.isArray(payload?.campaigns)
    ? payload.campaigns
    : Array.isArray(payload?.data?.campaigns)
      ? payload.data.campaigns
      : [];

  return rows.map((row) => normalizeCampaign(row, defaultName));
}

/**
 * ROI by platform.
 *
 * This was a hand-drawn SVG with a fixed 0–4 axis that the value was clamped
 * into — but `roiPercent` is a percentage from the API ((revenue − spend) /
 * spend × 100), so every platform above 4% pinned to the ceiling and a
 * platform returning 5% drew at exactly the same height as one returning
 * 500%. The axis now follows the data, and a loss is drawn in its own colour
 * because a negative ROI below the baseline is the one bar that matters.
 */
const RoiChart = ({ platforms, title, locale, t }) => {
  const data = useMemo(
    () =>
      (Array.isArray(platforms) ? platforms : []).map((item) => ({
        platform: mktCampPlatformLabel(locale, item.platform || 'meta'),
        roi: Number(item.roiPercent) || 0,
      })),
    [platforms, locale],
  );

  return (
    <section className="ui-panel">
      <div className="ui-panel-head">
        <span className="ui-panel-title">{title}</span>
      </div>
      {data.length === 0 ? (
        <div className="ui-empty">
          <div className="ui-empty-icon"><BarChart3 size={18} /></div>
          <div className="ui-empty-title">{t('roi.empty')}</div>
        </div>
      ) : (
        <div className="ui-panel-pad">
          <div className="ui-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                <XAxis dataKey="platform" tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `${Math.round(v)}%`}
                />
                <Tooltip formatter={(v) => formatPercent(locale, v)} />
                <Bar
                  dataKey="roi"
                  name={t('roi.th.roi')}
                  radius={[4, 4, 0, 0]}
                  fill={CHART.bar}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </section>
  );
};

export const AnalyticsROI = () => {
  const outletCtx = useOutletContext() || {};
  const locale =
    outletCtx.locale ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('marketing-locale') : null) ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
    'en';
  const t = useCallback((key, vars) => mktCampT(locale, key, vars), [locale]);

  const [campaigns, setCampaigns] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [summary, setSummary] = useState({
    totalSpend: 0,
    totalRevenue: 0,
    roiPercent: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const res = await marketingGetAnalyticsRoi({
        status: 'all',
      });

      const rows = extractCampaigns(res, t('campaign.default'));
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
      setError(err?.message || t('roi.errLoad'));
      setCampaigns([]);
      setPlatforms([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  const { pagedRows, pagerProps } = usePagedRows(campaigns, {
    resetKey: String(campaigns.length),
  });

  return (
    <div className="ui-root ui-root--flush ui-stack">
      {error ? (
        <div className="ui-banner ui-banner--dang" role="alert">
          <AlertTriangle size={14} />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="ui-kpis">
        <div className="ui-metric ui-metric--dang">
          <Receipt className="ui-metric-icon" size={58} strokeWidth={1.5} aria-hidden />
          <div className="ui-metric-label">{t('roi.totalSpent')}</div>
          <div className="ui-metric-value">
            {loading
              ? <span className="ui-sk ui-sk--title ui-sk--w70" />
              : mktCampMoney(locale, summary.totalSpend)}
          </div>
        </div>

        <div className="ui-metric ui-metric--ok">
          <TrendingUp className="ui-metric-icon" size={58} strokeWidth={1.5} aria-hidden />
          <div className="ui-metric-label">{t('roi.totalRevenue')}</div>
          <div className="ui-metric-value">
            {loading
              ? <span className="ui-sk ui-sk--title ui-sk--w70" />
              : mktCampMoney(locale, summary.totalRevenue)}
          </div>
        </div>

        {/* A negative return is not a green number. */}
        <div className={`ui-metric ui-metric--${summary.roiPercent < 0 ? 'dang' : 'ok'}`}>
          <BarChart3 className="ui-metric-icon" size={58} strokeWidth={1.5} aria-hidden />
          <div className="ui-metric-label">{t('roi.overallRoi')}</div>
          <div className="ui-metric-value">
            {loading
              ? <span className="ui-sk ui-sk--title ui-sk--w70" />
              : formatPercent(locale, summary.roiPercent)}
          </div>
        </div>
      </div>

      <RoiChart
        platforms={platforms}
        title={t('roi.chartTitle')}
        locale={locale}
        t={t}
      />

      <section className="ui-panel">
        <div className="ui-panel-head">
          <span className="ui-panel-title">{t('roi.performance')}</span>
        </div>

        <div className="ui-table-wrap ui-table-wrap--scroll ui-table-wrap--bare">
          <table className="ui-table">
            <thead>
              <tr>
                <th>{t('roi.th.campaign')}</th>
                <th>{t('roi.th.platform')}</th>
                <th>{t('roi.th.spent')}</th>
                <th>{t('roi.th.revenue')}</th>
                <th>{t('roi.th.roi')}</th>
                <th>{t('roi.th.leads')}</th>
                <th>{t('roi.th.conversions')}</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={`sk-${i}`} className="ui-sk-row">
                    <td><div className="ui-sk ui-sk--strong ui-sk--w90" /></td>
                    <td><div className="ui-sk ui-sk--text ui-sk--w55" /></td>
                    <td><div className="ui-sk ui-sk--text ui-sk--w40" /></td>
                    <td><div className="ui-sk ui-sk--text ui-sk--w40" /></td>
                    <td><div className="ui-sk ui-sk--text ui-sk--w25" /></td>
                    <td><div className="ui-sk ui-sk--text ui-sk--w25" /></td>
                    <td><div className="ui-sk ui-sk--text ui-sk--w25" /></td>
                  </tr>
                ))
              ) : pagedRows.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="ui-empty">
                      <div className="ui-empty-icon"><BarChart3 size={18} /></div>
                      <div className="ui-empty-title">{t('roi.empty')}</div>
                    </div>
                  </td>
                </tr>
              ) : (
                pagedRows.map((item) => (
                  <tr key={item.id}>
                    <td data-label={t('roi.th.campaign')} className="ui-strong">
                      {item.name}
                    </td>
                    <td data-label={t('roi.th.platform')}>
                      {mktCampPlatformLabel(locale, item.platform)}
                    </td>
                    {/* Both columns are money, like the cards above; they used
                        to print a bare number with no currency at all. */}
                    <td data-label={t('roi.th.spent')} className="ui-num ui-money ui-money--out">
                      {mktCampMoney(locale, item.spent)}
                    </td>
                    <td data-label={t('roi.th.revenue')} className="ui-num ui-money ui-money--in">
                      {mktCampMoney(locale, item.revenue)}
                    </td>
                    <td
                      data-label={t('roi.th.roi')}
                      className={`ui-num ui-strong${item.roi < 0 ? ' ui-money ui-money--out' : ''}`}
                    >
                      {formatPercent(locale, item.roi)}
                    </td>
                    <td data-label={t('roi.th.leads')} className="ui-num">{item.leads}</td>
                    <td data-label={t('roi.th.conversions')} className="ui-num">
                      {item.conversions}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <UiPager {...pagerProps} />
        </div>
      </section>
    </div>
  );
};

export default AnalyticsROI;
