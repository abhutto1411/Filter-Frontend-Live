import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BarChart3,
  Loader2,
  RefreshCw,
  Users,
  Receipt,
  Tag,
  Building2,
} from 'lucide-react';
import { marketingGetPromoCodeReport } from '../../services/superAdminMarketingApi';
import { marketingSectionPath } from './marketingRouteUtils';
import {
  formatPromoCodeSar,
  formatPromoCodeUsageLabel,
  mapDiscountTypeToUi,
  normalizePromoCode,
  safeArray,
} from './promoCodeShared';
import './MarketingUniversal.css';

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function MarketingPromoCodeReportPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const listPath = marketingSectionPath(location.pathname, 'promo-codes');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [promoCode, setPromoCode] = useState(null);
  const [summary, setSummary] = useState(null);
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [activeTab, setActiveTab] = useState('orders');

  const loadReport = async () => {
    try {
      setLoading(true);
      setError('');

      const data = await marketingGetPromoCodeReport(id);
      const code = data?.promoCode || data?.data?.promoCode || null;

      setPromoCode(code ? normalizePromoCode(code) : null);
      setSummary(data?.summary || data?.data?.summary || null);
      setOrders(safeArray(data, ['orders', 'data.orders']));
      setCustomers(safeArray(data, ['customers', 'data.customers']));
      setBranches(safeArray(data, ['branches', 'data.branches']));
    } catch (err) {
      setError(err?.message || 'Could not load promo code report.');
      setPromoCode(null);
      setSummary(null);
      setOrders([]);
      setCustomers([]);
      setBranches([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [id]);

  const usageLabel = useMemo(
    () => (promoCode ? formatPromoCodeUsageLabel(promoCode) : ''),
    [promoCode]
  );

  if (loading) {
    return (
      <div className="mkp-page mkp-report-loading">
        <Loader2 size={32} className="mkp-spin" />
        <div>Loading promo code report...</div>
      </div>
    );
  }

  if (error || !promoCode) {
    return (
      <div className="mkp-page">
        <button type="button" className="mkp-back-btn" onClick={() => navigate(listPath)}>
          <ArrowLeft size={16} />
          Back to Promo Codes
        </button>
        <div className="mk-code-error-banner">{error || 'Promo code not found.'}</div>
      </div>
    );
  }

  return (
    <div className="mk-report-page mkp-promotion-report-page">
      <div className="mkp-report-topbar">
        <button type="button" className="mkp-back-btn" onClick={() => navigate(listPath)}>
          <ArrowLeft size={16} />
          Back to Promo Codes
        </button>
        <button type="button" className="mkp-icon-btn" onClick={loadReport}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      <div className="mkp-report-hero">
        <div className="mkp-report-hero-icon">
          <Tag size={22} />
        </div>
        <div>
          <h1>{promoCode.code}</h1>
          <p>
            {promoCode.promotion || 'Standalone promo code'} •{' '}
            {mapDiscountTypeToUi(promoCode.discountType)} • {promoCode.discountValue}
          </p>
          <span
            className={`mk-code-status-badge status-${String(promoCode.status)
              .toLowerCase()
              .replace(/\s+/g, '-')}`}
          >
            {promoCode.status}
          </span>
        </div>
      </div>

      <div className="mkp-report-kpi-grid">
        <div className="mkp-report-kpi">
          <Receipt size={18} />
          <span>Redemptions</span>
          <strong>{summary?.redemptionCount ?? 0}</strong>
        </div>
        <div className="mkp-report-kpi">
          <Users size={18} />
          <span>Unique customers</span>
          <strong>{summary?.uniqueCustomers ?? 0}</strong>
        </div>
        <div className="mkp-report-kpi">
          <BarChart3 size={18} />
          <span>Usage</span>
          <strong>{usageLabel}</strong>
        </div>
        <div className="mkp-report-kpi">
          <Tag size={18} />
          <span>Discount given</span>
          <strong>{formatPromoCodeSar(summary?.totalDiscountProvided)}</strong>
        </div>
        <div className="mkp-report-kpi">
          <Building2 size={18} />
          <span>Revenue</span>
          <strong>{formatPromoCodeSar(summary?.totalRevenue)}</strong>
        </div>
      </div>

      <div className="mkp-report-tabs">
        {[
          ['orders', 'Orders'],
          ['customers', 'Customers'],
          ['branches', 'Branches'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={activeTab === key ? 'active' : ''}
            onClick={() => setActiveTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mkp-report-panel">
        {activeTab === 'orders' ? (
          orders.length === 0 ? (
            <div className="mkp-empty">No redemptions recorded yet.</div>
          ) : (
            <table className="mk-code-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th>Branch</th>
                  <th>Promo discount</th>
                  <th>Invoice total</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((row) => (
                  <tr key={row.orderId || row.invoiceId}>
                    <td>{row.invoiceNo || row.invoiceId || '—'}</td>
                    <td>{row.customerName || '—'}</td>
                    <td>{row.branchName || '—'}</td>
                    <td>{formatPromoCodeSar(row.promoDiscount)}</td>
                    <td>{formatPromoCodeSar(row.invoiceTotal)}</td>
                    <td>{formatDate(row.redeemedAt || row.issuedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : null}

        {activeTab === 'customers' ? (
          customers.length === 0 ? (
            <div className="mkp-empty">No customer data yet.</div>
          ) : (
            <table className="mk-code-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Orders</th>
                  <th>Discount</th>
                  <th>Revenue</th>
                  <th>Last used</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((row) => (
                  <tr key={row.customerId || row.customerName}>
                    <td>{row.customerName}</td>
                    <td>{row.orderCount}</td>
                    <td>{formatPromoCodeSar(row.totalDiscount)}</td>
                    <td>{formatPromoCodeSar(row.totalRevenue)}</td>
                    <td>{formatDate(row.lastRedeemedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : null}

        {activeTab === 'branches' ? (
          branches.length === 0 ? (
            <div className="mkp-empty">No branch data yet.</div>
          ) : (
            <table className="mk-code-table">
              <thead>
                <tr>
                  <th>Branch</th>
                  <th>Workshop</th>
                  <th>Orders</th>
                  <th>Discount</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {branches.map((row) => (
                  <tr key={row.branchId || row.branchName}>
                    <td>{row.branchName || '—'}</td>
                    <td>{row.workshopName || '—'}</td>
                    <td>{row.orderCount}</td>
                    <td>{formatPromoCodeSar(row.totalDiscount)}</td>
                    <td>{formatPromoCodeSar(row.totalRevenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : null}
      </div>
    </div>
  );
}
