import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import ProfessionalLedgerStatementDocument from '../../../components/accounting/ProfessionalLedgerStatementDocument';
import {
    accountNormalDebit,
    derivePartyFilterKey,
    isBankCashLedgerAccount,
    partyQueryFromFilterKey,
    unwrapLedgerPayload,
} from '../../../utils/accountLedgerStatementUtils';
import {
    exportAccountLedgerExcel,
    exportAccountLedgerPdf,
} from '../../../utils/supplierLedgerExport';
import { getSupplierAccountLedger, getSupplierAccounts } from '../../../services/supplierAccountingApi';
import {
    startOfMonthISO,
    todayISO,
} from './SupplierAccountingShared';

/**
 * Supplier portal — full-page COA account ledger statement.
 */
export default function SupplierAccountLedgerPage() {
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const accountId = useMemo(() => {
        const m = location.pathname.match(/^\/supplier\/accounting\/ledger\/([^/]+)/);
        return m ? decodeURIComponent(m[1]) : '';
    }, [location.pathname]);

    const [accountMeta, setAccountMeta] = useState(null);
    const [allAccounts, setAllAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [data, setData] = useState(null);
    const loadSeqRef = useRef(0);

    const [dateFrom, setDateFrom] = useState(startOfMonthISO);
    const [dateTo, setDateTo] = useState(todayISO);
    const [partyFilterKey, setPartyFilterKey] = useState(() =>
        derivePartyFilterKey({
            partyType: searchParams.get('partyType') || '',
            partyId: searchParams.get('partyId') || '',
            externalPartyId: searchParams.get('externalPartyId') || '',
        }),
    );
    const [offsetAccountFilterId, setOffsetAccountFilterId] = useState('');

    const accountsById = useMemo(() => {
        const m = new Map();
        for (const a of allAccounts || []) {
            if (a?.id != null) m.set(String(a.id), a);
        }
        return m;
    }, [allAccounts]);

    const account = accountMeta || accountsById.get(String(accountId)) || null;

    const isCashLedger = useMemo(
        () =>
            data?.isCashLedger === true ||
            isBankCashLedgerAccount(account, accountsById),
        [data?.isCashLedger, account, accountsById],
    );

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const list = await getSupplierAccounts();
                if (cancelled) return;
                const arr = Array.isArray(list) ? list : list?.accounts || list?.data || [];
                setAllAccounts(arr);
                const found = arr.find((a) => String(a.id) === String(accountId));
                if (found) setAccountMeta(found);
            } catch {
                /* optional */
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [accountId]);

    const ledgerQueryBase = useMemo(() => {
        const partyQ = partyQueryFromFilterKey(partyFilterKey);
        return {
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined,
            ...partyQ,
            offsetAccountId: offsetAccountFilterId || undefined,
        };
    }, [dateFrom, dateTo, partyFilterKey, offsetAccountFilterId]);

    const load = useCallback(async () => {
        if (!accountId) return;
        const seq = ++loadSeqRef.current;
        setLoading(true);
        setErr('');
        try {
            const res = await getSupplierAccountLedger(accountId, {
                ...ledgerQueryBase,
                limit: 10000,
            });
            if (seq !== loadSeqRef.current) return;
            setData(unwrapLedgerPayload(res));
        } catch (e) {
            if (seq !== loadSeqRef.current) return;
            setErr(e?.message || 'Failed to load ledger');
            setData(null);
        } finally {
            if (seq === loadSeqRef.current) setLoading(false);
        }
    }, [accountId, ledgerQueryBase]);

    useEffect(() => {
        void load();
    }, [load]);

    async function fetchForExport() {
        const res = await getSupplierAccountLedger(accountId, {
            ...ledgerQueryBase,
            limit: 10000,
        });
        return unwrapLedgerPayload(res);
    }

    function buildExportHeader(root) {
        const partyLabel = root?.header?.partyLabel || null;
        return {
            ...(root?.header || {}),
            accountCode: root?.header?.accountCode || account?.code || '',
            accountName:
                (root?.header?.accountName || account?.name || '') +
                (partyLabel ? ` · ${partyLabel}` : ''),
            accountType: root?.header?.accountType || account?.type || '',
            companyName: root?.header?.companyName || undefined,
            from: root?.header?.from || dateFrom || undefined,
            to: root?.header?.to || dateTo || undefined,
            currencyCode: root?.header?.currencyCode || 'SAR',
        };
    }

    async function onExportPdf() {
        setErr('');
        try {
            const root = await fetchForExport();
            exportAccountLedgerPdf({
                header: buildExportHeader(root),
                openingBalance: root?.openingBalance ?? 0,
                rows: root?.rows ?? [],
                totals: root?.totals,
            });
        } catch (e) {
            setErr(e?.message || 'PDF export failed');
        }
    }

    async function onExportExcel() {
        setErr('');
        try {
            const root = await fetchForExport();
            exportAccountLedgerExcel({
                header: buildExportHeader(root),
                openingBalance: root?.openingBalance ?? 0,
                rows: root?.rows ?? [],
                totals: root?.totals,
            });
        } catch (e) {
            setErr(e?.message || 'Excel export failed');
        }
    }

    function clearRange() {
        setDateFrom(startOfMonthISO());
        setDateTo(todayISO());
        setPartyFilterKey('');
        setOffsetAccountFilterId('');
    }

    const accountType = data?.header?.accountType || account?.type || '';
    const normalDebit = accountNormalDebit(accountType);
    const filterOptions = data?.filterOptions ?? { parties: [], offsetAccounts: [] };

    return (
        <div className="accounting-page module-container">
            <ProfessionalLedgerStatementDocument
                onBack={() => navigate('/supplier/accounting/coa')}
                backLabel="Back to Chart of Accounts"
                loading={loading}
                error={err}
                accountCode={data?.header?.accountCode || account?.code || ''}
                accountName={data?.header?.accountName || account?.name || ''}
                accountType={accountType}
                companyName={data?.header?.companyName}
                periodFrom={data?.header?.from || dateFrom || '—'}
                periodTo={data?.header?.to || dateTo || '—'}
                openingBalance={data?.openingBalance ?? 0}
                rows={data?.rows ?? []}
                totals={data?.totals}
                normalDebit={normalDebit}
                dateFrom={dateFrom}
                dateTo={dateTo}
                onDateFromChange={setDateFrom}
                onDateToChange={setDateTo}
                onApply={() => void load()}
                onClear={clearRange}
                onExportPdf={() => void onExportPdf()}
                onExportExcel={() => void onExportExcel()}
                exportDisabled={!data || loading}
                showCashLedgerColumns={isCashLedger}
                counterpartyColumnLabel="Paid to / Received from"
                offsetAccountColumnLabel="Expense / AR account"
                filterOptions={filterOptions}
                partyFilterKey={partyFilterKey}
                onPartyFilterKeyChange={setPartyFilterKey}
                offsetAccountFilterId={offsetAccountFilterId}
                onOffsetAccountFilterIdChange={setOffsetAccountFilterId}
            />
        </div>
    );
}
