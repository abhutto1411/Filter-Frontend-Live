/**
 * Sales Returns header KPI uses the filtered API total, never the current page slice.
 */
export function salesReturnsKpiFromListResponse(res) {
  const total = Number(res?.total);
  const summary = res?.summary && typeof res.summary === 'object' ? res.summary : null;
  const countRaw = summary?.count != null ? Number(summary.count) : total;
  return {
    count: Number.isFinite(countRaw) ? countRaw : 0,
    incVat: Number(summary?.incVat) || 0,
    exVat: Number(summary?.exVat) || 0,
    vat: Number(summary?.vat) || 0,
  };
}
