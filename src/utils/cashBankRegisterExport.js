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

function safeSlug(s) {
    return String(s || '')
        .replace(/[^\w-]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
}

function buildFileBase({ header }) {
    const register = safeSlug(header?.registerSlug || header?.registerTitle || 'register');
    const account = safeSlug(header?.accountSlug || 'all_accounts');
    const range =
        header?.from && header?.to
            ? `${header.from}_to_${header.to}`
            : header?.from
              ? `from_${header.from}`
              : header?.to
                ? `to_${header.to}`
                : 'all';
    return `Cash_Bank_Register_${register}_${account}_${range}`;
}

function mapLineForExport(row) {
    const date = row.entryDate ? String(row.entryDate).slice(0, 10) : '';
    const coaPart = row.coaCode ? `[${row.coaCode}] ${row.coaName || ''}` : row.accountName || '';
    const coaRegister = row.accountName && row.coaCode
        ? `${coaPart} — ${row.accountName}`
        : coaPart || row.accountName || '';
    const inAmt = row.direction === 'in' ? Number(row.amount ?? 0) : 0;
    const outAmt = row.direction === 'out' ? Number(row.amount ?? 0) : 0;
    return {
        date,
        coaRegister,
        description: row.description || '',
        reference: row.reference || row.sourceType || '',
        inAmt,
        outAmt,
        balance: Number(row.balance ?? 0),
    };
}

function buildExportRows(lines) {
    return (lines ?? []).map(mapLineForExport);
}

/**
 * Professional Cash / Bank / Petty Cash register statement — PDF download.
 */
export function exportCashBankRegisterPdf({ header, summary, lines }) {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const margin = 36;
    const pageW = doc.internal.pageSize.getWidth();
    let cursorY = margin;

    const company = pdfAsciiOrFallback(header?.companyName, 'FILTER ERP');
    const registerTitle = pdfAsciiOrFallback(header?.registerTitle, 'Cash Register Statement');
    const accountLabel = pdfAsciiOrFallback(
        header?.accountLabel,
        'All accounts in this register',
    );
    const currency = header?.currencyCode || 'SAR';

    doc.setFillColor(255, 215, 0);
    doc.rect(0, 0, pageW, 6, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(17, 24, 39);
    doc.text(company, margin, cursorY + 18);

    doc.setFontSize(13);
    doc.setTextColor(180, 83, 9);
    doc.text(registerTitle, margin, cursorY + 38);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    const meta = [
        `Account: ${accountLabel}`,
        `Period: ${header?.from || '—'}  to  ${header?.to || '—'}`,
        `Currency: ${currency}`,
        header?.filterNote ? `View: ${header.filterNote}` : null,
    ].filter(Boolean);
    meta.forEach((line, i) => {
        doc.text(line, margin, cursorY + 56 + i * 13);
    });
    cursorY += 56 + meta.length * 13 + 10;

    const sum = summary ?? {};
    autoTable(doc, {
        startY: cursorY,
        head: [['Opening Balance', 'Total Receipts (IN)', 'Total Payments (OUT)', 'Closing Balance']],
        body: [[
            `${currency} ${fmtMoney(sum.openingBalance)}`,
            `${currency} ${fmtMoney(sum.totalReceipts)}`,
            `${currency} ${fmtMoney(sum.totalPayments)}`,
            `${currency} ${fmtMoney(sum.closingBalance)}`,
        ]],
        margin: { left: margin, right: margin },
        styles: { fontSize: 9, cellPadding: 6, halign: 'center' },
        headStyles: { fillColor: [254, 243, 199], textColor: [120, 53, 15], fontStyle: 'bold' },
        bodyStyles: { fillColor: [255, 251, 235], textColor: [17, 24, 39], fontStyle: 'bold' },
        theme: 'plain',
    });
    cursorY = (doc.lastAutoTable?.finalY ?? cursorY) + 14;

    const exportRows = buildExportRows(lines);
    const body = [
        ['—', '—', 'Opening balance', '—', '', '', fmtMoney(sum.openingBalance)],
        ...exportRows.map((r) => [
            r.date,
            r.coaRegister,
            r.description,
            r.reference,
            r.inAmt > 0 ? fmtMoney(r.inAmt) : '',
            r.outAmt > 0 ? fmtMoney(r.outAmt) : '',
            fmtMoney(r.balance),
        ]),
        ['—', '—', 'Closing balance', '—', '', '', fmtMoney(sum.closingBalance)],
    ];

    autoTable(doc, {
        startY: cursorY,
        head: [['Date', 'COA / Register', 'Description', 'Reference', 'IN', 'OUT', 'Balance']],
        body,
        margin: { left: margin, right: margin },
        styles: { fontSize: 8.5, cellPadding: 5, overflow: 'linebreak' },
        headStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: 'bold' },
        columnStyles: {
            0: { cellWidth: 58 },
            1: { cellWidth: 120 },
            2: { cellWidth: 'auto' },
            3: { cellWidth: 62 },
            4: { cellWidth: 58, halign: 'right' },
            5: { cellWidth: 58, halign: 'right' },
            6: { cellWidth: 68, halign: 'right' },
        },
        didParseCell(data) {
            const rowIdx = data.row.index;
            const isOpening = rowIdx === 0;
            const isClosing = rowIdx === body.length - 1;
            if (isOpening || isClosing) {
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.fillColor = isOpening ? [248, 250, 252] : [255, 247, 237];
            }
            if ((data.column.index === 4 || data.column.index === 5) && data.cell.raw) {
                if (data.column.index === 4) data.cell.styles.textColor = [5, 150, 105];
                if (data.column.index === 5) data.cell.styles.textColor = [220, 38, 38];
            }
        },
    });

    const finalY = doc.lastAutoTable?.finalY ?? cursorY + 200;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(
        `Generated ${new Date().toLocaleString()} · ${company}`,
        margin,
        Math.min(finalY + 20, doc.internal.pageSize.getHeight() - 16),
    );

    doc.save(`${buildFileBase({ header })}.pdf`);
}

/**
 * Professional Cash / Bank / Petty Cash register statement — Excel download.
 */
export function exportCashBankRegisterExcel({ header, summary, lines }) {
    const company = header?.companyName || 'FILTER ERP';
    const registerTitle = header?.registerTitle || 'Cash Register Statement';
    const accountLabel = header?.accountLabel || 'All accounts in this register';
    const currency = header?.currencyCode || 'SAR';
    const sum = summary ?? {};
    const exportRows = buildExportRows(lines);

    const aoa = [
        [company],
        [registerTitle],
        ['Cash & Bank Register Statement'],
        [],
        ['Register', registerTitle],
        ['Account', accountLabel],
        ['Period', `${header?.from || '—'}  to  ${header?.to || '—'}`],
        ['Currency', currency],
        ...(header?.filterNote ? [['View', header.filterNote]] : []),
        [],
        ['Summary'],
        ['Opening Balance', Number(sum.openingBalance ?? 0)],
        ['Total Receipts (IN)', Number(sum.totalReceipts ?? 0)],
        ['Total Payments (OUT)', Number(sum.totalPayments ?? 0)],
        ['Closing Balance', Number(sum.closingBalance ?? 0)],
        [],
        ['Date', 'COA / Register', 'Description', 'Reference', `IN (${currency})`, `OUT (${currency})`, `Balance (${currency})`],
        ['—', '—', 'Opening balance', '—', '', '', Number(sum.openingBalance ?? 0)],
        ...exportRows.map((r) => [
            r.date,
            r.coaRegister,
            r.description,
            r.reference,
            r.inAmt > 0 ? Number(r.inAmt) : '',
            r.outAmt > 0 ? Number(r.outAmt) : '',
            Number(r.balance ?? 0),
        ]),
        ['—', '—', 'Closing balance', '—', '', '', Number(sum.closingBalance ?? 0)],
        [],
        ['Generated', new Date().toLocaleString()],
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [
        { wch: 14 },
        { wch: 36 },
        { wch: 40 },
        { wch: 16 },
        { wch: 14 },
        { wch: 14 },
        { wch: 16 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Register');
    XLSX.writeFile(wb, `${buildFileBase({ header })}.xlsx`);
}
