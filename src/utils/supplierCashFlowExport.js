/**
 * SP-08 — Supplier Cash Flow export (PDF + Excel), one method at a time (indirect | direct).
 * Same pipeline as the TB / P&L / BS exports (bilingual HTML → PDF with the SAMA Riyal SVG;
 * Excel via `exportRowsToExcel` with the U+20C1 Riyal sign in headers).
 */
import {
    bilingualHeaderCell,
    chunkRows,
    escapePdfHtml,
    exportHtmlPagesToPdf,
    pdfCellHtml,
    wrapStmtPage,
} from './bilingualHtmlPdf';
import { exportRowsToExcel } from './tableExport';
import { fmt2, riyalSvg } from './supplierTrialBalanceExport';

const RIYAL_SIGN = '⃁';
const ROWS_PER_PAGE = 26;

const ADJ_EN = { stock: 'Non-cash opening stock via', ar: 'Non-cash opening AR via', ap: 'Non-cash opening AP via', other: 'Non-cash movement via' };
const ADJ_AR = { stock: 'مخزون افتتاحي غير نقدي عبر', ar: 'ذمم مدينة افتتاحية غير نقدية عبر', ap: 'ذمم دائنة افتتاحية غير نقدية عبر', other: 'حركة غير نقدية عبر' };

const head = (en, ar) => ({ kind: 'head', label: `${en} / ${ar}` });
const total = (en, ar, amount) => ({ kind: 'total', label: `${en} / ${ar}`, amount });
const line = (label, amount, extra = {}) => ({ kind: 'line', label, amount, ...extra });

function indirectRows(data) {
    const ind = data?.indirect || {};
    return [
        head('Operating activities', 'الأنشطة التشغيلية'),
        line('Net income (P&L) / صافي الدخل', ind.netIncome),
        ...((ind.adjustments || []).length ? [head('Adjustments for non-cash items', 'تسويات البنود غير النقدية')] : []),
        ...(ind.adjustments || []).map((a) =>
            line(`${ADJ_EN[a.kind] || ADJ_EN.other} [${a.code}] ${a.name || ''} / ${ADJ_AR[a.kind] || ADJ_AR.other} [${a.code}]`, a.amount),
        ),
        ...((ind.workingCapitalChanges || []).length ? [head('Changes in working capital', 'تغيرات رأس المال العامل')] : []),
        ...(ind.workingCapitalChanges || []).map((w) => line(w.label, w.amount)),
        total('Net cash from operating activities', 'صافي النقد من الأنشطة التشغيلية', ind.netCashFromOperating),
        head('Investing activities', 'الأنشطة الاستثمارية'),
        ...(ind.investing?.lines || []).map((l) => line(l.label, l.amount)),
        total('Net cash from investing', 'صافي النقد من الاستثمار', ind.investing?.net ?? 0),
        head('Financing activities', 'الأنشطة التمويلية'),
        ...(ind.financing?.lines || []).map((l) => line(l.label, l.amount)),
        total('Net cash from financing', 'صافي النقد من التمويل', ind.financing?.net ?? 0),
        total('Opening cash', 'النقد الافتتاحي', ind.openingCash),
        total('Net change in cash', 'صافي التغير في النقد', ind.netChange),
        total('Closing cash', 'النقد الختامي', ind.closingCash),
        total('Reconciliation difference', 'فرق المطابقة', ind.reconciliationDifference ?? 0),
    ];
}

function directRows(data) {
    const d = data?.direct || {};
    const section = (en, ar, b) => {
        const rows = [
            ...(b?.inflows || []).map((r) => ({ ...r, signed: r.amount })),
            ...(b?.outflows || []).map((r) => ({ ...r, signed: -r.amount })),
        ].sort((x, y) => String(x.date).localeCompare(String(y.date)));
        return [
            head(en, ar),
            ...rows.map((r) =>
                line(r.description || r.source || r.journalType || '', r.signed, {
                    date: String(r.date || '').slice(0, 10),
                    entry: r.journalEntryNumber || '',
                    account: r.accountCode || '',
                }),
            ),
            total(`Net ${en.toLowerCase()}`, `صافي ${ar}`, b?.net ?? 0),
        ];
    };
    return [
        ...section('Operating activities', 'الأنشطة التشغيلية', d.operating),
        ...section('Investing activities', 'الأنشطة الاستثمارية', d.investing),
        ...section('Financing activities', 'الأنشطة التمويلية', d.financing),
        total('Opening cash', 'النقد الافتتاحي', d.openingCash),
        total('Net change in cash', 'صافي التغير في النقد', d.netChange),
        total('Closing cash', 'النقد الختامي', d.closingCash),
    ];
}

function rangeText(data) {
    return `${data?.dateFrom || '…'} – ${data?.dateTo || '…'} (Asia/Riyadh)`;
}

export async function exportSupplierCashFlowPdf({ data, method = 'indirect', supplierName = '' }) {
    const isDirect = method === 'direct';
    const rows = isDirect ? directRows(data) : indirectRows(data);
    const svg = await riyalSvg();
    const money = (v) =>
        v == null
            ? ''
            : `<span style="display:inline-flex;align-items:center;gap:3px;direction:ltr">${svg}<span>${escapePdfHtml(fmt2(v))}</span></span>`;
    const cols = isDirect ? 4 : 2;
    const thead = isDirect
        ? `<tr>
            <th style="width:13%">${bilingualHeaderCell('Date', 'التاريخ')}</th>
            <th style="width:12%">${bilingualHeaderCell('Entry', 'القيد')}</th>
            <th>${bilingualHeaderCell('Description', 'البيان')}</th>
            <th class="num" style="width:20%">${bilingualHeaderCell('Amount', 'المبلغ')}</th>
          </tr>`
        : `<tr>
            <th>${bilingualHeaderCell('Item', 'البند')}</th>
            <th class="num" style="width:24%">${bilingualHeaderCell('Amount', 'المبلغ')}</th>
          </tr>`;
    const rowHtml = (r) => {
        if (r.kind === 'head') {
            return `<tr class="open"><td colspan="${cols}">${pdfCellHtml(r.label.replace(' / ', '\n'))}</td></tr>`;
        }
        const cls = r.kind === 'total' ? ' class="close"' : '';
        const label = r.kind === 'total' ? r.label.replace(' / ', '\n') : r.label;
        if (isDirect) {
            const isLine = r.kind === 'line';
            return `<tr${cls}>
                <td>${isLine ? escapePdfHtml(r.date) : ''}</td>
                <td>${isLine ? escapePdfHtml(r.entry) : ''}</td>
                <td${isLine ? '' : ' colspan="1"'}>${pdfCellHtml(isLine ? `${label} [${r.account}]` : label)}</td>
                <td class="num">${money(r.amount)}</td>
            </tr>`;
        }
        return `<tr${cls}><td>${pdfCellHtml(label)}</td><td class="num">${money(r.amount)}</td></tr>`;
    };
    const checks = data?.checks || {};
    const diff = isDirect ? checks.directDifference : checks.indirectDifference;
    const recon = isDirect ? 0 : Number(data?.indirect?.reconciliationDifference ?? 0);
    const ok = Number(diff ?? 0) === 0 && recon === 0 && checks.closingCashMatch !== false;
    const status = ok
        ? `<div class="meta" style="color:#065f46;font-weight:700">Ties to the cash &amp; bank ledger — reconciliation 0.00 / مطابقة لدفتر النقد والبنك</div>`
        : `<div class="meta" style="color:#b91c1c;font-weight:700">Does NOT tie to the cash &amp; bank ledger — difference ${money(Number(diff ?? 0) || recon)}</div>`;
    const title = isDirect ? ['Cash Flow — Direct method', 'التدفقات النقدية — الطريقة المباشرة'] : ['Cash Flow — Indirect method', 'التدفقات النقدية — الطريقة غير المباشرة'];
    const chunks = chunkRows(rows, ROWS_PER_PAGE);
    const pages = chunks.map((chunk, i) => {
        const isLast = i === chunks.length - 1;
        return wrapStmtPage(`
            <div class="title-row">
                <div class="title-en">${escapePdfHtml(title[0])}</div>
                <div class="title-ar-wrap" style="text-align:center"><span class="title-ar">${escapePdfHtml(title[1])}</span></div>
            </div>
            <div class="meta">${escapePdfHtml(supplierName)}${supplierName ? ' · ' : ''}${escapePdfHtml(rangeText(data))} · Amounts in SAR (official Riyal)</div>
            <table class="grid"><thead>${thead}</thead><tbody>${chunk.map(rowHtml).join('')}</tbody></table>
            ${isLast ? status : ''}
            <div class="foot">FILTER · supplier ledger · read-only report</div>
        `);
    });
    await exportHtmlPagesToPdf({
        fileName: `cash-flow-${method}-${data?.dateFrom || 'all'}-${data?.dateTo || 'all'}.pdf`,
        orientation: 'portrait',
        pages,
    });
}

export function exportSupplierCashFlowExcel({ data, method = 'indirect' }) {
    const isDirect = method === 'direct';
    const rows = isDirect ? directRows(data) : indirectRows(data);
    const num = (v) => (v == null ? '' : Number(Number(v || 0).toFixed(2)));
    const headers = isDirect
        ? ['Date / التاريخ', 'Entry / القيد', 'Account / الحساب', 'Description / البيان', `Amount / المبلغ (${RIYAL_SIGN})`]
        : ['Item / البند', `Amount / المبلغ (${RIYAL_SIGN})`];
    const body = rows.map((r) => {
        if (isDirect) {
            if (r.kind === 'line') return [r.date, r.entry, r.account, r.label, num(r.amount)];
            return ['', '', '', r.label, r.kind === 'head' ? '' : num(r.amount)];
        }
        return [r.label, r.kind === 'head' ? '' : num(r.amount)];
    });
    const pad = isDirect ? ['', '', ''] : [];
    body.push([...pad, `Range: ${rangeText(data)}`]);
    exportRowsToExcel({
        sheetName: isDirect ? 'Cash Flow Direct' : 'Cash Flow Indirect',
        headers,
        rows: body,
        filenameBase: `cash-flow-${method}-${data?.dateFrom || 'all'}-${data?.dateTo || 'all'}`,
    });
}
