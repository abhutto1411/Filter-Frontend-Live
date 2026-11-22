import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useOutletContext } from 'react-router-dom';
import {
  ArrowLeftRight,
  FileText,
  Printer,
  RotateCcw,
} from 'lucide-react';
import { accT } from '../../../utils/accountingI18n';
import { useAuth } from '../../../context/AuthContext';
import {
  getAccountingBatch,
  reverseAccountingBatch,
  reverseAccountingBatchRow,
} from '../../../services/workshopAccountingApi';
import WsTableScroll from '../../../components/workshop/WsTableScroll';
import {
  deriveBatchResultCounts,
  formatSarLatn,
  rowAmountDisplay,
  rowDrCrHint,
  rowPartyLabel,
  truncateIdempotencyKey,
} from '../../../utils/bulkBatchesDisplay';
import '../../../styles/admin/AccountingPage.css';

function batchIdFromPath(pathname) {
  const parts = String(pathname || '').split('/').filter(Boolean);
  const i = parts.indexOf('batch');
  if (i >= 0 && parts[i + 1] && parts[i + 1] !== 'new') return parts[i + 1];
  return null;
}

function stateChip(state, t) {
  const s = String(state || '').toLowerCase();
  const map = {
    posted: { bg: '#DCFCE7', fg: '#166534', label: t('bb.status.posted') },
    reversed: { bg: '#E2E8F0', fg: '#334155', label: t('bb.status.reversed') },
    error: { bg: '#FEE2E2', fg: '#991B1B', label: t('bulk.status.error') },
    draft: { bg: '#FEF3C7', fg: '#92400E', label: t('bb.status.draft') },
    closed: { bg: '#F1F5F9', fg: '#475569', label: t('bb.status.closed') },
  };
  // Unknown states must never read as "Posted".
  const m = map[s] || { bg: '#F1F5F9', fg: '#475569', label: s || '—' };
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

export default function WorkshopBatchResultPage({ locale: localeProp }) {
  const { hasPermission } = useAuth();
  const location = useLocation();
  const batchId = batchIdFromPath(location.pathname);
  const outletCtx = useOutletContext() || {};
  const locale =
    localeProp ||
    outletCtx.locale ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
    'en';
  const t = useCallback((key, vars) => accT(locale, key, vars), [locale]);
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  const [batch, setBatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [actionErr, setActionErr] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [revDate, setRevDate] = useState('');
  const [revReason, setRevReason] = useState('');
  const [confirmBatch, setConfirmBatch] = useState(false);
  const [confirmRow, setConfirmRow] = useState(null);
  const idemRef = useRef(null);

  const canReversePerm =
    hasPermission('workshop.accounting.journal-entries.approve') ||
    hasPermission('workshop.accounting.journal-entries.delete') ||
    hasPermission('accounting.journal-entries.approve');

  const load = useCallback(async () => {
    if (!batchId) return;
    setLoading(true);
    setErr('');
    try {
      const res = await getAccountingBatch(batchId);
      setBatch(res);
    } catch (e) {
      setBatch(null);
      setErr(e?.message || t('br.err.load'));
    } finally {
      setLoading(false);
    }
  }, [batchId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(
    () => deriveBatchResultCounts(batch?.rows || []),
    [batch],
  );

  const ensureIdem = () => {
    if (!idemRef.current) {
      idemRef.current =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `rev-${Date.now()}`;
    }
    return idemRef.current;
  };

  const doReverseBatch = async () => {
    if (!batchId || !revReason.trim()) {
      setActionErr(t('br.err.reason'));
      return;
    }
    setBusy(true);
    setActionErr('');
    try {
      const res = await reverseAccountingBatch(batchId, {
        reason: revReason.trim(),
        date: revDate || undefined,
        idempotencyKey: ensureIdem(),
      });
      setBatch(res);
      setInfo(t('br.info.reversed'));
      setConfirmBatch(false);
      idemRef.current = null;
    } catch (e) {
      setActionErr(e?.message || t('br.err.reverse'));
    } finally {
      setBusy(false);
    }
  };

  const doReverseRow = async (lineNo) => {
    if (!batchId || !revReason.trim()) {
      setActionErr(t('br.err.reason'));
      return;
    }
    setBusy(true);
    setActionErr('');
    try {
      const res = await reverseAccountingBatchRow(batchId, lineNo, {
        reason: revReason.trim(),
        date: revDate || undefined,
        idempotencyKey: ensureIdem(),
      });
      setBatch(res);
      setInfo(t('br.info.rowReversed'));
      setConfirmRow(null);
      idemRef.current = null;
    } catch (e) {
      setActionErr(e?.message || t('br.err.reverse'));
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = () => {
    const rows = batch?.rows || [];
    const lines = [
      'lineNo,voucher,journalId,type,party,amount,state',
      ...rows.map((r) =>
        [
          r.lineNo,
          r.voucherNumber || '',
          r.journalId || '',
          r.type || '',
          JSON.stringify(rowPartyLabel(r)),
          rowAmountDisplay(r),
          r.state || '',
        ].join(','),
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${batch?.batchNo || 'batch'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printVouchers = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="module-container" dir={dir} role="status">
        {t('br.loading')}
      </div>
    );
  }

  if (err) {
    return (
      <div className="module-container" dir={dir} role="alert">
        <p style={{ color: '#B91C1C' }}>{err}</p>
        <button type="button" className="btn-portal-outline" onClick={load}>
          {t('bb.retry')}
        </button>
      </div>
    );
  }

  if (!batch) return null;

  const showReverse = batch.canReverse !== false && canReversePerm;
  const postedAt = batch.postedAt || batch.posted_at;
  const postedBy =
    batch.postedBy?.displayName ||
    batch.postedByName ||
    batch.postedBy ||
    null;
  const idem = batch.idempotencyKey || batch.idempotency_key;
  const audit = Array.isArray(batch.auditTrail) ? batch.auditTrail : null;

  const cards = [
    { id: 'posted', label: t('br.card.postedRows'), value: String(counts.postedRows) },
    batch.totalIn != null
      ? { id: 'in', label: t('br.card.totalIn'), value: formatSarLatn(batch.totalIn) }
      : null,
    batch.totalOut != null
      ? { id: 'out', label: t('br.card.totalOut'), value: formatSarLatn(batch.totalOut) }
      : null,
    { id: 'tr', label: t('br.card.transfers'), value: String(counts.transfers) },
    { id: 'je', label: t('br.card.journals'), value: String(counts.journals) },
  ].filter(Boolean);

  return (
    <div className="module-container batch-result-page" dir={dir}>
      <header style={{ marginBottom: 12 }}>
        <p className="form-help-text" style={{ marginBottom: 4 }}>
          <Link to="/workshop/accounting">{t('pcw.crumb.accounting')}</Link>
          {' / '}
          <Link to="/workshop/accounting/transactions">{t('tx.crumb.transactions')}</Link>
          {' / '}
          <Link to="/workshop/accounting/transactions/batches">{t('bb.crumb.batches')}</Link>
          {' / '}
          <span>{batch.batchNo || batchId}</span>
        </p>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0F172A' }}>
          {t('br.title', {
            no: batch.batchNo || batchId,
            status: String(batch.status || ''),
          })}
        </h2>
      </header>

      <div
        role="status"
        style={{
          marginBottom: 14,
          padding: '12px 14px',
          background: '#ECFDF5',
          border: '1px solid #A7F3D0',
          borderRadius: 10,
          color: '#065F46',
          fontSize: 13,
          lineHeight: 1.45,
        }}
      >
        ✅ {t('br.banner.batch')} <strong>{batch.batchNo || batchId}</strong>{' '}
        {t('br.banner.posted')}
        {postedAt ? ` ${String(postedAt).replace('T', ' ').slice(0, 16)} (Riyadh)` : ''}
        {postedBy ? ` ${t('br.banner.by')} ${postedBy}` : ''}
        {batch.postMode ? ` · ${t('br.banner.mode')}: ${batch.postMode}` : ''}
        {` · ${counts.postedRows} ${t('br.banner.rows')} · ${counts.journals} ${t('br.banner.journals')}`}
        {idem ? ` · ${t('br.banner.idem')} ${truncateIdempotencyKey(idem)}` : ''}
      </div>

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

      <div className="cash-bank-stats" style={{ marginBottom: 12 }}>
        {cards.map((c) => (
          <div key={c.id} className="acct-kpi-card">
            <div className="cash-bank-stat-icon">
              {c.id === 'tr' || c.id === 'je' ? (
                <ArrowLeftRight size={22} />
              ) : (
                <FileText size={22} />
              )}
            </div>
            <div>
              <p className="acct-kpi-label">{c.label}</p>
              <p className="acct-kpi-value">{c.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <button type="button" className="btn-portal-outline" onClick={printVouchers}>
          <Printer size={14} style={{ marginInlineEnd: 6 }} />
          {t('br.act.print')}
        </button>
        <button type="button" className="btn-portal-outline" onClick={exportCsv}>
          {t('br.act.export')}
        </button>
        <Link
          to="/workshop/accounting/transactions/batches"
          className="btn-portal-outline"
          style={{ textDecoration: 'none' }}
        >
          {t('br.act.allBatches')}
        </Link>
        <Link
          to="/workshop/accounting/transactions/batch/new"
          className="btn-submit btn-dark"
          style={{ textDecoration: 'none' }}
        >
          {t('br.act.newBatch')}
        </Link>
      </div>

      <WsTableScroll>
        <table className="ws-table" style={{ width: '100%', minWidth: 960 }}>
          <thead>
            <tr>
              <th className="table-th">#</th>
              <th className="table-th">{t('br.th.voucher')}</th>
              <th className="table-th">{t('br.th.journal')}</th>
              <th className="table-th">{t('br.th.type')}</th>
              <th className="table-th">{t('br.th.party')}</th>
              <th className="table-th">{t('br.th.drCr')}</th>
              <th className="table-th" style={{ textAlign: 'end' }}>
                {t('br.th.amount')}
              </th>
              <th className="table-th">{t('br.th.state')}</th>
              <th className="table-th" />
            </tr>
          </thead>
          <tbody>
            {(batch.rows || []).map((r) => (
              <tr key={`${r.lineNo}-${r.clientRowId}`}>
                <td className="table-cell">{r.lineNo}</td>
                <td className="table-cell">{r.voucherNumber || '—'}</td>
                <td className="table-cell">
                  {r.journalId ? (
                    <Link
                      to={`/workshop/accounting/journal-entries?id=${encodeURIComponent(r.journalId)}`}
                    >
                      {r.journalId}
                    </Link>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="table-cell">
                  {t(`bulk.type.${r.type || 'payment'}`)}
                </td>
                <td className="table-cell">{rowPartyLabel(r)}</td>
                <td className="table-cell" style={{ fontSize: 12 }}>
                  {rowDrCrHint(r)}
                </td>
                <td className="table-cell" style={{ textAlign: 'end' }}>
                  {formatSarLatn(rowAmountDisplay(r))}
                </td>
                <td className="table-cell">{stateChip(r.state, t)}</td>
                <td className="table-cell">
                  {showReverse && String(r.state).toLowerCase() === 'posted' ? (
                    <button
                      type="button"
                      className="btn-portal-outline"
                      style={{ fontSize: 12, padding: '4px 8px' }}
                      disabled={busy}
                      onClick={() => setConfirmRow(r.lineNo)}
                    >
                      {t('br.act.reverseRow')}
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </WsTableScroll>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
          gap: 16,
          marginTop: 16,
        }}
        className="batch-result-bottom"
      >
        {showReverse ? (
          <section
            className="acct-panel"
            style={{ padding: 14 }}
          >
            <h3 style={{ marginTop: 0, displaySize: 16 }}>
              <RotateCcw size={16} style={{ marginInlineEnd: 6 }} />
              {t('br.reverse.title')}
            </h3>
            <label style={{ display: 'block', marginBottom: 8 }}>
              <span className="form-help-text">{t('br.reverse.date')}</span>
              <input
                className="form-input"
                type="date"
                value={revDate}
                onChange={(e) => setRevDate(e.target.value)}
              />
            </label>
            <label style={{ display: 'block', marginBottom: 8 }}>
              <span className="form-help-text">{t('br.reverse.reason')}</span>
              <input
                className="form-input"
                value={revReason}
                onChange={(e) => setRevReason(e.target.value)}
                required
              />
            </label>
            <p className="form-help-text">{t('br.reverse.help')}</p>
            <button
              type="button"
              className="btn-submit btn-dark"
              disabled={busy || String(batch.status).toLowerCase() === 'reversed'}
              onClick={() => setConfirmBatch(true)}
            >
              {t('br.reverse.btn')}
            </button>
            {confirmBatch ? (
              <div
                role="alertdialog"
                style={{
                  marginTop: 10,
                  padding: 10,
                  background: '#FFFBEB',
                  border: '1px solid #F59E0B',
                  borderRadius: 8,
                }}
              >
                <p style={{ margin: '0 0 8px' }}>
                  {t('br.reverse.confirm', {
                    n: counts.postedRows,
                    out: formatSarLatn(batch.totalOut),
                    in: formatSarLatn(batch.totalIn),
                  })}
                </p>
                <button
                  type="button"
                  className="btn-submit btn-dark"
                  style={{ marginInlineEnd: 8 }}
                  disabled={busy}
                  onClick={doReverseBatch}
                >
                  {t('bulk.confirm.yes')}
                </button>
                <button
                  type="button"
                  className="btn-portal-outline"
                  onClick={() => setConfirmBatch(false)}
                >
                  {t('bulk.confirm.no')}
                </button>
              </div>
            ) : null}
            {confirmRow != null ? (
              <div
                role="alertdialog"
                style={{
                  marginTop: 10,
                  padding: 10,
                  background: '#FFFBEB',
                  border: '1px solid #F59E0B',
                  borderRadius: 8,
                }}
              >
                <p style={{ margin: '0 0 8px' }}>
                  {t('br.reverse.confirmRow', { n: confirmRow })}
                </p>
                <button
                  type="button"
                  className="btn-submit btn-dark"
                  style={{ marginInlineEnd: 8 }}
                  disabled={busy}
                  onClick={() => doReverseRow(confirmRow)}
                >
                  {t('bulk.confirm.yes')}
                </button>
                <button
                  type="button"
                  className="btn-portal-outline"
                  onClick={() => setConfirmRow(null)}
                >
                  {t('bulk.confirm.no')}
                </button>
              </div>
            ) : null}
          </section>
        ) : (
          <div />
        )}

        <section className="acct-panel" style={{ padding: 14 }}>
          <h3 style={{ marginTop: 0, fontSize: 16 }}>{t('br.audit.title')}</h3>
          {audit && audit.length > 0 ? (
            <WsTableScroll>
              <table className="ws-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th className="table-th">{t('br.audit.time')}</th>
                    <th className="table-th">{t('br.audit.user')}</th>
                    <th className="table-th">{t('br.audit.action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map((a, i) => (
                    <tr key={i}>
                      <td className="table-cell">{a.time || a.createdAt || '—'}</td>
                      <td className="table-cell">{a.user || a.userName || '—'}</td>
                      <td className="table-cell">{a.action || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </WsTableScroll>
          ) : (
            <p className="form-help-text" role="status">
              {t('br.audit.missing')}
            </p>
          )}
        </section>
      </div>

      <style>{`
        @media (max-width: 1100px) {
          .batch-result-bottom { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
