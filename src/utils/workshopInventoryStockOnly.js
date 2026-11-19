/**
 * Pure helpers for Inventory "stock only" filter (K19).
 */

export function workshopInventoryHasStock(p) {
  const q = Number(p?.qty ?? p?.qtyOnHand ?? 0);
  return Number.isFinite(q) && q > 0;
}

export function applyStockOnly(rows, stockOnly) {
  const list = Array.isArray(rows) ? rows : [];
  if (!stockOnly) return list;
  return list.filter(workshopInventoryHasStock);
}
