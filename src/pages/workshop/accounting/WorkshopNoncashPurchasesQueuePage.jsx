import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Paperclip,
  Users,
} from 'lucide-react';
import { accT } from '../../../utils/accountingI18n';
import { listNoncashPurchases } from '../../../services/noncashPurchasesApi';
import WsTableScroll from '../../../components/workshop/WsTableScroll';
import { PaginationControls } from '../../../components/PaginationControls';
import {
  buildNoncashQueueQuery,
  emptyNoncashQueueFilters,
  formatSarLatn,
  mapNoncashQueueSummary,
  pageRangeLabel,
  photoCountFromItem,
  statusChipKind,
} from '../../../utils/noncashReviewDisplay';
import '../../../styles/admin/AccountingPage.css';
import RiyalIcon from '../../../components/RiyalIcon';

const PAGE_SIZE = 25;

function chipStyle(kind) {
  const map = {
    pending: { bg: '#FEF3C7', fg: '#92400E' },
    approved: { bg: '#DCFCE7', fg: '#166534' },
    rejected: { bg: '#FEE2E2', fg: '#991B1B' },
    reversed: { bg: '#E2E8F0', fg: '#334155' },
  };
  return map[kind] || map.pending;
}

export default function WorkshopNoncashPurchasesQueuePage({
  branches = [],
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
    ...emptyNoncashQueueFilters(),
    branchId: selectedBranchId !== 'all' ? String(selectedBranchId) : '',
  }));
  const [applied, setApplied] = useState(() => ({ ...draft }));
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const res = await listNoncashPurchases(buildNoncashQueueQuery(applied, page));
      setItems(Array.isArray(res?.items) ? res.items : []);
      setSummary(res?.summary || null);
      setTotal(Number(res?.total) || 0);
    } catch (e) {
      setItems([]);
      setSummary(null);
      setTotal(0);
      setErr(e?.message || t('nc.err.load'));
    } finally {
      setLoading(false);
    }
  }, [applied, page, t]);

  useEffect(() => {
    load();
  }, [load]);

  const cards = useMemo(() => mapNoncashQueueSummary(summary), [summary]);
  const range = pageRangeLabel(page, PAGE_SIZE, total);

  const cardMeta = {
    pending: { Icon: ClipboardList, label: t('nc.card.pending') },
    approvedMonth: { Icon: CheckCircle2, label: t('nc.card.approvedMonth') },
    duplicates: { Icon: AlertTriangle, label: t('nc.card.duplicates') },
    openBills: { Icon: Users, label: t('nc.card.openBills') },
  };

  function onApply(e) {
    e?.preventDefault?.();
    setPage(1);
    setApplied({ ...draft });
  }

  function onShowAll() {
    const cleared = {
      ...emptyNoncashQueueFilters(),
      branchId: selectedBranchId !== 'all' ? String(selectedBranchId) : '',
    };
    setDraft(cleared);
    setApplied(cleared);
    setPage(1);
  }

  return (
    <div className="module-container noncash-queue-page" dir={dir}>
      <header style={{ marginBottom: 12 }}>
        <p className="form-help-text" style={{ marginBottom: 4 }}>
          <Link to="/workshop/accounting">{t('pcw.crumb.accounting')}</Link>
          {' / '}
          <span>{t('nc.crumb.purchases')}</span>
          {' / '}
          <span>{t('nc.crumb.review')}</span>
        </p>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0F172A' }}>
          {t('nc.title.queue')}
        </h2>
      </header>

      {err ? (
        <div role="alert" style={{ marginBottom: 10, color: '#B91C1C' }}>
          {err}{' '}
          <button type="button" className="btn-portal-outline" onClick={load}>
            {t('nc.retry')}
          </button>
        </div>
      ) : null}

      {cards.length ? (
        <div className="cash-bank-stats" style={{ marginBottom: 12 }}>
          {cards.map((c) => {
            const meta = cardMeta[c.id] || cardMeta.pending;
            const Icon = meta.Icon;
            return (
              <div key={c.id} className="acct-kpi-card">
                <div className="cash-bank-stat-icon">
                  <Icon size={22} />
                </div>
                <div>
                  <p className="acct-kpi-label">{meta.label}</p>
                  <p className="acct-kpi-value">
                    {c.count != null ? String(c.count) : '—'}
                    {c.amount != null ? (
                      <>
                        {' · '}
                        <bdi dir="ltr">{formatSarLatn(c.amount)}</bdi>{' '}
                        <RiyalIcon size={11} />
                      </>
                    ) : ''}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      <form
        className="acct-filter-bar"
        style={{ padding: 12, marginBottom: 12 }}
        onSubmit={onApply}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 8,
            alignItems: 'end',
          }}
        >
          <label>
            <span className="form-help-text">{t('nc.filter.supplier')}</span>
            <input
              className="form-input"
              value={draft.supplierId}
              onChange={(e) => setDraft((d) => ({ ...d, supplierId: e.target.value }))}
              placeholder={t('nc.filter.supplierPh')}
            />
          </label>
          <label>
            <span className="form-help-text">{t('nc.filter.branch')}</span>
            <select
              className="form-input"
              value={draft.branchId}
              onChange={(e) => setDraft((d) => ({ ...d, branchId: e.target.value }))}
            >
              <option value="">{t('nc.filter.all')}</option>
              {(branches || []).map((b) => (
                <option key={b.id} value={String(b.id)}>
                  {b.name || b.id}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="form-help-text">{t('nc.filter.submittedBy')}</span>
            <input
              className="form-input"
              value={draft.submittedByUserId}
              onChange={(e) =>
                setDraft((d) => ({ ...d, submittedByUserId: e.target.value }))
              }
              placeholder={t('nc.filter.userIdPh')}
            />
          </label>
          <label>
            <span className="form-help-text">{t('nc.filter.status')}</span>
            <select
              className="form-input"
              value={draft.status}
              onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}
            >
              <option value="">{t('nc.filter.all')}</option>
              <option value="pending">{t('nc.status.pending')}</option>
              <option value="approved">{t('nc.status.approved')}</option>
              <option value="rejected">{t('nc.status.rejected')}</option>
              <option value="reversed">{t('nc.status.reversed')}</option>
            </select>
          </label>
          <label>
            <span className="form-help-text">{t('nc.filter.billNo')}</span>
            <input
              className="form-input"
              value={draft.q}
              onChange={(e) => setDraft((d) => ({ ...d, q: e.target.value }))}
              placeholder={t('nc.filter.billPh')}
            />
          </label>
          <label>
            <span className="form-help-text">{t('nc.filter.from')}</span>
            <input
              className="form-input"
              type="date"
              value={draft.from}
              onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
            />
          </label>
          <label>
            <span className="form-help-text">{t('nc.filter.to')}</span>
            <input
              className="form-input"
              type="date"
              value={draft.to}
              onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
            />
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn-submit btn-dark">
              {t('nc.filter.apply')}
            </button>
            <button type="button" className="btn-portal-outline" onClick={onShowAll}>
              {t('nc.filter.showAll')}
            </button>
          </div>
        </div>
      </form>

      {loading ? (
        <p role="status">{t('nc.loading')}</p>
      ) : items.length === 0 && !err ? (
        <p role="status">{t('nc.empty')}</p>
      ) : (
        <WsTableScroll>
          <table className="ws-table" style={{ width: '100%', minWidth: 960 }}>
            <thead>
              <tr>
                <th className="table-th">{t('nc.th.date')}</th>
                <th className="table-th">{t('nc.th.bill')}</th>
                <th className="table-th">{t('nc.th.supplier')}</th>
                <th className="table-th">{t('nc.th.branch')}</th>
                <th className="table-th">{t('nc.th.cashier')}</th>
                <th className="table-th">{t('nc.th.type')}</th>
                <th className="table-th" style={{ textAlign: 'end' }}>
                  {t('nc.th.amount')}
                </th>
                <th className="table-th">📎</th>
                <th className="table-th">{t('nc.th.status')}</th>
                <th className="table-th" />
              </tr>
            </thead>
            <tbody>
              {items.map((row) => {
                const kind = statusChipKind(row.status);
                const st = chipStyle(kind);
                const matched = Boolean(row.supplierId);
                const photos = photoCountFromItem(row);
                const action =
                  kind === 'pending' ? t('nc.act.review') : t('nc.act.open');
                return (
                  <tr key={row.id || row.expenseRequestId}>
                    <td className="table-cell">
                      {row.expenseDate ||
                        (row.createdAt ? String(row.createdAt).slice(0, 10) : '—')}
                    </td>
                    <td className="table-cell">{row.billNo || '—'}</td>
                    <td className="table-cell">
                      {row.supplierName || '—'}{' '}
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          background: matched ? '#DCFCE7' : '#FEE2E2',
                          color: matched ? '#166534' : '#991B1B',
                          borderRadius: 6,
                          padding: '1px 6px',
                        }}
                      >
                        {matched ? t('nc.badge.matched') : t('nc.badge.notMatched')}
                      </span>
                    </td>
                    <td className="table-cell">{row.branchId || '—'}</td>
                    <td className="table-cell">
                      {row.cashierName || row.submittedByUserId || '—'}
                    </td>
                    <td className="table-cell">{row.type || row.expenseType || '—'}</td>
                    <td className="table-cell" style={{ textAlign: 'end' }}>
                      {formatSarLatn(row.amount)}
                    </td>
                    <td className="table-cell">
                      {photos > 0 ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Paperclip size={12} /> {photos}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="table-cell">
                      <span
                        style={{
                          background: st.bg,
                          color: st.fg,
                          borderRadius: 6,
                          padding: '2px 8px',
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {t(`nc.status.${kind}`)}
                      </span>
                      {row.possibleDuplicate ? (
                        <span
                          style={{
                            marginInlineStart: 6,
                            fontSize: 11,
                            color: '#991B1B',
                            fontWeight: 700,
                          }}
                        >
                          {t('nc.badge.dup')}
                        </span>
                      ) : null}
                    </td>
                    <td className="table-cell">
                      <Link
                        to={`/workshop/accounting/noncash-purchases/${encodeURIComponent(
                          row.expenseRequestId || row.id,
                        )}`}
                        className="btn-portal-outline"
                        style={{ textDecoration: 'none', fontSize: 12, padding: '4px 8px' }}
                      >
                        {action}
                      </Link>
                    </td>
                  </tr>
                );
              })}
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
        </div>
      ) : null}
    </div>
  );
}
