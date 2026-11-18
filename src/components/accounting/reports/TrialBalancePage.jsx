import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { getAccountsBranches, getTrialBalance } from '../../../services/accountsApi';
import SelectCombo from '../../SelectCombo';
import WsTableScroll from '../../workshop/WsTableScroll';
import WsTablePagination from '../../workshop/WsTablePagination';
import { usePagedRows } from '../../../hooks/usePagedRows';
import { accT, listMissingBsTbFields, pickTbUnallocatedBalance, reportRowFlags } from '../../../utils/accountingI18n';
import { defaultTbBsReportDates, toInclusiveCalendarRange } from '../../../utils/riyadhBusinessRange';
import {
  isLegacyHeadingDirectRow,
  isReportRangeInvalidError,
  TB_PERIOD_TOTAL_FIELDS,
  trialBalanceColumnTotals,
  trialBalanceHasPeriodColumns,
} from '../../../utils/accountingReportDisplay';
import { formatAccountingNumber } from '../../../utils/plBranchTableDisplay';
import ReportSummaryCards from './ReportSummaryCards';
import ProofAmount from './ProofAmount';
import { buildProofHref, proofColumnParam, shouldSyncReportUrl } from './reportProofLinks';
import {
  TB_DIFFERENCE,
  TB_TOTAL_CREDIT,
  TB_TOTAL_DEBIT,
  tbRowProofKeys,
  tbTotalsProofKeys,
  tbUnallocatedColumn,
  tbUnallocatedProofKeys,
} from './tbBsProofKeys';

function plBranchFromLayout(selectedBranchId) {
  if (selectedBranchId == null || selectedBranchId === '' || selectedBranchId === 'all') {
    return '';
  }
  return String(selectedBranchId);
}

function unwrapReport(res) {
  const root = res?.data && typeof res.data === 'object' && !Array.isArray(res.data) ? res.data : res;
  return root && typeof root === 'object' ? root : null;
}

function fmtSar(n, t) {
  if (n == null || n === '') return t('money.dash');
  return t('money.sar', { n: formatAccountingNumber(n) });
}

function readTbFiltersFromSearch(searchParams) {
  return {
    dateFrom: searchParams.get('dateFrom') || '',
    dateTo: searchParams.get('dateTo') || '',
    branchId: searchParams.get('branchId') || '',
    showAll: searchParams.get('showAll') === '1',
  };
}

function RowTags({ row, t }) {
  const flags = reportRowFlags(row);
  if (!flags.inactive && !flags.shownBecauseBalance) return null;
  return (
    <span style={{ marginInlineStart: 8, display: 'inline-flex', gap: 6, alignItems: 'center' }}>
      {flags.inactive ? (
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: '1px 6px',
            borderRadius: 999,
            background: '#F1F5F9',
            color: '#475569',
          }}
        >
          {t('report.bstb.inactive')}
        </span>
      ) : null}
      {flags.shownBecauseBalance ? (
        <span style={{ fontSize: 11, color: '#64748B' }}>{t('report.bstb.shownBecauseBalance')}</span>
      ) : null}
    </span>
  );
}

/**
 * Standalone Trial Balance (mockup K-4): Unallocated / HQ row + inactive tags.
 */
export default function TrialBalancePage({ locale: localeProp, selectedBranchId = 'all' } = {}) {
  const locale =
    localeProp ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
    'en';
  const t = useCallback((key, vars) => accT(locale, key, vars), [locale]);
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlInit = useMemo(() => readTbFiltersFromSearch(searchParams), []);

  const initial = useMemo(() => defaultTbBsReportDates(), []);
  const [draftFrom, setDraftFrom] = useState(urlInit.dateFrom || initial.tb.dateFrom);
  const [draftTo, setDraftTo] = useState(urlInit.dateTo || initial.tb.dateTo);
  const [draftBranch, setDraftBranch] = useState(() =>
    urlInit.branchId || plBranchFromLayout(selectedBranchId),
  );
  const [appliedFrom, setAppliedFrom] = useState(urlInit.dateFrom || initial.tb.dateFrom);
  const [appliedTo, setAppliedTo] = useState(urlInit.dateTo || initial.tb.dateTo);
  const [appliedBranch, setAppliedBranch] = useState(() =>
    urlInit.branchId || plBranchFromLayout(selectedBranchId),
  );
  const [showAll, setShowAll] = useState(Boolean(urlInit.showAll));
  const [branches, setBranches] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

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
    if (!shouldSyncReportUrl(location.pathname, '/accounting/trial-balance')) return;
    const next = new URLSearchParams();
    if (appliedFrom) next.set('dateFrom', appliedFrom);
    if (appliedTo) next.set('dateTo', appliedTo);
    if (appliedBranch) next.set('branchId', appliedBranch);
    if (showAll) next.set('showAll', '1');
    if (next.toString() === searchParams.toString()) return;
    setSearchParams(next, { replace: true });
  }, [appliedFrom, appliedTo, appliedBranch, showAll, location.pathname, searchParams, setSearchParams]);

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
      if (!cal.dateFrom || !cal.dateTo) throw new Error(t('coa.err.rangeRequired'));
      if (cal.dateFrom > cal.dateTo) throw new Error(t('coa.err.range'));
      const params = { dateFrom: cal.dateFrom, dateTo: cal.dateTo };
      if (appliedBranch) params.branchId = appliedBranch;
      const root = unwrapReport(await getTrialBalance(params));
      if (!root) {
        setReport(null);
        setErr(t('tb.err.load'));
        return;
      }
      setReport(root);
    } catch (e) {
      setReport(null);
      setErr(
        isReportRangeInvalidError(e) ? t('pl.rangeInvalid') : e?.message || t('tb.err.load'),
      );
    } finally {
      setLoading(false);
    }
  }, [appliedFrom, appliedTo, appliedBranch, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const branchSelected = Boolean(appliedBranch);
  const badge = pickTbUnallocatedBalance(report, { branchSelected });
  const missing = listMissingBsTbFields(report, { kind: 'tb', branchSelected });
  const unallocated = report?.unallocated && typeof report.unallocated === 'object' ? report.unallocated : null;
  const allRows = Array.isArray(report?.accounts) ? report.accounts : [];
  const hasPeriodCols = trialBalanceHasPeriodColumns(allRows);
  const colTotals = trialBalanceColumnTotals(report);
  const { pagedRows, pagerProps } = usePagedRows(allRows, {
    resetKey: `${appliedFrom}:${appliedTo}:${appliedBranch}:${allRows.length}`,
  });

  const proofFilters = useMemo(
    () => ({
      dateFrom: appliedFrom,
      dateTo: appliedTo,
      branchId: appliedBranch,
    }),
    [appliedFrom, appliedTo, appliedBranch],
  );
  const backHref = `${location.pathname}${location.search}`;

  function amountHref(proofKey, column) {
    if (!proofKey) return '';
    return buildProofHref({
      report: 'tb',
      key: proofKey,
      filters: proofFilters,
      column: column || proofColumnParam('total', { branchId: appliedBranch }),
      backHref,
    });
  }

  function renderProof(value, href) {
    if (value == null || value === '') return t('money.dash');
    return (
      <ProofAmount
        value={value}
        href={href}
        text={fmtSar(value, t)}
        title={t('proof.view')}
        aria-label={t('proof.view')}
      />
    );
  }

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
    setShowAll(false);
    setAppliedFrom(cal.dateFrom);
    setAppliedTo(cal.dateTo);
    setAppliedBranch(draftBranch);
  }

  function onShowAll() {
    const d = defaultTbBsReportDates();
    const branchId = plBranchFromLayout(selectedBranchId);
    setDraftFrom(d.tb.dateFrom);
    setDraftTo(d.tb.dateTo);
    setDraftBranch(branchId);
    setAppliedFrom(d.tb.dateFrom);
    setAppliedTo(d.tb.dateTo);
    setAppliedBranch(branchId);
    setShowAll(true);
    setErr('');
  }

  const footerKeys = tbTotalsProofKeys();
  const unallocKeys = tbUnallocatedProofKeys();

  return (
    <div className="ws-page" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <div style={{ marginBlockEnd: 8, fontSize: 13, color: '#64748B' }}>
        <Link to="/workshop/accounting/chart-of-accounts" style={{ color: '#64748B' }}>
          {t('coa.title')}
        </Link>
        {' / '}
        <span>{t('report.breadcrumb')}</span>
        {' / '}
        <span>{t('report.tb.title')}</span>
      </div>
      <h1 style={{ margin: '0 0 14px', fontSize: 22, fontWeight: 800, color: '#0F172A' }}>
        {t('report.tb.title')}
      </h1>

      <form
        onSubmit={onApply}
        className="acct-filter-bar"
        style={{
          background: '#fff',
          border: '1px solid #E5E7EB',
          borderRadius: 10,
          padding: 12,
          marginBlockEnd: 12,
        }}
      >
        <fieldset
          style={{
            border: 0,
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            fontSize: 12,
          }}
        >
          <legend style={{ padding: 0, fontSize: 12 }}>{t('report.pl.filter.period')}</legend>
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
        </fieldset>
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
            {branches.map((br) => (
              <option key={br.id} value={String(br.id)}>
                {br.name}
              </option>
            ))}
          </SelectCombo>
        </label>
        <button type="submit" className="btn-submit btn-dark" disabled={loading}>
          {t('date.apply')}
        </button>
        <button type="button" className="btn-portal-outline" disabled={loading} onClick={onShowAll}>
          {t('periodClos.filter.showAll')}
        </button>
      </form>

      {err ? (
        <div role="alert" style={{ color: '#B91C1C', marginBlockEnd: 12, fontSize: 13 }}>
          {err}{' '}
          <button type="button" className="btn-portal-outline" onClick={() => void load()}>
            {t('coa.retry')}
          </button>
        </div>
      ) : null}

      {missing.length > 0 ? (
        <p role="status" style={{ fontSize: 12, color: '#B45309', margin: '0 0 10px' }}>
          {t('report.bstb.needsBackend', { fields: missing.join(', ') })}
        </p>
      ) : null}

      {loading ? (
        <div style={{ padding: 24, color: '#64748B' }}>{t('loading')}</div>
      ) : !report ? (
        <div style={{ padding: 24, color: '#64748B' }}>{t('tb.empty')}</div>
      ) : (
        <>
          <ReportSummaryCards
            items={[
              { key: 'leaf', label: t('report.tb.card.leaf'), value: String(allRows.filter((r) => !r.isHeading).length) },
              {
                key: 'debit',
                label: t('report.tb.card.debit'),
                value: renderProof(report.totalDebits, amountHref(TB_TOTAL_DEBIT)),
              },
              {
                key: 'credit',
                label: t('report.tb.card.credit'),
                value: renderProof(report.totalCredits, amountHref(TB_TOTAL_CREDIT)),
              },
              {
                key: 'diff',
                label: t('report.tb.card.diff'),
                tone: badge.isBalanced ? 'ok' : 'bad',
                value: (
                  <ProofAmount
                    value={report.difference}
                    href={amountHref(TB_DIFFERENCE)}
                    text={
                      badge.isBalanced
                        ? t('report.tb.diffOk')
                        : formatAccountingNumber(report.difference)
                    }
                    title={t('proof.view')}
                    aria-label={t('proof.view')}
                  />
                ),
              },
            ]}
          />

          <div
            style={{
              border: '1px solid #E2E8F0',
              borderRadius: 12,
              overflow: 'hidden',
              background: '#fff',
              marginBlockStart: 12,
            }}
          >
            <WsTableScroll>
              <table className="ws-table" style={{ margin: 0, width: '100%', minWidth: 480 }}>
                <thead>
                  {hasPeriodCols ? (
                    <>
                      <tr>
                        <th rowSpan={2} className="table-th">{t('tb.th.code')}</th>
                        <th rowSpan={2} className="table-th">{t('tb.th.name')}</th>
                        <th colSpan={2} className="table-th" style={{ textAlign: 'center' }}>{t('tb.th.opening')}</th>
                        <th colSpan={2} className="table-th" style={{ textAlign: 'center' }}>{t('tb.th.period')}</th>
                        <th colSpan={2} className="table-th" style={{ textAlign: 'center' }}>{t('tb.th.closing')}</th>
                      </tr>
                      <tr>
                        {[t('tb.th.dr'), t('tb.th.cr'), t('tb.th.periodDebit'), t('tb.th.periodCredit'), t('tb.th.dr'), t('tb.th.cr')].map((h, i) => (
                          <th key={`${h}-${i}`} className="table-th" style={{ textAlign: 'end' }}>{h}</th>
                        ))}
                      </tr>
                    </>
                  ) : (
                    <tr>
                      <th className="table-th">{t('tb.th.code')}</th>
                      <th className="table-th">{t('tb.th.name')}</th>
                      <th className="table-th" style={{ textAlign: 'end' }}>{t('tb.th.debit')}</th>
                      <th className="table-th" style={{ textAlign: 'end' }}>{t('tb.th.credit')}</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {pagedRows.length === 0 ? (
                    <tr>
                      <td className="table-cell" colSpan={hasPeriodCols ? 8 : 4} style={{ textAlign: 'center', padding: 24, color: '#64748B' }}>
                        {t('tb.empty')}
                      </td>
                    </tr>
                  ) : (
                    pagedRows.map((a) => {
                      const heading = Boolean(a.isHeading);
                      const legacy = isLegacyHeadingDirectRow(a);
                      const keys = tbRowProofKeys(a);
                      return (
                        <tr key={a.id || `${a.code}-${a.name}`} style={{ background: heading ? '#F8FAFC' : undefined }}>
                          <td className="table-cell">{a.code}</td>
                          <td className="table-cell">
                            <span style={{ fontWeight: heading ? 700 : 400 }}>{a.name}</span>
                            {heading ? (
                              <span style={{ marginInlineStart: 8, fontSize: 11, color: '#94a3b8' }}>
                                {t('tb.headingLabel')}
                              </span>
                            ) : null}
                            {legacy ? (
                              <div style={{ fontSize: 11, color: '#94a3b8' }}>{t('tb.legacyNote')}</div>
                            ) : null}
                            <RowTags row={a} t={t} />
                          </td>
                          {hasPeriodCols ? (
                            <>
                              <td className="table-cell" style={{ textAlign: 'end' }}>{renderProof(a.openingDebit, amountHref(keys.opening))}</td>
                              <td className="table-cell" style={{ textAlign: 'end' }}>{renderProof(a.openingCredit, amountHref(keys.opening))}</td>
                              <td className="table-cell" style={{ textAlign: 'end' }}>{renderProof(a.periodDebit, amountHref(keys.debit))}</td>
                              <td className="table-cell" style={{ textAlign: 'end' }}>{renderProof(a.periodCredit, amountHref(keys.credit))}</td>
                              <td className="table-cell" style={{ textAlign: 'end' }}>{renderProof(a.closingDebit, amountHref(keys.closing))}</td>
                              <td className="table-cell" style={{ textAlign: 'end' }}>{renderProof(a.closingCredit, amountHref(keys.closing))}</td>
                            </>
                          ) : (
                            <>
                              <td className="table-cell" style={{ textAlign: 'end' }}>{renderProof(a.debitBalance, amountHref(keys.closing))}</td>
                              <td className="table-cell" style={{ textAlign: 'end' }}>{renderProof(a.creditBalance, amountHref(keys.closing))}</td>
                            </>
                          )}
                        </tr>
                      );
                    })
                  )}
                  {branchSelected && unallocated ? (
                    <tr style={{ background: '#FEF3C7', fontWeight: 700 }}>
                      <td className="table-cell" colSpan={2}>{t('report.bstb.unallocatedRow')}</td>
                      {hasPeriodCols ? (
                        <>
                          <td className="table-cell" style={{ textAlign: 'end' }}>{t('money.dash')}</td>
                          <td className="table-cell" style={{ textAlign: 'end' }}>{t('money.dash')}</td>
                          <td className="table-cell" style={{ textAlign: 'end' }}>
                            {renderProof(unallocated.periodDebit, amountHref(unallocKeys.periodDebit, tbUnallocatedColumn()))}
                          </td>
                          <td className="table-cell" style={{ textAlign: 'end' }}>
                            {renderProof(unallocated.periodCredit, amountHref(unallocKeys.periodCredit, tbUnallocatedColumn()))}
                          </td>
                          <td className="table-cell" style={{ textAlign: 'end' }}>
                            {renderProof(unallocated.closingDebit, amountHref(unallocKeys.closingDebit, tbUnallocatedColumn()))}
                          </td>
                          <td className="table-cell" style={{ textAlign: 'end' }}>
                            {renderProof(unallocated.closingCredit, amountHref(unallocKeys.closingCredit, tbUnallocatedColumn()))}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="table-cell" style={{ textAlign: 'end' }}>
                            {renderProof(unallocated.periodDebit, amountHref(unallocKeys.periodDebit, tbUnallocatedColumn()))}
                          </td>
                          <td className="table-cell" style={{ textAlign: 'end' }}>
                            {renderProof(unallocated.periodCredit, amountHref(unallocKeys.periodCredit, tbUnallocatedColumn()))}
                          </td>
                        </>
                      )}
                    </tr>
                  ) : null}
                  {hasPeriodCols ? (
                    <tr>
                      <td className="table-cell" colSpan={2} style={{ fontWeight: 800 }}>{t('tb.totals')}</td>
                      {TB_PERIOD_TOTAL_FIELDS.map((k) => (
                        <td key={k} className="table-cell" style={{ textAlign: 'end', fontWeight: 800 }}>
                          {renderProof(colTotals[k], amountHref(footerKeys[k]))}
                        </td>
                      ))}
                    </tr>
                  ) : (
                    <tr>
                      <td className="table-cell" colSpan={2} style={{ fontWeight: 800 }}>{t('tb.totals')}</td>
                      <td className="table-cell" style={{ textAlign: 'end', fontWeight: 800 }}>
                        {renderProof(report.totalDebits, amountHref(footerKeys.totalDebits))}
                      </td>
                      <td className="table-cell" style={{ textAlign: 'end', fontWeight: 800 }}>
                        {renderProof(report.totalCredits, amountHref(footerKeys.totalCredits))}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </WsTableScroll>
            <WsTablePagination {...pagerProps} />
          </div>
        </>
      )}
    </div>
  );
}
