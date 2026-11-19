import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { fetchDailyActivityV6Proof } from './dailyActivityApi.js';
import {
  DAR_V6_UNAVAILABLE,
  allowlistedSourceHref,
  formatBusinessDate,
  formatExactDecimal,
  formatMetricValue,
  formatRiyadhInstant,
} from './dailyActivityFormat.js';
import { darT } from './dailyActivityI18n.js';
import {
  nextProofSearch,
  proofFullResultDisplay,
  proofPageHref,
  readProofSearch,
  reportHrefFromProofQuery,
  safeDarReturnHash,
  snapshotTokenPreview,
  wrapOperandProofHref,
} from './dailyActivityProof.js';
import './daily-activity.css';

function canViewDar(hasPermission) {
  return (
    hasPermission('workshop.reports.daily-activity.view') ||
    hasPermission('workshop.reports.view')
  );
}

function cellText(value, kind = 'money') {
  if (value == null || value === '') return DAR_V6_UNAVAILABLE;
  return formatExactDecimal(value, { kind });
}

export default function DailyActivityProofPage({ locale: localeProp = 'en' }) {
  const locale = localeProp === 'ar' ? 'ar' : 'en';
  const t = (key) => darT(locale, key);
  const { hasPermission } = useAuth();
  const allowed = canViewDar(hasPermission);
  const [searchParams] = useSearchParams();
  const query = useMemo(() => readProofSearch(searchParams), [searchParams]);
  const [payload, setPayload] = useState(null);
  const [errorKind, setErrorKind] = useState(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef(null);
  const activeKeyRef = useRef('');
  const returnHash = safeDarReturnHash(query.returnTab) || 'depts';
  const backHref = useMemo(
    () => reportHrefFromProofQuery(query, { hash: returnHash }),
    [query],
  );
  const refreshHref = useMemo(
    () =>
      reportHrefFromProofQuery(query, {
        reopen: true,
        reopenMetricKey: query.metricKey,
        clickedValue: payload?.metric?.value ?? payload?.fullResult?.reconciledValue,
        hash: returnHash,
      }),
    [query, payload],
  );

  const load = useCallback(async () => {
    if (!allowed) {
      setPayload(null);
      setErrorKind('forbidden');
      setLoading(false);
      return;
    }
    if (!query.metricKey) {
      setPayload(null);
      setErrorKind('invalid');
      setLoading(false);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestKey = `${query.metricKey}|${query.snapshotToken}|${query.asOf}|${query.cursor}|${query.from}|${query.to}`;
    activeKeyRef.current = requestKey;
    setLoading(true);
    setErrorKind(null);
    try {
      const result = await fetchDailyActivityV6Proof(query, { signal: controller.signal });
      if (activeKeyRef.current !== requestKey) return;
      setPayload(result.payload);
      setErrorKind(null);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      if (activeKeyRef.current !== requestKey) return;
      const kind = err?.classified?.kind || 'unknown';
      setErrorKind(kind);
      if (kind === 'snapshot') {
        setPayload(null);
      }
    } finally {
      if (activeKeyRef.current === requestKey) setLoading(false);
    }
  }, [allowed, query]);

  useEffect(() => {
    void load();
    return () => abortRef.current?.abort();
  }, [load]);

  const nextHref = payload?.nextCursor
    ? proofPageHref(nextProofSearch(searchParams, payload.nextCursor))
    : '';
  const full = proofFullResultDisplay(payload);
  const clicked = payload?.metric;
  const fallbackQuery = {
    snapshotToken: query.snapshotToken,
    asOf: query.asOf,
    from: query.from,
    to: query.to,
    branchIds: query.branchIds,
    sessionIds: query.sessionIds,
    actorSource: query.actorSource,
  };

  return (
    <div className="dar-v6 dar-v6-proof" dir={locale === 'ar' ? 'rtl' : 'ltr'} lang={locale === 'ar' ? 'ar' : 'en'}>
      <p className="dar-v6-crumb">
        <Link to={backHref}>{t('proof.crumb')}</Link>
      </p>
      <header className="dar-v6-proof-head">
        <div>
          <h1>{t('proof.title')}</h1>
          <p className="dar-v6-sub">{t('proof.noFeSum')}</p>
        </div>
        <Link to={backHref} className="btn-portal-outline dar-v6-proof-back">
          {t('proof.back')}
        </Link>
      </header>

      <div className="dar-v6-proof-chips" role="status">
        <span>
          {t('proof.metric')}: <b dir="ltr">{query.metricKey || DAR_V6_UNAVAILABLE}</b>
        </span>
        <span>
          {t('proof.window')}: {formatBusinessDate(query.from, locale)} → {formatBusinessDate(query.to, locale)}
        </span>
        <span>
          {t('proof.snapshot')}: <b dir="ltr">{snapshotTokenPreview(query.snapshotToken)}</b>
        </span>
        {query.branchIds.length ? (
          <span dir="ltr">
            {t('filter.branch')}: {query.branchIds.join(', ')}
          </span>
        ) : null}
        {query.sessionIds.length ? (
          <span dir="ltr">
            {t('filter.sessions')}: {query.sessionIds.join(', ')}
          </span>
        ) : null}
        {query.actorSource !== 'all' ? <span>{t('filter.actor')}: {query.actorSource}</span> : null}
        {payload?.reducer ? (
          <span>
            {t('proof.reducer')}: <b dir="ltr">{payload.reducer}</b>
          </span>
        ) : null}
      </div>

      {!allowed || errorKind === 'forbidden' ? (
        <p className="dar-v6-warn" role="alert">
          {t('error.forbidden')}
        </p>
      ) : null}

      {errorKind === 'snapshot' ? (
        <div className="dar-v6-proof-alert" role="alert">
          <p>{t('proof.snapshotChanged')}</p>
          <p>
            {t('proof.metric')}: <b dir="ltr">{query.metricKey}</b>
          </p>
          {!query.asOf ? <p>{t('proof.asOfMissing')}</p> : null}
          <p>{t('proof.refreshHint')}</p>
          <Link to={refreshHref} className="btn-portal">
            {t('proof.refresh')}
          </Link>
        </div>
      ) : null}

      {errorKind === 'invalid' ? (
        <p className="dar-v6-warn" role="alert">
          {query.metricKey ? t('error.invalid') : t('proof.missingKey')}
        </p>
      ) : null}
      {errorKind === 'backend' ? (
        <p className="dar-v6-warn" role="alert">
          {t('error.backend')}
        </p>
      ) : null}
      {errorKind === 'network' ? (
        <p className="dar-v6-warn" role="alert">
          {t('error.network')}
        </p>
      ) : null}
      {errorKind === 'unknown' ? (
        <p className="dar-v6-warn" role="alert">
          {t('error.unknown')}
        </p>
      ) : null}

      {loading ? <p className="dar-v6-status">{t('proof.loading')}</p> : null}

      {payload && errorKind !== 'snapshot' ? (
        <>
          <section className="dar-v6-panel dar-v6-proof-clicked">
            <h2>{t('proof.value')}</h2>
            <p className="dar-v6-proof-value" dir="ltr">
              {formatMetricValue(clicked)}
            </p>
            <dl className="dar-v6-proof-dl">
              <div>
                <dt>{t('proof.basis')}</dt>
                <dd dir="ltr">{clicked?.source || clicked?.scope || DAR_V6_UNAVAILABLE}</dd>
              </div>
              <div>
                <dt>{t('proof.scope')}</dt>
                <dd dir="ltr">{clicked?.scope || DAR_V6_UNAVAILABLE}</dd>
              </div>
              <div>
                <dt>{t('proof.reason')}</dt>
                <dd>{clicked?.reason || payload.coverage?.reasons?.[0] || DAR_V6_UNAVAILABLE}</dd>
              </div>
            </dl>
          </section>

          <section className="dar-v6-panel">
            <h2>{t('proof.fullResult')}</h2>
            <p className="dar-v6-caption">{t('proof.noFeSum')}</p>
            <div className="dar-v6-proof-full">
              <div>
                <label>{t('proof.rowCount')}</label>
                <b dir="ltr">{full.rowCount}</b>
              </div>
              <div>
                <label>{t('proof.reconciled')}</label>
                <b dir="ltr">{full.reconciledValue}</b>
              </div>
              <div>
                <label>{t('proof.difference')}</label>
                <b dir="ltr">{full.difference}</b>
              </div>
            </div>
          </section>

          {payload.derivation ? (
            <section className="dar-v6-panel">
              <h2>{t('proof.derivation')}</h2>
              <p>
                <span className="dar-v6-caption">{t('proof.expression')}</span>
                <code dir="ltr">{payload.derivation.expression || DAR_V6_UNAVAILABLE}</code>
              </p>
              {Array.isArray(payload.derivation.operands) && payload.derivation.operands.length ? (
                <table className="dar-v6-table dar-v6-proof-table">
                  <thead>
                    <tr>
                      <th>{t('proof.operands')}</th>
                      <th>{t('proof.value')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payload.derivation.operands.map((op, i) => {
                      const href = wrapOperandProofHref(op.proofHref, fallbackQuery);
                      const shown =
                        op.value == null ? DAR_V6_UNAVAILABLE : formatExactDecimal(op.value);
                      return (
                        <tr key={`${op.label || 'op'}-${i}`}>
                          <td>{op.label || DAR_V6_UNAVAILABLE}</td>
                          <td dir="ltr">
                            {href ? (
                              <Link className="dar-v6-metric" to={href}>
                                {shown}
                              </Link>
                            ) : (
                              shown
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : null}
            </section>
          ) : null}

          <section className="dar-v6-panel">
            <h2>{t('proof.coverage')}</h2>
            <p>
              {payload.coverage?.complete ? t('proof.complete') : t('proof.incomplete')}
            </p>
            {(payload.coverage?.reasons || []).map((reason, i) => (
              <p key={`${reason}-${i}`} className="dar-v6-caption">
                {reason}
              </p>
            ))}
          </section>

          <section className="dar-v6-panel">
            <h2>{t('proof.rows')}</h2>
            {payload.rows.length === 0 ? (
              <p className="dar-v6-caption">{t('proof.emptyRows')}</p>
            ) : (
              <div className="dar-v6-proof-scroll">
                <table className="dar-v6-table dar-v6-proof-table">
                  <thead>
                    <tr>
                      <th>{t('proof.source')}</th>
                      <th>{t('proof.reference')}</th>
                      <th>{t('proof.date')}</th>
                      <th>{t('proof.recorded')}</th>
                      <th>{t('proof.branch')}</th>
                      <th>{t('proof.actor')}</th>
                      <th>{t('proof.qty')}</th>
                      <th>{t('proof.net')}</th>
                      <th>{t('proof.vat')}</th>
                      <th>{t('proof.gross')}</th>
                      <th>{t('proof.contribution')}</th>
                      <th>{t('proof.included')}</th>
                      <th>{t('proof.reason')}</th>
                      <th>{t('proof.journal')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payload.rows.map((row) => {
                      const src = allowlistedSourceHref(row.authorizedSourceHref);
                      const statusKey = row.journalStatus
                        ? `proof.journal.${row.journalStatus}`
                        : null;
                      const statusLabel = statusKey ? t(statusKey) : null;
                      const journal =
                        row.journalId != null && row.journalId !== ''
                          ? statusLabel
                            ? `${statusLabel} · #${row.journalId}`
                            : String(row.journalId)
                          : statusLabel || t('proof.journal.unavailable');
                      return (
                        <tr key={row.id || row.canonicalEventKey}>
                          <td>
                            {src ? (
                              <Link className="dar-v6-metric" to={src}>
                                {row.sourceType || t('proof.openSource')}
                                {row.sourceId ? ` #${row.sourceId}` : ''}
                              </Link>
                            ) : (
                              `${row.sourceType || DAR_V6_UNAVAILABLE}${row.sourceId ? ` #${row.sourceId}` : ''}`
                            )}
                          </td>
                          <td>{row.reference || DAR_V6_UNAVAILABLE}</td>
                          <td>{formatBusinessDate(row.businessDate, locale)}</td>
                          <td>{formatRiyadhInstant(row.recordedAt, locale)}</td>
                          <td dir="ltr">{row.branchId || DAR_V6_UNAVAILABLE}</td>
                          <td>{row.actor || DAR_V6_UNAVAILABLE}</td>
                          <td dir="ltr">
                            {cellText(row.quantity, 'quantity')}
                            {row.uom ? ` ${row.uom}` : ''}
                          </td>
                          <td dir="ltr">{cellText(row.net)}</td>
                          <td dir="ltr">{cellText(row.vat)}</td>
                          <td dir="ltr">{cellText(row.gross)}</td>
                          <td dir="ltr">{cellText(row.contribution)}</td>
                          <td>{row.included === false ? t('proof.excluded') : t('proof.included')}</td>
                          <td>{row.reason || DAR_V6_UNAVAILABLE}</td>
                          <td dir="ltr" title={row.journalNote || undefined}>
                            {journal}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {nextHref ? (
              <p className="dar-v6-proof-pager">
                <Link className="dar-v6-metric" to={nextHref}>
                  {t('proof.next')}
                </Link>
              </p>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  );
}
