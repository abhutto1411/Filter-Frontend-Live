import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Upload,
} from 'lucide-react';
import { accT } from '../../../utils/accountingI18n';
import { useAuth } from '../../../context/AuthContext';
import {
  createAccountingBatch,
  listCashBankAccounts,
  listCoaAccounts,
  listPayees,
  validateAccountingBatch,
} from '../../../services/workshopAccountingApi';
import WsTableScroll from '../../../components/workshop/WsTableScroll';
import { PaginationControls } from '../../../components/PaginationControls';
import {
  BATCH_ERROR_I18N,
  filterRowsByChip,
  mergeServerValidation,
  rowsToBatchDtoPayload,
} from '../../../utils/bulkTransactionGrid';
import {
  IMPORT_MAX_BYTES,
  IMPORT_MAX_ROWS,
  IMPORT_TARGET_FIELDS,
  IMPORT_TEMPLATE_COLUMNS,
  applyColumnMap,
  buildBatchRowsFromImport,
  buildInitialColumnMap,
  columnMapStorageKey,
  downloadImportTemplateCsv,
  mappingSample,
  pageSlice,
  parseCsvText,
  summarizeImportPreview,
} from '../../../utils/bulkCsvImport';
import '../../../styles/admin/AccountingPage.css';

const PAGE_SIZE = 25;

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

function issueText(row, t) {
  const parts = [...(row._errors || []), ...(row._warnings || [])].map((e) => {
    const key = BATCH_ERROR_I18N[e.code];
    return key ? t(key) : e.message || e.code;
  });
  return parts.join(' · ');
}

export default function WorkshopBulkCsvImportPage({
  selectedBranchId = 'all',
  locale: localeProp,
}) {
  const { user, hasPermission } = useAuth();
  const navigate = useNavigate();
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

  const [step, setStep] = useState(1);
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState([]);
  const [rawRows, setRawRows] = useState([]);
  const [columnMap, setColumnMap] = useState({});
  const [previewRows, setPreviewRows] = useState([]);
  const [chip, setChip] = useState('all');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const [lookups, setLookups] = useState({
    coa: [],
    registers: [],
    suppliers: [],
    customers: [],
    employees: [],
  });
  const [lookupsErr, setLookupsErr] = useState('');

  const remembered = useMemo(() => {
    try {
      const raw = localStorage.getItem(columnMapStorageKey(user?.id));
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }, [user?.id]);

  const loadLookups = useCallback(async () => {
    setLookupsErr('');
    try {
      const [cb, all, sup, emp, cust] = await Promise.all([
        listCashBankAccounts({ excludeCashierTills: '1' }),
        listCoaAccounts('all'),
        listPayees('supplier'),
        listPayees('employee', { includeInactive: 'true' }),
        listPayees('customer'),
      ]);
      setLookups({
        registers: cb?.accounts ?? [],
        coa: all?.accounts ?? [],
        suppliers: sup?.payees ?? [],
        employees: emp?.payees ?? [],
        customers: cust?.payees ?? [],
      });
    } catch (e) {
      setLookupsErr(e?.message || t('imp.err.lookups'));
    }
  }, [t]);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  const summary = useMemo(
    () => summarizeImportPreview(previewRows),
    [previewRows],
  );

  const filtered = useMemo(
    () => filterRowsByChip(previewRows, chip),
    [previewRows, chip],
  );

  const sliced = useMemo(
    () => pageSlice(filtered, page, PAGE_SIZE),
    [filtered, page],
  );

  const firstDataSamples = useMemo(() => {
    const samples = {};
    headers.forEach((h, i) => {
      for (const row of rawRows) {
        const v = row[i];
        if (v != null && String(v).trim()) {
          samples[h] = v;
          break;
        }
      }
    });
    return samples;
  }, [headers, rawRows]);

  async function parseFile(file) {
    setErr('');
    setInfo('');
    if (!file) return;
    if (file.size > IMPORT_MAX_BYTES) {
      setErr(t('imp.err.tooLarge'));
      return;
    }
    const name = file.name || 'file';
    const lower = name.toLowerCase();
    try {
      let parsed;
      if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
        const XLSX = await import('xlsx');
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array', cellDates: false });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const aoa = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          raw: true,
          defval: '',
        });
        const headersRow = (aoa[0] || []).map((h) => String(h ?? '').trim());
        const rows = aoa
          .slice(1)
          .filter((r) => (r || []).some((c) => String(c ?? '').trim()));
        parsed = { headers: headersRow, rows };
      } else if (lower.endsWith('.csv') || lower.endsWith('.txt')) {
        const text = await file.text();
        parsed = parseCsvText(text);
      } else {
        setErr(t('imp.err.fileType'));
        return;
      }
      if (!parsed.headers.length) {
        setErr(t('imp.err.empty'));
        return;
      }
      if (parsed.rows.length > IMPORT_MAX_ROWS) {
        setErr(t('imp.err.tooMany', { n: IMPORT_MAX_ROWS }));
        return;
      }
      if (!parsed.rows.length) {
        setErr(t('imp.err.noRows'));
        return;
      }
      setFileName(name);
      setHeaders(parsed.headers);
      setRawRows(parsed.rows);
      setColumnMap(buildInitialColumnMap(parsed.headers, remembered));
      setPreviewRows([]);
      setStep(2);
    } catch (e) {
      setErr(e?.message || t('imp.err.parse'));
    }
  }

  function saveColumnMap(next) {
    setColumnMap(next);
    try {
      localStorage.setItem(
        columnMapStorageKey(user?.id),
        JSON.stringify(next),
      );
    } catch {
      /* ignore */
    }
  }

  async function goPreview() {
    setErr('');
    setBusy(true);
    try {
      const mapped = rawRows.map((cells) =>
        applyColumnMap(headers, cells, columnMap),
      );
      let rows = buildBatchRowsFromImport(mapped, lookups);
      const branchId =
        selectedBranchId && selectedBranchId !== 'all'
          ? String(selectedBranchId)
          : undefined;
      try {
        const body = rowsToBatchDtoPayload(rows, { branchId });
        const res = await validateAccountingBatch(body);
        rows = mergeServerValidation(rows, res?.rows);
        // keep client errors if server silent on that row
        rows = rows.map((r) => {
          const hasErr = (r._errors || []).length > 0;
          const hasWarn = (r._warnings || []).length > 0;
          let _state = r._state;
          if (hasErr) _state = 'error';
          else if (hasWarn) _state = 'warning';
          else if (!r._state) _state = 'valid';
          return { ...r, _state };
        });
      } catch (e) {
        // Staging may 404 — keep client-side preview
        setInfo(e?.message || t('imp.warn.validateOffline'));
      }
      setPreviewRows(rows);
      setChip('all');
      setPage(1);
      setStep(3);
    } finally {
      setBusy(false);
    }
  }

  async function createDraft(mode) {
    if (!canWrite) return;
    setErr('');
    setBusy(true);
    try {
      const source =
        mode === 'valid'
          ? previewRows.filter((r) => r._state !== 'error')
          : previewRows;
      if (!source.length) {
        setErr(t('imp.err.noValid'));
        return;
      }
      const branchId =
        selectedBranchId && selectedBranchId !== 'all'
          ? String(selectedBranchId)
          : undefined;
      const body = rowsToBatchDtoPayload(source, {
        branchId,
        memo: `Import: ${fileName}`,
      });
      const res = await createAccountingBatch(body);
      const id = res?.id;
      if (!id) {
        setErr(t('imp.err.create'));
        return;
      }
      setStep(4);
      navigate(`/workshop/accounting/transactions/batch/${id}`);
    } catch (e) {
      setErr(e?.message || t('imp.err.create'));
    } finally {
      setBusy(false);
    }
  }

  const stepMeta = [
    { n: 1, label: t('imp.step.upload') },
    { n: 2, label: t('imp.step.map') },
    { n: 3, label: t('imp.step.preview') },
    { n: 4, label: t('imp.step.draft') },
  ];

  return (
    <div className="module-container bulk-csv-import-page" dir={dir}>
      <header style={{ marginBottom: 12 }}>
        <p className="form-help-text" style={{ marginBottom: 4 }}>
          <Link to="/workshop/accounting">{t('pcw.crumb.accounting')}</Link>
          {' / '}
          <Link to="/workshop/accounting/transactions">
            {t('tx.crumb.transactions')}
          </Link>
          {' / '}
          <span>{t('imp.crumb.import')}</span>
        </p>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0F172A' }}>
          {t('imp.title')}
        </h2>
      </header>

      <nav
        aria-label={t('imp.stepper')}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          marginBottom: 14,
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        {stepMeta.map((s) => {
          const done = step > s.n;
          const active = step === s.n;
          return (
            <span
              key={s.n}
              style={{
                color: active ? '#0F172A' : done ? '#166534' : '#64748B',
              }}
            >
              {s.n} {s.label}
              {done ? ' ✓' : ''}
              {s.n < 4 ? ' ·' : ''}
            </span>
          );
        })}
      </nav>

      {err ? (
        <div role="alert" style={{ marginBottom: 10, color: '#B91C1C' }}>
          {err}{' '}
          {lookupsErr ? (
            <button type="button" className="btn-portal-outline" onClick={loadLookups}>
              {t('bb.retry')}
            </button>
          ) : null}
        </div>
      ) : null}
      {lookupsErr && !err ? (
        <div role="alert" style={{ marginBottom: 10, color: '#B91C1C' }}>
          {lookupsErr}{' '}
          <button type="button" className="btn-portal-outline" onClick={loadLookups}>
            {t('bb.retry')}
          </button>
        </div>
      ) : null}
      {info ? (
        <div role="status" style={{ marginBottom: 10, color: '#92400E' }}>
          {info}
        </div>
      ) : null}

      {step >= 3 && previewRows.length ? (
        <div className="cash-bank-stats" style={{ marginBottom: 12 }}>
          <div className="acct-kpi-card">
            <div className="cash-bank-stat-icon">
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <p className="acct-kpi-label">{t('imp.card.file')}</p>
              <p className="acct-kpi-value" style={{ fontSize: 14 }}>
                {fileName}
              </p>
              <p className="acct-kpi-meta">
                {t('imp.card.rows', { n: summary.count })}
              </p>
            </div>
          </div>
          <div className="acct-kpi-card">
            <div className="cash-bank-stat-icon">
              <CheckCircle2 size={22} />
            </div>
            <div>
              <p className="acct-kpi-label">{t('imp.card.valid')}</p>
              <p className="acct-kpi-value">{summary.valid}</p>
            </div>
          </div>
          <div className="acct-kpi-card">
            <div className="cash-bank-stat-icon">
              <AlertTriangle size={22} />
            </div>
            <div>
              <p className="acct-kpi-label">{t('imp.card.warnings')}</p>
              <p className="acct-kpi-value">{summary.warnings}</p>
            </div>
          </div>
          <div className="acct-kpi-card">
            <div className="cash-bank-stat-icon">
              <AlertTriangle size={22} />
            </div>
            <div>
              <p className="acct-kpi-label">{t('imp.card.errors')}</p>
              <p className="acct-kpi-value">{summary.errors}</p>
            </div>
          </div>
          <div className="acct-kpi-card">
            <div className="cash-bank-stat-icon">
              <Upload size={22} />
            </div>
            <div>
              <p className="acct-kpi-label">{t('imp.card.totalOut')}</p>
              <p className="acct-kpi-value">{summary.totalOut}</p>
            </div>
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <section className="acct-panel" style={{ padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>{t('imp.upload.title')}</h3>
          <p className="form-help-text">{t('imp.upload.help')}</p>
          <label style={{ display: 'block', marginBottom: 12 }}>
            <span className="form-help-text">{t('imp.upload.file')}</span>
            <input
              className="form-input"
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => parseFile(e.target.files?.[0])}
            />
          </label>
          <button
            type="button"
            className="btn-portal-outline"
            onClick={() => downloadImportTemplateCsv()}
          >
            {t('imp.downloadTemplate')}
          </button>
        </section>
      ) : null}

      {step === 2 || step === 3 ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
            gap: 16,
            marginBottom: 14,
          }}
          className="imp-map-grid"
        >
          <section className="acct-panel" style={{ padding: 14 }}>
            <h3 style={{ marginTop: 0, fontSize: 16 }}>
              {t('imp.map.title')}
            </h3>
            <WsTableScroll>
              <table className="ws-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th className="table-th">{t('imp.map.fileCol')}</th>
                    <th className="table-th">{t('imp.map.mapsTo')}</th>
                    <th className="table-th">{t('imp.map.sample')}</th>
                  </tr>
                </thead>
                <tbody>
                  {headers.map((h) => (
                    <tr key={h}>
                      <td className="table-cell">{h}</td>
                      <td className="table-cell">
                        <label style={{ display: 'block' }}>
                          <span className="sr-only">{t('imp.map.mapsTo')}</span>
                          <select
                            className="form-input"
                            disabled={step !== 2}
                            value={columnMap[h] || ''}
                            onChange={(e) =>
                              saveColumnMap({
                                ...columnMap,
                                [h]: e.target.value,
                              })
                            }
                          >
                            {IMPORT_TARGET_FIELDS.map((f) => (
                              <option key={f.id || 'skip'} value={f.id}>
                                {t(f.labelKey)}
                              </option>
                            ))}
                          </select>
                        </label>
                      </td>
                      <td className="table-cell" style={{ fontSize: 12 }}>
                        {mappingSample(
                          h,
                          columnMap[h],
                          firstDataSamples[h],
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </WsTableScroll>
          </section>
          <aside className="acct-panel" style={{ padding: 14 }}>
            <h3 style={{ marginTop: 0, fontSize: 16 }}>
              {t('imp.template.title')}
            </h3>
            <p style={{ fontSize: 12, wordBreak: 'break-word' }}>
              {IMPORT_TEMPLATE_COLUMNS.join(', ')}
            </p>
            <p className="form-help-text">{t('imp.template.help')}</p>
          </aside>
        </div>
      ) : null}

      {step === 2 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button
            type="button"
            className="btn-portal-outline"
            onClick={() => setStep(1)}
          >
            {t('imp.act.backUpload')}
          </button>
          <button
            type="button"
            className="btn-submit btn-dark"
            disabled={busy}
            onClick={goPreview}
          >
            {t('imp.act.toPreview')}
          </button>
        </div>
      ) : null}

      {step === 3 ? (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            {[
              ['all', 'bulk.chip.all', summary.count],
              ['errors', 'bulk.chip.errors', summary.errors],
              ['warnings', 'bulk.chip.warnings', summary.warnings],
              ['valid', 'bulk.chip.valid', summary.valid],
            ].map(([id, key, n]) => (
              <button
                key={id}
                type="button"
                style={chipStyle(chip === id, id)}
                onClick={() => {
                  setChip(id);
                  setPage(1);
                }}
              >
                {t(key, { n })}
              </button>
            ))}
          </div>

          <WsTableScroll>
            <table className="ws-table" style={{ width: '100%', minWidth: 960 }}>
              <thead>
                <tr>
                  <th className="table-th">#</th>
                  <th className="table-th">{t('bulk.col.status')}</th>
                  <th className="table-th">{t('bulk.col.type')}</th>
                  <th className="table-th">{t('bulk.col.date')}</th>
                  <th className="table-th">{t('bulk.col.party')}</th>
                  <th className="table-th">{t('bulk.col.account')}</th>
                  <th className="table-th">{t('bulk.col.payFrom')}</th>
                  <th className="table-th" style={{ textAlign: 'end' }}>
                    {t('br.th.amount')}
                  </th>
                  <th className="table-th">{t('imp.th.message')}</th>
                </tr>
              </thead>
              <tbody>
                {sliced.rows.map((r) => (
                  <tr key={r.clientRowId}>
                    <td className="table-cell">{r._lineNo}</td>
                    <td className="table-cell">{statusChip(r._state, t)}</td>
                    <td className="table-cell">
                      {t(`bulk.type.${r.type || 'payment'}`)}
                    </td>
                    <td className="table-cell">{r.date || '—'}</td>
                    <td className="table-cell">{r.payeeName || '—'}</td>
                    <td className="table-cell">
                      {r._accountLabel || r.accountId || '—'}
                    </td>
                    <td className="table-cell">
                      {r._payFromLabel ||
                        (r._transferToLabel
                          ? `${r._payFromLabel || '—'} → ${r._transferToLabel}`
                          : '—')}
                    </td>
                    <td className="table-cell" style={{ textAlign: 'end' }}>
                      {r.amount || r.debit || r.credit || '—'}
                    </td>
                    <td className="table-cell" style={{ fontSize: 12 }}>
                      {issueText(r, t)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </WsTableScroll>

          <p className="form-help-text" style={{ marginTop: 8 }}>
            {t('bb.showing', {
              a: sliced.from,
              b: sliced.to,
              n: sliced.total,
            })}
          </p>
          <PaginationControls
            total={sliced.total}
            limit={PAGE_SIZE}
            offset={(sliced.page - 1) * PAGE_SIZE}
            loading={busy}
            onPageChange={(offset) =>
              setPage(Math.floor(offset / PAGE_SIZE) + 1)
            }
          />

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              marginTop: 14,
            }}
          >
            <button
              type="button"
              className="btn-portal-outline"
              onClick={() => setStep(2)}
              disabled={busy}
            >
              {t('imp.act.backMap')}
            </button>
            {canWrite ? (
              <>
                <button
                  type="button"
                  className="btn-portal-outline"
                  disabled={busy || summary.valid + summary.warnings === 0}
                  onClick={() => createDraft('valid')}
                >
                  {t('imp.act.draftValid', {
                    n: summary.valid + summary.warnings,
                  })}
                </button>
                <button
                  type="button"
                  className="btn-submit btn-dark"
                  disabled={busy || !previewRows.length}
                  onClick={() => createDraft('all')}
                >
                  {t('imp.act.draftAll', { n: summary.count })}
                </button>
              </>
            ) : null}
          </div>
          <p className="form-help-text" style={{ marginTop: 8 }}>
            {t('imp.note.neverPosts')}
          </p>
        </>
      ) : null}

      <style>{`
        @media (max-width: 1100px) {
          .imp-map-grid { grid-template-columns: 1fr !important; }
        }
        .sr-only {
          position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
          overflow: hidden; clip: rect(0,0,0,0); border: 0;
        }
      `}</style>
    </div>
  );
}
