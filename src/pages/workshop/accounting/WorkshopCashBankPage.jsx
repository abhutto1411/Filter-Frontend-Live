import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useNavigate, useSearchParams, useOutletContext } from 'react-router-dom';
import { Plus, RefreshCw, BookOpen, Search } from 'lucide-react';
import CashBankRegisterPanel from '../../../components/accounting/CashBankRegisterPanel';
import SearchableEntityCombobox from '../../../components/SearchableEntityCombobox';
import { PaginationControls } from '../../../components/PaginationControls';
import { accT } from '../../../utils/accountingI18n';
import { useAuth } from '../../../context/AuthContext';
import AllowNegativeBalanceToggle from '../../../components/accounting/AllowNegativeBalanceToggle';
import {
    listWorkshopCashBankAccounts,
    createWorkshopCashBankAccount,
    updateWorkshopCashBankAccount,
    listWorkshopCashBankPosTerminals,
    adjustWorkshopCashBankAmount,
    setWorkshopAllowNegativeBalance,
} from '../../../services/workshopStaffApi';
import { useHqAdminBooksScope } from '../../../hooks/useHqAdminBooksScope';
import {
    uiCashBankTypeToApi,
    normalizeWorkshopCashBankRow,
    todayIsoDate,
} from './workshopAccountingShared';
import {
    buildCashBankSummaryCards,
    cashBankBalanceSourceChip,
    cashBankRegisterClass,
    cashBankRegisterClassLabelKey,
    hasOtherRegisterClass,
    CASH_BANK_PAGE_SIZE,
    displayCashBankBalance,
    filterCashBankAccounts,
    pageCashBankRows,
    sharedCoaPeerNames,
    shouldShowUnreconciledCard,
} from '../../../utils/cashBankScreen';
import SelectCombo from '../../../components/SelectCombo';
import WorkshopCashBankReconcilePanel from './WorkshopCashBankReconcilePanel';
import '../../../styles/admin/AccountingPage.css';

/** Portal "All Branches" / empty → no branch filter. */
function layoutBranchId(selectedBranchId) {
    const raw = String(selectedBranchId ?? '').trim();
    if (!raw || raw.toLowerCase() === 'all') return '';
    return raw;
}

function formatSar2(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return '0.00';
    return x.toLocaleString('en-SA', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function BalanceSourceChip({ source, sharedHint, t }) {
    const chip = cashBankBalanceSourceChip(source);
    if (!chip) return null;
    if (chip === 'gl') {
        return (
            <span
                className="cash-bank-source-chip"
                style={{
                    marginInlineStart: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#2563eb',
                    background: '#eff6ff',
                    borderRadius: 4,
                    padding: '1px 6px',
                }}
            >
                {t('cb.chip.fromLedger')}
            </span>
        );
    }
    return (
        <span
            className="cash-bank-source-chip cash-bank-source-chip--shared"
            title={sharedHint || undefined}
            style={{
                marginInlineStart: 6,
                fontSize: 11,
                fontWeight: 700,
                color: '#b45309',
                background: '#fffbeb',
                borderRadius: 4,
                padding: '1px 6px',
            }}
        >
            {t('cb.chip.sharedAccount')}
        </span>
    );
}

export default function WorkshopCashBankPage({
    branches = [],
    selectedBranchId = 'all',
}) {
    const { isAdminHqBooks } = useHqAdminBooksScope();
    const { hasPermission, user } = useAuth();
    const outletCtx = useOutletContext() || {};
    const locale =
        outletCtx.locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => accT(locale, key, vars), [locale]);
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const canManage =
        isAdminHqBooks ||
        hasPermission('workshop.accounting.cash-bank.view') ||
        hasPermission('accounting.cash-bank.view');

    const canReconView =
        hasPermission('workshop.accounting.cash-bank.reconcile.view') ||
        hasPermission('accounting.cash-bank.reconcile.view');
    const canReconManage =
        hasPermission('workshop.accounting.cash-bank.reconcile.manage') ||
        hasPermission('accounting.cash-bank.reconcile.manage');

    const registerTypeParam = String(searchParams.get('registerType') || '').toUpperCase();
    const coaAccountIdParam = searchParams.get('coaAccountId') || '';
    const registerDrill =
        coaAccountIdParam && ['CASH', 'BANK', 'PETTY_CASH'].includes(registerTypeParam)
            ? { registerType: registerTypeParam, coaAccountId: coaAccountIdParam }
            : null;

    const closeRegisterDrill = useCallback(() => {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.delete('registerType');
            next.delete('coaAccountId');
            next.delete('dateFrom');
            next.delete('dateTo');
            next.delete('branchId');
            return next;
        }, { replace: true });
    }, [setSearchParams]);

    const openRegister = useCallback(
        (account) => {
            const coaId = account?.coaAccountId;
            const type = String(account?.apiType || '').toUpperCase();
            if (!coaId || !['CASH', 'BANK', 'PETTY_CASH'].includes(type)) return;
            setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.set('registerType', type);
                next.set('coaAccountId', String(coaId));
                if (account.branchId) next.set('branchId', String(account.branchId));
                else next.delete('branchId');
                return next;
            });
        },
        [setSearchParams],
    );

    const [mainTab, setMainTab] = useState('accounts');
    const [reconcileBankId, setReconcileBankId] = useState('');
    const [accounts, setAccounts] = useState([]);
    const [accountsLoading, setAccountsLoading] = useState(false);
    const [accountsError, setAccountsError] = useState('');
    const [listMeta, setListMeta] = useState({});

    const [draftSearch, setDraftSearch] = useState('');
    const [draftType, setDraftType] = useState('ALL');
    const [draftBranchId, setDraftBranchId] = useState(() => layoutBranchId(selectedBranchId));
    const [appliedFilters, setAppliedFilters] = useState(() => ({
        search: '',
        type: 'ALL',
        branchId: layoutBranchId(selectedBranchId),
    }));
    const [page, setPage] = useState(1);

    /** HQ books: no reconcile routes today — Accounts only, no Reconcile tab/placeholder. */
    const showReconcileUi = !isAdminHqBooks;

    const [saveError, setSaveError] = useState('');
    const [saving, setSaving] = useState(false);
    const [newPanelOpen, setNewPanelOpen] = useState(false);
    const [cashBankOpeningBalanceDate, setCashBankOpeningBalanceDate] = useState(() => todayIsoDate());
    const [newAccountName, setNewAccountName] = useState('');
    const [newAccountType, setNewAccountType] = useState('Cash');
    const [newAccountBranchId, setNewAccountBranchId] = useState('');
    const [newAccountOpeningBalance, setNewAccountOpeningBalance] = useState('0');
    const [newAccountStatus, setNewAccountStatus] = useState('active');
    const [newPosTerminalId, setNewPosTerminalId] = useState('');
    const [posTerminals, setPosTerminals] = useState([]);

    const [expandedEditId, setExpandedEditId] = useState('');
    const [editForm, setEditForm] = useState(null);

    const [adjustAccountId, setAdjustAccountId] = useState('');
    const [adjustAmount, setAdjustAmount] = useState('');
    const [adjustDate, setAdjustDate] = useState(() => todayIsoDate());
    const [adjustReason, setAdjustReason] = useState('');
    const [adjustError, setAdjustError] = useState('');
    const [adjustSubmitting, setAdjustSubmitting] = useState(false);

    const [reconBankDisplay, setReconBankDisplay] = useState('');
    const reconWantsClearOnBlurRef = useRef(false);

    const scopeBranchId = layoutBranchId(selectedBranchId);

    useEffect(() => {
        setDraftBranchId(layoutBranchId(selectedBranchId));
        setAppliedFilters((prev) => ({
            ...prev,
            branchId: layoutBranchId(selectedBranchId),
        }));
        setPage(1);
    }, [selectedBranchId]);

    useEffect(() => {
        if (!showReconcileUi && mainTab !== 'accounts') {
            setMainTab('accounts');
            setReconcileBankId('');
            setReconBankDisplay('');
        }
    }, [showReconcileUi, mainTab]);

    const loadAccounts = useCallback(async () => {
        setAccountsLoading(true);
        setAccountsError('');
        try {
            const res = await listWorkshopCashBankAccounts(
                scopeBranchId ? { branchId: scopeBranchId } : {},
            );
            const list = Array.isArray(res?.accounts)
                ? res.accounts
                : Array.isArray(res?.data?.accounts)
                  ? res.data.accounts
                  : [];
            const normalized = list.map((raw) => {
                const row = normalizeWorkshopCashBankRow(raw);
                if (raw?.unreconciledCount != null && Number.isFinite(Number(raw.unreconciledCount))) {
                    row.unreconciledCount = Number(raw.unreconciledCount);
                }
                return row;
            });
            // API already scopes to the layout branch and includes workshop-shared
            // registers (null branchId). Do not drop those shared cash/bank rows.
            setAccounts(normalized);
            setListMeta({
                unreconciledCount:
                    res?.unreconciledCount ??
                    res?.data?.unreconciledCount ??
                    res?.summary?.unreconciledCount,
            });
        } catch (e) {
            setAccounts([]);
            setAccountsError(e?.message || t('cb.err.load'));
        } finally {
            setAccountsLoading(false);
        }
    }, [scopeBranchId, t]);

    const loadPosTerminals = useCallback(async () => {
        try {
            const res = await listWorkshopCashBankPosTerminals();
            const list = Array.isArray(res?.terminals)
                ? res.terminals
                : Array.isArray(res?.data?.terminals)
                  ? res.data.terminals
                  : [];
            setPosTerminals(list);
        } catch {
            setPosTerminals([]);
        }
    }, []);

    useEffect(() => {
        loadAccounts();
    }, [loadAccounts]);

    useEffect(() => {
        loadPosTerminals();
    }, [loadPosTerminals]);

    useEffect(() => {
        if (!newPosTerminalId) return;
        const ok = posTerminals.some(
            (term) =>
                String(term.branchId) === String(newAccountBranchId) &&
                String(term.id) === String(newPosTerminalId),
        );
        if (!ok) setNewPosTerminalId('');
    }, [newAccountBranchId, newPosTerminalId, posTerminals]);

    const terminalsForSelectedNewBranch = useMemo(
        () => posTerminals.filter((term) => String(term.branchId) === String(newAccountBranchId)),
        [posTerminals, newAccountBranchId],
    );

    const filteredAccounts = useMemo(
        () => filterCashBankAccounts(accounts, appliedFilters),
        [accounts, appliedFilters],
    );

    const paged = useMemo(
        () => pageCashBankRows(filteredAccounts, { page, pageSize: CASH_BANK_PAGE_SIZE }),
        [filteredAccounts, page],
    );

    const summaryCards = useMemo(
        () => buildCashBankSummaryCards(filteredAccounts),
        [filteredAccounts],
    );

    const showOtherTypeOption = useMemo(
        () => hasOtherRegisterClass(accounts),
        [accounts],
    );

    const bankOptionsForReconcile = useMemo(() => {
        const banks = filteredAccounts.filter(
            (a) => cashBankRegisterClass(a) === 'BANK',
        );
        return banks.map((a) => ({
            id: a.id,
            label: `${a.name}${a.branch ? ` · ${a.branch}` : ''}`,
            searchText: `${a.name} ${a.branch || ''} ${a.coaLink || ''}`,
        }));
    }, [filteredAccounts]);

    const reconcileBank = useMemo(
        () =>
            filteredAccounts.find(
                (a) => a.id === reconcileBankId && cashBankRegisterClass(a) === 'BANK',
            ) ||
            accounts.find(
                (a) => a.id === reconcileBankId && cashBankRegisterClass(a) === 'BANK',
            ) ||
            null,
        [filteredAccounts, accounts, reconcileBankId],
    );

    const clearReconcileBank = useCallback(() => {
        reconWantsClearOnBlurRef.current = false;
        setReconcileBankId('');
        setReconBankDisplay('');
    }, []);

    const onReconBankDisplayChange = useCallback(
        (v) => {
            const next = v ?? '';
            const prev = reconBankDisplay;
            setReconBankDisplay(next);
            if (reconcileBankId && String(prev).trim() !== '' && String(next).trim() === '') {
                // User deleted search text while focused (not combobox blur reset).
                const active = document.activeElement;
                if (active && String(active.tagName || '').toUpperCase() === 'INPUT') {
                    reconWantsClearOnBlurRef.current = true;
                }
            } else if (String(next).trim() !== '') {
                reconWantsClearOnBlurRef.current = false;
            }
        },
        [reconBankDisplay, reconcileBankId],
    );

    useEffect(() => {
        if (!reconcileBankId) return;
        const inFiltered = bankOptionsForReconcile.some((o) => o.id === reconcileBankId);
        if (inFiltered) return;
        // Keep only if still present in the full loaded list; else clear.
        const inFull = accounts.some(
            (a) => a.id === reconcileBankId && cashBankRegisterClass(a) === 'BANK',
        );
        if (!inFull) clearReconcileBank();
    }, [bankOptionsForReconcile, reconcileBankId, accounts, clearReconcileBank]);

    const applyFilters = () => {
        setAppliedFilters({
            search: draftSearch,
            type: draftType || 'ALL',
            branchId: draftBranchId,
        });
        setPage(1);
        loadAccounts();
    };

    const showAllFilters = () => {
        const branchDefault = layoutBranchId(selectedBranchId);
        setDraftSearch('');
        setDraftType('ALL');
        setDraftBranchId(branchDefault);
        setAppliedFilters({ search: '', type: 'ALL', branchId: branchDefault });
        setPage(1);
        loadAccounts();
    };

    const closeNewPanel = () => {
        setNewPanelOpen(false);
        setSaveError('');
        setCashBankOpeningBalanceDate(todayIsoDate());
        setNewAccountName('');
        setNewAccountType('Cash');
        setNewAccountBranchId('');
        setNewAccountOpeningBalance('0');
        setNewAccountStatus('active');
        setNewPosTerminalId('');
    };

    const openNewPanel = () => {
        if (!canManage) return;
        if (isAdminHqBooks) {
            navigate('/admin/accounting/cash-bank/new');
            return;
        }
        setSaveError('');
        setNewPosTerminalId('');
        setExpandedEditId('');
        setAdjustAccountId('');
        setNewPanelOpen(true);
    };

    const openEditRow = (account) => {
        if (!canManage || account.isSystem) return;
        if (isAdminHqBooks) {
            navigate(`/admin/accounting/cash-bank/${encodeURIComponent(account.id)}/edit`);
            return;
        }
        setNewPanelOpen(false);
        setAdjustAccountId('');
        setExpandedEditId(account.id);
        setEditForm({
            id: account.id,
            name: account.name,
            type: account.type,
            branchId: account.branchId || '',
            status: account.status || 'active',
            posTerminalId: account.posTerminalId || '',
            coaLink: account.coaLink,
        });
        setSaveError('');
    };

    const closeEditRow = () => {
        setExpandedEditId('');
        setEditForm(null);
        setSaveError('');
    };

    const openAdjustPanel = (account) => {
        if (!canManage || account.isSystem) return;
        setNewPanelOpen(false);
        setExpandedEditId('');
        setAdjustError('');
        setAdjustAmount('');
        setAdjustDate(todayIsoDate());
        setAdjustReason('');
        setAdjustAccountId(account.id);
    };

    const closeAdjustPanel = () => {
        setAdjustAccountId('');
        setAdjustAmount('');
        setAdjustDate(todayIsoDate());
        setAdjustReason('');
        setAdjustError('');
        setAdjustSubmitting(false);
    };

    const adjustAccount = useMemo(
        () => accounts.find((a) => a.id === adjustAccountId) || null,
        [accounts, adjustAccountId],
    );

    const adjustPreview = useMemo(() => {
        const current = displayCashBankBalance(adjustAccount);
        const delta = Number(adjustAmount);
        if (
            !Number.isFinite(delta) ||
            adjustAmount === '' ||
            adjustAmount === '-' ||
            adjustAmount === '+'
        ) {
            return { current, delta: null, next: current };
        }
        return { current, delta, next: current + delta };
    }, [adjustAccount, adjustAmount]);

    const handleAdjust = async () => {
        if (!adjustAccount) return;
        setAdjustError('');
        if (!adjustAccount.coaAccountId) {
            setAdjustError(t('cb.adjust.err.coa'));
            return;
        }
        const delta = Number(adjustAmount);
        if (!Number.isFinite(delta) || delta === 0) {
            setAdjustError(t('cb.adjust.err.amount'));
            return;
        }
        if (adjustPreview.next < 0) {
            setAdjustError(t('cb.adjust.err.negative'));
            return;
        }
        const reason = adjustReason.trim();
        if (!reason) {
            setAdjustError(t('cb.adjust.err.reason'));
            return;
        }
        setAdjustSubmitting(true);
        try {
            await adjustWorkshopCashBankAmount(adjustAccount.id, {
                amount: delta,
                entryDate: adjustDate,
                reason,
            });
            closeAdjustPanel();
            await loadAccounts();
        } catch (e) {
            setAdjustError(e?.message || t('cb.adjust.err.failed'));
        } finally {
            setAdjustSubmitting(false);
        }
    };

    const handleSaveNew = async () => {
        setSaveError('');
        const name = newAccountName.trim();
        if (!name) {
            setSaveError(t('cb.err.name'));
            return;
        }
        if (!newAccountBranchId) {
            setSaveError(t('cb.err.branch'));
            return;
        }
        setSaving(true);
        try {
            const body = {
                name,
                type: uiCashBankTypeToApi(newAccountType),
                branchId: newAccountBranchId,
                openingBalance: Number(newAccountOpeningBalance) || 0,
                status: newAccountStatus,
            };
            if (newPosTerminalId) body.posTerminalId = newPosTerminalId;
            await createWorkshopCashBankAccount(body);
            closeNewPanel();
            await loadAccounts();
        } catch (e) {
            setSaveError(e?.message || t('cb.err.create'));
        } finally {
            setSaving(false);
        }
    };

    const handleSaveEdit = async () => {
        if (!editForm?.id) return;
        setSaveError('');
        const name = String(editForm.name || '').trim();
        if (!name) {
            setSaveError(t('cb.err.name'));
            return;
        }
        setSaving(true);
        try {
            const body = {
                name,
                type: uiCashBankTypeToApi(editForm.type),
                status: editForm.status,
            };
            if (editForm.branchId) body.branchId = editForm.branchId;
            if (editForm.posTerminalId) body.posTerminalId = editForm.posTerminalId;
            else body.posTerminalId = null;
            await updateWorkshopCashBankAccount(editForm.id, body);
            closeEditRow();
            await loadAccounts();
        } catch (e) {
            setSaveError(e?.message || t('cb.err.save'));
        } finally {
            setSaving(false);
        }
    };

    const openReconcile = (account) => {
        if (cashBankRegisterClass(account) !== 'BANK') return;
        setReconcileBankId(account.id);
        setReconBankDisplay('');
        setMainTab('reconcile');
    };

    const branchOptions = useMemo(
        () =>
            (branches || []).map((b) => ({
                id: String(b.id),
                label: b.name || String(b.id),
            })),
        [branches],
    );

    if (registerDrill) {
        return (
            <CashBankRegisterPanel
                registerType={registerDrill.registerType}
                initialCoaAccountId={registerDrill.coaAccountId}
                onClose={closeRegisterDrill}
                locale={locale}
            />
        );
    }

    const renderInlineConfirmBar = ({ onConfirm, onCancel, confirmLabel, busy }) => (
        <div
            style={{
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
                marginTop: 12,
                paddingTop: 12,
                borderTop: '1px solid #e5e7eb',
            }}
        >
            <button
                type="button"
                className="btn-submit btn-dark"
                onClick={onConfirm}
                disabled={busy}
            >
                {confirmLabel}
            </button>
            <button
                type="button"
                className="btn-portal-outline"
                onClick={onCancel}
                disabled={busy}
            >
                {t('cb.modal.cancel')}
            </button>
        </div>
    );

    return (
        <div className="cash-bank-view">
            <header className="cash-bank-header">
                <p
                    style={{
                        margin: 0,
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#6b7280',
                        letterSpacing: 0.3,
                    }}
                >
                    {t('cb.breadcrumb')}
                </p>
                <h2 className="cash-bank-title">{t('cb.title')}</h2>
                <p className="cash-bank-desc">
                    {isAdminHqBooks ? t('cb.desc.hq') : t('cb.desc.ws')}
                </p>
                <p style={{ margin: '8px 0 0', fontSize: 13 }}>
                    <Link to="/workshop/accounting/cash-bank/pending">
                        {locale === 'ar' ? 'مسودات بانتظار الترحيل' : 'Saved / pending post'}
                    </Link>
                </p>
            </header>

            {accountsError ? null : accountsLoading ? (
                <div
                    className="acct-kpi-grid"
                    aria-busy="true"
                    aria-label={t('cb.loading')}
                >
                    {[1, 2, 3].map((k) => (
                        <div
                            key={k}
                            className="acct-kpi-card"
                            style={{ opacity: 0.45 }}
                        >
                            <p className="acct-kpi-label">…</p>
                            <p className="acct-kpi-value">—</p>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="acct-kpi-grid">
                    {summaryCards.map((card) => {
                        const classLabel = t(
                            cashBankRegisterClassLabelKey(card.registerClass),
                        );
                        const amount = `SAR ${formatSar2(card.balance)}`;
                        if (card.kind === 'total') {
                            return (
                                <div key={card.key} className="acct-kpi-card">
                                    <p className="acct-kpi-label" title={classLabel}>{classLabel}</p>
                                    <p
                                        className="acct-kpi-value"
                                        title={amount}
                                        style={card.negative ? { color: '#dc2626' } : undefined}
                                    >
                                        {amount}
                                    </p>
                                    <p className="acct-kpi-meta">
                                        {t('cb.stat.accounts', { n: card.accountCount })}
                                    </p>
                                </div>
                            );
                        }
                        return (
                            <div key={card.key} className="acct-kpi-card">
                                <p className="acct-kpi-label" title={`${classLabel} · ${card.label}`}>
                                    {classLabel} · {card.label}
                                </p>
                                <p
                                    className="acct-kpi-value"
                                    title={amount}
                                    style={card.negative ? { color: '#dc2626' } : undefined}
                                >
                                    {amount}
                                </p>
                            </div>
                        );
                    })}
                    {showReconcileUi && shouldShowUnreconciledCard(listMeta) ? (
                        <div className="acct-kpi-card">
                            <p className="acct-kpi-label">{t('cb.card.unreconciled')}</p>
                            <p className="acct-kpi-value">
                                {t('cb.card.unreconciledItems', {
                                    n: Number(listMeta.unreconciledCount),
                                })}
                            </p>
                        </div>
                    ) : null}
                </div>
            )}

            {showReconcileUi ? (
            <div
                className="cash-bank-page-tabs"
                role="tablist"
                style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '16px 0' }}
            >
                <button
                    type="button"
                    role="tab"
                    aria-selected={mainTab === 'accounts'}
                    className={`cash-bank-tab ${mainTab === 'accounts' ? 'active' : ''}`}
                    onClick={() => setMainTab('accounts')}
                >
                    {t('cb.pageTab.accounts')}
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={mainTab === 'reconcile'}
                    className={`cash-bank-tab ${mainTab === 'reconcile' ? 'active' : ''}`}
                    onClick={() => setMainTab('reconcile')}
                    title={reconcileBank ? reconcileBank.name : undefined}
                    style={
                        reconcileBank
                            ? {
                                  maxWidth: 260,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                              }
                            : undefined
                    }
                >
                    {reconcileBank
                        ? t('cb.pageTab.reconcileNamed', { name: reconcileBank.name })
                        : t('cb.pageTab.reconcile')}
                </button>
            </div>
            ) : (
                <div style={{ margin: '16px 0 0' }} />
            )}

            {showReconcileUi && mainTab === 'reconcile' ? (
                <section style={{ padding: '8px 0 24px' }} data-testid="cb-reconcile-tab">
                    {!canReconView ? (
                        <p role="status" style={{ color: '#6b7280' }}>
                            {t('cb.recon.noAccess')}
                        </p>
                    ) : bankOptionsForReconcile.length === 0 && !reconcileBank ? (
                        <p role="status" style={{ color: '#6b7280' }}>
                            {t('cb.reconcile.noBankInSelection')}
                        </p>
                    ) : (
                        <>
                            <div
                                style={{ maxWidth: 480, marginBottom: 16 }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Escape' && reconcileBankId) {
                                        e.preventDefault();
                                        clearReconcileBank();
                                    }
                                }}
                                onBlur={(e) => {
                                    if (e.currentTarget.contains(e.relatedTarget)) return;
                                    if (reconWantsClearOnBlurRef.current && reconcileBankId) {
                                        clearReconcileBank();
                                    }
                                }}
                            >
                                <label className="form-label" htmlFor="cb-recon-bank">
                                    {t('cb.reconcile.bankAccount')}
                                </label>
                                <div
                                    style={{
                                        display: 'flex',
                                        gap: 8,
                                        alignItems: 'flex-start',
                                        flexWrap: 'wrap',
                                    }}
                                >
                                    <div style={{ flex: 1, minWidth: 200 }}>
                                        <SearchableEntityCombobox
                                            id="cb-recon-bank"
                                            options={
                                                reconcileBank &&
                                                !bankOptionsForReconcile.some(
                                                    (o) => o.id === reconcileBank.id,
                                                )
                                                    ? [
                                                          {
                                                              id: reconcileBank.id,
                                                              label: `${reconcileBank.name}${
                                                                  reconcileBank.branch
                                                                      ? ` · ${reconcileBank.branch}`
                                                                      : ''
                                                              }`,
                                                          },
                                                          ...bankOptionsForReconcile,
                                                      ]
                                                    : bankOptionsForReconcile
                                            }
                                            value={reconcileBankId}
                                            displayText={reconBankDisplay}
                                            onDisplayTextChange={onReconBankDisplayChange}
                                            onSelect={(opt) => {
                                                reconWantsClearOnBlurRef.current = false;
                                                const nextId = opt?.id ? String(opt.id) : '';
                                                setReconcileBankId(nextId);
                                                setReconBankDisplay('');
                                            }}
                                            placeholder={t('cb.reconcile.bankAccountPh')}
                                            entityLabel="bank"
                                            maxInitial={80}
                                            maxFiltered={120}
                                            menuMinWidth={280}
                                        />
                                    </div>
                                    {reconcileBankId ? (
                                        <button
                                            type="button"
                                            className="btn-portal-outline"
                                            style={{ whiteSpace: 'nowrap' }}
                                            onClick={clearReconcileBank}
                                        >
                                            {t('cb.reconcile.clear')}
                                        </button>
                                    ) : null}
                                </div>
                            </div>
                            <WorkshopCashBankReconcilePanel
                                bank={reconcileBank}
                                accounts={accounts}
                                canView={canReconView}
                                canManage={canReconManage}
                                t={t}
                                onSelectBankId={(id) => {
                                    setReconcileBankId(String(id));
                                    setReconBankDisplay('');
                                }}
                                onAccountsRefresh={loadAccounts}
                            />
                        </>
                    )}
                </section>
            ) : (
                <section style={{ padding: '0 0 24px' }}>
                    <div
                        data-testid="cb-accounts-filter-bar"
                        className="acct-filter-bar"
                    >
                        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
                            <Search
                                size={16}
                                color="#6b7280"
                                style={{
                                    position: 'absolute',
                                    top: '50%',
                                    insetInlineStart: 12,
                                    transform: 'translateY(-50%)',
                                }}
                            />
                            <input
                                value={draftSearch}
                                onChange={(e) => setDraftSearch(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') applyFilters();
                                }}
                                placeholder={t('cb.filter.searchPh')}
                                aria-label={t('cb.filter.search')}
                                style={{
                                    width: '100%',
                                    boxSizing: 'border-box',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: 8,
                                    padding: '8px 12px',
                                    paddingInlineStart: 36,
                                    fontSize: 14,
                                    outline: 'none',
                                }}
                            />
                        </div>
                        <SelectCombo
                            size="sm"
                            value={draftType}
                            onChange={(e) => setDraftType(e.target.value)}
                            aria-label={t('cb.filter.type')}
                            style={{ minWidth: 160 }}
                        >
                            <option value="ALL">{t('cb.type.all')}</option>
                            <option value="CASH_ON_HAND">{t('cb.type.cashOnHand')}</option>
                            <option value="CASHIER_TILL">{t('cb.type.cashierTills')}</option>
                            <option value="PETTY_WALLET">{t('cb.type.pettyWallets')}</option>
                            <option value="LOCKER">{t('cb.type.locker')}</option>
                            <option value="BANK">{t('cb.type.bank')}</option>
                            {showOtherTypeOption ? (
                                <option value="OTHER">{t('cb.type.other')}</option>
                            ) : null}
                        </SelectCombo>
                        {!isAdminHqBooks ? (
                        <SelectCombo
                            size="sm"
                            value={draftBranchId}
                            onChange={(e) => setDraftBranchId(e.target.value)}
                            aria-label={t('cb.filter.branch')}
                            style={{ minWidth: 160 }}
                        >
                            <option value="">{t('cb.filter.allBranches')}</option>
                            {branchOptions.map((b) => (
                                <option key={b.id} value={b.id}>
                                    {b.label}
                                </option>
                            ))}
                        </SelectCombo>
                        ) : null}
                        <button
                            type="button"
                            className="btn-portal-dark"
                            onClick={applyFilters}
                            disabled={accountsLoading}
                            style={{ whiteSpace: 'nowrap' }}
                        >
                            {t('date.apply')}
                        </button>
                        <button
                            type="button"
                            className="btn-portal-outline"
                            onClick={showAllFilters}
                            disabled={accountsLoading}
                            style={{ whiteSpace: 'nowrap' }}
                        >
                            {t('periodClos.filter.showAll')}
                        </button>
                    </div>

                    <div
                        className="cash-bank-actions"
                        style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}
                    >
                        {canManage ? (
                            <button
                                type="button"
                                className="btn-submit btn-dark"
                                onClick={openNewPanel}
                            >
                                <Plus size={16} style={{ marginInlineEnd: 6 }} />
                                {t('cb.newAccount')}
                            </button>
                        ) : null}
                        <button
                            type="button"
                            className="btn-portal-outline"
                            onClick={loadAccounts}
                            disabled={accountsLoading}
                        >
                            <RefreshCw size={14} style={{ marginInlineEnd: 6 }} />
                            {t('cb.refresh')}
                        </button>
                    </div>

                    {newPanelOpen && canManage ? (
                        <div
                            className="acct-panel"
                            style={{ marginBottom: 16 }}
                            data-testid="cb-new-account-panel"
                        >
                            <h3 style={{ margin: '0 0 12px', fontSize: '1.05rem' }}>
                                {t('cb.modal.newTitle')}
                            </h3>
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                                    gap: 12,
                                }}
                            >
                                <label className="coa-range-field">
                                    <span>{t('cb.field.name')}</span>
                                    <input
                                        value={newAccountName}
                                        onChange={(e) => setNewAccountName(e.target.value)}
                                        placeholder={t('cb.field.namePh')}
                                    />
                                </label>
                                <label className="coa-range-field">
                                    <span>{t('cb.field.type')}</span>
                                    <SelectCombo
                                        value={newAccountType}
                                        onChange={(e) => setNewAccountType(e.target.value)}
                                    >
                                        <option value="Cash">{t('cb.tab.cash')}</option>
                                        <option value="Bank">{t('cb.tab.bank')}</option>
                                        <option value="Petty Cash">{t('cb.tab.petty')}</option>
                                    </SelectCombo>
                                </label>
                                <label className="coa-range-field">
                                    <span>{t('cb.field.branch')}</span>
                                    <SelectCombo
                                        value={newAccountBranchId}
                                        onChange={(e) => setNewAccountBranchId(e.target.value)}
                                    >
                                        <option value="">{t('cb.field.selectBranch')}</option>
                                        {branchOptions.map((b) => (
                                            <option key={b.id} value={b.id}>
                                                {b.label}
                                            </option>
                                        ))}
                                    </SelectCombo>
                                </label>
                                <label className="coa-range-field">
                                    <span>{t('cb.field.opening')}</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={newAccountOpeningBalance}
                                        onChange={(e) => setNewAccountOpeningBalance(e.target.value)}
                                    />
                                </label>
                                <label className="coa-range-field">
                                    <span>{t('cb.field.openingDate')}</span>
                                    <input
                                        type="date"
                                        value={cashBankOpeningBalanceDate}
                                        onChange={(e) => setCashBankOpeningBalanceDate(e.target.value)}
                                    />
                                </label>
                                <label className="coa-range-field">
                                    <span>{t('cb.field.status')}</span>
                                    <SelectCombo
                                        value={newAccountStatus}
                                        onChange={(e) => setNewAccountStatus(e.target.value)}
                                    >
                                        <option value="active">{t('cb.status.active')}</option>
                                        <option value="inactive">{t('cb.status.inactive')}</option>
                                    </SelectCombo>
                                </label>
                                {terminalsForSelectedNewBranch.length > 0 ? (
                                    <label className="coa-range-field">
                                        <span>{t('cb.field.softpos')}</span>
                                        <SelectCombo
                                            value={newPosTerminalId}
                                            onChange={(e) => setNewPosTerminalId(e.target.value)}
                                        >
                                            <option value="">{t('cb.field.sharedRegister')}</option>
                                            {terminalsForSelectedNewBranch.map((term) => (
                                                <option key={String(term.id)} value={String(term.id)}>
                                                    {term.label || term.terminalCode || term.id}
                                                </option>
                                            ))}
                                        </SelectCombo>
                                    </label>
                                ) : null}
                            </div>
                            {saveError ? (
                                <p style={{ color: '#dc2626', marginTop: 8 }} role="alert">
                                    {saveError}
                                </p>
                            ) : null}
                            {renderInlineConfirmBar({
                                onConfirm: handleSaveNew,
                                onCancel: closeNewPanel,
                                confirmLabel: saving ? t('cb.modal.creating') : t('cb.modal.create'),
                                busy: saving,
                            })}
                        </div>
                    ) : null}

                    {accountsError ? (
                        <div style={{ marginBottom: 12 }} role="alert">
                            <p style={{ color: '#dc2626' }}>{accountsError}</p>
                            <button type="button" className="btn-portal-outline" onClick={loadAccounts}>
                                {t('cb.retry')}
                            </button>
                        </div>
                    ) : null}

                    {accountsLoading ? (
                        <p>{t('cb.loading')}</p>
                    ) : filteredAccounts.length === 0 ? (
                        <p role="status">{t('cb.emptyFiltered')}</p>
                    ) : (
                        <section className="premium-table cash-bank-table">
                            <table>
                                <thead>
                                    <tr>
                                        <th>{t('cb.th.account')}</th>
                                        <th>{t('cb.th.type')}</th>
                                        <th>{t('cb.th.branch')}</th>
                                        <th>{t('cb.th.balance')}</th>
                                        <th>{t('cb.th.status')}</th>
                                        <th>{t('cb.th.actions')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paged.rows.map((a) => {
                                        const sharedHint = sharedCoaPeerNames(
                                            a.sharedCoaWith,
                                            accounts,
                                        ).join(', ');
                                        const bal = displayCashBankBalance(a);
                                        return (
                                            <React.Fragment key={a.id}>
                                                <tr>
                                                    <td>
                                                        <button
                                                            type="button"
                                                            className="cash-bank-account-link"
                                                            onClick={() => openRegister(a)}
                                                            disabled={!a.coaAccountId}
                                                            title={t('cb.openRegisterHint')}
                                                            style={{
                                                                background: 'none',
                                                                border: 'none',
                                                                padding: 0,
                                                                color: '#2563eb',
                                                                cursor: a.coaAccountId
                                                                    ? 'pointer'
                                                                    : 'default',
                                                                fontWeight: 700,
                                                            }}
                                                        >
                                                            {a.name}
                                                        </button>
                                                        {a.allowNegativeBalance ? (
                                                            <span
                                                                data-testid="cb-neg-chip"
                                                                style={{ marginInlineStart: 6, fontSize: 11, fontWeight: 700, color: '#92400e', background: '#fef3c7', borderRadius: 4, padding: '1px 6px' }}
                                                            >
                                                                {t('cb.neg.chip')}
                                                            </span>
                                                        ) : null}
                                                        {a.isSystem ? (
                                                            <span
                                                                style={{
                                                                    marginInlineStart: 6,
                                                                    fontSize: 11,
                                                                    color: '#6b7280',
                                                                }}
                                                                title={t('cb.systemTitle')}
                                                            >
                                                                {t('cb.system')}
                                                            </span>
                                                        ) : null}
                                                        {showReconcileUi &&
                                                        cashBankRegisterClass(a) === 'BANK' &&
                                                        Number(a.unreconciledCount) > 0 ? (
                                                            <span
                                                                style={{
                                                                    marginInlineStart: 6,
                                                                    fontSize: 11,
                                                                    fontWeight: 700,
                                                                    color: '#b45309',
                                                                    background: '#fffbeb',
                                                                    padding: '1px 6px',
                                                                    borderRadius: 4,
                                                                }}
                                                            >
                                                                {t('cb.recon.badge.unreconciled', {
                                                                    n: Number(a.unreconciledCount),
                                                                })}
                                                            </span>
                                                        ) : null}
                                                    </td>
                                                    <td>
                                                        {t(
                                                            cashBankRegisterClassLabelKey(
                                                                cashBankRegisterClass(a),
                                                            ),
                                                        )}
                                                    </td>
                                                    <td>{a.branch || '—'}</td>
                                                    <td>
                                                        SAR {formatSar2(bal)}
                                                        <BalanceSourceChip
                                                            source={a.balanceSource}
                                                            sharedHint={
                                                                sharedHint
                                                                    ? t('cb.chip.sharedHint', {
                                                                          names: sharedHint,
                                                                      })
                                                                    : ''
                                                            }
                                                            t={t}
                                                        />
                                                    </td>
                                                    <td>
                                                        {a.status === 'active'
                                                            ? t('cb.status.active')
                                                            : t('cb.status.inactive')}
                                                    </td>
                                                    <td>
                                                        <div
                                                            style={{
                                                                display: 'flex',
                                                                gap: 6,
                                                                flexWrap: 'wrap',
                                                            }}
                                                        >
                                                            {canManage && !a.isSystem ? (
                                                                <button
                                                                    type="button"
                                                                    className="btn-portal-outline"
                                                                   
                                                                    onClick={() => openEditRow(a)}
                                                                >
                                                                    {t('cb.edit')}
                                                                </button>
                                                            ) : null}
                                                            {canManage && !a.isSystem ? (
                                                                <button
                                                                    type="button"
                                                                    className="btn-portal-outline"
                                                                   
                                                                    onClick={() => openAdjustPanel(a)}
                                                                >
                                                                    {t('cb.adjust')}
                                                                </button>
                                                            ) : null}
                                                            {showReconcileUi &&
                                                            cashBankRegisterClass(a) === 'BANK' &&
                                                            canManage ? (
                                                                <button
                                                                    type="button"
                                                                    className="btn-portal-outline"
                                                                   
                                                                    onClick={() => openReconcile(a)}
                                                                >
                                                                    {t('cb.reconcile.action')}
                                                                </button>
                                                            ) : null}
                                                            {a.coaAccountId ? (
                                                                <button
                                                                    type="button"
                                                                    className="btn-portal-outline"
                                                                   
                                                                    onClick={() => openRegister(a)}
                                                                    title={t('cb.openRegisterHint')}
                                                                >
                                                                    <BookOpen size={14} style={{ marginInlineEnd: 4 }} />
                                                                    {t('cb.ledger')}
                                                                </button>
                                                            ) : null}
                                                        </div>
                                                    </td>
                                                </tr>
                                                {expandedEditId === a.id && editForm ? (
                                                    <tr>
                                                        <td colSpan={6}>
                                                            <div
                                                                style={{
                                                                    padding: 12,
                                                                    background: '#f8fafc',
                                                                    borderRadius: 8,
                                                                }}
                                                                data-testid="cb-edit-account-panel"
                                                            >
                                                                <h4 style={{ margin: '0 0 10px' }}>
                                                                    {t('cb.modal.editTitle')}
                                                                </h4>
                                                                <div
                                                                    style={{
                                                                        display: 'grid',
                                                                        gridTemplateColumns:
                                                                            'repeat(auto-fill, minmax(180px, 1fr))',
                                                                        gap: 10,
                                                                    }}
                                                                >
                                                                    <label className="coa-range-field">
                                                                        <span>{t('cb.field.nameEdit')}</span>
                                                                        <input
                                                                            value={editForm.name}
                                                                            onChange={(e) =>
                                                                                setEditForm((f) => ({
                                                                                    ...f,
                                                                                    name: e.target.value,
                                                                                }))
                                                                            }
                                                                        />
                                                                    </label>
                                                                    <label className="coa-range-field">
                                                                        <span>{t('cb.field.typeEdit')}</span>
                                                                        <SelectCombo
                                                                            value={editForm.type}
                                                                            onChange={(e) =>
                                                                                setEditForm((f) => ({
                                                                                    ...f,
                                                                                    type: e.target.value,
                                                                                }))
                                                                            }
                                                                        >
                                                                            <option value="Cash">
                                                                                {t('cb.tab.cash')}
                                                                            </option>
                                                                            <option value="Bank">
                                                                                {t('cb.tab.bank')}
                                                                            </option>
                                                                            <option value="Petty Cash">
                                                                                {t('cb.tab.petty')}
                                                                            </option>
                                                                        </SelectCombo>
                                                                    </label>
                                                                    <label className="coa-range-field">
                                                                        <span>{t('cb.field.status')}</span>
                                                                        <SelectCombo
                                                                            value={editForm.status}
                                                                            onChange={(e) =>
                                                                                setEditForm((f) => ({
                                                                                    ...f,
                                                                                    status: e.target.value,
                                                                                }))
                                                                            }
                                                                        >
                                                                            <option value="active">
                                                                                {t('cb.status.active')}
                                                                            </option>
                                                                            <option value="inactive">
                                                                                {t('cb.status.inactive')}
                                                                            </option>
                                                                        </SelectCombo>
                                                                    </label>
                                                                    <div className="coa-range-field" data-testid="cb-neg-toggle">
                                                                        <AllowNegativeBalanceToggle
                                                                            account={a}
                                                                            user={user}
                                                                            isHq={isAdminHqBooks}
                                                                            hasPermission={hasPermission}
                                                                            locale={locale}
                                                                            t={t}
                                                                            onSave={(id, body) => setWorkshopAllowNegativeBalance(id, body)}
                                                                            onSaved={() => loadAccounts()}
                                                                        />
                                                                    </div>
                                                                    <label className="coa-range-field">
                                                                        <span>{t('cb.field.coaReadonly')}</span>
                                                                        <input
                                                                            value={editForm.coaLink || '—'}
                                                                            readOnly
                                                                        />
                                                                    </label>
                                                                </div>
                                                                {saveError ? (
                                                                    <p
                                                                        style={{ color: '#dc2626', marginTop: 8 }}
                                                                        role="alert"
                                                                    >
                                                                        {saveError}
                                                                    </p>
                                                                ) : null}
                                                                {renderInlineConfirmBar({
                                                                    onConfirm: handleSaveEdit,
                                                                    onCancel: closeEditRow,
                                                                    confirmLabel: saving
                                                                        ? t('cb.modal.saving')
                                                                        : t('cb.modal.save'),
                                                                    busy: saving,
                                                                })}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ) : null}
                                                {adjustAccountId === a.id && adjustAccount ? (
                                                    <tr>
                                                        <td colSpan={6}>
                                                            <div
                                                                style={{
                                                                    padding: 12,
                                                                    background: '#f8fafc',
                                                                    borderRadius: 8,
                                                                }}
                                                                data-testid="cb-adjust-panel"
                                                            >
                                                                <h4 style={{ margin: '0 0 8px' }}>
                                                                    {t('cb.adjust.title')}
                                                                </h4>
                                                                <p style={{ margin: '0 0 10px', color: '#6b7280' }}>
                                                                    {t('cb.adjust.desc')}
                                                                </p>
                                                                <p style={{ margin: '0 0 10px' }}>
                                                                    {t('cb.adjust.current')}: SAR{' '}
                                                                    {formatSar2(adjustPreview.current)}
                                                                    {' · '}
                                                                    {t('cb.adjust.preview')}: SAR{' '}
                                                                    {formatSar2(adjustPreview.next)}
                                                                </p>
                                                                <div
                                                                    style={{
                                                                        display: 'grid',
                                                                        gridTemplateColumns:
                                                                            'repeat(auto-fill, minmax(180px, 1fr))',
                                                                        gap: 10,
                                                                    }}
                                                                >
                                                                    <label className="coa-range-field">
                                                                        <span>{t('cb.adjust.amount')}</span>
                                                                        <input
                                                                            value={adjustAmount}
                                                                            onChange={(e) =>
                                                                                setAdjustAmount(e.target.value)
                                                                            }
                                                                            placeholder={t('cb.adjust.amountPh')}
                                                                        />
                                                                    </label>
                                                                    <label className="coa-range-field">
                                                                        <span>{t('cb.adjust.date')}</span>
                                                                        <input
                                                                            type="date"
                                                                            value={adjustDate}
                                                                            onChange={(e) =>
                                                                                setAdjustDate(e.target.value)
                                                                            }
                                                                        />
                                                                    </label>
                                                                    <label className="coa-range-field">
                                                                        <span>{t('cb.adjust.reason')}</span>
                                                                        <input
                                                                            value={adjustReason}
                                                                            onChange={(e) =>
                                                                                setAdjustReason(e.target.value)
                                                                            }
                                                                            placeholder={t('cb.adjust.reasonPh')}
                                                                        />
                                                                    </label>
                                                                </div>
                                                                {adjustError ? (
                                                                    <p
                                                                        style={{ color: '#dc2626', marginTop: 8 }}
                                                                        role="alert"
                                                                    >
                                                                        {adjustError}
                                                                    </p>
                                                                ) : null}
                                                                {renderInlineConfirmBar({
                                                                    onConfirm: handleAdjust,
                                                                    onCancel: closeAdjustPanel,
                                                                    confirmLabel: adjustSubmitting
                                                                        ? t('cb.adjust.submitting')
                                                                        : t('cb.adjust.submit'),
                                                                    busy: adjustSubmitting,
                                                                })}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ) : null}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                            <PaginationControls
                                total={paged.total}
                                limit={paged.pageSize}
                                offset={paged.offset}
                                onPageChange={(nextOffset) => {
                                    const nextPage =
                                        Math.floor(Number(nextOffset) / CASH_BANK_PAGE_SIZE) + 1;
                                    setPage(nextPage);
                                }}
                                loading={accountsLoading}
                            />
                        </section>
                    )}
                </section>
            )}
        </div>
    );
}
