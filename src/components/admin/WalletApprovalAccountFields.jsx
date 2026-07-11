import React, { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import SearchableEntityCombobox from '../SearchableEntityCombobox';
import {
    getRequesterWalletBalance,
    listAdminWalletCashAccounts,
} from '../../services/adminWalletApi';
import { listBudgetWalletAccountsForApproval } from '../../services/budgetWalletApi';
import { details as fetchApprovalExpenseDetails } from '../../services/approvalsApi';

function fmt(value) {
    const n = Number(value ?? 0);
    return (Number.isFinite(n) ? n : 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function accountKindLabel(kind, type) {
    switch (kind) {
        case 'SYSTEM_LOCKER_VAULT':
            return 'Locker vault';
        case 'SYSTEM_CASHIER_TILL':
            return 'Cashier till';
        case 'SYSTEM_PETTY_CASH_WALLET':
            return 'Petty cash';
        default:
            return String(type || '').toUpperCase() === 'BANK' ? 'Bank account' : 'Cash register';
    }
}

function normalizeCash(res) {
    const list = Array.isArray(res?.accounts)
        ? res.accounts
        : Array.isArray(res?.cashAccounts)
            ? res.cashAccounts
            : [];
    return list.map((a) => ({
        id: String(a.id),
        name: a.name || a.accountName || `Account ${a.id}`,
        balance: Number(a.currentBalance ?? a.balance ?? 0),
        branchId: a.branchId != null ? String(a.branchId) : '',
        branchName: a.branchName || a.branch?.name || '',
        kind: a.kind || '',
        kindLabel: a.kindLabel || accountKindLabel(a.kind, a.type),
        type: a.type || '',
    }));
}

function defaultLoadCash({ workshopId }) {
    return listAdminWalletCashAccounts(
        workshopId ? { workshopId } : {},
    ).then(normalizeCash);
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
    loadCashAccounts = defaultLoadCash,
    loadBudgetAccounts = defaultLoadBudgets,
    loadRequesterWalletBalance = defaultLoadRequesterWallet,
    loadExpenseApprovalContext = defaultLoadExpenseApprovalContext,
}) {
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
    const displayRequesterName = requesterName || resolvedRequesterName || 'Requester';

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
                : Promise.reject(new Error('Could not identify the expense requester'));

        loadPromise
            .then(applyWalletResult)
            .catch((err) => {
                if (!cancelled) {
                    setWalletError(err?.message || 'Could not load requester wallet balance');
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
    ]);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setLoadError('');
        setSourceAccountId('');
        setBudgetAccountId('');
        const loaders = [
            needsPayFromAccount || mode === 'fund'
                ? loadCashAccounts({ workshopId, branchId })
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
                if (!cancelled) setLoadError(err?.message || 'Failed to load accounts');
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
        loadCashAccounts,
        loadBudgetAccounts,
    ]);

    const cashOptions = useMemo(
        () => cashAccounts.map((a) => {
            const kindLabel = a.kindLabel || accountKindLabel(a.kind, a.type);
            const branchLabel = a.branchName
                || (a.kind === 'SYSTEM_LOCKER_VAULT' ? 'Workshop-wide locker' : 'Workshop-wide');
            return {
                id: a.id,
                label: `${a.name} — SAR ${fmt(a.balance)}`,
                subtitle: `${kindLabel} · ${branchLabel}`,
                searchText: [a.name, kindLabel, branchLabel].filter(Boolean).join(' '),
            };
        }),
        [cashAccounts],
    );

    const budgetOptions = useMemo(
        () => budgetAccounts.map((a) => ({
            id: String(a.id),
            label: `${a.name} — Remaining SAR ${fmt(a.remainingBalance)}`,
            subtitle: a.scopeType === 'platform_hq'
                ? 'Platform HQ budget'
                : `${a.workshopName || 'Workshop'}${a.branchName ? ` · ${a.branchName}` : ''}`,
            searchText: a.name,
        })),
        [budgetAccounts],
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
        blockReason = 'Loading requester wallet balance…';
    } else if (!loading && !loadError) {
        if (needsPayFromAccount && cashAccounts.length === 0) {
            blockReason = 'No payment accounts found for this entity.';
        } else if (showBudget && budgetAccounts.length === 0) {
            blockReason = 'No budget accounts found. Create one in Admin Wallets → Budget Wallet first.';
        } else if (needsPayFromAccount && !sourceAccountId) {
            blockReason = 'Select a payment account.';
        } else if (showBudget && !budgetAccountId) {
            blockReason = 'Select a budget account.';
        } else if (registerShort) {
            blockReason = `Insufficient balance in ${selectedCash.name} (SAR ${fmt(selectedCash.balance)}) for SAR ${fmt(amt)}.`;
        } else if (budgetShort) {
            blockReason = `Budget "${selectedBudget.name}" has only SAR ${fmt(selectedBudget.remainingBalance)} remaining for SAR ${fmt(amt)}.`;
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
                        Requester wallet
                    </p>
                    <p style={{ margin: '6px 0 0', fontSize: '0.875rem', color: '#0f172a' }}>
                        <strong>{displayRequesterName}</strong>
                        {' · '}
                        {walletLoading ? (
                            <span style={{ color: '#64748b' }}>Loading balance…</span>
                        ) : walletError ? (
                            <span style={{ color: '#b91c1c' }}>{walletError}</span>
                        ) : (
                            <>
                                Balance <strong>SAR {fmt(requesterWalletBalance)}</strong>
                                {amt > 0 ? (
                                    <>
                                        {' '}
                                        · Expense <strong>SAR {fmt(amt)}</strong>
                                    </>
                                ) : null}
                            </>
                        )}
                    </p>
                    {!walletLoading && !walletError && requesterWalletBalance != null ? (
                        <p style={{ margin: '8px 0 0', fontSize: '0.8125rem', color: walletCoversExpense ? '#15803d' : '#b45309' }}>
                            {walletCoversExpense
                                ? 'Wallet balance is sufficient — expense will be deducted from the requester wallet.'
                                : 'Wallet balance is insufficient — select a payment account below to pay from cash / bank / locker.'}
                        </p>
                    ) : null}
                </div>
            ) : null}

            {needsPayFromAccount ? (
                <>
                    <label className="approval-modal-label">
                        Pay from account <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    {loading ? (
                        <p style={{ fontSize: '0.875rem', color: '#64748b' }}>
                            <Loader2 size={14} className="spin" /> Loading accounts…
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
                                placeholder="Search Bank / Cash / Locker…"
                                entityLabel="account"
                                disabled={busy}
                            />
                            {selectedCash ? (
                                <p style={{ margin: '6px 0 0', fontSize: '0.8125rem', color: registerShort ? '#b91c1c' : '#64748b' }}>
                                    Closing balance: <strong>SAR {fmt(selectedCash.balance)}</strong>
                                </p>
                            ) : null}
                        </>
                    )}
                </>
            ) : null}

            {showBudget ? (
                <>
                    <label className="approval-modal-label" style={{ marginTop: needsPayFromAccount ? 14 : 0 }}>
                        Budget account <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    {loading ? (
                        <p style={{ fontSize: '0.875rem', color: '#64748b' }}>
                            <Loader2 size={14} className="spin" /> Loading budget accounts…
                        </p>
                    ) : loadError ? null : (
                        <>
                            <SearchableEntityCombobox
                                options={budgetOptions}
                                value={budgetAccountId}
                                displayText={budgetText}
                                onDisplayTextChange={setBudgetText}
                                onSelect={(opt) => { setBudgetAccountId(opt.id); setBudgetText(''); }}
                                placeholder="Search budget account…"
                                entityLabel="budget"
                                disabled={busy}
                            />
                            {selectedBudget ? (
                                <p style={{ margin: '6px 0 0', fontSize: '0.8125rem', color: budgetShort ? '#b91c1c' : '#15803d' }}>
                                    Remaining budget: <strong>SAR {fmt(selectedBudget.remainingBalance)}</strong>
                                </p>
                            ) : null}
                        </>
                    )}
                </>
            ) : null}
        </div>
    );
}
