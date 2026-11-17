import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { PaginationControls } from '../../../components/PaginationControls';
import ProofAmount from '../../../components/accounting/reports/ProofAmount';
import {
  buildProofHref,
  readProofParams,
} from '../../../components/accounting/reports/reportProofLinks';
import {
  getReportProof,
  getReportProofCsvUrl,
} from '../../../services/accountsApi';
import { apiFetch } from '../../../services/api';
import { accT } from '../../../utils/accountingI18n';
import {
  BS_WARNING_BANNER_STYLE,
  bsWarningMessages,
} from '../../../utils/accountingReportDisplay';
import { formatAccountingNumber } from '../../../utils/plBranchTableDisplay';

const REPORT_TITLE_KEY = {
  pl: 'report.pl.title',
  tb: 'report.tb.title',
  bs: 'report.bs.title',
};

function unwrapProof(res) {
  if (res && typeof res === 'object' && res.data && typeof res.data === 'object' && !Array.isArray(res.data)) {
    return res.data;
  }
  return res && typeof res === 'object' ? res : null;
}

function fallbackReportHref(report) {
  if (report === 'tb') return '/workshop/accounting/trial-balance';
  if (report === 'bs') return '/workshop/accounting/balance-sheet';
  return '/workshop/accounting/profit-loss';
}

function ledgerHref(accountId, filters) {
  if (!accountId) return '';
  const q = new URLSearchParams();
  if (filters.dateFrom) q.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) q.set('dateTo', filters.dateTo);
  if (filters.branchId) q.set('branchId', filters.branchId);
  const qs = q.toString();
  return `/workshop/accounting/ledger/${encodeURIComponent(String(accountId))}${qs ? `?${qs}` : ''}`;
}

function sourceLabel(line) {
  const ref = line?.sourceRef;
  if (ref && ref.type) {
    return ref.id ? `${ref.type} #${ref.id}` : String(ref.type);
  }
  if (line?.source) {
    return line.sourceId ? `${line.source} #${line.sourceId}` : String(line.source);
  }
  return '—';
}

export default function WorkshopReportProofPage({ locale: localeProp } = {}) {
  const locale =
    localeProp ||
    (typeof localStorage !== 'undefined'
      ? localStorage.getItem('portal-locale')
      : null) ||
    'en';
  const t = useCallback((key, vars) => accT(locale, key, vars), [locale]);
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const params = useMemo(() => readProofParams(searchParams), [searchParams]);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [exporting, setExporting] = useState(false);

  const queryFilters = useMemo(
    () => ({
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      branchId: params.branchId,
      basis: params.basis,
      compare: params.compare,
    }),
    [params.dateFrom, params.dateTo, params.branchId, params.basis, params.compare],
  );

  const thisProofHref = `${location.pathname}${location.search}`;
  const reportHref = params.back || fallbackReportHref(params.report);
  const reportTitle = t(REPORT_TITLE_KEY[params.report] || 'proof.fallbackReport');

  const load = useCallback(async () => {
    if (!params.key) {
      setData(null);
      setErr(t('proof.loadFailed'));
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr('');
    try {
      const res = await getReportProof({
        report: params.report,
        key: params.key,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        branchId: params.branchId,
        column: params.column,
        basis: params.basis,
        compare: params.compare,
        page: params.page,
        pageSize: params.pageSize || 100,
      });
      const root = unwrapProof(res);
      if (!root) {
        setData(null);
        setErr(t('proof.loadFailed'));
        return;
      }
      setData(root);
    } catch (e) {
      setData(null);
      setErr(e?.message || t('proof.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [params, t]);

  useEffect(() => {
    void load();
  }, [load]);

  function setPage(nextPage) {
    const next = new URLSearchParams(searchParams);
    if (nextPage > 1) next.set('page', String(nextPage));
    else next.delete('page');
    setSearchParams(next, { replace: true });
  }

  async function onExportCsv() {
    setExporting(true);
    try {
      const path = getReportProofCsvUrl({
        report: params.report,
        key: params.key,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        branchId: params.branchId,
        column: params.column,
        basis: params.basis,
        compare: params.compare,
      });
      const text = await apiFetch(path, { headers: { Accept: 'text/csv' } });
      const blob = new Blob([typeof text === 'string' ? text : String(text ?? '')], {
        type: 'text/csv;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-proof-${String(params.key || 'proof').replace(/[^\w.-]+/g, '_')}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(e?.message || t('proof.loadFailed'));
    } finally {
      setExporting(false);
    }
  }

  const liveBooks =
    data?.filters?.liveBooksAfterDate || data?.liveBooksAfterDate || '';
  const lines = data?.lines && typeof data.lines === 'object' ? data.lines : null;
  const items = Array.isArray(lines?.items) ? lines.items : [];
  const accounts = Array.isArray(data?.accounts) ? data.accounts : [];
  const components = Array.isArray(data?.components) ? data.components : [];
  const totals = data?.totals && typeof data.totals === 'object' ? data.totals : null;
  const pageSize = Number(lines?.pageSize || params.pageSize || 100);
  const page = Number(lines?.page || params.page || 1);
  const totalLines = Number(lines?.total || 0);
  const empty =
    !loading &&
    data &&
    data.kind === 'lines' &&
    items.length === 0 &&
    accounts.length === 0;

  function componentHref(proofKey) {
    if (!proofKey) return '';
    return buildProofHref({
      report: params.report,
      key: proofKey,
      filters: queryFilters,
      column: params.column,
      backHref: thisProofHref,
    });
  }

  function accountHref(accountId) {
    if (!accountId) return '';
    return buildProofHref({
      report: params.report,
      key: `account:${accountId}`,
      filters: queryFilters,
      column: params.column,
      backHref: thisProofHref,
    });
  }

  const reconOk = Boolean(data?.reconciled);
  const diffText = formatAccountingNumber(data?.difference ?? 0);

  return (
    <div className="ws-page" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <div style={{ marginBlockEnd: 8, fontSize: 13, color: '#64748B' }}>
        <Link to="/workshop/accounting/chart-of-accounts" style={{ color: '#64748B' }}>
          {t('proof.breadcrumb.accounting')}
        </Link>
        {' › '}
        <Link to={reportHref} style={{ color: '#64748B' }}>
          {reportTitle}
        </Link>
        {' › '}
        <span>{t('proof.breadcrumb.proof')}</span>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBlockEnd: 12,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 800,
            color: '#0F172A',
          }}
        >
          {data?.label || t('proof.pageTitle')}
        </h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-portal-outline"
            disabled={exporting || !params.key}
            onClick={() => void onExportCsv()}
          >
            {t('proof.exportCsv')}
          </button>
          <Link to={reportHref} className="btn-submit btn-dark" style={{ textDecoration: 'none' }}>
            {t('proof.back')}
          </Link>
        </div>
      </div>

      {params.report === 'bs'
        ? bsWarningMessages(data).map((w) => (
            <p key={w.key} role="status" style={BS_WARNING_BANNER_STYLE}>
              {t(w.key, w.vars)}
            </p>
          ))
        : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBlockEnd: 12 }}>
        {(params.dateFrom || params.dateTo) ? (
          <span style={chipStyle}>
            {t('proof.chip.period')}: {params.dateFrom || '—'} → {params.dateTo || '—'}
          </span>
        ) : null}
        {params.branchId || params.column ? (
          <span style={chipStyle}>
            {t('proof.chip.column')}: {params.column || (params.branchId ? `branch:${params.branchId}` : 'total')}
          </span>
        ) : null}
        {params.basis ? (
          <span style={chipStyle}>
            {t('proof.chip.basis')}: {params.basis}
          </span>
        ) : null}
        {liveBooks ? (
          <span style={chipStyle}>{t('proof.liveBooks', { date: String(liveBooks).slice(0, 10) })}</span>
        ) : null}
      </div>

      {err ? (
        <div role="alert" style={{ color: '#B91C1C', marginBlockEnd: 12, fontSize: 13 }}>
          {err}{' '}
          <button type="button" className="btn-portal-outline" onClick={() => void load()}>
            {t('proof.retry')}
          </button>
        </div>
      ) : null}

      {loading ? (
        <div style={{ padding: 24, color: '#64748B' }}>{t('loading')}</div>
      ) : !data ? (
        <div style={{ padding: 24, color: '#64748B' }}>{t('proof.empty')}</div>
      ) : (
        <>
          <div
            role="status"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 12,
              marginBlockEnd: 16,
              padding: 16,
              background: '#fff',
              border: '1px solid #E5E7EB',
              borderRadius: 10,
            }}
          >
            <div>
              <div style={{ fontSize: 12, color: '#64748B' }}>{t('proof.reportValue')}</div>
              <div style={{ fontWeight: 800 }}>{formatAccountingNumber(data.reportValue)}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#64748B' }}>{t('proof.proofTotal')}</div>
              <div style={{ fontWeight: 800 }}>{formatAccountingNumber(data.proofValue)}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#64748B' }}>{t('proof.difference')}</div>
              <div
                style={{
                  fontWeight: 800,
                  color: reconOk ? '#15803D' : '#B91C1C',
                }}
              >
                {reconOk ? t('proof.differenceOk') : diffText}
              </div>
            </div>
          </div>

          {data.kind === 'formula' ? (
            <div style={cardStyle}>
              <table className="ws-table" style={{ width: '100%', margin: 0 }}>
                <thead>
                  <tr>
                    <th className="table-th">{t('proof.col.label')}</th>
                    <th className="table-th">{t('proof.col.op')}</th>
                    <th className="table-th" style={{ textAlign: 'end' }}>
                      {t('proof.col.amount')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {components.map((c, i) => (
                    <tr
                      key={`${c.key || c.label || i}`}
                      style={c.op === '=' ? { background: '#F8FAFC', fontWeight: 800 } : undefined}
                    >
                      <td className="table-cell">{c.label || c.key || '—'}</td>
                      <td className="table-cell">{c.op || ''}</td>
                      <td className="table-cell" style={{ textAlign: 'end' }}>
                        <ProofAmount
                          value={c.amount}
                          href={componentHref(c.proofKey)}
                          title={t('proof.view')}
                          aria-label={t('proof.aria', { label: c.label || c.key || '' })}
                        />
                        {c.note ? (
                          <div style={{ fontSize: 11, color: '#64748B' }}>{c.note}</div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {data.kind === 'lines' && accounts.length > 1 ? (
            <div style={{ ...cardStyle, marginBlockEnd: 12 }}>
              <h2 style={{ margin: '0 0 8px', fontSize: 14 }}>{t('proof.accounts.heading')}</h2>
              <table className="ws-table" style={{ width: '100%', margin: 0 }}>
                <thead>
                  <tr>
                    <th className="table-th">{t('proof.col.account')}</th>
                    <th className="table-th" style={{ textAlign: 'end' }}>
                      {t('proof.col.amount')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a) => {
                    const id = a.id || a.accountId;
                    const amt = a.amount ?? a.signed ?? a.total;
                    return (
                      <tr key={String(id || a.code || a.name)}>
                        <td className="table-cell">
                          {[a.code, a.name].filter(Boolean).join(' ') || '—'}
                        </td>
                        <td className="table-cell" style={{ textAlign: 'end' }}>
                          <ProofAmount
                            value={amt}
                            href={accountHref(id)}
                            title={t('proof.view')}
                            aria-label={t('proof.aria', { label: a.name || a.code || '' })}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}

          {data.kind === 'lines' ? (
            <div style={cardStyle}>
              <h2 style={{ margin: '0 0 8px', fontSize: 14 }}>{t('proof.lines.heading')}</h2>
              {empty ? (
                <div style={{ padding: 24, color: '#64748B' }}>{t('proof.empty')}</div>
              ) : (
                <>
                  <table className="ws-table" style={{ width: '100%', margin: 0, minWidth: 720 }}>
                    <thead>
                      <tr>
                        <th className="table-th">{t('proof.col.date')}</th>
                        <th className="table-th">{t('proof.col.entry')}</th>
                        <th className="table-th">{t('proof.col.source')}</th>
                        <th className="table-th">{t('proof.col.account')}</th>
                        <th className="table-th">{t('proof.col.branch')}</th>
                        <th className="table-th">{t('proof.col.description')}</th>
                        <th className="table-th" style={{ textAlign: 'end' }}>
                          {t('proof.col.debit')}
                        </th>
                        <th className="table-th" style={{ textAlign: 'end' }}>
                          {t('proof.col.credit')}
                        </th>
                        <th className="table-th" style={{ textAlign: 'end' }}>
                          {t('proof.col.signed')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((line) => {
                        const accId = line.accountId || line.account?.id;
                        const je = ledgerHref(accId, queryFilters);
                        return (
                          <tr key={line.id || `${line.journalId}-${line.entryNumber}-${accId}`}>
                            <td className="table-cell">{String(line.date || '').slice(0, 10)}</td>
                            <td className="table-cell">
                              {je ? (
                                <Link to={je} style={{ color: 'inherit' }}>
                                  {line.entryNumber || line.journalId || '—'}
                                </Link>
                              ) : (
                                line.entryNumber || '—'
                              )}
                            </td>
                            <td className="table-cell">{sourceLabel(line)}</td>
                            <td className="table-cell">
                              {[line.accountCode || line.code, line.accountName || line.name]
                                .filter(Boolean)
                                .join(' ') || '—'}
                            </td>
                            <td className="table-cell">{line.branchName || line.branchId || '—'}</td>
                            <td className="table-cell">{line.description || ''}</td>
                            <td className="table-cell" style={{ textAlign: 'end' }}>
                              {formatAccountingNumber(line.debit)}
                            </td>
                            <td className="table-cell" style={{ textAlign: 'end' }}>
                              {formatAccountingNumber(line.credit)}
                            </td>
                            <td className="table-cell" style={{ textAlign: 'end' }}>
                              {formatAccountingNumber(line.signed)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {totals ? (
                      <tfoot>
                        <tr style={{ background: '#F8FAFC', fontWeight: 800 }}>
                          <td className="table-cell" colSpan={6}>
                            {t('proof.col.amount')}
                          </td>
                          <td className="table-cell" style={{ textAlign: 'end' }}>
                            {formatAccountingNumber(totals.debit)}
                          </td>
                          <td className="table-cell" style={{ textAlign: 'end' }}>
                            {formatAccountingNumber(totals.credit)}
                          </td>
                          <td className="table-cell" style={{ textAlign: 'end' }}>
                            {formatAccountingNumber(totals.signed)}
                          </td>
                        </tr>
                      </tfoot>
                    ) : null}
                  </table>
                  <PaginationControls
                    total={totalLines}
                    limit={pageSize}
                    offset={(page - 1) * pageSize}
                    onPageChange={(newOffset) =>
                      setPage(Math.floor(newOffset / pageSize) + 1)
                    }
                    loading={loading}
                  />
                </>
              )}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

const chipStyle = {
  fontSize: 12,
  padding: '4px 10px',
  background: '#F1F5F9',
  borderRadius: 999,
  color: '#334155',
};

const cardStyle = {
  background: '#fff',
  border: '1px solid #E5E7EB',
  borderRadius: 10,
  padding: 16,
  overflow: 'auto',
};
