/**
 * GET /supplier/profile returns a flat object (companyName, vatId, …).
 * Some callers still expect { supplier: { … } }.
 */
export function supplierProfileFromApi(res) {
    if (!res || typeof res !== 'object') return null;

    const s = res.supplier && typeof res.supplier === 'object' ? res.supplier : res;
    const name = String(s.companyName || s.name || '').trim();
    if (!name) return null;

    const address =
        String(s.address || '').trim() ||
        [s.street, s.cityDistrict].filter(Boolean).join(', ').trim() ||
        null;

    return {
        id: s.supplierId != null ? String(s.supplierId) : s.id != null ? String(s.id) : undefined,
        name,
        vatId: s.vatId ?? s.taxId ?? null,
        address,
        mobile: s.mobile ?? s.phone ?? null,
        email: s.email ?? null,
    };
}
