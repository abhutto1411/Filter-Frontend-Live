import { apiFetch } from './api';
import { mergeAccountingScopeParams } from '../utils/accountingWorkshopScope';

function withQuery(path, params = {}) {
  const query = new URLSearchParams();
  Object.entries(mergeAccountingScopeParams(params)).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value)) {
        value.forEach((v) => query.append(key, String(v)));
      } else {
        query.set(key, String(value));
      }
    }
  });
  const qs = query.toString();
  return qs ? `${path}?${qs}` : path;
}

/** GET /workshop-accounting/lookups/platform-expense-accounts */
export const lookupPlatformExpenseAccounts = (params = {}) =>
  apiFetch(
    withQuery('/workshop-accounting/lookups/platform-expense-accounts', params),
  );

/** POST /workshop-accounting/platform-expenses — P-A14A */
export const createPlatformExpense = (body = {}) =>
  apiFetch('/workshop-accounting/platform-expenses', {
    method: 'POST',
    body: JSON.stringify(body),
  });

/** GET /workshop-accounting/reports/intercompany — P-A14B */
export const getIntercompanyReport = (params = {}) =>
  apiFetch(withQuery('/workshop-accounting/reports/intercompany', params));

/** POST /workshop-accounting/intercompany/settlements — P-A14B */
export const createIntercompanySettlement = (body = {}) =>
  apiFetch('/workshop-accounting/intercompany/settlements', {
    method: 'POST',
    body: JSON.stringify(body),
  });
