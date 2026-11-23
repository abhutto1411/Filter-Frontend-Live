import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link2, AlertTriangle, RefreshCw } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { accT } from '../../../utils/accountingI18n';
import { useAuth } from '../../../context/AuthContext';
import SearchableEntityCombobox from '../../../components/SearchableEntityCombobox';
import { PaginationControls } from '../../../components/PaginationControls';
import WsTableScroll from '../../../components/workshop/WsTableScroll';
import { getIntercompanyReport } from '../../../services/platformExpensesApi';
import { listJournalEntries } from '../../../services/workshopAccountingApi';
import {
  buildLinkedCards,
  buildLjReportQuery,
  emptyLjFilters,
  formatSarLatn,
  mapIcListRows,
  mapJournalLines,
  pickJournalByNumber,
  slicePage,
} from '../../../utils/hqLinkedJournalsDisplay';
import '../../../styles/admin/AccountingPage.css';

async function resolveJournal({ journalId, entryNumber, workshopId }) {
  if (journalId) {
    try {
      const res = await listJournalEntries({
        q: String(journalId),
        workshopId: workshopId || undefined,
        limit: 10,
      });
      const entries = Array.isArray(res?.entries) ? res.entries : [];
      const byId = entries.find((e) => String(e?.id) === String(journalId));
      if (byId) return byId;
    } catch {
      /* fall through to number search */
    }
  }
  if (!entryNumber) return null;
  const res = await listJournalEntries({
    q: String(entryNumber),
    workshopId: workshopId || undefined,
    limit: 25,
  });
  const entries = Array.isArray(res?.entries) ? res.entries : [];
  return pickJournalByNumber(entries, entryNumber);
}

function JournalPanel({
  title,
  entryNumber,
  refLabel,
  lines,
  balanced,
  page,
  onPage,
  loading,
  missing,
  t,
}) {
  const sliced = slicePage(lines, page, 25);
  return (
    <section className="acct-panel hq-lj-panel">
      <h3 className="hq-lj-panel-title">
        {title}
        {entryNumber ? ` · ${entryNumber}` : ''}
      </h3>
      {loading ? (
        <p className="form-help-text">{t('lj.loading')}</p>
      ) : missing ? (
        <p className="form-help-text" role="status">
          {t('lj.panel.needsBackend')}
        </p>
      ) : (
        <>
          <WsTableScroll>
            <table className="ws-table">
              <thead>
                <tr>
                  <th className="table-th">{t('lj.th.account')}</th>
                  <th className="table-th" style={{ textAlign: 'right' }}>
                    {t('lj.th.debit')}
                  </th>
                  <th className="table-th" style={{ textAlign: 'right' }}>
                    {t('lj.th.credit')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sliced.items.length === 0 ? (
                  <tr>
                    <td className="table-cell" colSpan={3}>
                      {t('lj.panel.emptyLines')}
                    </td>
                  </tr>
                ) : (
                  sliced.items.map((line) => (
                    <tr key={line.id}>
                      <td className="table-cell">{line.account}</td>
                      <td className="table-cell" style={{ textAlign: 'right' }}>
                        {Number(line.debit) ? formatSarLatn(line.debit) : ''}
                      </td>
                      <td className="table-cell" style={{ textAlign: 'right' }}>
                        {Number(line.credit) ? formatSarLatn(line.credit) : ''}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </WsTableScroll>
          <p className="form-help-text hq-lj-balanced">
            {balanced ? t('lj.balanced', { ref: refLabel || '—' }) : t('lj.unbalanced', { ref: refLabel || '—' })}
          </p>
          {sliced.total > 25 ? (
            <PaginationControls
              page={sliced.page}
              pageSize={25}
              total={sliced.total}
              onPageChange={onPage}
            />
          ) : null}
        </>
      )}
    </section>
  );
}

export default function HqLinkedJournalsPage({
  workshops = [],
  hqWorkshopId = '',
  locale: localeProp,
}) {
  const { hasPermission } = useAuth();
  const outletCtx = useOutletContext() || {};
  const locale =
    localeProp ||
    outletCtx.locale ||
    (typeof localStorage !== 'undefined'
      ? localStorage.getItem('portal-locale')
      : null) ||
    'en';
  const t = useCallback((key, vars) => accT(locale, key, vars), [locale]);
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  const canView =
    hasPermission('accounting.journal-entries.view') ||
    hasPermission('accounting.monitor.view') ||
    hasPermission('workshop.accounting.journal-entries.view') ||
    hasPermission('workshop.accounting.expenses.view');

  const workshopOpts = useMemo(
    () =>
      (Array.isArray(workshops) ? workshops : [])
        .filter((w) => w && !w.isPlatformHq)
        .map((w) => ({
          id: String(w.id),
          name: w.name || w.workshopCode || String(w.id),
          label: w.name || w.workshopCode || String(w.id),
        })),
    [workshops],
  );

  const [draft, setDraft] = useState(() => emptyLjFilters());
  const [applied, setApplied] = useState(() => emptyLjFilters());
  const [wsLabel, setWsLabel] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [listErr, setListErr] = useState('');
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState(null);

  const [hqEntry, setHqEntry] = useState(null);
  const [wsEntry, setWsEntry] = useState(null);
  const [hqLines, setHqLines] = useState([]);
  const [wsLines, setWsLines] = useState([]);
  const [hqPage, setHqPage] = useState(1);
  const [wsPage, setWsPage] = useState(1);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailErr, setDetailErr] = useState('');

  const cards = useMemo(() => buildLinkedCards(selected), [selected]);

  const loadList = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    setListErr('');
    try {
      const res = await getIntercompanyReport(buildLjReportQuery(applied, page));
      const mapped = mapIcListRows(res?.items);
      setRows(mapped);
      setTotal(Number(res?.total) || mapped.length);
      if (applied.search && mapped.length === 1) {
        setSelected(mapped[0]);
      }
    } catch (e) {
      setRows([]);
      setTotal(0);
      setListErr(e?.message || t('lj.err.list'));
    } finally {
      setLoading(false);
    }
  }, [applied, page, canView, t]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    let cancelled = false;
    async function loadDetail() {
      if (!selected) {
        setHqEntry(null);
        setWsEntry(null);
        setHqLines([]);
        setWsLines([]);
        setDetailErr('');
        return;
      }
      setDetailLoading(true);
      setDetailErr('');
      setHqPage(1);
      setWsPage(1);
      try {
        const [hq, ws] = await Promise.all([
          resolveJournal({
            journalId: selected.hqJournalId,
            entryNumber: selected.hqJournalNumber,
            workshopId: hqWorkshopId || undefined,
          }).catch(() => null),
          resolveJournal({
            journalId: selected.workshopJournalId,
            entryNumber: selected.workshopJournalNumber,
            workshopId: selected.workshopId || undefined,
          }).catch(() => null),
        ]);
        if (cancelled) return;
        setHqEntry(hq);
        setWsEntry(ws);
        setHqLines(mapJournalLines(hq));
        setWsLines(mapJournalLines(ws));
        if (!hq && !ws && (selected.hqJournalNumber || selected.workshopJournalNumber)) {
          setDetailErr(t('lj.err.detail'));
        }
      } catch (e) {
        if (!cancelled) {
          setHqEntry(null);
          setWsEntry(null);
          setHqLines([]);
          setWsLines([]);
          setDetailErr(e?.message || t('lj.err.detail'));
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    }
    loadDetail();
    return () => {
      cancelled = true;
    };
  }, [selected, hqWorkshopId, t]);

  function onApply(e) {
    e?.preventDefault?.();
    setPage(1);
    setSelected(null);
    setApplied({ ...draft, search: String(draft.search || '').trim() });
  }

  function onShowAll() {
    const cleared = emptyLjFilters();
    setDraft(cleared);
    setWsLabel('');
    setPage(1);
    setSelected(null);
    setApplied(cleared);
  }

  function onKeyFilter(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      onApply();
    }
    if (e.key === 'Escape' && selected) {
      setSelected(null);
    }
  }

  const bothLabel =
    cards.bothSides === 'posted'
      ? t('lj.card.posted')
      : cards.bothSides === 'partial'
        ? t('lj.card.partial')
        : t('lj.card.missing');
  const bothTone =
    cards.bothSides === 'posted'
      ? 'hq-lj-chip--ok'
      : cards.bothSides === 'partial'
        ? 'hq-lj-chip--warn'
        : 'hq-lj-chip--bad';

  if (!canView) {
    return (
      <div className="module-container" dir={dir}>
        <p role="alert">{t('lj.err.forbidden')}</p>
      </div>
    );
  }

  const rangeFrom = total === 0 ? 0 : (page - 1) * 25 + 1;
  const rangeTo = Math.min(page * 25, total);

  return (
    <div className="module-container hq-linked-journals-page" dir={dir}>
      <header style={{ marginBottom: 12 }}>
        <p className="form-help-text" style={{ marginBottom: 4 }}>
          {t('lj.crumb')}
        </p>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0F172A' }}>
          {t('lj.title')}
        </h2>
      </header>

      <form
        className="acct-filter-bar hq-lj-filter"
        onSubmit={onApply}
        onKeyDown={onKeyFilter}
        style={{ padding: 14, marginBottom: 12 }}
      >
        <div className="hq-lj-filter-row">
          <label style={{ flex: '1 1 200px' }}>
            <span className="form-help-text">{t('lj.filter.ref')}</span>
            <input
              className="form-input"
              value={draft.search}
              onChange={(e) =>
                setDraft((d) => ({ ...d, search: e.target.value }))
              }
              placeholder={t('lj.filter.refPh')}
            />
          </label>
          <label style={{ flex: '1 1 220px' }}>
            <span className="form-help-text">{t('lj.filter.workshop')}</span>
            <SearchableEntityCombobox
              options={workshopOpts}
              value={draft.workshopId}
              displayText={wsLabel}
              onDisplayTextChange={setWsLabel}
              onSelect={(opt) => {
                setDraft((d) => ({
                  ...d,
                  workshopId: opt?.id ? String(opt.id) : '',
                }));
                setWsLabel(opt?.name || opt?.label || '');
              }}
              placeholder={t('lj.filter.workshopPh')}
            />
          </label>
          <div className="hq-lj-filter-actions">
            <button type="submit" className="btn-submit btn-dark">
              {t('lj.filter.apply')}
            </button>
            <button
              type="button"
              className="btn-portal-outline"
              onClick={onShowAll}
            >
              {t('lj.filter.showAll')}
            </button>
          </div>
        </div>
      </form>

      {listErr ? (
        <div role="alert" className="sa-acc-empty" style={{ marginBottom: 12 }}>
          <AlertTriangle size={22} />
          <p>{listErr}</p>
          <button type="button" className="btn-portal-outline" onClick={loadList}>
            <RefreshCw size={14} style={{ marginInlineEnd: 6 }} />
            {t('lj.retry')}
          </button>
        </div>
      ) : null}

      {selected ? (
        <>
          <div className="hq-lj-cards acct-kpi-grid">
            <div className="acct-kpi-card">
              <div className="acct-kpi-label" title={t('lj.card.reference')}>{t('lj.card.reference')}</div>
              <div className="acct-kpi-value" title={cards.reference || '—'}>{cards.reference || '—'}</div>
            </div>
            <div className="acct-kpi-card">
              <div className="acct-kpi-label" title={t('lj.card.amount')}>{t('lj.card.amount')}</div>
              <div
                className="acct-kpi-value"
                title={
                  cards.amount != null
                    ? `${t('lj.sar')} ${formatSarLatn(cards.amount)}`
                    : '—'
                }
              >
                {cards.amount != null
                  ? `${t('lj.sar')} ${formatSarLatn(cards.amount)}`
                  : '—'}
              </div>
            </div>
            <div className="acct-kpi-card">
              <div className="acct-kpi-label" title={t('lj.card.bothSides')}>{t('lj.card.bothSides')}</div>
              <div className="acct-kpi-value" title={bothLabel}>
                <strong className={`hq-lj-chip ${bothTone}`}>{bothLabel}</strong>
              </div>
            </div>
            <div className="acct-kpi-card">
              <div className="acct-kpi-label" title={t('lj.card.linked')}>{t('lj.card.linked')}</div>
              <div className="acct-kpi-value" title={t('lj.card.linkedCount', { n: String(cards.linkedCount) })}>
                {t('lj.card.linkedCount', { n: String(cards.linkedCount) })}
              </div>
            </div>
          </div>

          {detailErr ? (
            <div role="alert" className="form-help-text" style={{ marginBottom: 8 }}>
              {detailErr}
            </div>
          ) : null}

          <div className="hq-lj-panels">
            <JournalPanel
              title={t('lj.panel.hq')}
              entryNumber={
                hqEntry?.entryNumber || cards.hqJournalNumber || null
              }
              refLabel={cards.reference}
              lines={hqLines}
              balanced={Boolean(hqEntry?.isBalanced)}
              page={hqPage}
              onPage={setHqPage}
              loading={detailLoading}
              missing={!detailLoading && !hqEntry}
              t={t}
            />
            <JournalPanel
              title={t('lj.panel.workshop')}
              entryNumber={
                wsEntry?.entryNumber || cards.workshopJournalNumber || null
              }
              refLabel={cards.reference}
              lines={wsLines}
              balanced={Boolean(wsEntry?.isBalanced)}
              page={wsPage}
              onPage={setWsPage}
              loading={detailLoading}
              missing={!detailLoading && !wsEntry}
              t={t}
            />
          </div>

          <p className="hq-lj-note" role="note">
            {t('lj.note')}
          </p>
        </>
      ) : (
        <section className="acct-panel" style={{ padding: 14 }}>
          <h3 style={{ marginTop: 0, fontSize: 16 }}>
            <Link2 size={16} style={{ marginInlineEnd: 6, verticalAlign: -2 }} />
            {t('lj.list.title')}
          </h3>
          {loading ? (
            <p className="form-help-text">{t('lj.loading')}</p>
          ) : rows.length === 0 ? (
            <p className="form-help-text">{t('lj.list.empty')}</p>
          ) : (
            <>
              <WsTableScroll>
                <table className="ws-table">
                  <thead>
                    <tr>
                      <th className="table-th">{t('lj.th.ref')}</th>
                      <th className="table-th">{t('lj.th.date')}</th>
                      <th className="table-th">{t('lj.th.workshop')}</th>
                      <th className="table-th" style={{ textAlign: 'right' }}>
                        {t('lj.th.amount')}
                      </th>
                      <th className="table-th">{t('lj.th.status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.ref}
                        className="hq-lj-row"
                        onClick={() => setSelected(row)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelected(row);
                          }
                        }}
                        tabIndex={0}
                        role="button"
                      >
                        <td className="table-cell">{row.ref}</td>
                        <td className="table-cell">{row.date || '—'}</td>
                        <td className="table-cell">
                          {row.workshopName || row.workshopId || '—'}
                        </td>
                        <td className="table-cell" style={{ textAlign: 'right' }}>
                          {row.amount != null
                            ? formatSarLatn(row.amount)
                            : '—'}
                        </td>
                        <td className="table-cell">{row.status || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </WsTableScroll>
              <p className="form-help-text">
                {t('lj.showing', {
                  a: String(rangeFrom),
                  b: String(rangeTo),
                  n: String(total),
                })}
              </p>
              <PaginationControls
                page={page}
                pageSize={25}
                total={total}
                onPageChange={setPage}
              />
            </>
          )}
        </section>
      )}
    </div>
  );
}
