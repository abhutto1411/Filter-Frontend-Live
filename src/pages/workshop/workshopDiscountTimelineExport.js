import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

function fmtMoney(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return '0.00';
    return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDt(iso) {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString();
    } catch {
        return '—';
    }
}

function formatFilterRange(dateFrom, dateTo) {
    const from = dateFrom?.trim() ? fmtDt(dateFrom) : 'Beginning';
    const to = dateTo?.trim() ? fmtDt(dateTo) : 'Now';
    return `${from} → ${to}`;
}

/**
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} [opts.branchName]
 * @param {string} [opts.departmentName]
 * @param {string} [opts.dateFrom]
 * @param {string} [opts.dateTo]
 * @param {number} opts.recordCount
 * @param {number} [opts.invoiceCount]
 * @param {number} opts.totalAmount
 * @param {Array<object>} opts.rows
 */
export function exportDiscountTimelinePdf({
    title,
    branchName = 'All branches',
    departmentName = 'All departments',
    dateFrom = '',
    dateTo = '',
    recordCount = 0,
    invoiceCount,
    totalAmount = 0,
    rows = [],
}) {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const margin = 40;
    let y = margin;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text(title || 'Discount timeline', margin, y);
    y += 22;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    const meta = [
        `Branch: ${branchName}`,
        `Department: ${departmentName}`,
        `Period: ${formatFilterRange(dateFrom, dateTo)}`,
        `Generated: ${new Date().toLocaleString()}`,
    ];
    meta.forEach((line) => {
        doc.text(line, margin, y);
        y += 12;
    });
    y += 8;

    const cardW = (doc.internal.pageSize.getWidth() - margin * 2 - 24) / 3;
    const cardH = 44;
    const cards = [
        { label: 'RECORDS', value: String(recordCount) },
        { label: 'INVOICES', value: String(invoiceCount ?? recordCount) },
        { label: 'TOTAL DISCOUNT (SAR)', value: fmtMoney(totalAmount) },
    ];
    cards.forEach((card, i) => {
        const x = margin + i * (cardW + 12);
        doc.setDrawColor(226, 232, 240);
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(x, y, cardW, cardH, 4, 4, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(card.label, x + 10, y + 14);
        doc.setFontSize(12);
        doc.setTextColor(15, 23, 42);
        doc.text(card.value, x + 10, y + 32);
    });
    y += cardH + 18;

    const body = (rows || []).map((entry) => [
        fmtDt(entry.at),
        String(entry.invoiceNo || '—'),
        String(entry.customerName || '—'),
        String(entry.branchName || '—'),
        [
            entry.label || '—',
            entry.departmentName ? `· ${entry.departmentName}` : '',
        ]
            .join(' ')
            .trim(),
        fmtMoney(entry.amount),
    ]);

    autoTable(doc, {
        startY: y,
        head: [['Date / time', 'Invoice #', 'Customer', 'Branch', 'Detail', 'Amount (SAR)']],
        body,
        margin: { left: margin, right: margin, bottom: 36 },
        styles: {
            font: 'helvetica',
            fontSize: 8,
            cellPadding: 5,
            textColor: [15, 23, 42],
            lineColor: [226, 232, 240],
        },
        headStyles: {
            fillColor: [248, 250, 252],
            textColor: [15, 23, 42],
            fontStyle: 'bold',
            fontSize: 7.5,
        },
        alternateRowStyles: { fillColor: [252, 252, 253] },
        columnStyles: {
            0: { cellWidth: 100 },
            1: { cellWidth: 72 },
            2: { cellWidth: 110 },
            3: { cellWidth: 80 },
            4: { cellWidth: 'auto' },
            5: { cellWidth: 72, halign: 'right', fontStyle: 'bold' },
        },
    });

    const pageCount = doc.getNumberOfPages();
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    for (let i = 1; i <= pageCount; i += 1) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(`Page ${i} of ${pageCount}`, pageW - margin, pageH - 18, { align: 'right' });
    }

    const filename = `${safeFileSlug(title)}-${stamp()}.pdf`;
    doc.save(filename);
}
