import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
    createSupplierPaymentRegister,
    createSupplierReceiptRegister,
} from '../../../services/supplierAccountingApi';
import {
    formatAffiliatedBranchCustomerLabel,
    formatAffiliatedWorkshopCustomerLabel,
} from '../../../utils/affiliatedCustomerLabels';
import { saccT } from '../../../utils/supplierAccountingI18n';
import {
    AcctError,
    Field,
    inputStyle,
    money,
    outlineBtnStyle,
    primaryBtnStyle,
    todayISO,
    coaNetBalance,
} from './SupplierAccountingShared';
import SupplierAccountingCombobox, { toComboOptions } from './SupplierAccountingCombobox';

const PAY_TYPE_KEYS = [
    { value: 'super_supplier', key: 'hub.payType.super_supplier' },
    { value: 'employee', key: 'hub.payType.employee' },
    { value: 'customer', key: 'hub.payType.customer' },
    { value: 'others', key: 'hub.payType.others' },
];

export function emptyPayReceiptLine(headerDate, variant = 'payment', accounts = []) {
    const row = {
        lineDate: headerDate || todayISO(),
        payType: variant === 'receipt' ? 'customer' : 'super_supplier',
        payeeValue: '',
        accountId: '',
        accountAutoFilled: '',
        amount: '',
        lineReference: '',
        notes: '',
        allocatedInvoiceId: '',
        allocatedPurchaseId: '',
    };
    return { ...row, ...suggestAgainstPatch(row, accounts, row.payType, row.payeeValue) };
}

export function partyPayloadFromRow(row) {
    const t = row.payType;
    if (t === 'others' || !t) {
        return { partyType: undefined, partyId: undefined, externalPartyId: undefined };
    }
    if (t === 'super_supplier') {
        return {
            partyType: 'super_supplier',
            partyId: row.payeeValue || undefined,
            externalPartyId: undefined,
        };
    }
    if (t === 'employee') {
        return {
            partyType: 'employee',
            partyId: row.payeeValue || undefined,
            externalPartyId: undefined,
        };
    }
    if (t === 'customer') {
        const raw = String(row.payeeValue || '');
        const [kind, id] = raw.split('|');
        if (!id) return { partyType: undefined, partyId: undefined, externalPartyId: undefined };
        if (kind === 'branch') {
            return { partyType: 'branch', partyId: id, externalPartyId: undefined };
        }
        if (kind === 'workshop') {
            return { partyType: 'workshop', partyId: id, externalPartyId: undefined };
        }
        if (kind === 'external') {
            return { partyType: 'external_party', partyId: undefined, externalPartyId: id };
        }
    }
    return { partyType: undefined, partyId: undefined, externalPartyId: undefined };
}

function cashAccountLabel(a, locale = 'en') {
    const rd = Number(a.closingDebit) || 0;
    const rc = Number(a.closingCredit) || 0;
    const bal = coaNetBalance(a.type, rd, rc);
    return `[${a.code}] ${a.name} — ${money(bal, 'SAR', { locale })}`;
}

function accountCodeOf(payType, payeeValue) {
    if (payType === 'super_supplier') return '2000';
    if (payType !== 'customer') return '';
    const kind = String(payeeValue || '').split('|')[0];
    if (kind === 'external') return '1110';
    if (kind === 'branch' || kind === 'workshop') return '1100';
    return '';
}

export function resolveAgainstAccountId(accounts, payType, payeeValue) {
    const code = accountCodeOf(payType, payeeValue);
    if (!code) return '';
    const leaves = (accounts || []).filter((a) => !a.hasChildren && !a.isCashEquivalent);
    const byCode = leaves.find((a) => String(a.code || '').trim() === code);
    if (byCode?.id) return String(byCode.id);
    const seed =
        code === '2000'
            ? 'AP_SUPER_SUPPLIER'
            : code === '1110'
              ? 'AR_NON_AFFILIATED'
              : 'AR_AFFILIATED';
    const bySeed = leaves.find((a) => a.seedKey === seed);
    if (bySeed?.id) return String(bySeed.id);
    const needle =
        code === '2000'
            ? /accounts payable|super supplier/i
            : code === '1110'
              ? /non-affiliated.*receivable/i
              : /affiliated.*receivable/i;
    const byName = leaves.find((a) => needle.test(String(a.name || '')));
    return byName?.id ? String(byName.id) : '';
}

function suggestAgainstPatch(row, accounts, payType, payeeValue) {
    const suggested = resolveAgainstAccountId(accounts, payType, payeeValue);
    const current = String(row.accountId || '');
    const lastAuto = String(row.accountAutoFilled || '');
    const canFill = !current || current === lastAuto;
    if (!canFill) return {};
    return { accountId: suggested, accountAutoFilled: suggested };
}

function shortAccountLabel(account) {
    if (!account) return '';
    const code = String(account.code || '').trim();
    const name = String(account.name || '').trim();
    if (code && name) return `[${code}] ${name}`;
    return name || code || '';
}

function payeeDisplayName(row, superSuppliers, staff, customerOptions) {
    const raw = String(row.payeeValue || '').trim();
    if (!raw) return '';
    if (row.payType === 'others') return raw;
    if (row.payType === 'super_supplier') {
        const s = (superSuppliers || []).find((x) => String(x.id) === raw);
        return s?.name || s?.companyName || s?.code || raw;
    }
    if (row.payType === 'employee') {
        const s = (staff || []).find((x) => String(x.id) === raw);
        return s?.name || raw;
    }
    if (row.payType === 'customer') {
        const o = (customerOptions || []).find((x) => String(x.value) === raw);
        return o?.label || raw;
    }
    return raw;
}

function resolvePrefillCashAccountId(initialPrefill, cashOptions) {
    if (initialPrefill?.cashAccountId) return String(initialPrefill.cashAccountId);
    if (initialPrefill?.cashBankLabel && cashOptions.length) {
        const labelNeedle = String(initialPrefill.cashBankLabel).trim().toLowerCase();
        const match = cashOptions.find((a) => {
            const lbl = cashAccountLabel(a).toLowerCase();
            const name = String(a.name || '').toLowerCase();
            return lbl.includes(labelNeedle) || name.includes(labelNeedle);
        });
        if (match?.id) return String(match.id);
    }
    return cashOptions[0]?.id ? String(cashOptions[0].id) : '';
}

function buildGridStateFromPrefill(initialPrefill, variant, accounts, cashOptions) {
    if (!initialPrefill) {
        const today = todayISO();
        return {
            headerDate: today,
            headerRef: '',
            generalNote: '',
            cashAccountId: cashOptions[0]?.id ? String(cashOptions[0].id) : '',
            lines: [emptyPayReceiptLine(today, variant, accounts)],
        };
    }
    const prefillVariant = initialPrefill.variant || initialPrefill.tab || variant;
    if (prefillVariant !== variant) {
        const today = todayISO();
        return {
            headerDate: today,
            headerRef: '',
            generalNote: '',
            cashAccountId: cashOptions[0]?.id ? String(cashOptions[0].id) : '',
            lines: [emptyPayReceiptLine(today, variant, accounts)],
        };
    }
    const hdrDate = initialPrefill.headerDate || todayISO();
    return {
        headerDate: hdrDate,
        headerRef: String(initialPrefill.headerRef ?? ''),
        generalNote: String(initialPrefill.generalNote ?? ''),
        cashAccountId: resolvePrefillCashAccountId(initialPrefill, cashOptions),
        lines: (Array.isArray(initialPrefill.lines) && initialPrefill.lines.length
            ? initialPrefill.lines
            : [emptyPayReceiptLine(hdrDate, variant, accounts)]
        ).map((l) => {
            const payeeValue = String(l.payeeValue || '');
            const payType = l.payType || (variant === 'receipt' ? 'customer' : 'super_supplier');
            const suggested = resolveAgainstAccountId(accounts, payType, payeeValue);
            const accountId = l.accountId || suggested || '';
            return {
                ...emptyPayReceiptLine(l.lineDate || hdrDate, variant, accounts),
                ...l,
                payType,
                accountId,
                accountAutoFilled: l.accountId ? '' : suggested,
                allocatedInvoiceId:
                    l.allocatedInvoiceId || initialPrefill.allocatedInvoiceId || initialPrefill.salesInvoiceId || '',
            };
        }),
    };
}

function PayeeCell({
    row,
    idx,
    superSuppliers,
    staff,
    customerOptions,
    onChange,
    t,
}) {
    const payT = row.payType;
    if (payT === 'others') {
        return (
            <input
                style={inputStyle}
                value={row.payeeValue}
                onChange={(e) => onChange(idx, { payeeValue: e.target.value })}
                placeholder={t('hub.payee.othersPh')}
            />
        );
    }
    if (payT === 'super_supplier') {
        return (
            <SupplierAccountingCombobox
                value={row.payeeValue}
                onChange={(v) => onChange(idx, { payeeValue: v })}
                placeholder={t('hub.select.super')}
                entityLabel="payee"
                emptyHint={t('hub.select.super')}
                options={toComboOptions(superSuppliers, {
                    labelFn: (s) => s.name || s.companyName || s.code || String(s.id),
                    searchFn: (s) => `${s.name || ''} ${s.companyName || ''} ${s.code || ''}`,
                })}
            />
        );
    }
    if (payT === 'employee') {
        return (
            <SupplierAccountingCombobox
                value={row.payeeValue}
                onChange={(v) => onChange(idx, { payeeValue: v })}
                placeholder={t('hub.select.employee')}
                entityLabel="employee"
                emptyHint={t('hub.select.employee')}
                options={toComboOptions(staff, {
                    labelFn: (s) => s.name || String(s.id),
                    searchFn: (s) => `${s.name || ''} ${s.id || ''}`,
                })}
            />
        );
    }
    if (payT === 'customer') {
        return (
            <SupplierAccountingCombobox
                value={row.payeeValue}
                onChange={(v) => onChange(idx, { payeeValue: v })}
                placeholder={t('hub.select.customer')}
                entityLabel="customer"
                emptyHint={t('hub.select.customer')}
                options={(customerOptions || []).map((o) => ({
                    id: o.value,
                    label: o.label,
                    searchText: o.label,
                }))}
            />
        );
    }
    return null;
}

export function buildCustomerOptions(affiliatedRows, externalParties, t) {
    const workshopsWithBranchPins = new Set(
        affiliatedRows
            .filter((r) => r.scope === 'branch' && r.branchId)
            .map((r) => String(r.workshopId)),
    );
    const opts = [];
    for (const r of affiliatedRows) {
        if (r.scope === 'branch' && r.branchId) {
            opts.push({
                value: `branch|${r.branchId}`,
                label: formatAffiliatedBranchCustomerLabel(
                    r.workshopName,
                    r.branchName,
                ),
            });
        } else if (
            r.scope === 'workshop' &&
            r.workshopId &&
            !workshopsWithBranchPins.has(String(r.workshopId))
        ) {
            opts.push({
                value: `workshop|${r.workshopId}`,
                label: formatAffiliatedWorkshopCustomerLabel(r.workshopName),
            });
        }
    }
    for (const p of externalParties) {
        const id = p.id ?? p.externalPartyId;
        if (!id) continue;
        opts.push({
            value: `external|${String(id)}`,
            label: t('hub.nonAffiliated', { name: p.displayName || p.name || String(id) }),
        });
    }
    return opts;
}

export function PaymentReceiptGrid({
    variant,
    accounts,
    superSuppliers,
    staff,
    customerOptions,
    onPosted,
    initialPrefill,
    locale = 'en',
    t,
    cashFieldLabel,
}) {
    const tr = t || ((key, vars) => saccT(locale, key, vars));
    const leafAccounts = useMemo(
        () =>
            (accounts || []).filter(
                (a) =>
                    !a.hasChildren &&
                    String(a.status || 'active').toLowerCase() !== 'inactive',
            ),
        [accounts],
    );
    const cashOptions = leafAccounts.filter((a) => a.isCashEquivalent);
    const againstAccounts = leafAccounts.filter((a) => !a.isCashEquivalent);

    const prefillSeed = useMemo(
        () => buildGridStateFromPrefill(initialPrefill, variant, accounts, cashOptions),
        [initialPrefill, variant, accounts, cashOptions],
    );

    const [headerDate, setHeaderDate] = useState(() => prefillSeed.headerDate);
    const [headerRef, setHeaderRef] = useState(() => prefillSeed.headerRef);
    const [generalNote, setGeneralNote] = useState(() => prefillSeed.generalNote);
    const [cashAccountId, setCashAccountId] = useState(() => prefillSeed.cashAccountId);
    const [lines, setLines] = useState(() => prefillSeed.lines);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');
    const prefillAppliedRef = useRef(null);
    const cashTouchedRef = useRef(false);

    useEffect(() => {
        if (cashTouchedRef.current) return;
        if (cashAccountId) return;
        if (cashOptions[0]?.id) setCashAccountId(String(cashOptions[0].id));
    }, [cashOptions, cashAccountId]);

    function setCashAccountFromUser(nextId) {
        cashTouchedRef.current = true;
        setCashAccountId(nextId);
    }

    useEffect(() => {
        if (!initialPrefill) return;
        const prefillKey =
            initialPrefill.salesInvoiceId ||
            initialPrefill.headerRef ||
            JSON.stringify(initialPrefill.lines?.[0]?.payeeValue || '');
        if (prefillAppliedRef.current === prefillKey) return;

        const next = buildGridStateFromPrefill(initialPrefill, variant, accounts, cashOptions);
        setHeaderDate(next.headerDate);
        setHeaderRef(next.headerRef);
        setGeneralNote(next.generalNote);
        if (next.cashAccountId) setCashAccountId(next.cashAccountId);
        setLines(next.lines);
        prefillAppliedRef.current = prefillKey;
    }, [initialPrefill, variant, accounts, cashOptions]);

    const accountColOptions = againstAccounts;

    const total = useMemo(
        () => lines.reduce((s, l) => s + (Number(l.amount) || 0), 0),
        [lines],
    );

    const accountById = useMemo(() => {
        const m = new Map();
        for (const a of leafAccounts) m.set(String(a.id), a);
        return m;
    }, [leafAccounts]);

    const effectLines = useMemo(() => {
        const cash = accountById.get(String(cashAccountId));
        const cashLbl = shortAccountLabel(cash);
        return lines
            .filter((l) => l.accountId && Number(l.amount) > 0 && String(l.payeeValue || '').trim())
            .map((l) => {
                const against = shortAccountLabel(accountById.get(String(l.accountId)));
                const party = payeeDisplayName(l, superSuppliers, staff, customerOptions);
                const amt = money(l.amount, 'SAR', { locale });
                const partyBit = party ? tr('hub.effect.party', { name: party }) : '';
                if (variant === 'payment') {
                    return tr('hub.effect.payment', { cash: cashLbl || '—', against: against || '—', amount: amt, party: partyBit });
                }
                return tr('hub.effect.receipt', { cash: cashLbl || '—', against: against || '—', amount: amt, party: partyBit });
            });
    }, [accountById, cashAccountId, lines, superSuppliers, staff, customerOptions, locale, tr, variant]);

    const validCount = useMemo(
        () =>
            lines.filter(
                (l) =>
                    l.accountId
                    && Number(l.amount) > 0
                    && l.payeeValue
                    && String(l.payeeValue).trim() !== '',
            ).length,
        [lines],
    );

    function updateLine(idx, patch) {
        setLines((ls) => ls.map((l, i) => {
            if (i !== idx) return l;
            const next = { ...l, ...patch };
            if ('payeeValue' in patch || 'payType' in patch) {
                Object.assign(next, suggestAgainstPatch(l, accounts, next.payType, next.payeeValue));
            }
            return next;
        }));
    }

    function addLine() {
        setLines((ls) => {
            const next = [...ls, emptyPayReceiptLine(headerDate, variant, accounts)];
            const targetRow = next.length;
            queueMicrotask(() => {
                document
                    .querySelector(`[data-hub-row="${variant}-${targetRow}"] [data-hub-focus="date"]`)
                    ?.focus?.();
            });
            return next;
        });
    }

    function handleTypeChange(idx, payType) {
        updateLine(idx, { payType, payeeValue: '' });
    }

    function handleAccountChange(idx, accountId) {
        const row = lines[idx];
        const suggested = resolveAgainstAccountId(accounts, row?.payType, row?.payeeValue);
        updateLine(idx, {
            accountId,
            accountAutoFilled: accountId && accountId === suggested ? suggested : '',
        });
    }

    function handleTabFromNotes(e, idx) {
        if (e.key !== 'Tab' || e.shiftKey) return;
        if (idx !== lines.length - 1) return;
        e.preventDefault();
        addLine();
    }

    async function saveAll(e) {
        e.preventDefault();
        setErr('');
        if (!cashAccountId) {
            setErr(tr('hub.err.cash'));
            return;
        }
        const clean = lines.filter(
            (l) =>
                l.accountId
                && Number(l.amount) > 0
                && l.payeeValue
                && String(l.payeeValue).trim() !== '',
        );
        if (clean.length === 0) {
            setErr(tr('hub.err.rows'));
            return;
        }
        setSaving(true);
        const posted = [];
        try {
            for (let i = 0; i < clean.length; i++) {
                const l = clean[i];
                const party = partyPayloadFromRow(l);
                const rowDate = l.lineDate || headerDate;
                const lineBody = {
                    accountId: l.accountId,
                    amount: Number(l.amount),
                    description:
                        [l.payType === 'others' ? l.payeeValue?.trim() : '', l.notes?.trim()]
                            .filter(Boolean)
                            .join(' — ') || undefined,
                    lineReference: l.lineReference?.trim() || undefined,
                    allocatedInvoiceId: l.allocatedInvoiceId || undefined,
                    allocatedPurchaseId: l.allocatedPurchaseId || undefined,
                    ...party,
                };
                const body = {
                    date: rowDate,
                    cashAccountId,
                    description: generalNote.trim() || undefined,
                    reference: headerRef.trim() || undefined,
                    lines: [lineBody],
                };
                const res =
                    variant === 'payment'
                        ? await createSupplierPaymentRegister(body)
                        : await createSupplierReceiptRegister(body);
                posted.push(res);
            }
            onPosted?.(posted);
            setLines([emptyPayReceiptLine(headerDate, variant, accounts)]);
            setGeneralNote('');
            setHeaderRef('');
        } catch (ex) {
            setErr(ex?.message || tr('hub.err.save'));
        } finally {
            setSaving(false);
        }
    }

    const cashLabelText =
        cashFieldLabel
        || (variant === 'payment' ? tr('logs.col.paidFrom') : tr('logs.col.receivedIn'));

    return (
        <form onSubmit={saveAll} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ margin: 0, fontSize: 12, color: '#64748B', lineHeight: 1.45 }}>
                {variant === 'payment' ? tr('hub.hint.payment') : tr('hub.hint.receipt')}
            </p>
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: 12,
                }}
            >
                <Field label={tr('hub.field.date')} required>
                    <input
                        type="date"
                        style={inputStyle}
                        value={headerDate}
                        onChange={(e) => {
                            const v = e.target.value;
                            setHeaderDate(v);
                            setLines((ls) => ls.map((l, i) => (i === 0 && !l.lineDate ? { ...l, lineDate: v } : l)));
                        }}
                        required
                    />
                </Field>
                <Field label={tr('hub.field.ref')}>
                    <input
                        style={inputStyle}
                        value={headerRef}
                        onChange={(e) => setHeaderRef(e.target.value)}
                        placeholder={tr('hub.field.refPh')}
                    />
                </Field>
                <Field label={tr('hub.field.note')}>
                    <input
                        style={inputStyle}
                        value={generalNote}
                        onChange={(e) => setGeneralNote(e.target.value)}
                        placeholder={tr('hub.field.notePh')}
                    />
                </Field>
                <Field label={cashLabelText} required>
                    <SupplierAccountingCombobox
                        className="acct-table-combobox acct-filter-combobox"
                        value={cashAccountId}
                        onChange={setCashAccountFromUser}
                        placeholder={tr('select.dash')}
                        entityLabel="account"
                        required
                        options={cashOptions.map((a) => ({
                            id: String(a.id),
                            label: cashAccountLabel(a, locale),
                            searchText: `${a.code} ${a.name}`,
                        }))}
                    />
                </Field>
            </div>

            <div style={{ overflowX: 'auto' }}>
                <table className="ws-table" style={{ width: '100%', minWidth: 1180, tableLayout: 'auto' }}>
                    <thead>
                        <tr>
                            <th style={{ width: 88 }}>{tr('hub.th.voucher')}</th>
                            <th style={{ width: 130 }}>{tr('hub.th.date')}</th>
                            <th style={{ minWidth: 188, width: 200 }}>{tr('hub.th.type')}</th>
                            <th style={{ minWidth: 220 }}>
                                {variant === 'payment' ? tr('logs.col.paidTo') : tr('logs.col.receivedFrom')}
                            </th>
                            <th style={{ minWidth: 220 }}>{tr('logs.col.against')}</th>
                            <th style={{ width: 120, textAlign: 'right' }}>{tr('hub.th.amount')}</th>
                            <th style={{ width: 110 }}>{tr('hub.th.ref')}</th>
                            <th style={{ minWidth: 140 }}>{tr('hub.th.notes')}</th>
                            <th style={{ width: 44 }} />
                        </tr>
                    </thead>
                    <tbody>
                        {lines.map((l, idx) => (
                            <tr key={idx} data-hub-row={`${variant}-${idx + 1}`}>
                                <td>
                                    <span
                                        style={{
                                            display: 'inline-block',
                                            padding: '4px 8px',
                                            borderRadius: 8,
                                            background: '#E0F2FE',
                                            color: '#0369A1',
                                            fontWeight: 800,
                                            fontSize: 12,
                                        }}
                                    >
                                        {variant === 'payment' ? 'PE' : 'RC'}
                                        {String(idx + 1).padStart(4, '0')}
                                    </span>
                                </td>
                                <td>
                                    <input
                                        data-hub-focus="date"
                                        type="date"
                                        style={inputStyle}
                                        value={l.lineDate || headerDate}
                                        onChange={(e) => updateLine(idx, { lineDate: e.target.value })}
                                    />
                                </td>
                                <td style={{ minWidth: 188 }}>
                                    <SupplierAccountingCombobox
                                        className="acct-table-combobox acct-combo-type"
                                        value={l.payType}
                                        onChange={(v) => {
                                            if (!PAY_TYPE_KEYS.some((p) => p.value === v)) return;
                                            handleTypeChange(idx, v);
                                        }}
                                        placeholder={tr('hub.type.search')}
                                        entityLabel="type"
                                        menuMinWidth={220}
                                        options={PAY_TYPE_KEYS.map((p) => ({
                                            id: p.value,
                                            label: tr(p.key),
                                            searchText: tr(p.key),
                                        }))}
                                    />
                                </td>
                                <td>
                                    <PayeeCell
                                        row={l}
                                        idx={idx}
                                        superSuppliers={superSuppliers}
                                        staff={staff}
                                        customerOptions={customerOptions}
                                        onChange={updateLine}
                                        t={tr}
                                    />
                                </td>
                                <td>
                                    <SupplierAccountingCombobox
                                        value={l.accountId}
                                        onChange={(v) => handleAccountChange(idx, v)}
                                        placeholder={tr('hub.select.account')}
                                        entityLabel="account"
                                        emptyHint={tr('hub.select.account')}
                                        options={accountColOptions.map((a) => ({
                                            id: String(a.id),
                                            label: `[${a.code}] ${a.name}`,
                                            searchText: `${a.code} ${a.name}`,
                                            subtitle: a.type,
                                        }))}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        style={{ ...inputStyle, textAlign: 'right' }}
                                        value={l.amount}
                                        onChange={(e) => updateLine(idx, { amount: e.target.value })}
                                    />
                                </td>
                                <td>
                                    <input
                                        style={inputStyle}
                                        value={l.lineReference}
                                        onChange={(e) => updateLine(idx, { lineReference: e.target.value })}
                                        placeholder={tr('hub.refPh')}
                                    />
                                </td>
                                <td>
                                    <input
                                        style={inputStyle}
                                        value={l.notes}
                                        onChange={(e) => updateLine(idx, { notes: e.target.value })}
                                        placeholder={tr('hub.notesPh')}
                                        onKeyDown={(e) => handleTabFromNotes(e, idx)}
                                    />
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                    <button
                                        type="button"
                                        tabIndex={-1}
                                        style={{ ...outlineBtnStyle, color: '#B91C1C', borderColor: '#FECACA' }}
                                        onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))}
                                        disabled={lines.length === 1}
                                        title={tr('hub.removeRow')}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {effectLines.length > 0 ? (
                <div
                    style={{
                        padding: '10px 12px',
                        background: '#F8FAFC',
                        border: '1px solid #E2E8F0',
                        borderRadius: 8,
                        fontSize: 13,
                        color: '#0F172A',
                        lineHeight: 1.55,
                    }}
                >
                    {effectLines.map((text, i) => (
                        <div key={i} style={{ fontWeight: 600 }}>{text}</div>
                    ))}
                </div>
            ) : null}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#475569' }}>
                    {tr(validCount === 1 ? 'hub.validRow' : 'hub.validRows', {
                        count: validCount,
                        amount: money(total, 'SAR', { locale }),
                    })}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" style={outlineBtnStyle} onClick={addLine}>
                        <Plus size={14} /> {tr('hub.btn.addRow')}
                    </button>
                    <button type="submit" style={primaryBtnStyle} disabled={saving || validCount === 0}>
                        {saving
                            ? tr('hub.btn.saving')
                            : variant === 'payment'
                              ? tr('hub.btn.savePayments')
                              : tr('hub.btn.saveReceipts')}
                    </button>
                </div>
            </div>

            <AcctError message={err} />
        </form>
    );
}
