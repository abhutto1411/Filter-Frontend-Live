import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Loader, Plus, RotateCcw, Wallet } from 'lucide-react';
import Modal from '../../../../components/Modal';
import RowActionsMenu from '../../../../components/RowActionsMenu';
import { useStorageFacilityAccountingApi } from '../StorageFacilityPortalContext';
import { useSfT } from '../useSfT';
import { sfMoney } from '../sfFormat';
import StorageBrandLedgerView from './StorageBrandLedgerView';
import '../../../../styles/ui.css';

const CATEGORIES = ['Cash', 'Bank', 'AR', 'AP', 'Revenue', 'Expense', 'Equity', 'Other'];
const ACCOUNT_TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];

const EMPTY_FORM = {
    code: '',
    name: '',
    type: 'EXPENSE',
    accountCategory: 'Expense',
    status: 'active',
};

function AccountForm({ initial, saving, onSubmit, onCancel }) {
    const t = useSfT();
    const isEdit = !!initial?.id;
    const codeLocked = isEdit && Boolean(initial?.isAutoSeed);
    const [form, setForm] = useState(() =>
        initial
            ? {
                  code: initial.code || '',
                  name: initial.name || '',
                  type: initial.type || 'EXPENSE',
                  accountCategory: initial.accountCategory || 'Other',
                  status: initial.status || 'active',
              }
            : { ...EMPTY_FORM },
    );

    return (
        <form onSubmit={(e) => onSubmit(e, form)}>
            <div className="ui-form-grid">
                <div className="ui-field ui-col-4">
                    <label htmlFor="sf-coa-code">{t('coa.label.code')}</label>
                    <input
                        id="sf-coa-code"
                        type="text"
                        className="ui-input"
                        value={form.code}
                        onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                        required
                        disabled={codeLocked}
                    />
                    {codeLocked ? <p className="ui-help">{t('coa.codeLocked')}</p> : null}
                </div>
                <div className="ui-field ui-col-8">
                    <label htmlFor="sf-coa-name">{t('coa.label.name')}</label>
                    <input
                        id="sf-coa-name"
                        type="text"
                        className="ui-input"
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        required
                    />
                </div>
                <div className="ui-field ui-col-6">
                    <label htmlFor="sf-coa-type">{t('coa.label.type')}</label>
                    <select
                        id="sf-coa-type"
                        className="ui-select"
                        value={form.type}
                        onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                    >
                        {ACCOUNT_TYPES.map((ty) => (
                            <option key={ty} value={ty}>{t(`acct.type.${ty}`)}</option>
                        ))}
                    </select>
                </div>
                <div className="ui-field ui-col-6">
                    <label htmlFor="sf-coa-cat">{t('coa.label.category')}</label>
                    <select
                        id="sf-coa-cat"
                        className="ui-select"
                        value={form.accountCategory}
                        onChange={(e) =>
                            setForm((f) => ({ ...f, accountCategory: e.target.value }))
                        }
                    >
                        {CATEGORIES.map((c) => (
                            <option key={c} value={c}>{t(`ldg.cat.${c}`)}</option>
                        ))}
                    </select>
                </div>
                {isEdit ? (
                    <div className="ui-field ui-col-6">
                        <label htmlFor="sf-coa-status">{t('coa.label.status')}</label>
                        <select
                            id="sf-coa-status"
                            className="ui-select"
                            value={form.status}
                            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                        >
                            <option value="active">{t('coa.status.active')}</option>
                            <option value="inactive">{t('coa.status.inactive')}</option>
                        </select>
                    </div>
                ) : null}
            </div>

            {isEdit && (initial.journalLineCount ?? 0) > 0 ? (
                <div className="ui-banner ui-banner--warn">
                    <AlertTriangle size={14} />
                    <span>{t('coa.lockedHint')}</span>
                </div>
            ) : null}

            <div className="ui-form-foot">
                <button
                    type="button"
                    className="ui-btn ui-btn--default"
                    disabled={saving}
                    onClick={onCancel}
                >
                    {t('coa.btn.cancel')}
                </button>
                <button type="submit" className="ui-btn ui-btn--primary" disabled={saving}>
                    {saving ? (
                        <><Loader size={14} className="ui-spin" /> {t('coa.btn.saving')}</>
                    ) : isEdit ? t('coa.btn.saveChanges') : t('coa.btn.save')}
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
    const t = useSfT();
    const accountingApi = useStorageFacilityAccountingApi();
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [ledgerAccount, setLedgerAccount] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [saving, setSaving] = useState(false);
    const [showInactive, setShowInactive] = useState(true);
    const [reloadKey, setReloadKey] = useState(0);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await accountingApi.getBrandAccounts(brandId);
            setAccounts(accountingApi.unwrapBrandAccounts(res));
            setLoadError(false);
        } catch {
            setAccounts([]);
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    }, [brandId, accountingApi]);

    useEffect(() => {
        load();
    }, [load, reloadKey]);

    useEffect(() => {
        if (!openAccountId || accounts.length === 0) return;
        const acc = accounts.find((a) => String(a.id) === String(openAccountId));
        if (acc) {
            setLedgerAccount(acc);
            onLedgerOpened?.();
        }
    }, [openAccountId, accounts, onLedgerOpened]);

    const handleCreate = async (e, form) => {
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
            setReloadKey((k) => k + 1);
        } catch (ex) {
            window.alert(ex?.message || t('coa.errCreate'));
        } finally {
            setSaving(false);
        }
    };

    const handleUpdate = async (e, form) => {
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
            setReloadKey((k) => k + 1);
        } catch (ex) {
            window.alert(ex?.message || t('coa.errUpdate'));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (account) => {
        const vars = { code: account.code, name: account.name };
        if (!window.confirm(t('coa.confirmDelete', vars))) return;
        try {
            await accountingApi.deleteBrandAccount(brandId, account.id);
            setReloadKey((k) => k + 1);
        } catch (ex) {
            window.alert(ex?.message || t('coa.errDelete'));
        }
    };

    const toggleStatus = async (account) => {
        const next = account.status === 'active' ? 'inactive' : 'active';
        const vars = { code: account.code, name: account.name };
        const question = next === 'inactive'
            ? t('coa.confirmDeactivate', vars)
            : t('coa.confirmActivate', vars);
        if (!window.confirm(question)) return;
        try {
            await accountingApi.updateBrandAccount(brandId, account.id, { status: next });
            setReloadKey((k) => k + 1);
        } catch (ex) {
            window.alert(ex?.message || t('coa.errStatus'));
        }
    };

    if (ledgerAccount) {
        return (
            <StorageBrandLedgerView
                brandId={brandId}
                account={ledgerAccount}
                onBack={() => setLedgerAccount(null)}
            />
        );
    }

    const visible = accounts.filter((a) => showInactive || a.status !== 'inactive');
    const grouped = CATEGORIES.map((cat) => ({
        cat,
        rows: visible.filter((a) => (a.accountCategory || 'Other') === cat),
    })).filter((g) => g.rows.length > 0);

    return (
        <div className="ui-root ui-root--flush ui-stack">
            <div className="ui-row">
                <p className="ui-lead">{t('coa.lead')}</p>
                <div className="ui-toolbar-end">
                    <label className="ui-check">
                        <input
                            type="checkbox"
                            checked={showInactive}
                            onChange={(e) => setShowInactive(e.target.checked)}
                        />
                        <span className="ui-check-main">{t('coa.showInactive')}</span>
                    </label>
                    <button
                        type="button"
                        className="ui-btn ui-btn--primary ui-btn--sm"
                        onClick={() => {
                            setEditing(null);
                            setModalOpen(true);
                        }}
                    >
                        <Plus size={14} /> {t('coa.add')}
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="ui-stack" aria-busy="true">
                    {Array.from({ length: 2 }).map((_, s) => (
                        <section key={`sk-g-${s}`} className="ui-panel">
                            <div className="ui-panel-head">
                                <div className="ui-sk ui-sk--strong ui-sk--w25" />
                            </div>
                            <div className="ui-panel-body">
                                {Array.from({ length: 3 }).map((_, i) => (
                                    <div key={`sk-r-${i}`} className="ui-list-row ui-sk-row">
                                        <div className="ui-list-main">
                                            <div className="ui-sk ui-sk--strong ui-sk--w70" />
                                            <div className="ui-sk ui-sk--text ui-sk--w40" />
                                        </div>
                                        <div className="ui-sk ui-sk--text ui-sk--w25" />
                                    </div>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            ) : loadError ? (
                <div className="ui-empty">
                    <div className="ui-empty-icon"><AlertTriangle size={18} /></div>
                    <div className="ui-empty-title">{t('coa.errLoad')}</div>
                    <div className="ui-empty-sub">{t('coa.errSub')}</div>
                    <button
                        type="button"
                        className="ui-btn ui-btn--default ui-btn--sm"
                        onClick={() => setReloadKey((k) => k + 1)}
                    >
                        <RotateCcw size={13} /> {t('coa.retry')}
                    </button>
                </div>
            ) : accounts.length === 0 ? (
                <div className="ui-empty">
                    <div className="ui-empty-icon"><Wallet size={18} /></div>
                    <div className="ui-empty-title">{t('coa.emptyTitle')}</div>
                    <div className="ui-empty-sub">{t('coa.emptySub')}</div>
                </div>
            ) : (
                grouped.map(({ cat, rows }) => (
                    <section key={cat} className="ui-panel">
                        <div className="ui-panel-head">
                            <span className="ui-panel-title">{t(`ldg.cat.${cat}`)}</span>
                            <span className="ui-panel-end ui-meta">
                                {t('coa.count', { n: rows.length })}
                            </span>
                        </div>
                        <div className="ui-panel-body">
                            {rows.map((a) => {
                                const hasTx = (a.journalLineCount ?? 0) > 0;
                                const canDelete = a.canDelete ?? (!a.isAutoSeed && !hasTx);
                                const inactive = a.status === 'inactive';
                                return (
                                    <div key={a.id} className="ui-list-row">
                                        <div className="ui-list-main">
                                            {/* The name opens the ledger, so a keyboard
                                                reaches every account. */}
                                            <button
                                                type="button"
                                                className="ui-link"
                                                onClick={() => setLedgerAccount(a)}
                                            >
                                                <span className="ui-meta-ref">{a.code}</span>
                                                {a.name}
                                            </button>
                                            <span className="ui-list-meta">
                                                {t(`acct.type.${a.type}`)}
                                                {hasTx ? ` · ${t('coa.txn', { n: a.journalLineCount })}` : ''}
                                            </span>
                                        </div>
                                        {a.isAutoSeed ? (
                                            <span className="ui-pill ui-pill--neutral ui-list-end">
                                                {t('coa.system')}
                                            </span>
                                        ) : null}
                                        {inactive ? (
                                            <span className="ui-pill ui-pill--warn ui-list-end">
                                                {t('coa.inactive')}
                                            </span>
                                        ) : null}
                                        <span className="ui-list-amount">{sfMoney(t, a.balance)}</span>
                                        <div className="ui-list-end">
                                            <RowActionsMenu
                                                ariaLabel={t('coa.act.menu', {
                                                    code: a.code,
                                                    name: a.name,
                                                })}
                                                items={[
                                                    {
                                                        label: t('coa.act.edit'),
                                                        onClick: () => {
                                                            setModalOpen(false);
                                                            setEditing(a);
                                                        },
                                                    },
                                                    {
                                                        label: inactive
                                                            ? t('coa.act.activate')
                                                            : t('coa.act.deactivate'),
                                                        onClick: () => toggleStatus(a),
                                                    },
                                                    {
                                                        label: t('coa.act.delete'),
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
                    </section>
                ))
            )}

            {modalOpen ? (
                <Modal
                    title={t('coa.modal.add')}
                    width="560px"
                    // Portalled to <body>, outside this page's `.ui-root`, so
                    // the modal has to carry the design tokens itself.
                    contentClassName="ui-tokens"
                    disableClose={saving}
                    onClose={() => setModalOpen(false)}
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
                    title={t('coa.modal.edit', { code: editing.code })}
                    width="560px"
                    contentClassName="ui-tokens"
                    disableClose={saving}
                    onClose={() => setEditing(null)}
                >
                    <AccountForm
                        initial={editing}
                        saving={saving}
                        onSubmit={handleUpdate}
                        onCancel={() => !saving && setEditing(null)}
                    />
                </Modal>
            ) : null}
        </div>
    );
}
