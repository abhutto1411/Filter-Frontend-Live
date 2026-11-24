/**
 * SP-06 — Supplier Profit & Loss export (PDF + Excel), with the comparative column.
 * Same pipeline as the six-column trial balance export (bilingual HTML → PDF,
 * SAMA Riyal SVG; Excel via `exportRowsToExcel` with the U+20C1 Riyal sign).
 */
import {
    bilingualHeaderCell,
    escapePdfHtml,
    exportHtmlPagesToPdf,
    pdfCellHtml,
    wrapStmtPage,
} from './bilingualHtmlPdf';
import { exportRowsToExcel } from './tableExport';
import { fmt2, riyalSvg } from './supplierTrialBalanceExport';

const RIYAL_SIGN = '⃁';

/** Flatten the P&L payload into ordered printable rows. */
function plRows(data) {
    const hasCmp = Boolean(data?.compare);
    const t = data?.totals || {};
    const c = data?.compare?.totals || {};
    const v = data?.variance || {};
    const line = (l) => ({
        kind: 'line',
        code: l.code,
        name: l.name,
        amount: l.amount,
        compare: hasCmp ? l.compareAmount : null,
        variance: hasCmp ? l.variance : null,
    });
    const total = (en, ar, key) => ({
        kind: 'total',
        code: '',
        name: `${en} / ${ar}`,
        amount: t[key],
        compare: hasCmp ? c[key] : null,
        variance: hasCmp ? v[key] : null,
    });
    const head = (en, ar) => ({ kind: 'head', name: `${en} / ${ar}` });
    return [
        head('Sales', 'المبيعات'),
        ...(data?.sales || []).map(line),
        total('Total sales', 'إجمالي المبيعات', 'totalSales'),
        head('Cost of goods sold', 'تكلفة البضاعة المباعة'),
        ...(data?.costOfGoodsSold || []).map(line),
        total('Total COGS', 'إجمالي التكلفة', 'totalCOGS'),
        total('Gross profit', 'مجمل الربح', 'grossProfit'),
        ...((data?.otherIncome || []).length
            ? [
                  head('Other income', 'إيرادات أخرى'),
                  ...data.otherIncome.map(line),
                  total('Total other income', 'إجمالي الإيرادات الأخرى', 'totalOtherIncome'),
              ]
            : []),
        head('Operating expenses', 'المصروفات التشغيلية'),
        ...(data?.operatingExpenses || []).map(line),
        total('Total operating expenses', 'إجمالي المصروفات التشغيلية', 'totalOperatingExpenses'),
        total('Total income', 'إجمالي الإيرادات', 'totalIncome'),
        total('Total expenses', 'إجمالي المصروفات', 'totalExpense'),
        total('Net income', 'صافي الدخل', 'netIncome'),
    ];
}

function rangeText(from, to) {
    return `${from || '…'} – ${to || '…'} (Asia/Riyadh)`;
}

export async function exportSupplierProfitLossPdf({ data, supplierName = '' }) {
    const hasCmp = Boolean(data?.compare);
    const svg = await riyalSvg();
    const money = (val) =>
        val == null
            ? ''
            : `<span style="display:inline-flex;align-items:center;gap:3px;direction:ltr">${svg}<span>${escapePdfHtml(fmt2(val))}</span></span>`;
    const cols = hasCmp ? 5 : 3;
    const head = `<tr>
        <th style="width:9%">${bilingualHeaderCell('Code', 'الرمز')}</th>
        <th>${bilingualHeaderCell('Account', 'الحساب')}</th>
        <th class="num">${bilingualHeaderCell('This period', 'هذه الفترة')}</th>
        ${hasCmp ? `<th class="num">${bilingualHeaderCell('Compare', 'المقارنة')}</th><th class="num">${bilingualHeaderCell('Variance', 'الفرق')}</th>` : ''}
    </tr>`;
    const body = plRows(data)
        .map((r) => {
            if (r.kind === 'head') {
                return `<tr class="open"><td colspan="${cols}">${pdfCellHtml(r.name.replace(' / ', '\n'))}</td></tr>`;
            }
            const cls = r.kind === 'total' ? ' class="close"' : '';
            return `<tr${cls}>
                <td>${escapePdfHtml(r.code || '')}</td>
                <td>${pdfCellHtml(r.kind === 'total' ? r.name.replace(' / ', '\n') : r.name)}</td>
                <td class="num">${money(r.amount)}</td>
                ${hasCmp ? `<td class="num">${money(r.compare)}</td><td class="num">${money(r.variance)}</td>` : ''}
            </tr>`;
        })
        .join('');
    const page = wrapStmtPage(`
        <div class="title-row">
            <div class="title-en">Profit &amp; Loss</div>
            <div class="title-ar-wrap" style="text-align:center"><span class="title-ar">الأرباح والخسائر</span></div>
        </div>
        <div class="meta">${escapePdfHtml(supplierName)}${supplierName ? ' · ' : ''}${escapePdfHtml(rangeText(data?.dateFrom, data?.dateTo))}${
            hasCmp ? ` · Compare ${escapePdfHtml(rangeText(data.compare.dateFrom, data.compare.dateTo))}` : ''
        } · Amounts in SAR (official Riyal)</div>
        <table class="grid"><thead>${head}</thead><tbody>${body}</tbody></table>
        <div class="foot">FILTER · supplier ledger · read-only report</div>
    `);
    await exportHtmlPagesToPdf({
        fileName: `profit-and-loss-${data?.dateFrom || 'all'}-${data?.dateTo || 'all'}.pdf`,
        orientation: 'portrait',
        pages: [page],
    });
}

export function exportSupplierProfitLossExcel({ data }) {
    const hasCmp = Boolean(data?.compare);
    const num = (v) => (v == null ? '' : Number(Number(v || 0).toFixed(2)));
    const headers = [
        'Code / الرمز',
        'Account / الحساب',
        `This period / هذه الفترة (${RIYAL_SIGN})`,
        ...(hasCmp
            ? [`Compare / المقارنة (${RIYAL_SIGN})`, `Variance / الفرق (${RIYAL_SIGN})`]
            : []),
    ];
    const rows = plRows(data).map((r) =>
        r.kind === 'head'
            ? ['', r.name]
            : [r.code || '', r.name, num(r.amount), ...(hasCmp ? [num(r.compare), num(r.variance)] : [])],
    );
    rows.push(['', `Range: ${rangeText(data?.dateFrom, data?.dateTo)}`]);
    if (hasCmp) rows.push(['', `Compare: ${rangeText(data.compare.dateFrom, data.compare.dateTo)}`]);
    exportRowsToExcel({
        sheetName: 'Profit and Loss',
        headers,
        rows,
        filenameBase: `profit-and-loss-${data?.dateFrom || 'all'}-${data?.dateTo || 'all'}`,
    });
}
