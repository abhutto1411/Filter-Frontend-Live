import { apiFetch } from './api';

// ─── Cameras ──────────────────────────────────────────────────
export const listCameras = (params = {}) => {
  const qs = new URLSearchParams();
  if (params.workshopId) qs.set('workshopId', params.workshopId);
  if (params.branchId) qs.set('branchId', params.branchId);
  const q = qs.toString();
  return apiFetch(`/ai-camera${q ? `?${q}` : ''}`);
};

export const getCamera = (id) => apiFetch(`/ai-camera/${id}`);

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
export const listAiOrders = (params = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  });
  const q = qs.toString();
  return apiFetch(`/ai-camera/orders/list${q ? `?${q}` : ''}`);
};

export const getAiOrder = (id) => apiFetch(`/ai-camera/orders/${id}`);

// ─── Company Staff Vehicles ───────────────────────────────────
export const listStaffVehicles = (workshopId) =>
  apiFetch(`/ai-camera/staff-vehicles/${workshopId}`);

export const createStaffVehicle = (data) =>
  apiFetch('/ai-camera/staff-vehicles', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const deleteStaffVehicle = (id) =>
  apiFetch(`/ai-camera/staff-vehicles/${id}`, { method: 'DELETE' });
