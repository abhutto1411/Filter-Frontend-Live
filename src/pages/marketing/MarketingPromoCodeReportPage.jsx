import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom';
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
import { promoStatusLabel, promoT } from '../../utils/promoCodesI18n';
import { resolveMarketingLocale } from '../../utils/marketingPromotionsI18n';
import { marketingSectionPath } from './marketingRouteUtils';
import {
  formatPromoCodeSar,
  formatPromoCodeUsageLabel,
  mapDiscountTypeToUi,
  normalizePromoCode,
  safeArray,
} from './promoCodeShared';
import './MarketingUniversal.css';

function formatDate(value, locale) {
  if (!value) return promoT(locale, 'report.dash');
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return promoT(locale, 'report.dash');
  return date.toLocaleString(locale === 'ar' ? 'ar-SA' : undefined, {
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
  const outletCtx = useOutletContext() || {};
  const locale = resolveMarketingLocale(outletCtx);
  const t = useCallback((key, vars) => promoT(locale, key, vars), [locale]);
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

      setPromoCode(code ? normalizePromoCode(code, locale) : null);
      setSummary(data?.summary || data?.data?.summary || null);
      setOrders(safeArray(data, ['orders', 'data.orders']));
      setCustomers(safeArray(data, ['customers', 'data.customers']));
      setBranches(safeArray(data, ['branches', 'data.branches']));
    } catch (err) {
      setError(err?.message || t('report.errLoad'));
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
    () => (promoCode ? formatPromoCodeUsageLabel(promoCode, locale) : ''),
    [promoCode, locale],
  );

  if (loading) {
    return (
      <div className="mkp-page mkp-report-loading">
        <Loader2 size={32} className="mkp-spin" />
        <div>{t('report.loading')}</div>
      </div>
    );
  }

  if (error || !promoCode) {
    return (
      <div className="mkp-page">
        <button type="button" className="mkp-back-btn" onClick={() => navigate(listPath)}>
          <ArrowLeft size={16} />
          {t('report.back')}
        </button>
        <div className="mk-code-error-banner">{error || t('report.notFound')}</div>
      </div>
    );
  }

  return (
    <div className="mk-report-page mkp-promotion-report-page">
      <div className="mkp-report-topbar">
        <button type="button" className="mkp-back-btn" onClick={() => navigate(listPath)}>
          <ArrowLeft size={16} />
          {t('report.back')}
        </button>
        <button type="button" className="mkp-icon-btn" onClick={loadReport}>
          <RefreshCw size={16} />
          {t('report.refresh')}
        </button>
      </div>

      <div className="mkp-report-hero">
        <div className="mkp-report-hero-icon">
          <Tag size={22} />
        </div>
        <div>
          <h1>{promoCode.code}</h1>
          <p>
            {promoCode.promotion || t('report.standalone')} •{' '}
            {mapDiscountTypeToUi(promoCode.discountType, locale)} • {promoCode.discountValue}
          </p>
          <span
            className={`mk-code-status-badge status-${String(promoCode.status)
              .toLowerCase()
              .replace(/\s+/g, '-')}`}
          >
            {promoStatusLabel(locale, promoCode.status)}
          </span>
        </div>
      </div>

      <div className="mkp-report-kpi-grid">
        <div className="mkp-report-kpi">
          <Receipt size={18} />
          <span>{t('report.kpi.redemptions')}</span>
          <strong>{summary?.redemptionCount ?? 0}</strong>
        </div>
        <div className="mkp-report-kpi">
          <Users size={18} />
          <span>{t('report.kpi.customers')}</span>
          <strong>{summary?.uniqueCustomers ?? 0}</strong>
        </div>
        <div className="mkp-report-kpi">
          <BarChart3 size={18} />
          <span>{t('report.kpi.usage')}</span>
          <strong>{usageLabel}</strong>
        </div>
        <div className="mkp-report-kpi">
          <Tag size={18} />
          <span>{t('report.kpi.discount')}</span>
          <strong>{formatPromoCodeSar(summary?.totalDiscountProvided, locale)}</strong>
        </div>
        <div className="mkp-report-kpi">
          <Building2 size={18} />
          <span>{t('report.kpi.revenue')}</span>
          <strong>{formatPromoCodeSar(summary?.totalRevenue, locale)}</strong>
        </div>
      </div>

      <div className="mkp-report-tabs">
        {[
          ['orders', 'report.tab.orders'],
          ['customers', 'report.tab.customers'],
          ['branches', 'report.tab.branches'],
        ].map(([key, labelKey]) => (
          <button
            key={key}
            type="button"
            className={activeTab === key ? 'active' : ''}
            onClick={() => setActiveTab(key)}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>

      <div className="mkp-report-panel">
        {activeTab === 'orders' ? (
          orders.length === 0 ? (
            <div className="mkp-empty">{t('report.empty.orders')}</div>
          ) : (
            <table className="mk-code-table">
              <thead>
                <tr>
                  <th>{t('report.th.invoice')}</th>
                  <th>{t('report.th.customer')}</th>
                  <th>{t('report.th.branch')}</th>
                  <th>{t('report.th.promoDiscount')}</th>
                  <th>{t('report.th.invoiceTotal')}</th>
                  <th>{t('report.th.date')}</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((row) => (
                  <tr key={row.orderId || row.invoiceId}>
                    <td>{row.invoiceNo || row.invoiceId || t('report.dash')}</td>
                    <td>{row.customerName || t('report.dash')}</td>
                    <td>{row.branchName || t('report.dash')}</td>
                    <td>{formatPromoCodeSar(row.promoDiscount, locale)}</td>
                    <td>{formatPromoCodeSar(row.invoiceTotal, locale)}</td>
                    <td>{formatDate(row.redeemedAt || row.issuedAt, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : null}

        {activeTab === 'customers' ? (
          customers.length === 0 ? (
            <div className="mkp-empty">{t('report.empty.customers')}</div>
          ) : (
            <table className="mk-code-table">
              <thead>
                <tr>
                  <th>{t('report.th.customer')}</th>
                  <th>{t('report.th.orders')}</th>
                  <th>{t('report.th.discount')}</th>
                  <th>{t('report.th.revenue')}</th>
                  <th>{t('report.th.lastUsed')}</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((row) => (
                  <tr key={row.customerId || row.customerName}>
                    <td>{row.customerName}</td>
                    <td>{row.orderCount}</td>
                    <td>{formatPromoCodeSar(row.totalDiscount, locale)}</td>
                    <td>{formatPromoCodeSar(row.totalRevenue, locale)}</td>
                    <td>{formatDate(row.lastRedeemedAt, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : null}

        {activeTab === 'branches' ? (
          branches.length === 0 ? (
            <div className="mkp-empty">{t('report.empty.branches')}</div>
          ) : (
            <table className="mk-code-table">
              <thead>
                <tr>
                  <th>{t('report.th.branch')}</th>
                  <th>{t('report.th.workshop')}</th>
                  <th>{t('report.th.orders')}</th>
                  <th>{t('report.th.discount')}</th>
                  <th>{t('report.th.revenue')}</th>
                </tr>
              </thead>
              <tbody>
                {branches.map((row) => (
                  <tr key={row.branchId || row.branchName}>
                    <td>{row.branchName || t('report.dash')}</td>
                    <td>{row.workshopName || t('report.dash')}</td>
                    <td>{row.orderCount}</td>
                    <td>{formatPromoCodeSar(row.totalDiscount, locale)}</td>
                    <td>{formatPromoCodeSar(row.totalRevenue, locale)}</td>
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
