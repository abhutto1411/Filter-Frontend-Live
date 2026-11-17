/**
 * SP-05 — Supplier six-column Trial Balance export (PDF + Excel).
 *
 * PDF reuses the bilingual HTML → image pipeline (`exportHtmlPagesToPdf`), which
 * loads Noto Sans Arabic and keeps English / Arabic on separate lines. Amounts carry
 * the official SAMA Riyal mark (inline SVG, same paths as `components/RiyalIcon`).
 * Excel reuses `exportRowsToExcel`; amounts are numbers, headers carry the Saudi
 * Riyal sign (U+20C1).
 */
import React from 'react';
import RiyalIcon from '../components/RiyalIcon';
import {
    bilingualHeaderCell,
    chunkRows,
    escapePdfHtml,
    exportHtmlPagesToPdf,
    pdfCellHtml,
    wrapStmtPage,
} from './bilingualHtmlPdf';
import { exportRowsToExcel } from './tableExport';

/** U+20C1 SAUDI RIYAL SIGN (Unicode 17). */
const RIYAL_SIGN = '⃁';
const ROWS_PER_PAGE = 22;

const COLUMNS = [
    { key: 'openingDebit', en: 'Opening Dr', ar: 'افتتاحي مدين' },
    { key: 'openingCredit', en: 'Opening Cr', ar: 'افتتاحي دائن' },
    { key: 'periodDebit', en: 'Period Dr', ar: 'الفترة مدين' },
    { key: 'periodCredit', en: 'Period Cr', ar: 'الفترة دائن' },
    { key: 'closingDebit', en: 'Closing Dr', ar: 'ختامي مدين' },
    { key: 'closingCredit', en: 'Closing Cr', ar: 'ختامي دائن' },
];

export function fmt2(v) {
    const n = Number(v || 0);
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

let riyalSvgCache = '';
/** Inline SAMA Riyal SVG markup for HTML→PDF pages (lazy, cached). */
export async function riyalSvg() {
    if (riyalSvgCache) return riyalSvgCache;
    const { renderToStaticMarkup } = await import('react-dom/server');
    riyalSvgCache = renderToStaticMarkup(React.createElement(RiyalIcon, { size: 9 }));
    return riyalSvgCache;
}

function rangeLabel(data) {
    const from = data?.dateFrom || '…';
    const to = data?.dateTo || '…';
    return `${from} – ${to} (Asia/Riyadh)`;
}

/** Export the six-column trial balance returned by `GET /supplier/accounting/reports/trial-balance`. */
export async function exportSupplierTrialBalancePdf({ data, supplierName = '' }) {
    const rows = Array.isArray(data?.accounts) ? data.accounts : [];
    const svg = await riyalSvg();
    const money = (v) =>
        `<span style="display:inline-flex;align-items:center;gap:3px;direction:ltr">${svg}<span>${escapePdfHtml(fmt2(v))}</span></span>`;

    const head = `<tr>
        <th style="width:7%">${bilingualHeaderCell('Code', 'الرمز')}</th>
        <th style="width:21%">${bilingualHeaderCell('Account', 'الحساب')}</th>
        ${COLUMNS.map((c) => `<th class="num">${bilingualHeaderCell(c.en, c.ar)}</th>`).join('')}
    </tr>`;

    const t = data?.totals || {};
    const totalsRow = `<tr class="close">
        <td></td>
        <td>${bilingualHeaderCell('Totals', 'المجاميع')}</td>
        ${COLUMNS.map((c) => `<td class="num">${money(t[c.key])}</td>`).join('')}
    </tr>`;

    const checks = data?.checks || {};
    const unbalanced = ['opening', 'period', 'closing'].filter((k) => checks[k] && !checks[k].balanced);
    const statusLine = unbalanced.length
        ? `<div class="meta" style="color:#b91c1c;font-weight:700">Out of balance: ${unbalanced
              .map((k) => `${k} ${fmt2(checks[k].difference)}`)
              .join(' · ')}</div>`
        : `<div class="meta" style="color:#065f46;font-weight:700">Opening, period and closing columns balance / الأعمدة متوازنة</div>`;

    const chunks = chunkRows(rows, ROWS_PER_PAGE);
    const pages = chunks.map((chunk, i) => {
        const body = chunk
            .map(
                (r) => `<tr>
                    <td>${escapePdfHtml(r.code)}</td>
                    <td>${pdfCellHtml(r.name)}</td>
                    ${COLUMNS.map((c) => `<td class="num">${money(r[c.key])}</td>`).join('')}
                </tr>`,
            )
            .join('');
        const isLast = i === chunks.length - 1;
        return wrapStmtPage(`
            <div class="title-row">
                <div class="title-en">Trial Balance (6-column)</div>
                <div class="title-ar-wrap" style="text-align:center"><span class="title-ar">ميزان المراجعة (6 أعمدة)</span></div>
            </div>
            <div class="meta">${escapePdfHtml(supplierName)}${supplierName ? ' · ' : ''}${escapePdfHtml(rangeLabel(data))} · Amounts in SAR (official Riyal)</div>
            <table class="grid">
                <thead>${head}</thead>
                <tbody>${body}${isLast ? totalsRow : ''}</tbody>
            </table>
            ${isLast ? statusLine : ''}
            ${
                isLast && data?.netZatcaPayable != null
                    ? `<div class="meta">Memo — net VAT payable to ZATCA (2100 − 1300): ${money(data.netZatcaPayable)}</div>`
                    : ''
            }
            <div class="foot">FILTER · supplier ledger · read-only report</div>
        `);
    });

    await exportHtmlPagesToPdf({
        fileName: `trial-balance-${data?.dateFrom || 'all'}-${data?.dateTo || 'all'}.pdf`,
        orientation: 'landscape',
        pages,
    });
}

export function exportSupplierTrialBalanceExcel({ data }) {
    const rows = Array.isArray(data?.accounts) ? data.accounts : [];
    const headers = [
        'Code / الرمز',
        'Account / الحساب',
        ...COLUMNS.map((c) => `${c.en} / ${c.ar} (${RIYAL_SIGN})`),
    ];
    const num = (v) => Number(Number(v || 0).toFixed(2));
    const body = rows.map((r) => [r.code, r.name, ...COLUMNS.map((c) => num(r[c.key]))]);
    const t = data?.totals || {};
    body.push(['', 'Totals / المجاميع', ...COLUMNS.map((c) => num(t[c.key]))]);
    if (data?.netZatcaPayable != null) {
        body.push([
            '',
            `Memo: net VAT payable to ZATCA (2100 − 1300) (${RIYAL_SIGN})`,
            num(data.netZatcaPayable),
        ]);
    }
    body.push(['', `Range: ${rangeLabel(data)}`]);
    exportRowsToExcel({
        sheetName: 'Trial Balance',
        headers,
        rows: body,
        filenameBase: `trial-balance-${data?.dateFrom || 'all'}-${data?.dateTo || 'all'}`,
    });
}
