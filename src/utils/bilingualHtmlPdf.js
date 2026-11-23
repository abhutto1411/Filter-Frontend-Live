/**
 * Browser-captured bilingual PDF (Arabic + Latin).
 * jsPDF Helvetica/WinAnsi cannot render Arabic. Mixed EN/AR on one line plus
 * unicode-bidi:plaintext also produces symbol garbage in html-to-image.
 * Split scripts onto separate LTR / RTL spans and capture with system + Noto fonts.
 */

const FONT_LINK_ID = 'filter-bilingual-pdf-fonts';
const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+/g;
const LATIN_RE = /[A-Za-z0-9][A-Za-z0-9\s&.,'()\-/]+/g;

export function escapePdfHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

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

/** English and Arabic never share a line — html-to-image cannot rasterize mixed bidi reliably. */
export function bilingualHtml(value) {
    const raw = String(value ?? '');
    if (!raw.trim()) return '—';
    return raw
        .split(/\n/)
        .map((line) => {
            const { english, arabic } = splitLatinAndArabic(line);
            if (!english && !arabic) return '—';
            if (english && arabic) {
                return `<span class="td-en">${escapePdfHtml(english)}</span><span class="td-ar">${escapePdfHtml(arabic)}</span>`;
            }
            if (arabic) return `<span class="td-ar">${escapePdfHtml(arabic)}</span>`;
            return `<span class="td-en">${escapePdfHtml(english)}</span>`;
        })
        .join('<br/>');
}

export function pdfCellHtml(value) {
    return bilingualHtml(value);
}

export function bilingualHeaderCell(en, ar) {
    if (!ar) return `<span class="th-en">${escapePdfHtml(en)}</span>`;
    return `<span class="th-en">${escapePdfHtml(en)}</span><span class="th-ar">${escapePdfHtml(ar)}</span>`;
}

export const FILTER_SELLER_EN = 'Filter Car Services';
export const FILTER_SELLER_AR = 'فلتر لخدمات السيارات';
export const FILTER_STATEMENT_EN = 'Statement of Account';
export const FILTER_STATEMENT_AR = 'كشف حساب';

/** Opposite-side letterhead label: HQ books vs workshop books. */
export function statementScopeLabel(name) {
    const raw = String(name || '').trim();
    if (!raw) return '';
    if (/platform\s*hq|^hq$|headquarters/i.test(raw)) return 'Headquarters';
    return raw;
}

/** English on the first line, Arabic on the next — never side-by-side with |. */
export function stackedNameHtml(text, { enClass = 'title-en', arClass = 'title-ar', prefix = '' } = {}) {
    const { english, arabic } = splitLatinAndArabic(text);
    const en = english || (!arabic ? String(text || '').trim() : '');
    const prefixHtml = prefix ? escapePdfHtml(prefix) : '';
    const enLine = en
        ? `<div class="${enClass}">${prefixHtml}${escapePdfHtml(en)}</div>`
        : prefixHtml
            ? `<div class="${enClass}">${prefixHtml}</div>`
            : '';
    const arLine = arabic
        ? `<div class="${arClass}-wrap"><span class="${arClass}">${escapePdfHtml(arabic)}</span></div>`
        : '';
    return `${enLine}${arLine}` || '—';
}

export async function ensureBilingualPdfFonts() {
    if (typeof document === 'undefined') return;
    if (!document.getElementById(FONT_LINK_ID)) {
        const link = document.createElement('link');
        link.id = FONT_LINK_ID;
        link.rel = 'stylesheet';
        link.href =
            'https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;600;700&family=Noto+Sans:wght@400;700&display=swap';
        document.head.appendChild(link);
    }
    if (document.fonts?.load) {
        await Promise.all([
            document.fonts.load('400 12px "Noto Sans Arabic"'),
            document.fonts.load('600 12px "Noto Sans Arabic"'),
            document.fonts.load('700 12px "Noto Sans Arabic"'),
            document.fonts.load('400 12px "Segoe UI"'),
        ]).catch(() => {});
        await document.fonts.ready.catch(() => {});
    }
    await new Promise((r) => setTimeout(r, 160));
}

export const BILINGUAL_PDF_CSS = `
.stmt-pdf{
  box-sizing:border-box;
  width:100%;
  background:#fff;
  color:#1e293b;
  direction:ltr;
  font-family:"Segoe UI",Tahoma,Arial,sans-serif;
  padding:16px 18px 20px;
}
.stmt-pdf *,.stmt-pdf *::before,.stmt-pdf *::after{ box-sizing:border-box; }
.stmt-pdf .bar{ height:4px; background:#FCC247; margin:-16px -18px 12px; }
.stmt-pdf .hdr-top{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  padding-bottom:10px;
  border-bottom:2.5px solid #FCC247;
  margin-bottom:10px;
}
.stmt-pdf .hdr-brand-en{ font-size:18px; font-weight:700; color:#111827; letter-spacing:.02em; }
.stmt-pdf .hdr-brand-ar{
  font-family:"Noto Sans Arabic","Segoe UI",Tahoma,sans-serif;
  font-size:13px; font-weight:600; direction:rtl; unicode-bidi:isolate; color:#334155;
}
.stmt-pdf .title-row{ text-align:center; margin:0 0 8px; }
.stmt-pdf .title-en{ display:block; font-size:14px; font-weight:700; color:#111827; line-height:1.35; }
.stmt-pdf .hdr-letter{
  display:grid;
  grid-template-columns:minmax(0,1fr) minmax(180px,34%);
  column-gap:20px;
  align-items:start;
  direction:ltr;
  padding-bottom:10px;
  border-bottom:2.5px solid #FCC247;
  margin-bottom:10px;
}
.stmt-pdf .hdr-party{ min-width:0; direction:ltr; text-align:left; }
.stmt-pdf .stmt-title-en{ font-size:15px; font-weight:800; color:#111827; text-align:left; }
.stmt-pdf .stmt-title-ar-wrap,
.stmt-pdf .party-ar-wrap,
.stmt-pdf .meta-ar-wrap,
.stmt-pdf .title-ar-wrap{
  display:block;
  direction:ltr;
  text-align:left;
  width:100%;
}
.stmt-pdf .stmt-title-ar,
.stmt-pdf .party-ar,
.stmt-pdf .meta-ar,
.stmt-pdf .title-ar{
  display:inline-block;
  font-family:"Noto Sans Arabic","Segoe UI",Tahoma,sans-serif;
  direction:rtl;
  unicode-bidi:isolate;
  text-align:right;
  max-width:100%;
}
.stmt-pdf .stmt-title-ar{ font-size:13px; font-weight:700; color:#334155; margin-top:2px; }
.stmt-pdf .title-ar{ font-size:13px; font-weight:700; color:#475569; margin-top:2px; line-height:1.4; }
.stmt-pdf .party-en{ font-size:12px; font-weight:700; color:#0f172a; margin-top:8px; line-height:1.35; text-align:left; direction:ltr; }
.stmt-pdf .party-ar{ font-size:12px; font-weight:700; color:#1e293b; margin-top:2px; line-height:1.4; }
.stmt-pdf .meta-en{ display:block; direction:ltr; text-align:left; }
.stmt-pdf .meta-ar{ font-size:10px; font-weight:600; color:#334155; }
.stmt-pdf .hdr-scope{ min-width:0; direction:ltr; text-align:right; justify-self:end; }
.stmt-pdf .brand-word{ font-size:22px; font-weight:900; color:#ea580c; letter-spacing:.08em; line-height:1; }
.stmt-pdf .seller-en{ font-size:11px; font-weight:700; color:#111827; margin-top:6px; }
.stmt-pdf .seller-ar-wrap{ display:block; direction:ltr; text-align:right; width:100%; }
.stmt-pdf .seller-ar{
  display:inline-block;
  font-family:"Noto Sans Arabic","Segoe UI",Tahoma,sans-serif;
  font-size:11px; font-weight:600; direction:rtl; unicode-bidi:isolate; color:#334155;
  margin-top:1px; text-align:right; max-width:100%;
}
.stmt-pdf .scope-name{ font-size:13px; font-weight:800; color:#0f172a; margin-top:8px; }
.stmt-pdf .seller-vat{ font-size:9px; color:#64748b; margin-top:4px; }
.stmt-pdf .meta{ font-size:10px; color:#475569; line-height:1.45; margin:0 0 10px; direction:ltr; text-align:left; }
.stmt-pdf .kpis{ width:100%; border-collapse:collapse; margin:0 0 12px; }
.stmt-pdf .kpis th{
  background:#fef3c7; color:#78350f; font-size:10px; font-weight:700;
  padding:7px 6px; text-align:center; border:1px solid #fde68a;
}
.stmt-pdf .kpis td{
  background:#fffbeb; color:#111827; font-size:12px; font-weight:700;
  padding:7px 6px; text-align:center; border:1px solid #fde68a;
}
.stmt-pdf table.grid{ width:100%; border-collapse:collapse; table-layout:fixed; }
.stmt-pdf table.grid th{
  background:#f1f5f9; color:#1e293b; font-size:9px; font-weight:700;
  text-align:center; padding:6px 4px; border:1px solid #cbd5e1; vertical-align:middle;
}
.stmt-pdf table.grid td{
  font-size:9px; padding:5px 4px; border:1px solid #e2e8f0;
  vertical-align:top; word-wrap:break-word; overflow-wrap:anywhere;
}
.stmt-pdf table.grid td.num,.stmt-pdf table.grid th.num{ text-align:right; white-space:nowrap; font-variant-numeric:tabular-nums; }
.stmt-pdf table.grid td.in{ color:#059669; font-weight:700; }
.stmt-pdf table.grid td.out{ color:#dc2626; font-weight:700; }
.stmt-pdf tr.open td{ background:#f8fafc; font-weight:700; }
.stmt-pdf tr.close td{ background:#fff7ed; font-weight:700; }
.stmt-pdf .foot{ margin-top:10px; font-size:8px; color:#94a3b8; text-align:center; }
.stmt-pdf .th-en,.stmt-pdf .td-en{ display:block; line-height:1.25; }
.stmt-pdf .th-ar,.stmt-pdf .td-ar{
  display:block;
  font-family:"Noto Sans Arabic","Segoe UI",Tahoma,sans-serif;
  direction:rtl;
  unicode-bidi:isolate;
  text-align:right;
  line-height:1.3;
  color:#334155;
  margin-top:1px;
}
.stmt-pdf .th-ar{ color:#64748b; font-weight:600; }
`;

function pageWidthPx(orientation) {
    return orientation === 'portrait' ? 794 : 1122;
}

async function waitForMountedImages(root) {
    const imgs = Array.from(root.querySelectorAll('img'));
    if (!imgs.length) return;
    await Promise.all(
        imgs.map(
            (img) =>
                img.complete
                    ? Promise.resolve()
                    : new Promise((resolve) => {
                          img.onload = resolve;
                          img.onerror = resolve;
                      }),
        ),
    );
}

export async function exportHtmlPagesToPdf({
    fileName,
    orientation = 'landscape',
    pages = [],
}) {
    if (!pages.length) throw new Error('Nothing to export.');
    await ensureBilingualPdfFonts();
    const [{ toPng }, { jsPDF }] = await Promise.all([
        import('html-to-image'),
        import('jspdf'),
    ]);

    const pdf = new jsPDF({
        orientation,
        unit: 'pt',
        format: 'a4',
        compress: true,
    });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 24;
    const contentW = pageW - margin * 2;
    const contentH = pageH - margin * 2 - 14;
    const captureW = pageWidthPx(orientation);

    const mount = document.createElement('div');
    mount.setAttribute('aria-hidden', 'true');
    mount.style.cssText = [
        'position:fixed',
        'left:-16000px',
        'top:0',
        `width:${captureW}px`,
        'background:#fff',
        'pointer-events:none',
        'z-index:-1',
    ].join(';');
    document.body.appendChild(mount);

    try {
        for (let i = 0; i < pages.length; i += 1) {
            mount.innerHTML = pages[i];
            const el = mount.querySelector('.stmt-pdf');
            if (!el) throw new Error('Could not render PDF page.');
            await waitForMountedImages(el);
            await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
            const captureHeight = Math.max(el.scrollHeight, el.offsetHeight, 1);
            const imgData = await toPng(el, {
                backgroundColor: '#ffffff',
                pixelRatio: 2,
                cacheBust: true,
                width: captureW,
                height: captureHeight,
                style: {
                    width: `${captureW}px`,
                    height: `${captureHeight}px`,
                    backgroundColor: '#ffffff',
                    fontFamily: '"Segoe UI", Tahoma, Arial, sans-serif',
                },
            });
            const dims = await new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
                img.onerror = () => reject(new Error('Invalid PDF page image.'));
                img.src = imgData;
            });
            let drawW = contentW;
            let drawH = (dims.h / dims.w) * drawW;
            if (drawH > contentH) {
                const scale = contentH / drawH;
                drawW *= scale;
                drawH *= scale;
            }
            if (i > 0) pdf.addPage('a4', orientation);
            pdf.addImage(imgData, 'PNG', margin, margin, drawW, drawH, undefined, 'FAST');
        }
        const total = pdf.internal.getNumberOfPages();
        for (let i = 1; i <= total; i += 1) {
            pdf.setPage(i);
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(8);
            pdf.setTextColor(148, 163, 184);
            pdf.text(`Page ${i} of ${total}`, pageW / 2, pageH - 12, { align: 'center' });
        }
        pdf.save(fileName);
    } finally {
        mount.remove();
    }
}

export function chunkRows(rows, size) {
    const list = Array.isArray(rows) ? rows : [];
    if (list.length === 0) return [[]];
    const out = [];
    for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
    return out;
}

export function wrapStmtPage(inner) {
    return `<div class="stmt-pdf"><style>${BILINGUAL_PDF_CSS}</style><div class="bar"></div>${inner}</div>`;
}

export function buildGenericLedgerPdfPages({
    brand = 'FILTER ERP',
    title = 'Account Ledger Statement',
    metaHtml = '',
    kpiHead = [],
    kpiBody = [],
    columns = [],
    dataRows = [],
    openingCells = null,
    closingCells = null,
    rowsPerPage = 16,
    generated = '',
    letterhead = false,
    scopeName = '',
    sellerName = FILTER_SELLER_EN,
    sellerNameAr = FILTER_SELLER_AR,
    sellerVat = '',
    statementTitleEn = FILTER_STATEMENT_EN,
    statementTitleAr = FILTER_STATEMENT_AR,
}) {
    const brandParts = splitLatinAndArabic(brand);
    const chunks = chunkRows(dataRows, rowsPerPage);
    return chunks.map((chunk, pageIdx) => {
        const isFirst = pageIdx === 0;
        const isLast = pageIdx === chunks.length - 1;
        const kpi =
            isFirst && kpiHead.length
                ? `<table class="kpis"><thead><tr>${kpiHead.map((h) => `<th>${bilingualHtml(h)}</th>`).join('')}</tr></thead>
                   <tbody><tr>${kpiBody.map((v) => `<td>${escapePdfHtml(v)}</td>`).join('')}</tr></tbody></table>`
                : '';
        const th = columns
            .map((c) => `<th class="${c.num ? 'num' : ''}">${bilingualHeaderCell(c.label, c.labelAr)}</th>`)
            .join('');
        const renderCells = (cells, rowClass) =>
            `<tr class="${rowClass || ''}">${(cells || [])
                .map((c, i) => {
                    const num = columns[i]?.num;
                    const cls = [num ? 'num' : '', c.className || ''].filter(Boolean).join(' ');
                    return `<td class="${cls}">${c.html ?? pdfCellHtml(c.text)}</td>`;
                })
                .join('')}</tr>`;
        const opening = isFirst && openingCells ? renderCells(openingCells, 'open') : '';
        const closing = isLast && closingCells ? renderCells(closingCells, 'close') : '';
        const body = chunk.map((cells) => renderCells(cells, '')).join('');
        const headerHtml = letterhead
            ? `<div class="hdr-letter">
              <div class="hdr-party">
                <div class="stmt-title-en">${escapePdfHtml(statementTitleEn)}</div>
                <div class="stmt-title-ar-wrap"><span class="stmt-title-ar">${escapePdfHtml(statementTitleAr)}</span></div>
                ${stackedNameHtml(title, { enClass: 'party-en', arClass: 'party-ar' })}
              </div>
              <div class="hdr-scope">
                <div class="brand-word">${escapePdfHtml(brandParts.english || 'FILTER')}</div>
                <div class="seller-en">${escapePdfHtml(sellerName || FILTER_SELLER_EN)}</div>
                <div class="seller-ar-wrap"><span class="seller-ar">${escapePdfHtml(sellerNameAr || FILTER_SELLER_AR)}</span></div>
                ${scopeName ? `<div class="scope-name">${escapePdfHtml(statementScopeLabel(scopeName) || scopeName)}</div>` : ''}
                ${sellerVat ? `<div class="seller-vat">VAT ${escapePdfHtml(sellerVat)}</div>` : ''}
              </div>
            </div>`
            : `<div class="hdr-top">
              <div class="hdr-brand-en">${escapePdfHtml(brandParts.english || 'FILTER ERP')}</div>
              <div class="hdr-brand-ar">${escapePdfHtml(brandParts.arabic || FILTER_SELLER_AR)}</div>
            </div>
            <div class="title-row">
              ${stackedNameHtml(title)}
            </div>`;
        const inner = `
            ${headerHtml}
            <div class="meta">${metaHtml}${chunks.length > 1 ? `<br/>Page ${pageIdx + 1} of ${chunks.length}` : ''}</div>
            ${kpi}
            <table class="grid"><thead><tr>${th}</tr></thead><tbody>${opening}${body}${closing}</tbody></table>
            <div class="foot">${escapePdfHtml(generated)}</div>
        `;
        return wrapStmtPage(inner);
    });
}
