import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams, useOutletContext } from 'react-router-dom';
import { Plus, ArrowLeftRight, RefreshCw, Landmark, Wallet, Banknote, Zap, BookOpen } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../../components/Modal';
import SearchableEntityCombobox from '../../../components/SearchableEntityCombobox';
import CashBankRegisterPanel from '../../../components/accounting/CashBankRegisterPanel';
import { accT } from '../../../utils/accountingI18n';
import {
    listWorkshopCashBankAccounts,
    createWorkshopCashBankAccount,
    updateWorkshopCashBankAccount,
    listWorkshopCashBankPosTerminals,
    internalTransferWorkshopCashBank,
    resetCashFlowV3,
    setBranchDefaultAccounts,
} from '../../../services/workshopStaffApi';
import { useHqAdminBooksScope } from '../../../hooks/useHqAdminBooksScope';
import {
    CASH_BANK_TABS,
    uiCashBankTypeToApi,
    cashBankTypeLabelKey,
    normalizeWorkshopCashBankRow,
    formatSarAmount,
    todayIsoDate,
} from './workshopAccountingShared';
import '../../../styles/admin/AccountingPage.css';

export default function WorkshopCashBankPage({ branches = [] }) {
    const { isAdminHqBooks } = useHqAdminBooksScope();
    const outletCtx = useOutletContext() || {};
    const locale =
        outletCtx.locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => accT(locale, key, vars), [locale]);
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
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

    const openRegister = useCallback((account) => {
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
    }, [setSearchParams]);

    const [pageTab, setPageTab] = useState('accounts');
    const [accountTab, setAccountTab] = useState('all');
    const [accounts, setAccounts] = useState([]);
    const [accountsLoading, setAccountsLoading] = useState(false);
    const [accountsError, setAccountsError] = useState('');
    const [saveError, setSaveError] = useState('');
    const [saving, setSaving] = useState(false);
    const [newAccountOpen, setNewAccountOpen] = useState(false);
    const [editAccountOpen, setEditAccountOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState(null);
    const [cashBankOpeningBalanceDate, setCashBankOpeningBalanceDate] = useState(() => todayIsoDate());
    const [newAccountName, setNewAccountName] = useState('');
    const [newAccountType, setNewAccountType] = useState('Cash');
    const [newAccountBranchId, setNewAccountBranchId] = useState('');
    const [newAccountOpeningBalance, setNewAccountOpeningBalance] = useState('0');
    const [newAccountStatus, setNewAccountStatus] = useState('active');
    const [newPosTerminalId, setNewPosTerminalId] = useState('');
    const [posTerminals, setPosTerminals] = useState([]);
    const [xferFromId, setXferFromId] = useState('');
    const [xferToId, setXferToId] = useState('');
    const [xferFromDisplay, setXferFromDisplay] = useState('');
    const [xferToDisplay, setXferToDisplay] = useState('');
    const [xferAmount, setXferAmount] = useState('');
    const [xferDate, setXferDate] = useState(() => todayIsoDate());
    const [xferNote, setXferNote] = useState('');
    const [xferError, setXferError] = useState('');
    const [xferSubmitting, setXferSubmitting] = useState(false);
    const [editPosInitial, setEditPosInitial] = useState('');
    const [migratingV3, setMigratingV3] = useState(false);
    const [migrationMsg, setMigrationMsg] = useState('');
    const [branchDefaults, setBranchDefaults] = useState({});
    const [branchDefaultsMsg, setBranchDefaultsMsg] = useState('');

    const loadAccounts = useCallback(async () => {
        setAccountsLoading(true);
        setAccountsError('');
        try {
            const res = await listWorkshopCashBankAccounts();
            const list = Array.isArray(res?.accounts)
                ? res.accounts
                : Array.isArray(res?.data?.accounts)
                  ? res.data.accounts
                  : [];
            setAccounts(list.map(normalizeWorkshopCashBankRow));
        } catch (e) {
            setAccounts([]);
            setAccountsError(e?.message || t('cb.err.load'));
        } finally {
            setAccountsLoading(false);
        }
    }, [t]);

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

    const showDefaultsTab = !isAdminHqBooks && branches.length > 0;
    useEffect(() => {
        if (pageTab === 'defaults' && !showDefaultsTab) {
            setPageTab('accounts');
        }
    }, [pageTab, showDefaultsTab]);

    useEffect(() => {
        if (!newPosTerminalId) return;
        const ok = posTerminals.some(
            (t) => String(t.branchId) === String(newAccountBranchId) && String(t.id) === String(newPosTerminalId),
        );
        if (!ok) setNewPosTerminalId('');
    }, [newAccountBranchId, newPosTerminalId, posTerminals]);

    const terminalsForSelectedNewBranch = useMemo(
        () => posTerminals.filter((t) => String(t.branchId) === String(newAccountBranchId)),
        [posTerminals, newAccountBranchId],
    );

    const visibleAccounts = useMemo(() => {
        if (accountTab === 'all') return accounts;
        const want = accountTab === 'cash' ? 'CASH' : accountTab === 'bank' ? 'BANK' : 'PETTY_CASH';
        return accounts.filter((a) => a.apiType === want);
    }, [accounts, accountTab]);

    const stats = useMemo(() => {
        const sum = (t) => accounts.filter((a) => a.apiType === t).reduce((s, a) => s + a.currentBalance, 0);
        return {
            cash: sum('CASH'),
            bank: sum('BANK'),
            petty: sum('PETTY_CASH'),
            nCash: accounts.filter((a) => a.apiType === 'CASH').length,
            nBank: accounts.filter((a) => a.apiType === 'BANK').length,
            nPetty: accounts.filter((a) => a.apiType === 'PETTY_CASH').length,
        };
    }, [accounts]);

    const transferAccountOptions = useMemo(
        () =>
            accounts.map((acc) => ({
                id: String(acc.id),
                label: acc.name || '—',
                subtitle: `${acc.branch || '—'} · ${t(cashBankTypeLabelKey(acc.type))}`,
                trailing: `SAR ${formatSarAmount(acc.currentBalance)}`,
                searchText: `${acc.name} ${acc.branch} ${acc.coaLink} ${acc.apiType}`,
            })),
        [accounts, t],
    );

    const branchLabel = (branchId) => {
        if (branchId == null || String(branchId).trim() === '') return '';
        const b = branches.find((x) => String(x.id) === String(branchId));
        return b?.name ?? '';
    };

    const closeCashBankNewModal = () => {
        setNewAccountOpen(false);
        setSaveError('');
        setCashBankOpeningBalanceDate(todayIsoDate());
        setNewAccountName('');
        setNewAccountType('Cash');
        setNewAccountBranchId('');
        setNewAccountOpeningBalance('0');
        setNewAccountStatus('active');
        setNewPosTerminalId('');
    };

    const openNewAccountModal = () => {
        if (isAdminHqBooks) {
            navigate('/admin/accounting/cash-bank/new');
            return;
        }
        setSaveError('');
        setNewPosTerminalId('');
        setNewAccountOpen(true);
    };

    const handleSaveNew = async () => {
        setSaveError('');
        const name = newAccountName.trim();
        if (!name) {
            setSaveError(t('cb.err.name'));
            return;
        }
        if (!String(newAccountBranchId).trim()) {
            setSaveError(t('cb.err.branch'));
            return;
        }
        setSaving(true);
        try {
            const body = {
                name,
                type: uiCashBankTypeToApi(newAccountType),
                branchId: String(newAccountBranchId),
                openingBalance: Number(newAccountOpeningBalance) || 0,
                status: newAccountStatus,
            };
            if (String(newPosTerminalId).trim()) {
                body.posTerminalId = String(newPosTerminalId).trim();
            }
            await createWorkshopCashBankAccount(body);
            await loadAccounts();
            closeCashBankNewModal();
        } catch (e) {
            setSaveError(e?.message || t('cb.err.create'));
        } finally {
            setSaving(false);
        }
    };

    const openEdit = (a) => {
        if (isAdminHqBooks) {
            navigate(`/admin/accounting/cash-bank/${encodeURIComponent(a.id)}/edit`);
            return;
        }
        let bid = a.branchId != null && String(a.branchId).trim() !== '' ? String(a.branchId) : '';
        if (!bid && a.branch) {
            const match = branches.find((b) => b.name === a.branch);
            if (match?.id != null) bid = String(match.id);
        }
        setSaveError('');
        const pt = a.posTerminalId || '';
        setEditPosInitial(pt);
        setEditingAccount({
            ...a,
            branchId: bid,
            openingBalance: String(a.openingBalance ?? ''),
            posTerminalId: pt,
        });
        setEditAccountOpen(true);
    };

    const closeEditModal = () => {
        setEditAccountOpen(false);
        setEditingAccount(null);
        setEditPosInitial('');
        setSaveError('');
    };

    const handleSaveEdit = async () => {
        if (!editingAccount) return;
        const name = (editingAccount.name || '').trim();
        if (!name) {
            setSaveError(t('cb.err.name'));
            return;
        }
        if (!String(editingAccount.branchId || '').trim()) {
            setSaveError(t('cb.err.branch'));
            return;
        }
        setSaving(true);
        setSaveError('');
        try {
            const curPos = String(editingAccount.posTerminalId || '').trim();
            const iniPos = String(editPosInitial || '').trim();
            const body = {
                name,
                type: uiCashBankTypeToApi(editingAccount.type),
                branchId: String(editingAccount.branchId),
                openingBalance: Number(editingAccount.openingBalance) || 0,
                status: editingAccount.status,
            };
            if (curPos !== iniPos) {
                body.posTerminalId = curPos;
            }
            await updateWorkshopCashBankAccount(editingAccount.id, body);
            await loadAccounts();
            closeEditModal();
        } catch (e) {
            setSaveError(e?.message || t('cb.err.save'));
        } finally {
            setSaving(false);
        }
    };

    const terminalsForEditBranch = useMemo(() => {
        if (!editingAccount?.branchId) return [];
        return posTerminals.filter((t) => String(t.branchId) === String(editingAccount.branchId));
    }, [posTerminals, editingAccount?.branchId]);

    const handleInternalTransfer = async () => {
        setXferError('');
        if (!xferFromId || !xferToId) {
            setXferError(t('cb.xfer.err.both'));
            return;
        }
        if (xferFromId === xferToId) {
            setXferError(t('cb.xfer.err.diff'));
            return;
        }
        const amt = Number(xferAmount);
        if (!Number.isFinite(amt) || amt <= 0) {
            setXferError(t('cb.xfer.err.amount'));
            return;
        }
        setXferSubmitting(true);
        try {
            await internalTransferWorkshopCashBank({
                fromAccountId: xferFromId,
                toAccountId: xferToId,
                amount: amt,
                entryDate: xferDate,
                description: xferNote.trim() || undefined,
            });
            setXferAmount('');
            setXferNote('');
            await loadAccounts();
        } catch (e) {
            setXferError(e?.message || t('cb.xfer.err.failed'));
        } finally {
            setXferSubmitting(false);
        }
    };

    return (
        registerDrill ? (
            <CashBankRegisterPanel
                registerType={registerDrill.registerType}
                initialCoaAccountId={registerDrill.coaAccountId}
                onClose={closeRegisterDrill}
            />
        ) : (
        <div className="cash-bank-view">
            <header className="cash-bank-header">
                <h2 className="cash-bank-title">{t('cb.title')}</h2>
                <p className="cash-bank-desc">
                    {isAdminHqBooks ? t('cb.desc.hq') : t('cb.desc.ws')}
                </p>
            </header>
            {accountsError ? (
                <p className="form-help-text" style={{ color: '#B45309', marginBottom: 12 }} role="alert">
                    {accountsError}
                </p>
            ) : null}
            <div className="cash-bank-stats">
                <div className="cash-bank-stat-card">
                    <div className="cash-bank-stat-icon"><Banknote size={24} /></div>
                    <div>
                        <p className="cash-bank-stat-label">{t('cb.stat.cash')}</p>
                        <p className="cash-bank-stat-value">SAR {formatSarAmount(stats.cash)}</p>
                        <p className="cash-bank-stat-meta">{t('cb.stat.accounts', { n: stats.nCash })}</p>
                    </div>
                </div>
                <div className="cash-bank-stat-card">
                    <div className="cash-bank-stat-icon"><Landmark size={24} /></div>
                    <div>
                        <p className="cash-bank-stat-label">{t('cb.stat.bank')}</p>
                        <p className="cash-bank-stat-value">SAR {formatSarAmount(stats.bank)}</p>
                        <p className="cash-bank-stat-meta">{t('cb.stat.accounts', { n: stats.nBank })}</p>
                    </div>
                </div>
                <div className="cash-bank-stat-card">
                    <div className="cash-bank-stat-icon"><Wallet size={24} /></div>
                    <div>
                        <p className="cash-bank-stat-label">{t('cb.stat.petty')}</p>
                        <p className="cash-bank-stat-value">SAR {formatSarAmount(stats.petty)}</p>
                        <p className="cash-bank-stat-meta">{t('cb.stat.accounts', { n: stats.nPetty })}</p>
                    </div>
                </div>
            </div>
            <div
                className="cash-bank-page-tabs"
                style={{
                    display: 'flex',
                    gap: 16,
                    borderBottom: '1px solid #e5e7eb',
                    marginBottom: 16,
                    flexWrap: 'wrap',
                }}
            >
                {[
                    { id: 'accounts', labelKey: 'cb.pageTab.accounts' },
                    { id: 'transfer', labelKey: 'cb.pageTab.transfer' },
                    ...(showDefaultsTab
                        ? [{ id: 'defaults', labelKey: 'cb.pageTab.defaults' }]
                        : []),
                ].map((tab) => {
                    const active = pageTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setPageTab(tab.id)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: active ? '#111827' : '#6b7280',
                                fontWeight: active ? 700 : 500,
                                padding: '8px 0',
                                cursor: 'pointer',
                                borderBottom: active ? '3px solid #D4A017' : '3px solid transparent',
                            }}
                        >
                            {t(tab.labelKey)}
                        </button>
                    );
                })}
            </div>

            {pageTab === 'transfer' ? (
            <section
                className="cash-bank-internal-xfer"
                style={{
                    marginBottom: 20,
                    padding: '16px 18px',
                    borderRadius: 12,
                    border: '1px solid rgba(0,0,0,0.08)',
                    background: 'var(--accounting-card-bg, #fafafa)',
                }}
            >
                <h3 className="cash-bank-title" style={{ fontSize: '1.05rem', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ArrowLeftRight size={20} aria-hidden />
                    {t('cb.xfer.title')}
                </h3>
                <p className="form-help-text" style={{ marginBottom: 12 }}>
                    {t('cb.xfer.desc')}
                </p>
                {xferError ? (
                    <p className="form-help-text" style={{ color: '#B45309', marginBottom: 10 }} role="alert">{xferError}</p>
                ) : null}
                <div className="modal-form-grid" style={{ alignItems: 'end' }}>
                    <div className="form-group">
                        <label className="form-label">{t('cb.xfer.from')}</label>
                        <SearchableEntityCombobox
                            options={transferAccountOptions}
                            value={xferFromId}
                            displayText={xferFromDisplay}
                            onDisplayTextChange={(text) => {
                                setXferFromDisplay(text);
                                if (!text.trim()) setXferFromId('');
                            }}
                            onSelect={(opt) => {
                                setXferFromId(String(opt?.id || ''));
                                setXferFromDisplay('');
                            }}
                            placeholder={t('cb.xfer.searchPh')}
                            entityLabel="account"
                            emptyHint={t('cb.xfer.noMatch')}
                            loading={accountsLoading}
                            maxInitial={80}
                            maxFiltered={150}
                            menuMinWidth={320}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('cb.xfer.to')}</label>
                        <SearchableEntityCombobox
                            options={transferAccountOptions}
                            value={xferToId}
                            displayText={xferToDisplay}
                            onDisplayTextChange={(text) => {
                                setXferToDisplay(text);
                                if (!text.trim()) setXferToId('');
                            }}
                            onSelect={(opt) => {
                                setXferToId(String(opt?.id || ''));
                                setXferToDisplay('');
                            }}
                            placeholder={t('cb.xfer.searchPh')}
                            entityLabel="account"
                            emptyHint={t('cb.xfer.noMatch')}
                            loading={accountsLoading}
                            maxInitial={80}
                            maxFiltered={150}
                            menuMinWidth={320}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('cb.xfer.amount')}</label>
                        <input
                            type="number"
                            className="form-input-field"
                            min="0"
                            step="0.01"
                            value={xferAmount}
                            onChange={(e) => setXferAmount(e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('cb.xfer.date')}</label>
                        <input
                            type="date"
                            className="form-input-field"
                            value={xferDate}
                            onChange={(e) => setXferDate(e.target.value)}
                        />
                    </div>
                    <div className="form-group form-group-full">
                        <label className="form-label">{t('cb.xfer.note')}</label>
                        <input
                            type="text"
                            className="form-input-field"
                            placeholder={t('cb.xfer.notePh')}
                            value={xferNote}
                            onChange={(e) => setXferNote(e.target.value)}
                        />
                    </div>
                    <div className="form-group form-group-full" style={{ marginTop: 4 }}>
                        <button
                            type="button"
                            className="btn-submit btn-dark"
                            disabled={xferSubmitting || accounts.length < 2}
                            onClick={handleInternalTransfer}
                        >
                            {xferSubmitting ? t('cb.xfer.submitting') : t('cb.xfer.submit')}
                        </button>
                    </div>
                </div>
            </section>
            ) : pageTab === 'defaults' ? (
                !isAdminHqBooks && branches.length > 0 ? (
                <section
                    className="cash-bank-branch-defaults"
                    style={{
                        marginBottom: 20,
                        padding: '16px 18px',
                        borderRadius: 12,
                        border: '1px solid rgba(0,0,0,0.08)',
                        background: 'var(--accounting-card-bg, #fafafa)',
                    }}
                >
                    <h3 className="cash-bank-title" style={{ fontSize: '1.05rem', margin: '0 0 8px' }}>
                        {t('cb.defaults.title')}
                    </h3>
                    <p className="form-help-text" style={{ marginBottom: 12 }}>
                        {t('cb.defaults.desc')}
                    </p>
                    {branchDefaultsMsg ? (
                        <p className="form-help-text" style={{ color: '#0E7C66', margin: '0 0 8px' }}>{branchDefaultsMsg}</p>
                    ) : null}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 12, alignItems: 'end' }}>
                        {branches.map((b) => {
                            const bid = String(b.id);
                            const dCash = branchDefaults[bid]?.defaultCashAccountId ?? '';
                            const dBank = branchDefaults[bid]?.defaultBankAccountId ?? '';
                            return (
                                <React.Fragment key={bid}>
                                    <div className="form-group">
                                        <label className="form-label" style={{ fontSize: '0.85rem' }}>{b.name}</label>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{t('cb.defaults.cash')}</label>
                                        <select
                                            className="form-input-field"
                                            value={dCash}
                                            onChange={(e) => setBranchDefaults((cur) => ({
                                                ...cur,
                                                [bid]: { ...(cur[bid] || {}), defaultCashAccountId: e.target.value },
                                            }))}
                                        >
                                            <option value="">{t('cb.defaults.none')}</option>
                                            {accounts.filter((a) => a.apiType === 'CASH' && a.kind === 'OPERATING' && (!a.branchId || String(a.branchId) === bid)).map((a) => (
                                                <option key={a.id} value={a.id}>{a.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{t('cb.defaults.bank')}</label>
                                        <select
                                            className="form-input-field"
                                            value={dBank}
                                            onChange={(e) => setBranchDefaults((cur) => ({
                                                ...cur,
                                                [bid]: { ...(cur[bid] || {}), defaultBankAccountId: e.target.value },
                                            }))}
                                        >
                                            <option value="">{t('cb.defaults.none')}</option>
                                            {accounts.filter((a) => a.apiType === 'BANK' && a.kind === 'OPERATING' && (!a.branchId || String(a.branchId) === bid)).map((a) => (
                                                <option key={a.id} value={a.id}>{a.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <button
                                            type="button"
                                            className="btn-portal-outline"
                                            onClick={async () => {
                                                setBranchDefaultsMsg('');
                                                try {
                                                    const res = await setBranchDefaultAccounts(bid, {
                                                        defaultCashAccountId: dCash || null,
                                                        defaultBankAccountId: dBank || null,
                                                    });
                                                    setBranchDefaultsMsg(`Saved defaults for ${res?.branchName || b.name}.`);
                                                } catch (e) {
                                                    setBranchDefaultsMsg(e?.message || 'Save failed.');
                                                }
                                            }}
                                        >
                                            Save
                                        </button>
                                    </div>
                                </React.Fragment>
                            );
                        })}
                    </div>
                </section>
                ) : (
                    <p className="form-help-text">{t('cb.defaults.unavailable')}</p>
                )
            ) : (
            <>
            <div className="cash-bank-tabs">
                {CASH_BANK_TABS.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        className={`cash-bank-tab ${accountTab === tab.id ? 'active' : ''}`}
                        onClick={() => setAccountTab(tab.id)}
                    >
                        {t(tab.labelKey)}
                    </button>
                ))}
            </div>
            <div className="cash-bank-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button type="button" className="btn-portal" onClick={openNewAccountModal}><Plus size={16} /> {t('cb.newAccount')}</button>
                <button
                    type="button"
                    className="btn-portal-outline"
                    disabled={accountsLoading}
                    onClick={() => loadAccounts()}
                    title={t('cb.reloadList')}
                >
                    <RefreshCw size={16} style={{ marginRight: 6, opacity: accountsLoading ? 0.5 : 1 }} />
                    {t('cb.refresh')}
                </button>
                <button
                    type="button"
                    className="btn-portal-outline"
                    disabled={migratingV3}
                    onClick={async () => {
                        setMigrationMsg('');
                        setMigratingV3(true);
                        try {
                            const res = await resetCashFlowV3();
                            setMigrationMsg(res?.message || 'Cash flow migration completed.');
                            await loadAccounts();
                        } catch (e) {
                            setMigrationMsg(e?.message || 'Migration failed.');
                        } finally {
                            setMigratingV3(false);
                        }
                    }}
                    title={t('cb.migrateTitle')}
                >
                    <Zap size={16} style={{ marginRight: 6 }} />
                    {migratingV3 ? t('cb.migrating') : t('cb.migrate')}
                </button>
            </div>
            {migrationMsg && !isAdminHqBooks ? (
                <p className="form-help-text" style={{ color: '#0E7C66', margin: '6px 0 0' }}>{migrationMsg}</p>
            ) : null}

            <section className="premium-table cash-bank-table">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">{t('cb.th.account')}</th>
                            <th className="table-th">{t('cb.th.kind')}</th>
                            <th className="table-th">{t('cb.th.type')}</th>
                            {!isAdminHqBooks ? <th className="table-th">{t('cb.th.branch')}</th> : null}
                            {!isAdminHqBooks ? <th className="table-th">{t('cb.th.pos')}</th> : null}
                            <th className="table-th">{t('cb.th.coa')}</th>
                            <th className="table-th">{t('cb.th.opening')}</th>
                            <th className="table-th">{t('cb.th.current')}</th>
                            <th className="table-th">{t('cb.th.status')}</th>
                            <th className="table-th">{t('cb.th.actions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {accountsLoading ? (
                            <tr>
                                <td colSpan={isAdminHqBooks ? 8 : 10} className="table-cell table-empty">{t('cb.loading')}</td>
                            </tr>
                        ) : visibleAccounts.length === 0 ? (
                            <tr>
                                <td colSpan={isAdminHqBooks ? 8 : 10} className="table-cell table-empty">{t('cb.empty')}</td>
                            </tr>
                        ) : (
                            visibleAccounts.map((a) => (
                                <tr
                                    key={a.id}
                                    className={a.coaAccountId ? 'cash-bank-row--clickable' : undefined}
                                    onClick={() => {
                                        if (a.coaAccountId) openRegister(a);
                                    }}
                                    title={a.coaAccountId ? t('cb.openRegisterHint') : undefined}
                                    style={a.coaAccountId ? { cursor: 'pointer' } : undefined}
                                >
                                    <td className="table-cell cell-main-text">
                                        {a.coaAccountId ? (
                                            <button
                                                type="button"
                                                className="cash-bank-account-link"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    openRegister(a);
                                                }}
                                                style={{
                                                    border: 'none',
                                                    background: 'none',
                                                    padding: 0,
                                                    cursor: 'pointer',
                                                    fontWeight: 700,
                                                    color: '#0f172a',
                                                    textAlign: 'left',
                                                    textDecoration: 'underline',
                                                    textDecorationColor: 'rgba(212,160,23,0.55)',
                                                    textUnderlineOffset: 3,
                                                }}
                                            >
                                                {a.name}
                                            </button>
                                        ) : (
                                            a.name
                                        )}
                                    </td>
                                    <td className="table-cell">
                                        <span className={`status-badge ${a.isSystem ? 'status-pending' : 'status-completed'}`}>{t(a.kindKey)}</span>
                                    </td>
                                    <td className="table-cell">{t(cashBankTypeLabelKey(a.type))}</td>
                                    {!isAdminHqBooks ? <td className="table-cell">{a.branch}</td> : null}
                                    {!isAdminHqBooks ? (
                                        <td className="table-cell">{a.posShared ? t('cb.shared') : a.posLinkLabel}</td>
                                    ) : null}
                                    <td className="table-cell">{a.coaLink}</td>
                                    <td className="table-cell">SAR {formatSarAmount(a.openingBalance)}</td>
                                    <td className="table-cell">SAR {formatSarAmount(a.currentBalance)}</td>
                                    <td className="table-cell">
                                        <span className="status-badge status-completed">
                                            {a.status === 'inactive' ? t('cb.status.inactive') : t('cb.status.active')}
                                        </span>
                                    </td>
                                    <td className="table-cell" onClick={(e) => e.stopPropagation()}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                            {a.coaAccountId ? (
                                                <button
                                                    type="button"
                                                    className="btn-edit-zone"
                                                    onClick={() => openRegister(a)}
                                                    title={t('cb.openRegisterHint')}
                                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                                >
                                                    <BookOpen size={14} />
                                                    {t('cb.openRegister')}
                                                </button>
                                            ) : null}
                                            {a.isSystem ? (
                                                <span className="form-help-text" title={t('cb.systemTitle')}>{t('cb.system')}</span>
                                            ) : (
                                                <button type="button" className="btn-edit-zone" onClick={() => openEdit(a)}>{t('cb.edit')}</button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </section>
            </>
            )}

            {!isAdminHqBooks ? (
            <AnimatePresence>
                {newAccountOpen && (
                    <Modal
                        title={t('cb.modal.newTitle')}
                        onClose={closeCashBankNewModal}
                        footer={
                            <>
                                <button type="button" className="btn-secondary" onClick={closeCashBankNewModal} disabled={saving}>{t('cb.modal.cancel')}</button>
                                <button type="button" className="btn-submit btn-dark" onClick={handleSaveNew} disabled={saving}>{saving ? t('cb.modal.creating') : t('cb.modal.create')}</button>
                            </>
                        }
                    >
                        <div className="modal-form-grid">
                            {saveError ? (
                                <p className="form-group form-group-full form-help-text" style={{ color: '#B45309' }} role="alert">{saveError}</p>
                            ) : null}
                            <div className="form-group">
                                <label className="form-label">{t('cb.field.name')}</label>
                                <input
                                    type="text"
                                    className="form-input-field"
                                    placeholder={t('cb.field.namePh')}
                                    value={newAccountName}
                                    onChange={(e) => setNewAccountName(e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('cb.field.type')}</label>
                                <select
                                    className="form-input-field"
                                    value={newAccountType}
                                    onChange={(e) => setNewAccountType(e.target.value)}
                                >
                                    <option value="Cash">{t('cb.tab.cash')}</option>
                                    <option value="Bank">{t('cb.tab.bank')}</option>
                                    <option value="Petty Cash">{t('cb.tab.petty')}</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('cb.field.branch')}</label>
                                <select
                                    className="form-input-field"
                                    value={newAccountBranchId}
                                    onChange={(e) => setNewAccountBranchId(e.target.value)}
                                >
                                    <option value="">{t('cb.field.selectBranch')}</option>
                                    {branches.map((b) => (
                                        <option key={String(b.id)} value={String(b.id)}>
                                            {b.name}
                                        </option>
                                    ))}
                                </select>
                                {branches.length === 0 ? (
                                    <p className="form-help-text" style={{ color: '#B45309' }}>
                                        No branches loaded yet. Ensure your workshop has branches in Branches, then refresh
                                        the page.
                                    </p>
                                ) : null}
                            </div>
                            <div className="form-group form-group-full">
                                <label className="form-label">{t('cb.field.softpos')}</label>
                                <select
                                    className="form-input-field"
                                    value={newPosTerminalId}
                                    onChange={(e) => setNewPosTerminalId(e.target.value)}
                                    disabled={!newAccountBranchId}
                                >
                                    <option value="">{t('cb.field.sharedRegister')}</option>
                                    {terminalsForSelectedNewBranch.map((t) => (
                                        <option key={String(t.id)} value={String(t.id)}>
                                            {t.branchName}: {t.label}
                                            {t.linkedCashBankAccountId
                                                ? ' (already linked — will reassign)'
                                                : ''}
                                        </option>
                                    ))}
                                </select>
                                <p className="form-help-text">
                                    If you pick a terminal, this register becomes that terminal&apos;s settlement/bank account. Terminal must belong to the branch selected above. Leave as shared for a general workshop register.
                                </p>
                                {newAccountBranchId && terminalsForSelectedNewBranch.length === 0 ? (
                                    <p className="form-help-text" style={{ color: '#6B7280' }}>
                                        No SoftPOS terminals for this branch yet (add terminals in admin SoftPOS) — only shared mode applies.
                                    </p>
                                ) : null}
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('cb.field.opening')}</label>
                                <input
                                    type="number"
                                    className="form-input-field"
                                    value={newAccountOpeningBalance}
                                    onChange={(e) => setNewAccountOpeningBalance(e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('cb.field.openingDate')}</label>
                                <input
                                    type="date"
                                    className="form-input-field"
                                    value={cashBankOpeningBalanceDate}
                                    onChange={(e) => setCashBankOpeningBalanceDate(e.target.value)}
                                />
                                <p className="form-help-text">{t('cb.field.openingDateHelp')}</p>
                            </div>
                            <div className="form-group form-group-full">
                                <label className="form-label">{t('cb.field.status')}</label>
                                <select
                                    className="form-input-field"
                                    value={newAccountStatus}
                                    onChange={(e) => setNewAccountStatus(e.target.value)}
                                >
                                    <option value="active">{t('cb.status.active')}</option>
                                    <option value="inactive">{t('cb.status.inactive')}</option>
                                </select>
                            </div>
                        </div>
                    </Modal>
                )}

                {editAccountOpen && editingAccount && (
                    <Modal
                        title={t('cb.modal.editTitle')}
                        onClose={closeEditModal}
                        footer={
                            <>
                                <button type="button" className="btn-secondary" onClick={closeEditModal} disabled={saving}>{t('cb.modal.cancel')}</button>
                                <button type="button" className="btn-submit" onClick={handleSaveEdit} disabled={saving}>{saving ? t('cb.modal.saving') : t('cb.modal.save')}</button>
                            </>
                        }
                    >
                        {saveError ? (
                            <p className="form-help-text" style={{ color: '#B45309', marginBottom: 12 }} role="alert">{saveError}</p>
                        ) : null}
                        <div className="form-group">
                            <label className="form-label">{t('cb.field.nameEdit')}</label>
                            <input type="text" className="form-input-field" value={editingAccount.name} onChange={(e) => setEditingAccount((p) => ({ ...p, name: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">{t('cb.field.typeEdit')}</label>
                            <select className="form-input-field" value={editingAccount.type} onChange={(e) => setEditingAccount((p) => ({ ...p, type: e.target.value }))}>
                                <option value="Cash">{t('cb.tab.cash')}</option><option value="Bank">{t('cb.tab.bank')}</option><option value="Petty Cash">{t('cb.tab.petty')}</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">{t('cb.field.branch')}</label>
                            <select
                                className="form-input-field"
                                value={editingAccount.branchId != null ? String(editingAccount.branchId) : ''}
                                onChange={(e) => {
                                    const id = e.target.value;
                                    const name = branchLabel(id);
                                    setEditingAccount((p) => {
                                        const next = {
                                            ...p,
                                            branchId: id,
                                            branch: name || p.branch || '',
                                        };
                                        const stillOk = posTerminals.some(
                                            (term) => String(term.branchId) === String(id) && String(term.id) === String(p.posTerminalId),
                                        );
                                        if (!stillOk) next.posTerminalId = '';
                                        return next;
                                    });
                                }}
                            >
                                <option value="">{t('cb.field.selectBranch')}</option>
                                {branches.map((b) => (
                                    <option key={String(b.id)} value={String(b.id)}>
                                        {b.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group form-group-full">
                            <label className="form-label">{t('cb.field.softposEdit')}</label>
                            <select
                                className="form-input-field"
                                value={editingAccount.posTerminalId != null ? String(editingAccount.posTerminalId) : ''}
                                onChange={(e) => setEditingAccount((p) => ({ ...p, posTerminalId: e.target.value }))}
                                disabled={!editingAccount.branchId}
                            >
                                <option value="">{t('cb.field.sharedRegister')}</option>
                                {terminalsForEditBranch.map((t) => (
                                    <option key={String(t.id)} value={String(t.id)}>
                                        {t.branchName}: {t.label}
                                        {t.linkedCashBankAccountId && String(t.linkedCashBankAccountId) !== String(editingAccount.id)
                                            ? ' (linked to another register)'
                                            : ''}
                                    </option>
                                ))}
                            </select>
                            <p className="form-help-text">
                                Same branch as this register. Change only when you want to attach or detach a terminal; saving without changing this keeps the current link.
                            </p>
                        </div>
                        <div className="form-group">
                            <label className="form-label">{t('cb.field.coaReadonly')}</label>
                            <input type="text" className="form-input-field" readOnly value={editingAccount.coaLink || '—'} />
                            <p className="form-help-text">{t('cb.field.coaHelp')}</p>
                        </div>
                        <div className="form-group">
                            <label className="form-label">{t('cb.field.opening')}</label>
                            <input type="number" className="form-input-field" value={editingAccount.openingBalance} onChange={(e) => setEditingAccount((p) => ({ ...p, openingBalance: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">{t('cb.field.status')}</label>
                            <select className="form-input-field" value={editingAccount.status} onChange={(e) => setEditingAccount((p) => ({ ...p, status: e.target.value }))}>
                                <option value="active">{t('cb.status.active')}</option><option value="inactive">{t('cb.status.inactive')}</option>
                            </select>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
            ) : null}
        </div>
        )
    );
}
