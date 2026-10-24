import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

function money(n) {
    return Number(n || 0).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function qty(n) {
    const x = Number(n || 0);
    if (Math.abs(x - Math.round(x)) < 1e-9) return String(Math.round(x));
    return x.toLocaleString('en-US', { maximumFractionDigits: 3 });
}

function stampFile() {
    return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
}

function safeFileSlug(s) {
    return (
        String(s || 'purchase-price-report')
            .replace(/[^\w.-]+/g, '_')
            .replace(/^_|_$/g, '')
            .slice(0, 72) || 'purchase-price-report'
    );
}

function generatedAt() {
    return new Date().toLocaleString('en-GB', {
        timeZone: 'Asia/Riyadh',
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function buildPurchasePriceReportExportPayload({
    lines = [],
    filters = {},
    summary = {},
}) {
    const rows = (Array.isArray(lines) ? lines : []).map((r, idx) => ({
        no: idx + 1,
        product: r.sku ? `${r.productName} (${r.sku})` : r.productName || '—',
        vendor: r.vendorName || '—',
        invoiceNo: r.invoiceNo || '—',
        purchaseDate: r.purchaseDate || '—',
        qty: Number(r.qty || 0),
        unit: r.unit || 'pcs',
        unitPrice: Number(r.unitPrice || 0),
        lineTotal: Number(r.lineTotal || 0),
        vatAmount: Number(r.vatAmount || 0),
        grandTotal: Number(r.grandTotal || 0),
    }));
    const totals = {
        lineCount: Number(summary.lineCount ?? rows.length),
        totalQty: Number(
            (summary.totalQty ?? rows.reduce((s, r) => s + r.qty, 0)).toFixed(3),
        ),
        totalLine: Number(rows.reduce((s, r) => s + r.lineTotal, 0).toFixed(2)),
        totalVat: Number(rows.reduce((s, r) => s + r.vatAmount, 0).toFixed(2)),
        totalSpend: Number(
            (summary.totalAmount ?? rows.reduce((s, r) => s + r.grandTotal, 0)).toFixed(2),
        ),
    };
    return {
        title: 'Purchase Price Report',
        subtitle: 'Super-supplier purchases — filtered results',
        generatedAt: generatedAt(),
        filters: {
            dateFrom: filters.dateFrom || 'All dates',
            dateTo: filters.dateTo || 'All dates',
            vendor: filters.vendor || 'All super suppliers',
            products: filters.products || 'All products',
        },
        rows,
        totals,
    };
}

export function exportPurchasePriceReportPdf(input) {
    const data = buildPurchasePriceReportExportPayload(input);
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 28;

    doc.setFillColor(17, 24, 39);
    doc.rect(0, 0, pageW, 62, 'F');
    doc.setFillColor(245, 158, 11);
    doc.rect(0, 62, pageW, 4, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Filter Supplier Portal', margin, 26);
    doc.setFontSize(12);
    doc.text(data.title, margin, 46);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(data.subtitle, pageW - margin, 26, { align: 'right' });
    doc.text(`Generated ${data.generatedAt} (Asia/Riyadh)`, pageW - margin, 46, {
        align: 'right',
    });

    let y = 82;
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Applied filters', margin, y);
    y += 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    const filterLines = [
        `From: ${data.filters.dateFrom}    To: ${data.filters.dateTo}`,
        `Super supplier: ${data.filters.vendor}`,
        `Products: ${data.filters.products}`,
    ];
    filterLines.forEach((line) => {
        const wrapped = doc.splitTextToSize(line, pageW - margin * 2);
        doc.text(wrapped, margin, y);
        y += wrapped.length * 12;
    });
    y += 10;
    const kpiY = y;
    const kpis = [
        ['Lines', String(data.totals.lineCount)],
        ['Qty', qty(data.totals.totalQty)],
        ['Line total (ex VAT)', `SAR ${money(data.totals.totalLine)}`],
        ['VAT', `SAR ${money(data.totals.totalVat)}`],
        ['Spend (inc. VAT)', `SAR ${money(data.totals.totalSpend)}`],
    ];
    const kpiW = (pageW - margin * 2 - 16) / kpis.length;
    kpis.forEach((kpi, i) => {
        const x = margin + i * (kpiW + 4);
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(x, kpiY, kpiW, 36, 4, 4, 'FD');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(kpi[0], x + 8, kpiY + 14);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.text(kpi[1], x + 8, kpiY + 28);
    });

    const body = data.rows.map((r) => [
        String(r.no),
        r.product,
        r.vendor,
        r.invoiceNo,
        r.purchaseDate,
        qty(r.qty),
        r.unit,
        money(r.unitPrice),
        money(r.lineTotal),
        money(r.vatAmount),
        money(r.grandTotal),
    ]);
    body.push([
        '',
        'TOTAL',
        '',
        '',
        '',
        qty(data.totals.totalQty),
        '',
        '',
        money(data.totals.totalLine),
        money(data.totals.totalVat),
        money(data.totals.totalSpend),
    ]);

    autoTable(doc, {
        startY: kpiY + 48,
        head: [[
            '#',
            'Product',
            'Vendor',
            'Invoice #',
            'Purchase date',
            'Qty',
            'Unit',
            'Unit price ex VAT (SAR)',
            'Line total ex VAT (SAR)',
            'VAT (SAR)',
            'Grand total inc. VAT (SAR)',
        ]],
        body,
        margin: { left: margin, right: margin, bottom: 36 },
        tableWidth: pageW - margin * 2,
        styles: {
            font: 'helvetica',
            fontSize: 7.5,
            cellPadding: 3.5,
            overflow: 'linebreak',
            valign: 'middle',
            textColor: [15, 23, 42],
            lineColor: [226, 232, 240],
            lineWidth: 0.4,
        },
        headStyles: {
            fillColor: [31, 41, 55],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 7,
            halign: 'center',
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
            0: { cellWidth: 20, halign: 'center' },
            3: { cellWidth: 50, textColor: [234, 88, 12] },
            4: { cellWidth: 58, halign: 'center' },
            5: { cellWidth: 30, halign: 'right' },
            6: { cellWidth: 34, halign: 'center' },
            7: { cellWidth: 64, halign: 'right' },
            8: { cellWidth: 68, halign: 'right' },
            9: { cellWidth: 48, halign: 'right' },
            10: { cellWidth: 70, halign: 'right', fontStyle: 'bold' },
        },
        didParseCell(hook) {
            if (hook.section === 'body' && hook.row.index === body.length - 1) {
                hook.cell.styles.fontStyle = 'bold';
                hook.cell.styles.fillColor = [255, 247, 237];
                hook.cell.styles.textColor = [15, 23, 42];
            }
        },
        didDrawPage(hook) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            doc.text(
                'Confidential — Filter Supplier Portal',
                margin,
                pageH - 16,
            );
            doc.text(
                `Page ${hook.pageNumber} of ${doc.getNumberOfPages()}`,
                pageW - margin,
                pageH - 16,
                { align: 'right' },
            );
        },
    });

    doc.save(`${safeFileSlug('purchase-price-report')}-${stampFile()}.pdf`);
    return data;
}

export function exportPurchasePriceReportExcel(input) {
    const data = buildPurchasePriceReportExportPayload(input);
    const header = [
        ['Filter Supplier Portal'],
        [data.title],
        [data.subtitle],
        [`Generated ${data.generatedAt} (Asia/Riyadh)`],
        [],
        ['Applied filters'],
        ['From', data.filters.dateFrom],
        ['To', data.filters.dateTo],
        ['Super supplier', data.filters.vendor],
        ['Products', data.filters.products],
        [],
        ['Lines', data.totals.lineCount],
        ['Qty', data.totals.totalQty],
        ['Line total without VAT (SAR)', data.totals.totalLine],
        ['VAT (SAR)', data.totals.totalVat],
        ['Spend inc. VAT (SAR)', data.totals.totalSpend],
        [],
        [
            '#',
            'Product',
            'Vendor',
            'Invoice #',
            'Purchase date',
            'Qty',
            'Unit',
            'Unit price without VAT (SAR)',
            'Line total without VAT (SAR)',
            'VAT (SAR)',
            'Grand total Inc. VAT (SAR)',
        ],
    ];
    const table = data.rows.map((r) => [
        r.no,
        r.product,
        r.vendor,
        r.invoiceNo,
        r.purchaseDate,
        r.qty,
        r.unit,
        r.unitPrice,
        r.lineTotal,
        r.vatAmount,
        r.grandTotal,
    ]);
    table.push([
        '',
        'TOTAL',
        '',
        '',
        '',
        data.totals.totalQty,
        '',
        '',
        data.totals.totalLine,
        data.totals.totalVat,
        data.totals.totalSpend,
    ]);

    const ws = XLSX.utils.aoa_to_sheet([...header, ...table]);
    ws['!cols'] = [
        { wch: 5 },
        { wch: 36 },
        { wch: 32 },
        { wch: 14 },
        { wch: 14 },
        { wch: 10 },
        { wch: 10 },
        { wch: 18 },
        { wch: 20 },
        { wch: 12 },
        { wch: 22 },
    ];
    ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 10 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 10 } },
        { s: { r: 3, c: 0 }, e: { r: 3, c: 10 } },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Purchase Price Report');
    XLSX.writeFile(wb, `${safeFileSlug('purchase-price-report')}-${stampFile()}.xlsx`);
    return data;
}
