/** Helpers for AI Camera Training Data review UI. */

export const TRAINING_STATUSES = [
  'pending',
  'auto_labeled',
  'verified',
  'rejected',
];

export const TRAINING_REASONS = ['lock', 'low_conf', 'disagree'];

/** Prefill / normalize plate label: uppercase, strip spaces. */
export function normalizeTrainingLabel(raw) {
  return String(raw ?? '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .slice(0, 40);
}

export function defaultLabelForCrop(crop) {
  return normalizeTrainingLabel(crop?.labelText || crop?.predictedText || '');
}

/**
 * Char boxes may be crop-pixel absolute {x,y,w,h} or similar.
 * Returns a normalized list for SVG overlay.
 */
export function normalizeCharBoxes(charBoxes) {
  if (!Array.isArray(charBoxes)) return [];
  return charBoxes
    .map((box, index) => {
      if (!box || typeof box !== 'object') return null;
      const x = Number(box.x);
      const y = Number(box.y);
      const w = Number(box.w ?? box.width);
      const h = Number(box.h ?? box.height);
      if (![x, y, w, h].every((n) => Number.isFinite(n))) return null;
      return {
        key: `${index}-${box.char ?? box.cls ?? 'ch'}`,
        cls: box.cls,
        char: box.char != null ? String(box.char) : '',
        conf: box.conf != null ? Number(box.conf) : null,
        x,
        y,
        w,
        h,
      };
    })
    .filter(Boolean);
}

export function trainingImageSrc(url, baseUrl = '') {
  if (!url) return '';
  if (/^https?:\/\//i.test(url) || url.startsWith('data:')) return url;
  const base = String(baseUrl || '').replace(/\/+$/, '');
  return url.startsWith('/') ? `${base}${url}` : `${base}/${url}`;
}

/**
 * After verifying/rejecting the crop at `index`, return the next index
 * in the remaining list (same index if a later card slides up).
 */
export function nextReviewIndex(currentIndex, remainingCount) {
  if (remainingCount <= 0) return 0;
  if (currentIndex >= remainingCount) return remainingCount - 1;
  return currentIndex;
}

export function exportStatusParam(statusFilter) {
  if (!statusFilter || statusFilter === 'all') {
    return 'verified,auto_labeled';
  }
  if (statusFilter === 'verified' || statusFilter === 'auto_labeled') {
    return statusFilter;
  }
  return 'verified,auto_labeled';
}
