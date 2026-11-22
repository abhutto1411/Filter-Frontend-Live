import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  AlertTriangle,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { marketingGetCustomerInsights } from '../../services/superAdminMarketingApi';
import UiPager from '../../components/UiPager';
import { usePagedRows } from '../../hooks/usePagedRows';
import { ciT } from '../../utils/customerInsightsI18n';
import '../../styles/ui.css';
import './MarketingUniversal.css';

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatSar(value, locale = 'en') {
  return `SAR ${toNumber(value).toLocaleString(locale === 'ar' ? 'ar-SA' : undefined, {
    maximumFractionDigits: 0,
  })}`;
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

function translateTypeLabel(t, value) {
  const raw = String(value || '').trim();
  if (!raw) return humanize(value);
  const normalized = raw.toLowerCase().replace(/[-\s]+/g, '_');
  const key = `type.${normalized}`;
  const translated = t(key);
  return translated === key ? humanize(value) : translated;
}

function formatMonthLabel(date, locale = 'en') {
  return date.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
    month: 'short',
    year: '2-digit',
  });
}

function makeLastMonths(count = 6, locale = 'en') {
  const now = new Date();

  return Array.from({ length: count }, (_, index) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (count - 1 - index), 1);

    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: formatMonthLabel(d, locale),
      value: 0,
    };
  });
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
  const source = root.summary || root.cards || root || {};

  const totalCustomers = toNumber(
    source.totalCustomers ??
      source.uniqueCustomers ??
      source.totalUniqueCustomers ??
      source.total_unique_customers,
  );

  const newThisMonth = toNumber(
    source.newThisMonth ??
      source.newCustomers ??
      source.new_this_month,
  );

  const returningCustomers = toNumber(
    source.returningCustomers ??
      source.returning_customers,
  );

  const retentionRate = toNumber(
    source.retentionRate ??
      source.customerRetention ??
      source.retention,
  );

  const averageSpend = toNumber(
    source.averageSpend ??
      source.avgSpend ??
      source.averageSpendPerCustomer ??
      source.averageOrderValue,
  );

  const averageOrders = toNumber(
    source.averageOrders ??
      source.avgOrders ??
      source.avgOrdersPerCustomer,
  );

  return {
    totalCustomers,
    newThisMonth,
    returningCustomers,
    retentionRate,
    averageSpend,
    averageOrders,
  };
}

function normalizeCustomer(row, defaultName = 'Customer') {
  return {
    id: String(row?.id ?? row?.customerId ?? row?.customer_id ?? row?.email ?? row?.phone ?? ''),
    name:
      row?.name ||
      row?.customerName ||
      row?.customer_name ||
      row?.fullName ||
      row?.companyName ||
      defaultName,
    email: row?.email || row?.customerEmail || row?.customer_email || '',
    phone: row?.phone || row?.mobile || row?.customerPhone || row?.customer_phone || '',
    totalSpend: toNumber(
      row?.totalSpend ??
        row?.total_spend ??
        row?.totalRevenue ??
        row?.ltv ??
        row?.lifeTimeValue,
    ),
    orders: toNumber(
      row?.orders ??
        row?.visits ??
        row?.orderCount ??
        row?.order_count,
    ),
    segment:
      row?.segment ||
      row?.customerSegment ||
      row?.customer_segment ||
      'customer',
    createdAt:
      row?.createdAt ||
      row?.created_at ||
      row?.joinedAt ||
      row?.lastVisit ||
      row?.updatedAt ||
      '',
  };
}

function extractCustomers(payload, defaultName = 'Customer') {
  const root = payload?.data || payload || {};

  return asArray(root, [
    'customers',
    'topCustomers',
    'topReturningCustomers',
    'items',
  ]).map((row) => normalizeCustomer(row, defaultName));
}

function normalizeGrowthItem(item) {
  return {
    label:
      item?.label ||
      item?.month ||
      item?.name ||
      item?.period ||
      '',
    value: toNumber(
      item?.value ??
        item?.count ??
        item?.customers ??
        item?.newCustomers ??
        item?.new_this_month,
    ),
  };
}

function extractGrowth(payload, locale = 'en') {
  const root = payload?.data || payload || {};

  const rows = asArray(root, [
    'growth',
    'customerGrowth',
    'newCustomerGrowth',
    'monthlyGrowth',
    'newCustomersByMonth',
  ]).map(normalizeGrowthItem);

  const fallback = makeLastMonths(6, locale);

  if (!rows.length) return fallback;

  const monthMap = new Map();

  fallback.forEach((item) => {
    monthMap.set(item.label.toLowerCase(), item);
  });

  rows.forEach((item) => {
    const label = item.label || '';

    if (!label) return;

    const found = fallback.find(
      (month) =>
        month.label.toLowerCase() === label.toLowerCase() ||
        month.key === label,
    );

    if (found) {
      monthMap.set(found.label.toLowerCase(), {
        ...found,
        value: item.value,
      });
    }
  });

  return Array.from(monthMap.values());
}

function extractBreakdown(payload) {
  const root = payload?.data || payload || {};
  const b = root.breakdown || root || {};

  const nvr = b.newVsReturning || root.newVsReturning || {};
  return {
    newCustomers: toNumber(nvr.newCustomers ?? nvr.new_customers),
    returningCustomers: toNumber(
      nvr.returningCustomers ?? nvr.returning_customers,
    ),
    typeDistribution: asArray(b.typeDistribution || root.typeDistribution || []).map(
      (row) => ({
        type: row?.type || 'regular',
        customers: toNumber(row?.customers),
        revenue: toNumber(row?.revenue),
      }),
    ),
    branchDistribution: asArray(
      b.branchDistribution || root.branchDistribution || [],
    ).map((row) => ({
      branch: row?.branch || '—',
      customers: toNumber(row?.customers),
      revenue: toNumber(row?.revenue),
    })),
    ltv: toNumber(b.ltv ?? root.lifetimeValue ?? root.ltv),
  };
}

/**
 * A categorical ramp for the customer-type dots, where the colours carry no
 * meaning beyond "not the one above". Recharts and inline SVG both need a
 * literal colour, so these are ui.css token values written out.
 */
const TYPE_COLORS = ['#175cd3', '#6941c6', '#107569', '#b54708', '#b42318', '#0e7090'];

const CHART = { line: '#175cd3', grid: '#e4e7ec' };

const KPI_TONE = { pink: 'dang', purple: 'info', blue: 'info', teal: 'ok' };

const KpiCard = ({ title, value, sub, tone }) => (
  <div className={`ui-metric${KPI_TONE[tone] ? ` ui-metric--${KPI_TONE[tone]}` : ''}`}>
    <div className="ui-metric-label">{title}</div>
    <div className="ui-metric-value">{value}</div>
    {sub ? <div className="ui-metric-foot">{sub}</div> : null}
  </div>
);

const GrowthChart = ({ data, t }) => (
  <section className="ui-panel">
    <div className="ui-panel-head">
      <span className="ui-panel-title">{t('chart.growthTitle')}</span>
    </div>
    <div className="ui-panel-pad">
      <div className="ui-chart">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="value"
              name={t('chart.growthTitle')}
              stroke={CHART.line}
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  </section>
);

const EmptyCustomers = ({ t }) => (
  <div className="ui-empty">
    <div className="ui-empty-icon"><Users size={18} /></div>
    <div className="ui-empty-title">{t('empty.customers')}</div>
  </div>
);

export const CustomerInsights = () => {
  const ctx = useOutletContext() || {};
  const locale =
    ctx.locale ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('marketing-locale') : null) ||
    'en';
  const t = useCallback((key, vars) => ciT(locale, key, vars), [locale]);

  const [summary, setSummary] = useState({
    totalCustomers: 0,
    newThisMonth: 0,
    returningCustomers: 0,
    retentionRate: 0,
    averageSpend: 0,
    averageOrders: 0,
  });

  const [customers, setCustomers] = useState([]);
  const [growth, setGrowth] = useState(() => makeLastMonths(6, locale));
  const [breakdown, setBreakdown] = useState({
    newCustomers: 0,
    returningCustomers: 0,
    typeDistribution: [],
    branchDistribution: [],
    ltv: 0,
  });
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadInsights = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const res = await marketingGetCustomerInsights({
        limit: 500,
        offset: 0,
        status: 'all',
      });

      setSummary(normalizeSummary(res));
      setCustomers(extractCustomers(res, ciT(locale, 'customer.default')));
      setGrowth(extractGrowth(res, locale));
      setBreakdown(extractBreakdown(res));
    } catch (err) {
      setError(err?.message || ciT(locale, 'error.load'));
      setSummary({
        totalCustomers: 0,
        newThisMonth: 0,
        returningCustomers: 0,
        retentionRate: 0,
        averageSpend: 0,
        averageOrders: 0,
      });
      setCustomers([]);
      setGrowth(makeLastMonths(6, locale));
      setBreakdown({
        newCustomers: 0,
        returningCustomers: 0,
        typeDistribution: [],
        branchDistribution: [],
        ltv: 0,
      });
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();

    let rows = customers.filter((item) => {
      if (!q) return true;

      return [
        item.name,
        item.email,
        item.phone,
        item.segment,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q);
    });

    rows = [...rows].sort((a, b) => {
      if (sortBy === 'oldest') {
        return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      }

      if (sortBy === 'highest_spend') {
        return toNumber(b.totalSpend) - toNumber(a.totalSpend);
      }

      if (sortBy === 'most_orders') {
        return toNumber(b.orders) - toNumber(a.orders);
      }

      if (sortBy === 'name') {
        return String(a.name).localeCompare(String(b.name));
      }

      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

    return rows;
  }, [customers, search, sortBy]);

  const { pagedRows, pagerProps } = usePagedRows(filteredCustomers, {
    resetKey: `${search}|${sortBy}`,
  });

  return (
    <div className="ui-root ui-root--flush ui-stack">
      <div className="ui-kpis">
        <KpiCard
          title={t('kpi.totalCustomers')}
          value={summary.totalCustomers}
          sub={t('kpi.thisMonth', { count: summary.newThisMonth || 0 })}
          tone="pink"
        />

        <KpiCard
          title={t('kpi.returningCustomers')}
          value={summary.returningCustomers}
          sub={t('kpi.retention', { pct: summary.retentionRate || 0 })}
          tone="purple"
        />

        <KpiCard
          title={t('kpi.newThisMonth')}
          value={summary.newThisMonth}
          sub={t('kpi.vsLastMonth')}
          tone="blue"
        />

        <KpiCard
          title={t('kpi.avgSpend')}
          value={formatSar(summary.averageSpend, locale)}
          sub={t('kpi.allTime')}
          tone="teal"
        />
      </div>

      {error ? (
        <div className="ui-banner ui-banner--dang" role="alert">
          <AlertTriangle size={14} />
          <span>{error}</span>
        </div>
      ) : null}

      <GrowthChart data={growth} t={t} />

      <div className="ui-panels">
        <section className="ui-panel">
          <div className="ui-panel-head">
            <span className="ui-panel-title">{t('section.newVsReturning')}</span>
          </div>
          {(() => {
            const total =
              breakdown.newCustomers + breakdown.returningCustomers || 1;
            const newPct = Math.round((breakdown.newCustomers / total) * 100);
            const retPct = 100 - newPct;
            return (
              <div className="ui-panel-pad ui-stack-sm">
                <div className="ui-bar">
                  <div
                    className="ui-bar-fill ui-bar-fill--info"
                    style={{ width: `${newPct}%` }}
                    title={t('nvr.newTitle', { pct: newPct })}
                  />
                </div>

                <div className="ui-meta">
                  <span>
                    {t('nvr.new')} <b>{breakdown.newCustomers}</b> ({newPct}%)
                  </span>
                  <span>
                    {t('nvr.returning')} <b>{breakdown.returningCustomers}</b> ({retPct}%)
                  </span>
                </div>

                <div className="ui-fieldro">
                  <span className="ui-fieldro-label">{t('ltv.perCustomer')}</span>
                  <span className="ui-fieldro-value">
                    {formatSar(breakdown.ltv, locale)}
                  </span>
                </div>
              </div>
            );
          })()}
        </section>

        <section className="ui-panel">
          <div className="ui-panel-head">
            <span className="ui-panel-title">{t('section.walkInVsCorporate')}</span>
          </div>
          {breakdown.typeDistribution.length === 0 ? (
            <div className="ui-empty">
              <div className="ui-empty-title">{t('empty.data')}</div>
            </div>
          ) : (
            <ul className="ui-list">
              {breakdown.typeDistribution.map((row, idx) => (
                <li className="ui-list-row" key={row.type}>
                  <span
                    className="ui-swatch"
                    style={{ background: TYPE_COLORS[idx % TYPE_COLORS.length] }}
                    aria-hidden
                  />
                  <div className="ui-list-main">
                    <span className="ui-list-title">
                      {translateTypeLabel(t, row.type)}
                    </span>
                    <span className="ui-list-meta">
                      {t('meta.custRevenue', {
                        count: row.customers,
                        revenue: formatSar(row.revenue, locale),
                      })}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="ui-panel">
        <div className="ui-panel-head">
          <span className="ui-panel-title">{t('section.branchDistribution')}</span>
        </div>
        {breakdown.branchDistribution.length === 0 ? (
          <div className="ui-empty">
            <div className="ui-empty-title">{t('empty.data')}</div>
          </div>
        ) : (
          (() => {
            const maxRev = Math.max(
              1,
              ...breakdown.branchDistribution.map((r) => r.revenue),
            );
            return (
              <div className="ui-panel-pad ui-stack-sm">
                {breakdown.branchDistribution.map((row) => (
                  <div key={row.branch}>
                    <div className="ui-row">
                      <span className="ui-strong">{row.branch}</span>
                      <span className="ui-toolbar-end ui-help">
                        {t('meta.revenueCust', {
                          revenue: formatSar(row.revenue, locale),
                          count: row.customers,
                        })}
                      </span>
                    </div>
                    <div className="ui-bar">
                      <div
                        className="ui-bar-fill ui-bar-fill--ok"
                        style={{ width: `${(row.revenue / maxRev) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            );
          })()
        )}
      </section>

      <section className="ui-panel">
        <div className="ui-panel-head">
          <span className="ui-panel-title">{t('section.allCustomers')}</span>
        </div>

        <div className="ui-panel-pad ui-row ui-row--fields">
          <div className="ui-field ui-field--grow">
            <label htmlFor="ci-search">{t('search.label')}</label>
            <div className="ui-search">
              <Search size={15} />
              <input
                id="ci-search"
                className="ui-input"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('search.placeholder')}
              />
            </div>
          </div>

          <div className="ui-field">
            <label htmlFor="ci-sort">{t('sort.label')}</label>
            <select
              id="ci-sort"
              className="ui-select"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
            >
              <option value="newest">{t('sort.newest')}</option>
              <option value="oldest">{t('sort.oldest')}</option>
              <option value="highest_spend">{t('sort.highestSpend')}</option>
              <option value="most_orders">{t('sort.mostOrders')}</option>
              <option value="name">{t('sort.name')}</option>
            </select>
          </div>

          <div className="ui-toolbar-end">
            <button
              type="button"
              className="ui-btn ui-btn--default ui-btn--icon"
              onClick={loadInsights}
              disabled={loading}
              title={t('action.refresh')}
              aria-label={t('action.refresh')}
            >
              <RefreshCw size={14} className={loading ? 'ui-spin' : ''} />
            </button>
          </div>
        </div>

        {!loading && filteredCustomers.length === 0 ? (
          <EmptyCustomers t={t} />
        ) : (
          <div className="ui-table-wrap ui-table-wrap--scroll ui-table-wrap--bare">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>{t('table.customer')}</th>
                  <th>{t('table.contact')}</th>
                  <th>{t('table.orders')}</th>
                  <th>{t('table.totalSpend')}</th>
                  <th>{t('table.segment')}</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={`sk-${i}`} className="ui-sk-row">
                      <td><div className="ui-sk ui-sk--strong ui-sk--w90" /></td>
                      <td><div className="ui-sk ui-sk--text ui-sk--w70" /></td>
                      <td><div className="ui-sk ui-sk--text ui-sk--w25" /></td>
                      <td><div className="ui-sk ui-sk--text ui-sk--w40" /></td>
                      <td><div className="ui-sk ui-sk--pill" /></td>
                    </tr>
                  ))
                ) : (
                  pagedRows.map((item) => (
                    <tr key={item.id || `${item.name}-${item.phone}`}>
                      <td data-label={t('table.customer')}>
                        <div className="ui-strong">{item.name}</div>
                        <div className="ui-meta">{item.email || '—'}</div>
                      </td>
                      <td data-label={t('table.contact')}>{item.phone || '—'}</td>
                      <td data-label={t('table.orders')} className="ui-num">
                        {item.orders}
                      </td>
                      <td data-label={t('table.totalSpend')} className="ui-num ui-money ui-money--in">
                        {formatSar(item.totalSpend, locale)}
                      </td>
                      <td data-label={t('table.segment')}>
                        <span className="ui-pill ui-pill--neutral">
                          {translateTypeLabel(t, item.segment)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <UiPager {...pagerProps} />
          </div>
        )}
      </section>

    </div>
  );
};

export default CustomerInsights;