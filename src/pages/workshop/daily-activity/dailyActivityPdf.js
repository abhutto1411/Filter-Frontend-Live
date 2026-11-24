/**
 * DAR v6 owner PDF from the captured report payload.
 * Browser path: approved-style A4 pages via html-to-image + clickable proof annotations.
 * Node writeDailyActivityPdfDoc is TEST-ONLY and is not the owner download.
 * Format API strings only. Do not sum, invent zeros, or dump metricKey rows.
 */

import { jsPDF } from 'jspdf';
import {
  DAR_V6_SCHEMA,
  formatMetricValue,
  formatOwnerScopeLine,
  formatRiyadhDateClock,
  wrapProofHref,
} from './dailyActivityFormat.js';
import { darT } from './dailyActivityI18n.js';
import {
  buildDepartmentViews,
  collectDepartmentMetrics,
} from './dailyActivityDepartments.js';
import {
  collectRestMetrics,
  coverageRows,
  moneyPurchases,
  operationRows,
  osTagKind,
  ownerCoverageCopy,
  sessionRows,
  technicianRows,
} from './dailyActivityRest.js';
import {
  buildKpiCards,
  buildSummaryView,
  collectSummaryMetrics,
  proofFallbackFromReport,
} from './dailyActivitySummary.js';
import { escapePdfHtml, ensureBilingualPdfFonts } from '../../../utils/bilingualHtmlPdf.js';

export const DAR_V6_PDF_PHASE = 'phase-25';
export const DAR_V6_PDF_PAGE_COUNT = 5;
export const DAR_V6_PDF_ORIGIN_TEST = 'https://app.local';
export const DAR_PDF_PAGE_CLASS = 'dar-pdf-page';
const A4_PX_W = 794;
const A4_PX_H = 1123;

const FORBIDDEN_TOKENS = ['authorization', 'bearer ', 'access_token', 'id_token'];

function raceTimeout(promise, ms, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(label)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

export function canRenderDailyActivityPdf({
  report,
  stale = false,
  errorKind = null,
  loading = false,
} = {}) {
  if (loading || stale) return false;
  if (errorKind === 'snapshot' || errorKind === 'forbidden' || errorKind === 'backend') return false;
  if (!report || report.schemaVersion !== DAR_V6_SCHEMA) return false;
  if (!report.meta?.snapshotToken) return false;
  return true;
}

export function pdfDisabledReason({ report, stale, errorKind, loading, locale = 'en' } = {}) {
  if (stale) return darT(locale, 'pdf.disabledStale');
  if (errorKind === 'snapshot') return darT(locale, 'error.snapshot');
  if (loading || !report) return darT(locale, 'pdf.disabledEmpty');
  return darT(locale, 'pdf.later');
}

export function pdfProofHref(metric, report, origin = '') {
  if (!metric) return '';
  const path = wrapProofHref(metric, proofFallbackFromReport(report));
  if (!path) return '';
  const base = String(origin || '').replace(/\/$/, '');
  return base ? `${base}${path}` : path;
}

export function collectAllPdfMetrics(report) {
  const seen = new Set();
  const out = [];
  for (const m of [
    ...collectSummaryMetrics(report),
    ...collectDepartmentMetrics(report),
    ...collectRestMetrics(report),
  ]) {
    if (!m?.key || seen.has(m.key)) continue;
    seen.add(m.key);
    out.push(m);
  }
  return out;
}

export function proofLinksAreSafe(links) {
  return (links || []).every((link) => {
    const href = String(link?.href || '').toLowerCase();
    if (!href.includes('/workshop/daily-activity/proof')) return false;
    if (FORBIDDEN_TOKENS.some((tok) => href.includes(tok))) return false;
    if (href.startsWith('javascript:')) return false;
    return true;
  });
}

export function ownerPdfPageCount(html) {
  return (String(html).match(/<article class="a4 dar-pdf-page"/g) || []).length;
}

function chunkDepartments(depts) {
  if (!depts.length) return [[]];
  const size = depts.length <= 3 ? depts.length : 2;
  const chunks = [];
  for (let i = 0; i < depts.length; i += size) chunks.push(depts.slice(i, i + size));
  return chunks;
}

const SESS_ROWS_FIRST = 24;
const SESS_ROWS_CONT = 32;

export function chunkSessionRows(rows) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return [[]];
  const chunks = [list.slice(0, SESS_ROWS_FIRST)];
  for (let i = SESS_ROWS_FIRST; i < list.length; i += SESS_ROWS_CONT) {
    chunks.push(list.slice(i, i + SESS_ROWS_CONT));
  }
  return chunks;
}

export function buildDailyActivityPdfModel(report, locale = 'en', origin = '', verify = null) {
  const t = (k) => darT(locale, k);
  const meta = report?.meta || {};
  const filters = report?.filters || {};
  const fallback = proofFallbackFromReport(report);
  const kpis = buildKpiCards(report, locale);
  const summary = buildSummaryView(report, locale);
  const depts = buildDepartmentViews(report, locale);
  const sessions = sessionRows(report);
  const openSessions = sessions.filter((row) => !row.closedAt || row.status === 'open').length;
  const preliminary =
    meta.verificationStatus !== 'complete' ||
    !summary.completenessComplete ||
    openSessions > 0;
  const metrics = collectAllPdfMetrics(report).map((metric) => ({
    key: metric.key,
    display: formatMetricValue(metric),
    href: pdfProofHref(metric, report, origin),
    status: metric.status || null,
    reason: metric.reason || null,
  }));
  return {
    locale: locale === 'ar' ? 'ar' : 'en',
    dir: locale === 'ar' ? 'rtl' : 'ltr',
    title: t('title'),
    preliminary,
    preliminaryLabel: t('badge.partial'),
    header: {
      from: meta.from || '',
      to: meta.to || '',
      scopeLine: formatOwnerScopeLine(meta, locale),
      branches: (meta.selectedBranchIds || []).length
        ? (meta.selectedBranchIds || []).join(', ')
        : t('filter.branchesAll'),
      sessions:
        (meta.selectedSessionIds || []).length
          ? (meta.selectedSessionIds || []).join(', ')
          : t('filter.sessionsAll'),
      actor: filters.actorSource || 'all',
      verification: meta.verificationStatus || 'partial',
    },
    kpis,
    summary,
    depts,
    deptChunks: chunkDepartments(depts),
    sessChunks: chunkSessionRows(sessions),
    sessions: {
      rows: sessions,
      totals: report?.sessions?.totals || {},
      caption: t('sess.caption'),
    },
    money: report?.money || {},
    operations: operationRows(report),
    technicians: {
      rows: technicianRows(report),
      totals: report?.technicians?.totals || {},
    },
    coverage: coverageRows(report),
    purchases: moneyPurchases(report),
    metrics,
    fallback,
    verify: verify && verify.snapshotToken === (report?.meta?.snapshotToken || verify.snapshotToken)
      ? verify
      : null,
  };
}

function verifyStripHtml(model, t) {
  const v = model.verify;
  if (!v?.overallStatus || v.overallStatus === 'unverified') {
    return `<div class="notice notice-verify">${escapePdfHtml(t('pdf.verify.unchecked'))}</div>`;
  }
  const label = t(`verify.${v.overallStatus}`);
  return `<div class="notice notice-verify">${escapePdfHtml(label)} · <span dir="ltr">${escapePdfHtml(v.verificationTimestamp || '')}</span> · <span dir="ltr">${escapePdfHtml(v.sourceRevision || v.verifySourceRevision || '')}</span></div>`;
}

function countLine(n, t, overflow) {
  const line = `<p class="count"><span class="n" dir="ltr">${n}</span> ${escapePdfHtml(t('pdf.rowCount'))}</p>`;
  if (!overflow) return line;
  return `${line}<div class="notice pdf-overflow">${escapePdfHtml(t('pdf.overflow'))}</div>`;
}

function metricHtml(metric, report, origin) {
  const shown = escapePdfHtml(formatMetricValue(metric));
  if (!metric) return `<span class="n" dir="ltr">${shown}</span>`;
  const href = pdfProofHref(metric, report, origin);
  if (!href) return `<span class="n" dir="ltr">${shown}</span>`;
  return `<a class="n proof" dir="ltr" href="${escapePdfHtml(href)}">${shown}</a>`;
}

function osMetricHtml(metric, report, origin, locale) {
  const body = metricHtml(metric, report, origin);
  const tag = osTagKind(metric);
  if (!tag) return body;
  return `<span class="os">${body}<span class="ostag ostag-${tag}">${escapePdfHtml(darT(locale, `os.${tag}`))}</span></span>`;
}

const DAR_PDF_CSS = `
@page{size:A4;margin:0}
*{box-sizing:border-box}
.dar-pdf-stage{background:#fff}
.dar-pdf-page{
  width:${A4_PX_W}px;height:${A4_PX_H}px;padding:42px 44px 56px;
  background:#fff;color:#243c4c;position:relative;overflow:hidden;
  font:9px/1.35 "Noto Sans",Arial,"Noto Sans Arabic",sans-serif;
}
.dar-pdf-page[dir=rtl]{font-family:"Noto Sans Arabic",Arial,sans-serif;line-height:1.5}
.pdfheader{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #123248;padding-bottom:8px;margin-bottom:8px;gap:12px}
.pdflogo{font-size:22px;font-weight:900;letter-spacing:2px;color:#123248;direction:ltr}
.pdfheader h1{font-size:18px;margin:0 0 2px;color:#123248}
.pdfheader small{font-size:8px;color:#6b7d8b}
.docid{text-align:end;font-size:8px;color:#6b7d8b}
.notice{border:1px solid #d5e0e6;background:#f4f8fa;color:#3d5260;padding:6px 8px;font-size:7.2px;border-radius:3px;margin:6px 0}
.notice-verify{border-color:#c5d4dc}
.count{font-size:7px;color:#6b7d8b;margin:4px 0}
.compact td{font-size:6.6px;padding:2px 3px;line-height:1.2}
.panel{background:#fff;border:1px solid #dce5ea;border-radius:4px;padding:8px;margin:6px 0}
.accumulated{border-top:4px solid #123248}
h2{font-size:12px;margin:0 0 6px;color:#123248}
h3{font-size:10px;margin:0 0 4px;color:#123248}
h4{font-size:8px;margin:6px 0 4px;color:#123248}
p,caption,.caption{font-size:7px;color:#6b7d8b;margin:3px 0}
table{width:100%;border-collapse:collapse}
th{background:#f1f5f7;color:#69808e;font-size:6.7px;text-align:end;padding:3px}
td{font-size:7.6px;text-align:end;padding:3px;border-bottom:1px solid #e9eff2}
th:first-child,td:first-child{text-align:start}
tr.total td{background:#f1f7f7;font-weight:700}
.n{direction:ltr;unicode-bidi:isolate;display:inline-block;font-variant-numeric:tabular-nums}
a.proof{color:inherit;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:2px}
.vatsummary,.summarybottom,.kpis,.oilsummary{display:grid;gap:6px;margin:6px 0}
.kpis{grid-template-columns:repeat(6,1fr)}
.vatsummary,.summarybottom{grid-template-columns:repeat(3,1fr)}
.kpis>div,.vatsummary>div,.summarybottom>div{background:#eef6f6;padding:6px;border-radius:3px;font-size:7px}
.kpis b,.vatsummary b,.summarybottom b{display:block;font-size:11px;color:#123248;margin-top:2px}
.summarybottom .net{background:#123248;color:#fff}
.summarybottom .net b,.summarybottom .net label{color:#fff}
.chips{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:6px 0}
.chip{padding:5px 7px;border:1px solid #dce5ea;border-radius:3px;background:#f9fbfc;font-size:7px}
.chip b{display:block;font-size:8px;color:#123248}
.financegrid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.department{border:1px solid #dce5ea;border-radius:5px;margin:7px 0 0;overflow:hidden}
.depthead{display:flex;justify-content:space-between;padding:6px 8px;background:#eaf2f4}
.depttitle{display:flex;align-items:center;gap:8px}
.deptnumber{background:#123248;color:#fff;font-size:8px;padding:3px 5px;border-radius:3px}
.metrics{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;padding:5px 8px;background:#f7fafb}
.metrics label{display:block;font-size:6.4px;color:#6b7d8b}
.metrics b{display:block;font-size:7.5px;color:#123248}
.twocol{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:0 8px 6px}
.pagefoot{position:absolute;bottom:18px;left:44px;right:44px;display:flex;justify-content:space-between;font-size:7px;color:#6b7d8b;border-top:1px solid #dce5ea;padding-top:6px}
.empty{background:#f7f9fb;border:1px dashed #cedae2;padding:8px;font-size:7.5px;border-radius:3px}
.os{display:inline-flex;align-items:center;gap:4px;flex-wrap:wrap}
.ostag{font-size:6.5px;font-weight:700;padding:1px 4px;border-radius:8px;line-height:1.2}
.ostag-short{background:#fdecea;color:#8a2f26;border:1px solid #f0c4bf}
.ostag-over{background:#e6f6f2;color:#0b6b5b;border:1px solid #b7e0d6}
`;

function pdfHeader(model, t, pageLabel, pageNo, pageTotal) {
  return `<header class="pdfheader">
    <div class="pdflogo">FILTER</div>
    <div><h1>${escapePdfHtml(model.title)}</h1><small dir="ltr">${escapePdfHtml(model.header.scopeLine)}</small></div>
    <div class="docid">DAR · V6<br/>${escapePdfHtml(pageLabel)}<br/><span class="pdf-pageno n">${pageNo} / ${pageTotal}</span></div>
  </header>`;
}

function pdfFoot(t, pageNo, pageTotal) {
  return `<footer class="pagefoot"><span>${escapePdfHtml(t('pdf.footer'))}</span><b class="pdf-pageno n">${pageNo} / ${pageTotal}</b></footer>`;
}


function sessionRowHtml(row, report, origin, locale) {
  const m = (metric) => metricHtml(metric, report, origin);
  const os = (metric) => osMetricHtml(metric, report, origin, locale);
  const open = formatRiyadhDateClock(row.openedAt, locale);
  const close = row.closedAt ? formatRiyadhDateClock(row.closedAt, locale) : darT(locale, 'sess.open');
  return `<tr><td>${escapePdfHtml(row.cashierName || row.id || '')}</td><td>${escapePdfHtml(String(row.branchId || ''))}</td><td dir="ltr">${escapePdfHtml(`${open} → ${close}`)}</td><td>${escapePdfHtml(row.status || '')}</td><td>${m(row.expected)}</td><td>${m(row.counted)}</td><td>${os(row.overShort)}</td></tr>`;
}

function sessionTableHtml(rows, t, report, origin, locale) {
  const body = rows.length
    ? rows.map((row) => sessionRowHtml(row, report, origin, locale)).join('')
    : `<tr><td colspan="7">${escapePdfHtml(t('sess.empty'))}</td></tr>`;
  return `<table data-tbl="sessions" data-cont-label="${escapePdfHtml(t('sess.section'))} — ${escapePdfHtml(t('pdf.continued'))}"><thead><tr><th>${escapePdfHtml(t('sess.cashier'))}</th><th>${escapePdfHtml(t('sess.branch'))}</th><th>${escapePdfHtml(t('sess.window'))}</th><th>${escapePdfHtml(t('sess.status'))}</th><th>${escapePdfHtml(t('sess.expected'))}</th><th>${escapePdfHtml(t('sess.counted'))}</th><th>${escapePdfHtml(t('sess.os'))}</th></tr></thead>
      <tbody>${body}</tbody></table>`;
}

export function buildDailyActivityPdfHtml(report, locale = 'en', origin = '', verify = null) {
  const model = buildDailyActivityPdfModel(report, locale, origin, verify);
  const t = (k) => darT(locale, k);
  const m = (metric) => metricHtml(metric, report, origin);
  const os = (metric) => osMetricHtml(metric, report, origin, locale);
  const pageTotal = DAR_V6_PDF_PAGE_COUNT;
  let pageNo = 1;

  const kpiRow = model.kpis
    .map((c) => {
      const value = c.id === 'cashOs' ? os(c.metric) : m(c.metric);
      return `<div><label>${escapePdfHtml(c.label)}</label><b>${value}</b></div>`;
    })
    .join('');
  const deptSales = model.summary.departments
    .map((row) => `<tr><td>${escapePdfHtml(row.label)}</td><td>${m(row.exVat)}</td><td>${m(row.inclVat)}</td></tr>`)
    .join('');
  const deductions = model.summary.deductions
    .map((d) => `<tr><td>${escapePdfHtml(d.label)}</td><td>${m(d.amount)}</td><td>${m(d.entries)}</td></tr>`)
    .join('');

  const p1 = `<article class="a4 ${DAR_PDF_PAGE_CLASS}" dir="${model.dir}" data-page="${pageNo}" data-block="summary">
    ${pdfHeader(model, t, t('summary.title'), pageNo, pageTotal)}
    ${verifyStripHtml(model, t)}
    <div class="notice">${escapePdfHtml(`${t('pdf.caution')}${report?.meta?.costPolicy ? ` · ${report.meta.costPolicy} · reporting estimate, not historical COGS` : ''}`)}</div>
    <section class="panel accumulated">
      <h2>${escapePdfHtml(t('summary.title'))}</h2>
      <div class="kpis">${kpiRow}</div>
      <table><thead><tr><th>${escapePdfHtml(t('summary.dept'))}</th><th>${escapePdfHtml(t('summary.ex'))}</th><th>${escapePdfHtml(t('summary.inc'))}</th></tr></thead>
      <tbody>${deptSales}<tr class="total"><td>${escapePdfHtml(t('summary.total'))}</td><td>${m(model.summary.salesTotal.exVat)}</td><td>${m(model.summary.salesTotal.inclVat)}</td></tr></tbody></table>
      <div class="vatsummary">
        <div>${escapePdfHtml(t('summary.ex'))}<b>${m(model.summary.salesTotal.exVat)}</b></div>
        <div>${escapePdfHtml(t('summary.vatCard'))}<b>${m(model.summary.salesTotal.vat)}</b></div>
        <div>${escapePdfHtml(t('summary.inclStart'))}<b>${m(model.summary.salesTotal.inclVat)}</b></div>
      </div>
      <table><thead><tr><th>${escapePdfHtml(t('summary.deductions'))}</th><th>${escapePdfHtml(t('summary.amount'))}</th><th>${escapePdfHtml(t('summary.entries'))}</th></tr></thead>
      <tbody>${deductions}</tbody></table>
      <div class="summarybottom">
        <div><label>${escapePdfHtml(t('summary.known'))}</label><b>${m(model.summary.knownDeductions)}</b></div>
        <div><label>${escapePdfHtml(t('summary.remainder'))}</label><b>${m(model.summary.remainderBeforeUnknowns)}</b></div>
        <div class="net"><label>${escapePdfHtml(t('summary.net'))}</label><b>${m(model.summary.net)}</b></div>
      </div>
    </section>
    ${pdfFoot(t, pageNo, pageTotal)}
  </article>`;
  pageNo += 1;

  const sessRowsAll = model.sessions.rows;
  const p2 = `<article class="a4 ${DAR_PDF_PAGE_CLASS}" dir="${model.dir}" data-page="${pageNo}" data-block="sessions">
    ${pdfHeader(model, t, t('sess.section'), pageNo, pageTotal)}
    <section class="panel">
      <h2>${escapePdfHtml(t('sess.section'))}</h2>
      <div class="chips">
        <div class="chip"><b>${m(model.sessions.totals.closed)}</b>${escapePdfHtml(t('sess.closed'))}</div>
        <div class="chip"><b>${m(model.sessions.totals.open)}</b>${escapePdfHtml(t('sess.open'))}</div>
        <div class="chip"><b>${os(model.sessions.totals.cashOverShort)}</b>${escapePdfHtml(t('sess.cashOs'))}</div>
        <div class="chip"><b>${os(model.sessions.totals.allMethodsOverShort)}</b>${escapePdfHtml(t('sess.allOs'))}</div>
      </div>
      ${countLine(sessRowsAll.length, t, sessRowsAll.length > SESS_ROWS_FIRST)}
      ${sessionTableHtml(sessRowsAll, t, report, origin, locale)}
    </section>
    ${pdfFoot(t, pageNo, pageTotal)}
  </article>`;
  pageNo += 1;

  const deptRows = model.depts;
  const deptBody = deptRows.length
    ? deptRows
        .map((dept) => {
          const totals = dept.totals || {};
          return `<tr><td>${escapePdfHtml(dept.label || '')}</td><td>${m(totals.jobsCompleted)}</td><td>${m(totals.measures?.revenue?.exVat)}</td><td>${m(totals.measures?.revenue?.inclVat)}</td><td>${m(totals.measures?.cost)}</td><td>${m(totals.measures?.marginAmount)}</td></tr>`;
        })
        .join('')
    : `<tr><td colspan="6">${escapePdfHtml(t('dept.empty'))}</td></tr>`;
  const oilNestedNotes = deptRows
    .map((dept) => {
      const oil = (dept.products?.buckets || []).find((b) => b.code === 'oil');
      const n = Array.isArray(oil?.grades) ? oil.grades.length : 0;
      if (!n) return '';
      return `<p class="caption">${escapePdfHtml(dept.label || '')}: ${escapePdfHtml(
        t('dept.gradesCount').replace('{n}', String(n)),
      )} · ${escapePdfHtml(t('dept.revenue'))} ${m(oil.measures?.revenue?.exVat)}</p>`;
    })
    .filter(Boolean)
    .join('');
  const p3 = `<article class="a4 ${DAR_PDF_PAGE_CLASS}" dir="${model.dir}" data-page="${pageNo}" data-block="departments">
    ${pdfHeader(model, t, t('dept.section'), pageNo, pageTotal)}
    <section class="panel">
      <h2>${escapePdfHtml(t('dept.section'))}</h2>
      ${countLine(deptRows.length, t, deptRows.length > 14)}
      <table class="compact"><thead><tr><th>${escapePdfHtml(t('dept.item'))}</th><th>${escapePdfHtml(t('tech.jobs'))}</th><th>${escapePdfHtml(t('summary.ex'))}</th><th>${escapePdfHtml(t('summary.inc'))}</th><th>${escapePdfHtml(t('dept.cost'))}</th><th>${escapePdfHtml(t('dept.margin'))}</th></tr></thead>
      <tbody>${deptBody}</tbody></table>
      ${oilNestedNotes}
    </section>
    ${pdfFoot(t, pageNo, pageTotal)}
  </article>`;
  pageNo += 1;

  const pettyRows = (model.money.petty?.byPurpose || [])
    .map((p) => `<tr><td>${escapePdfHtml(p.labelEn || p.labelAr || p.code || '')}</td><td>${m(p.entries)}</td><td>${m(p.amount)}</td></tr>`)
    .join('');
  const purchaseRows = model.purchases
    .map(
      (p) =>
        `<tr><td>${escapePdfHtml(p.relationship || '')}</td><td>${m(p.entries)}</td><td>${m(p.net)}</td><td>${m(p.vat)}</td><td>${m(p.gross)}</td></tr>`,
    )
    .join('');
  const opGroup = (group) =>
    (model.operations || [])
      .filter((op) => (op.group || 'other') === group)
      .map(
        (op) =>
          `<tr><td>${escapePdfHtml(locale === 'ar' ? op.labelAr || op.labelEn || op.code || '' : op.labelEn || op.labelAr || op.code || '')}</td><td>${m(op.amount)}</td><td>${m(op.entries)}</td></tr>`,
      )
      .join('');
  const opSelected = opGroup('selected_sales') + opGroup('selected_sales_bridges');
  const opReceipts = opGroup('receipts');
  const opOther = opGroup('other');
  const opDate = opGroup('invoice_date');
  const techRows = model.technicians.rows
    .map(
      (row) =>
        `<tr><td>${escapePdfHtml(row.name || row.labelEn || '')}</td><td>${m(row.jobsCompleted)}</td><td>${m(row.attributedRevenue)}</td><td>${m(row.commissionAttributed)}</td></tr>`,
    )
    .join('');
  const covRows = model.coverage
    .map((row) => {
      const copy = ownerCoverageCopy(row, locale);
      return `<tr><td>${escapePdfHtml(copy.label)}</td><td>${escapePdfHtml(copy.status)}</td><td>${m(row.amount)}</td></tr>`;
    })
    .join('');

  const p4 = `<article class="a4 ${DAR_PDF_PAGE_CLASS}" dir="${model.dir}" data-page="${pageNo}" data-block="finance">
    ${pdfHeader(model, t, t('money.section'), pageNo, pageTotal)}
    <div class="financegrid">
      <section class="panel"><h3>${escapePdfHtml(t('money.petty'))}</h3>
        ${countLine((model.money.petty?.byPurpose || []).length, t, false)}
        <table><thead><tr><th>${escapePdfHtml(t('money.purpose'))}</th><th>${escapePdfHtml(t('summary.entries'))}</th><th>${escapePdfHtml(t('summary.amount'))}</th></tr></thead>
        <tbody>${pettyRows || `<tr><td>${escapePdfHtml(t('money.petty'))}</td><td></td><td>${m(model.money.petty?.total)}</td></tr>`}</tbody></table>
      </section>
      <section class="panel"><h3>${escapePdfHtml(t('money.noncash'))}</h3>
        <p>${escapePdfHtml(t('money.noncash'))} ${m(model.money.nonCash?.gross)}</p>
        <p>${escapePdfHtml(t('money.advances'))} ${m(model.money.advances?.amount)}</p>
        <p>${escapePdfHtml(t('money.replenish'))} ${m(model.money.replenishment?.amount)}</p>
      </section>
    </div>
    <section class="panel"><h3>${escapePdfHtml(t('money.purchases'))}</h3>
      ${countLine(model.purchases.length, t, false)}
      <table><thead><tr><th>${escapePdfHtml(t('money.relationship'))}</th><th>${escapePdfHtml(t('summary.entries'))}</th><th>${escapePdfHtml(t('money.net'))}</th><th>${escapePdfHtml(t('money.vat'))}</th><th>${escapePdfHtml(t('money.gross'))}</th></tr></thead>
      <tbody>${purchaseRows}</tbody></table>
    </section>
    ${pdfFoot(t, pageNo, pageTotal)}
  </article>`;
  pageNo += 1;

  const p5 = `<article class="a4 ${DAR_PDF_PAGE_CLASS}" dir="${model.dir}" data-page="${pageNo}" data-block="operations">
    ${pdfHeader(model, t, t('jump.04'), pageNo, pageTotal)}
    <section class="panel"><h3>${escapePdfHtml(t('ops.selectedSales'))}</h3>
      <p>${escapePdfHtml(t('ops.tendersCaption'))}</p>
      ${countLine(model.operations.length, t, model.operations.length > 18)}
      <table class="compact"><thead><tr><th>${escapePdfHtml(t('ops.movement'))}</th><th>${escapePdfHtml(t('summary.amount'))}</th><th>${escapePdfHtml(t('summary.entries'))}</th></tr></thead>
      <tbody>${opSelected}</tbody></table>
    </section>
    <section class="panel"><h3>${escapePdfHtml(t('ops.allReceipts'))}</h3>
      <p>${escapePdfHtml(t('ops.receiptsIncluded'))}</p>
      <table class="compact"><thead><tr><th>${escapePdfHtml(t('ops.movement'))}</th><th>${escapePdfHtml(t('summary.amount'))}</th><th>${escapePdfHtml(t('summary.entries'))}</th></tr></thead>
      <tbody>${opReceipts}</tbody></table>
      ${
        opDate
          ? `<p>${escapePdfHtml(t('ops.invoiceDateDetails'))}</p><table class="compact"><tbody>${opDate}</tbody></table>`
          : ''
      }
      ${
        opOther
          ? `<h3>${escapePdfHtml(t('ops.other'))}</h3><table class="compact"><tbody>${opOther}</tbody></table>`
          : ''
      }
    </section>
    <section class="panel"><h3>${escapePdfHtml(t('tech.section'))}</h3>
      ${countLine(model.technicians.rows.length, t, model.technicians.rows.length > 12)}
      <table class="compact"><thead><tr><th>${escapePdfHtml(t('tech.name'))}</th><th>${escapePdfHtml(t('tech.jobs'))}</th><th>${escapePdfHtml(t('tech.rev'))}</th><th>${escapePdfHtml(t('tech.comm'))}</th></tr></thead>
      <tbody>${techRows || `<tr><td colspan="4">${escapePdfHtml(t('tech.empty'))}</td></tr>`}</tbody></table>
    </section>
    <section class="panel"><h3>${escapePdfHtml(t('cov.section'))}</h3>
      ${countLine(model.coverage.length, t, false)}
      <table class="compact"><thead><tr><th>${escapePdfHtml(t('cov.item'))}</th><th>${escapePdfHtml(t('cov.status'))}</th><th>${escapePdfHtml(t('summary.amount'))}</th></tr></thead>
      <tbody>${covRows}</tbody></table>
    </section>
    ${pdfFoot(t, pageNo, pageTotal)}
  </article>`;

  const html = `<!DOCTYPE html><html lang="${model.locale}" dir="${model.dir}"><head><meta charset="utf-8"/><title>${escapePdfHtml(model.title)}</title>
<style>${DAR_PDF_CSS}</style></head><body>
<div class="dar-pdf-stage">${p1}${p2}${p3}${p4}${p5}</div>
</body></html>`;
  return { html, model, pages: pageTotal };
}

/**
 * TEST-ONLY node fallback. Owner downloads never use this path when `document` exists.
 * Three A4 pages, KPI proof links, no metricKey dump and no snapshot token.
 */
export function writeDailyActivityPdfDoc(report, locale = 'en', origin = DAR_V6_PDF_ORIGIN_TEST) {
  const model = buildDailyActivityPdfModel(report, locale, origin);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const titles = [darT(locale, 'summary.title'), darT(locale, 'sess.section'), darT(locale, 'money.section')];
  for (let i = 0; i < 3; i += 1) {
    if (i > 0) doc.addPage();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(18, 50, 72);
    doc.text('FILTER', 36, 36);
    doc.setFontSize(12);
    doc.text(titles[i], 36, 56);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(107, 125, 139);
    doc.text(model.header.scopeLine, 36, 72);
    if (i === 0) {
      doc.setTextColor(61, 82, 96);
      doc.setFontSize(8);
      doc.text(darT(locale, 'pdf.verify.unchecked'), 36, 93);
    }
    doc.setTextColor(18, 50, 72);
    doc.setFontSize(10);
    let y = 120;
    if (i === 0) {
      for (const c of model.kpis) {
        const href = pdfProofHref(c.metric, report, origin);
        const tag = c.id === 'cashOs' ? osTagKind(c.metric) : null;
        const line = `${c.label}: ${formatMetricValue(c.metric)}${tag ? ` ${darT(locale, `os.${tag}`)}` : ''}`;
        if (href) doc.textWithLink(line, 36, y, { url: href });
        else doc.text(line, 36, y);
        y += 14;
      }
      const netHref = pdfProofHref(model.summary.net, report, origin);
      const netLine = `${darT(locale, 'summary.net')}: ${formatMetricValue(model.summary.net)}`;
      if (netHref) doc.textWithLink(netLine, 36, y + 8, { url: netHref });
      else doc.text(netLine, 36, y + 8);
    }
    if (i === 1) {
      const cash = model.sessions.totals.cashOverShort;
      const tag = osTagKind(cash);
      const line = `${darT(locale, 'sess.cashOs')}: ${formatMetricValue(cash)}${tag ? ` ${darT(locale, `os.${tag}`)}` : ''}`;
      doc.text(line, 36, y);
      y += 16;
      for (const row of model.sessions.rows) {
        const rowTag = osTagKind(row.overShort);
        doc.text(
          `${row.cashierName || row.id}: ${formatMetricValue(row.overShort)}${rowTag ? ` ${darT(locale, `os.${rowTag}`)}` : ''}`,
          36,
          y,
        );
        y += 14;
      }
    }
    doc.setFontSize(8);
    doc.setTextColor(107, 125, 139);
    doc.text(`${i + 1} / 3`, pageW / 2, 820, { align: 'center' });
  }
  return { doc, model };
}

function reflowOwnerPdfPages(stage) {
  const pages = Array.from(stage.querySelectorAll(`.${DAR_PDF_PAGE_CLASS}`));
  pages.forEach((page, idx) => {
    page.style.height = `${A4_PX_H}px`;
    page.style.overflow = 'hidden';
    page.setAttribute('data-page', String(idx + 1));
    page.querySelectorAll('.pdf-pageno').forEach((el) => {
      el.textContent = `${idx + 1} / ${pages.length}`;
    });
  });
  return pages;
}

function collectProofRects(pageEl) {
  const box = pageEl.getBoundingClientRect();
  return Array.from(pageEl.querySelectorAll('a.proof')).map((a) => {
    const r = a.getBoundingClientRect();
    return {
      href: a.getAttribute('href') || '',
      x: r.left - box.left,
      y: r.top - box.top,
      w: Math.max(r.width, 4),
      h: Math.max(r.height, 4),
    };
  });
}

export async function renderDailyActivityPdf({
  report,
  locale = 'en',
  origin = '',
  fileName,
  save = true,
  verify = null,
} = {}) {
  if (!canRenderDailyActivityPdf({ report })) {
    return { ok: false, reason: pdfDisabledReason({ report, locale }) };
  }
  const resolvedOrigin =
    origin || (typeof window !== 'undefined' ? window.location.origin : DAR_V6_PDF_ORIGIN_TEST);
  const stamp = `${report.meta?.from || 'from'}_${report.meta?.to || 'to'}`;
  const name =
    fileName ||
    (locale === 'ar'
      ? `daily-activity-${stamp}-ar.pdf`
      : `daily-activity-${stamp}-en.pdf`);

  if (typeof document === 'undefined') {
    const { doc, model } = writeDailyActivityPdfDoc(report, locale, resolvedOrigin);
    if (save && typeof doc.save === 'function') doc.save(name);
    return { ok: true, fileName: name, model, pages: doc.internal.getNumberOfPages(), path: 'node-fallback' };
  }

  await Promise.race([
    ensureBilingualPdfFonts(),
    new Promise((resolve) => {
      setTimeout(resolve, 4000);
    }),
  ]);
  const { html, model } = buildDailyActivityPdfHtml(report, locale, resolvedOrigin, verify);
  const { toPng } = await import('html-to-image');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4', compress: true });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const mount = document.createElement('div');
  mount.setAttribute('aria-hidden', 'true');
  // Keep pages in the visual viewport so Chromium paints them; offscreen
  // left:-16000px lets html-to-image hang forever on toPng.
  mount.style.cssText = `position:fixed;left:0;top:0;width:${A4_PX_W}px;background:#fff;z-index:2147483000;opacity:0.02;pointer-events:none`;
  document.body.appendChild(mount);
  try {
    mount.innerHTML = html;
    const pages = reflowOwnerPdfPages(mount.querySelector('.dar-pdf-stage') || mount);
    if (!pages.length) throw new Error('Could not render Daily Activity PDF.');
    for (let i = 0; i < pages.length; i += 1) {
      const node = pages[i];
      node.style.width = `${A4_PX_W}px`;
      node.style.height = `${A4_PX_H}px`;
      const links = collectProofRects(node);
      const imgData = await raceTimeout(
        toPng(node, {
          backgroundColor: '#ffffff',
          pixelRatio: 2,
          cacheBust: false,
          skipFonts: true,
          width: A4_PX_W,
          height: A4_PX_H,
        }),
        15000,
        `DAR PDF page ${i + 1} raster timed out`,
      );
      if (i > 0) pdf.addPage('a4', 'portrait');
      pdf.addImage(imgData, 'PNG', 0, 0, pageW, pageH, undefined, 'FAST');
      for (const link of links) {
        if (!link.href || FORBIDDEN_TOKENS.some((tok) => link.href.toLowerCase().includes(tok))) continue;
        const x = (link.x / A4_PX_W) * pageW;
        const y = (link.y / A4_PX_H) * pageH;
        const w = (link.w / A4_PX_W) * pageW;
        const h = (link.h / A4_PX_H) * pageH;
        pdf.link(x, y, w, h, { url: link.href });
      }
    }
    if (save) pdf.save(name);
    return { ok: true, fileName: name, model, pages: pages.length, path: 'browser-a4' };
  } finally {
    mount.remove();
  }
}
