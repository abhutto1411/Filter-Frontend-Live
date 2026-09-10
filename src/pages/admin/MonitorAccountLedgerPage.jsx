import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import ProfessionalLedgerStatementDocument from '../../components/accounting/ProfessionalLedgerStatementDocument';
import {
    accountNormalDebit,
    unwrapLedgerPayload,
} from '../../utils/accountLedgerStatementUtils';
import {
    exportAccountLedgerExcel,
    exportAccountLedgerPdf,
} from '../../utils/supplierLedgerExport';
import * as accountsApi from '../../services/accountsApi';
import * as supMon from '../../services/supplierAccountingMonitorApi';
import { getPlatformHqInfo, getWorkshops, getSuppliers } from '../../services/superAdminApi';
import {
    loadSaAccountingDateRange,
    startOfMonthISO,
    todayISO,
} from './saAccountingDateRange';
import { loadSaAccountingScope } from './saAccountingScope';
import { adminWalletExpenseLedgerFilterOptions } from '../../constants/adminWalletExpenseCategories';
import '../../styles/admin/AccountingPage.css';

const HQ_ADMIN_WALLET_LEDGER_CODES = new Set(['6100', '1335']);

/**
 * Super Admin monitor — full-page account ledger statement (workshop, HQ, or supplier scope).
 */
export default function MonitorAccountLedgerPage() {
    const { accountId } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const scope = useMemo(() => loadSaAccountingScope(), []);
    const isSupplier = scope.type === 'supplier';
    const isHq = scope.type === 'hq';
    const [resolvedHqWorkshopId, setResolvedHqWorkshopId] = useState(scope.hqWorkshopId || '');

    const workshopId = isHq ? resolvedHqWorkshopId : scope.workshopId;

    const fallbackCode = searchParams.get('code') || '';
    const fallbackName = searchParams.get('name') || '';
    const fallbackType = searchParams.get('type') || '';
    const urlDateFrom = searchParams.get('dateFrom') || '';
    const urlDateTo = searchParams.get('dateTo') || '';

    const [entityLabel, setEntityLabel] = useState('');
    const storedRange = useMemo(() => loadSaAccountingDateRange(), []);
    const [dateFrom, setDateFrom] = useState(
        () => urlDateFrom || storedRange.dateFrom || startOfMonthISO(),
    );
    const [dateTo, setDateTo] = useState(
        () => urlDateTo || storedRange.dateTo || todayISO(),
    );
    const [expenseCategoryFilter, setExpenseCategoryFilter] = useState('');
    const [expenseCategoryInput, setExpenseCategoryInput] = useState('');
    const [walletUserFilter, setWalletUserFilter] = useState('');
    const [walletUserInput, setWalletUserInput] = useState('');
    const [topupsOnly, setTopupsOnly] = useState(false);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [data, setData] = useState(null);
    const loadSeqRef = useRef(0);

    useEffect(() => {
        if (!isHq) return;
        if (scope.hqWorkshopId) {
            setResolvedHqWorkshopId(scope.hqWorkshopId);
            return;
        }
        let cancelled = false;
        getPlatformHqInfo()
            .then((res) => {
                if (!cancelled && res?.workshopId) {
                    setResolvedHqWorkshopId(String(res.workshopId));
                }
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [isHq, scope.hqWorkshopId]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                if (isSupplier && scope.supplierId) {
                    const res = await getSuppliers().catch(() => ({ suppliers: [] }));
                    const s = (res?.suppliers || res || []).find(
                        (x) => String(x.id) === String(scope.supplierId),
                    );
                    if (!cancelled) setEntityLabel(s?.name || '');
                } else if (workshopId) {
                    const res = await getWorkshops({ limit: 100 }).catch(() => ({ workshops: [] }));
                    const w = (res?.workshops || res || []).find(
                        (x) => String(x.id) === String(workshopId),
                    );
                    if (!cancelled) {
                        setEntityLabel(
                            isHq ? w?.name || 'Platform HQ' : w?.name || '',
                        );
                    }
                }
            } catch {
                /* optional */
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [isSupplier, isHq, scope.supplierId, workshopId]);

    useEffect(() => {
        if (urlDateFrom) setDateFrom(urlDateFrom);
        if (urlDateTo) setDateTo(urlDateTo);
    }, [accountId, urlDateFrom, urlDateTo]);

    const ledgerParams = useMemo(() => {
        const p = {
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined,
            limit: 10000,
        };
        if (expenseCategoryFilter) {
            p.expenseCategory = expenseCategoryFilter;
        }
        if (walletUserFilter) {
            p.walletUserId = walletUserFilter;
        }
        if (topupsOnly) {
            p.topupsOnly = 'true';
        }
        if (!isSupplier && scope.branchId) {
            p.branchId = scope.branchId;
        }
        if (!isSupplier && workshopId) {
            p.workshopId = workshopId;
        }
        return p;
    }, [dateFrom, dateTo, expenseCategoryFilter, walletUserFilter, topupsOnly, isSupplier, scope.branchId, workshopId]);

    const load = useCallback(async (opts = {}) => {
        if (!accountId) return;
        if (isSupplier && !scope.supplierId) {
            setErr('Select a supplier on Chart of Accounts first.');
            setData(null);
            setLoading(false);
            return;
        }
        if (!isSupplier && !workshopId) {
            setErr(
                isHq
                    ? 'Set up Platform HQ books on Chart of Accounts first.'
                    : 'Select a workshop on Chart of Accounts first.',
            );
            setData(null);
            setLoading(false);
            return;
        }
        const seq = ++loadSeqRef.current;
        setLoading(true);
        setErr('');
        const categoryParam =
            opts.expenseCategory !== undefined
                ? opts.expenseCategory
                : expenseCategoryFilter;
        const walletUserParam =
            opts.walletUserId !== undefined
                ? opts.walletUserId
                : walletUserFilter;
        const topupsOnlyParam =
            opts.topupsOnly !== undefined ? opts.topupsOnly : topupsOnly;
        const params = {
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined,
            limit: 10000,
            ...(!topupsOnlyParam && categoryParam ? { expenseCategory: categoryParam } : {}),
            ...(walletUserParam ? { walletUserId: walletUserParam } : {}),
            ...(topupsOnlyParam ? { topupsOnly: 'true' } : {}),
            ...(!isSupplier && scope.branchId ? { branchId: scope.branchId } : {}),
            ...(!isSupplier && workshopId ? { workshopId } : {}),
        };
        try {
            let res;
            if (isSupplier) {
                res = await supMon.monitorSupplierAccountLedger(
                    scope.supplierId,
                    accountId,
                    params,
                );
            } else {
                res = await accountsApi.getAccountLedger(accountId, params);
            }
            if (seq !== loadSeqRef.current) return;
            setData(unwrapLedgerPayload(res));
        } catch (e) {
            if (seq !== loadSeqRef.current) return;
            setErr(e?.message || 'Failed to load ledger');
            setData(null);
        } finally {
            if (seq === loadSeqRef.current) setLoading(false);
        }
    }, [accountId, isHq, isSupplier, scope.supplierId, scope.branchId, workshopId, dateFrom, dateTo, expenseCategoryFilter, walletUserFilter, topupsOnly]);

    useEffect(() => {
        void load();
    }, [load]);

    async function fetchForExport() {
        if (isSupplier) {
            const res = await supMon.monitorSupplierAccountLedger(
                scope.supplierId,
                accountId,
                { ...ledgerParams, limit: 10000 },
            );
            return unwrapLedgerPayload(res);
        }
        const res = await accountsApi.getAccountLedger(accountId, {
            ...ledgerParams,
            limit: 10000,
        });
        return unwrapLedgerPayload(res);
    }

    function buildExportHeader(root) {
        return {
            ...(root?.header || {}),
            accountCode: root?.header?.accountCode || fallbackCode || data?.header?.accountCode || '',
            accountName: root?.header?.accountName || fallbackName || data?.header?.accountName || '',
            accountType: root?.header?.accountType || fallbackType || data?.header?.accountType || '',
            companyName: root?.header?.companyName || entityLabel || undefined,
            from: root?.header?.from || dateFrom || undefined,
            to: root?.header?.to || dateTo || undefined,
            expenseCategory: root?.header?.expenseCategory || expenseCategoryFilter || undefined,
            walletUserId: root?.header?.walletUserId || walletUserFilter || undefined,
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
        const next = loadSaAccountingDateRange();
        setDateFrom(next.dateFrom);
        setDateTo(next.dateTo);
        setExpenseCategoryFilter('');
        setExpenseCategoryInput('');
        setWalletUserFilter('');
        setWalletUserInput('');
        setTopupsOnly(false);
    }

    function syncWalletUserFromInput() {
        if (walletUserFilter) return walletUserFilter;
        const raw = String(walletUserInput || '').trim();
        if (!raw || raw.toLowerCase() === 'all users / employees' || raw.toLowerCase() === 'all employees') {
            setWalletUserFilter('');
            return '';
        }
        const options = walletUserComboboxOptions;
        const match = options.find(
            (u) => u.label.toLowerCase() === raw.toLowerCase()
                || String(u.id).toLowerCase() === raw.toLowerCase(),
        );
        const next = match?.id ?? '';
        setWalletUserFilter(next);
        return next;
    }

    function syncExpenseCategoryFromInput() {
        if (expenseCategoryFilter) return expenseCategoryFilter;
        const raw = String(expenseCategoryInput || '').trim();
        if (!raw || raw.toLowerCase() === 'all categories') {
            setExpenseCategoryFilter('');
            return '';
        }
        const options = expenseCategoryComboboxOptions;
        const match = options.find(
            (c) => c.label.toLowerCase() === raw.toLowerCase()
                || String(c.id).toLowerCase() === raw.toLowerCase(),
        );
        const next = match?.id ?? '';
        setExpenseCategoryFilter(next);
        return next;
    }

    function applyFilters() {
        const nextCategory = topupsOnly ? '' : syncExpenseCategoryFromInput();
        const nextWalletUser = syncWalletUserFromInput();
        void load({
            expenseCategory: nextCategory,
            walletUserId: nextWalletUser,
            topupsOnly,
        });
    }

    function handleTopupsOnlyChange(checked) {
        setTopupsOnly(checked);
        if (checked) {
            setExpenseCategoryFilter('');
            setExpenseCategoryInput('');
        }
    }

    const isAdminWalletTopupLedger = Boolean(
        isHq && (fallbackCode === '1335' || data?.header?.accountCode === '1335'),
    );
    const isPettyCashExpenseLedger = Boolean(
        data?.pettyCashExpenseLedger
        || (isHq && (
            HQ_ADMIN_WALLET_LEDGER_CODES.has(fallbackCode)
            || HQ_ADMIN_WALLET_LEDGER_CODES.has(data?.header?.accountCode)
        )),
    );

    const showExpenseCategoryFilter = isPettyCashExpenseLedger && !topupsOnly;

    const expenseCategoryComboboxOptions = useMemo(() => {
        if (data?.filterOptions?.expenseCategories?.length) {
            return data.filterOptions.expenseCategories.map((c) => ({
                id: c.key,
                label: c.label,
                searchText: c.label,
            }));
        }
        if (!isPettyCashExpenseLedger) return [];
        return adminWalletExpenseLedgerFilterOptions();
    }, [data?.filterOptions?.expenseCategories, isPettyCashExpenseLedger]);

    const ledgerFilterOptions = useMemo(() => {
        if (data?.filterOptions) {
            return data.filterOptions;
        }
        if (!isPettyCashExpenseLedger) return null;
        return {
            expenseCategories: adminWalletExpenseLedgerFilterOptions().map((o) => ({
                key: o.id,
                label: o.label,
            })),
            walletUsers: [{ key: '', label: 'All users / employees' }],
        };
    }, [data?.filterOptions, isPettyCashExpenseLedger]);

    const walletUserComboboxOptions = useMemo(
        () =>
            (ledgerFilterOptions?.walletUsers || [])
                .filter((u) => u.key)
                .map((u) => ({
                    id: u.key,
                    label: u.label,
                    searchText: u.label,
                })),
        [ledgerFilterOptions?.walletUsers],
    );

    const accountType =
        data?.header?.accountType ||
        data?.account?.type ||
        fallbackType ||
        '';
    const normalDebit = accountNormalDebit(accountType);
    const scopeLabel = isSupplier ? 'Supplier' : isHq ? 'Platform HQ' : 'Workshop';
    const scopeNote = isHq
        ? `${scopeLabel}: ${entityLabel || '—'} · Full editing enabled`
        : `${scopeLabel}: ${entityLabel || '—'} · Read-only monitoring`;

    return (
        <div className="accounting-page module-container">
            <ProfessionalLedgerStatementDocument
                onBack={() => navigate('/admin/accounting/chart-of-accounts')}
                backLabel="Back to Chart of Accounts"
                scopeNote={scopeNote}
                loading={loading}
                error={err}
                accountCode={data?.header?.accountCode || fallbackCode}
                accountName={data?.header?.accountName || fallbackName}
                accountType={accountType}
                companyName={data?.header?.companyName || entityLabel || undefined}
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
                onApply={applyFilters}
                onClear={clearRange}
                onExportPdf={() => void onExportPdf()}
                onExportExcel={() => void onExportExcel()}
                exportDisabled={!data || loading}
                showPettyCashExpenseColumns={isPettyCashExpenseLedger}
                closingBalanceKpiLabel={
                    isPettyCashExpenseLedger
                        ? 'Closing Balance (selected period)'
                        : 'Closing Balance'
                }
                filterOptions={ledgerFilterOptions}
                expenseCategoryFilter={expenseCategoryFilter}
                onExpenseCategoryFilterChange={setExpenseCategoryFilter}
                expenseCategoryFilterInput={expenseCategoryInput}
                onExpenseCategoryFilterInputChange={setExpenseCategoryInput}
                expenseCategoryComboboxOptions={expenseCategoryComboboxOptions}
                walletUserFilter={walletUserFilter}
                onWalletUserFilterChange={setWalletUserFilter}
                walletUserFilterInput={walletUserInput}
                onWalletUserFilterInputChange={setWalletUserInput}
                walletUsers={ledgerFilterOptions?.walletUsers ?? []}
                showTopupsOnlyFilter={isAdminWalletTopupLedger}
                topupsOnly={topupsOnly}
                onTopupsOnlyChange={handleTopupsOnlyChange}
                showExpenseCategoryFilter={showExpenseCategoryFilter}
            />
        </div>
    );
}
