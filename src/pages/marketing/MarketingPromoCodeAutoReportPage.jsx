import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom';
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
import { promoStatusLabel, promoT } from '../../utils/promoCodesI18n';
import { resolveMarketingLocale } from '../../utils/marketingPromotionsI18n';
import { marketingSectionPath } from './marketingRouteUtils';
import {
  formatPromoCodeSar,
  mapDiscountTypeToUi,
  normalizePromoCode,
} from './promoCodeShared';
import './MarketingUniversal.css';

function formatGeneratedAt(value, locale) {
  const opts = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };
  const loc = locale === 'ar' ? 'ar-SA' : undefined;
  if (!value) return new Date().toLocaleString(loc, opts);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toLocaleString(loc, opts);
  return date.toLocaleString(loc, opts);
}

function HealthBadge({ score, t }) {
  let tone = 'mid';
  if (score >= 80) tone = 'high';
  else if (score < 45) tone = 'low';

  return (
    <span className={`mkp-ar-health-badge tone-${tone}`}>
      {t('auto.health', { score: Math.round(score) })}
    </span>
  );
}

export default function MarketingPromoCodeAutoReportPage() {
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
  const [analytics, setAnalytics] = useState(null);
  const [generatedAt, setGeneratedAt] = useState('');

  const loadReport = async () => {
    try {
      setLoading(true);
      setError('');

      const data = await marketingGetPromoCodeAutoReport(id);
      const code = data?.promoCode || data?.data?.promoCode || null;

      setPromoCode(code ? normalizePromoCode(code, locale) : null);
      setAnalytics(data?.analytics || data?.data?.analytics || null);
      setGeneratedAt(data?.generatedAt || new Date().toISOString());
    } catch (err) {
      setError(err?.message || t('auto.errLoad'));
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
    [analytics],
  );

  if (loading) {
    return (
      <div className="mkp-page mkp-report-loading">
        <Loader2 size={32} className="mkp-spin" />
        <div>{t('auto.loading')}</div>
      </div>
    );
  }

  if (error || !promoCode) {
    return (
      <div className="mkp-page">
        <button type="button" className="mkp-back-btn" onClick={() => navigate(listPath)}>
          <ArrowLeft size={16} />
          {t('auto.back')}
        </button>
        <div className="mk-code-error-banner">{error || t('auto.notFound')}</div>
      </div>
    );
  }

  return (
    <div className="mkp-page mkp-promotion-report-page mkp-auto-report-page">
      <div className="mkp-report-topbar">
        <button type="button" className="mkp-back-btn" onClick={() => navigate(listPath)}>
          <ArrowLeft size={16} />
          {t('auto.back')}
        </button>
        <button type="button" className="mkp-icon-btn" onClick={loadReport}>
          <RefreshCw size={16} />
          {t('auto.refresh')}
        </button>
      </div>

      <div className="mkp-ar-hero">
        <div className="mkp-ar-hero-left">
          <div className="mkp-ar-hero-icon">
            <Sparkles size={22} />
          </div>
          <div>
            <h1>{t('auto.title', { code: promoCode.code })}</h1>
            <p>
              {promoCode.promotion || t('auto.standalone')} •{' '}
              {mapDiscountTypeToUi(promoCode.discountType, locale)} • {promoCode.discountValue}
            </p>
            <span className="mkp-ar-generated">
              {t('auto.generated', { date: formatGeneratedAt(generatedAt, locale) })}
            </span>
          </div>
        </div>
        {analytics?.healthScore != null ? (
          <HealthBadge score={analytics.healthScore} t={t} />
        ) : null}
      </div>

      <div className="mkp-ar-summary-card">
        <TrendingUp size={18} />
        <p>{analytics?.executiveSummary || t('auto.noSummary')}</p>
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
            {t('auto.performance')}
          </div>
          <ul className="mkp-ar-metric-list">
            <li>
              <span>{t('auto.avgOrder')}</span>
              <strong>{formatPromoCodeSar(analytics?.avgOrderValue, locale)}</strong>
            </li>
            <li>
              <span>{t('auto.avgDiscount')}</span>
              <strong>{formatPromoCodeSar(analytics?.avgDiscount, locale)}</strong>
            </li>
            <li>
              <span>{t('auto.discountRate')}</span>
              <strong>{analytics?.discountRate ?? 0}%</strong>
            </li>
            <li>
              <span>{t('auto.topBranch')}</span>
              <strong>{analytics?.topBranchName || '—'}</strong>
            </li>
          </ul>
        </div>

        <div className="mkp-ar-panel">
          <div className="mkp-ar-panel-head">
            <BarChart3 size={16} />
            {t('auto.usageProgress')}
          </div>
          <div className="mkp-ar-progress">
            <div className="mkp-ar-progress-head">
              <span>{t('auto.limitUsed')}</span>
              <strong>
                {analytics?.usagePercent != null
                  ? `${analytics.usagePercent}%`
                  : t('auto.unlimited')}
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
            {t('auto.statusRow', {
              status: promoStatusLabel(locale, promoCode.status),
              pos: promoCode.isActive ? t('auto.posActive') : t('auto.posInactive'),
            })}
          </div>
        </div>
      </div>

      {recommendations.length > 0 ? (
        <div className="mkp-ar-panel">
          <div className="mkp-ar-panel-head">
            <Lightbulb size={16} />
            {t('auto.recommendations')}
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
