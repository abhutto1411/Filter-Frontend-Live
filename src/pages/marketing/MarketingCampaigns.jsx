import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import {
  Plus,
  Search,
  Loader2,
  AlertTriangle,
  Pencil,
  BarChart3,
  Pause,
  Play,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Megaphone,
} from 'lucide-react';
import Modal from '../../components/Modal';
import UiPager from '../../components/UiPager';
import { useServerPaging } from '../../hooks/usePagedRows';
import { BUSINESS_TIMEZONE } from '../../utils/riyadhBusinessRange';
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
import {
  mktCampT,
  mktCampMoney,
  mktCampStatusLabel,
  mktCampPlatformLabel,
  mktCampTypeLabel,
} from '../../utils/marketingCampaignsI18n';
import { marketingSectionPath } from './marketingRouteUtils';
import { loadPromotionDropdownData } from './marketingPromotionShared';
import { useAuth } from '../../context/AuthContext';
import '../../styles/ui.css';

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function useMarketingLocale() {
  const outletCtx = useOutletContext() || {};
  return (
    outletCtx.locale ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('marketing-locale') : null) ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
    'en'
  );
}

const STATUS_TONE = {
  active: 'ok',
  approved: 'info',
  paused: 'warn',
  rejected: 'dang',
  cancelled: 'dang',
  pending_approval: 'neutral',
  draft: 'neutral',
};

function statusTone(status) {
  return STATUS_TONE[String(status || '').toLowerCase()] ?? 'neutral';
}

function normalizeCampaign(row, defaultName) {
  const branchIds = Array.isArray(row?.targetBranchIds)
    ? row.targetBranchIds.map(String)
    : [];
  return {
    id: String(row?.id ?? ''),
    name: row?.campaignName || row?.name || row?.title || defaultName,
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

function resolveBranchLabels(branchIds, branchOptions, t) {
  if (!branchIds?.length) return t('dash');
  const labels = branchIds
    .map((id) => branchOptions.find((b) => b.id === id || b.realId === id)?.label)
    .filter(Boolean);
  if (!labels.length) return t('list.branchCount', { count: branchIds.length });
  if (labels.length <= 2) return labels.join(', ');
  return t('list.branchesCount', { count: labels.length });
}

/** Rendered in the business timezone, so a start date never shifts a day. */
function formatCampaignDate(value, locale, t) {
  if (!value) return t('dash');
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
    timeZone: BUSINESS_TIMEZONE,
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
}

/**
 * Review a campaign waiting for approval, and reject it with a reason.
 *
 * The reason is a field in this modal. It used to come from `window.prompt`,
 * which a browser can block outright and which offers no validation — an empty
 * or whitespace reason simply cancelled with no explanation.
 */
const CampaignApprovalModal = ({
  campaign,
  branches,
  loading,
  onClose,
  onApprove,
  onReject,
  acting,
}) => {
  const locale = useMarketingLocale();
  const t = useCallback((key, vars) => mktCampT(locale, key, vars), [locale]);
  const c = campaign || {};
  const branchLabels = resolveBranchLabels(c.targetBranchIds, branches, t);

  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  const facts = [
    [t('review.campaign'), c.name],
    [t('review.status'), mktCampStatusLabel(locale, c.status)],
    [t('review.workshop'), c.workshopName || t('dash')],
    [t('review.branches'), branchLabels],
    [t('review.platform'), mktCampPlatformLabel(locale, c.platform)],
    [t('review.type'), mktCampTypeLabel(locale, c.type)],
    [t('review.budget'), mktCampMoney(locale, c.budget)],
    [
      t('review.spentRevenue'),
      `${mktCampMoney(locale, c.spent)} / ${mktCampMoney(locale, c.revenue)}`,
    ],
    [t('review.startDate'), formatCampaignDate(c.startDate, locale, t)],
    [t('review.endDate'), formatCampaignDate(c.endDate, locale, t)],
    [t('review.createdBy'), c.createdByName || c.submittedByName || t('dash')],
    [t('review.notes'), c.notes || c.description || t('dash')],
  ];

  return (
    <Modal
      title={t('review.title')}
      onClose={onClose}
      width="min(680px, 96vw)"
      contentClassName="ui-tokens"
      footer={(
        <>
          <button
            type="button"
            className="ui-btn ui-btn--default"
            onClick={rejecting ? () => setRejecting(false) : onClose}
            disabled={acting}
          >
            {t('review.cancel')}
          </button>
          {rejecting ? (
            <button
              type="button"
              className="ui-btn ui-btn--danger"
              onClick={() => onReject(reason.trim())}
              disabled={acting || !reason.trim()}
            >
              <XCircle size={14} /> {t('review.reject')}
            </button>
          ) : (
            <>
              <button
                type="button"
                className="ui-btn ui-btn--danger"
                onClick={() => setRejecting(true)}
                disabled={acting || loading}
              >
                <XCircle size={14} /> {t('review.reject')}
              </button>
              <button
                type="button"
                className="ui-btn ui-btn--primary"
                onClick={onApprove}
                disabled={acting || loading}
              >
                <CheckCircle size={14} /> {t('review.approve')}
              </button>
            </>
          )}
        </>
      )}
    >
      {loading ? (
        <div className="ui-stack-sm" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={`sk-${i}`} className="ui-sk-row">
              <div className="ui-sk ui-sk--text ui-sk--w90" />
            </div>
          ))}
        </div>
      ) : (
        <div className="ui-stack">
          <p className="ui-help">{t('review.lead')}</p>

          <div className="ui-fields">
            {facts.map(([label, value]) => (
              <div key={label} className="ui-fieldro">
                <span className="ui-fieldro-label">{label}</span>
                <span className="ui-fieldro-value">{value}</span>
              </div>
            ))}
          </div>

          {rejecting ? (
            <div className="ui-field">
              <label htmlFor="mc-reject-reason">
                {t('review.reasonLabel')}
              </label>
              <textarea
                id="mc-reject-reason"
                className="ui-textarea"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t('review.reasonPlaceholder')}
              />
              <p className="ui-help">{t('review.reasonRequired')}</p>
            </div>
          ) : null}
        </div>
      )}
    </Modal>
  );
};

const MetricsModal = ({ campaign, onClose, onSaved }) => {
  const locale = useMarketingLocale();
  const t = useCallback((key, vars) => mktCampT(locale, key, vars), [locale]);
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
      setError(err?.message || t('metrics.errPreview'));
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
      setError(err?.message || t('metrics.errSync'));
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
      setError(err?.message || t('metrics.errSave'));
    } finally {
      setSaving(false);
    }
  };

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (['budgetSpent', 'revenueGenerated', 'leadsCount', 'conversionsCount'].includes(key)) {
      setErpInfo(t('metrics.manualNote'));
    }
  };

  const erpFields = [
    ['budgetSpent', 'metrics.field.budgetSpent', 'metrics.hint.budgetSpent'],
    ['revenueGenerated', 'metrics.field.revenueGenerated', 'metrics.hint.revenueGenerated'],
    ['leadsCount', 'metrics.field.leadsCount', 'metrics.hint.leadsCount'],
    ['conversionsCount', 'metrics.field.conversionsCount', 'metrics.hint.conversionsCount'],
  ];

  const adFields = [
    ['impressions', 'metrics.field.impressions', 'metrics.hint.impressions'],
    ['clicks', 'metrics.field.clicks', 'metrics.hint.clicks'],
  ];

  const hasTargeting =
    Boolean(campaign?.workshopId) || (campaign?.targetBranchIds?.length ?? 0) > 0;

  const numberField = ([key, labelKey, hintKey], money = false) => (
    <div key={key} className="ui-field ui-col-6">
      <label htmlFor={`mc-metric-${key}`}>{t(labelKey)}</label>
      <input
        id={`mc-metric-${key}`}
        className="ui-input ui-input--figure"
        type="number"
        min="0"
        step={money ? '0.01' : '1'}
        value={form[key]}
        onChange={(e) => updateField(key, e.target.value)}
        placeholder="0"
      />
      <p className="ui-help">{t(hintKey)}</p>
    </div>
  );

  return (
    <Modal
      title={t('metrics.title', { name: campaign.name })}
      onClose={onClose}
      width="min(680px, 96vw)"
      contentClassName="ui-tokens"
      footer={(
        <>
          <button type="button" className="ui-btn ui-btn--default" onClick={onClose} disabled={saving}>
            {t('metrics.cancel')}
          </button>
          <button type="button" className="ui-btn ui-btn--primary" onClick={save} disabled={saving}>
            {saving ? <Loader2 size={14} className="ui-spin" /> : null}
            {saving ? t('metrics.saving') : t('metrics.save')}
          </button>
        </>
      )}
    >
      <div className="ui-stack">
        <div className="ui-banner ui-banner--warn">
          <BarChart3 size={14} />
          <div className="ui-stack-sm">
            <div>
              <strong>{t('metrics.erpTitle')}</strong>
              <p className="ui-help">{t('metrics.erpBody')}</p>
            </div>
            {!hasTargeting ? <p className="ui-help">{t('metrics.erpWarn')}</p> : null}
            {erpInfo ? <p className="ui-help">{erpInfo}</p> : null}
            <div className="ui-row">
              <button
                type="button"
                className="ui-btn ui-btn--default ui-btn--sm"
                onClick={previewErp}
                disabled={previewing || syncing || !hasTargeting}
              >
                <RefreshCw size={14} className={previewing ? 'ui-spin' : ''} />
                {previewing ? t('metrics.previewLoading') : t('metrics.preview')}
              </button>
              <button
                type="button"
                className="ui-btn ui-btn--primary ui-btn--sm"
                onClick={syncErp}
                disabled={syncing || previewing || !hasTargeting}
              >
                <RefreshCw size={14} className={syncing ? 'ui-spin' : ''} />
                {syncing ? t('metrics.syncing') : t('metrics.sync')}
              </button>
            </div>
          </div>
        </div>

        <section className="ui-subgroup">
          <div className="ui-subgroup-title">{t('metrics.manualTitle')}</div>
          <p className="ui-help">{t('metrics.manualHint')}</p>
          <div className="ui-form-grid">
            {erpFields.map((f) =>
              numberField(f, f[0] === 'budgetSpent' || f[0] === 'revenueGenerated'),
            )}
          </div>
        </section>

        <section className="ui-subgroup">
          <div className="ui-subgroup-title">{t('metrics.adTitle')}</div>
          <p className="ui-help">{t('metrics.adHint')}</p>
          <div className="ui-form-grid">
            {adFields.map((f) => numberField(f))}
          </div>
        </section>

        {error ? (
          <div className="ui-banner ui-banner--dang">
            <AlertTriangle size={14} />
            <span>{error}</span>
          </div>
        ) : null}
      </div>
    </Modal>
  );
};

export const MarketingCampaigns = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const locale = useMarketingLocale();
  const t = useCallback((key, vars) => mktCampT(locale, key, vars), [locale]);
  const listPath = marketingSectionPath(location.pathname, 'campaigns');
  const defaultCampaignName = t('campaign.default');

  const canApproveCampaigns = user?.userType === 'platform_admin';
  const isMarketingStaff = user?.userType === 'marketing_user';

  const [campaigns, setCampaigns] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
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
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

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

  const resetKey = [statusFilter, workshopFilter, branchFilter, debouncedSearch].join('|');
  const { page, pageSize, pagerFor } = useServerPaging({ resetKey });

  /**
   * One page at a time. This asked for `limit: 200, offset: 0` and rendered
   * whatever came back, so a campaign past the 200th could not be opened,
   * approved, paused or deleted from this screen at all — even though the
   * endpoint has always returned a `total` and honoured `offset`.
   */
  const loadCampaigns = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await marketingListCampaigns({
        limit: pageSize,
        offset: (page - 1) * pageSize,
        status: statusFilter,
        search: debouncedSearch || undefined,
        workshopId: workshopFilter || undefined,
        branchId: branchFilter || undefined,
      });
      const rows = res?.campaigns || res?.items || res?.data || [];
      setCampaigns(
        Array.isArray(rows)
          ? rows.map((row) => normalizeCampaign(row, defaultCampaignName))
          : [],
      );
      setTotal(toNumber(res?.total, Array.isArray(rows) ? rows.length : 0));
    } catch (err) {
      setError(err?.message || t('list.errLoad'));
      setCampaigns([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [
    debouncedSearch, statusFilter, workshopFilter, branchFilter,
    page, pageSize, defaultCampaignName, t,
  ]);

  useEffect(() => {
    void loadCampaigns();
  }, [loadCampaigns]);

  // Every failure below lands in the page banner. These used to call alert(),
  // which a browser can suppress and which loses the message on dismiss.
  const togglePause = async (campaign) => {
    const next =
      String(campaign.status).toLowerCase() === 'active' ? 'paused' : 'active';
    setError('');
    try {
      await marketingChangeCampaignStatus(campaign.id, { status: next });
      await loadCampaigns();
    } catch (err) {
      setError(err?.message || t('list.errStatus'));
    }
  };

  const handleDelete = async (campaign) => {
    if (!window.confirm(t('list.confirmDelete', { name: campaign.name }))) return;
    setError('');
    try {
      await marketingDeleteCampaign(campaign.id);
      await loadCampaigns();
    } catch (err) {
      setError(err?.message || t('list.errDelete'));
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
          ...normalizeCampaign(row, defaultCampaignName),
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
    setError('');
    try {
      setActionLoadingId(reviewCampaign.id);
      await marketingApproveCampaign(reviewCampaign.id);
      closeReview();
      await loadCampaigns();
    } catch (err) {
      setError(err?.message || t('list.errApprove'));
    } finally {
      setActionLoadingId(null);
    }
  };

  const confirmReject = async (reason) => {
    if (!reviewCampaign || !reason) return;
    setError('');
    try {
      setActionLoadingId(reviewCampaign.id);
      await marketingRejectCampaign(reviewCampaign.id, { rejectionReason: reason });
      closeReview();
      await loadCampaigns();
    } catch (err) {
      setError(err?.message || t('list.errReject'));
    } finally {
      setActionLoadingId(null);
    }
  };

  const pendingCount = useMemo(
    () => campaigns.filter((c) => isPendingApproval(c.status)).length,
    [campaigns],
  );

  return (
    <div className="ui-root ui-root--flush ui-stack">
      <div className="ui-row ui-row--fields">
        <div className="ui-field ui-field--grow">
          <label htmlFor="mc-search">{t('list.searchLabel')}</label>
          <div className="ui-search">
            <Search size={15} />
            <input
              id="mc-search"
              className="ui-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('list.searchPlaceholder')}
            />
          </div>
        </div>

        <div className="ui-field">
          <label htmlFor="mc-status">{t('list.statusLabel')}</label>
          <select
            id="mc-status"
            className="ui-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">{t('status.all')}</option>
            <option value="draft">{t('status.draft')}</option>
            <option value="pending_approval">{t('status.pending_approval')}</option>
            <option value="approved">{t('status.approved')}</option>
            <option value="active">{t('status.active')}</option>
            <option value="paused">{t('status.paused')}</option>
            <option value="completed">{t('status.completed')}</option>
            <option value="rejected">{t('status.rejected')}</option>
          </select>
        </div>

        <div className="ui-field">
          <label htmlFor="mc-workshop">{t('list.th.workshop')}</label>
          <select
            id="mc-workshop"
            className="ui-select"
            value={workshopFilter}
            onChange={(e) => {
              setWorkshopFilter(e.target.value);
              setBranchFilter('');
            }}
          >
            <option value="">{t('list.allWorkshops')}</option>
            {workshops.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label}
              </option>
            ))}
          </select>
        </div>

        <div className="ui-field">
          <label htmlFor="mc-branch">{t('list.th.branches')}</label>
          <select
            id="mc-branch"
            className="ui-select"
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
          >
            <option value="">{t('list.allBranches')}</option>
            {branchFilterOptions.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
        </div>

        <div className="ui-toolbar-end">
          <button
            type="button"
            className="ui-btn ui-btn--primary"
            onClick={() => navigate(`${listPath}/new`)}
          >
            <Plus size={15} /> {t('list.newCampaign')}
          </button>
        </div>
      </div>

      {error ? (
        <div className="ui-banner ui-banner--dang" role="alert">
          <AlertTriangle size={14} />
          <span>{error}</span>
        </div>
      ) : null}

      {canApproveCampaigns && pendingCount > 0 ? (
        <div className="ui-banner ui-banner--warn">
          <AlertTriangle size={14} />
          <span>
            {t('list.pendingAdmin', {
              count: pendingCount,
              plural: pendingCount === 1 ? '' : 's',
            })}
          </span>
        </div>
      ) : null}

      {isMarketingStaff && pendingCount > 0 ? (
        <div className="ui-banner ui-banner--info">
          <AlertTriangle size={14} />
          <span>{t('list.pendingMarketing', { count: pendingCount })}</span>
        </div>
      ) : null}

      <div className="ui-table-wrap ui-table-wrap--scroll">
        <table className="ui-table">
          <thead>
            <tr>
              <th>{t('list.th.campaign')}</th>
              <th>{t('list.th.workshop')}</th>
              <th>{t('list.th.branches')}</th>
              <th>{t('list.th.platform')}</th>
              <th>{t('list.th.type')}</th>
              <th>{t('list.th.budget')}</th>
              <th>{t('list.th.spent')}</th>
              <th>{t('list.th.revenue')}</th>
              <th>{t('list.th.status')}</th>
              <th>{t('list.th.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={`sk-${i}`} className="ui-sk-row">
                  <td><div className="ui-sk ui-sk--strong ui-sk--w90" /></td>
                  <td><div className="ui-sk ui-sk--text ui-sk--w70" /></td>
                  <td><div className="ui-sk ui-sk--text ui-sk--w55" /></td>
                  <td><div className="ui-sk ui-sk--text ui-sk--w55" /></td>
                  <td><div className="ui-sk ui-sk--text ui-sk--w70" /></td>
                  <td><div className="ui-sk ui-sk--text ui-sk--w40" /></td>
                  <td><div className="ui-sk ui-sk--text ui-sk--w40" /></td>
                  <td><div className="ui-sk ui-sk--text ui-sk--w40" /></td>
                  <td><div className="ui-sk ui-sk--pill" /></td>
                  <td><div className="ui-sk ui-sk--btn" /></td>
                </tr>
              ))
            ) : campaigns.length === 0 ? (
              <tr>
                <td colSpan={10}>
                  <div className="ui-empty">
                    <div className="ui-empty-icon"><Megaphone size={18} /></div>
                    <div className="ui-empty-title">{t('list.empty')}</div>
                    <button
                      type="button"
                      className="ui-btn ui-btn--primary"
                      onClick={() => navigate(`${listPath}/new`)}
                    >
                      <Plus size={14} /> {t('list.createFirst')}
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              campaigns.map((c) => {
                const isActive = String(c.status).toLowerCase() === 'active';
                const isPaused = String(c.status).toLowerCase() === 'paused';
                const pending = isPendingApproval(c.status);
                const acting = actionLoadingId === c.id;
                return (
                  <tr key={c.id}>
                    <td data-label={t('list.th.campaign')} className="ui-strong">{c.name}</td>
                    <td data-label={t('list.th.workshop')}>{c.workshopName || t('dash')}</td>
                    <td data-label={t('list.th.branches')}>
                      {resolveBranchLabels(c.targetBranchIds, branches, t)}
                    </td>
                    <td data-label={t('list.th.platform')}>
                      {mktCampPlatformLabel(locale, c.platform)}
                    </td>
                    <td data-label={t('list.th.type')}>{mktCampTypeLabel(locale, c.type)}</td>
                    <td data-label={t('list.th.budget')} className="ui-num">
                      {mktCampMoney(locale, c.budget)}
                    </td>
                    <td data-label={t('list.th.spent')} className="ui-num ui-money ui-money--out">
                      {mktCampMoney(locale, c.spent)}
                    </td>
                    <td data-label={t('list.th.revenue')} className="ui-num ui-money ui-money--in">
                      {mktCampMoney(locale, c.revenue)}
                    </td>
                    <td data-label={t('list.th.status')}>
                      <span className={`ui-pill ui-pill--${statusTone(c.status)}`}>
                        {mktCampStatusLabel(locale, c.status)}
                      </span>
                    </td>
                    <td data-label={t('list.th.actions')}>
                      <div className="ui-rowacts">
                        {/* One Review button. There were two — a tick and a
                            cross — and both opened the same modal. */}
                        {canApproveCampaigns && pending ? (
                          <button
                            type="button"
                            className="ui-btn ui-btn--default ui-btn--sm"
                            title={t('list.action.review')}
                            disabled={acting}
                            onClick={() => openReview(c)}
                          >
                            <CheckCircle size={14} /> {t('list.action.review')}
                          </button>
                        ) : null}
                        {!canApproveCampaigns && pending ? (
                          <span className="ui-pill ui-pill--neutral" title={t('list.awaitingSaTitle')}>
                            {t('list.awaitingSa')}
                          </span>
                        ) : null}
                        <button
                          type="button"
                          className="ui-btn ui-btn--default ui-btn--sm ui-btn--icon"
                          title={t('list.action.edit')}
                          aria-label={t('list.action.edit')}
                          onClick={() => navigate(`${listPath}/${c.id}/edit`)}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          className="ui-btn ui-btn--default ui-btn--sm ui-btn--icon"
                          title={t('list.action.metrics')}
                          aria-label={t('list.action.metrics')}
                          onClick={() => setMetricsCampaign(c)}
                        >
                          <BarChart3 size={14} />
                        </button>
                        {(isActive || isPaused) && (
                          <button
                            type="button"
                            className="ui-btn ui-btn--default ui-btn--sm ui-btn--icon"
                            title={isActive ? t('list.action.pause') : t('list.action.activate')}
                            aria-label={isActive ? t('list.action.pause') : t('list.action.activate')}
                            onClick={() => togglePause(c)}
                          >
                            {isActive ? <Pause size={14} /> : <Play size={14} />}
                          </button>
                        )}
                        <button
                          type="button"
                          className="ui-btn ui-btn--danger ui-btn--sm ui-btn--icon"
                          title={t('list.action.delete')}
                          aria-label={t('list.action.delete')}
                          onClick={() => handleDelete(c)}
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
        <UiPager {...pagerFor(total)} />
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
    </div>
  );
};

export default MarketingCampaigns;
