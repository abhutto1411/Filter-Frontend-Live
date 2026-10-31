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
import './MarketingUniversal.css';
import './RiderAppPromotions.css';

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
    <div className="rap-checklist">
      {items.map((item) => (
        <label key={item.id} className="rap-check">
          <input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)} />
          <span>
            {locale === 'ar' && item.nameAr ? item.nameAr : item.nameEn}
            {item.extra?.city ? <em> · {item.extra.city}</em> : null}
          </span>
        </label>
      ))}
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
  const [catalog, setCatalog] = useState({ services: [], zones: [], promoCodes: [], lastSyncedAt: null });
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
      type={type}
      value={form[key]}
      onChange={(e) => update(key, e.target.value)}
      className="mkp-input"
      {...extra}
    />
  );

  return (
    <MarketingFormShell
      title={isEdit ? t('form.titleEdit') : t('form.titleNew')}
      subtitle={t('form.subtitle')}
      onBack={() => navigate(listPath)}
    >
      {loading ? (
        <div className="mkp-empty">
          <Loader2 size={30} className="mkp-spin" />
        </div>
      ) : (
        <form onSubmit={submit} className="mkp-form-page-form">
          {error ? (
            <div className="mkp-error">
              <AlertCircle size={16} />
              {error}
            </div>
          ) : null}
          {isEdit && original?.approvalStatus === 'approved' ? (
            <div className="rap-warning">
              <AlertTriangle size={15} />
              {t('msg.editApproved')}
            </div>
          ) : null}

          <div className="mkp-section">
            <div className="mkp-section-title">{t('form.section.basic')}</div>
            <div className="mkp-two-col">
              <div className="mkp-form-group">
                <label className="mkp-label">{t('form.code')}</label>
                {input('code', 'text', { required: true, maxLength: 64, pattern: '[A-Za-z0-9_-]+' })}
                <p className={codeTaken ? 'rap-field-error' : 'mkp-field-hint'}>
                  {codeTaken ? t('form.codeTaken') : t('form.codeHint')}
                </p>
              </div>
              <div className="mkp-form-group">
                <label className="mkp-label">{t('form.title')}</label>
                {input('title', 'text', { maxLength: 255 })}
              </div>
            </div>
          </div>

          <div className="mkp-section">
            <div className="mkp-section-title">{t('form.section.rules')}</div>
            <div className="mkp-two-col">
              <div className="mkp-form-group">
                <label className="mkp-label">{t('form.discountType')}</label>
                <select
                  className="mkp-input"
                  value={form.discountType}
                  onChange={(e) => update('discountType', e.target.value)}
                >
                  <option value="PERCENTAGE">{t('form.percentage')}</option>
                  <option value="FIXED">{t('form.fixed')}</option>
                </select>
              </div>
              <div className="mkp-form-group">
                <label className="mkp-label">{t('form.discountValue')}</label>
                {input('discountValue', 'number', {
                  required: true,
                  min: 0.01,
                  step: '0.01',
                  max: form.discountType === 'PERCENTAGE' ? 100 : undefined,
                })}
              </div>
            </div>
            <div className="mkp-two-col">
              <div className="mkp-form-group">
                <label className="mkp-label">{t('form.maxDiscount')} <span>({t('form.optional')})</span></label>
                {input('maxDiscount', 'number', { min: 0, step: '0.01' })}
              </div>
              <div className="mkp-form-group">
                <label className="mkp-label">{t('form.minOrder')} <span>({t('form.optional')})</span></label>
                {input('minOrderValue', 'number', { min: 0, step: '0.01' })}
              </div>
            </div>
            <div className="mkp-two-col">
              <div className="mkp-form-group">
                <label className="mkp-label">{t('form.totalLimit')} <span>({t('form.optional')})</span></label>
                {input('totalUsageLimit', 'number', { min: 1, step: 1 })}
              </div>
              <div className="mkp-form-group">
                <label className="mkp-label">{t('form.perUserLimit')} <span>({t('form.optional')})</span></label>
                {input('limitPerUser', 'number', { min: 1, step: 1 })}
              </div>
            </div>
            <div className="mkp-two-col">
              <div className="mkp-form-group">
                <label className="mkp-label">{t('form.validFrom')}</label>
                {input('validFrom', 'datetime-local')}
              </div>
              <div className="mkp-form-group">
                <label className="mkp-label">{t('form.validTo')}</label>
                {input('validTo', 'datetime-local', { min: form.validFrom || undefined })}
              </div>
            </div>
          </div>

          <div className="mkp-section">
            <div className="mkp-section-title">{t('form.section.target')}</div>
            {catalog.lastSyncedAt ? (
              <p className="mkp-field-hint">
                {t('form.catalogAt', { at: new Date(catalog.lastSyncedAt).toLocaleString() })}
              </p>
            ) : (
              <div className="rap-warning">
                <AlertTriangle size={15} />
                {t('form.catalogEmpty')}
              </div>
            )}
            <div className="mkp-form-group">
              <label className="mkp-label">{t('form.services')}</label>
              <p className="mkp-field-hint">{t('form.servicesHint')}</p>
              <CheckList
                items={catalog.services}
                selected={form.serviceIds}
                onChange={(v) => update('serviceIds', v)}
                locale={locale}
              />
            </div>
            <div className="mkp-form-group">
              <label className="mkp-label">{t('form.zones')}</label>
              <p className="mkp-field-hint">{t('form.zonesHint')}</p>
              <CheckList
                items={catalog.zones}
                selected={form.zoneIds}
                onChange={(v) => update('zoneIds', v)}
                locale={locale}
              />
            </div>
          </div>

          <div className="mkp-section">
            <div className="mkp-section-title">{t('form.section.banner')}</div>
            <div className="mkp-two-col">
              <div className="mkp-form-group">
                <label className="mkp-label">{t('form.bannerBadge')}</label>
                {input('bannerBadge', 'text', { maxLength: 64 })}
              </div>
              <div className="mkp-form-group">
                <label className="mkp-label">{t('form.sortOrder')}</label>
                {input('bannerSortOrder', 'number', { step: 1 })}
              </div>
            </div>
            <div className="mkp-form-group">
              <label className="mkp-label">{t('form.bannerTitle')}</label>
              {input('bannerTitle', 'text', { maxLength: 255 })}
            </div>
            <div className="mkp-form-group">
              <label className="mkp-label">{t('form.bannerSubtitle')}</label>
              {input('bannerSubtitle', 'text', { maxLength: 255 })}
            </div>
            <BannerUploadField
              value={form.bannerImageUrl}
              onChange={(url) => update('bannerImageUrl', url)}
              locale={locale}
              showRiderNote
            />
            <div className="mkp-toggles-row">
              <Toggle
                checked={form.showOnHome}
                onChange={(v) => update('showOnHome', v)}
                label={t('form.showOnHome')}
              />
            </div>
          </div>

          <div className="mkp-form-page-footer">
            <button type="button" className="mkp-cancel-btn" onClick={() => navigate(listPath)} disabled={saving}>
              {t('form.cancel')}
            </button>
            <button type="submit" className="mkp-submit-btn" disabled={saving || codeTaken}>
              {saving ? (
                <>
                  <Loader2 size={15} className="mkp-spin" />
                  {t('form.saving')}
                </>
              ) : (
                t('form.save')
              )}
            </button>
          </div>
        </form>
      )}
    </MarketingFormShell>
  );
};

export default RiderAppPromotionFormPage;
