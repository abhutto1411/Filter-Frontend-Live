import { apiFetch } from './api';
import { qs } from './workshopStaffApi';
import {
  normalizeCollectionRequestDetail,
  normalizeCollectionRequestList,
  normalizeLockerTeam,
  normalizePostingContext,
  nullableMoney,
} from './lockerCollectionNormalize.js';

export {
  normalizeCollectionRequestDetail,
  normalizeCollectionRequestList,
  normalizeLockerTeam,
  normalizePostingContext,
  nullableMoney,
};

export async function listCollectionRequests(params = {}) {
  const res = await apiFetch(`/locker/collection-requests${qs(params)}`);
  return normalizeCollectionRequestList(res);
}

export async function getCollectionRequest(id) {
  const res = await apiFetch(
    `/locker/collection-requests/${encodeURIComponent(String(id))}`,
  );
  return normalizeCollectionRequestDetail(res);
}

export async function listLockerTeam() {
  const res = await apiFetch('/locker/team');
  return normalizeLockerTeam(res);
}

export async function getRecordPostingContext(requestId, extra = {}) {
  const res = await apiFetch(
    `/locker/record-collection/context${qs({
      requestId: requestId || undefined,
      officerUserId: extra.officerUserId || undefined,
    })}`,
  );
  return normalizePostingContext(res);
}

export function previewOfficerCitProvision(officerUserId) {
  return apiFetch(
    `/locker/cit/officers/${encodeURIComponent(String(officerUserId))}/provision/preview`,
  );
}

export function provisionOfficerCit(officerUserId) {
  return apiFetch(
    `/locker/cit/officers/${encodeURIComponent(String(officerUserId))}/provision`,
    { method: 'POST' },
  );
}
