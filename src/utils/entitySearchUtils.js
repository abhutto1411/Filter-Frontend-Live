/** Normalize text for fuzzy employee/entity search (Latin accents, extra spaces). */
export function normalizeEntitySearchText(value) {
    return String(value ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\p{L}\p{N}\s@._+-]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Build searchable haystack from combobox option fields. */
export function entitySearchHaystack(option) {
    const parts = [
        option?.label,
        option?.subtitle,
        option?.searchText,
        ...(Array.isArray(option?.searchTokens) ? option.searchTokens : []),
    ];
    return normalizeEntitySearchText(parts.filter(Boolean).join(' '));
}

function wordsFromNormalizedText(text) {
    return String(text || '')
        .split(' ')
        .filter(Boolean);
}

/** True when token matches a whole word exactly or as a word prefix (not embedded substring). */
function wordMatchesToken(word, token) {
    return word === token || word.startsWith(token);
}

/**
 * Score how well an option matches query (higher = better). Returns -1 if no match.
 * Uses word-boundary matching so "Aalim" does not match "Saalim".
 */
export function scoreEntitySearchMatch(option, rawQuery) {
    const query = normalizeEntitySearchText(rawQuery);
    if (!query) return 0;

    const haystack = entitySearchHaystack(option);
    if (!haystack) return -1;

    const label = normalizeEntitySearchText(option?.label);
    const labelWords = wordsFromNormalizedText(label);
    const hayWords = wordsFromNormalizedText(haystack);
    const queryTokens = query.split(' ').filter(Boolean);

    if (haystack === query) return 1000;
    if (label === query) return 980;
    if (label.startsWith(query)) return 900;
    if (haystack.startsWith(query)) return 880;

    if (queryTokens.length === 1) {
        const token = queryTokens[0];
        if (labelWords.some((w) => w === token)) return 850;
        if (labelWords.some((w) => wordMatchesToken(w, token))) return 820;
        if (hayWords.some((w) => w === token)) return 780;
        if (hayWords.some((w) => wordMatchesToken(w, token))) return 750;
        return -1;
    }

    if (queryTokens.every((t) => labelWords.some((w) => wordMatchesToken(w, t)))) return 700;
    if (queryTokens.every((t) => hayWords.some((w) => wordMatchesToken(w, t)))) return 650;

    return -1;
}

/** Filter + rank options for combobox search. */
export function filterSearchOptions(options, rawQuery, { maxInitial = 100, maxFiltered = 200 } = {}) {
    const list = Array.isArray(options) ? options : [];
    const query = normalizeEntitySearchText(rawQuery);
    if (!query) return list.slice(0, maxInitial);

    return list
        .map((option) => ({ option, score: scoreEntitySearchMatch(option, query) }))
        .filter((row) => row.score >= 0)
        .sort(
            (a, b) =>
                b.score - a.score ||
                String(a.option.label || '').localeCompare(String(b.option.label || '')),
        )
        .slice(0, maxFiltered)
        .map((row) => row.option);
}

export function countSearchMatches(options, rawQuery) {
    const query = normalizeEntitySearchText(rawQuery);
    if (!query) return Array.isArray(options) ? options.length : 0;
    return (Array.isArray(options) ? options : []).filter(
        (option) => scoreEntitySearchMatch(option, query) >= 0,
    ).length;
}
