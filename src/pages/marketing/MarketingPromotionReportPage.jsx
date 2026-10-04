import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useOutletContext, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BarChart3,
  Loader2,
  RefreshCw,
  Users,
  Receipt,
  Tag,
  TrendingUp,
  Percent,
  Building2,
  Package,
  Gift,
} from "lucide-react";
import { marketingGetPromotionReport } from "../../services/superAdminMarketingApi";
import {
  mktPromoOptionLabel,
  mktPromoT,
  resolveMarketingLocale,
} from "../../utils/marketingPromotionsI18n";
import {
  formatPromotionSar,
  formatPromotionUsageLabel,
  formatStatusLabel,
  isPromotionLiveOnPos,
  normalizePromotion,
  resolvePromotionBasePath,
  safeArray,
} from "./marketingPromotionShared";
import "./MarketingUniversal.css";

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatShortDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function MarketingPromotionReportPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const outletCtx = useOutletContext() || {};
  const locale = resolveMarketingLocale(outletCtx);
  const t = (key, vars) => mktPromoT(locale, key, vars);
  const listPath = resolvePromotionBasePath(location.pathname);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [promotion, setPromotion] = useState(null);
  const [summary, setSummary] = useState(null);
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [items, setItems] = useState([]);
  const [activeTab, setActiveTab] = useState("orders");

  const loadReport = async () => {
    try {
      setLoading(true);
      setError("");

      const data = await marketingGetPromotionReport(id);
      const promo =
        data?.promotion || data?.data?.promotion || data?.item || null;

      setPromotion(promo ? normalizePromotion(promo) : null);
      setSummary(data?.summary || data?.data?.summary || null);
      setOrders(safeArray(data, ["orders", "data.orders"]));
      setCustomers(safeArray(data, ["customers", "data.customers"]));
      setBranches(safeArray(data, ["branches", "data.branches"]));
      setItems(safeArray(data, ["items", "data.items"]));
    } catch (err) {
      console.error("Promotion report error:", err);
      setError(err?.message || t('report.errLoad'));
      setPromotion(null);
      setSummary(null);
      setOrders([]);
      setCustomers([]);
      setBranches([]);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [id]);

  const usageLabel = useMemo(
    () => (promotion ? formatPromotionUsageLabel(promotion, locale) : ""),
    [promotion]
  );

  if (loading) {
    return (
      <div className="mkp-page mkp-report-loading">
        <Loader2 size={32} className="mkp-spin" />
        <div>{t('report.loading')}</div>
      </div>
    );
  }

  if (error || !promotion) {
    return (
      <div className="mkp-page">
        <button
          type="button"
          className="mkp-report-back"
          onClick={() => navigate(listPath)}
        >
          <ArrowLeft size={16} />
          {t('common.backPromotions')}
        </button>
        <div className="mkp-error">
          {error || t('err.notFound')}
        </div>
      </div>
    );
  }

  return (
    <div className="mk-report-page mkp-promotion-report-page">
      <div className="mkp-report-topbar">
        <button
          type="button"
          className="mkp-report-back"
          onClick={() => navigate(listPath)}
        >
          <ArrowLeft size={16} />
          {t('common.backPromotions')}
        </button>

        <div className="mkp-report-topbar-actions">
          <button type="button" className="mk-report-ai-btn" onClick={loadReport}>
            <RefreshCw size={15} />
            {t('common.refresh')}
          </button>
          <button
            type="button"
            className="mk-btn-primary"
            onClick={() => navigate(`${listPath}/${promotion.id}/edit`)}
          >
            {t('report.edit')}
          </button>
        </div>
      </div>

      <div className="mkp-report-hero">
        <div className="mkp-report-hero-icon">
          <Tag size={22} />
        </div>
        <div>
          <h1>{promotion.name}</h1>
          <p>
            {promotion.strategy} · {promotion.promotionType} · Value{" "}
            {promotion.discountValue || 0}
          </p>
          <div className="mkp-report-hero-badges">
            <span
              className={`mkp-status status-${String(promotion.status)
                .toLowerCase()
                .replace(/\s+/g, "-")}`}
            >
              {formatStatusLabel(promotion.status, locale)}
            </span>
            {isPromotionLiveOnPos(promotion) ? (
              <span className="mkp-live-chip">{t('report.live')}</span>
            ) : null}
            <span className="mkp-report-scope-badge">{usageLabel}</span>
          </div>
        </div>
      </div>

      <div className="mk-report-metrics-grid">
        <div className="mk-report-metric-card mk-report-tone-dark">
          <div className="mk-report-metric-title">
            <Receipt size={14} />
            {t('report.metric.usage')}
          </div>
          <div className="mk-report-metric-value">{usageLabel}</div>
          <div className="mk-report-metric-sub">
            {t('report.metric.usageSub', { n: summary?.redemptionCount ?? 0 })}
          </div>
        </div>

        <div className="mk-report-metric-card mk-report-tone-red">
          <div className="mk-report-metric-title">
            <Percent size={14} />
            {t('report.metric.discount')}
          </div>
          <div className="mk-report-metric-value">
            {formatPromotionSar(summary?.totalDiscountProvided ?? 0, locale)}
          </div>
          <div className="mk-report-metric-sub">
            {t('report.metric.discountSub')}
          </div>
        </div>

        <div className="mk-report-metric-card">
          <div className="mk-report-metric-title">
            <TrendingUp size={14} />
            {t('report.metric.revenue')}
          </div>
          <div className="mk-report-metric-value">
            {formatPromotionSar(summary?.totalRevenue ?? 0, locale)}
          </div>
          <div className="mk-report-metric-sub">
            {t('report.metric.revenueSub')}
          </div>
        </div>

        <div className="mk-report-metric-card">
          <div className="mk-report-metric-title">
            <BarChart3 size={14} />
            {t('report.metric.gross')}
          </div>
          <div className="mk-report-metric-value">
            {formatPromotionSar(summary?.grossRevenue ?? 0, locale)}
          </div>
          <div className="mk-report-metric-sub">
            {t('report.metric.grossSub')}
          </div>
        </div>

        <div className="mk-report-metric-card mk-report-tone-red">
          <div className="mk-report-metric-title">
            <Building2 size={14} />
            {t('report.metric.payable')}
          </div>
          <div className="mk-report-metric-value">
            {formatPromotionSar(summary?.payableTotal ?? 0, locale)}
          </div>
          <div className="mk-report-metric-sub">
            {t('report.metric.payableSub')}
          </div>
        </div>

        <div className="mk-report-metric-card">
          <div className="mk-report-metric-title">
            <Package size={14} />
            {t('report.metric.trigger')}
          </div>
          <div className="mk-report-metric-value">
            {formatPromotionSar(summary?.triggerSalesTotal ?? 0, locale)}
          </div>
          <div className="mk-report-metric-sub">
            {t('report.metric.triggerSub')}
          </div>
        </div>

        <div className="mk-report-metric-card">
          <div className="mk-report-metric-title">
            <Gift size={14} />
            {t('report.metric.reward')}
          </div>
          <div className="mk-report-metric-value">
            {formatPromotionSar(summary?.rewardValueTotal ?? 0, locale)}
          </div>
          <div className="mk-report-metric-sub">
            {t('report.metric.rewardSub')}
          </div>
        </div>
      </div>

      <div className="mkp-report-tabs">
        <button
          type="button"
          className={activeTab === "orders" ? "active" : ""}
          onClick={() => setActiveTab("orders")}
        >
          <Receipt size={15} />
          {t('report.tab.orders', { n: orders.length })}
        </button>
        <button
          type="button"
          className={activeTab === "customers" ? "active" : ""}
          onClick={() => setActiveTab("customers")}
        >
          <Users size={15} />
          {t('report.tab.customers', { n: customers.length })}
        </button>
        <button
          type="button"
          className={activeTab === "branches" ? "active" : ""}
          onClick={() => setActiveTab("branches")}
        >
          <Building2 size={15} />
          {t('report.tab.branches', { n: branches.length })}
        </button>
        <button
          type="button"
          className={activeTab === "items" ? "active" : ""}
          onClick={() => setActiveTab("items")}
        >
          <Package size={15} />
          {t('report.tab.items', { n: items.length })}
        </button>
      </div>

      {activeTab === "orders" ? (
        <div className="mkp-report-table-wrap">
          <table className="mkp-report-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Branch</th>
                <th>Vehicle</th>
                <th>Sale (A)</th>
                <th>Free/Reward (B)</th>
                <th>Promo Discount</th>
                <th>Payable</th>
                <th>Invoice Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="mkp-report-empty-row">
                    No redemptions yet. Active promotions will appear here when
                    applied on POS invoices.
                  </td>
                </tr>
              ) : (
                orders.map((row) => (
                  <tr key={row.redemptionId || row.invoiceId}>
                    <td>
                      <strong>{row.invoiceNo || "—"}</strong>
                      <div className="mkp-report-subcell">
                        Order #{row.orderId || "—"}
                      </div>
                    </td>
                    <td>{formatDate(row.redeemedAt || row.invoiceDate)}</td>
                    <td>
                      <strong>{row.customerName || "—"}</strong>
                      {row.customerMobile ? (
                        <div className="mkp-report-subcell">{row.customerMobile}</div>
                      ) : null}
                    </td>
                    <td>{row.branchName || "—"}</td>
                    <td>
                      {row.vehiclePlate || "—"}
                      {row.vehicleMake || row.vehicleModel ? (
                        <div className="mkp-report-subcell">
                          {[row.vehicleMake, row.vehicleModel]
                            .filter(Boolean)
                            .join(" ")}
                        </div>
                      ) : null}
                    </td>
                    <td className="mkp-report-money">
                      {formatPromotionSar(row.triggerSalesTotal, locale)}
                    </td>
                    <td className="mkp-report-money">
                      {formatPromotionSar(row.rewardValueTotal, locale)}
                    </td>
                    <td className="mkp-report-money discount">
                      {formatPromotionSar(row.promotionDiscount, locale)}
                    </td>
                    <td className="mkp-report-money payable">
                      {formatPromotionSar(row.payableAmount ?? row.promotionDiscount, locale)}
                    </td>
                    <td className="mkp-report-money">
                      {formatPromotionSar(row.invoiceTotal, locale)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : activeTab === "customers" ? (
        <div className="mkp-report-table-wrap">
          <table className="mkp-report-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Orders</th>
                <th>Total Discount</th>
                <th>Revenue</th>
                <th>Gross</th>
                <th>Last Used</th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="mkp-report-empty-row">
                    No customer redemptions recorded yet.
                  </td>
                </tr>
              ) : (
                customers.map((row, index) => (
                  <tr key={row.customerId || `${row.customerName}-${index}`}>
                    <td>
                      <strong>{row.customerName || "—"}</strong>
                      {row.customerMobile ? (
                        <div className="mkp-report-subcell">{row.customerMobile}</div>
                      ) : null}
                    </td>
                    <td>{row.orderCount ?? 0}</td>
                    <td className="mkp-report-money discount">
                      {formatPromotionSar(row.totalDiscount, locale)}
                    </td>
                    <td className="mkp-report-money">
                      {formatPromotionSar(row.totalRevenue, locale)}
                    </td>
                    <td className="mkp-report-money">
                      {formatPromotionSar(row.grossRevenue, locale)}
                    </td>
                    <td>{formatShortDate(row.lastRedeemedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : activeTab === "branches" ? (
        <div className="mkp-report-table-wrap">
          <table className="mkp-report-table">
            <thead>
              <tr>
                <th>Workshop</th>
                <th>Branch</th>
                <th>Orders</th>
                <th>Sale (A)</th>
                <th>Free/Reward (B)</th>
                <th>Promo Discount</th>
                <th>HQ Payable</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {branches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="mkp-report-empty-row">
                    No branch/workshop redemptions yet.
                  </td>
                </tr>
              ) : (
                branches.map((row) => (
                  <tr key={row.branchId || row.workshopId}>
                    <td><strong>{row.workshopName || "—"}</strong></td>
                    <td>{row.branchName || "—"}</td>
                    <td>{row.orderCount ?? 0}</td>
                    <td className="mkp-report-money">
                      {formatPromotionSar(row.triggerSalesTotal, locale)}
                    </td>
                    <td className="mkp-report-money">
                      {formatPromotionSar(row.rewardValueTotal, locale)}
                    </td>
                    <td className="mkp-report-money discount">
                      {formatPromotionSar(row.promoDiscountTotal, locale)}
                    </td>
                    <td className="mkp-report-money payable">
                      {formatPromotionSar(row.payableTotal, locale)}
                    </td>
                    <td className="mkp-report-money">
                      {formatPromotionSar(row.revenueTotal, locale)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mkp-report-table-wrap">
          <table className="mkp-report-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Type</th>
                <th>Role</th>
                <th>Qty</th>
                <th>Sale (A)</th>
                <th>Free/Reward (B)</th>
                <th>Promo share</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="mkp-report-empty-row">
                    No product/service lines matched this promotion yet.
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr key={`${row.itemType}-${row.itemId}-${row.role}`}>
                    <td><strong>{row.itemName}</strong></td>
                    <td>{row.itemType}</td>
                    <td>
                      {row.role === "trigger"
                        ? "Customer bought (A)"
                        : row.role === "reward"
                          ? "Free / discounted (B)"
                          : "Other"}
                    </td>
                    <td>{row.totalQty ?? 0}</td>
                    <td className="mkp-report-money">
                      {formatPromotionSar(row.saleValue, locale)}
                    </td>
                    <td className="mkp-report-money">
                      {formatPromotionSar(row.rewardValueBefore, locale)}
                    </td>
                    <td className="mkp-report-money discount">
                      {formatPromotionSar(row.promoDiscountShare, locale)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="mkp-report-meta-grid">
        <div className="mkp-report-meta-card">
          <h3>Promotion window</h3>
          <p>
            {formatShortDate(promotion.startDate)} →{" "}
            {formatShortDate(promotion.endDate)}
          </p>
        </div>
        <div className="mkp-report-meta-card">
          <h3>POS visibility</h3>
          <p>
            {promotion.showOnPosInvoice
              ? "Shown on POS invoices when active"
              : "Hidden on POS invoices"}
          </p>
        </div>
        <div className="mkp-report-meta-card">
          <h3>Invoice banner</h3>
          <p>{promotion.invoiceBannerText || "—"}</p>
        </div>
      </div>
    </div>
  );
}
