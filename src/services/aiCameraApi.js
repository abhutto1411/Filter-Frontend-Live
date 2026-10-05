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

// ─── Company Staff Vehicles ───────────────────────────────────
export const listStaffVehicles = async (workshopId) => {
  const res = await apiFetch(`/ai-camera/staff-vehicles/${workshopId}`);
  return unwrap(res);
};

export const createStaffVehicle = (data) =>
  apiFetch('/ai-camera/staff-vehicles', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const deleteStaffVehicle = (id) =>
  apiFetch(`/ai-camera/staff-vehicles/${id}`, { method: 'DELETE' });
