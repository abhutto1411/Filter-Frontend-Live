import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const fmtMoney = (v) =>
    Number(v ?? 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

function buildFileBase({ header }) {
    const safe = (s) => String(s || '').replace(/[^\w-]+/g, '_').replace(/_+/g, '_');
    const supplier = safe(header?.supplierName || 'supplier');
    const range =
        header?.from && header?.to
            ? `${header.from}_to_${header.to}`
            : header?.from
              ? `from_${header.from}`
              : header?.to
                ? `to_${header.to}`
                : 'all';
    return `Supplier_Ledger_${supplier}_${range}`;
}

/** Export a supplier ledger to a styled PDF. */
export function exportSupplierLedgerPdf({
    header,
    openingBalance,
    rows,
    totals,
    logoDataUrl, // optional base64 data URL for the workshop logo
}) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const margin = 32;
    let cursorY = margin;

    if (logoDataUrl) {
        try {
            doc.addImage(logoDataUrl, 'PNG', margin, cursorY, 60, 60);
        } catch (e) {
            console.warn('logo render failed', e);
        }
    }

    const headerLeft = logoDataUrl ? margin + 76 : margin;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(header?.workshopName || 'Workshop', headerLeft, cursorY + 16);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    if (header?.workshopAddress) {
        doc.text(String(header.workshopAddress), headerLeft, cursorY + 32);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Supplier Ledger Statement', headerLeft, cursorY + 50);

    cursorY += 80;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const lines = [
        `Supplier: ${header?.supplierName || ''}  ` +
            `(${header?.type === 'affiliated' ? 'Affiliated' : 'Non-Affiliated'})`,
        header?.branchName ? `Branch: ${header.branchName}` : null,
        `Period: ${header?.from || '—'}  to  ${header?.to || '—'}`,
        `Currency: ${header?.currencyCode || 'SAR'}`,
    ].filter(Boolean);
    lines.forEach((line, i) => {
        doc.text(line, margin, cursorY + i * 14);
    });
    cursorY += lines.length * 14 + 8;

    const body = [];
    body.push([
        '—',
        'Opening balance',
        '',
        '',
        fmtMoney(openingBalance),
    ]);
    rows.forEach((r) => {
        body.push([
            r.date,
            r.description || '',
            r.debit > 0 ? fmtMoney(r.debit) : '',
            r.credit > 0 ? fmtMoney(r.credit) : '',
            fmtMoney(r.runningBalance),
        ]);
    });
    body.push([
        '',
        'Totals',
        fmtMoney(totals?.totalDebit),
        fmtMoney(totals?.totalCredit),
        fmtMoney(totals?.closingBalance),
    ]);

    autoTable(doc, {
        startY: cursorY,
        head: [['Date', 'Description', 'Debit', 'Credit', 'Balance']],
        body,
        margin: { left: margin, right: margin },
        styles: { fontSize: 9, cellPadding: 5 },
        headStyles: { fillColor: [241, 245, 249], textColor: 30 },
        columnStyles: {
            0: { cellWidth: 70 },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 75, halign: 'right' },
            3: { cellWidth: 75, halign: 'right' },
            4: { cellWidth: 85, halign: 'right' },
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
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(
        `Generated ${new Date().toLocaleString()}`,
        margin,
        Math.min(finalY + 18, doc.internal.pageSize.getHeight() - 16),
    );

    const file = `${buildFileBase({ header })}.pdf`;
    doc.save(file);
}

/** Export the same ledger to .xlsx. */
export function exportSupplierLedgerExcel({
    header,
    openingBalance,
    rows,
    totals,
}) {
    const aoa = [
        [header?.workshopName || 'Workshop'],
        ['Supplier Ledger Statement'],
        [],
        ['Supplier', header?.supplierName || ''],
        ['Type', header?.type === 'affiliated' ? 'Affiliated' : 'Non-Affiliated'],
        ['Branch', header?.branchName || ''],
        ['Period', `${header?.from || '—'}  to  ${header?.to || '—'}`],
        ['Currency', header?.currencyCode || 'SAR'],
        [],
        ['Date', 'Description', 'Debit', 'Credit', 'Balance'],
        ['—', 'Opening balance', '', '', Number(openingBalance ?? 0)],
        ...rows.map((r) => [
            r.date,
            r.description || '',
            r.debit > 0 ? Number(r.debit) : '',
            r.credit > 0 ? Number(r.credit) : '',
            Number(r.runningBalance ?? 0),
        ]),
        [
            '',
            'Totals',
            Number(totals?.totalDebit ?? 0),
            Number(totals?.totalCredit ?? 0),
            Number(totals?.closingBalance ?? 0),
        ],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 14 }, { wch: 50 }, { wch: 14 }, { wch: 14 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ledger');
    XLSX.writeFile(wb, `${buildFileBase({ header })}.xlsx`);
}
