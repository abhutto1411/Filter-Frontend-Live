import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Scale,
  Users,
} from 'lucide-react';
import {
  getCashierVarianceReport,
  lookupAccountingBranches,
  lookupAccountingCashiers,
} from '../../../services/workshopAccountingApi';
import {
  CASHIER_VARIANCE_PAGE_SIZE,
  buildApiQuery,
  filtersFromSearchParams,
  formatMoneyLatn,
  formatSessionStamp,
  formatSignedMoneyLatn,
  journalPostedLabel,
  mapSummaryCards,
  searchParamsFromFilters,
  showingRange,
  varianceTone,
} from '../../../utils/cashierVarianceDisplay';
import { accT } from '../../../utils/accountingI18n';
import MultiSelectSearchCombo from '../../../components/MultiSelectSearchCombo';
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

function toneColor(tone) {
  if (tone === 'bad') return '#DC2626';
  if (tone === 'ok') return '#16A34A';
  return '#0F172A';
}

function emptyFilters(defaultBranchIds = []) {
  return {
    branchIds: defaultBranchIds,
    cashierIds: [],
    from: '',
    to: '',
    openedFrom: '',
    openedTo: '',
    closedFrom: '',
    closedTo: '',
    type: 'all',
    page: 1,
  };
}

export default function WorkshopCashierVariancePage({
  locale: localeProp,
  branches: branchesProp = [],
  selectedBranchId: selectedBranchIdProp = 'all',
}) {
  const outletCtx = useOutletContext() || {};
  const locale =
    localeProp ||
    outletCtx.locale ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
    'en';
  const t = useCallback((key, vars) => accT(locale, key, vars), [locale]);
  const { hasPermission } = useAuth();
  const canView =
    hasPermission('workshop.pos-monitoring.view') ||
    hasPermission('workshop.accounting.ledger.view');

  const layoutBranch =
    selectedBranchIdProp || outletCtx.selectedBranchId || 'all';
  const defaultBranchIds = useMemo(
    () =>
      layoutBranch && layoutBranch !== 'all' ? [String(layoutBranch)] : [],
    [layoutBranch],
  );

  const [searchParams, setSearchParams] = useSearchParams();
  const applied = useMemo(() => {
    const fromUrl = filtersFromSearchParams(searchParams);
    if (
      !searchParams.get('branchIds') &&
      defaultBranchIds.length &&
      !fromUrl.branchIds.length
    ) {
      return { ...fromUrl, branchIds: defaultBranchIds };
    }
    return fromUrl;
  }, [searchParams, defaultBranchIds]);

  const [draft, setDraft] = useState(() => ({ ...applied }));
  const draftCashierBranchId = draft.branchIds?.[0] || '';
  const [openedMode, setOpenedMode] = useState(
    applied.openedFrom || applied.openedTo ? 'range' : 'any',
  );
  const [closedMode, setClosedMode] = useState(
    applied.closedFrom || applied.closedTo ? 'range' : 'any',
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [payload, setPayload] = useState(null);
  const [branchOpts, setBranchOpts] = useState([]);
  const [cashierOpts, setCashierOpts] = useState([]);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    setDraft({ ...applied });
    setOpenedMode(applied.openedFrom || applied.openedTo ? 'range' : 'any');
    setClosedMode(applied.closedFrom || applied.closedTo ? 'range' : 'any');
  }, [applied]);

  const loadLookups = useCallback(async () => {
    try {
      const [br, ca] = await Promise.all([
        lookupAccountingBranches({}).catch((err) => {
          if (Number(err?.status) === 404 || Number(err?.status) === 403) {
            return { items: [] };
          }
          throw err;
        }),
        lookupAccountingCashiers({
          branchId: draftCashierBranchId || undefined,
        }).catch((err) => {
          if (Number(err?.status) === 404 || Number(err?.status) === 403) {
            return { items: [] };
          }
          throw err;
        }),
      ]);
      const brItems = Array.isArray(br?.items) ? br.items : [];
      const caItems = Array.isArray(ca?.items) ? ca.items : [];
      if (brItems.length) {
        setBranchOpts(
          brItems.map((b) => ({
            id: String(b.id),
            label: b.name || String(b.id),
          })),
        );
      } else if (branchesProp?.length) {
        setBranchOpts(
          branchesProp.map((b) => ({
            id: String(b.id ?? b.value),
            label: b.name || b.label || String(b.id),
          })),
        );
      }
      setCashierOpts(
        caItems.map((c) => ({
          id: String(c.id),
          label: c.name || String(c.id),
        })),
      );
    } catch {
      if (branchesProp?.length) {
        setBranchOpts(
          branchesProp.map((b) => ({
            id: String(b.id ?? b.value),
            label: b.name || b.label || String(b.id),
          })),
        );
      }
    }
  }, [draftCashierBranchId, branchesProp]);

  useEffect(() => {
    void loadLookups();
  }, [loadLookups]);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getCashierVarianceReport(buildApiQuery(applied));
      const root = res?.data && typeof res.data === 'object' && !Array.isArray(res.data)
        ? res.data
        : res;
      setPayload(root && typeof root === 'object' ? root : null);
    } catch (e) {
      const status = Number(e?.status);
      if (status === 404 || status === 403) {
        setPayload(null);
        setError(t('cv.err.unavailable'));
      } else {
        setPayload(null);
        setError(e?.message || t('cv.err.load'));
      }
    } finally {
      setLoading(false);
    }
  }, [applied, t]);

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    void loadReport();
  }, [canView, loadReport]);

  function writeFilters(next) {
    const cleaned = { ...next };
    if (openedMode === 'any') {
      cleaned.openedFrom = '';
      cleaned.openedTo = '';
    }
    if (closedMode === 'any') {
      cleaned.closedFrom = '';
      cleaned.closedTo = '';
    }
    const params = searchParamsFromFilters(cleaned);
    setSearchParams(params, { replace: true });
  }

  function onApply(e) {
    e?.preventDefault?.();
    writeFilters({ ...draft, page: 1 });
  }

  function onShowAll() {
    setOpenedMode('any');
    setClosedMode('any');
    const cleared = emptyFilters([]);
    setDraft(cleared);
    setSearchParams({}, { replace: true });
  }

  function onPageChange(offset) {
    const page = Math.floor(offset / CASHIER_VARIANCE_PAGE_SIZE) + 1;
    writeFilters({ ...applied, page });
  }

  if (!canView) {
    return (
      <div role="alert" style={{ padding: 16, color: '#64748B' }}>
        {t('cv.noPermission')}
      </div>
    );
  }

  const cards = mapSummaryCards(payload?.summary);
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  const total = Number(payload?.total) || 0;
  const page = Number(payload?.page) || applied.page || 1;
  const pageSize = Number(payload?.pageSize) || CASHIER_VARIANCE_PAGE_SIZE;
  const range = showingRange(page, pageSize, total);
  const offset = (page - 1) * pageSize;

  return (
    <div dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <div style={{ marginBottom: 8, fontSize: '0.8rem', color: '#64748B' }}>
        {t('cv.breadcrumb')}
      </div>
      <h2 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 800, color: '#0F172A' }}>
        {t('cv.title')}
      </h2>

      <form className="acct-filter-bar" onSubmit={onApply}>
        <div style={{ ...fieldWrap, minWidth: 200 }}>
          <label style={labelStyle} htmlFor="cv-branch">
            {t('cv.filter.branch')}
          </label>
          <MultiSelectSearchCombo
            options={branchOpts}
            value={draft.branchIds}
            onChange={(ids) => setDraft((d) => ({ ...d, branchIds: ids.map(String) }))}
            placeholder={t('cv.filter.branchPh')}
            emptyHint={t('cv.filter.noMatch')}
            clearLabel={t('cv.filter.clear')}
            removeLabel={t('cv.filter.remove')}
          />
        </div>
        <div style={{ ...fieldWrap, minWidth: 200 }}>
          <label style={labelStyle} htmlFor="cv-cashier">
            {t('cv.filter.cashier')}
          </label>
          <MultiSelectSearchCombo
            options={cashierOpts}
            value={draft.cashierIds}
            onChange={(ids) => setDraft((d) => ({ ...d, cashierIds: ids.map(String) }))}
            placeholder={t('cv.filter.cashierPh')}
            emptyHint={t('cv.filter.noMatch')}
            clearLabel={t('cv.filter.clear')}
            removeLabel={t('cv.filter.remove')}
          />
        </div>
        <div style={fieldWrap}>
          <label style={labelStyle} htmlFor="cv-from">
            {t('cv.filter.from')}
          </label>
          <input
            id="cv-from"
            type="date"
            style={inputStyle}
            value={draft.from}
            onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
          />
        </div>
        <div style={fieldWrap}>
          <label style={labelStyle} htmlFor="cv-to">
            {t('cv.filter.to')}
          </label>
          <input
            id="cv-to"
            type="date"
            style={inputStyle}
            value={draft.to}
            onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
          />
        </div>
        <div style={fieldWrap}>
          <label style={labelStyle} htmlFor="cv-opened-mode">
            {t('cv.filter.opened')}
          </label>
          <select
            id="cv-opened-mode"
            style={inputStyle}
            value={openedMode}
            onChange={(e) => {
              const v = e.target.value;
              setOpenedMode(v);
              if (v === 'any') {
                setDraft((d) => ({ ...d, openedFrom: '', openedTo: '' }));
              }
            }}
          >
            <option value="any">{t('cv.filter.any')}</option>
            <option value="range">{t('cv.filter.range')}</option>
          </select>
        </div>
        {openedMode === 'range' ? (
          <>
            <div style={fieldWrap}>
              <label style={labelStyle} htmlFor="cv-opened-from">
                {t('cv.filter.openedFrom')}
              </label>
              <input
                id="cv-opened-from"
                type="date"
                style={inputStyle}
                value={draft.openedFrom}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, openedFrom: e.target.value }))
                }
              />
            </div>
            <div style={fieldWrap}>
              <label style={labelStyle} htmlFor="cv-opened-to">
                {t('cv.filter.openedTo')}
              </label>
              <input
                id="cv-opened-to"
                type="date"
                style={inputStyle}
                value={draft.openedTo}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, openedTo: e.target.value }))
                }
              />
            </div>
          </>
        ) : null}
        <div style={fieldWrap}>
          <label style={labelStyle} htmlFor="cv-closed-mode">
            {t('cv.filter.closed')}
          </label>
          <select
            id="cv-closed-mode"
            style={inputStyle}
            value={closedMode}
            onChange={(e) => {
              const v = e.target.value;
              setClosedMode(v);
              if (v === 'any') {
                setDraft((d) => ({ ...d, closedFrom: '', closedTo: '' }));
              }
            }}
          >
            <option value="any">{t('cv.filter.any')}</option>
            <option value="range">{t('cv.filter.range')}</option>
          </select>
        </div>
        {closedMode === 'range' ? (
          <>
            <div style={fieldWrap}>
              <label style={labelStyle} htmlFor="cv-closed-from">
                {t('cv.filter.closedFrom')}
              </label>
              <input
                id="cv-closed-from"
                type="date"
                style={inputStyle}
                value={draft.closedFrom}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, closedFrom: e.target.value }))
                }
              />
            </div>
            <div style={fieldWrap}>
              <label style={labelStyle} htmlFor="cv-closed-to">
                {t('cv.filter.closedTo')}
              </label>
              <input
                id="cv-closed-to"
                type="date"
                style={inputStyle}
                value={draft.closedTo}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, closedTo: e.target.value }))
                }
              />
            </div>
          </>
        ) : null}
        <div style={fieldWrap}>
          <span style={labelStyle}>{t('cv.filter.type')}</span>
          <div style={{ display: 'flex', gap: 4 }} role="group" aria-label={t('cv.filter.type')}>
            {['all', 'shortage', 'overage'].map((k) => (
              <button
                key={k}
                type="button"
                className={
                  draft.type === k ? 'btn-submit btn-dark' : 'btn-portal-outline'
                }
               
                onClick={() => setDraft((d) => ({ ...d, type: k }))}
              >
                {t(`cv.type.${k}`)}
              </button>
            ))}
          </div>
        </div>
        <button type="submit" className="btn-submit btn-dark">
          {t('cv.filter.apply')}
        </button>
        <button
          type="button"
          className="btn-portal-outline"
         
          onClick={onShowAll}
        >
          {t('cv.filter.showAll')}
        </button>
      </form>

      <div className="acct-kpi-grid">
        {[
          {
            key: 'sessions',
            label: t('cv.card.sessions'),
            value: cards.sessions,
            icon: Users,
            color: '#0F172A',
          },
          {
            key: 'shortages',
            label: t('cv.card.shortages'),
            value: cards.shortages != null ? formatMoneyLatn(cards.shortages) : null,
            prefix: 'SAR ',
            icon: ArrowDownRight,
            color: '#DC2626',
          },
          {
            key: 'overages',
            label: t('cv.card.overages'),
            value: cards.overages != null ? formatMoneyLatn(cards.overages) : null,
            prefix: 'SAR ',
            icon: ArrowUpRight,
            color: '#16A34A',
          },
          {
            key: 'net',
            label: t('cv.card.net'),
            value: cards.net != null ? formatSignedMoneyLatn(cards.net) : null,
            prefix: 'SAR ',
            icon: Scale,
            color: toneColor(varianceTone(cards.net)),
          },
        ].map((c) => {
          if (c.value == null && !loading) return null;
          const Icon = c.icon;
          const shown =
            loading && c.value == null
              ? '…'
              : c.value == null
                ? '—'
                : c.prefix
                  ? locale === 'ar'
                    ? `${c.value} ${t('cv.sar')}`
                    : `SAR ${c.value}`
                  : c.value;
          return (
            <div key={c.key} className="acct-kpi-card acct-kpi-card--with-icon">
              <div className="acct-kpi-icon" style={{ color: c.color }}>
                <Icon size={16} color={c.color} aria-hidden />
              </div>
              <div className="acct-kpi-body">
                <div className="acct-kpi-label" title={c.label}>
                  {c.label}
                </div>
                <div className="acct-kpi-value" title={String(shown)} style={{ color: c.color }}>
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
          <button type="button" className="btn-portal-outline" onClick={() => void loadReport()}>
            {t('cv.retry')}
          </button>
        </div>
      ) : null}

      {loading && !payload ? (
        <div style={{ padding: 24, color: '#64748B' }}>{t('cv.loading')}</div>
      ) : null}

      {!loading && !error && rows.length === 0 ? (
        <div style={{ padding: 24, color: '#64748B' }}>{t('cv.empty')}</div>
      ) : null}

      {rows.length > 0 ? (
        <>
          <WsTableScroll>
            <table className="ws-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th className="table-th">{t('cv.col.branch')}</th>
                  <th className="table-th">{t('cv.col.cashier')}</th>
                  <th className="table-th">{t('cv.col.opened')}</th>
                  <th className="table-th">{t('cv.col.closed')}</th>
                  <th className="table-th" style={{ textAlign: 'end' }}>
                    {t('cv.col.expected')}
                  </th>
                  <th className="table-th" style={{ textAlign: 'end' }}>
                    {t('cv.col.counted')}
                  </th>
                  <th className="table-th" style={{ textAlign: 'end' }}>
                    {t('cv.col.variance')}
                  </th>
                  <th className="table-th">{t('cv.col.postedTo')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const id = String(row.closingId || row.sessionId);
                  const tone = varianceTone(row.variance);
                  const posted = journalPostedLabel(row);
                  const open = expandedId === id;
                  return (
                    <React.Fragment key={id}>
                      <tr
                        style={{ cursor: 'pointer' }}
                        onClick={() => setExpandedId(open ? null : id)}
                      >
                        <td className="table-cell">{row.branchName || '—'}</td>
                        <td className="table-cell">{row.cashierName || '—'}</td>
                        <td className="table-cell">{formatSessionStamp(row.openedAt)}</td>
                        <td className="table-cell">{formatSessionStamp(row.closedAt)}</td>
                        <td className="table-cell" style={{ textAlign: 'end' }}>
                          {formatMoneyLatn(row.expectedCash)}
                        </td>
                        <td className="table-cell" style={{ textAlign: 'end' }}>
                          {formatMoneyLatn(row.countedCash)}
                        </td>
                        <td
                          className="table-cell"
                          style={{ textAlign: 'end', color: toneColor(tone), fontWeight: 700 }}
                        >
                          {formatSignedMoneyLatn(row.variance)}
                        </td>
                        <td className="table-cell">
                          {posted.kind === 'queued' ? (
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: 6,
                                background: '#FEF3C7',
                                color: '#92400E',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                              }}
                            >
                              {t('cv.queued')}
                            </span>
                          ) : posted.kind === 'posted' && posted.journalId ? (
                            <Link
                              to={`/workshop/accounting/journal-entries`}
                              onClick={(e) => e.stopPropagation()}
                              style={{ color: '#2563EB' }}
                            >
                              {posted.text}
                            </Link>
                          ) : (
                            posted.text || '—'
                          )}
                        </td>
                      </tr>
                      {open ? (
                        <tr>
                          <td
                            className="table-cell"
                            colSpan={8}
                            style={{ background: '#F8FAFC', fontSize: '0.85rem' }}
                          >
                            <div>
                              {t('cv.detail.session')}: {row.sessionId || '—'}
                            </div>
                            <div>
                              {t('cv.detail.closing')}: {row.closingId || '—'}
                            </div>
                            <div>
                              {t('cv.detail.journalStatus')}: {row.journalStatus || '—'}
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </WsTableScroll>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              marginTop: 12,
            }}
          >
            <div style={{ fontSize: '0.85rem', color: '#64748B' }}>
              {t('cv.showing', {
                a: String(range.from),
                b: String(range.to),
                n: String(range.total),
              })}
            </div>
            <PaginationControls
              total={total}
              limit={pageSize}
              offset={offset}
              onPageChange={onPageChange}
              loading={loading}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
