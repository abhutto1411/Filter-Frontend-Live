/**
 * Workshop tabs reachable by in-app navigation but not listed in the sidebar.
 * Kept free of React so `node --test` can import it.
 */
export const WORKSHOP_INTERNAL_TABS = new Set([
  'supplier-ledger',
  'acc-ledger-statement',
  'acc-coa-account',
  'advanced-reports-drilldown',
  'acc-books-health-noncash',
  'acc-transactions-batch-new',
  'acc-transactions-batch-import',
  'acc-transactions-batch',
  'acc-transactions-batches',
  'acc-noncash-detail',
  'acc-report-proof',
  'daily-activity-proof',
  'acc-locker-cit-record',
  'acc-locker-cit-wallet',
  'corporate-statement',
  'corporate-generate-bill',
  // CORPORATE-FIX-02 G3: Workshop → Corporate → Due from Super Admin.
  'corporate-hq-settlement',
]);

/** Parent sidebar id that grants route recognition for locker CIT children. */
export const LOCKER_CIT_PARENT_TAB_ID = 'acc-locker-cit';

export const ACC_LOCKER_CIT_RECORD = 'acc-locker-cit-record';
export const ACC_LOCKER_CIT_WALLET = 'acc-locker-cit-wallet';

/** Discovered Record collection URL (do not invent). */
export const LOCKER_CIT_RECORD_PATH =
  '/workshop/accounting/locker-cash-in-transit/record';

/**
 * Discovered officer-wallet URL. Requires a real officer id; never invents one.
 * Workshop accounting path — not `/locker/my-wallet`.
 */
export function lockerCitWalletPath(officerId) {
  const id = String(officerId ?? '').trim();
  if (!id) return null;
  return `/workshop/accounting/locker-cash-in-transit/officers/${id}`;
}

/** Map an accounting CIT pathname to its tab id, or null if it is not a CIT route. */
export function lockerCitTabFromPath(pathname) {
  const parts = String(pathname || '')
    .split('/')
    .filter(Boolean);
  if (parts[0] !== 'workshop' || parts[1] !== 'accounting') return null;
  if (parts[2] !== 'locker-cash-in-transit') return null;
  if (parts[3] === 'officers' && parts[4]) return ACC_LOCKER_CIT_WALLET;
  if (parts[3] === 'record') return ACC_LOCKER_CIT_RECORD;
  return LOCKER_CIT_PARENT_TAB_ID;
}

/**
 * Route recognition vs permission to act.
 * CIT children are recognized only when the parent locker CIT tab is visible.
 * Other internal tabs keep the existing unrestricted-recognition contract.
 */
export function isWorkshopTabAllowed(activeTab, visibleTabIds) {
  const visible = visibleTabIds instanceof Set ? visibleTabIds : new Set(visibleTabIds || []);
  if (
    activeTab === ACC_LOCKER_CIT_RECORD ||
    activeTab === ACC_LOCKER_CIT_WALLET
  ) {
    return visible.has(LOCKER_CIT_PARENT_TAB_ID);
  }
  if (
    activeTab === 'corporate-statement' ||
    activeTab === 'corporate-generate-bill' ||
    activeTab === 'corporate-hq-settlement'
  ) {
    return visible.has('corporate-management');
  }
  // F1a: Opening balance is reached from Settings, not the sidebar.
  if (activeTab === 'acc-opening-balance') {
    return visible.has('acc-settings');
  }
  // F1b: Supplier statement drill-down under Acc Suppliers.
  if (activeTab === 'acc-suppliers-statement') {
    return visible.has('acc-suppliers');
  }
  if (WORKSHOP_INTERNAL_TABS.has(activeTab)) return true;
  if (visible.has(activeTab)) return true;
  if (activeTab === 'catalog' && visible.has('departments')) return true;
  return false;
}

/**
 * Auto-snap used when the current tab is not allowed.
 * `firstVisibleTabId` is the first sidebar item the user may open (often dashboard).
 */
export function workshopDeniedTabSnapTarget(firstVisibleTabId, tabToPath) {
  if (!firstVisibleTabId) return null;
  return typeof tabToPath === 'function'
    ? tabToPath(firstVisibleTabId)
    : `/workshop/${firstVisibleTabId}`;
}
