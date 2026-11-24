import React from 'react';
import { formatRiyadhDateClock } from './dailyActivityFormat.js';
import { darT } from './dailyActivityI18n.js';
import { proofFallbackFromReport } from './dailyActivitySummary.js';
import {
  coverageRows,
  moneyPurchases,
  operationRows,
  ownerCoverageCopy,
  sessionRows,
  technicianRows,
} from './dailyActivityRest.js';
import { MetricLink, OsTaggedMetric, Tip } from './DailyActivitySections.jsx';

function OsLink({ metric, locale, fallback }) {
  return <OsTaggedMetric metric={metric} locale={locale} fallback={fallback} />;
}

function Chip({ label, metric, locale, fallback, os = false }) {
  return (
    <div className="dar-v6-chip">
      <label>{label}</label>
      <b>
        {os ? (
          <OsTaggedMetric metric={metric} locale={locale} fallback={fallback} />
        ) : (
          <MetricLink metric={metric} locale={locale} fallbackQuery={fallback} />
        )}
      </b>
    </div>
  );
}

export function DailyActivitySessions({ locale, report }) {
  const t = (k) => darT(locale, k);
  const fallback = proofFallbackFromReport(report, 'sessions');
  const totals = report?.sessions?.totals || {};
  const rows = sessionRows(report);
  return (
    <section className="dar-v6-panel" id="sessions">
      <div className="dar-v6-sectionheading">
        <Tip text={`${t('sess.caption')} ${t('sess.openNull')}`}>
          <h2>{t('sess.section')}</h2>
        </Tip>
      </div>
      <div className="dar-v6-chips">
        <Chip label={t('sess.closed')} metric={totals.closed} locale={locale} fallback={fallback} />
        <Chip label={t('sess.open')} metric={totals.open} locale={locale} fallback={fallback} />
        <Chip label={t('sess.balanced')} metric={totals.balanced} locale={locale} fallback={fallback} />
        <Chip label={t('sess.variance')} metric={totals.withVariance} locale={locale} fallback={fallback} />
        <Chip os label={t('sess.cashOs')} metric={totals.cashOverShort} locale={locale} fallback={fallback} />
        <Chip os label={t('sess.allOs')} metric={totals.allMethodsOverShort} locale={locale} fallback={fallback} />
      </div>
      {rows.length === 0 ? <p className="dar-v6-empty">{t('sess.empty')}</p> : null}
      {rows.length ? (
        <table className="dar-v6-table">
          <thead>
            <tr>
              <th>{t('sess.cashier')}</th>
              <th>{t('sess.branch')}</th>
              <th>{t('sess.window')}</th>
              <th>{t('sess.status')}</th>
              <th>{t('sess.expected')}</th>
              <th>{t('sess.counted')}</th>
              <th>{t('sess.os')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <React.Fragment key={row.id}>
                <tr>
                  <td>{row.cashierName || row.id}</td>
                  <td>{row.branchId}</td>
                  <td>
                    {formatRiyadhDateClock(row.openedAt, locale)} →{' '}
                    {row.closedAt ? formatRiyadhDateClock(row.closedAt, locale) : t('sess.open')}
                  </td>
                  <td>
                    <Tip text={row.closingBasis === 'full_shift' ? t('sess.fullShift') : row.closingBasis}>
                      <span className={`dar-v6-pill${row.status === 'open' || !row.closedAt ? ' open' : ''}`}>
                        {row.status || (row.closedAt ? t('sess.closed') : t('sess.open'))}
                      </span>
                    </Tip>
                  </td>
                  <td>
                    <MetricLink metric={row.expected} locale={locale} fallbackQuery={fallback} />
                  </td>
                  <td>
                    <MetricLink metric={row.counted} locale={locale} fallbackQuery={fallback} />
                  </td>
                  <td>
                    <OsLink metric={row.overShort} locale={locale} fallback={fallback} />
                  </td>
                </tr>
                {(row.methods || []).length ? (
                  <tr className="grade">
                    <td colSpan={7}>
                      {t('sess.methods')}
                      {': '}
                      {(row.methods || []).map((m) => (
                        <span key={m.method} className="dar-v6-method">
                          {m.method}{' '}
                          <MetricLink metric={m.expected} locale={locale} fallbackQuery={fallback} />
                          {' / '}
                          <MetricLink metric={m.counted} locale={locale} fallbackQuery={fallback} />
                          {' / '}
                          <OsLink metric={m.overShort} locale={locale} fallback={fallback} />
                        </span>
                      ))}
                    </td>
                  </tr>
                ) : null}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}

export function DailyActivityMoney({ locale, report }) {
  const t = (k) => darT(locale, k);
  const fallback = proofFallbackFromReport(report, 'finance');
  const money = report?.money || {};
  const petty = money.petty || {};
  const purchases = moneyPurchases(report);
  return (
    <section className="dar-v6-panel" id="finance">
      <div className="dar-v6-sectionheading">
        <Tip text={t('money.period')}>
          <h2>{t('money.section')}</h2>
        </Tip>
      </div>
      <div className="dar-v6-financegrid">
        <div>
          <h3>{t('money.petty')}</h3>
          <p>
            <MetricLink metric={petty.total} locale={locale} fallbackQuery={fallback} />
            {' · '}
            <MetricLink metric={petty.entries} locale={locale} fallbackQuery={fallback} />
          </p>
          <table className="dar-v6-table">
            <thead>
              <tr>
                <th>{t('money.purpose')}</th>
                <th>{t('summary.entries')}</th>
                <th>{t('summary.amount')}</th>
              </tr>
            </thead>
            <tbody>
              {(petty.byPurpose || []).map((p) => (
                <tr key={p.id}>
                  <td>{locale === 'ar' ? p.labelAr || p.labelEn : p.labelEn || p.labelAr}</td>
                  <td>
                    <MetricLink metric={p.entries} locale={locale} fallbackQuery={fallback} />
                  </td>
                  <td>
                    <MetricLink metric={p.amount} locale={locale} fallbackQuery={fallback} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h3>{t('money.noncash')}</h3>
          <p>
            {t('money.net')}{' '}
            <MetricLink metric={money.nonCash?.net} locale={locale} fallbackQuery={fallback} />
            {' · '}
            {t('money.vat')}{' '}
            <MetricLink metric={money.nonCash?.vat} locale={locale} fallbackQuery={fallback} />
            {' · '}
            {t('money.gross')}{' '}
            <MetricLink metric={money.nonCash?.gross} locale={locale} fallbackQuery={fallback} />
            {' · '}
            <MetricLink metric={money.nonCash?.entries} locale={locale} fallbackQuery={fallback} />
          </p>
          <h3>{t('money.advances')}</h3>
          <p>
            <MetricLink metric={money.advances?.amount} locale={locale} fallbackQuery={fallback} />
            {' · '}
            <MetricLink metric={money.advances?.entries} locale={locale} fallbackQuery={fallback} />
          </p>
          <h3>{t('money.replenish')}</h3>
          <p>
            <MetricLink metric={money.replenishment?.amount} locale={locale} fallbackQuery={fallback} />
            {' · '}
            <MetricLink metric={money.replenishment?.entries} locale={locale} fallbackQuery={fallback} />
          </p>
        </div>
      </div>
      <h3>{t('money.purchases')}</h3>
      <table className="dar-v6-table">
        <thead>
          <tr>
            <th>{t('money.relationship')}</th>
            <th>{t('summary.entries')}</th>
            <th>{t('money.net')}</th>
            <th>{t('money.vat')}</th>
            <th>{t('money.gross')}</th>
            <th>{t('money.paid')}</th>
            <th>{t('money.balance')}</th>
          </tr>
        </thead>
        <tbody>
          {purchases.map((p) => (
            <tr key={p.relationship}>
              <td>
                {p.relationship === 'affiliated' ? t('money.affiliated') : t('money.local')}
              </td>
              <td>
                <MetricLink metric={p.entries} locale={locale} fallbackQuery={fallback} />
              </td>
              <td>
                <MetricLink metric={p.net} locale={locale} fallbackQuery={fallback} />
              </td>
              <td>
                <MetricLink metric={p.vat} locale={locale} fallbackQuery={fallback} />
              </td>
              <td>
                <MetricLink metric={p.gross} locale={locale} fallbackQuery={fallback} />
              </td>
              <td>
                <MetricLink metric={p.paid} locale={locale} fallbackQuery={fallback} />
              </td>
              <td>
                <MetricLink metric={p.balance} locale={locale} fallbackQuery={fallback} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function opLabel(op, locale) {
  return locale === 'ar' ? op.labelAr || op.labelEn : op.labelEn || op.labelAr;
}

function OperationsTable({ locale, rows, fallback, qty = false }) {
  const t = (k) => darT(locale, k);
  if (!rows.length) return null;
  return (
    <table className="dar-v6-table">
      <thead>
        <tr>
          <th>{t('ops.movement')}</th>
          <th>{t('summary.amount')}</th>
          <th>{t('summary.entries')}</th>
          {qty ? <th>{t('ops.qty')}</th> : null}
        </tr>
      </thead>
      <tbody>
        {rows.map((op) => (
          <tr key={op.code}>
            <td>
              <Tip text={op.treatment}>
                <span>{opLabel(op, locale)}</span>
              </Tip>
            </td>
            <td>
              <MetricLink metric={op.amount} locale={locale} fallbackQuery={fallback} />
            </td>
            <td>
              <MetricLink metric={op.entries} locale={locale} fallbackQuery={fallback} />
            </td>
            {qty ? (
              <td>
                {(op.qtyByUom || []).map((q) => (
                  <div key={q.key}>
                    <MetricLink metric={q} locale={locale} fallbackQuery={fallback} />
                    {q.unit && q.unit !== 'SAR' && q.unit !== 'count' ? (
                      <span className="dar-v6-uom"> {q.unit}</span>
                    ) : null}
                  </div>
                ))}
              </td>
            ) : null}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function DailyActivityOperations({ locale, report }) {
  const t = (k) => darT(locale, k);
  const fallback = proofFallbackFromReport(report, 'operations');
  const rows = operationRows(report);
  const selected = rows.filter((op) => (op.group || '') === 'selected_sales');
  const bridges = rows.filter((op) => op.group === 'selected_sales_bridges');
  const receipts = rows.filter((op) => op.group === 'receipts');
  const invoiceDate = rows.filter((op) => op.group === 'invoice_date');
  const other = rows.filter(
    (op) =>
      !['selected_sales', 'selected_sales_bridges', 'receipts', 'invoice_date'].includes(
        op.group || '',
      ),
  );
  return (
    <section className="dar-v6-panel" id="operations">
      <div className="dar-v6-sectionheading">
        <Tip text={t('ops.caption')}>
          <h2>{t('ops.section')}</h2>
        </Tip>
      </div>
      <h3 className="dar-v6-subhead">{t('ops.selectedSales')}</h3>
      <p className="dar-v6-hint">{t('ops.tendersCaption')}</p>
      <OperationsTable locale={locale} rows={selected} fallback={fallback} />
      <OperationsTable locale={locale} rows={bridges} fallback={fallback} />
      <h3 className="dar-v6-subhead">{t('ops.allReceipts')}</h3>
      <p className="dar-v6-hint">{t('ops.receiptsIncluded')}</p>
      <OperationsTable locale={locale} rows={receipts} fallback={fallback} />
      {invoiceDate.length ? (
        <details className="dar-v6-tech">
          <summary>{t('ops.invoiceDateDetails')}</summary>
          <OperationsTable locale={locale} rows={invoiceDate} fallback={fallback} />
        </details>
      ) : null}
      {other.length ? (
        <>
          <h3 className="dar-v6-subhead">{t('ops.other')}</h3>
          <OperationsTable locale={locale} rows={other} fallback={fallback} qty />
        </>
      ) : null}
    </section>
  );
}

export function DailyActivityTechnicians({ locale, report }) {
  const t = (k) => darT(locale, k);
  const fallback = proofFallbackFromReport(report, 'operations');
  const rows = technicianRows(report);
  const totals = report?.technicians?.totals || {};
  return (
    <section className="dar-v6-panel" id="technicians">
      <div className="dar-v6-sectionheading">
        <Tip
          text={[t('tech.caption'), report?.technicians?.attributionBasis].filter(Boolean).join(' — ')}
        >
          <h2>{t('tech.section')}</h2>
        </Tip>
      </div>
      {rows.length === 0 ? <p className="dar-v6-empty">{t('tech.empty')}</p> : null}
      {rows.length ? (
        <table className="dar-v6-table">
          <thead>
            <tr>
              <th>{t('tech.name')}</th>
              <th>{t('tech.jobs')}</th>
              <th>{t('tech.assign')}</th>
              <th>{t('tech.rev')}</th>
              <th>{t('tech.comm')}</th>
              <th>{t('tech.avgH')}</th>
              <th>{t('tech.avgM')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.name || row.id}</td>
                <td>
                  <MetricLink metric={row.jobsCompleted} locale={locale} fallbackQuery={fallback} />
                </td>
                <td>
                  <MetricLink
                    metric={row.assignmentsCompleted}
                    locale={locale}
                    fallbackQuery={fallback}
                  />
                </td>
                <td>
                  <MetricLink metric={row.attributedRevenue} locale={locale} fallbackQuery={fallback} />
                </td>
                <td>
                  <MetricLink
                    metric={row.commissionAttributed}
                    locale={locale}
                    fallbackQuery={fallback}
                  />
                </td>
                <td>
                  <MetricLink metric={row.avgDurationHours} locale={locale} fallbackQuery={fallback} />
                </td>
                <td>
                  <MetricLink metric={row.avgRespondMinutes} locale={locale} fallbackQuery={fallback} />
                </td>
              </tr>
            ))}
            {totals && Object.keys(totals).length ? (
              <tr className="total">
                <td>{t('summary.total')}</td>
                <td>
                  <MetricLink metric={totals.jobsCompleted} locale={locale} fallbackQuery={fallback} />
                </td>
                <td>
                  <MetricLink
                    metric={totals.assignmentsCompleted}
                    locale={locale}
                    fallbackQuery={fallback}
                  />
                </td>
                <td>
                  <MetricLink
                    metric={totals.attributedRevenue}
                    locale={locale}
                    fallbackQuery={fallback}
                  />
                </td>
                <td>
                  <MetricLink
                    metric={totals.commissionAttributed}
                    locale={locale}
                    fallbackQuery={fallback}
                  />
                </td>
                <td>
                  <MetricLink metric={totals.avgDurationHours} locale={locale} fallbackQuery={fallback} />
                </td>
                <td>
                  <MetricLink
                    metric={totals.avgRespondMinutes}
                    locale={locale}
                    fallbackQuery={fallback}
                  />
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}

export function DailyActivityCoverage({ locale, report }) {
  const t = (k) => darT(locale, k);
  const fallback = proofFallbackFromReport(report, 'operations');
  const rows = coverageRows(report);
  const recon = report?.reconciliation || [];
  return (
    <section className="dar-v6-panel" id="coverage">
      <div className="dar-v6-sectionheading">
        <Tip text={t('cov.caption')}>
          <h2>{t('cov.section')}</h2>
        </Tip>
      </div>
      <table className="dar-v6-table">
        <thead>
          <tr>
            <th>{t('cov.item')}</th>
            <th>{t('cov.status')}</th>
            <th>{t('summary.entries')}</th>
            <th>{t('summary.amount')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const copy = ownerCoverageCopy(row, locale);
            const detail = [copy.why, copy.technical].filter(Boolean).join(' — ');
            return (
            <tr key={row.code}>
              <td>
                <Tip text={detail}>
                  <span>{copy.label}</span>
                </Tip>
              </td>
              <td>
                <Tip text={detail}>
                  <span>{copy.status}</span>
                </Tip>
              </td>
              <td>
                <MetricLink metric={row.entries} locale={locale} fallbackQuery={fallback} />
              </td>
              <td>
                <MetricLink metric={row.amount} locale={locale} fallbackQuery={fallback} />
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
      {recon.length ? (
        <details className="dar-v6-tech">
          <summary>{t('cov.section')}</summary>
          <ul>
          {recon.map((row) => (
            <li key={row.code}>
              {row.code} · {row.status}{' '}
              <MetricLink metric={row.difference} locale={locale} fallbackQuery={fallback} />
            </li>
          ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
