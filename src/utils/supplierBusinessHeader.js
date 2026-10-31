/**
 * Normalize flat GET /supplier/profile (or nested) into document-header fields.
 * Used by PDFs / print views so tenant Settings drive every business document.
 */
export function supplierBusinessFromProfile(res) {
    if (!res || typeof res !== 'object') return null;
    const s = res.supplier && typeof res.supplier === 'object' ? res.supplier : res;
    const name = String(s.companyName || s.name || '').trim();
    if (!name && !s.logoUrl && !s.vatId) return null;

    const address =
        String(s.address || '').trim() ||
        [s.street, s.cityDistrict].filter(Boolean).join(', ').trim() ||
        null;

    return {
        id: s.supplierId != null ? String(s.supplierId) : s.id != null ? String(s.id) : undefined,
        name: name || null,
        vatId: s.vatId ?? s.taxId ?? null,
        address,
        country: s.country != null ? String(s.country).trim() || null : null,
        logoUrl: s.logoUrl != null ? String(s.logoUrl).trim() || null : null,
        mobile: s.mobile ?? s.phone ?? null,
        email: s.email ?? null,
    };
}

/**
 * Merge tenant business identity onto a document detail object for WorkshopPurchaseInvoiceView
 * (and similar print templates). Existing explicit seller fields win over profile defaults.
 */
export function withSupplierBusinessHeader(detail, profileOrRes) {
    const base = detail && typeof detail === 'object' ? { ...detail } : {};
    const biz =
        profileOrRes && profileOrRes.name != null && profileOrRes.logoUrl !== undefined
            ? profileOrRes
            : supplierBusinessFromProfile(profileOrRes);

    if (!biz) return base;

    const existingName = String(
        base.supplierLegalName || base.supplierName || base.supplier?.name || '',
    ).trim();
    const existingVat = String(
        base.supplierVatNumber || base.supplier?.vatId || '',
    ).trim();
    const existingAddress = String(
        base.supplierAddress || base.supplier?.address || '',
    ).trim();
    const existingLogo = String(
        base.supplierLogoUrl || base.supplier?.logoUrl || '',
    ).trim();
    const existingCountry = String(
        base.supplierCountry || base.supplier?.country || '',
    ).trim();

    if (!existingName && biz.name) {
        base.supplierLegalName = biz.name;
        base.supplierName = biz.name;
    }
    if (!existingVat && biz.vatId) base.supplierVatNumber = biz.vatId;
    if (!existingAddress && biz.address) base.supplierAddress = biz.address;
    if (!existingLogo && biz.logoUrl) base.supplierLogoUrl = biz.logoUrl;
    if (!existingCountry && biz.country) base.supplierCountry = biz.country;

    if (biz.mobile && !base.supplierMobile) base.supplierMobile = biz.mobile;
    if (biz.email && !base.supplierEmail) base.supplierEmail = biz.email;

    // Prefer address lines as the EN/AR “tagline” under the name when present.
    if (biz.address) {
        if (!String(base.supplierTagline || '').trim()) {
            base.supplierTagline = biz.address;
        }
        if (!String(base.supplierTaglineAr || '').trim()) {
            base.supplierTaglineAr = biz.address;
        }
    }

    base.supplier = {
        ...(base.supplier && typeof base.supplier === 'object' ? base.supplier : {}),
        id: biz.id,
        name: existingName || biz.name,
        companyName: existingName || biz.name,
        vatId: existingVat || biz.vatId,
        address: existingAddress || biz.address,
        country: existingCountry || biz.country,
        logoUrl: existingLogo || biz.logoUrl,
        mobile: biz.mobile,
        email: biz.email,
    };

    return base;
}
