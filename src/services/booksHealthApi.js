import { apiFetch } from './api';
import { mergeAccountingScopeParams } from '../utils/accountingWorkshopScope';

function withQuery(path, params = {}) {
    const query = new URLSearchParams();
    Object.entries(mergeAccountingScopeParams(params)).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            query.set(key, String(value));
        }
    });
    const qs = query.toString();
    return qs ? `${path}?${qs}` : path;
}

/** GET /workshop-accounting/books-health */
export const getBooksHealthSummary = (params = {}) =>
    apiFetch(withQuery('/workshop-accounting/books-health', params));

/** POST /workshop-accounting/books-health/repair (ensureAccountingSetup) */
export const postBooksHealthRepair = (params = {}) =>
    apiFetch(withQuery('/workshop-accounting/books-health/repair', params), {
        method: 'POST',
    });

/** GET /workshop-accounting/books-health/outbox */
export const listBooksHealthOutbox = (params = {}) =>
    apiFetch(withQuery('/workshop-accounting/books-health/outbox', params));

/** POST /workshop-accounting/books-health/outbox/:id/retry */
export const retryBooksHealthOutbox = (id, params = {}) =>
    apiFetch(
        withQuery(
            `/workshop-accounting/books-health/outbox/${encodeURIComponent(String(id))}/retry`,
            params,
        ),
        { method: 'POST' },
    );

/**
 * POST /accounting/noncash-purchases/repair?dryRun=true|false
 * dryRun defaults true on the server.
 */
export const postNoncashPurchasesRepair = ({ dryRun = true, ...params } = {}) =>
    apiFetch(
        withQuery('/accounting/noncash-purchases/repair', {
            dryRun: dryRun ? 'true' : 'false',
            ...params,
        }),
        { method: 'POST' },
    );

/** GET /workshop-staff/accounting/invariants (P-A39) */
export const getAccountingInvariants = (params = {}) =>
    apiFetch(withQuery('/workshop-staff/accounting/invariants', params));
