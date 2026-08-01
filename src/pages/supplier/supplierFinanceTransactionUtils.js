/** Supplier customer (AR) transaction types shown in affiliated / external party money logs. */
export const SUPPLIER_CUSTOMER_FINANCIAL_TX_TYPES = new Set([
    'invoice_created',
    'payment_received',
    'invoice_return_created',
]);

export function isSupplierCustomerFinancialTx(row) {
    return SUPPLIER_CUSTOMER_FINANCIAL_TX_TYPES.has(String(row?.transactionType || ''));
}

/** Sales-side AR movements → debtor / credit columns (+ running balance). */
export function classifySalesArMovement(t) {
    const type = String(t.transactionType || '');
    const raw = t.amount;
    const n =
        raw != null && Number.isFinite(Number(raw)) ? Math.abs(Number(raw)) : null;
    if (n == null || n < 0.0005) return { debit: null, credit: null };

    if (type === 'invoice_created') {
        return { debit: n, credit: null };
    }
    if (type === 'payment_received' || type === 'invoice_return_created') {
        return { debit: null, credit: n };
    }
    return { debit: null, credit: null };
}

export function buildSalesArLedgerRows(transactions) {
    const financial = (transactions || []).filter(isSupplierCustomerFinancialTx);
    const ascending = [...financial].sort((a, b) => {
        const ta = new Date(a.createdAt).getTime();
        const tb = new Date(b.createdAt).getTime();
        if (ta !== tb) return ta - tb;
        return String(a.id).localeCompare(String(b.id), undefined, {
            numeric: true,
        });
    });
    let balance = 0;
    return ascending.map((t) => {
        const { debit, credit } = classifySalesArMovement(t);
        if (debit != null) balance += debit;
        if (credit != null) balance -= credit;
        return {
            raw: t,
            debit,
            credit,
            balance,
            currencyCode: t.currencyCode || 'SAR',
        };
    });
}
