import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Wallet, RefreshCw, CheckCircle, AlertTriangle, Plus, Trash2, ClipboardList,
    ArrowUpRight, ArrowDownLeft, HandCoins, BadgeDollarSign, ChevronDown, ChevronRight,
} from 'lucide-react';
import { apiFetch } from '../../services/api';
import {
    qs,
    getAllWorkshopEmployees,
    unwrapWorkshopEmployeesList,
    workshopStaffSelectValue,
    parseWorkshopStaffSelectValue,
    workshopStaffRoleLabel,
} from '../../services/workshopStaffApi';
import SearchSelect from '../../components/SearchSelect';
import WsTableScroll from '../../components/workshop/WsTableScroll';
import { useServerPaging } from '../../hooks/usePagedRows';
import LockerTablePager from './LockerTablePager';
import { useLockerPortal } from './useLockerPortal';
import { toRiyadhDateISO } from '../../utils/riyadhBusinessRange';

const BASE = '/locker/vault-vouchers';
const PAYEE_TYPES = ['Supplier', 'Customer', 'Employee', 'Other'];
const KINDS = ['payment', 'receipt', 'advance', 'salary'];
const STATUSES = ['pending', 'posted', 'rejected', 'processing'];

const todayISO = () => toRiyadhDateISO();
const thisMonth = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const newKey = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const num = (v) => Number(v) || 0;
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function emptyPartyRow(payeeType = 'Supplier') {
    return {
        key: newKey(),
        payeeType,
        payeeId: '',
        payeeName: '',
        accountId: '',
        accountAuto: false,
        amount: '',
        reference: '',
        notes: '',
    };
}

function emptySalaryRow() {
    return {
        key: newKey(),
        employeeKey: '',
        employeeRecordId: '',
        recordType: '',
        userId: '',
        employeeName: '',
        basicSalary: '',
        rewardBonus: '0',
        commissionAmount: 0,
        commissionLineIds: [],
        advanceDue: 0,
        advanceDeduction: '0',
        penalties: '0',
        penaltyNotes: '',
        loading: false,
    };
}

const salaryNet = (r) =>
    r2(num(r.basicSalary) + num(r.rewardBonus) + num(r.commissionAmount) - num(r.advanceDeduction) - num(r.penalties));

function statusStyle(status) {
    const s = String(status || '').toLowerCase();
    if (s === 'posted') return { background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' };
    if (s === 'rejected') return { background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' };
    if (s === 'processing') return { background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd' };
    return { background: '#fef9c3', color: '#a16207', border: '1px solid #fde68a' };
}

const okBox = { background: '#dcfce7', color: '#15803d', borderColor: '#bbf7d0' };
const rowCard = { border: '1px solid #e2e8f0', borderRadius: 12, padding: 12, background: '#f8fafc' };

/**
 * Locker vault payments / receipts / employee advances / salaries. Supervisors
 * request; the workshop owner or admin approves, which posts through the
 * accounting, advances or payroll module against 1004 Locker Cash.
 */
export default function VaultVouchers({
    selectedBranchId = 'all',
    branches: layoutBranches = null,
    branchLockedId = null,
} = {}) {
    const { t, can, money } = useLockerPortal();
    const dash = t('emdash');

    const [serverFlags, setServerFlags] = useState(null);
    const canCreate = can('vaultVouchers.create') && (serverFlags ? serverFlags.canCreate : true);
    const canDecide = can('vaultVouchers.decide') && (serverFlags ? serverFlags.canDecide : true);

    const [pageTab, setPageTab] = useState(() => (can('vaultVouchers.create') ? 'payment' : 'requests'));
    const [branches, setBranches] = useState([]);
    const [summary, setSummary] = useState(null);
    const [vouchers, setVouchers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [decidingId, setDecidingId] = useState(null);
    const [expanded, setExpanded] = useState(() => new Set());

    const scopeBranch = branchLockedId || (selectedBranchId !== 'all' ? String(selectedBranchId) : '');
    const [header, setHeader] = useState({ branchId: scopeBranch, date: todayISO(), notes: '' });
    const [filters, setFilters] = useState({ status: 'all', kind: 'all' });
    const [total, setTotal] = useState(0);
    const listTopRef = useRef(null);
    const { page, pageSize, setPage, pagerFor } = useServerPaging({
        resetKey: `${filters.status}|${filters.kind}|${scopeBranch}`,
        scrollRef: listTopRef,
    });

    const [accounts, setAccounts] = useState([]);
    const [payees, setPayees] = useState({});
    const [employees, setEmployees] = useState(null);
    const [employeesLoading, setEmployeesLoading] = useState(false);

    const [partyRows, setPartyRows] = useState(() => [emptyPartyRow()]);
    const [advance, setAdvance] = useState({ employeeKey: '', amount: '', reason: '' });
    const [period, setPeriod] = useState(thisMonth());
    const [salaryRows, setSalaryRows] = useState(() => [emptySalaryRow()]);

    useEffect(() => {
        if (!canCreate && pageTab !== 'requests') setPageTab('requests');
    }, [canCreate, pageTab]);

    useEffect(() => {
        setHeader((h) => ({ ...h, branchId: scopeBranch }));
    }, [scopeBranch]);

    // ------------------------------------------------------------------ loading

    const loadList = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiFetch(`${BASE}${qs({
                status: filters.status !== 'all' ? filters.status : undefined,
                kind: filters.kind !== 'all' ? filters.kind : undefined,
                branchId: scopeBranch || undefined,
                page,
                limit: pageSize,
            })}`);
            const list = Array.isArray(res?.vouchers) ? res.vouchers : [];
            const count = Number(res?.total) || 0;
            if (!list.length && count > 0 && page > 1) {
                setPage(Math.ceil(count / pageSize));
                return;
            }
            setVouchers(list);
            setTotal(count || list.length);
            setSummary(res?.summary || null);
            setServerFlags({ canCreate: Boolean(res?.canCreate), canDecide: Boolean(res?.canDecide) });
        } catch (e) {
            setError(e?.message || t('vv.errLoad'));
        } finally {
            setLoading(false);
        }
    }, [filters.status, filters.kind, scopeBranch, page, pageSize, setPage, t]);

    useEffect(() => {
        void loadList();
    }, [loadList]);

    useEffect(() => {
        if (Array.isArray(layoutBranches) && layoutBranches.length) {
            setBranches(layoutBranches);
            return;
        }
        apiFetch('/locker/branches')
            .then((res) => setBranches(Array.isArray(res?.branches) ? res.branches : []))
            .catch(() => setBranches([]));
    }, [layoutBranches]);

    useEffect(() => {
        if (!canCreate) return;
        apiFetch(`${BASE}/lookups/accounts`)
            .then((res) => setAccounts(Array.isArray(res?.accounts) ? res.accounts : []))
            .catch((e) => setError(e?.message || t('vv.errLoad')));
    }, [canCreate, t]);

    /** `payees[type]`: undefined = not requested, null = loading, array = loaded. */
    const loadPayees = useCallback(async (type) => {
        const key = String(type || '').toLowerCase();
        if (!['supplier', 'customer', 'employee'].includes(key) || key in payees) return;
        setPayees((p) => ({ ...p, [key]: null }));
        try {
            const res = await apiFetch(`${BASE}/lookups/payees${qs({ type: key })}`);
            setPayees((p) => ({ ...p, [key]: Array.isArray(res?.payees) ? res.payees : [] }));
        } catch (e) {
            setPayees((p) => ({ ...p, [key]: [] }));
            setError(e?.message || t('vv.errLoad'));
        }
    }, [payees, t]);

    useEffect(() => {
        if (!canCreate || (pageTab !== 'payment' && pageTab !== 'receipt')) return;
        new Set(partyRows.map((r) => r.payeeType)).forEach((type) => void loadPayees(type));
    }, [canCreate, pageTab, partyRows, loadPayees]);

    useEffect(() => {
        if (!canCreate || employees || employeesLoading || (pageTab !== 'advance' && pageTab !== 'salary')) return;
        setEmployeesLoading(true);
        getAllWorkshopEmployees({ isActive: 'true' })
            .then((res) => setEmployees(
                unwrapWorkshopEmployeesList(res).filter((e) => !e.transferPlaceholder),
            ))
            .catch((e) => {
                setEmployees([]);
                setError(e?.message || t('vv.errLoad'));
            })
            .finally(() => setEmployeesLoading(false));
    }, [canCreate, employees, employeesLoading, pageTab, t]);

    // ------------------------------------------------------------------ options

    const branchOpts = useMemo(() => {
        const list = (branches || []).map((b) => ({ value: String(b.id), label: b.name }));
        return branchLockedId ? list : [{ value: '', label: t('vv.workshopWide') }, ...list];
    }, [branches, branchLockedId, t]);

    const accountOpts = useMemo(
        () => accounts.map((a) => ({
            value: String(a.id),
            label: a.label || `${a.code} — ${a.name}`,
            hint: [a.type, a.subType].filter(Boolean).join(' · '),
            searchText: `${a.code} ${a.name}`,
        })),
        [accounts],
    );

    const payeeOpts = useCallback(
        (type) => (payees[String(type).toLowerCase()] || []).map((p) => ({
            value: String(p.id),
            label: p.name,
            hint: [p.sublabel, p.branchName, p.defaultAccountLabel].filter(Boolean).join(' · '),
            raw: p,
        })),
        [payees],
    );

    const payeeTypeOpts = useMemo(
        () => PAYEE_TYPES.map((p) => ({ value: p, label: t(`vv.payee.${p}`), searchText: p })),
        [t],
    );

    const staffOpts = useMemo(
        () => (employees || [])
            .map((e) => ({
                value: workshopStaffSelectValue(e),
                label: e.name || `#${e.id}`,
                hint: [workshopStaffRoleLabel(e), e.branchName || e.branch?.name].filter(Boolean).join(' · '),
                searchText: e.mobile || '',
                raw: e,
            }))
            .sort((a, b) => a.label.localeCompare(b.label)),
        [employees],
    );
    const staffByKey = useMemo(() => Object.fromEntries(staffOpts.map((o) => [o.value, o.raw])), [staffOpts]);
    const advanceStaffOpts = useMemo(() => staffOpts.filter((o) => o.raw?.userId), [staffOpts]);

    const statusOpts = useMemo(() => [
        { value: 'all', label: t('common.allStatuses') },
        ...STATUSES.map((s) => ({ value: s, label: t(`vv.status.${s}`), searchText: s })),
    ], [t]);
    const kindOpts = useMemo(() => [
        { value: 'all', label: t('vv.allKinds') },
        ...KINDS.map((k) => ({ value: k, label: t(`vv.kind.${k}`), searchText: k })),
    ], [t]);

    // ------------------------------------------------------------------ forms

    const vaultBalance = num(summary?.vaultBalance);
    const partyTotal = r2(partyRows.reduce((s, r) => s + num(r.amount), 0));
    const salaryTotal = r2(salaryRows.reduce((s, r) => s + (r.employeeRecordId ? salaryNet(r) : 0), 0));

    const updateParty = (key, patch) => setPartyRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    const updateSalary = (key, patch) => setSalaryRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

    const selectPayee = (row, opt) => {
        const p = opt?.raw;
        const patch = { payeeId: opt?.value || '', payeeName: p?.name || '' };
        if (p?.defaultAccountId && (!row.accountId || row.accountAuto)
            && accounts.some((a) => String(a.id) === String(p.defaultAccountId))) {
            patch.accountId = String(p.defaultAccountId);
            patch.accountAuto = true;
        }
        updateParty(row.key, patch);
    };

    const loadSalaryPreview = async (rowKey, employeeRecordId, recordType, forPeriod) => {
        updateSalary(rowKey, { loading: true });
        try {
            const p = await apiFetch(`${BASE}/payroll-preview${qs({
                period: forPeriod,
                employeeRecordId,
                recordType,
                branchId: header.branchId || undefined,
            })}`);
            const commissionEligible = recordType === 'cashier'
                || (recordType === 'employee' && String(p?.employeeType || '').toLowerCase() === 'technician');
            updateSalary(rowKey, {
                loading: false,
                userId: p?.userId || '',
                employeeName: p?.employeeName || '',
                basicSalary: num(p?.basicSalary) > 0 ? String(p.basicSalary) : '',
                advanceDue: num(p?.advanceDue),
                advanceDeduction: String(p?.suggestedAdvanceDeduction ?? p?.advanceDue ?? 0),
                commissionAmount: commissionEligible ? num(p?.commissionPayable) : 0,
                commissionLineIds: commissionEligible ? [...(p?.commissionLineIds || [])] : [],
            });
        } catch (e) {
            updateSalary(rowKey, { loading: false });
            setError(e?.message || t('vv.errPreview'));
        }
    };

    const selectSalaryEmployee = (row, opt) => {
        const parsed = parseWorkshopStaffSelectValue(opt?.value);
        const emp = staffByKey[opt?.value];
        updateSalary(row.key, {
            ...emptySalaryRow(),
            key: row.key,
            employeeKey: opt?.value || '',
            employeeRecordId: parsed.id,
            recordType: parsed.recordType,
            userId: emp?.userId ? String(emp.userId) : '',
            employeeName: emp?.name || '',
        });
        if (parsed.id && parsed.recordType) void loadSalaryPreview(row.key, parsed.id, parsed.recordType, period);
    };

    const changePeriod = (value) => {
        setPeriod(value);
        if (!/^\d{4}-\d{2}$/.test(value)) return;
        salaryRows.forEach((r) => {
            if (r.employeeRecordId && r.recordType) void loadSalaryPreview(r.key, r.employeeRecordId, r.recordType, value);
        });
    };

    const resetForms = () => {
        setPartyRows([emptyPartyRow()]);
        setAdvance({ employeeKey: '', amount: '', reason: '' });
        setSalaryRows([emptySalaryRow()]);
        setHeader((h) => ({ ...h, notes: '' }));
    };

    const buildBody = () => {
        const base = { kind: pageTab, branchId: header.branchId || undefined, date: header.date, notes: header.notes || undefined };
        if (pageTab === 'payment' || pageTab === 'receipt') {
            const rows = [];
            for (let i = 0; i < partyRows.length; i++) {
                const r = partyRows[i];
                if (r.payeeType !== 'Other' && !r.payeeId) throw new Error(t('vv.errRowPayee', { n: i + 1 }));
                if (r.payeeType === 'Other' && !r.payeeName.trim()) throw new Error(t('vv.errRowPayeeName', { n: i + 1 }));
                if (!r.accountId) throw new Error(t('vv.errRowAccount', { n: i + 1 }));
                if (!(num(r.amount) > 0)) throw new Error(t('vv.errRowAmount', { n: i + 1 }));
                rows.push({
                    payeeType: r.payeeType,
                    payeeId: r.payeeType !== 'Other' ? r.payeeId : undefined,
                    payeeName: r.payeeName.trim() || undefined,
                    accountId: r.accountId,
                    amount: num(r.amount),
                    reference: r.reference.trim() || undefined,
                    notes: r.notes.trim() || undefined,
                });
            }
            return { body: { ...base, rows }, total: partyTotal };
        }
        if (pageTab === 'advance') {
            const emp = staffByKey[advance.employeeKey];
            const parsed = parseWorkshopStaffSelectValue(advance.employeeKey);
            if (!emp?.userId) throw new Error(t('vv.errEmployee'));
            if (!(num(advance.amount) > 0)) throw new Error(t('vv.errAmount'));
            return {
                body: {
                    ...base,
                    employeeId: String(emp.userId),
                    employeeName: emp.name,
                    employeeRecordId: parsed.id,
                    recordType: parsed.recordType,
                    amount: num(advance.amount),
                    reason: advance.reason.trim() || undefined,
                },
                total: num(advance.amount),
            };
        }
        const chosen = salaryRows.filter((r) => r.employeeRecordId);
        if (!chosen.length) throw new Error(t('vv.errSalaryEmpty'));
        for (const r of chosen) {
            if (r.loading) throw new Error(t('vv.errSalaryLoading'));
            if (num(r.penalties) > 0 && !r.penaltyNotes.trim()) throw new Error(t('vv.errPenaltyReason', { name: r.employeeName }));
            if (salaryNet(r) <= 0) throw new Error(t('vv.errNet', { name: r.employeeName }));
        }
        return {
            body: {
                ...base,
                period,
                rows: chosen.map((r) => ({
                    employeeRecordId: r.employeeRecordId,
                    recordType: r.recordType,
                    userId: r.userId || undefined,
                    employeeName: r.employeeName,
                    basicSalary: num(r.basicSalary),
                    rewardBonus: num(r.rewardBonus),
                    commissionAmount: num(r.commissionAmount),
                    commissionLineIds: r.commissionLineIds,
                    advanceDeduction: num(r.advanceDeduction),
                    penalties: num(r.penalties),
                    penaltyNotes: r.penaltyNotes.trim() || undefined,
                })),
            },
            total: salaryTotal,
        };
    };

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        let built;
        try {
            built = buildBody();
        } catch (err) {
            setError(err.message);
            return;
        }
        if (pageTab !== 'receipt' && built.total > vaultBalance + 0.005) {
            setError(t('vv.errOverVault', { total: money(built.total), balance: money(vaultBalance) }));
            return;
        }
        setSubmitting(true);
        try {
            const res = await apiFetch(BASE, { method: 'POST', body: JSON.stringify(built.body) });
            if (res?.success === false) throw new Error(res?.message || t('vv.errSubmit'));
            setSuccess(t('vv.submitted', { ref: res?.voucher?.referenceCode || '', amount: money(res?.voucher?.amount) }));
            resetForms();
            await loadList();
        } catch (err) {
            setError(err?.message || t('vv.errSubmit'));
        } finally {
            setSubmitting(false);
        }
    };

    const decide = async (row, action) => {
        let reason;
        if (action === 'reject') {
            reason = window.prompt(t('common.rejectPrompt')) || '';
            if (!reason.trim()) return;
        } else if (!window.confirm(t('vv.confirmApprove', { ref: row.referenceCode, amount: money(row.amount) }))) {
            return;
        }
        setDecidingId(row.id);
        setError('');
        setSuccess('');
        try {
            const res = await apiFetch(`${BASE}/${encodeURIComponent(row.id)}/${action}`, {
                method: 'POST',
                body: JSON.stringify(action === 'reject' ? { rejectionReason: reason } : {}),
            });
            if (res?.success === false) throw new Error(res?.message || t('vv.errDecide'));
            setSuccess(action === 'approve' ? t('vv.approved', { ref: row.referenceCode }) : t('vv.rejected', { ref: row.referenceCode }));
            await loadList();
        } catch (err) {
            setError(err?.message || t('vv.errDecide'));
            await loadList();
        } finally {
            setDecidingId(null);
        }
    };

    const toggleExpanded = (id) => setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
    });

    // ------------------------------------------------------------------ render helpers

    const messages = (
        <>
            {error ? (
                <div className="wlk-error" style={{ marginBottom: 12 }}>
                    <AlertTriangle size={14} /> {error}
                </div>
            ) : null}
            {success ? (
                <div className="wlk-error" style={{ marginBottom: 12, ...okBox }}>
                    <CheckCircle size={14} /> {success}
                </div>
            ) : null}
        </>
    );

    const headerFields = (
        <div className="wlk-grid wlk-grid--form" style={{ marginBottom: 12 }}>
            <label>
                <span>{t('common.branch')}</span>
                <SearchSelect
                    id="vv-branch"
                    options={branchOpts}
                    value={header.branchId}
                    onChange={(v) => setHeader((h) => ({ ...h, branchId: String(v ?? '') }))}
                    placeholder={t('exp.searchBranch')}
                    emptyHint={t('common.noMatches')}
                    disabled={submitting || Boolean(branchLockedId)}
                    title={branchLockedId ? t('common.branchLocked') : undefined}
                />
            </label>
            <label>
                <span>{t('common.date')}</span>
                <input type="date" value={header.date} onChange={(e) => setHeader((h) => ({ ...h, date: e.target.value }))} required />
            </label>
            <label style={{ gridColumn: 'span 2' }}>
                <span>{t('vv.notes')}</span>
                <input type="text" value={header.notes} onChange={(e) => setHeader((h) => ({ ...h, notes: e.target.value }))} placeholder={t('exp.notesPh')} />
            </label>
        </div>
    );

    const partyForm = (
        <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
                <strong style={{ color: '#0f172a' }}>{pageTab === 'payment' ? t('vv.paymentRows') : t('vv.receiptRows')}</strong>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: '#64748b' }}>{t('exp.linesTotal', { amount: money(partyTotal) })}</span>
                    <button type="button" className="btn-secondary" onClick={() => setPartyRows((p) => [...p, emptyPartyRow(p[p.length - 1]?.payeeType)])}>
                        <Plus size={14} /> {t('exp.addLine')}
                    </button>
                </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {partyRows.map((r, idx) => (
                    <div key={r.key} className="wlk-grid wlk-grid--form" style={rowCard}>
                        <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>{t('exp.line', { n: idx + 1 })}</span>
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => setPartyRows((p) => (p.length <= 1 ? p : p.filter((x) => x.key !== r.key)))}
                                disabled={partyRows.length <= 1}
                                title={t('exp.removeLine')}
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                        <label>
                            <span>{pageTab === 'payment' ? t('vv.payTo') : t('vv.receiveFrom')}</span>
                            <SearchSelect
                                id={`vv-ptype-${r.key}`}
                                options={payeeTypeOpts}
                                value={r.payeeType}
                                onChange={(v) => updateParty(r.key, { payeeType: v, payeeId: '', payeeName: '' })}
                                placeholder={t('common.typeToSearch')}
                                emptyHint={t('common.noMatches')}
                                disabled={submitting}
                            />
                        </label>
                        {r.payeeType === 'Other' ? (
                            <label>
                                <span>{t('vv.payeeName')}</span>
                                <input type="text" value={r.payeeName} onChange={(e) => updateParty(r.key, { payeeName: e.target.value })} required />
                            </label>
                        ) : (
                            <label>
                                <span>{t(`vv.payee.${r.payeeType}`)}</span>
                                <SearchSelect
                                    id={`vv-payee-${r.key}`}
                                    options={payeeOpts(r.payeeType)}
                                    value={r.payeeId}
                                    onChange={(_v, opt) => selectPayee(r, opt)}
                                    required
                                    placeholder={t('vv.searchPayee')}
                                    emptyHint={t('common.noMatches')}
                                    loading={payees[r.payeeType.toLowerCase()] == null}
                                    loadingHint={t('common.loading')}
                                    moreHint={t('common.moreMatches')}
                                    menuMinWidth={320}
                                    disabled={submitting}
                                />
                            </label>
                        )}
                        <label>
                            <span>{t('vv.account')}</span>
                            <SearchSelect
                                id={`vv-acct-${r.key}`}
                                options={accountOpts}
                                value={r.accountId}
                                onChange={(v) => updateParty(r.key, { accountId: String(v || ''), accountAuto: false })}
                                required
                                placeholder={t('vv.searchAccount')}
                                emptyHint={t('common.noMatches')}
                                moreHint={t('common.moreMatches')}
                                menuMinWidth={360}
                                disabled={submitting}
                            />
                        </label>
                        <label>
                            <span>{t('common.amountSar')}</span>
                            <input type="number" min="0.01" step="0.01" value={r.amount} onChange={(e) => updateParty(r.key, { amount: e.target.value })} required />
                        </label>
                        <label>
                            <span>{t('common.referenceOptional')}</span>
                            <input type="text" value={r.reference} onChange={(e) => updateParty(r.key, { reference: e.target.value })} />
                        </label>
                        <label>
                            <span>{t('exp.descOptional')}</span>
                            <input type="text" value={r.notes} onChange={(e) => updateParty(r.key, { notes: e.target.value })} />
                        </label>
                    </div>
                ))}
            </div>
        </>
    );

    const advanceForm = (
        <div className="wlk-grid wlk-grid--form" style={rowCard}>
            <label>
                <span>{t('vv.employee')}</span>
                <SearchSelect
                    id="vv-adv-employee"
                    options={advanceStaffOpts}
                    value={advance.employeeKey}
                    onChange={(v) => setAdvance((a) => ({ ...a, employeeKey: String(v || '') }))}
                    required
                    placeholder={t('vv.searchEmployee')}
                    emptyHint={t('common.noMatches')}
                    loading={employeesLoading}
                    loadingHint={t('common.loading')}
                    moreHint={t('common.moreMatches')}
                    menuMinWidth={300}
                    disabled={submitting}
                />
            </label>
            <label>
                <span>{t('common.amountSar')}</span>
                <input type="number" min="0.01" step="0.01" value={advance.amount} onChange={(e) => setAdvance((a) => ({ ...a, amount: e.target.value }))} required />
            </label>
            <label style={{ gridColumn: 'span 2' }}>
                <span>{t('vv.reason')}</span>
                <input type="text" value={advance.reason} onChange={(e) => setAdvance((a) => ({ ...a, reason: e.target.value }))} />
            </label>
            <p style={{ gridColumn: '1 / -1', margin: 0, fontSize: 12, color: '#64748b' }}>{t('vv.advanceHint')}</p>
        </div>
    );

    const salaryForm = (
        <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{t('vv.period')}</span>
                    <input type="month" value={period} onChange={(e) => changePeriod(e.target.value)} required />
                </label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: '#64748b' }}>{t('vv.netTotal', { amount: money(salaryTotal) })}</span>
                    <button type="button" className="btn-secondary" onClick={() => setSalaryRows((p) => [...p, emptySalaryRow()])}>
                        <Plus size={14} /> {t('vv.addEmployee')}
                    </button>
                </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {salaryRows.map((r, idx) => {
                    const taken = new Set(salaryRows.filter((x) => x.key !== r.key).map((x) => x.employeeKey));
                    return (
                        <div key={r.key} className="wlk-grid wlk-grid--form" style={rowCard}>
                            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>
                                    {t('exp.line', { n: idx + 1 })}
                                    {r.loading ? ` · ${t('common.loading')}` : ''}
                                </span>
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() => setSalaryRows((p) => (p.length <= 1 ? p : p.filter((x) => x.key !== r.key)))}
                                    disabled={salaryRows.length <= 1}
                                    title={t('exp.removeLine')}
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                            <label>
                                <span>{t('vv.employee')}</span>
                                <SearchSelect
                                    id={`vv-sal-${r.key}`}
                                    options={staffOpts.filter((o) => !taken.has(o.value))}
                                    value={r.employeeKey}
                                    onChange={(_v, opt) => selectSalaryEmployee(r, opt)}
                                    placeholder={t('vv.searchEmployee')}
                                    emptyHint={t('common.noMatches')}
                                    loading={employeesLoading}
                                    loadingHint={t('common.loading')}
                                    moreHint={t('common.moreMatches')}
                                    menuMinWidth={300}
                                    disabled={submitting}
                                />
                            </label>
                            <label>
                                <span>{t('vv.basic')}</span>
                                <input type="number" min="0" step="0.01" value={r.basicSalary} disabled={r.loading} onChange={(e) => updateSalary(r.key, { basicSalary: e.target.value })} />
                            </label>
                            <label>
                                <span>{t('vv.reward')}</span>
                                <input type="number" min="0" step="0.01" value={r.rewardBonus} onChange={(e) => updateSalary(r.key, { rewardBonus: e.target.value })} />
                            </label>
                            <label>
                                <span>{t('vv.commission')}</span>
                                <input type="text" readOnly value={money(r.commissionAmount)} style={{ background: '#F8FAFC' }} />
                            </label>
                            <label>
                                <span>{t('vv.advanceDeduction', { due: money(r.advanceDue) })}</span>
                                <input type="number" min="0" max={r.advanceDue || undefined} step="0.01" value={r.advanceDeduction} onChange={(e) => updateSalary(r.key, { advanceDeduction: e.target.value })} />
                            </label>
                            <label>
                                <span>{t('vv.penalties')}</span>
                                <input type="number" min="0" step="0.01" value={r.penalties} onChange={(e) => updateSalary(r.key, { penalties: e.target.value })} />
                            </label>
                            {num(r.penalties) > 0 ? (
                                <label>
                                    <span>{t('vv.penaltyReason')}</span>
                                    <input type="text" value={r.penaltyNotes} onChange={(e) => updateSalary(r.key, { penaltyNotes: e.target.value })} required />
                                </label>
                            ) : null}
                            <label>
                                <span>{t('vv.net')}</span>
                                <input type="text" readOnly value={money(r.employeeRecordId ? salaryNet(r) : 0)} style={{ background: '#F8FAFC', fontWeight: 700 }} />
                            </label>
                        </div>
                    );
                })}
            </div>
        </>
    );

    const formTotal = pageTab === 'advance' ? num(advance.amount) : pageTab === 'salary' ? salaryTotal : partyTotal;

    const detailRows = (v) => {
        const p = v.payload || {};
        if (v.kind === 'payment' || v.kind === 'receipt') {
            return (p.rows || []).map((x, i) => (
                <li key={i}>
                    {t(`vv.payee.${x.payeeType}`)}: <strong>{x.payeeName || x.payeeId || dash}</strong>
                    {' · '}{x.accountLabel || x.accountId}{' · '}{money(x.amount)}
                    {x.reference ? ` · ${x.reference}` : ''}
                </li>
            ));
        }
        if (v.kind === 'advance') {
            return [<li key="a"><strong>{p.employeeName}</strong> · {money(p.amount)}{p.reason ? ` · ${p.reason}` : ''}</li>];
        }
        return (p.rows || []).map((x, i) => (
            <li key={i}>
                <strong>{x.employeeName}</strong> · {t('vv.basic')} {money(x.basicSalary)}
                {num(x.rewardBonus) ? ` · ${t('vv.reward')} ${money(x.rewardBonus)}` : ''}
                {num(x.commissionAmount) ? ` · ${t('vv.commission')} ${money(x.commissionAmount)}` : ''}
                {num(x.advanceDeduction) ? ` · ${t('vv.advanceDeductionShort')} −${money(x.advanceDeduction)}` : ''}
                {num(x.penalties) ? ` · ${t('vv.penalties')} −${money(x.penalties)}` : ''}
                {' · '}{t('vv.net')} <strong>{money(salaryNet(x))}</strong>
            </li>
        ));
    };

    const postedRefs = (v) => {
        const refs = v.resultRefs || {};
        if (Array.isArray(refs.transactions) && refs.transactions.length) {
            return refs.transactions.map((x) => x.voucherNumber).filter(Boolean).join(', ');
        }
        if (Array.isArray(refs.journalIds) && refs.journalIds.length) {
            return refs.journalIds.map((id) => `JE #${id}`).join(', ');
        }
        return '';
    };

    const tabs = [
        ...(canCreate ? [
            { id: 'payment', icon: ArrowUpRight, label: t('vv.tab.payment') },
            { id: 'receipt', icon: ArrowDownLeft, label: t('vv.tab.receipt') },
            { id: 'advance', icon: HandCoins, label: t('vv.tab.advance') },
            { id: 'salary', icon: BadgeDollarSign, label: t('vv.tab.salary') },
        ] : []),
        { id: 'requests', icon: ClipboardList, label: t('vv.tab.requests'), badge: summary?.pendingCount },
    ];

    return (
        <div className="wlk-page">
            <div className="wlk-topbar">
                <div>
                    <h2 className="wlk-title">{t('vv.title')}</h2>
                    <p className="wlk-subtitle">{canDecide ? t('vv.subAdmin') : t('vv.sub')}</p>
                </div>
                <button className="btn-secondary" type="button" onClick={() => void loadList()} disabled={loading}>
                    <RefreshCw size={16} className={loading ? 'spin' : ''} /> {t('common.refresh')}
                </button>
            </div>

            <div className="wlk-grid wlk-grid--kpi">
                <div className="wlk-stat wlk-stat--info">
                    <div className="wlk-stat-icon"><Wallet size={18} /></div>
                    <div className="wlk-stat-body">
                        <div className="wlk-stat-label">{t('common.vaultBalance')}</div>
                        <div className="wlk-stat-value">{money(vaultBalance)}</div>
                        <div className="wlk-stat-hint">{t('common.vaultHint')}</div>
                    </div>
                </div>
                <div className="wlk-stat">
                    <div className="wlk-stat-body">
                        <div className="wlk-stat-label">{t('vv.pendingCount')}</div>
                        <div className="wlk-stat-value">{summary?.pendingCount ?? 0}</div>
                        <div className="wlk-stat-hint">{t('vv.pendingCountHint')}</div>
                    </div>
                </div>
                <div className="wlk-stat">
                    <div className="wlk-stat-body">
                        <div className="wlk-stat-label">{t('vv.pendingOut')}</div>
                        <div className="wlk-stat-value">{money(summary?.pendingOutflow)}</div>
                        <div className="wlk-stat-hint">{t('vv.pendingOutHint')}</div>
                    </div>
                </div>
                <div className="wlk-stat">
                    <div className="wlk-stat-body">
                        <div className="wlk-stat-label">{t('vv.pendingIn')}</div>
                        <div className="wlk-stat-value">{money(summary?.pendingInflow)}</div>
                        <div className="wlk-stat-hint">{t('vv.pendingInHint')}</div>
                    </div>
                </div>
            </div>

            <div className="wlk-segmented" role="tablist" aria-label={t('vv.sections')}>
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={pageTab === tab.id}
                        className={`wlk-segmented__btn${pageTab === tab.id ? ' wlk-segmented__btn--active' : ''}`}
                        onClick={() => { setPageTab(tab.id); setError(''); setSuccess(''); }}
                    >
                        <tab.icon size={14} />
                        {tab.label}
                        {tab.badge > 0 ? <span className="wlk-segmented__badge">{tab.badge}</span> : null}
                    </button>
                ))}
            </div>

            {pageTab !== 'requests' && canCreate ? (
                <form className="wlk-create-user" onSubmit={submit}>
                    {messages}
                    <p style={{ margin: '0 0 12px', fontSize: 13, color: '#475569' }}>{t(`vv.help.${pageTab}`)}</p>
                    {headerFields}
                    {pageTab === 'advance' ? advanceForm : pageTab === 'salary' ? salaryForm : partyForm}
                    <div className="wlk-create-user-footer">
                        <span style={{ fontSize: 13, color: '#64748b', marginInlineEnd: 'auto' }}>
                            {pageTab === 'receipt'
                                ? t('vv.afterReceipt', { amount: money(vaultBalance + formTotal) })
                                : t('vv.afterPayment', { amount: money(vaultBalance - formTotal) })}
                        </span>
                        <button className="btn-primary" type="submit" disabled={submitting}>
                            <Wallet size={14} /> {submitting ? t('exp.submitting') : t('vv.submit', { amount: money(formTotal) })}
                        </button>
                    </div>
                </form>
            ) : (
                <div className="wlk-section" ref={listTopRef}>
                    <div className="wlk-section-header">
                        <h3>
                            {t('vv.tab.requests')}
                            <span className="wlk-count">{total}</span>
                        </h3>
                    </div>
                    {messages}
                    <div className="wlk-filter-bar" style={{ margin: '0 0 12px' }}>
                        <div className="wlk-filter-grid">
                            <div className="ws-field">
                                <label htmlFor="vv-filter-status">{t('common.status')}</label>
                                <SearchSelect
                                    id="vv-filter-status"
                                    size="sm"
                                    options={statusOpts}
                                    value={filters.status}
                                    onChange={(v) => setFilters((f) => ({ ...f, status: String(v || 'all') }))}
                                    placeholder={t('common.allStatuses')}
                                    emptyHint={t('common.noMatches')}
                                    disabled={loading}
                                />
                            </div>
                            <div className="ws-field">
                                <label htmlFor="vv-filter-kind">{t('vv.kind')}</label>
                                <SearchSelect
                                    id="vv-filter-kind"
                                    size="sm"
                                    options={kindOpts}
                                    value={filters.kind}
                                    onChange={(v) => setFilters((f) => ({ ...f, kind: String(v || 'all') }))}
                                    placeholder={t('vv.allKinds')}
                                    emptyHint={t('common.noMatches')}
                                    disabled={loading}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="wlk-section-body">
                        <WsTableScroll>
                        <table className="wlk-table">
                            <thead>
                                <tr>
                                    <th aria-label={t('vv.details')} />
                                    <th>{t('vv.ref')}</th>
                                    <th>{t('common.date')}</th>
                                    <th>{t('vv.kind')}</th>
                                    <th>{t('common.branch')}</th>
                                    <th>{t('vv.details')}</th>
                                    <th>{t('common.amount')}</th>
                                    <th>{t('common.status')}</th>
                                    <th>{t('vv.requestedBy')}</th>
                                    <th>{canDecide ? t('common.actions') : t('vv.decidedBy')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {vouchers.length === 0 ? (
                                    <tr>
                                        <td colSpan={10} style={{ color: '#64748B', textAlign: 'center' }}>
                                            {loading ? t('common.loading') : t('vv.empty')}
                                        </td>
                                    </tr>
                                ) : vouchers.map((v) => {
                                    const open = expanded.has(v.id);
                                    const inflow = v.kind === 'receipt';
                                    const refs = postedRefs(v);
                                    return (
                                        <React.Fragment key={v.id}>
                                            <tr>
                                                <td>
                                                    <button type="button" className="wlk-action-btn" onClick={() => toggleExpanded(v.id)} aria-expanded={open} title={t('vv.details')}>
                                                        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                    </button>
                                                </td>
                                                <td><strong>{v.referenceCode}</strong></td>
                                                <td>{v.voucherDate}</td>
                                                <td>{t(`vv.kind.${v.kind}`)}</td>
                                                <td>{v.branchName || t('vv.workshopWide')}</td>
                                                <td>
                                                    {v.summary || dash}
                                                    {v.lineCount > 1 ? <span style={{ color: '#64748b' }}> {t('vv.lines', { n: v.lineCount })}</span> : null}
                                                    {v.notes ? <div style={{ fontSize: 11, color: '#64748b' }}>{v.notes}</div> : null}
                                                    {v.status === 'rejected' && v.rejectionReason ? (
                                                        <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 2 }}>{v.rejectionReason}</div>
                                                    ) : null}
                                                    {refs ? <div style={{ fontSize: 11, color: '#15803d', marginTop: 2 }}>{refs}</div> : null}
                                                </td>
                                                <td style={{ color: inflow ? '#15803d' : '#b91c1c', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                                    {inflow ? '+' : '−'}{money(v.amount)}
                                                </td>
                                                <td>
                                                    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, ...statusStyle(v.status) }}>
                                                        {t(`vv.status.${v.status}`)}
                                                    </span>
                                                </td>
                                                <td>{v.createdBy?.name || dash}</td>
                                                <td>
                                                    {canDecide && v.status === 'pending' ? (
                                                        <div className="wlk-action-group">
                                                            <button
                                                                type="button"
                                                                className="wlk-action-btn wlk-action-btn--record"
                                                                onClick={() => decide(v, 'approve')}
                                                                disabled={decidingId != null}
                                                            >
                                                                {decidingId === v.id ? t('common.posting') : t('exp.approve')}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="wlk-action-btn wlk-action-btn--reject"
                                                                onClick={() => decide(v, 'reject')}
                                                                disabled={decidingId != null}
                                                            >
                                                                {t('common.reject')}
                                                            </button>
                                                        </div>
                                                    ) : (v.decidedBy?.name || dash)}
                                                </td>
                                            </tr>
                                            {open ? (
                                                <tr>
                                                    <td />
                                                    <td colSpan={9} style={{ background: '#f8fafc' }}>
                                                        <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 12, lineHeight: 1.7 }}>
                                                            {detailRows(v)}
                                                        </ul>
                                                    </td>
                                                </tr>
                                            ) : null}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                        </WsTableScroll>
                        <LockerTablePager {...pagerFor(total)} />
                    </div>
                </div>
            )}
        </div>
    );
}
