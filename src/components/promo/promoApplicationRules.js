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
