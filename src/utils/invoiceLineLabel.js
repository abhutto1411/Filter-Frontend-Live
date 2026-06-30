const GL_ACCOUNT_LABELS = new Set([
    'sales revenue',
    'cost of goods sold',
    'rent expense',
    'utilities expense',
    'salaries & wages',
    'inventory asset',
]);

/** True when a stored line label is a GL account name/code rather than a product. */
export function isLikelyGlAccountLabel(name) {
    const n = String(name ?? '').trim();
    if (!n) return true;
    if (/^\d{4}$/.test(n)) return true;
    if (/^\d{4}\s*-\s*.+$/i.test(n)) return true;
    return GL_ACCOUNT_LABELS.has(n.toLowerCase());
}

/** Split "1410 - Inventory Asset" → { code, name } */
export function parseAccountDisplay(accountDisplay) {
    const s = String(accountDisplay || '').trim();
    if (!s) return { code: '', name: '' };
    const i = s.indexOf(' - ');
    if (i === -1) return { code: s, name: '' };
    return { code: s.slice(0, i).trim(), name: s.slice(i + 3).trim() };
}

/**
 * Invoice line label for off-catalog / non-inventory items.
 * Uses typed item name when present, otherwise the selected GL account label.
 */
export function resolveManualInvoiceLineLabel(line, searchText = '') {
    const item = String(searchText ?? line?.item ?? '').trim();
    if (item) return item;
    const { code, name } = parseAccountDisplay(line?.account);
    if (name) return name;
    if (code) return code;
    return '';
}

/**
 * Invoice line display/save name: typed item → linked catalog product → GL account label.
 */
export function resolveInvoiceLineProductName(line, options = {}) {
    const searchText = options.searchText ?? line?.item ?? '';
    const item = String(searchText).trim();
    if (item) return item;

    const productId = String(
        options.productId ??
            line?.supplierStockProductId ??
            line?.supplierProductId ??
            line?.productId ??
            '',
    ).trim();
    const inventoryItems = options.inventoryItems;
    if (productId && Array.isArray(inventoryItems)) {
        const match = inventoryItems.find((p) => {
            const id = String(p?.id ?? '').trim();
            const sid = String(p?.supplierStockProductId ?? '').trim();
            return id === productId || sid === productId;
        });
        const catalogName = String(match?.name ?? '').trim();
        if (catalogName) return catalogName;
    }

    return resolveManualInvoiceLineLabel(line, searchText);
}

/** Line is ready to submit without a catalog product (account + qty + price). */
export function isManualInvoiceLineComplete(line, searchText = '') {
    const label = resolveManualInvoiceLineLabel(line, searchText);
    if (!label) return false;
    const qty = parseFloat(String(line?.qty ?? '').replace(',', '.'));
    if (!Number.isFinite(qty) || qty <= 0) return false;
    const price = parseFloat(String(line?.price ?? '').replace(',', '.'));
    if (!Number.isFinite(price) || price < 0) return false;
    return true;
}

export function isInvoiceLineSubmitReady(line, searchText = '') {
    const hasProduct =
        line?.productId != null && String(line.productId).trim() !== '';
    if (hasProduct) {
        const qty = parseFloat(String(line?.qty ?? '').replace(',', '.'));
        return Number.isFinite(qty) && qty > 0;
    }
    return isManualInvoiceLineComplete(line, searchText);
}
