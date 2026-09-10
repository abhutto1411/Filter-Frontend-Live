import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { Hourglass, Loader2 } from 'lucide-react';
import PromoCodeFormFields from '../../components/promo/PromoCodeFormFields';
import {
  buildMarketingPromoPayload,
  catalogItemId,
  emptyPromoForm,
  generatePromoCode,
  promoToForm,
  promotionToPromoFormRules,
  reconcilePromoFormWithWorkshops,
  restorePromoRuleFields,
  snapshotPromoRuleFields,
  strTrim,
  validatePromoForm,
} from '../../components/promo/promoCodeFormUtils';
import {
  marketingCreatePromoCode,
  marketingGetPromoCode,
  marketingGetPromoCodeOptions,
  marketingGetPromotion,
  marketingListPromotions,
  marketingUpdatePromoCode,
} from '../../services/superAdminMarketingApi';
import { promoT } from '../../utils/promoCodesI18n';
import { resolveMarketingLocale } from '../../utils/marketingPromotionsI18n';
import { MarketingFormShell } from './MarketingFormShell';
import { marketingSectionPath } from './marketingRouteUtils';
import { normalizePromoCode, safeArray } from './promoCodeShared';
import '../workshop/Workshop.css';
import './MarketingUniversal.css';

function normalizeBranches(payload) {
  const list = Array.isArray(payload?.branches)
    ? payload.branches
    : Array.isArray(payload?.applicableBranches)
      ? payload.applicableBranches
      : Array.isArray(payload?.items)
        ? payload.items
        : [];

  return list.map((row) => ({
    id: String(row.id ?? row.value ?? ''),
    name: row.name ?? row.label ?? row.branchName ?? `Branch ${row.id}`,
    workshopId: String(row.workshopId ?? row.workshop_id ?? ''),
    isActive: row.isActive !== false,
  }));
}

function normalizeWorkshops(payload) {
  const list = Array.isArray(payload?.workshops) ? payload.workshops : [];
  return list.map((row) => ({
    id: String(row.id ?? row.value ?? ''),
    name: row.name ?? row.label ?? `Workshop ${row.id}`,
  }));
}

function normalizeCatalogRows(rows, kind) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      const id = catalogItemId(row, kind);
      if (!id) return null;
      return {
        ...row,
        id,
        name: row.name ?? row.label ?? row.product?.name ?? row.service?.name,
        categoryId: row.categoryId ?? row.category_id ?? row.category?.id ?? null,
        categoryName: row.categoryName ?? row.category_name ?? row.category?.name ?? null,
      };
    })
    .filter(Boolean);
}

export default function PromoCodeFormPage({ readOnly = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const outletCtx = useOutletContext() || {};
  const locale = resolveMarketingLocale(outletCtx);
  const t = useCallback((key, vars) => promoT(locale, key, vars), [locale]);
  const { id } = useParams();
  const isEdit = Boolean(id) && !readOnly && /\/edit$/.test(location.pathname);
  const listPath = marketingSectionPath(location.pathname, 'promo-codes');

  const [form, setForm] = useState(emptyPromoForm);
  const [workshops, setWorkshops] = useState([]);
  const [branches, setBranches] = useState([]);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [catalogServices, setCatalogServices] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingRecord, setLoadingRecord] = useState(isEdit || readOnly);
  const [optionsError, setOptionsError] = useState('');
  const [recordError, setRecordError] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [usageCount, setUsageCount] = useState(null);
  const [promotionOptions, setPromotionOptions] = useState([]);
  const [promotionsLoading, setPromotionsLoading] = useState(false);
  const [promotionsById, setPromotionsById] = useState(() => new Map());
  const ruleSnapshotRef = useRef(null);

  const goBack = () => navigate(listPath);

  const branchIdsForCatalog = useMemo(() => {
    const selectedWorkshopIds =
      form.workshopMode === 'all'
        ? workshops.map((w) => String(w.id)).filter(Boolean)
        : form.workshopIds.length > 0
          ? form.workshopIds.map(String)
          : strTrim(form.workshopId)
            ? [String(form.workshopId)]
            : [];

    if (selectedWorkshopIds.length === 0) return [];

    if (form.branchMode === 'all') {
      return branches
        .filter((b) => selectedWorkshopIds.includes(String(b.workshopId ?? '')))
        .map((b) => String(b.id))
        .filter(Boolean);
    }
    return form.branchIds;
  }, [
    form.branchMode,
    form.branchIds,
    form.workshopId,
    form.workshopIds,
    form.workshopMode,
    branches,
    workshops,
  ]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoadingOptions(true);
        setOptionsError('');
        const data = await marketingGetPromoCodeOptions();
        if (cancelled) return;

        setBranches(normalizeBranches(data));
        setWorkshops(normalizeWorkshops(data));
        setCatalogProducts(normalizeCatalogRows(data.products, 'products'));
        setCatalogServices(normalizeCatalogRows(data.services, 'services'));
      } catch (error) {
        if (!cancelled) {
          setOptionsError(error?.message || t('form.err.options'));
        }
      } finally {
        if (!cancelled) setLoadingOptions(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setPromotionsLoading(true);
        const data = await marketingListPromotions({ limit: 500, offset: 0 });
        if (cancelled) return;

        const rows = safeArray(data, ['promotions', 'items']);
        const byId = new Map();
        const options = [];

        for (const row of rows) {
          const status = String(row?.status ?? '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '_');
          if (status !== 'active' && status !== 'approved') continue;

          const idStr = String(row?.id ?? '').trim();
          if (!idStr) continue;

          byId.set(idStr, row);
          options.push({
            id: idStr,
            label:
              String(row?.name ?? row?.promotionName ?? '').trim() ||
              `Promotion ${idStr}`,
            status,
          });
        }

        options.sort((a, b) => a.label.localeCompare(b.label));
        setPromotionsById(byId);
        setPromotionOptions(options);
      } catch {
        if (!cancelled) {
          setPromotionsById(new Map());
          setPromotionOptions([]);
        }
      } finally {
        if (!cancelled) setPromotionsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isEdit && !readOnly) return undefined;

    let cancelled = false;

    (async () => {
      try {
        setLoadingRecord(true);
        setRecordError('');
        const data = await marketingGetPromoCode(id);
        if (cancelled) return;

        const item = normalizePromoCode(
          data?.promoCode || data?.data || data?.item || data,
          locale,
        );

        setForm(reconcilePromoFormWithWorkshops(item, workshops));
        setUsageCount(item.currentUsage ?? item.current_usage_count ?? null);
        ruleSnapshotRef.current = null;
      } catch (error) {
        if (!cancelled) {
          setRecordError(error?.message || t('form.err.load'));
        }
      } finally {
        if (!cancelled) setLoadingRecord(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, isEdit, readOnly, loadingOptions, workshops]);

  const promotionSelectOptions = useMemo(() => {
    const opts = [...promotionOptions];
    const linkedId = String(form.promotionId || '').trim();
    if (
      linkedId &&
      !opts.some((opt) => String(opt.id) === linkedId)
    ) {
      opts.unshift({
        id: linkedId,
        label:
          String(form.promotionName || '').trim() ||
          `Promotion ${linkedId}`,
        status: 'linked',
      });
    }
    return opts;
  }, [promotionOptions, form.promotionId, form.promotionName]);

  const handlePromotionLinkChange = async (rawId, opt) => {
    const idStr = String(rawId ?? '').trim();

    if (!idStr) {
      setForm((prev) => {
        const restored = restorePromoRuleFields(prev, ruleSnapshotRef.current);
        ruleSnapshotRef.current = null;
        return {
          ...restored,
          promotionId: '',
          promotionName: '',
        };
      });
      return;
    }

    let promotion = promotionsById.get(idStr) || null;
    if (!promotion) {
      try {
        const data = await marketingGetPromotion(idStr);
        promotion =
          data?.promotion || data?.data || data?.item || data || null;
        if (promotion) {
          setPromotionsById((prev) => {
            const next = new Map(prev);
            next.set(idStr, promotion);
            return next;
          });
        }
      } catch {
        promotion = null;
      }
    }

    const name =
      String(
        promotion?.name ??
          promotion?.promotionName ??
          opt?.label ??
          '',
      ).trim() || `Promotion ${idStr}`;

    setForm((prev) => {
      if (!ruleSnapshotRef.current) {
        ruleSnapshotRef.current = snapshotPromoRuleFields(prev);
      }
      const rules = promotionToPromoFormRules(promotion || {});
      return {
        ...prev,
        ...rules,
        promotionId: idStr,
        promotionName: name,
      };
    });
  };

  const handleSubmit = async (e) => {
    if (readOnly) return;
    e.preventDefault();
    setFormError('');

    const validationMsg = validatePromoForm(form, {
      catalogLoading,
      requireWorkshop: true,
    });
    if (validationMsg) {
      setFormError(validationMsg);
      return;
    }

    try {
      setSubmitting(true);
      const payload = buildMarketingPromoPayload(form, {
        isEdit,
        allWorkshopIds: workshops.map((w) => w.id),
      });

      if (isEdit) {
        await marketingUpdatePromoCode(id, payload);
        navigate(listPath, {
          state: { successMessage: t('form.msg.updated') },
        });
      } else {
        await marketingCreatePromoCode(payload);
        navigate(listPath, {
          state: {
            successMessage: t('form.msg.created'),
          },
        });
      }
    } catch (error) {
      setFormError(error?.message || t('form.err.save'));
    } finally {
      setSubmitting(false);
    }
  };

  const needsCatalogForSave =
    form.productScope === 'selected'
    || form.serviceScope === 'selected'
    || (form.branchMode === 'selected' && form.branchIds.length > 0);
  const saveBlockedByCatalog = catalogLoading && needsCatalogForSave;

  return (
    <MarketingFormShell
      title={readOnly ? t('form.titleView') : isEdit ? t('form.titleEdit') : t('form.titleNew')}
      subtitle={
        readOnly
          ? t('form.subtitleView')
          : isEdit
            ? t('form.subtitleEdit')
            : t('form.subtitleNew')
      }
      backLabel={t('form.back')}
      onBack={goBack}
      className="mk-page mk-code-page mkp-form-page ws-promo-sub-screen"
    >
      {loadingRecord || loadingOptions ? (
        <div className="mk-code-empty-state">
          <Loader2 size={28} className="mk-code-spin" />
          <div>{t('form.loading')}</div>
        </div>
      ) : recordError ? (
        <div className="mk-code-error-banner">{recordError}</div>
      ) : optionsError ? (
        <div className="mk-code-error-banner">{optionsError}</div>
      ) : (
        <form onSubmit={handleSubmit} className="mkp-form-page-body ws-promo-form-body" noValidate>
          <fieldset disabled={readOnly} style={{ border: 'none', margin: 0, padding: 0, minWidth: 0 }}>
          <div className="ws-section" style={{ padding: 20, background: '#fff', borderRadius: 12 }}>
            <PromoCodeFormFields
              form={form}
              setForm={setForm}
              workshops={workshops}
              branches={branches}
              catalogProducts={catalogProducts}
              catalogServices={catalogServices}
              catalogLoading={catalogLoading}
              codeReadOnly={isEdit}
              usageCount={usageCount}
              formError={formError}
              showStatus={isEdit}
              requireWorkshop
              promotionOptions={promotionSelectOptions}
              promotionsLoading={promotionsLoading}
              rulesLocked={Boolean(String(form.promotionId || '').trim())}
              onPromotionLinkChange={readOnly ? undefined : handlePromotionLinkChange}
              onAutoGenerate={
                isEdit ? undefined : () => setForm((prev) => ({ ...prev, code: generatePromoCode() }))
              }
            />

            {!isEdit ? (
              <div className="mk-code-approval-note" style={{ marginTop: 16 }}>
                <Hourglass size={14} strokeWidth={2} />
                <span>{t('form.approvalNote')}</span>
              </div>
            ) : null}

            <div className="mkp-form-page-footer" style={{ marginTop: 20 }}>
              <button
                type="button"
                onClick={goBack}
                className="btn-secondary"
                disabled={submitting}
              >
                {readOnly ? t('form.btn.close') : t('form.btn.cancel')}
              </button>
              {!readOnly ? (
              <button
                type="submit"
                className="btn-submit"
                disabled={submitting || saveBlockedByCatalog}
              >
                {submitting ? (
                  <>
                    <Loader2 size={14} className="mk-code-spin" />
                    {isEdit ? t('form.btn.saving') : t('form.btn.submitting')}
                  </>
                ) : saveBlockedByCatalog ? (
                  t('form.btn.loadingCatalog')
                ) : isEdit ? (
                  t('form.btn.update')
                ) : (
                  t('form.btn.create')
                )}
              </button>
              ) : null}
            </div>
          </div>
          </fieldset>
        </form>
      )}
    </MarketingFormShell>
  );
}
