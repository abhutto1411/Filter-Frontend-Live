import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import {
  AlertTriangle,
  Banknote,
  FileDown,
  RefreshCw,
  Users,
} from 'lucide-react';
import {
  addPayrollSlip,
  approvePayrollRun,
  createPayrollRun,
  deletePayrollSlip,
  getPayrollRun,
  getPayrollSalarySheet,
  listPayrollRuns,
  patchPayrollSlip,
  payoutPayrollRun,
  reversePayrollRun,
  searchPayrollStaff,
} from '../../../services/advancesApi';
import SearchableEntityCombobox from '../../../components/SearchableEntityCombobox';
import InactiveTag from '../../../components/InactiveTag';
import RiyalIcon from '../../../components/RiyalIcon';
import PayrollSheetDownloadDialog, {
  isPayrollSheetReady,
} from './PayrollSheetDownloadDialog';
import {
  exportPayrollSalaryExcel,
  exportPayrollSalaryPdf,
} from './payrollSheetExport';
import { listCashBankAccounts } from '../../../services/workshopAccountingApi';
import { accT } from '../../../utils/accountingI18n';
import {
  PAYROLL_RUN_PAGE_SIZE,
  filterSlips,
  formatAccrualPreviewLines,
  formatOutstandingCell,
  formatSarLatn,
  lastDayOfPeriodYmd,
  loadPayrollStaffHits,
  mapRunSummaryCards,
  payrollErrorI18nKey,
  pickPayrollRun,
  recoveryExceedsMax,
  slicePage,
  validateDraftSlipEdits,
} from '../../../utils/payrollRunDisplay';
import { PaginationControls } from '../../../components/PaginationControls';
import WsTableScroll from '../../../components/workshop/WsTableScroll';
import { useAuth } from '../../../context/AuthContext';
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
const panelStyle = {
  background: '#fff',
  border: '1px solid #E2E8F0',
  borderRadius: 10,
  padding: 16,
  flex: '1 1 320px',
  minWidth: 280,
};

function money(v) {
  return formatSarLatn(v);
}

export default function WorkshopPayrollRunPage({
  period: periodProp,
  branches = [],
  selectedBranchId = 'all',
  locale: localeProp,
  employees = [],
}) {
  const outletCtx = useOutletContext() || {};
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canWrite =
    hasPermission('workshop.accounting.payroll') ||
    hasPermission('workshop.accounting.advances.create') ||
    hasPermission('workshop.accounting.advances.approve');

  const locale =
    localeProp ||
    outletCtx.locale ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
    'en';
  const t = useCallback((key, vars) => accT(locale, key, vars), [locale]);
  const isRtl = String(locale).toLowerCase().startsWith('ar');
  const period = periodProp || '';

  const [draft, setDraft] = useState({
    branchId:
      selectedBranchId && selectedBranchId !== 'all' ? String(selectedBranchId) : 'all',
    employeeQ: '',
  });
  const [applied, setApplied] = useState(draft);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lockedMsg, setLockedMsg] = useState('');
  const [run, setRun] = useState(null);
  const [edits, setEdits] = useState({}); // slipId -> { recovery, penalties }
  const [accounts, setAccounts] = useState([]);
  const [payFromAccountId, setPayFromAccountId] = useState('');
  const [payDate, setPayDate] = useState(toRiyadhDateISO());
  const [busy, setBusy] = useState(false);
  const [reverseOpen, setReverseOpen] = useState(false);
  const [reverseReason, setReverseReason] = useState('');
  const [addPick, setAddPick] = useState({ id: '', label: '', inactive: false });
  const [addQuery, setAddQuery] = useState('');
  const [addRemark, setAddRemark] = useState('');
  const [staffHits, setStaffHits] = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffSearchError, setStaffSearchError] = useState('');
  const [filterHits, setFilterHits] = useState([]);
  const [filterLoading, setFilterLoading] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetBusy, setSheetBusy] = useState(false);
  const [sheetError, setSheetError] = useState('');
  const [omittedStaff, setOmittedStaff] = useState([]);
  const [omittedOpen, setOmittedOpen] = useState(false);

  const mapPayrollErr = (e, fallback) => {
    const mapped = payrollErrorI18nKey(e);
    return mapped ? t(mapped, { name: e?.name || '' }) : t(fallback);
  };

  const load = useCallback(async () => {
    if (!period) {
      setLoading(false);
      setError(t('pr.err.period'));
      return;
    }
    setLoading(true);
    setError('');
    setLockedMsg('');
    try {
      const branchParams =
        applied.branchId && applied.branchId !== 'all'
          ? { branchId: applied.branchId }
          : {};
      const [listed, cb] = await Promise.all([
        listPayrollRuns({ period, ...branchParams }).catch((err) => {
          const st = err?.status || err?.response?.status;
          if (st === 404 || st === 403) return { missing: true, items: [] };
          throw err;
        }),
        listCashBankAccounts(branchParams).catch(() => ({ accounts: [] })),
      ]);
      setAccounts(cb?.accounts ?? cb?.items ?? []);

      if (listed?.missing) {
        setRun(null);
        setError(t('pr.err.apiMissing'));
        return;
      }
      const items = Array.isArray(listed?.items) ? listed.items : [];
      const match = pickPayrollRun(items, { period, branchId: applied.branchId }) || items[0];
      if (!match) {
        setRun(null);
        setOmittedStaff([]);
        return;
      }
      const full = await getPayrollRun(match.id, branchParams);
      setRun(full);
      const nextEdits = {};
      (full?.slips || []).forEach((s) => {
        nextEdits[s.id] = {
          basic: String(s.basic ?? ''),
          allowances: String(s.allowances ?? ''),
          bonus: String(s.bonus ?? ''),
          recovery: String(s.advanceRecovery ?? ''),
          penalties: String(s.penalties ?? ''),
          remarks: String(s.remarks ?? s.notes ?? ''),
          includePrior: Boolean(s.includePriorCommission),
        };
      });
      setEdits(nextEdits);
    } catch (e) {
      const code = e?.code || e?.body?.code || e?.response?.data?.code;
      if (code === 'PAYROLL_PERIOD_LOCKED') {
        setLockedMsg(mapPayrollErr(e, 'pr.err.locked'));
      }
      setError(mapPayrollErr(e, 'pr.err.load'));
      setRun(null);
    } finally {
      setLoading(false);
    }
  }, [applied.branchId, period, t]);

  useEffect(() => {
    load();
  }, [load]);

  const alreadyInRunKey = (run?.slips || [])
    .map((s) => s.employeeUserId)
    .join(',');

  useEffect(() => {
    const q = String(addQuery || '').trim();
    const draftRun = String(run?.status || '').toLowerCase() === 'draft';
    if (!draftRun || q.length < 1) {
      setStaffHits([]);
      setStaffLoading(false);
      setStaffSearchError('');
      return undefined;
    }
    let cancelled = false;
    setStaffLoading(true);
    setStaffSearchError('');
    const timer = window.setTimeout(async () => {
      try {
        const hits = await loadPayrollStaffHits(
          searchPayrollStaff,
          {
            q,
            runId: run?.id,
            ...(applied.branchId && applied.branchId !== 'all'
              ? { branchId: applied.branchId }
              : {}),
          },
          alreadyInRunKey.split(',').filter(Boolean),
        );
        if (!cancelled) setStaffHits(hits);
      } catch {
        if (!cancelled) {
          setStaffHits([]);
          setStaffSearchError(t('pr.searchError'));
        }
      } finally {
        if (!cancelled) setStaffLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [addQuery, applied.branchId, run?.id, run?.status, alreadyInRunKey, t]);

  useEffect(() => {
    const q = String(draft.employeeQ || '').trim();
    if (q.length < 1) {
      setFilterHits([]);
      setFilterLoading(false);
      return undefined;
    }
    let cancelled = false;
    setFilterLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const hits = await loadPayrollStaffHits(searchPayrollStaff, {
          q,
          ...(applied.branchId && applied.branchId !== 'all'
            ? { branchId: applied.branchId }
            : {}),
        });
        if (!cancelled) setFilterHits(hits);
      } catch {
        if (!cancelled) {
          setFilterHits([]);
          setStaffSearchError(t('pr.searchError'));
        }
      } finally {
        if (!cancelled) setFilterLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [draft.employeeQ, applied.branchId, t]);

  const createDraft = async () => {
    if (!canWrite) return;
    setBusy(true);
    setError('');
    try {
      const body = {
        period,
        ...(applied.branchId && applied.branchId !== 'all'
          ? { branchId: applied.branchId }
          : {}),
      };
      const created = await createPayrollRun(body);
      setRun(created);
      setOmittedStaff(Array.isArray(created?.omitted) ? created.omitted : []);
      setOmittedOpen((created?.omitted || []).length > 0);
      const nextEdits = {};
      (created?.slips || []).forEach((s) => {
        nextEdits[s.id] = {
          basic: String(s.basic ?? ''),
          allowances: String(s.allowances ?? ''),
          bonus: String(s.bonus ?? ''),
          recovery: String(s.advanceRecovery ?? ''),
          penalties: String(s.penalties ?? ''),
          remarks: String(s.remarks ?? s.notes ?? ''),
          includePrior: Boolean(s.includePriorCommission),
        };
      });
      setEdits(nextEdits);
    } catch (e) {
      const code = e?.code || e?.body?.code || e?.response?.data?.code;
      const runId = e?.runId || e?.body?.runId || e?.response?.data?.runId;
      if (code === 'PAYROLL_RUN_EXISTS' && runId) {
        try {
          const full = await getPayrollRun(runId);
          setRun(full);
        } catch (e2) {
          setError(mapPayrollErr(e2, 'pr.err.load'));
        }
      } else if (code === 'PAYROLL_PERIOD_LOCKED') {
        setLockedMsg(mapPayrollErr(e, 'pr.err.locked'));
        setError(mapPayrollErr(e, 'pr.err.locked'));
      } else {
        setError(mapPayrollErr(e, 'pr.err.create'));
      }
    } finally {
      setBusy(false);
    }
  };

  const filtered = useMemo(
    () => filterSlips(run?.slips || [], applied),
    [run, applied],
  );
  const paged = useMemo(() => slicePage(filtered, page, PAYROLL_RUN_PAGE_SIZE), [filtered, page]);
  const cards = useMemo(() => mapRunSummaryCards(run || { slips: [] }), [run]);
  const isDraft = String(run?.status || '').toLowerCase() === 'draft';
  const isApproved = ['approved', 'partially_paid', 'paid'].includes(
    String(run?.status || '').toLowerCase(),
  );
  const accrualDate = lastDayOfPeriodYmd(period);
  const previewLines = formatAccrualPreviewLines(run?.accrualPreview || run?.journalPreview);

  const statusLabel = (s) => {
    const k = String(s || '').toLowerCase();
    if (k === 'draft') return t('pr.status.draft');
    if (k === 'approved') return t('pr.status.approved');
    if (k === 'paid') return t('pr.status.paid');
    if (k === 'partially_paid') return t('pr.status.partial');
    if (k === 'reversed') return t('pr.status.reversed');
    return s || t('adv.emdash');
  };

  const applyFilters = () => {
    setApplied({ ...draft });
    setPage(1);
  };
  const showAll = () => {
    const cleared = {
      branchId: selectedBranchId && selectedBranchId !== 'all' ? String(selectedBranchId) : 'all',
      employeeQ: '',
    };
    setDraft(cleared);
    setApplied(cleared);
    setPage(1);
  };

  const setEdit = (slipId, field, value) => {
    setEdits((prev) => ({
      ...prev,
      [slipId]: { ...(prev[slipId] || {}), [field]: value },
    }));
  };

  const saveDraft = async () => {
    if (!run?.id || !isDraft || !canWrite) return;
    setBusy(true);
    setError('');
    try {
      for (const slip of run.slips || []) {
        const ed = edits[slip.id];
        if (!ed) continue;
        const checked = validateDraftSlipEdits(slip, ed);
        if (!checked.ok) {
          setError(t(payrollErrorI18nKey({ code: checked.code }) || 'pr.err.save', {
            name: slip.employeeName || slip.id,
          }));
          setBusy(false);
          return;
        }
        const outstanding = slip.outstandingAdvance ?? slip.outstanding ?? null;
        if (outstanding != null && recoveryExceedsMax(checked.advanceRecovery, outstanding)) {
          setError(t('pr.err.recoveryMax', { name: slip.employeeName || slip.id }));
          setBusy(false);
          return;
        }
        await patchPayrollSlip(run.id, slip.id, {
          basic: checked.basic,
          allowances: checked.allowances,
          bonus: checked.bonus,
          advanceRecovery: checked.advanceRecovery,
          penalties: checked.penalties,
          notes: checked.remarks,
          includePriorCommission: Boolean(ed.includePrior),
        });
      }
      await load();
    } catch (e) {
      setError(mapPayrollErr(e, 'pr.err.save'));
    } finally {
      setBusy(false);
    }
  };

  const addEmployeeLine = async () => {
    if (!run?.id || !isDraft || !canWrite) return;
    const userId = addPick.id;
    if (!userId) {
      setError(t('pr.err.noUser'));
      return;
    }
    if (addPick.inactive && !String(addRemark || '').trim()) {
      setError(t('pr.err.inactiveRemark'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      await addPayrollSlip(run.id, {
        userId: String(userId),
        notes: addRemark || undefined,
      });
      setAddPick({ id: '', label: '', inactive: false });
      setAddQuery('');
      setAddRemark('');
      await load();
    } catch (e) {
      setError(mapPayrollErr(e, 'pr.err.save'));
    } finally {
      setBusy(false);
    }
  };

  const removeEmployeeLine = async (slipId) => {
    if (!run?.id || !isDraft || !canWrite) return;
    setBusy(true);
    setError('');
    try {
      await deletePayrollSlip(run.id, slipId);
      await load();
    } catch (e) {
      setError(mapPayrollErr(e, 'pr.err.save'));
    } finally {
      setBusy(false);
    }
  };

  const doApprove = async () => {
    if (!run?.id || !canWrite) return;
    setBusy(true);
    setError('');
    try {
      for (const slip of run.slips || []) {
        const ed = edits[slip.id];
        if (!ed) continue;
        const recovery = Number(ed.recovery);
        const penalties = Number(ed.penalties);
        const changed =
          Number(slip.advanceRecovery) !== recovery || Number(slip.penalties) !== penalties;
        if (!changed) continue;
        await patchPayrollSlip(run.id, slip.id, {
          advanceRecovery: recovery,
          penalties,
        });
      }
      const updated = await approvePayrollRun(run.id);
      setRun(updated);
    } catch (e) {
      const code = e?.code || e?.body?.code;
      if (code === 'PAYROLL_PERIOD_LOCKED') {
        setLockedMsg(mapPayrollErr(e, 'pr.err.locked'));
      }
      setError(mapPayrollErr(e, 'pr.err.approve'));
    } finally {
      setBusy(false);
    }
  };

  const doPay = async () => {
    if (!run?.id || !canWrite || !payFromAccountId) {
      setError(t('pr.err.payFrom'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      await payoutPayrollRun(run.id, {
        all: true,
        payFromAccountId,
        date: payDate,
      });
      await load();
    } catch (e) {
      const code = e?.code || e?.body?.code;
      if (code === 'PAYROLL_PERIOD_LOCKED') {
        setLockedMsg(mapPayrollErr(e, 'pr.err.locked'));
      }
      setError(mapPayrollErr(e, 'pr.err.pay'));
    } finally {
      setBusy(false);
    }
  };

  const doReverse = async () => {
    if (!run?.id || !canWrite) return;
    setBusy(true);
    setError('');
    try {
      await reversePayrollRun(run.id, { reason: reverseReason || undefined });
      setReverseOpen(false);
      setReverseReason('');
      await load();
    } catch (e) {
      setError(mapPayrollErr(e, 'pr.err.reverse'));
    } finally {
      setBusy(false);
    }
  };

  const netTotal = cards.find((c) => c.id === 'net')?.value ?? 0;
  const empCount = cards.find((c) => c.id === 'employees')?.value ?? 0;
  const sheetReady = isPayrollSheetReady(run?.status);

  const downloadSalarySheet = async ({ branchId, month, format, language }) => {
    if (!run?.id || !sheetReady) return;
    setSheetBusy(true);
    setSheetError('');
    try {
      const sheet = await getPayrollSalarySheet(run.id, {
        ...(branchId ? { branchId } : {}),
        format: format === 'xlsx' ? 'xlsx' : 'pdf',
        language: language || 'en+ar',
        month: month || period,
      });
      if (format === 'xlsx') exportPayrollSalaryExcel(sheet);
      else await exportPayrollSalaryPdf(sheet);
      setSheetOpen(false);
    } catch (e) {
      setSheetError(mapPayrollErr(e, 'pr.sheet.err.totals'));
    } finally {
      setSheetBusy(false);
    }
  };

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'}>
      <div style={{ fontSize: 12, color: '#64748B', marginBottom: 6 }}>
        <Link to="/workshop/accounting/advances?tab=payroll" style={{ color: '#0284C7' }}>
          {t('pr.crumbBase')}
        </Link>
        {' / '}
        {period}
      </div>
      <header
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 16,
          alignItems: 'center',
        }}
      >
        <h2 style={{ margin: 0, fontSize: 22 }}>
          {t('pr.title', {
            period,
            status: statusLabel(run?.status || 'draft'),
          })}
        </h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span title={sheetReady ? t('pr.sheet.download') : t('pr.sheet.availableAfter')}>
            <button
              type="button"
              className="btn-portal-outline"
              disabled={!sheetReady || sheetBusy}
              onClick={() => {
                if (!sheetReady) return;
                setSheetError('');
                setSheetOpen(true);
              }}
            >
              <FileDown size={14} style={{ marginInlineEnd: 6 }} />
              {t('pr.sheet.download')}
            </button>
          </span>
          <button type="button" className="btn-portal-outline" onClick={load} disabled={loading}>
            <RefreshCw size={14} style={{ marginInlineEnd: 6 }} />
            {t('btn.refresh')}
          </button>
        </div>
      </header>

      {lockedMsg ? (
        <div
          role="alert"
          style={{
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            color: '#991B1B',
            padding: 12,
            borderRadius: 8,
            marginBottom: 12,
            fontWeight: 600,
          }}
        >
          <AlertTriangle size={16} style={{ marginInlineEnd: 8 }} />
          {lockedMsg}
        </div>
      ) : null}

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

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: 12,
          marginBottom: 16,
        }}
      >
        {cards.map((c) => {
          const isStatus = c.id === 'status';
          const isCount = c.id === 'employees';
          const labels = {
            employees: t('pr.card.employees'),
            gross: t('pr.card.gross'),
            recovery: t('pr.card.recovery'),
            penalties: t('pr.card.penalties'),
            net: t('pr.card.net'),
            status: t('pr.card.status'),
          };
          const Icon =
            c.id === 'employees' ? Users : c.id === 'status' ? AlertTriangle : RiyalIcon;
          return (
            <div key={c.id} className="acct-kpi-card">
              <Icon size={16} />
              <div style={{ fontSize: 12, color: '#64748B' }}>{labels[c.id]}</div>
              <div style={{ fontWeight: 800, fontSize: 18 }}>
                {isStatus
                  ? statusLabel(c.value)
                  : isCount
                    ? c.value
                    : t('adv.money.sar', { n: money(c.value) })}
              </div>
            </div>
          );
        })}
      </div>

      <div
        className="acct-filter-bar"
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            applyFilters();
          }
          if (e.key === 'Escape' && reverseOpen) setReverseOpen(false);
        }}
      >
        {branches.length > 0 ? (
          <div style={fieldWrap}>
            <label style={labelStyle} htmlFor="pr-branch">
              {t('pr.filter.branch')}
            </label>
            <select
              id="pr-branch"
              style={inputStyle}
              value={draft.branchId}
              onChange={(e) => setDraft((d) => ({ ...d, branchId: e.target.value }))}
            >
              <option value="all">{t('adv.allBranches')}</option>
              {branches.map((b) => (
                <option key={String(b.id)} value={String(b.id)}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div style={{ ...fieldWrap, minWidth: 200, flex: '1 1 200px' }}>
          <label style={labelStyle} htmlFor="pr-emp">
            {t('pr.filter.employee')}
          </label>
          <SearchableEntityCombobox
            id="pr-emp"
            options={filterHits}
            value=""
            displayText={draft.employeeQ}
            onDisplayTextChange={(v) => setDraft((d) => ({ ...d, employeeQ: v }))}
            onSelect={(opt) => {
              setDraft((d) => ({ ...d, employeeQ: opt?.label || opt?.name || '' }));
            }}
            onClear={() => setDraft((d) => ({ ...d, employeeQ: '' }))}
            placeholder={t('pr.filter.employeePh')}
            entityLabel={t('pr.th.employee')}
            filterLocally={false}
            inactiveSelectable
            inactiveTagLabel={t('pr.inactive')}
            clearLabel={t('pr.clearSearch')}
            emptyHint={staffSearchError || t('pr.searchNoResults')}
            loading={filterLoading}
          />
        </div>
        <button type="button" className="btn-submit btn-dark" onClick={applyFilters}>
          {t('adv.filter.apply')}
        </button>
        <button type="button" className="btn-portal-outline" onClick={showAll}>
          {t('adv.filter.showAll')}
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>{t('loading')}</div>
      ) : !run ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#64748B' }}>
          <p>{t('pr.empty')}</p>
          {canWrite ? (
            <button
              type="button"
              className="btn-submit btn-dark"
              disabled={busy}
              onClick={createDraft}
            >
              {t('pr.createDraft')}
            </button>
          ) : null}
        </div>
      ) : (
        <>
          {omittedStaff.length > 0 ? (
            <div
              style={{
                marginBottom: 12,
                border: '1px solid #E2E8F0',
                borderRadius: 8,
                background: '#F8FAFC',
              }}
            >
              <button
                type="button"
                onClick={() => setOmittedOpen((v) => !v)}
                style={{
                  width: '100%',
                  textAlign: 'start',
                  padding: '10px 12px',
                  border: 'none',
                  background: 'transparent',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {t('pr.omitted.title')} ({omittedStaff.length})
              </button>
              {omittedOpen ? (
                <ul style={{ margin: 0, padding: '0 12px 12px', fontSize: 13 }}>
                  {omittedStaff.map((row, i) => (
                    <li
                      key={`${row.name}-${row.reason}-${i}`}
                      style={{ marginTop: 6 }}
                      data-testid="pr-omitted-row"
                    >
                      <strong>{row.name || '—'}</strong>
                      {row.branchName ? (
                        <span style={{ color: '#64748B' }}>{` · ${row.branchName}`}</span>
                      ) : null}
                      {' — '}
                      {t(`pr.omitted.reason.${row.reason}`, {
                        defaultValue: row.reason,
                      })}
                      {row.reason === 'PAYROLL_ZERO_GROSS' ? (
                        <>
                          {' '}
                          <Link to="/workshop/employees" style={{ marginInlineStart: 6 }}>
                            {t('pr.omitted.setSalary')}
                          </Link>
                        </>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          {(run?.slips || []).length === 0 && omittedStaff.length > 0 ? (
            <p style={{ color: '#64748B', marginBottom: 12 }}>{t('pr.emptyAllOmitted')}</p>
          ) : null}
          <WsTableScroll>
            <table className="ws-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr className="table-header-row">
                  <th className="table-th">{t('pr.th.employee')}</th>
                  <th className="table-th" style={{ textAlign: 'end' }}>
                    {t('pr.th.basic')}
                  </th>
                  <th className="table-th" style={{ textAlign: 'end' }}>
                    {t('pr.th.allow')}
                  </th>
                  <th className="table-th" style={{ textAlign: 'end' }}>
                    {t('pr.th.bonus')}
                  </th>
                  <th className="table-th" style={{ textAlign: 'end' }}>
                    {t('pr.th.commission')}
                  </th>
                  <th className="table-th" style={{ textAlign: 'end' }}>
                    {t('pr.th.gross')}
                  </th>
                  <th className="table-th" style={{ textAlign: 'end' }}>
                    {t('pr.th.outstanding')}
                  </th>
                  <th className="table-th" style={{ textAlign: 'end' }}>
                    {t('pr.th.recovery')}
                  </th>
                  <th className="table-th" style={{ textAlign: 'end' }}>
                    {t('pr.th.penalties')}
                  </th>
                  <th className="table-th" style={{ textAlign: 'end' }}>
                    {t('pr.th.net')}
                  </th>
                  <th className="table-th">{t('pr.th.remarks')}</th>
                  <th className="table-th">{t('pr.th.slip')}</th>
                </tr>
              </thead>
              <tbody>
                {paged.items.map((s) => {
                  const ed = edits[s.id] || {};
                  const outstanding = s.outstandingAdvance ?? s.outstanding;
                  const recoveryVal = ed.recovery ?? s.advanceRecovery;
                  const over =
                    outstanding != null && recoveryExceedsMax(recoveryVal, outstanding);
                  const outCell = formatOutstandingCell(outstanding);
                  const moneyIn = (field, aria, extra) =>
                    isDraft && canWrite ? (
                      <input
                        aria-label={aria}
                        style={{
                          ...inputStyle,
                          width: 88,
                          textAlign: 'end',
                          ...extra,
                        }}
                        value={ed[field] ?? ''}
                        onChange={(e) => setEdit(s.id, field, e.target.value)}
                      />
                    ) : (
                      money(s[field === 'recovery' ? 'advanceRecovery' : field])
                    );
                  return (
                    <tr key={s.id} className="table-row">
                      <td className="table-cell" style={{ fontWeight: 700 }}>
                        {s.employeeName || t('adv.emdash')}
                        {s.inactive ? (
                          <InactiveTag label={t('pr.inactive')} />
                        ) : null}
                      </td>
                      <td className="table-cell" style={{ textAlign: 'end' }}>
                        {moneyIn('basic', t('pr.th.basic'))}
                      </td>
                      <td className="table-cell" style={{ textAlign: 'end' }}>
                        {moneyIn('allowances', t('pr.th.allow'))}
                      </td>
                      <td className="table-cell" style={{ textAlign: 'end' }}>
                        {moneyIn('bonus', t('pr.th.bonus'))}
                      </td>
                      <td className="table-cell" style={{ textAlign: 'end' }}>
                        {money(s.commission)}
                        {Number(s.priorCommission) > 0.005 ? (
                          <div style={{ fontSize: 11, color: '#64748B' }}>
                            {t('pr.th.prior')}: {money(s.priorCommission)}
                            {isDraft && canWrite ? (
                              <label style={{ display: 'block', fontWeight: 500 }}>
                                <input
                                  type="checkbox"
                                  checked={Boolean(ed.includePrior)}
                                  onChange={(e) =>
                                    setEdit(s.id, 'includePrior', e.target.checked)
                                  }
                                />{' '}
                                {t('pr.includePrior')}
                              </label>
                            ) : null}
                          </div>
                        ) : null}
                      </td>
                      <td className="table-cell" style={{ textAlign: 'end' }}>
                        {money(s.gross)}
                      </td>
                      <td
                        className="table-cell"
                        style={{ textAlign: 'end' }}
                        title={outCell.unknown ? t('pr.th.outstanding') : undefined}
                      >
                        {outCell.unknown ? t('adv.emdash') : outCell.text}
                      </td>
                      <td className="table-cell" style={{ textAlign: 'end' }}>
                        {isDraft && canWrite ? (
                          <div>
                            <input
                              aria-label={t('pr.th.recovery')}
                              style={{
                                ...inputStyle,
                                width: 88,
                                textAlign: 'end',
                                borderColor: over ? '#DC2626' : undefined,
                              }}
                              value={ed.recovery ?? ''}
                              onChange={(e) => setEdit(s.id, 'recovery', e.target.value)}
                            />
                            {outstanding != null ? (
                              <div style={{ fontSize: 11, color: over ? '#DC2626' : '#64748B' }}>
                                {t('pr.maxChip', { n: money(outstanding) })}
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          money(s.advanceRecovery)
                        )}
                      </td>
                      <td className="table-cell" style={{ textAlign: 'end' }}>
                        {moneyIn('penalties', t('pr.th.penalties'))}
                      </td>
                      <td className="table-cell" style={{ textAlign: 'end', fontWeight: 700 }}>
                        {money(s.net)}
                      </td>
                      <td className="table-cell">
                        {isDraft && canWrite ? (
                          <input
                            aria-label={t('pr.th.remarks')}
                            maxLength={500}
                            style={{ ...inputStyle, minWidth: 120 }}
                            value={ed.remarks ?? ''}
                            onChange={(e) => setEdit(s.id, 'remarks', e.target.value)}
                          />
                        ) : (
                          s.remarks || s.notes || t('adv.emdash')
                        )}
                      </td>
                      <td className="table-cell">
                        <button
                          type="button"
                          className="btn-portal-outline"
                          onClick={() =>
                            navigate(
                              `/workshop/accounting/advances/payroll/slip/${encodeURIComponent(s.id)}`,
                            )
                          }
                        >
                          {t('pr.openSlip')}
                        </button>
                        {isDraft && canWrite ? (
                          <button
                            type="button"
                            className="btn-portal-outline"
                            style={{ marginInlineStart: 6 }}
                            onClick={() => void removeEmployeeLine(s.id)}
                            disabled={busy}
                          >
                            {t('pr.removeLine')}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
                {isDraft && canWrite ? (
                  <tr className="table-row">
                    <td className="table-cell" colSpan={12}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ minWidth: 260, flex: 1 }}>
                          <SearchableEntityCombobox
                            id="pr-add-emp"
                            options={staffHits}
                            value={addPick.id}
                            displayText={addQuery}
                            onDisplayTextChange={setAddQuery}
                            onSelect={(opt) => {
                              if (!opt?.id) return;
                              setAddPick({
                                id: String(opt.id),
                                label: opt.label || '',
                                inactive: Boolean(opt.inactive),
                              });
                              setAddQuery(opt.label || '');
                            }}
                            onClear={() => {
                              setAddPick({ id: '', label: '', inactive: false });
                              setAddQuery('');
                            }}
                            placeholder={t('pr.addEmployee')}
                            entityLabel={t('pr.th.employee')}
                            filterLocally={false}
                            inactiveSelectable
                            inactiveTagLabel={t('pr.inactive')}
                            loading={staffLoading}
                            emptyHint={staffSearchError || t('pr.searchNoResults')}
                            clearLabel={t('pr.clearSearch')}
                          />
                        </div>
                        {addPick.inactive ? (
                          <input
                            style={{ ...inputStyle, minWidth: 180 }}
                            placeholder={t('pr.addRemarkPh')}
                            value={addRemark}
                            maxLength={500}
                            onChange={(e) => setAddRemark(e.target.value)}
                          />
                        ) : null}
                        <button
                          type="button"
                          className="btn-submit btn-dark"
                          onClick={() => void addEmployeeLine()}
                          disabled={busy || !addPick.id}
                        >
                          {t('pr.addEmployee')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : null}
                <tr className="table-row" style={{ background: '#F8FAFC', fontWeight: 800 }}>
                  <td className="table-cell">{t('pr.total')}</td>
                  <td className="table-cell" style={{ textAlign: 'end' }}>
                    {money(run?.totals?.basic)}
                  </td>
                  <td className="table-cell" style={{ textAlign: 'end' }}>
                    {money(run?.totals?.allowances)}
                  </td>
                  <td className="table-cell" style={{ textAlign: 'end' }}>
                    {money(run?.totals?.bonus)}
                  </td>
                  <td className="table-cell" style={{ textAlign: 'end' }}>
                    {money(run?.totals?.commission)}
                  </td>
                  <td className="table-cell" style={{ textAlign: 'end' }}>
                    {money(run?.totals?.gross ?? cards.find((c) => c.id === 'gross')?.value)}
                  </td>
                  <td className="table-cell" />
                  <td className="table-cell" style={{ textAlign: 'end' }}>
                    {money(run?.totals?.advanceRecovery ?? cards.find((c) => c.id === 'recovery')?.value)}
                  </td>
                  <td className="table-cell" style={{ textAlign: 'end' }}>
                    {money(run?.totals?.penalties ?? cards.find((c) => c.id === 'penalties')?.value)}
                  </td>
                  <td className="table-cell" style={{ textAlign: 'end' }}>
                    {money(run?.totals?.net ?? netTotal)}
                  </td>
                  <td className="table-cell" />
                  <td className="table-cell" />
                </tr>
              </tbody>
            </table>
          </WsTableScroll>
          {Array.isArray(run?.warnings) && run.warnings.length
            ? run.warnings.map((w) => (
                <p key={w.code} role="status" style={{ color: '#B45309', fontSize: 13 }}>
                  {t('pr.sameNameWarning', { name: (w.names || []).join(', ') })}
                </p>
              ))
            : null}
          <PaginationControls
            total={paged.total}
            limit={paged.pageSize}
            offset={(paged.page - 1) * paged.pageSize}
            onPageChange={(offset) => setPage(Math.floor(offset / paged.pageSize) + 1)}
            loading={loading}
          />

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 16,
              marginTop: 20,
              alignItems: 'stretch',
            }}
          >
            <div style={panelStyle}>
              <h3 style={{ marginTop: 0, fontSize: 16 }}>
                {t('pr.approveTitle', { date: accrualDate || period })}
              </h3>
              {previewLines.length ? (
                <div
                  style={{
                    background: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: 8,
                    padding: 12,
                    fontSize: 13,
                    marginBottom: 12,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {previewLines.map((line, i) => (
                    <div key={i}>
                      {typeof line === 'string'
                        ? line
                        : `${line.side || ''} ${line.account || ''} ${money(line.amount)}`}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 13, color: '#64748B' }}>{t('pr.previewMissing')}</p>
              )}
              {canWrite && isDraft ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn-portal-outline"
                    disabled={busy}
                    onClick={saveDraft}
                  >
                    {t('pr.saveDraft')}
                  </button>
                  <button
                    type="button"
                    className="btn-submit btn-dark"
                    disabled={busy}
                    onClick={doApprove}
                  >
                    {t('pr.approve')}
                  </button>
                </div>
              ) : null}
            </div>

            <div style={panelStyle}>
              <h3 style={{ marginTop: 0, fontSize: 16 }}>{t('pr.payTitle')}</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
                <div style={{ ...fieldWrap, flex: '1 1 180px' }}>
                  <label style={labelStyle} htmlFor="pr-payfrom">
                    {t('pr.payFrom')}
                  </label>
                  <select
                    id="pr-payfrom"
                    style={inputStyle}
                    value={payFromAccountId}
                    disabled={!isApproved || !canWrite}
                    onChange={(e) => setPayFromAccountId(e.target.value)}
                  >
                    <option value="">{t('pr.payFromPh')}</option>
                    {accounts.map((a) => (
                      <option key={String(a.id)} value={String(a.id)}>
                        {a.name || a.code || a.id}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={fieldWrap}>
                  <label style={labelStyle} htmlFor="pr-paydate">
                    {t('pr.payDate')}
                  </label>
                  <input
                    id="pr-paydate"
                    type="date"
                    style={inputStyle}
                    value={payDate}
                    disabled={!isApproved || !canWrite}
                    onChange={(e) => setPayDate(e.target.value)}
                  />
                </div>
              </div>
              <p style={{ fontSize: 13, color: '#475569' }}>
                {t('pr.paySelected', {
                  n: empCount,
                  amount: money(netTotal),
                })}
              </p>
              {canWrite ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                  <button
                    type="button"
                    className="btn-submit btn-dark"
                    disabled={!isApproved || busy}
                    onClick={doPay}
                  >
                    <Banknote size={14} style={{ marginInlineEnd: 6 }} />
                    {t('pr.pay')}
                  </button>
                  <button
                    type="button"
                    className="btn-portal-outline"
                    disabled={busy || String(run.status) === 'draft'}
                    onClick={() => setReverseOpen(true)}
                  >
                    {t('pr.reverse')}
                  </button>
                </div>
              ) : null}
              {reverseOpen ? (
                <div
                  style={{
                    marginTop: 12,
                    padding: 12,
                    background: '#FFFBEB',
                    borderRadius: 8,
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 8,
                    alignItems: 'flex-end',
                  }}
                >
                  <div style={{ ...fieldWrap, flex: '1 1 200px' }}>
                    <label style={labelStyle} htmlFor="pr-rev-reason">
                      {t('pr.reverseReason')}
                    </label>
                    <input
                      id="pr-rev-reason"
                      style={inputStyle}
                      value={reverseReason}
                      onChange={(e) => setReverseReason(e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn-submit btn-dark"
                    disabled={busy}
                    onClick={doReverse}
                  >
                    {t('pr.reverseConfirm')}
                  </button>
                  <button
                    type="button"
                    className="btn-portal-outline"
                    onClick={() => setReverseOpen(false)}
                  >
                    {t('pr.reverseCancel')}
                  </button>
                  <span style={{ fontSize: 12, color: '#64748B', width: '100%' }}>
                    {t('pr.reverseNote')}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </>
      )}
      <PayrollSheetDownloadDialog
        open={sheetOpen}
        title={t('pr.sheet.title')}
        t={t}
        mode="salary"
        downloadLabel={t('pr.sheet.download')}
        branches={branches}
        defaultBranchId={applied.branchId}
        defaultMonth={period}
        busy={sheetBusy}
        error={sheetError}
        onClose={() => setSheetOpen(false)}
        onDownload={downloadSalarySheet}
      />
    </div>
  );
}
