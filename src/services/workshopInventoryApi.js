import { apiFetch } from './api';

function qs(params) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params || {})) {
        if (v != null && v !== '' && String(v) !== 'undefined') p.set(k, v);
    }
    const s = p.toString();
    return s ? `?${s}` : '';
}

/**
 * Manual stock correction + audit (branch scope).
 *
 * Default POST updates branch_inventory.qty_on_hand only.
 * Reason **Opening qty** updates workshop_products.opening_qty and branch_inventory.qty_on_hand to the same value.
 * previousQty is optional; when sent it must match resolved on-hand (inventory row or else opening) for optimistic locking.
 *
 * ── POST /workshop-catalog/branches/:branchId/products/:productId/inventory-adjustments ──
 *   Optional query: `workshopId` (same as PATCH critical / branch lists when impersonating).
 *   Body:
 *     {
 *       previousQty?: number,
 *       newQty: number,       // >= 0
 *       reason: string,
 *       note?: string
 *     }
 *   Response:
 *     { success: true, data: { logId, branchId, productId, previousQty, newQty, delta, reason, note, createdAt } }
 *
 * ── GET adjustment history ───────────────────────────────────────────────────
 *   Path:   GET /workshop-catalog/branches/:branchId/products/:productId/inventory-adjustments
 *   Query:  limit?, offset?, sort?: 'asc'|'desc' (default desc by time)
 *   Response (example):
 *     {
 *       success: true,
 *       data: {
 *         entries: [
 *           {
 *             id: string,
 *             createdAt: string,     // ISO 8601
 *             previousQty: number,
 *             newQty: number,
 *             delta: number,
 *             reason: string,
 *             adjustedBy?: { id, name },
 *             source?: 'manual' | 'pos' | 'purchase_receipt' | 'supplier_purchase_invoice' | string
 *             (supplier_purchase_invoice = inventory_movements with movementType
 *             workshop_supplier_purchase_received when a supplier approves a workshop purchase invoice)
 *           }
 *         ],
 *         total?: number
 *       }
 *     }
 *
 * ── Workshop-wide scope ("All branches") ──────────────────────────────────
 *   Either:
 *     GET/POST .../workshop/products/:productId/inventory-adjustments?aggregate=true
 *   or require a branch to be selected for writes; reads can merge per branch.
 *   FE currently only POSTs when a single branch is selected.
 */

export function postBranchProductInventoryAdjustment(branchId, productId, body, { workshopId, signal } = {}) {
    return apiFetch(
        `/workshop-catalog/branches/${encodeURIComponent(branchId)}/products/${encodeURIComponent(productId)}/inventory-adjustments${qs({ workshopId })}`,
        { method: 'POST', body: JSON.stringify(body), signal },
    );
}

export function getBranchProductInventoryAdjustments(branchId, productId, { limit = 50, offset = 0, workshopId, signal } = {}) {
    return apiFetch(
        `/workshop-catalog/branches/${encodeURIComponent(branchId)}/products/${encodeURIComponent(productId)}/inventory-adjustments${qs({ limit, offset, workshopId })}`,
        { signal },
    );
}

/**
 * Bulk adjust many products on one branch in a single request (server runs adjustments in parallel).
 * Body: { reason, note?, items: [{ productId, newQty, previousQty? }] }
 * Response: { success, updated, failed, failures: [{ productId, message }] }
 */
export function postBranchBulkInventoryAdjustment(branchId, body, { workshopId, signal } = {}) {
    return apiFetch(
        `/workshop-catalog/branches/${encodeURIComponent(branchId)}/products/inventory-adjustments/bulk${qs({ workshopId })}`,
        { method: 'POST', body: JSON.stringify(body), signal },
    );
}
