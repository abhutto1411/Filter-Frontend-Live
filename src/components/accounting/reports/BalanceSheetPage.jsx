import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { getAccountsBranches, getBalanceSheet } from '../../../services/accountsApi';
import SelectCombo from '../../SelectCombo';
import { accT, listMissingBsTbFields, pickBsUnallocatedBalance, reportRowFlags } from '../../../utils/accountingI18n';
import { defaultTbBsReportDates } from '../../../utils/riyadhBusinessRange';
import {
  BS_WARNING_BANNER_STYLE,
  balanceSheetBadge,
  bsLineDisplayAmount,
  bsWarningMessages,
  isReportRangeInvalidError,
  sumOwnAmounts,
} from '../../../utils/accountingReportDisplay';
import { formatAccountingNumber } from '../../../utils/plBranchTableDisplay';
import RiyalIcon from '../../RiyalIcon';
import ReportSummaryCards from './ReportSummaryCards';
import ProofAmount from './ProofAmount';
import { buildProofHref, shouldSyncReportUrl } from './reportProofLinks';
import {
  bsAccountProofKey,
  bsSectionProofKey,
  bsUnallocatedProofKey,
} from './tbBsProofKeys';

function plBranchFromLayout(selectedBranchId) {
  if (selectedBranchId == null || selectedBranchId === '' || selectedBranchId === 'all') {
    return '';
  }
  return String(selectedBranchId);
}

function unwrapReport(res) {
  const root = res?.data && typeof res.data === 'object' && !Array.isArray(res.data) ? res.data : res;
  return root && typeof root === 'object' ? root : null;
}

function fmtAmt(n) {
  return (
    <>
      <bdi dir="ltr">{formatAccountingNumber(n)}</bdi>
      <RiyalIcon size={12} />
    </>
  );
}

function readBsFiltersFromSearch(searchParams) {
  return {
    asOf: searchParams.get('asOf') || searchParams.get('dateTo') || '',
    branchId: searchParams.get('branchId') || '',
  };
}

function RowTags({ row, t }) {
  const flags = reportRowFlags(row);
  if (!flags.inactive && !flags.shownBecauseBalance) return null;
  return (
    <span style={{ marginInlineStart: 8, display: 'inline-flex', gap: 6, alignItems: 'center' }}>
      {flags.inactive ? (
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: '1px 6px',
            borderRadius: 999,
            background: '#F1F5F9',
            color: '#475569',
          }}
        >
          {t('report.bstb.inactive')}
        </span>
      ) : null}
      {flags.shownBecauseBalance ? (
        <span style={{ fontSize: 11, color: '#64748B' }}>{t('report.bstb.shownBecauseBalance')}</span>
      ) : null}
    </span>
  );
}

/**
 * Standalone Balance Sheet (mockup K-3): Unallocated / HQ row + inactive tags.
 */
export default function BalanceSheetPage({ locale: localeProp, selectedBranchId = 'all' } = {}) {
  const locale =
    localeProp ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
    'en';
  const t = useCallback((key, vars) => accT(locale, key, vars), [locale]);
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlInit = useMemo(() => readBsFiltersFromSearch(searchParams), []);

  const initial = useMemo(() => defaultTbBsReportDates(), []);
  const [draftAsOf, setDraftAsOf] = useState(urlInit.asOf || initial.bs.asOf);
  const [draftBranch, setDraftBranch] = useState(() =>
    urlInit.branchId || plBranchFromLayout(selectedBranchId),
  );
  const [appliedAsOf, setAppliedAsOf] = useState(urlInit.asOf || initial.bs.asOf);
  const [appliedBranch, setAppliedBranch] = useState(() =>
    urlInit.branchId || plBranchFromLayout(selectedBranchId),
  );
  const [branches, setBranches] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const skipLayoutBranchOnce = useRef(Boolean(urlInit.branchId || urlInit.asOf));
  useEffect(() => {
    if (skipLayoutBranchOnce.current) {
      skipLayoutBranchOnce.current = false;
      return;
    }
    setDraftBranch(plBranchFromLayout(selectedBranchId));
    setAppliedBranch(plBranchFromLayout(selectedBranchId));
  }, [selectedBranchId]);

  useEffect(() => {
    if (!shouldSyncReportUrl(location.pathname, '/accounting/balance-sheet')) return;
    const next = new URLSearchParams();
    if (appliedAsOf) next.set('asOf', appliedAsOf);
    if (appliedBranch) next.set('branchId', appliedBranch);
    if (next.toString() === searchParams.toString()) return;
    setSearchParams(next, { replace: true });
  }, [appliedAsOf, appliedBranch, location.pathname, searchParams, setSearchParams]);

  useEffect(() => {
    let cancelled = false;
    getAccountsBranches()
      .then((list) => {
        if (!cancelled) setBranches(Array.isArray(list) ? list : []);
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
    try {
      const asOf = String(appliedAsOf || '').slice(0, 10);
      if (!asOf) throw new Error(t('coa.err.rangeRequired'));
      const params = { asOf };
      if (appliedBranch) params.branchId = appliedBranch;
      const root = unwrapReport(await getBalanceSheet(params));
      if (!root) {
        setReport(null);
        setErr(t('bs.err.load'));
        return;
      }
      setReport(root);
    } catch (e) {
      setReport(null);
      setErr(
        isReportRangeInvalidError(e) ? t('pl.rangeInvalid') : e?.message || t('bs.err.load'),
      );
    } finally {
      setLoading(false);
    }
  }, [appliedAsOf, appliedBranch, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const branchSelected = Boolean(appliedBranch);
  const badge = pickBsUnallocatedBalance(report, { branchSelected });
  const bsBadge = balanceSheetBadge(report, { isBranchScoped: branchSelected });
  const missing = listMissingBsTbFields(report, { kind: 'bs', branchSelected });
  const unallocated = report?.unallocated && typeof report.unallocated === 'object' ? report.unallocated : null;

  const b = report || {
    assets: { current: [], fixed: [], other: [], totalAssets: 0 },
    liabilities: { current: [], longTerm: [], other: [], totalLiabilities: 0 },
    equity: { accounts: [], totalEquity: 0 },
    totalLiabilitiesAndEquity: 0,
  };

  const proofFilters = useMemo(
    () => ({
      dateTo: appliedAsOf,
      branchId: appliedBranch,
    }),
    [appliedAsOf, appliedBranch],
  );
  const backHref = `${location.pathname}${location.search}`;

  function amountHref(proofKey) {
    if (!proofKey) return '';
    return buildProofHref({
      report: 'bs',
      key: proofKey,
      filters: proofFilters,
      column: 'total',
      backHref,
    });
  }

  function renderProof(value, href) {
    if (value == null || value === '') return fmtAmt(value);
    return (
      <ProofAmount
        value={value}
        href={href}
        text={fmtAmt(value)}
        title={t('proof.view')}
        aria-label={t('proof.view')}
      />
    );
  }

  function onApply(e) {
    e?.preventDefault?.();
    const asOf = String(draftAsOf || '').slice(0, 10);
    if (!asOf) {
      setErr(t('coa.err.rangeRequired'));
      return;
    }
    setErr('');
    setAppliedAsOf(asOf);
    setAppliedBranch(draftBranch);
  }

  function onShowAll() {
    const d = defaultTbBsReportDates();
    const branchId = plBranchFromLayout(selectedBranchId);
    setDraftAsOf(d.bs.asOf);
    setDraftBranch(branchId);
    setAppliedAsOf(d.bs.asOf);
    setAppliedBranch(branchId);
    setErr('');
  }

  const bsRow = {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '6px 0',
    borderBottom: '1px solid #E2E8F0',
  };

  function renderLine(r, keyPrefix) {
    const display = bsLineDisplayAmount(r);
    const heading = Boolean(r.isHeading);
    const href = amountHref(bsAccountProofKey(r));
    return (
      <div
        key={`${keyPrefix}-${r.id || r.code}`}
        style={{ ...bsRow, color: heading ? '#64748b' : undefined, fontWeight: heading ? 700 : 400 }}
      >
        <span>
          {r.name}
          {heading ? (
            <span style={{ marginInlineStart: 8, fontSize: 11, color: '#94a3b8' }}>{t('bs.heading')}</span>
          ) : null}
          <RowTags row={r} t={t} />
        </span>
        <span style={{ textAlign: 'end' }}>{renderProof(display, href)}</span>
      </div>
    );
  }

  return (
    <div className="ws-page" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <div style={{ marginBlockEnd: 8, fontSize: 13, color: '#64748B' }}>
        <Link to="/workshop/accounting/chart-of-accounts" style={{ color: '#64748B' }}>
          {t('coa.title')}
        </Link>
        {' / '}
        <span>{t('report.breadcrumb')}</span>
        {' / '}
        <span>{t('report.bs.title')}</span>
      </div>
      <h1 style={{ margin: '0 0 14px', fontSize: 22, fontWeight: 800, color: '#0F172A' }}>
        {t('report.bs.title')}
      </h1>

      <form
        onSubmit={onApply}
        className="acct-filter-bar"
        style={{
          background: '#fff',
          border: '1px solid #E5E7EB',
          borderRadius: 10,
          padding: 12,
          marginBlockEnd: 12,
        }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
          <span>{t('report.bstb.filter.asOf')}</span>
          <input
            type="date"
            aria-label={t('bs.riyadhLabel')}
            value={String(draftAsOf || '').slice(0, 10)}
            onChange={(e) => setDraftAsOf(e.target.value)}
            style={{ paddingInline: 10, borderRadius: 8, border: '1px solid #E2E8F0' }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
          <span>{t('report.pl.filter.branch')}</span>
          <SelectCombo
            size="sm"
            value={draftBranch}
            onChange={(e) => setDraftBranch(e.target.value)}
            aria-label={t('report.pl.filter.branch')}
            style={{ minWidth: 200 }}
          >
            <option value="">{t('report.pl.allBranches')}</option>
            {branches.map((br) => (
              <option key={br.id} value={String(br.id)}>
                {br.name}
              </option>
            ))}
          </SelectCombo>
        </label>
        <button type="submit" className="btn-submit btn-dark" disabled={loading}>
          {t('date.apply')}
        </button>
        <button type="button" className="btn-portal-outline" disabled={loading} onClick={onShowAll}>
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

      {missing.length > 0 ? (
        <p role="status" style={{ fontSize: 12, color: '#B45309', margin: '0 0 10px' }}>
          {t('report.bstb.needsBackend', { fields: missing.join(', ') })}
        </p>
      ) : null}
      {bsWarningMessages(report).map((w) => (
        <p key={w.key} role="status" style={BS_WARNING_BANNER_STYLE}>
          {t(w.key, w.vars)}
        </p>
      ))}

      {loading ? (
        <div style={{ padding: 24, color: '#64748B' }}>{t('loading')}</div>
      ) : !report ? (
        <div style={{ padding: 24, color: '#64748B' }}>{t('bs.emptyHint')}</div>
      ) : (
        <>
          <ReportSummaryCards
            items={[
              {
                key: 'assets',
                label: t('report.bs.card.assets'),
                value: renderProof(b.assets.totalAssets, amountHref(bsSectionProofKey('totalAssets'))),
              },
              {
                key: 'liab',
                label: t('report.bs.card.liabilities'),
                value: renderProof(b.liabilities.totalLiabilities, amountHref(bsSectionProofKey('totalLiabilities'))),
              },
              {
                key: 'equity',
                label: t('report.bs.card.equity'),
                value: renderProof(b.equity.totalEquity, amountHref(bsSectionProofKey('totalEquity'))),
              },
              {
                key: 'check',
                label: t('report.bs.card.check'),
                tone:
                  bsBadge.kind === 'balanced'
                    ? 'ok'
                    : bsBadge.kind === 'notApplicable' || bsBadge.kind === 'branchNote'
                      ? 'muted'
                      : 'bad',
                value: (
                  <ProofAmount
                    value={badge.difference}
                    href={amountHref(bsSectionProofKey('difference'))}
                    text={
                      <>
                        {t(bsBadge.textKey, bsBadge.vars)}
                        {bsBadge.vars?.n != null ? <RiyalIcon size={12} /> : null}
                      </>
                    }
                    title={t('proof.view')}
                    aria-label={t('proof.view')}
                  />
                ),
              },
            ]}
          />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 16,
              marginBlockStart: 12,
            }}
          >
            <div>
              <div style={{ fontSize: 11, letterSpacing: 1, color: '#6b7280', fontWeight: 700 }}>{t('bs.assets')}</div>
              <div style={{ ...bsRow, fontWeight: 700 }}>
                <span>{t('bs.currentAssets')}</span>
                <span>{fmtAmt(sumOwnAmounts(b.assets.current))}</span>
              </div>
              {(b.assets.current || []).map((r) => renderLine(r, 'ac'))}
              <div style={{ ...bsRow, fontWeight: 700 }}>
                <span>{t('bs.fixedAssets')}</span>
                <span>{fmtAmt(sumOwnAmounts(b.assets.fixed))}</span>
              </div>
              {(b.assets.fixed || []).map((r) => renderLine(r, 'af'))}
              <div style={{ ...bsRow, fontWeight: 700 }}>
                <span>{t('bs.otherAssets')}</span>
                <span>{fmtAmt(sumOwnAmounts(b.assets.other))}</span>
              </div>
              {(b.assets.other || []).map((r) => renderLine(r, 'ao'))}
              <div style={{ ...bsRow, fontWeight: 800 }}>
                <span>{t('bs.totalAssets')}</span>
                <span>{renderProof(b.assets.totalAssets, amountHref(bsSectionProofKey('totalAssets')))}</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, letterSpacing: 1, color: '#6b7280', fontWeight: 700 }}>
                {t('report.bs.liabEquity')}
              </div>
              <div style={{ ...bsRow, fontWeight: 700 }}>
                <span>{t('bs.currentLiab')}</span>
                <span>{fmtAmt(sumOwnAmounts(b.liabilities.current))}</span>
              </div>
              {(b.liabilities.current || []).map((r) => renderLine(r, 'lc'))}
              <div style={{ ...bsRow, fontWeight: 700 }}>
                <span>{t('bs.longTermLiab')}</span>
                <span>{fmtAmt(sumOwnAmounts(b.liabilities.longTerm))}</span>
              </div>
              {(b.liabilities.longTerm || []).map((r) => renderLine(r, 'll'))}
              {(b.liabilities.other || []).map((r) => renderLine(r, 'lo'))}
              <div style={{ ...bsRow, fontWeight: 800 }}>
                <span>{t('bs.totalLiab')}</span>
                <span>{renderProof(b.liabilities.totalLiabilities, amountHref(bsSectionProofKey('totalLiabilities')))}</span>
              </div>
              <div style={{ fontSize: 11, letterSpacing: 1, color: '#6b7280', fontWeight: 700, marginTop: 12 }}>
                {t('bs.equity')}
              </div>
              {(b.equity.accounts || []).map((r) => renderLine(r, 'eq'))}
              <div style={{ ...bsRow, fontWeight: 800 }}>
                <span>{t('bs.totalEquity')}</span>
                <span>{renderProof(b.equity.totalEquity, amountHref(bsSectionProofKey('totalEquity')))}</span>
              </div>
              <div
                style={{
                  marginTop: 12,
                  background: '#1e293b',
                  color: '#fff',
                  borderRadius: 8,
                  padding: 12,
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontWeight: 800,
                }}
              >
                <span>{t('bs.totalLiabEquity')}</span>
                <span>
                  {renderProof(
                    b.totalLiabilitiesAndEquity,
                    amountHref(bsSectionProofKey('totalLiabilitiesAndEquity')),
                  )}
                </span>
              </div>
            </div>
          </div>

          {branchSelected && unallocated ? (
            <div
              role="row"
              style={{
                marginBlockStart: 12,
                background: '#FEF3C7',
                border: '1px solid #F59E0B',
                borderRadius: 8,
                padding: 12,
                fontWeight: 700,
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <span>{t('report.bstb.unallocatedRow')}</span>
              <span>
                {t('report.bs.card.assets')}{' '}
                {renderProof(unallocated.assets, amountHref(bsUnallocatedProofKey('assets')))}
                {' · '}
                {t('report.bs.card.liabilities')}{' '}
                {renderProof(unallocated.liabilities, amountHref(bsUnallocatedProofKey('liabilities')))}
                {' · '}
                {t('report.bs.card.equity')}{' '}
                {renderProof(unallocated.equity, amountHref(bsUnallocatedProofKey('equity')))}
              </span>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
