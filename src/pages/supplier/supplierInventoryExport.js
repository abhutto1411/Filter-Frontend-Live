import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import {
    formatSupplierTimelineSourceRef,
    warehouseStockLineValueSar,
} from './supplierInventoryTimelineUtils';

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

function locationsSummary(row) {
    const locs = row?.byLocation || [];
    if (!locs.length) return '';
    return locs
        .map(
            (l) =>
                `${l.locationName || '—'}: ${
                    l.quantityWorkshopUnits ?? l.quantityWarehouseUnits ?? ''
                }`,
        )
        .join(' | ');
}

function fmtQtyPlain(n) {
    if (n == null || !Number.isFinite(Number(n))) return '';
    const x = Number(n);
    if (Math.abs(x - Math.round(x)) < 1e-9) return String(Math.round(x));
    return String(x.toFixed(3)).replace(/\.?0+$/, '');
}

function fmtDeltaPlain(d) {
    if (d == null || !Number.isFinite(Number(d))) return '';
    const n = Number(d);
    if (n > 0) return `+${fmtQtyPlain(n)}`;
    return fmtQtyPlain(n);
}

/**
 * @param {string} title
 * @param {string} [subtitle]
 * @param {string[]} headers
 * @param {number[]} colWidthsPt – must sum to ≤ usable width (landscape A4 ≈ 770)
 * @param {string[][]} rows
 * @param {string} filenameBase
 */
function downloadTablePdf({ title, subtitle, headers, colWidthsPt, rows, filenameBase }) {
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const margin = 36;
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const lineH = 13;
    let y = margin;

    const drawHeaderBlock = () => {
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
        } else {
            y += 4;
        }
    };

    drawHeaderBlock();

    const sumW = colWidthsPt.reduce((a, b) => a + b, 0);
    const scale = sumW > pageW - margin * 2 ? (pageW - margin * 2) / sumW : 1;
    const colW = colWidthsPt.map((w) => w * scale);

    const drawColumnHeaders = () => {
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'bold');
        let x = margin;
        headers.forEach((h, i) => {
            const lines = pdf.splitTextToSize(String(h), colW[i] - 4);
            pdf.text(lines, x + 2, y + lineH - 3);
            x += colW[i];
        });
        y += lineH + 2;
        pdf.setFont('helvetica', 'normal');
    };

    drawColumnHeaders();

    for (const row of rows) {
        const cells = row.map((c) => (c == null ? '' : String(c)));
        const wrapped = cells.map((text, i) =>
            pdf.splitTextToSize(text, colW[i] - 4),
        );
        const rowH = Math.max(
            lineH,
            ...wrapped.map((lines) => lines.length * (lineH - 2)),
        );

        if (y + rowH > pageH - margin) {
            pdf.addPage();
            y = margin;
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'bold');
            pdf.text(title + ' (continued)', margin, y);
            y += lineH + 6;
            pdf.setFont('helvetica', 'normal');
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

/** @param {Record<string, unknown>[]} stockRows — same shape as SupplierStockInventory `stock` / filtered rows */
export function exportStockInventoryExcel(stockRows, filenameBase = 'supplier-stock-inventory') {
    const headers = [
        'Product',
        'SKU',
        'Unit',
        'Stock Qty',
        'Critical Level',
        'Reorder Level',
        'Unit Price (SAR)',
        'Line Value (SAR)',
        'Status',
        'By location',
    ];
    const rows = (stockRows || []).map((s) => {
        const qtyWh = Number(s.warehouseQty ?? s.qty) || 0;
        const critLevel = Number(s.criticalLevel ?? 0);
        const reorder = s.reorder != null && s.reorder !== '' ? Number(s.reorder) : '';
        const price = Number(s.price) || 0;
        const value = warehouseStockLineValueSar(s);
        const isCritical = (Number(s.warehouseQty ?? s.qty) || 0) <= critLevel;
        const sku =
            !s.sku || s.sku === '-' ? '' : String(s.sku);
        return [
            s.name || '',
            sku,
            s.warehouseUnit || s.unit || '',
            qtyWh,
            s.criticalLevel != null ? critLevel : '',
            reorder === '' ? '' : reorder,
            price,
            value,
            isCritical ? 'Critical' : 'OK',
            locationsSummary(s),
        ];
    });
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock');
    XLSX.writeFile(wb, `${safeFileSlug(filenameBase)}-${stamp()}.xlsx`);
}

/** @param {Record<string, unknown>[]} entries — timeline-shaped rows like `movementEntries` */
export function exportMovementsExcel(entries, filenameBase = 'supplier-stock-movements') {
    const headers = ['When', 'Product', 'From', 'To', 'Delta', 'Reason', 'Source / Ref', 'By'];
    const rows = (entries || []).map((e) => [
        new Date(e.at).toLocaleString(),
        e.productLabel || '',
        fmtQtyPlain(e.previousQty),
        fmtQtyPlain(e.newQty),
        fmtDeltaPlain(e.delta),
        e.reason || '',
        formatSupplierTimelineSourceRef(e),
        e.adjustedBy?.name || '',
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Movements');
    XLSX.writeFile(wb, `${safeFileSlug(filenameBase)}-${stamp()}.xlsx`);
}

/**
 * @param {{ name?: string; sku?: string }} product
 * @param {Record<string, unknown>[]} entries
 */
export function exportTimelineExcel(product, entries, filenameBase = 'supplier-stock-timeline') {
    const headers = ['When', 'From', 'To', 'Delta', 'Reason', 'Source / Ref', 'By'];
    const rows = (entries || []).map((e) => [
        new Date(e.at).toLocaleString(),
        fmtQtyPlain(e.previousQty),
        fmtQtyPlain(e.newQty),
        fmtDeltaPlain(e.delta),
        e.reason || '',
        formatSupplierTimelineSourceRef(e),
        e.adjustedBy?.name || '',
    ]);
    const sku = product?.sku && product.sku !== '-' ? String(product.sku) : '';
    const meta = [['Product', product?.name || ''], ['SKU', sku], [], headers];
    const ws = XLSX.utils.aoa_to_sheet([...meta, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Timeline');
    XLSX.writeFile(wb, `${safeFileSlug(filenameBase)}-${stamp()}.xlsx`);
}

/** @param {Record<string, unknown>[]} stockRows */
export function exportStockInventoryPdf(stockRows, filenameBase = 'supplier-stock-inventory') {
    const headers = ['Product', 'SKU', 'Unit', 'Qty', 'Critical', 'Reorder', 'Price', 'Value', 'Status', 'Locations'];
    const colW = [130, 58, 32, 36, 40, 40, 48, 52, 42, 192];
    const rows = (stockRows || []).map((s) => {
        const qtyWh = Number(s.warehouseQty ?? s.qty) || 0;
        const critLevel = Number(s.criticalLevel ?? 0);
        const price = Number(s.price) || 0;
        const value = warehouseStockLineValueSar(s);
        const sku = !s.sku || s.sku === '-' ? '' : String(s.sku);
        const isCritical = qtyWh <= critLevel;
        return [
            String(s.name || ''),
            sku,
            String(s.warehouseUnit || s.unit || ''),
            fmtQtyPlain(qtyWh),
            s.criticalLevel != null ? fmtQtyPlain(critLevel) : '—',
            s.reorder != null ? fmtQtyPlain(s.reorder) : '—',
            price.toFixed(2),
            value.toFixed(2),
            isCritical ? 'Critical' : 'OK',
            locationsSummary(s) || '—',
        ];
    });
    downloadTablePdf({
        title: 'Stock inventory',
        subtitle: `Exported ${rows.length} row(s) · SAR line value uses unit price × workshop qty`,
        headers,
        colWidthsPt: colW,
        rows,
        filenameBase,
    });
}

/** @param {Record<string, unknown>[]} entries */
export function exportMovementsPdf(entries, filenameBase = 'supplier-stock-movements') {
    const headers = ['When', 'Product', 'From', 'To', 'Delta', 'Reason', 'Source / Ref', 'By'];
    const colW = [100, 120, 36, 36, 40, 100, 180, 72];
    const rows = (entries || []).map((e) => [
        new Date(e.at).toLocaleString(),
        String(e.productLabel || ''),
        fmtQtyPlain(e.previousQty),
        fmtQtyPlain(e.newQty),
        fmtDeltaPlain(e.delta),
        String(e.reason || ''),
        formatSupplierTimelineSourceRef(e),
        e.adjustedBy?.name || '—',
    ]);
    downloadTablePdf({
        title: 'Stock movements',
        subtitle: `Exported ${rows.length} movement(s)`,
        headers,
        colWidthsPt: colW,
        rows,
        filenameBase,
    });
}

/**
 * @param {{ name?: string; sku?: string }} product
 * @param {Record<string, unknown>[]} entries
 */
export function exportTimelinePdf(product, entries, filenameBase = 'supplier-stock-timeline') {
    const headers = ['When', 'From', 'To', 'Delta', 'Reason', 'Source / Ref', 'By'];
    const colW = [110, 44, 44, 44, 110, 220, 80];
    const rows = (entries || []).map((e) => [
        new Date(e.at).toLocaleString(),
        fmtQtyPlain(e.previousQty),
        fmtQtyPlain(e.newQty),
        fmtDeltaPlain(e.delta),
        String(e.reason || ''),
        formatSupplierTimelineSourceRef(e),
        e.adjustedBy?.name || '—',
    ]);
    const sub = `Product: ${product?.name || '—'} · SKU: ${product?.sku && product.sku !== '-' ? product.sku : '—'} · ${rows.length} row(s)`;
    downloadTablePdf({
        title: 'Inventory stock timeline',
        subtitle: sub,
        headers,
        colWidthsPt: colW,
        rows,
        filenameBase,
    });
}

/**
 * Affiliated workshop / branch AR-style transaction ledger (SupplierAffiliatedWorkshops modal).
 *
 * @param {Array<{ raw: Record<string, unknown>; debit?: number | null; credit?: number | null; balance: number; currencyCode?: string }>} lines
 */
export function exportAffiliatedTransactionLedgerExcel(
    lines,
    filenameBase = 'supplier-affiliated-transaction-log',
) {
    const headers = [
        'When',
        'Type',
        'Title',
        'Description',
        'Debt (Dr)',
        'Credit (Cr)',
        'Balance',
        'Currency',
    ];
    const rows = (lines || []).map((line) => {
        const t = line.raw || {};
        return [
            new Date(String(t.createdAt)).toLocaleString(),
            String(t.transactionType || ''),
            String(t.title || ''),
            String(t.description || '').trim(),
            line.debit != null && Number.isFinite(Number(line.debit)) ? Number(line.debit) : '',
            line.credit != null && Number.isFinite(Number(line.credit)) ? Number(line.credit) : '',
            Number.isFinite(Number(line.balance)) ? Number(line.balance) : '',
            String(line.currencyCode || 'SAR'),
        ];
    });
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
    XLSX.writeFile(wb, `${safeFileSlug(filenameBase)}-${stamp()}.xlsx`);
}

/**
 * @param {Array<{ raw: Record<string, unknown>; debit?: number | null; credit?: number | null; balance: number; currencyCode?: string }>} lines
 * @param {string} [subtitle]
 */
export function exportAffiliatedTransactionLedgerPdf(
    lines,
    subtitle,
    filenameBase = 'supplier-affiliated-transaction-log',
) {
    const fmtLedgerCell = (value, cc) => {
        if (value == null || Number.isNaN(Number(value))) return '—';
        const amt = Number(value).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
        return `${amt} ${cc || 'SAR'}`;
    };
    const headers = ['When', 'Type', 'Title', 'Debt (Dr)', 'Credit (Cr)', 'Balance'];
    const colW = [105, 75, 220, 78, 78, 86];
    const rows = (lines || []).map((line) => {
        const t = line.raw || {};
        const cc = line.currencyCode || 'SAR';
        const desc = String(t.description || '').trim();
        const titleBlock = desc ? `${String(t.title || '')}\n${desc}` : String(t.title || '');
        return [
            new Date(String(t.createdAt)).toLocaleString(),
            String(t.transactionType || ''),
            titleBlock,
            line.debit != null ? fmtLedgerCell(line.debit, cc) : '—',
            line.credit != null ? fmtLedgerCell(line.credit, cc) : '—',
            fmtLedgerCell(line.balance, cc),
        ];
    });
    downloadTablePdf({
        title: 'Transaction log',
        subtitle: subtitle || '',
        headers,
        colWidthsPt: colW,
        rows,
        filenameBase,
    });
}
