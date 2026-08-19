import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import {
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
import './MarketingUniversal.css';

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

const StatCard = ({ icon, title, value, iconBg = '#F8FAFC', iconColor = '#D5AD27' }) => {
  return (
    <div className="mk-influencer-stat-card">
      <div className="mk-influencer-stat-icon" style={{ background: iconBg }}>
        {React.cloneElement(icon, {
          size: 18,
          color: iconColor,
          strokeWidth: 2,
        })}
      </div>

      <div>
        <div className="mk-influencer-stat-title">{title}</div>
        <div className="mk-influencer-stat-value">{value}</div>
      </div>
    </div>
  );
};

const StatusBadge = ({ status, locale }) => {
  const value = String(status || 'active').toLowerCase();

  const classNameMap = {
    active: 'mk-status-approved',
    inactive: 'mk-status-draft',
    suspended: 'mk-status-rejected',
    pending: 'mk-status-pending',
  };

  return (
    <span className={`mk-status ${classNameMap[value] || 'mk-status-draft'}`}>
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
  const [influencers, setInfluencers] = useState([]);

  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState('');
  const [error, setError] = useState('');

  const loadInfluencers = async () => {
    try {
      setLoading(true);
      setError('');

      const res = await marketingListReferrers({
        limit: 100,
        offset: 0,
        status: 'all',
        search: search.trim(),
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
  };

  useEffect(() => {
    loadInfluencers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  const filteredInfluencers = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return influencers;

    return influencers.filter((item) => {
      const text = [
        item.name,
        item.email,
        item.phone,
        item.platform,
        item.handle,
        item.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return text.includes(q);
    });
  }, [search, influencers]);

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
      setActionLoadingId(item.id);
      await marketingDeleteReferrer(item.id);
      await loadInfluencers();
    } catch (err) {
      alert(err?.message || t('err.delete'));
    } finally {
      setActionLoadingId('');
    }
  };

  return (
    <div className="mk-page" dir={locale === 'ar' ? 'rtl' : undefined}>
      {error ? <div className="mk-error-text">{error}</div> : null}

      <div className="mk-influencer-stats-grid">
        <StatCard
          icon={<Star />}
          title={t('stat.influencers')}
          value={totalInfluencers}
          iconBg="#FFFBEB"
          iconColor="#D5AD27"
        />

        <StatCard
          icon={<DollarSign />}
          title={t('stat.commissions')}
          value={mktInfFormatSar(locale, totalCommissions)}
          iconBg="#ECFDF5"
          iconColor="#10B981"
        />

        <StatCard
          icon={<TrendingUp />}
          title={t('stat.campaigns')}
          value={activeCampaigns}
          iconBg="#EFF6FF"
          iconColor="#3B82F6"
        />
      </div>

      <section className="mk-card mk-influencer-card">
        <div className="mk-influencer-card-header">
          <h3 className="mk-card-title">{t('card.title')}</h3>

          <div className="mk-influencer-actions">
            <label className="mk-search-field mk-influencer-search">
              <Search size={14} color="#9CA3AF" />

              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') loadInfluencers();
                }}
                placeholder={t('search.placeholder')}
              />
            </label>

            <button
              type="button"
              className="mk-btn-primary"
              onClick={openCreatePage}
            >
              <Plus size={16} strokeWidth={2.5} />
              {t('btn.add')}
            </button>
          </div>
        </div>

        <table className="mk-table mk-influencer-table">
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
              <tr>
                <td colSpan={8} className="mk-empty-table">
                  {t('empty.loading')}
                </td>
              </tr>
            ) : filteredInfluencers.length === 0 ? (
              <tr>
                <td colSpan={8} className="mk-empty-table">
                  {t('empty.none')}
                </td>
              </tr>
            ) : (
              filteredInfluencers.map((item) => {
                const busy = actionLoadingId === item.id;

                return (
                  <tr key={item.id}>
                    <td>
                      <div className="mk-table-title">{item.name}</div>
                      <div className="mk-table-subtitle">
                        {item.email || item.phone || t('dash')}
                      </div>
                    </td>

                    <td>{mktInfPlatformLabel(locale, item.platform)}</td>
                    <td>{item.handle || t('dash')}</td>
                    <td>{mktInfFormatSar(locale, item.commission)}</td>
                    <td>{Number(item.commissionRate || 0)}%</td>
                    <td>{item.activeCampaigns}</td>
                    <td>
                      <StatusBadge status={item.status} locale={locale} />
                    </td>
                    <td>
                      <div className="mk-icon-actions">
                        <button
                          type="button"
                          title={t('action.edit')}
                          disabled={busy}
                          onClick={() => openEditPage(item.id)}
                        >
                          <Pencil size={15} />
                        </button>

                        <button
                          type="button"
                          title={t('action.delete')}
                          disabled={busy}
                          onClick={() => handleDelete(item)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
};

export default InfluencerReferrers;
