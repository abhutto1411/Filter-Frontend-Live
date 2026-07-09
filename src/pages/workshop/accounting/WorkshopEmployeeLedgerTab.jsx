import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { BookOpen, Calendar, RefreshCw } from 'lucide-react';

import SearchableEntityCombobox from '../../../components/SearchableEntityCombobox';

import { getWorkshopEmployeeLedger } from '../../../services/advancesApi';
import { getWorkshopCommissionsEmployees } from '../../../services/workshopCommissionsApi';

import {

    getWorkshopEmployees,

    indexWorkshopStaffBySelectValue,

    parseWorkshopStaffSelectValue,

    unwrapWorkshopEmployeesList,

    workshopStaffSelectValue,

} from '../../../services/workshopStaffApi';

import '../Workshop.css';



const fmt = (n) => {

    const x = Number(n);

    if (!Number.isFinite(x)) return '0.00';

    return x.toLocaleString('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

};



const TYPE_LABELS = {

    commission_accrued: 'Commission accrued',

    commission_paid: 'Commission paid',

    commission_settled: 'Commission settled',

    salary_payable: 'Basic salary',

    salary_paid: 'Salary payout',

    advance_issued: 'Advance issued',

    advance_deducted: 'Advance deducted',

    penalty: 'Penalty',

};



const TYPE_COLORS = {

    Earnings: { bg: '#ECFDF5', color: '#065F46' },

    Payment: { bg: '#EFF6FF', color: '#1D4ED8' },

    Advance: { bg: '#FFF7ED', color: '#C2410C' },

    Deduction: { bg: '#FEF2F2', color: '#B91C1C' },

    Settlement: { bg: '#F5F3FF', color: '#6D28D9' },

};



function localDatetimeToEpochMs(local) {

    if (!local || !String(local).trim()) return '';

    const s = String(local).trim();

    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return '';

    const d = new Date(s);

    if (Number.isNaN(d.getTime())) return '';

    return String(d.getTime());

}



function CategoryBadge({ category }) {

    const style = TYPE_COLORS[category] ?? { bg: '#F1F5F9', color: '#475569' };

    return (

        <span

            style={{

                fontSize: 11,

                fontWeight: 700,

                padding: '2px 8px',

                borderRadius: 999,

                background: style.bg,

                color: style.color,

            }}

        >

            {category}

        </span>

    );

}



export default function WorkshopEmployeeLedgerTab({

    employees: employeesProp = [],

    employeeByRecordId: employeeByRecordIdProp = {},

    branchFilter = '',

    workshopId = '',

    allBranches = false,

}) {

    const [employees, setEmployees] = useState(employeesProp);
    const [employeesLoading, setEmployeesLoading] = useState(false);
    const [employeesLoadError, setEmployeesLoadError] = useState('');

    const [ledgerEmployeeId, setLedgerEmployeeId] = useState('');

    const [selectedUserId, setSelectedUserId] = useState('');

    const [employeeSearchDraft, setEmployeeSearchDraft] = useState('');

    const [draftStartDateTime, setDraftStartDateTime] = useState('');

    const [draftEndDateTime, setDraftEndDateTime] = useState('');

    const [appliedStartDateTime, setAppliedStartDateTime] = useState('');

    const [appliedEndDateTime, setAppliedEndDateTime] = useState('');

    const [ledger, setLedger] = useState(null);

    const [initialLoading, setInitialLoading] = useState(false);

    const [refreshing, setRefreshing] = useState(false);

    const [error, setError] = useState('');

    const requestSeq = useRef(0);
    const hasLedgerRef = useRef(false);
    hasLedgerRef.current = Boolean(ledger);



    const branchParams = useMemo(() => {

        const p = {};

        if (branchFilter) p.branchId = branchFilter;

        if (workshopId) {

            p.workshopId = workshopId;

            if (!branchFilter && allBranches) p.allBranches = 'true';

        }

        return p;

    }, [branchFilter, workshopId, allBranches]);



    const appliedScopeParams = useMemo(() => {

        const p = { ...branchParams };

        const startMs = localDatetimeToEpochMs(appliedStartDateTime);

        const endMs = localDatetimeToEpochMs(appliedEndDateTime);

        if (startMs) p.startAt = startMs;

        if (endMs) p.endAt = endMs;

        return p;

    }, [branchParams, appliedStartDateTime, appliedEndDateTime]);



    const employeeByRecordId = useMemo(() => {

        if (Object.keys(employeeByRecordIdProp).length > 0) {

            return employeeByRecordIdProp;

        }

        return indexWorkshopStaffBySelectValue(employees);

    }, [employeeByRecordIdProp, employees]);



    useEffect(() => {
        if (employeesProp.length > 0) {
            setEmployees(employeesProp);
            setEmployeesLoading(false);
            setEmployeesLoadError('');
            return;
        }
        if (!workshopId) {
            setEmployees([]);
            setEmployeesLoading(false);
            return;
        }

        let cancelled = false;
        setEmployeesLoading(true);
        setEmployeesLoadError('');

        (async () => {
            try {
                const scope = { ...branchParams, limit: 500 };
                const [staffRes, commissionRes] = await Promise.all([
                    getWorkshopEmployees(scope, { explicitScope: true }),
                    getWorkshopCommissionsEmployees({
                        workshopId,
                        ...(branchFilter ? { branchId: branchFilter } : { allBranches: true }),
                    }).catch(() => null),
                ]);

                if (cancelled) return;

                const staffList = unwrapWorkshopEmployeesList(staffRes);
                const byKey = new Map(
                    staffList.map((e) => [workshopStaffSelectValue(e), e]),
                );

                const commissionEmps =
                    commissionRes?.employees ??
                    commissionRes?.data?.employees ??
                    [];
                for (const row of commissionEmps) {
                    const bareId = String(row.employee_id ?? row.employeeId ?? '');
                    if (!bareId) continue;
                    const existing =
                        byKey.get(`employee:${bareId}`) ||
                        byKey.get(`portal_user:${bareId}`) ||
                        byKey.get(`cashier:${bareId}`);
                    if (existing) continue;
                    byKey.set(`employee:${bareId}`, {
                        id: bareId,
                        name: row.name ?? row.employee_name ?? 'Employee',
                        recordType: 'employee',
                        branch: row.branch?.name
                            ? { name: row.branch.name }
                            : row.branch_name
                              ? { name: row.branch_name }
                              : null,
                    });
                }

                setEmployees(Array.from(byKey.values()));
            } catch (e) {
                if (!cancelled) {
                    setEmployees([]);
                    setEmployeesLoadError(e?.message || 'Could not load employees');
                }
            } finally {
                if (!cancelled) setEmployeesLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [employeesProp, workshopId, branchParams, branchFilter]);



    const loadLedger = useCallback(

        async ({ silent = false } = {}) => {

            if (!ledgerEmployeeId) {

                setLedger(null);

                return;

            }

            const seq = ++requestSeq.current;

            if (!silent) {

                setInitialLoading(!hasLedgerRef.current);

                setRefreshing(hasLedgerRef.current);

            }

            setError('');

            try {

                const parsed = parseWorkshopStaffSelectValue(ledgerEmployeeId);

                const res = await getWorkshopEmployeeLedger(parsed.id, {

                    recordType: parsed.recordType,

                    userId: selectedUserId || undefined,

                    ...appliedScopeParams,

                });

                if (seq !== requestSeq.current) return;

                setLedger(res);

            } catch (e) {

                if (seq !== requestSeq.current) return;

                setError(e?.message || 'Could not load employee ledger');

                if (!silent) setLedger(null);

            } finally {

                if (seq === requestSeq.current) {

                    setInitialLoading(false);

                    setRefreshing(false);

                }

            }

        },

        [ledgerEmployeeId, selectedUserId, appliedScopeParams],

    );



    useEffect(() => {

        loadLedger();

    }, [ledgerEmployeeId, appliedScopeParams, loadLedger]);



    const applyDateFilter = () => {

        setAppliedStartDateTime(draftStartDateTime);

        setAppliedEndDateTime(draftEndDateTime);

    };



    const clearDateFilter = () => {

        setDraftStartDateTime('');

        setDraftEndDateTime('');

        setAppliedStartDateTime('');

        setAppliedEndDateTime('');

    };



    const summary = ledger?.summary ?? null;

    const rows = ledger?.rows ?? [];

    const hasLiveBalance =

        summary &&

        (Number(summary.commissionPending) > 0 ||

            Number(summary.advanceOutstanding) > 0 ||

            Number(summary.closingBalance) !== 0);



    const employeeComboboxOptions = useMemo(
        () =>
            [...employees]
                .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                .map((e) => {
                    const selectKey = workshopStaffSelectValue(e);
                    const typeLabel =
                        e.recordType && e.recordType !== 'employee'
                            ? String(e.recordType).replace(/_/g, ' ')
                            : 'Employee';
                    const branchName = e.branch?.name || '';
                    return {
                        id: selectKey,
                        label: e.name || 'Employee',
                        subtitle: [typeLabel, branchName].filter(Boolean).join(' · '),
                        searchText: [
                            e.name,
                            e.mobile,
                            e.email,
                            e.employeeType,
                            branchName,
                            selectKey,
                        ]
                            .filter(Boolean)
                            .join(' '),
                    };
                }),
        [employees],
    );



    const kpiCards = summary

        ? [

              {

                  label: 'Opening balance',

                  value: summary.openingBalance,

                  color: '#475569',

              },

              {

                  label: 'Period earnings',

                  value: summary.totalEarnings,

                  color: '#065F46',

              },

              {

                  label: 'Period deductions',

                  value: summary.totalDeductions,

                  color: '#B91C1C',

              },

              {

                  label: 'Period paid out',

                  value: summary.totalPaid,

                  color: '#1D4ED8',

              },

              {

                  label: summary.balanceLabel || 'Closing balance',

                  value:

                      summary.balanceType === 'receivable'

                          ? summary.netReceivable ?? -summary.closingBalance

                          : summary.closingBalance,

                  color:

                      summary.balanceType === 'receivable' ? '#C2410C' : '#0F172A',

              },

              {

                  label: 'Advance due (live)',

                  value: summary.advanceOutstanding,

                  color: '#C2410C',

              },

              {

                  label: 'Comm. pending (live)',

                  value: summary.commissionPending,

                  color: '#7C3AED',

              },

          ]

        : [];



    const loading = initialLoading && !ledger;



    return (

        <div style={{ padding: '8px 0' }}>

            <div

                style={{

                    display: 'flex',

                    flexWrap: 'wrap',

                    gap: 12,

                    alignItems: 'flex-end',

                    marginBottom: 16,

                    padding: 14,

                    background: '#F8FAFC',

                    borderRadius: 12,

                    border: '1px solid #E2E8F0',

                }}

            >

                <div style={{ minWidth: 240, flex: 1 }}>

                    <label className="form-label">Employee / Technician</label>

                    <SearchableEntityCombobox
                        className="ws-filter-combobox"
                        options={employeeComboboxOptions}
                        value={ledgerEmployeeId}
                        displayText={employeeSearchDraft}
                        entityLabel="employee"
                        loading={employeesLoading}
                        placeholder="Type employee name… (↑↓ keys)"
                        emptyHint={
                            employeesLoadError
                                ? employeesLoadError
                                : 'No employees match — try name, mobile, or branch'
                        }
                        onDisplayTextChange={(text) => {
                            setEmployeeSearchDraft(text);
                            if (!text.trim()) {
                                setLedgerEmployeeId('');
                                setSelectedUserId('');
                                setLedger(null);
                                return;
                            }
                            if (ledgerEmployeeId) {
                                const selected = employeeByRecordId[ledgerEmployeeId];
                                const selectedName = (selected?.name || '').trim();
                                if (selectedName && text.trim() !== selectedName) {
                                    setLedgerEmployeeId('');
                                    setSelectedUserId('');
                                    setLedger(null);
                                }
                            }
                        }}
                        onSelect={(opt) => {
                            setLedgerEmployeeId(opt.id);
                            setEmployeeSearchDraft(opt.label || '');
                            const emp = employeeByRecordId[opt.id];
                            setSelectedUserId(emp?.userId ? String(emp.userId) : '');
                        }}
                    />
                    {!employeesLoading && employees.length > 0 ? (
                        <p className="form-help-text" style={{ marginTop: 6, fontSize: 12 }}>
                            {employees.length} employees loaded — type to search (e.g. &quot;alim&quot;,
                            mobile, branch)
                        </p>
                    ) : null}

                </div>

                <div className="ws-datetime-range" aria-label="Date & time range filter">

                    <span className="ws-datetime-range-label">Date &amp; time</span>

                    <div className="ws-date-picker ws-datetime-picker">

                        <input

                            type="datetime-local"

                            className="form-input-field"

                            value={draftStartDateTime}

                            onChange={(e) => setDraftStartDateTime(e.target.value)}

                            aria-label="From date and time"

                        />

                        <Calendar size={14} />

                    </div>

                    <span className="ws-datetime-range-sep">to</span>

                    <div className="ws-date-picker ws-datetime-picker">

                        <input

                            type="datetime-local"

                            className="form-input-field"

                            value={draftEndDateTime}

                            onChange={(e) => setDraftEndDateTime(e.target.value)}

                            aria-label="To date and time"

                        />

                        <Calendar size={14} />

                    </div>

                    <button

                        type="button"

                        className="btn-portal-outline"

                        disabled={!ledgerEmployeeId}

                        onClick={applyDateFilter}

                    >

                        Apply

                    </button>

                    {(appliedStartDateTime || appliedEndDateTime) && (

                        <button type="button" className="btn-portal-outline" onClick={clearDateFilter}>

                            Clear

                        </button>

                    )}

                </div>

                <button

                    type="button"

                    className="btn-portal-outline"

                    disabled={refreshing || !ledgerEmployeeId}

                    onClick={() => loadLedger({ silent: false })}

                >

                    <RefreshCw

                        size={14}

                        style={{ marginRight: 6, ...(refreshing ? { animation: 'spin 1s linear infinite' } : {}) }}

                    />

                    {refreshing ? 'Refreshing…' : 'Refresh'}

                </button>

            </div>



            <p className="form-help-text" style={{ marginBottom: 14, fontSize: 13 }}>

                <BookOpen size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />

                Live employee ledger — commissions &amp; salary accrue automatically; advances,

                penalties, and payouts reduce balance payable. Leave dates empty to show all

                transactions; use Apply to filter by date &amp; time.

            </p>



            {error ? (

                <p className="form-help-text" style={{ color: '#B45309', marginBottom: 12 }}>

                    {error}

                </p>

            ) : null}



            {!ledgerEmployeeId ? (

                <div style={{ textAlign: 'center', color: '#94A3B8', padding: 48 }}>

                    Select an employee or technician to view their ledger

                </div>

            ) : loading ? (

                <div style={{ textAlign: 'center', color: '#64748B', padding: 48 }}>

                    Loading ledger…

                </div>

            ) : (

                <>

                    {summary ? (

                        <div

                            style={{

                                display: 'grid',

                                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',

                                gap: 10,

                                marginBottom: 16,

                                opacity: refreshing ? 0.65 : 1,

                                transition: 'opacity 0.15s ease',

                            }}

                        >

                            {kpiCards.map((k) => (

                                <div

                                    key={k.label}

                                    style={{

                                        padding: '10px 12px',

                                        background: '#fff',

                                        border: '1px solid #E2E8F0',

                                        borderRadius: 10,

                                    }}

                                >

                                    <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>

                                        {k.label}

                                    </div>

                                    <div style={{ fontSize: 16, fontWeight: 800, color: k.color }}>

                                        SAR {fmt(k.value)}

                                    </div>

                                </div>

                            ))}

                        </div>

                    ) : null}



                    {!ledger?.hasUserAccount ? (

                        <p className="form-help-text" style={{ marginBottom: 12, color: '#64748B' }}>

                            Commissions shown by employee record. Link a user account to include

                            salary &amp; advance transactions.

                        </p>

                    ) : null}



                    <section className="premium-table cash-bank-table">

                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>

                            <thead>

                                <tr className="table-header-row">

                                    <th className="table-th">DATE</th>

                                    <th className="table-th">TYPE</th>

                                    <th className="table-th">DESCRIPTION</th>

                                    <th className="table-th">PERIOD</th>

                                    <th className="table-th">EARNINGS</th>

                                    <th className="table-th">DEDUCTIONS</th>

                                    <th className="table-th">PAID</th>

                                    <th className="table-th">ADVANCE</th>

                                    <th className="table-th">STATUS</th>

                                    <th className="table-th">NET POS.</th>

                                </tr>

                            </thead>

                            <tbody>

                                {rows.length === 0 ? (

                                    <tr>

                                        <td colSpan={10} className="table-cell table-empty">

                                            {appliedStartDateTime || appliedEndDateTime

                                                ? hasLiveBalance

                                                    ? 'No transactions in this date & time range. Clear the filter or widen the range — live balances above include all time.'

                                                    : 'No transactions in this date & time range.'

                                                : 'No ledger transactions found for this employee in the selected workshop scope.'}

                                        </td>

                                    </tr>

                                ) : (

                                    rows.map((r) => (

                                        <tr key={r.id} className="table-row">

                                            <td className="table-cell">

                                                {new Date(r.date).toLocaleString()}

                                            </td>

                                            <td className="table-cell">

                                                <CategoryBadge category={r.category} />

                                                <div

                                                    style={{

                                                        fontSize: 11,

                                                        color: '#64748B',

                                                        marginTop: 2,

                                                    }}

                                                >

                                                    {TYPE_LABELS[r.type] ?? r.type}

                                                </div>

                                            </td>

                                            <td className="table-cell">

                                                {r.description}

                                                {r.reference ? (

                                                    <div style={{ fontSize: 11, color: '#94A3B8' }}>

                                                        {r.reference}

                                                    </div>

                                                ) : null}

                                            </td>

                                            <td className="table-cell">{r.period ?? '—'}</td>

                                            <td

                                                className="table-cell"

                                                style={{

                                                    color: r.earnings > 0 ? '#065F46' : undefined,

                                                    fontWeight: r.earnings > 0 ? 600 : 400,

                                                }}

                                            >

                                                {r.earnings > 0 ? `SAR ${fmt(r.earnings)}` : '—'}

                                            </td>

                                            <td

                                                className="table-cell"

                                                style={{

                                                    color: r.deductions > 0 ? '#B91C1C' : undefined,

                                                    fontWeight: r.deductions > 0 ? 600 : 400,

                                                }}

                                            >

                                                {r.deductions > 0

                                                    ? `SAR ${fmt(r.deductions)}`

                                                    : '—'}

                                            </td>

                                            <td

                                                className="table-cell"

                                                style={{

                                                    color: r.paid > 0 ? '#1D4ED8' : undefined,

                                                    fontWeight: r.paid > 0 ? 600 : 400,

                                                }}

                                            >

                                                {r.paid > 0 ? `SAR ${fmt(r.paid)}` : '—'}

                                            </td>

                                            <td

                                                className="table-cell"

                                                style={{

                                                    color: r.advance > 0 ? '#C2410C' : undefined,

                                                    fontWeight: r.advance > 0 ? 600 : 400,

                                                }}

                                            >

                                                {r.advance > 0 ? `SAR ${fmt(r.advance)}` : '—'}

                                            </td>

                                            <td className="table-cell">

                                                {r.status ? (

                                                    <span

                                                        className={`status-badge ${

                                                            r.status === 'paid' ||

                                                            r.status === 'settled'

                                                                ? 'approved'

                                                                : 'pending'

                                                        }`}

                                                    >

                                                        {r.status}

                                                    </span>

                                                ) : (

                                                    '—'

                                                )}

                                            </td>

                                            <td className="table-cell" style={{ fontWeight: 700 }}>

                                                SAR {fmt(r.netPosition)}

                                            </td>

                                        </tr>

                                    ))

                                )}

                            </tbody>

                        </table>

                    </section>

                </>

            )}

        </div>

    );

}

