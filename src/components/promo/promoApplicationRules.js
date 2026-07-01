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
