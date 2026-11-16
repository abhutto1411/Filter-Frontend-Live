import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  AlertTriangle,
  Eye,
  Megaphone,
  MousePointerClick,
  Receipt,
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
import UiPager from '../../components/UiPager';
import { loadPromotionDropdownData } from './marketingPromotionShared';
import { usePagedRows } from '../../hooks/usePagedRows';
import {
  marketingGetDashboard,
  marketingGetDashboardAnalytics,
} from '../../services/superAdminMarketingApi';
import {
  formatMarketingMonthLabel,
  marketingT,
} from '../../utils/marketingI18n';
import '../../styles/ui.css';

const DEFAULT_CURRENCY = 'SAR';

/**
 * Recharts takes literal colour strings, not CSS variables, so the series
 * colours are ui.css token values written out: info, ok, dang, and the
 * neutral used for gridlines.
 */
const CHART = {
  info: '#175cd3',
  ok: '#067647',
  dang: '#b42318',
  warn: '#b54708',
  grid: '#e4e7ec',
};

/**
 * A categorical ramp for the platform pie, where the colours carry no meaning
 * beyond "not the slice next to it". Kept distinct and ordered, so the same
 * platform gets the same colour every time the chart is drawn.
 */
const PLATFORM_COLORS = [
  '#175cd3',
  '#067647',
  '#6941c6',
  '#b54708',
  '#b42318',
  '#0e7090',
  '#c11574',
  '#107569',
  '#3538cd',
  '#4f7a21',
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

/**
 * One figure. The icon bleeds off the corner as a watermark rather than
 * sitting in a tinted disc, so eight of these still read as a single row.
 */
const KpiCard = (props) => {
  const { title, value, foot, tone } = props;
  // Assigned rather than destructured as `icon: Icon`: this eslint config has
  // no React plugin, so JSX use is not a reference and a destructured arg is
  // reported unused. `varsIgnorePattern: '^[A-Z_]'` covers a variable.
  const Icon = props.icon;
  return (
    <div className={`ui-metric${tone ? ` ui-metric--${tone}` : ''}`}>
      <Icon className="ui-metric-icon" size={58} strokeWidth={1.5} aria-hidden />
      <div className="ui-metric-label">{title}</div>
      <div className="ui-metric-value">{value}</div>
      {foot ? <div className="ui-metric-foot">{foot}</div> : null}
    </div>
  );
};

/** Panel chrome for a chart, with room for the line that explains it. */
const ChartCard = ({ title, subtitle, children }) => (
  <section className="ui-panel">
    <div className="ui-panel-head">
      <div>
        <div className="ui-panel-title">{title}</div>
        {subtitle ? <div className="ui-help">{subtitle}</div> : null}
      </div>
    </div>
    <div className="ui-panel-pad">{children}</div>
  </section>
);

/**
 * The shape the screen is about to fill: ten figures and the first pair of
 * panels. The shared marketing skeleton drew four tiles and two cards, which
 * is not what this page settles into.
 */
const DashboardSkeleton = () => (
  <div className="ui-stack" aria-busy="true" role="status" aria-live="polite">
    <div className="ui-kpis">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={`sk-kpi-${i}`} className="ui-metric ui-stack-sm">
          <div className="ui-sk ui-sk--label ui-sk--w55" />
          <div className="ui-sk ui-sk--title ui-sk--w90" />
        </div>
      ))}
    </div>
    <div className="ui-panels">
      {Array.from({ length: 2 }).map((_, i) => (
        <section key={`sk-panel-${i}`} className="ui-panel">
          <div className="ui-panel-head">
            <div className="ui-sk ui-sk--strong ui-sk--w40" />
          </div>
          <div className="ui-panel-pad">
            <div className="ui-sk ui-chart" />
          </div>
        </section>
      ))}
    </div>
  </div>
);

/** A chart that fills the standard box, or the reason there is nothing to draw. */
const ChartBody = ({ empty, emptyText, children }) =>
  empty ? (
    <div className="ui-empty">
      <div className="ui-empty-title">{emptyText}</div>
    </div>
  ) : (
    <div className="ui-chart">
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
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

  const setMarketingWorkshopId = ctx.setMarketingWorkshopId;
  const ctxWorkshops = ctx.workshops;
  // Under the admin shell the workshop is chosen in that shell's header.
  const workshopScopeInHeader = Boolean(ctx.workshopScopeInHeader);

  const [dash, setDash] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [workshops, setWorkshops] = useState([]);
  const [branches, setBranches] = useState([]);
  const [scopeError, setScopeError] = useState('');
  const [branchId, setBranchId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // The locale is only read for the fallback wording of a failed request.
  // Holding it in a ref keeps it out of the loader's dependencies, so
  // switching language does not throw the whole dashboard back to skeletons.
  const localeRef = useRef(locale);
  useEffect(() => { localeRef.current = locale; }, [locale]);

  // The layout's workshop list is only a fallback, and it arrives a moment
  // after this mounts. Reading it through a ref keeps that arrival from
  // re-running the options call.
  const ctxWorkshopsRef = useRef(ctxWorkshops);
  useEffect(() => { ctxWorkshopsRef.current = ctxWorkshops; }, [ctxWorkshops]);

  // Workshops and their branches, in one call: every branch carries the
  // workshop it belongs to, which is what lets the second list narrow.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await loadPromotionDropdownData();
        if (!active) return;
        setWorkshops(asArray(data?.workshops));
        setBranches(asArray(data?.branches));
        setScopeError('');
      } catch (e) {
        if (!active) return;
        // The layout already holds a workshop list, so the first choice still
        // works even when the options call is the thing that failed.
        setWorkshops(asArray(ctxWorkshopsRef.current).map((w) => ({
          id: String(w?.id ?? w?._id ?? w?.workshopId ?? ''),
          label: w?.name || w?.workshopName || '',
        })).filter((w) => w.id));
        setBranches([]);
        setScopeError(e?.message || marketingT(localeRef.current, 'branch.errOptions'));
      }
    })();
    return () => { active = false; };
  }, []);

  // Only the selected workshop's branches. A branch the server sent without a
  // workshop is kept rather than hidden, so nothing disappears silently.
  const branchOptions = useMemo(() => {
    if (!marketingWorkshopId) return [];
    return branches.filter(
      (b) => !b.workshopId || String(b.workshopId) === String(marketingWorkshopId),
    );
  }, [branches, marketingWorkshopId]);

  // A branch of the previous workshop means nothing under the new one. The
  // reset lives here rather than in the change handler because the workshop
  // can also change from the admin shell's own header, where this page has no
  // handler to hang it on.
  const [seenWorkshopId, setSeenWorkshopId] = useState(marketingWorkshopId);
  if (seenWorkshopId !== marketingWorkshopId) {
    setSeenWorkshopId(marketingWorkshopId);
    if (branchId) setBranchId('');
  }

  const loadDashboard = useCallback(async () => {
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
          ...(branchId ? { branchId } : {}),
          months: 6,
        }),
      ]);

      if (dashRes?.success === false) {
        throw new Error(
          dashRes?.message || marketingT(localeRef.current, 'error.request'),
        );
      }

      setDash(dashRes?.data || dashRes || {});
      setAnalytics(analyticsRes || {});
    } catch (e) {
      setAnalytics(null);
      setError(e?.message || marketingT(localeRef.current, 'error.load'));
    } finally {
      setLoading(false);
    }
  }, [marketingWorkshopId, branchId]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

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

  // The branch table can run long on a multi-branch account, so it pages.
  const branchTable = usePagedRows(branchWise, { resetKey: branchId });

  if (loading) {
    return (
      <div className="ui-root ui-root--flush">
        <DashboardSkeleton />
      </div>
    );
  }

  return (
    <div className="ui-root ui-root--flush ui-stack">
      {error ? (
        <div className="ui-banner ui-banner--dang" role="alert">
          <AlertTriangle size={14} />
          <span>{error}</span>
        </div>
      ) : null}

      {scopeError ? (
        <div className="ui-banner ui-banner--warn" role="status">
          <AlertTriangle size={14} />
          <span>{scopeError}</span>
        </div>
      ) : null}

      {/* Workshop first, then that workshop's branches. */}
      <div className="ui-row ui-row--fields">
        {workshopScopeInHeader ? null : (
          <div className="ui-field ui-field--grow">
            <label htmlFor="mkd-workshop">{t('header.workshopScope')}</label>
            <select
              id="mkd-workshop"
              className="ui-select"
              value={marketingWorkshopId}
              onChange={(e) => setMarketingWorkshopId?.(e.target.value)}
              disabled={!setMarketingWorkshopId}
            >
              <option value="">{t('header.allWorkshops')}</option>
              {workshops.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.label || w.name || t('header.workshopN', { id: w.id })}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="ui-field ui-field--grow">
          <label htmlFor="mkd-branch">{t('branch.label')}</label>
          <select
            id="mkd-branch"
            className="ui-select"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            disabled={!marketingWorkshopId}
          >
            <option value="">
              {marketingWorkshopId ? t('branch.all') : t('branch.pickWorkshop')}
            </option>
            {branchOptions.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label || b.name || t('branch.n', { id: b.id })}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="ui-kpis">
        <KpiCard
          title={t('kpi.walletBalance')}
          value={formatSar(overview.walletBalance, currency, locale)}
          icon={Wallet}
          tone="brand"
        />
        <KpiCard
          title={t('kpi.activeCampaigns')}
          value={formatPlainNumber(overview.activeCampaigns, locale)}
          icon={Megaphone}
          tone="info"
        />
        <KpiCard
          title={t('kpi.revenueGenerated')}
          value={formatSar(overview.revenue, currency, locale)}
          icon={TrendingUp}
          tone="ok"
        />
        <KpiCard
          title={t('kpi.totalLeads')}
          value={formatPlainNumber(overview.leads, locale)}
          icon={Target}
          tone="info"
        />
        <KpiCard
          title={t('kpi.impressions')}
          value={formatPlainNumber(overview.impressions, locale)}
          icon={Eye}
          tone="info"
        />
        <KpiCard
          title={t('kpi.uniqueCustomers')}
          value={formatPlainNumber(overview.uniqueCustomers, locale)}
          icon={Users}
          tone="info"
        />
        <KpiCard
          title={t('kpi.conversions')}
          value={formatPlainNumber(overview.conversions, locale)}
          icon={MousePointerClick}
          tone="ok"
        />
        <KpiCard
          title={t('kpi.overallRoi')}
          value={`${formatPlainNumber(overview.roiPercent, locale)}%`}
          icon={Zap}
          tone="warn"
        />
        {/* Spend and the pending queue were a separate band below the grid.
            They are figures like the rest, so they sit in the same row. */}
        <KpiCard
          title={t('roi.totalSpend')}
          value={formatSar(overview.totalSpend, currency, locale)}
          foot={t('roi.sub', {
            roas: toNumber(overview.roas).toFixed(2),
            rate: toNumber(overview.conversionRate).toFixed(1),
          })}
          icon={Receipt}
          tone="dang"
        />
        <KpiCard
          title={t('roi.pendingRequests')}
          value={formatPlainNumber(cards.pendingRequests, locale)}
          icon={Megaphone}
          tone="warn"
        />
      </div>

      <div className="ui-panels">
        <ChartCard title={t('chart.conversionTrends')} subtitle={t('chart.conversionTrendsSub')}>
          <ChartBody empty={trends.length === 0} emptyText={t('empty.noData')}>
            <AreaChart data={trends} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area
                type="monotone"
                dataKey="leads"
                name={t('series.leads')}
                stroke={CHART.info}
                fill={`${CHART.info}22`}
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="conversions"
                name={t('series.conversions')}
                stroke={CHART.ok}
                fill={`${CHART.ok}22`}
                strokeWidth={2}
              />
            </AreaChart>
          </ChartBody>
        </ChartCard>

        <ChartCard title={t('chart.revenueTrend')} subtitle={t('chart.revenueTrendSub')}>
          <ChartBody empty={trends.length === 0} emptyText={t('empty.noData')}>
            <AreaChart data={trends} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => formatSar(v, currency, locale)} />
              <Area
                type="monotone"
                dataKey="revenue"
                name={t('series.revenue')}
                stroke={CHART.ok}
                fill={`${CHART.ok}22`}
                strokeWidth={2}
              />
            </AreaChart>
          </ChartBody>
        </ChartCard>
      </div>

      <div className="ui-panels">
        <ChartCard title={t('chart.customerGrowth')} subtitle={t('chart.customerGrowthSub')}>
          <ChartBody empty={trends.length === 0} emptyText={t('empty.noData')}>
            <BarChart data={trends} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="customers" name={t('series.customers')} fill={CHART.info} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartBody>
        </ChartCard>

        <ChartCard title={t('chart.reachByPlatform')} subtitle={t('chart.reachByPlatformSub')}>
          <ChartBody empty={reachByPlatform.length === 0} emptyText={t('empty.platform')}>
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
          </ChartBody>
        </ChartCard>
      </div>

      <section className="ui-panel">
        <div className="ui-panel-head">
          <div>
            <div className="ui-panel-title">{t('chart.branchWise')}</div>
            <div className="ui-help">{t('chart.branchWiseSub')}</div>
          </div>
        </div>

        {branchWise.length === 0 ? (
          <div className="ui-empty">
            <div className="ui-empty-title">{t('empty.branch')}</div>
          </div>
        ) : (
          <>
            <div className="ui-panel-pad">
              <div className="ui-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={branchWise}
                    margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                    <XAxis dataKey="branch" tick={{ fontSize: 10 }} interval={0} angle={-12} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v) => formatSar(v, currency, locale)} />
                    <Bar dataKey="revenue" name={t('series.revenue')} fill={CHART.ok} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="ui-table-wrap ui-table-wrap--scroll ui-table-wrap--bare">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>{t('table.branch')}</th>
                    <th>{t('table.orders')}</th>
                    <th>{t('table.customers')}</th>
                    <th>{t('table.revenue')}</th>
                  </tr>
                </thead>
                <tbody>
                  {branchTable.pagedRows.map((b) => (
                    <tr key={b.branchId}>
                      <td data-label={t('table.branch')}>{b.branch}</td>
                      <td data-label={t('table.orders')} className="ui-num">
                        {formatPlainNumber(b.orders, locale)}
                      </td>
                      <td data-label={t('table.customers')} className="ui-num">
                        {formatPlainNumber(b.customers, locale)}
                      </td>
                      <td data-label={t('table.revenue')} className="ui-num ui-money ui-money--in">
                        {formatSar(b.revenue, currency, locale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <UiPager {...branchTable.pagerProps} />
            </div>
          </>
        )}
      </section>

      <div className="ui-panels">
        <ChartCard title={t('chart.workshopWise')} subtitle={t('chart.workshopWiseSub')}>
          <ChartBody empty={workshopWise.length === 0} emptyText={t('empty.workshop')}>
            <BarChart
              data={workshopWise}
              layout="vertical"
              margin={{ top: 8, right: 12, left: 8, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis
                type="category"
                dataKey="workshop"
                tick={{ fontSize: 10 }}
                width={110}
              />
              <Tooltip formatter={(v) => formatSar(v, currency, locale)} />
              <Bar dataKey="revenue" name={t('series.revenue')} fill={CHART.info} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ChartBody>
        </ChartCard>

        <section className="ui-panel">
          <div className="ui-panel-head">
            <div>
              <div className="ui-panel-title">{t('chart.topCampaigns')}</div>
              <div className="ui-help">{t('chart.topCampaignsSub')}</div>
            </div>
          </div>

          {topCampaigns.length === 0 ? (
            <div className="ui-empty">
              <div className="ui-empty-title">{t('empty.campaigns')}</div>
            </div>
          ) : (
            <ul className="ui-list">
              {topCampaigns.map((campaign, index) => (
                <li className="ui-list-row" key={campaign.id || index}>
                  <div className="ui-list-main">
                    <span className="ui-list-title">
                      {campaign.campaignName || campaign.name}
                    </span>
                    <span className="ui-list-meta">
                      {campaign.platformLabel || campaign.platform} ·{' '}
                      {String(campaign.status || 'active').replaceAll('_', ' ')}
                    </span>
                  </div>

                  <div className="ui-list-end">
                    <div className="ui-list-amount">
                      {formatSar(campaign.revenue, currency, locale)}
                    </div>
                    <span className="ui-list-meta">
                      {t('campaign.roi', { pct: formatPlainNumber(campaign.roiPercent, locale) })}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};

export default MarketingDashboard;
