import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { FileDown, Plus, RefreshCw } from 'lucide-react';
import { createPayrollRun, getPayrollSalarySheet, listPayrollRuns } from '../../../services/advancesApi';
import PayrollSheetDownloadDialog, { isPayrollSheetReady } from './PayrollSheetDownloadDialog';
import { exportPayrollSalaryExcel, exportPayrollSalaryPdf } from './payrollSheetExport';
import { accT } from '../../../utils/accountingI18n';
import {
  PAYROLL_RUN_PAGE_SIZE,
  currentPeriodYmd,
  payrollErrorI18nKey,
  slicePage,
} from '../../../utils/payrollRunDisplay';
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

/**
 * P-A12H2: Payroll runs list (replaces old Salary post/edit/delete modals).
 * Also imported by HQ admin panels as a thin compatibility surface.
 */
export default function WorkshopSalaryTab({
  branchFilter = '',
  branches = [],
  locale: localeProp,
}) {
  const outletCtx = useOutletContext() || {};
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canWrite =
    hasPermission('workshop.accounting.payroll') ||
    hasPermission('workshop.accounting.advances.create');

  const locale =
    localeProp ||
    outletCtx.locale ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
    'en';
  const t = useCallback((key, vars) => accT(locale, key, vars), [locale]);

  const [draftPeriod, setDraftPeriod] = useState(currentPeriodYmd());
  const [draftBranch, setDraftBranch] = useState(branchFilter || 'all');
  const [applied, setApplied] = useState({
    period: '',
    branchId: branchFilter || 'all',
  });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payload, setPayload] = useState(null);
  const [busy, setBusy] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetBusy, setSheetBusy] = useState(false);
  const [sheetError, setSheetError] = useState('');
  const [sheetRun, setSheetRun] = useState(null);

  useEffect(() => {
    if (branchFilter) {
      setDraftBranch(branchFilter);
      setApplied((a) => ({ ...a, branchId: branchFilter }));
    }
  }, [branchFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        page: String(page),
        ...(applied.period ? { period: applied.period } : {}),
        ...(applied.branchId && applied.branchId !== 'all'
          ? { branchId: applied.branchId }
          : {}),
      };
      const res = await listPayrollRuns(params);
      setPayload(res);
        } catch (e) {
      const st = e?.status || e?.response?.status;
      if (st === 404 || st === 403) {
        setPayload({ items: [], total: 0, missing: true });
        setError(t('pr.err.apiMissing'));
      } else {
        const mapped = payrollErrorI18nKey(e);
        setError(mapped ? t(mapped) : t('pr.err.loadRuns'));
        setPayload(null);
      }
        } finally {
      setLoading(false);
    }
  }, [applied, page, t]);

  useEffect(() => {
    load();
  }, [load]);

  const items = useMemo(() => {
    const list = Array.isArray(payload?.items) ? payload.items : [];
    if (payload?.page != null && payload?.total != null) return list;
    return slicePage(list, page, PAYROLL_RUN_PAGE_SIZE).items;
  }, [payload, page]);

  const total = Number(payload?.total ?? items.length) || 0;
  const pageSize = Number(payload?.pageSize) || PAYROLL_RUN_PAGE_SIZE;

  const statusLabel = (s) => {
    const k = String(s || '').toLowerCase();
    if (k === 'draft') return t('pr.status.draft');
    if (k === 'approved') return t('pr.status.approved');
    if (k === 'paid') return t('pr.status.paid');
    if (k === 'partially_paid') return t('pr.status.partial');
    if (k === 'reversed') return t('pr.status.reversed');
    return s || t('adv.emdash');
  };

  const openRun = (period) => {
    navigate(`/workshop/accounting/advances/payroll/${encodeURIComponent(period)}`);
  };

  const downloadSalarySheet = async ({ branchId, month, format, language }) => {
    if (!sheetRun?.id) return;
    setSheetBusy(true);
    setSheetError('');
    try {
      const sheet = await getPayrollSalarySheet(sheetRun.id, {
        ...(branchId ? { branchId } : {}),
        format: format === 'xlsx' ? 'xlsx' : 'pdf',
        language: language || 'en+ar',
        month: month || sheetRun.period,
      });
      if (format === 'xlsx') exportPayrollSalaryExcel(sheet);
      else await exportPayrollSalaryPdf(sheet);
      setSheetOpen(false);
    } catch (e) {
      const mapped = payrollErrorI18nKey(e);
      setSheetError(mapped ? t(mapped) : t('pr.sheet.err.totals'));
    } finally {
      setSheetBusy(false);
    }
  };

  const applyFilters = () => {
    setApplied({
      period: draftPeriod || '',
      branchId: draftBranch || 'all',
    });
    setPage(1);
  };

  const showAll = () => {
    setDraftPeriod(currentPeriodYmd());
    setDraftBranch(branchFilter || 'all');
    setApplied({ period: '', branchId: branchFilter || 'all' });
    setPage(1);
  };

  const createAndOpen = async () => {
    if (!canWrite || !draftPeriod) return;
    setBusy(true);
    setError('');
    try {
      const body = {
        period: draftPeriod,
        ...(draftBranch && draftBranch !== 'all' ? { branchId: draftBranch } : {}),
      };
      const created = await createPayrollRun(body);
      if (created?.id) {
        navigate(
          `/workshop/accounting/advances/payroll/${encodeURIComponent(draftPeriod)}`,
        );
        return;
      }
      openRun(draftPeriod);
        } catch (e) {
      const code = e?.code || e?.body?.code || e?.response?.data?.code;
      const runId = e?.runId || e?.body?.runId || e?.response?.data?.runId;
      if (code === 'PAYROLL_RUN_EXISTS') {
        if (runId) {
          navigate(
            `/workshop/accounting/advances/payroll/${encodeURIComponent(draftPeriod)}`,
          );
        } else {
          openRun(draftPeriod);
        }
            return;
        }
      const mapped = payrollErrorI18nKey(e);
      setError(mapped ? t(mapped) : t('pr.err.create'));
        } finally {
      setBusy(false);
        }
    };

    return (
        <div>
      <div className="acct-filter-bar">
        <div style={fieldWrap}>
          <label style={labelStyle} htmlFor="pr-list-period">
            {t('pr.filter.period')}
                                    </label>
                                    <input
            id="pr-list-period"
            type="month"
            style={inputStyle}
            value={draftPeriod}
            onChange={(e) => setDraftPeriod(e.target.value)}
                            />
                        </div>
                        {branches.length > 0 ? (
          <div style={fieldWrap}>
            <label style={labelStyle} htmlFor="pr-list-branch">
              {t('pr.filter.branch')}
            </label>
            <select
              id="pr-list-branch"
              style={inputStyle}
              value={draftBranch}
              onChange={(e) => setDraftBranch(e.target.value)}
            >
              <option value="all">{t('adv.allBranches')}</option>
                                    {branches.map((b) => (
                                        <option key={String(b.id)} value={String(b.id)}>
                                            {b.name}
                                        </option>
                                    ))}
            </select>
                            </div>
                        ) : null}
        <button type="button" className="btn-submit btn-dark" onClick={applyFilters}>
          {t('adv.filter.apply')}
                            </button>
        <button type="button" className="btn-portal-outline" onClick={showAll}>
          {t('adv.filter.showAll')}
                            </button>
        {canWrite ? (
                            <button
                                type="button"
            className="btn-submit btn-dark"
            disabled={busy}
            onClick={createAndOpen}
          >
            <Plus size={14} style={{ marginInlineEnd: 6 }} />
            {t('pr.runPayrollPeriod')}
                            </button>
        ) : null}
        <button type="button" className="btn-portal-outline" onClick={load} disabled={loading}>
          <RefreshCw size={14} style={{ marginInlineEnd: 6 }} />
          {t('btn.refresh')}
                            </button>
                        </div>

      {error ? (
        <div
          role="alert"
                        style={{
            padding: 12,
            marginBottom: 12,
            color: '#B45309',
            background: '#FFFBEB',
            borderRadius: 8,
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <span>{error}</span>
          <button type="button" className="btn-portal-outline" onClick={load}>
            {t('adv.err.retry')}
          </button>
        </div>
                        ) : null}

      {loading ? (
        <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>{t('loading')}</div>
      ) : (
        <>
          <WsTableScroll>
            <table className="ws-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="table-header-row">
                  <th className="table-th">{t('pr.filter.period')}</th>
                  <th className="table-th">{t('pr.card.status')}</th>
                  <th className="table-th" style={{ textAlign: 'end' }}>
                    {t('pr.card.employees')}
                  </th>
                  <th className="table-th">{t('adv.th.action')}</th>
                        </tr>
                    </thead>
                    <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="table-cell"
                      style={{ textAlign: 'center', padding: 32, color: '#94A3B8' }}
                    >
                      {t('pr.listEmpty')}
                                </td>
                            </tr>
                ) : (
                  items.map((r) => (
                    <tr key={r.id} className="table-row">
                      <td className="table-cell" style={{ fontWeight: 700 }}>
                        {r.period}
                      </td>
                      <td className="table-cell">{statusLabel(r.status)}</td>
                      <td className="table-cell" style={{ textAlign: 'end' }}>
                        {r.slipCount != null ? r.slipCount : t('adv.emdash')}
                      </td>
                                <td className="table-cell">
                                        <button
                                            type="button"
                          className="btn-portal-outline"
                          onClick={() => openRun(r.period)}
                        >
                          {t('pr.openRun')}
                                        </button>
                          <span
                            title={
                              isPayrollSheetReady(r.status)
                                ? t('pr.sheet.download')
                                : t('pr.sheet.availableAfter')
                            }
                            style={{ marginInlineStart: 6 }}
                          >
                            <button
                              type="button"
                              className="btn-portal-outline"
                              disabled={!isPayrollSheetReady(r.status) || sheetBusy}
                              onClick={() => {
                                if (!isPayrollSheetReady(r.status)) return;
                                setSheetRun(r);
                                setSheetError('');
                                setSheetOpen(true);
                              }}
                            >
                              <FileDown size={14} style={{ marginInlineEnd: 6 }} />
                              {t('pr.sheet.download')}
                            </button>
                          </span>
                                </td>
                            </tr>
                  ))
                )}
                    </tbody>
                </table>
          </WsTableScroll>
          <PaginationControls
            total={total}
            limit={pageSize}
            offset={(Math.max(1, Number(payload?.page) || page) - 1) * pageSize}
            onPageChange={(offset) => setPage(Math.floor(offset / pageSize) + 1)}
            loading={loading}
          />
                        </>
                    )}
      <PayrollSheetDownloadDialog
        open={sheetOpen}
        title={t('pr.sheet.title')}
        t={t}
        branches={branches}
        defaultBranchId={applied.branchId}
        defaultMonth={sheetRun?.period || draftPeriod}
        busy={sheetBusy}
        error={sheetError}
        onClose={() => setSheetOpen(false)}
        onDownload={downloadSalarySheet}
      />
        </div>
    );
}
