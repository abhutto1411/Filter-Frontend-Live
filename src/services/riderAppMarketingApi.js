import { apiFetch } from './api';

/** Marketing portal → Filter Rider app promotions (synced to Rider by the Rider backend). */
const ROOT = '/super-admin-marketing-protal/rider-app';

const json = (method, body) => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});
const enc = (id) => encodeURIComponent(String(id));

/** Rider services, zones and existing promo codes (copied from Rider). */
export const riderAppGetCatalog = () => apiFetch(`${ROOT}/catalog`);

export const riderAppListPromotions = () => apiFetch(`${ROOT}/promotions`);

export const riderAppGetPromotion = (id) => apiFetch(`${ROOT}/promotions/${enc(id)}`);

export const riderAppCreatePromotion = (payload) =>
  apiFetch(`${ROOT}/promotions`, json('POST', payload));

export const riderAppUpdatePromotion = (id, payload) =>
  apiFetch(`${ROOT}/promotions/${enc(id)}`, json('PATCH', payload));

export const riderAppSubmitPromotion = (id) =>
  apiFetch(`${ROOT}/promotions/${enc(id)}/submit-approval`, json('PATCH', {}));

export const riderAppApprovePromotion = (id) =>
  apiFetch(`${ROOT}/promotions/${enc(id)}/approve`, json('PATCH', {}));

export const riderAppRejectPromotion = (id, reason) =>
  apiFetch(`${ROOT}/promotions/${enc(id)}/reject`, json('PATCH', { reason }));

export const riderAppSetPromotionActivation = (id, active) =>
  apiFetch(`${ROOT}/promotions/${enc(id)}/activation`, json('PATCH', { active }));

/** "Show on Rider app" settings for existing ERP promotions. */
export const riderAppListWorkshopOffers = () => apiFetch(`${ROOT}/workshop-offers`);

export const riderAppSetWorkshopOffer = (promotionId, payload) =>
  apiFetch(`${ROOT}/workshop-offers/${enc(promotionId)}`, json('PUT', payload));

/** Upload a banner image (JPG / PNG / WEBP, max 2 MB). Returns { id, url }. */
export const marketingUploadMedia = (file) => {
  const form = new FormData();
  form.append('file', file);
  return apiFetch('/super-admin-marketing-protal/media', { method: 'POST', body: form });
};
