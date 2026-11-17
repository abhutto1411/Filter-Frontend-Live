import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import {
  AlertTriangle,
  Building2,
  Clock,
  Landmark,
  RefreshCw,
  Users,
  Wallet,
} from 'lucide-react';
import { getLockerCitSummary } from '../../../services/lockerCitApi';
import { apiFetch } from '../../../services/api';
import {
  LOCKER_CIT_PAGE_SIZE,
  citCoverageTone,
  citResponseMatchesApplied,
  daysHeldTone,
  formatCitMoneyLatn,
  formatCitStamp,
  mapCitOverviewCards,
} from '../../../utils/lockerCitDisplay';
import { toRiyadhDateISO } from '../../../utils/riyadhBusinessRange';
import { accT } from '../../../utils/accountingI18n';
import SearchableEntityCombobox from '../../../components/SearchableEntityCombobox';
import { PaginationControls } from '../../../components/PaginationControls';
import WsTableScroll from '../../../components/workshop/WsTableScroll';
import { useAuth } from '../../../context/AuthContext';

const filterBarStyle = {
  background: '#fff',
  border: '1px solid #E2E8F0',
  borderRadius: 10,
  padding: 14,
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  alignItems: 'flex-end',
  marginBottom: 16,
};

const fieldWrap = { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 140 };
const labelStyle = { fontSize: '0.75rem', fontWeight: 600, color: '#64748B' };
const inputStyle = {
  height: 36,
  borderRadius: 8,
  border: '1px solid #CBD5E1',
  padding: '0 10px',
  fontSize: '0.875rem',
  background: '#fff',
};

const cardGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
  gap: 12,
  marginBottom: 16,
};

function toneColor(tone) {
  if (tone === 'bad') return '#DC2626';
  if (tone === 'warn') return '#D97706';
  if (tone === 'ok') return '#16A34A';
  return '#0F172A';
}

function emptyFilters(branchDefault = '') {
  const today = toRiyadhDateISO(new Date());
  return {
    officerUserId: '',
    branchId: branchDefault,
    aging: 'any',
    from: today,
    to: today,
    generation: `cit-${Date.now()}`,
    page: 1,
  };
}

function StatCard({ icon: Icon, label, value, meta, tone = 'neutral' }) {
  if (value == null) return null;
  return (
    <div className="cash-bank-stat-card" style={{ padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        {Icon ? <Icon size={16} color="#64748B" /> : null}
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B' }}>{label}</span>
      </div>
      <div style={{ fontSize: '1.15rem', fontWeight: 700, color: toneColor(tone) }}>{value}</div>
      {meta ? (
        <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: 4 }}>{meta}</div>
      ) : null}
    </div>
  );
}

/**
 * Shared CIT overview (mockup 31) — Accounting route + Locker Management embed.
 */
export default function WorkshopLockerCitOverviewPage({
  locale: localeProp,
  branches: branchesProp = [],
  selectedBranchId: selectedBranchIdProp = 'all',
  embedded = false,
  onOpenRecord,
  onOpenWallet,
}) {
  const outletCtx = useOutletContext() || {};
  const locale =
    localeProp ||
    outletCtx.locale ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
    'en';
  const t = useCallback((key, vars) => accT(locale, key, vars), [locale]);
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canView =
    hasPermission('workshop.locker-management.view') ||
    hasPermission('workshop.locker-management.cash-in-transit.view') ||
    hasPermission('workshop.locker-management.collections.view');
  const canReceive =
    hasPermission('workshop.locker-management.cash-in-transit.receive') ||
    hasPermission('workshop.locker-management.collections.create') ||
    hasPermission('workshop.locker-management.view');

  const layoutBranch =
    selectedBranchIdProp || outletCtx.selectedBranchId || 'all';
  const branchDefault =
    layoutBranch && layoutBranch !== 'all' ? String(layoutBranch) : '';

  const [draft, setDraft] = useState(() => emptyFilters(branchDefault));
  const [applied, setApplied] = useState(() => emptyFilters(branchDefault));
  const [officerDisplay, setOfficerDisplay] = useState('');
  const [branchDisplay, setBranchDisplay] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [payload, setPayload] = useState(null);
  const [officers, setOfficers] = useState([]);
  const [branchOptions, setBranchOptions] = useState([]);

  useEffect(() => {
    setDraft((d) => ({ ...d, branchId: branchDefault }));
    setApplied((a) => ({ ...a, branchId: branchDefault, page: 1 }));
  }, [branchDefault]);

  useEffect(() => {
    const fromActors = Array.isArray(payload?.actors) ? payload.actors : [];
    const fromRows = Array.isArray(payload?.officers) ? payload.officers : [];
    const byId = new Map();
    for (const row of fromRows) {
      const id = String(row?.officer?.id || row?.officerId || '');
      if (!id) continue;
      byId.set(id, {
        id,
        label: row?.officer?.name || row?.officer?.email || id,
      });
    }
    for (const a of fromActors) {
      const id = String(a?.officerId || '');
      if (!id || byId.has(id)) continue;
      byId.set(id, { id, label: id });
    }
    setOfficers([...byId.values()]);
  }, [payload]);

  useEffect(() => {
    const fromProp = Array.isArray(branchesProp) ? branchesProp : [];
    if (fromProp.length) {
      setBranchOptions(
        fromProp.map((b) => ({ id: String(b.id), label: b.name || String(b.id) })),
      );
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch('/locker/branches');
        const list = Array.isArray(res?.branches) ? res.branches : [];
        if (!cancelled) {
          setBranchOptions(
            list.map((b) => ({ id: String(b.id), label: b.name || String(b.id) })),
          );
        }
      } catch {
        if (!cancelled) setBranchOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [branchesProp]);

  const load = useCallback(async () => {
    if (!canView) return;
    const generation = applied.generation || `cit-${Date.now()}`;
    setLoading(true);
    setError(null);
    setPayload(null);
    try {
      const offset = (Math.max(1, applied.page) - 1) * LOCKER_CIT_PAGE_SIZE;
      const res = await getLockerCitSummary({
        officerUserId: applied.officerUserId || undefined,
        branchId: applied.branchId || undefined,
        aging: applied.aging && applied.aging !== 'any' ? applied.aging : undefined,
        from: applied.from || undefined,
        to: applied.to || undefined,
        generation,
        offset,
        limit: LOCKER_CIT_PAGE_SIZE,
      });
      if (!citResponseMatchesApplied(res?.scope, { ...applied, generation })) {
        return;
      }
      setPayload(res && typeof res === 'object' ? res : null);
    } catch (err) {
      const status = Number(err?.status);
      if (status === 404) {
        setError(t('cit.error.notDeployed'));
      } else if (status === 403) {
        setError(t('cit.error.forbidden'));
      } else if (err?.code === 'CIT_RANGE_INVALID' || err?.code === 'CIT_RANGE_INCOMPLETE') {
        setError(t('cit.error.range'));
      } else {
        setError(err?.message || t('cit.error.load'));
      }
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [applied, canView, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const cards = useMemo(
    () => mapCitOverviewCards(payload?.summary, payload?.coverage),
    [payload],
  );
  const rows = Array.isArray(payload?.officers) ? payload.officers : [];
  const total = Number(payload?.total ?? rows.length) || 0;
  const page = Math.max(1, applied.page);
  const offset = (page - 1) * LOCKER_CIT_PAGE_SIZE;
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + LOCKER_CIT_PAGE_SIZE, total);
  const officerComboOptions = useMemo(
    () => [{ id: 'all', label: t('cit.filter.allOfficers') }, ...officers],
    [officers, t],
  );
  const branchComboOptions = useMemo(
    () => [{ id: 'all', label: t('cit.filter.allBranches') }, ...branchOptions],
    [branchOptions, t],
  );

  const openWallet = (officerId) => {
    if (onOpenWallet) {
      onOpenWallet(officerId);
      return;
    }
    navigate(`/workshop/accounting/locker-cash-in-transit/officers/${officerId}`);
  };

  const goRecord = () => {
    if (onOpenRecord) {
      onOpenRecord();
      return;
    }
    navigate('/workshop/accounting/locker-cash-in-transit/record');
  };

  const applyFilters = (e) => {
    e?.preventDefault?.();
    setApplied({ ...draft, page: 1, generation: `cit-${Date.now()}` });
  };

  const showAll = () => {
    const cleared = emptyFilters(branchDefault);
    setDraft(cleared);
    setApplied(cleared);
    setOfficerDisplay('');
    setBranchDisplay('');
  };

  if (!canView) {
    return (
      <div role="alert" style={{ padding: 24, color: '#B91C1C' }}>
        {t('cit.error.forbidden')}
      </div>
    );
  }

  return (
    <div className="locker-cit-overview" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      {!embedded ? (
        <div style={{ fontSize: '0.8rem', color: '#64748B', marginBottom: 8 }}>
          {t('cit.breadcrumb')}
        </div>
      ) : null}

      <div
        className="ws-page-header"
        style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}
      >
        <div>
          <h2 className="ws-page-title" style={{ margin: 0 }}>
            {t('cit.overview.title')}
          </h2>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {canReceive ? (
            <button type="button" className="btn-submit btn-dark" onClick={goRecord}>
              {t('cit.btn.recordCollection')}
            </button>
          ) : null}
          <button
            type="button"
            className="btn-portal-outline"
            onClick={() => void load()}
            disabled={loading}
            aria-label={t('cit.btn.refresh')}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      <div style={cardGrid}>
        <StatCard
          icon={Landmark}
          label={t('cit.card.vault')}
          value={cards.vaultCash != null ? `SAR ${formatCitMoneyLatn(cards.vaultCash)}` : null}
        />
        <StatCard
          icon={Wallet}
          label={t('cit.card.inTransit')}
          value={
            cards.totalInTransit != null
              ? `SAR ${formatCitMoneyLatn(cards.totalInTransit)}`
              : null
          }
        />
        <StatCard
          icon={Users}
          label={t('cit.card.officers')}
          value={cards.officers}
        />
        <StatCard
          icon={Clock}
          label={t('cit.card.heldOver')}
          value={
            cards.over3Days != null
              ? cards.over3DaysAmount != null
                ? `${cards.over3Days} · SAR ${formatCitMoneyLatn(cards.over3DaysAmount)}`
                : cards.over3Days
              : null
          }
          tone={Number(cards.over3Days) > 0 ? 'bad' : 'neutral'}
        />
        <StatCard
          icon={AlertTriangle}
          label={t('cit.card.pendingVariances')}
          value={cards.pendingVariances}
          tone={Number(cards.pendingVariances) > 0 ? 'warn' : 'neutral'}
        />
      </div>
      {payload?.coverage?.status ? (
        <p
          role="status"
          style={{
            margin: '0 0 12px',
            fontSize: '0.85rem',
            color: toneColor(citCoverageTone(payload.coverage.status)),
          }}
        >
          {t(`cit.coverage.${payload.coverage.status}`)}
          {payload.scope?.fromYmd
            ? ` · ${t('cit.scope.asOf')} ${payload.scope.fromYmd} → ${payload.scope.toYmd}`
            : ''}
          {payload.bridge?.status && payload.bridge.status !== 'ok'
            ? ` · ${t(`cit.bridge.${payload.bridge.status}`)}`
            : ''}
        </p>
      ) : null}

      <form style={filterBarStyle} onSubmit={applyFilters}>
        <div style={fieldWrap}>
          <label style={labelStyle} htmlFor="cit-officer">
            {t('cit.filter.officer')}
          </label>
          <SearchableEntityCombobox
            id="cit-officer"
            options={officerComboOptions}
            value={draft.officerUserId || 'all'}
            displayText={officerDisplay}
            onDisplayTextChange={setOfficerDisplay}
            onSelect={(opt) => {
              const next = !opt?.id || opt.id === 'all' ? '' : String(opt.id);
              setDraft((d) => ({ ...d, officerUserId: next }));
              setOfficerDisplay('');
            }}
            placeholder={t('cit.filter.allOfficers')}
            entityLabel="officer"
            maxInitial={80}
            maxFiltered={120}
            menuMinWidth={220}
          />
        </div>
        <div style={fieldWrap}>
          <label style={labelStyle} htmlFor="cit-branch">
            {t('cit.filter.branch')}
          </label>
          <SearchableEntityCombobox
            id="cit-branch"
            options={branchComboOptions}
            value={draft.branchId || 'all'}
            displayText={branchDisplay}
            onDisplayTextChange={setBranchDisplay}
            onSelect={(opt) => {
              const next = !opt?.id || opt.id === 'all' ? '' : String(opt.id);
              setDraft((d) => ({ ...d, branchId: next }));
              setBranchDisplay('');
            }}
            placeholder={t('cit.filter.allBranches')}
            entityLabel="branch"
            maxInitial={80}
            maxFiltered={120}
            menuMinWidth={220}
          />
        </div>
        <div style={fieldWrap}>
          <label style={labelStyle} htmlFor="cit-aging">
            {t('cit.filter.aging')}
          </label>
          <select
            id="cit-aging"
            style={inputStyle}
            value={draft.aging}
            onChange={(e) => setDraft((d) => ({ ...d, aging: e.target.value }))}
          >
            <option value="any">{t('cit.filter.agingAny')}</option>
            <option value="0-1">{t('cit.filter.aging01')}</option>
            <option value="2-3">{t('cit.filter.aging23')}</option>
            <option value="4-7">{t('cit.filter.aging47')}</option>
            <option value=">7">{t('cit.filter.aging7')}</option>
          </select>
        </div>
        <div style={fieldWrap}>
          <label style={labelStyle} htmlFor="cit-from">
            {t('cit.filter.from')}
          </label>
          <input
            id="cit-from"
            type="date"
            style={inputStyle}
            value={draft.from}
            onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
          />
        </div>
        <div style={fieldWrap}>
          <label style={labelStyle} htmlFor="cit-to">
            {t('cit.filter.to')}
          </label>
          <input
            id="cit-to"
            type="date"
            style={inputStyle}
            value={draft.to}
            onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
          />
        </div>
        <button type="submit" className="btn-submit btn-dark">
          {t('cit.btn.apply')}
        </button>
        <button type="button" className="btn-portal-outline" onClick={showAll}>
          {t('cit.btn.showAll')}
        </button>
      </form>

      {error ? (
        <div role="alert" style={{ marginBottom: 12, color: '#B91C1C' }}>
          {error}{' '}
          <button type="button" className="btn-portal-outline" onClick={() => void load()}>
            {t('cit.btn.retry')}
          </button>
        </div>
      ) : null}

      {loading && !payload ? (
        <p style={{ color: '#64748B' }}>{t('cit.loading')}</p>
      ) : null}

      {!loading && !error && rows.length === 0 ? (
        <div className="ws-section" style={{ padding: 24, textAlign: 'center', color: '#9CA3AF' }}>
          {t('cit.empty.officers')}
        </div>
      ) : null}

      {rows.length > 0 ? (
        <>
          <WsTableScroll>
            <table className="ws-table">
              <thead>
                <tr>
                  <th className="table-th">{t('cit.col.officer')}</th>
                  <th className="table-th">{t('cit.col.wallet')}</th>
                  <th className="table-th">{t('cit.col.branches')}</th>
                  <th className="table-th" style={{ textAlign: 'end' }}>
                    {t('cit.col.open')}
                  </th>
                  <th className="table-th" style={{ textAlign: 'end' }}>
                    {t('cit.col.amount')}
                  </th>
                  <th className="table-th">{t('cit.col.oldest')}</th>
                  <th className="table-th">{t('cit.col.lastHandover')}</th>
                  <th className="table-th" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const oid = String(row?.officer?.id || row?.officerId || '');
                  const oldest = row?.oldestDays;
                  const tone = daysHeldTone(oldest);
                  const walletCode = row?.walletAccount || row?.accountCode || null;
                  const lastHandover = row?.lastHandoverAt || row?.lastHandover || null;
                  return (
                    <tr key={oid || JSON.stringify(row)}>
                      <td className="table-cell">{row?.officer?.name || t('cit.emdash')}</td>
                      <td className="table-cell">
                        {walletCode != null ? walletCode : t('cit.emdash')}
                      </td>
                      <td className="table-cell">
                        {Array.isArray(row?.branches) && row.branches.length
                          ? row.branches.join(', ')
                          : t('cit.emdash')}
                      </td>
                      <td className="table-cell" style={{ textAlign: 'end' }}>
                        {row?.openCount != null ? String(row.openCount) : t('cit.emdash')}
                      </td>
                      <td className="table-cell" style={{ textAlign: 'end' }}>
                        {row?.amount != null
                          ? formatCitMoneyLatn(row.amount)
                          : t('cit.emdash')}
                      </td>
                      <td className="table-cell" style={{ color: toneColor(tone), fontWeight: 600 }}>
                        {oldest != null
                          ? t('cit.days', { n: String(oldest) })
                          : t('cit.emdash')}
                      </td>
                      <td className="table-cell">
                        {lastHandover
                          ? formatCitStamp(lastHandover, true)
                          : t('cit.emdash')}
                      </td>
                      <td className="table-cell">
                        {oid ? (
                          <button
                            type="button"
                            className="btn-portal-outline"
                            onClick={() => openWallet(oid)}
                          >
                            {t('cit.btn.openWallet')}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </WsTableScroll>
          <div style={{ marginTop: 8, fontSize: '0.85rem', color: '#64748B' }}>
            {t('cit.showing', { a: String(from), b: String(to), n: String(total) })}
          </div>
          <PaginationControls
            total={total}
            limit={LOCKER_CIT_PAGE_SIZE}
            offset={offset}
            loading={loading}
            onPageChange={(nextOffset) =>
              setApplied((a) => ({
                ...a,
                page: Math.floor(nextOffset / LOCKER_CIT_PAGE_SIZE) + 1,
              }))
            }
          />
        </>
      ) : null}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
          marginTop: 20,
        }}
      >
        <section
          style={{
            background: '#fff',
            border: '1px solid #E2E8F0',
            borderRadius: 10,
            padding: 16,
          }}
        >
          <h3 style={{ margin: '0 0 8px', fontSize: '0.95rem' }}>{t('cit.chain.title')}</h3>
          <p style={{ margin: 0, color: '#475569', fontSize: '0.875rem', lineHeight: 1.5 }}>
            {t('cit.chain.body')}
          </p>
        </section>
        <section
          style={{
            background: '#fff',
            border: '1px solid #E2E8F0',
            borderRadius: 10,
            padding: 16,
          }}
        >
          <h3 style={{ margin: '0 0 8px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Building2 size={14} /> {t('cit.movements.title')}
          </h3>
          {Array.isArray(payload?.recentVaultMovements) &&
          payload.recentVaultMovements.length > 0 ? (
            <WsTableScroll>
              <table className="ws-table">
                <thead>
                  <tr>
                    <th className="table-th">{t('cit.movements.time')}</th>
                    <th className="table-th">{t('cit.movements.type')}</th>
                    <th className="table-th" style={{ textAlign: 'end' }}>
                      {t('cit.movements.amount')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {payload.recentVaultMovements.map((m, i) => (
                    <tr key={m.id || i}>
                      <td className="table-cell">{formatCitStamp(m.time || m.at, true)}</td>
                      <td className="table-cell">{m.type || m.label || t('cit.emdash')}</td>
                      <td className="table-cell" style={{ textAlign: 'end' }}>
                        {formatCitMoneyLatn(m.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </WsTableScroll>
          ) : (
            <p style={{ margin: 0, color: '#94A3B8', fontSize: '0.85rem' }}>
              {t('cit.movements.empty')}
            </p>
          )}
        </section>
      </div>

      {!embedded ? (
        <p style={{ marginTop: 12, fontSize: '0.8rem' }}>
          <Link to="/workshop/locker-management">{t('cit.link.lockerMgmt')}</Link>
        </p>
      ) : null}
    </div>
  );
}
