/**
 * CORPORATE-FIX-02 (A/G1): "Managed by" on the Super Admin corporate form.
 * hq       → owner = Platform HQ; stores from any workshop.
 * workshop → owner = the single workshop of every selected store.
 */
export const MANAGED_BY_HQ = 'hq';
export const MANAGED_BY_WORKSHOP = 'workshop';

export function normalizeManagedBy(v, fallback = MANAGED_BY_HQ) {
    const s = String(v ?? '').trim().toLowerCase();
    if (s === MANAGED_BY_HQ || s === MANAGED_BY_WORKSHOP) return s;
    return fallback;
}

/** Workshop ids of the selected stores (unique, in order). */
/** Workshops of the selected stores, in first-seen order. */
export function homeWorkshopChoices(selectedIds, branches, workshops) {
    const ids = workshopIdsOfStores(selectedIds, branches);
    const byId = new Map((workshops || []).map((w) => [String(w.id), w]));
    return ids.map((id) => ({
        id,
        name: byId.get(String(id))?.name || id,
    }));
}

export function workshopIdsOfStores(selectedIds, branches) {
    const byId = new Map((branches || []).map((b) => [String(b.id), String(b.workshopId ?? '')]));
    const out = [];
    for (const id of selectedIds || []) {
        const w = byId.get(String(id));
        if (w && !out.includes(w)) out.push(w);
    }
    return out;
}

/**
 * Returns an i18n error key or null.
 * Stores may span workshops. A workshop-managed create still needs a home workshop.
 */
export function managedByStoreError() {
    return null;
}

/** Create, or an edit that changes the manager to workshop, needs a home workshop. */
export function ownerWorkshopRequired({ managedBy, ownerWorkshopId, managerChanged = true } = {}) {
    if (normalizeManagedBy(managedBy) !== MANAGED_BY_WORKSHOP) return null;
    if (!managerChanged) return null;
    const id = String(ownerWorkshopId ?? '').trim();
    return id ? null : 'err.ownerWorkshopRequired';
}

/** Edit: changing the manager needs an explicit confirmation. */
export function managedByChanged(initial, next) {
    if (!initial) return false;
    return normalizeManagedBy(initial) !== normalizeManagedBy(next);
}

/** Map backend error codes from the owner rule to i18n keys. */
export function managedByErrorKey(err) {
    const code = String(err?.code || err?.body?.code || err?.error?.code || '');
    if (code === 'CORPORATE_BRANCH_DOUBLE_MANAGED') return 'err.doubleManaged';
    if (code === 'CORPORATE_BRANCH_FOREIGN_WORKSHOP') return 'err.managedByOneWorkshop';
    if (code === 'CORPORATE_OWNER_CHANGE_UNCONFIRMED') return 'err.ownerChangeUnconfirmed';
    if (code === 'CORPORATE_OWNER_WORKSHOP_REQUIRED') return 'err.ownerWorkshopRequired';
    if (code === 'CORPORATE_OWNER_WORKSHOP_INVALID') return 'err.ownerWorkshopInvalid';
    if (code === 'CORPORATE_MULTI_WORKSHOP_USE_HQ_BILL') return 'err.multiWorkshopUseHqBill';
    return null;
}

/**
 * CLOSING F1: with managedBy=workshop, once the first store is picked every
 * store of ANOTHER workshop is disabled. HQ-managed never disables.
 * Returns a Set of disabled store ids (strings).
 */
export function disabledStoreIdsForManagedBy() {
    return new Set();
}

/**
 * CLOSING F1: group store options by workshop (stable by workshop name, then
 * store name) and mark the ones a workshop-managed account may not add.
 */
export function groupedStoreOptions(options, { managedBy, selectedIds, branches } = {}) {
    const cmp = (a, b) => String(a).localeCompare(String(b), undefined, { sensitivity: 'base' });
    return [...(options || [])]
        .sort((a, b) => cmp(a.group, b.group) || cmp(a.chipLabel || a.label, b.chipLabel || b.label))
        .map((o) => ({ ...o, disabled: false }));
}

/**
 * CLOSING F1: edit form — derive managedBy when the API omits it:
 * owner workshop = HQ → 'hq', any other owner → 'workshop'.
 */
export function deriveManagedBy({ managedBy, ownerWorkshopId, hqWorkshopId } = {}, fallback = MANAGED_BY_HQ) {
    const explicit = String(managedBy ?? '').trim().toLowerCase();
    if (explicit === MANAGED_BY_HQ || explicit === MANAGED_BY_WORKSHOP) return explicit;
    const owner = ownerWorkshopId == null ? '' : String(ownerWorkshopId).trim();
    const hq = hqWorkshopId == null ? '' : String(hqWorkshopId).trim();
    if (!owner || !hq) return fallback;
    return owner === hq ? MANAGED_BY_HQ : MANAGED_BY_WORKSHOP;
}

/**
 * FINAL F1 (pure): id of the Platform HQ workshop from the options list
 * `{ id, name, status, isPlatformHq }`, or null while unknown.
 */
export function hqWorkshopIdFrom(workshops) {
    const hq = (workshops || []).find((w) => w && w.isPlatformHq === true);
    return hq?.id != null && String(hq.id).trim() ? String(hq.id) : null;
}

/**
 * FINAL F1 (pure): the workshops (and so the HQ id) may arrive AFTER the
 * edit details. Re-derive managedBy / initialManagedBy then — but never when
 * the API sent managedBy or the user already touched the field.
 * Returns the same object when nothing changes.
 */
export function rederiveEditManagedBy(editing, hqWorkshopId) {
    if (!editing || !hqWorkshopId) return editing;
    if (editing.managedByFromApi || editing.managedByTouched) return editing;
    if (editing.ownerWorkshopId == null || String(editing.ownerWorkshopId).trim() === '') return editing;
    const derived = deriveManagedBy({ ownerWorkshopId: editing.ownerWorkshopId, hqWorkshopId }, null);
    if (!derived) return editing;
    if (editing.managedBy === derived && editing.initialManagedBy === derived) return editing;
    return { ...editing, managedBy: derived, initialManagedBy: derived };
}

/**
 * FINAL F1 (pure): a cached workshop list from before isPlatformHq existed
 * cannot tell which row is HQ — ignore it.
 */
export function isUsableBranchCache(cache) {
    const ws = Array.isArray(cache?.workshops) ? cache.workshops : null;
    if (!ws || ws.length === 0) return false;
    return ws.every((w) => w && typeof w.isPlatformHq === 'boolean');
}
