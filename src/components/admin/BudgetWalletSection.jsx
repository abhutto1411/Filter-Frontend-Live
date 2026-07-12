import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Pencil, Wallet, RefreshCw, X } from 'lucide-react';
import Modal from '../Modal';
import { getWorkshops, getBranches } from '../../services/superAdminApi';
import {
    listBudgetWalletAccounts,
    createBudgetWalletAccount,
    updateBudgetWalletAccount,
    listBudgetWalletTransactions,
} from '../../services/budgetWalletApi';

function fmt(value) {
    const n = Number(value ?? 0);
    return (Number.isFinite(n) ? n : 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function normalizeWorkshops(res) {
    const list = Array.isArray(res) ? res : (res?.workshops ?? res?.data ?? []);
    return (Array.isArray(list) ? list : [])
        .filter((w) => !w.isPlatformHq && !w.is_platform_hq)
        .map((w) => ({ id: String(w.id), name: w.name || `Workshop ${w.id}` }));
}

function normalizeBranches(res) {
    const list = Array.isArray(res) ? res : (res?.branches ?? res?.data ?? []);
    return (Array.isArray(list) ? list : []).map((b) => ({
        id: String(b.id),
        name: b.name || `Branch ${b.id}`,
    }));
}

function txTypeLabel(t) {
    if (t === 'allocation') return 'Allocation';
    if (t === 'expense') return 'Expense';
    if (t === 'adjustment') return 'Adjustment';
    return t;
}

function BudgetAccountModal({ account, canEdit, busy, error, onCancel, onSubmit }) {
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
            .then((res) => setWorkshops(normalizeWorkshops(res)))
            .catch(() => setWorkshops([]));
    }, [editing]);

    useEffect(() => {
        if (editing || scopeType !== 'workshop' || !workshopId) {
            setBranches([]);
            return;
        }
        getBranches({ workshopId })
            .then((res) => setBranches(normalizeBranches(res)))
            .catch(() => setBranches([]));
    }, [editing, scopeType, workshopId]);

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
        <Modal
            title={editing ? 'Edit budget account' : 'Create budget account'}
            onClose={busy ? undefined : onCancel}
            width={520}
            disableClose={busy}
            footer={(
                <div className="admin-wallets-modal-footer">
                    <button type="button" className="admin-wallets-modal-btn-cancel" disabled={busy} onClick={onCancel}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="admin-wallets-modal-btn-primary"
                        disabled={busy || !valid || !canEdit}
                        onClick={submit}
                    >
                        {busy ? <Loader2 size={14} className="spin" /> : null}
                        {editing ? 'Save changes' : 'Create account'}
                    </button>
                </div>
            )}
        >
            {error ? (
                <div className="admin-wallets-alert" role="alert" style={{ marginTop: 0 }}>{error}</div>
            ) : null}

            <label className="admin-wallets-modal-label">Account name *</label>
            <input
                className="admin-wallets-modal-select"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={busy}
                placeholder="e.g. Salary Budget Account"
            />

            <label className="admin-wallets-modal-label">Short code (optional)</label>
            <input
                className="admin-wallets-modal-select"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={busy}
                placeholder="e.g. SAL-BUD"
            />

            {!editing ? (
                <>
                    <label className="admin-wallets-modal-label">Scope *</label>
                    <select
                        className="admin-wallets-modal-select"
                        value={scopeType}
                        onChange={(e) => { setScopeType(e.target.value); setWorkshopId(''); setBranchId(''); }}
                        disabled={busy}
                    >
                        <option value="platform_hq">Platform HQ</option>
                        <option value="workshop">Workshop / Branch</option>
                    </select>

                    {scopeType === 'workshop' ? (
                        <>
                            <label className="admin-wallets-modal-label">Workshop *</label>
                            <select
                                className="admin-wallets-modal-select"
                                value={workshopId}
                                onChange={(e) => { setWorkshopId(e.target.value); setBranchId(''); }}
                                disabled={busy}
                            >
                                <option value="">Select workshop…</option>
                                {workshops.map((w) => (
                                    <option key={w.id} value={w.id}>{w.name}</option>
                                ))}
                            </select>

                            <label className="admin-wallets-modal-label">Branch *</label>
                            <select
                                className="admin-wallets-modal-select"
                                value={branchId}
                                onChange={(e) => setBranchId(e.target.value)}
                                disabled={busy || !workshopId}
                            >
                                <option value="">Select branch…</option>
                                {branches.map((b) => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                        </>
                    ) : null}

                    <label className="admin-wallets-modal-label">Initial budget (SAR) *</label>
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="admin-wallets-modal-select"
                        value={initialBudget}
                        onChange={(e) => setInitialBudget(e.target.value)}
                        disabled={busy}
                        placeholder="e.g. 50000"
                    />
                </>
            ) : (
                <>
                    <label className="admin-wallets-modal-label">Status</label>
                    <select
                        className="admin-wallets-modal-select"
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        disabled={busy}
                    >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>

                    <label className="admin-wallets-modal-label">Manual adjustment (SAR, +/-)</label>
                    <input
                        type="number"
                        step="0.01"
                        className="admin-wallets-modal-select"
                        value={adjustmentAmount}
                        onChange={(e) => setAdjustmentAmount(e.target.value)}
                        disabled={busy}
                        placeholder="e.g. 10000 to add, -5000 to reduce"
                    />
                    {adjustmentAmount !== '' && Number(adjustmentAmount) !== 0 ? (
                        <>
                            <label className="admin-wallets-modal-label">Adjustment reason</label>
                            <input
                                className="admin-wallets-modal-select"
                                value={adjustmentReason}
                                onChange={(e) => setAdjustmentReason(e.target.value)}
                                disabled={busy}
                                placeholder="Why are you adjusting this budget?"
                            />
                        </>
                    ) : null}
                </>
            )}

            <label className="admin-wallets-modal-label">Description (optional)</label>
            <textarea
                className="admin-wallets-modal-textarea"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={busy}
            />
        </Modal>
    );
}

function BudgetLedgerModal({ account, onClose }) {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError('');
        listBudgetWalletTransactions(account.id, { limit: 200 })
            .then((res) => { if (!cancelled) setRows(Array.isArray(res?.transactions) ? res.transactions : []); })
            .catch((e) => { if (!cancelled) setError(e?.message || 'Failed to load ledger'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [account.id]);

    return (
        <Modal title={`Ledger — ${account.name}`} onClose={onClose} width={720}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
                <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                    Allocated: <strong>SAR {fmt(account.allocatedTotal)}</strong>
                </span>
                <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                    Spent: <strong>SAR {fmt(account.spentTotal)}</strong>
                </span>
                <span style={{ fontSize: '0.8125rem', color: '#15803d' }}>
                    Remaining: <strong>SAR {fmt(account.remainingBalance)}</strong>
                </span>
            </div>
            {loading ? (
                <p style={{ color: '#64748b' }}><Loader2 size={14} className="spin" /> Loading…</p>
            ) : error ? (
                <p style={{ color: '#b91c1c' }}>{error}</p>
            ) : rows.length === 0 ? (
                <p style={{ color: '#64748b' }}>No transactions yet.</p>
            ) : (
                <div className="admin-wallets-tx-table-wrap">
                    <table className="admin-wallets-tx-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Type</th>
                                <th>Reference</th>
                                <th>Payment account</th>
                                <th style={{ textAlign: 'right' }}>Amount</th>
                                <th style={{ textAlign: 'right' }}>Running balance</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => (
                                <tr key={r.id}>
                                    <td>{new Date(r.createdAt).toLocaleString()}</td>
                                    <td>{txTypeLabel(r.type)}</td>
                                    <td>{r.referenceNumber || r.description || '—'}</td>
                                    <td>{r.sourceAccountName || '—'}</td>
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
        </Modal>
    );
}

export default function BudgetWalletSection({ canCreate, canEdit }) {
    const [scope, setScope] = useState('platform_hq');
    const [filterWorkshopId, setFilterWorkshopId] = useState('');
    const [filterBranchId, setFilterBranchId] = useState('');
    const [workshops, setWorkshops] = useState([]);
    const [branches, setBranches] = useState([]);

    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [modal, setModal] = useState(null); // { account? }
    const [modalBusy, setModalBusy] = useState(false);
    const [modalError, setModalError] = useState('');
    const [ledger, setLedger] = useState(null);

    useEffect(() => {
        if (scope !== 'workshop') return;
        getWorkshops({ status: 'approved' })
            .then((res) => setWorkshops(normalizeWorkshops(res)))
            .catch(() => setWorkshops([]));
    }, [scope]);

    useEffect(() => {
        if (scope !== 'workshop' || !filterWorkshopId) { setBranches([]); return; }
        getBranches({ workshopId: filterWorkshopId })
            .then((res) => setBranches(normalizeBranches(res)))
            .catch(() => setBranches([]));
    }, [scope, filterWorkshopId]);

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
            .catch((e) => setError(e?.message || 'Failed to load budget accounts'))
            .finally(() => setLoading(false));
    }, [scope, filterWorkshopId, filterBranchId]);

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
            setModalError(e?.message || 'Save failed');
        } finally {
            setModalBusy(false);
        }
    };

    const totalRemaining = useMemo(
        () => accounts.reduce((sum, a) => sum + Number(a.remainingBalance ?? 0), 0),
        [accounts],
    );

    return (
        <div className="budget-wallet-section">
            <div className="admin-wallets-panel-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Wallet size={18} />
                    <h2 className="admin-wallets-panel-title" style={{ margin: 0 }}>Budget Wallet</h2>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div className="admin-wallets-filters">
                        <button
                            type="button"
                            className={`admin-wallets-filter-btn${scope === 'platform_hq' ? ' active' : ''}`}
                            onClick={() => setScope('platform_hq')}
                        >
                            Platform HQ
                        </button>
                        <button
                            type="button"
                            className={`admin-wallets-filter-btn${scope === 'workshop' ? ' active' : ''}`}
                            onClick={() => setScope('workshop')}
                        >
                            Workshop
                        </button>
                    </div>
                    <button type="button" className="admin-wallets-modal-btn-cancel" onClick={loadAccounts} title="Refresh">
                        <RefreshCw size={14} />
                    </button>
                    {canCreate ? (
                        <button type="button" className="admin-wallets-modal-btn-primary" onClick={() => { setModalError(''); setModal({}); }}>
                            <Plus size={14} /> New account
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
                        <option value="">Select workshop…</option>
                        {workshops.map((w) => (<option key={w.id} value={w.id}>{w.name}</option>))}
                    </select>
                    <select
                        className="admin-wallets-modal-select"
                        style={{ maxWidth: 240 }}
                        value={filterBranchId}
                        onChange={(e) => setFilterBranchId(e.target.value)}
                        disabled={!filterWorkshopId}
                    >
                        <option value="">Select branch…</option>
                        {branches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
                    </select>
                </div>
            ) : null}

            {error ? <div className="admin-wallets-alert" role="alert">{error}</div> : null}

            {scope === 'workshop' && (!filterWorkshopId || !filterBranchId) ? (
                <p style={{ color: '#64748b', padding: '16px 4px' }}>
                    Select a workshop and branch to view its budget accounts.
                </p>
            ) : loading ? (
                <p style={{ color: '#64748b', padding: '16px 4px' }}><Loader2 size={14} className="spin" /> Loading…</p>
            ) : accounts.length === 0 ? (
                <p style={{ color: '#64748b', padding: '16px 4px' }}>No budget accounts yet for this scope.</p>
            ) : (
                <div className="admin-wallets-tx-table-wrap">
                    <table className="admin-wallets-tx-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Scope</th>
                                <th style={{ textAlign: 'right' }}>Initial</th>
                                <th style={{ textAlign: 'right' }}>Allocated</th>
                                <th style={{ textAlign: 'right' }}>Spent</th>
                                <th style={{ textAlign: 'right' }}>Remaining</th>
                                <th>Status</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
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
                                    <td>{a.scopeType === 'platform_hq' ? 'Platform HQ' : `${a.workshopName || 'Workshop'}${a.branchName ? ` · ${a.branchName}` : ''}`}</td>
                                    <td style={{ textAlign: 'right' }}>SAR {fmt(a.initialBudget)}</td>
                                    <td style={{ textAlign: 'right' }}>SAR {fmt(a.allocatedTotal)}</td>
                                    <td style={{ textAlign: 'right' }}>SAR {fmt(a.spentTotal)}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#15803d' }}>SAR {fmt(a.remainingBalance)}</td>
                                    <td>
                                        <span className={`admin-wallets-badge admin-wallets-badge--${a.status === 'active' ? 'active' : 'inactive'}`}>
                                            {a.status}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        {canEdit ? (
                                            <button
                                                type="button"
                                                className="admin-wallets-modal-btn-cancel"
                                                onClick={() => { setModalError(''); setModal({ account: a }); }}
                                                title="Edit"
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
                                <td colSpan={5} style={{ textAlign: 'right', fontWeight: 600 }}>Total remaining</td>
                                <td style={{ textAlign: 'right', fontWeight: 700, color: '#15803d' }}>SAR {fmt(totalRemaining)}</td>
                                <td colSpan={2} />
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}

            {modal ? (
                <BudgetAccountModal
                    account={modal.account}
                    canEdit={canCreate || canEdit}
                    busy={modalBusy}
                    error={modalError}
                    onCancel={() => { if (!modalBusy) setModal(null); }}
                    onSubmit={submitModal}
                />
            ) : null}

            {ledger ? (
                <BudgetLedgerModal account={ledger} onClose={() => setLedger(null)} />
            ) : null}
        </div>
    );
}
