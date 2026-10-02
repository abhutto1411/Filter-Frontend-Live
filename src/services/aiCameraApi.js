import { apiFetch } from './api';

/** Unwrap { success, data } or { success, ...rest } wrapper from the backend interceptor. */
function unwrap(res) {
  if (!res || typeof res !== 'object') return res;
  // Array wrapped in { success, data: [...] }
  if (Array.isArray(res.data)) return res.data;
  // Object spread { success, ...fields }
  if ('success' in res) {
    const { success, ...rest } = res;
    return rest;
  }
  return res;
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
