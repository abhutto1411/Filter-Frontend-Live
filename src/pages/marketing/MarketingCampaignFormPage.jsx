import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  useLocation,
  useNavigate,
  useOutletContext,
  useParams,
} from 'react-router-dom';

import { AlertTriangle, Building2, Loader2 } from 'lucide-react';
import {
  marketingCreateCampaign,
  marketingGetCampaign,
  marketingUpdateCampaign,
} from '../../services/superAdminMarketingApi';
import { mktCampT } from '../../utils/marketingCampaignsI18n';
import { BUSINESS_TIMEZONE } from '../../utils/riyadhBusinessRange';
import { MarketingFormShell } from './MarketingFormShell';
import { marketingSectionPath } from './marketingRouteUtils';
import {
  loadPromotionDropdownData,
  SelectField,
  SingleSelectApiField,
  MultiSelectApiField,
} from './marketingPromotionShared';
// The shell's own chrome (back button, heading) still comes from here.
import './MarketingUniversal.css';
import '../../styles/ui.css';

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

/**
 * The `YYYY-MM-DD` a date input expects, read in the business timezone.
 *
 * This used `toISOString().slice(0, 10)`, which is the UTC day: a campaign
 * starting 1 November at 00:00 in Riyadh is 31 October at 21:00 UTC, so
 * opening it for edit showed — and on save re-submitted — the day before.
 */
function toDateInput(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  // en-CA renders as YYYY-MM-DD, which is what <input type="date"> wants.
  return d.toLocaleDateString('en-CA', { timeZone: BUSINESS_TIMEZONE });
}

export default function MarketingCampaignFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
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
  // One place for everything that used to be an alert().
  const [error, setError] = useState('');
  const [touched, setTouched] = useState(false);

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
        setError('');
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
        if (active) setError(err?.message || t('form.errLoad'));
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

  // Validation shown beside the field it belongs to, not in a dialog that
  // covers the form and says nothing about where the problem is.
  const nameError = !form.campaignName.trim() ? t('form.errName') : '';
  const dateError =
    form.startDate && form.endDate && form.endDate < form.startDate
      ? t('form.errDates')
      : '';
  const canSubmit = !nameError && !dateError && !submitting;

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
    setTouched(true);
    if (nameError || dateError) return;

    setError('');
    const payload = buildPayload();
    try {
      setSubmitting(true);
      if (isEdit) await marketingUpdateCampaign(id, payload);
      else await marketingCreateCampaign(payload);
      // A new campaign lands on the list, which already tells marketing staff
      // how many of theirs are waiting on a Super Admin.
      navigate(listPath);
    } catch (err) {
      setError(err?.message || t('form.errSave'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MarketingFormShell
      title={isEdit ? t('form.titleEdit') : t('form.titleNew')}
      backLabel={t('form.back')}
      onBack={() => navigate(listPath)}
      className="mk-page ui-tokens ui-formpage"
    >
      {loading ? (
        <section className="ui-panel ui-panel-pad">
          <div className="ui-stack-sm" aria-busy="true">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={`sk-${i}`} className="ui-stack-sm">
                <div className="ui-sk ui-sk--label ui-sk--w25" />
                <div className="ui-sk ui-sk--input" />
              </div>
            ))}
          </div>
        </section>
      ) : (
        <form onSubmit={handleSubmit} className="ui-stack" noValidate>
          {error ? (
            <div className="ui-banner ui-banner--dang" role="alert">
              <AlertTriangle size={14} />
              <span>{error}</span>
            </div>
          ) : null}

          <section className="ui-panel ui-panel-pad">
            <div className="ui-form-grid">
              <div className="ui-field ui-col-12">
                <label htmlFor="mcf-name">
                  {t('form.name')}
                  <span className="ui-field-req"> *</span>
                </label>
                <input
                  id="mcf-name"
                  className="ui-input"
                  value={form.campaignName}
                  onChange={(e) => update('campaignName', e.target.value)}
                  onBlur={() => setTouched(true)}
                  placeholder={t('form.namePlaceholder')}
                  aria-invalid={touched && Boolean(nameError)}
                  autoFocus
                />
                {touched && nameError ? (
                  <p className="ui-help ui-help--err">{nameError}</p>
                ) : null}
              </div>

              <div className="ui-field ui-col-6">
                {/* SelectField renders its own control, with no id to point at. */}
                <label>{t('form.platform')}</label>
                <SelectField
                  value={form.platform}
                  onChange={(value) => update('platform', value)}
                  options={PLATFORMS}
                />
              </div>

              <div className="ui-field ui-col-6">
                <label>{t('form.type')}</label>
                <SelectField
                  value={form.campaignType}
                  onChange={(value) => update('campaignType', value)}
                  options={TYPES}
                />
              </div>

              <div className="ui-field ui-col-6">
                <label htmlFor="mcf-start">{t('form.startDate')}</label>
                <input
                  id="mcf-start"
                  type="date"
                  className="ui-input"
                  value={form.startDate}
                  onChange={(e) => update('startDate', e.target.value)}
                />
              </div>

              <div className="ui-field ui-col-6">
                <label htmlFor="mcf-end">{t('form.endDate')}</label>
                <input
                  id="mcf-end"
                  type="date"
                  className="ui-input"
                  value={form.endDate}
                  // The picker itself refuses an end before the start, so the
                  // message below is only ever for a value typed in directly.
                  min={form.startDate || undefined}
                  onChange={(e) => update('endDate', e.target.value)}
                  aria-invalid={Boolean(dateError)}
                />
                {dateError ? <p className="ui-help ui-help--err">{dateError}</p> : null}
              </div>

              <div className="ui-field ui-col-6">
                <label htmlFor="mcf-budget">{t('form.budget')}</label>
                <input
                  id="mcf-budget"
                  type="number"
                  min="0"
                  step="0.01"
                  className="ui-input ui-input--figure"
                  value={form.budgetAllocated}
                  onChange={(e) => update('budgetAllocated', e.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="ui-panel">
            <div className="ui-panel-head">
              <span className="ui-panel-title">{t('form.targeting')}</span>
            </div>
            <div className="ui-panel-pad ui-stack-sm">
              {dropdownError ? (
                <div className="ui-banner ui-banner--dang">
                  <AlertTriangle size={14} />
                  <span>{dropdownError}</span>
                </div>
              ) : null}

              <SingleSelectApiField
                label={t('form.workshop')}
                icon={Building2}
                options={workshops}
                value={form.workshopId}
                onChange={handleWorkshopChange}
                loading={loadingDropdowns}
                error={dropdownError}
                placeholder={t('form.workshopPlaceholder')}
                locale={locale}
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
                locale={locale}
              />
            </div>
          </section>

          <section className="ui-panel ui-panel-pad">
            <div className="ui-field">
              <label htmlFor="mcf-notes">{t('form.notes')}</label>
              <textarea
                id="mcf-notes"
                className="ui-textarea"
                value={form.notes}
                onChange={(e) => update('notes', e.target.value)}
                rows={4}
                placeholder={t('form.notesPlaceholder')}
              />
            </div>
          </section>

          <div className="ui-form-foot">
            <button
              type="button"
              onClick={() => navigate(listPath)}
              className="ui-btn ui-btn--default"
              disabled={submitting}
            >
              {t('form.cancel')}
            </button>
            <button
              type="submit"
              className="ui-btn ui-btn--primary"
              disabled={!canSubmit}
            >
              {submitting ? <Loader2 size={14} className="ui-spin" /> : null}
              {submitting ? t('form.saving') : t('form.save')}
            </button>
          </div>
        </form>
      )}
    </MarketingFormShell>
  );
}
