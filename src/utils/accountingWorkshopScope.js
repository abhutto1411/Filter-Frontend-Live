/** Module-level HQ workshop id for Super Admin accounting clone API calls. */
let _workshopId = null;
let _hqBooks = false;

export function setAccountingWorkshopScopeId(id) {
    _workshopId = id != null && id !== '' ? String(id) : null;
}

export function setAccountingHqBooksMode(enabled) {
    _hqBooks = Boolean(enabled);
}

export function getAccountingWorkshopScopeId() {
    return _workshopId;
}

export function isAccountingHqBooksMode() {
    return _hqBooks;
}

export function mergeAccountingScopeParams(params = {}) {
    const out = { ...params };
    if (_workshopId && out.workshopId == null) {
        out.workshopId = _workshopId;
    }
    if (_hqBooks) {
        out.hqBooks = 'true';
    }
    return out;
}

export function mergeAccountingScopeBody(body = {}) {
    const out = { ...body };
    if (_workshopId && out.workshopId == null) {
        out.workshopId = _workshopId;
    }
    if (_hqBooks) {
        out.hqBooks = 'true';
    }
    return out;
}
