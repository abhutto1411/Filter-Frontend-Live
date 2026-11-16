import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Building2,
  FileWarning,
  Landmark,
  Users,
} from 'lucide-react';
import {
  getSupplierApStatement,
  getSuppliersApReport,
} from '../../../services/workshopAccountingApi';
import {
  SUPPLIERS_AP_PAGE_SIZE,
  buildApListQuery,
  buildStatementQuery,
  filtersFromSearchParams,
  formatDocLabel,
  formatMoneyLatn,
  hasDrift,
  mapApSummaryCards,
  searchParamsFromFilters,
  showingRange,
  typeChipKind,
} from '../../../utils/suppliersApDisplay';
import { accT } from '../../../utils/accountingI18n';
import { PaginationControls } from '../../../components/PaginationControls';
import WsTableScroll from '../../../components/workshop/WsTableScroll';
import { useAuth } from '../../../context/AuthContext';

const fieldWrap = { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 140 };
const labelStyle = { fontSize: '0.75rem', fontWeight: 600, color: '#64748B' };
const inputStyle = {
  borderRadius: 8,
  border: '1px solid #CBD5E1',
  padding: '0 10px',
  fontSize: '0.875rem',
  background: '#fff',
};

function TypeChip({ kind, t }) {
  const affiliated = kind === 'affiliated';
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 6,
        fontSize: '0.72rem',
        fontWeight: 700,
        background: affiliated ? '#DBEAFE' : '#F1F5F9',
        color: affiliated ? '#1D4ED8' : '#475569',
      }}
    >
      {affiliated ? t('supAp.type.affiliated') : t('supAp.type.local')}
    </span>
  );
}

export default function WorkshopSuppliersApPage({ locale: localeProp }) {
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

  const [searchParams, setSearchParams] = useSearchParams();
  const applied = useMemo(
    () => filtersFromSearchParams(searchParams),
    [searchParams],
  );
  const [draft, setDraft] = useState(() => ({ ...applied }));

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [payload, setPayload] = useState(null);
  const [affiliatedTotal, setAffiliatedTotal] = useState(null);

  const [stmtLoading, setStmtLoading] = useState(false);
  const [stmtError, setStmtError] = useState(null);
  const [stmt, setStmt] = useState(null);
  const [stmtPage, setStmtPage] = useState(1);

  useEffect(() => {
    setDraft({ ...applied });
  }, [applied]);

  const writeFilters = useCallback(
    (next) => {
      setSearchParams(searchParamsFromFilters(next), { replace: true });
    },
    [setSearchParams],
  );

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, aff] = await Promise.all([
        getSuppliersApReport(buildApListQuery(applied)),
        applied.type === 'affiliated'
          ? Promise.resolve(null)
          : getSuppliersApReport({
              type: 'affiliated',
              page: 1,
              pageSize: 1,
              asOf: applied.asOf || applied.to || undefined,
            }).catch((err) => {
              if (Number(err?.status) === 404 || Number(err?.status) === 403) {
                return null;
              }
              throw err;
            }),
      ]);
      const root =
        res?.data && typeof res.data === 'object' && !Array.isArray(res.data)
          ? res.data
          : res;
      setPayload(root && typeof root === 'object' ? root : null);
      if (applied.type === 'affiliated') {
        setAffiliatedTotal(
          root?.summary?.suppliersCount ?? root?.total ?? null,
        );
      } else if (aff) {
        const aRoot =
          aff?.data && typeof aff.data === 'object' ? aff.data : aff;
        setAffiliatedTotal(aRoot?.total ?? aRoot?.summary?.suppliersCount ?? null);
      } else {
        setAffiliatedTotal(null);
      }
    } catch (e) {
      const status = Number(e?.status);
      setPayload(null);
      setError(
        status === 404 || status === 403
          ? t('supAp.err.unavailable')
          : e?.message || t('supAp.err.load'),
      );
    } finally {
      setLoading(false);
    }
  }, [applied, t]);

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    void loadList();
  }, [canView, loadList]);

  const selectedType = applied.supplierType;
  const selectedId = applied.supplierId;

  const loadStatement = useCallback(async () => {
    if (!selectedType || !selectedId) {
      setStmt(null);
      return;
    }
    setStmtLoading(true);
    setStmtError(null);
    try {
      const res = await getSupplierApStatement(
        selectedType,
        selectedId,
        buildStatementQuery({ ...applied, stmtPage }),
      );
      const root =
        res?.data && typeof res.data === 'object' && !Array.isArray(res.data)
          ? res.data
          : res;
      setStmt(root && typeof root === 'object' ? root : null);
    } catch (e) {
      const status = Number(e?.status);
      setStmt(null);
      setStmtError(
        status === 404 || status === 403
          ? t('supAp.err.unavailable')
          : e?.message || t('supAp.err.stmt'),
      );
    } finally {
      setStmtLoading(false);
    }
  }, [selectedType, selectedId, applied, stmtPage, t]);

  useEffect(() => {
    void loadStatement();
  }, [loadStatement]);

  function onApply(e) {
    e?.preventDefault?.();
    writeFilters({
      ...draft,
      page: 1,
      supplierType: applied.supplierType,
      supplierId: applied.supplierId,
      highlightRef: applied.highlightRef,
    });
  }

  function onShowAll() {
    setDraft({
      search: '',
      type: 'all',
      from: '',
      to: '',
      asOf: '',
      page: 1,
      supplierType: '',
      supplierId: '',
      highlightRef: '',
    });
    setSearchParams({}, { replace: true });
    setStmtPage(1);
  }

  function selectSupplier(row) {
    writeFilters({
      ...applied,
      supplierType: row.type,
      supplierId: String(row.id),
      highlightRef: '',
    });
    setStmtPage(1);
  }

  if (!canView) {
    return (
      <div role="alert" style={{ padding: 16, color: '#64748B' }}>
        {t('supAp.noPermission')}
      </div>
    );
  }

  const cards = mapApSummaryCards(payload?.summary, { affiliatedTotal });
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  const total = Number(payload?.total) || 0;
  const page = Number(payload?.page) || applied.page || 1;
  const pageSize = Number(payload?.pageSize) || SUPPLIERS_AP_PAGE_SIZE;
  const range = showingRange(page, pageSize, total);
  const selectedRow = rows.find(
    (r) =>
      String(r.id) === String(selectedId) &&
      String(r.type) === String(selectedType),
  );
  const ledgerTitle =
    selectedRow?.name ||
    stmt?.header?.name ||
    (selectedId ? `#${selectedId}` : '');

  const stmtRows = Array.isArray(stmt?.rows) ? stmt.rows : [];
  const stmtTotal = Number(stmt?.total) || stmtRows.length;
  const stmtRange = showingRange(
    Number(stmt?.page) || stmtPage,
    Number(stmt?.pageSize) || SUPPLIERS_AP_PAGE_SIZE,
    stmtTotal,
  );

  return (
    <div dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <div style={{ marginBottom: 8, fontSize: '0.8rem', color: '#64748B' }}>
        {t('supAp.breadcrumb')}
      </div>
      <h2 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 800, color: '#0F172A' }}>
        {t('supAp.title')}
      </h2>

      <form className="acct-filter-bar" onSubmit={onApply}>
        <div style={{ ...fieldWrap, minWidth: 200 }}>
          <label style={labelStyle} htmlFor="supap-search">
            {t('supAp.filter.supplier')}
          </label>
          <input
            id="supap-search"
            style={inputStyle}
            value={draft.search}
            placeholder={t('supAp.filter.supplierPh')}
            onChange={(e) => setDraft((d) => ({ ...d, search: e.target.value }))}
          />
        </div>
        <div style={fieldWrap}>
          <label style={labelStyle} htmlFor="supap-type">
            {t('supAp.filter.type')}
          </label>
          <select
            id="supap-type"
            style={inputStyle}
            value={draft.type}
            onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))}
          >
            <option value="all">{t('supAp.filter.typeAll')}</option>
            <option value="affiliated">{t('supAp.filter.typeAff')}</option>
            <option value="local">{t('supAp.filter.typeLocal')}</option>
          </select>
        </div>
        <div style={fieldWrap}>
          <label style={labelStyle} htmlFor="supap-from">
            {t('supAp.filter.from')}
          </label>
          <input
            id="supap-from"
            type="date"
            style={inputStyle}
            value={draft.from}
            onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
          />
        </div>
        <div style={fieldWrap}>
          <label style={labelStyle} htmlFor="supap-to">
            {t('supAp.filter.to')}
          </label>
          <input
            id="supap-to"
            type="date"
            style={inputStyle}
            value={draft.to}
            onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
          />
        </div>
        <button type="submit" className="btn-submit btn-dark">
          {t('supAp.filter.apply')}
        </button>
        <button
          type="button"
          className="btn-portal-outline"
         
          onClick={onShowAll}
        >
          {t('supAp.filter.showAll')}
        </button>
      </form>

      <div className="acct-kpi-grid">
        {[
          {
            key: 'suppliers',
            label: t('supAp.card.suppliers'),
            value: cards.suppliers,
            icon: Users,
          },
          {
            key: 'affiliated',
            label: t('supAp.card.affiliated'),
            value: cards.affiliated,
            icon: Building2,
          },
          {
            key: 'open',
            label: t('supAp.card.openBills'),
            value: cards.openBills != null ? formatMoneyLatn(cards.openBills) : null,
            money: true,
            icon: Landmark,
          },
          {
            key: 'overdue',
            label: t('supAp.card.overdue'),
            value: cards.overdue != null ? formatMoneyLatn(cards.overdue) : null,
            money: true,
            warn: true,
            icon: FileWarning,
          },
        ].map((c) => {
          if (c.value == null && !loading) return null;
          const Icon = c.icon;
          const shown =
            loading && c.value == null
              ? '…'
              : c.money
                ? locale === 'ar'
                  ? `${c.value} ${t('supAp.sar')}`
                  : `SAR ${c.value}`
                : c.value;
          return (
            <div key={c.key} className="acct-kpi-card acct-kpi-card--with-icon">
              <div className="acct-kpi-icon" style={{ color: c.warn ? '#DC2626' : '#64748B' }}>
                <Icon size={16} color={c.warn ? '#DC2626' : '#64748B'} aria-hidden />
              </div>
              <div className="acct-kpi-body">
                <div className="acct-kpi-label" title={c.label}>
                  {c.label}
                </div>
                <div
                  className={`acct-kpi-value${c.warn ? ' acct-kpi-value--bad' : ''}`}
                  title={shown == null ? undefined : String(shown)}
                >
                  {shown}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {error ? (
        <div role="alert" style={{ marginBottom: 12, color: '#B91C1C' }}>
          <AlertTriangle size={16} style={{ marginInlineEnd: 6, verticalAlign: 'middle' }} />
          {error}{' '}
          <button type="button" className="btn-portal-outline" onClick={() => void loadList()}>
            {t('supAp.retry')}
          </button>
        </div>
      ) : null}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(280px, 1fr) minmax(320px, 1.2fr)',
          gap: 16,
          alignItems: 'start',
        }}
        className="supap-split"
      >
        <div>
          {loading && !payload ? (
            <div style={{ padding: 24, color: '#64748B' }}>{t('supAp.loading')}</div>
          ) : null}
          {!loading && !error && rows.length === 0 ? (
            <div style={{ padding: 24, color: '#64748B' }}>{t('supAp.empty')}</div>
          ) : null}
          {rows.length > 0 ? (
            <>
              <WsTableScroll>
                <table className="ws-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th className="table-th">{t('supAp.col.supplier')}</th>
                      <th className="table-th">{t('supAp.col.type')}</th>
                      <th className="table-th" style={{ textAlign: 'end' }}>
                        {t('supAp.col.balance')}
                      </th>
                      {rows.some((r) => r.pendingGl != null) ? (
                        <th className="table-th" style={{ textAlign: 'end' }}>
                          {t('supAp.col.pendingGl')}
                        </th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const selected =
                        String(row.id) === String(selectedId) &&
                        String(row.type) === String(selectedType);
                      const showPending = row.pendingGl != null;
                      return (
                        <tr
                          key={`${row.type}-${row.id}`}
                          onClick={() => selectSupplier(row)}
                          style={{
                            cursor: 'pointer',
                            background: selected ? '#FEF9C3' : undefined,
                          }}
                        >
                          <td className="table-cell">
                            {row.name}
                            {hasDrift(row.drift) ? (
                              <span
                                title={t('supAp.driftHint', { n: row.drift })}
                                style={{ marginInlineStart: 6, color: '#D97706' }}
                              >
                                ⚠
                              </span>
                            ) : null}
                          </td>
                          <td className="table-cell">
                            <TypeChip kind={typeChipKind(row.type)} t={t} />
                          </td>
                          <td className="table-cell" style={{ textAlign: 'end', fontWeight: 700 }}>
                            {formatMoneyLatn(row.glBalance)}
                          </td>
                          {rows.some((r) => r.pendingGl != null) ? (
                            <td className="table-cell" style={{ textAlign: 'end' }}>
                              {showPending ? formatMoneyLatn(row.pendingGl) : '—'}
                            </td>
                          ) : null}
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
                  marginTop: 10,
                  fontSize: '0.85rem',
                  color: '#64748B',
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
                  offset={(page - 1) * pageSize}
                  onPageChange={(offset) =>
                    writeFilters({
                      ...applied,
                      page: Math.floor(offset / pageSize) + 1,
                    })
                  }
                  loading={loading}
                />
              </div>
            </>
          ) : null}
        </div>

        <div
          style={{
            background: '#fff',
            border: '1px solid #E2E8F0',
            borderRadius: 10,
            padding: 14,
            minHeight: 280,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 8,
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
              {selectedId
                ? t('supAp.ledgerTitle', { name: ledgerTitle })
                : t('supAp.ledgerEmpty')}
            </h3>
            {selectedType && selectedId ? (
              <Link
                to={`/workshop/accounting/suppliers/${encodeURIComponent(selectedType)}/${encodeURIComponent(selectedId)}${
                  applied.from || applied.to
                    ? `?${new URLSearchParams({
                        ...(applied.from ? { from: applied.from } : {}),
                        ...(applied.to ? { to: applied.to } : {}),
                      }).toString()}`
                    : ''
                }`}
                className="btn-portal-outline"
                style={{ fontSize: '0.8rem', padding: '6px 10px' }}
              >
                {t('supAp.openStatement')}
              </Link>
            ) : null}
          </div>

          {!selectedId ? (
            <div style={{ color: '#64748B', fontSize: '0.9rem' }}>
              {t('supAp.pickSupplier')}
            </div>
          ) : null}

          {stmtError ? (
            <div role="alert" style={{ color: '#B91C1C', marginBottom: 8 }}>
              {stmtError}{' '}
              <button
                type="button"
                className="btn-portal-outline"
                onClick={() => void loadStatement()}
              >
                {t('supAp.retry')}
              </button>
            </div>
          ) : null}

          {stmtLoading ? (
            <div style={{ color: '#64748B' }}>{t('supAp.loading')}</div>
          ) : null}

          {selectedId && !stmtLoading && stmt ? (
            <>
              {stmt.header?.vatId != null || stmt.openingBalance != null ? (
                <div style={{ fontSize: '0.8rem', color: '#64748B', marginBottom: 8 }}>
                  {t('supAp.col.vat')}: {stmt.header?.vatId || '—'}
                  {stmt.openingBalance != null
                    ? ` · ${t('supAp.opening')}: ${formatMoneyLatn(stmt.openingBalance)}`
                    : null}
                </div>
              ) : null}
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
                    {stmtRows.length === 0 ? (
                      <tr>
                        <td className="table-cell" colSpan={6}>
                          {t('supAp.emptyStmt')}
                        </td>
                      </tr>
                    ) : (
                      stmtRows.map((row) => {
                        const hi =
                          applied.highlightRef &&
                          (String(row.sourceId) === applied.highlightRef ||
                            String(row.journalId) === applied.highlightRef ||
                            String(row.journalNumber) === applied.highlightRef);
                        return (
                          <tr
                            key={row.id}
                            style={hi ? { background: '#FEF3C7' } : undefined}
                          >
                            <td className="table-cell">{row.date || '—'}</td>
                            <td className="table-cell">{formatDocLabel(row)}</td>
                            <td className="table-cell">
                              {stmt.header?.vatId || '—'}
                            </td>
                            <td className="table-cell" style={{ textAlign: 'end' }}>
                              {Number(row.debit) ? formatMoneyLatn(row.debit) : ''}
                            </td>
                            <td className="table-cell" style={{ textAlign: 'end' }}>
                              {Number(row.credit) ? formatMoneyLatn(row.credit) : ''}
                            </td>
                            <td
                              className="table-cell"
                              style={{ textAlign: 'end', fontWeight: 700 }}
                            >
                              {formatMoneyLatn(row.balance)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </WsTableScroll>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  gap: 8,
                  marginTop: 10,
                  fontSize: '0.85rem',
                  color: '#64748B',
                }}
              >
                <span>
                  {t('supAp.items', { n: String(stmtTotal) })}
                </span>
                <PaginationControls
                  total={stmtTotal}
                  limit={Number(stmt?.pageSize) || SUPPLIERS_AP_PAGE_SIZE}
                  offset={
                    ((Number(stmt?.page) || stmtPage) - 1) *
                    (Number(stmt?.pageSize) || SUPPLIERS_AP_PAGE_SIZE)
                  }
                  onPageChange={(offset) => {
                    const size = Number(stmt?.pageSize) || SUPPLIERS_AP_PAGE_SIZE;
                    setStmtPage(Math.floor(offset / size) + 1);
                  }}
                  loading={stmtLoading}
                />
              </div>
              {stmtRange.total ? (
                <div style={{ fontSize: '0.8rem', color: '#94A3B8', marginTop: 4 }}>
                  {t('supAp.showing', {
                    a: String(stmtRange.from),
                    b: String(stmtRange.to),
                    n: String(stmtRange.total),
                  })}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      <style>{`
        @media (max-width: 1100px) {
          .supap-split { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
