/** Missing money stays null — never coerce to 0. */
export function nullableMoney(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asItemArray(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') {
    if (Array.isArray(value.items)) return value.items;
    if (Array.isArray(value.rows)) return value.rows;
    if (Array.isArray(value.data)) return value.data;
  }
  return [];
}

/**
 * Accept a bare array, `{items,total}`, `{rows}`, `{data}`, or junk.
 * Junk / null / string → `{ items: [], total: null }`.
 */
export function normalizeCollectionRequestList(res) {
  if (Array.isArray(res)) {
    return { items: res, total: res.length };
  }
  if (res && typeof res === 'object') {
    const items = asItemArray(res);
    if (res.total == null || res.total === '') {
      return { items, total: null };
    }
    const n = Number(res.total);
    return { items, total: Number.isFinite(n) ? n : null };
  }
  return { items: [], total: null };
}

export function normalizeLockerTeam(res) {
  if (Array.isArray(res)) return { users: res };
  if (res && typeof res === 'object' && Array.isArray(res.users)) {
    return { users: res.users };
  }
  return { users: [] };
}

export function normalizeCollectionRequestDetail(res) {
  if (res == null || typeof res !== 'object' || Array.isArray(res)) {
    throw new Error('Collection request not found');
  }
  return res;
}

export function normalizePostingContext(res) {
  const src = res && typeof res === 'object' ? res : {};
  const debitRaw = src.debitAccount;
  const debitAccount =
    debitRaw && typeof debitRaw === 'object'
      ? {
          code: debitRaw.code != null && debitRaw.code !== '' ? String(debitRaw.code) : null,
          name: debitRaw.name != null && debitRaw.name !== '' ? String(debitRaw.name) : null,
        }
      : null;
  const status = src.officerLeafStatus;
  return {
    citEnabled: src.citEnabled === true,
    debitAccount,
    officerLeafStatus:
      status === 'ok' || status === 'missing' || status === 'conflict' ? status : null,
  };
}
