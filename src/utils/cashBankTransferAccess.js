/** Matches BE @AccountingAccess('admin','workshop.accounting.cash-bank'). */
export function canTransferCashBank({ isAdminHqBooks, hasPermission } = {}) {
  if (isAdminHqBooks) return true;
  if (typeof hasPermission !== 'function') return false;
  return Boolean(hasPermission('workshop.accounting.cash-bank'));
}
