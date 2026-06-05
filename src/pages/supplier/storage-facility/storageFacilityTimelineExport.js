import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';

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
    if (!Number.isFinite(Number(n))) return '';
    const x = Number(n);
    if (Math.abs(x - Math.round(x)) < 1e-9) return String(Math.round(x));
    return String(x.toFixed(3)).replace(/\.?0+$/, '');
}

function downloadTablePdf({ title, subtitle, headers, colWidthsPt, rows, filenameBase }) {
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const margin = 36;
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const lineH = 13;
    let y = margin;

    pdf.setFontSize(13);
    pdf.setFont('helvetica', 'bold');
    pdf.text(title, margin, y);
    y += lineH + 4;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    if (subtitle) {
        const subLines = pdf.splitTextToSize(subtitle, pageW - margin * 2);
        pdf.text(subLines, margin, y);
        y += subLines.length * (lineH - 2) + 6;
    }

    const sumW = colWidthsPt.reduce((a, b) => a + b, 0);
    const scale = sumW > pageW - margin * 2 ? (pageW - margin * 2) / sumW : 1;
    const colW = colWidthsPt.map((w) => w * scale);

    const drawColumnHeaders = () => {
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'bold');
        let x = margin;
        headers.forEach((h, i) => {
            pdf.text(String(h), x + 2, y + lineH - 3);
            x += colW[i];
        });
        y += lineH + 2;
        pdf.setFont('helvetica', 'normal');
    };

    drawColumnHeaders();

    for (const row of rows) {
        const wrapped = row.map((text, i) =>
            pdf.splitTextToSize(text == null ? '' : String(text), colW[i] - 4),
        );
        const rowH = Math.max(
            lineH,
            ...wrapped.map((lines) => lines.length * (lineH - 2)),
        );
        if (y + rowH > pageH - margin) {
            pdf.addPage();
            y = margin;
            drawColumnHeaders();
        }
        let x = margin;
        pdf.setFontSize(7.5);
        wrapped.forEach((lines, i) => {
            pdf.text(lines, x + 2, y + lineH - 3);
            x += colW[i];
        });
        y += rowH + 2;
    }

    pdf.save(`${safeFileSlug(filenameBase)}-${stamp()}.pdf`);
}

/** Manager.io-style inventory timeline export */
export function exportStorageTimelineExcel(product, rows, kpis, filenameBase) {
    const headers = [
        'Date',
        'Transaction',
        'Reference',
        'Inventory Item',
        'Qty owned',
        'Balance',
    ];
    const dataRows = (rows || []).map((r) => [
        r.dateDisplay || r.date,
        r.transaction,
        r.reference,
        r.inventoryItem || product?.name || '',
        fmtQty(r.qtyOwned),
        fmtQty(r.balance),
    ]);
    const meta = [
        ['Product', product?.name || ''],
        ['SKU', product?.sku || ''],
        ['Total Stock IN', fmtQty(kpis?.totalStockIn)],
        ['Total Stock OUT', fmtQty(kpis?.totalStockOut)],
        [
            `Closing balance as of ${kpis?.asOfDate || ''}`,
            fmtQty(kpis?.closingBalance),
        ],
        [],
        headers,
    ];
    const ws = XLSX.utils.aoa_to_sheet([...meta, ...dataRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Timeline');
    XLSX.writeFile(wb, `${safeFileSlug(filenameBase)}-${stamp()}.xlsx`);
}

export function exportStorageTimelinePdf(product, rows, kpis, filenameBase) {
    const headers = [
        'Date',
        'Transaction',
        'Reference',
        'Inventory Item',
        'Qty owned',
        'Balance',
    ];
    const colW = [56, 200, 90, 120, 56, 56];
    const body = (rows || []).map((r) => [
        r.dateDisplay || r.date,
        String(r.transaction || '').slice(0, 80),
        String(r.reference || ''),
        String(r.inventoryItem || product?.name || ''),
        fmtQty(r.qtyOwned),
        fmtQty(r.balance),
    ]);
    const sub = `Product: ${product?.name || '—'} · IN: ${fmtQty(kpis?.totalStockIn)} · OUT: ${fmtQty(kpis?.totalStockOut)} · Closing (${kpis?.asOfDate}): ${fmtQty(kpis?.closingBalance)}`;
    downloadTablePdf({
        title: 'Inventory Items — Qty owned',
        subtitle: sub,
        headers,
        colWidthsPt: colW,
        rows: body,
        filenameBase,
    });
}
