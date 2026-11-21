import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  FileStack,
  Filter,
  Layers,
  Plus,
  RotateCcw,
  Upload,
} from 'lucide-react';
import { accT } from '../../../utils/accountingI18n';
import { listAccountingBatches } from '../../../services/workshopAccountingApi';
import WsTableScroll from '../../../components/workshop/WsTableScroll';
import { PaginationControls } from '../../../components/PaginationControls';
import {
  batchListAction,
  batchStatusChip,
  buildBatchListQuery,
  emptyBatchListFilters,
  formatSarLatn,
  mapBatchListSummary,
  pageRangeLabel,
} from '../../../utils/bulkBatchesDisplay';
import '../../../styles/admin/AccountingPage.css';

const PAGE_SIZE = 25;

function statusLabel(chip, t) {
  if (chip.kind === 'posted') return t('bb.status.posted');
  if (chip.kind === 'reversed') return t('bb.status.reversed');
  if (chip.kind === 'closed') return t('bb.status.closed');
  if (chip.kind === 'draft_import') return t('bb.status.draftImport');
  if (chip.kind === 'partial') {
    return t('bb.status.partial', { n: chip.errorCount || 0 });
  }
  if (chip.kind === 'draft' && chip.errorCount > 0) {
    return t('bb.status.draftErrors', { n: chip.errorCount });
  }
  return t('bb.status.draft');
}

function statusStyle(kind) {
  if (kind === 'posted') return { background: '#DCFCE7', color: '#166534' };
  if (kind === 'reversed') return { background: '#E2E8F0', color: '#334155' };
  if (kind === 'draft_import' || kind === 'draft' || kind === 'partial') {
    return { background: '#FEF3C7', color: '#92400E' };
  }
  return { background: '#F1F5F9', color: '#475569' };
}

export default function WorkshopTransactionBatchesPage({
  selectedBranchId = 'all',
  locale: localeProp,
}) {
  const outletCtx = useOutletContext() || {};
  const locale =
    localeProp ||
    outletCtx.locale ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
    'en';
  const t = useCallback((key, vars) => accT(locale, key, vars), [locale]);
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  const [draft, setDraft] = useState(() => ({
    ...emptyBatchListFilters(),
    branchId: selectedBranchId !== 'all' ? String(selectedBranchId) : '',
  }));
  const [applied, setApplied] = useState(() => ({
    ...emptyBatchListFilters(),
    branchId: selectedBranchId !== 'all' ? String(selectedBranchId) : '',
  }));
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [pageTotals, setPageTotals] = useState(null);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const res = await listAccountingBatches(
        buildBatchListQuery(applied, page, PAGE_SIZE),
      );
      setItems(Array.isArray(res?.items) ? res.items : []);
      setSummary(res?.summary || null);
      setPageTotals(res?.pageTotals || null);
      setTotal(Number(res?.total || 0));
    } catch (e) {
      setItems([]);
      setSummary(null);
      setPageTotals(null);
      setTotal(0);
      setErr(e?.message || t('bb.err.load'));
    } finally {
      setLoading(false);
    }
  }, [applied, page, t]);

  useEffect(() => {
    load();
  }, [load]);

  const cards = useMemo(() => mapBatchListSummary(summary), [summary]);
  const range = pageRangeLabel(page, PAGE_SIZE, total);

  const applyFilters = (e) => {
    e?.preventDefault?.();
    setPage(1);
    setApplied({ ...draft });
  };

  const showAll = () => {
    const cleared = {
      ...emptyBatchListFilters(),
      branchId: selectedBranchId !== 'all' ? String(selectedBranchId) : '',
    };
    setDraft(cleared);
    setApplied(cleared);
    setPage(1);
  };

  const cardMeta = {
    batches: { Icon: Layers, label: t('bb.card.batches') },
    drafts: { Icon: FileStack, label: t('bb.card.drafts') },
    posted: { Icon: FileStack, label: t('bb.card.posted') },
    reversed: { Icon: RotateCcw, label: t('bb.card.reversed') },
    totalPosted: { Icon: Layers, label: t('bb.card.totalPosted') },
  };

  return (
    <div className="module-container" dir={dir}>
      <header style={{ marginBottom: 12 }}>
        <p className="form-help-text" style={{ marginBottom: 4 }}>
          <Link to="/workshop/accounting">{t('pcw.crumb.accounting')}</Link>
          {' / '}
          <Link to="/workshop/accounting/transactions">{t('tx.crumb.transactions')}</Link>
          {' / '}
          <span>{t('bb.crumb.batches')}</span>
        </p>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0F172A' }}>
          {t('bb.title')}
        </h2>
      </header>

      <form
        onSubmit={applyFilters}
        className="acct-filter-bar"
        style={{
          padding: 14,
          marginBottom: 14,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 10,
          alignItems: 'end',
        }}
      >
        <label>
          <span className="form-help-text">{t('bb.filter.search')}</span>
          <input
            className="form-input"
            value={draft.search}
            onChange={(e) => setDraft((d) => ({ ...d, search: e.target.value }))}
            placeholder={t('bb.filter.searchPh')}
          />
        </label>
        <label>
          <span className="form-help-text">{t('bb.filter.status')}</span>
          <select
            className="form-input"
            value={draft.status}
            onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}
          >
            <option value="">{t('bb.filter.all')}</option>
            <option value="draft">{t('bb.status.draft')}</option>
            <option value="posted">{t('bb.status.posted')}</option>
            <option value="reversed">{t('bb.status.reversed')}</option>
            <option value="partially_posted">{t('bb.status.partialShort')}</option>
          </select>
        </label>
        <label>
          <span className="form-help-text">{t('bb.filter.type')}</span>
          <select
            className="form-input"
            value={draft.type}
            onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))}
          >
            <option value="">{t('bb.filter.all')}</option>
            <option value="payment">{t('bulk.type.payment')}</option>
            <option value="receipt">{t('bulk.type.receipt')}</option>
            <option value="transfer">{t('bulk.type.transfer')}</option>
            <option value="journal">{t('bulk.type.journal')}</option>
          </select>
        </label>
        <label>
          <span className="form-help-text">{t('bb.filter.createdBy')}</span>
          <input
            className="form-input"
            value={draft.createdBy}
            onChange={(e) => setDraft((d) => ({ ...d, createdBy: e.target.value }))}
            placeholder={t('bb.filter.createdByPh')}
          />
        </label>
        <label>
          <span className="form-help-text">{t('bb.filter.from')}</span>
          <input
            className="form-input"
            type="date"
            value={draft.from}
            onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
          />
        </label>
        <label>
          <span className="form-help-text">{t('bb.filter.to')}</span>
          <input
            className="form-input"
            type="date"
            value={draft.to}
            onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
          />
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="submit" className="btn-submit btn-dark" disabled={loading}>
            <Filter size={14} style={{ marginInlineEnd: 6 }} />
            {t('bb.filter.apply')}
          </button>
          <button
            type="button"
            className="btn-portal-outline"
            disabled={loading}
            onClick={showAll}
          >
            {t('bb.filter.showAll')}
          </button>
        </div>
      </form>

      {err ? (
        <div role="alert" style={{ marginBottom: 12, color: '#B91C1C' }}>
          {err}{' '}
          <button type="button" className="btn-portal-outline" onClick={load}>
            {t('bb.retry')}
          </button>
        </div>
      ) : null}

      {cards.length > 0 ? (
        <div className="cash-bank-stats" style={{ marginBottom: 12 }}>
          {cards.map((c) => {
            const meta = cardMeta[c.id] || cardMeta.batches;
            const Icon = meta.Icon;
            return (
              <div key={c.id} className="acct-kpi-card">
                <div className="cash-bank-stat-icon">
                  <Icon size={24} />
                </div>
                <div>
                  <p className="acct-kpi-label">{meta.label}</p>
                  <p className="acct-kpi-value">
                    {c.id === 'totalPosted'
                      ? t('bb.card.totalPostedVal', {
                          out: formatSarLatn(c.out),
                          in: formatSarLatn(c.in),
                        })
                      : String(c.value ?? 0)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 10,
        }}
      >
        <Link
          to="/workshop/accounting/transactions/batch/import"
          className="btn-portal-outline"
          style={{ textDecoration: 'none' }}
        >
          <Upload size={14} style={{ marginInlineEnd: 6 }} />
          {t('tx.bulk.import')}
        </Link>
        <Link
          to="/workshop/accounting/transactions/batch/new"
          className="btn-submit btn-dark"
          style={{ textDecoration: 'none' }}
        >
          <Plus size={14} style={{ marginInlineEnd: 6 }} />
          {t('tx.bulk.newMany')}
        </Link>
      </div>

      {loading ? (
        <p role="status">{t('bb.loading')}</p>
      ) : items.length === 0 && !err ? (
        <p role="status">{t('bb.empty')}</p>
      ) : (
        <WsTableScroll>
          <table className="ws-table" style={{ width: '100%', minWidth: 900 }}>
            <thead>
              <tr>
                <th className="table-th">{t('bb.th.batch')}</th>
                <th className="table-th">{t('bb.th.date')}</th>
                <th className="table-th">{t('bb.th.memo')}</th>
                <th className="table-th" style={{ textAlign: 'end' }}>
                  {t('bb.th.rows')}
                </th>
                <th className="table-th">{t('bb.th.status')}</th>
                <th className="table-th">{t('bb.th.createdBy')}</th>
                <th className="table-th" style={{ textAlign: 'end' }}>
                  {t('bb.th.totalOut')}
                </th>
                <th className="table-th" style={{ textAlign: 'end' }}>
                  {t('bb.th.totalIn')}
                </th>
                <th className="table-th">{t('bb.th.action')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const chip = batchStatusChip(it);
                const action = batchListAction(it);
                return (
                  <tr key={it.id}>
                    <td className="table-cell">
                      <Link to={`/workshop/accounting/transactions/batch/${it.id}`}>
                        {it.batchNo || it.id}
                      </Link>
                    </td>
                    <td className="table-cell">{it.date || '—'}</td>
                    <td className="table-cell">{it.memo || '—'}</td>
                    <td className="table-cell" style={{ textAlign: 'end' }}>
                      {it.rowCount ?? '—'}
                    </td>
                    <td className="table-cell">
                      <span
                        style={{
                          ...statusStyle(chip.kind),
                          borderRadius: 6,
                          padding: '2px 8px',
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {statusLabel(chip, t)}
                      </span>
                    </td>
                    <td className="table-cell">
                      {it.createdBy?.displayName || it.createdBy?.id || '—'}
                    </td>
                    <td className="table-cell" style={{ textAlign: 'end' }}>
                      {formatSarLatn(it.totalOut)}
                    </td>
                    <td className="table-cell" style={{ textAlign: 'end' }}>
                      {formatSarLatn(it.totalIn)}
                    </td>
                    <td className="table-cell">
                      <Link
                        to={`/workshop/accounting/transactions/batch/${it.id}`}
                        className="btn-portal-outline"
                        style={{ textDecoration: 'none', fontSize: 12, padding: '4px 10px' }}
                      >
                        {action === 'continue' ? t('bb.act.continue') : t('bb.act.open')}
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {pageTotals ? (
                <tr style={{ background: '#F8FAFC', fontWeight: 700 }}>
                  <td className="table-cell" colSpan={3}>
                    {t('bb.totals.page')}
                  </td>
                  <td className="table-cell" style={{ textAlign: 'end' }}>
                    {pageTotals.rowCount ?? '—'}
                  </td>
                  <td className="table-cell" colSpan={2} />
                  <td className="table-cell" style={{ textAlign: 'end' }}>
                    {formatSarLatn(pageTotals.totalOut)}
                  </td>
                  <td className="table-cell" style={{ textAlign: 'end' }}>
                    {formatSarLatn(pageTotals.totalIn)}
                  </td>
                  <td className="table-cell" />
                </tr>
              ) : null}
            </tbody>
          </table>
        </WsTableScroll>
      )}

      {!loading && total > 0 ? (
        <div style={{ marginTop: 12 }}>
          <p className="form-help-text" style={{ marginBottom: 6 }}>
            {t('bb.showing', { a: range.from, b: range.to, n: range.total })}
          </p>
          <PaginationControls
            total={total}
            limit={PAGE_SIZE}
            offset={(page - 1) * PAGE_SIZE}
            loading={loading}
            onPageChange={(offset) => setPage(Math.floor(offset / PAGE_SIZE) + 1)}
          />
          <p className="form-help-text">{t('bb.note')}</p>
        </div>
      ) : null}
    </div>
  );
}
