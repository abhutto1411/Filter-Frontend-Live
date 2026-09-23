const STORAGE_KEY = 'filter_referral_code';

function trimCode(value) {
  return String(value || '').trim();
}

export function persistReferralCode(code) {
  const next = trimCode(code);
  if (!next || typeof localStorage === 'undefined') return next;
  localStorage.setItem(STORAGE_KEY, next);
  return next;
}

export function getStoredReferralCode() {
  if (typeof localStorage === 'undefined') return '';
  return trimCode(localStorage.getItem(STORAGE_KEY));
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
