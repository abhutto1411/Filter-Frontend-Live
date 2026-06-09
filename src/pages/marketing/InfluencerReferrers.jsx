import React, { useEffect, useMemo, useState } from 'react';
import {
  Star,
  DollarSign,
  TrendingUp,
  Search,
  Plus,
  X,
  Pencil,
  Trash2,
} from 'lucide-react';
import {
  marketingCreateReferrer,
  marketingDeleteReferrer,
  marketingListReferrers,
  marketingUpdateReferrer,
} from '../../services/superAdminMarketingApi';
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
  const [search, setSearch] = useState('');
  const [influencers, setInfluencers] = useState([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState('');
  const [error, setError] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(initialForm);

  const isEditing = Boolean(form.id);

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

  const updateForm = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const openCreateModal = () => {
    setForm(initialForm);
    setShowModal(true);
  };

  const openEditModal = (item) => {
    setForm({
      id: item.id,
      name: item.name || '',
      email: item.email || '',
      phone: item.phone || '',
      platform: item.platform || 'instagram',
      handle: item.handle || '',
      commissionRate: String(item.commissionRate || ''),
      activeCampaigns: String(item.activeCampaigns || ''),
      status: item.status || 'active',
      notes: item.notes || '',
    });

    setShowModal(true);
  };

  const closeModal = () => {
    setForm(initialForm);
    setShowModal(false);
  };

  const buildPayload = () => ({
    name: form.name.trim(),
    fullName: form.name.trim(),
    email: form.email.trim() || undefined,
    phone: form.phone.trim() || undefined,
    platform: form.platform,
    socialPlatform: form.platform,
    handle: form.handle.trim() || undefined,
    socialHandle: form.handle.trim() || undefined,
    commissionRate: Number(form.commissionRate || 0),
    activeCampaigns: Number(form.activeCampaigns || 0),
    status: form.status,
    type: 'influencer',
    referrerType: 'influencer',
    category: 'influencer',
    notes: form.notes.trim() || undefined,
  });

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.name.trim()) {
      alert('Influencer name is required.');
      return;
    }

    try {
      setSaving(true);

      const payload = buildPayload();

      if (isEditing) {
        await marketingUpdateReferrer(form.id, payload);
      } else {
        await marketingCreateReferrer(payload);
      }

      closeModal();
      await loadInfluencers();
    } catch (err) {
      alert(err?.message || 'Failed to save influencer referrer.');
    } finally {
      setSaving(false);
    }
  };

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
              onClick={openCreateModal}
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
                          onClick={() => openEditModal(item)}
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

      {showModal ? (
        <div className="mk-modal-overlay">
          <div className="mk-modal-card">
            <div className="mk-modal-header">
              <h2>{isEditing ? 'Edit Influencer' : 'Add Influencer'}</h2>

              <button
                type="button"
                className="mk-modal-close"
                onClick={closeModal}
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="mk-form-grid-2">
                <div className="mk-form-group">
                  <label className="mk-label">Name</label>
                  <input
                    autoFocus
                    className="mk-input"
                    value={form.name}
                    onChange={(e) => updateForm('name', e.target.value)}
                  />
                </div>

                <div className="mk-form-group">
                  <label className="mk-label">Status</label>
                  <select
                    className="mk-input"
                    value={form.status}
                    onChange={(e) => updateForm('status', e.target.value)}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="pending">Pending</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>

              <div className="mk-form-grid-2">
                <div className="mk-form-group">
                  <label className="mk-label">Email</label>
                  <input
                    className="mk-input"
                    value={form.email}
                    onChange={(e) => updateForm('email', e.target.value)}
                  />
                </div>

                <div className="mk-form-group">
                  <label className="mk-label">Phone</label>
                  <input
                    className="mk-input"
                    value={form.phone}
                    onChange={(e) => updateForm('phone', e.target.value)}
                  />
                </div>
              </div>

              <div className="mk-form-grid-2">
                <div className="mk-form-group">
                  <label className="mk-label">Platform</label>
                  <select
                    className="mk-input"
                    value={form.platform}
                    onChange={(e) => updateForm('platform', e.target.value)}
                  >
                    {platformOptions.map((option) => (
                      <option key={option} value={option}>
                        {humanize(option)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mk-form-group">
                  <label className="mk-label">Handle / Username</label>
                  <input
                    className="mk-input"
                    value={form.handle}
                    onChange={(e) => updateForm('handle', e.target.value)}
                    placeholder="@username"
                  />
                </div>
              </div>

              <div className="mk-form-grid-2">
                <div className="mk-form-group">
                  <label className="mk-label">Commission Rate (%)</label>
                  <input
                    type="number"
                    min="0"
                    className="mk-input"
                    value={form.commissionRate}
                    onChange={(e) => updateForm('commissionRate', e.target.value)}
                  />
                </div>

                <div className="mk-form-group">
                  <label className="mk-label">Active Campaigns</label>
                  <input
                    type="number"
                    min="0"
                    className="mk-input"
                    value={form.activeCampaigns}
                    onChange={(e) => updateForm('activeCampaigns', e.target.value)}
                  />
                </div>
              </div>

              <div className="mk-form-group">
                <label className="mk-label">Notes</label>
                <input
                  className="mk-input"
                  value={form.notes}
                  onChange={(e) => updateForm('notes', e.target.value)}
                />
              </div>

              <div className="mk-modal-footer">
                <button
                  type="button"
                  className="mk-btn-secondary"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button type="submit" className="mk-btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Influencer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default InfluencerReferrers;