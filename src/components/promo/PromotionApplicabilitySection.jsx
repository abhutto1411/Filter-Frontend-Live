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
        hint='Choose exactly one rule. Set Products or Services to "Specific only" and search items below.'
        disabledHint='Select "Specific only" for products and/or services to enable these rules.'
      />

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
            <MultiSelectApiField
              label="Search Products"
              icon={Package}
              options={productOptions}
              selectedIds={(form.productTriggerIds || []).map(String)}
              onChange={(ids) => onChange('productTriggerIds', ids)}
              loading={loading}
              error={error}
              placeholder="Type to search products…"
            />
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
            <MultiSelectApiField
              label="Search Services"
              icon={Wrench}
              options={serviceOptions}
              selectedIds={(form.serviceTriggerIds || []).map(String)}
              onChange={(ids) => onChange('serviceTriggerIds', ids)}
              loading={loading}
              error={error}
              placeholder="Type to search services…"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
