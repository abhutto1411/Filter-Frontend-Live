import { useCallback, useEffect, useState } from 'react';
import * as accountsApi from '../../services/accountsApi';
import * as supMon from '../../services/supplierAccountingMonitorApi';

function parseAccountList(res) {
    if (Array.isArray(res)) return res;
    if (res?.accounts && Array.isArray(res.accounts)) return res.accounts;
    if (res?.data && Array.isArray(res.data)) return res.data;
    return [];
}

function accountsParamsForIndex(scope) {
    if (scope.type === 'supplier') return null;
    const p = {};
    if (scope.type === 'hq') {
        if (scope.hqWorkshopId) p.workshopId = scope.hqWorkshopId;
        p.hqBooks = 'true';
    } else {
        if (scope.workshopId) p.workshopId = scope.workshopId;
        if (scope.branchId) p.branchId = scope.branchId;
    }
    return p;
}

export function isMonitorBooksScope(scope) {
    return (
        scope?.type === 'workshop' ||
        scope?.type === 'supplier' ||
        scope?.type === 'hq'
    );
}

function isScopeReady(scope) {
    if (scope?.type === 'supplier') return !!scope.supplierId;
    if (scope?.type === 'hq') return !!scope.hqWorkshopId;
    return !!scope.workshopId;
}

/**
 * Loads COA accounts for the active monitor scope and resolves report rows → account id.
 */
export function useMonitorAccountIndex(scope) {
    const [byCode, setByCode] = useState(() => new Map());
    const [byId, setById] = useState(() => new Map());
    const [ready, setReady] = useState(false);

    useEffect(() => {
        if (!isMonitorBooksScope(scope)) {
            setByCode(new Map());
            setById(new Map());
            setReady(false);
            return undefined;
        }

        if (!isScopeReady(scope)) {
            setReady(false);
            return undefined;
        }

        let cancelled = false;
        (async () => {
            try {
                let list = [];
                if (scope.type === 'supplier') {
                    const res = await supMon.monitorSupplierAccounts(scope.supplierId);
                    list = parseAccountList(res);
                } else {
                    list = await accountsApi.getAccounts(accountsParamsForIndex(scope));
                }
                if (cancelled) return;
                const codeMap = new Map();
                const idMap = new Map();
                for (const a of list) {
                    if (a?.id != null && a.id !== '') idMap.set(String(a.id), a);
                    if (a?.code != null && a.code !== '') codeMap.set(String(a.code), a);
                }
                setByCode(codeMap);
                setById(idMap);
                setReady(true);
            } catch {
                if (!cancelled) setReady(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [scope.type, scope.workshopId, scope.supplierId, scope.branchId, scope.hqWorkshopId]);

    const resolve = useCallback(
        (row) => {
            if (!row) return null;
            if (row.id != null && row.id !== '') {
                const id = String(row.id);
                return byId.get(id) || { ...row, id };
            }
            if (row.accountId != null && row.accountId !== '') {
                const id = String(row.accountId);
                const hit = byId.get(id);
                return hit || { ...row, id };
            }
            if (row.code != null && row.code !== '') {
                return byCode.get(String(row.code)) || null;
            }
            return null;
        },
        [byCode, byId],
    );

    return { resolve, ready };
}
