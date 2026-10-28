/** Shared helpers for the Rider app promotion pages. */

/** The ERP backend wraps arrays as { success, data: [...] }. */
export const listFrom = (response) =>
  Array.isArray(response) ? response : response?.data ?? [];

export function syncBadgeClass(status) {
  switch (status) {
    case 'LIVE':
      return 'rap-badge rap-badge--live';
    case 'ERROR':
      return 'rap-badge rap-badge--error';
    case 'INACTIVE':
      return 'rap-badge rap-badge--off';
    default:
      return 'rap-badge rap-badge--pending';
  }
}
