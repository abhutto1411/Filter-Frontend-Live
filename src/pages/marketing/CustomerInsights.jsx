import React, { useEffect, useMemo, useState } from 'react';
import {
  RefreshCw,
  Search,
  Users,
} from 'lucide-react';
import { marketingGetCustomerInsights } from '../../services/superAdminMarketingApi';
import './MarketingUniversal.css';

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatSar(value) {
  return `SAR ${toNumber(value).toLocaleString(undefined, {
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

function formatMonthLabel(date) {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    year: '2-digit',
  });
}

function makeLastMonths(count = 6) {
  const now = new Date();

  return Array.from({ length: count }, (_, index) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (count - 1 - index), 1);

    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: formatMonthLabel(d),
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

function normalizeCustomer(row) {
  return {
    id: String(row?.id ?? row?.customerId ?? row?.customer_id ?? row?.email ?? row?.phone ?? ''),
    name:
      row?.name ||
      row?.customerName ||
      row?.customer_name ||
      row?.fullName ||
      row?.companyName ||
      'Customer',
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

function extractCustomers(payload) {
  const root = payload?.data || payload || {};

  return asArray(root, [
    'customers',
    'topCustomers',
    'topReturningCustomers',
    'items',
  ]).map(normalizeCustomer);
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

function extractGrowth(payload) {
  const root = payload?.data || payload || {};

  const rows = asArray(root, [
    'growth',
    'customerGrowth',
    'newCustomerGrowth',
    'monthlyGrowth',
    'newCustomersByMonth',
  ]).map(normalizeGrowthItem);

  const fallback = makeLastMonths(6);

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

const TYPE_COLORS = ['#3b82f6', '#8b5cf6', '#14b8a6', '#f59e0b', '#ef4444', '#0ea5e9'];

const KpiCard = ({ title, value, sub, tone }) => (
  <section className={`ci-kpi-card ci-kpi-${tone}`}>
    <div className="ci-kpi-top-line" />

    <div className="ci-kpi-content">
      <p>{title}</p>
      <strong>{value}</strong>
      <span>{sub}</span>
    </div>
  </section>
);

const GrowthChart = ({ data }) => {
  const width = 980;
  const height = 160;
  const left = 48;
  const right = 18;
  const top = 18;
  const bottom = 32;
  const chartW = width - left - right;
  const chartH = height - top - bottom;

  const maxValue = Math.max(4, ...data.map((item) => toNumber(item.value)));
  const ticks = [0, 1, 2, 3, 4];

  const points = data.map((item, index) => {
    const slot = data.length > 1 ? chartW / (data.length - 1) : chartW;
    const x = left + slot * index;
    const y = top + chartH - (toNumber(item.value) / maxValue) * chartH;

    return {
      ...item,
      x,
      y,
    };
  });

  return (
    <section className="ci-chart-card">
      <h3>New Customer Growth — Last 6 Months</h3>

      <svg
        className="ci-chart-svg"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
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
                className="ci-grid-line"
              />

              <text
                x={left - 8}
                y={y + 4}
                textAnchor="end"
                className="ci-axis-text"
              >
                {tick}
              </text>
            </g>
          );
        })}

        {points.map((point) => (
          <line
            key={`v-${point.label}`}
            x1={point.x}
            y1={top}
            x2={point.x}
            y2={top + chartH}
            className="ci-vertical-grid"
          />
        ))}

        <line
          x1={left}
          y1={top + chartH}
          x2={width - right}
          y2={top + chartH}
          className="ci-axis-line"
        />

        <line
          x1={left}
          y1={top}
          x2={left}
          y2={top + chartH}
          className="ci-axis-line"
        />

        {points.length > 1 ? (
          <polyline
            points={points.map((point) => `${point.x},${point.y}`).join(' ')}
            className="ci-growth-line"
          />
        ) : null}

        {points.map((point) => (
          <g key={`point-${point.label}`}>
            <circle cx={point.x} cy={point.y} r="3" className="ci-growth-dot" />

            <text
              x={point.x}
              y={height - 10}
              textAnchor="middle"
              className="ci-axis-text"
            >
              {point.label}
            </text>
          </g>
        ))}
      </svg>
    </section>
  );
};

const EmptyCustomers = () => (
  <div className="ci-empty-customers">
    <Users size={34} strokeWidth={1.7} />
    <p>No customers found</p>
  </div>
);

export const CustomerInsights = () => {
  const [summary, setSummary] = useState({
    totalCustomers: 0,
    newThisMonth: 0,
    returningCustomers: 0,
    retentionRate: 0,
    averageSpend: 0,
    averageOrders: 0,
  });

  const [customers, setCustomers] = useState([]);
  const [growth, setGrowth] = useState(makeLastMonths(6));
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

  const loadInsights = async () => {
    try {
      setLoading(true);
      setError('');

      const res = await marketingGetCustomerInsights({
        limit: 500,
        offset: 0,
        status: 'all',
      });

      setSummary(normalizeSummary(res));
      setCustomers(extractCustomers(res));
      setGrowth(extractGrowth(res));
      setBreakdown(extractBreakdown(res));
    } catch (err) {
      setError(err?.message || 'Failed to load customer insights.');
      setSummary({
        totalCustomers: 0,
        newThisMonth: 0,
        returningCustomers: 0,
        retentionRate: 0,
        averageSpend: 0,
        averageOrders: 0,
      });
      setCustomers([]);
      setGrowth(makeLastMonths(6));
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
  };

  useEffect(() => {
    loadInsights();
  }, []);

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

  return (
    <div className="mk-page ci-page">
      <div className="ci-kpi-grid">
        <KpiCard
          title="Total Customers"
          value={summary.totalCustomers}
          sub={`+${summary.newThisMonth || 0} this month`}
          tone="pink"
        />

        <KpiCard
          title="Returning Customers"
          value={summary.returningCustomers}
          sub={`${summary.retentionRate || 0}% retention`}
          tone="purple"
        />

        <KpiCard
          title="New This Month"
          value={summary.newThisMonth}
          sub="vs last month"
          tone="blue"
        />

        <KpiCard
          title="Avg. Spend / Customer"
          value={formatSar(summary.averageSpend)}
          sub="All time"
          tone="teal"
        />
      </div>

      {error ? <div className="mk-error-text">{error}</div> : null}

      <GrowthChart data={growth} />

      <div className="ci-breakdown-grid">
        <section className="ci-breakdown-card">
          <h3>New vs Returning</h3>
          {(() => {
            const total =
              breakdown.newCustomers + breakdown.returningCustomers || 1;
            const newPct = Math.round((breakdown.newCustomers / total) * 100);
            const retPct = 100 - newPct;
            return (
              <>
                <div className="ci-nvr-bar">
                  <div
                    className="ci-nvr-new"
                    style={{ width: `${newPct}%` }}
                    title={`New ${newPct}%`}
                  />
                  <div
                    className="ci-nvr-ret"
                    style={{ width: `${retPct}%` }}
                    title={`Returning ${retPct}%`}
                  />
                </div>
                <div className="ci-nvr-legend">
                  <span>
                    <i className="ci-dot-new" /> New&nbsp;
                    <b>{breakdown.newCustomers}</b> ({newPct}%)
                  </span>
                  <span>
                    <i className="ci-dot-ret" /> Returning&nbsp;
                    <b>{breakdown.returningCustomers}</b> ({retPct}%)
                  </span>
                </div>
                <div className="ci-ltv-line">
                  Lifetime Value / Customer:{' '}
                  <b>{formatSar(breakdown.ltv)}</b>
                </div>
              </>
            );
          })()}
        </section>

        <section className="ci-breakdown-card">
          <h3>Walk-in vs Corporate</h3>
          {breakdown.typeDistribution.length === 0 ? (
            <div className="ci-bd-empty">No data</div>
          ) : (
            <div className="ci-type-list">
              {breakdown.typeDistribution.map((row, idx) => (
                <div className="ci-type-row" key={row.type}>
                  <span className="ci-type-name">
                    <i
                      className="ci-type-dot"
                      style={{
                        background: TYPE_COLORS[idx % TYPE_COLORS.length],
                      }}
                    />
                    {humanize(row.type)}
                  </span>
                  <span className="ci-type-meta">
                    <b>{row.customers}</b> cust · {formatSar(row.revenue)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="ci-breakdown-card ci-branch-card">
        <h3>Branch Distribution</h3>
        {breakdown.branchDistribution.length === 0 ? (
          <div className="ci-bd-empty">No data</div>
        ) : (
          (() => {
            const maxRev = Math.max(
              1,
              ...breakdown.branchDistribution.map((r) => r.revenue),
            );
            return (
              <div className="ci-branch-list">
                {breakdown.branchDistribution.map((row) => (
                  <div className="ci-branch-row" key={row.branch}>
                    <div className="ci-branch-top">
                      <span>{row.branch}</span>
                      <span>
                        <b>{formatSar(row.revenue)}</b> · {row.customers} cust
                      </span>
                    </div>
                    <div className="ci-branch-track">
                      <div
                        className="ci-branch-fill"
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

      <section className="ci-customers-card">
        <div className="ci-customers-header">
          <h3>All Customers</h3>

          <div className="ci-customers-actions">
            <label className="ci-search">
              <Search size={13} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search..."
              />
            </label>

            <select
              className="ci-sort-select"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="highest_spend">Highest Spend</option>
              <option value="most_orders">Most Orders</option>
              <option value="name">Name A-Z</option>
            </select>

            <button
              type="button"
              className="ci-refresh-btn"
              onClick={loadInsights}
              disabled={loading}
              title="Refresh"
            >
              <RefreshCw size={14} className={loading ? 'ci-spin' : ''} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="ci-empty-customers">
            <RefreshCw size={26} className="ci-spin" />
            <p>Loading customers...</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <EmptyCustomers />
        ) : (
          <div className="ci-table-wrap">
            <table className="ci-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Contact</th>
                  <th>Orders</th>
                  <th>Total Spend</th>
                  <th>Segment</th>
                </tr>
              </thead>

              <tbody>
                {filteredCustomers.map((item) => (
                  <tr key={item.id || `${item.name}-${item.phone}`}>
                    <td>
                      <strong>{item.name}</strong>
                      <span>{item.email || '—'}</span>
                    </td>
                    <td>{item.phone || '—'}</td>
                    <td>{item.orders}</td>
                    <td>{formatSar(item.totalSpend)}</td>
                    <td>{humanize(item.segment)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <style>
        {`
          .ci-page {
            padding: 20px 22px 28px;
            background: #f4f6f9;
            min-height: calc(100vh - 60px);
          }

          .ci-kpi-grid {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 14px;
            margin-bottom: 16px;
          }

          .ci-kpi-card {
            height: 82px;
            background: #ffffff;
            border: 1px solid #e1e7ef;
            border-radius: 9px;
            overflow: hidden;
            position: relative;
            box-sizing: border-box;
          }

          .ci-kpi-top-line {
            height: 3px;
            width: 100%;
          }

          .ci-kpi-pink .ci-kpi-top-line {
            background: #f43f8e;
          }

          .ci-kpi-purple .ci-kpi-top-line {
            background: #8b5cf6;
          }

          .ci-kpi-blue .ci-kpi-top-line {
            background: #3b82f6;
          }

          .ci-kpi-teal .ci-kpi-top-line {
            background: #14b8a6;
          }

          .ci-kpi-content {
            padding: 14px 13px 10px;
          }

          .ci-kpi-content p {
            margin: 0 0 7px;
            color: #64748b;
            font-size: 10px;
            font-weight: 650;
          }

          .ci-kpi-content strong {
            display: block;
            color: #111827;
            font-size: 21px;
            font-weight: 950;
            line-height: 1;
            margin-bottom: 6px;
          }

          .ci-kpi-content span {
            display: block;
            color: #8492aa;
            font-size: 10px;
            font-weight: 650;
          }

          .ci-chart-card {
            background: #ffffff;
            border: 1px solid #e1e7ef;
            border-radius: 9px;
            padding: 14px 16px 16px;
            margin-bottom: 18px;
            box-sizing: border-box;
          }

          .ci-chart-card h3 {
            margin: 0 0 10px;
            color: #111827;
            font-size: 13px;
            font-weight: 800;
          }

          .ci-chart-svg {
            width: 100%;
            height: 160px;
            display: block;
          }

          .ci-grid-line {
            stroke: #e6ebf2;
            stroke-width: 1;
            stroke-dasharray: 3 4;
          }

          .ci-vertical-grid {
            stroke: #eef2f7;
            stroke-width: 1;
            stroke-dasharray: 3 4;
          }

          .ci-axis-line {
            stroke: #94a3b8;
            stroke-width: 1;
          }

          .ci-axis-text {
            fill: #64748b;
            font-size: 10px;
            font-weight: 650;
          }

          .ci-growth-line {
            fill: none;
            stroke: #3b82f6;
            stroke-width: 2;
          }

          .ci-growth-dot {
            fill: #3b82f6;
          }

          .ci-breakdown-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 14px;
            margin-bottom: 18px;
          }

          .ci-breakdown-card {
            background: #ffffff;
            border: 1px solid #e1e7ef;
            border-radius: 9px;
            padding: 14px 16px 16px;
            box-sizing: border-box;
          }

          .ci-breakdown-card h3 {
            margin: 0 0 12px;
            color: #111827;
            font-size: 13px;
            font-weight: 800;
          }

          .ci-branch-card {
            margin-bottom: 18px;
          }

          .ci-bd-empty {
            color: #94a3b8;
            font-size: 11px;
            font-weight: 650;
            padding: 14px 0;
            text-align: center;
          }

          .ci-nvr-bar {
            display: flex;
            height: 14px;
            border-radius: 7px;
            overflow: hidden;
            background: #eef2f7;
          }

          .ci-nvr-new { background: #3b82f6; }
          .ci-nvr-ret { background: #8b5cf6; }

          .ci-nvr-legend {
            display: flex;
            justify-content: space-between;
            gap: 10px;
            margin-top: 10px;
            font-size: 11px;
            color: #475569;
            font-weight: 650;
          }

          .ci-nvr-legend i,
          .ci-type-dot {
            display: inline-block;
            width: 9px;
            height: 9px;
            border-radius: 50%;
            margin-right: 5px;
            vertical-align: middle;
          }

          .ci-dot-new { background: #3b82f6; }
          .ci-dot-ret { background: #8b5cf6; }

          .ci-ltv-line {
            margin-top: 12px;
            padding-top: 10px;
            border-top: 1px solid #eef2f7;
            font-size: 11px;
            color: #64748b;
            font-weight: 650;
          }

          .ci-ltv-line b { color: #111827; }

          .ci-type-list {
            display: grid;
            gap: 10px;
          }

          .ci-type-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 12px;
            color: #334155;
            font-weight: 650;
          }

          .ci-type-name {
            display: inline-flex;
            align-items: center;
          }

          .ci-type-meta {
            color: #64748b;
            font-size: 11px;
          }

          .ci-type-meta b { color: #111827; }

          .ci-branch-list {
            display: grid;
            gap: 12px;
          }

          .ci-branch-top {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            color: #475569;
            font-weight: 650;
            margin-bottom: 5px;
          }

          .ci-branch-top b { color: #111827; }

          .ci-branch-track {
            height: 8px;
            border-radius: 5px;
            background: #eef2f7;
            overflow: hidden;
          }

          .ci-branch-fill {
            height: 100%;
            border-radius: 5px;
            background: linear-gradient(90deg, #14b8a6, #3b82f6);
          }

          .ci-customers-card {
            min-height: 160px;
            background: #ffffff;
            border: 1px solid #e1e7ef;
            border-radius: 9px;
            padding: 14px 14px 16px;
            box-sizing: border-box;
          }

          .ci-customers-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 12px;
          }

          .ci-customers-header h3 {
            margin: 0;
            color: #111827;
            font-size: 13px;
            font-weight: 800;
          }

          .ci-customers-actions {
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .ci-search {
            width: 145px;
            height: 28px;
            border: 1px solid #dbe1ea;
            border-radius: 7px;
            display: flex;
            align-items: center;
            gap: 7px;
            padding: 0 9px;
            color: #94a3b8;
            box-sizing: border-box;
          }

          .ci-search input {
            border: 0;
            outline: none;
            width: 100%;
            min-width: 0;
            font-size: 10px;
            color: #111827;
            font-family: inherit;
          }

          .ci-sort-select {
            width: 110px;
            height: 28px;
            border: 1px solid #d9ad18;
            border-radius: 7px;
            background: #ffffff;
            color: #111827;
            font-size: 10px;
            font-weight: 650;
            outline: none;
            padding: 0 8px;
            font-family: inherit;
          }

          .ci-refresh-btn {
            width: 28px;
            height: 28px;
            border: 1px solid #dbe1ea;
            border-radius: 7px;
            background: #ffffff;
            color: #64748b;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
          }

          .ci-empty-customers {
            height: 95px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: #dbe3ef;
          }

          .ci-empty-customers p {
            margin: 6px 0 0;
            color: #94a3b8;
            font-size: 11px;
            font-weight: 650;
          }

          .ci-table-wrap {
            overflow-x: auto;
          }

          .ci-table {
            width: 100%;
            border-collapse: collapse;
          }

          .ci-table th {
            height: 34px;
            padding: 0 10px;
            color: #64748b;
            font-size: 9px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 1.3px;
            text-align: left;
            border-bottom: 1px solid #e5e7eb;
          }

          .ci-table td {
            height: 42px;
            padding: 0 10px;
            color: #111827;
            font-size: 11px;
            font-weight: 650;
            border-bottom: 1px solid #eef2f7;
          }

          .ci-table td strong {
            display: block;
            font-weight: 850;
          }

          .ci-table td span {
            display: block;
            margin-top: 2px;
            color: #94a3b8;
            font-size: 10px;
          }

          .ci-spin {
            animation: ci-spin 1s linear infinite;
          }

          @keyframes ci-spin {
            to {
              transform: rotate(360deg);
            }
          }

          @media (max-width: 1050px) {
            .ci-kpi-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }

            .ci-breakdown-grid {
              grid-template-columns: 1fr;
            }
          }

          @media (max-width: 700px) {
            .ci-kpi-grid {
              grid-template-columns: 1fr;
            }

            .ci-customers-header {
              flex-direction: column;
              align-items: stretch;
            }

            .ci-customers-actions {
              flex-direction: column;
              align-items: stretch;
            }

            .ci-search,
            .ci-sort-select {
              width: 100%;
            }
          }
        `}
      </style>
    </div>
  );
};

export default CustomerInsights;