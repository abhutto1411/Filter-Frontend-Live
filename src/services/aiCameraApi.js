import { apiFetch } from './api';

/**
 * Unwrap { success, ... } wrapper from the backend SuccessResponseInterceptor.
 * - Pure list wrap `{ success, data: [...] }` → returns the array
 * - Paginated wrap `{ success, data, total, page, ... }` → drops success, keeps object
 * - Object wrap `{ success, id, name, ... }` → drops success, keeps object
 */
function unwrap(res) {
  if (!res || typeof res !== 'object') return res;
  if (!('success' in res)) return res;

  const { success, ...rest } = res;

  // Pure array response: { success: true, data: [...] }
  const keys = Object.keys(rest);
  if (keys.length === 1 && keys[0] === 'data' && Array.isArray(rest.data)) {
    return rest.data;
  }

  return rest;
}

// ─── Cameras ──────────────────────────────────────────────────
export const listCameras = async (params = {}) => {
  const qs = new URLSearchParams();
  if (params.workshopId) qs.set('workshopId', params.workshopId);
  if (params.branchId) qs.set('branchId', params.branchId);
  const q = qs.toString();
  const res = await apiFetch(`/ai-camera${q ? `?${q}` : ''}`);
  return unwrap(res);
};

export const getCamera = async (id) => {
  const res = await apiFetch(`/ai-camera/${id}`);
  return unwrap(res);
};

export const createCamera = (data) =>
  apiFetch('/ai-camera', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateCamera = (id, data) =>
  apiFetch(`/ai-camera/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const deleteCamera = (id) =>
  apiFetch(`/ai-camera/${id}`, { method: 'DELETE' });

// ─── AI Orders ────────────────────────────────────────────────
export const listAiOrders = async (params = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  });
  const q = qs.toString();
  const res = await apiFetch(`/ai-camera/orders/list${q ? `?${q}` : ''}`);
  return unwrap(res);
};

export const getAiOrder = async (id) => {
  const res = await apiFetch(`/ai-camera/orders/${id}`);
  return unwrap(res);
};

/** Phase 4 — Matching Engine */
export const runAiOrderMatching = async (params = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  });
  const q = qs.toString();
  const res = await apiFetch(`/ai-camera/orders/run-matching${q ? `?${q}` : ''}`, {
    method: 'POST',
  });
  return unwrap(res);
};

export const matchAiOrder = (id, salesOrderId) =>
  apiFetch(`/ai-camera/orders/${id}/match`, {
    method: 'POST',
    body: JSON.stringify({ salesOrderId }),
  });

export const unmatchAiOrder = (id) =>
  apiFetch(`/ai-camera/orders/${id}/unmatch`, { method: 'POST' });

// ─── Company Staff Vehicles ───────────────────────────────────
export const listStaffVehicles = async (workshopId, params = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  });
  const q = qs.toString();
  const res = await apiFetch(
    `/ai-camera/staff-vehicles/${workshopId}${q ? `?${q}` : ''}`,
  );
  return unwrap(res);
};

export const createStaffVehicle = (data) =>
  apiFetch('/ai-camera/staff-vehicles', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateStaffVehicle = (id, data) =>
  apiFetch(`/ai-camera/staff-vehicles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const deleteStaffVehicle = (id) =>
  apiFetch(`/ai-camera/staff-vehicles/${id}`, { method: 'DELETE' });

// ─── Phase 5 — Reports ────────────────────────────────────────
export const getAiCameraReportSummary = async (params = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  });
  const q = qs.toString();
  const res = await apiFetch(`/ai-camera/reports/summary${q ? `?${q}` : ''}`);
  return unwrap(res);
};

export const getAiCameraPermissions = async () => {
  const res = await apiFetch('/ai-camera/permissions');
  return unwrap(res);
};

// ─── Unmatched POS Orders (Cashier-only tab) ──────────────────
export const listUnmatchedPosOrders = async (params = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  });
  const q = qs.toString();
  const res = await apiFetch(`/ai-camera/orders/unmatched-pos${q ? `?${q}` : ''}`);
  return unwrap(res);
};

// ─── Manual Plate Correction ──────────────────────────────────
export const correctPlateNumber = (orderId, plateNumber) =>
  apiFetch(`/ai-camera/orders/${orderId}/correct-plate`, {
    method: 'POST',
    body: JSON.stringify({ plateNumber }),
  });

// ─── Fuzzy Match Suggestions ──────────────────────────────────
export const getMatchSuggestions = async (orderId, params = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  });
  const q = qs.toString();
  const res = await apiFetch(`/ai-camera/orders/${orderId}/suggestions${q ? `?${q}` : ''}`);
  return unwrap(res);
};

// ─── Delete AI Order ──────────────────────────────────────────
export const deleteAiOrder = (orderId) =>
  apiFetch(`/ai-camera/orders/${orderId}`, { method: 'DELETE' });
