import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';

const OPENING_QTY = 'Opening qty';
const INFINITE_QTY = 'Infinite qty';

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

function isInfiniteEntry(e) {
    if (!e) return false;
    const reason = String(e.reason ?? '').trim();
    const source = String(e.source ?? '').toLowerCase();
    return (
        reason === INFINITE_QTY ||
        source === 'manual_infinite_qty' ||
        e.isInfiniteQty === true ||
        e.affectsInfinite === true
    );
}

function humanizeSource(source) {
    const s = String(source || 'manual').toLowerCase();
    if (s === 'manual_opening_qty') return 'Manual (opening qty)';
    if (s === 'manual_infinite_qty') return 'Manual (infinite qty)';
    if (s === 'supplier_purchase_invoice') return 'Supplier purchase (approved)';
    if (s === 'local_supplier_purchase_invoice') return 'Non-affiliated supplier purchase';
    if (s === 'supplier_purchase_return') return 'Supplier purchase return';
    if (s === 'local_supplier_purchase_return') return 'Non-affiliated purchase return';
    if (s === 'super_admin_starting_stock') return 'Super admin (opening stock)';
    if (s === 'pos') return 'POS';
    if (s === 'purchase_receipt') return 'Purchase receipt';
    return s.replace(/_/g, ' ');
}

function humanizeReferenceType(type) {
    const t = String(type || '').toLowerCase();
    if (t === 'workshop_supplier_purchase_invoice') return 'Workshop purchase invoice';
    if (t === 'workshop_local_supplier_purchase_invoice') return 'Workshop local purchase invoice';
    if (t === 'workshop_local_supplier_purchase_return') return 'Workshop local debit note';
    return t.replace(/_/g, ' ');
}

export function formatWorkshopTimelineSourceRef(e) {
    if (!e) return '—';
    const base = humanizeSource(e.source);
    if (e.reference?.id || (e.reference?.type && e.reference.type !== 'manual')) {
        const parts = [base];
        if (e.reference?.type) parts.push(humanizeReferenceType(e.reference.type));
        if (e.reference?.invoiceNumber) parts.push(`#${e.reference.invoiceNumber}`);
        else if (e.reference?.id) parts.push(`#${e.reference.id}`);
        return parts.filter(Boolean).join(' · ');
    }
    return base;
}

function fmtQtyPlain(n) {
    if (n == null || !Number.isFinite(Number(n))) return '';
    const x = Number(n);
    if (Math.abs(x - Math.round(x)) < 1e-9) return String(Math.round(x));
    return String(x.toFixed(3)).replace(/\.?0+$/, '');
}

function fmtEntryQty(entry, which) {
    if (isInfiniteEntry(entry) && which === 'new') return '∞';
    const val = which === 'new' ? entry.newQty : entry.previousQty;
    return val == null ? '—' : fmtQtyPlain(val);
}

function fmtEntryDelta(entry) {
    if (isInfiniteEntry(entry)) return '—';
    const d = entry.delta;
    if (d == null || !Number.isFinite(Number(d))) return '';
    const n = Number(d);
    if (n > 0) return `+${fmtQtyPlain(n)}`;
    return fmtQtyPlain(n);
}

function timelineRowsForExport(entries) {
    return (entries || []).map((e) => [
        new Date(e.at).toLocaleString(),
        fmtEntryQty(e, 'previous'),
        fmtEntryQty(e, 'new'),
        fmtEntryDelta(e),
        String(e.reason || ''),
        formatWorkshopTimelineSourceRef(e),
        e.adjustedBy?.name || e.adjustedBy?.id || '',
    ]);
}

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
        const wrapped = cells.map((text, i) => pdf.splitTextToSize(text, colW[i] - 4));
        const rowH = Math.max(lineH, ...wrapped.map((lines) => lines.length * (lineH - 2)));

        if (y + rowH > pageH - margin) {
            pdf.addPage();
            y = margin;
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'bold');
            pdf.text(`${title} (continued)`, margin, y);
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

/**
 * @param {{ name?: string; sku?: string; openingQty?: number | string }} product
 * @param {Record<string, unknown>[]} entries
 * @param {{ branchName?: string; filenameBase?: string }} [opts]
 */
export function exportWorkshopTimelineExcel(product, entries, opts = {}) {
    const headers = ['When', 'From', 'To', 'Delta', 'Reason', 'Source / Ref', 'By'];
    const rows = timelineRowsForExport(entries);
    const sku = product?.sku && product.sku !== '-' ? String(product.sku) : '';
    const meta = [
        ['Product', product?.name || ''],
        ['SKU', sku],
        ['Branch', opts.branchName || ''],
        [],
        headers,
    ];
    const ws = XLSX.utils.aoa_to_sheet([...meta, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Timeline');
    const base = opts.filenameBase || `workshop-timeline-${product?.name || 'product'}`;
    XLSX.writeFile(wb, `${safeFileSlug(base)}-${stamp()}.xlsx`);
}

/**
 * @param {{ name?: string; sku?: string; openingQty?: number | string }} product
 * @param {Record<string, unknown>[]} entries
 * @param {{ branchName?: string; filenameBase?: string }} [opts]
 */
export function exportWorkshopTimelinePdf(product, entries, opts = {}) {
    const headers = ['When', 'From', 'To', 'Delta', 'Reason', 'Source / Ref', 'By'];
    const colW = [110, 44, 44, 44, 110, 220, 80];
    const rows = timelineRowsForExport(entries);
    const sku = product?.sku && product.sku !== '-' ? String(product.sku) : '—';
    const branch = opts.branchName ? ` · Branch: ${opts.branchName}` : '';
    const sub = `Product: ${product?.name || '—'} · SKU: ${sku}${branch} · ${rows.length} row(s)`;
    const base = opts.filenameBase || `workshop-timeline-${product?.name || 'product'}`;
    downloadTablePdf({
        title: 'Inventory stock timeline',
        subtitle: sub,
        headers,
        colWidthsPt: colW,
        rows,
        filenameBase: base,
    });
}
