import * as XLSX from 'xlsx';
import { splitBilingualName } from './bilingualName';

const FONT_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@600;700&family=Noto+Naskh+Arabic:wght@400;700&display=swap');
.wcorp-stmt-pdf, .wcorp-stmt-pdf * { font-family: "Noto Naskh Arabic", serif; box-sizing: border-box; }
.wcorp-stmt-pdf h1, .wcorp-stmt-pdf h2, .wcorp-stmt-pdf .heading { font-family: Cairo, sans-serif; font-weight: 700; }
`;

const PDF_CAPTURE_WIDTH = 1400;
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

function money(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return '0.00';
    return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function assertStatementExportReconciles(data) {
    const lines = Array.isArray(data?.lines) ? data.lines : [];
    const closing = Number(data?.statementClosing ?? data?.summary?.closingBalance ?? 0).toFixed(2);
    const listDue = Number(data?.listDueBalance ?? 0).toFixed(2);
    const last = lines.length ? Number(lines[lines.length - 1].running).toFixed(2) : closing;
    if (last !== closing) {
        throw new Error(`STATEMENT_RUNNING_MISMATCH: last running ${last} ≠ closing ${closing}`);
    }
    if (closing !== listDue) {
        throw new Error(`STATEMENT_CLOSE_MISMATCH: closing ${closing} ≠ list due ${listDue}`);
    }
}

function namesOf(data) {
    const corp = data?.corporate || {};
    if (corp.companyNameEn || corp.companyNameAr) {
        return { en: corp.companyNameEn || '', ar: corp.companyNameAr || '' };
    }
    return splitBilingualName(corp.companyName);
}

export function buildWorkshopStatementHtml(data) {
    const names = namesOf(data);
    const s = data?.summary || {};
    const lines = Array.isArray(data?.lines) ? data.lines : [];
    const rows = lines.map((line) => `<tr>
      <td>${escapeHtml(line.date)}</td>
      <td>${escapeHtml(line.type)}</td>
      <td>${escapeHtml(line.ref)}</td>
      <td>${escapeHtml(line.description)}</td>
      <td class="num">${money(line.debit)}</td>
      <td class="num">${money(line.credit)}</td>
      <td class="num">${money(line.running)}</td>
    </tr>`).join('');
    return `<!doctype html><html><head><meta charset="utf-8"/><style>
${FONT_CSS}
.wcorp-stmt-pdf { width:${PDF_CAPTURE_WIDTH}px; background:#fff; color:#0f172a; padding:18px 22px; }
.wcorp-stmt-pdf h1 { font-size:20px; margin:0 0 4px; }
.wcorp-stmt-pdf .ar { font-family:"Noto Naskh Arabic",serif; }
.wcorp-stmt-pdf .sub { color:#475569; font-size:12px; margin-bottom:8px; }
.wcorp-stmt-pdf .kpis { display:flex; flex-wrap:wrap; gap:12px; font-size:12px; margin:8px 0 12px; }
.wcorp-stmt-pdf table { width:100%; border-collapse:collapse; font-size:11px; }
.wcorp-stmt-pdf th { background:#0f2744; color:#fff; padding:6px 4px; font-family:Cairo,sans-serif; text-align:start; }
.wcorp-stmt-pdf td { border-bottom:1px solid #e2e8f0; padding:5px 4px; vertical-align:top; }
.wcorp-stmt-pdf .num { text-align:end; font-variant-numeric:tabular-nums; }
</style></head><body><div class="wcorp-stmt-pdf">
<h1 class="heading">Account statement / كشف الحساب</h1>
<div class="sub">${escapeHtml(names.en)}</div>
${names.ar ? `<div class="ar" dir="rtl">${escapeHtml(names.ar)}</div>` : ''}
<div class="sub">VAT ${escapeHtml(data?.corporate?.vatNumber || '—')} · ${escapeHtml(data?.dateFrom || '')} → ${escapeHtml(data?.dateTo || '')} · Asia/Riyadh</div>
<div class="kpis">
  <span>Opening ${money(s.openingBalance)}</span>
  <span>Invoices ${money(s.totalInvoiceAmount)}</span>
  <span>Receipts ${money(s.totalReceipts)}</span>
  <span>Returns ${money(s.totalSalesReturns)}</span>
  <span><strong>Closing ${money(data?.statementClosing ?? s.closingBalance)}</strong></span>
  <span>List due ${money(data?.listDueBalance)}</span>
</div>
<table><thead><tr>
  <th>Date / التاريخ</th><th>Type / النوع</th><th>Ref / المرجع</th><th>Description</th>
  <th>Debit / مدين</th><th>Credit / دائن</th><th>Running / الرصيد</th>
</tr></thead><tbody>${rows || `<tr><td colspan="7">No ledger lines in this range.</td></tr>`}</tbody></table>
</div></body></html>`;
}

export async function exportWorkshopCorporateStatementPdf(data) {
    assertStatementExportReconciles(data);
    const [{ toPng }, { jsPDF }] = await Promise.all([
        import('html-to-image'),
        import('jspdf'),
    ]);
    const mount = document.createElement('div');
    mount.style.position = 'fixed';
    mount.style.left = '-10000px';
    mount.style.top = '0';
    document.body.appendChild(mount);
    mount.innerHTML = buildWorkshopStatementHtml(data);
    try {
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const el = mount.querySelector('.wcorp-stmt-pdf');
        const img = await toPng(el, {
            backgroundColor: '#ffffff',
            pixelRatio: 2,
            cacheBust: true,
            width: PDF_CAPTURE_WIDTH,
            height: Math.max(el.scrollHeight, 1),
        });
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4', compress: true });
        const usableWpt = A4_LANDSCAPE.w - PDF_MARGIN_X_PT * 2;
        const im = await new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = reject;
            image.src = img;
        });
        const displayH = (im.naturalHeight / im.naturalWidth) * usableWpt;
        pdf.addImage(img, 'PNG', PDF_MARGIN_X_PT, PDF_MARGIN_Y_PT, usableWpt, displayH, undefined, 'FAST');
        const slug = String(data?.corporate?.companyNameEn || data?.corporate?.companyName || 'corporate').replace(/[^\w-]+/g, '_');
        pdf.save(`Corporate-Statement_${slug}_${data?.dateFrom || ''}_${data?.dateTo || ''}.pdf`);
    } finally {
        mount.remove();
    }
}

export function exportWorkshopCorporateStatementExcel(data) {
    assertStatementExportReconciles(data);
    const names = namesOf(data);
    const s = data?.summary || {};
    const aoa = [
        ['Account statement / كشف الحساب'],
        [names.en, names.ar],
        [`VAT ${data?.corporate?.vatNumber || ''}`],
        [`Range ${data?.dateFrom || ''} → ${data?.dateTo || ''} (Asia/Riyadh)`],
        [
            `Opening ${money(s.openingBalance)}`,
            `Invoices ${money(s.totalInvoiceAmount)}`,
            `Receipts ${money(s.totalReceipts)}`,
            `Returns ${money(s.totalSalesReturns)}`,
            `Closing ${money(data?.statementClosing ?? s.closingBalance)}`,
            `List due ${money(data?.listDueBalance)}`,
        ],
        [],
        ['Date', 'Type', 'Ref', 'Description', 'Debit', 'Credit', 'Running'],
    ];
    const lines = Array.isArray(data?.lines) ? data.lines : [];
    const first = aoa.length + 1;
    for (const line of lines) {
        aoa.push([
            line.date,
            line.type,
            line.ref,
            line.description,
            Number(line.debit || 0),
            Number(line.credit || 0),
            Number(line.running || 0),
        ]);
    }
    const last = Math.max(aoa.length, first);
    aoa.push([
        'Totals',
        '',
        '',
        '',
        { f: `SUM(E${first}:E${last})`, t: 'n' },
        { f: `SUM(F${first}:F${last})`, t: 'n' },
        Number(data?.statementClosing || 0),
    ]);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [15, 14, 16, 40, 12, 12, 12].map((wch) => ({ wch }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Statement');
    const slug = String(names.en || 'corporate').replace(/[^\w-]+/g, '_');
    XLSX.writeFile(wb, `Corporate-Statement_${slug}_${data?.dateFrom || ''}_${data?.dateTo || ''}.xlsx`);
}
