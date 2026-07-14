import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Hourglass, Loader2 } from 'lucide-react';
import PromoCodeFormFields from '../../components/promo/PromoCodeFormFields';
import {
  buildMarketingPromoPayload,
  catalogItemId,
  emptyPromoForm,
  generatePromoCode,
  promoToForm,
  reconcilePromoFormWithWorkshops,
  strTrim,
  validatePromoForm,
} from '../../components/promo/promoCodeFormUtils';
import {
  marketingCreatePromoCode,
  marketingGetPromoCode,
  marketingGetPromoCodeOptions,
  marketingUpdatePromoCode,
} from '../../services/superAdminMarketingApi';
import { MarketingFormShell } from './MarketingFormShell';
import { marketingSectionPath } from './marketingRouteUtils';
import { normalizePromoCode } from './promoCodeShared';
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
          setOptionsError(error?.message || 'Failed to load form options.');
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
        );

        setForm(reconcilePromoFormWithWorkshops(item, workshops));
        setUsageCount(item.currentUsage ?? item.current_usage_count ?? null);
      } catch (error) {
        if (!cancelled) {
          setRecordError(error?.message || 'Promo code load failed.');
        }
      } finally {
        if (!cancelled) setLoadingRecord(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, isEdit, readOnly, loadingOptions, workshops]);

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
          state: { successMessage: 'Promo code updated successfully.' },
        });
      } else {
        await marketingCreatePromoCode(payload);
        navigate(listPath, {
          state: {
            successMessage:
              'Promo code submitted for Super Admin approval. It will appear on POS after approval.',
          },
        });
      }
    } catch (error) {
      setFormError(error?.message || 'Promo code save failed.');
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
      title={readOnly ? 'View Promo Code' : isEdit ? 'Edit Promo Code' : 'Create Promo Code'}
      subtitle={
        readOnly
          ? 'Full promo code configuration (read-only).'
          : isEdit
            ? 'Discount rules, branch scope, and catalog eligibility.'
            : 'Requires cashier to enter this code at POS. Does not auto-apply on invoices.'
      }
      backLabel="Back to Promo Codes"
      onBack={goBack}
      className="mk-page mk-code-page mkp-form-page ws-promo-sub-screen"
    >
      {loadingRecord || loadingOptions ? (
        <div className="mk-code-empty-state">
          <Loader2 size={28} className="mk-code-spin" />
          <div>Loading promo code form...</div>
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
              onAutoGenerate={
                isEdit ? undefined : () => setForm((prev) => ({ ...prev, code: generatePromoCode() }))
              }
            />

            {!isEdit ? (
              <div className="mk-code-approval-note" style={{ marginTop: 16 }}>
                <Hourglass size={14} strokeWidth={2} />
                <span>
                  Cashier must enter this code at POS. It does <b>not</b> auto-apply.
                  Super Admin approval is required before activation.
                </span>
              </div>
            ) : null}

            <div className="mkp-form-page-footer" style={{ marginTop: 20 }}>
              <button
                type="button"
                onClick={goBack}
                className="btn-secondary"
                disabled={submitting}
              >
                {readOnly ? 'Close' : 'Cancel'}
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
                    {isEdit ? 'Saving...' : 'Submitting...'}
                  </>
                ) : saveBlockedByCatalog ? (
                  'Loading catalog...'
                ) : isEdit ? (
                  'Update Promo'
                ) : (
                  'Create Promo'
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
