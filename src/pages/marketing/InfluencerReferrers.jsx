import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
import { marketingSectionPath } from './marketingRouteUtils';
import './MarketingUniversal.css';

const initialForm = {
  id: '',
  name: '',
  email: '',
  phone: '',
  platform: 'instagram',
  handle: '',
  commissionRate: '',
  activeCampaigns: '',
  status: 'active',
  notes: '',
};

const platformOptions = [
  'instagram',
  'tiktok',
  'youtube',
  'snapchat',
  'facebook',
  'x',
  'blog',
  'offline',
  'other',
];

function formatSar(value) {
  const n = Number(value);

  if (!Number.isFinite(n)) return '0 SAR';

  return `${n.toLocaleString(undefined, {
    maximumFractionDigits: 0,
  })} SAR`;
}

function humanize(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function normalizeReferrer(row) {
  const name =
    row.name ||
    row.fullName ||
    row.full_name ||
    row.referrerName ||
    row.referrer_name ||
    row.displayName ||
    'Referrer';

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

function extractReferrers(payload) {
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

  return rows.map(normalizeReferrer);
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

const StatusBadge = ({ status }) => {
  const value = String(status || 'active').toLowerCase();

  const classNameMap = {
    active: 'mk-status-approved',
    inactive: 'mk-status-draft',
    suspended: 'mk-status-rejected',
    pending: 'mk-status-pending',
  };

  return (
    <span className={`mk-status ${classNameMap[value] || 'mk-status-draft'}`}>
      {humanize(value)}
    </span>
  );
};

export const InfluencerReferrers = () => {
  const navigate = useNavigate();
  const location = useLocation();
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

      const rows = extractReferrers(res);

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
      setError(err?.message || 'Failed to load influencer referrers.');
      setInfluencers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInfluencers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (!window.confirm(`Delete ${item.name}?`)) return;

    try {
      setActionLoadingId(item.id);
      await marketingDeleteReferrer(item.id);
      await loadInfluencers();
    } catch (err) {
      alert(err?.message || 'Failed to delete influencer referrer.');
    } finally {
      setActionLoadingId('');
    }
  };

  return (
    <div className="mk-page">
      <div className="mk-influencer-stats-grid">
        <StatCard
          icon={<Star />}
          title="Influencers"
          value={totalInfluencers}
          iconBg="#FFFBEB"
          iconColor="#D5AD27"
        />

        <StatCard
          icon={<DollarSign />}
          title="Total Commissions"
          value={formatSar(totalCommissions)}
          iconBg="#ECFDF5"
          iconColor="#10B981"
        />

        <StatCard
          icon={<TrendingUp />}
          title="Active Campaigns w / Influencers"
          value={activeCampaigns}
          iconBg="#EFF6FF"
          iconColor="#3B82F6"
        />
      </div>

      <section className="mk-card mk-influencer-card">
        <div className="mk-influencer-card-header">
          <h3 className="mk-card-title">Influencer Referrers</h3>

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
                placeholder="Search..."
              />
            </label>

            <button
              type="button"
              className="mk-btn-primary"
              onClick={openCreatePage}
            >
              <Plus size={16} strokeWidth={2.5} />
              Add Influencer
            </button>
          </div>
        </div>

        <table className="mk-table mk-influencer-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Platform</th>
              <th>Handle</th>
              <th>Commission</th>
              <th>Rate</th>
              <th>Campaigns</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="mk-empty-table">
                  Loading influencer referrers...
                </td>
              </tr>
            ) : filteredInfluencers.length === 0 ? (
              <tr>
                <td colSpan={8} className="mk-empty-table">
                  No influencer referrers found
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
                        {item.email || item.phone || '—'}
                      </div>
                    </td>

                    <td>{humanize(item.platform)}</td>
                    <td>{item.handle || '—'}</td>
                    <td>{formatSar(item.commission)}</td>
                    <td>{Number(item.commissionRate || 0)}%</td>
                    <td>{item.activeCampaigns}</td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                    <td>
                      <div className="mk-icon-actions">
                        <button
                          type="button"
                          title="Edit"
                          disabled={busy}
                          onClick={() => openEditPage(item.id)}
                        >
                          <Pencil size={15} />
                        </button>

                        <button
                          type="button"
                          title="Delete"
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