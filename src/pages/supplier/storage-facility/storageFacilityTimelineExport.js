import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const MARGIN = 40;
const PAGE_FOOTER_RESERVE = 28;

const COLORS = {
    ink: [15, 23, 42],
    muted: [100, 116, 139],
    border: [226, 232, 240],
    headerBg: [248, 250, 252],
    inGreen: [21, 128, 61],
    outAmber: [180, 83, 9],
    negRed: [220, 38, 38],
    posGreen: [21, 128, 61],
    cardBg: [255, 255, 255],
};

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

function fmtQty(n) {
    if (!Number.isFinite(Number(n))) return '—';
    const x = Number(n);
    if (Math.abs(x - Math.round(x)) < 1e-9) return String(Math.round(x));
    return String(x.toFixed(3)).replace(/\.?0+$/, '');
}

function fmtQtyWithUnit(n, unit = '') {
    const q = fmtQty(n);
    if (q === '—') return q;
    return unit ? `${q} ${unit}` : q;
}

function fmtQtyDelta(n) {
    const q = fmtQty(n);
    if (q === '—') return q;
    const num = Number(n);
    if (num > 0) return `+${q}`;
    return q;
}

function formatDisplayDate(ymd) {
    if (!ymd) return '—';
    const s = String(ymd).slice(0, 10);
    const [y, m, d] = s.split('-');
    if (!y || !m || !d) return s;
    return `${d}/${m}/${y}`;
}

function generatedAtLabel() {
    return new Date().toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function drawKpiCard(doc, { x, y, w, h, label, value, sublabel, valueColor }) {
    doc.setDrawColor(...COLORS.border);
    doc.setFillColor(...COLORS.cardBg);
    doc.setLineWidth(0.75);
    doc.roundedRect(x, y, w, h, 6, 6, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...COLORS.muted);
    doc.text(label, x + 12, y + 18);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...(valueColor || COLORS.ink));
    doc.text(value, x + 12, y + 40);

    if (sublabel) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...COLORS.muted);
        doc.text(sublabel, x + 12, y + h - 10);
    }
}

function addPageFooters(doc) {
    const pageCount = doc.getNumberOfPages();
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    for (let i = 1; i <= pageCount; i += 1) {
        doc.setPage(i);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...COLORS.muted);
        doc.text(`Generated ${generatedAtLabel()}`, MARGIN, pageH - 16);
        doc.text(`Page ${i} of ${pageCount}`, pageW - MARGIN, pageH - 16, { align: 'right' });
    }
}

/**
 * @param {object} opts
 * @param {string} [opts.brandName]
 * @param {string} [opts.dateFrom]
 * @param {string} [opts.dateTo]
 * @param {string} [opts.unit]
 * @param {string} [opts.qtyColLabel]
 * @param {string} [opts.balanceColLabel]
 */
function buildTimelinePdf({
    product,
    rows,
    kpis,
    filenameBase,
    options = {},
}) {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const contentW = pageW - MARGIN * 2;
    let y = MARGIN;

    const unit = options.unit || product?.unit || '';
    const asOfDate = kpis?.asOfDate || options.asOfDate || '';
    const qtyLabel = options.qtyColLabel || (unit ? `Qty owned (${unit})` : 'Qty owned');
    const balanceLabel = options.balanceColLabel || (unit ? `Balance (${unit})` : 'Balance');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(...COLORS.ink);
    doc.text('Inventory Items — Qty owned', MARGIN, y);
    y += 22;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.muted);
    const metaLines = [
        options.brandName ? `Storage brand: ${options.brandName}` : null,
        `Product: ${product?.name || '—'}`,
        product?.sku ? `SKU: ${product.sku}` : null,
        options.dateFrom || options.dateTo
            ? `Period: ${formatDisplayDate(options.dateFrom)} to ${formatDisplayDate(options.dateTo)}`
            : null,
        asOfDate ? `Closing as of: ${formatDisplayDate(asOfDate)}` : null,
    ].filter(Boolean);
    metaLines.forEach((line, i) => {
        doc.text(line, MARGIN, y + i * 13);
    });
    y += metaLines.length * 13 + 14;

    const cardGap = 12;
    const cardH = 58;
    const cardW = (contentW - cardGap * 2) / 3;
    drawKpiCard(doc, {
        x: MARGIN,
        y,
        w: cardW,
        h: cardH,
        label: 'TOTAL STOCK IN',
        value: fmtQtyWithUnit(kpis?.totalStockIn, unit),
        valueColor: COLORS.inGreen,
    });
    drawKpiCard(doc, {
        x: MARGIN + cardW + cardGap,
        y,
        w: cardW,
        h: cardH,
        label: 'TOTAL STOCK OUT',
        value: fmtQtyWithUnit(kpis?.totalStockOut, unit),
        valueColor: COLORS.outAmber,
    });
    drawKpiCard(doc, {
        x: MARGIN + (cardW + cardGap) * 2,
        y,
        w: cardW,
        h: cardH,
        label: 'CLOSING BALANCE',
        value: fmtQtyWithUnit(kpis?.closingBalance, unit),
        sublabel: asOfDate ? `as of ${asOfDate}` : '',
        valueColor: COLORS.ink,
    });
    y += cardH + 18;

    const headers = ['Date', 'Transaction', 'Reference', 'Inventory Item', qtyLabel, balanceLabel];
    const body = (rows || []).map((r) => [
        r.dateDisplay || formatDisplayDate(r.date) || '—',
        String(r.transaction || '—'),
        String(r.reference || '—'),
        String(r.inventoryItem || product?.name || '—'),
        fmtQtyDelta(r.qtyOwned),
        fmtQty(r.balance),
    ]);

    const qtyColIndex = 4;

    autoTable(doc, {
        startY: y,
        head: [headers],
        body,
        margin: { left: MARGIN, right: MARGIN, bottom: PAGE_FOOTER_RESERVE },
        styles: {
            font: 'helvetica',
            fontSize: 8.5,
            cellPadding: { top: 6, right: 6, bottom: 6, left: 6 },
            textColor: COLORS.ink,
            lineColor: COLORS.border,
            lineWidth: 0.5,
            overflow: 'linebreak',
            valign: 'middle',
        },
        headStyles: {
            fillColor: COLORS.headerBg,
            textColor: COLORS.ink,
            fontStyle: 'bold',
            fontSize: 8,
        },
        alternateRowStyles: { fillColor: [252, 252, 253] },
        columnStyles: {
            0: { cellWidth: 62 },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 88 },
            3: { cellWidth: 110 },
            4: { cellWidth: 72, halign: 'right', fontStyle: 'bold' },
            5: { cellWidth: 72, halign: 'right' },
        },
        didParseCell(data) {
            if (data.section !== 'body' || data.column.index !== qtyColIndex) return;
            const raw = (rows || [])[data.row.index]?.qtyOwned;
            const n = Number(raw);
            if (!Number.isFinite(n) || n === 0) return;
            data.cell.styles.textColor = n < 0 ? COLORS.negRed : COLORS.posGreen;
        },
    });

    addPageFooters(doc);
    doc.save(`${safeFileSlug(filenameBase)}-${stamp()}.pdf`);
}

/** Manager.io-style inventory timeline export */
export function exportStorageTimelineExcel(product, rows, kpis, filenameBase, options = {}) {
    const unit = options.unit || product?.unit || '';
    const headers = [
        'Date',
        'Transaction',
        'Reference',
        'Inventory Item',
        options.qtyColLabel || (unit ? `Qty owned (${unit})` : 'Qty owned'),
        options.balanceColLabel || (unit ? `Balance (${unit})` : 'Balance'),
    ];
    const dataRows = (rows || []).map((r) => [
        r.dateDisplay || r.date,
        r.transaction,
        r.reference,
        r.inventoryItem || product?.name || '',
        fmtQtyDelta(r.qtyOwned),
        fmtQty(r.balance),
    ]);
    const meta = [
        options.brandName ? ['Storage brand', options.brandName] : null,
        ['Product', product?.name || ''],
        ['SKU', product?.sku || ''],
        options.dateFrom || options.dateTo
            ? [
                  'Period',
                  `${formatDisplayDate(options.dateFrom)} to ${formatDisplayDate(options.dateTo)}`,
              ]
            : null,
        ['Total Stock IN', fmtQtyWithUnit(kpis?.totalStockIn, unit)],
        ['Total Stock OUT', fmtQtyWithUnit(kpis?.totalStockOut, unit)],
        [
            `Closing balance as of ${kpis?.asOfDate || options.asOfDate || ''}`,
            fmtQtyWithUnit(kpis?.closingBalance, unit),
        ],
        [],
        headers,
    ].filter(Boolean);
    const ws = XLSX.utils.aoa_to_sheet([...meta, ...dataRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Timeline');
    XLSX.writeFile(wb, `${safeFileSlug(filenameBase)}-${stamp()}.xlsx`);
}

export function exportStorageTimelinePdf(product, rows, kpis, filenameBase, options = {}) {
    buildTimelinePdf({ product, rows, kpis, filenameBase, options });
}
