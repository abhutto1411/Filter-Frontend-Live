import React, { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import Modal from '../../../../components/Modal';
import { useStorageFacilityAccountingApi } from '../StorageFacilityPortalContext';
import RowActionsMenu from '../../../../components/RowActionsMenu';

import {
    AcctCard,
    AcctEmpty,
    AcctError,
    AcctLoading,
    money,
    primaryBtnStyle,
} from '../../accounting/SupplierAccountingShared';
import StorageBrandLedgerView from './StorageBrandLedgerView';

const CATEGORIES = ['Cash', 'Bank', 'AR', 'AP', 'Revenue', 'Expense', 'Equity', 'Other'];

const emptyForm = {
    code: '',
    name: '',
    type: 'EXPENSE',
    accountCategory: 'Expense',
    status: 'active',
};

function AccountForm({ initial, saving, onSubmit, onCancel }) {
    const isEdit = !!initial?.id;
    const [form, setForm] = useState(() =>
        initial
            ? {
                  code: initial.code || '',
                  name: initial.name || '',
                  type: initial.type || 'EXPENSE',
                  accountCategory: initial.accountCategory || 'Other',
                  status: initial.status || 'active',
              }
            : { ...emptyForm },
    );

    return (
        <form className="sf-simple-form" onSubmit={(e) => onSubmit(e, form)}>
            <div className="sf-form-row-2">
                <div className="sf-form-field">
                    <label>Code *</label>
                    <input
                        value={form.code}
                        onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                        required
                        disabled={isEdit && initial?.isAutoSeed}
                    />
                </div>
                <div className="sf-form-field">
                    <label>Category</label>
                    <select
                        value={form.accountCategory}
                        onChange={(e) =>
                            setForm((f) => ({ ...f, accountCategory: e.target.value }))
                        }
                    >
                        {CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                                {c}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
            <div className="sf-form-field">
                <label>Name *</label>
                <input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    required
                />
            </div>
            <div className="sf-form-row-2">
                <div className="sf-form-field">
                    <label>Account type</label>
                    <select
                        value={form.type}
                        onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                    >
                        <option value="ASSET">Asset</option>
                        <option value="LIABILITY">Liability</option>
                        <option value="EQUITY">Equity</option>
                        <option value="REVENUE">Revenue</option>
                        <option value="EXPENSE">Expense</option>
                    </select>
                </div>
                {isEdit ? (
                    <div className="sf-form-field">
                        <label>Status</label>
                        <select
                            value={form.status}
                            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                        >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                    </div>
                ) : null}
            </div>
            <div className="sf-form-actions">
                <button
                    type="button"
                    className="btn-portal-outline"
                    disabled={saving}
                    onClick={onCancel}
                >
                    Cancel
                </button>
                <button type="submit" style={primaryBtnStyle} disabled={saving}>
                    {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Save account'}
                </button>
            </div>
        </form>
    );
}

export default function StorageBrandAccountsTab({
    brandId,
    openAccountId = null,
    onLedgerOpened,
}) {
    const accountingApi = useStorageFacilityAccountingApi();
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [ledgerAccount, setLedgerAccount] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [saving, setSaving] = useState(false);
    const [showInactive, setShowInactive] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const res = await accountingApi.getBrandAccounts(brandId);
            setAccounts(accountingApi.unwrapBrandAccounts(res));
        } catch (e) {
            setErr(e?.message || 'Failed to load accounts');
            setAccounts([]);
        } finally {
            setLoading(false);
        }
    }, [brandId, accountingApi]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        if (!openAccountId || accounts.length === 0) return;
        const acc = accounts.find((a) => String(a.id) === String(openAccountId));
        if (acc) {
            setLedgerAccount(acc);
            onLedgerOpened?.();
        }
    }, [openAccountId, accounts, onLedgerOpened]);

    if (ledgerAccount) {
        return (
            <StorageBrandLedgerView
                brandId={brandId}
                account={ledgerAccount}
                onBack={() => setLedgerAccount(null)}
            />
        );
    }

    async function handleCreate(e, form) {
        e.preventDefault();
        setSaving(true);
        try {
            await accountingApi.createBrandAccount(brandId, {
                code: form.code,
                name: form.name,
                type: form.type,
                accountCategory: form.accountCategory,
            });
            setModalOpen(false);
            await load();
        } catch (ex) {
            window.alert(ex?.message || 'Failed to add account');
        } finally {
            setSaving(false);
        }
    }

    async function handleUpdate(e, form) {
        e.preventDefault();
        if (!editing?.id) return;
        setSaving(true);
        try {
            await accountingApi.updateBrandAccount(brandId, editing.id, {
                code: form.code,
                name: form.name,
                type: form.type,
                accountCategory: form.accountCategory,
                status: form.status,
            });
            setEditing(null);
            await load();
        } catch (ex) {
            window.alert(ex?.message || 'Failed to update account');
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(account) {
        if (
            !window.confirm(
                `Delete account [${account.code}] ${account.name}? This cannot be undone.`,
            )
        ) {
            return;
        }
        try {
            await accountingApi.deleteBrandAccount(brandId, account.id);
            await load();
        } catch (ex) {
            window.alert(ex?.message || 'Delete failed');
        }
    }

    async function toggleStatus(account) {
        const next = account.status === 'active' ? 'inactive' : 'active';
        const label = next === 'inactive' ? 'deactivate' : 'activate';
        if (!window.confirm(`${label} [${account.code}] ${account.name}?`)) return;
        try {
            await accountingApi.updateBrandAccount(brandId, account.id, { status: next });
            await load();
        } catch (ex) {
            window.alert(ex?.message || 'Status update failed');
        }
    }

    const visible = accounts.filter(
        (a) => showInactive || a.status !== 'inactive',
    );

    const grouped = CATEGORIES.map((cat) => ({
        cat,
        rows: visible.filter((a) => (a.accountCategory || 'Other') === cat),
    })).filter((g) => g.rows.length > 0);

    return (
        <div>
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: 12,
                    flexWrap: 'wrap',
                    gap: 10,
                }}
            >
                <p style={{ margin: 0, color: '#64748b', fontSize: 14, maxWidth: 520 }}>
                    Chart of accounts for this brand. Accounts with transactions cannot be
                    deleted — set them inactive instead.
                </p>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input
                            type="checkbox"
                            checked={showInactive}
                            onChange={(e) => setShowInactive(e.target.checked)}
                        />
                        Show inactive
                    </label>
                    <button
                        type="button"
                        className="mgr-si-btn-new"
                        onClick={() => {
                            setEditing(null);
                            setModalOpen(true);
                        }}
                    >
                        <Plus size={14} /> Add account
                    </button>
                </div>
            </div>
            <AcctError message={err} />
            {loading ? (
                <AcctLoading />
            ) : accounts.length === 0 ? (
                <AcctEmpty message="No accounts yet." />
            ) : (
                grouped.map(({ cat, rows }) => (
                    <AcctCard key={cat} title={cat} style={{ marginBottom: 16 }}>
                        <div className="sf-account-list">
                            {rows.map((a) => {
                                const hasTx = (a.journalLineCount ?? 0) > 0;
                                const canDelete = a.canDelete ?? (!a.isAutoSeed && !hasTx);
                                return (
                                    <div
                                        key={a.id}
                                        className={
                                            a.status === 'inactive'
                                                ? 'sf-account-list-row sf-account-list-row--inactive'
                                                : 'sf-account-list-row'
                                        }
                                    >
                                        <button
                                            type="button"
                                            className="sf-account-list-row-main"
                                            onClick={() => setLedgerAccount(a)}
                                        >
                                            <span>
                                                <strong>
                                                    [{a.code}] {a.name}
                                                </strong>
                                                <small>
                                                    {a.type}
                                                    {a.isAutoSeed ? ' · System' : ''}
                                                    {a.status === 'inactive'
                                                        ? ' · Inactive'
                                                        : ''}
                                                    {hasTx
                                                        ? ` · ${a.journalLineCount} txn`
                                                        : ''}
                                                </small>
                                            </span>
                                            <span>{money(a.balance)}</span>
                                        </button>
                                        <div
                                            className="sf-account-list-actions"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <RowActionsMenu
                                                ariaLabel={`Actions for [${a.code}] ${a.name}`}
                                                items={[
                                                    {
                                                        label: 'Edit',
                                                        onClick: () => {
                                                            setModalOpen(false);
                                                            setEditing(a);
                                                        },
                                                    },
                                                    {
                                                        label:
                                                            a.status === 'active' ? 'Inactive' : 'Active',
                                                        onClick: () => toggleStatus(a),
                                                    },
                                                    {
                                                        label: 'Delete',
                                                        onClick: () => handleDelete(a),
                                                        hidden: !canDelete,
                                                        danger: true,
                                                    },
                                                ]}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </AcctCard>
                ))
            )}

            {modalOpen ? (
                <Modal
                    title="Add account"
                    width="520px"
                    contentClassName="sf-simple-modal"
                    onClose={() => !saving && setModalOpen(false)}
                >
                    <AccountForm
                        saving={saving}
                        onSubmit={handleCreate}
                        onCancel={() => !saving && setModalOpen(false)}
                    />
                </Modal>
            ) : null}

            {editing ? (
                <Modal
                    title={`Edit — [${editing.code}]`}
                    width="520px"
                    contentClassName="sf-simple-modal"
                    onClose={() => !saving && setEditing(null)}
                >
                    <AccountForm
                        initial={editing}
                        saving={saving}
                        onSubmit={handleUpdate}
                        onCancel={() => !saving && setEditing(null)}
                    />
                    {editing.journalLineCount > 0 ? (
                        <p
                            style={{
                                fontSize: 12,
                                color: '#B45309',
                                marginTop: 12,
                                marginBottom: 0,
                            }}
                        >
                            This account has posted transactions. Deletion is blocked — use
                            Inactive if you no longer want it on new entries.
                        </p>
                    ) : null}
                </Modal>
            ) : null}
        </div>
    );
}
