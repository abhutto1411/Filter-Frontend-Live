import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import ProfessionalLedgerStatementDocument from '../../../components/accounting/ProfessionalLedgerStatementDocument';
import {
    accountNormalDebit,
    unwrapLedgerPayload,
} from '../../../utils/accountLedgerStatementUtils';
import {
    exportAccountLedgerExcel,
    exportAccountLedgerPdf,
} from '../../../utils/supplierLedgerExport';
import * as accountsApi from '../../../services/accountsApi';
import { adminWalletExpenseLedgerFilterOptions } from '../../../constants/adminWalletExpenseCategories';
import {
    startOfMonthISO,
    todayISO,
} from '../../admin/saAccountingDateRange';
import {
    isWorkshopLockerExpensesLedgerAccount,
    isWorkshopPettyCashExpenseLedgerAccount,
    isWorkshopPettyCashFundLedgerAccount,
    parseWorkshopLedgerAccountIdFromPath,
} from '../workshopCoaAccountRouting';
import { accT } from '../../../utils/accountingI18n';
import { LOCKER_EXPENSE_CATEGORIES } from '../../locker/lockerExpenseCategories';
import '../../../styles/admin/AccountingPage.css';

/**
 * Workshop admin — full-page ledger for petty cash fund [1280], employee petty
 * cash expenses [6100], locker expenses [6110], and other COA accounts.
 */
export default function WorkshopAccountLedgerPage({ locale: localeProp } = {}) {
    const outletCtx = useOutletContext() || {};
    const locale =
        localeProp ||
        outletCtx.locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => accT(locale, key, vars), [locale]);

    const routeParams = useParams();
    const location = useLocation();
    const accountId =
        routeParams.accountId ||
        parseWorkshopLedgerAccountIdFromPath(location.pathname);
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { workshop, user } = useAuth();

    const fallbackCode = searchParams.get('code') || '';
    const fallbackName = searchParams.get('name') || '';
    const fallbackType = searchParams.get('type') || '';
    const urlDateFrom = searchParams.get('dateFrom') || '';
    const urlDateTo = searchParams.get('dateTo') || '';
    const urlBranchId = searchParams.get('branchId') || '';

    const [dateFrom, setDateFrom] = useState(
        () => urlDateFrom || startOfMonthISO(),
    );
    const [dateTo, setDateTo] = useState(
        () => urlDateTo || todayISO(),
    );
    const [branchFilter, setBranchFilter] = useState(urlBranchId);
    const [expenseCategoryFilter, setExpenseCategoryFilter] = useState('');
    const [expenseCategoryInput, setExpenseCategoryInput] = useState('');
    const [walletUserFilter, setWalletUserFilter] = useState('');
    const [walletUserInput, setWalletUserInput] = useState('');
    const [topupsOnly, setTopupsOnly] = useState(false);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [data, setData] = useState(null);
    const loadSeqRef = useRef(0);

    const entityLabel = workshop?.name || user?.workshopName || t('stmt.entity.workshop');

    useEffect(() => {
        if (urlDateFrom) setDateFrom(urlDateFrom);
        if (urlDateTo) setDateTo(urlDateTo);
        if (urlBranchId) setBranchFilter(urlBranchId);
    }, [accountId, urlDateFrom, urlDateTo, urlBranchId]);

    const load = useCallback(async (opts = {}) => {
        if (!accountId) {
            setErr(t('stmt.err.noAccount'));
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
        const branchParam =
            opts.branchId !== undefined ? opts.branchId : branchFilter;
        const dateFromParam =
            opts.dateFrom !== undefined ? opts.dateFrom : dateFrom;
        const dateToParam =
            opts.dateTo !== undefined ? opts.dateTo : dateTo;
        const params = {
            dateFrom: dateFromParam || undefined,
            dateTo: dateToParam || undefined,
            limit: 10000,
            ...(!topupsOnlyParam && categoryParam ? { expenseCategory: categoryParam } : {}),
            ...(walletUserParam ? { walletUserId: walletUserParam } : {}),
            ...(topupsOnlyParam ? { topupsOnly: 'true' } : {}),
            ...(branchParam ? { branchId: branchParam } : {}),
        };
        try {
            const res = await accountsApi.getAccountLedger(accountId, params);
            if (seq !== loadSeqRef.current) return;
            const payload = unwrapLedgerPayload(res);
            if (!payload || typeof payload !== 'object') {
                throw new Error(t('stmt.err.empty'));
            }
            if (!Array.isArray(payload.rows)) {
                throw new Error(t('stmt.err.missingRows'));
            }
            setData(payload);
        } catch (e) {
            if (seq !== loadSeqRef.current) return;
            setErr(e?.message || t('stmt.err.load'));
            setData(null);
        } finally {
            if (seq === loadSeqRef.current) setLoading(false);
        }
    }, [accountId, dateFrom, dateTo, expenseCategoryFilter, walletUserFilter, topupsOnly, branchFilter, t]);

    useEffect(() => {
        void load();
        // Reload when navigating to a different COA account only.
        // Filter/date changes apply via the Apply filters button.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [accountId]);

    async function fetchForExport() {
        const res = await accountsApi.getAccountLedger(accountId, {
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined,
            limit: 10000,
            ...(expenseCategoryFilter && !topupsOnly
                ? { expenseCategory: expenseCategoryFilter }
                : {}),
            ...(walletUserFilter ? { walletUserId: walletUserFilter } : {}),
            ...(topupsOnly ? { topupsOnly: 'true' } : {}),
            ...(branchFilter ? { branchId: branchFilter } : {}),
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
            setErr(e?.message || t('stmt.err.pdf'));
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
            setErr(e?.message || t('stmt.err.excel'));
        }
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

    function syncWalletUserFromInput() {
        if (walletUserFilter) return walletUserFilter;
        const raw = String(walletUserInput || '').trim();
        if (!raw || raw.toLowerCase() === 'all employees' || raw === t('stmt.allEmployees')) {
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

    function applyFilters() {
        const nextCategory = topupsOnly ? '' : syncExpenseCategoryFromInput();
        const nextWalletUser = syncWalletUserFromInput();
        void load({
            expenseCategory: nextCategory,
            walletUserId: nextWalletUser,
            topupsOnly,
            branchId: branchFilter,
        });
    }

    function handleTopupsOnlyChange(checked) {
        setTopupsOnly(checked);
        if (checked) {
            setExpenseCategoryFilter('');
            setExpenseCategoryInput('');
        }
    }

    const accountCode = data?.header?.accountCode || fallbackCode;
    const isFundFromCode = isWorkshopPettyCashFundLedgerAccount({ code: accountCode });
    const isExpenseFromCode = isWorkshopPettyCashExpenseLedgerAccount({ code: accountCode });
    const isLockerFromCode = isWorkshopLockerExpensesLedgerAccount({ code: accountCode });
    const isWorkshopPettyCashFundLedger = Boolean(
        data?.workshopPettyCashFundLedger || isFundFromCode,
    );
    const isWorkshopPettyCashExpenseLedger = Boolean(
        data?.workshopPettyCashExpenseLedger || isExpenseFromCode,
    );
    const isWorkshopLockerExpensesLedger = Boolean(
        data?.workshopLockerExpensesLedger || isLockerFromCode,
    );
    const isPettyCashExpenseLedger = Boolean(
        data?.pettyCashExpenseLedger
        || isFundFromCode
        || isExpenseFromCode
        || isLockerFromCode,
    );
    const showTopupsOnlyFilter = isWorkshopPettyCashFundLedger;
    const showExpenseCategoryFilter = isPettyCashExpenseLedger && !topupsOnly;
    const showBranchFilter =
        isWorkshopPettyCashFundLedger
        || isWorkshopPettyCashExpenseLedger
        || isWorkshopLockerExpensesLedger;
    const scopeNote = isWorkshopLockerExpensesLedger
        ? t('stmt.scope.locker', { entity: entityLabel })
        : isWorkshopPettyCashExpenseLedger
            ? t('stmt.scope.expense', { entity: entityLabel })
            : isWorkshopPettyCashFundLedger
                ? t('stmt.scope.fund', { entity: entityLabel })
                : '';

    const ledgerFilterOptions = useMemo(() => {
        if (data?.filterOptions) {
            return data.filterOptions;
        }
        if (!isPettyCashExpenseLedger) return null;
        if (isWorkshopLockerExpensesLedger) {
            return {
                expenseCategories: [
                    { key: '', label: 'All categories' },
                    ...LOCKER_EXPENSE_CATEGORIES.map((name) => ({
                        key: name,
                        label: name,
                    })),
                ],
                walletUsers: [{ key: '', label: 'All employees' }],
                branches: [{ key: '', label: 'All branches' }],
            };
        }
        return {
            expenseCategories: adminWalletExpenseLedgerFilterOptions().map((o) => ({
                key: o.id,
                label: o.label,
            })),
            walletUsers: [{ key: '', label: t('stmt.allEmployees') }],
            branches: [{ key: '', label: t('stmt.allBranches') }],
        };
    }, [data?.filterOptions, isPettyCashExpenseLedger, isWorkshopLockerExpensesLedger, t]);

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

    const expenseCategoryComboboxOptions = useMemo(() => {
        if (data?.filterOptions?.expenseCategories?.length) {
            return data.filterOptions.expenseCategories.map((c) => ({
                id: c.key,
                label: c.label,
                searchText: c.label,
            }));
        }
        if (!isPettyCashExpenseLedger) return [];
        if (isWorkshopLockerExpensesLedger) {
            return LOCKER_EXPENSE_CATEGORIES.map((name) => ({
                id: name,
                label: name,
                searchText: name,
            }));
        }
        return adminWalletExpenseLedgerFilterOptions();
    }, [
        data?.filterOptions?.expenseCategories,
        isPettyCashExpenseLedger,
        isWorkshopLockerExpensesLedger,
    ]);

    function clearRangeAndReload() {
        const from = startOfMonthISO();
        const to = todayISO();
        setDateFrom(from);
        setDateTo(to);
        setExpenseCategoryFilter('');
        setExpenseCategoryInput('');
        setWalletUserFilter('');
        setWalletUserInput('');
        setBranchFilter('');
        setTopupsOnly(false);
        void load({
            expenseCategory: '',
            walletUserId: '',
            topupsOnly: false,
            branchId: '',
            dateFrom: from,
            dateTo: to,
        });
    }

    const accountType =
        data?.header?.accountType ||
        data?.account?.type ||
        fallbackType ||
        '';
    const normalDebit = accountNormalDebit(accountType);

    return (
        <div className="accounting-page module-container">
            <ProfessionalLedgerStatementDocument
                onBack={() => navigate('/workshop/accounting/chart-of-accounts')}
                backLabel={t('stmt.backToCoa')}
                scopeNote={scopeNote}
                loading={loading}
                error={err}
                accountCode={accountCode}
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
                onClear={clearRangeAndReload}
                onExportPdf={() => void onExportPdf()}
                onExportExcel={() => void onExportExcel()}
                exportDisabled={!data || loading}
                showPettyCashExpenseColumns={isPettyCashExpenseLedger}
                walletUserColumnLabel={
                    isWorkshopLockerExpensesLedger
                        ? t('stmt.recordedBy')
                        : isWorkshopPettyCashExpenseLedger
                            ? t('stmt.walletUserEmployee')
                            : t('stmt.employee')
                }
                expenseCategoryColumnLabel={t('stmt.accountCategory')}
                closingBalanceKpiLabel={t('stmt.closingBalanceKpi')}
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
                branchFilter={branchFilter}
                onBranchFilterChange={setBranchFilter}
                branches={ledgerFilterOptions?.branches ?? []}
                showBranchFilter={showBranchFilter}
                showTopupsOnlyFilter={showTopupsOnlyFilter}
                topupsOnly={topupsOnly}
                onTopupsOnlyChange={handleTopupsOnlyChange}
                showExpenseCategoryFilter={showExpenseCategoryFilter}
            />
        </div>
    );
}
