import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const fmtMoney = (v) =>
    Number(v ?? 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

function pdfAsciiOrFallback(text, fallback = '') {
    const s = String(text || '').trim();
    if (!s) return fallback;
    if (/[^\u0020-\u007E]/.test(s)) return fallback;
    return s;
}

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
export function exportWorkshopGlLedgerPdf({
    header,
    openingBalance = 0,
    lines = [],
    totals,
    includeVehicle = false,
}) {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const margin = 28;
    let cursorY = margin;

    const accountLabel = header?.accountCode
        ? `[${header.accountCode}] ${header.accountName || ''}`
        : header?.accountName || 'Account';

    const headingName = header?.partyLabel || header?.companyName || accountLabel;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(pdfAsciiOrFallback(headingName, 'General Ledger'), margin, cursorY + 12);

    doc.setFontSize(11);
    doc.text(pdfAsciiOrFallback(accountLabel, 'Account Ledger'), margin, cursorY + 30);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const meta = [
        header?.workshopName ? `Workshop: ${header.workshopName}` : null,
        `Period: ${header?.from || '—'}  to  ${header?.to || '—'}`,
        header?.partyLabel ? `Corporate customer: ${header.partyLabel}` : null,
        header?.vatNumber ? `VAT No.: ${header.vatNumber}` : null,
        header?.phone ? `Phone: ${header.phone}` : null,
        header?.contactPerson || header?.customerName
            ? `Contact: ${header.contactPerson || header.customerName}`
            : null,
        `Currency: ${header?.currencyCode || 'SAR'}`,
        `Lines: ${lines.length}`,
    ].filter(Boolean);
    meta.forEach((line, i) => {
        doc.text(pdfAsciiOrFallback(line, line), margin, cursorY + 48 + i * 12);
    });
    cursorY += 48 + meta.length * 12 + 6;

    const head = includeVehicle
        ? [['Date', 'Entry #', 'Type', 'Vehicle No.', 'Description', 'Source', 'Debit', 'Credit', 'Balance']]
        : [['Date', 'Entry #', 'Type', 'Description', 'Source', 'Debit', 'Credit', 'Balance']];

    const openingRow = includeVehicle
        ? ['—', '—', 'Opening', '—', 'Opening balance', '—', '', '', fmtMoney(openingBalance)]
        : ['—', '—', 'Opening', 'Opening balance', '—', '', '', fmtMoney(openingBalance)];

    const body = [
        openingRow,
        ...lines.map((l) => {
            const desc = l.lineDescription || l.journalDescription || l.description || '—';
            const base = [
                fmtDateCell(l.date),
                l.entryNumber || '—',
                l.journalType || l.type || '—',
            ];
            if (includeVehicle) base.push(l.vehicleNo || '—');
            base.push(
                desc,
                l.source || '—',
                Number(l.debit) > 0 ? fmtMoney(l.debit) : '',
                Number(l.credit) > 0 ? fmtMoney(l.credit) : '',
                fmtMoney(l.runningBalance),
            );
            return base;
        }),
        includeVehicle
            ? [
                  '',
                  '',
                  '',
                  '',
                  'Totals / Closing',
                  '',
                  fmtMoney(totals?.totalDebit),
                  fmtMoney(totals?.totalCredit),
                  fmtMoney(totals?.closingBalance),
              ]
            : [
                  '',
                  '',
                  '',
                  'Totals / Closing',
                  '',
                  fmtMoney(totals?.totalDebit),
                  fmtMoney(totals?.totalCredit),
                  fmtMoney(totals?.closingBalance),
              ],
    ];

    autoTable(doc, {
        startY: cursorY,
        head,
        body,
        margin: { left: margin, right: margin },
        styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
        headStyles: { fillColor: [241, 245, 249], textColor: 30, fontStyle: 'bold' },
        columnStyles: includeVehicle
            ? {
                  0: { cellWidth: 58 },
                  1: { cellWidth: 78 },
                  2: { cellWidth: 56 },
                  3: { cellWidth: 62 },
                  4: { cellWidth: 'auto' },
                  5: { cellWidth: 70 },
                  6: { cellWidth: 62, halign: 'right' },
                  7: { cellWidth: 62, halign: 'right' },
                  8: { cellWidth: 68, halign: 'right' },
              }
            : {
                  0: { cellWidth: 58 },
                  1: { cellWidth: 90 },
                  2: { cellWidth: 62 },
                  3: { cellWidth: 'auto' },
                  4: { cellWidth: 72 },
                  5: { cellWidth: 62, halign: 'right' },
                  6: { cellWidth: 62, halign: 'right' },
                  7: { cellWidth: 70, halign: 'right' },
              },
        didParseCell(data) {
            const last = data.row.index === body.length - 1;
            const first = data.row.index === 0;
            if (last || first) {
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.fillColor = first ? [248, 250, 252] : [255, 247, 237];
            }
        },
    });

    const finalY = doc.lastAutoTable?.finalY ?? cursorY + 200;
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(
        `Generated ${new Date().toLocaleString()}`,
        margin,
        Math.min(finalY + 16, doc.internal.pageSize.getHeight() - 14),
    );

    doc.save(`${buildFileBase({ header })}.pdf`);
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
