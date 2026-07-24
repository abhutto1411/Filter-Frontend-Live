import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import QRCode from 'qrcode';
import filterBrandIcon from '../assets/images/filter-brand-icon.png';
import { buildZatcaPhase1QrPayloadFromInvoice } from './zatcaQr';

const fmt = (v) =>
    Number(v ?? 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

function fmtCell(v) {
    if (v == null || v === '') return '';
    return fmt(v);
}

function safeSlug(s) {
    return String(s || '')
        .replace(/[^\w-]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
}

function buildFileBase({ header }) {
    const company = safeSlug(header?.companyNameEnglish || header?.companyName || 'corporate');
    const range =
        header?.dateFrom && header?.dateTo
            ? `${header.dateFrom}_to_${header.dateTo}`
            : 'all';
    return `Corporate_AR_Ledger_${company}_${range}`;
}

const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+/g;
const LATIN_RE = /[A-Za-z0-9][A-Za-z0-9\s&.,'()\-/]+/g;

/** Split mixed EN/AR company names into separate lines for PDF. */
export function splitLatinAndArabic(text) {
    const raw = String(text || '').trim();
    if (!raw) return { english: '', arabic: '' };

    const arabicParts = raw.match(ARABIC_RE) || [];
    const latinParts = raw.match(LATIN_RE) || [];

    const english = latinParts.join(' ').replace(/\s+/g, ' ').trim();
    const arabic = arabicParts.join(' ').replace(/\s+/g, ' ').trim();

    if (english && arabic) return { english, arabic };
    if (arabic && !english) return { english: '', arabic };
    if (/[\u0600-\u06FF]/.test(raw)) return { english: '', arabic: raw };
    return { english: raw, arabic: '' };
}

function formatPeriodLabel(dateFrom, dateTo) {
    if (!dateFrom && !dateTo) return 'All transactions';
    if (dateFrom && dateTo) return `${dateFrom}  —  ${dateTo}`;
    if (dateFrom) return `From ${dateFrom}`;
    return `Until ${dateTo}`;
}

function escapeHtml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** PDF/Excel type column — first 3 characters (e.g. Invoice → INV, Receipt → REC). */
export function formatLedgerTypeShort(type) {
    const s = String(type || '').trim();
    if (!s) return '—';
    return s.slice(0, 3).toUpperCase();
}

const LEDGER_COLUMNS = [
    { en: 'Date', ar: 'التاريخ' },
    { en: 'Inv No.', ar: 'رقم الفاتورة' },
    { en: 'Vehicle No.', ar: 'رقم المركبة' },
    { en: 'Products & Services', ar: 'المنتجات والخدمات' },
    { en: 'Type', ar: 'النوع' },
    { en: 'Inv Excl VAT', ar: 'المبلغ بدون ضريبة' },
    { en: 'VAT 15%', ar: 'ضريبة 15%' },
    { en: 'Discounts', ar: 'الخصومات' },
    { en: 'INV Incl VAT', ar: 'الفاتورة شامل الضريبة' },
    { en: 'Returns', ar: 'المرتجعات' },
    { en: 'Receipts', ar: 'المقبوضات' },
    { en: 'Balance', ar: 'الرصيد' },
];

const KPI_COLUMNS = [
    { en: 'Total Invoices', ar: 'إجمالي الفواتير' },
    { en: 'Total Receipts', ar: 'إجمالي المقبوضات' },
    { en: 'Discounts', ar: 'الخصومات' },
    { en: 'Sales Returns', ar: 'مرتجعات المبيعات' },
    { en: 'Closing Balance', ar: 'الرصيد الختامي' },
];

const PDF_MARGIN = 20;
/** Reserve space at bottom for "Page X of Y" footer text. */
const PDF_FOOTER_RESERVE_PT = 14;

function getPdfLayout(doc) {
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    return {
        margin: PDF_MARGIN,
        contentW: pageW - PDF_MARGIN * 2,
        contentH: pageH - PDF_MARGIN * 2,
    };
}

const PDF_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;600;700&display=swap');
  .car-pdf * { box-sizing: border-box; margin: 0; padding: 0; }
  .car-pdf {
    width: 100%;
    background: #ffffff;
    font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
    color: #1e293b;
  }
  .car-pdf-hdr { padding: 12px 10px 8px; }
  .car-pdf-hdr__top {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding-bottom: 10px;
    border-bottom: 2.5px solid #FCC247;
  }
  .car-pdf-hdr__logo { width: 40px; height: 40px; object-fit: contain; display: block; }
  .car-pdf-hdr__seller { flex: 1; text-align: right; padding-top: 2px; }
  .car-pdf-hdr__seller-en { font-size: 12px; font-weight: 700; color: #111827; line-height: 1.25; }
  .car-pdf-hdr__seller-ar {
    font-family: 'Noto Sans Arabic', sans-serif;
    font-size: 11px; font-weight: 600; direction: rtl; color: #334155; margin-top: 2px;
  }
  .car-pdf-hdr__seller-meta { font-size: 9px; color: #64748b; margin-top: 4px; line-height: 1.4; }
  .car-pdf-hdr__title-row {
    text-align: center;
    margin: 10px 0 6px;
    padding-bottom: 6px;
    border-bottom: 1px solid #e2e8f0;
  }
  .car-pdf-hdr__title-text {
    display: inline-block;
    white-space: nowrap;
    font-size: 14px;
    font-weight: 700;
    color: #111827;
    line-height: 1.3;
  }
  .car-pdf-hdr__title-ar-inline {
    font-family: 'Noto Sans Arabic', sans-serif;
    text-decoration: underline;
    text-underline-offset: 4px;
    unicode-bidi: embed;
    direction: rtl;
    display: inline;
  }
  .car-pdf-hdr__title-sep {
    display: inline;
    margin: 0 10px;
    color: #94a3b8;
    font-weight: 400;
  }
  .car-pdf-hdr__title-en-inline {
    color: #475569;
    display: inline;
  }
  .car-pdf-hdr__period { font-size: 9px; color: #64748b; margin-bottom: 8px; }
  .car-pdf-hdr__customer-en { font-size: 11px; font-weight: 600; color: #0f172a; line-height: 1.35; }
  .car-pdf-hdr__customer-ar {
    font-family: 'Noto Sans Arabic', sans-serif;
    font-size: 11px; font-weight: 600; color: #0f172a;
    direction: rtl; text-align: left; line-height: 1.4; margin-top: 4px;
  }
  .car-pdf-hdr__customer-tax { font-size: 9px; color: #475569; margin-top: 6px; }
  .car-pdf-hdr__generated { font-size: 8px; color: #94a3b8; margin-top: 3px; }
  .car-pdf-body { padding: 0 10px 8px; }
  .car-pdf-cont {
    padding: 10px 10px 8px;
    border-top: 2px solid #FCC247;
  }
  .car-pdf-cont__title {
    font-size: 10px;
    font-weight: 700;
    color: #334155;
    margin-bottom: 3px;
  }
  .car-pdf-cont__meta { font-size: 8px; color: #64748b; margin-bottom: 8px; }
  .car-bill-detail-banner {
    text-align: center;
    margin: 0 10px 10px;
    padding: 8px 6px;
    border-bottom: 1px solid #e2e8f0;
  }
  .car-bill-detail-banner__en { font-size: 11px; font-weight: 700; color: #1e293b; }
  .car-bill-detail-banner__ar {
    font-family: 'Noto Sans Arabic', sans-serif;
    font-size: 10px; font-weight: 600; color: #475569; direction: rtl; margin-top: 3px;
  }
  .car-pdf-page-foot {
    padding: 6px 14px 0;
    text-align: center;
    font-size: 8px;
    color: #94a3b8;
  }
  .car-pdf-kpi {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 8px;
    font-size: 7.5px;
    table-layout: fixed;
  }
  .car-pdf-kpi th {
    background: #FEF3C7;
    color: #92400E;
    padding: 5px 3px;
    border: 1px solid #FDE68A;
    text-align: center;
    vertical-align: middle;
  }
  .car-pdf-kpi td {
    background: #FFFBEB;
    font-weight: 700;
    padding: 5px 3px;
    border: 1px solid #FDE68A;
    text-align: center;
    font-size: 7.5px;
  }
  .car-pdf-kpi .lbl-en { display: block; font-size: 7px; font-weight: 700; line-height: 1.15; }
  .car-pdf-kpi .lbl-ar {
    display: block;
    font-family: 'Noto Sans Arabic', sans-serif;
    font-size: 6.5px;
    font-weight: 600;
    direction: rtl;
    color: #78350F;
    margin-top: 1px;
    line-height: 1.15;
  }
  .car-pdf-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 7px;
    table-layout: fixed;
  }
  .car-pdf-table th {
    background: #F1F5F9;
    color: #1E293B;
    padding: 4px 2px;
    border: 1px solid #CBD5E1;
    vertical-align: middle;
    text-align: center;
  }
  .car-pdf-table td {
    padding: 4px 2px;
    border: 1px solid #E2E8F0;
    vertical-align: top;
    word-wrap: break-word;
    overflow-wrap: anywhere;
  }
  .car-pdf-table td.col-text { text-align: left; }
  .car-pdf-table td.col-prod { text-align: left; padding-left: 4px; padding-right: 3px; }
  .car-pdf-table .th-en, .car-pdf-table .td-en { display: block; line-height: 1.15; font-size: 7px; }
  .car-pdf-table .th-ar, .car-pdf-table .td-ar {
    display: block;
    font-family: 'Noto Sans Arabic', sans-serif;
    direction: rtl;
    text-align: right;
    line-height: 1.15;
    font-size: 6.5px;
    color: #475569;
    margin-top: 1px;
  }
  .car-pdf-table .td-ar { color: #334155; }
  .car-pdf-table .num {
    text-align: right;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    font-size: 7px;
    padding-right: 3px;
  }
  .car-pdf-table tr.row-open td, .car-pdf-table tr.row-close td {
    background: #F8FAFC;
    font-weight: 700;
  }
  .car-pdf-table tr.row-close td { background: #FFF7ED; }
  .car-pdf-table col.col-date { width: 8%; }
  .car-pdf-table col.col-inv { width: 8%; }
  .car-pdf-table col.col-veh { width: 7%; }
  .car-pdf-table col.col-prod { width: 21%; }
  .car-pdf-table col.col-type { width: 4%; }
  .car-pdf-table col.col-num { width: 7.57%; }
`;

function bilingualCell(en, ar) {
    if (!ar) return `<span class="td-en">${escapeHtml(en)}</span>`;
    return `<span class="td-en">${escapeHtml(en)}</span><span class="td-ar">${escapeHtml(ar)}</span>`;
}

function buildHeaderHtml(header) {
    const { english, arabic } = splitLatinAndArabic(header?.companyName);
    const companyNameEnglish = header?.companyNameEnglish || english || 'Corporate Customer';
    const companyNameArabic = header?.companyNameArabic || arabic;
    const sellerEn = header?.sellerNameEn || 'Filter Car Services';
    const sellerAr = header?.sellerNameAr || 'فلتر لخدمات السيارات';
    const sellerTax = header?.sellerTaxId || '311120967500003';
    const branch = header?.workshopName || header?.branchName || '';
    const vat = header?.vatNumber || '—';
    const period = formatPeriodLabel(header?.dateFrom, header?.dateTo);
    const generated = header?.generatedAt || new Date().toLocaleString();

    return `
<div class="car-pdf-hdr">
  <div class="car-pdf-hdr__top">
    <div><img class="car-pdf-hdr__logo" src="${escapeHtml(filterBrandIcon)}" alt="FILTER" /></div>
    <div class="car-pdf-hdr__seller">
      <div class="car-pdf-hdr__seller-en">${escapeHtml(sellerEn)}</div>
      <div class="car-pdf-hdr__seller-ar">${escapeHtml(sellerAr)}</div>
      <div class="car-pdf-hdr__seller-meta">
        ${branch ? `<div>${escapeHtml(branch)}</div>` : ''}
        <div>Tax No.: ${escapeHtml(sellerTax)}</div>
      </div>
    </div>
  </div>
  <div class="car-pdf-hdr__title-row">
    <div class="car-pdf-hdr__title-text">
      <span class="car-pdf-hdr__title-ar-inline">كشف&nbsp;حساب</span><span class="car-pdf-hdr__title-sep">|</span><span class="car-pdf-hdr__title-en-inline">Statement of Account</span>
    </div>
  </div>
  <div class="car-pdf-hdr__period">Period: ${escapeHtml(period)}</div>
  <div class="car-pdf-hdr__customer-en">${escapeHtml(companyNameEnglish)}</div>
  ${companyNameArabic ? `<div class="car-pdf-hdr__customer-ar">${escapeHtml(companyNameArabic)}</div>` : ''}
  <div class="car-pdf-hdr__customer-tax">Tax No.: ${escapeHtml(vat)}</div>
  <div class="car-pdf-hdr__generated">Generated: ${escapeHtml(generated)}</div>
</div>`;
}

function buildTableHeadHtml() {
    const colHead = LEDGER_COLUMNS.map(
        (c) =>
            `<th><span class="th-en">${escapeHtml(c.en)}</span><span class="th-ar">${escapeHtml(c.ar)}</span></th>`,
    ).join('');
    const colgroup = `
<colgroup>
  <col class="col-date" /><col class="col-inv" /><col class="col-veh" /><col class="col-prod" />
  <col class="col-type" /><col class="col-num" /><col class="col-num" /><col class="col-num" />
  <col class="col-num" /><col class="col-num" /><col class="col-num" /><col class="col-num" />
</colgroup>`;
    return { colHead, colgroup };
}

function buildDataRowHtml(r) {
    const prodEn = r.productsServicesEn ?? r.productsServices ?? '—';
    const prodAr = r.productsServicesAr ?? '';
    return `<tr>
  <td class="col-text">${escapeHtml(r.date)}</td>
  <td class="col-text">${escapeHtml(r.invoiceNo)}</td>
  <td class="col-text">${escapeHtml(r.vehicleNo)}</td>
  <td class="col-prod">${bilingualCell(prodEn, prodAr)}</td>
  <td class="col-text">${escapeHtml(formatLedgerTypeShort(r.type))}</td>
  <td class="num">${fmtCell(r.invoiceExclVat)}</td>
  <td class="num">${fmtCell(r.vat15)}</td>
  <td class="num">${fmtCell(r.salesDiscounts)}</td>
  <td class="num">${fmtCell(r.invoiceInclusiveVat)}</td>
  <td class="num">${fmtCell(r.salesReturns)}</td>
  <td class="num">${fmtCell(r.receipts)}</td>
  <td class="num">${fmt(r.runningBalance)}</td>
</tr>`;
}

function buildKpiHtml(summary) {
    const sum = summary ?? {};
    const kpiValues = [
        `SAR ${fmt(sum.totalInvoiceAmount)}`,
        `SAR ${fmt(sum.totalReceipts)}`,
        `SAR ${fmt(sum.totalDiscounts)}`,
        `SAR ${fmt(sum.totalSalesReturns)}`,
        `SAR ${fmt(sum.closingBalance)}`,
    ];
    const kpiHead = KPI_COLUMNS.map(
        (c) =>
            `<th><span class="lbl-en">${escapeHtml(c.en)}</span><span class="lbl-ar">${escapeHtml(c.ar)}</span></th>`,
    ).join('');
    return `<table class="car-pdf-kpi"><thead><tr>${kpiHead}</tr></thead>
  <tbody><tr>${kpiValues.map((v) => `<td>${escapeHtml(v)}</td>`).join('')}</tr></tbody></table>`;
}

/** One print page — KPI optional; opening/closing only on first/last chunk. */
function buildLedgerPageHtml(summary, chunkRows, opts) {
    const sum = summary ?? {};
    const { showKpi, showOpening, showClosing } = opts;
    const { colHead, colgroup } = buildTableHeadHtml();

    const openingRow = showOpening
        ? `<tr class="row-open"><td colspan="11"><strong>Opening balance / الرصيد الافتتاحي</strong></td><td class="num">${fmt(sum.openingBalance)}</td></tr>`
        : '';
    const closingRow = showClosing
        ? `<tr class="row-close"><td colspan="11"><strong>Closing balance / الرصيد الختامي</strong></td><td class="num">${fmt(sum.closingBalance)}</td></tr>`
        : '';
    const dataRows = chunkRows.map(buildDataRowHtml).join('');

    return `
<div class="car-pdf-body">
  ${showKpi ? buildKpiHtml(summary) : ''}
  <table class="car-pdf-table">${colgroup}
    <thead><tr>${colHead}</tr></thead>
    <tbody>${openingRow}${dataRows}${closingRow}</tbody>
  </table>
</div>`;
}

function buildContinuationHeaderHtml(header) {
    const { english } = splitLatinAndArabic(header?.companyName);
    const name = header?.companyNameEnglish || english || 'Corporate Customer';
    const period = formatPeriodLabel(header?.dateFrom, header?.dateTo);
    return `
<div class="car-pdf-cont">
  <div class="car-pdf-cont__title">${escapeHtml(name)} — Statement of Account / كشف حساب</div>
  <div class="car-pdf-cont__meta">Period: ${escapeHtml(period)} · Tax No.: ${escapeHtml(header?.vatNumber || '—')}</div>
</div>`;
}

function buildBillDetailBannerHtml() {
    return `
<div class="car-bill-detail-banner">
  <div class="car-bill-detail-banner__en">Statement of Account — Detailed Transactions</div>
  <div class="car-bill-detail-banner__ar">كشف حساب — التفاصيل</div>
</div>`;
}

function buildBillDetailPageHtml(header, summary, chunk) {
    const pageOpts = {
        showKpi: chunk.isFirst,
        showOpening: chunk.isFirst,
        showClosing: chunk.isLast,
    };
    if (chunk.isFirst) {
        return (
            buildHeaderHtml(header) +
            buildBillDetailBannerHtml() +
            buildLedgerPageHtml(summary, chunk.rows, pageOpts)
        );
    }
    return (
        buildContinuationHeaderHtml(header) +
        buildLedgerPageHtml(summary, chunk.rows, { ...pageOpts, showKpi: false })
    );
}

/** Invoice lines from ledger or statement fallback. */
function getLedgerInvoiceLines(ledgerStatement, statement) {
    const fromLedger = (ledgerStatement?.lines ?? [])
        .filter((r) => r.type === 'Invoice')
        .filter(
            (r) =>
                Number(r.invoiceInclusiveVat ?? 0) > 0 ||
                Number(r.invoiceExclVat ?? 0) > 0,
        );
    if (fromLedger.length) return fromLedger;

    const stmtRows = (statement?.rows ?? []).filter((r) => r.type === 'Invoice');
    return stmtRows.map((r) => {
        const incl = Number(r.invoiceAmount ?? 0);
        const excl = incl / 1.15;
        const vat = incl - excl;
        return {
            date: r.date,
            invoiceNo: r.refNo,
            type: 'Invoice',
            invoiceExclVat: excl,
            vat15: vat,
            invoiceInclusiveVat: incl,
        };
    });
}

function parseIsoDate(s) {
    if (!s) return null;
    const raw = String(s).trim();
    const d = new Date(raw.includes('T') ? raw : `${raw}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
}

function ordinalSuffix(n) {
    if (n >= 11 && n <= 13) return 'th';
    const r = n % 10;
    if (r === 1) return 'st';
    if (r === 2) return 'nd';
    if (r === 3) return 'rd';
    return 'th';
}

const MONTH_NAMES_EN = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTH_NAMES_EN_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAMES_AR = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

/** Bill summary date column — e.g. 1-Mar-26 */
function formatBillGeneratedDateLabel(d) {
    const day = d.getDate();
    const mon = MONTH_NAMES_EN_SHORT[d.getMonth()];
    const yr = String(d.getFullYear()).slice(-2);
    return `${day}-${mon}-${yr}`;
}

function formatPeriodPhraseStart(d) {
    const day = d.getDate();
    const pad = String(day).padStart(2, '0');
    return `${pad}${ordinalSuffix(day)} ${MONTH_NAMES_EN[d.getMonth()]}`;
}

function formatPeriodPhraseEnd(d) {
    const day = d.getDate();
    const pad = String(day).padStart(2, '0');
    return `${pad}${ordinalSuffix(day)} ${MONTH_NAMES_EN[d.getMonth()]} ${d.getFullYear()}`;
}

function formatPeriodPhraseStartAr(d) {
    const day = d.getDate();
    return `${day} ${MONTH_NAMES_AR[d.getMonth()]}`;
}

function formatPeriodPhraseEndAr(d) {
    const day = d.getDate();
    return `${day} ${MONTH_NAMES_AR[d.getMonth()]} ${d.getFullYear()}`;
}

function buildMonthlyBillDescriptionEn(start, end) {
    return `Oil change & Car Wash Services Bill for the period of ${formatPeriodPhraseStart(start)} till ${formatPeriodPhraseEnd(end)}`;
}

function buildMonthlyBillDescriptionAr(start, end) {
    return `فاتورة غيار زيت وغسيل سيارات للفترة من ${formatPeriodPhraseStartAr(start)} حتى ${formatPeriodPhraseEndAr(end)}`;
}

/** Split selected bill period into calendar-month chunks (e.g. May 1–Jun 20 → May + Jun partial). */
function splitPeriodIntoMonthChunks(startStr, endStr) {
    const start = parseIsoDate(startStr);
    const end = parseIsoDate(endStr);
    if (!start || !end || start > end) return [];

    const chunks = [];
    let y = start.getFullYear();
    let m = start.getMonth();

    while (true) {
        const chunkStart =
            chunks.length === 0
                ? new Date(y, m, start.getDate())
                : new Date(y, m, 1);
        if (chunkStart > end) break;

        const lastOfMonth = new Date(y, m + 1, 0);
        const chunkEnd = lastOfMonth > end ? new Date(end.getTime()) : lastOfMonth;
        chunks.push({ start: chunkStart, end: chunkEnd });

        if (chunkEnd >= end) break;
        m += 1;
        if (m > 11) {
            m = 0;
            y += 1;
        }
    }

    return chunks;
}

function normalizeInvoiceAmounts(line) {
    let incl = Number(line.invoiceInclusiveVat ?? line.invoiceAmount ?? 0);
    let excl = Number(line.invoiceExclVat ?? 0);
    let vat = Number(line.vat15 ?? 0);
    if (incl > 0 && excl <= 0) {
        excl = incl / 1.15;
        vat = incl - excl;
    } else if (excl > 0 && incl <= 0) {
        vat = vat > 0 ? vat : excl * 0.15;
        incl = excl + vat;
    }
    return {
        excl: Number(excl.toFixed(2)),
        vat: Number(vat.toFixed(2)),
        incl: Number(incl.toFixed(2)),
    };
}

/**
 * Summarized bill rows — one line per calendar month (or partial month) in the bill period.
 * Amounts = sum of invoice Excl VAT / VAT / Incl VAT from detailed ledger for that sub-period.
 */
function buildMonthlySummarizedBillRows(ledgerStatement, statement, bill) {
    const invoiceLines = getLedgerInvoiceLines(ledgerStatement, statement);
    const dateFrom =
        bill?.periodStartDate?.slice?.(0, 10) ||
        statement?.period?.startDate?.slice?.(0, 10) ||
        '';
    const dateTo =
        bill?.periodEndDate?.slice?.(0, 10) ||
        statement?.period?.endDate?.slice?.(0, 10) ||
        '';

    const genDate = parseIsoDate(bill?.createdAt) || new Date();
    const dateLabel = formatBillGeneratedDateLabel(genDate);

    const chunks = splitPeriodIntoMonthChunks(dateFrom, dateTo);
    if (!chunks.length) {
        const { excl, vat, incl } = invoiceLines.reduce(
            (acc, line) => {
                const a = normalizeInvoiceAmounts(line);
                acc.excl += a.excl;
                acc.vat += a.vat;
                acc.incl += a.incl;
                return acc;
            },
            { excl: 0, vat: 0, incl: 0 },
        );
        const start = parseIsoDate(dateFrom) || genDate;
        const end = parseIsoDate(dateTo) || genDate;
        return [
            {
                date: dateLabel,
                descriptionEn: buildMonthlyBillDescriptionEn(start, end),
                descriptionAr: buildMonthlyBillDescriptionAr(start, end),
                invoiceExclVat: Number(excl.toFixed(2)),
                vat15: Number(vat.toFixed(2)),
                invoiceInclusiveVat: Number(incl.toFixed(2)),
            },
        ];
    }

    return chunks.map((chunk) => {
        let excl = 0;
        let vat = 0;
        let incl = 0;

        for (const line of invoiceLines) {
            const lineDate = parseIsoDate(line.date);
            if (!lineDate) continue;
            if (lineDate < chunk.start || lineDate > chunk.end) continue;
            const a = normalizeInvoiceAmounts(line);
            excl += a.excl;
            vat += a.vat;
            incl += a.incl;
        }

        return {
            date: dateLabel,
            descriptionEn: buildMonthlyBillDescriptionEn(chunk.start, chunk.end),
            descriptionAr: buildMonthlyBillDescriptionAr(chunk.start, chunk.end),
            invoiceExclVat: Number(excl.toFixed(2)),
            vat15: Number(vat.toFixed(2)),
            invoiceInclusiveVat: Number(incl.toFixed(2)),
        };
    });
}

function computeSummaryTotals(summaryRows, statement, bill) {
    const kpis = bill?.kpis ?? statement?.kpis ?? {};
    let totalExcl = summaryRows.reduce((s, r) => s + Number(r.invoiceExclVat ?? 0), 0);
    let totalVat = summaryRows.reduce((s, r) => s + Number(r.vat15 ?? 0), 0);
    let totalIncl = summaryRows.reduce((s, r) => s + Number(r.invoiceInclusiveVat ?? 0), 0);

    if (summaryRows.length === 0 && Number(kpis.totalInvoiceAmount ?? 0) > 0) {
        totalIncl = Number(kpis.totalInvoiceAmount);
        totalExcl = totalIncl / 1.15;
        totalVat = totalIncl - totalExcl;
    }

    const balanceDue = Number(kpis.balance ?? totalIncl);
    return {
        totalExcl: Number(totalExcl.toFixed(2)),
        totalVat: Number(totalVat.toFixed(2)),
        totalIncl: Number(totalIncl.toFixed(2)),
        balanceDue,
    };
}

function resolveZatcaSellerName(corp, header) {
    const workshop = String(corp?.workshopName || header?.workshopName || '').trim();
    if (workshop) return workshop;
    return 'Filter Car Services';
}

function resolveZatcaSellerTaxId(corp, header) {
    const tax = String(
        corp?.workshopTaxId || header?.sellerTaxId || header?.workshopTaxId || '',
    ).trim();
    return tax || '311120967500003';
}

function buildBillKpiSummary(ledger, statement, bill, totals) {
    const ledgerSum = ledger?.summary ?? {};
    const kpis = bill?.kpis ?? statement?.kpis ?? {};
    return {
        openingBalance: Number(ledgerSum.openingBalance ?? 0),
        totalInvoiceAmount: Number(
            ledgerSum.totalInvoiceAmount ?? totals.totalIncl ?? kpis.totalInvoiceAmount ?? 0,
        ),
        totalReceipts: Number(ledgerSum.totalReceipts ?? kpis.totalReceipts ?? 0),
        totalDiscounts: Number(ledgerSum.totalDiscounts ?? 0),
        totalSalesReturns: Number(
            ledgerSum.totalSalesReturns ?? kpis.totalSalesReturn ?? kpis.totalSalesReturns ?? 0,
        ),
        closingBalance: Number(
            ledgerSum.closingBalance ?? kpis.balance ?? totals.balanceDue ?? 0,
        ),
    };
}

/** Build ledger detail pages from frozen statement when snapshot ledger is missing. */
function buildSyntheticLedgerFromStatement(statement, bill) {
    const rows = statement?.rows ?? [];
    const kpis = statement?.kpis ?? bill?.kpis ?? {};
    const closingBalance = Number(kpis.balance ?? 0);
    const totalInv = Number(kpis.totalInvoiceAmount ?? 0);
    const totalRec = Number(kpis.totalReceipts ?? 0);
    const totalRet = Number(kpis.totalSalesReturn ?? 0);
    const openingBalance = Number(
        (closingBalance - totalInv + totalRec + totalRet).toFixed(2),
    );

    const sorted = [...rows].sort((a, b) => {
        const da = String(a.date).localeCompare(String(b.date));
        if (da !== 0) return da;
        const typeOrder = { Invoice: 0, 'Sales Return': 1, Receipt: 2 };
        return (typeOrder[a.type] ?? 9) - (typeOrder[b.type] ?? 9);
    });

    let running = openingBalance;
    const lines = [];

    for (const row of sorted) {
        const type = row.type;
        let invoiceExclVat = null;
        let vat15 = null;
        let invoiceInclusiveVat = null;
        let salesReturns = null;
        let receipts = null;
        let productsServicesEn = row.workshopBranch || type;
        let productsServicesAr = '';

        if (type === 'Invoice') {
            const incl = Number(row.invoiceAmount ?? 0);
            invoiceExclVat = incl / 1.15;
            vat15 = incl - invoiceExclVat;
            invoiceInclusiveVat = incl;
            productsServicesAr = 'خدمات ومنتجات';
        } else if (type === 'Sales Return') {
            salesReturns = Number(row.salesReturn ?? 0);
            productsServicesEn = 'Sales return';
            productsServicesAr = 'مرتجع مبيعات';
        } else if (type === 'Receipt') {
            receipts = Number(row.receipts ?? 0);
            productsServicesEn = row.orderSourceLabel || 'Receipt';
            productsServicesAr = 'سند قبض';
        }

        const countsInBalance =
            type === 'Sales Return'
                ? row.status === 'Approved'
                : type === 'Receipt'
                  ? !String(row.status).includes('Unapproved')
                  : true;

        if (countsInBalance) {
            if (type === 'Invoice') running += Number(row.invoiceAmount ?? 0);
            else if (type === 'Sales Return') running -= Number(row.salesReturn ?? 0);
            else if (type === 'Receipt') running -= Number(row.receipts ?? 0);
            running = Number(running.toFixed(2));
        }

        lines.push({
            id: `${type}-${row.refNo}-${row.date}`,
            date: row.date,
            invoiceNo: row.refNo,
            vehicleNo: row.vehicleNumber || '—',
            productsServicesEn,
            productsServicesAr,
            type,
            invoiceExclVat,
            vat15,
            salesDiscounts: null,
            invoiceInclusiveVat,
            salesReturns,
            receipts,
            runningBalance: running,
            status: row.status,
            countsInBalance,
        });
    }

    return {
        corporateAccount: statement?.corporateAccount ?? null,
        summary: {
            openingBalance,
            closingBalance,
            totalInvoiceAmount: totalInv,
            totalReceipts: totalRec,
            totalDiscounts: 0,
            totalSalesReturns: totalRet,
        },
        lines,
    };
}

async function resolveLedgerForBillExport({ bill, statement, ledgerStatement, fetchLedger }) {
    if (ledgerStatement?.lines?.length) return ledgerStatement;

    const corpId = bill?.corporateAccountId;
    const dateFrom =
        bill?.periodStartDate?.slice?.(0, 10) ||
        statement?.period?.startDate?.slice?.(0, 10) ||
        '';
    const dateTo =
        bill?.periodEndDate?.slice?.(0, 10) ||
        statement?.period?.endDate?.slice?.(0, 10) ||
        '';

    if (fetchLedger && corpId) {
        try {
            const live = await fetchLedger({
                corporateAccountId: corpId,
                dateFrom,
                dateTo,
            });
            if (live?.lines?.length) return live;
        } catch (e) {
            console.warn('[corporate bill PDF] live ledger fetch failed', e);
        }
    }

    return buildSyntheticLedgerFromStatement(statement, bill);
}

function buildPageHtml(header, summary, chunk) {
    const pageOpts = {
        showKpi: chunk.isFirst,
        showOpening: chunk.isFirst,
        showClosing: chunk.isLast,
    };
    if (chunk.isFirst) {
        return buildHeaderHtml(header) + buildLedgerPageHtml(summary, chunk.rows, pageOpts);
    }
    return (
        buildContinuationHeaderHtml(header) +
        buildLedgerPageHtml(summary, chunk.rows, { ...pageOpts, showKpi: false })
    );
}

async function mountPdfFragment(htmlInner, contentWidth) {
    const host = document.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    Object.assign(host.style, {
        position: 'fixed',
        left: '-12000px',
        top: '0',
        width: `${contentWidth}px`,
        zIndex: '-1',
        pointerEvents: 'none',
    });
    host.innerHTML = `<style>${PDF_STYLES}</style><div class="car-pdf" style="width:${contentWidth}px">${htmlInner}</div>`;
    document.body.appendChild(host);

    if (document.fonts?.load) {
        await Promise.all([
            document.fonts.load('600 12px "Noto Sans Arabic"'),
            document.fonts.load('700 17px "Noto Sans Arabic"'),
        ]).catch(() => {});
        await new Promise((r) => setTimeout(r, 150));
    }

    const root = host.querySelector('.car-pdf');
    return { host, root };
}

function unmountPdfFragment(host) {
    host?.remove();
}

async function measureHtmlHeight(htmlInner, contentWidth) {
    const { host, root } = await mountPdfFragment(htmlInner, contentWidth);
    try {
        return root.offsetHeight;
    } finally {
        unmountPdfFragment(host);
    }
}

async function measureDataRowHeights(rows, contentWidth) {
    if (!rows?.length) return [];
    const { colgroup } = buildTableHeadHtml();
    const rowsHtml = rows.map(buildDataRowHtml).join('');
    const html = `<div class="car-pdf-body"><table class="car-pdf-table">${colgroup}<tbody>${rowsHtml}</tbody></table></div>`;
    const { host, root } = await mountPdfFragment(html, contentWidth);
    try {
        const trs = root.querySelectorAll('tbody tr');
        return Array.from(trs).map((tr) => tr.getBoundingClientRect().height);
    } finally {
        unmountPdfFragment(host);
    }
}

async function measureTableHeadHeight(contentWidth) {
    const { colHead, colgroup } = buildTableHeadHtml();
    const html = `<div class="car-pdf-body"><table class="car-pdf-table">${colgroup}<thead><tr>${colHead}</tr></thead></table></div>`;
    return measureHtmlHeight(html, contentWidth);
}

async function measureOpeningRowHeight(summary, contentWidth) {
    const sum = summary ?? {};
    const { colgroup } = buildTableHeadHtml();
    const row = `<tr class="row-open"><td colspan="11"><strong>Opening balance / الرصيد الافتتاحي</strong></td><td class="num">${fmt(sum.openingBalance)}</td></tr>`;
    const html = `<div class="car-pdf-body"><table class="car-pdf-table">${colgroup}<tbody>${row}</tbody></table></div>`;
    return measureHtmlHeight(html, contentWidth);
}

async function measureClosingRowHeight(summary, contentWidth) {
    const sum = summary ?? {};
    const { colgroup } = buildTableHeadHtml();
    const row = `<tr class="row-close"><td colspan="11"><strong>Closing balance / الرصيد الختامي</strong></td><td class="num">${fmt(sum.closingBalance)}</td></tr>`;
    const html = `<div class="car-pdf-body"><table class="car-pdf-table">${colgroup}<tbody>${row}</tbody></table></div>`;
    return measureHtmlHeight(html, contentWidth);
}

/**
 * Pack ledger rows into pages using measured heights — no fixed row counts, no image slicing.
 * Each page is one self-contained HTML fragment that fits the printable area.
 */
async function packLinesIntoPages(lines, summary, header, layout, pageHtmlBuilder = buildPageHtml) {
    const all = lines ?? [];
    const { contentW, contentH } = layout;
    const usable = contentH - PDF_FOOTER_RESERVE_PT;
    const detailBannerH =
        pageHtmlBuilder === buildBillDetailPageHtml
            ? await measureHtmlHeight(buildBillDetailBannerHtml(), contentW)
            : 0;

    const [headerH, kpiH, contHeaderH, theadH, openingH, closingH, rowHeights] = await Promise.all([
        measureHtmlHeight(buildHeaderHtml(header), contentW),
        measureHtmlHeight(buildKpiHtml(summary), contentW),
        measureHtmlHeight(buildContinuationHeaderHtml(header), contentW),
        measureTableHeadHeight(contentW),
        measureOpeningRowHeight(summary, contentW),
        measureClosingRowHeight(summary, contentW),
        measureDataRowHeights(all, contentW),
    ]);

    const pages = [];
    let rowIdx = 0;
    let pageIdx = 0;

    while (rowIdx < all.length || pageIdx === 0) {
        const isFirst = pageIdx === 0;
        let overhead = isFirst ? headerH + kpiH + detailBannerH : contHeaderH;
        overhead += theadH;
        if (isFirst) overhead += openingH;

        const available = usable - overhead;
        const pageRows = [];
        let usedRows = 0;

        while (rowIdx < all.length) {
            const rowH = rowHeights[rowIdx];
            const isLastRow = rowIdx === all.length - 1;
            const closingExtra = isLastRow ? closingH : 0;
            const projected = usedRows + rowH + closingExtra;

            if (pageRows.length > 0 && projected > available) break;

            pageRows.push(all[rowIdx]);
            usedRows += rowH;
            rowIdx += 1;
            if (isLastRow) break;
        }

        pages.push({ isFirst, isLast: rowIdx >= all.length, rows: pageRows });
        pageIdx += 1;
        if (rowIdx >= all.length) break;
    }

    // Safety: verify each packed page fits; move overflow rows to the next page.
    let i = 0;
    while (i < pages.length) {
        let chunk = pages[i];
        let pageHeight = await measureHtmlHeight(pageHtmlBuilder(header, summary, chunk), contentW);

        while (pageHeight > usable && chunk.rows.length > 0) {
            const moved = chunk.rows.pop();
            chunk.isLast = false;

            if (i + 1 < pages.length) {
                pages[i + 1].rows.unshift(moved);
                pages[i + 1].isFirst = false;
            } else {
                pages.push({ isFirst: false, isLast: true, rows: [moved] });
            }

            chunk = pages[i];
            pageHeight = await measureHtmlHeight(pageHtmlBuilder(header, summary, chunk), contentW);
        }
        i += 1;
    }

    pages.forEach((p, idx) => {
        p.isLast = idx === pages.length - 1;
    });

    return pages;
}

async function captureHtmlFragment(htmlInner, contentWidth) {
    const { host, root } = await mountPdfFragment(htmlInner, contentWidth);

    try {
        const { toPng } = await import('html-to-image');
        const imgData = await toPng(root, {
            backgroundColor: '#ffffff',
            pixelRatio: 2,
            cacheBust: true,
        });

        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () =>
                resolve({
                    dataUrl: imgData,
                    width: img.naturalWidth,
                    height: img.naturalHeight,
                });
            img.onerror = () => reject(new Error('Failed to render PDF section'));
            img.src = imgData;
        });
    } finally {
        unmountPdfFragment(host);
    }
}

/** Place one captured page on PDF — scale down if needed; never slice mid-content. */
function addSinglePageImage(doc, img, layout, startNewPage) {
    const { margin, contentW, contentH } = layout;
    const drawW = contentW;
    const drawH = (img.height * drawW) / img.width;

    if (startNewPage) doc.addPage();

    if (drawH > contentH) {
        const scale = contentH / drawH;
        const scaledW = drawW * scale;
        const x = margin + (contentW - scaledW) / 2;
        doc.addImage(img.dataUrl, 'PNG', x, margin, scaledW, contentH);
        return;
    }

    doc.addImage(img.dataUrl, 'PNG', margin, margin, drawW, drawH);
}

function addPdfPageFooters(doc, layout) {
    const total = doc.internal.getNumberOfPages();
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    for (let i = 1; i <= total; i++) {
        doc.setPage(i);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(`Page ${i} of ${total}`, pageW / 2, pageH - layout.margin / 2, {
            align: 'center',
        });
    }
}

export async function exportCorporateArLedgerPdf({ header, summary, lines }) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const layout = getPdfLayout(doc);

    try {
        const pages = await packLinesIntoPages(lines, summary, header, layout);
        let isFirstPdfPage = true;

        for (const chunk of pages) {
            const html = buildPageHtml(header, summary, chunk);
            const img = await captureHtmlFragment(html, layout.contentW);
            addSinglePageImage(doc, img, layout, !isFirstPdfPage);
            isFirstPdfPage = false;
        }

        addPdfPageFooters(doc, layout);
    } catch (e) {
        console.error('[corporate AR PDF]', e);
        throw e;
    }

    doc.save(`${buildFileBase({ header })}.pdf`);
}

const MONTHLY_INVOICE_STYLES = `
  .car-mi-hdr {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    padding-bottom: 12px;
    border-bottom: 2.5px solid #FCC247;
    margin-bottom: 12px;
  }
  .car-mi-hdr__customer-en { font-size: 11px; font-weight: 600; color: #0f172a; line-height: 1.35; }
  .car-mi-hdr__customer-ar {
    font-family: 'Noto Sans Arabic', sans-serif;
    font-size: 11px; font-weight: 600; direction: rtl; text-align: left; margin-top: 4px;
  }
  .car-mi-hdr__meta { font-size: 9px; color: #64748b; margin-top: 6px; line-height: 1.45; }
  .car-mi-hdr__seller { flex: 0 0 auto; text-align: right; min-width: 140px; }
  .car-mi-hdr__logo { width: 48px; height: 48px; object-fit: contain; display: block; margin-left: auto; margin-bottom: 4px; }
  .car-mi-hdr__seller-en { font-size: 12px; font-weight: 700; color: #111827; }
  .car-mi-hdr__seller-ar {
    font-family: 'Noto Sans Arabic', sans-serif; font-size: 11px; font-weight: 600; direction: rtl; margin-top: 2px;
  }
  .car-mi-hdr__seller-meta { font-size: 9px; color: #64748b; margin-top: 4px; line-height: 1.4; }
  .car-mi-title-block {
    text-align: center;
    margin: 14px 0 12px;
    padding-bottom: 10px;
    border-bottom: 1px solid #e2e8f0;
  }
  .car-mi-title-en { font-size: 15px; font-weight: 700; color: #111827; line-height: 1.3; }
  .car-mi-title-ar {
    font-family: 'Noto Sans Arabic', sans-serif;
    font-size: 14px; font-weight: 700; color: #111827; direction: rtl; margin-top: 5px;
  }
  .car-mi-due {
    font-size: 10px;
    color: #c2410c;
    font-weight: 700;
    margin-bottom: 10px;
    text-align: center;
  }
  .car-mi-kpi-wrap { margin: 0 0 12px; padding: 0 4px; }
  .car-mi-table {
    width: 100%; border-collapse: collapse; font-size: 7.5px; table-layout: fixed; margin-bottom: 12px;
  }
  .car-mi-table th {
    background: #DBEAFE; color: #1E3A8A; padding: 6px 4px; border: 1px solid #93C5FD;
    text-align: center; vertical-align: middle;
  }
  .car-mi-table td { padding: 5px 4px; border: 1px solid #E2E8F0; vertical-align: top; word-wrap: break-word; }
  .car-mi-table .th-ar, .car-mi-table .td-ar {
    display: block; font-family: 'Noto Sans Arabic', sans-serif; direction: rtl; font-size: 6.5px; margin-top: 2px;
  }
  .car-mi-table .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .car-mi-table tr.totals td { background: #DBEAFE; font-weight: 700; color: #1E3A8A; }
  .car-mi-table tr.empty td { height: 18px; }
  .car-mi-footer { display: flex; align-items: flex-end; justify-content: flex-start; margin-top: 16px; min-height: 130px; }
  .car-mi-qr img { width: 128px; height: 128px; display: block; }
  .car-mi-qr-label { font-size: 8px; color: #64748b; margin-top: 5px; text-align: center; }
`;

function buildMonthlyInvoiceRowHtml(row) {
    const descEn = row.descriptionEn ?? row.productsServicesEn ?? row.productsServices ?? '—';
    const descAr = row.descriptionAr ?? row.productsServicesAr ?? '';
    const desc = descAr
        ? `${escapeHtml(descEn)}<span class="td-ar">${escapeHtml(descAr)}</span>`
        : escapeHtml(descEn);
    return `<tr>
  <td>${escapeHtml(row.date)}</td>
  <td>${desc}</td>
  <td class="num">${fmtCell(row.invoiceExclVat)}</td>
  <td class="num">${fmtCell(row.vat15)}</td>
  <td class="num">${fmtCell(row.invoiceInclusiveVat)}</td>
</tr>`;
}

async function buildMonthlyInvoiceQrDataUrl(opts) {
    try {
        const grandTotal = Number(opts.grandTotal ?? opts.totalWithVat ?? 0);
        let vatAmount = Number(opts.vatAmount ?? 0);
        if (grandTotal > 0 && vatAmount <= 0) {
            vatAmount = grandTotal - grandTotal / 1.15;
        }
        const payload = buildZatcaPhase1QrPayloadFromInvoice({
            sellerName: opts.sellerName,
            vatNumber: opts.vatNumber,
            invoiceDate: opts.invoiceDate ?? opts.timestamp,
            grandTotal,
            vatAmount,
        });
        if (!payload) return '';
        return await QRCode.toDataURL(payload, {
            width: 220,
            margin: 2,
            errorCorrectionLevel: 'M',
        });
    } catch {
        return '';
    }
}

function buildMonthlyInvoiceHtml({ bill, statement, summaryRows, totals, kpiSummary, qrDataUrl }) {
    const corp = statement?.corporateAccount ?? {};
    const { english, arabic } = splitLatinAndArabic(corp.companyName);
    const companyEn = english || corp.companyName || 'Corporate Customer';
    const companyAr = arabic || corp.companyNameArabic || '';
    const sellerEn = 'Filter Car Services';
    const sellerAr = 'فلتر لخدمات السيارات';
    const sellerTax = '311120967500003';
    const workshop = corp.workshopName || '';
    const vat = corp.vatNumber || '—';
    const dateFrom =
        bill?.periodStartDate?.slice?.(0, 10) ||
        statement?.period?.startDate?.slice?.(0, 10) ||
        '';
    const dateTo =
        bill?.periodEndDate?.slice?.(0, 10) ||
        statement?.period?.endDate?.slice?.(0, 10) ||
        '';
    const period = formatPeriodLabel(dateFrom, dateTo);
    const invoiceRows = summaryRows ?? [];
    const { totalExcl, totalVat, totalIncl, balanceDue } =
        totals ?? computeSummaryTotals(invoiceRows, statement, bill);

    const rowsHtml = invoiceRows.map(buildMonthlyInvoiceRowHtml).join('');
    const minBodyRows = 4;
    const fillerCount = Math.max(0, minBodyRows - invoiceRows.length);
    const fillerHtml = Array.from({ length: fillerCount }, () =>
        '<tr class="empty"><td>&nbsp;</td><td></td><td class="num"></td><td class="num"></td><td class="num"></td></tr>',
    ).join('');

    const dueDate =
        bill?.dueDate?.slice?.(0, 10) ||
        statement?.dueDate?.slice?.(0, 10) ||
        bill?.dueDate ||
        statement?.dueDate ||
        '—';

    const kpiHtml = kpiSummary ? `<div class="car-mi-kpi-wrap">${buildKpiHtml(kpiSummary)}</div>` : '';

    const qrBlock = qrDataUrl
        ? `<div class="car-mi-qr"><img src="${qrDataUrl}" alt="" /></div>`
        : '';

    return `
<style>${MONTHLY_INVOICE_STYLES}</style>
<div class="car-mi-hdr">
  <div>
    <div class="car-mi-hdr__meta">Period: ${escapeHtml(period)}</div>
    <div class="car-mi-hdr__customer-en">${escapeHtml(companyEn)}</div>
    ${companyAr ? `<div class="car-mi-hdr__customer-ar">${escapeHtml(companyAr)}</div>` : ''}
    <div class="car-mi-hdr__meta">Tax No.: ${escapeHtml(vat)}</div>
    <div class="car-mi-hdr__meta">Bill No.: ${escapeHtml(bill?.billNo || '—')}</div>
  </div>
  <div class="car-mi-hdr__seller">
    <img class="car-mi-hdr__logo" src="${escapeHtml(filterBrandIcon)}" alt="FILTER" />
    <div class="car-mi-hdr__seller-en">${escapeHtml(sellerEn)}</div>
    <div class="car-mi-hdr__seller-ar">${escapeHtml(sellerAr)}</div>
    <div class="car-mi-hdr__seller-meta">
      ${workshop ? `<div>${escapeHtml(workshop)}</div>` : ''}
      <div>Tax No.: ${escapeHtml(sellerTax)}</div>
    </div>
  </div>
</div>
<div class="car-mi-title-block">
  <div class="car-mi-title-en">Monthly Services &amp; Products Invoice</div>
  <div class="car-mi-title-ar">فاتورة الخدمات والمنتجات الشهرية</div>
</div>
<div class="car-mi-due">Due date: ${escapeHtml(dueDate)} · Amount due: SAR ${fmt(balanceDue)}</div>
${kpiHtml}
<table class="car-mi-table">
  <thead>
    <tr>
      <th style="width:12%"><span>Date</span><span class="th-ar">التاريخ</span></th>
      <th style="width:46%"><span>Description</span><span class="th-ar">الوصف</span></th>
      <th style="width:14%"><span>Excl VAT</span><span class="th-ar">قبل الضريبة</span></th>
      <th style="width:14%"><span>VAT 15%</span><span class="th-ar">ضريبة 15%</span></th>
      <th style="width:14%"><span>Incl VAT</span><span class="th-ar">شامل الضريبة</span></th>
    </tr>
  </thead>
  <tbody>
    ${rowsHtml}
    ${fillerHtml}
    <tr class="totals">
      <td colspan="2" style="text-align:left;font-weight:700">Total / الإجمالي</td>
      <td class="num">${fmt(totalExcl)}</td>
      <td class="num">${fmt(totalVat)}</td>
      <td class="num">${fmt(totalIncl)}</td>
    </tr>
  </tbody>
</table>
<div class="car-mi-footer">${qrBlock}</div>`;
}

/** Combined PDF: monthly invoice (ZATCA QR) + full AR statement details. */
export async function exportCorporateGeneratedBillPdf({
    bill,
    statement,
    ledgerStatement,
    fetchLedger,
}) {
    const stmt = statement ?? {};
    const ledger = await resolveLedgerForBillExport({
        bill,
        statement: stmt,
        ledgerStatement,
        fetchLedger,
    });
    const corp = stmt.corporateAccount ?? ledger?.corporateAccount ?? {};
    const dateFrom =
        bill?.periodStartDate?.slice?.(0, 10) ||
        stmt.period?.startDate?.slice?.(0, 10) ||
        '';
    const dateTo =
        bill?.periodEndDate?.slice?.(0, 10) ||
        stmt.period?.endDate?.slice?.(0, 10) ||
        '';

    const header = {
        companyName: corp.companyName,
        vatNumber: corp.vatNumber,
        workshopName: corp.workshopName,
        dateFrom,
        dateTo,
        generatedAt: bill?.createdAt
            ? new Date(bill.createdAt).toLocaleString()
            : new Date().toLocaleString(),
    };

    const summaryRows = buildMonthlySummarizedBillRows(ledger, stmt, bill);
    const totals = computeSummaryTotals(summaryRows, stmt, bill);
    const kpiSummary = buildBillKpiSummary(ledger, stmt, bill, totals);

    const qrDataUrl = await buildMonthlyInvoiceQrDataUrl({
        sellerName: resolveZatcaSellerName(corp, header),
        vatNumber: resolveZatcaSellerTaxId(corp, header),
        invoiceDate: bill?.createdAt || new Date().toISOString(),
        grandTotal: totals.balanceDue > 0 ? totals.balanceDue : totals.totalIncl,
        vatAmount: totals.totalVat,
    });

    const monthlyHtml = buildMonthlyInvoiceHtml({
        bill,
        statement: stmt,
        summaryRows,
        totals,
        kpiSummary,
        qrDataUrl,
    });

    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const layout = getPdfLayout(doc);

    try {
        const monthlyImg = await captureHtmlFragment(monthlyHtml, layout.contentW);
        addSinglePageImage(doc, monthlyImg, layout, false);

        const detailLines = ledger?.lines ?? [];
        if (detailLines.length > 0) {
            const summary = ledger.summary ?? buildBillKpiSummary(ledger, stmt, bill, totals);
            summary.openingBalance = Number(summary.openingBalance ?? 0);
            const pages = await packLinesIntoPages(
                detailLines,
                summary,
                header,
                layout,
                buildBillDetailPageHtml,
            );

            for (const chunk of pages) {
                const html = buildBillDetailPageHtml(header, summary, chunk);
                const img = await captureHtmlFragment(html, layout.contentW);
                addSinglePageImage(doc, img, layout, true);
            }
        }

        addPdfPageFooters(doc, layout);
    } catch (e) {
        console.error('[corporate generated bill PDF]', e);
        throw e;
    }

    const slug = safeSlug(bill?.billNo || 'bill');
    doc.save(`Corporate_Bill_${slug}.pdf`);
}

function productsExcelCell(row) {
    const en = row.productsServicesEn ?? row.productsServices ?? '';
    const ar = row.productsServicesAr ?? '';
    if (en && ar) return `${en}\n${ar}`;
    return en || ar;
}

export function exportCorporateArLedgerExcel({ header, summary, lines }) {
    const { english, arabic } = splitLatinAndArabic(header?.companyName);
    const sum = summary ?? {};
    const aoa = [
        ['Corporate AR Ledger Statement — كشف حساب'],
        [english || header?.companyName || ''],
        ...(arabic ? [[arabic]] : []),
        [`VAT No.: ${header?.vatNumber || '—'}`],
        [`Period: ${header?.dateFrom || '—'} to ${header?.dateTo || '—'}`],
        [`Generated: ${header?.generatedAt || new Date().toLocaleString()}`],
        [],
        ['Summary'],
        ['Opening Balance', Number(sum.openingBalance ?? 0)],
        ['Total Invoice Amount', Number(sum.totalInvoiceAmount ?? 0)],
        ['Total Receipts', Number(sum.totalReceipts ?? 0)],
        ['Total Discounts', Number(sum.totalDiscounts ?? 0)],
        ['Total Sales Returns', Number(sum.totalSalesReturns ?? 0)],
        ['Closing Balance', Number(sum.closingBalance ?? 0)],
        [],
        LEDGER_COLUMNS.map((c) => `${c.en} / ${c.ar}`),
        ['—', '—', '—', 'Opening balance / الرصيد الافتتاحي', '—', '', '', '', '', '', '', Number(sum.openingBalance ?? 0)],
        ...(lines ?? []).map((r) => [
            r.date,
            r.invoiceNo,
            r.vehicleNo,
            productsExcelCell(r),
            formatLedgerTypeShort(r.type),
            r.invoiceExclVat != null ? Number(r.invoiceExclVat) : '',
            r.vat15 != null ? Number(r.vat15) : '',
            r.salesDiscounts != null ? Number(r.salesDiscounts) : '',
            r.invoiceInclusiveVat != null ? Number(r.invoiceInclusiveVat) : '',
            r.salesReturns != null ? Number(r.salesReturns) : '',
            r.receipts != null ? Number(r.receipts) : '',
            Number(r.runningBalance ?? 0),
        ]),
        ['—', '—', '—', 'Closing balance / الرصيد الختامي', '—', '', '', '', '', '', '', Number(sum.closingBalance ?? 0)],
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [
        { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 40 }, { wch: 12 },
        { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 14 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Corporate AR');
    XLSX.writeFile(wb, `${buildFileBase({ header })}.xlsx`);
}
