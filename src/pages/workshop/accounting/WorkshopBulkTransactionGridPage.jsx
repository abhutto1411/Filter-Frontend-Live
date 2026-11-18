import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { Copy, Paperclip, Plus, Trash2, Upload } from 'lucide-react';
import { accT } from '../../../utils/accountingI18n';
import { useAuth } from '../../../context/AuthContext';
import { useHqAdminBooksScope } from '../../../hooks/useHqAdminBooksScope';
import {
  listCashBankAccounts,
  listCoaAccounts,
  listPayees,
  validateAccountingBatch,
  createAccountingBatch,
  updateAccountingBatch,
  postAccountingBatch,
  getAccountingBatch,
} from '../../../services/workshopAccountingApi';
import CoaAccountSearchCombobox, {
  mapCashBankToComboboxOptions,
} from '../../../components/accounting/CoaAccountSearchCombobox';
import SearchableEntityCombobox from '../../../components/SearchableEntityCombobox';
import WsTableScroll from '../../../components/workshop/WsTableScroll';
import {
  BATCH_ERROR_I18N,
  clientValidateRow,
  computeGridTotals,
  downloadBatchTemplateCsv,
  emptyBatchRow,
  filterRowsByChip,
  journalGroupsBalanced,
  localDraftStorageKey,
  mapPasteCellsToRowPatch,
  mergeServerValidation,
  parsePasteBlock,
  rowsToBatchDtoPayload,
  splitInclusiveVat,
  todayYmdRiyadh,
} from '../../../utils/bulkTransactionGrid';
import '../../../styles/admin/AccountingPage.css';

const TYPE_OPTS = ['payment', 'receipt', 'transfer', 'journal'];
const VAT_OPTS = ['NONE', 'S15', 'Z0', 'EX'];

function chipStyle(active, tone) {
  const tones = {
    all: { bg: '#E2E8F0', fg: '#0F172A' },
    errors: { bg: '#FEE2E2', fg: '#991B1B' },
    warnings: { bg: '#FEF3C7', fg: '#92400E' },
    valid: { bg: '#DCFCE7', fg: '#166534' },
  };
  const t = tones[tone] || tones.all;
  return {
    border: active ? '2px solid #0F172A' : '1px solid #CBD5E1',
    background: t.bg,
    color: t.fg,
    borderRadius: 999,
    padding: '4px 12px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  };
}

function statusChip(state, t) {
  const map = {
    valid: { bg: '#DCFCE7', fg: '#166534', label: t('bulk.status.valid') },
    warning: { bg: '#FEF3C7', fg: '#92400E', label: t('bulk.status.warning') },
    error: { bg: '#FEE2E2', fg: '#991B1B', label: t('bulk.status.error') },
  };
  const m = map[state] || map.valid;
  return (
    <span
      style={{
        display: 'inline-block',
        background: m.bg,
        color: m.fg,
        borderRadius: 6,
        padding: '2px 8px',
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      {m.label}
    </span>
  );
}

function issueText(issues, t) {
  return (issues || [])
    .map((e) => {
      const key = BATCH_ERROR_I18N[e.code];
      return key ? t(key) : e.message || e.code;
    })
    .join(' · ');
}

export default function WorkshopBulkTransactionGridPage({
  branches = [],
  selectedBranchId = 'all',
  locale: localeProp,
  mode = 'new',
}) {
  const { isAdminHqBooks } = useHqAdminBooksScope();
  const { user, hasPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const paramBatchId = (() => {
    const parts = String(location.pathname || '').split('/').filter(Boolean);
    const i = parts.indexOf('batch');
    if (i >= 0 && parts[i + 1] && parts[i + 1] !== 'new') return parts[i + 1];
    return null;
  })();
  const outletCtx = useOutletContext() || {};
  const locale =
    localeProp ||
    outletCtx.locale ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
    'en';
  const t = useCallback((key, vars) => accT(locale, key, vars), [locale]);
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  const canWrite =
    hasPermission('workshop.accounting.transactions.create') ||
    hasPermission('workshop.accounting.payments.create') ||
    hasPermission('accounting.transactions.create');

  const [batchId, setBatchId] = useState(mode === 'edit' ? paramBatchId : null);
  const [batchNo, setBatchNo] = useState(null);
  const [version, setVersion] = useState(1);
  const [status, setStatus] = useState('draft');
  const [memo, setMemo] = useState('');
  const [defaultDate, setDefaultDate] = useState(todayYmdRiyadh());
  const [defaultBranchId, setDefaultBranchId] = useState(
    selectedBranchId && selectedBranchId !== 'all' ? String(selectedBranchId) : '',
  );
  const [defaultRegisterId, setDefaultRegisterId] = useState('');
  const [rows, setRows] = useState(() => [
    emptyBatchRow({
      date: todayYmdRiyadh(),
      type: 'payment',
    }),
  ]);
  const [chip, setChip] = useState('all');
  const [acceptWarnings, setAcceptWarnings] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadErr, setLoadErr] = useState('');
  const [actionErr, setActionErr] = useState('');
  const [info, setInfo] = useState('');
  const [restoredBanner, setRestoredBanner] = useState(false);
  const [confirmPostValid, setConfirmPostValid] = useState(false);
  const [undoRow, setUndoRow] = useState(null);
  const [proofRowId, setProofRowId] = useState(null);
  const [cashBankAccounts, setCashBankAccounts] = useState([]);
  const [coaAll, setCoaAll] = useState([]);
  const [payees, setPayees] = useState({ supplier: [], employee: [], customer: [] });
  const [lookupsLoading, setLookupsLoading] = useState(true);
  const idemRef = useRef(null);
  const validateTimer = useRef(null);
  const focusCell = useRef({ r: 0, c: 0 });

  const workshopId = user?.workshopId != null ? String(user.workshopId) : '';

  const refreshLookups = useCallback(async () => {
    setLookupsLoading(true);
    setLoadErr('');
    try {
      const [cb, all, sup, emp, cust] = await Promise.all([
        listCashBankAccounts({ excludeCashierTills: '1' }),
        listCoaAccounts('all'),
        listPayees('supplier'),
        listPayees('employee', { includeInactive: 'true' }),
        listPayees('customer'),
      ]);
      setCashBankAccounts(cb?.accounts ?? []);
      setCoaAll(all?.accounts ?? []);
      setPayees({
        supplier: sup?.payees ?? [],
        employee: emp?.payees ?? [],
        customer: cust?.payees ?? [],
      });
    } catch (e) {
      setLoadErr(e?.message || t('bulk.err.lookups'));
    } finally {
      setLookupsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    refreshLookups();
  }, [refreshLookups]);

  useEffect(() => {
    if (selectedBranchId && selectedBranchId !== 'all') {
      setDefaultBranchId(String(selectedBranchId));
    }
  }, [selectedBranchId]);

  // Local draft restore (new only)
  useEffect(() => {
    if (mode !== 'new' || !workshopId) return;
    try {
      const key = localDraftStorageKey(user?.id, workshopId);
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.rows?.length) {
        setRows(parsed.rows);
        setMemo(parsed.memo || '');
        setDefaultDate(parsed.defaultDate || todayYmdRiyadh());
        setDefaultRegisterId(parsed.defaultRegisterId || '');
        setRestoredBanner(true);
      }
    } catch {
      /* ignore */
    }
  }, [mode, workshopId, user?.id]);

  // Autosave local every 5s
  useEffect(() => {
    if (mode !== 'new' || status === 'posted' || !workshopId) return undefined;
    const id = setInterval(() => {
      try {
        localStorage.setItem(
          localDraftStorageKey(user?.id, workshopId),
          JSON.stringify({
            rows,
            memo,
            defaultDate,
            defaultRegisterId,
            savedAt: Date.now(),
          }),
        );
      } catch {
        /* ignore */
      }
    }, 5000);
    return () => clearInterval(id);
  }, [rows, memo, defaultDate, defaultRegisterId, mode, status, workshopId, user?.id]);

  // Load existing batch
  useEffect(() => {
    if (mode !== 'edit' || !paramBatchId) return undefined;
    let cancelled = false;
    (async () => {
      setBusy(true);
      setLoadErr('');
      try {
        const res = await getAccountingBatch(paramBatchId);
        if (cancelled) return;
        setBatchId(res?.id || paramBatchId);
        setBatchNo(res?.batchNo || null);
        setVersion(res?.version || 1);
        setStatus(res?.status || 'draft');
        setMemo(res?.memo || '');
        const loaded = (res?.rows || []).map((line) => {
          const p = line.payload || {};
          return {
            ...emptyBatchRow(p),
            clientRowId: line.clientRowId || p.clientRowId,
            type: line.type || p.type,
            attachmentUrl: line.attachmentUrl || p.attachmentUrl || '',
            _state: line.state === 'posted' ? 'valid' : line.state === 'error' ? 'error' : undefined,
            _voucher: line.voucherNumber,
            _journalId: line.journalId,
          };
        });
        setRows(loaded.length ? loaded : [emptyBatchRow({ date: todayYmdRiyadh() })]);
      } catch (e) {
        if (!cancelled) setLoadErr(e?.message || t('bulk.err.load'));
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, paramBatchId, t]);

  const annotatedRows = useMemo(() => {
    const today = todayYmdRiyadh();
    return rows.map((r) => {
      if (r._errors?.length || r._warnings?.length) {
        const state =
          r._errors?.length ? 'error' : r._warnings?.length ? 'warning' : r._state || 'valid';
        return { ...r, _state: state };
      }
      const v = clientValidateRow(r, { todayYmd: today });
      return { ...r, _state: v.state, _errors: v.errors, _warnings: v.warnings };
    });
  }, [rows]);

  const totals = useMemo(() => computeGridTotals(annotatedRows), [annotatedRows]);
  const jeBal = useMemo(() => journalGroupsBalanced(annotatedRows), [annotatedRows]);
  const visible = useMemo(
    () => filterRowsByChip(annotatedRows, chip),
    [annotatedRows, chip],
  );

  const registerOpts = useMemo(
    () => mapCashBankToComboboxOptions(cashBankAccounts),
    [cashBankAccounts],
  );

  const branchOpts = useMemo(
    () =>
      (branches || []).map((b) => ({
        id: String(b.id),
        label: b.name || String(b.id),
        searchText: b.name || '',
      })),
    [branches],
  );

  const updateRow = useCallback((idx, patch) => {
    setRows((prev) => {
      const next = [...prev];
      const cur = { ...next[idx], ...patch };
      if (
        (cur.type === 'payment' || cur.type === 'receipt') &&
        cur.vatCode === 'S15' &&
        cur.amount &&
        patch.amount !== undefined
      ) {
        const split = splitInclusiveVat(cur.amount, 15);
        cur.vatAmount = split.vat;
      }
      delete cur._errors;
      delete cur._warnings;
      next[idx] = cur;
      return next;
    });
  }, []);

  const addRow = useCallback(
    (afterIdx) => {
      const base = emptyBatchRow({
        date: defaultDate || todayYmdRiyadh(),
        type: 'payment',
        cashBankAccountId: defaultRegisterId || '',
        branchId: defaultBranchId || '',
      });
      setRows((prev) => {
        const next = [...prev];
        const at = afterIdx == null ? next.length : afterIdx + 1;
        next.splice(at, 0, base);
        return next;
      });
    },
    [defaultDate, defaultRegisterId, defaultBranchId],
  );

  const duplicateRow = useCallback((idx) => {
    setRows((prev) => {
      const copy = {
        ...prev[idx],
        clientRowId: emptyBatchRow().clientRowId,
      };
      delete copy._errors;
      delete copy._warnings;
      delete copy._voucher;
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  }, []);

  const deleteRow = useCallback((idx) => {
    setRows((prev) => {
      if (prev.length <= 1) return prev;
      const removed = prev[idx];
      const next = prev.filter((_, i) => i !== idx);
      setUndoRow({ row: removed, index: idx });
      setTimeout(() => setUndoRow(null), 10000);
      return next;
    });
  }, []);

  const runValidate = useCallback(async () => {
    setActionErr('');
    setInfo('');
    try {
      const body = rowsToBatchDtoPayload(annotatedRows, {
        memo,
        branchId: defaultBranchId || undefined,
      });
      const res = await validateAccountingBatch(body);
      setRows((prev) => mergeServerValidation(prev, res?.rows || []));
      setInfo(t('bulk.info.validated'));
    } catch (e) {
      setActionErr(e?.message || t('bulk.err.validate'));
    }
  }, [annotatedRows, memo, defaultBranchId, t]);

  // Debounced server validate (silent — staging may 404 until BE deploy)
  useEffect(() => {
    if (status === 'posted') return undefined;
    if (validateTimer.current) clearTimeout(validateTimer.current);
    validateTimer.current = setTimeout(async () => {
      if (annotatedRows.length === 0) return;
      try {
        const body = rowsToBatchDtoPayload(annotatedRows, {
          memo,
          branchId: defaultBranchId || undefined,
        });
        const res = await validateAccountingBatch(body);
        setRows((prev) => mergeServerValidation(prev, res?.rows || []));
      } catch {
        /* client validation still shows; server optional until route is live */
      }
    }, 600);
    return () => {
      if (validateTimer.current) clearTimeout(validateTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, memo]);

  const saveDraft = useCallback(async () => {
    if (!canWrite) return;
    setBusy(true);
    setActionErr('');
    try {
      const body = rowsToBatchDtoPayload(annotatedRows, {
        memo,
        branchId: defaultBranchId || undefined,
        version,
      });
      let res;
      if (batchId) {
        res = await updateAccountingBatch(batchId, body);
      } else {
        res = await createAccountingBatch(body);
        setBatchId(res?.id);
        if (res?.id) {
          navigate(`/workshop/accounting/transactions/batch/${res.id}`, { replace: true });
        }
      }
      setBatchNo(res?.batchNo || batchNo);
      setVersion(res?.version || version);
      setStatus(res?.status || 'draft');
      setInfo(t('bulk.info.saved', { no: res?.batchNo || '—' }));
      try {
        localStorage.removeItem(localDraftStorageKey(user?.id, workshopId));
      } catch {
        /* ignore */
      }
    } catch (e) {
      setActionErr(e?.message || t('bulk.err.save'));
    } finally {
      setBusy(false);
    }
  }, [
    canWrite,
    annotatedRows,
    memo,
    defaultBranchId,
    version,
    batchId,
    batchNo,
    navigate,
    t,
    user?.id,
    workshopId,
  ]);

  const ensureIdempotencyKey = () => {
    if (!idemRef.current) {
      idemRef.current =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `idem-${Date.now()}`;
    }
    return idemRef.current;
  };

  const doPost = useCallback(
    async (postMode) => {
      if (!canWrite) return;
      if (totals.errors > 0 && postMode === 'all_or_nothing') return;
      if (totals.warnings > 0 && !acceptWarnings) {
        setActionErr(t('bulk.err.acceptWarnings'));
        return;
      }
      if (!jeBal.balanced) {
        setActionErr(t('bulk.err.jeUnbalanced'));
        return;
      }
      setBusy(true);
      setActionErr('');
      try {
        let id = batchId;
        if (!id) {
          const created = await createAccountingBatch(
            rowsToBatchDtoPayload(annotatedRows, {
              memo,
              branchId: defaultBranchId || undefined,
            }),
          );
          id = created?.id;
          setBatchId(id);
          setBatchNo(created?.batchNo);
        } else {
          await updateAccountingBatch(
            id,
            rowsToBatchDtoPayload(annotatedRows, {
              memo,
              branchId: defaultBranchId || undefined,
              version,
            }),
          );
        }
        const res = await postAccountingBatch(id, {
          mode: postMode,
          idempotencyKey: ensureIdempotencyKey(),
          acceptWarnings,
        });
        if (res?.success === false) {
          setRows((prev) => mergeServerValidation(prev, res?.rows || []));
          setActionErr(t('bulk.err.postBlocked'));
          return;
        }
        setStatus(res?.status || 'posted');
        setVersion(res?.version || version);
        setInfo(t('bulk.info.posted'));
        idemRef.current = null;
        try {
          localStorage.removeItem(localDraftStorageKey(user?.id, workshopId));
        } catch {
          /* ignore */
        }
        if (id) navigate(`/workshop/accounting/transactions/batch/${id}`);
      } catch (e) {
        setActionErr(e?.message || t('bulk.err.post'));
      } finally {
        setBusy(false);
        setConfirmPostValid(false);
      }
    },
    [
      canWrite,
      totals.errors,
      totals.warnings,
      acceptWarnings,
      jeBal.balanced,
      batchId,
      annotatedRows,
      memo,
      defaultBranchId,
      version,
      navigate,
      t,
      user?.id,
      workshopId,
    ],
  );

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        saveDraft();
      }
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        runValidate();
      }
      if (e.ctrlKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicateRow(focusCell.current.r || 0);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saveDraft, runValidate, duplicateRow]);

  const onPaste = (e, rowIdx) => {
    const text = e.clipboardData?.getData('text');
    if (!text || (!text.includes('\t') && !text.includes('\n'))) return;
    e.preventDefault();
    const block = parsePasteBlock(text);
    if (!block.length) return;
    setRows((prev) => {
      const next = [...prev];
      for (let i = 0; i < block.length; i += 1) {
        const idx = rowIdx + i;
        while (next.length <= idx) {
          next.push(
            emptyBatchRow({
              date: defaultDate,
              cashBankAccountId: defaultRegisterId,
              branchId: defaultBranchId,
            }),
          );
        }
        const patch = mapPasteCellsToRowPatch(block[i], 0);
        next[idx] = { ...next[idx], ...patch };
      }
      return next;
    });
  };

  const payeeOptions = useMemo(() => {
    const out = [];
    for (const [kind, list] of Object.entries(payees)) {
      for (const p of list || []) {
        out.push({
          id: String(p.id),
          label: p.name || p.label || String(p.id),
          searchText: `${p.name || ''} ${kind}`,
          subtitle: kind,
          payeeType:
            kind === 'supplier'
              ? 'Supplier'
              : kind === 'employee'
                ? 'Employee'
                : kind === 'customer'
                  ? 'Customer'
                  : 'Other',
        });
      }
    }
    out.push({
      id: '__other__',
      label: t('bulk.party.other'),
      searchText: 'other',
      payeeType: 'Other',
    });
    return out;
  }, [payees, t]);

  const registerAfter = useMemo(() => {
    const reg = cashBankAccounts.find((a) => String(a.id) === String(defaultRegisterId));
    if (!reg) return null;
    const bal = Number(reg.currentBalance || 0);
    let delta = 0;
    for (const r of annotatedRows) {
      if (String(r.cashBankAccountId) !== String(defaultRegisterId)) continue;
      const amt = Number(r.amount || 0);
      if (r.type === 'payment' || r.type === 'transfer') delta -= amt;
      if (r.type === 'receipt') delta += amt;
    }
    return {
      name: reg.name,
      from: bal.toFixed(2),
      to: (bal + delta).toFixed(2),
    };
  }, [cashBankAccounts, defaultRegisterId, annotatedRows]);

  if (loadErr && !annotatedRows.length) {
    return (
      <div className="module-container" dir={dir} role="alert">
        <p style={{ color: '#B91C1C' }}>{loadErr}</p>
        <button type="button" className="btn-portal-outline" onClick={refreshLookups}>
          {t('bulk.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="module-container bulk-tx-grid" dir={dir}>
      <header style={{ marginBottom: 10 }}>
        <p className="form-help-text" style={{ marginBottom: 4 }}>
          <Link to="/workshop/accounting">{t('pcw.crumb.accounting')}</Link>
          {' / '}
          <Link to="/workshop/accounting/transactions">{t('tx.crumb.transactions')}</Link>
          {' / '}
          <span>{t('bulk.crumb.new')}</span>
        </p>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            gap: 8,
            alignItems: 'center',
          }}
        >
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0F172A' }}>
            {t('bulk.title')}
          </h2>
          <Link
            to="/workshop/accounting/transactions"
            className="btn-portal-outline"
            style={{ textDecoration: 'none', fontSize: 13 }}
          >
            {t('bulk.classicForm')}
          </Link>
        </div>
      </header>

      {restoredBanner ? (
        <div
          role="status"
          style={{
            marginBottom: 10,
            padding: '8px 12px',
            background: '#FEF3C7',
            borderRadius: 8,
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <span>{t('bulk.restored')}</span>
          <button
            type="button"
            className="btn-portal-outline"
            onClick={() => {
              try {
                localStorage.removeItem(localDraftStorageKey(user?.id, workshopId));
              } catch {
                /* ignore */
              }
              setRows([emptyBatchRow({ date: todayYmdRiyadh(), type: 'payment' })]);
              setRestoredBanner(false);
            }}
          >
            {t('bulk.discard')}
          </button>
        </div>
      ) : null}

      {loadErr ? (
        <div role="alert" style={{ marginBottom: 10, color: '#B91C1C' }}>
          {loadErr}{' '}
          <button type="button" className="btn-portal-outline" onClick={refreshLookups}>
            {t('bulk.retry')}
          </button>
        </div>
      ) : null}
      {actionErr ? (
        <div role="alert" style={{ marginBottom: 10, color: '#B91C1C' }}>
          {actionErr}
        </div>
      ) : null}
      {info ? (
        <div role="status" style={{ marginBottom: 10, color: '#166534' }}>
          {info}
        </div>
      ) : null}

      {/* Header fields */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 10,
          marginBottom: 12,
          padding: 12,
          border: '1px solid #E2E8F0',
          borderRadius: 12,
          background: '#F8FAFC',
        }}
      >
        <label>
          <span className="form-help-text">{t('bulk.field.batch')}</span>
          <input
            className="form-input"
            readOnly
            value={
              batchNo
                ? batchNo
                : t('bulk.field.batchDraft')
            }
          />
        </label>
        <label>
          <span className="form-help-text">{t('bulk.field.defaultDate')}</span>
          <input
            className="form-input"
            type="date"
            value={defaultDate}
            onChange={(e) => setDefaultDate(e.target.value)}
          />
        </label>
        {!isAdminHqBooks ? (
          <label>
            <span className="form-help-text">{t('bulk.field.defaultBranch')}</span>
            <select
              className="form-input"
              value={defaultBranchId}
              onChange={(e) => setDefaultBranchId(e.target.value)}
            >
              <option value="">{t('bulk.field.branchAll')}</option>
              {branchOpts.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label>
          <span className="form-help-text">{t('bulk.field.defaultRegister')}</span>
          <SearchableEntityCombobox
            className="ws-filter-combobox"
            options={registerOpts}
            value={defaultRegisterId}
            displayText={
              registerOpts.find((o) => o.id === String(defaultRegisterId))?.label || ''
            }
            onDisplayTextChange={() => {}}
            onSelect={(opt) => setDefaultRegisterId(opt?.id ? String(opt.id) : '')}
            placeholder={t('bulk.field.registerPh')}
          />
        </label>
        <label style={{ gridColumn: '1 / -1' }}>
          <span className="form-help-text">{t('bulk.field.memo')}</span>
          <input
            className="form-input"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            maxLength={500}
          />
        </label>
        <p className="form-help-text" style={{ gridColumn: '1 / -1', margin: 0 }}>
          {t('bulk.help.keyboard')}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, gridColumn: '1 / -1' }}>
          <Link
            to="/workshop/accounting/transactions/batch/import"
            className="btn-portal-outline"
            style={{ textDecoration: 'none' }}
          >
            <Upload size={14} style={{ marginInlineEnd: 6 }} />
            {t('tx.bulk.import')}
          </Link>
          <button
            type="button"
            className="btn-portal-outline"
            onClick={() => downloadBatchTemplateCsv()}
          >
            {t('bulk.downloadTemplate')}
          </button>
        </div>
      </section>

      {/* Filter chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        {[
          ['all', 'bulk.chip.all', totals.count],
          ['errors', 'bulk.chip.errors', totals.errors],
          ['warnings', 'bulk.chip.warnings', totals.warnings],
          ['valid', 'bulk.chip.valid', totals.valid],
        ].map(([id, key, n]) => (
          <button
            key={id}
            type="button"
            style={chipStyle(chip === id, id)}
            onClick={() => setChip(id)}
          >
            {t(key, { n })}
          </button>
        ))}
      </div>

      {lookupsLoading ? (
        <p role="status">{t('bulk.loading')}</p>
      ) : (
        <WsTableScroll>
          <table className="ws-table" role="grid" style={{ minWidth: 1400 }}>
            <thead>
              <tr>
                {[
                  '#',
                  t('bulk.col.status'),
                  t('bulk.col.type'),
                  t('bulk.col.date'),
                  t('bulk.col.ref'),
                  t('bulk.col.party'),
                  t('bulk.col.purpose'),
                  t('bulk.col.account'),
                  t('bulk.col.payFrom'),
                  t('bulk.col.transferTo'),
                  t('bulk.col.jeGrp'),
                  t('bulk.col.desc'),
                  t('bulk.col.amount'),
                  t('bulk.col.credit'),
                  t('bulk.col.vat'),
                  t('bulk.col.vatAmt'),
                  '📎',
                  '',
                ].map((h) => (
                  <th key={h} className="table-th">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const idx = annotatedRows.findIndex(
                  (r) => r.clientRowId === row.clientRowId,
                );
                const msg = issueText(
                  [...(row._errors || []), ...(row._warnings || [])],
                  t,
                );
                const isJe = row.type === 'journal';
                const isTr = row.type === 'transfer';
                const isEmp = String(row.payeeType || '').toLowerCase() === 'employee';
                return (
                  <React.Fragment key={row.clientRowId}>
                    <tr
                      onFocus={() => {
                        focusCell.current.r = idx;
                      }}
                      onPaste={(e) => onPaste(e, idx)}
                    >
                      <td className="table-cell">{idx + 1}</td>
                      <td className="table-cell">{statusChip(row._state, t)}</td>
                      <td className="table-cell">
                        <select
                          className="form-input"
                          value={row.type}
                          disabled={status === 'posted'}
                          onChange={(e) => updateRow(idx, { type: e.target.value })}
                          onKeyDown={(e) => {
                            const map = { p: 'payment', r: 'receipt', t: 'transfer', j: 'journal' };
                            const m = map[e.key.toLowerCase()];
                            if (m && !e.ctrlKey && !e.metaKey) {
                              e.preventDefault();
                              updateRow(idx, { type: m });
                            }
                          }}
                        >
                          {TYPE_OPTS.map((x) => (
                            <option key={x} value={x}>
                              {t(`bulk.type.${x}`)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="table-cell">
                        <input
                          className="form-input"
                          type="date"
                          value={row.date}
                          disabled={status === 'posted'}
                          onChange={(e) => updateRow(idx, { date: e.target.value })}
                        />
                      </td>
                      <td className="table-cell">
                        <input
                          className="form-input"
                          value={row.reference || ''}
                          disabled={status === 'posted'}
                          onChange={(e) => updateRow(idx, { reference: e.target.value })}
                        />
                      </td>
                      <td className="table-cell" style={{ minWidth: 160 }}>
                        {!isTr && !isJe ? (
                          <SearchableEntityCombobox
                            className="ws-filter-combobox"
                            options={payeeOptions}
                            value={row.payeeId}
                            displayText={row.payeeName || ''}
                            onDisplayTextChange={(txt) =>
                              updateRow(idx, { payeeName: txt, payeeType: row.payeeType || 'Other' })
                            }
                            onSelect={(opt) =>
                              updateRow(idx, {
                                payeeId: opt?.id === '__other__' ? '' : opt?.id || '',
                                payeeName: opt?.label || '',
                                payeeType: opt?.payeeType || 'Other',
                              })
                            }
                            placeholder={t('bulk.col.party')}
                            disabled={status === 'posted'}
                          />
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="table-cell">
                        {isEmp ? (
                          <select
                            className="form-input"
                            value={row.employeePurpose || ''}
                            disabled={status === 'posted'}
                            onChange={(e) =>
                              updateRow(idx, { employeePurpose: e.target.value })
                            }
                          >
                            <option value="">{t('bulk.purpose.choose')}</option>
                            <option value="advance">{t('tx.purpose.advance')}</option>
                            <option value="salary_payable">{t('tx.purpose.salary')}</option>
                          </select>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="table-cell" style={{ minWidth: 180 }}>
                        {!isTr ? (
                          <CoaAccountSearchCombobox
                            accounts={coaAll}
                            value={row.accountId}
                            onChange={(id) => updateRow(idx, { accountId: id })}
                            disabled={status === 'posted'}
                          />
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="table-cell" style={{ minWidth: 160 }}>
                        {!isJe ? (
                          <SearchableEntityCombobox
                            className="ws-filter-combobox"
                            options={registerOpts}
                            value={row.cashBankAccountId}
                            displayText={
                              registerOpts.find(
                                (o) => o.id === String(row.cashBankAccountId),
                              )?.label || ''
                            }
                            onDisplayTextChange={() => {}}
                            onSelect={(opt) =>
                              updateRow(idx, {
                                cashBankAccountId: opt?.id ? String(opt.id) : '',
                              })
                            }
                            disabled={status === 'posted'}
                          />
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="table-cell" style={{ minWidth: 140 }}>
                        {isTr ? (
                          <SearchableEntityCombobox
                            className="ws-filter-combobox"
                            options={registerOpts}
                            value={row.toCashBankAccountId}
                            displayText={
                              registerOpts.find(
                                (o) => o.id === String(row.toCashBankAccountId),
                              )?.label || ''
                            }
                            onDisplayTextChange={() => {}}
                            onSelect={(opt) =>
                              updateRow(idx, {
                                toCashBankAccountId: opt?.id ? String(opt.id) : '',
                              })
                            }
                            disabled={status === 'posted'}
                          />
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="table-cell">
                        {isJe ? (
                          <input
                            className="form-input"
                            style={{ width: 56 }}
                            value={row.journalGroup ?? ''}
                            disabled={status === 'posted'}
                            onChange={(e) =>
                              updateRow(idx, { journalGroup: e.target.value })
                            }
                          />
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="table-cell">
                        <input
                          className="form-input"
                          value={row.description || ''}
                          disabled={status === 'posted'}
                          onChange={(e) => updateRow(idx, { description: e.target.value })}
                        />
                      </td>
                      <td className="table-cell" style={{ textAlign: 'right' }}>
                        {isJe ? (
                          <input
                            className="form-input"
                            style={{ textAlign: 'right', width: 90 }}
                            value={row.debit || ''}
                            disabled={status === 'posted'}
                            onChange={(e) => updateRow(idx, { debit: e.target.value })}
                          />
                        ) : (
                          <input
                            className="form-input"
                            style={{ textAlign: 'right', width: 90 }}
                            value={row.amount || ''}
                            disabled={status === 'posted'}
                            onChange={(e) => updateRow(idx, { amount: e.target.value })}
                            onKeyDown={(e) => {
                              if (
                                e.key === 'Enter' &&
                                idx === annotatedRows.length - 1
                              ) {
                                e.preventDefault();
                                addRow(idx);
                              }
                            }}
                          />
                        )}
                      </td>
                      <td className="table-cell" style={{ textAlign: 'right' }}>
                        {isJe ? (
                          <input
                            className="form-input"
                            style={{ textAlign: 'right', width: 90 }}
                            value={row.credit || ''}
                            disabled={status === 'posted'}
                            onChange={(e) => updateRow(idx, { credit: e.target.value })}
                          />
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="table-cell">
                        {!isTr && !isJe ? (
                          <select
                            className="form-input"
                            value={row.vatCode || 'NONE'}
                            disabled={status === 'posted'}
                            onChange={(e) => {
                              const vatCode = e.target.value;
                              const patch = { vatCode };
                              if (vatCode === 'S15' && row.amount) {
                                patch.vatAmount = splitInclusiveVat(row.amount, 15).vat;
                              }
                              if (vatCode === 'NONE' || vatCode === 'EX' || vatCode === 'Z0') {
                                patch.vatAmount = '0.00';
                              }
                              updateRow(idx, patch);
                            }}
                          >
                            {VAT_OPTS.map((v) => (
                              <option key={v} value={v}>
                                {v}
                              </option>
                            ))}
                          </select>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="table-cell" style={{ textAlign: 'right' }}>
                        {!isTr && !isJe ? (
                          <input
                            className="form-input"
                            style={{ textAlign: 'right', width: 80 }}
                            value={row.vatAmount || ''}
                            disabled={status === 'posted'}
                            onChange={(e) => updateRow(idx, { vatAmount: e.target.value })}
                          />
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="table-cell">
                        <button
                          type="button"
                          className="btn-portal-outline"
                          style={{ padding: 4 }}
                          disabled={status === 'posted'}
                          onClick={() =>
                            setProofRowId(
                              proofRowId === row.clientRowId ? null : row.clientRowId,
                            )
                          }
                          aria-label={t('bulk.col.attach')}
                        >
                          <Paperclip size={14} />
                        </button>
                      </td>
                      <td className="table-cell" style={{ whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          className="btn-portal-outline"
                          style={{ padding: 4, marginInlineEnd: 4 }}
                          disabled={status === 'posted'}
                          onClick={() => duplicateRow(idx)}
                          aria-label={t('bulk.act.duplicate')}
                        >
                          <Copy size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn-portal-outline"
                          style={{ padding: 4 }}
                          disabled={status === 'posted' || annotatedRows.length <= 1}
                          onClick={() => deleteRow(idx)}
                          aria-label={t('bulk.act.delete')}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                    {msg ? (
                      <tr>
                        <td
                          colSpan={18}
                          className="table-cell"
                          style={{
                            color: row._state === 'error' ? '#991B1B' : '#92400E',
                            fontSize: 12,
                            background: row._state === 'error' ? '#FEF2F2' : '#FFFBEB',
                          }}
                        >
                          {row._state === 'error' ? '⛔ ' : '⚠ '}
                          {msg}
                        </td>
                      </tr>
                    ) : null}
                    {proofRowId === row.clientRowId ? (
                      <tr>
                        <td colSpan={18} className="table-cell">
                          <label className="form-help-text">
                            {t('bulk.col.attach')}
                            <input
                              className="form-input"
                              style={{ marginTop: 4 }}
                              value={row.attachmentUrl || ''}
                              disabled={status === 'posted'}
                              placeholder="https://…"
                              onChange={(e) =>
                                updateRow(idx, { attachmentUrl: e.target.value })
                              }
                            />
                          </label>
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </WsTableScroll>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
        <button
          type="button"
          className="btn-portal-outline"
          disabled={status === 'posted' || annotatedRows.length >= 500}
          onClick={() => addRow()}
        >
          <Plus size={14} style={{ marginInlineEnd: 4 }} />
          {t('bulk.act.addRow')}
        </button>
        <span className="form-help-text">{t('bulk.act.insertHint')}</span>
      </div>

      {undoRow ? (
        <div
          role="status"
          style={{
            marginBottom: 10,
            padding: 8,
            background: '#F1F5F9',
            borderRadius: 8,
            display: 'flex',
            gap: 8,
          }}
        >
          <span>{t('bulk.undo.deleted')}</span>
          <button
            type="button"
            className="btn-portal-outline"
            onClick={() => {
              setRows((prev) => {
                const next = [...prev];
                next.splice(undoRow.index, 0, undoRow.row);
                return next;
              });
              setUndoRow(null);
            }}
          >
            {t('bulk.undo.action')}
          </button>
        </div>
      ) : null}

      {/* Totals strip */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 14,
          padding: '12px 14px',
          background: '#1E293B',
          color: '#F8FAFC',
          borderRadius: 10,
          marginBottom: 12,
          fontSize: 13,
        }}
      >
        <span>
          {t('bulk.tot.rows')} <strong>{totals.count}</strong>
        </span>
        <span>
          {t('bulk.tot.vwe')}{' '}
          <strong>
            {totals.valid} / {totals.warnings} / {totals.errors}
          </strong>
        </span>
        <span>
          {t('bulk.tot.in')} <strong>{totals.totalIn}</strong>
        </span>
        <span>
          {t('bulk.tot.out')} <strong>{totals.totalOut}</strong>
        </span>
        <span>
          {t('bulk.tot.transfers')} <strong>{totals.transfers}</strong>
        </span>
        <span>
          {t('bulk.tot.je')}{' '}
          <strong>
            {totals.journalDebit} / {totals.journalCredit}
          </strong>
        </span>
        <span style={{ color: totals.difference !== '0.00' ? '#FCA5A5' : undefined }}>
          {t('bulk.tot.diff')} <strong>{totals.difference}</strong>
        </span>
        {registerAfter ? (
          <span>
            {registerAfter.name} {t('bulk.tot.after')}{' '}
            <strong>
              {registerAfter.from} → {registerAfter.to}
            </strong>
          </span>
        ) : null}
      </div>

      {confirmPostValid ? (
        <div
          role="alertdialog"
          style={{
            marginBottom: 12,
            padding: 12,
            border: '1px solid #F59E0B',
            borderRadius: 8,
            background: '#FFFBEB',
          }}
        >
          <p style={{ margin: '0 0 8px' }}>
            {t('bulk.confirm.validOnly', { n: totals.errors })}
          </p>
          <button
            type="button"
            className="btn-submit btn-dark"
            style={{ marginInlineEnd: 8 }}
            disabled={busy}
            onClick={() => doPost('valid_rows_only')}
          >
            {t('bulk.confirm.yes')}
          </button>
          <button
            type="button"
            className="btn-portal-outline"
            onClick={() => setConfirmPostValid(false)}
          >
            {t('bulk.confirm.no')}
          </button>
        </div>
      ) : null}

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={acceptWarnings}
            onChange={(e) => setAcceptWarnings(e.target.checked)}
            disabled={status === 'posted'}
          />
          {t('bulk.acceptWarnings', { n: totals.warnings })}
        </label>
        <button
          type="button"
          className="btn-portal-outline"
          disabled={busy || status === 'posted'}
          onClick={runValidate}
        >
          {t('bulk.act.validate')}
        </button>
        {canWrite ? (
          <button
            type="button"
            className="btn-portal-outline"
            disabled={busy || status === 'posted'}
            onClick={saveDraft}
          >
            {t('bulk.act.saveDraft')}
          </button>
        ) : null}
        {canWrite ? (
          <button
            type="button"
            className="btn-portal-outline"
            disabled={busy || status === 'posted' || totals.valid < 1}
            onClick={() => setConfirmPostValid(true)}
          >
            {t('bulk.act.postValid', { n: totals.valid })}
          </button>
        ) : null}
        {canWrite ? (
          <button
            type="button"
            className="btn-submit btn-dark"
            disabled={
              busy ||
              status === 'posted' ||
              totals.errors > 0 ||
              !jeBal.balanced ||
              (totals.warnings > 0 && !acceptWarnings)
            }
            onClick={() => doPost('all_or_nothing')}
          >
            {t('bulk.act.postAll', { n: totals.errors })}
          </button>
        ) : null}
      </div>
      <p className="form-help-text" style={{ marginTop: 4 }}>
        {t('bulk.footer.note')}
      </p>

      {status === 'posted' ? (
        <section
          style={{
            marginTop: 16,
            padding: 14,
            border: '1px solid #BBF7D0',
            borderRadius: 10,
            background: '#F0FDF4',
          }}
        >
          <h3 style={{ marginTop: 0 }}>{t('bulk.result.title')}</h3>
          <p>{t('bulk.result.blurb')}</p>
          <ul>
            {annotatedRows
              .filter((r) => r._voucher)
              .map((r) => (
                <li key={r.clientRowId}>
                  {r._voucher} — {t(`bulk.type.${r.type}`)} {r.amount || r.debit || r.credit}
                </li>
              ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
