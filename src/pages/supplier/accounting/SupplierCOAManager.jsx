import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    ChevronDown,
    ChevronRight,
    Plus,
} from 'lucide-react';
import Modal from '../../../components/Modal';
import RowActionsMenu from '../../../components/RowActionsMenu';
import {
    createSupplierAccount,
    deleteSupplierAccount,
    getSupplierAccounts,
    getSupplierAccountsTree,
    unwrapSupplierAccountingList,
    updateSupplierAccount,
} from '../../../services/supplierAccountingApi';
import {
    ACCOUNT_SUBTYPES_BY_TYPE,
    ACCOUNT_TYPES,
    AcctCard,
    AcctEmpty,
    AcctError,
    AcctLoading,
    CASH_FLOW_CATEGORIES,
    Field,
    dangerBtnStyle,
    fmtDate,
    inputStyle,
    money,
    outlineBtnStyle,
    primaryBtnStyle,
    startOfMonthISO,
    todayISO,
    coaNetBalance,
    formatCoaBalance,
} from './SupplierAccountingShared';
import { saccT } from '../../../utils/supplierAccountingI18n';

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

const TYPE_LABEL_KEYS = {
    ASSET: 'type.ASSET',
    LIABILITY: 'type.LIABILITY',
    EQUITY: 'type.EQUITY',
    INCOME: 'type.INCOME',
    EXPENSE: 'type.EXPENSE',
};

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
        openingBalance: initial.openingBalance ?? 0,
        openingBalanceDate: initial.openingBalanceDate
            ? String(initial.openingBalanceDate).slice(0, 10)
            : todayISO(),
        openingOffsetAccountId: initial.openingOffsetAccountId
            ? String(initial.openingOffsetAccountId)
            : '',
    };
}

function AccountForm({ initial, accounts, onCancel, onSaved, locale, t }) {
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
                !a.hasChildren &&
                String(a.id) !== String(form.id) &&
                a.seedKey !== 'OPENING_SUSPENSE',
        );
    }, [accounts, form.id]);

    const subtypes = ACCOUNT_SUBTYPES_BY_TYPE[form.type] || ['OTHER'];

    useEffect(() => {
        if (!subtypes.includes(form.subType)) {
            setForm((f) => ({ ...f, subType: subtypes[0] }));
        }
    }, [form.type]); // eslint-disable-line

    const parentOptions = (accounts || []).filter(
        (a) => a.type === form.type && a.id !== form.id,
    );

    async function submit(e) {
        e.preventDefault();
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
                await updateSupplierAccount(form.id, body);
            } else {
                await createSupplierAccount(body);
            }
            onSaved();
        } catch (e) {
            setErr(e?.message || t('coa.err.save'));
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
            <Field label={t('coa.form.code')} hint={t('coa.form.codeHint')}>
                <input
                    style={inputStyle}
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder={t('coa.form.codePh') || t('coa.form.codeHint')}
                />
            </Field>
            <Field label={t('coa.form.name')} required>
                <input
                    style={inputStyle}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder={t('coa.form.namePh')}
                    required
                />
            </Field>
            <Field label={t('coa.form.type')} required>
                <select
                    style={inputStyle}
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                    {ACCOUNT_TYPES.map((typeKey) => (
                        <option key={typeKey} value={typeKey}>
                            {t(TYPE_LABEL_KEYS[typeKey] || typeKey)}
                        </option>
                    ))}
                </select>
            </Field>
            <Field label={t('coa.form.subType')} required>
                <select
                    style={inputStyle}
                    value={form.subType}
                    onChange={(e) => setForm({ ...form, subType: e.target.value })}
                >
                    {subtypes.map((s) => (
                        <option key={s} value={s}>{t(`subtype.${s}`) || s.replace(/_/g, ' ')}</option>
                    ))}
                </select>
            </Field>
            <Field label={t('coa.form.parent')}>
                <select
                    style={inputStyle}
                    value={form.parentId || ''}
                    onChange={(e) => setForm({ ...form, parentId: e.target.value })}
                >
                    <option value="">{t('coa.form.parentNone')}</option>
                    {parentOptions.map((p) => (
                        <option key={p.id} value={p.id}>
                            [{p.code}] {p.name}
                        </option>
                    ))}
                </select>
            </Field>
            <Field label={t('coa.form.cashFlow')} hint={t('coa.form.cashFlowHint')}>
                <select
                    style={inputStyle}
                    value={form.cashFlowCategory || ''}
                    onChange={(e) => setForm({ ...form, cashFlowCategory: e.target.value })}
                >
                    {CASH_FLOW_CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c ? (t(`cfCat.${c}`) || c) : t('coa.form.cashFlowAuto')}</option>
                    ))}
                </select>
            </Field>
            <Field label={t('coa.form.openingBal')}>
                <input
                    type="number"
                    step="0.01"
                    style={inputStyle}
                    value={form.openingBalance}
                    onChange={(e) => setForm({ ...form, openingBalance: e.target.value })}
                />
            </Field>
            <Field label={t('coa.form.openingDate')} hint={t('coa.form.openingDateHint')}>
                <input
                    type="date"
                    style={inputStyle}
                    value={form.openingBalanceDate || ''}
                    onChange={(e) =>
                        setForm({ ...form, openingBalanceDate: e.target.value })
                    }
                />
            </Field>
            <Field label={t('coa.form.openingContra')} hint={t('coa.form.openingContraHint')}>
                <select
                    style={inputStyle}
                    value={form.openingOffsetAccountId || ''}
                    onChange={(e) =>
                        setForm({ ...form, openingOffsetAccountId: e.target.value })
                    }
                >
                    <option value="">{t('coa.form.openingSuspense')}</option>
                    {equityContraOptions.map((a) => (
                        <option key={a.id} value={a.id}>
                            [{a.code}] {a.name}
                        </option>
                    ))}
                </select>
            </Field>
            <Field label={t('coa.form.status')}>
                <select
                    style={inputStyle}
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                    <option value="active">{t('coa.form.status.active')}</option>
                    <option value="inactive">{t('coa.form.status.inactive')}</option>
                </select>
            </Field>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, gridColumn: '1 / -1' }}>
                <input
                    type="checkbox"
                    checked={!!form.isCashEquivalent}
                    onChange={(e) => setForm({ ...form, isCashEquivalent: e.target.checked })}
                />
                {t('coa.form.cashEquiv')}
            </label>
            <Field label={t('coa.form.description')}>
                <textarea
                    rows={2}
                    style={{ ...inputStyle, fontFamily: 'inherit' }}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
            </Field>
            {err ? <div style={{ gridColumn: '1 / -1' }}><AcctError message={err} /></div> : null}
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" style={outlineBtnStyle} onClick={onCancel} disabled={saving}>
                    {t('btn.cancel')}
                </button>
                <button type="submit" style={primaryBtnStyle} disabled={saving}>
                    {saving
                        ? t('coa.btn.saving')
                        : isEdit
                          ? t('coa.btn.saveChanges')
                          : t('coa.btn.createAccount')}
                </button>
            </div>
        </form>
    );
}

export default function SupplierCOAManager({ locale: localeProp }) {
    const locale =
        localeProp ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => saccT(locale, key, vars), [locale]);
    const navigate = useNavigate();
    const [accounts, setAccounts] = useState([]);
    const [tree, setTree] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [view, setView] = useState('tree'); // 'tree' | 'flat'
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState('');
    const [creating, setCreating] = useState(false);
    const [editing, setEditing] = useState(null);
    const [searchParams, setSearchParams] = useSearchParams();
    const coaLedgerQueryConsumed = useRef(false);

    const navigateToAccountLedger = useCallback((account, partyFilter = {}) => {
        if (!account?.id) return;
        if (account?.seedKey === 'VAT_OUTPUT') {
            navigate('/supplier/accounting/vat');
            return;
        }
        const params = new URLSearchParams();
        if (partyFilter.partyType) params.set('partyType', partyFilter.partyType);
        if (partyFilter.partyId) params.set('partyId', partyFilter.partyId);
        if (partyFilter.externalPartyId) {
            params.set('externalPartyId', partyFilter.externalPartyId);
        }
        const qs = params.toString();
        navigate(
            `/supplier/accounting/ledger/${encodeURIComponent(account.id)}${qs ? `?${qs}` : ''}`,
        );
    }, [navigate]);

    useEffect(() => {
        const seed = (searchParams.get('openLedgerSeed') || '').trim();
        const openAccountId = (searchParams.get('openLedgerAccountId') || '').trim();
        if (!seed && !openAccountId) {
            coaLedgerQueryConsumed.current = false;
            return;
        }
        if (!accounts.length || coaLedgerQueryConsumed.current) return;
        if (seed) {
            const partyType = (searchParams.get('partyType') || '').trim();
            const partyId = (searchParams.get('partyId') || '').trim();
            const externalPartyId = (searchParams.get('externalPartyId') || '').trim();
            const acc = accounts.find((a) => a.seedKey === seed);
            if (!acc) return;
            coaLedgerQueryConsumed.current = true;
            navigateToAccountLedger(acc, { partyType, partyId, externalPartyId });
            setSearchParams({}, { replace: true });
            return;
        }
        if (openAccountId) {
            const acc = accounts.find((a) => String(a.id) === openAccountId);
            if (!acc) return;
            coaLedgerQueryConsumed.current = true;
            navigateToAccountLedger(acc, {});
            setSearchParams({}, { replace: true });
        }
    }, [accounts, searchParams, setSearchParams, navigateToAccountLedger]);

    const reload = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const [flat, treeRes] = await Promise.all([
                getSupplierAccounts(),
                getSupplierAccountsTree(),
            ]);
            setAccounts(unwrapSupplierAccountingList(flat));
            setTree(unwrapSupplierAccountingList(treeRes));
        } catch (e) {
            setErr(e?.message || t('coa.err.load'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => { reload(); }, [reload]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return (accounts || []).filter((a) => {
            if (filterType && a.type !== filterType) return false;
            if (!q) return true;
            const nm = (a.name || '').toLowerCase();
            return nm.includes(q) || String(a.code || '').toLowerCase().includes(q);
        });
    }, [accounts, search, filterType]);

    const treeRootsFiltered = useMemo(() => {
        return (tree || [])
            .filter((n) => !filterType || n.type === filterType)
            .filter((n) => {
                const q = search.trim().toLowerCase();
                if (!q) return true;
                const matches = (a) =>
                    (a.name || '').toLowerCase().includes(q) ||
                    String(a.code || '').toLowerCase().includes(q) ||
                    (a.children || []).some(matches);
                return matches(n);
            });
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

    const rollupById = useMemo(() => buildRollupMap(tree), [tree]);

    async function handleDelete(id) {
        if (!confirm(t('coa.confirm.delete'))) return;
        try {
            await deleteSupplierAccount(id);
            await reload();
        } catch (e) {
            alert(e?.message || t('coa.err.delete'));
        }
    }

    function openAccountLedger(account, partyFilter = {}) {
        navigateToAccountLedger(account, partyFilter);
    }

    function renderRow(a, depth = 0) {
        const roll = rollupById.get(a.id);
        const hasChildren =
            (a.children && a.children.length > 0) ||
            !!a.hasChildren ||
            (roll?.hasChildren ?? false);
        let rd = roll ? roll.rollupDebit : Number(a.closingDebit) || 0;
        let rc = roll ? roll.rollupCredit : Number(a.closingCredit) || 0;
        const isVatPayable = a.seedKey === 'VAT_OUTPUT';
        const isRetainedEarnings = a.seedKey === 'RETAINED_EARNINGS' || a.computedFromPl;
        if (isRetainedEarnings && a.cumulativeNetIncome != null) {
            const plNet = Number(a.cumulativeNetIncome);
            if (Number.isFinite(plNet)) {
                if (plNet >= 0) {
                    rc = plNet;
                    rd = 0;
                } else {
                    rd = Math.abs(plNet);
                    rc = 0;
                }
            }
        }
        const vatBalance = isVatPayable
            ? Number(a.netZatcaPayable ?? coaNetBalance(a.type, rd, rc))
            : null;
        const canOpenLedger = !hasChildren;
        const partyRows = (a.partyBalances || []).map((pb, idx) => {
            const pbd = Number(pb.closingDebit) || 0;
            const pbc = Number(pb.closingCredit) || 0;
            return (
                <tr
                    key={`${a.id}-party-${idx}`}
                    style={{ background: '#F8FAFC', fontSize: 13 }}
                >
                    <td style={{ paddingLeft: 28 + depth * 22, color: '#475569' }}>
                        <span style={{ marginRight: 6, color: '#94A3B8' }}>↳</span>
                        {pb.label}
                        {pb.lineCount != null ? (
                            <span style={{ marginLeft: 8, fontSize: 11, color: '#94A3B8' }}>
                                {t('coa.party.lines', { count: pb.lineCount })}
                            </span>
                        ) : null}
                    </td>
                    <td style={{ color: '#64748B' }}>{pb.partyType || t('emdash')}</td>
                    <td style={{ color: '#94A3B8' }}>{t('emdash')}</td>
                    <td style={{ textAlign: 'right' }}>{Number(pbd) > 0 ? money(pbd, 'SAR', { locale }) : t('emdash')}</td>
                    <td style={{ textAlign: 'right' }}>{Number(pbc) > 0 ? money(pbc, 'SAR', { locale }) : t('emdash')}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCoaBalance(a.type, pbd, pbc, 'SAR', locale)}</td>
                    <td style={{ textAlign: 'right' }}>
                        {canOpenLedger ? (
                            <button
                                type="button"
                                style={{ ...outlineBtnStyle, fontSize: 11, padding: '4px 8px' }}
                                onClick={() =>
                                    openAccountLedger(a, {
                                        partyType: pb.partyType || '',
                                        partyId: pb.partyId || '',
                                        externalPartyId: pb.externalPartyId || '',
                                    })}
                            >
                                {t('coa.btn.ledger')}
                            </button>
                        ) : null}
                    </td>
                </tr>
            );
        });
        return [
            <tr key={a.id}>
                <td style={{ paddingLeft: 12 + depth * 22 }}>
                    {canOpenLedger ? (
                        <button
                            type="button"
                            style={{ background: 'transparent', border: 'none', padding: 0, color: '#1D4ED8', fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}
                            onClick={() => openAccountLedger(a)}
                        >
                            [{a.code}] {a.name}
                        </button>
                    ) : (
                        <span
                            style={{ fontWeight: 700, color: '#0F172A', cursor: 'default' }}
                            title={t('coa.rollupTitle')}
                        >
                            [{a.code}] {a.name}
                            <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 600, color: '#64748B' }}>{t('coa.badge.total')}</span>
                        </span>
                    )}
                    {a.isAutoSeed ? (
                        <span style={{ marginLeft: 8, fontSize: 10, padding: '2px 6px', borderRadius: 999, background: '#E0F2FE', color: '#075985', fontWeight: 700 }}>
                            {t('coa.badge.system')}
                        </span>
                    ) : null}
                    {isVatPayable ? (
                        <div style={{ fontSize: 11, color: '#64748B', fontWeight: 500, marginTop: 4 }}>
                            {t('coa.vat.hint')}
                        </div>
                    ) : null}
                    {isRetainedEarnings ? (
                        <div style={{ fontSize: 11, color: '#64748B', fontWeight: 500, marginTop: 4 }}>
                            {t('coa.re.hint')}
                        </div>
                    ) : null}
                </td>
                <td>{t(TYPE_LABEL_KEYS[a.type] || a.type)}</td>
                <td>{(a.subType ? (t(`subtype.${a.subType}`) || String(a.subType).replace(/_/g, ' ')) : t('emdash'))}</td>
                <td style={{ textAlign: 'right' }}>{Number(rd) > 0 ? money(rd, 'SAR', { locale }) : t('emdash')}</td>
                <td style={{ textAlign: 'right' }}>{Number(rc) > 0 ? money(rc, 'SAR', { locale }) : t('emdash')}</td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>
                    {isVatPayable
                        ? (Math.abs(vatBalance) < 0.005 ? t('emdash') : money(vatBalance, 'SAR', { locale }))
                        : formatCoaBalance(a.type, rd, rc, 'SAR', locale)}
                </td>
                <td style={{ textAlign: 'right' }}>
                    <RowActionsMenu
                        ariaLabel={`Actions for [${a.code}] ${a.name}`}
                        items={[
                            {
                                label: t('coa.btn.edit'),
                                onClick: () => setEditing(a),
                            },
                            {
                                label: t('coa.btn.delete'),
                                onClick: () => handleDelete(a.id),
                                hidden: Boolean(a.isAutoSeed),
                                danger: true,
                            },
                        ]}
                    />
                </td>
            </tr>,
            ...partyRows,
        ];
    }

    function renderTreeNode(node, depth) {
        const rows = [...renderRow(node, depth)];
        if (node.children?.length) {
            for (const child of node.children) {
                rows.push(...renderTreeNode(child, depth + 1));
            }
        }
        return rows;
    }

    return (
        <div style={{ padding: 4 }}>
            <AcctCard
                title={t('coa.title')}
                action={(
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <select style={{ ...inputStyle, width: 'auto' }} value={view} onChange={(e) => setView(e.target.value)}>
                            <option value="tree">{t('coa.view.tree')}</option>
                            <option value="flat">{t('coa.view.flat')}</option>
                        </select>
                        <select style={{ ...inputStyle, width: 'auto' }} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                            <option value="">{t('coa.filter.allTypes')}</option>
                            {ACCOUNT_TYPES.map((typeKey) => (
                                <option key={typeKey} value={typeKey}>
                                    {t(TYPE_LABEL_KEYS[typeKey] || typeKey)}
                                </option>
                            ))}
                        </select>
                        <input
                            type="search"
                            placeholder={t('coa.search.placeholder')}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={{ ...inputStyle, width: 200 }}
                        />
                        <button type="button" style={primaryBtnStyle} onClick={() => { setCreating(true); setEditing(null); }}>
                            <Plus size={14} /> {t('coa.btn.newAccount')}
                        </button>
                    </div>
                )}
            >
                {creating || editing ? (
                    <div style={{ marginBottom: 14 }}>
                        <AccountForm
                            initial={editing}
                            accounts={accounts}
                            locale={locale}
                            t={t}
                            onCancel={() => { setCreating(false); setEditing(null); }}
                            onSaved={() => { setCreating(false); setEditing(null); reload(); }}
                        />
                    </div>
                ) : null}

                <AcctError message={err} />
                {loading ? <AcctLoading label={t('coa.loading')} locale={locale} /> : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="ws-table" style={{ width: '100%' }}>
                            <thead>
                                <tr>
                                    <th>{t('coa.th.account')}</th>
                                    <th>{t('coa.th.type')}</th>
                                    <th>{t('coa.th.subType')}</th>
                                    <th style={{ textAlign: 'right' }}>{t('coa.th.debitBal')}</th>
                                    <th style={{ textAlign: 'right' }}>{t('coa.th.creditBal')}</th>
                                    <th style={{ textAlign: 'right' }}>{t('coa.th.balance')}</th>
                                    <th style={{ textAlign: 'right' }}>{t('coa.th.actions')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {view === 'tree'
                                    ? treeRootsFiltered.flatMap((n) => renderTreeNode(n, 0))
                                    : filtered.flatMap((a) => renderRow(a, 0))}
                                {!loading &&
                                    (view === 'tree' ? treeVisibleRowCount === 0 : filtered.length === 0) && (
                                    <tr>
                                        <td colSpan={7} style={{ textAlign: 'center', padding: 32, color: '#64748B' }}>
                                            {accounts.length === 0
                                                ? t('coa.empty.none')
                                                : t('coa.empty.filtered')}
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
