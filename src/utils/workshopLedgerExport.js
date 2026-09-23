import * as XLSX from 'xlsx';
import {
    buildGenericLedgerPdfPages,
    escapePdfHtml,
    exportHtmlPagesToPdf,
} from './bilingualHtmlPdf';

const fmtMoney = (v) =>
    Number(v ?? 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

function buildFileBase({ header }) {
    const safe = (s) => String(s || '').replace(/[^\w-]+/g, '_').replace(/_+/g, '_');
    const code = safe(header?.accountCode || 'ledger');
    const name = safe(header?.accountName || 'account').slice(0, 40);
    const range =
        header?.from && header?.to
            ? `${header.from}_to_${header.to}`
            : header?.from
              ? `from_${header.from}`
              : header?.to
                ? `to_${header.to}`
                : 'all';
    const party = header?.partyLabel ? `_${safe(header.partyLabel).slice(0, 32)}` : '';
    return `GL_${code}_${name}${party}_${range}`;
}

function fmtDateCell(d) {
    if (!d) return '—';
    try {
        const s = String(d);
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
        return new Date(d).toISOString().slice(0, 10);
    } catch {
        return String(d);
    }
}

/**
 * Export workshop General Ledger (all lines for the selected period — not just the current page).
 * Optional `includeVehicle` adds a Vehicle No. column (corporate AR customer view).
 */
export async function exportWorkshopGlLedgerPdf({
    header,
    openingBalance = 0,
    lines = [],
    totals,
    includeVehicle = false,
}) {
    const accountLabel = header?.accountCode
        ? `[${header.accountCode}] ${header.accountName || ''}`
        : header?.accountName || 'Account';
    const headingName = header?.partyLabel || header?.partyName || accountLabel;
    const brand = 'FILTER';
    const scopeName = header?.workshopName || header?.companyName || '';
    const sellerName =
        header?.sellerName && header.sellerName !== scopeName
            ? header.sellerName
            : 'Filter Car Services';
    const textCell = (v) => ({ text: v });
    const moneyCell = (v, show) => ({
        html: show ? escapePdfHtml(fmtMoney(v)) : '',
        className: 'num',
    });

    const columns = includeVehicle
        ? [
              { label: 'Date' },
              { label: 'Entry #' },
              { label: 'Type' },
              { label: 'Vehicle No.' },
              { label: 'Description' },
              { label: 'Source' },
              { label: 'Debit', num: true },
              { label: 'Credit', num: true },
              { label: 'Balance', num: true },
          ]
        : [
              { label: 'Date' },
              { label: 'Entry #' },
              { label: 'Type' },
              { label: 'Description' },
              { label: 'Source' },
              { label: 'Debit', num: true },
              { label: 'Credit', num: true },
              { label: 'Balance', num: true },
          ];

    const dataRows = (lines ?? []).map((l) => {
        const desc = l.lineDescription || l.journalDescription || l.description || '—';
        const cells = [
            textCell(fmtDateCell(l.date)),
            textCell(l.entryNumber || '—'),
            textCell(l.journalType || l.type || '—'),
        ];
        if (includeVehicle) cells.push(textCell(l.vehicleNo || '—'));
        cells.push(
            textCell(desc),
            textCell(l.source || '—'),
            moneyCell(l.debit, Number(l.debit) > 0),
            moneyCell(l.credit, Number(l.credit) > 0),
            moneyCell(l.runningBalance, true),
        );
        return cells;
    });

    const openingCells = includeVehicle
        ? [
              textCell('—'),
              textCell('—'),
              textCell('Opening'),
              textCell('—'),
              textCell('Opening balance'),
              textCell('—'),
              moneyCell(0, false),
              moneyCell(0, false),
              moneyCell(openingBalance, true),
          ]
        : [
              textCell('—'),
              textCell('—'),
              textCell('Opening'),
              textCell('Opening balance'),
              textCell('—'),
              moneyCell(0, false),
              moneyCell(0, false),
              moneyCell(openingBalance, true),
          ];
    const closingCells = includeVehicle
        ? [
              textCell(''),
              textCell(''),
              textCell(''),
              textCell(''),
              textCell('Totals / Closing'),
              textCell(''),
              moneyCell(totals?.totalDebit, true),
              moneyCell(totals?.totalCredit, true),
              moneyCell(totals?.closingBalance, true),
          ]
        : [
              textCell(''),
              textCell(''),
              textCell(''),
              textCell('Totals / Closing'),
              textCell(''),
              moneyCell(totals?.totalDebit, true),
              moneyCell(totals?.totalCredit, true),
              moneyCell(totals?.closingBalance, true),
          ];

    const metaHtml = [
        `Period: ${escapePdfHtml(header?.from || '—')} to ${escapePdfHtml(header?.to || '—')}`,
        header?.vatNumber ? `VAT No.: ${escapePdfHtml(header.vatNumber)}` : null,
        header?.crNumber ? `CR No.: ${escapePdfHtml(header.crNumber)}` : null,
        header?.partyPhone ? `Tel.: ${escapePdfHtml(header.partyPhone)}` : null,
        header?.partyAddress ? `Address: ${escapePdfHtml(header.partyAddress)}` : null,
        `Currency: ${escapePdfHtml(header?.currencyCode || 'SAR')}`,
        `Lines: ${escapePdfHtml(String(lines.length))}`,
    ]
        .filter(Boolean)
        .join('<br/>');

    const pages = buildGenericLedgerPdfPages({
        letterhead: true,
        brand,
        sellerName,
        scopeName,
        sellerVat: header?.sellerVatNumber || '',
        title: headingName,
        metaHtml,
        columns,
        dataRows,
        openingCells,
        closingCells,
        rowsPerPage: includeVehicle ? 12 : 14,
        generated: `Generated ${new Date().toLocaleString()} · FILTER`,
    });

    await exportHtmlPagesToPdf({
        fileName: `${buildFileBase({ header })}.pdf`,
        orientation: 'landscape',
        pages,
    });
}

export function exportWorkshopGlLedgerExcel({
    header,
    openingBalance = 0,
    lines = [],
    totals,
    includeVehicle = false,
}) {
    const accountLabel = header?.accountCode
        ? `[${header.accountCode}] ${header.accountName || ''}`
        : header?.accountName || 'Account';

    const cols = includeVehicle
        ? ['Date', 'Entry #', 'Type', 'Vehicle No.', 'Description', 'Source', 'Debit', 'Credit', 'Running Balance']
        : ['Date', 'Entry #', 'Type', 'Description', 'Source', 'Debit', 'Credit', 'Running Balance'];

    const openingRow = includeVehicle
        ? ['—', '—', 'Opening', '—', 'Opening balance', '—', '', '', Number(openingBalance ?? 0)]
        : ['—', '—', 'Opening', 'Opening balance', '—', '', '', Number(openingBalance ?? 0)];

    const dataRows = (lines || []).map((l) => {
        const desc = l.lineDescription || l.journalDescription || l.description || '—';
        const row = [
            fmtDateCell(l.date),
            l.entryNumber || '—',
            l.journalType || l.type || '—',
        ];
        if (includeVehicle) row.push(l.vehicleNo || '—');
        row.push(
            desc,
            l.source || '—',
            Number(l.debit) > 0 ? Number(l.debit) : '',
            Number(l.credit) > 0 ? Number(l.credit) : '',
            Number(l.runningBalance ?? 0),
        );
        return row;
    });

    const totalsRow = includeVehicle
        ? [
              '',
              '',
              '',
              '',
              'Totals / Closing',
              '',
              Number(totals?.totalDebit ?? 0),
              Number(totals?.totalCredit ?? 0),
              Number(totals?.closingBalance ?? 0),
          ]
        : [
              '',
              '',
              '',
              'Totals / Closing',
              '',
              Number(totals?.totalDebit ?? 0),
              Number(totals?.totalCredit ?? 0),
              Number(totals?.closingBalance ?? 0),
          ];

    const headingName = header?.partyLabel || header?.companyName || accountLabel;
    const aoa = [
        [headingName || 'FILTER'],
        [accountLabel],
        ['General Ledger Statement'],
        [],
        ...(header?.workshopName ? [['Workshop', header.workshopName]] : []),
        ['Period', `${header?.from || '—'}  to  ${header?.to || '—'}`],
        ...(header?.partyLabel ? [['Corporate customer', header.partyLabel]] : []),
        ...(header?.vatNumber ? [['VAT No.', header.vatNumber]] : []),
        ...(header?.phone ? [['Phone', header.phone]] : []),
        ...(header?.contactPerson || header?.customerName
            ? [['Contact', header.contactPerson || header.customerName]]
            : []),
        ['Currency', header?.currencyCode || 'SAR'],
        ['Lines', lines.length],
        [],
        cols,
        openingRow,
        ...dataRows,
        totalsRow,
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = includeVehicle
        ? [
              { wch: 12 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 40 },
              { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 14 },
          ]
        : [
              { wch: 12 }, { wch: 18 }, { wch: 14 }, { wch: 40 },
              { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 14 },
          ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ledger');
    XLSX.writeFile(wb, `${buildFileBase({ header })}.xlsx`);
}
