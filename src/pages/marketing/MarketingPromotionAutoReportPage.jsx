import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Loader2,
  Printer,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Target,
  AlertTriangle,
  Lightbulb,
  ShieldAlert,
  BarChart3,
  Clock,
  Building2,
  Package,
  Users,
  FileText,
} from "lucide-react";
import { marketingGetPromotionAutoReport } from "../../services/superAdminMarketingApi";
import {
  formatPromotionSar,
  formatStatusLabel,
  normalizePromotion,
  resolvePromotionBasePath,
  safeArray,
} from "./marketingPromotionShared";
import {
  buildClientAutoReportAnalytics,
  buildConfigurationFromPromotion,
} from "./marketingPromotionAutoReportAnalytics";
import "./MarketingUniversal.css";

function formatGeneratedAt(value) {
  if (!value) return new Date().toLocaleString();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toLocaleString();
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

function ProgressBar({ percent, label, tone = "amber" }) {
  const clamped = Math.min(100, Math.max(0, Number(percent) || 0));
  return (
    <div className="mkp-ar-progress">
      <div className="mkp-ar-progress-head">
        <span>{label}</span>
        <strong>{clamped.toFixed(0)}%</strong>
      </div>
      <div className="mkp-ar-progress-track">
        <div
          className={`mkp-ar-progress-fill tone-${tone}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

function HealthBadge({ score, label }) {
  let tone = "mid";
  if (score >= 80) tone = "high";
  else if (score < 45) tone = "low";

  return (
    <div className={`mkp-ar-health mkp-ar-health-${tone}`}>
      <div className="mkp-ar-health-score">{score}</div>
      <div>
        <strong>Campaign Health</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  const s = String(status || "ok").toLowerCase();
  return <span className={`mkp-ar-status-pill status-${s}`}>{s}</span>;
}

function PriorityBadge({ priority }) {
  return (
    <span className={`mkp-ar-priority priority-${priority}`}>{priority}</span>
  );
}

export default function MarketingPromotionAutoReportPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const listPath = resolvePromotionBasePath(location.pathname);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [promotion, setPromotion] = useState(null);
  const [summary, setSummary] = useState(null);
  const [configuration, setConfiguration] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [orders, setOrders] = useState([]);
  const [branches, setBranches] = useState([]);
  const [items, setItems] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [generatedAt, setGeneratedAt] = useState(null);

  const loadAutoReport = async () => {
    try {
      setLoading(true);
      setError("");

      const data = await marketingGetPromotionAutoReport(id);
      const promo =
        data?.promotion || data?.data?.promotion || data?.item || null;
      const normalized = promo ? normalizePromotion(promo) : null;
      const summaryData = data?.summary || data?.data?.summary || null;
      const configData =
        data?.configuration ||
        data?.data?.configuration ||
        buildConfigurationFromPromotion(normalized);
      const ordersData = safeArray(data, ["orders", "data.orders"]);
      const branchesData = safeArray(data, ["branches", "data.branches"]);
      const itemsData = safeArray(data, ["items", "data.items"]);
      const customersData = safeArray(data, ["customers", "data.customers"]);

      const analyticsData =
        data?.analytics ||
        data?.data?.analytics ||
        buildClientAutoReportAnalytics({
          promotion: normalized,
          summary: summaryData,
          configuration: configData,
          orders: ordersData,
          branches: branchesData,
          items: itemsData,
          customers: customersData,
        });

      setPromotion(normalized);
      setSummary(summaryData);
      setConfiguration(configData);
      setAnalytics(analyticsData);
      setOrders(ordersData);
      setBranches(branchesData);
      setItems(itemsData);
      setCustomers(customersData);
      setGeneratedAt(data?.generatedAt || new Date().toISOString());
    } catch (err) {
      console.error("Promotion auto report error:", err);
      setError(err?.message || "Could not load auto report.");
      setPromotion(null);
      setSummary(null);
      setConfiguration(null);
      setAnalytics(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAutoReport();
  }, [id]);

  const sections = configuration?.sections || [];
  const targeting = configuration?.targeting || null;
  const timeline = analytics?.timeline || {};
  const financial = analytics?.financial || {};
  const topCustomers = useMemo(
    () =>
      [...customers]
        .sort((a, b) => Number(b.totalRevenue) - Number(a.totalRevenue))
        .slice(0, 5),
    [customers]
  );

  const handlePrint = () => window.print();

  if (loading) {
    return (
      <div className="mkp-page mkp-auto-report-page">
        <div className="mkp-empty">
          <Loader2 size={30} className="mkp-spin" />
          <div>Building analyst report...</div>
        </div>
      </div>
    );
  }

  if (error || !promotion || !analytics) {
    return (
      <div className="mkp-page mkp-auto-report-page">
        <button
          type="button"
          className="mkp-report-back"
          onClick={() => navigate(listPath)}
        >
          <ArrowLeft size={16} />
          Back to Promotions
        </button>
        <div className="mkp-error">{error || "Report could not be generated."}</div>
      </div>
    );
  }

  return (
    <div className="mkp-page mkp-promotion-report-page mkp-auto-report-page">
      <div className="mkp-report-topbar mkp-ar-no-print">
        <button
          type="button"
          className="mkp-report-back"
          onClick={() => navigate(listPath)}
        >
          <ArrowLeft size={16} />
          Back to Promotions
        </button>
        <div className="mkp-report-topbar-actions">
          <button type="button" onClick={loadAutoReport} disabled={loading}>
            <RefreshCw size={15} />
            Refresh
          </button>
          <button type="button" onClick={handlePrint}>
            <Printer size={15} />
            Print / PDF
          </button>
        </div>
      </div>

      <article className="mkp-ar-document">
        <header className="mkp-ar-doc-header">
          <div className="mkp-ar-doc-brand">
            <Sparkles size={20} />
            <span>Marketing Intelligence Report</span>
          </div>
          <h1>{promotion.name}</h1>
          <p className="mkp-ar-doc-subtitle">
            Configuration-driven performance analysis — promotion form settings
            mapped against live redemption data
          </p>
          <div className="mkp-ar-doc-meta">
            <span>Report ID: PROMO-{promotion.id}</span>
            <span>Generated: {formatGeneratedAt(generatedAt)}</span>
            <span
              className={`mkp-status status-${String(promotion.status)
                .toLowerCase()
                .replace(/\s+/g, "-")}`}
            >
              {formatStatusLabel(promotion.status)}
            </span>
            <span className="mkp-auto-report-badge">Auto Report</span>
          </div>
        </header>

        <section className="mkp-ar-section mkp-ar-executive">
          <div className="mkp-ar-section-head">
            <FileText size={18} />
            <h2>Executive Summary</h2>
          </div>
          <div className="mkp-ar-executive-grid">
            <p className="mkp-ar-narrative">{analytics.executiveSummary}</p>
            <HealthBadge
              score={analytics.healthScore}
              label={analytics.healthLabel}
            />
          </div>
        </section>

        <section className="mkp-ar-section">
          <div className="mkp-ar-section-head">
            <BarChart3 size={18} />
            <h2>Performance Dashboard</h2>
          </div>
          <div className="mkp-ar-kpi-grid">
            {analytics.kpis?.map((kpi) => (
              <div key={kpi.key} className="mkp-ar-kpi-card">
                <span className="mkp-ar-kpi-label">{kpi.label}</span>
                <strong className="mkp-ar-kpi-value">{kpi.formatted}</strong>
                <span className="mkp-ar-kpi-context">{kpi.context}</span>
                <span className="mkp-ar-kpi-benchmark">{kpi.benchmark}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mkp-ar-section">
          <div className="mkp-ar-section-head">
            <Clock size={18} />
            <h2>Campaign Timeline & Adoption Pace</h2>
          </div>
          <div className="mkp-ar-timeline-grid">
            <div className="mkp-ar-timeline-stats">
              <div>
                <span>Start</span>
                <strong>{formatShortDate(timeline.startDate)}</strong>
              </div>
              <div>
                <span>End</span>
                <strong>{formatShortDate(timeline.endDate)}</strong>
              </div>
              <div>
                <span>Days elapsed</span>
                <strong>
                  {timeline.daysElapsed ?? 0} / {timeline.daysTotal ?? 0}
                </strong>
              </div>
              <div>
                <span>Days remaining</span>
                <strong>{timeline.daysRemaining ?? 0}</strong>
              </div>
              <div>
                <span>Pace ratio</span>
                <strong>
                  {timeline.paceRatio != null
                    ? `${timeline.paceRatio.toFixed(2)}x`
                    : "—"}
                </strong>
              </div>
              <div>
                <span>Projected at end</span>
                <strong>{timeline.projectedUsageAtEnd ?? 0} uses</strong>
              </div>
            </div>
            <div className="mkp-ar-progress-stack">
              <ProgressBar
                percent={timeline.timeProgressPercent}
                label="Time elapsed"
                tone="blue"
              />
              <ProgressBar
                percent={timeline.usageProgressPercent}
                label="Usage cap consumed"
                tone="amber"
              />
            </div>
          </div>
        </section>

        <section className="mkp-ar-section">
          <div className="mkp-ar-section-head">
            <TrendingUp size={18} />
            <h2>Financial Impact Analysis</h2>
          </div>
          <table className="mkp-report-table mkp-ar-fin-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Value</th>
                <th>Analyst Note</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Gross revenue (pre-discount view)</td>
                <td className="mkp-report-money">
                  {formatPromotionSar(financial.grossRevenue)}
                </td>
                <td>Total invoice value including promotional discount</td>
              </tr>
              <tr>
                <td>Net revenue (post-promotion)</td>
                <td className="mkp-report-money">
                  {formatPromotionSar(financial.totalRevenue)}
                </td>
                <td>What the business collected after discount</td>
              </tr>
              <tr>
                <td>Promotional cost (discount given)</td>
                <td className="mkp-report-money discount">
                  {formatPromotionSar(financial.totalDiscount)}
                </td>
                <td>Direct marketing spend on this campaign</td>
              </tr>
              <tr>
                <td>Trigger sales (A)</td>
                <td>{formatPromotionSar(financial.triggerSalesTotal)}</td>
                <td>Qualifying purchase lines that triggered the offer</td>
              </tr>
              <tr>
                <td>Reward value (B)</td>
                <td>{formatPromotionSar(financial.rewardValueTotal)}</td>
                <td>Free or discounted reward lines before promo discount</td>
              </tr>
              <tr>
                <td>HQ payable (2215)</td>
                <td className="mkp-report-money payable">
                  {formatPromotionSar(financial.payableTotal)}
                </td>
                <td>Settlement liability to workshops / HQ accounts</td>
              </tr>
              <tr>
                <td>Net difference (A vs B economics)</td>
                <td>{formatPromotionSar(financial.netDifference)}</td>
                <td>Sale vs reward economics gap</td>
              </tr>
              <tr>
                <td>Average order value</td>
                <td>{formatPromotionSar(financial.avgOrderValue)}</td>
                <td>Revenue per redemption — basket depth indicator</td>
              </tr>
              <tr>
                <td>Avg discount per redemption</td>
                <td>{formatPromotionSar(financial.avgDiscountPerRedemption)}</td>
                <td>Cost efficiency per transaction</td>
              </tr>
              <tr>
                <td>Discount rate</td>
                <td>
                  {financial.discountRate != null
                    ? `${financial.discountRate.toFixed(1)}%`
                    : "—"}
                </td>
                <td>Discount as % of gross revenue</td>
              </tr>
              <tr>
                <td>Net ROI</td>
                <td>
                  {financial.roi != null ? `${financial.roi.toFixed(2)}x` : "—"}
                </td>
                <td>(Net revenue − discount) ÷ discount</td>
              </tr>
              <tr>
                <td>Cost per unique customer</td>
                <td>{formatPromotionSar(financial.costPerCustomer)}</td>
                <td>Promotional spend per distinct customer reached</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="mkp-ar-section">
          <div className="mkp-ar-section-head">
            <Target size={18} />
            <h2>Configuration vs Actual Performance</h2>
          </div>
          <p className="mkp-ar-section-intro">
            Each row compares what was configured at promotion setup against
            observed results — the basis for explainable, decision-ready analysis.
          </p>
          <table className="mkp-report-table">
            <thead>
              <tr>
                <th>Dimension</th>
                <th>Configured</th>
                <th>Actual</th>
                <th>Variance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {analytics.configVsActual?.map((row) => (
                <tr key={row.dimension}>
                  <td>{row.dimension}</td>
                  <td>{row.configured}</td>
                  <td>{row.actual}</td>
                  <td>{row.variance}</td>
                  <td><StatusPill status={row.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {branches.length > 0 ? (
          <section className="mkp-ar-section">
            <div className="mkp-ar-section-head">
              <Building2 size={18} />
              <h2>Branch / Workshop Performance</h2>
            </div>
            <table className="mkp-report-table">
              <thead>
                <tr>
                  <th>Branch</th>
                  <th>Workshop</th>
                  <th>Redemptions</th>
                  <th>Trigger Sales (A)</th>
                  <th>Reward Value (B)</th>
                  <th>Discount</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {branches.map((branch) => (
                  <tr key={branch.branchId || branch.id}>
                    <td>{branch.branchName || branch.name || "—"}</td>
                    <td>{branch.workshopName || "—"}</td>
                    <td>{branch.redemptionCount ?? branch.orderCount ?? 0}</td>
                    <td>{formatPromotionSar(branch.triggerSalesTotal)}</td>
                    <td>{formatPromotionSar(branch.rewardValueTotal)}</td>
                    <td className="mkp-report-money discount">
                      {formatPromotionSar(branch.promoDiscountTotal)}
                    </td>
                    <td className="mkp-report-money">
                      {formatPromotionSar(branch.revenueTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        {items.length > 0 ? (
          <section className="mkp-ar-section">
            <div className="mkp-ar-section-head">
              <Package size={18} />
              <h2>Product & Service Line Analysis</h2>
            </div>
            <table className="mkp-report-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Role</th>
                  <th>Type</th>
                  <th>Lines</th>
                  <th>Qty</th>
                  <th>Sale Value</th>
                  <th>Reward Value</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={`${item.itemId}-${item.role}`}>
                    <td>{item.itemName || "—"}</td>
                    <td>
                      <StatusPill
                        status={
                          item.role === "trigger" ? "ok" : item.role === "reward" ? "warning" : "scheduled"
                        }
                      />
                      {item.role}
                    </td>
                    <td>{item.itemType || "—"}</td>
                    <td>{item.lineCount ?? 0}</td>
                    <td>{item.totalQty ?? 0}</td>
                    <td>{formatPromotionSar(item.saleValue)}</td>
                    <td>{formatPromotionSar(item.rewardValueBefore)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        {topCustomers.length > 0 ? (
          <section className="mkp-ar-section">
            <div className="mkp-ar-section-head">
              <Users size={18} />
              <h2>Customer Impact (Top 5)</h2>
            </div>
            <table className="mkp-report-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Mobile</th>
                  <th>Orders</th>
                  <th>Discount</th>
                  <th>Revenue</th>
                  <th>Last Redemption</th>
                </tr>
              </thead>
              <tbody>
                {topCustomers.map((customer) => (
                  <tr key={customer.customerId || customer.customerName}>
                    <td>{customer.customerName || "—"}</td>
                    <td>{customer.customerMobile || "—"}</td>
                    <td>{customer.orderCount ?? 0}</td>
                    <td className="mkp-report-money discount">
                      {formatPromotionSar(customer.totalDiscount)}
                    </td>
                    <td className="mkp-report-money">
                      {formatPromotionSar(customer.totalRevenue)}
                    </td>
                    <td>{formatShortDate(customer.lastRedeemedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        {analytics.insights?.length > 0 ? (
          <section className="mkp-ar-section">
            <div className="mkp-ar-section-head">
              <Lightbulb size={18} />
              <h2>Key Insights</h2>
            </div>
            <div className="mkp-ar-insight-grid">
              {analytics.insights.map((insight) => (
                <div
                  key={insight.title}
                  className={`mkp-ar-insight-card type-${insight.type}`}
                >
                  <strong>{insight.title}</strong>
                  <p>{insight.detail}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {analytics.recommendations?.length > 0 ? (
          <section className="mkp-ar-section">
            <div className="mkp-ar-section-head">
              <Target size={18} />
              <h2>Strategic Recommendations</h2>
            </div>
            <ol className="mkp-ar-recommendations">
              {analytics.recommendations.map((rec, index) => (
                <li key={rec.action}>
                  <div className="mkp-ar-rec-head">
                    <span className="mkp-ar-rec-num">{index + 1}</span>
                    <strong>{rec.action}</strong>
                    <PriorityBadge priority={rec.priority} />
                  </div>
                  <p>{rec.rationale}</p>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {analytics.risks?.length > 0 ? (
          <section className="mkp-ar-section mkp-ar-risks">
            <div className="mkp-ar-section-head">
              <ShieldAlert size={18} />
              <h2>Risks & Watchlist</h2>
            </div>
            <div className="mkp-ar-risk-list">
              {analytics.risks.map((risk) => (
                <div key={risk.title} className="mkp-ar-risk-item">
                  <PriorityBadge priority={risk.severity} />
                  <div>
                    <strong>{risk.title}</strong>
                    <p>{risk.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mkp-ar-section mkp-ar-appendix">
          <div className="mkp-ar-section-head">
            <FileText size={18} />
            <h2>Appendix — Promotion Configuration (Form Snapshot)</h2>
          </div>
          <p className="mkp-ar-section-intro">
            Full record of settings defined when the promotion was created.
            Targeting coverage: {analytics.targetingCoverage?.branchesConfigured ?? 0}{" "}
            branch(es) configured, {analytics.targetingCoverage?.branchesWithActivity ?? 0}{" "}
            with activity · {analytics.targetingCoverage?.triggerItemsConfigured ?? 0}{" "}
            trigger item(s) · {analytics.targetingCoverage?.rewardItemsConfigured ?? 0}{" "}
            reward item(s).
          </p>

          {sections.map((section) => (
            <div key={section.title} className="mkp-ar-appendix-block">
              <h3>{section.title}</h3>
              <table className="mkp-report-table mkp-auto-config-table">
                <tbody>
                  {section.fields?.map((field) => (
                    <tr key={field.label}>
                      <th>{field.label}</th>
                      <td>{field.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          {targeting ? (
            <div className="mkp-auto-targeting-grid">
              {targeting.triggerItems?.length ? (
                <div className="mkp-auto-targeting-card">
                  <h3>Trigger Items</h3>
                  <ul>
                    {targeting.triggerItems.map((item) => (
                      <li key={item.id}>
                        {item.name}
                        <span className="mkp-auto-item-type">{item.type}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {targeting.rewardItems?.length ? (
                <div className="mkp-auto-targeting-card">
                  <h3>Reward Items</h3>
                  <ul>
                    {targeting.rewardItems.map((item) => (
                      <li key={item.id}>
                        {item.name}
                        <span className="mkp-auto-item-type">{item.type}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {targeting.targetBranches?.length ? (
                <div className="mkp-auto-targeting-card">
                  <h3>Target Branches</h3>
                  <ul>
                    {targeting.targetBranches.map((branch) => (
                      <li key={branch.id}>
                        {branch.name}
                        {branch.workshopName ? (
                          <span className="mkp-auto-item-type">
                            {branch.workshopName}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        <footer className="mkp-ar-footer">
          <p>
            Auto Report · Marketing & Care Portal · Confidential internal use
          </p>
          <p>Data reflects promotion configuration and redemption records at time of generation.</p>
        </footer>
      </article>
    </div>
  );
}
