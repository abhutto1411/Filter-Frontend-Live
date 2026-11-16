import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import {
  AlertTriangle,
  Star,
  DollarSign,
  TrendingUp,
  Search,
  Plus,
  Pencil,
  Trash2,
} from 'lucide-react';
import {
  marketingDeleteReferrer,
  marketingListReferrers,
} from '../../services/superAdminMarketingApi';
import {
  mktInfFormatSar,
  mktInfPlatformLabel,
  mktInfStatusLabel,
  mktInfT,
} from '../../utils/marketingInfluencersI18n';
import { marketingSectionPath } from './marketingRouteUtils';
import { platformOptions } from './influencerReferrerShared';
import UiPager from '../../components/UiPager';
import { usePagedRows } from '../../hooks/usePagedRows';
import '../../styles/ui.css';

function normalizeReferrer(row, locale) {
  const name =
    row.name ||
    row.fullName ||
    row.full_name ||
    row.referrerName ||
    row.referrer_name ||
    row.displayName ||
    mktInfT(locale, 'fallback.name');

  const commission =
    row.commission ||
    row.totalCommission ||
    row.total_commission ||
    row.commissionEarned ||
    row.commission_earned ||
    0;

  return {
    id: String(row.id || row._id || ''),
    name,
    email: row.email || '',
    phone: row.phone || row.mobile || row.phoneNumber || '',
    platform:
      row.platform ||
      row.socialPlatform ||
      row.social_platform ||
      row.channel ||
      'instagram',
    handle:
      row.handle ||
      row.socialHandle ||
      row.social_handle ||
      row.username ||
      '',
    commission: Number(commission || 0),
    commissionRate: Number(
      row.commissionRate ??
        row.commission_rate ??
        row.rate ??
        row.defaultCommissionRate ??
        0
    ),
    activeCampaigns: Number(
      row.activeCampaigns ??
        row.active_campaigns ??
        row.campaignsCount ??
        row.campaigns_count ??
        0
    ),
    status: row.status || 'active',
    notes: row.notes || '',
    type:
      row.type ||
      row.referrerType ||
      row.referrer_type ||
      row.category ||
      '',
  };
}

function extractReferrers(payload, locale) {
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.referrers)
      ? payload.referrers
      : Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload?.data?.referrers)
            ? payload.data.referrers
            : Array.isArray(payload?.data?.items)
              ? payload.data.items
              : [];

  return rows.map((row) => normalizeReferrer(row, locale));
}

const StatCard = (props) => {
  const { title, value, tone } = props;
  // Assigned rather than destructured: this eslint config has no React
  // plugin, so JSX use is not a reference and a destructured arg reads as
  // unused. `varsIgnorePattern: '^[A-Z_]'` covers a variable.
  const Icon = props.icon;
  return (
    <div className={`ui-metric${tone ? ` ui-metric--${tone}` : ''}`}>
      <Icon className="ui-metric-icon" size={58} strokeWidth={1.5} aria-hidden />
      <div className="ui-metric-label">{title}</div>
      <div className="ui-metric-value">{value}</div>
    </div>
  );
};

const STATUS_TONE = {
  active: 'ok',
  inactive: 'neutral',
  suspended: 'dang',
  pending: 'warn',
};

const StatusBadge = ({ status, locale }) => {
  const value = String(status || 'active').toLowerCase();
  return (
    <span className={`ui-pill ui-pill--${STATUS_TONE[value] || 'neutral'}`}>
      {mktInfStatusLabel(locale, value)}
    </span>
  );
};

export const InfluencerReferrers = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const outletCtx = useOutletContext() || {};
  const locale =
    outletCtx.locale ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('marketing-locale') : null) ||
    'en';
  const t = useCallback((key, vars) => mktInfT(locale, key, vars), [locale]);
  const listPath = marketingSectionPath(location.pathname, 'influencer-referrers');

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [influencers, setInfluencers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  /**
   * Searched by the server, paged in the browser.
   *
   * The search used to run twice — once as a query parameter, then again over
   * the same rows in JS — and only reached the server when Enter was pressed,
   * so typing narrowed just what had already arrived.
   *
   * The paging stays client-side because the list below is narrowed again by
   * referrer type, and the API has no type filter: paging on the server would
   * hand back pages that this filter then punches holes in, and a `total` that
   * no longer matches what is on screen. The request asks for the endpoint's
   * own maximum (500); past that, search is how you reach a referrer.
   */
  const loadInfluencers = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const res = await marketingListReferrers({
        limit: 500,
        offset: 0,
        status: 'all',
        search: debouncedSearch || undefined,
      });

      const rows = extractReferrers(res, locale);

      const influencerRows = rows.filter((item) => {
        const typeText = String(item.type || '').toLowerCase();
        const platformText = String(item.platform || '').toLowerCase();

        if (!typeText) return true;

        return (
          typeText.includes('influencer') ||
          typeText.includes('referrer') ||
          platformOptions.includes(platformText)
        );
      });

      setInfluencers(influencerRows);
    } catch (err) {
      setError(err?.message || t('err.load'));
      setInfluencers([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, locale, t]);

  useEffect(() => {
    void loadInfluencers();
  }, [loadInfluencers]);

  const { pagedRows, pagerProps } = usePagedRows(influencers, {
    resetKey: debouncedSearch,
  });

  const totalInfluencers = influencers.length;

  const totalCommissions = influencers.reduce(
    (sum, item) => sum + Number(item.commission || 0),
    0
  );

  const activeCampaigns = influencers.reduce(
    (sum, item) => sum + Number(item.activeCampaigns || 0),
    0
  );

  const openCreatePage = () => navigate(`${listPath}/new`);
  const openEditPage = (id) => navigate(`${listPath}/${id}/edit`);

  const handleDelete = async (item) => {
    if (!window.confirm(t('confirm.delete', { name: item.name }))) return;

    try {
      setError('');
      setActionLoadingId(item.id);
      await marketingDeleteReferrer(item.id);
      await loadInfluencers();
    } catch (err) {
      setError(err?.message || t('err.delete'));
    } finally {
      setActionLoadingId('');
    }
  };

  return (
    <div className="ui-root ui-root--flush ui-stack" dir={locale === 'ar' ? 'rtl' : undefined}>
      {error ? (
        <div className="ui-banner ui-banner--dang" role="alert">
          <AlertTriangle size={14} />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="ui-kpis">
        <StatCard
          icon={Star}
          title={t('stat.influencers')}
          value={totalInfluencers}
          tone="brand"
        />

        <StatCard
          icon={DollarSign}
          title={t('stat.commissions')}
          value={mktInfFormatSar(locale, totalCommissions)}
          tone="ok"
        />

        <StatCard
          icon={TrendingUp}
          title={t('stat.campaigns')}
          value={activeCampaigns}
          tone="info"
        />
      </div>

      <section className="ui-panel">
        <div className="ui-panel-head">
          <span className="ui-panel-title">{t('card.title')}</span>
        </div>

        <div className="ui-panel-pad ui-row ui-row--fields">
          <div className="ui-field ui-field--grow">
            <label htmlFor="inf-search">{t('search.label')}</label>
            <div className="ui-search">
              <Search size={15} />
              <input
                id="inf-search"
                type="text"
                className="ui-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('search.placeholder')}
              />
            </div>
          </div>

          <div className="ui-toolbar-end">
            <button
              type="button"
              className="ui-btn ui-btn--primary"
              onClick={openCreatePage}
            >
              <Plus size={15} /> {t('btn.add')}
            </button>
          </div>
        </div>

        <div className="ui-table-wrap ui-table-wrap--scroll ui-table-wrap--bare">
          <table className="ui-table">
            <thead>
              <tr>
                <th>{t('th.name')}</th>
                <th>{t('th.platform')}</th>
                <th>{t('th.handle')}</th>
                <th>{t('th.commission')}</th>
                <th>{t('th.rate')}</th>
                <th>{t('th.campaigns')}</th>
                <th>{t('th.status')}</th>
                <th>{t('th.actions')}</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={`sk-${i}`} className="ui-sk-row">
                    <td><div className="ui-sk ui-sk--strong ui-sk--w90" /></td>
                    <td><div className="ui-sk ui-sk--text ui-sk--w55" /></td>
                    <td><div className="ui-sk ui-sk--text ui-sk--w70" /></td>
                    <td><div className="ui-sk ui-sk--text ui-sk--w40" /></td>
                    <td><div className="ui-sk ui-sk--text ui-sk--w25" /></td>
                    <td><div className="ui-sk ui-sk--text ui-sk--w25" /></td>
                    <td><div className="ui-sk ui-sk--pill" /></td>
                    <td><div className="ui-sk ui-sk--btn" /></td>
                  </tr>
                ))
              ) : pagedRows.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="ui-empty">
                      <div className="ui-empty-icon"><Star size={18} /></div>
                      <div className="ui-empty-title">{t('empty.none')}</div>
                      <button
                        type="button"
                        className="ui-btn ui-btn--primary"
                        onClick={openCreatePage}
                      >
                        <Plus size={14} /> {t('btn.add')}
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                pagedRows.map((item) => {
                  const busy = actionLoadingId === item.id;

                  return (
                    <tr key={item.id}>
                      <td data-label={t('th.name')}>
                        <div className="ui-strong">{item.name}</div>
                        <div className="ui-meta">
                          {item.email || item.phone || t('dash')}
                        </div>
                      </td>

                      <td data-label={t('th.platform')}>
                        {mktInfPlatformLabel(locale, item.platform)}
                      </td>
                      <td data-label={t('th.handle')}>{item.handle || t('dash')}</td>
                      <td data-label={t('th.commission')} className="ui-num ui-money ui-money--in">
                        {mktInfFormatSar(locale, item.commission)}
                      </td>
                      <td data-label={t('th.rate')} className="ui-num">
                        {Number(item.commissionRate || 0)}%
                      </td>
                      <td data-label={t('th.campaigns')} className="ui-num">
                        {item.activeCampaigns}
                      </td>
                      <td data-label={t('th.status')}>
                        <StatusBadge status={item.status} locale={locale} />
                      </td>
                      <td data-label={t('th.actions')}>
                        <div className="ui-rowacts">
                          <button
                            type="button"
                            className="ui-btn ui-btn--default ui-btn--sm ui-btn--icon"
                            title={t('action.edit')}
                            aria-label={t('action.edit')}
                            disabled={busy}
                            onClick={() => openEditPage(item.id)}
                          >
                            <Pencil size={14} />
                          </button>

                          <button
                            type="button"
                            className="ui-btn ui-btn--danger ui-btn--sm ui-btn--icon"
                            title={t('action.delete')}
                            aria-label={t('action.delete')}
                            disabled={busy}
                            onClick={() => handleDelete(item)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          <UiPager {...pagerProps} />
        </div>
      </section>
    </div>
  );
};

export default InfluencerReferrers;
