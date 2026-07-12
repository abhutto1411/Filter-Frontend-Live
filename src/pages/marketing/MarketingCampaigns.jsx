import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Loader2,
  AlertCircle,
  Pencil,
  BarChart3,
  Pause,
  Play,
  Trash2,
  X,
  RefreshCw,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import {
  marketingListCampaigns,
  marketingChangeCampaignStatus,
  marketingDeleteCampaign,
  marketingUpdateCampaignMetrics,
  marketingGetCampaignErpMetrics,
  marketingSyncCampaignErpMetrics,
  marketingApproveCampaign,
  marketingRejectCampaign,
  marketingGetCampaign,
} from '../../services/superAdminMarketingApi';
import { marketingSectionPath } from './marketingRouteUtils';
import { loadPromotionDropdownData } from './marketingPromotionShared';
import { useAuth } from '../../context/AuthContext';
import './MarketingUniversal.css';

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatSar(value) {
  return `${toNumber(value).toLocaleString(undefined, { maximumFractionDigits: 0 })} SAR`;
}

function humanize(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function statusBadgeClass(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'active') return 'mk-camp-status active';
  if (s === 'approved') return 'mk-camp-status approved';
  if (s === 'paused') return 'mk-camp-status paused';
  if (s === 'rejected' || s === 'cancelled') return 'mk-camp-status rejected';
  if (s === 'pending_approval' || s === 'draft') return 'mk-camp-status pending';
  return 'mk-camp-status';
}

function normalizeCampaign(row) {
  const branchIds = Array.isArray(row?.targetBranchIds)
    ? row.targetBranchIds.map(String)
    : [];
  return {
    id: String(row?.id ?? ''),
    name: row?.campaignName || row?.name || row?.title || 'Campaign',
    platform: row?.platform || 'unknown',
    type: row?.campaignType || row?.type || 'brand_awareness',
    budget: toNumber(row?.budgetAllocated ?? row?.budget),
    spent: toNumber(row?.budgetSpent ?? row?.spent),
    revenue: toNumber(row?.revenueGenerated ?? row?.revenue),
    status: row?.status || 'draft',
    leads: toNumber(row?.leadsCount ?? row?.leads),
    conversions: toNumber(row?.conversionsCount ?? row?.conversions),
    impressions: toNumber(row?.impressions),
    clicks: toNumber(row?.clicks),
    workshopId: String(row?.workshopId || row?.requestedByTenantId || ''),
    workshopName: row?.workshopName || row?.requestedByName || row?.workshopBranch || '',
    targetBranchIds: branchIds,
    createdByName: row?.createdByUserName || row?.submittedByName || '',
    submittedByName: row?.submittedByName || '',
    notes: row?.notes || '',
    description: row?.description || '',
    startDate: row?.startDate,
    endDate: row?.endDate,
  };
}

function resolveBranchLabels(branchIds, branchOptions) {
  if (!branchIds?.length) return '—';
  const labels = branchIds
    .map((id) => branchOptions.find((b) => b.id === id || b.realId === id)?.label)
    .filter(Boolean);
  if (!labels.length) return `${branchIds.length} branch(es)`;
  if (labels.length <= 2) return labels.join(', ');
  return `${labels.length} branches`;
}

function formatCampaignDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

const CampaignApprovalModal = ({
  campaign,
  branches,
  loading,
  onClose,
  onApprove,
  onReject,
  acting,
}) => {
  const c = campaign || {};
  const branchLabels = resolveBranchLabels(c.targetBranchIds, branches);

  return (
    <div className="mk-camp-modal-overlay" role="dialog" aria-modal="true">
      <div className="mk-camp-modal mk-camp-modal-wide mk-camp-review-modal">
        <div className="mk-camp-modal-head">
          <h3>Review campaign for approval</h3>
          <button type="button" onClick={onClose} className="mk-camp-modal-close">
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <div className="mk-camp-form-loading">
            <Loader2 className="mk-camp-spin" size={24} />
            <p>Loading campaign details...</p>
          </div>
        ) : (
          <>
            <p className="mk-camp-review-lead">
              Marketing submitted this campaign. Review complete details before approving
              or rejecting.
            </p>
            <div className="mk-camp-review-grid">
              <div><span>Campaign</span><strong>{c.name}</strong></div>
              <div><span>Status</span><strong>{humanize(c.status)}</strong></div>
              <div><span>Workshop</span><strong>{c.workshopName || '—'}</strong></div>
              <div><span>Branches</span><strong>{branchLabels}</strong></div>
              <div><span>Platform</span><strong>{humanize(c.platform)}</strong></div>
              <div><span>Type</span><strong>{humanize(c.type)}</strong></div>
              <div><span>Budget</span><strong>{formatSar(c.budget)}</strong></div>
              <div><span>Spent / Revenue</span><strong>{formatSar(c.spent)} / {formatSar(c.revenue)}</strong></div>
              <div><span>Start date</span><strong>{formatCampaignDate(c.startDate)}</strong></div>
              <div><span>End date</span><strong>{formatCampaignDate(c.endDate)}</strong></div>
              <div className="mk-camp-review-full"><span>Created by</span><strong>{c.createdByName || c.submittedByName || '—'}</strong></div>
              <div className="mk-camp-review-full"><span>Notes</span><strong>{c.notes || c.description || '—'}</strong></div>
            </div>
          </>
        )}

        <div className="mk-camp-modal-foot">
          <button type="button" onClick={onClose} disabled={acting}>
            Cancel
          </button>
          <button
            type="button"
            className="mk-camp-review-reject"
            onClick={onReject}
            disabled={acting || loading}
          >
            <XCircle size={14} /> Reject
          </button>
          <button
            type="button"
            className="primary"
            onClick={onApprove}
            disabled={acting || loading}
          >
            <CheckCircle size={14} /> Approve campaign
          </button>
        </div>
      </div>
    </div>
  );
};

const MetricsModal = ({ campaign, onClose, onSaved }) => {
  const [form, setForm] = useState({
    budgetSpent: campaign?.spent ?? 0,
    revenueGenerated: campaign?.revenue ?? 0,
    leadsCount: campaign?.leads ?? 0,
    conversionsCount: campaign?.conversions ?? 0,
    impressions: campaign?.impressions ?? 0,
    clicks: campaign?.clicks ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState('');
  const [erpInfo, setErpInfo] = useState('');

  const applyErpMetrics = (metrics, summary) => {
    setForm((prev) => ({
      ...prev,
      revenueGenerated: metrics?.revenueGenerated ?? prev.revenueGenerated,
      conversionsCount: metrics?.conversionsCount ?? prev.conversionsCount,
      leadsCount: metrics?.leadsCount ?? prev.leadsCount,
      budgetSpent:
        metrics?.budgetSpent ?? metrics?.budgetSpentFromExpenses ?? prev.budgetSpent,
    }));
    if (summary) setErpInfo(summary);
  };

  const previewErp = async () => {
    try {
      setPreviewing(true);
      setError('');
      const res = await marketingGetCampaignErpMetrics(campaign.id);
      applyErpMetrics(res?.metrics || res?.data?.metrics, res?.summary || res?.message);
    } catch (err) {
      setError(err?.message || 'Could not load POS/ERP revenue.');
      setErpInfo('');
    } finally {
      setPreviewing(false);
    }
  };

  const syncErp = async () => {
    try {
      setSyncing(true);
      setError('');
      const res = await marketingSyncCampaignErpMetrics(campaign.id);
      const metrics = res?.metrics || res?.data?.metrics;
      applyErpMetrics(metrics, res?.summary || res?.message);
      onSaved();
    } catch (err) {
      setError(err?.message || 'POS/ERP sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  const save = async () => {
    try {
      setSaving(true);
      setError('');
      const payload = {
        budgetSpent: Number(form.budgetSpent) || 0,
        revenueGenerated: Number(form.revenueGenerated) || 0,
        leadsCount: parseInt(String(form.leadsCount), 10) || 0,
        conversionsCount: parseInt(String(form.conversionsCount), 10) || 0,
        impressions: parseInt(String(form.impressions), 10) || 0,
        clicks: parseInt(String(form.clicks), 10) || 0,
      };
      await marketingUpdateCampaignMetrics(campaign.id, payload);
      onSaved();
      onClose();
    } catch (err) {
      setError(err?.message || 'Failed to update metrics.');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (['budgetSpent', 'revenueGenerated', 'leadsCount', 'conversionsCount'].includes(key)) {
      setErpInfo('Manual POS/ERP values — click Save Metrics to apply (same as sync).');
    }
  };

  const erpFields = [
    ['budgetSpent', 'Spent (SAR)', 'Campaign spend / linked expenses'],
    ['revenueGenerated', 'POS/ERP Revenue (SAR)', 'Invoice sales total for this campaign'],
    ['leadsCount', 'Leads (customers)', 'Unique customers — manual if ERP unavailable'],
    ['conversionsCount', 'Conversions (orders)', 'Invoice/order count — manual if ERP unavailable'],
  ];

  const adFields = [
    ['impressions', 'Impressions', 'From Meta / Google Ads dashboard'],
    ['clicks', 'Clicks', 'From ad platform dashboard'],
  ];

  const hasTargeting =
    Boolean(campaign?.workshopId) || (campaign?.targetBranchIds?.length ?? 0) > 0;

  return (
    <div className="mk-camp-modal-overlay" role="dialog" aria-modal="true">
      <div className="mk-camp-modal mk-camp-modal-wide">
        <div className="mk-camp-modal-head">
          <h3>
            <BarChart3 size={16} /> Campaign Metrics — {campaign.name}
          </h3>
          <button type="button" onClick={onClose} className="mk-camp-modal-close">
            <X size={16} />
          </button>
        </div>

        <div className="mk-camp-erp-panel">
          <div>
            <strong>POS / ERP revenue — auto sync</strong>
            <p>
              Pull invoice totals from ERP for this campaign&apos;s workshop/branches and
              date range. Or skip sync and type the same values manually in the section below.
            </p>
            {!hasTargeting ? (
              <p className="mk-camp-erp-warn">
                Sync needs workshop/branches on the campaign. You can still enter POS/ERP
                revenue manually below.
              </p>
            ) : null}
            {erpInfo ? <p className="mk-camp-erp-summary">{erpInfo}</p> : null}
          </div>
          <div className="mk-camp-erp-actions">
            <button
              type="button"
              className="mk-camp-erp-btn"
              onClick={previewErp}
              disabled={previewing || syncing || !hasTargeting}
            >
              <RefreshCw size={14} className={previewing ? 'mk-camp-spin' : ''} />
              {previewing ? 'Loading...' : 'Preview ERP'}
            </button>
            <button
              type="button"
              className="mk-camp-erp-btn primary"
              onClick={syncErp}
              disabled={syncing || previewing || !hasTargeting}
            >
              <RefreshCw size={14} className={syncing ? 'mk-camp-spin' : ''} />
              {syncing ? 'Syncing...' : 'Sync from POS/ERP'}
            </button>
          </div>
        </div>

        <div className="mk-camp-metrics-section">
          <div className="mk-camp-metrics-section-head">
            <span className="mk-camp-metrics-section-title">Manual POS / ERP entry</span>
            <span className="mk-camp-metrics-section-hint">
              Use when sync is unavailable — saves to the same campaign fields
            </span>
          </div>
          <div className="mk-camp-modal-grid">
            {erpFields.map(([key, label, hint]) => (
              <label key={key} className="mk-camp-field">
                <span>{label}</span>
                <input
                  type="number"
                  min="0"
                  step={key === 'budgetSpent' || key === 'revenueGenerated' ? '0.01' : '1'}
                  value={form[key]}
                  onChange={(e) => updateField(key, e.target.value)}
                  placeholder="0"
                />
                <small className="mk-camp-field-hint">{hint}</small>
              </label>
            ))}
          </div>
        </div>

        <div className="mk-camp-metrics-section">
          <div className="mk-camp-metrics-section-head">
            <span className="mk-camp-metrics-section-title">Ad platform metrics</span>
            <span className="mk-camp-metrics-section-hint">Meta, Google Ads, TikTok, etc.</span>
          </div>
          <div className="mk-camp-modal-grid mk-camp-modal-grid-2">
            {adFields.map(([key, label, hint]) => (
              <label key={key} className="mk-camp-field">
                <span>{label}</span>
                <input
                  type="number"
                  min="0"
                  value={form[key]}
                  onChange={(e) => updateField(key, e.target.value)}
                  placeholder="0"
                />
                <small className="mk-camp-field-hint">{hint}</small>
              </label>
            ))}
          </div>
        </div>

        {error ? <div className="mk-camp-error">{error}</div> : null}
        <div className="mk-camp-modal-foot">
          <button type="button" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="primary" onClick={save} disabled={saving}>
            {saving ? 'Saving...' : 'Save Metrics'}
          </button>
        </div>
      </div>
    </div>
  );
};

export const MarketingCampaigns = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const listPath = marketingSectionPath(location.pathname, 'campaigns');

  const canApproveCampaigns = user?.userType === 'platform_admin';
  const isMarketingStaff = user?.userType === 'marketing_user';

  const [campaigns, setCampaigns] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [workshopFilter, setWorkshopFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [workshops, setWorkshops] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [metricsCampaign, setMetricsCampaign] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [reviewCampaign, setReviewCampaign] = useState(null);
  const [reviewDetail, setReviewDetail] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await loadPromotionDropdownData();
        if (!active) return;
        setWorkshops(data.workshops);
        setBranches(data.branches);
      } catch {
        if (active) {
          setWorkshops([]);
          setBranches([]);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const branchFilterOptions = useMemo(() => {
    if (!workshopFilter) return branches;
    return branches.filter(
      (b) => !b.workshopId || String(b.workshopId) === String(workshopFilter),
    );
  }, [branches, workshopFilter]);

  const loadCampaigns = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await marketingListCampaigns({
        limit: 200,
        offset: 0,
        status: statusFilter,
        search: search.trim() || undefined,
        workshopId: workshopFilter || undefined,
        branchId: branchFilter || undefined,
      });
      const rows = res?.campaigns || res?.items || res?.data || [];
      setCampaigns(Array.isArray(rows) ? rows.map(normalizeCampaign) : []);
    } catch (err) {
      setError(err?.message || 'Failed to load campaigns.');
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, workshopFilter, branchFilter]);

  useEffect(() => {
    const t = setTimeout(loadCampaigns, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [loadCampaigns, search]);

  const togglePause = async (campaign) => {
    const next =
      String(campaign.status).toLowerCase() === 'active' ? 'paused' : 'active';
    try {
      await marketingChangeCampaignStatus(campaign.id, { status: next });
      await loadCampaigns();
    } catch (err) {
      alert(err?.message || 'Status change failed.');
    }
  };

  const handleDelete = async (campaign) => {
    if (!window.confirm(`Delete campaign "${campaign.name}"?`)) return;
    try {
      await marketingDeleteCampaign(campaign.id);
      await loadCampaigns();
    } catch (err) {
      alert(err?.message || 'Delete failed.');
    }
  };

  const isPendingApproval = (status) => {
    const s = String(status || '').toLowerCase();
    return s === 'pending_approval' || s === 'pending' || s === 'draft';
  };

  const openReview = async (campaign) => {
    setReviewCampaign(campaign);
    setReviewDetail(campaign);
    try {
      setReviewLoading(true);
      const res = await marketingGetCampaign(campaign.id);
      const row = res?.campaign || res?.data || res;
      if (row) {
        setReviewDetail({
          ...normalizeCampaign(row),
          notes: row.notes || row.description,
          description: row.description,
          createdByName: row.createdByUserName || row.submittedByName,
          submittedByName: row.submittedByName,
          startDate: row.startDate,
          endDate: row.endDate,
        });
      }
    } catch {
      setReviewDetail(campaign);
    } finally {
      setReviewLoading(false);
    }
  };

  const closeReview = () => {
    setReviewCampaign(null);
    setReviewDetail(null);
    setReviewLoading(false);
  };

  const confirmApprove = async () => {
    if (!reviewCampaign) return;
    try {
      setActionLoadingId(reviewCampaign.id);
      await marketingApproveCampaign(reviewCampaign.id);
      closeReview();
      await loadCampaigns();
    } catch (err) {
      alert(err?.message || 'Approve failed.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const confirmReject = async () => {
    if (!reviewCampaign) return;
    const reason = window.prompt(`Reject reason for "${reviewCampaign.name}":`);
    if (!reason?.trim()) return;
    try {
      setActionLoadingId(reviewCampaign.id);
      await marketingRejectCampaign(reviewCampaign.id, {
        rejectionReason: reason.trim(),
      });
      closeReview();
      await loadCampaigns();
    } catch (err) {
      alert(err?.message || 'Reject failed.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const pendingCount = useMemo(
    () => campaigns.filter((c) => isPendingApproval(c.status)).length,
    [campaigns],
  );

  return (
    <div className="mk-page mk-camp-page">
      <div className="mk-camp-toolbar">
        <label className="mk-camp-search">
          <Search size={14} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search campaigns..."
          />
        </label>

        <select
          className="mk-camp-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="pending_approval">Pending Approval</option>
          <option value="approved">Approved</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="completed">Completed</option>
          <option value="rejected">Rejected</option>
        </select>

        <select
          className="mk-camp-select mk-camp-filter-select"
          value={workshopFilter}
          onChange={(e) => {
            setWorkshopFilter(e.target.value);
            setBranchFilter('');
          }}
        >
          <option value="">All Workshops</option>
          {workshops.map((w) => (
            <option key={w.id} value={w.id}>
              {w.label}
            </option>
          ))}
        </select>

        <select
          className="mk-camp-select mk-camp-filter-select"
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
        >
          <option value="">All Branches</option>
          {branchFilterOptions.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          className="mk-camp-new-btn"
          onClick={() => navigate(`${listPath}/new`)}
        >
          <Plus size={15} /> New Campaign
        </button>
      </div>

      {error ? (
        <div className="mk-camp-error-banner">
          <AlertCircle size={15} /> {error}
        </div>
      ) : null}

      {canApproveCampaigns && pendingCount > 0 ? (
        <div className="mk-camp-pending-banner">
          <AlertCircle size={15} />
          <span>
            <strong>{pendingCount}</strong> campaign{pendingCount === 1 ? '' : 's'} awaiting
            <strong> Super Admin approval</strong> — open review from Actions to see full details.
          </span>
        </div>
      ) : null}

      {isMarketingStaff && pendingCount > 0 ? (
        <div className="mk-camp-pending-banner mk-camp-marketing-banner">
          <AlertCircle size={15} />
          <span>
            <strong>{pendingCount}</strong> of your campaigns are pending Super Admin approval.
            You cannot approve your own campaigns.
          </span>
        </div>
      ) : null}

      <div className="mk-camp-table-card">
        {loading ? (
          <div className="mk-camp-empty">
            <Loader2 size={28} className="mk-camp-spin" />
            <p>Loading campaigns...</p>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="mk-camp-empty">
            <p>No campaigns found</p>
            <button
              type="button"
              className="mk-camp-new-btn"
              onClick={() => navigate(`${listPath}/new`)}
            >
              <Plus size={14} /> Create your first campaign
            </button>
          </div>
        ) : (
          <div className="mk-camp-table-wrap">
            <table className="mk-camp-table">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Workshop</th>
                  <th>Branches</th>
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
                {campaigns.map((c) => {
                  const isActive = String(c.status).toLowerCase() === 'active';
                  const isPaused = String(c.status).toLowerCase() === 'paused';
                  const pending = isPendingApproval(c.status);
                  const acting = actionLoadingId === c.id;
                  return (
                    <tr key={c.id}>
                      <td>
                        <strong>{c.name}</strong>
                      </td>
                      <td>{c.workshopName || '—'}</td>
                      <td>{resolveBranchLabels(c.targetBranchIds, branches)}</td>
                      <td>{humanize(c.platform)}</td>
                      <td>{humanize(c.type)}</td>
                      <td>{formatSar(c.budget)}</td>
                      <td>{formatSar(c.spent)}</td>
                      <td>{formatSar(c.revenue)}</td>
                      <td>
                        <span className={statusBadgeClass(c.status)}>
                          {humanize(c.status)}
                        </span>
                      </td>
                      <td>
                        <div className="mk-camp-actions">
                          {canApproveCampaigns && pending ? (
                            <>
                              <button
                                type="button"
                                title="Review & approve"
                                className="approve"
                                disabled={acting}
                                onClick={() => openReview(c)}
                              >
                                <CheckCircle size={14} />
                              </button>
                              <button
                                type="button"
                                title="Review & reject"
                                className="reject"
                                disabled={acting}
                                onClick={() => openReview(c)}
                              >
                                <XCircle size={14} />
                              </button>
                            </>
                          ) : null}
                          {!canApproveCampaigns && pending ? (
                            <span className="mk-camp-awaiting-pill" title="Awaiting Super Admin">
                              Awaiting SA
                            </span>
                          ) : null}
                          <button
                            type="button"
                            title="Edit"
                            onClick={() => navigate(`${listPath}/${c.id}/edit`)}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            title="Update metrics"
                            onClick={() => setMetricsCampaign(c)}
                          >
                            <BarChart3 size={14} />
                          </button>
                          {(isActive || isPaused) && (
                            <button
                              type="button"
                              title={isActive ? 'Pause' : 'Activate'}
                              onClick={() => togglePause(c)}
                            >
                              {isActive ? (
                                <Pause size={14} />
                              ) : (
                                <Play size={14} />
                              )}
                            </button>
                          )}
                          <button
                            type="button"
                            title="Delete"
                            className="danger"
                            onClick={() => handleDelete(c)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {metricsCampaign ? (
        <MetricsModal
          campaign={metricsCampaign}
          onClose={() => setMetricsCampaign(null)}
          onSaved={loadCampaigns}
        />
      ) : null}

      {reviewCampaign ? (
        <CampaignApprovalModal
          campaign={reviewDetail || reviewCampaign}
          branches={branches}
          loading={reviewLoading}
          onClose={closeReview}
          onApprove={confirmApprove}
          onReject={confirmReject}
          acting={actionLoadingId === reviewCampaign.id}
        />
      ) : null}

      <style>{`
        .mk-camp-page { padding: 18px 22px 32px; }
        .mk-camp-toolbar { display:flex; align-items:center; gap:10px; margin-bottom:14px; flex-wrap:wrap; }
        .mk-camp-search { flex:1; min-width:200px; max-width:320px; height:36px; border:1px solid #dbe1ea; border-radius:8px; display:flex; align-items:center; gap:8px; padding:0 12px; background:#fff; }
        .mk-camp-search input { border:0; outline:none; width:100%; font-size:13px; font-family:inherit; }
        .mk-camp-select { height:36px; border:1px solid #dbe1ea; border-radius:8px; padding:0 10px; font-size:12px; font-weight:650; background:#fff; max-width:180px; }
        .mk-camp-filter-select { min-width: 150px; }
        .mk-camp-new-btn { margin-left:auto; display:inline-flex; align-items:center; gap:7px; border:0; border-radius:8px; background:#d9ad18; color:#fff; font-weight:800; font-size:13px; padding:9px 16px; cursor:pointer; }
        .mk-camp-error-banner { display:flex; align-items:center; gap:8px; background:#fef2f2; border:1px solid #fecaca; color:#b91c1c; border-radius:8px; padding:10px 12px; font-size:12.5px; margin-bottom:12px; }
        .mk-camp-pending-banner { display:flex; align-items:flex-start; gap:8px; background:#fffbeb; border:1px solid #fde68a; color:#92400e; border-radius:8px; padding:10px 12px; font-size:12.5px; margin-bottom:12px; }
        .mk-camp-marketing-banner { background:#eff6ff; border-color:#bfdbfe; color:#1e40af; }
        .mk-camp-awaiting-pill { font-size:9px; font-weight:800; text-transform:uppercase; color:#64748b; background:#f1f5f9; border:1px solid #e2e8f0; border-radius:10px; padding:4px 7px; white-space:nowrap; }
        .mk-camp-review-modal { max-width: 620px; }
        .mk-camp-review-lead { margin:0 0 12px; font-size:12px; color:#64748b; line-height:1.45; }
        .mk-camp-review-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px 16px; margin-bottom:16px; }
        .mk-camp-review-grid div span { display:block; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.4px; color:#94a3b8; margin-bottom:2px; }
        .mk-camp-review-grid div strong { font-size:12.5px; color:#0f172a; font-weight:700; }
        .mk-camp-review-full { grid-column: 1 / -1; }
        .mk-camp-review-reject { border:1px solid #fecaca !important; background:#fef2f2 !important; color:#dc2626 !important; display:inline-flex; align-items:center; gap:6px; border-radius:8px; padding:8px 14px; font-weight:700; font-size:12px; cursor:pointer; }
        .mk-camp-pending-link { border:0; background:transparent; color:#b45309; font-weight:800; text-decoration:underline; cursor:pointer; padding:0; font-size:inherit; }
        .mk-camp-table-card { background:#fff; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden; }
        .mk-camp-table-wrap { overflow-x:auto; }
        .mk-camp-table { width:100%; border-collapse:collapse; font-size:12.5px; }
        .mk-camp-table th { text-align:left; padding:11px 14px; font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.6px; color:#64748b; border-bottom:1px solid #e2e8f0; background:#f8fafc; white-space:nowrap; }
        .mk-camp-table td { padding:12px 14px; border-bottom:1px solid #f1f5f9; color:#0f172a; vertical-align:middle; }
        .mk-camp-table td strong { font-weight:800; }
        .mk-camp-status { display:inline-block; font-size:10px; font-weight:800; text-transform:lowercase; padding:3px 9px; border-radius:12px; }
        .mk-camp-status.active { background:#dcfce7; color:#15803d; }
        .mk-camp-status.approved { background:#dbeafe; color:#1d4ed8; }
        .mk-camp-status.paused { background:#fef3c7; color:#b45309; }
        .mk-camp-status.pending { background:#f1f5f9; color:#64748b; }
        .mk-camp-status.rejected { background:#fee2e2; color:#b91c1c; }
        .mk-camp-actions { display:flex; gap:6px; }
        .mk-camp-actions button { width:30px; height:30px; border:1px solid #e2e8f0; border-radius:7px; background:#fff; color:#475569; display:inline-flex; align-items:center; justify-content:center; cursor:pointer; }
        .mk-camp-actions button:hover { background:#f8fafc; }
        .mk-camp-actions button.approve { color:#15803d; border-color:#bbf7d0; background:#f0fdf4; }
        .mk-camp-actions button.reject { color:#dc2626; border-color:#fecaca; background:#fef2f2; }
        .mk-camp-actions button.danger { color:#dc2626; border-color:#fecaca; }
        .mk-camp-empty { padding:48px 20px; text-align:center; color:#94a3b8; display:flex; flex-direction:column; align-items:center; gap:12px; }
        .mk-camp-spin { animation: mk-camp-spin 1s linear infinite; }
        @keyframes mk-camp-spin { to { transform: rotate(360deg); } }
        .mk-camp-modal-overlay { position:fixed; inset:0; background:rgba(15,23,42,.5); display:flex; align-items:center; justify-content:center; z-index:1200; padding:16px; }
        .mk-camp-modal { background:#fff; border-radius:12px; width:100%; max-width:480px; padding:18px; }
        .mk-camp-modal-wide { max-width: 560px; }
        .mk-camp-erp-panel { display:flex; gap:12px; justify-content:space-between; align-items:flex-start; background:#fffbeb; border:1px solid #fde68a; border-radius:10px; padding:12px 14px; margin-bottom:14px; }
        .mk-camp-erp-panel strong { display:block; font-size:12px; margin-bottom:4px; color:#92400e; }
        .mk-camp-erp-panel p { margin:0; font-size:11.5px; line-height:1.45; color:#78350f; }
        .mk-camp-erp-warn { margin-top:8px !important; color:#b45309 !important; font-weight:700; }
        .mk-camp-erp-summary { margin-top:8px !important; color:#15803d !important; font-weight:700; }
        .mk-camp-erp-actions { display:flex; flex-direction:column; gap:8px; flex-shrink:0; }
        .mk-camp-erp-btn { display:inline-flex; align-items:center; gap:6px; border:1px solid #e2e8f0; background:#fff; border-radius:8px; padding:8px 12px; font-size:11px; font-weight:700; cursor:pointer; white-space:nowrap; }
        .mk-camp-erp-btn.primary { background:#d9ad18; border-color:#d9ad18; color:#fff; }
        .mk-camp-erp-btn:disabled { opacity:0.55; cursor:not-allowed; }
        .mk-camp-metrics-section { margin-bottom: 14px; }
        .mk-camp-metrics-section-head { display:flex; align-items:baseline; justify-content:space-between; gap:10px; margin-bottom:10px; flex-wrap:wrap; }
        .mk-camp-metrics-section-title { font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.5px; color:#475569; }
        .mk-camp-metrics-section-hint { font-size:10.5px; color:#94a3b8; }
        .mk-camp-modal-grid-2 { grid-template-columns: 1fr 1fr; }
        .mk-camp-field-hint { display:block; margin-top:4px; font-size:10px; color:#94a3b8; line-height:1.3; font-weight:500; }
        .mk-camp-modal-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; }
        .mk-camp-modal-head h3 { margin:0; font-size:14px; display:flex; align-items:center; gap:8px; }
        .mk-camp-modal-close { border:0; background:transparent; cursor:pointer; color:#94a3b8; }
        .mk-camp-modal-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        .mk-camp-field span { display:block; font-size:11px; font-weight:700; color:#64748b; margin-bottom:4px; }
        .mk-camp-field input { width:100%; height:36px; border:1px solid #e2e8f0; border-radius:8px; padding:0 10px; font-size:13px; box-sizing:border-box; }
        .mk-camp-modal-foot { display:flex; justify-content:flex-end; gap:8px; margin-top:16px; }
        .mk-camp-modal-foot button { border:1px solid #e2e8f0; background:#fff; border-radius:8px; padding:8px 14px; font-weight:700; font-size:12px; cursor:pointer; }
        .mk-camp-modal-foot button.primary { background:#d9ad18; border-color:#d9ad18; color:#fff; }
        .mk-camp-error { color:#b91c1c; font-size:12px; margin-top:10px; }
      `}</style>
    </div>
  );
};

export default MarketingCampaigns;
