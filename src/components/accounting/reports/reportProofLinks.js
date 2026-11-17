/**
 * Full-screen report-proof URLs (RF-20-FE-A). Pure — no React, no tokens.
 */

export const REPORT_PROOF_PATH = '/workshop/accounting/reports/proof';

/**
 * True only when the current path is this report's own route.
 * Prevents setSearchParams({ replace: true }) from rewriting a previous tab's URL.
 */
export function shouldSyncReportUrl(pathname, route) {
  const path = String(pathname || '').split('?')[0].replace(/\/+$/, '');
  const suffix = String(route || '').replace(/\/+$/, '');
  if (!path || !suffix) return false;
  return path === suffix || path.endsWith(suffix);
}

function setIfPresent(params, key, value) {
  if (value == null) return;
  const s = String(value).trim();
  if (!s) return;
  params.set(key, s);
}

/**
 * Build `/workshop/accounting/reports/proof?...`.
 * Empty filter values are omitted. `back` is the caller's current report URL.
 */
export function buildProofHref({
  report,
  key,
  filters = {},
  column,
  backHref,
  page,
} = {}) {
  const params = new URLSearchParams();
  const f = filters && typeof filters === 'object' ? filters : {};
  setIfPresent(params, 'report', report);
  setIfPresent(params, 'key', key);
  setIfPresent(params, 'dateFrom', f.dateFrom);
  setIfPresent(params, 'dateTo', f.dateTo);
  setIfPresent(params, 'branchId', f.branchId);
  setIfPresent(params, 'column', column);
  setIfPresent(params, 'basis', f.basis);
  setIfPresent(params, 'compare', f.compare);
  if (page != null && Number(page) > 1) {
    setIfPresent(params, 'page', String(Math.floor(Number(page))));
  }
  setIfPresent(params, 'back', backHref);
  const qs = params.toString();
  return qs ? `${REPORT_PROOF_PATH}?${qs}` : REPORT_PROOF_PATH;
}

export function readProofParams(searchParams) {
  const get = (name) => {
    if (!searchParams || typeof searchParams.get !== 'function') return '';
    const v = searchParams.get(name);
    return v == null ? '' : String(v);
  };
  const pageRaw = Number(get('page') || '1');
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;
  const sizeRaw = Number(get('pageSize') || '100');
  const pageSize =
    Number.isFinite(sizeRaw) && sizeRaw > 0 ? Math.floor(sizeRaw) : 100;
  return {
    report: get('report') || 'pl',
    key: get('key'),
    dateFrom: get('dateFrom'),
    dateTo: get('dateTo'),
    branchId: get('branchId'),
    column: get('column'),
    basis: get('basis'),
    compare: get('compare'),
    page,
    pageSize,
    back: get('back'),
  };
}

/** Statement / detail column key → API `column` query. */
export function proofColumnParam(colKey, { branchId } = {}) {
  if (
    colKey === 'unallocated' ||
    colKey === 'compareUnallocated' ||
    colKey === '__unallocated'
  ) {
    return 'unallocated';
  }
  if (colKey === 'branch') {
    return branchId ? `branch:${branchId}` : 'total';
  }
  if (colKey === 'compare' || colKey === 'total' || colKey === '__combined') {
    return 'total';
  }
  if (colKey != null && String(colKey).trim() !== '') {
    return `branch:${colKey}`;
  }
  return 'total';
}
