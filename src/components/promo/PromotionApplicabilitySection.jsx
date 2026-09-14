import React from 'react';
import { Package, Wrench } from 'lucide-react';
import PromoApplicationRulesPanel from './PromoApplicationRulesPanel';
import { PROMO_APPLICATION_RULES } from './promoApplicationRules';
import { MultiSelectApiField } from '../../pages/marketing/marketingPromotionShared';

const SCOPE_CHOICES = [
  { value: 'all', label: 'All' },
  { value: 'selected', label: 'Specific only' },
  { value: 'none', label: 'Does not apply' },
];

const TRIGGER_RULES = [
  {
    value: 'all_required',
    title: 'Must buy ALL selected items',
    summary:
      'The invoice must contain every selected product/service before the reward is granted.',
  },
  {
    value: 'any_present',
    title: 'Must buy ANY selected item',
    summary:
      'The invoice needs at least one selected product/service to grant the reward.',
  },
];

function categoryOptionsFromItems(items = []) {
  const map = new Map();
  items.forEach((item) => {
    const id = String(item.categoryId ?? item.category_id ?? '').trim();
    const label = item.categoryName ?? item.category_name ?? item.category?.name;
    if (id && label) map.set(id, label);
  });
  return [...map.entries()]
    .map(([id, label]) => ({ id, label, name: label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function ScopeRadios({ name, scope, onChange, disabled }) {
  return (
    <div className="ws-promo-scope-radios">
      {SCOPE_CHOICES.map((opt) => (
        <label key={opt.value} className="ws-promo-scope-radio">
          <input
            type="radio"
            name={name}
            checked={scope === opt.value}
            disabled={disabled}
            onChange={() => onChange(opt.value)}
          />
          {opt.label}
        </label>
      ))}
    </div>
  );
}

export default function PromotionApplicabilitySection({
  form,
  onChange,
  productOptions = [],
  serviceOptions = [],
  loading = false,
  error = '',
  disabled = false,
  variant = 'discount',
}) {
  const isTrigger = variant === 'trigger';
  const hasSpecificSelection =
    form.productScope === 'selected' || form.serviceScope === 'selected';
  const hasSelectedProducts =
    form.productScope === 'selected' &&
    ((form.productTriggerIds || []).length > 0 ||
      (form.productCategoryTriggerIds || []).length > 0);
  const hasSelectedServices =
    form.serviceScope === 'selected' &&
    ((form.serviceTriggerIds || []).length > 0 ||
      (form.serviceCategoryTriggerIds || []).length > 0);
  const productCategoryOptions = categoryOptionsFromItems(productOptions);
  const serviceCategoryOptions = categoryOptionsFromItems(serviceOptions);

  const sectionTitle = isTrigger
    ? 'What The Customer Must Buy (Trigger)'
    : 'Promotion Application Rules';

  const bannerText = isTrigger ? (
    <>
      <b>Trigger items:</b> The customer must buy these products/services for the
      reward below to apply automatically at POS.
    </>
  ) : (
    <>
      <b>Auto-apply promotion:</b> After Super Admin approval and POS activation, this
      discount applies automatically on eligible invoices. No promo code is required at
      checkout.
    </>
  );

  const rulesContextLabel = isTrigger
    ? 'Trigger match rule'
    : 'Promotion application rule';
  const rulesList = isTrigger ? TRIGGER_RULES : PROMO_APPLICATION_RULES;

  return (
    <div className="mkp-section">
      <div className="mkp-section-title">{sectionTitle}</div>

      <div className="mk-expense-info-banner" role="note">
        {bannerText}
      </div>

      <PromoApplicationRulesPanel
        selectedItemMatchMode={form.selectedItemMatchMode}
        onChange={(value) => onChange('selectedItemMatchMode', value)}
        hasSpecificSelection={hasSpecificSelection}
        contextLabel={rulesContextLabel}
        rules={rulesList}
        hint='Choose exactly one rule. Set Products or Services/Categories to "Specific only" and search items below.'
        disabledHint='Select "Specific only" for products, services, or categories to enable these rules.'
      >
        {hasSelectedProducts && hasSelectedServices ? (
          <div className="ws-promo-service-toggle">
            <div>
              <strong>Selected service required with selected product?</strong>
              <p>
                ON: invoice must include selected product/category plus selected service/category.
                OFF: selected service is optional; promotion can apply from selected products/categories.
              </p>
            </div>
            <button
              type="button"
              className={`ws-promo-toggle-btn${form.selectedServiceRequired !== false ? ' is-on' : ''}`}
              disabled={disabled}
              onClick={() =>
                onChange('selectedServiceRequired', form.selectedServiceRequired === false)
              }
            >
              {form.selectedServiceRequired !== false ? 'ON' : 'OFF'}
            </button>
          </div>
        ) : null}
      </PromoApplicationRulesPanel>

      <div className="ws-promo-scope-grid">
        <div className="ws-promo-picker">
          <div className="ws-promo-picker-head">
            <label>Products</label>
            {form.productScope === 'selected' && form.productTriggerIds?.length ? (
              <span className="ws-promo-picker-count">
                {form.productTriggerIds.length} selected
              </span>
            ) : null}
          </div>
          <ScopeRadios
            name="promotion-product-scope"
            scope={form.productScope}
            disabled={disabled}
            onChange={(value) => onChange('productScope', value)}
          />
          {form.productScope === 'selected' ? (
            <>
              <MultiSelectApiField
                label="Complete Product Categories"
                icon={Package}
                options={productCategoryOptions}
                selectedIds={(form.productCategoryTriggerIds || []).map(String)}
                onChange={(ids) => onChange('productCategoryTriggerIds', ids)}
                loading={loading}
                error={error}
                placeholder="Type to search categories…"
              />
              <MultiSelectApiField
                label="Specific Products From Categories"
                icon={Package}
                options={productOptions}
                selectedIds={(form.productTriggerIds || []).map(String)}
                onChange={(ids) => onChange('productTriggerIds', ids)}
                loading={loading}
                error={error}
                placeholder="Type to search products…"
              />
            </>
          ) : null}
        </div>

        <div className="ws-promo-picker">
          <div className="ws-promo-picker-head">
            <label>Services</label>
            {form.serviceScope === 'selected' && form.serviceTriggerIds?.length ? (
              <span className="ws-promo-picker-count">
                {form.serviceTriggerIds.length} selected
              </span>
            ) : null}
          </div>
          <ScopeRadios
            name="promotion-service-scope"
            scope={form.serviceScope}
            disabled={disabled}
            onChange={(value) => onChange('serviceScope', value)}
          />
          {form.serviceScope === 'selected' ? (
            <>
              <MultiSelectApiField
                label="Complete Service Categories"
                icon={Wrench}
                options={serviceCategoryOptions}
                selectedIds={(form.serviceCategoryTriggerIds || []).map(String)}
                onChange={(ids) => onChange('serviceCategoryTriggerIds', ids)}
                loading={loading}
                error={error}
                placeholder="Type to search categories…"
              />
              <MultiSelectApiField
                label="Specific Services From Categories"
                icon={Wrench}
                options={serviceOptions}
                selectedIds={(form.serviceTriggerIds || []).map(String)}
                onChange={(ids) => onChange('serviceTriggerIds', ids)}
                loading={loading}
                error={error}
                placeholder="Type to search services…"
              />
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
