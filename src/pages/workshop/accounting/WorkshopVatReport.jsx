import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  getWorkshopVatReport,
  getWorkshopVatReturnSummary,
  lookupAccountingBranches,
} from '../../../services/workshopAccountingApi';
import {
  exportVatReportExcel,
  exportVatReportPdf,
} from '../../../utils/supplierLedgerExport';
import { accT } from '../../../utils/accountingI18n';
import { toRiyadhDateISO } from '../../../utils/riyadhBusinessRange';
import {
  buildVatReturnViewModel,
  defaultVatQuarterValue,
  formatVatLatn,
  formatVatSar,
  listVatQuarterOptions,
  splitVatDetailRows,
} from '../../../utils/vatReturnDisplay';
import SelectCombo from '../../../components/SelectCombo';
import WsTableScroll from '../../../components/workshop/WsTableScroll';
import WsTablePagination from '../../../components/workshop/WsTablePagination';
import { usePagedRows } from '../../../hooks/usePagedRows';
import ReportSummaryCards from '../../../components/accounting/reports/ReportSummaryCards';

/**
 * VAT return (mockup 11 / P-A26B). Replaces old VAT Calculation list-only UI.
 */
export default function WorkshopVatReport({ locale: localeProp } = {}) {
  const locale =
    localeProp ||
    (typeof localStorage !== 'undefined'
      ? localStorage.getItem('portal-locale')
      : null) ||
    'en';
  const t = useCallback((key, vars) => accT(locale, key, vars), [locale]);

  const asOf = useMemo(() => toRiyadhDateISO() || new Date().toISOString().slice(0, 10), []);
  const quarterOptions = useMemo(() => listVatQuarterOptions(asOf), [asOf]);

  const [draftQuarter, setDraftQuarter] = useState(
    () => defaultVatQuarterValue(asOf),
  );
  const [draftBranch, setDraftBranch] = useState('');
  const [appliedQuarter, setAppliedQuarter] = useState(
    () => defaultVatQuarterValue(asOf),
  );
  const [appliedBranch, setAppliedBranch] = useState('');

  const [tab, setTab] = useState('summary'); // summary | output | input
  const [branches, setBranches] = useState([]);
  const [rowReport, setRowReport] = useState(null);
  const [summary, setSummary] = useState(null);
  const [summaryUnavailable, setSummaryUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const appliedRange = useMemo(() => {
    const q = quarterOptions.find((o) => o.value === appliedQuarter);
    return {
      from: q?.fromYmd || '',
      to: q?.toYmd || '',
    };
  }, [quarterOptions, appliedQuarter]);

  useEffect(() => {
    let cancelled = false;
    lookupAccountingBranches({ limit: 50 })
      .then((res) => {
        if (cancelled) return;
        const root = res?.data && typeof res.data === 'object' ? res.data : res;
        const list = root?.branches || root?.items || root || [];
        setBranches(Array.isArray(list) ? list : []);
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
    setSummaryUnavailable(false);
    try {
      const q = quarterOptions.find((o) => o.value === appliedQuarter);
      const dateFrom = q?.fromYmd;
      const dateTo = q?.toYmd;
      if (!dateFrom || !dateTo) {
        throw new Error(t('coa.err.rangeRequired'));
      }
      const rowParams = {
        dateFrom,
        dateTo,
        ...(appliedBranch ? { branchId: appliedBranch } : {}),
      };
      const summaryParams = {
        quarter: appliedQuarter,
        ...(appliedBranch ? { branchId: appliedBranch } : {}),
      };

      const [rowRes, sumOutcome] = await Promise.all([
        getWorkshopVatReport(rowParams).catch((e) => {
          throw e;
        }),
        getWorkshopVatReturnSummary(summaryParams)
          .then((r) => ({ ok: true, r }))
          .catch((e) => ({ ok: false, e })),
      ]);

      const rowRoot =
        rowRes?.data && typeof rowRes.data === 'object' ? rowRes.data : rowRes;
      setRowReport(rowRoot || null);

      if (sumOutcome.ok) {
        const s =
          sumOutcome.r?.data && typeof sumOutcome.r.data === 'object'
            ? sumOutcome.r.data
            : sumOutcome.r;
        setSummary(s || null);
      } else {
        setSummary(null);
        setSummaryUnavailable(true);
      }
    } catch (e) {
      setRowReport(null);
      setSummary(null);
      setErr(e?.message || t('vatReturn.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [appliedQuarter, appliedBranch, quarterOptions, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const model = useMemo(
    () => buildVatReturnViewModel({ summary, rowReport }),
    [summary, rowReport],
  );

  const detail = useMemo(
    () => splitVatDetailRows(rowReport?.rows),
    [rowReport],
  );

  const tableRows = useMemo(() => {
    if (tab === 'summary') return model.boxes;
    if (tab === 'output') return detail.output;
    return detail.input;
  }, [tab, model.boxes, detail]);

  const { pagedRows, pagerProps } = usePagedRows(tableRows, {
    resetKey: `${tab}:${appliedQuarter}:${appliedBranch}:${tableRows.length}`,
  });

  function onApply(e) {
    e?.preventDefault?.();
    setAppliedQuarter(draftQuarter);
    setAppliedBranch(draftBranch);
  }

  function onShowAll() {
    const q = defaultVatQuarterValue(asOf);
    setDraftQuarter(q);
    setDraftBranch('');
    setAppliedQuarter(q);
    setAppliedBranch('');
    setTab('summary');
  }

  function onExportPdf() {
    if (!rowReport) return;
    exportVatReportPdf({
      header: rowReport.header,
      openingPayable: rowReport.openingPayable,
      rows: rowReport.rows ?? [],
      totals: rowReport.totals,
      vatPayableAccount: rowReport.vatPayableAccount,
    });
  }

  function onExportExcel() {
    if (!rowReport) return;
    exportVatReportExcel({
      header: rowReport.header,
      openingPayable: rowReport.openingPayable,
      rows: rowReport.rows ?? [],
      totals: rowReport.totals,
      vatPayableAccount: rowReport.vatPayableAccount,
    });
  }

  const cards = model.cards;
  const billsLabel =
    cards.billsWithoutVatNo == null
      ? t('vatReturn.card.billsNeedsBe')
      : t('vatReturn.card.billsMeta', {
          n: formatVatLatn(cards.billsWithoutVatNo, { fractionDigits: 0 }),
        });

  return (
    <div className="ws-page" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBlockEnd: 8,
        }}
      >
        <div>
          <div style={{ fontSize: 13, color: '#64748B', marginBlockEnd: 6 }}>
            <Link to="/workshop/accounting/chart-of-accounts" style={{ color: '#64748B' }}>
              {t('report.breadcrumb')}
            </Link>
            {' / '}
            <span>{t('vatReturn.title')}</span>
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 800,
              color: '#0F172A',
            }}
          >
            {t('vatReturn.title')}
          </h1>
        </div>
        <div style={{ display: 'inline-flex', gap: 8 }}>
          <button
            type="button"
            className="btn-portal-outline"
            onClick={onExportPdf}
            disabled={!rowReport || loading}
            aria-label={t('vatReturn.exportPdf')}
            title={t('vatReturn.exportPdf')}
          >
            <FileText size={14} aria-hidden />
          </button>
          <button
            type="button"
            className="btn-portal-outline"
            onClick={onExportExcel}
            disabled={!rowReport || loading}
            aria-label={t('vatReturn.exportExcel')}
            title={t('vatReturn.exportExcel')}
          >
            <FileSpreadsheet size={14} aria-hidden />
          </button>
        </div>
      </div>

      <form
        onSubmit={onApply}
        className="acct-filter-bar"
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
          <span>{t('vatReturn.filter.quarter')}</span>
          <SelectCombo
            size="sm"
            value={draftQuarter}
            onChange={(e) => setDraftQuarter(e.target.value)}
            aria-label={t('vatReturn.filter.quarter')}
            style={{ minWidth: 220 }}
          >
            {quarterOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </SelectCombo>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
          <span>{t('vatReturn.filter.branch')}</span>
          <SelectCombo
            size="sm"
            value={draftBranch}
            onChange={(e) => setDraftBranch(e.target.value)}
            aria-label={t('vatReturn.filter.branch')}
            style={{ minWidth: 180 }}
          >
            <option value="">{t('vatReturn.branchCombined')}</option>
            {branches.map((b) => (
              <option key={b.id || b.branchId} value={String(b.id || b.branchId)}>
                {b.name || b.label || b.id}
              </option>
            ))}
          </SelectCombo>
        </label>
        <button type="submit" className="btn-submit btn-dark" disabled={loading}>
          {t('date.apply')}
        </button>
        <button
          type="button"
          className="btn-portal-outline"
          disabled={loading}
          onClick={onShowAll}
        >
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

      {(summaryUnavailable || model.boxMappingNote) && !err ? (
        <p role="status" style={{ fontSize: 12, color: '#B45309', marginBlockEnd: 10 }}>
          {t('vatReturn.boxMappingNote')}
        </p>
      ) : null}

      <ReportSummaryCards
        items={[
          {
            key: 'out',
            label: t('vatReturn.card.output'),
            value:
              cards.outputVat == null ? t('report.emDash') : formatVatSar(cards.outputVat),
          },
          {
            key: 'in',
            label: t('vatReturn.card.input'),
            value:
              cards.inputVat == null ? t('report.emDash') : formatVatSar(cards.inputVat),
          },
          {
            key: 'net',
            label: t('vatReturn.card.net'),
            tone: Number(cards.netPayable) >= 0 ? 'ok' : 'bad',
            value:
              cards.netPayable == null
                ? t('report.emDash')
                : formatVatSar(cards.netPayable),
          },
          {
            key: 'bills',
            label: t('vatReturn.card.bills'),
            value:
              cards.billsWithoutVatNo == null
                ? t('report.emDash')
                : formatVatLatn(cards.billsWithoutVatNo, { fractionDigits: 0 }),
            meta: billsLabel,
          },
        ].map((item) =>
          item.meta
            ? {
                ...item,
                value: (
                  <span>
                    <span style={{ display: 'block' }}>{item.value}</span>
                    <span
                      style={{
                        display: 'block',
                        marginTop: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#64748B',
                        textTransform: 'none',
                      }}
                    >
                      {item.meta}
                    </span>
                  </span>
                ),
              }
            : item,
        )}
      />

      {model.glTieOut ? (
        <p style={{ fontSize: 12, color: '#64748B', marginBlockEnd: 12 }}>
          {t('vatReturn.glTieOut', {
            out: model.glTieOut.outputCode,
            inn: model.glTieOut.inputCode,
            from: appliedRange.from,
            to: appliedRange.to,
          })}
        </p>
      ) : null}

      <div
        role="tablist"
        aria-label={t('vatReturn.tabs')}
        style={{ display: 'flex', gap: 8, marginBlockEnd: 12, flexWrap: 'wrap' }}
      >
        {[
          { id: 'summary', label: t('vatReturn.tab.summary') },
          { id: 'output', label: t('vatReturn.tab.output') },
          { id: 'input', label: t('vatReturn.tab.input') },
        ].map((tb) => (
          <button
            key={tb.id}
            type="button"
            role="tab"
            aria-selected={tab === tb.id}
            className={tab === tb.id ? 'btn-submit btn-dark' : 'btn-portal-outline'}
            onClick={() => setTab(tb.id)}
          >
            {tb.label}
          </button>
        ))}
      </div>

      <div
        style={{
          border: '1px solid #E2E8F0',
          borderRadius: 12,
          overflow: 'hidden',
          background: '#fff',
        }}
      >
        {loading ? (
          <div style={{ padding: 24, color: '#64748B' }}>{t('loading')}</div>
        ) : (
          <>
            <WsTableScroll>
              {tab === 'summary' ? (
                <table className="ws-table" style={{ margin: 0, width: '100%' }}>
                  <thead>
                    <tr>
                      <th className="table-th">{t('vatReturn.th.box')}</th>
                      <th className="table-th">{t('vatReturn.th.description')}</th>
                      <th className="table-th" style={{ textAlign: 'end' }}>
                        {t('vatReturn.th.amount')}
                      </th>
                      <th className="table-th" style={{ textAlign: 'end' }}>
                        {t('vatReturn.th.vat')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedRows.map((row) => (
                      <tr
                        key={`${row.box}:${row.descriptionKey}`}
                        style={row.isTotal ? { fontWeight: 800, background: '#FFF7ED' } : undefined}
                      >
                        <td className="table-cell">{row.box}</td>
                        <td className="table-cell">
                          {t(row.descriptionKey)}
                          {row.optional ? ` ${t('vatReturn.optional')}` : ''}
                        </td>
                        <td className="table-cell" style={{ textAlign: 'end' }}>
                          {row.amount == null ? '' : formatVatLatn(row.amount)}
                        </td>
                        <td className="table-cell" style={{ textAlign: 'end' }}>
                          {row.vat == null ? '' : formatVatLatn(row.vat)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="ws-table" style={{ margin: 0, width: '100%' }}>
                  <thead>
                    <tr>
                      <th className="table-th">{t('vatReturn.th.date')}</th>
                      <th className="table-th">{t('vatReturn.th.reference')}</th>
                      <th className="table-th">{t('vatReturn.th.description')}</th>
                      <th className="table-th" style={{ textAlign: 'end' }}>
                        {tab === 'output'
                          ? t('vatReturn.th.saleIncl')
                          : t('vatReturn.th.purchaseIncl')}
                      </th>
                      <th className="table-th" style={{ textAlign: 'end' }}>
                        {tab === 'output'
                          ? t('vatReturn.th.vatOutput')
                          : t('vatReturn.th.vatInput')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="table-cell"
                          style={{ textAlign: 'center', padding: 24, color: '#64748B' }}
                        >
                          {t('vatReturn.emptyDetail')}
                        </td>
                      </tr>
                    ) : (
                      pagedRows.map((r) => (
                        <tr key={r.id || `${r.date}:${r.reference}`}>
                          <td className="table-cell" style={{ whiteSpace: 'nowrap' }}>
                            {r.date || '—'}
                          </td>
                          <td className="table-cell">{r.reference || '—'}</td>
                          <td className="table-cell">{r.description || '—'}</td>
                          <td className="table-cell" style={{ textAlign: 'end' }}>
                            {formatVatLatn(
                              tab === 'output' ? r.saleInclVat : r.purchaseInclVat,
                            )}
                          </td>
                          <td className="table-cell" style={{ textAlign: 'end' }}>
                            {formatVatLatn(tab === 'output' ? r.vatOutput : r.vatInput)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </WsTableScroll>
            <WsTablePagination {...pagerProps} />
          </>
        )}
      </div>
    </div>
  );
}
