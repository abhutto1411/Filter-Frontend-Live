import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
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

function formatDate(value) {
  if (!value) return 'Not set';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
}

function renderValue(value) {
  if (value === null || value === undefined || value === '') return 'Not configured';
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

function FieldGrid({ rows }) {
  return (
    <div className="mk-config-grid">
      {rows.map((row) => (
        <div key={row.label} className="mk-config-field">
          <span>{row.label}</span>
          <strong>{renderValue(row.value)}</strong>
        </div>
      ))}
    </div>
  );
}

function ItemList({ scope, ids, categoryIds = [], items, emptyLabel }) {
  if (scope === 'none') {
    return <p className="mk-config-muted">Does not apply.</p>;
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
    .map((id) => ({ id: String(id), name: categoryMap.get(String(id)) || `Category ${id}` }))
    .filter((item) => item.id);

  if (selected.length === 0 && selectedCategories.length === 0) {
    return <p className="mk-config-muted">No selected items/categories found.</p>;
  }

  return (
    <div className="mk-config-chip-list">
      {selectedCategories.map((item) => (
        <span key={`category-${item.id}`} className="mk-config-chip">
          {selected.length > 0 ? 'Category scope' : 'Complete category'}
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
        const promo = normalizePromoCode(detail?.promoCode || detail?.data || detail?.item || detail);

        setRecord(promo);
        setForm(reconcilePromoFormWithWorkshops(promo, workshops));
        setLookups({ workshops, branches, products, services });
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Promo code configuration load failed.');
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
      <MarketingFormShell title="Promo Code Configuration" onBack={() => navigate(listPath)} backLabel="Back to Promo Codes">
        <div className="mk-config-loading"><Loader2 className="mk-code-spin" size={28} /> Loading configuration...</div>
      </MarketingFormShell>
    );
  }

  if (error || !record || !form) {
    return (
      <MarketingFormShell title="Promo Code Configuration" onBack={() => navigate(listPath)} backLabel="Back to Promo Codes">
        <div className="mk-code-error-banner">{error || 'Promo code not found.'}</div>
      </MarketingFormShell>
    );
  }

  return (
    <MarketingFormShell
      title="Promo Code Configuration"
      subtitle="Professional read-only summary of the active rule set and selected eligibility."
      backLabel="Back to Promo Codes"
      onBack={() => navigate(listPath)}
      className="mk-page mkp-form-page mk-config-page"
    >
      <div className="mk-config-hero">
        <div>
          <span className="mk-config-eyebrow">Promo Code</span>
          <h2>{record.code}</h2>
          <p>{record.promotion || form.description || 'Standalone promo code'}</p>
        </div>
        <div className="mk-config-hero-badges">
          <span className={`mk-config-status status-${String(record.status).toLowerCase().replace(/\s+/g, '-')}`}>
            {record.status}
          </span>
          <span className={record.isActive ? 'mk-config-live' : 'mk-config-muted-pill'}>
            {record.isActive ? 'Live on POS' : 'Not live on POS'}
          </span>
        </div>
      </div>

      <div className="mk-config-layout">
        <ConfigCard icon={Tags} title="Discount & POS Logic">
          <FieldGrid
            rows={[
              { label: 'Discount Type', value: mapDiscountTypeToUi(form.discountType) },
              { label: 'Discount Value', value: form.discountType === 'percent' ? `${form.discountValue}%` : `SAR ${form.discountValue}` },
              { label: 'Minimum Order', value: form.minOrderAmount ? `SAR ${form.minOrderAmount}` : 'No minimum' },
              { label: 'Usage Limit', value: form.usageLimit || 'Unlimited' },
            ]}
          />
          <div className="mk-config-rule">
            <CheckCircle2 size={16} />
            <div>
              <strong>{rule?.title || 'Selected item rule'}</strong>
              <p>{rule?.summary || 'Default selected item matching rule is applied.'}</p>
            {form.productScope === 'selected' && form.serviceScope === 'selected' ? (
              <p>
                Selected service is{' '}
                <b>{form.selectedServiceRequired === false ? 'optional' : 'mandatory'}</b>
                {' '}with selected product/category.
              </p>
            ) : null}
            </div>
          </div>
          {requirementLines.length > 0 ? (
            <div className="mk-config-requirements">
              <strong>Requirements to apply this promo</strong>
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

        <ConfigCard icon={CalendarDays} title="Validity">
          <FieldGrid
            rows={[
              { label: 'Valid From', value: formatDate(form.validFrom) },
              { label: 'Valid To', value: formatDate(form.validTo) },
              { label: 'Current Usage', value: record.currentUsage ?? 0 },
              { label: 'Remaining Usage', value: record.remainingUsage ?? 'Auto calculated' },
            ]}
          />
        </ConfigCard>

        <ConfigCard icon={Layers3} title="Workshop & Branch Scope">
          <FieldGrid
            rows={[
              { label: 'Workshops', value: form.workshopMode === 'all' ? 'All workshops' : `${selectedWorkshops.length} selected` },
              { label: 'Branches', value: form.branchMode === 'all' ? 'All branches' : `${selectedBranches.length} selected` },
            ]}
          />
          {selectedWorkshops.length > 0 ? (
            <div className="mk-config-chip-list">{selectedWorkshops.map((name) => <span key={name} className="mk-config-chip">{name}</span>)}</div>
          ) : null}
          {selectedBranches.length > 0 ? (
            <div className="mk-config-chip-list">{selectedBranches.map((name) => <span key={name} className="mk-config-chip">{name}</span>)}</div>
          ) : null}
        </ConfigCard>

        <ConfigCard icon={ReceiptText} title="Products Applied">
          <ItemList
            scope={form.productScope}
            ids={form.productIds}
            categoryIds={form.productCategoryIds}
            items={lookups.products}
            emptyLabel="All products in the master catalog are eligible."
          />
        </ConfigCard>

        <ConfigCard icon={ReceiptText} title="Services Applied">
          <ItemList
            scope={form.serviceScope}
            ids={form.serviceIds}
            categoryIds={form.serviceCategoryIds}
            items={lookups.services}
            emptyLabel="All services in the master catalog are eligible."
          />
        </ConfigCard>

        {form.description ? (
          <ConfigCard icon={ReceiptText} title="Description / Notes">
            <p className="mk-config-note">{form.description}</p>
          </ConfigCard>
        ) : null}
      </div>
    </MarketingFormShell>
  );
}
