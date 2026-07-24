import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, Loader2, AlertCircle } from 'lucide-react';

const statusOptions = ['Pending Approval', 'Active', 'Inactive', 'Rejected'];

const discountTypeOptions = [
  { label: 'Percentage (%)', value: 'Percentage (%)' },
  { label: 'Fixed Amount (SAR)', value: 'Fixed Amount (SAR)' },
];

const safeArray = (response, keys = []) => {
  if (Array.isArray(response)) return response;

  for (const key of keys) {
    if (Array.isArray(response?.[key])) return response[key];
    if (Array.isArray(response?.data?.[key])) return response.data[key];
  }

  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.records)) return response.records;
  if (Array.isArray(response?.results)) return response.results;

  return [];
};

const randomCode = () => {
  return Math.random().toString(36).slice(2, 9).toUpperCase();
};

const toDateTimeLocal = (value) => {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);

  return localDate.toISOString().slice(0, 16);
};

const toDateOnly = (value) => {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  return date.toISOString().slice(0, 10);
};

const normalizeOption = (item, fallbackPrefix) => {
  const id =
    item?.id ||
    item?._id ||
    item?.value ||
    `${fallbackPrefix}-${Math.random().toString(36).slice(2)}`;

  const label =
    item?.label ||
    item?.name ||
    item?.title ||
    item?.code ||
    item?.sku ||
    item?.branchName ||
    item?.zoneName ||
    `${fallbackPrefix} ${id}`;

  return {
    ...item,
    id: String(id),
    value: String(item?.value || id),
    label,
    realId: String(item?.realId || id),
  };
};

const formatPromoWorkshopScope = (item) => {
  const ids = Array.isArray(item?.workshopIds)
    ? item.workshopIds
    : Array.isArray(item?.workshop_ids)
      ? item.workshop_ids
      : [];
  if (item?.appliesToAllWorkshops || item?.applies_to_all_workshops) {
    return 'All workshops';
  }
  if (Array.isArray(item?.applicableWorkshops) && item.applicableWorkshops.length > 0) {
    const names = item.applicableWorkshops
      .map((row) => row?.name)
      .filter(Boolean);
    if (names.length === 1) return names[0];
    if (names.length > 1) return `${names.length} workshops`;
  }
  if (ids.length === 0) return 'All workshops';
  if (ids.length === 1) return '1 workshop';
  return `${ids.length} workshops`;
};

const formatPromoBranchScope = (item) => {
  const branchIds = Array.isArray(item?.branchIds)
    ? item.branchIds
    : Array.isArray(item?.branch_ids)
      ? item.branch_ids
      : Array.isArray(item?.applicable_branches)
        ? item.applicable_branches
        : Array.isArray(item?.applicableBranches)
          ? item.applicableBranches
          : [];
  if (item?.appliesToAllBranches || branchIds.length === 0) {
    return item?.branchScope || 'All branches';
  }
  if (typeof item?.branchScope === 'string' && item.branchScope.trim()) {
    return item.branchScope;
  }
  return `${branchIds.length} branches`;
};

const normalizePromoCode = (item) => {
  const statusRaw = String(
    item?.status || (item?.isActive === false ? 'inactive' : 'active')
  ).toLowerCase();

  const statusMap = {
    active: 'Active',
    inactive: 'Inactive',
    expired: 'Expired',
    pending_approval: 'Pending Approval',
    pending: 'Pending Approval',
    rejected: 'Rejected',
  };

  return {
    ...item,
    id: String(item?.id || item?._id || Date.now()),
    code: item?.code || '-',
    promotion:
      item?.promotion_name ||
      item?.promotionName ||
      item?.promotion ||
      item?.description ||
      '',
    promotionId: item?.promotion_id || item?.promotionId || '',
    discountType: item?.discount_type || item?.discountType || 'percentage',
    discountValue: item?.discount_value ?? item?.discountValue ?? 0,
    minPurchase:
      item?.min_purchase_amount ??
      item?.minPurchaseAmount ??
      item?.minOrderAmount ??
      0,
    maxUsage:
      item?.max_usage_count ??
      item?.maxUsageCount ??
      item?.usageLimit ??
      0,
    currentUsage:
      item?.current_usage_count ??
      item?.currentUsageCount ??
      item?.usageCount ??
      0,
    validFrom: item?.valid_from || item?.validFrom || '',
    validUntil: item?.valid_until || item?.validTo || '',
    showSavings: Boolean(item?.show_on_invoice ?? item?.showOnInvoice ?? false),
    notes: item?.notes || item?.description || '',
    status: statusMap[statusRaw] || (item?.isActive === true ? 'Active' : 'Pending Approval'),
    isActive: Boolean(item?.isActive ?? item?.is_active ?? false),
    totalDiscountProvided:
      item?.totalDiscountProvided ?? item?.total_discount_provided ?? 0,
    totalRevenue: item?.totalRevenue ?? item?.total_revenue ?? 0,
    remainingUsage: item?.remainingUsage ?? item?.remaining_usage ?? null,
    workshopIds: item?.workshopIds ?? item?.workshop_ids ?? [],
    branchIds: item?.branchIds ?? item?.branch_ids ?? [],
    workshopScope: formatPromoWorkshopScope(item),
    branchScopeLabel: formatPromoBranchScope(item),
  };
};

const formatPromoCodeSar = (value) => {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return '0 SAR';
  return `${amount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} SAR`;
};

const formatPromoCodeUsageLabel = (item) => {
  const used = Number(item?.currentUsage ?? 0);
  const max = Number(item?.maxUsage ?? 0);

  if (max > 0) return `${used} / ${max}`;
  return `${used} (unlimited)`;
};

const canTogglePromoCodeActivation = (item) => {
  const status = String(item?.status || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

  const blocked = ['pending_approval', 'rejected', 'expired', 'draft'];
  return !blocked.includes(status);
};

const activationToggleHint = (item) => {
  const status = String(item?.status || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

  if (status === 'pending_approval' || status === 'pending') {
    return 'Waiting for Super Admin approval before POS use.';
  }

  if (status === 'rejected') {
    return 'Rejected promo codes cannot be activated.';
  }

  if (status === 'expired') {
    return 'Expired promo codes cannot be activated.';
  }

  return item?.isActive
    ? 'Available on POS when customers apply this code.'
    : 'Disabled — will not apply on POS invoices.';
};

const isPromoCodeLiveOnPos = (item) =>
  Boolean(item?.isActive) &&
  String(item?.status || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_') === 'active';

const mapDiscountTypeToBackend = (value) => {
  const raw = String(value || '').toLowerCase();

  if (raw.includes('fixed') || raw.includes('sar')) return 'fixed_amount';

  return 'percentage';
};

const mapDiscountTypeToUi = (value) => {
  const raw = String(value || '').toLowerCase();

  if (raw.includes('fixed')) return 'Fixed Amount (SAR)';

  return 'Percentage (%)';
};

const mapStatusToIsActive = (value) => {
  const raw = String(value || '')
    .toLowerCase()
    .replace(/\s+/g, '_');

  return raw === 'active';
};

const CLEAR_PROMOTION_OPTION = { id: '', label: 'Select promotion...' };

function usePromotionDropdownKeyboard({
  open,
  setOpen,
  optionCount,
  onPickIndex,
  resetKeys = [],
}) {
  const [highlightIndex, setHighlightIndex] = useState(0);
  const listRef = useRef(null);

  useEffect(() => {
    if (open) setHighlightIndex(0);
  }, [open, optionCount, ...resetKeys]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector(
      `[data-option-index="${highlightIndex}"]`
    );
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlightIndex, open]);

  const handleListKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setHighlightIndex((index) =>
        Math.min(index + 1, Math.max(optionCount - 1, 0))
      );
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setHighlightIndex((index) => Math.max(index - 1, 0));
      return;
    }

    if (event.key === 'Enter' && open && optionCount > 0) {
      event.preventDefault();
      onPickIndex(highlightIndex);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
    }
  };

  const handleTriggerKeyDown = (event) => {
    if (
      event.key === 'ArrowDown' ||
      event.key === 'Enter' ||
      event.key === ' '
    ) {
      event.preventDefault();
      setOpen(true);
    }
  };

  return {
    highlightIndex,
    setHighlightIndex,
    listRef,
    handleListKeyDown,
    handleTriggerKeyDown,
  };
}

const SelectField = ({ value, onChange, options }) => {
  return (
    <div className="mk-code-select-wrap">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mk-code-input mk-code-select"
      >
        {options.map((option) => (
          <option key={option.value || option} value={option.value || option}>
            {option.label || option}
          </option>
        ))}
      </select>

      <ChevronDown size={14} strokeWidth={2} className="mk-code-select-icon" />
    </div>
  );
};

const PromotionSelect = ({ value, onChange, options, loading, error }) => {
  const wrapRef = useRef(null);
  const searchInputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const normalizedOptions = useMemo(
    () => [CLEAR_PROMOTION_OPTION, ...options],
    [options]
  );

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return normalizedOptions;

    return normalizedOptions.filter((item) =>
      String(item.label || '').toLowerCase().includes(q)
    );
  }, [normalizedOptions, search]);

  const selected = useMemo(() => {
    return options.find((item) => item.id === value) || null;
  }, [options, value]);

  const pickOption = (id) => {
    onChange(id);
    setOpen(false);
    setSearch('');
  };

  const {
    highlightIndex,
    setHighlightIndex,
    listRef,
    handleListKeyDown,
    handleTriggerKeyDown,
  } = usePromotionDropdownKeyboard({
    open,
    setOpen,
    optionCount: filteredOptions.length,
    onPickIndex: (index) => {
      const item = filteredOptions[index];
      if (item) pickOption(item.id);
    },
    resetKeys: [search],
  });

  useEffect(() => {
    const handleOutside = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        setOpen(false);
        setSearch('');
      }
    };

    document.addEventListener('mousedown', handleOutside);

    return () => {
      document.removeEventListener('mousedown', handleOutside);
    };
  }, []);

  useEffect(() => {
    if (open) {
      window.setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  }, [open]);

  return (
    <div className="mk-code-form-group mk-code-dd-wrap" ref={wrapRef}>
      <label className="mk-code-label">Link to Promotion (optional)</label>

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={handleTriggerKeyDown}
        className={`mk-code-dd-btn ${open ? 'open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>
          {loading ? 'Loading...' : selected?.label || CLEAR_PROMOTION_OPTION.label}
        </span>
        <ChevronDown size={14} />
      </button>

      {open ? (
        <div className="mk-code-dd-menu">
          <div className="mk-code-dd-search">
            <Search size={14} />
            <input
              ref={searchInputRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={handleListKeyDown}
              placeholder="Search promotions..."
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <div className="mk-code-dd-list" ref={listRef} role="listbox">
            {loading ? (
              <div className="mk-code-dd-empty">
                <Loader2 size={14} className="mk-code-spin" />
                Loading promotions...
              </div>
            ) : error ? (
              <div className="mk-code-dd-empty error">
                <AlertCircle size={14} />
                {error}
              </div>
            ) : filteredOptions.length === 0 ? (
              <div className="mk-code-dd-empty">No promotions found</div>
            ) : (
              filteredOptions.map((item, index) => (
                <button
                  type="button"
                  key={item.id || 'clear'}
                  data-option-index={index}
                  className={`mk-code-dd-option ${
                    value === item.id ? 'selected' : ''
                  } ${index === highlightIndex ? 'active' : ''}`}
                  onClick={() => pickOption(item.id)}
                  onMouseEnter={() => setHighlightIndex(index)}
                >
                  {item.label}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

const Toggle = ({ checked, onChange, label }) => {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="mk-code-toggle-btn"
    >
      <span className={checked ? 'mk-code-toggle active' : 'mk-code-toggle'}>
        <span />
      </span>

      {label}
    </button>
  );
};
export {
  statusOptions,
  discountTypeOptions,
  safeArray,
  randomCode,
  toDateTimeLocal,
  toDateOnly,
  normalizeOption,
  normalizePromoCode,
  mapDiscountTypeToBackend,
  mapDiscountTypeToUi,
  mapStatusToIsActive,
  formatPromoCodeSar,
  formatPromoCodeUsageLabel,
  formatPromoBranchScope,
  formatPromoWorkshopScope,
  canTogglePromoCodeActivation,
  activationToggleHint,
  isPromoCodeLiveOnPos,
  SelectField,
  PromotionSelect,
  Toggle,
};
