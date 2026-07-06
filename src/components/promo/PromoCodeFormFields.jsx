import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { catalogItemId, catalogItemName } from './promoCodeFormUtils';

function strTrim(value) {
  return String(value ?? '').trim();
}

export const PROMO_APPLICATION_RULES = [
  {
    value: 'all_required',
    title: 'Rule 1 — Selected product/category trigger',
    summary:
      'Invoice must contain the selected product/category. Selected services can be mandatory or optional using the toggle below.',
  },
  {
    value: 'any_present',
    title: 'Rule 2 — Any selected product/service/category',
    summary:
      'Invoice needs at least one selected product/service/category. Discount applies only on matching eligible lines.',
  },
  {
    value: 'entire_order',
    title: 'Rule 3 — Eligible trigger, entire invoice discount',
    summary:
      'Invoice needs an eligible selected product/service/category. Discount applies on the full invoice total.',
  },
];

const SCOPE_CHOICES = [
  { value: 'all', label: 'All' },
  { value: 'selected', label: 'Specific only' },
  { value: 'none', label: 'Does not apply' },
];

function CategoryMultiCombobox({
  options,
  selectedIds,
  onChange,
  disabled,
  loading,
}) {
  const wrapRef = useRef(null);
  const listRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((item) => item.name.toLowerCase().includes(q));
  }, [options, search]);

  const selectedNames = useMemo(
    () => options.filter((item) => selectedIds.includes(item.id)).map((item) => item.name),
    [options, selectedIds],
  );

  useEffect(() => {
    const onDoc = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (!open) return;
    setHighlightIndex(0);
  }, [open, search]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-category-index="${highlightIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [open, highlightIndex]);

  const toggleId = (id) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((item) => item !== id));
      return;
    }
    onChange([...selectedIds, id]);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setHighlightIndex((index) => Math.min(index + 1, Math.max(filtered.length - 1, 0)));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setHighlightIndex((index) => Math.max(index - 1, 0));
      return;
    }
    if (event.key === 'Enter') {
      if (!open) {
        event.preventDefault();
        setOpen(true);
        return;
      }
      const item = filtered[highlightIndex];
      if (item) {
        event.preventDefault();
        toggleId(item.id);
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      setSearch('');
    }
  };

  if (options.length === 0) return null;

  return (
    <div className="ws-promo-category-combo" ref={wrapRef}>
      <button
        type="button"
        className={`ws-promo-category-trigger${open ? ' is-open' : ''}`}
        disabled={disabled || loading}
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>
          {selectedNames.length === 0
            ? 'All categories'
            : selectedNames.length <= 2
              ? selectedNames.join(', ')
              : `${selectedNames.length} categories selected`}
        </span>
        <ChevronDown size={14} />
      </button>

      {selectedNames.length > 0 ? (
        <div className="ws-promo-category-chips">
          {selectedNames.slice(0, 3).map((name) => (
            <span key={name}>{name}</span>
          ))}
          {selectedNames.length > 3 ? <span>+{selectedNames.length - 3} more</span> : null}
          <button type="button" onClick={() => onChange([])} disabled={disabled || loading}>
            Clear
          </button>
        </div>
      ) : null}

      {open ? (
        <div className="ws-promo-category-menu">
          <div className="ws-promo-picker-search-wrap">
            <Search size={15} />
            <input
              type="text"
              className="ws-promo-picker-search"
              placeholder="Type category name..."
              value={search}
              disabled={disabled || loading}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          </div>
          <div className="ws-promo-category-list" role="listbox" ref={listRef}>
            {filtered.length === 0 ? (
              <p className="ws-promo-picker-empty">No categories found.</p>
            ) : (
              filtered.map((item, index) => (
                <button
                  type="button"
                  key={item.id}
                  data-category-index={index}
                  className={`ws-promo-category-option${selectedIds.includes(item.id) ? ' selected' : ''}${index === highlightIndex ? ' active' : ''}`}
                  onClick={() => toggleId(item.id)}
                  onMouseEnter={() => setHighlightIndex(index)}
                  role="option"
                  aria-selected={selectedIds.includes(item.id)}
                >
                  <span>{item.name}</span>
                  {selectedIds.includes(item.id) ? <b>Selected</b> : null}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ScopeSection({
  title,
  scope,
  onScopeChange,
  items,
  selectedIds,
  selectedCategoryIds = [],
  onToggle,
  onSelectMany,
  onCategoryChange,
  kind,
  loading,
  disabled,
}) {
  const [search, setSearch] = useState('');

  const categoryOptions = useMemo(() => {
    const map = new Map();
    items.forEach((row) => {
      const id = String(row.categoryId ?? row.category_id ?? '').trim();
      const name = row.categoryName ?? row.category_name ?? row.category?.name;
      if (id && name) map.set(id, name);
    });
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  const sorted = useMemo(
    () => [...items].sort((a, b) => catalogItemName(a).localeCompare(catalogItemName(b))),
    [items],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sorted.filter((row) => {
      if (
        selectedCategoryIds.length > 0
        && !selectedCategoryIds.includes(String(row.categoryId ?? row.category_id ?? ''))
      ) {
        return false;
      }
      if (!q) return true;
      const name = catalogItemName(row).toLowerCase();
      const sku = String(row.sku ?? '').toLowerCase();
      const cat = String(row.categoryName ?? row.category_name ?? '').toLowerCase();
      return name.includes(q) || sku.includes(q) || cat.includes(q);
    });
  }, [sorted, search, selectedCategoryIds]);

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
          <CategoryMultiCombobox
            options={categoryOptions}
            selectedIds={selectedCategoryIds}
            onChange={onCategoryChange}
            disabled={disabled}
            loading={loading}
          />
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
  workshops = [],
  branches = [],
  catalogProducts = [],
  catalogServices = [],
  catalogLoading = false,
  codeReadOnly = false,
  usageCount,
  formError = '',
  showStatus = true,
  requireWorkshop = false,
  onAutoGenerate,
}) {
  const branchOptions = useMemo(() => {
    const active = branches.filter((b) => b.isActive !== false);
    if (!requireWorkshop || form.workshopMode === 'all') return active;

    const selectedWorkshopIds =
      form.workshopIds.length > 0
        ? form.workshopIds.map(String)
        : strTrim(form.workshopId)
          ? [String(form.workshopId)]
          : [];

    if (selectedWorkshopIds.length === 0) return [];

    return active.filter((b) =>
      selectedWorkshopIds.includes(String(b.workshopId ?? '')),
    );
  }, [branches, form.workshopId, form.workshopIds, form.workshopMode, requireWorkshop]);

  const toggleWorkshop = (workshopId) => {
    const id = String(workshopId);
    setForm((prev) => {
      const has = prev.workshopIds.includes(id);
      const workshopIds = has
        ? prev.workshopIds.filter((x) => x !== id)
        : [...prev.workshopIds, id];
      return {
        ...prev,
        workshopIds,
        workshopId: workshopIds.length === 1 ? workshopIds[0] : '',
        branchMode: 'all',
        branchIds: [],
        productIds: [],
        productCategoryIds: [],
        serviceIds: [],
        serviceCategoryIds: [],
      };
    });
  };

  const workflowStatus = String(form.workflowStatus || 'pending_approval')
    .trim()
    .toLowerCase();
  const statusLocked =
    workflowStatus === 'pending_approval'
    || workflowStatus === 'pending'
    || workflowStatus === 'rejected';

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

  const catalogDisabled =
    (requireWorkshop
      && form.workshopMode === 'selected'
      && form.workshopIds.length === 0
      && !strTrim(form.workshopId))
    || (form.branchMode === 'selected' && form.branchIds.length === 0);
  const hasSpecificSelection =
    form.productScope === 'selected' || form.serviceScope === 'selected';
  const hasSelectedProducts =
    form.productScope === 'selected' &&
    ((form.productIds || []).length > 0 || (form.productCategoryIds || []).length > 0);
  const hasSelectedServices =
    form.serviceScope === 'selected' &&
    ((form.serviceIds || []).length > 0 || (form.serviceCategoryIds || []).length > 0);
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
              {statusLocked ? (
                <input
                  readOnly
                  value={
                    workflowStatus === 'rejected'
                      ? 'Rejected'
                      : 'Pending Super Admin approval'
                  }
                  style={{ background: '#f8fafc', color: '#64748b', cursor: 'not-allowed' }}
                />
              ) : (
                <select
                  value={form.isActive ? 'active' : 'inactive'}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, isActive: e.target.value === 'active' }))
                  }
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              )}
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
          {requireWorkshop ? (
            <div className="ws-field" style={{ gridColumn: '1 / -1' }}>
              <label>Workshop *</label>
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
                    name="promoWorkshopMode"
                    checked={form.workshopMode === 'all'}
                    onChange={() =>
                      setForm((prev) => ({
                        ...prev,
                        workshopMode: 'all',
                        workshopId: '',
                        workshopIds: [],
                        branchMode: 'all',
                        branchIds: [],
                        productIds: [],
                        serviceIds: [],
                      }))
                    }
                  />
                  All workshops
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
                    name="promoWorkshopMode"
                    checked={form.workshopMode === 'selected'}
                    onChange={() =>
                      setForm((prev) => ({
                        ...prev,
                        workshopMode: 'selected',
                        workshopId: '',
                        workshopIds: [],
                        branchMode: 'all',
                        branchIds: [],
                        productIds: [],
                        serviceIds: [],
                      }))
                    }
                  />
                  Selected workshops
                </label>
              </div>
              {form.workshopMode === 'selected' ? (
                <div className="ws-promo-branch-list">
                  {workshops.length === 0 ? (
                    <p className="ws-promo-picker-empty">No workshops available.</p>
                  ) : (
                    workshops.map((workshop) => {
                      const id = String(workshop.id);
                      return (
                        <label key={id} className="ws-promo-branch-row">
                          <input
                            type="checkbox"
                            checked={form.workshopIds.includes(id)}
                            onChange={() => toggleWorkshop(id)}
                          />
                          <span>{workshop.name}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              ) : (
                <p className="form-help-text" style={{ margin: 0 }}>
                  Applies to all workshops ({workshops.length}). Saved as workshop IDs:{' '}
                  {workshops.map((w) => w.name).slice(0, 3).join(', ')}
                  {workshops.length > 3 ? ` +${workshops.length - 3} more` : ''}.
                </p>
              )}
            </div>
          ) : null}
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
                {(requireWorkshop
                  && form.workshopMode === 'selected'
                  && form.workshopIds.length === 0
                  && !strTrim(form.workshopId)) ? (
                  <p className="ws-promo-picker-empty">Select at least one workshop first.</p>
                ) : branchOptions.length === 0 ? (
                  <p className="ws-promo-picker-empty">
                    {requireWorkshop ? 'No branches available for this workshop.' : 'No branches available.'}
                  </p>
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
                {requireWorkshop && form.workshopMode === 'selected' && form.workshopIds.length === 0 && !strTrim(form.workshopId)
                  ? 'Select workshops to scope branches.'
                  : form.workshopMode === 'all'
                    ? `Promo applies to all active branches across selected workshops (${branchOptions.length}).`
                    : `Promo applies to all active branches in selected workshops (${branchOptions.length}).`}
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
                Select &ldquo;Specific only&rdquo; for products, services, or categories to enable these rules.
              </p>
            ) : (
              <p className="ws-promo-rules-panel-active">
                Active rule: <b>{activeRule.title}</b>
              </p>
            )}
            {hasSelectedProducts && hasSelectedServices ? (
              <div className="ws-promo-service-toggle">
                <div>
                  <strong>Selected service required with selected product?</strong>
                  <p>
                    ON: invoice must include selected product/category plus selected service/category.
                    OFF: selected service is optional; promo can apply on selected products/categories.
                  </p>
                </div>
                <button
                  type="button"
                  className={`ws-promo-toggle-btn${form.selectedServiceRequired !== false ? ' is-on' : ''}`}
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      selectedServiceRequired: prev.selectedServiceRequired === false,
                    }))
                  }
                >
                  {form.selectedServiceRequired !== false ? 'ON' : 'OFF'}
                </button>
              </div>
            ) : null}
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
                  productCategoryIds:
                    scope === 'selected' ? (prev.productCategoryIds || []) : [],
                }))
              }
              items={catalogProducts}
              selectedIds={form.productIds}
              selectedCategoryIds={form.productCategoryIds || []}
              onToggle={(id) => toggleId('productIds', id)}
              onSelectMany={(ids) => setIds('productIds', ids)}
              onCategoryChange={(ids) => setIds('productCategoryIds', ids)}
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
                  serviceCategoryIds:
                    scope === 'selected' ? (prev.serviceCategoryIds || []) : [],
                }))
              }
              items={catalogServices}
              selectedIds={form.serviceIds}
              selectedCategoryIds={form.serviceCategoryIds || []}
              onToggle={(id) => toggleId('serviceIds', id)}
              onSelectMany={(ids) => setIds('serviceIds', ids)}
              onCategoryChange={(ids) => setIds('serviceCategoryIds', ids)}
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
