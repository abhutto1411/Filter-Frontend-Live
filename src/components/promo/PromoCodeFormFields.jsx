import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { catalogItemId, catalogItemName } from './promoCodeFormUtils';

export const PROMO_APPLICATION_RULES = [
  {
    value: 'all_required',
    title: 'Rule 1 — All selected items required',
    summary:
      'Invoice must contain every selected product/service. Discount applies only on those selected lines.',
  },
  {
    value: 'any_present',
    title: 'Rule 2 — Any selected item',
    summary:
      'Invoice needs at least one selected product/service. Discount applies only on the matching lines.',
  },
  {
    value: 'entire_order',
    title: 'Rule 3 — Any selected item, entire invoice discount',
    summary:
      'Invoice needs at least one selected product/service. Discount applies on the full invoice total.',
  },
];

const SCOPE_CHOICES = [
  { value: 'all', label: 'All' },
  { value: 'selected', label: 'Specific only' },
  { value: 'none', label: 'Does not apply' },
];

function ScopeSection({
  title,
  scope,
  onScopeChange,
  items,
  selectedIds,
  onToggle,
  onSelectMany,
  kind,
  loading,
  disabled,
}) {
  const [search, setSearch] = useState('');

  const sorted = useMemo(
    () => [...items].sort((a, b) => catalogItemName(a).localeCompare(catalogItemName(b))),
    [items],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((row) => catalogItemName(row).toLowerCase().includes(q));
  }, [sorted, search]);

  const visibleIds = useMemo(
    () => filtered.map((row) => catalogItemId(row, kind)).filter(Boolean),
    [filtered, kind],
  );

  const selectedInView = visibleIds.filter((id) => selectedIds.includes(id)).length;

  return (
    <div className="ws-promo-picker">
      <div className="ws-promo-picker-head">
        <label>{title}</label>
        {scope === 'selected' && selectedIds.length > 0 ? (
          <span className="ws-promo-picker-count">{selectedIds.length} selected</span>
        ) : null}
      </div>
      <div className="ws-promo-scope-radios">
        {SCOPE_CHOICES.map((opt) => (
          <label key={opt.value} className="ws-promo-scope-radio">
            <input
              type="radio"
              name={`promo-${kind}-scope`}
              checked={scope === opt.value}
              disabled={disabled}
              onChange={() => onScopeChange(opt.value)}
            />
            {opt.label}
          </label>
        ))}
      </div>
      {scope === 'selected' ? (
        <>
          <div className="ws-promo-picker-search-wrap">
            <Search size={15} />
            <input
              type="text"
              className="ws-promo-picker-search"
              placeholder={`Search ${kind}…`}
              value={search}
              disabled={disabled || loading}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {!disabled && !loading && filtered.length > 0 ? (
            <div className="ws-promo-picker-actions">
              <button
                type="button"
                disabled={disabled}
                onClick={() => onSelectMany([...new Set([...selectedIds, ...visibleIds])])}
              >
                Select visible ({visibleIds.length})
              </button>
              <button
                type="button"
                disabled={disabled || selectedInView === 0}
                onClick={() => {
                  const remove = new Set(visibleIds);
                  onSelectMany(selectedIds.filter((id) => !remove.has(id)));
                }}
              >
                Clear visible
              </button>
            </div>
          ) : null}
          <div className="ws-promo-picker-list">
            {loading ? (
              <p className="ws-promo-picker-empty">Loading catalog…</p>
            ) : disabled ? (
              <p className="ws-promo-picker-empty">Select at least one branch first.</p>
            ) : sorted.length === 0 ? (
              <p className="ws-promo-picker-empty">
                No {kind} on the selected branch(es).
              </p>
            ) : filtered.length === 0 ? (
              <p className="ws-promo-picker-empty">
                No {kind} match &ldquo;{search.trim()}&rdquo;
              </p>
            ) : (
              filtered.map((row) => {
                const id = catalogItemId(row, kind);
                if (!id) return null;
                return (
                  <label key={id} className="ws-promo-picker-row">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(id)}
                      disabled={disabled}
                      onChange={() => onToggle(id)}
                    />
                    <span>{catalogItemName(row)}</span>
                  </label>
                );
              })
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

export default function PromoCodeFormFields({
  form,
  setForm,
  branches = [],
  catalogProducts = [],
  catalogServices = [],
  catalogLoading = false,
  codeReadOnly = false,
  usageCount,
  formError = '',
  showStatus = true,
  onAutoGenerate,
}) {
  const branchOptions = useMemo(
    () => branches.filter((b) => b.isActive !== false),
    [branches],
  );

  const toggleBranch = (branchId) => {
    const id = String(branchId);
    setForm((prev) => {
      const has = prev.branchIds.includes(id);
      const branchIds = has
        ? prev.branchIds.filter((x) => x !== id)
        : [...prev.branchIds, id];
      return { ...prev, branchIds };
    });
  };

  const toggleId = (field, id) => {
    setForm((prev) => {
      const list = prev[field];
      const next = list.includes(id)
        ? list.filter((x) => x !== id)
        : [...list, id];
      return { ...prev, [field]: next };
    });
  };

  const setIds = (field, ids) => {
    setForm((prev) => ({ ...prev, [field]: ids.map(String) }));
  };

  const catalogDisabled = form.branchMode === 'selected' && form.branchIds.length === 0;
  const hasSpecificSelection =
    form.productScope === 'selected' || form.serviceScope === 'selected';
  const activeRule =
    PROMO_APPLICATION_RULES.find(
      (rule) => rule.value === (form.selectedItemMatchMode || 'all_required'),
    ) ?? PROMO_APPLICATION_RULES[0];

  return (
    <div>
      {formError ? <p className="ws-promo-form-error">{formError}</p> : null}

      <section className="ws-promo-form-section">
        <h3 className="ws-promo-form-section-title">Promo details</h3>
        <p className="ws-promo-form-section-desc">Code, discount, and optional description.</p>
        <div className="ws-form-grid">
          <div className="ws-field">
            <label>Promo Code *</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
              <input
                value={form.code}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))
                }
                placeholder="e.g. SAVE20"
                readOnly={codeReadOnly}
                style={{
                  flex: 1,
                  ...(codeReadOnly ? { background: '#f8fafc', cursor: 'not-allowed' } : {}),
                }}
              />
              {!codeReadOnly && onAutoGenerate ? (
                <button
                  type="button"
                  onClick={onAutoGenerate}
                  style={{
                    padding: '0 14px',
                    borderRadius: 8,
                    border: '1px solid #CBD5E1',
                    background: '#fff',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Auto
                </button>
              ) : null}
            </div>
          </div>
          {showStatus ? (
            <div className="ws-field">
              <label>Status</label>
              <select
                value={form.isActive ? 'active' : 'inactive'}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, isActive: e.target.value === 'active' }))
                }
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          ) : (
            <div className="ws-field">
              <label>Status</label>
              <input
                readOnly
                value="Pending Super Admin approval"
                style={{ background: '#f8fafc', color: '#64748b', cursor: 'not-allowed' }}
              />
            </div>
          )}
          <div className="ws-field">
            <label>Discount Type *</label>
            <select
              value={form.discountType}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, discountType: e.target.value }))
              }
            >
              <option value="fixed">Fixed (SAR)</option>
              <option value="percent">Percent (%)</option>
            </select>
          </div>
          <div className="ws-field">
            <label>Discount Value *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.discountValue}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, discountValue: e.target.value }))
              }
              placeholder={form.discountType === 'percent' ? 'e.g. 10' : 'e.g. 50'}
            />
          </div>
          <div className="ws-field" style={{ gridColumn: '1 / -1' }}>
            <label>Description</label>
            <input
              value={form.description}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="Optional internal note"
            />
          </div>
        </div>
      </section>

      <section className="ws-promo-form-section">
        <h3 className="ws-promo-form-section-title">Validity & limits</h3>
        <p className="ws-promo-form-section-desc">
          When the promo is valid and how often it can be used.
        </p>
        <div className="ws-form-grid">
          <div className="ws-field">
            <label>Valid From *</label>
            <input
              type="date"
              value={form.validFrom}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, validFrom: e.target.value }))
              }
            />
          </div>
          <div className="ws-field">
            <label>Valid To *</label>
            <input
              type="date"
              value={form.validTo}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, validTo: e.target.value }))
              }
            />
          </div>
          <div className="ws-field">
            <label>Usage Limit</label>
            <input
              type="number"
              min="0"
              step="1"
              value={form.usageLimit}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, usageLimit: e.target.value }))
              }
              placeholder="Leave empty for unlimited"
            />
            {usageCount != null && (
              <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                Times used: {usageCount}
              </p>
            )}
          </div>
          <div className="ws-field">
            <label>Min Order Amount (SAR)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.minOrderAmount}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, minOrderAmount: e.target.value }))
              }
              placeholder="Optional"
            />
          </div>
        </div>
      </section>

      <section className="ws-promo-form-section">
        <h3 className="ws-promo-form-section-title">Where this promo applies</h3>
        <p className="ws-promo-form-section-desc">
          Set branches, then choose separately for products and services: all, specific items, or not applicable.
        </p>
        <div className="ws-form-grid">
          <div className="ws-field" style={{ gridColumn: '1 / -1' }}>
            <label>Branches *</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginBottom: 10 }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="promoBranchMode"
                  checked={form.branchMode === 'all'}
                  onChange={() =>
                    setForm((prev) => ({
                      ...prev,
                      branchMode: 'all',
                      branchIds: [],
                    }))
                  }
                />
                All branches
              </label>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="promoBranchMode"
                  checked={form.branchMode === 'selected'}
                  onChange={() => setForm((prev) => ({ ...prev, branchMode: 'selected' }))}
                />
                Selected branches
              </label>
            </div>
            {form.branchMode === 'selected' ? (
              <div className="ws-promo-branch-list">
                {branchOptions.length === 0 ? (
                  <p className="ws-promo-picker-empty">No branches available.</p>
                ) : (
                  branchOptions.map((b) => {
                    const id = String(b.id);
                    return (
                      <label key={id} className="ws-promo-branch-row">
                        <input
                          type="checkbox"
                          checked={form.branchIds.includes(id)}
                          onChange={() => toggleBranch(id)}
                        />
                        <span>{b.name}</span>
                      </label>
                    );
                  })
                )}
              </div>
            ) : (
              <p className="form-help-text" style={{ margin: 0 }}>
                Promo applies to all active branches ({branchOptions.length}).
              </p>
            )}
          </div>

          <div className="ws-promo-rules-panel" style={{ gridColumn: '1 / -1' }}>
            <label className="ws-promo-match-mode-label">Promo application rule *</label>
            <p className="ws-promo-rules-panel-hint">
              Choose exactly one rule. To use Rules 1–3, set Products or Services to
              &ldquo;Specific only&rdquo; and select items below.
            </p>
            <div className="ws-promo-match-mode-options">
              {PROMO_APPLICATION_RULES.map((rule) => (
                <label
                  key={rule.value}
                  className={`ws-promo-match-mode-option ws-promo-rule-card${
                    (form.selectedItemMatchMode || 'all_required') === rule.value
                      ? ' is-active'
                      : ''
                  }${!hasSpecificSelection ? ' is-disabled' : ''}`}
                >
                  <input
                    type="radio"
                    name="promoApplicationRule"
                    checked={(form.selectedItemMatchMode || 'all_required') === rule.value}
                    disabled={!hasSpecificSelection}
                    onChange={() =>
                      setForm((prev) => ({
                        ...prev,
                        selectedItemMatchMode: rule.value,
                      }))
                    }
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
              <p className="ws-promo-rules-panel-warning">
                Select &ldquo;Specific only&rdquo; for products and/or services to enable these
                rules.
              </p>
            ) : (
              <p className="ws-promo-rules-panel-active">
                Active rule: <b>{activeRule.title}</b>
              </p>
            )}
          </div>

          <div className="ws-promo-applicability-grid">
            <ScopeSection
              title="Products"
              scope={form.productScope}
              onScopeChange={(scope) =>
                setForm((prev) => ({
                  ...prev,
                  productScope: scope,
                  productIds: scope === 'selected' ? prev.productIds : [],
                }))
              }
              items={catalogProducts}
              selectedIds={form.productIds}
              onToggle={(id) => toggleId('productIds', id)}
              onSelectMany={(ids) => setIds('productIds', ids)}
              kind="products"
              loading={catalogLoading}
              disabled={catalogDisabled}
            />

            <ScopeSection
              title="Services"
              scope={form.serviceScope}
              onScopeChange={(scope) =>
                setForm((prev) => ({
                  ...prev,
                  serviceScope: scope,
                  serviceIds: scope === 'selected' ? prev.serviceIds : [],
                }))
              }
              items={catalogServices}
              selectedIds={form.serviceIds}
              onToggle={(id) => toggleId('serviceIds', id)}
              onSelectMany={(ids) => setIds('serviceIds', ids)}
              kind="services"
              loading={catalogLoading}
              disabled={catalogDisabled}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
