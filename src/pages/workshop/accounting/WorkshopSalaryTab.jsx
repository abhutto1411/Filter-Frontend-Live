import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, Save, RefreshCw, Banknote, Filter, FileDown, Pencil, FileSpreadsheet } from 'lucide-react';
import Modal from '../../../components/Modal';
import {
    deleteWorkshopSalaryPayroll,
    getRecentWorkshopSalaryPayroll,
    getSalaryPayrollPreview,
    postWorkshopSalaryPayroll,
    updateWorkshopSalaryPayroll,
} from '../../../services/advancesApi';
import { listCashBankAccounts } from '../../../services/workshopAccountingApi';
import {
    getAllWorkshopEmployees,
    indexWorkshopStaffBySelectValue,
    parseWorkshopStaffSelectValue,
    unwrapWorkshopEmployeesList,
    workshopStaffRoleLabel,
    workshopStaffSelectValue,
} from '../../../services/workshopStaffApi';
import {
    exportSalaryPaymentsExcel,
    exportSalaryPaymentsPdf,
    formatSalaryMonth,
} from './workshopSalaryPaymentsExport';
import WsStaffPicker from '../../../components/workshop/WsStaffPicker';
import WsSearchSuggest from '../../../components/workshop/WsSearchSuggest';
import WsTablePagination from '../../../components/workshop/WsTablePagination';
import usePagedSearch, { WS_PAGE_SIZES } from '../../../components/workshop/usePagedSearch';
import { staffMeta, staffName, staffSearchText } from './staffPickerOptions';

const fmt = (n) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return '0.00';
    return x.toLocaleString('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const ackBadge = (status, ackAt) => {
    const s = String(status || 'pending').toLowerCase();
    if (s === 'accepted') {
        const when = ackAt ? new Date(ackAt).toLocaleString() : '';
        return (
            <span className="status-badge approved" title={when || undefined}>
                Accepted{when ? ` · ${when}` : ''}
            </span>
        );
    }
    if (s === 'rejected') {
        const when = ackAt ? new Date(ackAt).toLocaleString() : '';
        return (
            <span className="status-badge pending" style={{ background: '#FEE2E2', color: '#B91C1C' }} title={when || undefined}>
                Rejected{when ? ` · ${when}` : ''}
            </span>
        );
    }
    return <span className="status-badge pending">Awaiting technician</span>;
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const filterChipStyle = {
    padding: '2px 8px',
    borderRadius: 999,
    background: '#F1F5F9',
    border: '1px solid #E2E8F0',
    fontWeight: 600,
};

const fmtFilterDate = (ymd) => {
    const [y, m, d] = String(ymd).split('-');
    return y && m && d ? `${d}/${m}/${y}` : ymd;
};

const recentRowKey = (s) => String(s.id);
const recentRowName = (s) => s.employeeName || '';
const recentRowHay = (s) =>
    [
        s.employeeName,
        s.period,
        s.payFromAccountName,
        s.branchName,
        s.entryNumber,
        s.paymentDate ? String(s.paymentDate).slice(0, 10) : '',
    ]
        .filter(Boolean)
        .join(' ');
const recentRowMeta = (s) =>
    [
        s.entryNumber,
        s.period,
        s.paymentDate ? new Date(s.paymentDate).toLocaleDateString() : '',
        `Net SAR ${fmt(s.netSalary)}`,
        s.payFromAccountName,
    ]
        .filter(Boolean)
        .join(' · ');

const listBasicSalary = (emp) => {
    if (!emp) return '';
    const n = Number(emp.basicSalary ?? emp.basic_salary ?? 0);
    return Number.isFinite(n) && n > 0 ? String(n) : '';
};

/** Resolve employee id/type from row state (select key is source of truth for the dropdown). */
const resolveRowEmployee = (row) => {
    const parsed = parseWorkshopStaffSelectValue(row.employeeSelectKey);
    const fromSelect = String(row.employeeSelectKey || '').includes(':');
    return {
        employeeRecordId: String((fromSelect ? parsed.id : row.employeeRecordId) || parsed.id || '').trim(),
        recordType: fromSelect ? parsed.recordType : (parsed.recordType || row.recordType || ''),
    };
};

const isNonTechnicianStaff = (recordType, employeeType) => {
    if (recordType === 'portal_user') return true;
    if (recordType === 'cashier') return false;
    const et = String(employeeType || '').trim().toLowerCase();
    return Boolean(et) && et !== 'technician';
};

const employeeBulkKey = (recordType, employeeRecordId) => {
    const type = String(recordType || '').trim();
    return type ? `${type}:${String(employeeRecordId)}` : '';
};

const defaultPeriod = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const emptyRow = () => ({
    key: `row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    employeeSelectKey: '',
    employeeRecordId: '',
    recordType: '',
    userId: '',
    employeeName: '',
    basicSalary: '',
    rewardBonus: '0',
    advanceDue: 0,
    commissionPayable: 0,
    commissionLineIds: [],
    advanceDeduction: '0',
    penalties: '0',
    penaltyNotes: '',
    notes: '',
    previewLoading: false,
    previewLoaded: false,
});

const branchKey = (b) => String(b.id);
const branchLabel = (b) => b?.name || '—';
const branchMeta = (b) => [b?.branchCode, b?.address].filter(Boolean).join(' · ') || 'Branch';
const branchSearchText = (b) => [b?.name, b?.branchCode, b?.address].filter(Boolean).join(' ');

const editNetPayable = (f) => {
    if (!f) return 0;
    return (Number(f.basicSalary) || 0)
        + (Number(f.rewardBonus) || 0)
        + (Number(f.commissionAmount) || 0)
        - (Number(f.advanceDeduction) || 0)
        - (Number(f.penalties) || 0);
};

function netPayable(row) {
    const basic = Number(row.basicSalary) || 0;
    const reward = Number(row.rewardBonus) || 0;
    const comm = Number(row.commissionPayable) || 0;
    const adv = Number(row.advanceDeduction) || 0;
    const pen = Number(row.penalties) || 0;
    return Math.max(basic + reward + comm - adv - pen, 0);
}

export default function WorkshopSalaryTab({ branchFilter = '', branches = [] }) {
    const [period, setPeriod] = useState(defaultPeriod());
    const [paymentDate, setPaymentDate] = useState(todayIso());
    const [payFromAccountId, setPayFromAccountId] = useState('');
    const [rows, setRows] = useState([emptyRow()]);
    const [employees, setEmployees] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [recent, setRecent] = useState([]);
    const [recentLoading, setRecentLoading] = useState(false);
    const [recentDateFrom, setRecentDateFrom] = useState('');
    const [recentDateTo, setRecentDateTo] = useState('');
    const [recentBranchId, setRecentBranchId] = useState(() => branchFilter || '');
    const [appliedFilters, setAppliedFilters] = useState(() => ({
        branchId: branchFilter || '',
        dateFrom: '',
        dateTo: '',
    }));
    const [filterError, setFilterError] = useState('');
    const [loadingLookups, setLoadingLookups] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [msg, setMsg] = useState('');
    const [error, setError] = useState('');
    const [editForm, setEditForm] = useState(null);
    const [editSaving, setEditSaving] = useState(false);
    const [editError, setEditError] = useState('');
    const [deleteRow, setDeleteRow] = useState(null);
    const [deleteBusy, setDeleteBusy] = useState(false);
    const [deleteError, setDeleteError] = useState('');
    const [sheetOpen, setSheetOpen] = useState(false);
    const [sheetMonth, setSheetMonth] = useState(defaultPeriod());
    const [sheetBranchId, setSheetBranchId] = useState('');
    const [sheetFormat, setSheetFormat] = useState('pdf');
    const [sheetBusy, setSheetBusy] = useState(false);
    const [sheetError, setSheetError] = useState('');
    const previewSeqRef = useRef({});
    const recentSeqRef = useRef(0);
    /** Filters the table was last loaded with — background refreshes never pick up unapplied inputs. */
    const appliedFiltersRef = useRef(appliedFilters);

    const branchParams = useMemo(
        () => (branchFilter ? { branchId: branchFilter } : {}),
        [branchFilter],
    );

    const loadRecentPayments = useCallback(async ({ filters, silent = false } = {}) => {
        const f = filters ?? appliedFiltersRef.current;
        const seq = recentSeqRef.current + 1;
        recentSeqRef.current = seq;
        if (!silent) setRecentLoading(true);
        try {
            const salRes = await getRecentWorkshopSalaryPayroll({
                limit: 5000,
                ...(f.branchId ? { branchId: f.branchId } : {}),
                ...(f.dateFrom ? { dateFrom: f.dateFrom } : {}),
                ...(f.dateTo ? { dateTo: f.dateTo } : {}),
            });
            if (recentSeqRef.current !== seq) return;
            const list = (salRes?.list ?? []).filter((r) => {
                if (f.branchId && String(r.branchId ?? '') !== String(f.branchId)) return false;
                const day = r.paymentDate ? String(r.paymentDate).slice(0, 10) : '';
                if (f.dateFrom && day && day < f.dateFrom) return false;
                if (f.dateTo && day && day > f.dateTo) return false;
                return true;
            });
            appliedFiltersRef.current = f;
            setAppliedFilters(f);
            setRecent(list);
        } catch (e) {
            if (recentSeqRef.current !== seq) return;
            setError(e?.message || 'Could not refresh recent salary payments.');
        } finally {
            if (recentSeqRef.current === seq) setRecentLoading(false);
        }
    }, []);

    const refreshRecent = useCallback(() => loadRecentPayments(), [loadRecentPayments]);

    const branchNameOf = useCallback((id) => {
        if (!id) return 'All branches';
        const match = branches.find((b) => String(b.id) === String(id));
        return match?.name || 'Branch';
    }, [branches]);

    /** Label of the branch whose rows are actually loaded (never the unsaved dropdown value). */
    const recentBranchName = useMemo(
        () => branchNameOf(appliedFilters.branchId),
        [branchNameOf, appliedFilters.branchId],
    );

    const filtersDirty = recentBranchId !== appliedFilters.branchId
        || recentDateFrom !== appliedFilters.dateFrom
        || recentDateTo !== appliedFilters.dateTo;

    const applyRecentFilters = () => {
        setFilterError('');
        if (recentDateFrom && recentDateTo && recentDateFrom > recentDateTo) {
            setFilterError('"From" date cannot be after the "To" date.');
            return;
        }
        loadRecentPayments({
            filters: { branchId: recentBranchId, dateFrom: recentDateFrom, dateTo: recentDateTo },
        });
    };

    const clearRecentFilters = () => {
        setFilterError('');
        const next = { branchId: branchFilter || '', dateFrom: '', dateTo: '' };
        setRecentBranchId(next.branchId);
        setRecentDateFrom('');
        setRecentDateTo('');
        loadRecentPayments({ filters: next });
    };

    const editPayFromOptions = useMemo(() => {
        if (!editForm?.payFromAccountId) return accounts;
        if (accounts.some((a) => String(a.id) === String(editForm.payFromAccountId))) return accounts;
        return [{ id: editForm.payFromAccountId, name: editForm.payFromAccountName || 'Current account' }, ...accounts];
    }, [accounts, editForm?.payFromAccountId, editForm?.payFromAccountName]);

    const openEdit = (s) => {
        setEditError('');
        setEditForm({
            id: s.id,
            employeeName: s.employeeName,
            entryNumber: s.entryNumber || '',
            branchName: s.branchName || '',
            period: s.period || '',
            paymentDate: s.paymentDate ? String(s.paymentDate).slice(0, 10) : todayIso(),
            payFromAccountId: s.payFromAccountId ? String(s.payFromAccountId) : '',
            payFromAccountName: s.payFromAccountName || '',
            basicSalary: String(s.basicSalary ?? 0),
            rewardBonus: String(s.rewardBonus ?? 0),
            commissionAmount: Number(s.commissionAmount || 0),
            advanceDeduction: String(s.advanceDeduction ?? 0),
            penalties: String(s.penalties ?? 0),
            penaltyNotes: s.penaltyNotes || '',
            notes: s.notes || '',
        });
    };

    const saveEdit = async () => {
        if (!editForm) return;
        setEditError('');
        const nums = ['basicSalary', 'rewardBonus', 'advanceDeduction', 'penalties'];
        for (const k of nums) {
            const n = Number(editForm[k]);
            if (editForm[k] === '' || !Number.isFinite(n) || n < 0) {
                setEditError('Salary, reward/bonus, advance deduction and penalties must be numbers ≥ 0.');
                return;
            }
        }
        if (!editForm.period) { setEditError('Select the salary period (month).'); return; }
        if (!editForm.paymentDate) { setEditError('Select the payment date.'); return; }
        if (!editForm.payFromAccountId) { setEditError('Select a Pay From account (cash or bank).'); return; }
        if (Number(editForm.penalties) > 0 && !editForm.penaltyNotes.trim()) {
            setEditError('Penalty reason is required when a penalty amount is entered.');
            return;
        }
        const gross = (Number(editForm.basicSalary) || 0) + (Number(editForm.rewardBonus) || 0) + editForm.commissionAmount;
        if (gross <= 0) { setEditError('Salary must have a payable amount greater than zero.'); return; }
        if (editNetPayable(editForm) < -0.004) { setEditError('Deductions cannot exceed the gross salary.'); return; }

        setEditSaving(true);
        try {
            const res = await updateWorkshopSalaryPayroll(editForm.id, {
                period: editForm.period,
                paymentDate: editForm.paymentDate,
                payFromAccountId: String(editForm.payFromAccountId),
                basicSalary: Number(editForm.basicSalary),
                rewardBonus: Number(editForm.rewardBonus),
                advanceDeduction: Number(editForm.advanceDeduction),
                penalties: Number(editForm.penalties),
                penaltyNotes: editForm.penaltyNotes.trim(),
                notes: editForm.notes.trim(),
            });
            setMsg(
                `Updated salary for ${editForm.employeeName}. Same document ${res?.entryNumber || editForm.entryNumber || ''} — net SAR ${fmt(res?.netSalary)}.`
                + (res?.technicianAckReset ? ' Technician acknowledgment reset to awaiting.' : ''),
            );
            setError('');
            setEditForm(null);
            await loadRecentPayments();
        } catch (e) {
            setEditError(e?.message || 'Could not update salary.');
        } finally {
            setEditSaving(false);
        }
    };

    const confirmDelete = async () => {
        if (!deleteRow) return;
        setDeleteError('');
        setDeleteBusy(true);
        try {
            const res = await deleteWorkshopSalaryPayroll(deleteRow.id);
            const jes = (res?.deletedJournals ?? []).join(', ');
            const comm = Number(res?.revertedCommissionLines || 0);
            setMsg(
                `Deleted salary for ${deleteRow.employeeName} (${deleteRow.period}).`
                + (jes ? ` Journal ${jes} removed from all ledgers.` : '')
                + (comm ? ` ${comm} commission line(s) returned to unpaid.` : ''),
            );
            setError('');
            setDeleteRow(null);
            await loadRecentPayments();
        } catch (e) {
            setDeleteError(e?.message || 'Could not delete salary.');
        } finally {
            setDeleteBusy(false);
        }
    };

    const openSheet = () => {
        setSheetError('');
        setSheetBranchId(appliedFilters.branchId || branchFilter || '');
        setSheetOpen(true);
    };

    const downloadSheet = async () => {
        setSheetError('');
        if (!/^\d{4}-\d{2}$/.test(sheetMonth || '')) {
            setSheetError('Select the salary month.');
            return;
        }
        if (branches.length > 0 && !sheetBranchId) {
            setSheetError('Select the branch.');
            return;
        }
        const branchName = branchNameOf(sheetBranchId);
        setSheetBusy(true);
        try {
            const res = await getRecentWorkshopSalaryPayroll({
                limit: 5000,
                period: sheetMonth,
                ...(sheetBranchId ? { branchId: sheetBranchId } : {}),
            });
            const rows = (res?.list ?? []).filter(
                (r) => r.period === sheetMonth && (!sheetBranchId || String(r.branchId) === String(sheetBranchId)),
            );
            if (rows.length === 0) {
                setSheetError(`No salary prepared for ${formatSalaryMonth(sheetMonth)} — ${branchName}.`);
                return;
            }
            const opts = { rows, branchName, salaryMonth: sheetMonth };
            if (sheetFormat === 'excel') exportSalaryPaymentsExcel(opts);
            else await exportSalaryPaymentsPdf(opts);
            setMsg(`Downloaded salary sheet for ${formatSalaryMonth(sheetMonth)} — ${branchName} (${rows.length} employee${rows.length === 1 ? '' : 's'}).`);
            setSheetOpen(false);
        } catch (e) {
            setSheetError(e?.message || 'Could not download the salary sheet.');
        } finally {
            setSheetBusy(false);
        }
    };

    const recentPager = usePagedSearch({
        rows: recent,
        getKey: recentRowKey,
        getName: recentRowName,
        getHay: recentRowHay,
        resetKey: recent,
    });
    const recentTableRef = useRef(null);
    const goToRecentPage = (p) => {
        recentPager.setPage(p);
        recentTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    useEffect(() => {
        const branchId = branchFilter || '';
        setRecentBranchId(branchId);
        loadRecentPayments({ filters: { ...appliedFiltersRef.current, branchId } });
    }, [branchFilter, loadRecentPayments]);

    const staffBySelectKey = useMemo(
        () => indexWorkshopStaffBySelectValue(employees),
        [employees],
    );

    const sortedEmployees = useMemo(
        () => [...employees].sort((a, b) => (a.name || '').localeCompare(b.name || '')),
        [employees],
    );

    const chosenStaffKeys = useMemo(
        () => new Set(rows.map((r) => r.employeeSelectKey).filter(Boolean)),
        [rows],
    );

    const loadLookups = useCallback(async () => {
        setLoadingLookups(true);
        try {
            const [empRes, cashRes] = await Promise.all([
                getAllWorkshopEmployees(branchParams).catch(() => ({ employees: [] })),
                listCashBankAccounts(branchParams).catch(() => ({ accounts: [] })),
            ]);
            setEmployees(unwrapWorkshopEmployeesList(empRes).filter((e) => !e.transferPlaceholder));
            setAccounts(cashRes?.accounts ?? cashRes?.items ?? []);
        } catch (e) {
            setError(e?.message || 'Could not load salary data.');
        } finally {
            setLoadingLookups(false);
        }
    }, [branchParams]);

    useEffect(() => { loadLookups(); }, [loadLookups]);

    useEffect(() => {
        const refreshOnReturn = () => {
            if (document.visibilityState === 'visible') {
                loadRecentPayments({ silent: true });
            }
        };
        document.addEventListener('visibilitychange', refreshOnReturn);
        return () => document.removeEventListener('visibilitychange', refreshOnReturn);
    }, [loadRecentPayments]);

    const loadPreview = async (idx, { id, recordType }) => {
        if (!id || !recordType || !period) return;
        const seq = (previewSeqRef.current[idx] ?? 0) + 1;
        previewSeqRef.current[idx] = seq;
        setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, previewLoading: true } : r)));
        try {
            const preview = await getSalaryPayrollPreview({
                period,
                employeeRecordId: String(id),
                recordType,
                ...branchParams,
            });
            if (previewSeqRef.current[idx] !== seq) return;
            setRows((prev) => prev.map((r, i) => {
                if (i !== idx) return r;
                return {
                    ...r,
                    userId: preview.userId || r.userId || '',
                    recordType: preview.recordType || recordType || r.recordType,
                    employeeName: preview.employeeName || r.employeeName,
                    basicSalary: (() => {
                        const fromPreview = Number(preview.basicSalary);
                        if (Number.isFinite(fromPreview) && fromPreview > 0) {
                            return String(fromPreview);
                        }
                        return r.basicSalary || listBasicSalary(staffBySelectKey[r.employeeSelectKey]) || '';
                    })(),
                    advanceDue: Number(preview.advanceDue ?? 0),
                    commissionPayable: isNonTechnicianStaff(
                        preview.recordType || recordType,
                        preview.employeeType || staffBySelectKey[r.employeeSelectKey]?.employeeType,
                    )
                        ? 0
                        : Number(preview.commissionPayable ?? 0),
                    commissionLineIds: isNonTechnicianStaff(
                        preview.recordType || recordType,
                        preview.employeeType || staffBySelectKey[r.employeeSelectKey]?.employeeType,
                    )
                        ? []
                        : [...(preview.commissionLineIds ?? [])],
                    advanceDeduction: String(
                        preview.suggestedAdvanceDeduction ?? preview.advanceDue ?? 0,
                    ),
                    previewLoading: false,
                    previewLoaded: true,
                };
            }));
        } catch (e) {
            if (previewSeqRef.current[idx] !== seq) return;
            setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, previewLoading: false } : r)));
            setError(e?.message || 'Could not load employee payroll preview.');
        }
    };

    const setRow = (idx, patch) => {
        setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
    };

    const handleEmployeeChange = (idx, selectKey) => {
        const parsed = parseWorkshopStaffSelectValue(selectKey);
        const emp = staffBySelectKey[selectKey];
        setRow(idx, {
            employeeSelectKey: selectKey,
            employeeRecordId: parsed.id,
            recordType: parsed.recordType,
            userId: emp?.userId || '',
            employeeName: emp?.name || '',
            previewLoaded: false,
            basicSalary: listBasicSalary(emp),
            rewardBonus: '0',
            advanceDue: 0,
            commissionPayable: 0,
            commissionLineIds: [],
            advanceDeduction: '0',
            penalties: '0',
            penaltyNotes: '',
        });
        if (parsed.id && parsed.recordType) {
            loadPreview(idx, { id: parsed.id, recordType: parsed.recordType });
        }
    };

    useEffect(() => {
        rows.forEach((r, idx) => {
            const { employeeRecordId, recordType } = resolveRowEmployee(r);
            if (employeeRecordId && recordType && r.previewLoaded) {
                loadPreview(idx, { id: employeeRecordId, recordType });
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [period]);

    const addRow = () => setRows((prev) => [...prev, emptyRow()]);
    const removeRow = (idx) => setRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));

    const totals = useMemo(() => {
        let basic = 0;
        let rewardBonus = 0;
        let commission = 0;
        let advance = 0;
        let penalties = 0;
        let net = 0;
        for (const r of rows) {
            basic += Number(r.basicSalary) || 0;
            rewardBonus += Number(r.rewardBonus) || 0;
            commission += Number(r.commissionPayable) || 0;
            advance += Number(r.advanceDeduction) || 0;
            penalties += Number(r.penalties) || 0;
            net += netPayable(r);
        }
        return { basic, rewardBonus, commission, advance, penalties, net };
    }, [rows]);

    const submit = async () => {
        setMsg('');
        setError('');

        const prepared = rows
            .map((r) => {
                const { employeeRecordId, recordType } = resolveRowEmployee(r);
                return { ...r, employeeRecordId, recordType };
            })
            .filter((r) => r.employeeRecordId && (
                Number(r.basicSalary) > 0
                || Number(r.rewardBonus) > 0
                || Number(r.commissionPayable) > 0
            ));

        if (prepared.length === 0) {
            setError('Add at least one employee with salary, reward/bonus, or commission payable.');
            return;
        }

        const missingType = prepared.find((r) => !r.recordType);
        if (missingType) {
            setError(`Re-select ${missingType.employeeName || 'the employee'} from the list. Staff ids overlap across technicians, cashiers, and portal users.`);
            return;
        }

        const seen = new Set();
        for (const r of prepared) {
            const key = employeeBulkKey(r.recordType, r.employeeRecordId);
            if (seen.has(key)) {
                setError(`Duplicate employee in bulk payroll: ${r.employeeName || r.employeeRecordId}. Remove the duplicate row.`);
                return;
            }
            seen.add(key);
        }

        if (!payFromAccountId) {
            setError('Select a Pay From account (cash or bank).');
            return;
        }
        for (const r of prepared) {
            if (netPayable(r) <= 0) {
                setError(`Net payable must be greater than zero for ${r.employeeName || 'employee'}.`);
                return;
            }
            if (Number(r.penalties) > 0 && !r.penaltyNotes?.trim()) {
                setError(`Penalty reason is required for ${r.employeeName || 'employee'} when a penalty amount is entered.`);
                return;
            }
        }

        const payloadRows = prepared.map((r) => ({
            employeeRecordId: String(r.employeeRecordId),
            recordType: r.recordType || undefined,
            userId: r.userId ? String(r.userId) : undefined,
            employeeName: r.employeeName,
            basicSalary: Number(r.basicSalary || 0),
            rewardBonus: Number(r.rewardBonus || 0),
            commissionAmount: Number(r.commissionPayable || 0),
            commissionLineIds: [...(r.commissionLineIds ?? [])],
            advanceDeduction: Number(r.advanceDeduction || 0),
            penalties: Number(r.penalties || 0),
            penaltyNotes: r.penaltyNotes?.trim() || undefined,
            notes: r.notes?.trim() || undefined,
        }));

        setSubmitting(true);
        try {
            const res = await postWorkshopSalaryPayroll({
                period,
                paymentDate,
                payFromAccountId: String(payFromAccountId),
                rows: payloadRows,
            });
            const saved = Number(res?.saved ?? payloadRows.length);
            const received = Number(res?.received ?? payloadRows.length);
            if (saved !== payloadRows.length || received !== payloadRows.length) {
                setError(
                    `Only ${saved} of ${payloadRows.length} salary payment(s) were posted (server received ${received}). Check recent payments and try again for missing employees.`,
                );
            } else {
                setMsg(`Posted ${saved} salary payment(s). Total net SAR ${fmt(res?.totalNet ?? totals.net)}. Journal entries created.`);
                setRows([emptyRow()]);
                await loadLookups();
                await loadRecentPayments();
            }
        } catch (e) {
            setError(e?.message || 'Could not post salary payroll.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div>
            {error ? <p className="form-help-text" style={{ color: '#B45309', marginBottom: 12 }}>{error}</p> : null}
            {msg ? <p className="form-help-text" style={{ color: '#065F46', marginBottom: 12 }}>{msg}</p> : null}

            <section style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 12,
                marginBottom: 16,
                padding: 14,
                background: '#F8FAFC',
                borderRadius: 12,
                border: '1px solid #E2E8F0',
            }}>
                <div>
                    <label className="form-label">Period (month) *</label>
                    <input type="month" className="form-input-field" value={period} onChange={(e) => setPeriod(e.target.value)} />
                </div>
                <div>
                    <label className="form-label">Payment date *</label>
                    <input type="date" className="form-input-field" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                </div>
                <div>
                    <label className="form-label">Pay from (cash / bank) *</label>
                    <select className="form-input-field" value={payFromAccountId} onChange={(e) => setPayFromAccountId(e.target.value)}>
                        <option value="">Select account…</option>
                        {accounts.map((a) => (
                            <option key={a.id} value={a.id}>{a.name}{a.coaCode ? ` · ${a.coaCode}` : ''}</option>
                        ))}
                    </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button type="button" className="btn-portal-outline" disabled={loadingLookups} onClick={loadLookups}>
                        <RefreshCw size={14} style={{ marginRight: 6 }} /> Refresh
                    </button>
                </div>
            </section>

            <p className="form-help-text" style={{ marginBottom: 12, fontSize: 13 }}>
                Select an employee to auto-load <strong>advance due</strong> and <strong>accrued commissions</strong> for the period.
                Posting creates journal entries: Dr Salary Expense · Dr Reward/Bonus Expense · Dr Commission Payable · Cr Advances · Cr Cash/Bank.
            </p>

            {rows.map((r, idx) => (
                <section
                    key={r.key}
                    style={{
                        marginBottom: 14,
                        padding: 14,
                        border: '1px solid #E2E8F0',
                        borderRadius: 12,
                        background: '#fff',
                    }}
                >
                    <div style={{ minWidth: 0, marginBottom: r.employeeSelectKey ? 12 : 0 }}>
                        <label className="form-label">Employee / Technician *</label>
                        <WsStaffPicker
                            options={sortedEmployees}
                            value={r.employeeSelectKey}
                            onChange={(key) => handleEmployeeChange(idx, key)}
                            getKey={workshopStaffSelectValue}
                            getLabel={staffName}
                            getMeta={staffMeta}
                            getSearchText={staffSearchText}
                            disabledKeys={chosenStaffKeys}
                            disabledHint="Already in this payroll"
                            placeholder={loadingLookups ? 'Loading staff…' : 'Search name, phone, role or branch…'}
                            emptyText="No employee or technician matches"
                        />
                        {r.employeeSelectKey ? (
                            <p className="form-help-text" style={{ margin: '6px 0 0', fontSize: 12 }}>
                                {workshopStaffRoleLabel(staffBySelectKey[r.employeeSelectKey] || { recordType: r.recordType })}
                                {staffBySelectKey[r.employeeSelectKey]?.branch?.name
                                    ? ` · ${staffBySelectKey[r.employeeSelectKey].branch.name}`
                                    : ''}
                            </p>
                        ) : null}
                    </div>
                    {r.employeeSelectKey ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                                <div>
                                    <label className="form-label">Basic salary (SAR)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className="form-input-field"
                                        value={r.basicSalary}
                                        disabled={r.previewLoading}
                                        onChange={(e) => setRow(idx, { basicSalary: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="form-label">Reward/Bonus (SAR)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className="form-input-field"
                                        value={r.rewardBonus}
                                        onChange={(e) => setRow(idx, { rewardBonus: e.target.value })}
                                        placeholder="0.00"
                                    />
                                </div>
                                <div>
                                    <label className="form-label">Advance due</label>
                                    <input type="text" className="form-input-field" readOnly value={`SAR ${fmt(r.advanceDue)}`} style={{ background: '#F8FAFC' }} />
                                </div>
                                <div>
                                    <label className="form-label">Commissions payable</label>
                                    <input type="text" className="form-input-field" readOnly value={`SAR ${fmt(r.commissionPayable)}`} style={{ background: '#F8FAFC' }} />
                                </div>
                                <div>
                                    <label className="form-label">Deduct from advance</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        max={r.advanceDue}
                                        className="form-input-field"
                                        value={r.advanceDeduction}
                                        onChange={(e) => setRow(idx, { advanceDeduction: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="form-label">Penalties (manual)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className="form-input-field"
                                        value={r.penalties}
                                        onChange={(e) => setRow(idx, { penalties: e.target.value })}
                                        placeholder="0.00"
                                    />
                                </div>
                                <div>
                                    <label className="form-label">
                                        Penalty reason
                                        {Number(r.penalties) > 0 ? ' *' : ''}
                                    </label>
                                    <input
                                        type="text"
                                        className="form-input-field"
                                        value={r.penaltyNotes}
                                        onChange={(e) => setRow(idx, { penaltyNotes: e.target.value })}
                                        placeholder="e.g. Late arrival — appears on penalty JE line"
                                    />
                                </div>
                                <div>
                                    <label className="form-label">Net payable</label>
                                    <input
                                        type="text"
                                        className="form-input-field"
                                        readOnly
                                        value={`SAR ${fmt(netPayable(r))}`}
                                        style={{ background: '#ECFDF5', fontWeight: 700, color: '#065F46' }}
                                    />
                                </div>
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <label className="form-label">Payroll notes (optional)</label>
                                    <input
                                        type="text"
                                        className="form-input-field"
                                        value={r.notes}
                                        onChange={(e) => setRow(idx, { notes: e.target.value })}
                                        placeholder="Internal note for this payout"
                                    />
                                </div>
                    </div>
                        ) : null}
                    {rows.length > 1 ? (
                        <div style={{ marginTop: 10, textAlign: 'right' }}>
                            <button type="button" className="btn-edit-zone" onClick={() => removeRow(idx)}>
                                <Trash2 size={14} /> Remove row
                            </button>
                        </div>
                    ) : null}
                    {r.previewLoading ? (
                        <p className="form-help-text" style={{ marginTop: 8 }}>Loading advance & commission data…</p>
                    ) : null}
                </section>
            ))}

            <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                <button type="button" className="btn-portal-outline" onClick={addRow}>
                    <Plus size={14} style={{ marginRight: 6 }} /> Add employee (bulk)
                </button>
                <div style={{ marginLeft: 'auto', color: '#0F172A', fontSize: 13 }}>
                    <strong>Salary:</strong> SAR {fmt(totals.basic)}
                    {' · '}<strong>Reward/Bonus:</strong> SAR {fmt(totals.rewardBonus)}
                    {' · '}<strong>Commission:</strong> SAR {fmt(totals.commission)}
                    {' · '}<strong>Deductions:</strong> SAR {fmt(totals.advance + totals.penalties)}
                    {' · '}<strong>Net cash:</strong> SAR {fmt(totals.net)}
                </div>
                <button type="button" className="btn-portal" disabled={submitting || loadingLookups} onClick={submit}>
                    <Save size={14} style={{ marginRight: 6 }} />
                    {submitting ? 'Posting…' : 'Post Salary'}
                </button>
            </div>

            <section className="premium-table cash-bank-table" style={{ overflow: 'visible' }}>
                <header style={{ padding: '12px 16px', borderBottom: '1px solid #E2E8F0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <Banknote size={16} />
                        <strong>Recent Salary Payments</strong>
                        <button
                            type="button"
                            className="btn-portal"
                            onClick={openSheet}
                            style={{ marginLeft: 'auto', padding: '4px 10px', fontSize: 12 }}
                        >
                            <FileSpreadsheet size={14} style={{ marginRight: 6 }} />
                            Download Salary Sheet
                        </button>
                        <button
                            type="button"
                            className="btn-portal-outline"
                            disabled={recentLoading}
                            onClick={refreshRecent}
                            style={{ padding: '4px 10px', fontSize: 12 }}
                        >
                            <RefreshCw size={14} style={{ marginRight: 6 }} />
                            {recentLoading ? 'Refreshing…' : 'Refresh status'}
                        </button>
                    </div>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                        gap: 10,
                        alignItems: 'end',
                    }}>
                        <div>
                            <label className="form-label">From</label>
                            <input
                                type="date"
                                className="form-input-field"
                                value={recentDateFrom}
                                onChange={(e) => setRecentDateFrom(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="form-label">To</label>
                            <input
                                type="date"
                                className="form-input-field"
                                value={recentDateTo}
                                onChange={(e) => setRecentDateTo(e.target.value)}
                            />
                        </div>
                        {branches.length > 0 ? (
                            <div>
                                <label className="form-label">Branch</label>
                                <select
                                    className="form-input-field"
                                    value={recentBranchId}
                                    onChange={(e) => setRecentBranchId(e.target.value)}
                                >
                                    <option value="">All branches</option>
                                    {branches.map((b) => (
                                        <option key={String(b.id)} value={String(b.id)}>
                                            {b.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ) : null}
                        <div>
                            <label className="form-label">Employee</label>
                            <WsSearchSuggest
                                value={recentPager.query}
                                onChange={recentPager.setQuery}
                                matches={recentPager.suggestions}
                                picked={recentPager.picked}
                                getKey={recentRowKey}
                                getLabel={recentRowName}
                                getMeta={recentRowMeta}
                                onPick={recentPager.pick}
                                onClear={recentPager.clear}
                                placeholder="Search employee, period or account…"
                                emptyText="No salary payments match"
                            />
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                className="btn-portal"
                                disabled={recentLoading}
                                onClick={applyRecentFilters}
                            >
                                <Filter size={14} style={{ marginRight: 6 }} />
                                {recentLoading ? 'Loading…' : 'Apply'}
                            </button>
                            <button
                                type="button"
                                className="btn-portal-outline"
                                disabled={recentLoading}
                                onClick={clearRecentFilters}
                            >
                                Clear
                            </button>
                            <button
                                type="button"
                                className="btn-portal-outline"
                                disabled={recentPager.total === 0 || recentLoading}
                                onClick={async () => {
                                    try {
                                        await exportSalaryPaymentsPdf({
                                            rows: recentPager.visible,
                                            branchName: recentBranchName,
                                            dateFrom: appliedFilters.dateFrom,
                                            dateTo: appliedFilters.dateTo,
                                            employeeSearch: recentPager.query,
                                        });
                                    } catch (e) {
                                        setError(e?.message || 'Could not export salary payments PDF.');
                                    }
                                }}
                            >
                                <FileDown size={14} style={{ marginRight: 6 }} />
                                PDF
                            </button>
                            <button
                                type="button"
                                className="btn-portal-outline"
                                disabled={recentPager.total === 0 || recentLoading}
                                onClick={() => exportSalaryPaymentsExcel({
                                    rows: recentPager.visible,
                                    branchName: recentBranchName,
                                    dateFrom: appliedFilters.dateFrom,
                                    dateTo: appliedFilters.dateTo,
                                    employeeSearch: recentPager.query,
                                })}
                            >
                                <FileDown size={14} style={{ marginRight: 6 }} />
                                Excel
                            </button>
                        </div>
                    </div>
                    {filterError ? (
                        <p className="form-help-text" style={{ margin: '8px 0 0', fontSize: 12, color: '#B91C1C' }}>{filterError}</p>
                    ) : null}
                    <div
                        style={{
                            display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center',
                            marginTop: 10, fontSize: 12, color: '#334155',
                        }}
                    >
                        <strong>Showing {recentPager.total} payment{recentPager.total === 1 ? '' : 's'} for:</strong>
                        <span style={filterChipStyle}>Branch: {recentBranchName}</span>
                        <span style={filterChipStyle}>
                            Date: {appliedFilters.dateFrom ? fmtFilterDate(appliedFilters.dateFrom) : 'Any'}
                            {' – '}
                            {appliedFilters.dateTo ? fmtFilterDate(appliedFilters.dateTo) : 'Any'}
                        </span>
                        {recentPager.query.trim() ? (
                            <span style={filterChipStyle}>Employee: “{recentPager.query.trim()}”</span>
                        ) : null}
                        <span>Net total SAR {fmt(recentPager.visible.reduce((sum, r) => sum + (Number(r.netSalary) || 0), 0))}</span>
                        {filtersDirty ? (
                            <span style={{ color: '#B45309', fontWeight: 600 }}>
                                Filters changed — click Apply to update the results.
                            </span>
                        ) : null}
                    </div>
                </header>
                <div style={{ overflowX: 'auto' }}>
                <table ref={recentTableRef} style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">Date</th>
                            <th className="table-th">Doc No.</th>
                            <th className="table-th">Employee</th>
                            <th className="table-th">Branch</th>
                            <th className="table-th">Period</th>
                            <th className="table-th">Salary</th>
                            <th className="table-th">Reward/Bonus</th>
                            <th className="table-th">Commission</th>
                            <th className="table-th">Deductions</th>
                            <th className="table-th">Net paid</th>
                            <th className="table-th">Pay from</th>
                            <th className="table-th">Technician</th>
                            <th className="table-th">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {recentPager.total === 0 ? (
                            <tr>
                                <td colSpan={13} className="table-cell table-empty">
                                    {recentLoading
                                        ? 'Loading…'
                                        : recentPager.query.trim() || appliedFilters.branchId || appliedFilters.dateFrom || appliedFilters.dateTo
                                            ? 'No salary payments match the applied filters.'
                                            : 'No salary payments yet.'}
                                </td>
                            </tr>
                        ) : recentPager.paged.map((s) => (
                            <tr key={s.id}>
                                <td className="table-cell">{s.paymentDate ? new Date(s.paymentDate).toLocaleDateString() : '—'}</td>
                                <td className="table-cell" style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{s.entryNumber || '—'}</td>
                                <td className="table-cell">{s.employeeName}</td>
                                <td className="table-cell">{s.branchName || '—'}</td>
                                <td className="table-cell">{s.period}</td>
                                <td className="table-cell">SAR {fmt(s.basicSalary ?? s.grossSalary)}</td>
                                <td className="table-cell">SAR {fmt(s.rewardBonus)}</td>
                                <td className="table-cell">SAR {fmt(s.commissionAmount)}</td>
                                <td className="table-cell">SAR {fmt(s.totalDeductions ?? (Number(s.advanceDeduction || 0) + Number(s.penalties || 0)))}</td>
                                <td className="table-cell" style={{ fontWeight: 700 }}>SAR {fmt(s.netSalary)}</td>
                                <td className="table-cell">{s.payFromAccountName ?? '—'}</td>
                                <td className="table-cell">{ackBadge(s.technicianAckStatus, s.technicianAckAt)}</td>
                                <td className="table-cell">
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button
                                            type="button"
                                            className="btn-edit-zone"
                                            title={`Edit salary ${s.entryNumber || ''}`.trim()}
                                            onClick={() => openEdit(s)}
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                        >
                                            <Pencil size={13} /> Edit
                                        </button>
                                        <button
                                            type="button"
                                            className="btn-edit-zone"
                                            title={`Delete salary ${s.entryNumber || ''}`.trim()}
                                            onClick={() => { setDeleteError(''); setDeleteRow(s); }}
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#B91C1C', background: '#FEE2E2' }}
                                        >
                                            <Trash2 size={13} /> Delete
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                </div>
                {recentPager.total > 0 ? (
                    <WsTablePagination
                        page={recentPager.page}
                        pageCount={recentPager.pageCount}
                        pageSize={recentPager.pageSize}
                        pageSizes={WS_PAGE_SIZES}
                        total={recentPager.total}
                        onPageChange={goToRecentPage}
                        onPageSizeChange={recentPager.setPageSize}
                    />
                ) : null}
            </section>

            {editForm ? (
                <Modal
                    title={`Edit Salary — ${editForm.employeeName}`}
                    onClose={() => !editSaving && setEditForm(null)}
                    disableClose={editSaving}
                    width="min(94vw, 760px)"
                    footer={(
                        <>
                            <button type="button" className="btn-secondary" disabled={editSaving} onClick={() => setEditForm(null)}>
                                Cancel
                            </button>
                            <button type="button" className="btn-submit btn-dark" disabled={editSaving} onClick={saveEdit}>
                                <Save size={14} style={{ marginRight: 6 }} />
                                {editSaving ? 'Updating…' : 'Update Salary'}
                            </button>
                        </>
                    )}
                >
                    {editError ? (
                        <p className="form-help-text" style={{ color: '#B45309', marginBottom: 12 }} role="alert">{editError}</p>
                    ) : null}
                    <p className="form-help-text" style={{ marginBottom: 12, fontSize: 13 }}>
                        Document <strong>{editForm.entryNumber || '—'}</strong>
                        {editForm.branchName ? <> · {editForm.branchName}</> : null}
                        {' '}— updating keeps the same document number and rewrites its journal lines in every ledger.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                        <div>
                            <label className="form-label">Period (month) *</label>
                            <input type="month" className="form-input-field" value={editForm.period} onChange={(e) => setEditForm((f) => ({ ...f, period: e.target.value }))} />
                        </div>
                        <div>
                            <label className="form-label">Payment date *</label>
                            <input type="date" className="form-input-field" value={editForm.paymentDate} onChange={(e) => setEditForm((f) => ({ ...f, paymentDate: e.target.value }))} />
                        </div>
                        <div>
                            <label className="form-label">Pay from (cash / bank) *</label>
                            <select className="form-input-field" value={editForm.payFromAccountId} onChange={(e) => setEditForm((f) => ({ ...f, payFromAccountId: e.target.value }))}>
                                <option value="">Select account…</option>
                                {editPayFromOptions.map((a) => (
                                    <option key={a.id} value={String(a.id)}>{a.name}{a.coaCode ? ` · ${a.coaCode}` : ''}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="form-label">Basic salary (SAR)</label>
                            <input type="number" min="0" step="0.01" className="form-input-field" value={editForm.basicSalary} onChange={(e) => setEditForm((f) => ({ ...f, basicSalary: e.target.value }))} />
                        </div>
                        <div>
                            <label className="form-label">Reward/Bonus (SAR)</label>
                            <input type="number" min="0" step="0.01" className="form-input-field" value={editForm.rewardBonus} onChange={(e) => setEditForm((f) => ({ ...f, rewardBonus: e.target.value }))} />
                        </div>
                        <div>
                            <label className="form-label">Commission (settled)</label>
                            <input type="text" className="form-input-field" readOnly value={`SAR ${fmt(editForm.commissionAmount)}`} style={{ background: '#F8FAFC' }} title="Commission lines stay settled by this salary. Delete and re-post the salary to change them." />
                        </div>
                        <div>
                            <label className="form-label">Deduct from advance</label>
                            <input type="number" min="0" step="0.01" className="form-input-field" value={editForm.advanceDeduction} onChange={(e) => setEditForm((f) => ({ ...f, advanceDeduction: e.target.value }))} />
                        </div>
                        <div>
                            <label className="form-label">Penalties (manual)</label>
                            <input type="number" min="0" step="0.01" className="form-input-field" value={editForm.penalties} onChange={(e) => setEditForm((f) => ({ ...f, penalties: e.target.value }))} />
                        </div>
                        <div>
                            <label className="form-label">Penalty reason{Number(editForm.penalties) > 0 ? ' *' : ''}</label>
                            <input type="text" className="form-input-field" value={editForm.penaltyNotes} onChange={(e) => setEditForm((f) => ({ ...f, penaltyNotes: e.target.value }))} />
                        </div>
                        <div>
                            <label className="form-label">Net payable</label>
                            <input
                                type="text"
                                className="form-input-field"
                                readOnly
                                value={`SAR ${fmt(Math.max(editNetPayable(editForm), 0))}`}
                                style={{ background: '#ECFDF5', fontWeight: 700, color: '#065F46' }}
                            />
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                            <label className="form-label">Payroll notes (optional)</label>
                            <input type="text" className="form-input-field" value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} />
                        </div>
                    </div>
                </Modal>
            ) : null}

            {deleteRow ? (
                <Modal
                    title="Delete Salary"
                    onClose={() => !deleteBusy && setDeleteRow(null)}
                    disableClose={deleteBusy}
                    width="min(94vw, 520px)"
                    footer={(
                        <>
                            <button type="button" className="btn-secondary" disabled={deleteBusy} onClick={() => setDeleteRow(null)}>
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn-submit"
                                disabled={deleteBusy}
                                onClick={confirmDelete}
                                style={{ background: '#B91C1C', borderColor: '#B91C1C', color: '#fff' }}
                            >
                                <Trash2 size={14} style={{ marginRight: 6 }} />
                                {deleteBusy ? 'Deleting…' : 'Delete Salary'}
                            </button>
                        </>
                    )}
                >
                    {deleteError ? (
                        <p className="form-help-text" style={{ color: '#B45309', marginBottom: 12 }} role="alert">{deleteError}</p>
                    ) : null}
                    <p style={{ margin: '0 0 10px', fontSize: 14 }}>
                        Delete the salary of <strong>{deleteRow.employeeName}</strong> for <strong>{deleteRow.period}</strong>
                        {deleteRow.branchName ? <> ({deleteRow.branchName})</> : null} — net SAR {fmt(deleteRow.netSalary)}?
                    </p>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
                        <li>Journal <strong>{deleteRow.entryNumber || '—'}</strong> is removed from every ledger (salary expense, cash/bank, advances, commission, penalties).</li>
                        {Number(deleteRow.commissionAmount) > 0 ? (
                            <li>Commission SAR {fmt(deleteRow.commissionAmount)} returns to unpaid (accrued).</li>
                        ) : null}
                        {Number(deleteRow.advanceDeduction) > 0 ? (
                            <li>Advance deduction SAR {fmt(deleteRow.advanceDeduction)} is restored to the employee&apos;s advance balance.</li>
                        ) : null}
                        <li>This cannot be undone.</li>
                    </ul>
                </Modal>
            ) : null}

            {sheetOpen ? (
                <Modal
                    title="Download Salary Sheet"
                    onClose={() => !sheetBusy && setSheetOpen(false)}
                    disableClose={sheetBusy}
                    width="min(94vw, 520px)"
                    footer={(
                        <>
                            <button type="button" className="btn-secondary" disabled={sheetBusy} onClick={() => setSheetOpen(false)}>
                                Cancel
                            </button>
                            <button type="button" className="btn-submit btn-dark" disabled={sheetBusy} onClick={downloadSheet}>
                                <FileDown size={14} style={{ marginRight: 6 }} />
                                {sheetBusy ? 'Preparing…' : 'Download'}
                            </button>
                        </>
                    )}
                >
                    {sheetError ? (
                        <p className="form-help-text" style={{ color: '#B45309', marginBottom: 12 }} role="alert">{sheetError}</p>
                    ) : null}
                    <div style={{ display: 'grid', gap: 14, minHeight: 260 }}>
                        <div>
                            <label className="form-label">Salary for the Month of *</label>
                            <input type="month" className="form-input-field" value={sheetMonth} onChange={(e) => setSheetMonth(e.target.value)} />
                        </div>
                        {branches.length > 0 ? (
                            <div>
                                <label className="form-label">Salary for the Branch *</label>
                                <WsStaffPicker
                                    options={branches}
                                    value={sheetBranchId}
                                    onChange={(key) => setSheetBranchId(key || '')}
                                    getKey={branchKey}
                                    getLabel={branchLabel}
                                    getMeta={branchMeta}
                                    getSearchText={branchSearchText}
                                    placeholder="Search branch name or code…"
                                    emptyText="No branch matches"
                                    countText={(n, total, searching) => (searching ? `${n} of ${total} branches` : `${total} branches`)}
                                />
                            </div>
                        ) : null}
                        <div>
                            <label className="form-label">Format</label>
                            <div style={{ display: 'flex', gap: 18, fontSize: 14 }}>
                                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                    <input type="radio" name="salary-sheet-format" checked={sheetFormat === 'pdf'} onChange={() => setSheetFormat('pdf')} /> PDF
                                </label>
                                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                    <input type="radio" name="salary-sheet-format" checked={sheetFormat === 'excel'} onChange={() => setSheetFormat('excel')} /> Excel
                                </label>
                            </div>
                        </div>
                    </div>
                </Modal>
            ) : null}
        </div>
    );
}
