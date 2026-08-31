import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Loader2, Plus, Pencil, Wallet, RefreshCw } from 'lucide-react';
import AdminModalAsScreen from './AdminModalAsScreen';
import { getWorkshops, getBranches } from '../../services/superAdminApi';
import {
    listBudgetWalletAccounts,
    createBudgetWalletAccount,
    updateBudgetWalletAccount,
    listBudgetWalletTransactions,
} from '../../services/budgetWalletApi';
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

function normalizeWorkshops(res, t) {
    const list = Array.isArray(res) ? res : (res?.workshops ?? res?.data ?? []);
    return (Array.isArray(list) ? list : [])
        .filter((w) => !w.isPlatformHq && !w.is_platform_hq)
        .map((w) => ({ id: String(w.id), name: w.name || t('budget.workshopFallback', { id: w.id }) }));
}

function normalizeBranches(res, t) {
    const list = Array.isArray(res) ? res : (res?.branches ?? res?.data ?? []);
    return (Array.isArray(list) ? list : []).map((b) => ({
        id: String(b.id),
        name: b.name || t('budget.branchFallback', { id: b.id }),
    }));
}

function txTypeLabel(type, t) {
    if (type === 'allocation') return t('ledger.txAllocation');
    if (type === 'expense') return t('ledger.txExpense');
    if (type === 'adjustment') return t('ledger.txAdjustment');
    return type;
}

function statusLabel(status, t) {
    const s = String(status || '').toLowerCase();
    if (s === 'active') return t('status.active');
    if (s === 'inactive') return t('status.inactive');
    return status;
}

function BudgetAccountModal({ account, canEdit, busy, error, onCancel, onSubmit, t }) {
    const editing = Boolean(account);
    const [name, setName] = useState(account?.name ?? '');
    const [code, setCode] = useState(account?.code ?? '');
    const [description, setDescription] = useState(account?.description ?? '');
    const [scopeType, setScopeType] = useState(account?.scopeType ?? 'platform_hq');
    const [workshopId, setWorkshopId] = useState(account?.workshopId ?? '');
    const [branchId, setBranchId] = useState(account?.branchId ?? '');
    const [initialBudget, setInitialBudget] = useState(
        account ? String(account.initialBudget ?? 0) : '',
    );
    const [status, setStatus] = useState(account?.status ?? 'active');
    const [adjustmentAmount, setAdjustmentAmount] = useState('');
    const [adjustmentReason, setAdjustmentReason] = useState('');

    const [workshops, setWorkshops] = useState([]);
    const [branches, setBranches] = useState([]);

    useEffect(() => {
        if (editing) return;
        getWorkshops({ status: 'approved' })
            .then((res) => setWorkshops(normalizeWorkshops(res, t)))
            .catch(() => setWorkshops([]));
    }, [editing, t]);

    useEffect(() => {
        if (editing || scopeType !== 'workshop' || !workshopId) {
            setBranches([]);
            return;
        }
        getBranches({ workshopId })
            .then((res) => setBranches(normalizeBranches(res, t)))
            .catch(() => setBranches([]));
    }, [editing, scopeType, workshopId, t]);

    const valid = editing
        ? name.trim().length > 0
        : name.trim().length > 0
            && initialBudget !== '' && Number(initialBudget) >= 0
            && (scopeType === 'platform_hq' || (workshopId && branchId));

    const submit = () => {
        if (editing) {
            const payload = {
                name: name.trim(),
                code: code.trim() || undefined,
                description: description.trim() || undefined,
                status,
            };
            if (adjustmentAmount !== '' && Number(adjustmentAmount) !== 0) {
                payload.adjustmentAmount = Number(adjustmentAmount);
                payload.adjustmentReason = adjustmentReason.trim() || undefined;
            }
            onSubmit(payload);
        } else {
            onSubmit({
                name: name.trim(),
                code: code.trim() || undefined,
                description: description.trim() || undefined,
                scopeType,
                workshopId: scopeType === 'workshop' ? workshopId : undefined,
                branchId: scopeType === 'workshop' ? branchId : undefined,
                initialBudget: Number(initialBudget),
            });
        }
    };

    return (
        <AdminModalAsScreen
            title={editing ? t('budgetModal.editTitle') : t('budgetModal.createTitle')}
            onClose={onCancel}
            backDisabled={busy}
            footer={(
                <div className="admin-wallets-modal-footer">
                    <button type="button" className="admin-wallets-modal-btn-cancel" disabled={busy} onClick={onCancel}>
                        {t('btn.cancel')}
                    </button>
                    <button
                        type="button"
                        className="admin-wallets-modal-btn-primary"
                        disabled={busy || !valid || !canEdit}
                        onClick={submit}
                    >
                        {busy ? <Loader2 size={14} className="spin" /> : null}
                        {editing ? t('btn.saveChanges') : t('btn.createAccount')}
                    </button>
                </div>
            )}
        >
            {error ? (
                <div className="admin-wallets-alert" role="alert" style={{ marginTop: 0 }}>{error}</div>
            ) : null}

            <label className="admin-wallets-modal-label">{t('budgetModal.name')}</label>
            <input
                className="admin-wallets-modal-select"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={busy}
                placeholder={t('budgetModal.namePh')}
            />

            <label className="admin-wallets-modal-label">{t('budgetModal.code')}</label>
            <input
                className="admin-wallets-modal-select"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={busy}
                placeholder={t('budgetModal.codePh')}
            />

            {!editing ? (
                <>
                    <label className="admin-wallets-modal-label">{t('budgetModal.scope')}</label>
                    <select
                        className="admin-wallets-modal-select"
                        value={scopeType}
                        onChange={(e) => { setScopeType(e.target.value); setWorkshopId(''); setBranchId(''); }}
                        disabled={busy}
                    >
                        <option value="platform_hq">{t('budget.scopeHq')}</option>
                        <option value="workshop">{t('budget.scopeWorkshopBranch')}</option>
                    </select>

                    {scopeType === 'workshop' ? (
                        <>
                            <label className="admin-wallets-modal-label">{t('budgetModal.workshop')}</label>
                            <select
                                className="admin-wallets-modal-select"
                                value={workshopId}
                                onChange={(e) => { setWorkshopId(e.target.value); setBranchId(''); }}
                                disabled={busy}
                            >
                                <option value="">{t('budget.selectWorkshop')}</option>
                                {workshops.map((w) => (
                                    <option key={w.id} value={w.id}>{w.name}</option>
                                ))}
                            </select>

                            <label className="admin-wallets-modal-label">{t('budgetModal.branch')}</label>
                            <select
                                className="admin-wallets-modal-select"
                                value={branchId}
                                onChange={(e) => setBranchId(e.target.value)}
                                disabled={busy || !workshopId}
                            >
                                <option value="">{t('budget.selectBranch')}</option>
                                {branches.map((b) => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                        </>
                    ) : null}

                    <label className="admin-wallets-modal-label">{t('budgetModal.initial')}</label>
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="admin-wallets-modal-select"
                        value={initialBudget}
                        onChange={(e) => setInitialBudget(e.target.value)}
                        disabled={busy}
                        placeholder={t('budgetModal.initialPh')}
                    />
                </>
            ) : (
                <>
                    <label className="admin-wallets-modal-label">{t('budgetModal.status')}</label>
                    <select
                        className="admin-wallets-modal-select"
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        disabled={busy}
                    >
                        <option value="active">{t('budgetModal.active')}</option>
                        <option value="inactive">{t('budgetModal.inactive')}</option>
                    </select>

                    <label className="admin-wallets-modal-label">{t('budgetModal.adjustment')}</label>
                    <input
                        type="number"
                        step="0.01"
                        className="admin-wallets-modal-select"
                        value={adjustmentAmount}
                        onChange={(e) => setAdjustmentAmount(e.target.value)}
                        disabled={busy}
                        placeholder={t('budgetModal.adjustmentPh')}
                    />
                    {adjustmentAmount !== '' && Number(adjustmentAmount) !== 0 ? (
                        <>
                            <label className="admin-wallets-modal-label">{t('budgetModal.adjustmentReason')}</label>
                            <input
                                className="admin-wallets-modal-select"
                                value={adjustmentReason}
                                onChange={(e) => setAdjustmentReason(e.target.value)}
                                disabled={busy}
                                placeholder={t('budgetModal.adjustmentReasonPh')}
                            />
                        </>
                    ) : null}
                </>
            )}

            <label className="admin-wallets-modal-label">{t('budgetModal.description')}</label>
            <textarea
                className="admin-wallets-modal-textarea"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={busy}
            />
        </AdminModalAsScreen>
    );
}

function BudgetLedgerPanel({ account, onClose, t }) {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError('');
        listBudgetWalletTransactions(account.id, { limit: 200 })
            .then((res) => { if (!cancelled) setRows(Array.isArray(res?.transactions) ? res.transactions : []); })
            .catch((e) => { if (!cancelled) setError(e?.message || t('budget.errLoadLedger')); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [account.id, t]);

    return (
        <AdminModalAsScreen title={t('ledger.title', { name: account.name })} onClose={onClose} size="large">
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
                <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                    {t('ledger.allocated')} <strong>SAR {fmt(account.allocatedTotal)}</strong>
                </span>
                <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                    {t('ledger.spent')} <strong>SAR {fmt(account.spentTotal)}</strong>
                </span>
                <span style={{ fontSize: '0.8125rem', color: '#15803d' }}>
                    {t('ledger.remaining')} <strong>SAR {fmt(account.remainingBalance)}</strong>
                </span>
            </div>
            {loading ? (
                <p style={{ color: '#64748b' }}><Loader2 size={14} className="spin" /> {t('budget.loading')}</p>
            ) : error ? (
                <p style={{ color: '#b91c1c' }}>{error}</p>
            ) : rows.length === 0 ? (
                <p style={{ color: '#64748b' }}>{t('ledger.empty')}</p>
            ) : (
                <div className="admin-wallets-tx-table-wrap">
                    <table className="admin-wallets-tx-table">
                        <thead>
                            <tr>
                                <th>{t('th.date')}</th>
                                <th>{t('th.type')}</th>
                                <th>{t('th.reference')}</th>
                                <th>{t('th.paymentAccount')}</th>
                                <th style={{ textAlign: 'right' }}>{t('th.amount')}</th>
                                <th style={{ textAlign: 'right' }}>{t('th.runningBalance')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => (
                                <tr key={r.id}>
                                    <td>{new Date(r.createdAt).toLocaleString()}</td>
                                    <td>{txTypeLabel(r.type, t)}</td>
                                    <td>{r.referenceNumber || r.description || t('empty.emDash')}</td>
                                    <td>{r.sourceAccountName || t('empty.emDash')}</td>
                                    <td style={{ textAlign: 'right', color: r.type === 'expense' ? '#b91c1c' : '#15803d' }}>
                                        {r.type === 'expense' ? '-' : '+'}SAR {fmt(r.amount)}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>SAR {fmt(r.runningBalance)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </AdminModalAsScreen>
    );
}

export default function BudgetWalletSection({ canCreate, canEdit }) {
    const { t } = useAwLocale();
    const [scope, setScope] = useState('platform_hq');
    const [filterWorkshopId, setFilterWorkshopId] = useState('');
    const [filterBranchId, setFilterBranchId] = useState('');
    const [workshops, setWorkshops] = useState([]);
    const [branches, setBranches] = useState([]);

    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [modal, setModal] = useState(null);
    const [modalBusy, setModalBusy] = useState(false);
    const [modalError, setModalError] = useState('');
    const [ledger, setLedger] = useState(null);

    useEffect(() => {
        if (scope !== 'workshop') return;
        getWorkshops({ status: 'approved' })
            .then((res) => setWorkshops(normalizeWorkshops(res, t)))
            .catch(() => setWorkshops([]));
    }, [scope, t]);

    useEffect(() => {
        if (scope !== 'workshop' || !filterWorkshopId) { setBranches([]); return; }
        getBranches({ workshopId: filterWorkshopId })
            .then((res) => setBranches(normalizeBranches(res, t)))
            .catch(() => setBranches([]));
    }, [scope, filterWorkshopId, t]);

    const loadAccounts = useCallback(() => {
        if (scope === 'workshop' && (!filterWorkshopId || !filterBranchId)) {
            setAccounts([]);
            return;
        }
        setLoading(true);
        setError('');
        const params = scope === 'platform_hq'
            ? { scopeType: 'platform_hq', status: 'all' }
            : { scopeType: 'workshop', workshopId: filterWorkshopId, branchId: filterBranchId, status: 'all' };
        listBudgetWalletAccounts(params)
            .then((res) => setAccounts(Array.isArray(res?.accounts) ? res.accounts : []))
            .catch((e) => setError(e?.message || t('budget.errLoadAccounts')))
            .finally(() => setLoading(false));
    }, [scope, filterWorkshopId, filterBranchId, t]);

    useEffect(() => { loadAccounts(); }, [loadAccounts]);

    const submitModal = async (payload) => {
        setModalBusy(true);
        setModalError('');
        try {
            if (modal?.account) {
                await updateBudgetWalletAccount(modal.account.id, payload);
            } else {
                await createBudgetWalletAccount(payload);
            }
            setModal(null);
            loadAccounts();
        } catch (e) {
            setModalError(e?.message || t('budget.errSave'));
        } finally {
            setModalBusy(false);
        }
    };

    const totalRemaining = useMemo(
        () => accounts.reduce((sum, a) => sum + Number(a.remainingBalance ?? 0), 0),
        [accounts],
    );

    if (modal) {
        return (
            <BudgetAccountModal
                account={modal.account}
                canEdit={canCreate || canEdit}
                busy={modalBusy}
                error={modalError}
                t={t}
                onCancel={() => { if (!modalBusy) setModal(null); }}
                onSubmit={submitModal}
            />
        );
    }

    if (ledger) {
        return (
            <BudgetLedgerPanel account={ledger} onClose={() => setLedger(null)} t={t} />
        );
    }

    return (
        <div className="budget-wallet-section">
            <div className="admin-wallets-panel-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Wallet size={18} />
                    <h2 className="admin-wallets-panel-title" style={{ margin: 0 }}>{t('budget.title')}</h2>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div className="admin-wallets-filters">
                        <button
                            type="button"
                            className={`admin-wallets-filter-btn${scope === 'platform_hq' ? ' active' : ''}`}
                            onClick={() => setScope('platform_hq')}
                        >
                            {t('budget.scopeHq')}
                        </button>
                        <button
                            type="button"
                            className={`admin-wallets-filter-btn${scope === 'workshop' ? ' active' : ''}`}
                            onClick={() => setScope('workshop')}
                        >
                            {t('budget.scopeWorkshop')}
                        </button>
                    </div>
                    <button type="button" className="admin-wallets-modal-btn-cancel" onClick={loadAccounts} title={t('btn.refresh')}>
                        <RefreshCw size={14} />
                    </button>
                    {canCreate ? (
                        <button type="button" className="admin-wallets-modal-btn-primary" onClick={() => { setModalError(''); setModal({}); }}>
                            <Plus size={14} /> {t('btn.newAccount')}
                        </button>
                    ) : null}
                </div>
            </div>

            {scope === 'workshop' ? (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '10px 0' }}>
                    <select
                        className="admin-wallets-modal-select"
                        style={{ maxWidth: 240 }}
                        value={filterWorkshopId}
                        onChange={(e) => { setFilterWorkshopId(e.target.value); setFilterBranchId(''); }}
                    >
                        <option value="">{t('budget.selectWorkshop')}</option>
                        {workshops.map((w) => (<option key={w.id} value={w.id}>{w.name}</option>))}
                    </select>
                    <select
                        className="admin-wallets-modal-select"
                        style={{ maxWidth: 240 }}
                        value={filterBranchId}
                        onChange={(e) => setFilterBranchId(e.target.value)}
                        disabled={!filterWorkshopId}
                    >
                        <option value="">{t('budget.selectBranch')}</option>
                        {branches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
                    </select>
                </div>
            ) : null}

            {error ? <div className="admin-wallets-alert" role="alert">{error}</div> : null}

            {scope === 'workshop' && (!filterWorkshopId || !filterBranchId) ? (
                <p style={{ color: '#64748b', padding: '16px 4px' }}>
                    {t('budget.pickScope')}
                </p>
            ) : loading ? (
                <p style={{ color: '#64748b', padding: '16px 4px' }}><Loader2 size={14} className="spin" /> {t('budget.loading')}</p>
            ) : accounts.length === 0 ? (
                <p style={{ color: '#64748b', padding: '16px 4px' }}>{t('budget.empty')}</p>
            ) : (
                <div className="admin-wallets-tx-table-wrap">
                    <table className="admin-wallets-tx-table">
                        <thead>
                            <tr>
                                <th>{t('th.name')}</th>
                                <th>{t('th.scope')}</th>
                                <th style={{ textAlign: 'right' }}>{t('th.initial')}</th>
                                <th style={{ textAlign: 'right' }}>{t('th.allocated')}</th>
                                <th style={{ textAlign: 'right' }}>{t('th.spent')}</th>
                                <th style={{ textAlign: 'right' }}>{t('th.remaining')}</th>
                                <th>{t('th.status')}</th>
                                <th style={{ textAlign: 'right' }}>{t('th.actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {accounts.map((a) => (
                                <tr key={a.id}>
                                    <td>
                                        <button
                                            type="button"
                                            onClick={() => setLedger(a)}
                                            style={{ background: 'none', border: 'none', color: '#1d4ed8', cursor: 'pointer', padding: 0, fontWeight: 600 }}
                                        >
                                            {a.name}
                                        </button>
                                        {a.code ? <span style={{ color: '#94a3b8', marginLeft: 6 }}>· {a.code}</span> : null}
                                    </td>
                                    <td>
                                        {a.scopeType === 'platform_hq'
                                            ? t('budget.scopeHq')
                                            : `${a.workshopName || t('budget.workshop')}${a.branchName ? ` · ${a.branchName}` : ''}`}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>SAR {fmt(a.initialBudget)}</td>
                                    <td style={{ textAlign: 'right' }}>SAR {fmt(a.allocatedTotal)}</td>
                                    <td style={{ textAlign: 'right' }}>SAR {fmt(a.spentTotal)}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#15803d' }}>SAR {fmt(a.remainingBalance)}</td>
                                    <td>
                                        <span className={`admin-wallets-badge admin-wallets-badge--${a.status === 'active' ? 'active' : 'inactive'}`}>
                                            {statusLabel(a.status, t)}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        {canEdit ? (
                                            <button
                                                type="button"
                                                className="admin-wallets-modal-btn-cancel"
                                                onClick={() => { setModalError(''); setModal({ account: a }); }}
                                                title={t('btn.edit')}
                                            >
                                                <Pencil size={14} />
                                            </button>
                                        ) : null}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colSpan={5} style={{ textAlign: 'right', fontWeight: 600 }}>{t('budget.totalRemaining')}</td>
                                <td style={{ textAlign: 'right', fontWeight: 700, color: '#15803d' }}>SAR {fmt(totalRemaining)}</td>
                                <td colSpan={2} />
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
        </div>
    );
}
