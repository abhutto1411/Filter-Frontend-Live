/**
 * Salary / advance sheet filters: month OR a full from ≤ to range (advance mode
 * and date-range dialogs); salary mode needs a month.
 */
export function validateSheetFilters({ month, from, to, showDateRange, mode }) {
  const hasMonth = Boolean(String(month || '').trim());
  const hasFrom = Boolean(String(from || '').trim());
  const hasTo = Boolean(String(to || '').trim());
  if (showDateRange || mode === 'advance') {
    if (hasMonth) return { ok: true };
    if (hasFrom && hasTo) {
      if (from > to) return { ok: false, code: 'range' };
      return { ok: true };
    }
    if (hasFrom || hasTo) return { ok: false, code: 'range' };
    if (!hasMonth) return { ok: false, code: 'required' };
  }
  if (!hasMonth && mode === 'salary') return { ok: false, code: 'required' };
  return { ok: true };
}
