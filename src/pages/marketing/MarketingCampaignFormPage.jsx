import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  useLocation,
  useNavigate,
  useOutletContext,
  useParams,
} from 'react-router-dom';

import { Building2, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  marketingCreateCampaign,
  marketingGetCampaign,
  marketingUpdateCampaign,
} from '../../services/superAdminMarketingApi';
import { mktCampT } from '../../utils/marketingCampaignsI18n';
import { MarketingFormShell } from './MarketingFormShell';
import { marketingSectionPath } from './marketingRouteUtils';
import {
  loadPromotionDropdownData,
  SelectField,
  SingleSelectApiField,
  MultiSelectApiField,
} from './marketingPromotionShared';
import './MarketingUniversal.css';

const EMPTY = {
  campaignName: '',
  platform: 'meta',
  campaignType: 'brand_awareness',
  startDate: '',
  endDate: '',
  budgetAllocated: '0',
  notes: '',
  workshopId: '',
  targetBranchIds: [],
};

function toDateInput(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toISOString().slice(0, 10);
}

export default function MarketingCampaignFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const listPath = marketingSectionPath(location.pathname, 'campaigns');
  const outletCtx = useOutletContext() || {};
  const locale =
    outletCtx.locale ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('marketing-locale') : null) ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
    'en';
  const t = useCallback((key, vars) => mktCampT(locale, key, vars), [locale]);

  const PLATFORMS = useMemo(
    () => [
      { value: 'meta', label: t('platform.meta') },
      { value: 'google_ads', label: t('platform.google_ads') },
      { value: 'tiktok', label: t('platform.tiktok') },
      { value: 'snapchat', label: t('platform.snapchat') },
      { value: 'influencer', label: t('platform.influencer') },
      { value: 'offline', label: t('platform.offline') },
    ],
    [t],
  );

  const TYPES = useMemo(
    () => [
      { value: 'brand_awareness', label: t('type.brand_awareness') },
      { value: 'lead_generation', label: t('type.lead_generation') },
      { value: 'conversion', label: t('type.conversion') },
      { value: 'retention', label: t('type.retention') },
      { value: 'seasonal', label: t('type.seasonal') },
    ],
    [t],
  );

  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [workshops, setWorkshops] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loadingDropdowns, setLoadingDropdowns] = useState(true);
  const [dropdownError, setDropdownError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoadingDropdowns(true);
        setDropdownError('');
        const data = await loadPromotionDropdownData();
        if (!active) return;
        setWorkshops(data.workshops);
        setBranches(data.branches);
      } catch (err) {
        if (active) setDropdownError(err?.message || t('form.errDropdowns'));
      } finally {
        if (active) setLoadingDropdowns(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [t]);

  useEffect(() => {
    if (!isEdit) return;
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const res = await marketingGetCampaign(id);
        const c = res?.campaign || res?.data || res;
        if (!active || !c) return;
        const branchIds = Array.isArray(c.targetBranchIds)
          ? c.targetBranchIds.map(String)
          : [];
        setForm({
          campaignName: c.campaignName || c.name || '',
          platform: c.platform || 'meta',
          campaignType: c.campaignType || c.type || 'brand_awareness',
          startDate: toDateInput(c.startDate),
          endDate: toDateInput(c.endDate),
          budgetAllocated: String(c.budgetAllocated ?? c.budget ?? 0),
          notes: c.notes || '',
          workshopId: String(c.workshopId || c.requestedByTenantId || ''),
          targetBranchIds: branchIds,
        });
      } catch (err) {
        alert(err?.message || t('form.errLoad'));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id, isEdit, t]);

  const branchOptions = useMemo(() => {
    if (!form.workshopId) return branches;
    return branches.filter(
      (b) => !b.workshopId || String(b.workshopId) === String(form.workshopId),
    );
  }, [branches, form.workshopId]);

  const selectedWorkshop = useMemo(
    () => workshops.find((w) => w.id === form.workshopId) || null,
    [workshops, form.workshopId],
  );

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleWorkshopChange = (workshopId) => {
    setForm((prev) => {
      const nextBranches = branches.filter(
        (b) => !b.workshopId || String(b.workshopId) === String(workshopId),
      );
      const allowed = new Set(nextBranches.map((b) => b.id));
      return {
        ...prev,
        workshopId,
        targetBranchIds: prev.targetBranchIds.filter((bid) => allowed.has(bid)),
      };
    });
  };

  const buildPayload = () => {
    const workshopName =
      selectedWorkshop?.label ||
      selectedWorkshop?.name ||
      null;

    return {
      campaignName: form.campaignName.trim(),
      platform: form.platform,
      campaignType: form.campaignType,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      budgetAllocated: Number(form.budgetAllocated) || 0,
      notes: form.notes.trim() || undefined,
      workshopId: form.workshopId || undefined,
      requestedByTenantId: form.workshopId || undefined,
      requestedByName: workshopName || undefined,
      targetBranchIds: form.targetBranchIds,
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.campaignName.trim()) {
      alert(t('form.errName'));
      return;
    }
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      alert(t('form.errDates'));
      return;
    }

    const payload = buildPayload();
    try {
      setSubmitting(true);
      if (isEdit) await marketingUpdateCampaign(id, payload);
      else {
        await marketingCreateCampaign(payload);
        if (user?.userType === 'marketing_user') {
          alert(t('form.submitted'));
        }
      }
      navigate(listPath);
    } catch (err) {
      alert(err?.message || t('form.errSave'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MarketingFormShell
      title={isEdit ? t('form.titleEdit') : t('form.titleNew')}
      subtitle={t('form.subtitle')}
      backLabel={t('form.back')}
      onBack={() => navigate(listPath)}
      className="mk-page mkp-form-page mk-camp-form-page"
    >
      {loading ? (
        <div className="mk-camp-form-loading">
          <Loader2 className="mk-camp-spin" size={28} />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mkp-form-page-body mk-camp-form-card">
          <div className="mkp-form-group">
            <label className="mkp-label">{t('form.name')}</label>
            <input
              className="mkp-input"
              value={form.campaignName}
              onChange={(e) => update('campaignName', e.target.value)}
              placeholder={t('form.namePlaceholder')}
              autoFocus
            />
          </div>

          <div className="mkp-two-col">
            <div className="mkp-form-group">
              <label className="mkp-label">{t('form.platform')}</label>
              <SelectField
                value={form.platform}
                onChange={(value) => update('platform', value)}
                options={PLATFORMS}
              />
            </div>

            <div className="mkp-form-group">
              <label className="mkp-label">{t('form.type')}</label>
              <SelectField
                value={form.campaignType}
                onChange={(value) => update('campaignType', value)}
                options={TYPES}
              />
            </div>
          </div>

          <div className="mkp-two-col">
            <div className="mkp-form-group">
              <label className="mkp-label">{t('form.startDate')}</label>
              <input
                type="date"
                className="mkp-input"
                value={form.startDate}
                onChange={(e) => update('startDate', e.target.value)}
              />
            </div>

            <div className="mkp-form-group">
              <label className="mkp-label">{t('form.endDate')}</label>
              <input
                type="date"
                className="mkp-input"
                value={form.endDate}
                onChange={(e) => update('endDate', e.target.value)}
              />
            </div>
          </div>

          <div className="mkp-form-group">
            <label className="mkp-label">{t('form.budget')}</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="mkp-input"
              value={form.budgetAllocated}
              onChange={(e) => update('budgetAllocated', e.target.value)}
            />
          </div>

          <div className="mkp-section">
            <div className="mkp-section-title">{t('form.targeting')}</div>

            <SingleSelectApiField
              label={t('form.workshop')}
              icon={Building2}
              options={workshops}
              value={form.workshopId}
              onChange={handleWorkshopChange}
              loading={loadingDropdowns}
              error={dropdownError}
              placeholder={t('form.workshopPlaceholder')}
            />

            <MultiSelectApiField
              label={t('form.branches')}
              icon={Building2}
              options={branchOptions}
              selectedIds={form.targetBranchIds}
              onChange={(ids) => update('targetBranchIds', ids)}
              loading={loadingDropdowns}
              error={dropdownError}
              placeholder={
                form.workshopId
                  ? t('form.branchesPlaceholderWorkshop')
                  : t('form.branchesPlaceholderFirst')
              }
            />
          </div>

          <div className="mkp-form-group">
            <label className="mkp-label">{t('form.notes')}</label>
            <textarea
              className="mkp-textarea"
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              rows={4}
              placeholder={t('form.notesPlaceholder')}
            />
          </div>

          <div className="mkp-form-page-footer">
            <button
              type="button"
              onClick={() => navigate(listPath)}
              className="mkp-cancel-btn"
              disabled={submitting}
            >
              {t('form.cancel')}
            </button>
            <button
              type="submit"
              className="mk-camp-submit-btn"
              disabled={submitting}
            >
              {submitting ? t('form.saving') : t('form.save')}
            </button>
          </div>
        </form>
      )}

      <style>{`
        .mk-camp-form-page { padding: 18px 22px 32px; max-width: 760px; }
        .mk-camp-form-card { margin-top: 4px; }
        .mk-camp-form-loading { padding: 48px; text-align: center; color: #94a3b8; }
        .mk-camp-spin { animation: mk-camp-spin 1s linear infinite; }
        @keyframes mk-camp-spin { to { transform: rotate(360deg); } }
        .mk-camp-submit-btn {
          min-height: 36px;
          border: 0;
          border-radius: 8px;
          padding: 0 18px;
          font-size: 12px;
          font-weight: 800;
          background: #d9ad18;
          color: #fff;
          cursor: pointer;
        }
        .mk-camp-submit-btn:hover { filter: brightness(0.96); }
        .mk-camp-submit-btn:disabled { opacity: 0.65; cursor: not-allowed; }
      `}</style>
    </MarketingFormShell>
  );
}
