import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { fetchDailyActivityV6, fetchDailyActivityV6Verify } from './dailyActivityApi.js';
import { buildVerifyQueryFromCaptured, verifyErrorPayload, verifyStatusFromPayload } from './dailyActivityVerify.js';
import {
  canRenderDailyActivityPdf,
  pdfDisabledReason,
  renderDailyActivityPdf,
} from './dailyActivityPdf.js';
import {
  buildRequestKey,
  classifyDarError,
  formatDarErrorDetail,
  isStaleRequest,
  defaultOwnedQuery,
  pruneStaleSessionIds,
  readDarSectionTab,
  readOwnedSearch,
  shouldSyncDarUrl,
  wrapProofHref,
  writeOwnedSearch,
} from './dailyActivityFormat.js';
import { proofFallbackFromReport } from './dailyActivitySummary.js';
import {
  captureReopenIntentFromSearch,
  takeReopenIntent,
} from './dailyActivityProof.js';
import { darT } from './dailyActivityI18n.js';
import {
  DailyActivityCoverage,
  DailyActivityMoney,
  DailyActivityOperations,
  DailyActivitySessions,
  DailyActivityTechnicians,
} from './DailyActivityRest.jsx';
import {
  DailyActivityDepartments,
  DailyActivityFilters,
  DailyActivityHeader,
  DailyActivityJump,
  DailyActivityKpis,
  DailyActivityScope,
  DailyActivityStatus,
  DailyActivitySummary,
  DailyActivityVerifyPanel,
} from './DailyActivitySections.jsx';
import './daily-activity.css';

function canViewDar(hasPermission) {
  return (
    hasPermission('workshop.reports.daily-activity.view') ||
    hasPermission('workshop.reports.view')
  );
}

function findMetricInReport(report, metricKey) {
  let found = null;
  const walk = (node) => {
    if (found || node == null) return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (typeof node !== 'object') return;
    if (typeof node.key === 'string' && node.key === metricKey && ('value' in node || 'status' in node)) {
      found = node;
      return;
    }
    for (const value of Object.values(node)) walk(value);
  };
  walk(report);
  return found;
}

function mergeInitialQuery(search, layoutBranchId) {
  const fromUrl = readOwnedSearch(search);
  const base = defaultOwnedQuery();
  const query = {
    ...base,
    from: fromUrl.from || base.from,
    to: fromUrl.to || base.to,
    branchIds: fromUrl.branchIds,
    sessionIds: fromUrl.sessionIds,
    actorSource: fromUrl.actorSource,
  };
  if (
    !query.branchIds.length &&
    layoutBranchId &&
    layoutBranchId !== 'all' &&
    /^\d+$/.test(String(layoutBranchId))
  ) {
    query.branchIds = [String(layoutBranchId)];
  }
  return query;
}

export default function DailyActivityPage({
  selectedBranchId = 'all',
  branches = [],
  locale: localeProp = 'en',
  onLocale,
}) {
  const { hasPermission } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const locale = localeProp === 'ar' ? 'ar' : 'en';
  const allowed = canViewDar(hasPermission);
  const [proofReopenNote, setProofReopenNote] = useState(null);

  const [draft, setDraft] = useState(() => mergeInitialQuery(searchParams, selectedBranchId));
  const [applied, setApplied] = useState(() => mergeInitialQuery(searchParams, selectedBranchId));
  const [report, setReport] = useState(null);
  const [errorKind, setErrorKind] = useState(null);
  const [errorDetail, setErrorDetail] = useState('');
  const [loading, setLoading] = useState(false);
  const [stale, setStale] = useState(false);
  const [sessionsCleared, setSessionsCleared] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyPayload, setVerifyPayload] = useState(null);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const activeKeyRef = useRef('');
  const abortRef = useRef(null);
  const verifyAbortRef = useRef(null);
  const verifyKeyRef = useRef('');
  const reportRef = useRef(null);
  const [tabHash, setTabHash] = useState(() => location.hash || '');

  useEffect(() => {
    if (!captureReopenIntentFromSearch(searchParams)) return;
    if (!searchParams.has('reopenProof') && !searchParams.has('proofClicked')) return;
    const cleaned = new URLSearchParams(searchParams);
    cleaned.delete('reopenProof');
    cleaned.delete('proofClicked');
    setSearchParams(cleaned, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    setTabHash(location.hash || '');
  }, [location.hash]);

  useEffect(() => {
    const onHash = () => setTabHash(window.location.hash || '');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const authorizedBranches = useMemo(
    () =>
      (branches || []).map((b) => ({
        id: String(b.id),
        labelEn: b.name || b.labelEn || String(b.id),
        labelAr: b.nameAr || b.labelAr || b.name || String(b.id),
      })),
    [branches],
  );

  const persistUrl = useCallback(
    (query) => {
      if (!shouldSyncDarUrl(location.pathname)) return;
      const next = writeOwnedSearch(query, searchParams);
      if (next.toString() !== searchParams.toString()) {
        setSearchParams(next, { replace: true });
      }
    },
    [location.pathname, searchParams, setSearchParams],
  );

  const load = useCallback(
    async (query) => {
      if (!allowed) return;
      const key = buildRequestKey(query);
      activeKeyRef.current = key;
      abortRef.current?.abort();
      verifyAbortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setErrorKind(null);
      setErrorDetail('');
      try {
        const { payload, requestKey } = await fetchDailyActivityV6(query, {
          signal: controller.signal,
        });
        if (isStaleRequest(activeKeyRef.current, requestKey)) return;
        const pruned = pruneStaleSessionIds(
          query.sessionIds,
          payload?.filters?.sessions,
          query.branchIds,
        );
        if (pruned.cleared) {
          const next = { ...query, sessionIds: pruned.ids };
          setSessionsCleared(true);
          setDraft(next);
          setApplied(next);
          persistUrl(next);
        } else {
          setSessionsCleared(false);
        }
        reportRef.current = payload;
        setReport(payload);
        setStale(false);
        setVerifyPayload(null);
        setVerifyOpen(false);
        const pending = takeReopenIntent();
        if (pending?.metricKey && payload?.meta?.snapshotToken) {
          const metric = findMetricInReport(payload, pending.metricKey);
          const href = wrapProofHref(
            metric || { key: pending.metricKey, proof: { metricKey: pending.metricKey } },
            proofFallbackFromReport(payload, readDarSectionTab(window.location.hash || '')),
          );
          const freshValue = metric?.value == null ? '' : String(metric.value);
          if (pending.clicked && freshValue && pending.clicked !== freshValue) {
            setProofReopenNote({
              metricKey: pending.metricKey,
              previous: pending.clicked,
              current: freshValue,
            });
          } else {
            setProofReopenNote(null);
          }
          navigate(href);
        }
      } catch (err) {
        if (err?.name === 'AbortError') return;
        if (isStaleRequest(activeKeyRef.current, err.requestKey)) return;
        const classified = err.classified || classifyDarError(err);
        setErrorKind(classified.kind);
        setErrorDetail(
          classified.kind === 'invalid' || classified.kind === 'unknown'
            ? formatDarErrorDetail(err)
            : '',
        );
        if (classified.kind === 'network' && reportRef.current) setStale(true);
        else if (classified.kind === 'forbidden' || classified.kind === 'backend') {
          reportRef.current = null;
          setReport(null);
          setStale(false);
        }
      } finally {
        if (activeKeyRef.current === key) setLoading(false);
      }
    },
    [allowed, persistUrl],
  );

  const appliedKey = buildRequestKey(applied);
  useEffect(() => {
    persistUrl(applied);
    load(applied);
    return () => abortRef.current?.abort();
    // Apply atomically via request key — not draft keystrokes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedKey]);

  function onApply() {
    const next = { ...draft };
    setApplied(next);
    persistUrl(next);
  }

  const pdfEnabled = canRenderDailyActivityPdf({
    report,
    stale,
    errorKind,
    loading,
  });
  const pdfReason = pdfDisabledReason({ report, stale, errorKind, loading, locale });

  async function exportPdf(pdfLocale) {
    const captured = reportRef.current;
    if (
      pdfBusy ||
      !canRenderDailyActivityPdf({
        report: captured,
        stale,
        errorKind,
        loading,
      })
    ) {
      return;
    }
    setPdfBusy(true);
    try {
      await renderDailyActivityPdf({
        report: captured,
        locale: pdfLocale,
        origin: typeof window !== 'undefined' ? window.location.origin : '',
        verify: verifyPayload,
      });
    } catch {
      /* raster timeout or html-to-image failure — busy must still clear */
    } finally {
      setPdfBusy(false);
    }
  }

  async function runVerify() {
    const captured = reportRef.current;
    if (verifyBusy || !captured?.meta?.snapshotToken) return;
    verifyAbortRef.current?.abort();
    const controller = new AbortController();
    verifyAbortRef.current = controller;
    const key = buildRequestKey(applied) + '|' + captured.meta.snapshotToken;
    verifyKeyRef.current = key;
    setVerifyBusy(true);
    try {
      const { payload } = await fetchDailyActivityV6Verify(
        buildVerifyQueryFromCaptured(applied, captured),
        { signal: controller.signal },
      );
      if (verifyKeyRef.current !== key) return;
      if (payload?.sourceFingerprint && reportRef.current?.meta) {
        const next = {
          ...reportRef.current,
          meta: {
            ...reportRef.current.meta,
            sourceFingerprint: payload.sourceFingerprint,
          },
        };
        reportRef.current = next;
        setReport(next);
      }
      setVerifyPayload(payload);
      setVerifyOpen(true);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      setVerifyPayload(verifyErrorPayload(captured, err));
      setVerifyOpen(true);
    } finally {
      setVerifyBusy(false);
    }
  }

  if (!allowed) {
    return (
      <div className="dar-v6" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
        <p className="dar-v6-error" role="alert">
          {darT(locale, 'error.forbidden')}
        </p>
      </div>
    );
  }

  const sessions = report?.filters?.sessions || [];
  const actorSourceAvailable = Boolean(report?.filters?.actorSourceAvailable);
  const activeTab = readDarSectionTab(tabHash);

  return (
    <div className="dar-v6" dir={locale === 'ar' ? 'rtl' : 'ltr'} lang={locale === 'ar' ? 'ar' : 'en'}>
      {proofReopenNote ? (
        <p className="dar-v6-notice" role="status">
          {darT(locale, 'proof.reopenedChanged')}{' '}
          <span dir="ltr">
            {proofReopenNote.metricKey}: {proofReopenNote.previous} → {proofReopenNote.current}
          </span>
        </p>
      ) : null}
      <DailyActivityHeader
        locale={locale}
        onLocale={onLocale}
        onPdfEn={() => void exportPdf('en')}
        onPdfAr={() => void exportPdf('ar')}
        pdfEnabled={pdfEnabled}
        pdfBusy={pdfBusy}
        pdfReason={pdfReason}
        onVerify={() => void runVerify()}
        verifyEnabled={Boolean(report?.meta?.snapshotToken) && !loading}
        verifyBusy={verifyBusy}
        verifyStatus={
          verifyBusy
            ? 'running'
            : verifyStatusFromPayload(verifyPayload, report?.meta?.snapshotToken)
        }
      />
      <DailyActivityFilters
        locale={locale}
        draft={draft}
        branches={authorizedBranches}
        sessions={sessions}
        actorSourceAvailable={actorSourceAvailable}
        sessionsCleared={sessionsCleared}
        applying={loading}
        onDraft={setDraft}
        onApply={onApply}
      />
      {report ? <DailyActivityScope locale={locale} report={report} /> : null}
      <DailyActivityStatus
        locale={locale}
        report={report}
        errorKind={errorKind}
        errorDetail={errorDetail}
        stale={stale}
        loading={loading}
      />
      {report ? <DailyActivityKpis locale={locale} report={report} /> : null}
      {report ? (
        <>
          <DailyActivityJump locale={locale} active={activeTab} />
          <div
            className="dar-v6-tabpanel"
            role="tabpanel"
            aria-labelledby={`dar-tab-${activeTab}`}
          >
            {activeTab === 'accumulated' ? (
              <DailyActivitySummary locale={locale} report={report} />
            ) : null}
            {activeTab === 'depts' ? (
              <DailyActivityDepartments locale={locale} report={report} />
            ) : null}
            {activeTab === 'sessions' ? (
              <DailyActivitySessions locale={locale} report={report} />
            ) : null}
            {activeTab === 'finance' ? (
              <DailyActivityMoney locale={locale} report={report} />
            ) : null}
            {activeTab === 'operations' ? (
              <>
                <DailyActivityOperations locale={locale} report={report} />
                <DailyActivityTechnicians locale={locale} report={report} />
                <DailyActivityCoverage locale={locale} report={report} />
              </>
            ) : null}
          </div>
        </>
      ) : null}
      {verifyOpen ? (
        <DailyActivityVerifyPanel
          locale={locale}
          payload={verifyPayload}
          onClose={() => setVerifyOpen(false)}
        />
      ) : null}
    </div>
  );
}
