const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

/** Split a concatenated EN+AR string at the first Arabic letter. */
export function splitBilingualName(raw) {
    const s = String(raw || '').trim();
    if (!s) return { en: '', ar: '' };
    const idx = s.search(ARABIC_RE);
    if (idx < 0) return { en: s, ar: '' };
    if (idx === 0) {
        const latin = s.search(/[A-Za-z]/);
        if (latin < 0) return { en: '', ar: s };
        return { en: s.slice(latin).trim(), ar: s.slice(0, latin).trim() };
    }
    return { en: s.slice(0, idx).trim(), ar: s.slice(idx).trim() };
}
