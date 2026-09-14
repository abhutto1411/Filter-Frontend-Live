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

function fmtDelta(d) {
    if (!Number.isFinite(Number(d))) return '';
    const n = Number(d);
    if (n > 0) return `+${fmtQty(n)}`;
    return fmtQty(n);
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
    const drawHeaders = () => {
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
    drawHeaders();
    for (const row of rows) {
        const wrapped = row.map((text, i) =>
            pdf.splitTextToSize(text == null ? '' : String(text), colW[i] - 4),
        );
        const rowH = Math.max(lineH, ...wrapped.map((lines) => lines.length * (lineH - 2)));
        if (y + rowH > pageH - margin) {
            pdf.addPage();
            y = margin;
            drawHeaders();
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

export function exportStorageMovementsExcel(entries, filenameBase = 'storage-stock-movements') {
    const headers = [
        'When',
        'Product',
        'From',
        'To',
        'Change',
        'Reason',
        'Source / Ref',
    ];
    const rows = (entries || []).map((e) => [
        new Date(e.at).toLocaleString(),
        e.productLabel || '',
        `${fmtQty(e.previousQty)} ${e.unit || ''}`.trim(),
        `${fmtQty(e.newQty)} ${e.unit || ''}`.trim(),
        `${fmtDelta(e.delta)} ${e.unit || ''}`.trim(),
        e.reason || '',
        e.sourceRef || '',
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Movements');
    XLSX.writeFile(wb, `${safeFileSlug(filenameBase)}-${stamp()}.xlsx`);
}

export function exportStorageMovementsPdf(entries, filenameBase = 'storage-stock-movements') {
    const headers = ['When', 'Product', 'From', 'To', 'Change', 'Reason', 'Source / Ref'];
    const colW = [100, 110, 52, 52, 52, 140, 120];
    const body = (entries || []).map((e) => [
        new Date(e.at).toLocaleString(),
        String(e.productLabel || ''),
        `${fmtQty(e.previousQty)} ${e.unit || ''}`,
        `${fmtQty(e.newQty)} ${e.unit || ''}`,
        `${fmtDelta(e.delta)} ${e.unit || ''}`,
        String(e.reason || '').slice(0, 60),
        String(e.sourceRef || '').slice(0, 40),
    ]);
    downloadTablePdf({
        title: 'Storage facility — stock movements',
        subtitle: `${body.length} movement(s)`,
        headers,
        colWidthsPt: colW,
        rows: body,
        filenameBase,
    });
}
