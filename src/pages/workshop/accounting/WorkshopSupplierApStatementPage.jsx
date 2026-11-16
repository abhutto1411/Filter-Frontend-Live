import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { getSupplierApStatement } from '../../../services/workshopAccountingApi';
import {
  SUPPLIERS_AP_PAGE_SIZE,
  buildStatementQuery,
  formatDocLabel,
  formatMoneyLatn,
  showingRange,
} from '../../../utils/suppliersApDisplay';
import { accT } from '../../../utils/accountingI18n';
import { PaginationControls } from '../../../components/PaginationControls';
import WsTableScroll from '../../../components/workshop/WsTableScroll';
import { useAuth } from '../../../context/AuthContext';

const inputStyle = {
  borderRadius: 8,
  border: '1px solid #CBD5E1',
  padding: '0 10px',
  fontSize: '0.875rem',
};

/**
 * Full-page AP statement (mockup "Open full statement" + deep links).
 * Path: /workshop/accounting/suppliers/:type/:id
 */
export default function WorkshopSupplierApStatementPage({ locale: localeProp }) {
  const outletCtx = useOutletContext() || {};
  const locale =
    localeProp ||
    outletCtx.locale ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
    'en';
  const t = useCallback((key, vars) => accT(locale, key, vars), [locale]);
  const { hasPermission } = useAuth();
  const canView =
    hasPermission('workshop.suppliers.view') ||
    hasPermission('workshop.accounting.ledger.view');

  const params = useParams();
  const pathParts = useMemo(() => {
    if (typeof window === 'undefined') return [];
    return window.location.pathname.split('/').filter(Boolean);
  }, []);
  // /workshop/accounting/suppliers/:type/:id
  const typeFromPath =
    params.type ||
    (pathParts[2] === 'suppliers' ? pathParts[3] : null) ||
    '';
  const idFromPath =
    params.id ||
    (pathParts[2] === 'suppliers' ? pathParts[4] : null) ||
    '';

  const [searchParams, setSearchParams] = useSearchParams();
  const [from, setFrom] = useState(() => searchParams.get('from') || '');
  const [to, setTo] = useState(() => searchParams.get('to') || '');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const highlightRef = searchParams.get('highlightRef') || '';

  const load = useCallback(async () => {
    if (!typeFromPath || !idFromPath) {
      setLoading(false);
      setError(t('supAp.err.missingId'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await getSupplierApStatement(
        typeFromPath,
        idFromPath,
        buildStatementQuery({ from, to, stmtPage: page }),
      );
      const root =
        res?.data && typeof res.data === 'object' && !Array.isArray(res.data)
          ? res.data
          : res;
      setData(root && typeof root === 'object' ? root : null);
    } catch (e) {
      const status = Number(e?.status);
      setData(null);
      setError(
        status === 404 || status === 403
          ? t('supAp.err.unavailable')
          : e?.message || t('supAp.err.stmt'),
      );
    } finally {
      setLoading(false);
    }
  }, [typeFromPath, idFromPath, from, to, page, t]);

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    void load();
  }, [canView, load]);

  function onApply(e) {
    e?.preventDefault?.();
    const next = {};
    if (from) next.from = from;
    if (to) next.to = to;
    if (highlightRef) next.highlightRef = highlightRef;
    setSearchParams(next, { replace: true });
    setPage(1);
  }

  if (!canView) {
    return (
      <div role="alert" style={{ padding: 16 }}>
        {t('supAp.noPermission')}
      </div>
    );
  }

  const rows = Array.isArray(data?.rows) ? data.rows : [];
  const total = Number(data?.total) || 0;
  const pageSize = Number(data?.pageSize) || SUPPLIERS_AP_PAGE_SIZE;
  const curPage = Number(data?.page) || page;
  const range = showingRange(curPage, pageSize, total);

  return (
    <div dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <div style={{ marginBottom: 12 }}>
        <Link to="/workshop/accounting/suppliers" style={{ fontSize: '0.85rem' }}>
          ← {t('supAp.backToList')}
        </Link>
      </div>
      <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800 }}>
        {t('supAp.statementTitle', {
          name: data?.header?.name || idFromPath || '—',
        })}
      </h2>
      <div style={{ color: '#64748B', fontSize: '0.85rem', marginBottom: 16 }}>
        {t('supAp.col.vat')}: {data?.header?.vatId || '—'}
        {data?.openingBalance != null
          ? ` · ${t('supAp.opening')}: ${formatMoneyLatn(data.openingBalance)}`
          : null}
        {data?.closingBalance != null
          ? ` · ${t('supAp.closing')}: ${formatMoneyLatn(data.closingBalance)}`
          : null}
      </div>

      <form
        onSubmit={onApply}
        className="acct-filter-bar"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label htmlFor="stmt-from" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
            {t('supAp.filter.from')}
          </label>
          <input
            id="stmt-from"
            type="date"
            style={inputStyle}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label htmlFor="stmt-to" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
            {t('supAp.filter.to')}
          </label>
          <input
            id="stmt-to"
            type="date"
            style={inputStyle}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <button type="submit" className="btn-submit btn-dark">
          {t('supAp.filter.apply')}
        </button>
      </form>

      {error ? (
        <div role="alert" style={{ color: '#B91C1C', marginBottom: 12 }}>
          <AlertTriangle size={16} style={{ marginInlineEnd: 6, verticalAlign: 'middle' }} />
          {error}{' '}
          <button type="button" className="btn-portal-outline" onClick={() => void load()}>
            {t('supAp.retry')}
          </button>
        </div>
      ) : null}

      {loading ? <div style={{ color: '#64748B' }}>{t('supAp.loading')}</div> : null}

      {!loading && data ? (
        <>
          <WsTableScroll>
            <table className="ws-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th className="table-th">{t('supAp.col.date')}</th>
                  <th className="table-th">{t('supAp.col.doc')}</th>
                  <th className="table-th">{t('supAp.col.vat')}</th>
                  <th className="table-th" style={{ textAlign: 'end' }}>
                    {t('supAp.col.debit')}
                  </th>
                  <th className="table-th" style={{ textAlign: 'end' }}>
                    {t('supAp.col.credit')}
                  </th>
                  <th className="table-th" style={{ textAlign: 'end' }}>
                    {t('supAp.col.balance')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const hi =
                    highlightRef &&
                    (String(row.sourceId) === highlightRef ||
                      String(row.journalId) === highlightRef ||
                      String(row.journalNumber) === highlightRef);
                  return (
                    <tr key={row.id} style={hi ? { background: '#FEF3C7' } : undefined}>
                      <td className="table-cell">{row.date || '—'}</td>
                      <td className="table-cell">{formatDocLabel(row)}</td>
                      <td className="table-cell">{data.header?.vatId || '—'}</td>
                      <td className="table-cell" style={{ textAlign: 'end' }}>
                        {Number(row.debit) ? formatMoneyLatn(row.debit) : ''}
                      </td>
                      <td className="table-cell" style={{ textAlign: 'end' }}>
                        {Number(row.credit) ? formatMoneyLatn(row.credit) : ''}
                      </td>
                      <td className="table-cell" style={{ textAlign: 'end', fontWeight: 700 }}>
                        {formatMoneyLatn(row.balance)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </WsTableScroll>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              gap: 8,
              marginTop: 12,
              color: '#64748B',
              fontSize: '0.85rem',
            }}
          >
            <span>
              {t('supAp.showing', {
                a: String(range.from),
                b: String(range.to),
                n: String(range.total),
              })}
            </span>
            <PaginationControls
              total={total}
              limit={pageSize}
              offset={(curPage - 1) * pageSize}
              onPageChange={(offset) => setPage(Math.floor(offset / pageSize) + 1)}
              loading={loading}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
