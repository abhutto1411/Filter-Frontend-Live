import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import {
    createAccount,
    deleteAccount,
    getAccounts,
    getAccountsTree,
    updateAccount,
} from '../../services/accountsApi';
import {
    ACCOUNT_SUBTYPES_BY_TYPE,
    ACCOUNT_TYPES,
    AcctCard,
    AcctError,
    AcctLoading,
    CASH_FLOW_CATEGORIES,
    Field,
    dangerBtnStyle,
    inputStyle,
    money,
    outlineBtnStyle,
    primaryBtnStyle,
    formatCoaBalance,
} from '../../pages/supplier/accounting/SupplierAccountingShared';
import { useAccountingWorkshopScope } from '../../context/AccountingWorkshopScopeContext';
import { HQ_COA_CONTROL_BADGES } from '../../pages/admin/hqCoaAccountRouting';
import {
    filterWorkshopPettyCashCoaList,
    isWorkshopPettyCashCoaControlAccount,
    pruneWorkshopPettyCashCoaTree,
} from '../../pages/workshop/workshopCoaAccountRouting';

const HQ_CASHIER_CODE_RE = /^10(01|03|11)-(C|U)\d+/i;
const HQ_STAFF_PETTY_RE = /^1003-E\d+/i;

function isHqCashierNoiseAccount(account) {
    const code = String(account?.code ?? '').trim();
    if (HQ_STAFF_PETTY_RE.test(code)) return false;
    if (HQ_CASHIER_CODE_RE.test(code)) return true;
    const name = (account?.name ?? '').toLowerCase();
    return (
        name.includes('cashier cash till') ||
        name.includes('cashier petty cash wallet') ||
        name.includes('cashier card till')
    );
}

const HQ_HIDDEN_WORKSHOP_CODES = new Set([
    '1004',
    '1150',
    '1151',
    '1152',
    '1153',
    '1200',
    '4500',
    '4700',
    '5000',
    '2310',
]);

function shouldHideFromHqCoa(account) {
    if (isHqCashierNoiseAccount(account)) return true;
    const code = String(account?.code ?? '').trim();
    if (HQ_HIDDEN_WORKSHOP_CODES.has(code)) return true;
    // Workshop POS sub-registers (e.g. 100101) are not HQ books.
    if (/^10010\d+$/i.test(code)) return true;
    return false;
}

function filterHqBooksAccounts(list, hqBooks) {
    if (!hqBooks) return list;
    return (list || []).filter((a) => !shouldHideFromHqCoa(a));
}

function filterHqBooksTree(nodes, hqBooks) {
    if (!hqBooks) return nodes;
    const walk = (node) => {
        const children = (node.children || []).map(walk).filter(Boolean);
        if (shouldHideFromHqCoa(node)) return null;
        return { ...node, children };
    };
    return (nodes || []).map(walk).filter(Boolean);
}

const TYPE_LABELS = {
    ASSET: 'Assets',
    LIABILITY: 'Liabilities',
    EQUITY: 'Equity',
    INCOME: 'Revenue',
    EXPENSE: 'Expenses',
};

const parseArr = (res) => {
    if (Array.isArray(res)) return res;
    if (res && Array.isArray(res.data)) return res.data;
    if (res && Array.isArray(res.list)) return res.list;
    return [];
};

function buildRollupMap(nodes) {
    const map = new Map();
    function walk(node) {
        const kids = node.children || [];
        if (!kids.length) {
            const rd = Number(node.closingDebit) || 0;
            const rc = Number(node.closingCredit) || 0;
            map.set(node.id, { rollupDebit: rd, rollupCredit: rc, hasChildren: false });
            return { rd, rc };
        }
        let rd = 0;
        let rc = 0;
        for (const k of kids) {
            const x = walk(k);
            rd += x.rd;
            rc += x.rc;
        }
        map.set(node.id, { rollupDebit: rd, rollupCredit: rc, hasChildren: true });
        return { rd, rc };
    }
    for (const n of nodes || []) walk(n);
    return map;
}

function emptyForm() {
    return {
        id: null,
        code: '',
        name: '',
        type: 'ASSET',
        subType: 'CURRENT',
        parentId: '',
        description: '',
        status: 'active',
        cashFlowCategory: '',
        isCashEquivalent: false,
        cashBankRegisterType: '',
        bankName: '',
        iban: '',
        accountNumber: '',
        openingBalance: 0,
        openingBalanceDate: todayISO(),
        openingOffsetAccountId: '',
    };
}

function formFromInitial(initial) {
    if (!initial?.id) return emptyForm();
    return {
        ...emptyForm(),
        ...initial,
        id: initial.id,
        code: initial.code != null ? String(initial.code) : '',
        name: initial.name != null ? String(initial.name) : '',
        type: initial.type || 'ASSET',
        subType: initial.subType || 'CURRENT',
        parentId: initial.parentId != null ? String(initial.parentId) : '',
        description: initial.description != null ? String(initial.description) : '',
        status: initial.status || 'active',
        cashFlowCategory: initial.cashFlowCategory != null ? String(initial.cashFlowCategory) : '',
        isCashEquivalent: !!initial.isCashEquivalent,
        cashBankRegisterType: initial.cashBankRegisterType || '',
        bankName: initial.bankName || '',
        iban: initial.iban || '',
        accountNumber: initial.accountNumber || '',
        openingBalance: initial.openingBalance ?? 0,
        openingBalanceDate: initial.openingBalanceDate
            ? String(initial.openingBalanceDate).slice(0, 10)
            : todayISO(),
        openingOffsetAccountId: initial.openingOffsetAccountId
            ? String(initial.openingOffsetAccountId)
            : '',
    };
}

function AccountForm({ initial, accounts, onCancel, onSaved, readOnly }) {
    const [form, setForm] = useState(() => formFromInitial(initial));
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');
    const isEdit = !!initial?.id;

    useEffect(() => {
        setForm(formFromInitial(initial));
    }, [initial?.id]);

    const equityContraOptions = useMemo(() => {
        return (accounts || []).filter(
            (a) =>
                a.type === 'EQUITY' &&
                String(a.id) !== String(form.id) &&
                a.code !== '3190',
        );
    }, [accounts, form.id]);

    const subtypes = ACCOUNT_SUBTYPES_BY_TYPE[form.type] || ['OTHER'];

    useEffect(() => {
        if (!subtypes.includes(form.subType)) {
            setForm((f) => ({ ...f, subType: subtypes[0] }));
        }
    }, [form.type]); // eslint-disable-line

    const parentOptions = (accounts || []).filter(
        (a) =>
            a.type === form.type &&
            String(a.id) !== String(form.id) &&
            (a.hasChildren || a.isHeading || (a.isAutoSeed && !a.parentId)),
    );

    const selectedParent = parentOptions.find((p) => String(p.id) === String(form.parentId));
    const showCashBankRegister =
        form.type === 'ASSET' &&
        (form.isCashEquivalent ||
            selectedParent?.code === '1000' ||
            selectedParent?.code === '1010' ||
            /petty/i.test(String(form.name || '')));

    function inferCashBankRegisterType() {
        if (form.cashBankRegisterType) return form.cashBankRegisterType;
        if (selectedParent?.code === '1010') return 'BANK';
        if (/petty/i.test(String(form.name || ''))) return 'PETTY_CASH';
        if (form.isCashEquivalent || selectedParent?.code === '1000') return 'CASH';
        return '';
    }

    async function submit(e) {
        e.preventDefault();
        if (readOnly) return;
        setErr('');
        setSaving(true);
        try {
            const ob = Number(form.openingBalance || 0);
            const body = {
                name: String(form.name ?? '').trim(),
                type: form.type,
                subType: form.subType,
                parentId: form.parentId || undefined,
                description: String(form.description ?? '').trim() || undefined,
                status: form.status,
                cashFlowCategory: form.cashFlowCategory || undefined,
                isCashEquivalent: !!form.isCashEquivalent,
                openingBalance: ob,
            };
            const registerType = inferCashBankRegisterType();
            if (showCashBankRegister && registerType) {
                body.cashBankRegisterType = registerType;
                if (registerType === 'BANK') {
                    body.bankName = String(form.bankName ?? '').trim() || undefined;
                    body.iban = String(form.iban ?? '').trim() || undefined;
                    body.accountNumber = String(form.accountNumber ?? '').trim() || undefined;
                }
            }
            if (Math.abs(ob) >= 0.005) {
                body.openingBalanceDate = (form.openingBalanceDate || todayISO()).slice(0, 10);
            } else {
                body.openingBalanceDate = '';
            }
            if (isEdit) {
                body.openingOffsetAccountId = form.openingOffsetAccountId
                    ? String(form.openingOffsetAccountId)
                    : '';
            } else if (form.openingOffsetAccountId) {
                body.openingOffsetAccountId = String(form.openingOffsetAccountId);
            }
            const codeTrim = String(form.code ?? '').trim();
            if (codeTrim) body.code = codeTrim;
            if (isEdit) {
                await updateAccount(form.id, body);
            } else {
                await createAccount(body);
            }
            onSaved();
        } catch (e) {
            setErr(e?.message || 'Failed to save account');
        } finally {
            setSaving(false);
        }
    }

    return (
        <form
            onSubmit={submit}
            style={{
                display: 'grid',
                gap: 12,
                gridTemplateColumns: 'repeat(2, minmax(200px, 1fr))',
                padding: 14,
                background: '#F8FAFC',
                borderRadius: 12,
                border: '1px solid rgba(0,0,0,0.06)',
            }}
        >
            <Field
                label="Account code"
                hint="Optional. Seeded chart uses 1000–6999 (e.g. 1100 is already AR). Leave blank to auto-generate a unique code."
            >
                <input
                    style={inputStyle}
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="e.g. 6210 — or leave blank"
                    disabled={readOnly || isEdit}
                />
            </Field>
            <Field label="Name" required>
                <input
                    style={inputStyle}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Account name"
                    required
                    disabled={readOnly}
                />
            </Field>
            <Field label="Type" required>
                <select
                    style={inputStyle}
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    disabled={readOnly}
                >
                    {ACCOUNT_TYPES.map((t) => (
                        <option key={t} value={t}>{TYPE_LABELS[t] || t}</option>
                    ))}
                </select>
            </Field>
            <Field label="Sub-type" required>
                <select
                    style={inputStyle}
                    value={form.subType}
                    onChange={(e) => setForm({ ...form, subType: e.target.value })}
                    disabled={readOnly}
                >
                    {subtypes.map((s) => (
                        <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                    ))}
                </select>
            </Field>
            <Field label="Parent" hint="Heading accounts only — transactions post to child (detail) accounts.">
                <select
                    style={inputStyle}
                    value={form.parentId || ''}
                    onChange={(e) => {
                        const parentId = e.target.value;
                        const parent = parentOptions.find((p) => String(p.id) === String(parentId));
                        setForm((f) => ({
                            ...f,
                            parentId,
                            ...(parent?.code === '1000' || parent?.code === '1010'
                                ? { isCashEquivalent: true }
                                : {}),
                            ...(parent?.code === '1010' && !f.cashBankRegisterType
                                ? { cashBankRegisterType: 'BANK' }
                                : {}),
                            ...(parent?.code === '1000' && !f.cashBankRegisterType
                                ? { cashBankRegisterType: 'CASH' }
                                : {}),
                        }));
                    }}
                    disabled={readOnly}
                >
                    <option value="">— None —</option>
                    {parentOptions.map((p) => (
                        <option key={p.id} value={p.id}>
                            [{p.code}] {p.name}
                        </option>
                    ))}
                </select>
            </Field>
            <Field label="Cash flow category" hint="Tag cash/bank accounts so they show up in the Cash Flow statement.">
                <select
                    style={inputStyle}
                    value={form.cashFlowCategory || ''}
                    onChange={(e) => setForm({ ...form, cashFlowCategory: e.target.value })}
                    disabled={readOnly}
                >
                    {CASH_FLOW_CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c || '— Auto —'}</option>
                    ))}
                </select>
            </Field>
            <Field label="Opening balance">
                <input
                    type="number"
                    step="0.01"
                    style={inputStyle}
                    value={form.openingBalance}
                    onChange={(e) => setForm({ ...form, openingBalance: e.target.value })}
                    disabled={readOnly}
                />
            </Field>
            <Field
                label="Opening balance date"
                hint="Date this opening balance applies from. Used as the journal date for the opening entry. Required when opening balance is not zero."
            >
                <input
                    type="date"
                    style={inputStyle}
                    value={form.openingBalanceDate || ''}
                    onChange={(e) =>
                        setForm({ ...form, openingBalanceDate: e.target.value })
                    }
                    disabled={readOnly}
                />
            </Field>
            <Field
                label="Opening contra (equity)"
                hint="Optional. Positive = normal side for this account type (e.g. debit for cash). If empty, the other leg posts to system account 3190 Opening balance suspense."
            >
                <select
                    style={inputStyle}
                    value={form.openingOffsetAccountId || ''}
                    onChange={(e) =>
                        setForm({ ...form, openingOffsetAccountId: e.target.value })
                    }
                    disabled={readOnly}
                >
                    <option value="">— Use opening suspense (3190) —</option>
                    {equityContraOptions.map((a) => (
                        <option key={a.id} value={a.id}>
                            [{a.code}] {a.name}
                        </option>
                    ))}
                </select>
            </Field>
            <Field label="Status">
                <select
                    style={inputStyle}
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    disabled={readOnly}
                >
                    <option value="active">active</option>
                    <option value="inactive">inactive</option>
                </select>
            </Field>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, gridColumn: '1 / -1' }}>
                <input
                    type="checkbox"
                    checked={!!form.isCashEquivalent}
                    onChange={(e) => setForm({ ...form, isCashEquivalent: e.target.checked })}
                    disabled={readOnly}
                />
                Treat as a cash equivalent (cash/bank). Used by Cash Flow report scope.
            </label>
            {showCashBankRegister ? (
                <>
                    <Field
                        label="Cash & Bank register"
                        hint="Also creates a register on the Cash & Bank page (linked to this COA account)."
                    >
                        <select
                            style={inputStyle}
                            value={form.cashBankRegisterType || ''}
                            onChange={(e) =>
                                setForm({ ...form, cashBankRegisterType: e.target.value })
                            }
                            disabled={readOnly}
                        >
                            <option value="">— COA only (no register) —</option>
                            <option value="CASH">Cash register</option>
                            <option value="BANK">Bank register</option>
                            <option value="PETTY_CASH">Petty cash register</option>
                        </select>
                    </Field>
                    {form.cashBankRegisterType === 'BANK' ? (
                        <>
                            <Field label="Bank name">
                                <input
                                    style={inputStyle}
                                    value={form.bankName}
                                    onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                                    disabled={readOnly}
                                />
                            </Field>
                            <Field label="IBAN">
                                <input
                                    style={inputStyle}
                                    value={form.iban}
                                    onChange={(e) => setForm({ ...form, iban: e.target.value })}
                                    disabled={readOnly}
                                />
                            </Field>
                            <Field label="Account number">
                                <input
                                    style={inputStyle}
                                    value={form.accountNumber}
                                    onChange={(e) =>
                                        setForm({ ...form, accountNumber: e.target.value })
                                    }
                                    disabled={readOnly}
                                />
                            </Field>
                        </>
                    ) : null}
                </>
            ) : null}
            <Field label="Description">
                <textarea
                    rows={2}
                    style={{ ...inputStyle, fontFamily: 'inherit' }}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    disabled={readOnly}
                />
            </Field>
            {err ? <div style={{ gridColumn: '1 / -1' }}><AcctError message={err} /></div> : null}
            {!readOnly ? (
                <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button type="button" style={outlineBtnStyle} onClick={onCancel} disabled={saving}>Cancel</button>
                    <button type="submit" style={primaryBtnStyle} disabled={saving}>
                        {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create account'}
                    </button>
                </div>
            ) : null}
        </form>
    );
}

export default function WorkshopCOAManager({
    readOnly = false,
    dateRange,
    enableLedgerLinks = false,
    buildLedgerUrl,
}) {
    const { hqBooks, workshopId: scopeWorkshopId } = useAccountingWorkshopScope();
    const navigate = useNavigate();
    const [accounts, setAccounts] = useState([]);
    const [tree, setTree] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [view, setView] = useState('tree');
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState('');
    const [creating, setCreating] = useState(false);
    const [editing, setEditing] = useState(null);

    const reload = useCallback(async () => {
        if (hqBooks && !scopeWorkshopId) {
            setAccounts([]);
            setTree([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        setErr('');
        try {
            const dateParams =
                dateRange?.dateFrom || dateRange?.dateTo
                    ? {
                          ...(dateRange.dateFrom ? { dateFrom: dateRange.dateFrom } : {}),
                          ...(dateRange.dateTo ? { dateTo: dateRange.dateTo } : {}),
                      }
                    : {};
            const scopeParams = {
                ...dateParams,
                ...(scopeWorkshopId ? { workshopId: scopeWorkshopId } : {}),
                ...(hqBooks ? { hqBooks: 'true' } : {}),
            };
            const [flat, t] = await Promise.all([
                getAccounts(scopeParams),
                getAccountsTree(scopeParams),
            ]);
            const flatList = filterHqBooksAccounts(parseArr(flat), hqBooks);
            const visibleFlat = hqBooks
                ? flatList
                : filterWorkshopPettyCashCoaList(flatList);
            const byId = new Map(visibleFlat.map((a) => [String(a.id), a]));
            const enrichTree = (nodes) =>
                (nodes || []).map((n) => ({
                    ...n,
                    closingDebit: byId.get(String(n.id))?.closingDebit ?? 0,
                    closingCredit: byId.get(String(n.id))?.closingCredit ?? 0,
                    isAutoSeed: byId.get(String(n.id))?.isAutoSeed ?? n.isAutoSeed,
                    hasChildren: byId.get(String(n.id))?.hasChildren ?? n.hasChildren,
                    isHeading: byId.get(String(n.id))?.isHeading ?? n.isHeading,
                    children: enrichTree(n.children),
                }));
            setAccounts(visibleFlat);
            const rawTree = hqBooks
                ? filterHqBooksTree(parseArr(t), hqBooks)
                : pruneWorkshopPettyCashCoaTree(parseArr(t));
            setTree(enrichTree(rawTree));
        } catch (e) {
            setErr(e?.message || 'Failed to load chart of accounts');
        } finally {
            setLoading(false);
        }
    }, [dateRange?.dateFrom, dateRange?.dateTo, hqBooks, scopeWorkshopId]);

    useEffect(() => {
        reload();
    }, [reload]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return (accounts || []).filter((a) => {
            if (filterType && a.type !== filterType) return false;
            if (!q) return true;
            return (
                (a.name || '').toLowerCase().includes(q) ||
                String(a.code || '').toLowerCase().includes(q)
            );
        });
    }, [accounts, search, filterType]);

    const treeRootsFiltered = useMemo(() => {
        const q = search.trim().toLowerCase();
        const matches = (a) =>
            (a.name || '').toLowerCase().includes(q) ||
            String(a.code || '').toLowerCase().includes(q) ||
            (a.children || []).some(matches);
        return (tree || [])
            .filter((n) => !filterType || n.type === filterType)
            .filter((n) => !q || matches(n));
    }, [tree, filterType, search]);

    const treeVisibleRowCount = useMemo(() => {
        let c = 0;
        const walk = (node) => {
            c += 1;
            for (const ch of node.children || []) walk(ch);
        };
        for (const n of treeRootsFiltered) walk(n);
        return c;
    }, [treeRootsFiltered]);

    const rollupById = useMemo(() => {
        const map = buildRollupMap(tree);
        for (const a of accounts || []) {
            if (!a.hasChildren && !a.isHeading) continue;
            const rd = Number(a.closingDebit) || 0;
            const rc = Number(a.closingCredit) || 0;
            map.set(a.id, { rollupDebit: rd, rollupCredit: rc, hasChildren: true });
        }
        return map;
    }, [tree, accounts]);

    async function handleDelete(id) {
        if (!confirm('Delete this account? System-seeded and posted accounts cannot be deleted.')) return;
        try {
            await deleteAccount(id);
            await reload();
        } catch (e) {
            alert(e?.message || 'Delete failed');
        }
    }

    function renderRow(a, depth = 0) {
        const roll = rollupById.get(a.id);
        const hasChildren =
            (a.children && a.children.length > 0) ||
            !!a.hasChildren ||
            (roll?.hasChildren ?? false);
        const rd = roll ? roll.rollupDebit : Number(a.closingDebit) || 0;
        const rc = roll ? roll.rollupCredit : Number(a.closingCredit) || 0;
        const pad = depth * 18;

        const ledgerUrl =
            enableLedgerLinks &&
            buildLedgerUrl &&
            (!hasChildren || isWorkshopPettyCashCoaControlAccount(a))
                ? buildLedgerUrl(a)
                : null;
        const accountLabel = `[${a.code}] ${a.name}`;
        const controlBadge = HQ_COA_CONTROL_BADGES[String(a.code)];

        return (
            <tr
                key={a.id}
                className={ledgerUrl ? 'sa-acc-row-clickable' : undefined}
                onClick={ledgerUrl ? () => navigate(ledgerUrl) : undefined}
                onKeyDown={ledgerUrl ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate(ledgerUrl);
                    }
                } : undefined}
                tabIndex={ledgerUrl ? 0 : undefined}
                role={ledgerUrl ? 'link' : undefined}
            >
                <td style={{ paddingLeft: 12 + pad }}>
                    {ledgerUrl ? (
                        <Link to={ledgerUrl} className="sa-acc-ledger-link" onClick={(e) => e.stopPropagation()}>
                            {accountLabel}
                        </Link>
                    ) : (
                        accountLabel
                    )}
                    {a.isAutoSeed ? (
                        <span style={{ marginLeft: 8, fontSize: 10, padding: '2px 6px', borderRadius: 999, background: '#E0F2FE', color: '#075985', fontWeight: 700 }}>
                            System
                        </span>
                    ) : null}
                    {controlBadge ? (
                        <span style={{
                            marginLeft: 8,
                            fontSize: 10,
                            padding: '2px 6px',
                            borderRadius: 999,
                            background: controlBadge.background,
                            color: controlBadge.color,
                            fontWeight: 700,
                        }}>
                            {controlBadge.label}
                        </span>
                    ) : null}
                    {hasChildren ? (
                        <span style={{ marginLeft: 8, fontSize: 10, padding: '2px 6px', borderRadius: 999, background: '#FEF3C7', color: '#92400E', fontWeight: 700 }}>
                            Heading
                        </span>
                    ) : null}
                </td>
                <td>{a.type}</td>
                <td>{String(a.subType || '').replace(/_/g, ' ') || '—'}</td>
                <td style={{ textAlign: 'right' }}>{Number(rd) > 0 ? money(rd) : '—'}</td>
                <td style={{ textAlign: 'right' }}>{Number(rc) > 0 ? money(rc) : '—'}</td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatCoaBalance(a.type, rd, rc)}</td>
                <td style={{ textAlign: 'right' }}>
                    {!readOnly && !a.isAutoSeed && !hasChildren ? (
                        <>
                            <button type="button" style={outlineBtnStyle} onClick={() => { setEditing(a); setCreating(false); }} title="Edit">
                                <Pencil size={14} />
                            </button>
                            <button type="button" style={{ ...dangerBtnStyle, marginLeft: 6 }} onClick={() => handleDelete(a.id)} title="Delete">
                                <Trash2 size={14} />
                            </button>
                        </>
                    ) : null}
                </td>
            </tr>
        );
    }

    function renderTreeNode(node, depth) {
        const rows = [renderRow(node, depth)];
        if (node.children?.length) {
            for (const child of node.children) {
                rows.push(...renderTreeNode(child, depth + 1));
            }
        }
        return rows;
    }

    return (
        <div className="chart-of-accounts-view" style={{ padding: 0 }}>
            <AcctCard
                title="Chart of Accounts"
                action={(
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <select style={{ ...inputStyle, width: 'auto' }} value={view} onChange={(e) => setView(e.target.value)}>
                            <option value="tree">Tree view</option>
                            <option value="flat">Flat list</option>
                        </select>
                        <select style={{ ...inputStyle, width: 'auto' }} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                            <option value="">All types</option>
                            {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t] || t}</option>)}
                        </select>
                        <input
                            type="search"
                            placeholder="Search by code/name"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={{ ...inputStyle, width: 200 }}
                        />
                        {!readOnly ? (
                            <button
                                type="button"
                                className="btn-portal"
                                onClick={() => { setCreating(true); setEditing(null); }}
                            >
                                <Plus size={14} /> New Account
                            </button>
                        ) : null}
                    </div>
                )}
            >
                {(creating || editing) && !readOnly ? (
                    <div style={{ marginBottom: 14 }}>
                        <AccountForm
                            initial={editing}
                            accounts={accounts}
                            onCancel={() => { setCreating(false); setEditing(null); }}
                            onSaved={() => { setCreating(false); setEditing(null); reload(); }}
                        />
                    </div>
                ) : null}

                <AcctError message={err} />
                {loading ? <AcctLoading label="Loading accounts…" /> : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="ws-table premium-table" style={{ width: '100%' }}>
                            <thead>
                                <tr>
                                    <th>Account</th>
                                    <th>Type</th>
                                    <th>Sub-type</th>
                                    <th style={{ textAlign: 'right' }}>Debit Bal</th>
                                    <th style={{ textAlign: 'right' }}>Credit Bal</th>
                                    <th style={{ textAlign: 'right' }}>Balance</th>
                                    {!readOnly ? <th style={{ textAlign: 'right' }}>Actions</th> : null}
                                </tr>
                            </thead>
                            <tbody>
                                {view === 'tree'
                                    ? treeRootsFiltered.flatMap((n) => renderTreeNode(n, 0))
                                    : filtered.map((a) => renderRow(a, 0))}
                                {!loading &&
                                    (view === 'tree' ? treeVisibleRowCount === 0 : filtered.length === 0) && (
                                    <tr>
                                        <td colSpan={readOnly ? 6 : 7} style={{ textAlign: 'center', padding: 32, color: '#64748B' }}>
                                            {accounts.length === 0
                                                ? 'No accounts in chart yet — use New Account to add one.'
                                                : 'No accounts match your filters.'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </AcctCard>
        </div>
    );
}
