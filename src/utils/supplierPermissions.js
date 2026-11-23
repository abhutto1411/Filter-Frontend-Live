import { useAuth } from '../context/AuthContext';

/**
 * SP-22 — supplier portal action codes (mirror of backend `SUPPLIER_PERM` in
 * permissions/constants/super-admin-permissions.const.ts). The API answers 403 for a
 * missing code; the UI disables the matching button so users are not surprised.
 *
 * Bootstrap rule is the shared one (`userHas` in AuthContext): a supplier user with no
 * role keeps full access; once a role is assigned it is enforced strictly.
 */
export const SUPPLIER_PERM = {
    grPost: 'supplier.goods-receipts.post',
    grReverse: 'supplier.goods-receipts.reverse',
    billPost: 'supplier.purchase-bills.post',
    salesPost: 'supplier.sales-invoices.post',
    expensePost: 'supplier.expenses.post',
    paymentPost: 'supplier.payments.post',
    receiptPost: 'supplier.receipts.post',
    journalPost: 'supplier.journals.post',
    reportsExport: 'supplier.reports.export',
};

/**
 * `const can = useSupplierCan(); can(SUPPLIER_PERM.grPost)` — true when allowed.
 *
 * MZ-06: fail-closed. Without an auth context (no `hasPermission`) every action is
 * denied. The "no role ⇒ full access" bootstrap lives in one place only —
 * `userHas` in AuthContext (step 3) — so a supplier with no role still gets `true`.
 */
export function useSupplierCan() {
    // Every supplier page renders inside AuthProvider (App root).
    const has = useAuth()?.hasPermission;
    return (code) => (typeof has === 'function' ? has(code) === true : false);
}
