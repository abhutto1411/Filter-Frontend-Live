import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import { Printer, RefreshCw, Wallet, Banknote } from 'lucide-react';
import RiyalIcon from '../../../components/RiyalIcon';
import SearchableEntityCombobox from '../../../components/SearchableEntityCombobox';
import { isInactiveRecord } from '../../../utils/inactiveRecords';
import {
  getEmployeePayrollStatement,
  getWorkshopEmployeeLedger,
} from '../../../services/advancesApi';
import { getWorkshopCommissionsEmployees } from '../../../services/workshopCommissionsApi';
import {
  getAllWorkshopEmployees,
  parseWorkshopStaffSelectValue,
  unwrapWorkshopEmployeesList,
  workshopStaffRoleLabel,
  workshopStaffSelectValue,
} from '../../../services/workshopStaffApi';
import { accT } from '../../../utils/accountingI18n';
import {
  STATEMENT_PAGE_SIZE,
  accountLabel,
  balanceSuffixKey,
  formatSarLatn,
  mapStatementCards,
  mapStatementItems,
  mapStatementSourceKey,
  refHref,
  slicePage,
  statementDefaultFrom,
  withOpeningRow,
} from '../../../utils/employeeStatementDisplay';
import { escapeHtml, printReportHtml } from '../../../utils/accountingReportDisplay';
import { PaginationControls } from '../../../components/PaginationControls';
import WsTableScroll from '../../../components/workshop/WsTableScroll';
import { toRiyadhDateISO } from '../../../utils/riyadhBusinessRange';

const fieldWrap = { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 140 };
const labelStyle = { fontSize: '0.75rem', fontWeight: 600, color: '#64748B' };
const inputStyle = {
  borderRadius: 8,
  border: '1px solid #CBD5E1',
  padding: '0 10px',
  fontSize: '0.875rem',
  background: '#fff',
};

function SourceChip({ sourceKey, t }) {
  const labels = {
    opening: t('stmt.source.opening'),
    admin: t('stmt.source.admin'),
    pos: t('stmt.source.pos'),
    payroll: t('stmt.source.payroll'),
    payout: t('stmt.source.payout'),
    transactions: t('stmt.source.transactions'),
  };
  const tones = {
    opening: { bg: '#F1F5F9', color: '#475569' },
    admin: { bg: '#DBEAFE', color: '#1D4ED8' },
    pos: { bg: '#FEF3C7', color: '#92400E' },
    payroll: { bg: '#E0E7FF', color: '#3730A3' },
    payout: { bg: '#DCFCE7', color: '#166534' },
    transactions: { bg: '#F3E8FF', color: '#6B21A8' },
  };
  const tone = tones[sourceKey] || tones.transactions;
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 6,
        fontSize: '0.72rem',
        fontWeight: 700,
        background: tone.bg,
        color: tone.color,
      }}
    >
      {labels[sourceKey] || sourceKey}
    </span>
  );
}

/**
 * P-A12H3: Employee statement (mockup 21).
 * Shared with HQ admin panels — REPLACE old datetime ledger UI in place.
 */
export default function WorkshopEmployeeLedgerTab({
  employees: employeesProp = [],
  employeeByRecordId: employeeByRecordIdProp = {},
  branchFilter = '',
  workshopId = '',
  allBranches = false,
  locale: localeProp,
  initialEmployeeKey = '',
}) {
  const outletCtx = useOutletContext() || {};
  const [searchParams] = useSearchParams();
  const locale =
    localeProp ||
    outletCtx.locale ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
    'en';
  const t = useCallback((key, vars) => accT(locale, key, vars), [locale]);
  const isRtl = String(locale).toLowerCase().startsWith('ar');

  const defaultFrom = () => statementDefaultFrom(toRiyadhDateISO());

  const [employees, setEmployees] = useState(employeesProp);
  // HQ callers still pass employeeByRecordId — keep prop for API compatibility.
  void employeeByRecordIdProp;
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employeeKey, setEmployeeKey] = useState(
    () => initialEmployeeKey || searchParams.get('employee') || '',
  );
  const [employeeDisplay, setEmployeeDisplay] = useState('');
  const [draftFrom, setDraftFrom] = useState(defaultFrom);
  const [draftTo, setDraftTo] = useState(() => toRiyadhDateISO());
  const [applied, setApplied] = useState(() => ({
    from: defaultFrom(),
    to: toRiyadhDateISO(),
  }));
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [payload, setPayload] = useState(null);
  const [apiMissing, setApiMissing] = useState(false);
  const [legacyMode, setLegacyMode] = useState(false);

  const branchParams = useMemo(() => {
    const p = {};
    if (branchFilter) p.branchId = branchFilter;
    if (workshopId) {
      p.workshopId = workshopId;
      if (!branchFilter && allBranches) p.allBranches = 'true';
    }
    return p;
  }, [branchFilter, workshopId, allBranches]);

  useEffect(() => {
    if (Array.isArray(employeesProp) && employeesProp.length) {
      setEmployees(employeesProp);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      setEmployeesLoading(true);
      try {
        const [emps, commissions] = await Promise.all([
          getAllWorkshopEmployees(branchParams).catch(() => ({ employees: [] })),
          getWorkshopCommissionsEmployees(branchParams).catch(() => []),
        ]);
        if (cancelled) return;
        const byKey = new Map();
        unwrapWorkshopEmployeesList(emps)
          .filter((e) => !e.transferPlaceholder)
          .forEach((e) => byKey.set(workshopStaffSelectValue(e), e));
        const commissionEmps = Array.isArray(commissions)
          ? commissions
          : commissions?.employees || commissions?.list || [];
        for (const row of commissionEmps) {
          const bareId = String(row.employee_id ?? row.employeeId ?? '');
          if (!bareId) continue;
          if (
            byKey.has(`employee:${bareId}`) ||
            byKey.has(`portal_user:${bareId}`) ||
            byKey.has(`cashier:${bareId}`)
          ) {
            continue;
          }
          byKey.set(`employee:${bareId}`, {
            id: bareId,
            name: row.name ?? row.employee_name ?? 'Employee',
            recordType: 'employee',
            userId: row.user_id ?? row.userId ?? bareId,
            branch: row.branch?.name
              ? { name: row.branch.name }
              : row.branch_name
                ? { name: row.branch_name }
                : null,
          });
        }
        setEmployees(Array.from(byKey.values()));
      } catch {
        if (!cancelled) setEmployees([]);
      } finally {
        if (!cancelled) setEmployeesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [employeesProp, branchParams]);

  const selectedEmployee = useMemo(() => {
    if (!employeeKey) return null;
    return (
      employees.find((e) => workshopStaffSelectValue(e) === String(employeeKey)) || null
    );
  }, [employees, employeeKey]);

  const selectedUserId = useMemo(() => {
    if (!selectedEmployee) {
      const raw = searchParams.get('employee');
      if (raw && /^\d+$/.test(raw)) return raw;
      return '';
    }
    return String(selectedEmployee.userId || '');
  }, [selectedEmployee, searchParams]);

  const employeeName =
    selectedEmployee?.name ||
    searchParams.get('name') ||
    t('stmt.employeeFallback');

  useEffect(() => {
    if (selectedEmployee?.name) setEmployeeDisplay(selectedEmployee.name);
  }, [selectedEmployee?.name]);

  const load = useCallback(async () => {
    if (!selectedUserId && !employeeKey) {
      setPayload(null);
      return;
    }
    setLoading(true);
    setError('');
    setApiMissing(false);
    setLegacyMode(false);
    try {
      const userId = selectedUserId;
      if (!userId) {
        setError(
          selectedEmployee
            ? t('pr.err.noUser')
            : t('stmt.err.pickEmployee'),
        );
        setPayload(null);
        return;
      }
      const params = {
        ...branchParams,
        page: String(page),
        ...(applied.from ? { from: applied.from } : {}),
        ...(applied.to ? { to: applied.to } : {}),
        ...(selectedEmployee?.id &&
        (selectedEmployee.recordType === 'employee' ||
          selectedEmployee.employeeType === 'technician')
          ? { employeeRecordId: String(selectedEmployee.id) }
          : {}),
      };
      try {
        const res = await getEmployeePayrollStatement(userId, params);
        setPayload(res);
        setApiMissing(false);
      } catch (e) {
        const st = e?.status || e?.response?.status;
        if (st === 404 || st === 403) {
          // Fallback: legacy employee ledger (workshop record id).
          setApiMissing(true);
          const parsed = parseWorkshopStaffSelectValue(employeeKey);
          if (parsed.id) {
            const legacy = await getWorkshopEmployeeLedger(parsed.id, {
              recordType: parsed.recordType,
              userId: selectedUserId || undefined,
              ...branchParams,
            }).catch(() => null);
            if (legacy) {
              setLegacyMode(true);
              const rows = Array.isArray(legacy.rows) ? legacy.rows : [];
              setPayload({
                page: 1,
                pageSize: STATEMENT_PAGE_SIZE,
                total: rows.length,
                opening: legacy.summary?.openingBalance ?? legacy.opening ?? null,
                summary: {
                  advancesGiven: legacy.summary?.advancesGiven,
                  recovered: legacy.summary?.advancesRecovered,
                  salaryPayable: legacy.summary?.salaryPayable,
                  closingAdvance:
                    legacy.summary?.advanceOutstanding ?? legacy.summary?.closingBalance,
                },
                items: rows.map((r) => ({
                  id: r.id,
                  date: r.date,
                  ref: r.reference,
                  source: r.type || r.category,
                  type: r.type,
                  accountCode: r.accountCode || '',
                  narration: r.description,
                  debit:
                    r.debit != null
                      ? r.debit
                      : r.earnings != null
                        ? r.earnings
                        : Number(r.advance) > 0
                          ? Math.abs(Number(r.advance))
                          : null,
                  credit:
                    r.credit != null
                      ? r.credit
                      : r.deductions != null
                        ? r.deductions
                        : r.paid != null
                          ? r.paid
                          : Number(r.advance) < 0
                            ? Math.abs(Number(r.advance))
                            : null,
                  balance: r.balance ?? r.runningBalance,
                })),
              });
            } else {
              setPayload({ page: 1, pageSize: 25, total: 0, opening: 0, items: [] });
              setError(t('stmt.err.apiMissing'));
            }
          } else {
            setPayload(null);
            setError(t('stmt.err.apiMissing'));
          }
        } else {
          throw e;
        }
      }
    } catch (e) {
      setError(e?.message || t('empStmt.err.load'));
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [
    applied.from,
    applied.to,
    branchParams,
    employeeKey,
    page,
    selectedUserId,
    t,
  ]);

  useEffect(() => {
    load();
  }, [load]);

  const cards = useMemo(() => mapStatementCards(payload || {}), [payload]);
  const mappedItems = useMemo(() => {
    const items = mapStatementItems(payload);
    return withOpeningRow(items, payload?.opening, applied.from);
  }, [payload, applied.from]);

  const paged = useMemo(() => {
    if (payload?.page != null && payload?.pageSize != null && !legacyMode && !apiMissing) {
      // Server paging — opening row only on page 1
      const serverItems = mapStatementItems(payload);
      const rows =
        Number(payload.page) === 1
          ? withOpeningRow(serverItems, payload.opening, applied.from)
          : serverItems;
      return {
        page: Number(payload.page) || page,
        pageSize: Number(payload.pageSize) || STATEMENT_PAGE_SIZE,
        total: Number(payload.total) || rows.length,
        items: rows,
      };
    }
    return slicePage(mappedItems, page, STATEMENT_PAGE_SIZE);
  }, [payload, mappedItems, page, legacyMode, apiMissing, applied.from]);

  const employeeOptions = useMemo(
    () =>
      [...employees]
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        .map((e) => {
          const selectKey = workshopStaffSelectValue(e);
          return {
            id: selectKey,
            label: e.name || t('stmt.employeeFallback'),
            subtitle: [workshopStaffRoleLabel(e), e.branch?.name].filter(Boolean).join(' · '),
            searchText: [e.name, e.mobile, e.email, e.employeeType, selectKey]
              .filter(Boolean)
              .join(' '),
            ...(isInactiveRecord(e) ? { inactive: true } : {}),
          };
        }),
    [employees, t],
  );

  const applyFilters = () => {
    setApplied({ from: draftFrom, to: draftTo });
    setPage(1);
  };
  const showAllTime = () => {
    setDraftFrom('');
    setDraftTo('');
    setApplied({ from: '', to: '' });
    setPage(1);
  };

  const formatBalance = (row) => {
    if (row.balance == null) return t('adv.emdash');
    const n = formatSarLatn(row.balance);
    const suf = balanceSuffixKey(row);
    if (suf === 'payable') return `${n} ${t('stmt.suffix.payable')}`;
    if (suf === 'adv') return `${n} ${t('stmt.suffix.adv')}`;
    return n;
  };

  const printStatement = () => {
    const rowsHtml = (paged.items || [])
      .map(
        (r) =>
          `<tr>
            <td>${escapeHtml(r.date)}</td>
            <td>${escapeHtml(r.ref || '—')}</td>
            <td>${escapeHtml(mapStatementSourceKey(r))}</td>
            <td>${escapeHtml(accountLabel(r.accountCode))}</td>
            <td>${escapeHtml(r.narration || '')}</td>
            <td style="text-align:right">${r.debit != null ? escapeHtml(formatSarLatn(r.debit)) : ''}</td>
            <td style="text-align:right">${r.credit != null ? escapeHtml(formatSarLatn(r.credit)) : ''}</td>
            <td style="text-align:right">${escapeHtml(formatBalance(r))}</td>
          </tr>`,
      )
      .join('');
    const cardsHtml = cards
      .map((c) => `<li>${escapeHtml(c.id)}: SAR ${escapeHtml(formatSarLatn(c.value))}</li>`)
      .join('');
    printReportHtml(
      t('stmt.printTitle', { name: employeeName }),
      `<h1>${escapeHtml(t('stmt.title', { name: employeeName }))}</h1>
       <ul>${cardsHtml}</ul>
       <table><thead><tr>
         <th>Date</th><th>Ref</th><th>Source</th><th>Account</th><th>Narration</th><th>Debit</th><th>Credit</th><th>Balance</th>
       </tr></thead><tbody>${rowsHtml}</tbody></table>`,
    );
  };

  const cardMeta = {
    opening: { label: t('stmt.card.opening'), Icon: Wallet },
    given: { label: t('stmt.card.given'), Icon: Banknote },
    recovered: { label: t('stmt.card.recovered'), Icon: RiyalIcon },
    payable: { label: t('stmt.card.payable'), Icon: Banknote },
    closing: { label: t('stmt.card.closing'), Icon: Wallet },
  };

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          gap: 12,
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 12, color: '#64748B' }}>{t('stmt.crumb')}</div>
          <h2 style={{ margin: '4px 0 0', fontSize: 20 }}>
            {t('stmt.title', { name: employeeName })}
          </h2>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="btn-submit btn-dark"
            disabled={!payload}
            onClick={printStatement}
          >
            <Printer size={14} style={{ marginInlineEnd: 6 }} />
            {t('stmt.print')}
          </button>
          <button type="button" className="btn-portal-outline" onClick={load} disabled={loading}>
            <RefreshCw size={14} style={{ marginInlineEnd: 6 }} />
            {t('btn.refresh')}
          </button>
        </div>
      </div>

      <div
        className="acct-filter-bar"
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            applyFilters();
          }
        }}
      >
        <div style={{ ...fieldWrap, minWidth: 240, flex: '1 1 240px' }}>
          <label style={labelStyle} htmlFor="stmt-employee">
            {t('stmt.filter.employee')}
          </label>
          <SearchableEntityCombobox
            id="stmt-employee"
            options={employeeOptions}
            value={employeeKey}
            displayText={employeeDisplay}
            onDisplayTextChange={setEmployeeDisplay}
            onSelect={(opt) => {
              setEmployeeKey(opt?.id ? String(opt.id) : '');
              setEmployeeDisplay(opt?.label || '');
              setPage(1);
            }}
            placeholder={t('stmt.filter.employeePh')}
            disabled={employeesLoading}
            loading={employeesLoading}
            entityLabel="employee"
          />
        </div>
        <div style={fieldWrap}>
          <label style={labelStyle} htmlFor="stmt-from">
            {t('stmt.filter.from')}
          </label>
          <input
            id="stmt-from"
            type="date"
            style={inputStyle}
            value={draftFrom}
            onChange={(e) => setDraftFrom(e.target.value)}
          />
        </div>
        <div style={fieldWrap}>
          <label style={labelStyle} htmlFor="stmt-to">
            {t('stmt.filter.to')}
          </label>
          <input
            id="stmt-to"
            type="date"
            style={inputStyle}
            value={draftTo}
            onChange={(e) => setDraftTo(e.target.value)}
          />
        </div>
        <button type="button" className="btn-submit btn-dark" onClick={applyFilters}>
          {t('adv.filter.apply')}
        </button>
        <button type="button" className="btn-portal-outline" onClick={showAllTime}>
          {t('stmt.filter.allTime')}
        </button>
      </div>

      {error ? (
        <div
          role="alert"
          style={{
            padding: 12,
            marginBottom: 12,
            color: '#B45309',
            background: '#FFFBEB',
            borderRadius: 8,
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <span>{error}</span>
          <button type="button" className="btn-portal-outline" onClick={load}>
            {t('adv.err.retry')}
          </button>
        </div>
      ) : null}

      {apiMissing && legacyMode ? (
        <p style={{ fontSize: 13, color: '#64748B', marginBottom: 8 }}>{t('stmt.legacyNote')}</p>
      ) : null}

      {cards.length > 0 ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 12,
            marginBottom: 16,
          }}
        >
          {cards.map((c) => {
            const meta = cardMeta[c.id] || cardMeta.opening;
            const Icon = meta.Icon;
            return (
              <div key={c.id} className="acct-kpi-card">
                <Icon size={16} />
                <div style={{ fontSize: 12, color: '#64748B' }}>{meta.label}</div>
                <div style={{ fontWeight: 800, fontSize: 18 }}>
                  {t('adv.money.sar', { n: formatSarLatn(c.value) })}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {loading ? (
        <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>{t('loading')}</div>
      ) : !employeeKey && !selectedUserId ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#94A3B8' }}>
          {t('stmt.pickPrompt')}
        </div>
      ) : (
        <>
          <WsTableScroll>
            <table className="ws-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr className="table-header-row">
                  <th className="table-th">{t('stmt.th.date')}</th>
                  <th className="table-th">{t('stmt.th.ref')}</th>
                  <th className="table-th">{t('stmt.th.source')}</th>
                  <th className="table-th">{t('stmt.th.account')}</th>
                  <th className="table-th">{t('stmt.th.narration')}</th>
                  <th className="table-th" style={{ textAlign: 'end' }}>
                    {t('stmt.th.debit')}
                  </th>
                  <th className="table-th" style={{ textAlign: 'end' }}>
                    {t('stmt.th.credit')}
                  </th>
                  <th className="table-th" style={{ textAlign: 'end' }}>
                    {t('stmt.th.balance')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {paged.items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="table-cell"
                      style={{ textAlign: 'center', padding: 32, color: '#94A3B8' }}
                    >
                      {t('stmt.empty')}
                    </td>
                  </tr>
                ) : (
                  paged.items.map((r) => {
                    const href = refHref(r);
                    const sk = mapStatementSourceKey(r);
                    return (
                      <tr key={r.id} className="table-row">
                        <td className="table-cell">{r.date}</td>
                        <td className="table-cell">
                          {href && r.ref ? (
                            <Link to={href} style={{ color: '#0284C7', fontWeight: 600 }}>
                              {r.ref}
                            </Link>
                          ) : (
                            r.ref || t('adv.emdash')
                          )}
                        </td>
                        <td className="table-cell">
                          <SourceChip sourceKey={sk} t={t} />
                        </td>
                        <td className="table-cell">{accountLabel(r.accountCode) || t('adv.emdash')}</td>
                        <td className="table-cell">{r.narration || t('adv.emdash')}</td>
                        <td className="table-cell" style={{ textAlign: 'end' }}>
                          {r.debit != null && Number(r.debit) !== 0
                            ? formatSarLatn(r.debit)
                            : ''}
                        </td>
                        <td className="table-cell" style={{ textAlign: 'end' }}>
                          {r.credit != null && Number(r.credit) !== 0
                            ? formatSarLatn(r.credit)
                            : ''}
                        </td>
                        <td className="table-cell" style={{ textAlign: 'end', fontWeight: 600 }}>
                          {formatBalance(r)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </WsTableScroll>
          <PaginationControls
            total={paged.total}
            limit={paged.pageSize}
            offset={(paged.page - 1) * paged.pageSize}
            onPageChange={(offset) => setPage(Math.floor(offset / paged.pageSize) + 1)}
            loading={loading}
          />
        </>
      )}
    </div>
  );
}
