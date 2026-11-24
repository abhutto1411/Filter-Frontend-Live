/** P-A12C helpers — no money maths; format/display only. */

export const EXPENSE_PURPOSES_PAGE_SIZE = 25;

export function purposeDisplayName(row, locale = 'en') {
  if (!row) return '';
  const ar = row.nameAr || row.name_ar || '';
  const en = row.nameEn || row.name_en || row.name || '';
  if (String(locale).toLowerCase().startsWith('ar') && ar) return ar;
  return en || ar || row.code || '';
}

export function purposeRolesLabel(roles, t) {
  const list = Array.isArray(roles) ? roles : [];
  if (!list.length) return t ? t('ep.roles.none') : '—';
  if (list.length >= 4) return t ? t('ep.roles.all') : 'All';
  return list
    .map((r) => {
      const key = `ep.role.${r}`;
      return t ? t(key) : r;
    })
    .join(', ');
}

export function isOtherPurpose(row) {
  if (!row) return false;
  if (row.isOther === true || row.is_other === true) return true;
  const code = String(row.code || '').toLowerCase();
  return code === 'other_not_sure';
}

export function mapPurposeRoleCards(items) {
  const rows = Array.isArray(items) ? items : [];
  let cashier = 0;
  let purchaser = 0;
  let staff = 0;
  let other = 0;
  for (const r of rows) {
    if (isOtherPurpose(r)) {
      other += 1;
      continue;
    }
    const roles = Array.isArray(r.roles) ? r.roles : [];
    if (roles.includes('cashier')) cashier += 1;
    if (roles.includes('purchaser')) purchaser += 1;
    if (roles.includes('staff')) staff += 1;
  }
  return { cashier, purchaser, staff, other };
}

export function filterPurposesByRole(items, role) {
  const rows = Array.isArray(items) ? items : [];
  const r = String(role || 'all').toLowerCase();
  if (!r || r === 'all') return rows;
  return rows.filter((row) => {
    if (isOtherPurpose(row)) return true;
    const roles = Array.isArray(row.roles) ? row.roles : [];
    return roles.includes(r);
  });
}

export function filterPurposesBySearch(items, search, locale = 'en') {
  const q = String(search || '')
    .trim()
    .toLowerCase();
  if (!q) return items || [];
  return (items || []).filter((row) => {
    const en = String(row.nameEn || row.name_en || '').toLowerCase();
    const ar = String(row.nameAr || row.name_ar || '').toLowerCase();
    const code = String(row.code || '').toLowerCase();
    const syn = Array.isArray(row.synonyms)
      ? row.synonyms.join(' ').toLowerCase()
      : '';
    const shown = purposeDisplayName(row, locale).toLowerCase();
    return (
      en.includes(q) ||
      ar.includes(q) ||
      code.includes(q) ||
      syn.includes(q) ||
      shown.includes(q)
    );
  });
}

export function slicePage(items, page, pageSize = EXPENSE_PURPOSES_PAGE_SIZE) {
  const rows = Array.isArray(items) ? items : [];
  const p = Math.max(1, Number(page) || 1);
  const size = Math.max(1, Number(pageSize) || EXPENSE_PURPOSES_PAGE_SIZE);
  const start = (p - 1) * size;
  return {
    page: p,
    pageSize: size,
    total: rows.length,
    items: rows.slice(start, start + size),
    from: rows.length ? start + 1 : 0,
    to: Math.min(rows.length, start + size),
  };
}

export function formatSarLatn(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0.00';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function topPurposeChips(items, limit = 8) {
  const rows = Array.isArray(items) ? items : [];
  const sorted = [...rows].sort(
    (a, b) => Number(a.sort || 0) - Number(b.sort || 0),
  );
  return sorted.slice(0, limit);
}

export function purposeNeedsVatFields(row) {
  const mode = String(row?.vatMode || row?.vat_mode || 'ask').toLowerCase();
  return mode === 'ask' || mode === 'inclusive_15';
}

export function purposeRequiresNoteAndProof(row) {
  return isOtherPurpose(row);
}
