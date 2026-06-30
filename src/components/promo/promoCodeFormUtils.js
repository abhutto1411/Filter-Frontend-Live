export const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const dateOnly = (value) => {
  const s = String(value ?? '').trim();
  if (!s) return '';
  return s.length >= 10 ? s.slice(0, 10) : s;
};

export const strTrim = (value) => String(value ?? '').trim();

export const catalogItemId = (row, kind) => {
  if (kind === 'products') {
    return String(row.id ?? row.productId ?? row.product?.id ?? '');
  }
  return String(row.id ?? row.serviceId ?? row.service?.id ?? '');
};

export const catalogItemName = (row) =>
  row.name ?? row.product?.name ?? row.service?.name ?? row.label ?? '—';

export const emptyPromoForm = () => ({
  code: '',
  discountType: 'fixed',
  discountValue: '',
  validFrom: '',
  validTo: '',
  usageLimit: '',
  minOrderAmount: '',
  description: '',
  isActive: true,
  branchMode: 'all',
  branchIds: [],
  productScope: 'all',
  productIds: [],
  serviceScope: 'all',
  serviceIds: [],
  selectedItemMatchMode: 'all_required',
});

export const inferScope = (explicit, ids) => {
  const s = String(explicit ?? '').trim().toLowerCase();
  if (s === 'all' || s === 'selected' || s === 'none') return s;
  return ids.length > 0 ? 'selected' : 'all';
};

export const promoToForm = (promo) => {
  const branchIds = Array.isArray(promo.branchIds)
    ? promo.branchIds.map(String)
    : Array.isArray(promo.branch_ids)
      ? promo.branch_ids.map(String)
      : Array.isArray(promo.applicable_branches)
        ? promo.applicable_branches.map((item) =>
            typeof item === 'object' ? String(item.id) : String(item),
          )
        : Array.isArray(promo.applicableBranches)
          ? promo.applicableBranches.map((item) =>
              typeof item === 'object' ? String(item.id) : String(item),
            )
          : [];

  const productIds = Array.isArray(promo.productIds)
    ? promo.productIds.map(String)
    : Array.isArray(promo.applicable_products)
      ? promo.applicable_products.map((item) =>
          typeof item === 'object' ? String(item.id) : String(item),
        )
      : Array.isArray(promo.applicableProducts)
        ? promo.applicableProducts.map((item) =>
            typeof item === 'object' ? String(item.id) : String(item),
          )
        : [];

  const serviceIds = Array.isArray(promo.serviceIds)
    ? promo.serviceIds.map(String)
    : Array.isArray(promo.applicable_services)
      ? promo.applicable_services.map((item) =>
          typeof item === 'object' ? String(item.id) : String(item),
        )
      : Array.isArray(promo.applicableServices)
        ? promo.applicableServices.map((item) =>
            typeof item === 'object' ? String(item.id) : String(item),
          )
        : [];

  const discountRaw = String(
    promo.discountType ?? promo.discount_type ?? 'fixed',
  ).toLowerCase();

  return {
    code: promo.code || '',
    discountType:
      discountRaw.includes('percent') || discountRaw === 'percent'
        ? 'percent'
        : 'fixed',
    discountValue:
      promo.discountValue != null && promo.discountValue !== ''
        ? String(promo.discountValue)
        : promo.discount_value != null && promo.discount_value !== ''
          ? String(promo.discount_value)
          : '',
    validFrom: dateOnly(promo.validFrom ?? promo.valid_from),
    validTo: dateOnly(promo.validTo ?? promo.valid_to ?? promo.valid_until),
    usageLimit:
      promo.usageLimit != null && promo.usageLimit !== ''
        ? String(promo.usageLimit)
        : promo.max_usage_count != null && promo.max_usage_count !== ''
          ? String(promo.max_usage_count)
          : promo.maxUsageCount != null && promo.maxUsageCount !== ''
            ? String(promo.maxUsageCount)
            : '',
    minOrderAmount:
      promo.minOrderAmount != null && promo.minOrderAmount !== ''
        ? String(promo.minOrderAmount)
        : promo.min_purchase_amount != null && promo.min_purchase_amount !== ''
          ? String(promo.min_purchase_amount)
          : promo.minPurchaseAmount != null && promo.minPurchaseAmount !== ''
            ? String(promo.minPurchaseAmount)
            : '',
    description: promo.description || promo.notes || '',
    isActive: promo.isActive !== false,
    branchMode: branchIds.length === 0 ? 'all' : 'selected',
    branchIds,
    productScope: inferScope(promo.productScope, productIds),
    productIds,
    serviceScope: inferScope(promo.serviceScope, serviceIds),
    serviceIds,
    selectedItemMatchMode:
      (() => {
        const mode = String(
          promo.selectedItemMatchMode ?? promo.selected_item_match_mode ?? 'all_required',
        ).toLowerCase();
        if (mode === 'any_present' || mode === 'any' || mode === 'partial') return 'any_present';
        if (mode === 'entire_order' || mode === 'full_order') return 'entire_order';
        return 'all_required';
      })(),
  };
};

export function buildPromoPayload(form, { includeIsActive = false } = {}) {
  const payload = {
    code: strTrim(form.code).toUpperCase(),
    discountType: form.discountType,
    discountValue: toNumber(form.discountValue),
    validFrom: dateOnly(form.validFrom),
    validTo: dateOnly(form.validTo),
    usageLimit: strTrim(form.usageLimit) === '' ? null : toNumber(form.usageLimit),
    minOrderAmount:
      strTrim(form.minOrderAmount) === '' ? null : toNumber(form.minOrderAmount),
    description: strTrim(form.description) || null,
    branchIds: form.branchMode === 'all' ? [] : form.branchIds.map(String),
    productScope: form.productScope,
    productIds:
      form.productScope === 'selected' ? form.productIds.map(String) : [],
    serviceScope: form.serviceScope,
    serviceIds:
      form.serviceScope === 'selected' ? form.serviceIds.map(String) : [],
    selectedItemMatchMode: form.selectedItemMatchMode || 'all_required',
  };

  if (includeIsActive) {
    payload.isActive = Boolean(form.isActive);
  }

  return payload;
}

export function buildMarketingPromoPayload(form, { isEdit = false } = {}) {
  const base = buildPromoPayload(form, { includeIsActive: isEdit });

  return {
    code: base.code,
    discountType: base.discountType === 'percent' ? 'percentage' : 'fixed_amount',
    discount_type: base.discountType === 'percent' ? 'percentage' : 'fixed_amount',
    discountValue: base.discountValue,
    discount_value: base.discountValue,
    validFrom: base.validFrom,
    valid_from: base.validFrom,
    validTo: base.validTo,
    valid_to: base.validTo,
    maxUsageCount: base.usageLimit,
    max_usage_count: base.usageLimit,
    minPurchaseAmount: base.minOrderAmount ?? 0,
    min_purchase_amount: base.minOrderAmount ?? 0,
    description: base.description,
    notes: base.description,
    applicable_branches: base.branchIds,
    applicableBranches: base.branchIds,
    applicable_products: base.productIds,
    applicableProducts: base.productIds,
    applicable_services: base.serviceIds,
    applicableServices: base.serviceIds,
    productScope: base.productScope,
    serviceScope: base.serviceScope,
    selectedItemMatchMode: base.selectedItemMatchMode,
    selected_item_match_mode: base.selectedItemMatchMode,
    ...(isEdit
      ? { isActive: base.isActive, status: base.isActive ? 'active' : 'inactive' }
      : { status: 'pending_approval', isActive: false }),
  };
}

export function validatePromoForm(form, { catalogLoading = false } = {}) {
  if (!strTrim(form.code) || !dateOnly(form.validFrom) || !dateOnly(form.validTo)) {
    return 'Code, valid from, and valid to are required.';
  }
  if (form.branchMode === 'selected' && form.branchIds.length === 0) {
    return 'Select at least one branch, or choose All branches.';
  }
  if (catalogLoading && form.branchMode === 'selected' && form.branchIds.length > 0) {
    return 'Catalog is still loading for the selected branch(es). Please wait a moment.';
  }
  if (form.productScope === 'selected' && form.productIds.length === 0) {
    return 'Select at least one product, or change products to All / Does not apply.';
  }
  if (form.serviceScope === 'selected' && form.serviceIds.length === 0) {
    return 'Select at least one service, or change services to All / Does not apply.';
  }
  if (form.productScope === 'none' && form.serviceScope === 'none') {
    return 'Promo must apply to products and/or services.';
  }
  if (toNumber(form.discountValue) <= 0) {
    return 'Discount value must be greater than zero.';
  }
  const from = dateOnly(form.validFrom);
  const to = dateOnly(form.validTo);
  if (to && from && to < from) {
    return 'Valid To must be on or after Valid From.';
  }
  return '';
}

export const generatePromoCode = () => {
  const seg = () =>
    Math.random().toString(36).slice(2, 6).toUpperCase().replace(/[^A-Z0-9]/g, 'X');
  return `SAVE${seg()}`;
};
