import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { AlertCircle, Loader2, Plus, Pencil, Wallet, RefreshCw } from 'lucide-react';
import AdminModalAsScreen from './AdminModalAsScreen';
import { getWorkshops, getBranches } from '../../services/superAdminApi';
import {
    listBudgetWalletAccounts,
    createBudgetWalletAccount,
    updateBudgetWalletAccount,
    listBudgetWalletTransactions,
} from '../../services/budgetWalletApi';
import { awT } from '../../utils/adminWalletsI18n';
import UiPager from '../UiPager';
import { usePagedRows } from '../../hooks/usePagedRows';
import '../../styles/ui.css';

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
                <div className="ui-panel-end">
                    <button type="button" className="ui-btn ui-btn--default" disabled={busy} onClick={onCancel}>
                        {t('btn.cancel')}
                    </button>
                    <button
                        type="button"
                        className="ui-btn ui-btn--primary"
                        disabled={busy || !valid || !canEdit}
                        onClick={submit}
                    >
                        {busy ? <Loader2 size={14} className="ui-spin" /> : null}
                        {editing ? t('btn.saveChanges') : t('btn.createAccount')}
                    </button>
                </div>
            )}
        >
            {error ? (
                <div className="ui-banner ui-banner--dang" role="alert">
                    <AlertCircle size={15} />
                    <span>{error}</span>
                </div>
            ) : null}

            <label className="ui-fieldlabel">{t('budgetModal.name')}</label>
            <input
                className="ui-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={busy}
                placeholder={t('budgetModal.namePh')}
            />

            <label className="ui-fieldlabel">{t('budgetModal.code')}</label>
            <input
                className="ui-input"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={busy}
                placeholder={t('budgetModal.codePh')}
            />

            {!editing ? (
                <>
                    <label className="ui-fieldlabel">{t('budgetModal.scope')}</label>
                    <select
                        className="ui-select"
                        value={scopeType}
                        onChange={(e) => { setScopeType(e.target.value); setWorkshopId(''); setBranchId(''); }}
                        disabled={busy}
                    >
                        <option value="platform_hq">{t('budget.scopeHq')}</option>
                        <option value="workshop">{t('budget.scopeWorkshopBranch')}</option>
                    </select>

                    {scopeType === 'workshop' ? (
                        <>
                            <label className="ui-fieldlabel">{t('budgetModal.workshop')}</label>
                            <select
                                className="ui-select"
                                value={workshopId}
                                onChange={(e) => { setWorkshopId(e.target.value); setBranchId(''); }}
                                disabled={busy}
                            >
                                <option value="">{t('budget.selectWorkshop')}</option>
                                {workshops.map((w) => (
                                    <option key={w.id} value={w.id}>{w.name}</option>
                                ))}
                            </select>

                            <label className="ui-fieldlabel">{t('budgetModal.branch')}</label>
                            <select
                                className="ui-select"
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

                    <label className="ui-fieldlabel">{t('budgetModal.initial')}</label>
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="ui-input"
                        value={initialBudget}
                        onChange={(e) => setInitialBudget(e.target.value)}
                        disabled={busy}
                        placeholder={t('budgetModal.initialPh')}
                    />
                </>
            ) : (
                <>
                    <label className="ui-fieldlabel">{t('budgetModal.status')}</label>
                    <select
                        className="ui-select"
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        disabled={busy}
                    >
                        <option value="active">{t('budgetModal.active')}</option>
                        <option value="inactive">{t('budgetModal.inactive')}</option>
                    </select>

                    <label className="ui-fieldlabel">{t('budgetModal.adjustment')}</label>
                    <input
                        type="number"
                        step="0.01"
                        className="ui-input"
                        value={adjustmentAmount}
                        onChange={(e) => setAdjustmentAmount(e.target.value)}
                        disabled={busy}
                        placeholder={t('budgetModal.adjustmentPh')}
                    />
                    {adjustmentAmount !== '' && Number(adjustmentAmount) !== 0 ? (
                        <>
                            <label className="ui-fieldlabel">{t('budgetModal.adjustmentReason')}</label>
                            <input
                                className="ui-input"
                                value={adjustmentReason}
                                onChange={(e) => setAdjustmentReason(e.target.value)}
                                disabled={busy}
                                placeholder={t('budgetModal.adjustmentReasonPh')}
                            />
                        </>
                    ) : null}
                </>
            )}

            <label className="ui-fieldlabel">{t('budgetModal.description')}</label>
            <textarea
                className="ui-textarea"
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
    const paged = usePagedRows(rows);

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
            <div className="ui-fields" style={{ marginBottom: 18 }}>
                <div className="ui-fieldro">
                    <span className="ui-fieldro-label">{t('ledger.allocated')}</span>
                    <span className="ui-fieldro-value">SAR {fmt(account.allocatedTotal)}</span>
                </div>
                <div className="ui-fieldro">
                    <span className="ui-fieldro-label">{t('ledger.spent')}</span>
                    <span className="ui-fieldro-value">SAR {fmt(account.spentTotal)}</span>
                </div>
                <div className="ui-fieldro">
                    <span className="ui-fieldro-label">{t('ledger.remaining')}</span>
                    <span className="ui-fieldro-value">SAR {fmt(account.remainingBalance)}</span>
                </div>
            </div>
            {loading ? (
                <div className="ui-state">
                    <Loader2 size={18} className="ui-spin" />
                    <div className="ui-state-title">{t('budget.loading')}</div>
                </div>
            ) : error ? (
                <div className="ui-banner ui-banner--dang" role="alert">
                    <AlertCircle size={15} />
                    <span>{error}</span>
                </div>
            ) : rows.length === 0 ? (
                <div className="ui-empty">
                    <div className="ui-empty-title">{t('ledger.empty')}</div>
                </div>
            ) : (
                <div className="ui-table-wrap ui-table-wrap--scroll">
                    <table className="ui-table">
                        <thead>
                            <tr>
                                <th>{t('th.date')}</th>
                                <th>{t('th.type')}</th>
                                <th>{t('th.reference')}</th>
                                <th>{t('th.paymentAccount')}</th>
                                <th className="ui-num">{t('th.amount')}</th>
                                <th className="ui-num">{t('th.runningBalance')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paged.pagedRows.map((r) => (
                                <tr key={r.id}>
                                    <td data-label={t('th.date')} className="ui-nowrap">
                                        {new Date(r.createdAt).toLocaleString()}
                                    </td>
                                    <td data-label={t('th.type')}>{txTypeLabel(r.type, t)}</td>
                                    <td data-label={t('th.reference')}>
                                        {r.referenceNumber || r.description || t('empty.emDash')}
                                    </td>
                                    <td data-label={t('th.paymentAccount')}>
                                        {r.sourceAccountName || t('empty.emDash')}
                                    </td>
                                    <td
                                        data-label={t('th.amount')}
                                        className={`ui-num ui-money ui-money--${r.type === 'expense' ? 'out' : 'in'}`}
                                    >
                                        {r.type === 'expense' ? '-' : '+'}SAR {fmt(r.amount)}
                                    </td>
                                    <td data-label={t('th.runningBalance')} className="ui-num">
                                        SAR {fmt(r.runningBalance)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <UiPager {...paged.pagerProps} id="bw-ledger-per-page" />
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

    // The footer total covers every account in scope, not just the page shown.
    const totalRemaining = useMemo(
        () => accounts.reduce((sum, a) => sum + Number(a.remainingBalance ?? 0), 0),
        [accounts],
    );
    const paged = usePagedRows(accounts, { resetKey: `${scope}|${filterWorkshopId}|${filterBranchId}` });

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
        <div className="ui-root ui-root--flush" style={{ marginTop: 16 }}>
            <section className="ui-panel">
                <div className="ui-toolbar">
                    <Wallet size={16} />
                    <span className="ui-panel-title">{t('budget.title')}</span>
                    <div className="ui-toolbar-end" style={{ alignItems: 'center' }}>
                        <button
                            type="button"
                            className={`ui-chip${scope === 'platform_hq' ? ' ui-chip--on' : ''}`}
                            aria-pressed={scope === 'platform_hq'}
                            onClick={() => setScope('platform_hq')}
                        >
                            {t('budget.scopeHq')}
                        </button>
                        <button
                            type="button"
                            className={`ui-chip${scope === 'workshop' ? ' ui-chip--on' : ''}`}
                            aria-pressed={scope === 'workshop'}
                            onClick={() => setScope('workshop')}
                        >
                            {t('budget.scopeWorkshop')}
                        </button>
                        <button
                            type="button"
                            className="ui-btn ui-btn--icon ui-btn--default ui-btn--sm"
                            onClick={loadAccounts}
                            title={t('btn.refresh')}
                        >
                            <RefreshCw size={14} />
                        </button>
                        {canCreate ? (
                            <button
                                type="button"
                                className="ui-btn ui-btn--primary ui-btn--sm"
                                onClick={() => { setModalError(''); setModal({}); }}
                            >
                                <Plus size={14} /> {t('btn.newAccount')}
                            </button>
                        ) : null}
                    </div>
                </div>

                {scope === 'workshop' ? (
                    <div className="ui-toolbar">
                        <select
                            className="ui-select"
                            style={{ maxWidth: 240 }}
                            value={filterWorkshopId}
                            onChange={(e) => { setFilterWorkshopId(e.target.value); setFilterBranchId(''); }}
                        >
                            <option value="">{t('budget.selectWorkshop')}</option>
                            {workshops.map((w) => (<option key={w.id} value={w.id}>{w.name}</option>))}
                        </select>
                        <select
                            className="ui-select"
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

                {error ? (
                    <div className="ui-panel-pad">
                        <div className="ui-banner ui-banner--dang" role="alert">
                            <AlertCircle size={15} />
                            <span>{error}</span>
                        </div>
                    </div>
                ) : null}

                {scope === 'workshop' && (!filterWorkshopId || !filterBranchId) ? (
                    <div className="ui-empty">
                        <div className="ui-empty-title">{t('budget.pickScope')}</div>
                    </div>
                ) : loading ? (
                    <div className="ui-state">
                        <Loader2 size={18} className="ui-spin" />
                        <div className="ui-state-title">{t('budget.loading')}</div>
                    </div>
                ) : accounts.length === 0 ? (
                    <div className="ui-empty">
                        <div className="ui-empty-icon"><Wallet size={18} /></div>
                        <div className="ui-empty-title">{t('budget.empty')}</div>
                    </div>
                ) : (
                    <div className="ui-table-wrap ui-table-wrap--scroll">
                        <table className="ui-table">
                            <thead>
                                <tr>
                                    <th>{t('th.name')}</th>
                                    <th>{t('th.scope')}</th>
                                    <th className="ui-num">{t('th.initial')}</th>
                                    <th className="ui-num">{t('th.allocated')}</th>
                                    <th className="ui-num">{t('th.spent')}</th>
                                    <th className="ui-num">{t('th.remaining')}</th>
                                    <th>{t('th.status')}</th>
                                    <th aria-label={t('th.actions')} />
                                </tr>
                            </thead>
                            <tbody>
                                {paged.pagedRows.map((a) => (
                                    <tr key={a.id}>
                                        <td data-label={t('th.name')}>
                                            <button
                                                type="button"
                                                className="ui-link"
                                                onClick={() => setLedger(a)}
                                            >
                                                {a.name}
                                            </button>
                                            {a.code ? <span className="ui-list-meta">{a.code}</span> : null}
                                        </td>
                                        <td data-label={t('th.scope')}>
                                            {a.scopeType === 'platform_hq'
                                                ? t('budget.scopeHq')
                                                : `${a.workshopName || t('budget.workshop')}${a.branchName ? ` · ${a.branchName}` : ''}`}
                                        </td>
                                        <td data-label={t('th.initial')} className="ui-num">SAR {fmt(a.initialBudget)}</td>
                                        <td data-label={t('th.allocated')} className="ui-num">SAR {fmt(a.allocatedTotal)}</td>
                                        <td data-label={t('th.spent')} className="ui-num">SAR {fmt(a.spentTotal)}</td>
                                        <td data-label={t('th.remaining')} className="ui-num ui-money ui-money--in">
                                            SAR {fmt(a.remainingBalance)}
                                        </td>
                                        <td data-label={t('th.status')}>
                                            <span className={`ui-pill ui-pill--${a.status === 'active' ? 'ok' : 'neutral'}`}>
                                                {statusLabel(a.status, t)}
                                            </span>
                                        </td>
                                        <td>
                                            {canEdit ? (
                                                <div className="ui-row" style={{ justifyContent: 'flex-end' }}>
                                                    <button
                                                        type="button"
                                                        className="ui-btn ui-btn--icon ui-btn--default ui-btn--sm"
                                                        onClick={() => { setModalError(''); setModal({ account: a }); }}
                                                        title={t('btn.edit')}
                                                    >
                                                        <Pencil size={14} />
                                                    </button>
                                                </div>
                                            ) : null}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan={5} className="ui-num">{t('budget.totalRemaining')}</td>
                                    <td className="ui-num ui-money ui-money--in">SAR {fmt(totalRemaining)}</td>
                                    <td colSpan={2} />
                                </tr>
                            </tfoot>
                        </table>
                        <UiPager {...paged.pagerProps} id="bw-accounts-per-page" />
                    </div>
                )}
            </section>
        </div>
    );
}
