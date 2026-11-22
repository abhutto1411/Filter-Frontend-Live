import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { AlertCircle, AlertTriangle, Loader2 } from 'lucide-react';
import {
  riderAppCreatePromotion,
  riderAppGetCatalog,
  riderAppGetPromotion,
  riderAppUpdatePromotion,
} from '../../services/riderAppMarketingApi';
import { resolveMarketingLocale } from '../../utils/marketingPromotionsI18n';
import { riderAppT } from '../../utils/riderAppPromotionsI18n';
import { MarketingFormShell } from './MarketingFormShell';
import BannerUploadField from './BannerUploadField';
import { resolvePromotionBasePath, toDateTimeLocal, Toggle } from './marketingPromotionShared';
// The shell's own chrome (back button, heading) still comes from here.
import './MarketingUniversal.css';
import '../../styles/ui.css';

const EMPTY = {
  code: '',
  title: '',
  discountType: 'PERCENTAGE',
  discountValue: '',
  maxDiscount: '',
  minOrderValue: '',
  totalUsageLimit: '',
  limitPerUser: '',
  validFrom: '',
  validTo: '',
  serviceIds: [],
  zoneIds: [],
  workshopIds: [],
  branchIds: [],
  bannerBadge: '',
  bannerTitle: '',
  bannerSubtitle: '',
  bannerImageUrl: '',
  showOnHome: true,
  bannerSortOrder: '0',
};

const numOrUndefined = (v) => (v === '' || v == null ? undefined : Number(v));
const isoOrUndefined = (v) => (v ? new Date(v).toISOString() : undefined);

function fromItem(item) {
  const s = (v) => (v == null ? '' : String(v));
  return {
    code: s(item.code),
    title: s(item.title),
    discountType: item.discountType === 'FIXED' ? 'FIXED' : 'PERCENTAGE',
    discountValue: s(item.discountValue),
    maxDiscount: s(item.maxDiscount),
    minOrderValue: s(item.minOrderValue),
    totalUsageLimit: s(item.totalUsageLimit),
    limitPerUser: s(item.limitPerUser),
    validFrom: toDateTimeLocal(item.validFrom),
    validTo: toDateTimeLocal(item.validTo),
    serviceIds: Array.isArray(item.serviceIds) ? item.serviceIds : [],
    zoneIds: Array.isArray(item.zoneIds) ? item.zoneIds : [],
    // Stored as JSON; ids come back as strings, so compare them as strings.
    workshopIds: (Array.isArray(item.workshopIds) ? item.workshopIds : []).map(String),
    branchIds: (Array.isArray(item.branchIds) ? item.branchIds : []).map(String),
    bannerBadge: s(item.bannerBadge),
    bannerTitle: s(item.bannerTitle),
    bannerSubtitle: s(item.bannerSubtitle),
    bannerImageUrl: s(item.bannerImageUrl),
    showOnHome: item.showOnHome !== false,
    bannerSortOrder: s(item.bannerSortOrder ?? 0),
  };
}

function toPayload(form) {
  return {
    code: form.code.trim(),
    title: form.title.trim() || undefined,
    discountType: form.discountType,
    discountValue: Number(form.discountValue),
    maxDiscount: numOrUndefined(form.maxDiscount),
    minOrderValue: numOrUndefined(form.minOrderValue),
    totalUsageLimit: numOrUndefined(form.totalUsageLimit),
    limitPerUser: numOrUndefined(form.limitPerUser),
    validFrom: isoOrUndefined(form.validFrom),
    validTo: isoOrUndefined(form.validTo),
    serviceIds: form.serviceIds,
    zoneIds: form.zoneIds,
    workshopIds: form.workshopIds,
    branchIds: form.branchIds,
    bannerBadge: form.bannerBadge.trim() || undefined,
    bannerTitle: form.bannerTitle.trim() || undefined,
    bannerSubtitle: form.bannerSubtitle.trim() || undefined,
    bannerImageUrl: form.bannerImageUrl.trim() || undefined,
    showOnHome: form.showOnHome,
    bannerSortOrder: Number(form.bannerSortOrder || 0),
  };
}

function CheckList({ items, selected, onChange, locale }) {
  const toggle = (id) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  return (
    <div className="ui-checks">
      {items.map((item) => (
        <label key={item.id} className="ui-check">
          <input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)} />
          <span className="ui-check-main">
            {locale === 'ar' && item.nameAr ? item.nameAr : item.nameEn}
          </span>
          {item.extra?.city ? (
            <span className="ui-check-alt">{item.extra.city}</span>
          ) : null}
        </label>
      ))}
    </div>
  );
}

const OPERATIONAL_WORKSHOP = new Set(['approved', 'active']);

/**
 * Where in the ERP the promotion applies: workshops, and inside them branches.
 *
 * A workshop's branches only appear once the workshop itself is ticked, so the
 * nesting is visible rather than implied. Ticking no branch is the normal case
 * and means every branch of that workshop — which is why the branch rows carry
 * a running count instead of a "select all".
 *
 * Unticking a workshop also drops the branches that belonged to it: a branch
 * left behind would widen the promotion past the workshops on screen, and the
 * backend rejects that pair rather than quietly fixing it.
 */
function WorkshopScopePicker({ workshops, workshopIds, branchIds, onChange, t }) {
  if (!workshops.length) {
    return <p className="ui-help">{t('form.workshopsEmpty')}</p>;
  }

  const toggleWorkshop = (ws) => {
    const on = workshopIds.includes(ws.id);
    if (!on) {
      onChange({ workshopIds: [...workshopIds, ws.id], branchIds });
      return;
    }
    const dropped = new Set(ws.branches.map((b) => b.id));
    onChange({
      workshopIds: workshopIds.filter((x) => x !== ws.id),
      branchIds: branchIds.filter((id) => !dropped.has(id)),
    });
  };

  const toggleBranch = (branchId) =>
    onChange({
      workshopIds,
      branchIds: branchIds.includes(branchId)
        ? branchIds.filter((x) => x !== branchId)
        : [...branchIds, branchId],
    });

  return (
    <div className="ui-scope">
      {workshops.map((ws) => {
        const on = workshopIds.includes(ws.id);
        const picked = ws.branches.filter((b) => branchIds.includes(b.id)).length;
        return (
          <div key={ws.id} className={`ui-scope-group${on ? ' ui-scope-group--on' : ''}`}>
            <label className="ui-scope-head">
              <input type="checkbox" checked={on} onChange={() => toggleWorkshop(ws)} />
              <span className="ui-check-main">{ws.name}</span>
              {OPERATIONAL_WORKSHOP.has(String(ws.status)) ? null : (
                <span className="ui-check-alt">{t('form.wsNotActive')}</span>
              )}
              {on ? (
                <span className="ui-scope-note">
                  {picked === 0
                    ? t('form.allBranches')
                    : t('form.branchesChosen', { n: picked, total: ws.branches.length })}
                </span>
              ) : null}
            </label>

            {on && ws.branches.length === 0 ? (
              <p className="ui-scope-hint">{t('form.noBranches')}</p>
            ) : null}

            {on && ws.branches.length > 0 ? (
              <div className="ui-scope-children">
                {ws.branches.map((b) => (
                  <label key={b.id} className="ui-check">
                    <input
                      type="checkbox"
                      checked={branchIds.includes(b.id)}
                      onChange={() => toggleBranch(b.id)}
                    />
                    <span className="ui-check-main">{b.name}</span>
                    {b.isActive ? null : (
                      <span className="ui-check-alt">{t('form.branchOff')}</span>
                    )}
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Create / edit a Rider app promotion (same options as the Rider admin form).
 * Saving never publishes directly: it goes live after approval + activation.
 */
export const RiderAppPromotionFormPage = () => {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const location = useLocation();
  const outletCtx = useOutletContext() || {};
  const locale = resolveMarketingLocale(outletCtx);
  const t = useCallback((key, vars) => riderAppT(locale, key, vars), [locale]);
  const listPath = `${resolvePromotionBasePath(location.pathname)}/rider-app`;

  const [form, setForm] = useState(EMPTY);
  const [original, setOriginal] = useState(null);
  const [catalog, setCatalog] = useState({
    services: [],
    zones: [],
    promoCodes: [],
    workshops: [],
    lastSyncedAt: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [cat, item] = await Promise.all([
          riderAppGetCatalog(),
          isEdit ? riderAppGetPromotion(id) : Promise.resolve(null),
        ]);
        if (!alive) return;
        setCatalog({
          services: cat?.services ?? [],
          zones: cat?.zones ?? [],
          promoCodes: cat?.promoCodes ?? [],
          workshops: cat?.workshops ?? [],
          lastSyncedAt: cat?.lastSyncedAt ?? null,
        });
        if (item) {
          setOriginal(item);
          setForm(fromItem(item));
        }
      } catch (err) {
        if (alive) setError(err?.message || t('err.load'));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, isEdit, t]);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  // Code already used in Rider by a promotion that is not this one's Rider copy.
  const codeTaken = useMemo(() => {
    const code = form.code.trim().toUpperCase();
    if (!code) return false;
    if (original && String(original.code).toUpperCase() === code) return false;
    return catalog.promoCodes.some((c) => String(c).toUpperCase() === code);
  }, [form.code, catalog.promoCodes, original]);

  // The promotion will print on invoices in the workshops it names, so it has
  // to name at least one. The backend rejects an empty list too.
  const noWorkshop = form.workshopIds.length === 0;

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = toPayload(form);
      if (isEdit) await riderAppUpdatePromotion(id, payload);
      else await riderAppCreatePromotion(payload);
      navigate(listPath);
    } catch (err) {
      setError(err?.message || t('err.action'));
    } finally {
      setSaving(false);
    }
  };

  const input = (key, type = 'text', extra = {}) => (
    <input
      id={`rap-${key}`}
      type={type}
      value={form[key]}
      onChange={(e) => update(key, e.target.value)}
      className="ui-input"
      {...extra}
    />
  );

  return (
    <MarketingFormShell
      title={isEdit ? t('form.titleEdit') : t('form.titleNew')}
      onBack={() => navigate(listPath)}
      className="mk-page ui-tokens ui-formpage"
    >
      {loading ? (
        <section className="ui-panel ui-panel-pad">
          <div className="ui-stack-sm" aria-busy="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={`sk-${i}`} className="ui-stack-sm">
                <div className="ui-sk ui-sk--label ui-sk--w25" />
                <div className="ui-sk ui-sk--input" />
              </div>
            ))}
          </div>
        </section>
      ) : (
        <form onSubmit={submit} className="ui-stack" noValidate>
          {error ? (
            <div className="ui-banner ui-banner--dang" role="alert">
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          ) : null}
          {isEdit && original?.approvalStatus === 'approved' ? (
            <div className="ui-banner ui-banner--warn">
              <AlertTriangle size={14} />
              <span>{t('msg.editApproved')}</span>
            </div>
          ) : null}

          <section className="ui-panel ui-panel-pad ui-stack-sm">
            <div className="ui-subgroup-title">{t('form.section.basic')}</div>
            <div className="ui-form-grid">
              <div className="ui-field ui-col-6">
                <label htmlFor="rap-code">{t('form.code')}</label>
                {input('code', 'text', { required: true, maxLength: 64, pattern: '[A-Za-z0-9_-]+' })}
                <p className={codeTaken ? 'ui-help ui-help--err' : 'ui-help'}>
                  {codeTaken ? t('form.codeTaken') : t('form.codeHint')}
                </p>
              </div>
              <div className="ui-field ui-col-6">
                <label htmlFor="rap-title">{t('form.title')}</label>
                {input('title', 'text', { maxLength: 255 })}
              </div>
            </div>
          </section>

          <section className="ui-panel ui-panel-pad ui-stack-sm">
            <div className="ui-subgroup-title">{t('form.section.rules')}</div>
            <div className="ui-form-grid">
              <div className="ui-field ui-col-6">
                <label>{t('form.discountType')}</label>
                <select
                  className="ui-input"
                  value={form.discountType}
                  onChange={(e) => update('discountType', e.target.value)}
                >
                  <option value="PERCENTAGE">{t('form.percentage')}</option>
                  <option value="FIXED">{t('form.fixed')}</option>
                </select>
              </div>
              <div className="ui-field ui-col-6">
                <label htmlFor="rap-discountValue">{t('form.discountValue')}</label>
                {input('discountValue', 'number', {
                  required: true,
                  min: 0.01,
                  step: '0.01',
                  max: form.discountType === 'PERCENTAGE' ? 100 : undefined,
                })}
              </div>
            </div>
            <div className="ui-form-grid">
              <div className="ui-field ui-col-6">
                <label htmlFor="rap-maxDiscount">{t('form.maxDiscount')} <span>({t('form.optional')})</span></label>
                {input('maxDiscount', 'number', { min: 0, step: '0.01' })}
              </div>
              <div className="ui-field ui-col-6">
                <label htmlFor="rap-minOrderValue">{t('form.minOrder')} <span>({t('form.optional')})</span></label>
                {input('minOrderValue', 'number', { min: 0, step: '0.01' })}
              </div>
            </div>
            <div className="ui-form-grid">
              <div className="ui-field ui-col-6">
                <label htmlFor="rap-totalUsageLimit">{t('form.totalLimit')} <span>({t('form.optional')})</span></label>
                {input('totalUsageLimit', 'number', { min: 1, step: 1 })}
              </div>
              <div className="ui-field ui-col-6">
                <label htmlFor="rap-limitPerUser">{t('form.perUserLimit')} <span>({t('form.optional')})</span></label>
                {input('limitPerUser', 'number', { min: 1, step: 1 })}
              </div>
            </div>
            <div className="ui-form-grid">
              <div className="ui-field ui-col-6">
                <label htmlFor="rap-validFrom">{t('form.validFrom')}</label>
                {input('validFrom', 'datetime-local')}
              </div>
              <div className="ui-field ui-col-6">
                <label htmlFor="rap-validTo">{t('form.validTo')}</label>
                {input('validTo', 'datetime-local', { min: form.validFrom || undefined })}
              </div>
            </div>
          </section>

          <section className="ui-panel ui-panel-pad ui-stack-sm">
            <div className="ui-subgroup-title">{t('form.section.target')}</div>
            {catalog.lastSyncedAt ? (
              <p className="ui-help">
                {t('form.catalogAt', { at: new Date(catalog.lastSyncedAt).toLocaleString() })}
              </p>
            ) : (
              <div className="ui-banner ui-banner--warn">
                <AlertTriangle size={15} />
                {t('form.catalogEmpty')}
              </div>
            )}
            <div className="ui-field ui-col-6">
              <label>{t('form.services')}</label>
              <p className="ui-help">{t('form.servicesHint')}</p>
              <CheckList
                items={catalog.services}
                selected={form.serviceIds}
                onChange={(v) => update('serviceIds', v)}
                locale={locale}
              />
            </div>
            <div className="ui-field ui-col-6">
              <label>{t('form.zones')}</label>
              <p className="ui-help">{t('form.zonesHint')}</p>
              <CheckList
                items={catalog.zones}
                selected={form.zoneIds}
                onChange={(v) => update('zoneIds', v)}
                locale={locale}
              />
            </div>
            <div className="ui-field ui-col-6">
              <label>{t('form.workshops')}</label>
              <p className={noWorkshop ? 'ui-help ui-help--err' : 'ui-help'}>
                {noWorkshop ? t('form.workshopsRequired') : t('form.workshopsHint')}
              </p>
              <WorkshopScopePicker
                workshops={catalog.workshops}
                workshopIds={form.workshopIds}
                branchIds={form.branchIds}
                onChange={({ workshopIds, branchIds }) =>
                  setForm((prev) => ({ ...prev, workshopIds, branchIds }))
                }
                t={t}
              />
            </div>
          </section>

          <section className="ui-panel ui-panel-pad ui-stack-sm">
            <div className="ui-subgroup-title">{t('form.section.banner')}</div>
            <div className="ui-form-grid">
              <div className="ui-field ui-col-6">
                <label htmlFor="rap-bannerBadge">{t('form.bannerBadge')}</label>
                {input('bannerBadge', 'text', { maxLength: 64 })}
              </div>
              <div className="ui-field ui-col-6">
                <label htmlFor="rap-bannerSortOrder">{t('form.sortOrder')}</label>
                {input('bannerSortOrder', 'number', { step: 1 })}
              </div>
            </div>
            <div className="ui-field ui-col-6">
              <label htmlFor="rap-bannerTitle">{t('form.bannerTitle')}</label>
              {input('bannerTitle', 'text', { maxLength: 255 })}
            </div>
            <div className="ui-field ui-col-6">
              <label htmlFor="rap-bannerSubtitle">{t('form.bannerSubtitle')}</label>
              {input('bannerSubtitle', 'text', { maxLength: 255 })}
            </div>
            <BannerUploadField
              value={form.bannerImageUrl}
              onChange={(url) => update('bannerImageUrl', url)}
              locale={locale}
              showRiderNote
            />
            <div className="ui-row">
              <Toggle
                checked={form.showOnHome}
                onChange={(v) => update('showOnHome', v)}
                label={t('form.showOnHome')}
              />
            </div>
          </section>

          <div className="ui-form-foot">
            <button
              type="button"
              className="ui-btn ui-btn--default"
              onClick={() => navigate(listPath)}
              disabled={saving}
            >
              {t('form.cancel')}
            </button>
            <button
              type="submit"
              className="ui-btn ui-btn--primary"
              disabled={saving || codeTaken || noWorkshop}
            >
              {saving ? <Loader2 size={14} className="ui-spin" /> : null}
              {saving ? t('form.saving') : t('form.save')}
            </button>
          </div>
        </form>
      )}
    </MarketingFormShell>
  );
};

export default RiderAppPromotionFormPage;
