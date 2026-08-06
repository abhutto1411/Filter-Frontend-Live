import React from 'react';
import { PROMO_APPLICATION_RULES } from './promoApplicationRules';

export default function PromoApplicationRulesPanel({
  selectedItemMatchMode = 'all_required',
  onChange,
  hasSpecificSelection = false,
  contextLabel = 'Promo application rule',
  hint = 'Choose exactly one rule. Set Products or Services to "Specific only" and select items below.',
  disabledHint = 'Select "Specific only" for products and/or services to enable these rules.',
  rules = PROMO_APPLICATION_RULES,
  children,
}) {
  const activeRule =
    rules.find(
      (rule) => rule.value === (selectedItemMatchMode || 'all_required'),
    ) ?? rules[0];

  return (
    <div className="ws-promo-rules-panel">
      <label className="ws-promo-match-mode-label">{contextLabel} *</label>
      <p className="ws-promo-rules-panel-hint">{hint}</p>
      <div className="ws-promo-match-mode-options">
        {rules.map((rule) => (
          <label
            key={rule.value}
            className={`ws-promo-match-mode-option ws-promo-rule-card${
              (selectedItemMatchMode || 'all_required') === rule.value ? ' is-active' : ''
            }${!hasSpecificSelection ? ' is-disabled' : ''}`}
          >
            <input
              type="radio"
              name="promoApplicationRule"
              checked={(selectedItemMatchMode || 'all_required') === rule.value}
              disabled={!hasSpecificSelection}
              onChange={() => onChange?.(rule.value)}
            />
            <span>
              <b>{rule.title}</b>
              <br />
              {rule.summary}
            </span>
          </label>
        ))}
      </div>
      {!hasSpecificSelection ? (
        <p className="ws-promo-rules-panel-warning">{disabledHint}</p>
      ) : (
        <p className="ws-promo-rules-panel-active">
          Active rule: <b>{activeRule.title}</b>
        </p>
      )}
      {children}
    </div>
  );
}
