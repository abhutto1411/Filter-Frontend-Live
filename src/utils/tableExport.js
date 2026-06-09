import * as XLSX from 'xlsx';

/**
 * Generic table → PDF / Excel export helpers, shared across the admin Sales
 * tabs (and reusable anywhere). Data-agnostic: callers pass `headers` + `rows`
 * (array-of-arrays) that mirror their on-screen table.
 *
 * PDF note: we render through the BROWSER's print engine (a hidden iframe),
 * not a JS PDF library. The data is bilingual (English + Arabic) and JS PDF
 * libraries can't shape/RTL Arabic — they produce mojibake. The browser has
 * full Unicode fonts + Arabic shaping + bidi, so "Save as PDF" from the print
 * dialog yields a correct document. Excel (xlsx) stores UTF-8, so Arabic is
 * already correct there.
 */

function safeFileSlug(s) {
    const t = String(s || 'export')
        .replace(/[^\w.-]+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 80);
    return t || 'export';
}

function stamp() {
    return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
}

function escapeHtml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * Render an array-of-arrays table to a print-ready document and open the
 * browser's print dialog (→ "Save as PDF"). Rendered by the browser so Arabic
 * + English + RTL all display correctly.
 *
 * Uses a hidden iframe (not window.open) so it works after an async fetch
 * without tripping pop-up blockers.
 *
 * @param {object}   opts
 * @param {string}   opts.title
 * @param {string}  [opts.subtitle]
 * @param {string[]} opts.headers
 * @param {Array<Array<string|number|null|undefined>>} opts.rows
 * @param {string}   opts.filenameBase – becomes the document title (default PDF name).
 */
export function exportRowsToPdf({ title, subtitle, headers, rows, filenameBase }) {
    const docTitle = `${safeFileSlug(filenameBase)}-${stamp()}`;
    const thead = `<tr>${(headers || []).map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr>`;
    const tbody = (rows || [])
        .map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`)
        .join('');

    const html = `<!DOCTYPE html>
<html dir="auto"><head><meta charset="utf-8"><title>${escapeHtml(docTitle)}</title>
<style>
  body { font-family: 'Segoe UI', Tahoma, 'Arial', sans-serif; margin: 18px; color: #0f172a; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .sub { font-size: 12px; color: #64748b; margin: 0 0 14px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: start; vertical-align: top; }
  th { background: #f8fafc; font-weight: 700; text-transform: uppercase; font-size: 10px; }
  tr:nth-child(even) td { background: #fafafa; }
  @media print { @page { size: landscape; margin: 12mm; } }
</style></head>
<body>
  <h1>${escapeHtml(title || 'Export')}</h1>
  ${subtitle ? `<p class="sub">${escapeHtml(subtitle)}</p>` : ''}
  <table><thead>${thead}</thead><tbody>${tbody}</tbody></table>
</body></html>`;

    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(iframe);

    const cleanup = () => {
        try { document.body.removeChild(iframe); } catch { /* already gone */ }
    };

    const doc = iframe.contentWindow?.document;
    if (!doc) { cleanup(); return; }
    doc.open();
    doc.write(html);
    doc.close();

    // Give the browser a tick to lay out fonts before printing.
    setTimeout(() => {
        try {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
        } catch { /* noop */ }
        // Remove after the print dialog has had time to grab the document.
        setTimeout(cleanup, 1500);
    }, 350);
}

/**
 * Download an array-of-arrays table as a single-sheet .xlsx.
 *
 * @param {object}   opts
 * @param {string}  [opts.sheetName]
 * @param {string[]} opts.headers
 * @param {Array<Array<string|number|null|undefined>>} opts.rows
 * @param {string}   opts.filenameBase
 */
export function exportRowsToExcel({ sheetName = 'Sheet1', headers, rows, filenameBase }) {
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    // Excel sheet names cap at 31 chars and forbid a few characters.
    const safeSheet = String(sheetName || 'Sheet1').replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Sheet1';
    XLSX.utils.book_append_sheet(wb, ws, safeSheet);
    XLSX.writeFile(wb, `${safeFileSlug(filenameBase)}-${stamp()}.xlsx`);
}
