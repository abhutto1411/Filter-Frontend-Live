import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { getAccountsBranches, getPLReport } from '../../../services/accountsApi';
import SelectCombo from '../../SelectCombo';
import WsTableScroll from '../../workshop/WsTableScroll';
import WsTablePagination from '../../workshop/WsTablePagination';
import { usePagedRows } from '../../../hooks/usePagedRows';
import { accT } from '../../../utils/accountingI18n';
import {
  defaultInclusiveCoaCalendarRange,
  toInclusiveCalendarRange,
} from '../../../utils/riyadhBusinessRange';
import {
  formatBooksStartDisplay,
  newPlLoadCorrelation,
  plPageViewState,
  sanitizePlLoadError,
} from '../../../utils/accountingReportDisplay';
import { buildPlBranchTableModel } from '../../../utils/plBranchTableDisplay';
import ProfitLossIncVatView from './ProfitLossIncVatView';
import ProofAmount from './ProofAmount';
import { buildProofHref, proofColumnParam, shouldSyncReportUrl } from './reportProofLinks';
import {
  attachDetailProofKeys,
  buildPlDocumentBridgeRows,
  buildPlReconRows,
  buildPlStatementRows,
  plExportRows,
  showLegacyBackendHint,
  statementCellProofKey,
  withUnallocatedColumn,
} from './profitLossRows';
import SimpleProfitLossPanel from './SimpleProfitLossPanel';
import { detectPlChip, plChipRange } from './plPeriodChips';
import { downloadCsv } from '../../../utils/csvDownload';
import './ProfitLossSimple.css';

function plBranchFromLayout(selectedBranchId) {
  if (selectedBranchId == null || selectedBranchId === '' || selectedBranchId === 'all') {
    return '';
  }
  return String(selectedBranchId);
}

function readPlFiltersFromSearch(searchParams) {
  return {
    dateFrom: searchParams.get('dateFrom') || '',
    dateTo: searchParams.get('dateTo') || '',
    branchId: searchParams.get('branchId') || '',
    basis: searchParams.get('basis') === 'cash' ? 'cash' : searchParams.get('basis') === 'accrual' ? 'accrual' : '',
    compare: searchParams.get('compare') || '',
  };
}

/**
 * Standalone Profit & Loss (mockup K-2): summary statement first.
 */
export default function ProfitLossPage({ locale: localeProp, selectedBranchId = 'all' } = {}) {
  const locale =
    localeProp ||
    (typeof localStorage !== 'undefined'
      ? localStorage.getItem('portal-locale')
      : null) ||
    'en';
  const t = useCallback((key, vars) => accT(locale, key, vars), [locale]);
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlInit = useMemo(() => readPlFiltersFromSearch(searchParams), []);

  const initialRange = useMemo(() => defaultInclusiveCoaCalendarRange(), []);
  const [draftFrom, setDraftFrom] = useState(urlInit.dateFrom || initialRange.dateFrom);
  const [draftTo, setDraftTo] = useState(urlInit.dateTo || initialRange.dateTo);
  const [draftBranch, setDraftBranch] = useState(() =>
    urlInit.branchId || plBranchFromLayout(selectedBranchId),
  );
  const [draftBasis, setDraftBasis] = useState(urlInit.basis || 'accrual');
  const [draftCompare, setDraftCompare] = useState(urlInit.compare || '');

  const [appliedFrom, setAppliedFrom] = useState(urlInit.dateFrom || initialRange.dateFrom);
  const [appliedTo, setAppliedTo] = useState(urlInit.dateTo || initialRange.dateTo);
  const [appliedBranch, setAppliedBranch] = useState(() =>
    urlInit.branchId || plBranchFromLayout(selectedBranchId),
  );
  const [appliedBasis, setAppliedBasis] = useState(urlInit.basis || 'accrual');
  const [appliedCompare, setAppliedCompare] = useState(urlInit.compare || '');

  const [branches, setBranches] = useState([]);
  const [pl, setPl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [viewMode, setViewMode] = useState('simple');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [periodChip, setPeriodChip] = useState(() =>
    detectPlChip(urlInit.dateFrom || initialRange.dateFrom, urlInit.dateTo || initialRange.dateTo),
  );

  const skipLayoutBranchOnce = useRef(
    Boolean(urlInit.branchId || urlInit.dateFrom || urlInit.dateTo),
  );
  useEffect(() => {
    if (skipLayoutBranchOnce.current) {
      skipLayoutBranchOnce.current = false;
      return;
    }
    setDraftBranch(plBranchFromLayout(selectedBranchId));
    setAppliedBranch(plBranchFromLayout(selectedBranchId));
  }, [selectedBranchId]);

  useEffect(() => {
    if (!shouldSyncReportUrl(location.pathname, '/accounting/profit-loss')) return;
    const next = new URLSearchParams();
    if (appliedFrom) next.set('dateFrom', appliedFrom);
    if (appliedTo) next.set('dateTo', appliedTo);
    if (appliedBranch) next.set('branchId', appliedBranch);
    if (appliedBasis) next.set('basis', appliedBasis);
    if (appliedCompare) next.set('compare', appliedCompare);
    if (next.toString() === searchParams.toString()) return;
    setSearchParams(next, { replace: true });
  }, [appliedFrom, appliedTo, appliedBranch, appliedBasis, appliedCompare, location.pathname, searchParams, setSearchParams]);

  useEffect(() => {
    let cancelled = false;
    getAccountsBranches()
      .then((list) => {
        if (!cancelled) setBranches(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setBranches([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const cal = toInclusiveCalendarRange(appliedFrom, appliedTo);
      if (!cal.dateFrom || !cal.dateTo) {
        throw new Error(t('coa.err.rangeRequired'));
      }
      if (cal.dateFrom > cal.dateTo) {
        throw new Error(t('coa.err.range'));
      }
      const params = {
        dateFrom: cal.dateFrom,
        dateTo: cal.dateTo,
        basis: appliedBasis,
      };
      const combined = !appliedBranch;
      if (combined) {
        params.breakdown = 'branch';
      } else {
        params.branchIds = appliedBranch;
        params.branchId = appliedBranch;
        params.breakdown = 'branch';
      }
      if (appliedCompare) params.compare = appliedCompare;
      const res = await getPLReport(params);
      const root = res?.data && typeof res.data === 'object' && !Array.isArray(res.data)
        ? res.data
        : res;
      if (!root || typeof root !== 'object') {
        setPl(null);
        setErr(t('pl.loadFailed'));
        return;
      }
      setPl(root);
    } catch (e) {
      setPl(null);
      const corr = newPlLoadCorrelation();
      const sanitized = sanitizePlLoadError(e, t, corr);
      console.error('[ProfitLoss]', corr, e);
      setErr(sanitized.message);
    } finally {
      setLoading(false);
    }
  }, [appliedFrom, appliedTo, appliedBranch, appliedBasis, appliedCompare, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const showCombined = !appliedBranch;
  const selectedBranchMeta = branches.find((b) => String(b.id) === String(appliedBranch));
  const branchName = selectedBranchMeta?.name || t('report.pl.filter.branch');

  const statement = useMemo(
    () =>
      buildPlStatementRows(pl, {
        branchSelected: !showCombined,
        branchId: appliedBranch,
        compareMode: appliedCompare || null,
      }),
    [pl, showCombined, appliedBranch, appliedCompare],
  );

  const model = useMemo(() => {
    const base = buildPlBranchTableModel(pl, {
      showCombined,
      unassignedLabel: t('report.pl.unassigned'),
      combinedLabel: t('report.pl.combined'),
      incomeLabel: t('report.pl.section.income'),
      expensesLabel: t('report.pl.section.expenses'),
      netProfitLabel: t('report.pl.card.net'),
      cashCountDiffLabel: t('report.pl.row.cashCountDiff'),
    });
    return attachDetailProofKeys(
      withUnallocatedColumn(base, pl, {
        branchSelected: !showCombined,
        columnLabel: t('report.pl.col.unallocated'),
      }),
    );
  }, [pl, showCombined, t]);

  const proofFilters = useMemo(
    () => ({
      dateFrom: appliedFrom,
      dateTo: appliedTo,
      branchId: appliedBranch,
      basis: appliedBasis,
      compare: appliedCompare,
    }),
    [appliedFrom, appliedTo, appliedBranch, appliedBasis, appliedCompare],
  );
  const backHref = `${location.pathname}${location.search}`;

  function amountHref(proofKey, colKey) {
    if (!proofKey) return '';
    return buildProofHref({
      report: 'pl',
      key: proofKey,
      filters: proofFilters,
      column: proofColumnParam(colKey, { branchId: appliedBranch }),
      backHref,
    });
  }

  function renderProofCell(value, href, { unallocatedZeroAsDash } = {}) {
    if (value == null || value === '') return '';
    const dash = unallocatedZeroAsDash && (value === 0 || value === 0.0);
    return (
      <ProofAmount
        value={value}
        href={href}
        text={dash ? '—' : undefined}
        title={t('proof.view')}
        aria-label={t('proof.view')}
      />
    );
  }

  const incVat = pl?.incVatView && typeof pl.incVatView === 'object' ? pl.incVatView : null;
  const legacyHint = showLegacyBackendHint(pl);

  const { pagedRows, pagerProps } = usePagedRows(model.rows, {
    resetKey: `${appliedFrom}:${appliedTo}:${appliedBranch}:${appliedBasis}:${appliedCompare}:${model.rows.length}`,
  });

  const reconRows = useMemo(() => buildPlReconRows(pl), [pl]);
  const documentBridgeRows = useMemo(() => buildPlDocumentBridgeRows(pl), [pl]);
  const dryRunInvoices = Array.isArray(pl?.documentBridge?.dryRunInvoices)
    ? pl.documentBridge.dryRunInvoices
    : [];
  const dryRunReturns = Array.isArray(pl?.documentBridge?.dryRunReturns)
    ? pl.documentBridge.dryRunReturns
    : [];

  function onApply(e) {
    e?.preventDefault?.();
    const cal = toInclusiveCalendarRange(draftFrom, draftTo);
    if (!cal.dateFrom || !cal.dateTo) {
      setErr(t('coa.err.rangeRequired'));
      return;
    }
    if (cal.dateFrom > cal.dateTo) {
      setErr(t('coa.err.range'));
      return;
    }
    setErr('');
    setAppliedFrom(cal.dateFrom);
    setAppliedTo(cal.dateTo);
    setAppliedBranch(draftBranch);
    setAppliedBasis(draftBasis === 'cash' ? 'cash' : 'accrual');
    setAppliedCompare(draftCompare || '');
  }

  function onShowAll() {
    const r = defaultInclusiveCoaCalendarRange();
    const branchId = plBranchFromLayout(selectedBranchId);
    setDraftFrom(r.dateFrom);
    setDraftTo(r.dateTo);
    setDraftBranch(branchId);
    setDraftBasis('accrual');
    setDraftCompare('');
    setAppliedFrom(r.dateFrom);
    setAppliedTo(r.dateTo);
    setAppliedBranch(branchId);
    setAppliedBasis('accrual');
    setAppliedCompare('');
    setErr('');
  }

  function statementColHeader(col) {
    if (col.headerKind === 'branch' && appliedBranch) {
      return (
        <span title={branchName}>{t('report.pl.col.branchId', { id: appliedBranch })}</span>
      );
    }
    if (col.headerKind === 'named') return col.name;
    return t(col.nameKey);
  }

  function statementLabel(row) {
    if (row.leadKey) {
      return (
        <>
          <b>{t(row.leadKey)}</b>
          {t(row.restKey)}
        </>
      );
    }
    if (row.kind === 'tot' || row.kind === 'emphasis') {
      return <b>{t(row.labelKey)}</b>;
    }
    return t(row.labelKey);
  }

  function applyChip(chip) {
    setPeriodChip(chip);
    if (chip === 'custom') {
      setAdvancedOpen(true);
      return;
    }
    const r = plChipRange(chip);
    if (!r) return;
    setDraftFrom(r.dateFrom);
    setDraftTo(r.dateTo);
    setAppliedFrom(r.dateFrom);
    setAppliedTo(r.dateTo);
    setErr('');
  }

  return (
    <div className="ws-page" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <div style={{ marginBlockEnd: 8, fontSize: 13, color: '#64748B' }}>
        <Link to="/workshop/accounting/chart-of-accounts" style={{ color: '#64748B' }}>
          {t('coa.title')}
        </Link>
        {' / '}
        <Link to="/workshop/accounting/chart-of-accounts" style={{ color: '#64748B' }}>
          {t('report.breadcrumb')}
        </Link>
        {' / '}
        <span>{t('report.pl.title')}</span>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBlockEnd: 4,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 800,
            color: '#0F172A',
            fontFamily: locale === 'ar' ? 'Cairo, sans-serif' : 'Poppins, sans-serif',
          }}
        >
          {t('report.pl.title')}
        </h1>
        <button
          type="button"
          className="btn-portal-outline"
          disabled={!pl}
          onClick={() => {
            const rows = plExportRows(pl).map((r) => [
              t(`csv.${r.section}`),
              r.amount == null || r.amount === '' ? '' : String(r.amount),
            ]);
            const branchName =
              selectedBranchMeta?.name ||
              (appliedBranch ? String(appliedBranch) : t('csv.allBranches'));
            const fromDisp = formatBooksStartDisplay(appliedFrom);
            const toDisp = formatBooksStartDisplay(appliedTo);
            const generated = new Intl.DateTimeFormat('en-GB', {
              timeZone: 'Asia/Riyadh',
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            }).format(new Date());
            downloadCsv(
              `profit-loss-${appliedFrom || 'from'}-${appliedTo || 'to'}.csv`,
              [
                [t('csv.title'), ''],
                [t('csv.period'), `${fromDisp} – ${toDisp}`],
                [t('csv.branch'), branchName],
                [t('csv.basis'), String(pl?.basis || appliedBasis || '')],
                [t('csv.generatedAt'), generated],
              ],
              [t('report.pl.th.account'), t('report.pl.col.total')],
              rows,
            );
          }}
        >
          {t('proof.exportCsv')}
        </button>
      </div>
      <p style={{ margin: '0 0 14px', color: '#64748B', fontSize: 14 }}>
        {t('report.pl.simple.subtitle')}
      </p>

      <form
        onSubmit={onApply}
        className="acct-filter-bar"
        style={{
          background: '#fff',
          border: '1px solid #E5E7EB',
          borderRadius: 10,
          padding: 12,
          marginBlockEnd: 12,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'flex-end',
        }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
          <span>{t('report.pl.filter.branch')}</span>
          <SelectCombo
            size="sm"
            value={draftBranch}
            onChange={(e) => setDraftBranch(e.target.value)}
            aria-label={t('report.pl.filter.branch')}
            style={{ minWidth: 200 }}
          >
            <option value="">{t('report.pl.allBranches')}</option>
            {branches.map((b) => (
              <option key={b.id} value={String(b.id)}>
                {t('report.pl.branchOption', { id: b.id, name: b.name })}
              </option>
            ))}
          </SelectCombo>
        </label>
        <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
          <legend style={{ padding: 0, fontSize: 12, marginBottom: 4 }}>
            {t('report.pl.filter.period')}
          </legend>
          <div className="pl-simple-chips">
            {['today', 'yesterday', 'thisMonth', 'lastMonth', 'custom'].map((chip) => (
              <button
                key={chip}
                type="button"
                className={`pl-simple-chip ${periodChip === chip ? 'is-on' : ''}`}
                onClick={() => applyChip(chip)}
              >
                {t(`report.pl.chip.${chip}`)}
              </button>
            ))}
          </div>
        </fieldset>
        {periodChip === 'custom' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <input
              type="date"
              aria-label={t('coa.range.from')}
              value={String(draftFrom || '').slice(0, 10)}
              onChange={(e) => setDraftFrom(e.target.value)}
              style={{ paddingInline: 10, borderRadius: 8, border: '1px solid #E2E8F0' }}
            />
            <span aria-hidden="true">→</span>
            <input
              type="date"
              aria-label={t('coa.range.to')}
              value={String(draftTo || '').slice(0, 10)}
              onChange={(e) => setDraftTo(e.target.value)}
              style={{ paddingInline: 10, borderRadius: 8, border: '1px solid #E2E8F0' }}
            />
          </div>
        ) : null}
        <button type="submit" className="btn-submit btn-dark" disabled={loading}>
          {t('report.pl.simple.show')}
        </button>
        <button
          type="button"
          className="btn-portal-outline"
          onClick={() => setAdvancedOpen((v) => !v)}
        >
          {t('report.pl.simple.advanced')}
        </button>
        <button
          type="button"
          className="btn-portal-outline"
          onClick={() => setViewMode((v) => (v === 'simple' ? 'accountant' : 'simple'))}
        >
          {viewMode === 'simple'
            ? t('report.pl.simple.accountantView')
            : t('report.pl.simple.simpleView')}
        </button>
        {advancedOpen ? (
          <>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
              <span>{t('report.pl.filter.basis')}</span>
              <SelectCombo
                size="sm"
                value={draftBasis}
                onChange={(e) => setDraftBasis(e.target.value)}
                aria-label={t('report.pl.filter.basis')}
                style={{ minWidth: 140 }}
              >
                <option value="accrual">{t('report.pl.basis.accrual')}</option>
                <option value="cash">{t('report.pl.basis.cash')}</option>
              </SelectCombo>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
              <span>{t('report.pl.filter.compare')}</span>
              <SelectCombo
                size="sm"
                value={draftCompare}
                onChange={(e) => setDraftCompare(e.target.value)}
                aria-label={t('report.pl.filter.compare')}
                style={{ minWidth: 180 }}
              >
                <option value="">{t('report.pl.compare.none')}</option>
                <option value="previous_period">{t('report.pl.compare.previous_period')}</option>
                <option value="previous_year">{t('report.pl.compare.previous_year')}</option>
              </SelectCombo>
            </label>
            <button type="button" className="btn-portal-outline" onClick={onShowAll}>
              {t('periodClos.filter.showAll')}
            </button>
          </>
        ) : null}
      </form>

      {pl?.basisNote ? (
        <p style={{ fontSize: 12, color: '#64748B', marginBlockStart: 0, marginBlockEnd: 10 }}>
          {pl.basisNote}
        </p>
      ) : null}

      {plPageViewState({ loading, err, pl }) === 'error' ? (
        <div role="alert" style={{ color: '#B91C1C', marginBlockEnd: 12, fontSize: 13 }}>
          {err}{' '}
          <button type="button" className="btn-portal-outline" onClick={() => void load()}>
            {t('coa.retry')}
          </button>
        </div>
      ) : plPageViewState({ loading, err, pl }) === 'loading' ? (
        <div style={{ padding: 24, color: '#64748B' }}>{t('loading')}</div>
      ) : plPageViewState({ loading, err, pl }) === 'empty' ? (
        <div style={{ padding: 24, color: '#64748B' }}>{t('pl.empty')}</div>
      ) : viewMode === 'simple' ? (
        <SimpleProfitLossPanel
          pl={pl}
          t={t}
          locale={locale}
          proofFilters={proofFilters}
          backHref={backHref}
          appliedBranch={appliedBranch}
          amountHref={amountHref}
          onOpenMissingJournals={() => {
            setViewMode('accountant');
            setAdvancedOpen(true);
          }}
        />
      ) : (
        <>
          <p
            style={{
              margin: '0 0 10px',
              padding: '8px 12px',
              fontSize: 12,
              color: '#1D4ED8',
              background: '#EFF6FF',
              borderRadius: 8,
            }}
          >
            <b>{t('report.pl.exVatHeader')}</b>
          </p>
          {legacyHint ? (
            <p role="status" style={{ fontSize: 12, color: '#6B7280', margin: '0 0 10px' }}>
              {t('report.pl.legacyBackendHint')}
            </p>
          ) : null}
          {Array.isArray(pl?.basisWarnings) && pl.basisWarnings.includes('pl.beforeBooksStart') ? (
            <p role="status" style={{ fontSize: 12, color: '#92400E', margin: '0 0 10px' }}>
              {t('pl.beforeBooksStart', {
                date: formatBooksStartDisplay(pl.booksStartDate),
              })}
            </p>
          ) : null}

          <div
            style={{
              border: '1px solid #E2E8F0',
              borderRadius: 12,
              overflow: 'hidden',
              background: '#fff',
              marginBlockEnd: 12,
            }}
          >
            <WsTableScroll>
              <table className="ws-table" style={{ margin: 0, width: '100%', minWidth: 360 }}>
                <thead>
                  <tr>
                    <th className="table-th">{t('report.pl.th.account')}</th>
                    {statement.columns.map((col) => (
                      <th
                        key={col.key}
                        className="table-th"
                        style={{ textAlign: 'end', whiteSpace: 'nowrap' }}
                      >
                        {statementColHeader(col)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {statement.rows.map((row) => {
                    const isTot = row.kind === 'tot';
                    const isEmphasis = row.kind === 'emphasis';
                    const isNote = row.kind === 'note';
                    return (
                      <tr
                        key={row.key}
                        style={
                          isTot
                            ? { background: '#F8FAFC', fontWeight: 800 }
                            : isEmphasis
                              ? { fontWeight: 800 }
                              : undefined
                        }
                      >
                        <td
                          className="table-cell"
                          style={
                            isNote
                              ? { paddingInlineStart: 28, color: '#64748B', fontSize: 12 }
                              : undefined
                          }
                        >
                          {statementLabel(row)}
                        </td>
                        {statement.columns.map((col) => {
                          const v = row.amounts?.[col.key];
                          const dashZero = col.key === 'unallocated';
                          const proofKey = statementCellProofKey(row.key, col.key);
                          return (
                            <td
                              key={col.key}
                              className="table-cell"
                              style={{
                                textAlign: 'end',
                                color: isNote ? '#64748B' : undefined,
                                fontWeight: isTot ? 800 : undefined,
                              }}
                            >
                              {renderProofCell(v, amountHref(proofKey, col.key), {
                                unallocatedZeroAsDash: dashZero,
                              })}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </WsTableScroll>
            {statement.showUnallocated ? (
              <p style={{ margin: '8px 12px 12px', fontSize: 12, color: '#64748B' }}>
                {t('report.pl.unallocatedFootnote')}
              </p>
            ) : null}
          </div>

          {reconRows.length > 0 ? (
            <div
              style={{
                width: '100%',
                marginBlockEnd: 16,
                background: '#fff',
                border: '1px solid #E5E7EB',
                borderRadius: 10,
                padding: 16,
              }}
            >
              <h2 style={{ margin: '0 0 8px', fontSize: 14 }}>{t('pl.reconHeading')}</h2>
              <table className="ws-table" style={{ width: '100%', minWidth: 280 }}>
                <thead>
                  <tr>
                    <th className="table-th">{t('report.pl.recon.line')}</th>
                    <th className="table-th" style={{ textAlign: 'end' }}>
                      {t('report.pl.recon.sar')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {reconRows.map((row) => (
                    <tr
                      key={row.key}
                      style={
                        row.tot
                          ? { background: '#F8FAFC', fontWeight: 800 }
                          : undefined
                      }
                    >
                      <td className="table-cell">
                        {row.tot ? <b>{t(row.labelKey)}</b> : t(row.labelKey)}
                        {row.noteKey ? (
                          <div style={{ fontSize: 12, fontWeight: 400, color: '#64748B' }}>
                            {t(row.noteKey, row.noteVars || {})}
                          </div>
                        ) : null}
                      </td>
                      <td className="table-cell" style={{ textAlign: 'end', fontWeight: row.tot ? 800 : undefined }}>
                        {renderProofCell(row.value, amountHref(row.proofKey, 'total'))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {pl?.documentBridge?.error ? (
            <div
              role="alert"
              style={{
                width: '100%',
                marginBlockEnd: 16,
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: 10,
                padding: 16,
                color: '#991B1B',
              }}
            >
              {t('pl.bridge.loadFailed', { message: pl.documentBridge.error })}
            </div>
          ) : null}

          {documentBridgeRows.length > 0 ? (
            <div
              id="pl-document-bridge"
              style={{
                width: '100%',
                marginBlockEnd: 16,
                background: '#fff',
                border: '1px solid #E5E7EB',
                borderRadius: 10,
                padding: 16,
              }}
            >
              <h2 style={{ margin: '0 0 8px', fontSize: 14 }}>{t('pl.bridge.heading')}</h2>
              <p style={{ margin: '0 0 12px', fontSize: 12, color: '#64748B' }}>{t('pl.bridge.note')}</p>
              <table className="ws-table" style={{ width: '100%', minWidth: 280 }}>
                <thead>
                  <tr>
                    <th className="table-th">{t('report.pl.recon.line')}</th>
                    <th className="table-th" style={{ textAlign: 'end' }}>{t('report.pl.recon.sar')}</th>
                  </tr>
                </thead>
                <tbody>
                  {documentBridgeRows.map((row) => (
                    <tr
                      key={row.key}
                      style={row.tot ? { background: '#F8FAFC', fontWeight: 800 } : undefined}
                    >
                      <td className="table-cell">
                        {row.sign ? `${row.sign} ` : ''}
                        {row.tot ? <b>{t(row.labelKey)}</b> : t(row.labelKey)}
                        {row.noteKey ? (
                          <div style={{ fontSize: 12, fontWeight: 400, color: '#64748B' }}>
                            {t(row.noteKey, row.noteVars || {})}
                          </div>
                        ) : null}
                      </td>
                      <td className="table-cell" style={{ textAlign: 'end', fontWeight: row.tot ? 800 : undefined }}>
                        {Number(row.value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <details style={{ marginBlockStart: 12 }}>
                <summary style={{ cursor: 'pointer', fontWeight: 700 }}>
                  {t('pl.bridge.dryRun', { invoices: dryRunInvoices.length, returns: dryRunReturns.length })}
                </summary>
                <p style={{ fontSize: 12, color: '#64748B' }}>{t('pl.bridge.dryRunNote')}</p>
                <WsTableScroll>
                  <table className="ws-table" style={{ width: '100%', minWidth: 480 }}>
                    <thead>
                      <tr>
                        <th className="table-th">{t('pl.bridge.col.kind')}</th>
                        <th className="table-th">{t('pl.bridge.col.number')}</th>
                        <th className="table-th">{t('pl.bridge.col.branch')}</th>
                        <th className="table-th" style={{ textAlign: 'end' }}>{t('report.pl.recon.sar')}</th>
                        <th className="table-th">{t('pl.bridge.col.why')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dryRunInvoices.map((row) => (
                        <tr key={`inv-${row.id}`}>
                          <td className="table-cell">{t('pl.bridge.kind.invoice')}</td>
                          <td className="table-cell">{row.invoiceNo}</td>
                          <td className="table-cell">{row.branchName || t('emdash')}</td>
                          <td className="table-cell" style={{ textAlign: 'end' }}>
                            {Number(row.exVat || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="table-cell">{row.why}</td>
                        </tr>
                      ))}
                      {dryRunReturns.map((row) => (
                        <tr key={`ret-${row.id}`}>
                          <td className="table-cell">{t('pl.bridge.kind.return')}</td>
                          <td className="table-cell">{row.returnNo}</td>
                          <td className="table-cell">{row.branchName || t('emdash')}</td>
                          <td className="table-cell" style={{ textAlign: 'end' }}>
                            {Number(row.exVat || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="table-cell">{row.why}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </WsTableScroll>
              </details>
            </div>
          ) : null}

          <ProfitLossIncVatView
            incVatView={incVat}
            pl={pl}
            t={t}
            filters={proofFilters}
            backHref={backHref}
          />

          <details style={{ marginBlockStart: 16, marginBlockEnd: 16 }}>
            <summary style={{ cursor: 'pointer', fontWeight: 700, marginBlockEnd: 8 }}>
              {t('report.pl.accountDetail')}
            </summary>
            <div
              style={{
                border: '1px solid #E2E8F0',
                borderRadius: 12,
                overflow: 'hidden',
                background: '#fff',
              }}
            >
              {model.showUnallocated ? (
                <p style={{ margin: '8px 12px', fontSize: 12, color: '#64748B' }}>
                  {t('report.pl.unallocatedFootnote')}
                </p>
              ) : null}
              <WsTableScroll>
                <table className="ws-table" style={{ margin: 0, width: '100%', minWidth: 480 }}>
                  <thead>
                    <tr>
                      <th className="table-th">{t('report.pl.th.account')}</th>
                      {model.columns.map((col) => (
                        <th
                          key={col.key}
                          className="table-th"
                          style={{ textAlign: 'end', whiteSpace: 'nowrap' }}
                        >
                          {col.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pagedRows.length === 0 ? (
                      <tr>
                        <td
                          className="table-cell"
                          colSpan={1 + model.columns.length}
                          style={{ textAlign: 'center', padding: 24, color: '#64748B' }}
                        >
                          {t('pl.empty')}
                        </td>
                      </tr>
                    ) : (
                      pagedRows.map((row) => {
                        const isSection = row.kind === 'section';
                        const isNet = row.kind === 'net';
                        return (
                          <tr
                            key={row.key}
                            style={
                              isSection
                                ? { background: '#F8FAFC', fontWeight: 800 }
                                : isNet
                                  ? { fontWeight: 800 }
                                  : undefined
                            }
                          >
                            <td className="table-cell">{row.label}</td>
                            {model.columns.map((col) => {
                              const v = row.amounts?.[col.key];
                              const proofKey =
                                col.key === '__unallocated' && row.kind === 'net'
                                  ? 'pl.unallocated.netIncome'
                                  : row.proofKey;
                              return (
                                <td
                                  key={col.key}
                                  className="table-cell"
                                  style={{ textAlign: 'end' }}
                                >
                                  {isSection || v == null || v === ''
                                    ? ''
                                    : renderProofCell(v, amountHref(proofKey, col.key))}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </WsTableScroll>
              <WsTablePagination {...pagerProps} />
            </div>
          </details>
        </>
      )}
    </div>
  );
}
