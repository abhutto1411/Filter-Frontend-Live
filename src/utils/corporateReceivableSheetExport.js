import * as XLSX from 'xlsx';

/** Cairo headings + Noto Naskh Arabic body (same family as salary-sheet / AR ledger). */
export const RECEIVABLE_SHEET_FONT_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@600;700&family=Noto+Naskh+Arabic:wght@400;700&display=swap');
.receivable-sheet-pdf, .receivable-sheet-pdf * {
  font-family: "Noto Naskh Arabic", "Noto Naskh Arabic", serif;
  box-sizing: border-box;
}
.receivable-sheet-pdf h1, .receivable-sheet-pdf h2, .receivable-sheet-pdf .heading {
  font-family: Cairo, "Cairo", sans-serif;
  font-weight: 700;
}
`;

const PDF_CAPTURE_WIDTH = 1700;
const A4_LANDSCAPE = { w: 841.89, h: 595.28 };
const PDF_MARGIN_X_PT = (1 / 2.54) * 72;
const PDF_MARGIN_Y_PT = (1.5 / 2.54) * 72;

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function moneyCents(n) {
  const s = String(n ?? '').trim().replace(/,/g, '');
  if (!s) return 0;
  const neg = s.startsWith('-');
  const body = neg ? s.slice(1) : s;
  if (!/^\d+(\.\d+)?$/.test(body)) {
    const v = Number(n);
    if (!Number.isFinite(v)) return 0;
    return Math.round(v * 100);
  }
  const [whole, frac = ''] = body.split('.');
  let cents = Number(whole) * 100 + Number((frac + '00').slice(0, 2));
  if (frac[2] && Number(frac[2]) >= 5) cents += 1;
  return neg ? -cents : cents;
}

/** Display string. Totals use sumReceivableMoney, not a JS float add. */
export function fmtReceivableMoney(n) {
  const cents = moneyCents(n);
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const text = `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
  const [w, f] = text.replace('-', '').split('.');
  const grouped = w.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}${grouped}.${f}`;
}

export function sumReceivableMoney(values) {
  const cents = (values || []).reduce((s, v) => s + moneyCents(v), 0);
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

function safeFileSlug(s) {
  const t = String(s || 'export')
    .replace(/[^\w.-]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80);
  return t || 'export';
}

function riyadhStamp(iso) {
  try {
    return new Date(iso || Date.now()).toLocaleString('en-GB', { timeZone: 'Asia/Riyadh' });
  } catch {
    return String(iso || '');
  }
}

const COLS = [
  ['Company', 'الشركة'],
  ['VAT', 'الرقم الضريبي'],
  ['Contact', 'جهة الاتصال'],
  ['Mobile', 'الجوال'],
  ['Status', 'الحالة'],
  ['Credit limit', 'حد الائتمان'],
  ['Opening', 'افتتاحي'],
  ['Credit sales', 'مبيعات آجلة'],
  ['Collections', 'تحصيلات'],
  ['Returns', 'مرتجعات'],
  ['Closing / Due', 'الختامي / المستحق'],
  ['GL 1110 child', 'حساب 1110 الفرعي'],
  ['Over-limit', 'تجاوز الحد'],
];

export function receivableSheetFileBase(sheet) {
  const ws = safeFileSlug(sheet?.workshopName || 'Workshop');
  const from = sheet?.dateFrom || 'from';
  const to = sheet?.dateTo || 'to';
  return `Corporate-Receivable_${ws}_${from}_${to}`;
}

export function receivableSheetPageCss() {
  return `${RECEIVABLE_SHEET_FONT_CSS}
.receivable-sheet-pdf { width: ${PDF_CAPTURE_WIDTH}px; background:#fff; color:#0f172a; padding:18px 22px 12px; }
.receivable-sheet-pdf h1 { font-size:20px; margin:0 0 4px; color:#0f172a; }
.receivable-sheet-pdf .sub { color:#475569; font-size:12px; margin-bottom:8px; }
.receivable-sheet-pdf .meta { display:flex; justify-content:space-between; gap:16px; font-size:12px; margin-bottom:10px; }
.receivable-sheet-pdf table { width:100%; border-collapse:collapse; font-size:11px; }
.receivable-sheet-pdf th { background:#0f2744; color:#fff; padding:6px 4px; font-family:Cairo,sans-serif; font-weight:700; text-align:start; }
.receivable-sheet-pdf td { border-bottom:1px solid #e2e8f0; padding:5px 4px; vertical-align:top; }
.receivable-sheet-pdf tr.tot-row td { font-weight:800; background:#f8fafc; }
.receivable-sheet-pdf .num { text-align:end; font-variant-numeric:tabular-nums; }
.receivable-sheet-pdf .pagefoot { display:flex; justify-content:space-between; font-size:10px; color:#64748b; margin-top:8px; }
.receivable-sheet-pdf .ar { font-family:"Noto Naskh Arabic",serif; }
.receivable-sheet-pdf .note { font-size:11px; color:#334155; margin-top:8px; }
`;
}

export function buildReceivableSheetHtml(sheet, { pageIndex = 0, totalPages = 1 } = {}) {
  const css = receivableSheetPageCss();
  const title = 'Corporate receivable list / قائمة مستحقات الشركات';
  const head = COLS.map(
    ([en, ar]) => `<th>${escapeHtml(en)}<br/><span class="ar" dir="rtl">${escapeHtml(ar)}</span></th>`,
  ).join('');
  const rows = sheet.rows || [];
  let body = '';
  for (const r of rows) {
    body += `<tr>
      <td>${escapeHtml(r.companyName)}<div class="ar" dir="rtl">${escapeHtml(r.companyNameAr || '')}</div></td>
      <td>${escapeHtml(r.vatNumber || '')}</td>
      <td>${escapeHtml(r.contactPerson || '')}</td>
      <td>${escapeHtml(r.mobile || '')}</td>
      <td>${escapeHtml(r.status || '')}</td>
      <td class="num">${fmtReceivableMoney(r.creditLimit)}</td>
      <td class="num">${fmtReceivableMoney(r.opening)}</td>
      <td class="num">${fmtReceivableMoney(r.periodSales)}</td>
      <td class="num">${fmtReceivableMoney(r.periodCollections)}</td>
      <td class="num">${fmtReceivableMoney(r.periodReturns)}</td>
      <td class="num">${fmtReceivableMoney(r.dueBalance)}</td>
      <td class="num">${fmtReceivableMoney(r.glBalance)}</td>
      <td>${r.overLimit ? 'Yes / نعم' : ''}</td>
    </tr>`;
  }
  const k = sheet.kpis || {};
  body += `<tr class="tot-row">
    <td colspan="5">Totals / الإجمالي · ${rows.length}</td>
    <td class="num">${fmtReceivableMoney(sumReceivableMoney(rows.map((r) => r.creditLimit)))}</td>
    <td class="num">${fmtReceivableMoney(sumReceivableMoney(rows.map((r) => r.opening)))}</td>
    <td class="num">${fmtReceivableMoney(k.creditSales)}</td>
    <td class="num">${fmtReceivableMoney(k.collections)}</td>
    <td class="num">${fmtReceivableMoney(sumReceivableMoney(rows.map((r) => r.periodReturns)))}</td>
    <td class="num">${fmtReceivableMoney(k.totalReceivable)}</td>
    <td class="num">${fmtReceivableMoney(k.glChildSum)}</td>
    <td></td>
  </tr>`;
  const notes = sheet.glNotes || {};
  return `<div class="receivable-sheet-pdf" dir="ltr">
    <style>${css}</style>
    <h1 class="heading">${title}</h1>
    <div class="sub">Live statement due (not cached due_balance). HQ assignment means statement total is not forced equal to 1110-child sum.</div>
    <div class="meta">
      <div>
        <div><strong>Workshop / الورشة:</strong> ${escapeHtml(sheet.workshopName || '')}</div>
        <div><strong>Branch / الفرع:</strong> ${escapeHtml(sheet.branchName || 'All branches / جميع الفروع')}</div>
        <div><strong>Range / الفترة:</strong> ${escapeHtml(sheet.dateFrom || '')} → ${escapeHtml(sheet.dateTo || '')}</div>
        <div><strong>Records / السجلات:</strong> ${sheet.records ?? rows.length}</div>
        <div><strong>Generated / تاريخ الإنشاء:</strong> ${escapeHtml(riyadhStamp(sheet.generatedAt))} (Asia/Riyadh UTC+3)</div>
      </div>
      <div>
        <strong>Total receivable (SAR) / إجمالي المستحق</strong>
        <div style="font-size:20px;font-family:Cairo,sans-serif">${fmtReceivableMoney(k.totalReceivable)}</div>
        <div>1110 child sum: ${fmtReceivableMoney(k.glChildSum)}</div>
        <div>Billed awaiting collection: ${fmtReceivableMoney(k.billedAwaitingCollection)}</div>
      </div>
    </div>
    <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
    <div class="note ar" dir="rtl">
      تسريب ترويسة 1110: ${fmtReceivableMoney(notes.headingLeakage || k.glHeadingLeakage)} ·
      1110-VAR مستبعد: ${fmtReceivableMoney(notes.varExcluded || k.glVarExcluded)} ·
      1100 ذمم تجارية مستبعدة: ${fmtReceivableMoney(notes.tradeAr1100Excluded || k.tradeAr1100Excluded)}
    </div>
    <div class="note">${escapeHtml(notes.note || '')}</div>
    <div class="pagefoot">
      <span>Amounts in SAR · official Riyal · page totals = this page / المبالغ بالريال</span>
      <span>Page ${pageIndex + 1} of ${totalPages} / صفحة ${pageIndex + 1} من ${totalPages}</span>
    </div>
  </div>`;
}

async function ensureSheetFonts() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('filter-receivable-sheet-fonts')) return;
  const link = document.createElement('link');
  link.id = 'filter-receivable-sheet-fonts';
  link.rel = 'stylesheet';
  link.href =
    'https://fonts.googleapis.com/css2?family=Cairo:wght@600;700&family=Noto+Naskh+Arabic:wght@400;700&display=swap';
  document.head.appendChild(link);
  await new Promise((r) => setTimeout(r, 80));
}

async function htmlToPdf(pagesHtml, filename) {
  await ensureSheetFonts();
  const mount = document.createElement('div');
  mount.setAttribute('aria-hidden', 'true');
  mount.style.cssText = `position:fixed;left:-12000px;top:0;width:${PDF_CAPTURE_WIDTH}px;background:#fff;pointer-events:none;z-index:-1`;
  document.body.appendChild(mount);
  try {
    const [{ toPng }, { jsPDF }] = await Promise.all([
      import('html-to-image'),
      import('jspdf'),
    ]);
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4', compress: true });
    const usableWpt = A4_LANDSCAPE.w - PDF_MARGIN_X_PT * 2;
    for (let i = 0; i < pagesHtml.length; i += 1) {
      mount.innerHTML = pagesHtml[i];
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const el = mount.querySelector('.receivable-sheet-pdf');
      const img = await toPng(el, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        cacheBust: true,
        width: PDF_CAPTURE_WIDTH,
        height: Math.max(el.scrollHeight, 1),
      });
      const im = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = img;
      });
      const displayH = (im.naturalHeight / im.naturalWidth) * usableWpt;
      if (i > 0) pdf.addPage('a4', 'landscape');
      pdf.addImage(img, 'PNG', PDF_MARGIN_X_PT, PDF_MARGIN_Y_PT, usableWpt, displayH, undefined, 'FAST');
    }
    pdf.save(filename);
  } finally {
    mount.remove();
  }
}

export async function exportCorporateReceivablePdf(sheet) {
  const pages = [buildReceivableSheetHtml(sheet, { pageIndex: 0, totalPages: 1 })];
  await htmlToPdf(pages, `${receivableSheetFileBase(sheet)}.pdf`);
}

export function buildReceivableSheetWorkbook(sheet) {
  const header = COLS.map(([en, ar]) => `${en} / ${ar}`);
  const aoa = [
    ['Corporate receivable list / قائمة مستحقات الشركات'],
    [`Workshop / الورشة: ${sheet.workshopName || ''}`],
    [`Branch / الفرع: ${sheet.branchName || 'All branches'}`],
    [`Range / الفترة: ${sheet.dateFrom || ''} → ${sheet.dateTo || ''}`],
    [`Generated (Asia/Riyadh UTC+3): ${riyadhStamp(sheet.generatedAt)}`],
    [`Total receivable (SAR): ${fmtReceivableMoney(sheet.kpis?.totalReceivable)} · 1110 child: ${fmtReceivableMoney(sheet.kpis?.glChildSum)} · HQ assignment means these are not forced equal`],
    [],
    header,
  ];
  const rows = sheet.rows || [];
  const firstData = aoa.length + 1;
  for (const r of rows) {
    aoa.push([
      r.companyName,
      r.vatNumber || '',
      r.contactPerson || '',
      r.mobile || '',
      r.status || '',
      Number(r.creditLimit || 0),
      Number(r.opening || 0),
      Number(r.periodSales || 0),
      Number(r.periodCollections || 0),
      Number(r.periodReturns || 0),
      Number(r.dueBalance || 0),
      Number(r.glBalance || 0),
      r.overLimit ? 'Yes' : '',
    ]);
  }
  const lastData = aoa.length;
  const start = firstData;
  const end = Math.max(lastData, start);
  aoa.push([
    'Totals / الإجمالي',
    '',
    '',
    '',
    '',
    { f: `SUM(F${start}:F${end})`, t: 'n' },
    { f: `SUM(G${start}:G${end})`, t: 'n' },
    { f: `SUM(H${start}:H${end})`, t: 'n' },
    { f: `SUM(I${start}:I${end})`, t: 'n' },
    { f: `SUM(J${start}:J${end})`, t: 'n' },
    { f: `SUM(K${start}:K${end})`, t: 'n' },
    { f: `SUM(L${start}:L${end})`, t: 'n' },
    '',
  ]);
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!freeze'] = { xSplit: 0, ySplit: 8 };
  ws['!views'] = [{ state: 'frozen', ySplit: 8 }];
  const numFmt = '#,##0.00';
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let r = 8; r <= range.e.r; r += 1) {
    for (let c = 5; c <= 11; c += 1) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (ws[addr]) ws[addr].z = numFmt;
    }
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Receivable');
  const summary = XLSX.utils.aoa_to_sheet([
    ['Metric / البند', 'SAR'],
    ['Total receivable / إجمالي المستحق', Number(sheet.kpis?.totalReceivable || 0)],
    ['Workshop 1110 sub-ledger / دفتر 1110', Number(sheet.kpis?.glChildSum || 0)],
    ['Billed awaiting collection / مفوتر بانتظار التحصيل', Number(sheet.kpis?.billedAwaitingCollection || 0)],
    ['1110 heading leakage / تسريب الترويسة', Number(sheet.kpis?.glHeadingLeakage || 0)],
    ['1110-VAR excluded', Number(sheet.kpis?.glVarExcluded || 0)],
    ['1100 trade AR excluded', Number(sheet.kpis?.tradeAr1100Excluded || 0)],
    ['Note', String(sheet.glNotes?.note || '')],
  ]);
  summary['B2'].z = numFmt;
  summary['B3'].z = numFmt;
  summary['B4'].z = numFmt;
  summary['B5'].z = numFmt;
  summary['B6'].z = numFmt;
  summary['B7'].z = numFmt;
  XLSX.utils.book_append_sheet(wb, summary, 'Summary');
  return wb;
}

export function exportCorporateReceivableExcel(sheet) {
  const wb = buildReceivableSheetWorkbook(sheet);
  XLSX.writeFile(wb, `${receivableSheetFileBase(sheet)}.xlsx`);
}
