/**
 * Shared client-side match for invoice / note / GRN product pickers.
 *
 * Every word the user types must appear somewhere in the product's name, SKU,
 * Arabic name or brand — in any order. "toyota 20w50" finds "TOYOTA Oil 20W50",
 * and "OIL-549" finds SKU "OIL-549". Mirrors the backend picker search
 * (word-by-word AND), so a row the server returns is never hidden by the client.
 */

export function normalizeProductPickerText(value) {
    return String(value ?? '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

export function productPickerTokens(query) {
    const q = normalizeProductPickerText(query);
    if (!q) return [];
    return Array.from(new Set(q.split(' ').filter(Boolean)));
}

export function productPickerHaystack(item) {
    return normalizeProductPickerText(
        [
            item?.name,
            item?.productName,
            item?.sku,
            item?.arabicName,
            item?.brandName,
            item?.searchText,
        ]
            .filter(Boolean)
            .join(' '),
    );
}

/** True when every typed word is found in the product's searchable text. */
export function productMatchesPickerQuery(item, query) {
    const tokens = productPickerTokens(query);
    if (tokens.length === 0) return true;
    const hay = productPickerHaystack(item);
    if (!hay) return false;
    return tokens.every((tok) => hay.includes(tok));
}
