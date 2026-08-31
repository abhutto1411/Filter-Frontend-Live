import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { wiT } from '../../utils/workshopInventoryI18n';


function resolveExportT(labels) {
    if (labels?.t) return labels.t;
    const locale = labels?.locale || 'en';
    return (key, vars) => wiT(locale, key, vars);
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

function fmtQtyPlain(value, isInfiniteQty = false, t) {
    if (isInfiniteQty) return t ? t('export.unlimited') : 'Unlimited';
    if (value == null || value === '') return '';
    const n = Number(value);
    if (!Number.isFinite(n)) return '';
    if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
    return String(n.toFixed(3)).replace(/\.?0+$/, '');
}

function inventoryUomLabel(item) {
    if (item?.uomProfileName) return String(item.uomProfileName);
    const rule = String(item?.conversionRule || '').trim();
    if (rule && rule !== '—') return rule;
    return String(item?.workshopUnit || item?.unit || 'pcs');
}

function inventoryStockQty(item, t) {
    if (item?.isInfiniteQty) return t ? t('export.unlimited') : 'Unlimited';
    const qty = fmtQtyPlain(item?.qty, false, t);
    if (!qty) return '0';
    const unit = String(item?.workshopUnit || item?.unit || '').trim();
    return unit ? `${qty} ${unit}` : qty;
}

function inventoryStatusLabel(item, t) {
    if (!t) {
        if (item?.status === 'Requested') return 'Requested';
        if (item?.isInfiniteQty) return 'Unlimited';
        const qty = Number(item?.qty) || 0;
        const crit = Number(item?.critical_level) || 0;
        if (qty <= 0) return 'Out of Stock';
        if (crit > 0 && qty <= crit) return 'Low Stock';
        return 'In Stock';
    }
    if (item?.status === 'Requested') return t('status.requested');
    if (item?.isInfiniteQty) return t('status.unlimited');
    const qty = Number(item?.qty) || 0;
    const crit = Number(item?.critical_level) || 0;
    if (qty <= 0) return t('status.outOfStock');
    if (crit > 0 && qty <= crit) return t('status.lowStock');
    return t('status.inStock');
}

/** jsPDF default Helvetica cannot render Arabic — keep Latin text only for PDF cells. */
function pdfSafeText(value, fallback = '—') {
    const s = String(value ?? '').trim();
    if (!s) return fallback;
    const latin = s
        .replace(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (latin) return latin;
    return fallback;
}

function fmtMoney(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return '—';
    return x.toLocaleString('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function workshopInventoryLineValueSar(item) {
    if (item?.isInfiniteQty) return 0;
    const qty = Number(item?.qty) || 0;
    const price = Number(item?.purchasePrice) || 0;
    return qty * price;
}

function excelHeaders(t) {
    return [
        t('export.excelProduct'),
        t('export.excelSku'),
        t('export.excelDepartment'),
        t('export.excelCategory'),
        t('export.excelOpening'),
        t('export.excelCurrent'),
        t('export.excelCritical'),
        t('export.excelUom'),
        t('export.excelPurchase'),
        t('export.excelStatus'),
        t('export.excelLineValue'),
        t('export.excelBranch'),
    ];
}

/** Full row set for Excel export. */
function inventoryRowsForExcel(items, t) {
    return (items || []).map((item) => {
        const opening =
            item.openingQty != null && item.openingQty !== ''
                ? fmtQtyPlain(item.openingQty, false, t)
                : '';
        const critical =
            Number(item.critical_level) > 0 ? fmtQtyPlain(item.critical_level, false, t) : '';
        const purchasePrice = Number(item.purchasePrice) || 0;
        const lineValue = workshopInventoryLineValueSar(item);
        const stock =
            item?.stockDisplayPrimary && item.stockDisplaySecondary != null
                ? `${item.stockDisplayPrimary} (${item.stockDisplaySecondary})`
                : inventoryStockQty(item, t);
        return [
            item.name || '',
            item.sku || '',
            item.departmentName || '',
            item.categoryName || '',
            opening,
            stock,
            critical,
            inventoryUomLabel(item),
            purchasePrice,
            inventoryStatusLabel(item, t),
            lineValue,
            item.branchName || '',
        ];
    });
}

/** Compact row set for PDF — fewer columns, clearer labels. */
function inventoryRowsForPdf(items, t) {
    return (items || []).map((item) => {
        const opening =
            item.openingQty != null && item.openingQty !== ''
                ? fmtQtyPlain(item.openingQty, false, t)
                : '—';
        const critical =
            Number(item.critical_level) > 0 ? fmtQtyPlain(item.critical_level, false, t) : '—';
        return {
            product: pdfSafeText(item.name),
            sku: pdfSafeText(item.sku, '—'),
            department: pdfSafeText(item.departmentName, '—'),
            category: pdfSafeText(item.categoryName, '—'),
            opening,
            stock: pdfSafeText(inventoryStockQty(item, t), '0'),
            critical,
            cost: fmtMoney(item.purchasePrice),
            status: inventoryStatusLabel(item, t),
            value: fmtMoney(workshopInventoryLineValueSar(item)),
        };
    });
}

function pdfColumns(t) {
    return [
        { key: 'product', label: t('export.excelProduct'), width: 198, align: 'left' },
        { key: 'sku', label: t('export.excelSku'), width: 52, align: 'left' },
        { key: 'department', label: t('export.excelDepartment'), width: 82, align: 'left' },
        { key: 'category', label: t('export.excelCategory'), width: 72, align: 'left' },
        { key: 'opening', label: t('export.pdfOpening'), width: 44, align: 'right' },
        { key: 'stock', label: t('export.pdfOnHand'), width: 58, align: 'right' },
        { key: 'critical', label: t('export.pdfCritical'), width: 44, align: 'right' },
        { key: 'cost', label: t('export.pdfCost'), width: 54, align: 'right' },
        { key: 'status', label: t('export.pdfStatus'), width: 56, align: 'left' },
        { key: 'value', label: t('export.pdfValue'), width: 54, align: 'right' },
    ];
}

function downloadWorkshopInventoryPdf({ title, meta, rows, totalValue, filenameBase, t }) {
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const marginX = 32;
    const marginTop = 28;
    const marginBottom = 34;
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const contentW = pageW - marginX * 2;
    const lineH = 11;
    const cellPadX = 4;
    const cellPadY = 5;
    const headerBg = [241, 245, 249];
    const zebraBg = [248, 250, 252];
    const borderColor = [203, 213, 225];
    const mutedColor = [100, 116, 139];
    const PDF_COLUMNS = pdfColumns(t);

    const sumColW = PDF_COLUMNS.reduce((s, c) => s + c.width, 0);
    const scale = sumColW > contentW ? contentW / sumColW : 1;
    const colW = PDF_COLUMNS.map((c) => c.width * scale);

    let pageNum = 1;

    const drawPageFooter = () => {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7.5);
        pdf.setTextColor(...mutedColor);
        pdf.text(t('export.page', { n: pageNum }), pageW - marginX, pageH - 14, { align: 'right' });
        pdf.text(t('export.footerBrand'), marginX, pageH - 14);
        pdf.setTextColor(0, 0, 0);
    };

    const drawTitleBlock = (continued = false) => {
        let y = marginTop;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(continued ? 11 : 15);
        pdf.text(continued ? t('export.continued', { title }) : title, marginX, y);
        y += continued ? 16 : 18;

        if (!continued) {
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(9);
            pdf.setTextColor(...mutedColor);
            const branch = meta.branchName || '—';
            const exported = new Date().toLocaleString();
            pdf.text(t('export.branchLine', { branch }), marginX, y);
            y += 12;
            pdf.text(t('export.exportedLine', { when: exported, count: rows.length }), marginX, y);
            y += 14;
            pdf.setTextColor(0, 0, 0);
        }
        return y + (continued ? 4 : 0);
    };

    const measureCellLines = (text, width, fontSize) => {
        pdf.setFontSize(fontSize);
        return pdf.splitTextToSize(String(text ?? ''), Math.max(width - cellPadX * 2, 8));
    };

    const drawTableHeader = (startY) => {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7.5);
        let headerH = 0;
        const wrappedHeaders = PDF_COLUMNS.map((col, i) => {
            const lines = measureCellLines(col.label, colW[i], 7.5);
            headerH = Math.max(headerH, lines.length * lineH + cellPadY * 2);
            return lines;
        });

        pdf.setFillColor(...headerBg);
        pdf.setDrawColor(...borderColor);
        pdf.rect(marginX, startY, contentW, headerH, 'FD');

        let x = marginX;
        wrappedHeaders.forEach((lines, i) => {
            const col = PDF_COLUMNS[i];
            const textX = col.align === 'right' ? x + colW[i] - cellPadX : x + cellPadX;
            pdf.text(lines, textX, startY + cellPadY + lineH - 2, {
                align: col.align === 'right' ? 'right' : 'left',
                maxWidth: colW[i] - cellPadX * 2,
            });
            if (i > 0) {
                pdf.line(x, startY, x, startY + headerH);
            }
            x += colW[i];
        });
        pdf.line(marginX + contentW, startY, marginX + contentW, startY + headerH);

        return startY + headerH;
    };

    const drawDataRow = (row, startY, rowIndex) => {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        let rowH = 0;
        const wrappedCells = PDF_COLUMNS.map((col, i) => {
            const lines = measureCellLines(row[col.key], colW[i], 8);
            rowH = Math.max(rowH, lines.length * lineH + cellPadY * 2);
            return { lines, col, i };
        });

        if (rowIndex % 2 === 1) {
            pdf.setFillColor(...zebraBg);
            pdf.rect(marginX, startY, contentW, rowH, 'F');
        }

        pdf.setDrawColor(...borderColor);
        pdf.line(marginX, startY + rowH, marginX + contentW, startY + rowH);

        let x = marginX;
        wrappedCells.forEach(({ lines, col, i }) => {
            if (i > 0) pdf.line(x, startY, x, startY + rowH);
            const textX = col.align === 'right' ? x + colW[i] - cellPadX : x + cellPadX;
            pdf.text(lines, textX, startY + cellPadY + lineH - 2, {
                align: col.align === 'right' ? 'right' : 'left',
                maxWidth: colW[i] - cellPadX * 2,
            });
            x += colW[i];
        });
        pdf.line(marginX + contentW, startY, marginX + contentW, startY + rowH);

        return startY + rowH;
    };

    let y = drawTitleBlock(false);
    y = drawTableHeader(y);

    rows.forEach((row, idx) => {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        const estLines = PDF_COLUMNS.map((col, i) =>
            measureCellLines(row[col.key], colW[i], 8).length,
        );
        const estH = Math.max(...estLines) * lineH + cellPadY * 2;

        if (y + estH > pageH - marginBottom) {
            drawPageFooter();
            pdf.addPage();
            pageNum += 1;
            y = drawTitleBlock(true);
            y = drawTableHeader(y);
        }
        y = drawDataRow(row, y, idx);
    });

    if (y + 28 > pageH - marginBottom) {
        drawPageFooter();
        pdf.addPage();
        pageNum += 1;
        y = drawTitleBlock(true);
    }

    y += 10;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.text(t('export.totalLineValue', { amount: fmtMoney(totalValue) }), marginX, y);
    y += 12;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(...mutedColor);
    pdf.text(t('export.lineValueNote'), marginX, y);
    pdf.setTextColor(0, 0, 0);

    drawPageFooter();
    pdf.save(`${safeFileSlug(filenameBase)}-${stamp()}.pdf`);
}

/**
 * @param {Record<string, unknown>[]} items — selected workshop inventory rows
 * @param {{ branchName?: string; subtitle?: string }} [meta]
 * @param {string} [filenameBase]
 */
export function exportWorkshopInventoryExcel(
    items,
    meta = {},
    filenameBase = 'workshop-inventory',
) {
    const t = resolveExportT(meta.labels);
    const rows = inventoryRowsForExcel(items, t);
    const metaRows = [
        [t('export.metaBranch'), meta.branchName || '—'],
        [t('export.metaExported'), new Date().toLocaleString()],
        [t('export.metaProducts'), String(rows.length)],
        [],
    ];
    const ws = XLSX.utils.aoa_to_sheet([...metaRows, excelHeaders(t), ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t('export.sheetInventory'));
    XLSX.writeFile(wb, `${safeFileSlug(filenameBase)}-${stamp()}.xlsx`);
}

/**
 * @param {Record<string, unknown>[]} items
 * @param {{ branchName?: string; subtitle?: string }} [meta]
 * @param {string} [filenameBase]
 */
export function exportWorkshopInventoryPdf(
    items,
    meta = {},
    filenameBase = 'workshop-inventory',
) {
    const t = resolveExportT(meta.labels);
    const rows = inventoryRowsForPdf(items, t);
    const totalValue = (items || []).reduce(
        (sum, item) => sum + workshopInventoryLineValueSar(item),
        0,
    );
    downloadWorkshopInventoryPdf({
        title: t('export.titleInventory'),
        meta,
        rows,
        totalValue,
        filenameBase,
        t,
    });
}

/** Products with on-hand stock > 0, or unlimited-stock mode. */
export function workshopInventoryHasStock(item) {
    if (!item) return false;
    if (item.isInfiniteQty) return true;
    return (Number(item.qty) || 0) > 0;
}
