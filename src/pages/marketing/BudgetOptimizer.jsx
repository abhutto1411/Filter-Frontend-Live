import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  AlertTriangle,
  Bell,
  Bot,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import {
  marketingApplyBudgetOptimizer,
  marketingGetBudgetOptimizer,
  marketingGetBudgetOptimizerInsights,
  marketingOptimizeBudget,
} from '../../services/superAdminMarketingApi';
import { boT } from '../../utils/budgetOptimizerI18n';
import '../../styles/ui.css';

const emptySummary = {
  walletBalance: 0,
  availableBalance: 0,
  totalBudgetAllocated: 0,
  totalBudget: 0,
  totalSpent: 0,
  totalSpend: 0,
  totalRevenue: 0,
  totalLeads: 0,
  totalConversions: 0,
  overallRoi: 0,
  budgetUtilized: 0,
  costPerLead: 0,
  campaignsCount: 0,
};

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatSar(value, locale = 'en', currencyLabel = 'SAR') {
  const numberLocale = locale === 'ar' ? 'ar-SA' : undefined;
  return `${toNumber(value).toLocaleString(numberLocale, {
    maximumFractionDigits: 0,
  })} ${currencyLabel}`;
}

function formatPercent(value, locale = 'en') {
  const numberLocale = locale === 'ar' ? 'ar-SA' : undefined;
  return `${toNumber(value).toLocaleString(numberLocale, {
    maximumFractionDigits: 1,
  })}%`;
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

function localizeToken(t, prefix, value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  const key = `${prefix}.${raw}`;
  const translated = t(key);
  if (translated !== key) return translated;
  return humanize(value);
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
  const source = root.summary || {};
  const wallet = root.wallet || {};

  const walletBalance = toNumber(
    source.walletBalance ??
      source.availableBalance ??
      wallet.balance ??
      wallet.availableBalance,
  );

  const totalSpent = toNumber(
    source.totalSpent ??
      source.totalSpend ??
      source.spent,
  );

  const totalBudgetAllocated = toNumber(
    source.totalBudgetAllocated ??
      source.totalBudget ??
      source.budgetAllocated,
  );

  return {
    walletBalance,
    availableBalance: walletBalance,
    totalBudgetAllocated,
    totalBudget: totalBudgetAllocated,
    totalSpent,
    totalSpend: totalSpent,
    totalRevenue: toNumber(source.totalRevenue ?? source.revenue),
    totalLeads: toNumber(source.totalLeads ?? source.leads),
    totalConversions: toNumber(source.totalConversions ?? source.conversions),
    overallRoi: toNumber(source.overallRoi ?? source.roi),
    budgetUtilized: toNumber(source.budgetUtilized),
    costPerLead: toNumber(source.costPerLead),
    campaignsCount: toNumber(
      source.campaignsCount ??
        root.meta?.totalCampaigns ??
        asArray(root, ['campaigns']).length,
    ),
  };
}

function normalizeWarning(item, summary, t) {
  const type = item?.type || 'warning';
  const isWalletLow = type === 'wallet_low';

  return {
    type,
    title: item?.title || humanize(type),
    message: isWalletLow
      ? t('warn.walletLow', {
          balance: Math.round(toNumber(summary.walletBalance)),
        })
      : item?.message || '',
    severity: isWalletLow ? 'critical' : item?.severity || 'warning',
  };
}

function extractWarnings(payload, summary, t) {
  const root = payload?.data || payload || {};
  return asArray(root, ['warnings', 'alerts']).map((item) =>
    normalizeWarning(item, summary, t),
  );
}

function normalizeRecommendation(item, totalBudget = 0, t) {
  const recommendedBudget = toNumber(
    item?.recommendedBudget ??
      item?.amount ??
      item?.recommendedAmount,
  );

  const percentage =
    totalBudget > 0
      ? Math.round((recommendedBudget / totalBudget) * 10000) / 100
      : toNumber(item?.percentage);

  return {
    campaignId: item?.campaignId || item?.id || '',
    campaignName:
      item?.campaignName ||
      item?.name ||
      item?.channel ||
      (item?.platform ? humanize(item.platform) : t('rec.defaultCampaign')),
    platform: item?.platform || 'unknown',
    percentage,
    amount: recommendedBudget,
    currentBudget: toNumber(item?.currentBudget),
    currentSpent: toNumber(item?.currentSpent ?? item?.spent),
    revenue: toNumber(item?.revenue),
    roi: toNumber(item?.roi),
    leads: toNumber(item?.leads ?? item?.leadsCount),
    action: item?.action || 'keep',
    reason:
      item?.reason ||
      item?.recommendation ||
      t('rec.defaultReason'),
  };
}

function extractRecommendations(payload, totalBudget = 0, t) {
  const root = payload?.data || payload || {};

  return asArray(root, [
    'optimizedBudgets',
    'recommendations',
    'campaigns',
  ]).map((item) => normalizeRecommendation(item, totalBudget, t));
}

const STAT_TONE = { dark: '', red: 'dang', green: 'ok' };

const StatCard = ({ title, value, label, tone = 'dark' }) => {
  const mapped = STAT_TONE[tone] ?? '';
  return (
    <div className={`ui-metric${mapped ? ` ui-metric--${mapped}` : ''}`}>
      <div className="ui-metric-label">{title}</div>
      <div className="ui-metric-value">{value}</div>
      {label ? <div className="ui-metric-foot">{label}</div> : null}
    </div>
  );
};

const SEVERITY_TONE = { critical: 'dang', high: 'dang', warning: 'warn', info: 'info' };

const WarningBanner = ({ warning, onClose, t }) => (
  <div className={`ui-banner ui-banner--${SEVERITY_TONE[warning.severity] || 'warn'}`}>
    <AlertTriangle size={14} />
    <span>
      <strong>{warning.title}</strong>
      {' \u00b7 '}
      {localizeToken(t, 'severity', warning.severity)}
      {' \u2014 '}
      {warning.message}
    </span>
    <button
      type="button"
      className="ui-banner-x"
      onClick={onClose}
      aria-label={t('btn.dismiss')}
    >
      <X size={14} />
    </button>
  </div>
);

const RecommendationCard = ({ item, t, locale, currencyLabel }) => {
  const share = Math.min(100, Math.max(0, toNumber(item.percentage)));
  return (
    <section className="ui-panel">
      <div className="ui-panel-head">
        <div>
          <div className="ui-panel-title">{item.campaignName}</div>
          <div className="ui-help">
            {localizeToken(t, 'platform', item.platform)} ·{' '}
            {localizeToken(t, 'action', item.action)}
          </div>
        </div>
        <strong className="ui-panel-end">{formatPercent(item.percentage, locale)}</strong>
      </div>

      <div className="ui-panel-pad ui-stack-sm">
        {/* The share of the budget this campaign is being given. */}
        <div
          className="ui-bar"
          role="img"
          aria-label={formatPercent(item.percentage, locale)}
        >
          <div className="ui-bar-fill ui-bar-fill--info" style={{ width: `${share}%` }} />
        </div>

        <div className="ui-fields">
          <div className="ui-fieldro">
            <span className="ui-fieldro-label">{t('rec.recommended')}</span>
            <span className="ui-fieldro-value">
              {formatSar(item.amount, locale, currencyLabel)}
            </span>
          </div>
          <div className="ui-fieldro">
            <span className="ui-fieldro-label">{t('rec.roi')}</span>
            <span className="ui-fieldro-value">{formatPercent(item.roi, locale)}</span>
          </div>
          <div className="ui-fieldro">
            <span className="ui-fieldro-label">{t('rec.leads')}</span>
            <span className="ui-fieldro-value">{item.leads}</span>
          </div>
        </div>

        <p className="ui-help">{item.reason}</p>
      </div>
    </section>
  );
};

export const BudgetOptimizer = () => {
  const ctx = useOutletContext() || {};
  const locale =
    ctx.locale ||
    (typeof localStorage !== 'undefined'
      ? localStorage.getItem('portal-locale')
      : null) ||
    (typeof localStorage !== 'undefined'
      ? localStorage.getItem('marketing-locale')
      : null) ||
    'en';
  const t = useCallback((key, vars) => boT(locale, key, vars), [locale]);
  const currencyLabel = t('currency.sar');

  const [summary, setSummary] = useState(emptySummary);
  const [recommendations, setRecommendations] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [dismissedWarnings, setDismissedWarnings] = useState([]);
  const [budget, setBudget] = useState('');

  const [loading, setLoading] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [error, setError] = useState('');

  const [insights, setInsights] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  // The one success message; the rest went into `error`.
  const [notice, setNotice] = useState('');

  const effectiveBudget = useMemo(() => {
    const typed = toNumber(budget);
    if (typed > 0) return typed;
    return toNumber(summary.walletBalance);
  }, [budget, summary.walletBalance]);

  const visibleWarnings = useMemo(
    () =>
      warnings.filter(
        (warning, index) => !dismissedWarnings.includes(`${warning.type}-${index}`),
      ),
    [warnings, dismissedWarnings],
  );

  const loadOptimizer = async () => {
    try {
      setLoading(true);
      setError('');

      const res = await marketingGetBudgetOptimizer({
        status: 'all',
        limit: 100,
        offset: 0,
      });

      const nextSummary = normalizeSummary(res);
      const nextWarnings = extractWarnings(res, nextSummary, t);
      const nextRecommendations = extractRecommendations(
        res,
        nextSummary.walletBalance || nextSummary.totalBudgetAllocated,
        t,
      );

      setSummary(nextSummary);
      setWarnings(nextWarnings);
      setRecommendations(nextRecommendations);
      setDismissedWarnings([]);

      if (nextSummary.walletBalance > 0 && !budget) {
        setBudget(String(Math.round(nextSummary.walletBalance)));
      }
    } catch (err) {
      setError(err?.message || t('error.load'));
      setSummary(emptySummary);
      setWarnings([]);
      setRecommendations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOptimizer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOptimize = async () => {
    const value = toNumber(effectiveBudget);

    if (value <= 0) {
      setError(t('error.invalidBudget'));
      return;
    }

    try {
      setOptimizing(true);
      setError('');

      const res = await marketingOptimizeBudget({
        totalBudget: value,
        strategy: 'balanced',
        applyChanges: false,
      });

      const optimizedRecommendations = extractRecommendations(res, value, t);

      setRecommendations(optimizedRecommendations);
    } catch (err) {
      setError(err?.message || t('error.optimize'));
    } finally {
      setOptimizing(false);
    }
  };

  const handleManageAlerts = () => {
    setDismissedWarnings([]);
  };

  const loadInsights = async () => {
    try {
      setInsightsLoading(true);
      setError('');

      const res = await marketingGetBudgetOptimizerInsights({ status: 'all' });
      setInsights(res || null);
    } catch (err) {
      setError(err?.message || t('error.insights'));
    } finally {
      setInsightsLoading(false);
    }
  };

  const handleApplyInsights = async () => {
    const items = asArray(insights?.recommendations)
      .filter((rec) => toNumber(rec.suggestedBudget) >= 0 && rec.campaignId)
      .map((rec) => ({
        campaignId: rec.campaignId,
        suggestedBudget: toNumber(rec.suggestedBudget),
      }));

    if (items.length === 0) {
      setError(t('error.noRecommendations'));
      return;
    }

    const confirmMsg =
      items.length === 1
        ? t('confirm.applyOne')
        : t('confirm.applyMany', { n: items.length });

    if (!window.confirm(confirmMsg)) {
      return;
    }

    try {
      setApplying(true);
      setError('');
      setNotice('');
      await marketingApplyBudgetOptimizer({ items });
      await loadOptimizer();
      await loadInsights();
      setNotice(t('success.applied'));
    } catch (err) {
      setError(err?.message || t('error.apply'));
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="ui-root ui-root--flush ui-stack">
      {visibleWarnings.map((warning, index) => (
        <WarningBanner
          key={`${warning.type}-${index}`}
          warning={warning}
          t={t}
          onClose={() =>
            setDismissedWarnings((prev) => [...prev, `${warning.type}-${index}`])
          }
        />
      ))}

      <section className="ui-panel">
        <div className="ui-panel-head">
          <Zap size={15} />
          <span className="ui-panel-title">{t('title')}</span>

          <div className="ui-panel-end">
            <button
              type="button"
              className="ui-btn ui-btn--default ui-btn--sm"
              onClick={handleManageAlerts}
              disabled={dismissedWarnings.length === 0}
            >
              <Bell size={13} />
              {t('btn.manageAlerts')}
              <span className="ui-tab-count">{warnings.length}</span>
            </button>
          </div>
        </div>

        <div className="ui-panel-pad ui-stack-sm">
          {error ? (
            <div className="ui-banner ui-banner--dang" role="alert">
              <AlertTriangle size={14} />
              <span>{error}</span>
            </div>
          ) : null}

          {notice ? (
            <div className="ui-banner ui-banner--ok" role="status">
              <Sparkles size={14} />
              <span>{notice}</span>
            </div>
          ) : null}

          <div className="ui-kpis">
          <StatCard
            title={t('kpi.wallet')}
            value={formatSar(summary.walletBalance, locale, currencyLabel)}
            label=""
            tone={summary.walletBalance <= 0 ? 'red' : 'dark'}
          />

          <StatCard
            title={t('kpi.overallRoi')}
            value={formatPercent(summary.overallRoi, locale)}
            label=""
            tone={summary.overallRoi < 0 ? 'red' : 'green'}
          />

          <StatCard
            title={t('kpi.budgetUtilized')}
            value={formatPercent(summary.budgetUtilized, locale)}
            label=""
            tone="dark"
          />

          <StatCard
            title={t('kpi.costPerLead')}
            value={formatSar(summary.costPerLead, locale, currencyLabel)}
            label=""
            tone="dark"
          />
          </div>

          <div className="ui-row ui-row--fields">
            <div className="ui-field ui-field--grow">
              <label htmlFor="bo-budget">{t('label.totalBudget')}</label>
              <input
                id="bo-budget"
                type="number"
                min="0"
                className="ui-input ui-input--figure"
                value={budget}
                onChange={(event) => setBudget(event.target.value)}
                placeholder={t('placeholder.budget', {
                  amount: Math.round(summary.walletBalance || 0),
                })}
              />
            </div>

            <div className="ui-toolbar-end">
              <button
                type="button"
                className="ui-btn ui-btn--default ui-btn--icon"
                onClick={loadOptimizer}
                disabled={loading}
                title={t('btn.refresh')}
                aria-label={t('btn.refresh')}
              >
                <RefreshCw size={14} className={loading ? 'ui-spin' : ''} />
              </button>

              <button
                type="button"
                className="ui-btn ui-btn--primary"
                onClick={handleOptimize}
                disabled={optimizing || loading}
              >
                <Sparkles size={14} />
                {optimizing ? t('btn.optimizing') : t('btn.optimize')}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="ui-panel">
        <div className="ui-panel-head">
          <Bot size={15} />
          <span className="ui-panel-title">
            {insights?.llmUsed ? t('ai.titleLlm') : t('ai.title')}
          </span>

          <div className="ui-panel-end ui-rowacts">
            <button
              type="button"
              className="ui-btn ui-btn--default ui-btn--sm"
              onClick={loadInsights}
              disabled={insightsLoading}
            >
              {insightsLoading
                ? <Loader2 size={13} className="ui-spin" />
                : <Sparkles size={13} />}
              {insightsLoading ? t('btn.analyzing') : t('btn.generateInsights')}
            </button>

            {insights?.recommendations?.length ? (
              <button
                type="button"
                className="ui-btn ui-btn--primary ui-btn--sm"
                onClick={handleApplyInsights}
                disabled={applying}
              >
                {applying ? <Loader2 size={13} className="ui-spin" /> : null}
                {applying ? t('btn.applying') : t('btn.applyRecommendations')}
              </button>
            ) : null}
          </div>
        </div>

        {insights ? (
          <div className="ui-panel-pad ui-stack-sm">
            <div className="ui-row">
              <div className="ui-metric">
                <div className="ui-metric-label">{t('ai.performanceScore')}</div>
                <div className="ui-metric-value">
                  {toNumber(insights.performanceScore).toFixed(0)}
                </div>
              </div>
              <p className="ui-help ui-field--grow">{insights.assessment}</p>
            </div>

            {asArray(insights.alerts).map((item, index) => (
              <div
                key={`${item.type}-${index}`}
                className={`ui-banner ui-banner--${SEVERITY_TONE[item.severity] || 'warn'}`}
              >
                <AlertTriangle size={14} />
                <span>
                  <strong>{item.title || humanize(item.type)}</strong>
                  {' \u2014 '}
                  {item.message}
                </span>
              </div>
            ))}

            {asArray(insights.recommendations).length > 0 ? (
              <ul className="ui-list">
                {asArray(insights.recommendations).map((rec, index) => (
                  <li className="ui-list-row" key={`${rec.campaignId}-${index}`}>
                    <div className="ui-list-main">
                      <span className="ui-list-title">
                        {rec.campaignName}{' '}
                        <span className="ui-pill ui-pill--info">
                          {localizeToken(t, 'action', rec.action)}
                        </span>
                      </span>
                      <span className="ui-list-meta">{rec.rationale}</span>
                    </div>
                    <div className="ui-list-end ui-list-amount">
                      {formatSar(rec.currentBudget, locale, currencyLabel)}
                      {' \u2192 '}
                      <strong>
                        {formatSar(rec.suggestedBudget, locale, currencyLabel)}
                      </strong>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <div className="ui-empty">
            <div className="ui-empty-icon"><Bot size={18} /></div>
            <div className="ui-empty-title">{t('ai.empty')}</div>
          </div>
        )}
      </section>

      {recommendations.length > 0 ? (
        <section className="ui-stack">
          <div className="ui-row">
            <div className="ui-head">
              <h1>{t('results.title')}</h1>
            </div>
            <div className="ui-toolbar-end">
              <span className="ui-pill ui-pill--neutral">
                {t('results.count', { n: recommendations.length })}
              </span>
            </div>
          </div>

          <div className="ui-panels">
            {recommendations.map((item) => (
              <RecommendationCard
                key={`${item.campaignId}-${item.platform}-${item.campaignName}`}
                item={item}
                t={t}
                locale={locale}
                currencyLabel={currencyLabel}
              />
            ))}
          </div>
        </section>
      ) : null}

    </div>
  );
};

export default BudgetOptimizer;