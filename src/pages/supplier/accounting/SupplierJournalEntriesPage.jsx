import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import {
    getSupplierAccounts,
    getSupplierJournalById,
    listSupplierJournalsAll,
    postSupplierGeneralJournal,
    updateSupplierJournal,
} from '../../../services/supplierAccountingApi';
import {
    listSupplierAffiliatedWorkshops,
    listSupplierExternalParties,
    listSupplierSuperSuppliers,
} from '../../../services/supplierApi';
import { saccT } from '../../../utils/supplierAccountingI18n';
import {
    AcctCard,
    AcctEmpty,
    AcctError,
    AcctLoading,
    Field,
    fmtDate,
    inputStyle,
    money,
    outlineBtnStyle,
    primaryBtnStyle,
    todayISO,
} from './SupplierAccountingShared';
import {
    accountsFrom,
    canEditManualJournal,
    extractArray,
    journalBalance,
    journalsFrom,
    unwrapPayload,
} from './SupplierManagerAccountingShared';
import { buildCustomerOptions } from './SupplierPayReceiptBulkGrid';
import SupplierAccountingCombobox, { toComboOptions } from './SupplierAccountingCombobox';

function emptyLine() {
    return { accountId: '', partyKey: '', debit: '', credit: '', description: '' };
}

export function controlKind(account) {
    if (!account) return null;
    const seed = String(account.seedKey || '');
    const code = String(account.code || '').trim();
    if (seed === 'AR_AFFILIATED' || code === '1100') return 'ar_affiliated';
    if (seed === 'AR_NON_AFFILIATED' || code === '1110') return 'ar_nonaff';
    if (seed === 'AP_SUPER_SUPPLIER' || code === '2000') return 'ap_super';
    return null;
}

function partyPayloadFromControl(kind, partyKey) {
    const key = String(partyKey || '').trim();
    if (!key) return {};
    if (kind === 'ap_super') {
        return { partyType: 'super_supplier', partyId: key };
    }
    if (kind === 'ar_nonaff') {
        const id = key.startsWith('external|') ? key.split('|')[1] : key;
        return { partyType: 'external_party', externalPartyId: id };
    }
    if (kind === 'ar_affiliated') {
        const [type, id] = key.split('|');
        if (type === 'branch' && id) return { partyType: 'branch', partyId: id };
        if (type === 'workshop' && id) return { partyType: 'workshop', partyId: id };
    }
    return {};
}

function partyKeyFromLine(line) {
    if (line.partyType === 'super_supplier' && line.partyId) return String(line.partyId);
    if (line.externalPartyId) return `external|${line.externalPartyId}`;
    if (line.partyType === 'branch' && line.partyId) return `branch|${line.partyId}`;
    if (line.partyType === 'workshop' && line.partyId) return `workshop|${line.partyId}`;
    return '';
}

export default function SupplierJournalEntriesPage({ locale = 'en' }) {
    const t = useCallback((key, vars) => saccT(locale, key, vars), [locale]);
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const editParam = (searchParams.get('edit') || '').trim();
    const [accounts, setAccounts] = useState([]);
    const [journals, setJournals] = useState([]);
    const [affiliated, setAffiliated] = useState([]);
    const [externals, setExternals] = useState([]);
    const [supers, setSupers] = useState([]);
    const [origin, setOrigin] = useState('all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [listLoading, setListLoading] = useState(true);
    const [err, setErr] = useState('');
    const [listErr, setListErr] = useState('');
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState('');
    const [editingEntry, setEditingEntry] = useState('');
    const [date, setDate] = useState(todayISO());
    const [reference, setReference] = useState('');
    const [narration, setNarration] = useState('');
    const [lines, setLines] = useState([emptyLine(), emptyLine()]);

    const nonCash = useMemo(
        () =>
            accounts.filter(
                (a) =>
                    !a.hasChildren &&
                    !a.isCashEquivalent &&
                    String(a.status || 'active').toLowerCase() !== 'inactive',
            ),
        [accounts],
    );

    const customerOptions = useMemo(
        () => buildCustomerOptions(affiliated, externals, t),
        [affiliated, externals, t],
    );
    const affiliatedOptions = useMemo(
        () => customerOptions.filter((o) => String(o.value).startsWith('branch|') || String(o.value).startsWith('workshop|')),
        [customerOptions],
    );
    const nonaffOptions = useMemo(
        () => customerOptions.filter((o) => String(o.value).startsWith('external|')),
        [customerOptions],
    );

    const accountById = useMemo(() => {
        const m = new Map();
        for (const a of accounts) m.set(String(a.id), a);
        return m;
    }, [accounts]);

    const loadLookups = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const [acc, aff, ext, ss] = await Promise.all([
                getSupplierAccounts({ status: 'active' }),
                listSupplierAffiliatedWorkshops().catch(() => ({})),
                listSupplierExternalParties().catch(() => ({})),
                listSupplierSuperSuppliers().catch(() => ({})),
            ]);
            setAccounts(accountsFrom(acc));
            setAffiliated(extractArray(aff, ['rows', 'data']));
            setExternals(extractArray(ext, ['parties', 'rows', 'data']));
            setSupers(extractArray(ss, ['superSuppliers', 'data']));
        } catch (e) {
            setErr(e?.message || t('logs.err.load'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    const loadJournals = useCallback(async () => {
        setListLoading(true);
        setListErr('');
        try {
            const list = await listSupplierJournalsAll({
                limit: '80',
                ...(origin === 'all' ? {} : { origin }),
                ...(dateFrom ? { dateFrom } : {}),
                ...(dateTo ? { dateTo } : {}),
                ...(search.trim() ? { search: search.trim() } : {}),
            });
            setJournals(journalsFrom(list).journals);
        } catch (e) {
            setListErr(e?.message || t('logs.err.load'));
        } finally {
            setListLoading(false);
        }
    }, [t, origin, dateFrom, dateTo, search]);

    useEffect(() => {
        loadLookups();
    }, [loadLookups]);

    useEffect(() => {
        loadJournals();
    }, [loadJournals]);

    const totals = useMemo(
        () => journalBalance(
            lines.reduce((s, l) => s + (Number(l.debit) || 0), 0),
            lines.reduce((s, l) => s + (Number(l.credit) || 0), 0),
        ),
        [lines],
    );
    const hasAmountLine = lines.some(
        (l) => l.accountId && ((Number(l.debit) || 0) + (Number(l.credit) || 0)) > 0,
    );

    const lineEffects = useMemo(() => {
        return lines.flatMap((l) => {
            const acc = accountById.get(String(l.accountId));
            if (!acc) return [];
            const debit = Number(l.debit) || 0;
            const credit = Number(l.credit) || 0;
            if (debit <= 0 && credit <= 0) return [];
            const kind = controlKind(acc);
            let party = '';
            if (kind === 'ap_super') {
                const s = supers.find((x) => String(x.id) === String(l.partyKey));
                party = s?.name || s?.companyName || '';
            } else if (kind === 'ar_nonaff') {
                party = nonaffOptions.find((o) => o.value === l.partyKey)?.label || '';
            } else if (kind === 'ar_affiliated') {
                party = affiliatedOptions.find((o) => o.value === l.partyKey)?.label || '';
            }
            const partyBit = party ? t('hub.effect.party', { name: party }) : '';
            const account = `[${acc.code}] ${acc.name}`;
            const vars = { account, party: partyBit, amount: money(debit > 0 ? debit : credit, 'SAR', { locale }) };
            return [t(debit > 0 ? 'mgr.je.lineEffectDr' : 'mgr.je.lineEffectCr', vars)];
        });
    }, [lines, accountById, supers, nonaffOptions, affiliatedOptions, t, locale]);

    function updateLine(idx, patch) {
        setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
    }

    function resetForm() {
        setEditingId('');
        setEditingEntry('');
        setLines([emptyLine(), emptyLine()]);
        setReference('');
        setNarration('');
        setDate(todayISO());
        setSearchParams({}, { replace: true });
    }

    const applyJournalToForm = useCallback((raw) => {
        const j = unwrapPayload(raw);
        if (!j?.id) return;
        if (!canEditManualJournal(j)) {
            setErr(t('mgr.je.readonly'));
            return;
        }
        setEditingId(String(j.id));
        setEditingEntry(j.entryNumber || String(j.id));
        setDate(fmtDate(j.date));
        setReference(j.reference || '');
        setNarration(j.description || '');
        const next = (j.lines || []).map((ln) => ({
            accountId: String(ln.accountId || ''),
            partyKey: partyKeyFromLine(ln),
            debit: Number(ln.debit) > 0 ? String(ln.debit) : '',
            credit: Number(ln.credit) > 0 ? String(ln.credit) : '',
            description: ln.description || '',
        }));
        setLines(next.length >= 2 ? next : [...next, emptyLine()]);
        setErr('');
    }, [t]);

    useEffect(() => {
        if (!editParam) return;
        let cancelled = false;
        (async () => {
            try {
                const raw = await getSupplierJournalById(editParam);
                if (!cancelled) applyJournalToForm(raw);
            } catch (e) {
                if (!cancelled) setErr(e?.message || t('logs.err.detail'));
            }
        })();
        return () => { cancelled = true; };
    }, [editParam, applyJournalToForm, t]);

    async function submit(e) {
        e.preventDefault();
        setErr('');
        const cashHit = lines.some((l) => accountById.get(String(l.accountId))?.isCashEquivalent);
        if (cashHit) {
            setErr(t('mgr.je.noCash'));
            return;
        }
        const missingParty = lines.some((l) => {
            const kind = controlKind(accountById.get(String(l.accountId)));
            if (!kind) return false;
            return !String(l.partyKey || '').trim();
        });
        if (missingParty) {
            setErr(t('mgr.je.needParty'));
            return;
        }
        const clean = lines
            .filter((l) => l.accountId && ((Number(l.debit) || 0) + (Number(l.credit) || 0)) > 0)
            .map((l) => {
                const kind = controlKind(accountById.get(String(l.accountId)));
                return {
                    accountId: l.accountId,
                    debit: Number(l.debit) || 0,
                    credit: Number(l.credit) || 0,
                    description: l.description || undefined,
                    ...partyPayloadFromControl(kind, l.partyKey),
                };
            });
        if (clean.length < 1) {
            setErr(t('mgr.je.needLine'));
            return;
        }
        const payload = {
            date,
            reference: reference.trim() || undefined,
            description: narration.trim() || undefined,
            lines: clean,
        };
        setSaving(true);
        try {
            if (editingId) {
                await updateSupplierJournal(editingId, payload);
            } else {
                await postSupplierGeneralJournal(payload);
            }
            resetForm();
            await loadJournals();
        } catch (ex) {
            setErr(ex?.message || t('hub.err.post'));
        } finally {
            setSaving(false);
        }
    }

    function openVoucher(id) {
        navigate(`/supplier/accounting/journals/${encodeURIComponent(id)}`);
    }

    function startEdit(id, e) {
        e?.stopPropagation?.();
        setSearchParams({ edit: String(id) });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    return (
        <div className="module-container">
            <AcctCard
                title={editingId ? t('mgr.je.editing', { entry: editingEntry }) : t('mgr.je.new')}
                action={editingId ? (
                    <button type="button" style={outlineBtnStyle} onClick={resetForm}>
                        {t('mgr.je.cancelEdit')}
                    </button>
                ) : null}
            >
                <p style={{ margin: '0 0 12px', fontSize: 13, color: '#64748B' }}>{t('mgr.je.hint')}</p>
                <AcctError message={err} />
                <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                                <Field label={t('hub.field.date')} required>
                                    <input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} required />
                                </Field>
                                <Field label={t('hub.field.ref')}>
                                    <input style={inputStyle} value={reference} onChange={(e) => setReference(e.target.value)} placeholder={t('hub.field.refPh')} />
                                </Field>
                            </div>
                            <Field label={t('mgr.je.narration')}>
                                <input style={inputStyle} value={narration} onChange={(e) => setNarration(e.target.value)} placeholder={t('mgr.je.narrationPh')} />
                            </Field>
                            <div style={{ overflowX: 'auto' }}>
                                <table className="ws-table" style={{ width: '100%', minWidth: 1080 }}>
                                    <thead>
                                        <tr>
                                            <th>{t('logs.th.account')}</th>
                                            <th>{t('mgr.je.party')}</th>
                                            <th style={{ width: 130 }}>{t('logs.th.debit')}</th>
                                            <th style={{ width: 130 }}>{t('logs.th.credit')}</th>
                                            <th>{t('logs.th.description')}</th>
                                            <th style={{ width: 44 }} />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {lines.map((l, idx) => {
                                            const kind = controlKind(accountById.get(String(l.accountId)));
                                            return (
                                                <tr key={idx}>
                                                    <td style={{ minWidth: 240 }}>
                                                        <SupplierAccountingCombobox
                                                            value={l.accountId}
                                                            onChange={(v) => updateLine(idx, { accountId: v, partyKey: '' })}
                                                            placeholder={t('select.dash')}
                                                            entityLabel="account"
                                                            options={nonCash.map((a) => ({
                                                                id: String(a.id),
                                                                label: `[${a.code}] ${a.name}`,
                                                                searchText: `${a.code} ${a.name}`,
                                                                subtitle: a.type,
                                                            }))}
                                                        />
                                                    </td>
                                                    <td style={{ minWidth: 220 }}>
                                                        {kind === 'ar_affiliated' ? (
                                                            <SupplierAccountingCombobox
                                                                value={l.partyKey}
                                                                onChange={(v) => updateLine(idx, { partyKey: v })}
                                                                placeholder={t('mgr.je.selectCustomer')}
                                                                entityLabel="customer"
                                                                options={affiliatedOptions.map((o) => ({
                                                                    id: o.value,
                                                                    label: o.label,
                                                                    searchText: o.label,
                                                                }))}
                                                            />
                                                        ) : kind === 'ar_nonaff' ? (
                                                            <SupplierAccountingCombobox
                                                                value={l.partyKey}
                                                                onChange={(v) => updateLine(idx, { partyKey: v })}
                                                                placeholder={t('mgr.je.selectCustomer')}
                                                                entityLabel="customer"
                                                                options={nonaffOptions.map((o) => ({
                                                                    id: o.value,
                                                                    label: o.label,
                                                                    searchText: o.label,
                                                                }))}
                                                            />
                                                        ) : kind === 'ap_super' ? (
                                                            <SupplierAccountingCombobox
                                                                value={l.partyKey}
                                                                onChange={(v) => updateLine(idx, { partyKey: v })}
                                                                placeholder={t('mgr.je.selectSupplier')}
                                                                entityLabel="supplier"
                                                                options={toComboOptions(supers, {
                                                                    labelFn: (s) => s.name || s.companyName || String(s.id),
                                                                    searchFn: (s) => `${s.name || ''} ${s.companyName || ''}`,
                                                                })}
                                                            />
                                                        ) : (
                                                            <span style={{ color: '#94A3B8', fontSize: 13 }}>{t('emdash')}</span>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <input type="number" min="0" step="0.01" style={inputStyle} value={l.debit} onChange={(e) => updateLine(idx, { debit: e.target.value, credit: '' })} />
                                                    </td>
                                                    <td>
                                                        <input type="number" min="0" step="0.01" style={inputStyle} value={l.credit} onChange={(e) => updateLine(idx, { credit: e.target.value, debit: '' })} />
                                                    </td>
                                                    <td>
                                                        <input style={inputStyle} value={l.description} onChange={(e) => updateLine(idx, { description: e.target.value })} />
                                                    </td>
                                                    <td>
                                                        <button type="button" style={{ ...outlineBtnStyle, color: '#B91C1C' }} disabled={lines.length <= 1} onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))}>
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot>
                                        <tr>
                                            <td colSpan={2} style={{ textAlign: 'right', fontWeight: 700 }}>{t('logs.totals')}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 700 }}>{money(totals.debit, 'SAR', { locale })}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 700 }}>{money(totals.credit, 'SAR', { locale })}</td>
                                            <td colSpan={2} />
                                        </tr>
                                        <tr>
                                            <td colSpan={2} style={{ textAlign: 'right', fontWeight: 700, color: totals.balanced ? '#065F46' : '#B45309' }}>
                                                {t('mgr.je.difference')}
                                            </td>
                                            <td colSpan={2} style={{ textAlign: 'right', fontWeight: 800, color: totals.balanced ? '#065F46' : '#B45309' }}>
                                                {money(Math.abs(totals.difference), 'SAR', { locale })}
                                                {' · '}
                                                {totals.balanced ? t('mgr.je.balanced') : t('mgr.je.unbalanced')}
                                            </td>
                                            <td colSpan={2} />
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                            {lineEffects.length > 0 ? (
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
                                    {lineEffects.map((text, i) => (
                                        <div key={i} style={{ fontWeight: 600 }}>{text}</div>
                                    ))}
                                </div>
                            ) : null}
                            {!totals.balanced && hasAmountLine ? (
                                <p style={{ margin: 0, fontSize: 13, color: '#B45309', fontWeight: 600 }}>
                                    {t('mgr.je.unbalancedHint')} {t('logs.th.debit')} {money(totals.debit, 'SAR', { locale })} − {t('logs.th.credit')} {money(totals.credit, 'SAR', { locale })} = {money(Math.abs(totals.difference), 'SAR', { locale })}
                                </p>
                            ) : null}
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                <button type="button" style={outlineBtnStyle} onClick={() => setLines((ls) => [...ls, emptyLine()])}>
                                    <Plus size={14} /> {t('hub.btn.addRow')}
                                </button>
                                <button type="submit" style={primaryBtnStyle} disabled={saving || !hasAmountLine}>
                                    {saving
                                        ? t('hub.btn.saving')
                                        : editingId
                                            ? t('mgr.je.update')
                                            : totals.balanced
                                                ? t('mgr.je.save')
                                                : t('mgr.je.saveDraft')}
                                </button>
                            </div>
                </form>
            </AcctCard>

            <AcctCard title={t('mgr.je.title')}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 12, flexWrap: 'wrap' }}>
                    <Field label={t('logs.from')}>
                        <input type="date" style={inputStyle} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                    </Field>
                    <Field label={t('logs.to')}>
                        <input type="date" style={inputStyle} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                    </Field>
                    <Field label={t('logs.search')}>
                        <input
                            type="search"
                            style={{ ...inputStyle, minWidth: 220 }}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={t('logs.searchPh')}
                        />
                    </Field>
                    <Field label={t('mgr.je.origin')}>
                        <SupplierAccountingCombobox
                            className="acct-table-combobox acct-filter-combobox"
                            value={origin}
                            onChange={(v) => setOrigin(v || 'all')}
                            placeholder={t('mgr.je.origin')}
                            entityLabel="origin"
                            options={[
                                { id: 'all', label: t('mgr.je.origin.all') },
                                { id: 'manual', label: t('mgr.je.origin.manual') },
                                { id: 'system', label: t('mgr.je.origin.system') },
                            ]}
                        />
                    </Field>
                    <button
                        type="button"
                        style={outlineBtnStyle}
                        onClick={() => {
                            setDateFrom('');
                            setDateTo('');
                            setSearch('');
                            setOrigin('all');
                        }}
                    >
                        {t('btn.clear')}
                    </button>
                </div>
                <AcctError message={listErr} />
                {listLoading ? (
                    <AcctLoading locale={locale} />
                ) : journals.length === 0 ? (
                    <AcctEmpty message={t('mgr.je.empty')} />
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="ws-table" style={{ width: '100%' }}>
                            <thead>
                                <tr>
                                    <th>{t('logs.th.date')}</th>
                                    <th>{t('logs.th.entryNo')}</th>
                                    <th>{t('logs.th.type')}</th>
                                    <th>{t('mgr.je.origin')}</th>
                                    <th>{t('logs.th.description')}</th>
                                    <th style={{ textAlign: 'right' }}>{t('logs.th.debit')}</th>
                                    <th style={{ textAlign: 'right' }}>{t('logs.th.credit')}</th>
                                    <th>{t('logs.th.status')}</th>
                                    <th>{t('logs.th.actions')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {journals.map((j) => {
                                    const bal = journalBalance(j.totalDebit, j.totalCredit);
                                    const balanced = j.isBalanced === true || bal.balanced;
                                    const voided = String(j.status || '') === 'void';
                                    return (
                                        <tr
                                            key={j.id}
                                            style={{ cursor: 'pointer' }}
                                            onClick={() => openVoucher(j.id)}
                                        >
                                            <td>{fmtDate(j.date)}</td>
                                            <td>{j.entryNumber}</td>
                                            <td>{j.type}</td>
                                            <td>{j.origin === 'manual' || j.source === 'manual_journal' ? t('mgr.je.origin.manual') : t('mgr.je.origin.system')}</td>
                                            <td>{j.description || j.reference || t('emdash')}</td>
                                            <td style={{ textAlign: 'right' }}>{money(j.totalDebit, 'SAR', { locale })}</td>
                                            <td style={{ textAlign: 'right' }}>{money(j.totalCredit, 'SAR', { locale })}</td>
                                            <td>
                                                {voided ? (
                                                    <span style={{ color: '#B91C1C', fontWeight: 700 }}>{j.status}</span>
                                                ) : (
                                                    <span style={{ color: balanced ? '#065F46' : '#B45309', fontWeight: 700 }}>
                                                        {balanced ? t('mgr.je.balanced') : t('mgr.je.unbalanced')}
                                                        {!balanced ? ` · ${money(Math.abs(bal.difference), 'SAR', { locale })}` : ''}
                                                    </span>
                                                )}
                                            </td>
                                            <td onClick={(e) => e.stopPropagation()}>
                                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                    <button type="button" style={outlineBtnStyle} onClick={() => openVoucher(j.id)}>
                                                        <Eye size={14} /> {t('mgr.je.view')}
                                                    </button>
                                                    {canEditManualJournal(j) ? (
                                                        <button type="button" style={outlineBtnStyle} onClick={(e) => startEdit(j.id, e)}>
                                                            <Pencil size={14} /> {t('mgr.je.edit')}
                                                        </button>
                                                    ) : null}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </AcctCard>
        </div>
    );
}
