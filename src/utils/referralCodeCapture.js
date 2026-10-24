const STORAGE_KEY = 'filter_referral_code';

function trimCode(value) {
  return String(value || '').trim();
}

/** POS may still scan an old /r/:code URL — keep only the referral code. */
export function extractReferralCodeFromInput(raw) {
  const s = trimCode(raw);
  if (!s) return '';
  const fromPath = (pathname) => {
    const parts = String(pathname || '').split('/').filter(Boolean);
    const rIdx = parts.findIndex((p) => String(p).toLowerCase() === 'r');
    if (rIdx >= 0 && parts[rIdx + 1]) {
      try {
        return decodeURIComponent(parts[rIdx + 1]).trim();
      } catch {
        return String(parts[rIdx + 1]).trim();
      }
    }
    return '';
  };
  try {
    if (/^https?:\/\//i.test(s)) {
      const from = fromPath(new URL(s).pathname);
      if (from) return from;
    }
  } catch {
    /* ignore */
  }
  const m = s.match(/\/r\/([^/?#]+)/i);
  if (m?.[1]) {
    try {
      return decodeURIComponent(m[1]).trim();
    } catch {
      return m[1].trim();
    }
  }
  return s;
}

export function persistReferralCode(code) {
  const next = extractReferralCodeFromInput(code);
  if (!next || typeof localStorage === 'undefined') return next;
  localStorage.setItem(STORAGE_KEY, next);
  return next;
}

export function getStoredReferralCode() {
  if (typeof localStorage === 'undefined') return '';
  return extractReferralCodeFromInput(localStorage.getItem(STORAGE_KEY));
}

export function captureReferralCodeFromSearch(search) {
  if (!search) return '';
  const params = new URLSearchParams(String(search).startsWith('?') ? search : `?${search}`);
  const code = trimCode(params.get('ref') || params.get('referral') || params.get('code'));
  if (code) persistReferralCode(code);
  return code;
}

export function publicReferralSharePath(code) {
  const next = trimCode(code);
  return next ? `/r/${encodeURIComponent(next)}` : '';
}
