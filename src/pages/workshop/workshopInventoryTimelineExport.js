import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { wiT, wiReasonLabel } from '../../utils/workshopInventoryI18n';

const OPENING_QTY = 'Opening qty';
const INFINITE_QTY = 'Infinite qty';

function resolveExportT(labels) {
    if (labels?.t) return labels.t;
    const locale = labels?.locale || 'en';
    return (key, vars) => wiT(locale, key, vars);
}

function humanizeSource(source, t) {
    const s = String(source || 'manual').toLowerCase();
    if (s === 'manual_opening_qty') return t('source.manualOpening');
    if (s === 'manual_infinite_qty') return t('source.manualInfinite');
    if (s === 'supplier_purchase_invoice') return t('source.supplierPurchase');
    if (s === 'local_supplier_purchase_invoice') return t('source.localSupplierPurchase');
    if (s === 'supplier_purchase_return') return t('source.supplierReturn');
    if (s === 'local_supplier_purchase_return') return t('source.localReturn');
    if (s === 'super_admin_starting_stock') return t('source.superAdmin');
    if (s === 'pos') return t('source.pos');
    if (s === 'purchase_receipt') return t('source.purchaseReceipt');
    return s.replace(/_/g, ' ');
}

function humanizeReferenceType(type, t) {
    const ty = String(type || '').toLowerCase();
    if (ty === 'workshop_supplier_purchase_invoice') return t('ref.wpi');
    if (ty === 'workshop_local_supplier_purchase_invoice') return t('ref.localWpi');
    if (ty === 'workshop_local_supplier_purchase_return') return t('ref.localDebit');
    return ty.replace(/_/g, ' ');
}

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

export function formatWorkshopTimelineSourceRef(e, t) {
    const translate = t || ((k) => wiT('en', k));
    if (!e) return translate('emdash');
    const base = humanizeSource(e.source, translate);
    if (e.reference?.id || (e.reference?.type && e.reference.type !== 'manual')) {
        const parts = [base];
        if (e.reference?.type) parts.push(humanizeReferenceType(e.reference.type, translate));
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

function timelineRowsForExport(entries, t, locale) {
    return (entries || []).map((e) => [
        new Date(e.at).toLocaleString(),
        fmtEntryQty(e, 'previous'),
        fmtEntryQty(e, 'new'),
        fmtEntryDelta(e),
        wiReasonLabel(locale || 'en', e.reason),
        formatWorkshopTimelineSourceRef(e, t),
        e.adjustedBy?.name || e.adjustedBy?.id || '',
    ]);
}

function downloadTablePdf({ title, subtitle, headers, colWidthsPt, rows, filenameBase, continuedLabel }) {
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
            pdf.text(continuedLabel || `${title} (continued)`, margin, y);
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
    const t = resolveExportT(opts.labels);
    const locale = opts.labels?.locale || 'en';
    const headers = [
        t('export.timelineWhen'),
        t('export.timelineFrom'),
        t('export.timelineTo'),
        t('export.timelineDelta'),
        t('export.timelineReason'),
        t('export.timelineSource'),
        t('export.timelineBy'),
    ];
    const rows = timelineRowsForExport(entries, t, locale);
    const sku = product?.sku && product.sku !== '-' ? String(product.sku) : '';
    const meta = [
        [t('export.metaProduct'), product?.name || ''],
        [t('export.metaSku'), sku],
        [t('export.metaBranch'), opts.branchName || ''],
        [],
        headers,
    ];
    const ws = XLSX.utils.aoa_to_sheet([...meta, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t('export.sheetTimeline'));
    const base = opts.filenameBase || `workshop-timeline-${product?.name || 'product'}`;
    XLSX.writeFile(wb, `${safeFileSlug(base)}-${stamp()}.xlsx`);
}

/**
 * @param {{ name?: string; sku?: string; openingQty?: number | string }} product
 * @param {Record<string, unknown>[]} entries
 * @param {{ branchName?: string; filenameBase?: string }} [opts]
 */
export function exportWorkshopTimelinePdf(product, entries, opts = {}) {
    const t = resolveExportT(opts.labels);
    const locale = opts.labels?.locale || 'en';
    const headers = [
        t('export.timelineWhen'),
        t('export.timelineFrom'),
        t('export.timelineTo'),
        t('export.timelineDelta'),
        t('export.timelineReason'),
        t('export.timelineSource'),
        t('export.timelineBy'),
    ];
    const colW = [110, 44, 44, 44, 110, 220, 80];
    const rows = timelineRowsForExport(entries, t, locale);
    const sku = product?.sku && product.sku !== '-' ? String(product.sku) : '—';
    const branch = opts.branchName ? t('export.branchPart', { branch: opts.branchName }) : '';
    const sub = t('export.subtitleTimeline', {
        name: product?.name || '—',
        sku,
        branch,
        count: rows.length,
    });
    const base = opts.filenameBase || `workshop-timeline-${product?.name || 'product'}`;
    downloadTablePdf({
        title: t('export.titleTimeline'),
        subtitle: sub,
        headers,
        colWidthsPt: colW,
        rows,
        filenameBase: base,
        continuedLabel: t('export.continued', { title: t('export.titleTimeline') }),
    });
}
