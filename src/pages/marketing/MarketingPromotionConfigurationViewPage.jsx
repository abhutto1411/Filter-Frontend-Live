import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { CalendarDays, CheckCircle2, Gift, Layers3, Loader2, Megaphone, ReceiptText } from 'lucide-react';
import { marketingGetPromotion } from '../../services/superAdminMarketingApi';
import { PROMO_APPLICATION_RULES } from '../../components/promo/PromoCodeFormFields';
import { buildPromoApplicationRequirements } from '../../components/promo/promoApplicationRequirements';
import { MarketingFormShell } from './MarketingFormShell';
import {
  alignStoredIdsWithOptions,
  formatPromotionDiscountDisplay,
  formatStatusLabel,
  loadPromotionDropdownData,
  normalizePromotion,
  promotionFormFromItem,
  resolvePromotionBasePath,
} from './marketingPromotionShared';
import './MarketingUniversal.css';

function formatDateTime(value) {
  if (!value) return 'Not set';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function createLookup(rows) {
  const map = new Map();
  rows.forEach((row) => {
    if (!row) return;
    const label = row.label || row.name || row.title || row.id;
    [row.id, row.realId, String(row.id || '').replace(/^product-|^service-/, '')]
      .filter(Boolean)
      .forEach((key) => map.set(String(key), label));
  });
  return map;
}

function labelsFromIds(ids = [], map) {
  return ids.map((id) => map.get(String(id)) || map.get(String(id).replace(/^product-|^service-/, '')) || String(id));
}

function createCategoryLookup(rows, serviceOnly = false) {
  const map = new Map();
  rows.forEach((row) => {
    const isService = String(row?.itemKind || row?.type || '').toLowerCase() === 'service';
    if (isService !== serviceOnly) return;
    const id = String(row?.categoryId ?? row?.category_id ?? '').trim();
    const label = row?.categoryName ?? row?.category_name ?? row?.category?.name;
    if (id && label) map.set(id, label);
  });
  return map;
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
          <strong>{row.value || 'Not configured'}</strong>
        </div>
      ))}
    </div>
  );
}

function ChipList({ values, empty }) {
  if (!values || values.length === 0) return <p className="mk-config-muted">{empty}</p>;
  return (
    <div className="mk-config-chip-list">
      {values.map((value) => (
        <span key={value} className="mk-config-chip">{value}</span>
      ))}
    </div>
  );
}

function ScopeList({ scope, labels, categoryLabels = [], allText }) {
  if (scope === 'none') return <p className="mk-config-muted">Does not apply.</p>;
  if (scope !== 'selected') return <p className="mk-config-muted">{allText}</p>;
  const allLabels = [
    ...categoryLabels.map((label) =>
      labels.length > 0 ? `Category scope: ${label}` : `Complete category: ${label}`,
    ),
    ...labels,
  ];
  return (
    <ChipList values={allLabels} empty="No selected items/categories found." />
  );
}

export default function MarketingPromotionConfigurationViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = resolvePromotionBasePath(location.pathname);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [record, setRecord] = useState(null);
  const [form, setForm] = useState(null);
  const [lookups, setLookups] = useState({
    workshops: [],
    branches: [],
    zones: [],
    triggerItems: [],
    rewardItems: [],
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError('');
        const [detail, dropdowns] = await Promise.all([
          marketingGetPromotion(id),
          loadPromotionDropdownData(),
        ]);
        if (cancelled) return;

        const raw = detail?.promotion || detail?.data || detail?.item || detail;
        const normalized = normalizePromotion(raw);
        const nextForm = promotionFormFromItem(normalized);
        const productOptions = dropdowns.triggerItems.filter((item) => item.itemKind !== 'service');
        const serviceOptions = dropdowns.triggerItems.filter((item) => item.itemKind === 'service');

        nextForm.productTriggerIds = alignStoredIdsWithOptions(nextForm.productTriggerIds, productOptions);
        nextForm.serviceTriggerIds = alignStoredIdsWithOptions(nextForm.serviceTriggerIds, serviceOptions);
        nextForm.rewardProductIds = alignStoredIdsWithOptions(nextForm.rewardProductIds, dropdowns.rewardItems);

        setRecord(normalized);
        setForm(nextForm);
        setLookups(dropdowns);
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Promotion configuration load failed.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const workshopMap = useMemo(() => createLookup(lookups.workshops), [lookups.workshops]);
  const branchMap = useMemo(() => createLookup(lookups.branches), [lookups.branches]);
  const zoneMap = useMemo(() => createLookup(lookups.zones), [lookups.zones]);
  const catalogMap = useMemo(() => createLookup(lookups.triggerItems), [lookups.triggerItems]);
  const rewardMap = useMemo(() => createLookup(lookups.rewardItems), [lookups.rewardItems]);
  const productCategoryMap = useMemo(
    () => createCategoryLookup(lookups.triggerItems, false),
    [lookups.triggerItems],
  );
  const serviceCategoryMap = useMemo(
    () => createCategoryLookup(lookups.triggerItems, true),
    [lookups.triggerItems],
  );
  const rewardProductCategoryMap = useMemo(
    () => createCategoryLookup(lookups.rewardItems, false),
    [lookups.rewardItems],
  );
  const rewardServiceCategoryMap = useMemo(
    () => createCategoryLookup(lookups.rewardItems, true),
    [lookups.rewardItems],
  );
  const rule = PROMO_APPLICATION_RULES.find((item) => item.value === form?.selectedItemMatchMode);

  if (loading) {
    return (
      <MarketingFormShell title="Promotion Configuration" onBack={() => navigate(basePath)} backLabel="Back to Promotions">
        <div className="mk-config-loading"><Loader2 className="mk-code-spin" size={28} /> Loading configuration...</div>
      </MarketingFormShell>
    );
  }

  if (error || !record || !form) {
    return (
      <MarketingFormShell title="Promotion Configuration" onBack={() => navigate(basePath)} backLabel="Back to Promotions">
        <div className="mk-code-error-banner">{error || 'Promotion not found.'}</div>
      </MarketingFormShell>
    );
  }

  const productLabels = labelsFromIds(form.productTriggerIds, catalogMap);
  const serviceLabels = labelsFromIds(form.serviceTriggerIds, catalogMap);
  const rewardLabels = labelsFromIds(form.rewardProductIds, rewardMap);
  const productCategoryLabels = labelsFromIds(
    form.productCategoryTriggerIds,
    productCategoryMap,
  );
  const serviceCategoryLabels = labelsFromIds(
    form.serviceCategoryTriggerIds,
    serviceCategoryMap,
  );
  const rewardCategoryLabels = [
    ...labelsFromIds(form.rewardProductCategoryIds, rewardProductCategoryMap),
    ...labelsFromIds(form.rewardServiceCategoryIds, rewardServiceCategoryMap),
  ];
  const requirementLines = buildPromoApplicationRequirements({
    selectedItemMatchMode: form.selectedItemMatchMode,
    selectedServiceRequired: form.selectedServiceRequired !== false,
    productScope: form.productScope,
    serviceScope: form.serviceScope,
    productIds: form.productTriggerIds,
    serviceIds: form.serviceTriggerIds,
    productCategoryIds: form.productCategoryTriggerIds,
    serviceCategoryIds: form.serviceCategoryTriggerIds,
    products: lookups.triggerItems?.filter((item) => item.itemKind !== 'service') ?? [],
    services: lookups.triggerItems?.filter((item) => item.itemKind === 'service') ?? [],
  });

  return (
    <MarketingFormShell
      title="Promotion Configuration"
      subtitle="Professional read-only summary of eligibility, reward logic, and publishing settings."
      backLabel="Back to Promotions"
      onBack={() => navigate(basePath)}
      className="mk-page mkp-form-page mk-config-page"
    >
      <div className="mk-config-hero">
        <div>
          <span className="mk-config-eyebrow">Marketing Promotion</span>
          <h2>{record.name}</h2>
          <p>{record.description || 'No description added.'}</p>
        </div>
        <div className="mk-config-hero-badges">
          <span className={`mk-config-status status-${String(record.status).toLowerCase().replace(/\s+/g, '-')}`}>
            {formatStatusLabel(record.status)}
          </span>
          <span className={record.isActive ? 'mk-config-live' : 'mk-config-muted-pill'}>
            {record.isActive ? 'Live on POS' : 'Not live on POS'}
          </span>
        </div>
      </div>

      <div className="mk-config-layout">
        <ConfigCard icon={Megaphone} title="Promotion Logic">
          <FieldGrid
            rows={[
              { label: 'Strategy', value: form.strategy },
              { label: 'Promotion Type', value: form.promotionType },
              { label: 'Discount', value: formatPromotionDiscountDisplay(record) },
              { label: 'Customer Segment', value: form.customerSegment },
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

        <ConfigCard icon={CalendarDays} title="Schedule & Limits">
          <FieldGrid
            rows={[
              { label: 'Start Date', value: formatDateTime(form.startDate) },
              { label: 'End Date', value: formatDateTime(form.endDate) },
              { label: 'Minimum Purchase', value: form.minPurchase ? `SAR ${form.minPurchase}` : 'No minimum' },
              { label: 'Max Usage', value: form.maxUsage || 'Unlimited' },
            ]}
          />
        </ConfigCard>

        <ConfigCard icon={Layers3} title="Location Scope">
          <FieldGrid
            rows={[
              { label: 'Source Workshop', value: workshopMap.get(String(form.sourceWorkshopId)) || 'All / not restricted' },
              { label: 'Target Workshop', value: workshopMap.get(String(form.targetWorkshopId)) || 'All / not restricted' },
            ]}
          />
          <h4 className="mk-config-subtitle">Target Branches</h4>
          <ChipList values={labelsFromIds(form.targetBranchIds, branchMap)} empty="All branches or no branch restriction." />
          <h4 className="mk-config-subtitle">Target Zones</h4>
          <ChipList values={labelsFromIds(form.targetZoneIds, zoneMap)} empty="No zone restriction." />
        </ConfigCard>

        <ConfigCard icon={ReceiptText} title="Products Applied">
          <ScopeList
            scope={form.productScope}
            labels={productLabels}
            categoryLabels={productCategoryLabels}
            allText="All products in the master catalog are eligible."
          />
        </ConfigCard>

        <ConfigCard icon={ReceiptText} title="Services Applied">
          <ScopeList
            scope={form.serviceScope}
            labels={serviceLabels}
            categoryLabels={serviceCategoryLabels}
            allText="All services in the master catalog are eligible."
          />
        </ConfigCard>

        {form.rewardBenefitType && form.rewardBenefitType !== 'none' ? (
          <ConfigCard icon={Gift} title="Reward Configuration">
            <FieldGrid
              rows={[
                { label: 'Reward Type', value: form.rewardBenefitType },
                { label: 'Reward Value', value: form.rewardBenefitType === 'free' ? 'Free' : form.rewardDiscountValue },
                { label: 'Max Quantity', value: form.rewardMaxQuantity || 'No max quantity' },
              ]}
            />
            <ChipList
              values={[
                ...rewardCategoryLabels.map((label) => `Complete category: ${label}`),
                ...rewardLabels,
              ]}
              empty="No reward items/categories selected."
            />
          </ConfigCard>
        ) : null}

        <ConfigCard icon={CheckCircle2} title="Publishing & Customer Display">
          <FieldGrid
            rows={[
              { label: 'Show on POS Invoice', value: form.showPos ? 'Yes' : 'No' },
              { label: 'Show on Customer Portal', value: form.showCustomerPortal ? 'Yes' : 'No' },
              { label: 'Auto Close on End Date', value: form.autoClose ? 'Yes' : 'No' },
              { label: 'Current Usage', value: record.usageCount ?? 0 },
            ]}
          />
          {form.bannerText ? <p className="mk-config-note"><b>Invoice Banner:</b> {form.bannerText}</p> : null}
          {form.terms ? <p className="mk-config-note"><b>Terms:</b> {form.terms}</p> : null}
        </ConfigCard>
      </div>
    </MarketingFormShell>
  );
}
