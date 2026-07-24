import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Target,
  Lightbulb,
  BarChart3,
  Tag,
} from 'lucide-react';
import { marketingGetPromoCodeAutoReport } from '../../services/superAdminMarketingApi';
import { marketingSectionPath } from './marketingRouteUtils';
import {
  formatPromoCodeSar,
  mapDiscountTypeToUi,
  normalizePromoCode,
} from './promoCodeShared';
import './MarketingUniversal.css';

function formatGeneratedAt(value) {
  if (!value) return new Date().toLocaleString();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toLocaleString();
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function HealthBadge({ score }) {
  let tone = 'mid';
  if (score >= 80) tone = 'high';
  else if (score < 45) tone = 'low';

  return (
    <span className={`mkp-ar-health-badge tone-${tone}`}>
      Health {Math.round(score)}/100
    </span>
  );
}

export default function MarketingPromoCodeAutoReportPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const listPath = marketingSectionPath(location.pathname, 'promo-codes');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [promoCode, setPromoCode] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [generatedAt, setGeneratedAt] = useState('');

  const loadReport = async () => {
    try {
      setLoading(true);
      setError('');

      const data = await marketingGetPromoCodeAutoReport(id);
      const code = data?.promoCode || data?.data?.promoCode || null;

      setPromoCode(code ? normalizePromoCode(code) : null);
      setAnalytics(data?.analytics || data?.data?.analytics || null);
      setGeneratedAt(data?.generatedAt || new Date().toISOString());
    } catch (err) {
      setError(err?.message || 'Could not load promo code auto report.');
      setPromoCode(null);
      setAnalytics(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [id]);

  const recommendations = useMemo(
    () => analytics?.recommendations || [],
    [analytics]
  );

  if (loading) {
    return (
      <div className="mkp-page mkp-report-loading">
        <Loader2 size={32} className="mkp-spin" />
        <div>Generating auto report...</div>
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
    <div className="mkp-page mkp-promotion-report-page mkp-auto-report-page">
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

      <div className="mkp-ar-hero">
        <div className="mkp-ar-hero-left">
          <div className="mkp-ar-hero-icon">
            <Sparkles size={22} />
          </div>
          <div>
            <h1>Auto Report · {promoCode.code}</h1>
            <p>
              {promoCode.promotion || 'Standalone promo code'} •{' '}
              {mapDiscountTypeToUi(promoCode.discountType)} • {promoCode.discountValue}
            </p>
            <span className="mkp-ar-generated">
              Generated {formatGeneratedAt(generatedAt)}
            </span>
          </div>
        </div>
        {analytics?.healthScore != null ? (
          <HealthBadge score={analytics.healthScore} />
        ) : null}
      </div>

      <div className="mkp-ar-summary-card">
        <TrendingUp size={18} />
        <p>{analytics?.executiveSummary || 'No summary available.'}</p>
      </div>

      <div className="mkp-ar-kpi-grid">
        {(analytics?.kpis || []).map((kpi) => (
          <div key={kpi.label} className="mkp-ar-kpi-card">
            <span>{kpi.label}</span>
            <strong>{kpi.value}</strong>
            <small>{kpi.hint}</small>
          </div>
        ))}
      </div>

      <div className="mkp-ar-grid-two">
        <div className="mkp-ar-panel">
          <div className="mkp-ar-panel-head">
            <Target size={16} />
            Performance snapshot
          </div>
          <ul className="mkp-ar-metric-list">
            <li>
              <span>Avg order value</span>
              <strong>{formatPromoCodeSar(analytics?.avgOrderValue)}</strong>
            </li>
            <li>
              <span>Avg discount / order</span>
              <strong>{formatPromoCodeSar(analytics?.avgDiscount)}</strong>
            </li>
            <li>
              <span>Discount rate</span>
              <strong>{analytics?.discountRate ?? 0}%</strong>
            </li>
            <li>
              <span>Top branch</span>
              <strong>{analytics?.topBranchName || '—'}</strong>
            </li>
          </ul>
        </div>

        <div className="mkp-ar-panel">
          <div className="mkp-ar-panel-head">
            <BarChart3 size={16} />
            Usage progress
          </div>
          <div className="mkp-ar-progress">
            <div className="mkp-ar-progress-head">
              <span>Limit used</span>
              <strong>
                {analytics?.usagePercent != null
                  ? `${analytics.usagePercent}%`
                  : 'Unlimited'}
              </strong>
            </div>
            <div className="mkp-ar-progress-track">
              <div
                className="mkp-ar-progress-fill tone-amber"
                style={{
                  width: `${Math.min(100, analytics?.usagePercent ?? 0)}%`,
                }}
              />
            </div>
          </div>
          <div className="mkp-ar-status-row">
            <Tag size={14} />
            Status: {promoCode.status} • POS: {promoCode.isActive ? 'Active' : 'Inactive'}
          </div>
        </div>
      </div>

      {recommendations.length > 0 ? (
        <div className="mkp-ar-panel">
          <div className="mkp-ar-panel-head">
            <Lightbulb size={16} />
            Recommendations
          </div>
          <ul className="mkp-ar-recommendations">
            {recommendations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
