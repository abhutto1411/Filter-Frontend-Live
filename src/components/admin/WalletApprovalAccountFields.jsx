import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import SearchableEntityCombobox from '../SearchableEntityCombobox';
import {
    getRequesterWalletBalance,
    listAdminWalletCashAccounts,
} from '../../services/adminWalletApi';
import { listBudgetWalletAccountsForApproval } from '../../services/budgetWalletApi';
import { details as fetchApprovalExpenseDetails } from '../../services/approvalsApi';
import { awT } from '../../utils/adminWalletsI18n';

function useAwLocale() {
    const outletCtx = useOutletContext() || {};
    const locale =
        outletCtx.locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => awT(locale, key, vars), [locale]);
    return { locale, t };
}

function fmt(value) {
    const n = Number(value ?? 0);
    return (Number.isFinite(n) ? n : 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function accountKindLabel(kind, type, t) {
    switch (kind) {
        case 'SYSTEM_LOCKER_VAULT':
            return t('acct.lockerVault');
        case 'SYSTEM_CASHIER_TILL':
            return t('acct.cashierTill');
        case 'SYSTEM_PETTY_CASH_WALLET':
            return t('acct.pettyCash');
        default:
            return String(type || '').toUpperCase() === 'BANK' ? t('acct.bank') : t('acct.cash');
    }
}

function normalizeCash(res, t) {
    const list = Array.isArray(res?.accounts)
        ? res.accounts
        : Array.isArray(res?.cashAccounts)
            ? res.cashAccounts
            : [];
    return list.map((a) => ({
        id: String(a.id),
        name: a.name || a.accountName || t('acct.accountFallback', { id: a.id }),
        balance: Number(a.currentBalance ?? a.balance ?? 0),
        branchId: a.branchId != null ? String(a.branchId) : '',
        branchName: a.branchName || a.branch?.name || '',
        kind: a.kind || '',
        kindLabel: a.kindLabel || accountKindLabel(a.kind, a.type, t),
        type: a.type || '',
    }));
}

function defaultLoadCash({ workshopId }, t) {
    return listAdminWalletCashAccounts(
        workshopId ? { workshopId } : {},
    ).then((res) => normalizeCash(res, t));
}

function defaultLoadBudgets({ workshopId, branchId }) {
    return listBudgetWalletAccountsForApproval({ workshopId, branchId }).then((res) =>
        Array.isArray(res?.accounts) ? res.accounts : [],
    );
}

function defaultLoadRequesterWallet({ userId, currencyCode }) {
    return getRequesterWalletBalance(userId, currencyCode).then((res) => ({
        userId: res?.userId ?? userId,
        name: null,
        balance: Number(res?.balance ?? 0),
    }));
}

function defaultLoadExpenseApprovalContext({ expenseRequestId }) {
    return fetchApprovalExpenseDetails('admin_wallet_expense_request', expenseRequestId).then(
        (res) => ({
            userId: res?.userId ?? res?.adminUser?.id ?? '',
            name: res?.adminUser?.name ?? res?.adminUserName ?? null,
            balance: Number(res?.requesterWalletBalance ?? 0),
        }),
    );
}

/**
 * Payment + budget pickers for admin wallet fund/expense approval.
 *
 * Expense mode is wallet-first: if the requester's wallet covers the amount,
 * payment account is hidden. Otherwise Pay from account is required (Option B).
 */
export default function WalletApprovalAccountFields({
    workshopId,
    branchId,
    amount,
    mode = 'fund',
    showBudget = mode === 'expense',
    busy = false,
    requesterUserId = '',
    requesterName = '',
    expenseRequestId = '',
    currencyCode = 'SAR',
    onChange,
    loadCashAccounts,
    loadBudgetAccounts = defaultLoadBudgets,
    loadRequesterWalletBalance = defaultLoadRequesterWallet,
    loadExpenseApprovalContext = defaultLoadExpenseApprovalContext,
}) {
    const { t } = useAwLocale();
    const resolveCash = useCallback(
        (args) => (loadCashAccounts ? loadCashAccounts(args) : defaultLoadCash(args, t)),
        [loadCashAccounts, t],
    );

    const [cashAccounts, setCashAccounts] = useState([]);
    const [budgetAccounts, setBudgetAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [walletLoading, setWalletLoading] = useState(false);
    const [walletError, setWalletError] = useState('');
    const [requesterWalletBalance, setRequesterWalletBalance] = useState(null);
    const [resolvedRequesterUserId, setResolvedRequesterUserId] = useState('');
    const [resolvedRequesterName, setResolvedRequesterName] = useState('');

    const [sourceAccountId, setSourceAccountId] = useState('');
    const [sourceText, setSourceText] = useState('');
    const [budgetAccountId, setBudgetAccountId] = useState('');
    const [budgetText, setBudgetText] = useState('');

    const amt = Number(amount ?? 0);
    const isExpense = mode === 'expense';
    const walletCoversExpense = Boolean(
        isExpense
        && requesterWalletBalance != null
        && amt > 0
        && requesterWalletBalance >= amt,
    );
    const needsPayFromAccount = mode === 'fund' || (isExpense && !walletCoversExpense);
    const displayRequesterName = requesterName || resolvedRequesterName || t('acct.requester');

    useEffect(() => {
        if (!isExpense) {
            setRequesterWalletBalance(null);
            setResolvedRequesterUserId('');
            setResolvedRequesterName('');
            setWalletError('');
            setWalletLoading(false);
            return undefined;
        }

        let cancelled = false;
        setWalletLoading(true);
        setWalletError('');

        const applyWalletResult = (res) => {
            if (cancelled) return;
            setResolvedRequesterUserId(String(res?.userId ?? requesterUserId ?? ''));
            if (res?.name) setResolvedRequesterName(String(res.name));
            setRequesterWalletBalance(Number(res?.balance ?? 0));
        };

        const loadPromise = requesterUserId
            ? loadRequesterWalletBalance({ userId: requesterUserId, currencyCode })
            : expenseRequestId
                ? loadExpenseApprovalContext({ expenseRequestId, currencyCode })
                : Promise.reject(new Error(t('acct.errIdentify')));

        loadPromise
            .then(applyWalletResult)
            .catch((err) => {
                if (!cancelled) {
                    setWalletError(err?.message || t('acct.errWallet'));
                    setRequesterWalletBalance(null);
                    setResolvedRequesterUserId('');
                }
            })
            .finally(() => {
                if (!cancelled) setWalletLoading(false);
            });

        return () => { cancelled = true; };
    }, [
        isExpense,
        requesterUserId,
        expenseRequestId,
        currencyCode,
        loadRequesterWalletBalance,
        loadExpenseApprovalContext,
        t,
    ]);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setLoadError('');
        setSourceAccountId('');
        setBudgetAccountId('');
        const loaders = [
            needsPayFromAccount || mode === 'fund'
                ? resolveCash({ workshopId, branchId })
                : Promise.resolve([]),
            showBudget ? loadBudgetAccounts({ workshopId, branchId }) : Promise.resolve([]),
        ];
        Promise.all(loaders)
            .then(([cash, budgets]) => {
                if (cancelled) return;
                const cashList = Array.isArray(cash) ? cash : [];
                const budgetList = showBudget && Array.isArray(budgets) ? budgets : [];
                setCashAccounts(cashList);
                setBudgetAccounts(budgetList);
                if (needsPayFromAccount) {
                    const preferredCash = branchId
                        ? (cashList.find((a) => String(a.branchId) === String(branchId)) || cashList[0])
                        : cashList[0];
                    if (preferredCash) setSourceAccountId(String(preferredCash.id));
                }
                if (budgetList.length > 0) setBudgetAccountId(String(budgetList[0].id));
            })
            .catch((err) => {
                if (!cancelled) setLoadError(err?.message || t('acct.errLoad'));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [
        workshopId,
        branchId,
        showBudget,
        mode,
        needsPayFromAccount,
        resolveCash,
        loadBudgetAccounts,
        t,
    ]);

    const cashOptions = useMemo(
        () => cashAccounts.map((a) => {
            const kindLabel = a.kindLabel || accountKindLabel(a.kind, a.type, t);
            const branchLabel = a.branchName
                || (a.kind === 'SYSTEM_LOCKER_VAULT' ? t('acct.workshopWideLocker') : t('acct.workshopWide'));
            return {
                id: a.id,
                label: `${a.name} — SAR ${fmt(a.balance)}`,
                subtitle: `${kindLabel} · ${branchLabel}`,
                searchText: [a.name, kindLabel, branchLabel].filter(Boolean).join(' '),
            };
        }),
        [cashAccounts, t],
    );

    const budgetOptions = useMemo(
        () => budgetAccounts.map((a) => ({
            id: String(a.id),
            label: `${a.name} — ${t('acct.remainingSar', { amount: fmt(a.remainingBalance) })}`,
            subtitle: a.scopeType === 'platform_hq'
                ? t('acct.hqBudget')
                : `${a.workshopName || t('budget.workshop')}${a.branchName ? ` · ${a.branchName}` : ''}`,
            searchText: a.name,
        })),
        [budgetAccounts, t],
    );

    const selectedCash = cashAccounts.find((a) => String(a.id) === String(sourceAccountId)) || null;
    const selectedBudget = budgetAccounts.find((a) => String(a.id) === String(budgetAccountId)) || null;

    const registerShort = Boolean(
        needsPayFromAccount && selectedCash && amt > 0 && selectedCash.balance < amt,
    );
    const budgetShort = Boolean(
        isExpense && selectedBudget && amt > 0
        && Number(selectedBudget.remainingBalance ?? 0) < amt,
    );

    let blockReason = '';
    if (walletError) {
        blockReason = walletError;
    } else if (isExpense && walletLoading) {
        blockReason = t('acct.blockLoadingWallet');
    } else if (!loading && !loadError) {
        if (needsPayFromAccount && cashAccounts.length === 0) {
            blockReason = t('acct.blockNoPay');
        } else if (showBudget && budgetAccounts.length === 0) {
            blockReason = t('acct.blockNoBudget');
        } else if (needsPayFromAccount && !sourceAccountId) {
            blockReason = t('acct.blockSelectPay');
        } else if (showBudget && !budgetAccountId) {
            blockReason = t('acct.blockSelectBudget');
        } else if (registerShort) {
            blockReason = t('acct.blockRegisterShort', {
                name: selectedCash.name,
                balance: fmt(selectedCash.balance),
                amount: fmt(amt),
            });
        } else if (budgetShort) {
            blockReason = t('acct.blockBudgetShort', {
                name: selectedBudget.name,
                remaining: fmt(selectedBudget.remainingBalance),
                amount: fmt(amt),
            });
        }
    } else if (loadError) {
        blockReason = loadError;
    }

    const blocked = loading || walletLoading || Boolean(loadError) || Boolean(blockReason);

    const paymentSource = isExpense
        ? (walletCoversExpense ? 'wallet' : 'cash_register')
        : 'cash_register';

    useEffect(() => {
        onChange?.({
            sourceAccountId: needsPayFromAccount ? sourceAccountId : '',
            sourceAccountName: needsPayFromAccount ? (selectedCash?.name || '') : '',
            budgetAccountId: showBudget ? budgetAccountId : '',
            budgetAccountName: showBudget ? (selectedBudget?.name || '') : '',
            paymentSource,
            requesterWalletBalance,
            walletCoversExpense,
            requesterUserId: resolvedRequesterUserId || requesterUserId,
            loading: loading || walletLoading,
            blocked,
            blockReason: loadError || walletError || blockReason,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        sourceAccountId,
        budgetAccountId,
        loading,
        walletLoading,
        blocked,
        blockReason,
        loadError,
        walletError,
        needsPayFromAccount,
        paymentSource,
        requesterWalletBalance,
        walletCoversExpense,
    ]);

    return (
        <div className="wallet-approval-account-fields">
            {isExpense && (requesterUserId || expenseRequestId) ? (
                <div
                    style={{
                        marginBottom: 14,
                        padding: '12px 14px',
                        borderRadius: 10,
                        background: walletCoversExpense ? '#f0fdf4' : '#fffbeb',
                        border: `1px solid ${walletCoversExpense ? '#bbf7d0' : '#fde68a'}`,
                    }}
                >
                    <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        {t('acct.requesterWallet')}
                    </p>
                    <p style={{ margin: '6px 0 0', fontSize: '0.875rem', color: '#0f172a' }}>
                        <strong>{displayRequesterName}</strong>
                        {' · '}
                        {walletLoading ? (
                            <span style={{ color: '#64748b' }}>{t('acct.loadingBalance')}</span>
                        ) : walletError ? (
                            <span style={{ color: '#b91c1c' }}>{walletError}</span>
                        ) : (
                            <>
                                {t('acct.balance')} <strong>SAR {fmt(requesterWalletBalance)}</strong>
                                {amt > 0 ? (
                                    <>
                                        {' '}
                                        · {t('acct.expense')} <strong>SAR {fmt(amt)}</strong>
                                    </>
                                ) : null}
                            </>
                        )}
                    </p>
                    {!walletLoading && !walletError && requesterWalletBalance != null ? (
                        <p style={{ margin: '8px 0 0', fontSize: '0.8125rem', color: walletCoversExpense ? '#15803d' : '#b45309' }}>
                            {walletCoversExpense
                                ? t('acct.walletOk')
                                : t('acct.walletShort')}
                        </p>
                    ) : null}
                </div>
            ) : null}

            {needsPayFromAccount ? (
                <>
                    <label className="approval-modal-label">
                        {t('acct.payFrom')} <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    {loading ? (
                        <p style={{ fontSize: '0.875rem', color: '#64748b' }}>
                            <Loader2 size={14} className="spin" /> {t('acct.loadingAccounts')}
                        </p>
                    ) : loadError ? (
                        <p style={{ color: '#b91c1c', fontSize: '0.875rem' }}>{loadError}</p>
                    ) : (
                        <>
                            <SearchableEntityCombobox
                                options={cashOptions}
                                value={sourceAccountId}
                                displayText={sourceText}
                                onDisplayTextChange={setSourceText}
                                onSelect={(opt) => { setSourceAccountId(opt.id); setSourceText(''); }}
                                placeholder={t('acct.searchPay')}
                                entityLabel="account"
                                disabled={busy}
                            />
                            {selectedCash ? (
                                <p style={{ margin: '6px 0 0', fontSize: '0.8125rem', color: registerShort ? '#b91c1c' : '#64748b' }}>
                                    {t('acct.closingBalance')} <strong>SAR {fmt(selectedCash.balance)}</strong>
                                </p>
                            ) : null}
                        </>
                    )}
                </>
            ) : null}

            {showBudget ? (
                <>
                    <label className="approval-modal-label" style={{ marginTop: needsPayFromAccount ? 14 : 0 }}>
                        {t('acct.budgetAccount')} <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    {loading ? (
                        <p style={{ fontSize: '0.875rem', color: '#64748b' }}>
                            <Loader2 size={14} className="spin" /> {t('acct.loadingBudgets')}
                        </p>
                    ) : loadError ? null : (
                        <>
                            <SearchableEntityCombobox
                                options={budgetOptions}
                                value={budgetAccountId}
                                displayText={budgetText}
                                onDisplayTextChange={setBudgetText}
                                onSelect={(opt) => { setBudgetAccountId(opt.id); setBudgetText(''); }}
                                placeholder={t('acct.searchBudget')}
                                entityLabel="budget"
                                disabled={busy}
                            />
                            {selectedBudget ? (
                                <p style={{ margin: '6px 0 0', fontSize: '0.8125rem', color: budgetShort ? '#b91c1c' : '#15803d' }}>
                                    {t('acct.remainingBudget')} <strong>SAR {fmt(selectedBudget.remainingBalance)}</strong>
                                </p>
                            ) : null}
                        </>
                    )}
                </>
            ) : null}
        </div>
    );
}
