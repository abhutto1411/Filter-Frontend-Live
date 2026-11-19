import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import MultiSelectSearchCombo from '../../../components/MultiSelectSearchCombo.jsx';
import {
  DAR_V6_SECTION_TABS,
  DAR_V6_UNAVAILABLE,
  formatMetricValue,
  formatOwnerScopeLine,
  formatRiyadhDateClock,
  formatRiyadhExclusiveWindow,
  formatRiyadhInstant,
  sessionChipLabel,
  sessionOpenedGroupLabel,
  sessionSelectedChipLabel,
  sessionsForSelectedBranches,
  wrapProofHref,
} from './dailyActivityFormat.js';
import {
  buildDepartmentViews,
  buildReconciliationNotes,
  qtyFragments,
} from './dailyActivityDepartments.js';
import { darT } from './dailyActivityI18n.js';
import { sanitizeVerifyReason } from './dailyActivityVerify.js';
import { osTagKind, signedOsTone } from './dailyActivityRest.js';
import { buildKpiCards, buildSummaryView, proofFallbackFromReport } from './dailyActivitySummary.js';

export function Tip({ text, children }) {
  if (!text) return children ?? null;
  if (React.isValidElement(children)) {
    const prev = children.props.className;
    return React.cloneElement(children, {
      className: [prev, 'dar-v6-tip'].filter(Boolean).join(' '),
      title: text,
      'data-tip': text,
      tabIndex: children.props.tabIndex ?? 0,
    });
  }
  return (
    <span className="dar-v6-tip" title={text} data-tip={text} tabIndex={0}>
      {children}
    </span>
  );
}

export function MetricLink({ metric, fallbackQuery, children }) {
  const label = children ?? formatMetricValue(metric);
  const href = wrapProofHref(metric, fallbackQuery);
  const key = metric?.key || metric?.proof?.metricKey || 'metric';
  const reason = metric?.reason || '';
  return (
    <Link
      className="dar-v6-metric"
      to={href}
      title={reason || undefined}
      aria-label={`${key} ${label}${reason ? ` — ${reason}` : ''}`}
    >
      <span className="dar-v6-metric__value" dir="ltr">
        {label}
      </span>
    </Link>
  );
}

export function OsTaggedMetric({ metric, locale, fallback }) {
  const t = (k) => darT(locale, k);
  const tone = signedOsTone(metric);
  const tag = osTagKind(metric);
  return (
    <span className={`dar-v6-os dar-v6-os--${tone}`}>
      <MetricLink metric={metric} locale={locale} fallbackQuery={fallback} />
      {tag ? <span className={`dar-v6-ostag dar-v6-ostag--${tag}`}>{t(`os.${tag}`)}</span> : null}
    </span>
  );
}

export function DailyActivityHeader({
  locale,
  onLocale,
  onPdfEn,
  onPdfAr,
  pdfEnabled = false,
  pdfBusy = false,
  pdfReason = '',
  onVerify,
  verifyEnabled = false,
  verifyBusy = false,
  verifyStatus = 'unverified',
}) {
  const t = (k) => darT(locale, k);
  const disabled = !pdfEnabled || pdfBusy;
  const verifyDisabled = !verifyEnabled || verifyBusy;
  const statusKey = `verify.${verifyStatus}`;
  const statusLabel = t(statusKey) === statusKey ? t('verify.unverified') : t(statusKey);
  return (
    <header className="ws-page-header dar-v6-head">
      <div>
        <div className="dar-v6-crumb">{t('crumb')}</div>
        <h1>{t('title')}</h1>
        <p className="dar-v6-sub">{t('subtitle')}</p>
      </div>
      <div className="ws-page-header-actions dar-v6-topright">
        <div className="dar-v6-lang" role="group" aria-label="Language">
          <button
            type="button"
            className={`ws-lang-btn${locale === 'en' ? ' active' : ''}`}
            onClick={() => onLocale?.('en')}
          >
            EN
          </button>
          <button
            type="button"
            className={`ws-lang-btn ws-lang-btn-ar${locale === 'ar' ? ' active' : ''}`}
            onClick={() => onLocale?.('ar')}
          >
            عربي
          </button>
        </div>
        <button
          type="button"
          className={`btn-portal-outline dar-v6-verify-btn dar-v6-verify-btn--${verifyStatus}`}
          disabled={verifyDisabled}
          title={t('verify.hint')}
          aria-busy={verifyBusy ? 'true' : 'false'}
          onClick={() => onVerify?.()}
        >
          {verifyBusy ? t('verify.running') : t('verify.action')}
          <span className="dar-v6-verify-chip">{statusLabel}</span>
        </button>
        <button
          type="button"
          className="btn-portal-outline"
          disabled={disabled}
          title={disabled ? pdfReason || t('pdf.later') : t('pdf.enHint')}
          onClick={() => onPdfEn?.()}
        >
          {t('pdf.en')}
        </button>
        <button
          type="button"
          className="btn-portal-outline"
          disabled={disabled}
          title={disabled ? pdfReason || t('pdf.later') : t('pdf.arHint')}
          onClick={() => onPdfAr?.()}
        >
          {t('pdf.ar')}
        </button>
      </div>
    </header>
  );
}

export function DailyActivityFilters({
  locale,
  draft,
  branches,
  sessions,
  actorSourceAvailable,
  sessionsCleared,
  applying,
  onDraft,
  onApply,
}) {
  const t = (k) => darT(locale, k);
  const selectedBranches = (draft.branchIds || []).map(String);
  const selectedSessions = (draft.sessionIds || []).map(String);
  const branchOptions = useMemo(
    () =>
      (branches || []).map((b) => ({
        id: String(b.id),
        label: locale === 'ar' ? b.labelAr || b.labelEn || b.id : b.labelEn || b.labelAr || b.id,
        searchText: `${b.labelEn || ''} ${b.labelAr || ''} ${b.id}`,
      })),
    [branches, locale],
  );
  const sessionOptions = useMemo(
    () =>
      sessionsForSelectedBranches(sessions, selectedBranches).map((s) => {
        const full = sessionChipLabel(s, locale);
        const opened = formatRiyadhDateClock(s.openedAt, locale);
        return {
          id: String(s.id),
          label: full,
          optionLabel: full,
          chipLabel: sessionSelectedChipLabel(s, locale),
          hint: locale === 'ar' ? `افتتحت ${opened} آسيا/الرياض` : `Opened ${opened} Asia/Riyadh`,
          group: sessionOpenedGroupLabel(s, locale),
          searchText: `${s.id} ${s.cashierName || ''} ${s.branchId || ''} ${s.status || ''} ${full} ${opened}`,
        };
      }),
    [sessions, locale, selectedBranches],
  );

  function onBranchesChange(next) {
    const ids = (next || []).map(String).filter((v) => /^\d+$/.test(v));
    onDraft({ ...draft, branchIds: ids, sessionIds: [] });
  }

  function onSessionsChange(next) {
    const ids = (next || []).map(String).filter((v) => /^\d+$/.test(v));
    onDraft({ ...draft, sessionIds: ids });
  }

  return (
    <form
      className="dar-v6-filters"
      onSubmit={(e) => {
        e.preventDefault();
        onApply();
      }}
    >
      <div className="dar-v6-field">
        <label htmlFor="dar-from">{t('filter.from')}</label>
        <input
          id="dar-from"
          type="date"
          value={draft.from || ''}
          onChange={(e) => onDraft({ ...draft, from: e.target.value, sessionIds: [] })}
        />
      </div>
      <div className="dar-v6-field">
        <label htmlFor="dar-to">{t('filter.to')}</label>
        <input
          id="dar-to"
          type="date"
          value={draft.to || ''}
          onChange={(e) => onDraft({ ...draft, to: e.target.value, sessionIds: [] })}
        />
      </div>
      <div className="dar-v6-field dar-v6-field--combo">
        <Tip text={t('filter.branchesAll')}>
          <label id="dar-branches-label">{t('filter.branch')}</label>
        </Tip>
        <MultiSelectSearchCombo
          options={branchOptions}
          value={selectedBranches}
          onChange={onBranchesChange}
          placeholder={t('filter.branchesPh')}
          emptyHint={t('filter.noBranches')}
          clearLabel={t('filter.clear')}
          removeLabel={t('filter.remove')}
          menuMinWidth={280}
        />
      </div>
      <div className="dar-v6-field dar-v6-field--combo">
        <Tip text={t('filter.sessionsHint')}>
          <label id="dar-sessions-label">{t('filter.sessions')}</label>
        </Tip>
        <MultiSelectSearchCombo
          options={sessionOptions}
          value={selectedSessions}
          onChange={onSessionsChange}
          placeholder={t('filter.sessionsPh')}
          emptyHint={t('filter.noSessions')}
          clearLabel={t('filter.clear')}
          removeLabel={t('filter.remove')}
          menuMinWidth={560}
        />
        {sessionsCleared ? <p className="dar-v6-warn">{t('filter.sessionsCleared')}</p> : null}
      </div>
      <div className="dar-v6-field">
        <Tip text={!actorSourceAvailable ? t('filter.actorUnavailable') : t('filter.actorAll')}>
          <label htmlFor="dar-actor">{t('filter.actor')}</label>
        </Tip>
        <select
          id="dar-actor"
          disabled={!actorSourceAvailable}
          value={actorSourceAvailable ? draft.actorSource : 'all'}
          onChange={(e) => onDraft({ ...draft, actorSource: e.target.value })}
          title={!actorSourceAvailable ? t('filter.actorUnavailable') : undefined}
        >
          <option value="all">{t('filter.actorAll')}</option>
        </select>
      </div>
      <button type="submit" className="btn-portal" disabled={applying}>
        {t('apply')}
      </button>
    </form>
  );
}

export function DailyActivityScope({ locale, report }) {
  const t = (k) => darT(locale, k);
  const meta = report?.meta;
  const windows = meta?.effectiveWindows || [];
  const boundaries = meta?.sessionBoundaries || [];
  const overnight = (meta?.scopeWarnings || []).filter((w) => w.code === 'SESSION_CLIPPED_OVERNIGHT');
  return (
    <section className="dar-v6-scope" aria-label={t('scope.windows')}>
      <div className="dar-v6-scopebar">
        <b>{t('scope.actors')}</b>
        <span dir="ltr">{formatOwnerScopeLine(meta, locale)}</span>
      </div>
      <p className="dar-v6-hint">{t('scope.mixed')}</p>
      <ul className="dar-v6-scope-groups">
        <li>{t('scope.group.activity')}</li>
        <li>{t('scope.group.fullShift')}</li>
        <li>{t('scope.group.period')}</li>
      </ul>
      {boundaries.length ? (
        <ul className="dar-v6-windows">
          {boundaries.map((s) => (
            <li key={s.id}>
              {s.id}
              {' · '}
              {locale === 'ar' ? 'افتتحت' : 'opened'}{' '}
              <span dir="ltr">{formatRiyadhDateClock(s.openedAt, locale)}</span>
              {' · '}
              {locale === 'ar' ? 'الشريحة' : 'slice'}{' '}
              <span dir="ltr">
                {formatRiyadhDateClock(s.clippedStart, locale)} →{' '}
                {formatRiyadhDateClock(s.clippedEndExclusive, locale)}
              </span>
              {' · '}
              {t('scope.tz')}
            </li>
          ))}
        </ul>
      ) : null}
      {overnight.map((w) => (
        <p key={w.code} className="dar-v6-warn">
          {locale === 'ar' ? w.textAr || w.textEn : w.textEn || w.textAr}
        </p>
      ))}
      <details className="dar-v6-tech">
        <summary>{t('scope.windowsToggle')}</summary>
        {windows.length ? (
          <ul className="dar-v6-windows">
            {windows.map((w) => (
              <li key={`${w.branchId}-${w.start}`}>
                {w.branchId ? `${w.branchId} · ` : ''}
                <span dir="ltr">{formatRiyadhExclusiveWindow(w.start, w.endExclusive, locale)}</span>
                {' · '}
                {t('scope.tz')}
              </li>
            ))}
          </ul>
        ) : (
          <p className="dar-v6-caption">{t('filter.sessionsAll')}</p>
        )}
        <p className="dar-v6-meta">
          {t('scope.generated')}: {formatRiyadhInstant(meta?.generatedAt, locale)}
          {' · '}
          {t('scope.asOf')}: {formatRiyadhInstant(meta?.asOf, locale)}
        </p>
      </details>
    </section>
  );
}

export function DailyActivityKpis({ locale, report }) {
  const t = (k) => darT(locale, k);
  const cards = buildKpiCards(report, locale);
  const fallback = proofFallbackFromReport(report, 'accumulated');
  return (
    <section className="dar-v6-kpis-wrap" aria-label={t('kpi.salesEx')}>
      <div className="dar-v6-kpis">
        {cards.map((c) => {
          const tip = [c.hint, c.reason].filter(Boolean).join(' — ');
          return (
            <article key={c.id} className={`dar-v6-kpi${c.id === 'salesEx' ? ' accent' : ''}`}>
              <Tip text={tip}>
                <label>
                  {c.label}
                  {c.scope ? (
                    <span className="dar-v6-scope-tag">
                      {' '}
                      {c.scope === 'full_shift'
                        ? t('scope.tag.fullShift')
                        : c.scope === 'session_windows'
                          ? t('scope.tag.activity')
                          : t('scope.tag.period')}
                    </span>
                  ) : null}
                </label>
              </Tip>
              <strong>
                {c.id === 'cashOs' ? (
                  <OsTaggedMetric metric={c.metric} locale={locale} fallback={fallback} />
                ) : (
                  <MetricLink metric={c.metric} locale={locale} fallbackQuery={fallback} />
                )}
              </strong>
            </article>
          );
        })}
      </div>
      <p className="dar-v6-notice">{t('pdf.caution')}</p>
    </section>
  );
}

export function DailyActivitySummary({ locale, report }) {
  const t = (k) => darT(locale, k);
  const view = buildSummaryView(report, locale);
  const fallback = proofFallbackFromReport(report, 'accumulated');
  return (
    <section className="dar-v6-summary panel accumulated" id="accumulated">
      <div className="dar-v6-sectionheading">
        <Tip text={t('summary.caption')}>
          <h2>{t('summary.title')}</h2>
        </Tip>
      </div>
      <table className="dar-v6-table">
        <thead>
          <tr>
            <th scope="col">{t('summary.dept')}</th>
            <th scope="col">{t('summary.ex')}</th>
            <th scope="col">{t('summary.inc')}</th>
          </tr>
        </thead>
        <tbody>
          {view.departments.length === 0 ? (
            <tr>
              <td colSpan={3}>{t('summary.emptyDepts')}</td>
            </tr>
          ) : (
            view.departments.map((row) => (
              <tr key={row.id}>
                <td>{row.label}</td>
                <td>
                  <MetricLink metric={row.exVat} locale={locale} fallbackQuery={fallback} />
                </td>
                <td>
                  <MetricLink metric={row.inclVat} locale={locale} fallbackQuery={fallback} />
                </td>
              </tr>
            ))
          )}
          <tr className="total">
            <td>{t('summary.total')}</td>
            <td>
              <MetricLink metric={view.salesTotal.exVat} locale={locale} fallbackQuery={fallback} />
            </td>
            <td>
              <MetricLink metric={view.salesTotal.inclVat} locale={locale} fallbackQuery={fallback} />
            </td>
          </tr>
        </tbody>
      </table>
      <div className="dar-v6-vatsummary">
        <div>
          {t('summary.ex')}
          <b>
            <MetricLink metric={view.salesTotal.exVat} locale={locale} fallbackQuery={fallback} />
          </b>
        </div>
        <div>
          {t('summary.vatCard')}
          <b>
            <MetricLink metric={view.salesTotal.vat} locale={locale} fallbackQuery={fallback} />
          </b>
        </div>
        <div>
          {t('summary.inclStart')}
          <b>
            <MetricLink metric={view.salesTotal.inclVat} locale={locale} fallbackQuery={fallback} />
          </b>
        </div>
      </div>
      <table className="dar-v6-table">
        <thead>
          <tr>
            <th scope="col">{t('summary.deductions')}</th>
            <th scope="col">{t('summary.amount')}</th>
            <th scope="col">{t('summary.entries')}</th>
          </tr>
        </thead>
        <tbody>
          {view.deductions.map((d) => {
            const detail = [d.payableNote, d.amount?.reason].filter(Boolean).join(' — ');
            return (
            <tr key={d.code}>
              <td>
                <Tip text={detail}>
                  <span>{d.label}</span>
                </Tip>
              </td>
              <td>
                <MetricLink metric={d.amount} locale={locale} fallbackQuery={fallback} />
              </td>
              <td>
                <MetricLink metric={d.entries} locale={locale} fallbackQuery={fallback} />
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
      <div className="dar-v6-summarybottom">
        <div>
          <Tip text={view.knownDeductions?.reason}>
            <label>{t('summary.known')}</label>
          </Tip>
          <b>
            <MetricLink metric={view.knownDeductions} locale={locale} fallbackQuery={fallback} />
          </b>
        </div>
        <div>
          <Tip text={[t('summary.remainderNotNet'), view.remainderBeforeUnknowns?.reason].filter(Boolean).join(' — ')}>
            <label>{t('summary.remainder')}</label>
          </Tip>
          <b>
            <MetricLink
              metric={view.remainderBeforeUnknowns}
              locale={locale}
              fallbackQuery={fallback}
            />
          </b>
        </div>
        <div className="net">
          <Tip text={[t('summary.formula'), view.net?.reason].filter(Boolean).join(' — ')}>
            <label>{t('summary.net')}</label>
          </Tip>
          <b>
            <MetricLink metric={view.net} locale={locale} fallbackQuery={fallback} />
          </b>
        </div>
      </div>
      {view.exclusions.length ? (
        <table className="dar-v6-table">
          <thead>
            <tr>
              <th scope="col">{t('summary.exclusions')}</th>
              <th scope="col">{t('summary.amount')}</th>
              <th scope="col">{t('summary.entries')}</th>
            </tr>
          </thead>
          <tbody>
            {view.exclusions.map((ex) => (
              <tr key={ex.code}>
                <td>{ex.label}</td>
                <td>
                  <MetricLink metric={ex.amount} locale={locale} fallbackQuery={fallback} />
                </td>
                <td>
                  <MetricLink metric={ex.entries} locale={locale} fallbackQuery={fallback} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}

function MeasuresStrip({ locale, measures, fallback, withholdTip }) {
  const t = (k) => darT(locale, k);
  const frags = qtyFragments(measures);
  const cost = measures?.cost;
  const margin = measures?.marginAmount;
  const pct = measures?.marginPct;
  const tip =
    withholdTip ||
    (cost?.value == null && cost?.reason ? cost.reason : null) ||
    (margin?.value == null && margin?.reason ? margin.reason : null);
  return (
    <div className="dar-v6-metrics">
      <div>
        <label>{t('dept.qty')}</label>
        <b>
          {frags.length === 0 ? (
            DAR_V6_UNAVAILABLE
          ) : (
            frags.map((f, i) => (
              <span key={f.metric?.key || i}>
                {i ? ' · ' : null}
                <MetricLink metric={f.metric} locale={locale} fallbackQuery={fallback} />
                {f.metric?.unit && f.metric.unit !== 'count' && f.metric.unit !== 'SAR' ? (
                  <span className="dar-v6-uom"> {f.metric.unit}</span>
                ) : null}
              </span>
            ))
          )}
        </b>
      </div>
      <div>
        <label>{t('dept.revenue')}</label>
        <b>
          <MetricLink metric={measures?.revenue?.exVat} locale={locale} fallbackQuery={fallback} />
        </b>
      </div>
      <div>
        <label>{t('dept.cost')}</label>
        <b>
          <Tip text={cost?.value == null ? tip : null}>
            <MetricLink metric={cost} locale={locale} fallbackQuery={fallback} />
          </Tip>
        </b>
        {cost?.status === 'estimated' ? <small className="dar-v6-basis">{t('dept.estimated')}</small> : null}
      </div>
      <div>
        <label>{t('dept.margin')}</label>
        <b>
          <Tip text={margin?.value == null ? tip : null}>
            <MetricLink metric={margin} locale={locale} fallbackQuery={fallback} />
          </Tip>
        </b>
        {margin?.status === 'estimated' ? <small className="dar-v6-basis">{t('dept.estimated')}</small> : null}
      </div>
      <div>
        <label>{t('dept.marginPct')}</label>
        <b>
          <Tip text={pct?.value == null ? tip : null}>
            <MetricLink metric={pct} locale={locale} fallbackQuery={fallback} />
          </Tip>
        </b>
      </div>
    </div>
  );
}

function ProductCostCoverageStrip({ locale, coverage, fallback }) {
  const t = (k) => darT(locale, k);
  if (!coverage?.productMeasures) return null;
  const pm = coverage.productMeasures;
  if (pm.cost?.value == null && !coverage.incomplete) return null;
  return (
    <div className="dar-v6-product-cost" role="group" aria-label={t('dept.productOnlyCost')}>
      <Tip text={coverage.reason || t('dept.costWithheld')}>
        <h5>{t('dept.productOnlyCost')}</h5>
      </Tip>
      <p className="dar-v6-notice">{t('dept.costWithheld')}</p>
      <div className="dar-v6-metrics">
        <div>
          <label>{t('dept.productOnlyDenom')}</label>
          <b>
            <MetricLink metric={pm.revenue?.exVat} locale={locale} fallbackQuery={fallback} />
          </b>
        </div>
        <div>
          <label>{t('dept.cost')}</label>
          <b>
            <MetricLink metric={pm.cost} locale={locale} fallbackQuery={fallback} />
          </b>
          {pm.cost?.status === 'estimated' ? (
            <small className="dar-v6-basis">{t('dept.estimated')}</small>
          ) : null}
        </div>
        <div>
          <label>{t('dept.margin')}</label>
          <b>
            <MetricLink metric={pm.marginAmount} locale={locale} fallbackQuery={fallback} />
          </b>
        </div>
        <div>
          <label>{t('dept.marginPct')}</label>
          <b>
            <MetricLink metric={pm.marginPct} locale={locale} fallbackQuery={fallback} />
          </b>
        </div>
        <div>
          <label>{t('dept.uncoveredServices')}</label>
          <b>
            <MetricLink
              metric={coverage.uncoveredServiceExVat}
              locale={locale}
              fallbackQuery={fallback}
            />
            {' / '}
            <MetricLink
              metric={coverage.uncoveredServiceCount}
              locale={locale}
              fallbackQuery={fallback}
            />
          </b>
        </div>
      </div>
    </div>
  );
}

function Top5CoverageNote({ locale, coverage }) {
  const t = (k) => darT(locale, k);
  if (!coverage) return null;
  const sold = coverage.soldItemCount ?? 0;
  const shown = coverage.shownCount ?? 0;
  const text = coverage.truncated
    ? t('dept.top5Remainder')
        .replace('{shown}', String(shown))
        .replace('{sold}', String(sold))
        .replace(
          '{shownAmt}',
          coverage.shownExVat?.value != null ? String(coverage.shownExVat.value) : '—',
        )
        .replace(
          '{remainAmt}',
          coverage.remainderExVat?.value != null ? String(coverage.remainderExVat.value) : '—',
        )
        .replace('{remainCount}', String(coverage.remainderItemCount ?? 0))
    : t('dept.top5Complete').replace('{sold}', String(sold));
  return (
    <p className="dar-v6-top5-note">
      <Tip text={coverage.remainderExVat?.reason || t('dept.subset')}>
        <span>{text}</span>
      </Tip>
    </p>
  );
}

function DetailTable({ locale, rows, fallback, showGrades }) {
  const t = (k) => darT(locale, k);
  const [open, setOpen] = useState({});
  if (!rows.length) return null;
  return (
    <table className="dar-v6-table">
      <thead>
        <tr>
          <th scope="col">{t('dept.item')}</th>
          <th scope="col">{t('dept.qty')}</th>
          <th scope="col">{t('dept.cost')}</th>
          <th scope="col">{t('dept.revenue')}</th>
          <th scope="col">{t('dept.margin')}</th>
          <th scope="col">{t('dept.mapping')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const grades = showGrades ? row.grades || [] : [];
          const foldable = grades.length > 0;
          const expanded = foldable ? Boolean(open[row.id || row.code]) : false;
          const label = locale === 'ar' ? row.labelAr || row.labelEn : row.labelEn || row.labelAr;
          const foldId = row.id || row.code;
          return (
          <React.Fragment key={foldId}>
            <tr className={row.isSubset ? 'grade' : undefined}>
              <td>
                {foldable ? (
                  <Tip text={t('dept.subset')}>
                    <button
                      type="button"
                      className="dar-v6-fold"
                      aria-expanded={expanded}
                      aria-label={`${label} — ${t('dept.gradesCount').replace('{n}', String(grades.length))}`}
                      onClick={() =>
                        setOpen((prev) => ({ ...prev, [foldId]: !prev[foldId] }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setOpen((prev) => ({ ...prev, [foldId]: !prev[foldId] }));
                        }
                      }}
                    >
                      <span className="dar-v6-chevron" aria-hidden="true">
                        {expanded ? '▾' : locale === 'ar' ? '◂' : '▸'}
                      </span>
                      <span>{label}</span>
                      <span className="dar-v6-foldcount">
                        {t('dept.gradesCount').replace('{n}', String(grades.length))}
                      </span>
                    </button>
                  </Tip>
                ) : (
                  <Tip text={row.isSubset ? t('dept.subset') : null}>
                    <span>{label}</span>
                  </Tip>
                )}
              </td>
              <td>
                {(row.measures?.qtyByUom || []).map((q) => (
                  <div key={q.key}>
                    <MetricLink metric={q} locale={locale} fallbackQuery={fallback} />
                    {q.unit && q.unit !== 'count' && q.unit !== 'SAR' ? (
                      <span className="dar-v6-uom"> {q.unit}</span>
                    ) : null}
                  </div>
                ))}
              </td>
              <td>
                <MetricLink metric={row.measures?.cost} locale={locale} fallbackQuery={fallback} />
                {row.measures?.cost?.status === 'estimated' ? (
                  <small className="dar-v6-basis">{t('dept.estimated')}</small>
                ) : null}
              </td>
              <td>
                <MetricLink
                  metric={row.measures?.revenue?.exVat}
                  locale={locale}
                  fallbackQuery={fallback}
                />
              </td>
              <td>
                <MetricLink
                  metric={row.measures?.marginAmount}
                  locale={locale}
                  fallbackQuery={fallback}
                />
                {row.measures?.marginAmount?.status === 'estimated' ? (
                  <small className="dar-v6-basis">{t('dept.estimated')}</small>
                ) : null}
              </td>
              <td>
                <Tip text={row.mappingStatus === 'unmapped' ? t('dept.unmapped') : null}>
                  <span>{row.mappingStatus || ''}</span>
                </Tip>
              </td>
            </tr>
            {foldable && expanded
              ? grades.map((g) => (
              <tr key={g.id} className="grade">
                <td>
                  <Tip text={t('dept.subset')}>
                    <span>{locale === 'ar' ? g.labelAr || g.labelEn || g.id : g.labelEn || g.labelAr || g.id}</span>
                  </Tip>
                </td>
                <td>
                  {(g.measures?.qtyByUom || []).map((q) => (
                    <div key={q.key}>
                      <MetricLink metric={q} locale={locale} fallbackQuery={fallback} />
                      {q.unit && q.unit !== 'count' && q.unit !== 'SAR' ? (
                        <span className="dar-v6-uom"> {q.unit}</span>
                      ) : null}
                    </div>
                  ))}
                </td>
                <td>
                  <MetricLink metric={g.measures?.cost} locale={locale} fallbackQuery={fallback} />
                </td>
                <td>
                  <MetricLink
                    metric={g.measures?.revenue?.exVat}
                    locale={locale}
                    fallbackQuery={fallback}
                  />
                </td>
                <td>
                  <MetricLink
                    metric={g.measures?.marginAmount}
                    locale={locale}
                    fallbackQuery={fallback}
                  />
                </td>
                <td>
                  <Tip text={g.mappingStatus === 'unmapped' ? t('dept.unmapped') : null}>
                    <span>{g.mappingStatus || ''}</span>
                  </Tip>
                </td>
              </tr>
            ))
              : null}
          </React.Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

export function DailyActivityDepartments({ locale, report }) {
  const t = (k) => darT(locale, k);
  const views = buildDepartmentViews(report, locale);
  const fallback = proofFallbackFromReport(report, 'depts');
  const recon = buildReconciliationNotes(report);
  return (
    <section className="dar-v6-depts" id="depts">
      <div className="dar-v6-sectionheading">
        <Tip text={t('dept.uomNote')}>
          <h2>{t('dept.section')}</h2>
        </Tip>
      </div>
      {views.length === 0 ? <p className="dar-v6-empty">{t('dept.empty')}</p> : null}
      {views.map((dept) => (
        <article key={dept.id} className="dar-v6-dept">
          <div className="dar-v6-depthead">
            <div>
              <div className="dar-v6-depttitle">
                <span className="dar-v6-deptnumber">{String(dept.index + 1).padStart(2, '0')}</span>
                <h3>{dept.label}</h3>
              </div>
              <p className="dar-v6-caption">
                {t('dept.jobsOpened')}{' '}
                <MetricLink
                  metric={dept.totals.jobsOpened}
                  locale={locale}
                  fallbackQuery={fallback}
                />
                {' · '}
                {t('dept.jobsDone')}{' '}
                <MetricLink
                  metric={dept.totals.jobsCompleted}
                  locale={locale}
                  fallbackQuery={fallback}
                />
                {' · '}
                {t('dept.jobsProgress')}{' '}
                <MetricLink
                  metric={dept.totals.jobsInProgress}
                  locale={locale}
                  fallbackQuery={fallback}
                />
                {' · '}
                {t('dept.jobsCancelled')}{' '}
                <MetricLink
                  metric={dept.totals.jobsCancelled}
                  locale={locale}
                  fallbackQuery={fallback}
                />
              </p>
            </div>
            <div className="dar-v6-deptamount">
              <label>{t('dept.revenue')}</label>
              <MetricLink
                metric={dept.totals.measures?.revenue?.exVat}
                locale={locale}
                fallbackQuery={fallback}
              />
            </div>
          </div>
          <MeasuresStrip
            locale={locale}
            measures={dept.totals.measures}
            fallback={fallback}
            withholdTip={
              dept.totals.measures?.cost?.value == null ? t('dept.costWithheld') : null
            }
          />
          {dept.productCostCoverage?.incomplete ||
          dept.productCostCoverage?.productMeasures?.cost?.value != null ? (
            <ProductCostCoverageStrip
              locale={locale}
              coverage={dept.productCostCoverage}
              fallback={fallback}
            />
          ) : null}
          <div className="dar-v6-deptbody">
            <h4>{t('dept.products')}</h4>
            <DetailTable
              locale={locale}
              rows={dept.products.buckets}
              fallback={fallback}
              showGrades
            />
            <Tip text={t('dept.subset')}>
              <h4>{t('dept.top5')}</h4>
            </Tip>
            <Top5CoverageNote locale={locale} coverage={dept.products.top5Coverage} />
            <DetailTable locale={locale} rows={dept.products.top5} fallback={fallback} />
            <h4>{t('dept.services')}</h4>
            {dept.services.groups.map((g) => (
              <div key={g.id || g.code} className="dar-v6-servicegroup">
                <Tip text={t('dept.groupTop5')}>
                  <h4>
                    {locale === 'ar' ? g.labelAr || g.labelEn : g.labelEn || g.labelAr}
                    <span>
                      <MetricLink
                        metric={g.measures?.revenue?.exVat}
                        locale={locale}
                        fallbackQuery={fallback}
                      />
                    </span>
                  </h4>
                </Tip>
                <MeasuresStrip locale={locale} measures={g.measures} fallback={fallback} />
                <Top5CoverageNote locale={locale} coverage={g.top5Coverage} />
                <DetailTable locale={locale} rows={g.top5 || []} fallback={fallback} />
              </div>
            ))}
            {dept.blackOilBridge ? (
              <Tip text={t('dept.blackNote')}>
              <div className="dar-v6-oilsummary">
                <div>
                  {t('dept.blackExcl')}
                  <b>
                    <MetricLink
                      metric={dept.blackOilBridge.excluding}
                      locale={locale}
                      fallbackQuery={fallback}
                    />
                  </b>
                </div>
                <div>
                  {t('dept.black')}
                  <b>
                    <MetricLink
                      metric={dept.blackOilBridge.blackOil}
                      locale={locale}
                      fallbackQuery={fallback}
                    />
                  </b>
                </div>
                <div>
                  {t('dept.blackIncl')}
                  <b>
                    <MetricLink
                      metric={dept.blackOilBridge.including}
                      locale={locale}
                      fallbackQuery={fallback}
                    />
                  </b>
                </div>
              </div>
              </Tip>
            ) : null}
            {dept.unallocated ? (
              <div>
                <h4>{t('dept.unallocated')}</h4>
                <MeasuresStrip locale={locale} measures={dept.unallocated} fallback={fallback} />
              </div>
            ) : null}
          </div>
        </article>
      ))}
      {recon.length ? (
        <div className="dar-v6-recon">
          <h3>{t('dept.recon')}</h3>
          <ul>
            {recon.map((row) => (
              <li key={row.code}>
                {row.code}
                {': '}
                <MetricLink metric={row.difference} locale={locale} fallbackQuery={fallback} />
                {row.status ? ` · ${row.status}` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

export function DailyActivityVerifyPanel({ locale, payload, onClose }) {
  const t = (k) => darT(locale, k);
  const overall = payload?.overallStatus || 'unverified';
  const rows = Array.isArray(payload?.metrics) ? payload.metrics : [];
  const reasons = Array.isArray(payload?.reasons)
    ? payload.reasons.map(sanitizeVerifyReason).filter(Boolean)
    : [];
  const snapshotFail =
    overall === 'error' &&
    (payload?.code === 'REPORT_SNAPSHOT_CHANGED' || reasons.includes('snapshot'));
  const showAlert = overall === 'error' || rows.length === 0;
  const titleRef = useRef(null);
  useEffect(() => {
    const prev = typeof document !== 'undefined' ? document.activeElement : null;
    titleRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose?.();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      if (prev && typeof prev.focus === 'function') prev.focus();
    };
  }, [onClose]);
  const node = (
    <div
      className="modal-overlay dar-v6-verify-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dar-verify-title"
      onClick={onClose}
    >
      <div
        className="dar-v6-verify-panel"
        dir={locale === 'ar' ? 'rtl' : 'ltr'}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="dar-v6-verify-head">
          <h2 id="dar-verify-title" ref={titleRef} tabIndex={-1}>
            {t('verify.details')}
          </h2>
          <p className={`dar-v6-verify-chip dar-v6-verify-btn--${overall}`}>{t(`verify.${overall}`)}</p>
          <button type="button" className="btn-portal-outline" onClick={onClose}>
            {t('verify.close')}
          </button>
        </header>
        <p className="dar-v6-verify-meta">
          {payload?.verificationTimestamp || ''} · {payload?.method || ''} · {payload?.sourceRevision || ''}
        </p>
        {showAlert ? (
          <p className="dar-v6-verify-alert dar-v6-error" role="alert">
            {snapshotFail ? t('error.snapshot') : t('verify.empty')}
            {reasons
              .filter((r) => r !== 'snapshot')
              .map((r) => (
                <span key={r} className="dar-v6-error-detail">
                  {' '}
                  {r}
                </span>
              ))}
          </p>
        ) : null}
        {rows.length ? (
          <div className="dar-v6-proof-scroll">
            <table className="dar-v6-proof-table">
              <thead>
                <tr>
                  <th>{t('verify.col.metric')}</th>
                  <th>{t('verify.col.report')}</th>
                  <th>{t('verify.col.db')}</th>
                  <th>{t('verify.col.delta')}</th>
                  <th>{t('verify.col.status')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key}>
                    <td>{row.key}</td>
                    <td dir="ltr">{row.reportValue ?? '—'}</td>
                    <td dir="ltr">{row.dbExpected ?? '—'}</td>
                    <td dir="ltr">{row.delta ?? '—'}</td>
                    <td>{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
  if (typeof document === 'undefined') return node;
  return createPortal(node, document.body);
}

export function DailyActivityJump({ locale, active = 'accumulated' }) {
  const t = (k) => darT(locale, k);
  return (
    <nav className="dar-v6-jump" role="tablist" aria-label={t('title')} id="dar-v6-tabs">
      {DAR_V6_SECTION_TABS.map((tab) => {
        const selected = active === tab.id;
        return (
          <a
            key={tab.id}
            id={`dar-tab-${tab.id}`}
            href={`#${tab.id}`}
            role="tab"
            aria-selected={selected}
            className={selected ? 'is-active' : undefined}
          >
            {t(tab.labelKey)}
          </a>
        );
      })}
    </nav>
  );
}

export function DailyActivityStatus({ locale, errorKind, errorDetail, stale, loading }) {
  const t = (k) => darT(locale, k);
  if (loading) return <p className="dar-v6-status" role="status">{t('status.loading')}</p>;
  if (errorKind === 'backend') return <p className="dar-v6-error" role="alert">{t('error.backend')}</p>;
  if (errorKind === 'forbidden') return <p className="dar-v6-error" role="alert">{t('error.forbidden')}</p>;
  if (errorKind === 'network') return <p className="dar-v6-error" role="alert">{t('error.network')}</p>;
  if (errorKind === 'invalid') {
    return (
      <p className="dar-v6-error" role="alert">
        {t('error.invalid')}
        {errorDetail ? <span className="dar-v6-error-detail"> {errorDetail}</span> : null}
      </p>
    );
  }
  if (errorKind === 'snapshot') return <p className="dar-v6-error" role="alert">{t('error.snapshot')}</p>;
  if (errorKind && errorKind !== 'aborted') {
    return (
      <p className="dar-v6-error" role="alert">
        {t('error.unknown')}
        {errorDetail ? <span className="dar-v6-error-detail"> {errorDetail}</span> : null}
      </p>
    );
  }
  return (
    <div className="dar-v6-status">
      {stale ? <p className="dar-v6-warn">{t('status.stale')}</p> : <p>{t('status.ready')}</p>}
    </div>
  );
}
