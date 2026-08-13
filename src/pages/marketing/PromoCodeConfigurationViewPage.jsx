import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { CalendarDays, CheckCircle2, Layers3, Loader2, ReceiptText, Tags } from 'lucide-react';
import { marketingGetPromoCode, marketingGetPromoCodeOptions } from '../../services/superAdminMarketingApi';
import {
  catalogItemId,
  catalogItemName,
  reconcilePromoFormWithWorkshops,
} from '../../components/promo/promoCodeFormUtils';
import { PROMO_APPLICATION_RULES } from '../../components/promo/PromoCodeFormFields';
import { buildPromoApplicationRequirements } from '../../components/promo/promoApplicationRequirements';
import { MarketingFormShell } from './MarketingFormShell';
import { marketingSectionPath } from './marketingRouteUtils';
import { promoStatusLabel, promoT } from '../../utils/promoCodesI18n';
import { resolveMarketingLocale } from '../../utils/marketingPromotionsI18n';
import { mapDiscountTypeToUi, normalizePromoCode } from './promoCodeShared';
import './MarketingUniversal.css';

function normalizeRows(rows = [], kind) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      const id = catalogItemId(row, kind);
      if (!id) return null;
      return {
        ...row,
        id,
        name: catalogItemName(row),
        categoryId: String(row.categoryId ?? row.category_id ?? row.category?.id ?? ''),
        categoryName: row.categoryName ?? row.category_name ?? row.category?.name ?? 'Uncategorized',
      };
    })
    .filter(Boolean);
}

function normalizeOptionRows(rows = [], fallback) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    id: String(row.id ?? row.value ?? ''),
    name: row.name ?? row.label ?? row.branchName ?? `${fallback} ${row.id}`,
    workshopId: row.workshopId ?? row.workshop_id ?? '',
  }));
}

function createLabelMap(rows) {
  const map = new Map();
  rows.forEach((row) => {
    if (!row?.id) return;
    map.set(String(row.id), row.name);
  });
  return map;
}

function formatDate(value, locale, t) {
  if (!value) return t('config.notSet');
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString(locale === 'ar' ? 'ar-SA' : undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

function renderValue(value, t) {
  if (value === null || value === undefined || value === '') return t('config.notConfigured');
  return String(value);
}

function ConfigCard({ icon: Icon, title, children }) {
  return (
    <section className="mk-config-card">
      <div className="mk-config-card-head">
        <span className="mk-config-icon"><Icon size={16} /></span>
        <h3>{title}</h3>
      </div>
      {children}
    </section>
  );
}

function FieldGrid({ rows, t }) {
  return (
    <div className="mk-config-grid">
      {rows.map((row) => (
        <div key={row.label} className="mk-config-field">
          <span>{row.label}</span>
          <strong>{renderValue(row.value, t)}</strong>
        </div>
      ))}
    </div>
  );
}

function ItemList({ scope, ids, categoryIds = [], items, emptyLabel, t }) {
  if (scope === 'none') {
    return <p className="mk-config-muted">{t('config.doesNotApply')}</p>;
  }
  if (scope !== 'selected') {
    return <p className="mk-config-muted">{emptyLabel}</p>;
  }
  const selected = ids
    .map((id) => items.find((item) => String(item.id) === String(id)))
    .filter(Boolean);
  const categoryMap = new Map();
  items.forEach((item) => {
    if (item.categoryId && item.categoryName) {
      categoryMap.set(String(item.categoryId), item.categoryName);
    }
  });
  const selectedCategories = categoryIds
    .map((id) => ({ id: String(id), name: categoryMap.get(String(id)) || t('config.categoryFallback', { id }) }))
    .filter((item) => item.id);

  if (selected.length === 0 && selectedCategories.length === 0) {
    return <p className="mk-config-muted">{t('config.emptyItems')}</p>;
  }

  return (
    <div className="mk-config-chip-list">
      {selectedCategories.map((item) => (
        <span key={`category-${item.id}`} className="mk-config-chip">
          {selected.length > 0 ? t('config.categoryScope') : t('config.completeCategory')}
          <small>{item.name}</small>
        </span>
      ))}
      {selected.map((item) => (
        <span key={item.id} className="mk-config-chip">
          {item.name}
          {item.categoryName ? <small>{item.categoryName}</small> : null}
        </span>
      ))}
    </div>
  );
}

export default function PromoCodeConfigurationViewPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const outletCtx = useOutletContext() || {};
  const locale = resolveMarketingLocale(outletCtx);
  const t = useCallback((key, vars) => promoT(locale, key, vars), [locale]);
  const listPath = marketingSectionPath(location.pathname, 'promo-codes');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [record, setRecord] = useState(null);
  const [form, setForm] = useState(null);
  const [lookups, setLookups] = useState({
    workshops: [],
    branches: [],
    products: [],
    services: [],
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError('');
        const [detail, options] = await Promise.all([
          marketingGetPromoCode(id),
          marketingGetPromoCodeOptions(),
        ]);
        if (cancelled) return;

        const workshops = normalizeOptionRows(options?.workshops, 'Workshop');
        const branches = normalizeOptionRows(
          options?.branches ?? options?.applicableBranches,
          'Branch',
        );
        const products = normalizeRows(options?.products, 'products');
        const services = normalizeRows(options?.services, 'services');
        const promo = normalizePromoCode(detail?.promoCode || detail?.data || detail?.item || detail, locale);

        setRecord(promo);
        setForm(reconcilePromoFormWithWorkshops(promo, workshops));
        setLookups({ workshops, branches, products, services });
      } catch (err) {
        if (!cancelled) setError(err?.message || t('config.errLoad'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const workshopMap = useMemo(() => createLabelMap(lookups.workshops), [lookups.workshops]);
  const branchMap = useMemo(() => createLabelMap(lookups.branches), [lookups.branches]);
  const rule = PROMO_APPLICATION_RULES.find((item) => item.value === form?.selectedItemMatchMode);
  const requirementLines = form
    ? buildPromoApplicationRequirements({
        selectedItemMatchMode: form.selectedItemMatchMode,
        selectedServiceRequired: form.selectedServiceRequired !== false,
        productScope: form.productScope,
        serviceScope: form.serviceScope,
        productIds: form.productIds,
        serviceIds: form.serviceIds,
        productCategoryIds: form.productCategoryIds,
        serviceCategoryIds: form.serviceCategoryIds,
        products: lookups.products,
        services: lookups.services,
      })
    : [];

  const selectedWorkshops = form?.workshopMode === 'selected'
    ? form.workshopIds.map((wsId) => workshopMap.get(String(wsId)) || `Workshop ${wsId}`)
    : [];
  const selectedBranches = form?.branchMode === 'selected'
    ? form.branchIds.map((branchId) => branchMap.get(String(branchId)) || `Branch ${branchId}`)
    : [];

  if (loading) {
    return (
      <MarketingFormShell title={t('config.title')} onBack={() => navigate(listPath)} backLabel={t('config.back')}>
        <div className="mk-config-loading"><Loader2 className="mk-code-spin" size={28} /> {t('config.loading')}</div>
      </MarketingFormShell>
    );
  }

  if (error || !record || !form) {
    return (
      <MarketingFormShell title={t('config.title')} onBack={() => navigate(listPath)} backLabel={t('config.back')}>
        <div className="mk-code-error-banner">{error || t('config.notFound')}</div>
      </MarketingFormShell>
    );
  }

  return (
    <MarketingFormShell
      title={t('config.title')}
      subtitle={t('config.subtitle')}
      backLabel={t('config.back')}
      onBack={() => navigate(listPath)}
      className="mk-page mkp-form-page mk-config-page"
    >
      <div className="mk-config-hero">
        <div>
          <span className="mk-config-eyebrow">{t('config.eyebrow')}</span>
          <h2>{record.code}</h2>
          <p>{record.promotion || form.description || t('config.standalone')}</p>
        </div>
        <div className="mk-config-hero-badges">
          <span className={`mk-config-status status-${String(record.status).toLowerCase().replace(/\s+/g, '-')}`}>
            {promoStatusLabel(locale, record.status)}
          </span>
          <span className={record.isActive ? 'mk-config-live' : 'mk-config-muted-pill'}>
            {record.isActive ? t('config.live') : t('config.notLive')}
          </span>
        </div>
      </div>

      <div className="mk-config-layout">
        <ConfigCard icon={Tags} title={t('config.card.discount')}>
          <FieldGrid
            t={t}
            rows={[
              { label: t('config.label.discountType'), value: mapDiscountTypeToUi(form.discountType, locale) },
              {
                label: t('config.label.discountValue'),
                value:
                  form.discountType === 'percent'
                    ? t('config.valuePct', { value: form.discountValue })
                    : t('config.valueSar', { value: form.discountValue }),
              },
              {
                label: t('config.label.minOrder'),
                value: form.minOrderAmount
                  ? t('config.minSar', { value: form.minOrderAmount })
                  : t('config.noMinimum'),
              },
              {
                label: t('config.label.usageLimit'),
                value: form.usageLimit || t('config.unlimited'),
              },
            ]}
          />
          <div className="mk-config-rule">
            <CheckCircle2 size={16} />
            <div>
              <strong>{rule?.title || t('config.ruleDefault')}</strong>
              <p>{rule?.summary || t('config.ruleDefaultSummary')}</p>
            {form.productScope === 'selected' && form.serviceScope === 'selected' ? (
              <p>
                {t('config.serviceWithProduct', {
                  mode:
                    form.selectedServiceRequired === false
                      ? t('config.serviceOptional')
                      : t('config.serviceMandatory'),
                })}
              </p>
            ) : null}
            </div>
          </div>
          {requirementLines.length > 0 ? (
            <div className="mk-config-requirements">
              <strong>{t('config.requirements')}</strong>
              <ul className="mk-config-requirements-list">
                {requirementLines.map((line, index) => {
                  if (line.type === 'heading') {
                    return <li key={index} className="mk-config-req-heading">{line.text}</li>;
                  }
                  if (line.type === 'subheading') {
                    return <li key={index} className="mk-config-req-subheading">{line.text}</li>;
                  }
                  if (line.type === 'note') {
                    return <li key={index} className="mk-config-req-note">{line.text}</li>;
                  }
                  if (line.type === 'bullet') {
                    return <li key={index} className="mk-config-req-bullet">{line.text}</li>;
                  }
                  return <li key={index}>{line.text}</li>;
                })}
              </ul>
            </div>
          ) : null}
        </ConfigCard>

        <ConfigCard icon={CalendarDays} title={t('config.card.validity')}>
          <FieldGrid
            t={t}
            rows={[
              { label: t('config.label.validFrom'), value: formatDate(form.validFrom, locale, t) },
              { label: t('config.label.validTo'), value: formatDate(form.validTo, locale, t) },
              { label: t('config.label.usage'), value: record.currentUsage ?? 0 },
              {
                label: t('config.label.remaining'),
                value: record.remainingUsage ?? t('config.remainingAuto'),
              },
            ]}
          />
        </ConfigCard>

        <ConfigCard icon={Layers3} title={t('config.card.scope')}>
          <FieldGrid
            t={t}
            rows={[
              {
                label: t('config.label.workshops'),
                value:
                  form.workshopMode === 'all'
                    ? t('config.workshopsAll')
                    : t('config.nSelected', { n: selectedWorkshops.length }),
              },
              {
                label: t('config.label.branches'),
                value:
                  form.branchMode === 'all'
                    ? t('config.branchesAll')
                    : t('config.nSelected', { n: selectedBranches.length }),
              },
            ]}
          />
          {selectedWorkshops.length > 0 ? (
            <div className="mk-config-chip-list">{selectedWorkshops.map((name) => <span key={name} className="mk-config-chip">{name}</span>)}</div>
          ) : null}
          {selectedBranches.length > 0 ? (
            <div className="mk-config-chip-list">{selectedBranches.map((name) => <span key={name} className="mk-config-chip">{name}</span>)}</div>
          ) : null}
        </ConfigCard>

        <ConfigCard icon={ReceiptText} title={t('config.card.products')}>
          <ItemList
            t={t}
            scope={form.productScope}
            ids={form.productIds}
            categoryIds={form.productCategoryIds}
            items={lookups.products}
            emptyLabel={t('config.allProducts')}
          />
        </ConfigCard>

        <ConfigCard icon={ReceiptText} title={t('config.card.services')}>
          <ItemList
            t={t}
            scope={form.serviceScope}
            ids={form.serviceIds}
            categoryIds={form.serviceCategoryIds}
            items={lookups.services}
            emptyLabel={t('config.allServices')}
          />
        </ConfigCard>

        {form.description ? (
          <ConfigCard icon={ReceiptText} title={t('config.card.description')}>
            <p className="mk-config-note">{form.description}</p>
          </ConfigCard>
        ) : null}
      </div>
    </MarketingFormShell>
  );
}
