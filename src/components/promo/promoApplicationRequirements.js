import { PROMO_APPLICATION_RULES } from './promoApplicationRules';

function normalizeMode(mode) {
  const value = String(mode ?? 'all_required').trim().toLowerCase();
  if (value === 'any_present' || value === 'any' || value === 'partial') return 'any_present';
  if (value === 'entire_order' || value === 'entire_order_discount' || value === 'full_order') {
    return 'entire_order';
  }
  return 'all_required';
}

function resolveItemNames({ scope, ids = [], categoryIds = [], items = [], emptyLabel }) {
  if (scope !== 'selected') return [];
  const names = [];
  const idSet = new Set(ids.map((id) => String(id)));
  const categorySet = new Set(categoryIds.map((id) => String(id)));
  for (const item of items) {
    const itemId = String(item?.id ?? '');
    const categoryId = String(item?.categoryId ?? item?.category_id ?? item?.category?.id ?? '');
    if (idSet.has(itemId) || (categoryId && categorySet.has(categoryId))) {
      names.push(item?.name || item?.productName || item?.serviceName || `#${itemId}`);
    }
  }
  if (names.length > 0) return names;
  if (ids.length > 0) return ids.map((id) => `Item #${id}`);
  if (categoryIds.length > 0) return categoryIds.map((id) => `Category #${id}`);
  return emptyLabel ? [emptyLabel] : [];
}

/**
 * Human-readable invoice requirements for promo application rules 1–3 + service toggle.
 */
export function buildPromoApplicationRequirements({
  selectedItemMatchMode = 'all_required',
  selectedServiceRequired = true,
  productScope = 'all',
  serviceScope = 'all',
  productIds = [],
  serviceIds = [],
  productCategoryIds = [],
  serviceCategoryIds = [],
  products = [],
  services = [],
}) {
  const lines = [];
  const mode = normalizeMode(selectedItemMatchMode);
  const rule = PROMO_APPLICATION_RULES.find((item) => item.value === mode);
  const hasProductSelection =
    productScope === 'selected' && (productIds.length > 0 || productCategoryIds.length > 0);
  const hasServiceSelection =
    serviceScope === 'selected' && (serviceIds.length > 0 || serviceCategoryIds.length > 0);
  const bothSelected = hasProductSelection && hasServiceSelection;
  const serviceOptional = bothSelected && selectedServiceRequired === false;

  if (rule) {
    lines.push({ type: 'heading', text: rule.title });
    lines.push({ type: 'text', text: rule.summary });
  }

  if (mode === 'all_required') {
    lines.push({
      type: 'text',
      text: hasProductSelection
        ? 'Invoice must include ALL selected products/categories below.'
        : 'Invoice must include all configured product triggers.',
    });
    if (bothSelected && selectedServiceRequired !== false) {
      lines.push({
        type: 'text',
        text: 'Invoice must also include ALL selected services/categories below.',
      });
    } else if (serviceOptional) {
      lines.push({
        type: 'text',
        text: 'Selected services are optional — products alone can unlock this promo.',
      });
    }
    lines.push({
      type: 'text',
      text: 'Discount applies only on matching eligible line items (before VAT, not the full invoice).',
    });
  } else if (mode === 'any_present') {
    if (serviceOptional) {
      lines.push({
        type: 'text',
        text: 'Invoice needs at least one selected product/category OR one selected service/category.',
      });
    } else if (bothSelected && selectedServiceRequired !== false) {
      lines.push({
        type: 'text',
        text: 'Invoice needs at least one selected product/category AND at least one selected service/category.',
      });
    } else {
      lines.push({
        type: 'text',
        text: 'Invoice needs at least one selected product/service/category from the lists below.',
      });
    }
    lines.push({
      type: 'text',
      text: 'Discount applies only on matching eligible line items (before VAT, not the full invoice).',
    });
  } else if (mode === 'entire_order') {
    lines.push({
      type: 'text',
      text: serviceOptional
        ? 'Invoice needs at least one selected product/category OR service/category as a trigger.'
        : bothSelected && selectedServiceRequired !== false
          ? 'Invoice needs at least one selected product/category AND one selected service/category as a trigger.'
          : 'Invoice needs at least one eligible selected item as a trigger.',
    });
    lines.push({
      type: 'text',
      text: 'Discount applies to the full invoice total before VAT (not line-by-line only).',
    });
  }

  const productNames = resolveItemNames({
    scope: productScope,
    ids: productIds,
    categoryIds: productCategoryIds,
    items: products,
    emptyLabel: productScope === 'all' ? 'All products' : null,
  });
  const serviceNames = resolveItemNames({
    scope: serviceScope,
    ids: serviceIds,
    categoryIds: serviceCategoryIds,
    items: services,
    emptyLabel: serviceScope === 'all' ? 'All services' : null,
  });

  if (productScope === 'all') {
    lines.push({ type: 'subheading', text: 'Products' });
    lines.push({ type: 'bullet', text: 'All products' });
  } else if (productNames.length > 0) {
    lines.push({
      type: 'subheading',
      text: mode === 'all_required' && hasProductSelection
        ? 'Required products / categories (all)'
        : 'Eligible products / categories',
    });
    productNames.forEach((name) => lines.push({ type: 'bullet', text: name }));
  }

  if (serviceScope === 'all') {
    lines.push({ type: 'subheading', text: 'Services' });
    lines.push({ type: 'bullet', text: 'All services' });
  } else if (serviceNames.length > 0) {
    lines.push({
      type: 'subheading',
      text:
        mode === 'all_required' && hasServiceSelection && selectedServiceRequired !== false
          ? 'Required services / categories (all)'
          : 'Eligible services / categories',
    });
    serviceNames.forEach((name) => lines.push({ type: 'bullet', text: name }));
  }

  if (bothSelected) {
    lines.push({
      type: 'note',
      text:
        selectedServiceRequired === false
          ? 'Toggle OFF: selected service is optional; promo can apply on selected products/categories.'
          : 'Toggle ON: selected product/category and selected service/category must both be present on the invoice.',
    });
  }

  if (hasProductSelection || hasServiceSelection) {
    lines.push({
      type: 'note',
      text:
        'Category only = discount on all products/services in that category. Category + specific items = discount only on those selected items (per rule).',
    });
  }

  return lines;
}
