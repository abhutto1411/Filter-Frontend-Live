/** Shared helpers for the Rider app promotion pages. */

/** The ERP backend wraps arrays as { success, data: [...] }. */
export const listFrom = (response) =>
  Array.isArray(response) ? response : response?.data ?? [];
