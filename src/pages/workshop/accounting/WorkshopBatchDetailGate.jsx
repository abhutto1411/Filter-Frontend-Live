import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useOutletContext } from 'react-router-dom';
import { accT } from '../../../utils/accountingI18n';
import { getAccountingBatch } from '../../../services/workshopAccountingApi';
import WorkshopBulkTransactionGridPage from './WorkshopBulkTransactionGridPage';
import WorkshopBatchResultPage from './WorkshopBatchResultPage';

function batchIdFromPath(pathname) {
  const parts = String(pathname || '').split('/').filter(Boolean);
  const i = parts.indexOf('batch');
  if (i >= 0 && parts[i + 1] && parts[i + 1] !== 'new') return parts[i + 1];
  return null;
}

/**
 * Draft / partially_posted → grid (P-A18B). Posted / reversed → result (P-A18D mockup 30).
 */
export default function WorkshopBatchDetailGate({
  branches = [],
  selectedBranchId = 'all',
  locale: localeProp,
}) {
  const location = useLocation();
  const batchId = batchIdFromPath(location.pathname);
  const outletCtx = useOutletContext() || {};
  const locale =
    localeProp ||
    outletCtx.locale ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
    'en';
  const t = useCallback((key, vars) => accT(locale, key, vars), [locale]);

  const [mode, setMode] = useState('loading'); // loading | grid | result | error
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!batchId) {
        setMode('error');
        setErr(t('br.err.load'));
        return;
      }
      setMode('loading');
      setErr('');
      try {
        const res = await getAccountingBatch(batchId);
        if (cancelled) return;
        const st = String(res?.status || '').toLowerCase();
        if (
          st === 'draft' ||
          st === 'draft_import' ||
          st === 'partially_posted'
        ) {
          setMode('grid');
        } else {
          setMode('result');
        }
      } catch (e) {
        if (cancelled) return;
        // Staging may 404 — open grid so Continue/Open still usable offline of API
        setErr(e?.message || t('br.err.load'));
        setMode('result');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [batchId, t]);

  if (mode === 'loading') {
    return (
      <div className="module-container" role="status">
        {t('br.loading')}
      </div>
    );
  }

  if (mode === 'grid') {
    return (
      <WorkshopBulkTransactionGridPage
        branches={branches}
        selectedBranchId={selectedBranchId}
        locale={locale}
        mode="edit"
      />
    );
  }

  return (
    <>
      {err ? (
        <div className="module-container" role="alert" style={{ color: '#B91C1C' }}>
          {err}
        </div>
      ) : null}
      <WorkshopBatchResultPage locale={locale} />
    </>
  );
}
