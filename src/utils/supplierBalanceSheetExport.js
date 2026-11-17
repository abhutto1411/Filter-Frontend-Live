/**
 * SP-07 — Supplier Balance Sheet export (PDF + Excel), with the optional compare as-of column.
 * Same pipeline as the trial balance / P&L exports (bilingual HTML → PDF, SAMA Riyal SVG;
 * Excel via `exportRowsToExcel` with the U+20C1 Riyal sign in headers).
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
const CY_EN = 'Current-year earnings';
const CY_AR = 'أرباح السنة الحالية';

/** Flatten the balance-sheet payload into ordered printable rows. */
function bsRows(data) {
    const hasCmp = Boolean(data?.compare);
    const ct = data?.compare?.totals || {};
    const cv = data?.compare?.variance || {};
    const line = (l) => ({
        kind: 'line',
        code: l.isCurrentYearEarnings ? '' : l.code,
        name: l.isCurrentYearEarnings ? `${CY_EN} / ${CY_AR}` : l.name,
        amount: l.amount,
        compare: hasCmp ? l.compareAmount : null,
        variance: hasCmp ? l.variance : null,
    });
    const total = (en, ar, amount, key) => ({
        kind: 'total',
        code: '',
        name: `${en} / ${ar}`,
        amount,
        compare: hasCmp ? ct[key] : null,
        variance: hasCmp ? cv[key] : null,
    });
    const head = (en, ar) => ({ kind: 'head', name: `${en} / ${ar}` });
    const section = (en, ar, lines) =>
        (lines || []).length ? [head(en, ar), ...lines.map(line)] : [];
    const a = data?.assets || {};
    const l = data?.liabilities || {};
    const e = data?.equity || {};
    return [
        ...section('Current assets', 'الأصول المتداولة', a.current),
        ...section('Fixed assets', 'الأصول الثابتة', a.fixed),
        ...section('Other assets', 'أصول أخرى', a.other),
        total('Total assets', 'إجمالي الأصول', a.total, 'totalAssets'),
        ...section('Current liabilities', 'الالتزامات المتداولة', l.current),
        ...section('Long-term liabilities', 'الالتزامات طويلة الأجل', l.longTerm),
        ...section('Other liabilities', 'التزامات أخرى', l.other),
        total('Total liabilities', 'إجمالي الالتزامات', l.total, 'totalLiabilities'),
        ...section('Equity', 'حقوق الملكية', e.accounts),
        total('Total equity', 'إجمالي حقوق الملكية', e.total, 'totalEquity'),
        total(
            'Total liabilities + equity',
            'إجمالي الالتزامات + حقوق الملكية',
            data?.totalLiabilitiesAndEquity,
            'totalLiabilitiesAndEquity',
        ),
    ];
}

export async function exportSupplierBalanceSheetPdf({ data, supplierName = '' }) {
    const hasCmp = Boolean(data?.compare);
    const svg = await riyalSvg();
    const money = (val) =>
        val == null
            ? ''
            : `<span style="display:inline-flex;align-items:center;gap:3px;direction:ltr">${svg}<span>${escapePdfHtml(fmt2(val))}</span></span>`;
    const cols = hasCmp ? 5 : 3;
    const asOf = data?.asOf || '…';
    const head = `<tr>
        <th style="width:9%">${bilingualHeaderCell('Code', 'الرمز')}</th>
        <th>${bilingualHeaderCell('Account', 'الحساب')}</th>
        <th class="num">${bilingualHeaderCell(`As of ${asOf}`, `حتى ${asOf}`)}</th>
        ${
            hasCmp
                ? `<th class="num">${bilingualHeaderCell(`As of ${data.compare.asOf}`, `حتى ${data.compare.asOf}`)}</th><th class="num">${bilingualHeaderCell('Change', 'التغيّر')}</th>`
                : ''
        }
    </tr>`;
    const body = bsRows(data)
        .map((r) => {
            if (r.kind === 'head') {
                return `<tr class="open"><td colspan="${cols}">${pdfCellHtml(r.name.replace(' / ', '\n'))}</td></tr>`;
            }
            const cls = r.kind === 'total' ? ' class="close"' : '';
            return `<tr${cls}>
                <td>${escapePdfHtml(r.code || '')}</td>
                <td>${pdfCellHtml(r.name.includes(' / ') ? r.name.replace(' / ', '\n') : r.name)}</td>
                <td class="num">${money(r.amount)}</td>
                ${hasCmp ? `<td class="num">${money(r.compare)}</td><td class="num">${money(r.variance)}</td>` : ''}
            </tr>`;
        })
        .join('');
    const check = data?.check;
    const status = check
        ? check.balanced
            ? `<div class="meta" style="color:#065f46;font-weight:700">Assets = Liabilities + Equity / الأصول = الالتزامات + حقوق الملكية</div>`
            : `<div class="meta" style="color:#b91c1c;font-weight:700">Out of balance by ${money(check.difference)} — nothing was adjusted / غير متوازنة</div>`
        : '';
    const page = wrapStmtPage(`
        <div class="title-row">
            <div class="title-en">Balance Sheet</div>
            <div class="title-ar-wrap" style="text-align:center"><span class="title-ar">الميزانية العمومية</span></div>
        </div>
        <div class="meta">${escapePdfHtml(supplierName)}${supplierName ? ' · ' : ''}As of ${escapePdfHtml(asOf)} (Asia/Riyadh, end of day)${
            hasCmp ? ` · Compare as of ${escapePdfHtml(data.compare.asOf || '…')}` : ''
        } · Amounts in SAR (official Riyal)</div>
        <table class="grid"><thead>${head}</thead><tbody>${body}</tbody></table>
        ${status}
        <div class="foot">FILTER · supplier ledger · read-only report</div>
    `);
    await exportHtmlPagesToPdf({
        fileName: `balance-sheet-${data?.asOf || 'today'}.pdf`,
        orientation: 'portrait',
        pages: [page],
    });
}

export function exportSupplierBalanceSheetExcel({ data }) {
    const hasCmp = Boolean(data?.compare);
    const num = (v) => (v == null ? '' : Number(Number(v || 0).toFixed(2)));
    const asOf = data?.asOf || '';
    const headers = [
        'Code / الرمز',
        'Account / الحساب',
        `As of ${asOf} / حتى ${asOf} (${RIYAL_SIGN})`,
        ...(hasCmp
            ? [
                  `As of ${data.compare.asOf} / حتى ${data.compare.asOf} (${RIYAL_SIGN})`,
                  `Change / التغيّر (${RIYAL_SIGN})`,
              ]
            : []),
    ];
    const rows = bsRows(data).map((r) =>
        r.kind === 'head'
            ? ['', r.name]
            : [r.code || '', r.name, num(r.amount), ...(hasCmp ? [num(r.compare), num(r.variance)] : [])],
    );
    if (data?.check) {
        rows.push(['', `Check: Assets − (Liabilities + Equity) (${RIYAL_SIGN})`, num(data.check.difference)]);
    }
    rows.push(['', `As of ${asOf} (Asia/Riyadh, end of day)`]);
    exportRowsToExcel({
        sheetName: 'Balance Sheet',
        headers,
        rows,
        filenameBase: `balance-sheet-${asOf || 'today'}`,
    });
}
