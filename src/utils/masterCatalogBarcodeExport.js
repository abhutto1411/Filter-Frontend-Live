import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import JsBarcode from 'jsbarcode';

function pdfSafeText(value, fallback = '—') {
    const s = String(value ?? '').trim();
    if (!s) return fallback;
    const latin = s
        .replace(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    return latin || fallback;
}

function stampDate() {
    return new Date().toISOString().slice(0, 10);
}

function formatPrice(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    return `SAR ${n.toFixed(2)}`;
}

export function barcodePngDataUrl(value, { height = 72, width = 1.8 } = {}) {
    const code = String(value ?? '').trim();
    if (!code) return null;
    const canvas = document.createElement('canvas');
    const isEan13 = /^\d{13}$/.test(code);
    try {
        JsBarcode(canvas, code, {
            format: isEan13 ? 'EAN13' : 'CODE128',
            displayValue: false,
            margin: 6,
            height,
            width,
            background: '#ffffff',
            lineColor: '#111111',
        });
        return canvas.toDataURL('image/png');
    } catch {
        return null;
    }
}

function withBarcodes(rows) {
    return (rows || []).filter((r) => r && String(r.barcode || '').trim());
}

/**
 * List PDF: name, price, barcode number, barcode image.
 */
export async function exportMasterBarcodeListPdf({ rows, t }) {
    const items = withBarcodes(rows);
    if (!items.length) {
        throw new Error(t('barcode.export.none'));
    }

    const images = items.map((r) => barcodePngDataUrl(r.barcode, { height: 64, width: 1.6 }));
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const margin = 36;
    const pageW = doc.internal.pageSize.getWidth();

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(t('barcode.export.listTitle'), margin, 40);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(t('barcode.export.listSub', { n: items.length, date: stampDate() }), margin, 56);
    doc.setTextColor(0);

    autoTable(doc, {
        startY: 68,
        margin: { left: margin, right: margin, bottom: 36 },
        head: [[
            t('barcode.th.name'),
            t('barcode.th.price'),
            t('barcode.th.number'),
            t('barcode.th.visual'),
        ]],
        body: items.map((r) => [
            pdfSafeText(r.name, String(r.id || '—')),
            formatPrice(r.salePrice),
            String(r.barcode).trim(),
            '',
        ]),
        styles: {
            font: 'helvetica',
            fontSize: 8,
            cellPadding: 6,
            minCellHeight: 46,
            valign: 'middle',
            overflow: 'linebreak',
        },
        headStyles: {
            fillColor: [249, 250, 251],
            textColor: [55, 65, 81],
            fontStyle: 'bold',
            fontSize: 8,
        },
        columnStyles: {
            0: { cellWidth: 180 },
            1: { cellWidth: 72 },
            2: { cellWidth: 110, font: 'courier', fontSize: 8 },
            3: { cellWidth: pageW - margin * 2 - 180 - 72 - 110 },
        },
        didDrawCell: (data) => {
            if (data.section !== 'body' || data.column.index !== 3) return;
            const img = images[data.row.index];
            if (!img) return;
            const pad = 4;
            const maxW = data.cell.width - pad * 2;
            const maxH = data.cell.height - pad * 2;
            const drawW = Math.min(120, maxW);
            const drawH = Math.min(32, maxH);
            const x = data.cell.x + (data.cell.width - drawW) / 2;
            const y = data.cell.y + (data.cell.height - drawH) / 2;
            try {
                doc.addImage(img, 'PNG', x, y, drawW, drawH, undefined, 'FAST');
            } catch {
                /* skip broken image */
            }
        },
    });

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i += 1) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(140);
        doc.text(
            t('barcode.export.page', { n: i, m: pageCount }),
            pageW - margin,
            doc.internal.pageSize.getHeight() - 16,
            { align: 'right' },
        );
        doc.setTextColor(0);
    }

    doc.save(`barcode-list-${stampDate()}.pdf`);
}

/**
 * Sticker sheet: name on top, barcode, number below. Repeats `quantity` times per product
 * and packs 3×8 labels per A4 page.
 */
export async function exportMasterBarcodeStickerPdf({ rows, quantity, t }) {
    const items = withBarcodes(rows);
    const qty = Math.min(500, Math.max(1, Math.round(Number(quantity) || 0)));
    if (!items.length) {
        throw new Error(t('barcode.export.none'));
    }

    const stickers = [];
    for (const item of items) {
        for (let i = 0; i < qty; i += 1) stickers.push(item);
    }

    const imageByCode = new Map();
    for (const item of items) {
        const code = String(item.barcode).trim();
        if (!imageByCode.has(code)) {
            imageByCode.set(code, barcodePngDataUrl(code, { height: 56, width: 1.5 }));
        }
    }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = 210;
    const pageH = 297;
    const marginX = 5;
    const marginY = 6;
    const cols = 3;
    const rowsPerPage = 8;
    const gapX = 0.8;
    const gapY = 0.8;
    const stickerW = (pageW - marginX * 2 - gapX * (cols - 1)) / cols;
    const stickerH = (pageH - marginY * 2 - gapY * (rowsPerPage - 1)) / rowsPerPage;
    const perPage = cols * rowsPerPage;

    stickers.forEach((item, index) => {
        if (index > 0 && index % perPage === 0) doc.addPage();
        const slot = index % perPage;
        const col = slot % cols;
        const row = Math.floor(slot / cols);
        const x = marginX + col * (stickerW + gapX);
        const y = marginY + row * (stickerH + gapY);
        drawSticker(doc, {
            x,
            y,
            w: stickerW,
            h: stickerH,
            name: pdfSafeText(item.name, String(item.id || 'Product')),
            barcode: String(item.barcode).trim(),
            image: imageByCode.get(String(item.barcode).trim()),
        });
    });

    doc.save(`barcode-stickers-${stampDate()}.pdf`);
}

function drawSticker(doc, { x, y, w, h, name, barcode, image }) {
    doc.setDrawColor(200);
    doc.setLineWidth(0.2);
    doc.rect(x, y, w, h);

    const pad = 1.2;
    const innerW = w - pad * 2;
    let cursorY = y + pad + 3.2;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(17);
    const lines = doc.splitTextToSize(name, innerW);
    const nameLines = lines.slice(0, 2);
    doc.text(nameLines, x + w / 2, cursorY, { align: 'center' });
    cursorY += nameLines.length * 3.2 + 0.8;

    const imgH = Math.min(12, h - (cursorY - y) - 6);
    const imgW = Math.min(innerW, imgH * 3.2);
    if (image && imgH > 6) {
        try {
            doc.addImage(image, 'PNG', x + (w - imgW) / 2, cursorY, imgW, imgH, undefined, 'FAST');
        } catch {
            /* skip */
        }
    }
    cursorY += imgH + 1.6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(55);
    doc.text(barcode, x + w / 2, Math.min(y + h - pad - 1.5, cursorY), { align: 'center' });
    doc.setTextColor(0);
}
