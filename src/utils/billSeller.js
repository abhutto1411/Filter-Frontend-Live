/**
 * CORPORATE-FIX-02 F: seller on a generated-bill print (pure; `node --test`-safe).
 * Workshop self-billing (collectionOwner 'workshop') → the workshop's own name (EN/AR) + taxId,
 * never the platform. HQ bills → the platform; role 'principal' (hq_principal) or 'collector'.
 * `resolvePlatform(...sources)` returns { nameEn, nameAr, qrName, vatNumber }.
 */
export function resolveBillSellerWith(resolvePlatform, bill, corp, workshop, ...platformSources) {
    const ps = bill?.printSeller && typeof bill.printSeller === 'object' ? bill.printSeller : null;
    const isWorkshop = bill?.collectionOwner === 'workshop' || ps?.kind === 'workshop';
    if (isWorkshop) {
        const nameEn = String(workshop?.name || ps?.nameEn || corp?.workshopName || '').trim();
        const nameAr = String(workshop?.nameAr || ps?.nameAr || '').trim() || nameEn;
        const vatNumber = String(workshop?.taxId || ps?.vatNumber || corp?.workshopTaxId || '').trim();
        return { kind: 'workshop', role: 'seller', nameEn, nameAr, qrName: nameAr || nameEn, vatNumber };
    }
    const platform = resolvePlatform(
        corp,
        ...platformSources,
        ps ? { platformNameEn: ps.nameEn, platformNameAr: ps.nameAr, platformVatNumber: ps.vatNumber } : null,
    );
    const role = bill?.vatModel === 'hq_principal' || ps?.role === 'principal' ? 'principal' : 'collector';
    return { kind: 'platform', role, ...platform };
}
