/**
 * Corporate bookings (JWT) — list/detail/branches for the new booking UX.
 * Old GET /corporate/orders and POST /corporate/make_payment remain; prefer these routes.
 */
import { apiFetch } from './api';

function qs(params) {
    const u = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v == null || v === '') return;
        u.set(k, String(v));
    });
    const s = u.toString();
    return s ? `?${s}` : '';
}

/** GET /corporate/branches — branch picker for booking step 2. */
export async function fetchCorporateBranches({ signal } = {}) {
    const data = await apiFetch('/corporate/branches', { signal });
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.branches)) return data.branches;
    if (Array.isArray(data?.data?.branches)) return data.data.branches;
    if (Array.isArray(data?.data)) return data.data;
    return [];
}

/**
 * GET /corporate/bookings?status=&branchId=&startDate=&endDate=&limit=&offset=
 * Corporate portal bookings: app `CorporateOrder` rows plus walk-in sales orders once they are no
 * longer “awaiting corporate approval” (pending quotes: `GET /corporate/walk-in-orders/pending`).
 * @returns {{ bookings: unknown[], total?: number, limit?: number, offset?: number }}
 */
export async function fetchCorporateBookings(params = {}, { signal } = {}) {
    const data = await apiFetch(`/corporate/bookings${qs(params)}`, { signal });
    const root = data?.data && typeof data.data === 'object' ? data.data : data;
    const bookings = Array.isArray(root?.bookings)
        ? root.bookings
        : Array.isArray(root?.orders)
          ? root.orders
          : Array.isArray(data?.bookings)
            ? data.bookings
            : [];
    return {
        bookings,
        total: root?.total ?? data?.total,
        limit: root?.limit ?? data?.limit,
        offset: root?.offset ?? data?.offset,
    };
}

/** GET /corporate/bookings/:id — full booking detail; falls back to null on failure. */
export async function fetchCorporateBookingById(id, { signal } = {}) {
    const data = await apiFetch(`/corporate/bookings/${encodeURIComponent(String(id))}`, { signal });
    return data?.booking ?? data?.data?.booking ?? data?.data ?? data?.order ?? data;
}

/** GET /corporate/bookings/:bookingId/invoice — accepts numeric id or CB-<id> reference. */
export async function fetchCorporateBookingInvoice(bookingId, { signal } = {}) {
    const data = await apiFetch(
        `/corporate/bookings/${encodeURIComponent(String(bookingId))}/invoice`,
        { signal },
    );
    return data?.invoice ?? data?.data?.invoice ?? data?.data ?? data;
}

/** GET /corporate/walk-in-orders/pending */
export async function fetchCorporatePendingWalkInOrders({ signal } = {}) {
    const data = await apiFetch('/corporate/walk-in-orders/pending', { signal });
    return Array.isArray(data?.pending) ? data.pending : Array.isArray(data?.data?.pending) ? data.data.pending : [];
}

/** GET /corporate/walk-in-orders/:orderId */
export async function fetchCorporateWalkInOrderById(orderId, { signal } = {}) {
    const data = await apiFetch(`/corporate/walk-in-orders/${encodeURIComponent(String(orderId))}`, { signal });
    return data?.data ?? data;
}

/** POST /corporate/walk-in-orders/:orderId/approve */
export async function approveCorporateWalkInOrder(orderId) {
    return apiFetch(`/corporate/walk-in-orders/${encodeURIComponent(String(orderId))}/approve`, { method: 'POST' });
}

/** POST /corporate/walk-in-orders/:orderId/reject */
export async function rejectCorporateWalkInOrder(orderId, reason) {
    return apiFetch(`/corporate/walk-in-orders/${encodeURIComponent(String(orderId))}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
    });
}

/**
 * GET /corporate/walk-in-orders/settings — returns `{ autoApproveWalkIns }`.
 * When `true`, future cashier walk-in submissions are auto-approved on the
 * corporate user's behalf (skipping the manual booking-approvals queue).
 */
export async function getCorporateWalkInSettings({ signal } = {}) {
    const data = await apiFetch('/corporate/walk-in-orders/settings', { signal });
    return {
        autoApproveWalkIns: Boolean(
            data?.autoApproveWalkIns ?? data?.data?.autoApproveWalkIns,
        ),
    };
}

/** PATCH /corporate/walk-in-orders/settings */
export async function updateCorporateWalkInSettings({ autoApproveWalkIns }) {
    return apiFetch('/corporate/walk-in-orders/settings', {
        method: 'PATCH',
        body: JSON.stringify({ autoApproveWalkIns: !!autoApproveWalkIns }),
    });
}
