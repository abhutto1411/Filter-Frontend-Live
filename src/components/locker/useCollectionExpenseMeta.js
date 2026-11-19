import { useEffect, useState } from 'react';
import { fetchAllExpenseAccounts } from './expenseAccountOptions';

const DEFAULT_META = { vatPercent: 15, vatInputAccount: null, clearing: null };

/**
 * Workshop VAT rate, input-VAT account (1310) and pending-expenses clearing account,
 * from the same session-cached GET /locker/expense-accounts?all=1 the account picker uses.
 * Falls back to 15 % until (or if) the API does not return a rate.
 */
export default function useCollectionExpenseMeta() {
    const [meta, setMeta] = useState(DEFAULT_META);
    useEffect(() => {
        let alive = true;
        fetchAllExpenseAccounts()
            .then((res) => {
                if (!alive || !res || Array.isArray(res)) return;
                const pct = Number(res.vatPercent);
                setMeta({
                    vatPercent: Number.isFinite(pct) && pct >= 0 ? pct : 15,
                    vatInputAccount: res.vatInputAccount || null,
                    clearing: res.clearing ?? res.clearingAccount ?? null,
                });
            })
            .catch(() => {});
        return () => {
            alive = false;
        };
    }, []);
    return meta;
}
