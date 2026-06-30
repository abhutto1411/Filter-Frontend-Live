import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Plus,
  X,
  ChevronDown,
  Pencil,
  BarChart3,
  Pause,
  Play,
} from 'lucide-react';
import {
  marketingChangeCampaignStatus,
  marketingCreateCampaign,
  marketingListCampaigns,
  marketingUpdateCampaign,
  marketingUpdateCampaignMetrics,
} from '../../services/superAdminMarketingApi';
import './MarketingUniversal.css';

const platformOptions = [
  'meta',
  'google ads',
  'tiktok',
  'snapchat',
  'seo',
  'influencer',
  'offline',
  'email',
  'sms',
  'multiple',
];

const typeOptions = [
  'brand awareness',
  'lead generation',
  'conversion',
  'retention',
  'referral',
  'discount',
  'bundle',
  'seasonal',
  'loyalty',
];

const initialForm = {
  id: '',
  name: '',
  workshopBranch: '',
  platform: 'meta',
  type: 'brand awareness',
  startDate: '',
  endDate: '',
  budget: '0',
  notes: '',
  status: '',
};

const initialMetricsForm = {
  id: '',
  budgetSpent: '0',
  revenueGenerated: '0',
  leadsCount: '0',
  conversionsCount: '0',
  impressions: '0',
  clicks: '0',
};

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
    .replace(/-/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function normalizeCampaignType(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function normalizePlatform(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase();
}

function asArrayResponse(res) {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.campaigns)) return res.campaigns;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.items)) return res.items;
  if (Array.isArray(res?.data?.items)) return res.data.items;
  if (Array.isArray(res?.data?.campaigns)) return res.data.campaigns;
  return [];
}

function normalizeCampaign(row) {
  const status = row.status || 'pending_approval';

  return {
    id: String(row.id || ''),
    name: row.name || row.campaignName || row.title || '',
    campaignName: row.campaignName || row.name || row.title || '',
    workshopBranch:
      row.workshopBranch ||
      row.requestedByName ||
      row.branchName ||
      row.workshopName ||
      'Super Admin',
    platform: row.platform || 'meta',
    type: row.type || row.campaignType || 'brand_awareness',
    campaignType: row.campaignType || row.type || 'brand_awareness',
    budget: Number(row.budget ?? row.budgetAllocated ?? 0),
    budgetAllocated: Number(row.budgetAllocated ?? row.budget ?? 0),
    spent: Number(row.spent ?? row.budgetSpent ?? 0),
    budgetSpent: Number(row.budgetSpent ?? row.spent ?? 0),
    revenue: Number(row.revenue ?? row.revenueGenerated ?? 0),
    revenueGenerated: Number(row.revenueGenerated ?? row.revenue ?? 0),
    leadsCount: Number(row.leadsCount ?? 0),
    conversionsCount: Number(row.conversionsCount ?? 0),
    impressions: Number(row.impressions ?? 0),
    clicks: Number(row.clicks ?? 0),
    status,
    startDate: row.startDate ? String(row.startDate).slice(0, 10) : '',
    endDate: row.endDate ? String(row.endDate).slice(0, 10) : '',
    notes: row.notes || '',
  };
}

function canUpdateMetrics(status) {
  const s = normalizeStatus(status);
  return ['approved', 'active', 'paused', 'completed'].includes(s);
}

function canPauseResume(status) {
  const s = normalizeStatus(status);
  return ['approved', 'active', 'paused'].includes(s);
}

const SelectField = ({ value, onChange, options }) => {
  return (
    <div className="mk-select-wrap">
      <select
        className="mk-input mk-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {humanize(option)}
          </option>
        ))}
      </select>

      <ChevronDown className="mk-select-icon" size={15} strokeWidth={2} />
    </div>
  );
};

const StatusBadge = ({ status }) => {
  const value = normalizeStatus(status) || 'pending_approval';

  const classNameMap = {
    pending_approval: 'mk-status-pending',
    pending: 'mk-status-pending',
    approved: 'mk-status-approved-blue',
    active: 'mk-status-approved',
    paused: 'mk-status-paused',
    rejected: 'mk-status-rejected',
    cancelled: 'mk-status-rejected',
    completed: 'mk-status-approved',
    draft: 'mk-status-draft',
  };

  return (
    <span className={`mk-status ${classNameMap[value] || 'mk-status-pending'}`}>
      {humanize(value)}
    </span>
  );
};

export const Promotions = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(initialForm);

  const [showMetricsModal, setShowMetricsModal] = useState(false);
  const [metricsForm, setMetricsForm] = useState(initialMetricsForm);

  const isEditing = Boolean(form.id);

  const loadCampaigns = async (serverSearch = '') => {
    try {
      setLoading(true);
      setError('');

      const res = await marketingListCampaigns({
        limit: 100,
        offset: 0,
        status: 'all',
        search: serverSearch.trim(),
      });

      setCampaigns(asArrayResponse(res).map(normalizeCampaign));
    } catch (err) {
      setCampaigns([]);
      setError(err?.message || 'Unable to load campaigns.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCampaigns();
  }, []);

  const filteredCampaigns = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return campaigns;

    return campaigns.filter((item) => {
      const text = [
        item.name,
        item.workshopBranch,
        item.platform,
        item.type,
        item.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return text.includes(q);
    });
  }, [campaigns, search]);

  const updateForm = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const updateMetricsForm = (field, value) => {
    setMetricsForm((prev) => ({
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
      workshopBranch: item.workshopBranch || '',
      platform: String(item.platform || 'meta').replace(/_/g, ' '),
      type: String(item.type || 'brand awareness').replace(/_/g, ' '),
      startDate: item.startDate || '',
      endDate: item.endDate || '',
      budget: String(item.budget || 0),
      notes: item.notes || '',
      status: item.status || '',
    });

    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;

    setShowModal(false);
    setForm(initialForm);
  };

  const openMetricsModal = (item) => {
    setMetricsForm({
      id: item.id,
      budgetSpent: String(item.spent || 0),
      revenueGenerated: String(item.revenue || 0),
      leadsCount: String(item.leadsCount || 0),
      conversionsCount: String(item.conversionsCount || 0),
      impressions: String(item.impressions || 0),
      clicks: String(item.clicks || 0),
    });

    setShowMetricsModal(true);
  };

  const closeMetricsModal = () => {
    if (saving) return;

    setShowMetricsModal(false);
    setMetricsForm(initialMetricsForm);
  };

  const buildCampaignPayload = () => {
    const campaignName = form.name.trim();
    const workshopBranch = form.workshopBranch.trim();

    const payload = {
      campaignName,
      name: campaignName,
      title: campaignName,
      requestedByName: workshopBranch,
      workshopBranch,
      platform: normalizePlatform(form.platform),
      campaignType: normalizeCampaignType(form.type),
      type: normalizeCampaignType(form.type),
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      budgetAllocated: Number(form.budget || 0),
      budget: Number(form.budget || 0),
      notes: form.notes?.trim() || undefined,
      requestedByPortal: 'marketing_portal',
    };

    if (!isEditing) {
      payload.status = 'pending_approval';
    }

    return payload;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.name.trim()) {
      alert('Campaign name is required.');
      return;
    }

    if (!form.workshopBranch.trim()) {
      alert('Workshop / branch name is required.');
      return;
    }

    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      alert('End date must be on or after start date.');
      return;
    }

    try {
      setSaving(true);
      setError('');

      const payload = buildCampaignPayload();

      if (isEditing) {
        await marketingUpdateCampaign(form.id, payload);
      } else {
        await marketingCreateCampaign(payload);
        alert('Campaign approval request has been sent to Admin Approvals.');
      }

      closeModal();
      await loadCampaigns();
    } catch (err) {
      setError(err?.message || 'Unable to save campaign.');
    } finally {
      setSaving(false);
    }
  };

  const handlePauseResume = async (item) => {
    const currentStatus = normalizeStatus(item.status);
    const nextStatus = currentStatus === 'paused' ? 'active' : 'paused';

    try {
      setError('');

      await marketingChangeCampaignStatus(item.id, {
        status: nextStatus,
        notes: item.notes || 'Status updated from Marketing Portal.',
      });

      await loadCampaigns();
    } catch (err) {
      setError(err?.message || 'Unable to update campaign status.');
    }
  };

  const handleMetricsSubmit = async (e) => {
    e.preventDefault();

    try {
      setSaving(true);
      setError('');

      await marketingUpdateCampaignMetrics(metricsForm.id, {
        budgetSpent: Number(metricsForm.budgetSpent || 0),
        revenueGenerated: Number(metricsForm.revenueGenerated || 0),
        leadsCount: Number(metricsForm.leadsCount || 0),
        conversionsCount: Number(metricsForm.conversionsCount || 0),
        impressions: Number(metricsForm.impressions || 0),
        clicks: Number(metricsForm.clicks || 0),
      });

      closeMetricsModal();
      await loadCampaigns();
    } catch (err) {
      setError(err?.message || 'Unable to update metrics.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mk-page">
      <div className="mk-page-actions">
        <label className="mk-search-field">
          <Search size={15} color="#94A3B8" strokeWidth={2} />

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') loadCampaigns(search);
            }}
            placeholder="Search campaigns..."
          />
        </label>

        <button type="button" className="mk-btn-primary" onClick={openCreateModal}>
          <Plus size={16} strokeWidth={2.5} />
          New Campaign
        </button>
      </div>

      {error ? <div className="mk-error-text">{error}</div> : null}

      <section className="mk-table-card">
        <table className="mk-table mk-campaigns-table">
          <thead>
            <tr>
              <th>Campaign</th>
              <th>Workshop</th>
              <th>Platform</th>
              <th>Type</th>
              <th>Budget</th>
              <th>Spent</th>
              <th>Revenue</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="mk-empty-table">
                  Loading campaigns...
                </td>
              </tr>
            ) : filteredCampaigns.length === 0 ? (
              <tr>
                <td colSpan={9} className="mk-empty-table">
                  No campaigns found
                </td>
              </tr>
            ) : (
              filteredCampaigns.map((item) => {
                const status = normalizeStatus(item.status);

                return (
                  <tr key={item.id}>
                    <td>
                      <div className="mk-table-title">{item.name}</div>
                    </td>

                    <td>
                      <div className="mk-table-workshop">{item.workshopBranch}</div>
                    </td>

                    <td>{humanize(item.platform)}</td>
                    <td>{humanize(item.type)}</td>
                    <td>{formatSar(item.budget)}</td>
                    <td>{formatSar(item.spent)}</td>
                    <td>{formatSar(item.revenue)}</td>

                    <td>
                      <StatusBadge status={item.status} />
                    </td>

                    <td>
                      <div className="mk-icon-actions mk-campaign-actions">
                        <button
                          type="button"
                          title="Edit"
                          className="mk-action-edit"
                          onClick={() => openEditModal(item)}
                        >
                          <Pencil size={15} />
                        </button>

                        {canUpdateMetrics(status) ? (
                          <button
                            type="button"
                            title="Metrics"
                            className="mk-action-metrics"
                            onClick={() => openMetricsModal(item)}
                          >
                            <BarChart3 size={15} />
                          </button>
                        ) : null}

                        {canPauseResume(status) ? (
                          <button
                            type="button"
                            title={status === 'paused' ? 'Resume' : 'Pause'}
                            className="mk-action-pause"
                            onClick={() => handlePauseResume(item)}
                          >
                            {status === 'paused' ? (
                              <Play size={15} />
                            ) : (
                              <Pause size={15} />
                            )}
                          </button>
                        ) : null}
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
              <h2>{isEditing ? 'Edit Campaign' : 'New Campaign'}</h2>

              <button
                type="button"
                className="mk-modal-close"
                onClick={closeModal}
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="mk-form-group">
                <label className="mk-label">Campaign Name</label>
                <input
                  autoFocus
                  className="mk-input mk-input-focus"
                  value={form.name}
                  onChange={(e) => updateForm('name', e.target.value)}
                  maxLength={160}
                />
              </div>

              <div className="mk-form-group">
                <label className="mk-label">Workshop / Branch Name</label>
                <input
                  className="mk-input"
                  value={form.workshopBranch}
                  onChange={(e) => updateForm('workshopBranch', e.target.value)}
                  placeholder="Enter workshop or branch name"
                  maxLength={160}
                />
              </div>

              <div className="mk-form-grid-2">
                <div className="mk-form-group">
                  <label className="mk-label">Platform</label>
                  <SelectField
                    value={form.platform}
                    onChange={(value) => updateForm('platform', value)}
                    options={platformOptions}
                  />
                </div>

                <div className="mk-form-group">
                  <label className="mk-label">Type</label>
                  <SelectField
                    value={form.type}
                    onChange={(value) => updateForm('type', value)}
                    options={typeOptions}
                  />
                </div>
              </div>

              <div className="mk-form-grid-2">
                <div className="mk-form-group">
                  <label className="mk-label">Start Date</label>
                  <input
                    type="date"
                    className="mk-input"
                    value={form.startDate}
                    onChange={(e) => updateForm('startDate', e.target.value)}
                  />
                </div>

                <div className="mk-form-group">
                  <label className="mk-label">End Date</label>
                  <input
                    type="date"
                    className="mk-input"
                    value={form.endDate}
                    onChange={(e) => updateForm('endDate', e.target.value)}
                  />
                </div>
              </div>

              <div className="mk-form-group">
                <label className="mk-label">Budget Allocated (SAR)</label>
                <input
                  type="number"
                  min="0"
                  className="mk-input"
                  value={form.budget}
                  onChange={(e) => updateForm('budget', e.target.value)}
                />
              </div>

              <div className="mk-form-group">
                <label className="mk-label">Notes</label>
                <input
                  className="mk-input"
                  value={form.notes}
                  onChange={(e) => updateForm('notes', e.target.value)}
                  maxLength={1000}
                />
              </div>

              {!isEditing ? (
                <div className="mk-campaign-approval-note">
                  This campaign will be sent to Admin Approvals as pending approval.
                </div>
              ) : null}

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
                  {saving ? 'Saving...' : isEditing ? 'Save Campaign' : 'Send for Approval'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showMetricsModal ? (
        <div className="mk-modal-overlay">
          <div className="mk-modal-card">
            <div className="mk-modal-header">
              <h2>Update Campaign Metrics</h2>

              <button
                type="button"
                className="mk-modal-close"
                onClick={closeMetricsModal}
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            <form onSubmit={handleMetricsSubmit}>
              <div className="mk-form-grid-2">
                <div className="mk-form-group">
                  <label className="mk-label">Budget Spent (SAR)</label>
                  <input
                    type="number"
                    min="0"
                    className="mk-input"
                    value={metricsForm.budgetSpent}
                    onChange={(e) =>
                      updateMetricsForm('budgetSpent', e.target.value)
                    }
                  />
                </div>

                <div className="mk-form-group">
                  <label className="mk-label">Revenue Generated (SAR)</label>
                  <input
                    type="number"
                    min="0"
                    className="mk-input"
                    value={metricsForm.revenueGenerated}
                    onChange={(e) =>
                      updateMetricsForm('revenueGenerated', e.target.value)
                    }
                  />
                </div>
              </div>

              <div className="mk-form-grid-2">
                <div className="mk-form-group">
                  <label className="mk-label">Leads</label>
                  <input
                    type="number"
                    min="0"
                    className="mk-input"
                    value={metricsForm.leadsCount}
                    onChange={(e) =>
                      updateMetricsForm('leadsCount', e.target.value)
                    }
                  />
                </div>

                <div className="mk-form-group">
                  <label className="mk-label">Conversions</label>
                  <input
                    type="number"
                    min="0"
                    className="mk-input"
                    value={metricsForm.conversionsCount}
                    onChange={(e) =>
                      updateMetricsForm('conversionsCount', e.target.value)
                    }
                  />
                </div>
              </div>

              <div className="mk-form-grid-2">
                <div className="mk-form-group">
                  <label className="mk-label">Impressions</label>
                  <input
                    type="number"
                    min="0"
                    className="mk-input"
                    value={metricsForm.impressions}
                    onChange={(e) =>
                      updateMetricsForm('impressions', e.target.value)
                    }
                  />
                </div>

                <div className="mk-form-group">
                  <label className="mk-label">Clicks</label>
                  <input
                    type="number"
                    min="0"
                    className="mk-input"
                    value={metricsForm.clicks}
                    onChange={(e) => updateMetricsForm('clicks', e.target.value)}
                  />
                </div>
              </div>

              <div className="mk-modal-footer">
                <button
                  type="button"
                  className="mk-btn-secondary"
                  onClick={closeMetricsModal}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button type="submit" className="mk-btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Metrics'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

   
    </div>
  );
};

export default Promotions;