import React, {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
} from 'react';
import { Download } from 'lucide-react';
import QRCode from 'qrcode';
import { buildZatcaPhase2QrPayloadFromInvoice } from '../../utils/zatcaQr';
import './WorkshopPurchaseInvoiceView.css';

/** Capture width tuned to A4 portrait (595.28pt page at 96dpi). */
export const WPI_PDF_CAPTURE_WIDTH = 750;

const WPI_PDF_MARGIN_PT = 8;

async function waitForCaptureImages(root) {
    if (!root) return;
    const imgs = root.querySelectorAll('img');
    await Promise.all(
        [...imgs].map((img) =>
            img.complete
                ? Promise.resolve()
                : new Promise((resolve) => {
                      img.addEventListener('load', resolve, { once: true });
                      img.addEventListener('error', resolve, { once: true });
                  }),
        ),
    );
    if (document.fonts?.ready) {
        await document.fonts.ready.catch(() => {});
    }
    await new Promise((r) => setTimeout(r, 80));
}

/** Shrink-wrap height — avoids inflated scrollHeight from watermark / fixed mounts. */
function measureCaptureHeight(el) {
    if (!el) return 1;
    const prevHeight = el.style.height;
    const prevMinHeight = el.style.minHeight;
    el.style.height = 'auto';
    el.style.minHeight = '0';
    void el.offsetHeight;
    const h = Math.ceil(el.getBoundingClientRect().height);
    el.style.height = prevHeight;
    el.style.minHeight = prevMinHeight;
    return Math.max(h, 1);
}

function collectPageBreakCandidates(captureEl, captureWidth) {
    if (!captureEl) return [];
    const rect = captureEl.getBoundingClientRect();
    const scale = captureWidth / Math.max(rect.width || 1, 1);
    const top = rect.top;
    const points = new Set();

    const pushBottom = (node) => {
        if (!node) return;
        const box = node.getBoundingClientRect();
        const y = Math.round((box.bottom - top) * scale);
        if (y > 0) points.add(y);
    };
    const pushTop = (node) => {
        if (!node) return;
        const box = node.getBoundingClientRect();
        const y = Math.round((box.top - top) * scale);
        if (y > 0) points.add(y);
    };

    const bodyRows = [...captureEl.querySelectorAll('.wpi-view__table-wrap tbody tr')];
    bodyRows.forEach((row, idx) => {
        if (idx > 0) pushTop(row);
    });
    [
        '.wpi-view__bottom-grid',
        '.wpi-view__panel',
        '.wpi-view__closing-row',
        '.wpi-view__corp-footer',
    ].forEach((selector) => {
        const node = captureEl.querySelector(selector);
        pushTop(node);
        pushBottom(node);
    });

    return [...points].sort((a, b) => a - b);
}

function collectTableRowBands(captureEl, captureWidth) {
    if (!captureEl) return [];
    const rect = captureEl.getBoundingClientRect();
    const scale = captureWidth / Math.max(rect.width || 1, 1);
    const top = rect.top;
    return [...captureEl.querySelectorAll('.wpi-view__table-wrap tbody tr')]
        .map((row) => {
            const box = row.getBoundingClientRect();
            return {
                top: Math.round((box.top - top) * scale),
                bottom: Math.round((box.bottom - top) * scale),
            };
        })
        .filter((band) => band.bottom > band.top);
}

/** Split invoice raster across A4 pages without shrinking long invoices to one page. */
async function buildA4PdfFromPng(imgData, dims, breakCandidates = [], rowBands = []) {
    const { jsPDF } = await import('jspdf');
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const margin = WPI_PDF_MARGIN_PT;
    const usableW = pageWidth - margin * 2;
    const usableH = pageHeight - margin * 2;
    const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait', compress: true });
    const img = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Invalid PNG from capture'));
        image.src = imgData;
    });

    const scale = usableW / dims.w;
    const pageSliceHeightPx = Math.max(1, Math.floor(usableH / scale));
    const displayW = usableW;
    // Leave a slightly larger safety gap before a new row starts.
    // DOM row measurements and rasterized PNG pixels can differ by a few pixels.
    const breakGapPx = 6;

    let offsetYpx = 0;
    let isFirstPage = true;
    while (offsetYpx < dims.h) {
        let contentHeightPx = Math.min(pageSliceHeightPx, dims.h - offsetYpx);
        const targetBottom = offsetYpx + contentHeightPx;
        const crossingRow = rowBands.find(
            (band) => band.top > offsetYpx && band.top < targetBottom && band.bottom > targetBottom,
        );
        const minPreferredBottom = offsetYpx + Math.floor(pageSliceHeightPx * 0.82);
        const preferredBreak = breakCandidates.find((point) => point > targetBottom);
        const candidate = breakCandidates
            .filter((point) => point > minPreferredBottom && point <= targetBottom)
            .pop();
        if (crossingRow) {
            contentHeightPx = Math.max(1, crossingRow.top - offsetYpx - breakGapPx);
        } else if (candidate) {
            contentHeightPx = Math.max(1, candidate - offsetYpx - breakGapPx);
        } else if (preferredBreak && preferredBreak - offsetYpx < Math.floor(pageSliceHeightPx * 1.04)) {
            contentHeightPx = Math.max(1, preferredBreak - offsetYpx - breakGapPx);
        }
        contentHeightPx = Math.max(1, Math.min(contentHeightPx, dims.h - offsetYpx));
        const drawHeightPx = Math.min(dims.h - offsetYpx, contentHeightPx);
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = dims.w;
        sliceCanvas.height = drawHeightPx;
        const ctx = sliceCanvas.getContext('2d');
        if (!ctx) {
            throw new Error('Could not create PDF page canvas');
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
        ctx.drawImage(
            img,
            0,
            offsetYpx,
            dims.w,
            drawHeightPx,
            0,
            0,
            dims.w,
            drawHeightPx,
        );

        if (!isFirstPage) pdf.addPage();
        const displayH = drawHeightPx * scale;
        pdf.addImage(
            sliceCanvas.toDataURL('image/png'),
            'PNG',
            margin,
            margin,
            displayW,
            displayH,
            undefined,
            'FAST',
        );

        offsetYpx += contentHeightPx;
        isFirstPage = false;
    }
    return pdf;
}

function sumNodeHeights(nodes) {
    return (nodes || []).reduce(
        (sum, node) => sum + Math.ceil(node?.getBoundingClientRect?.().height || 0),
        0,
    );
}

/**
 * Pack line-item rows into pages by height only. The closing block (totals,
 * signatures, footer) is intentionally NOT reserved here — the caller places it
 * separately (attached to the last row page if it fits, otherwise on its own
 * trailing page). Reserving its height while packing rows made the last content
 * page stop early and leave a blank band with a lone row orphaned onto the next
 * page.
 */
function paginateTableRows(rowHeights, pageHeightPx, firstFixedHeight, middleFixedHeight) {
    const totalRows = rowHeights.length;
    if (totalRows === 0) {
        return [{ start: 0, end: 0, isFirst: true }];
    }

    const pages = [];
    let cursor = 0;
    let isFirst = true;
    while (cursor < totalRows) {
        const fixed = isFirst ? firstFixedHeight : middleFixedHeight;
        const capacity = Math.max(1, pageHeightPx - fixed);

        let used = 0;
        const start = cursor;
        while (cursor < totalRows) {
            const next = rowHeights[cursor];
            if (cursor > start && used + next > capacity) break;
            used += next;
            cursor += 1;
        }
        pages.push({ start, end: cursor, isFirst });
        isFirst = false;
    }

    return pages;
}

async function buildA4PdfFromPageImages(pageImages) {
    const { jsPDF } = await import('jspdf');
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const margin = WPI_PDF_MARGIN_PT;
    const usableW = pageWidth - margin * 2;
    const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait', compress: true });

    pageImages.forEach((page, idx) => {
        if (idx > 0) pdf.addPage();
        const displayH = usableW * (page.h / page.w);
        pdf.addImage(page.imgData, 'PNG', margin, margin, usableW, displayH, undefined, 'FAST');
    });

    return pdf;
}

async function buildStructuredInvoicePdf(rootEl, captureWidth) {
    if (!rootEl) throw new Error('Invoice preview is not ready.');
    const { toPng } = await import('html-to-image');
    const pageWidthPt = 595.28;
    const pageHeightPt = 841.89;
    const usableWPt = pageWidthPt - WPI_PDF_MARGIN_PT * 2;
    const usableHPt = pageHeightPt - WPI_PDF_MARGIN_PT * 2;
    const capturePageHeight = Math.max(1, Math.floor((captureWidth * usableHPt) / usableWPt));

    const sandbox = document.createElement('div');
    sandbox.style.position = 'fixed';
    sandbox.style.left = '-20000px';
    sandbox.style.top = '0';
    sandbox.style.width = `${captureWidth}px`;
    sandbox.style.background = '#ffffff';
    sandbox.style.zIndex = '-1';
    sandbox.style.pointerEvents = 'none';
    document.body.appendChild(sandbox);

    try {
        const pageRoot = document.createElement('div');
        pageRoot.className = `${rootEl.className} wpi-view--pdf-capture`;
        pageRoot.style.width = `${captureWidth}px`;
        pageRoot.style.maxWidth = `${captureWidth}px`;
        pageRoot.style.background = '#ffffff';
        const sheetClone = (rootEl.querySelector('.wpi-view__sheet') || rootEl).cloneNode(true);
        pageRoot.appendChild(sheetClone);
        sandbox.appendChild(pageRoot);
        await waitForCaptureImages(pageRoot);

        const sheet = pageRoot.querySelector('.wpi-view__sheet');
        const surface = sheet?.querySelector('.wpi-view__surface');
        const footer = sheet?.querySelector('.wpi-view__corp-footer');
        const tableWrap = surface?.querySelector('.wpi-view__table-wrap');
        const table = tableWrap?.querySelector('table');
        const thead = table?.querySelector('thead');
        const rows = [...(table?.querySelectorAll('tbody > tr') || [])];
        const surfaceChildren = [...(surface?.children || [])];
        const tableIndex = surfaceChildren.indexOf(tableWrap);

        if (!sheet || !surface || !tableWrap || !table || !thead || tableIndex < 0) {
            throw new Error('Could not prepare invoice pages');
        }

        const topNodes = surfaceChildren.slice(0, tableIndex);
        const afterNodes = surfaceChildren.slice(tableIndex + 1);
        const rowHeights = rows.map((row) => Math.ceil(row.getBoundingClientRect().height || 0));

        const headerMeasure = tableWrap.cloneNode(false);
        const headerMeasureTable = table.cloneNode(false);
        const emptyBody = document.createElement('tbody');
        headerMeasureTable.appendChild(thead.cloneNode(true));
        headerMeasureTable.appendChild(emptyBody);
        headerMeasure.appendChild(headerMeasureTable);
        sandbox.appendChild(headerMeasure);

        const tableHeaderHeight = Math.ceil(headerMeasure.getBoundingClientRect().height || 0);
        headerMeasure.remove();

        const firstFixedHeight = sumNodeHeights(topNodes) + tableHeaderHeight;
        const middleFixedHeight = tableHeaderHeight;

        /**
         * Render one planned page.
         * - `plan.isFirst` → include the top header/detail blocks.
         * - `plan.closingOnly` → no line-item table (closing block on its own page).
         * - `plan.withClosing` → append the totals/signature blocks + footer.
         */
        const buildPageNode = (plan) => {
            const page = document.createElement('div');
            page.className = `${rootEl.className} wpi-view--pdf-capture`;
            page.style.width = `${captureWidth}px`;
            page.style.maxWidth = `${captureWidth}px`;
            page.style.background = '#ffffff';

            const pageSheet = sheet.cloneNode(false);
            const watermark = sheet.querySelector('.wpi-view__watermark-layer');
            if (watermark) pageSheet.appendChild(watermark.cloneNode(true));

            const pageSurface = surface.cloneNode(false);
            if (plan.isFirst) {
                topNodes.forEach((node) => pageSurface.appendChild(node.cloneNode(true)));
            }

            if (!plan.closingOnly) {
                const pageTableWrap = tableWrap.cloneNode(false);
                const pageTable = table.cloneNode(false);
                const pageTHead = thead.cloneNode(true);
                const pageTBody = document.createElement('tbody');
                rows.slice(plan.start, plan.end).forEach((row) => pageTBody.appendChild(row.cloneNode(true)));
                pageTable.appendChild(pageTHead);
                pageTable.appendChild(pageTBody);
                pageTableWrap.appendChild(pageTable);
                pageSurface.appendChild(pageTableWrap);
            }

            if (plan.withClosing) {
                afterNodes.forEach((node) => pageSurface.appendChild(node.cloneNode(true)));
            }

            pageSheet.appendChild(pageSurface);
            if (plan.withClosing && footer) {
                pageSheet.appendChild(footer.cloneNode(true));
            }

            page.appendChild(pageSheet);
            return page;
        };

        const measurePlanHeight = (plan) => {
            const probePage = buildPageNode(plan);
            sandbox.appendChild(probePage);
            const probeHeight = measureCaptureHeight(probePage.querySelector('.wpi-view__sheet') || probePage);
            probePage.remove();
            return probeHeight;
        };

        // 1) Pack rows into pages by height (closing block excluded for now).
        const adjustedPlans = paginateTableRows(
            rowHeights,
            capturePageHeight,
            firstFixedHeight,
            middleFixedHeight,
        ).map((plan) => ({ ...plan, withClosing: false, closingOnly: false }));

        // 2) Stabilize row pages against their real rendered height — never
        //    counting the closing block, so a page fills with rows only.
        let stabilized = false;
        while (!stabilized) {
            stabilized = true;
            for (let i = 0; i < adjustedPlans.length; i += 1) {
                adjustedPlans[i].isFirst = i === 0;
            }

            for (let i = 0; i < adjustedPlans.length; i += 1) {
                const plan = adjustedPlans[i];
                if (measurePlanHeight(plan) <= capturePageHeight) continue;
                if (plan.end - plan.start <= 1) continue;

                let nextPlan = adjustedPlans[i + 1];
                if (!nextPlan) {
                    nextPlan = {
                        start: plan.end - 1,
                        end: plan.end,
                        isFirst: false,
                        withClosing: false,
                        closingOnly: false,
                    };
                    adjustedPlans.push(nextPlan);
                } else {
                    nextPlan.start -= 1;
                }
                plan.end -= 1;
                stabilized = false;
                break;
            }
        }

        // 3) Place the closing block: attach it under the last row page when it
        //    still fits, otherwise give it its own trailing page so the rows
        //    keep packing fully (no blank band + orphaned last row).
        adjustedPlans.forEach((plan, i) => {
            plan.isFirst = i === 0;
        });
        const lastRowPlan = adjustedPlans[adjustedPlans.length - 1];
        lastRowPlan.withClosing = true;
        if (
            lastRowPlan.end > lastRowPlan.start &&
            measurePlanHeight(lastRowPlan) > capturePageHeight
        ) {
            lastRowPlan.withClosing = false;
            adjustedPlans.push({
                start: lastRowPlan.end,
                end: lastRowPlan.end,
                isFirst: false,
                withClosing: true,
                closingOnly: true,
            });
        }

        const pageImages = [];
        for (const plan of adjustedPlans) {
            const page = buildPageNode(plan);
            sandbox.appendChild(page);
            await waitForCaptureImages(page);
            const captureTarget = page.querySelector('.wpi-view__sheet') || page;
            const captureHeight = measureCaptureHeight(captureTarget);
            const imgData = await toPng(captureTarget, {
                backgroundColor: '#ffffff',
                pixelRatio: 2,
                cacheBust: true,
                width: captureWidth,
                height: captureHeight,
                style: {
                    overflow: 'hidden',
                    width: `${captureWidth}px`,
                    maxWidth: `${captureWidth}px`,
                    height: `${captureHeight}px`,
                    minHeight: '0',
                    backgroundColor: '#ffffff',
                },
            });
            const dims = await new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
                img.onerror = () => reject(new Error('Invalid PNG from page capture'));
                img.src = imgData;
            });
            pageImages.push({ imgData, ...dims });
            page.remove();
        }

        return buildA4PdfFromPageImages(pageImages);
    } finally {
        sandbox.remove();
    }
}

function money(n, currency = 'SAR') {
    const v = Number(n);
    if (!Number.isFinite(v)) return `—`;
    return `${currency} ${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function round2(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return 0;
    return Math.round(x * 100) / 100;
}

function pick(inv, ...keys) {
    for (const k of keys) {
        if (inv && inv[k] != null && inv[k] !== '') return inv[k];
    }
    return null;
}

function lineEnglishName(line) {
    const nested = line?.product && typeof line.product === 'object' ? line.product : null;
    const candidates = [
        nested?.name,
        line?.catalogProductName,
        line?.supplierProductName,
        line?.productName,
        line?.product_name,
        line?.itemName,
        line?.item_name,
        line?.description,
    ];
    for (const c of candidates) {
        if (c == null || String(c).trim() === '') continue;
        const s = String(c).trim();
        // Skip GL account labels that were incorrectly stored as productName.
        if (/^\d{4}(\s*-\s*.+)?$/i.test(s)) continue;
        if (s.toLowerCase() === 'inventory asset') continue;
        return s;
    }
    return '—';
}

function lineArabicName(line) {
    const nested = line?.product && typeof line.product === 'object' ? line.product : null;
    const candidates = [
        line?.productNameArabic,
        line?.product_name_arabic,
        line?.arabicName,
        line?.arabic_name,
        nested?.arabicName,
        nested?.arabic_name,
    ];
    for (const c of candidates) {
        if (c != null && String(c).trim() !== '') return String(c).trim();
    }
    return '';
}

function lineDesc(line) {
    return lineEnglishName(line);
}

function lineQty(line) {
    const q = line?.qty ?? line?.quantity;
    if (q == null || q === '') return '—';
    const n = Number(q);
    return Number.isFinite(n) ? String(n) : String(q);
}

function lineUom(line) {
    const candidates = [
        line?.uom,
        line?.unit,
        line?.warehouseUnit,
        line?.warehouse_unit,
        line?.supplierProduct?.warehouseUnit,
        line?.unitOfMeasure,
        line?.unit_of_measure,
    ];
    for (const c of candidates) {
        if (c != null && String(c).trim() !== '') return String(c).trim();
    }
    return 'piece';
}

function lineWorkshopConversionNote(line) {
    const wsQty = line?.qtyWorkshop ?? line?.qty_workshop;
    const wsUnit = line?.workshopUnit ?? line?.workshop_unit;
    if (wsQty == null || wsUnit == null || String(wsUnit).trim() === '') return '';
    const n = Number(wsQty);
    if (!Number.isFinite(n) || n <= 0) return '';
    return `= ${n} ${String(wsUnit).trim()} at workshop`;
}

function lineUnitExVat(line) {
    const n = Number(
        line?.unitPriceExVat ?? line?.unit_price_ex_vat ?? line?.unitPrice ?? line?.unit_price ?? 0,
    );
    return Number.isFinite(n) ? n : 0;
}

function lineVatPct(line) {
    const r = line?.vatRate ?? line?.vat_rate ?? line?.taxRate;
    if (r == null) return null;
    const n = Number(r);
    if (!Number.isFinite(n)) return null;
    return n <= 1 ? n * 100 : n;
}

function lineVatAmount(line) {
    const v = Number(line?.vatAmount ?? line?.vat_amount ?? line?.lineVat ?? line?.tax_amount ?? line?.taxAmount);
    return Number.isFinite(v) ? v : null;
}

function lineTotalExVatOnly(line) {
    const q = Number(line?.qty ?? line?.quantity ?? 0);
    const unit = lineUnitExVat(line);
    if (!Number.isFinite(q) || !Number.isFinite(unit)) return 0;
    return round2(q * unit);
}

function lineVatForDisplay(line) {
    const v = lineVatAmount(line);
    if (v != null && Number.isFinite(v) && Math.abs(v) >= 1e-9) return round2(v);
    const ex = lineTotalExVatOnly(line);
    const pct = lineVatPct(line);
    if (pct != null && Number.isFinite(pct)) return round2(ex * (pct / 100));
    return round2(0);
}

function statusBadgeClass(s) {
    const x = String(s || '').toLowerCase();
    if (x === 'rejected') return 'wpi-view__badge wpi-view__badge--rejected';
    if (x === 'pending') return 'wpi-view__badge wpi-view__badge--pending';
    if (x === 'delivered' || x === 'approved') return 'wpi-view__badge wpi-view__badge--approved';
    if (x === 'processing' || x === 'ready_to_dispatch' || x === 'on_the_way') {
        return 'wpi-view__badge wpi-view__badge--pending';
    }
    return 'wpi-view__badge wpi-view__badge--pending';
}

function fmtStatusLabel(status) {
    if (!status || status === '—') return '—';
    return String(status)
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Portal PATCH stores receiving account prefix on `supplier_payments.reference`. */
function receivingAccountFromPaymentReference(reference) {
    const s = String(reference ?? '').trim();
    const m = /^Recv\s*:\s*(.+)$/is.exec(s);
    return m ? String(m[1] || '').trim() : '';
}

/** Values match supplier portal mark-paid PATCH (`cash`, `bank_transfer`, …). */
function formatPortalPaymentMethodLabel(raw) {
    const lower = String(raw ?? '').trim().toLowerCase();
    if (!lower) return '';
    const presets = {
        cash: 'Cash',
        bank_transfer: 'Bank transfer',
        card: 'Card',
        cheque: 'Cheque',
        other: 'Other',
    };
    if (presets[lower]) return presets[lower];
    return String(raw)
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatInvoiceDateTime(inv, row) {
    const raw =
        pick(inv, 'createdAt', 'created_at', 'updatedAt', 'updated_at', 'issueDate', 'issue_date') ??
        row?.date;
    if (!raw && raw !== 0) return '—';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return String(raw).slice(0, 19);
    return d.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
}

const WorkshopPurchaseInvoiceView = forwardRef(function WorkshopPurchaseInvoiceView(
    {
        detail,
        listRow,
        variant = 'workshop',
        /** Tighter spacing for modal preview (PDF download still uses full layout). */
        compact = false,
    },
    imperativeRef,
) {
    const inv = detail && typeof detail === 'object' ? detail : {};
    const row = listRow && typeof listRow === 'object' ? listRow : {};
    const isSuperSupplier = variant === 'super_supplier';
    const isSupplierSales = variant === 'supplier_sales';
    const isWorkshopReceive = variant === 'workshop_receive';
    const isStockReceiveLayout = isSupplierSales || isWorkshopReceive;

    const invoiceNo =
        pick(inv, 'invoiceNumber', 'invoice_number', 'invoiceNo', 'reference') ??
        row.invoice_number ??
        row.invoiceNo ??
        '—';

    const status = String(pick(inv, 'status', 'state') ?? row.status ?? '—').toLowerCase();

    const issueDate = (
        pick(
            inv,
            'issueDate',
            'issue_date',
            'invoiceDate',
            'invoice_date',
            'purchaseDate',
            'createdAt',
            'created_at',
        ) ??
        row.date ??
        row.purchaseDate ??
        ''
    )
        .toString()
        .slice(0, 10);

    const dueDate = (pick(inv, 'dueDate', 'due_date') ?? row.due_date ?? '').toString().slice(0, 10);

    const vendorRef =
        pick(
            inv,
            'vendorInvoiceRef',
            'vendor_invoice_ref',
            'vendorRef',
            'referenceNo',
            'ref_number',
        ) ??
        row.vendor_invoice_ref ??
        row.vendorRef ??
        '';

    const workshopLabel = isSuperSupplier
        ? pick(inv, 'superSupplierName', 'super_supplier_name') ?? row.superSupplierName ?? ''
        : pick(
              inv,
              'workshopName',
              'workshop_name',
              'branchName',
              'branch_name',
              'workshopBranchName',
          ) ??
          inv?.branch?.name ??
          inv?.workshop?.name ??
          inv?.workshop?.branchName ??
          '';

    const supplierLabel =
        pick(inv, 'supplierLegalName', 'supplier_name', 'supplierName', 'vendorName', 'vendor_name') ??
        inv?.supplier?.companyName ??
        inv?.supplier?.name ??
        row.vendor_name ??
        row.supplier ??
        'FILTER';

    const supplierLabelAr =
        pick(
            inv,
            'supplierNameAr',
            'supplier_name_ar',
            'supplierLegalNameAr',
            'vendorNameAr',
        ) ??
        inv?.supplier?.nameAr ??
        inv?.supplier?.name_ar ??
        supplierLabel;

    const supplierTagline =
        pick(inv, 'supplierTagline', 'supplier_tagline') ??
        'Specialist procurement & inventory for automotive workshops — wholesale linked supply.';

    const supplierTaglineAr =
        pick(inv, 'supplierTaglineAr', 'supplier_tagline_ar') ??
        'توريد وقطع ومستهلكات ورش ومبيعات تجارية وفق بوليصة المورد المعتمد.';

    const description = pick(inv, 'description', 'title') ?? '';
    const notes = pick(inv, 'notes', 'internalNotes', 'internal_notes') ?? row.notes ?? '';

    /** Supplier “internal notes” for print: hide system line we append on create (due date is already in the header). */
    const notesForPolicy = (() => {
        const raw = String(notes || '').trim();
        if (!raw) return '';
        return raw
            .split('\n')
            .map((l) => l.trimEnd())
            .filter((l) => !/^Due date:\s*[0-9]{4}-[0-9]{2}-[0-9]{2}\s*$/i.test(l.trim()))
            .join('\n')
            .trim();
    })();

    const dueDateFromNotes =
        isSuperSupplier && notes
            ? String(notes).match(/Due date:\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/i)?.[1] ?? ''
            : '';
    const dueDateDisplay =
        dueDate && String(dueDate).trim() !== ''
            ? dueDate
            : dueDateFromNotes || dueDate;

    const workshopVat = isSuperSupplier
        ? pick(
              inv,
              'superSupplierVatNumber',
              'super_supplier_vat_number',
              'upstreamVendorVat',
          ) ??
          row.superSupplierVatNumber ??
          ''
        : pick(
              inv,
              'workshopVatNumber',
              'workshop_vat_number',
              'buyerVatNumber',
              'buyer_vat_number',
              'customerVat',
              'customer_vat',
              'branchVat',
              'branch_vat',
          ) ??
          inv?.branch?.vatNumber ??
          inv?.branch?.vat_number ??
          inv?.workshop?.vatNumber ??
          '';

    const supplierVat =
        pick(inv, 'supplierVatNumber', 'supplier_vat_number', 'vendorVat', 'sellerVatNumber') ??
        inv?.supplier?.vatNumber ??
        inv?.supplier?.vat_number ??
        '';

    const workshopMobile = isSuperSupplier
        ? pick(inv, 'superSupplierMobile', 'super_supplier_mobile') ?? ''
        : pick(
              inv,
              'workshopMobile',
              'workshop_mobile',
              'buyerMobile',
              'branchPhone',
              'branch_phone',
          ) ??
          inv?.branch?.phone ??
          inv?.branch?.mobile ??
          inv?.workshop?.mobile ??
          inv?.workshop?.phone ??
          '';

    const items = Array.isArray(inv.items) ? inv.items : Array.isArray(inv.lines) ? inv.lines : [];

    const subtotalEx = Number(
        pick(
            inv,
            'subtotalExVat',
            'subtotal_ex_vat',
            'subtotalExcludingVat',
            'subtotal',
            'subtotalLines',
            'amount',
        ) ?? row.subtotal ?? row.amount ?? 0,
    );
    const totalVatFromApi = Number(
        pick(inv, 'totalVat', 'total_vat', 'vatAmount', 'vat_amount') ?? row.vat_amount ?? 0,
    );
    const grand = Number(
        pick(inv, 'grandTotal', 'grand_total', 'totalInclVat', 'total') ?? row.grand_total ?? 0,
    );
    const totalVat = (() => {
        const raw = Number.isFinite(totalVatFromApi) ? totalVatFromApi : 0;
        if (Math.abs(raw) > 1e-6) return raw;
        if (Number.isFinite(grand) && Number.isFinite(subtotalEx) && grand > subtotalEx + 1e-6) {
            return Math.round((grand - subtotalEx) * 100) / 100;
        }
        return raw;
    })();

    const discountAmount = round2(
        Number(
            pick(
                inv,
                'discountTotal',
                'discount_total',
                'discountAmount',
                'discount_amount',
                'invoiceDiscountAmount',
                'invoice_discount_amount',
            ) ??
                inv?.totals?.discount ??
                inv?.totals?.discountTotal ??
                0,
        ),
    );

    const paid = Number(pick(inv, 'amountPaid', 'amount_paid') ?? row.amount_paid ?? 0);
    const returnsTotal = round2(
        Number(pick(inv, 'returnsTotal', 'returns_total') ?? row.returns_total ?? 0),
    );
    const balance = Number(
        pick(inv, 'balanceDue', 'balance_due') ?? row.balance_due ?? Math.max(0, grand - paid),
    );

    const currency = pick(inv, 'currencyCode', 'currency') ?? 'SAR';

    const lineQtyReturned = (line) => {
        const q = line?.qtyReturned ?? line?.qty_returned;
        if (q == null || q === '') return '0';
        const n = Number(q);
        return Number.isFinite(n) ? String(n) : String(q);
    };

    /** Opens Filter public verify page — scanner opens browser URL (not raw JSON). */
    const verifyUrl = useMemo(() => {
        const internalId = pick(inv, 'id') ?? row.id;
        if (internalId == null || String(internalId).trim() === '') return '';
        if (typeof window === 'undefined') return '';
        if (isSuperSupplier) {
            return `${window.location.origin}/verify/ssp/${encodeURIComponent(String(internalId))}`;
        }
        if (isSupplierSales) {
            return `${window.location.origin}/verify/sinv/${encodeURIComponent(String(internalId))}`;
        }
        return `${window.location.origin}/verify/wpi/${encodeURIComponent(String(internalId))}`;
    }, [inv, row.id, isSuperSupplier, isSupplierSales]);

    const [verifyQrDataUrl, setVerifyQrDataUrl] = useState('');
    const [zatcaQrDataUrl, setZatcaQrDataUrl] = useState('');
    const [qrBroken, setQrBroken] = useState(false);
    const [pdfBusy, setPdfBusy] = useState(false);
    const [pdfError, setPdfError] = useState('');
    const printRootRef = useRef(null);

    const zatcaQrInputs = useMemo(
        () => ({
            sellerName: supplierLabel,
            vatNumber: supplierVat,
            invoiceDate: issueDate || pick(inv, 'createdAt', 'created_at'),
            invoiceNumber: invoiceNo,
            grandTotal: grand,
            vatAmount: totalVat,
        }),
        [supplierLabel, supplierVat, issueDate, inv, invoiceNo, grand, totalVat],
    );

    useEffect(() => {
        let cancelled = false;
        setQrBroken(false);
        if (!verifyUrl) {
            setVerifyQrDataUrl('');
        } else {
            QRCode.toDataURL(verifyUrl, { width: 132, margin: 1, errorCorrectionLevel: 'M' })
                .then((url) => {
                    if (!cancelled) setVerifyQrDataUrl(url);
                })
                .catch(() => {
                    if (!cancelled) {
                        setVerifyQrDataUrl('');
                        setQrBroken(true);
                    }
                });
        }

        (async () => {
            if (!supplierVat || !Number.isFinite(grand)) {
                if (!cancelled) setZatcaQrDataUrl('');
                return;
            }
            try {
                const payload = await buildZatcaPhase2QrPayloadFromInvoice(zatcaQrInputs);
                if (!payload || cancelled) {
                    if (!cancelled) setZatcaQrDataUrl('');
                    return;
                }
                const url = await QRCode.toDataURL(payload, {
                    width: 140,
                    margin: 1,
                    errorCorrectionLevel: 'M',
                });
                if (!cancelled) setZatcaQrDataUrl(url);
            } catch {
                if (!cancelled) setZatcaQrDataUrl('');
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [verifyUrl, zatcaQrInputs, supplierVat, grand]);

    const renderWorkshopVerifyQr = (className = 'wpi-view__qr-block') => (
        <div className={`${className} wpi-view__qr-visual`}>
            {verifyUrl && verifyQrDataUrl && !qrBroken ? (
                <>
                    <img src={verifyQrDataUrl} width={120} height={120} alt="Verification QR" />
                    <p className="wpi-view__qr-caption">
                        Scan to receive stock &amp; invoice
                        <br />
                        <span dir="rtl">امسح لاستلام المخزون والفاتورة</span>
                    </p>
                </>
            ) : verifyUrl && qrBroken ? (
                <div className="wpi-view__qr-fallback">QR unavailable — open link below</div>
            ) : (
                <div className="wpi-view__qr-fallback">No verify id</div>
            )}
            {verifyUrl ? (
                <a className="wpi-view__verify-link" href={verifyUrl} target="_blank" rel="noopener noreferrer">
                    {verifyUrl}
                </a>
            ) : null}
        </div>
    );

    const watermarkText =
        supplierLabel.length <= 24 ? String(supplierLabel).replace(/\s+/g, ' ').toUpperCase() : 'FILTER';

    const logoLetter = (supplierLabel || 'F').trim().charAt(0).toUpperCase() || 'F';

    const invoiceDateDisplay = formatInvoiceDateTime(inv, row);

    const lineTableColCount = isStockReceiveLayout ? 7 : 6;

    const paymentLabelRaw =
        pick(inv, 'paymentStatus', 'payment_status') ?? row.payment_status ?? 'unpaid';

    const paymentLabel =
        paymentLabelRaw && String(paymentLabelRaw) !== '—'
            ? String(paymentLabelRaw).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
            : '—';

    /** Supplier AR: method + receiving account from latest portal payment (`Recv:` reference) or meta. */
    const supplierArReceiptLabels = useMemo(() => {
        if (!isSupplierSales) return { method: '—', account: '—' };
        const list = Array.isArray(inv.payments) ? [...inv.payments] : [];
        list.sort((a, b) => String(b?.paidAt ?? '').localeCompare(String(a?.paidAt ?? '')));

        let method = '';
        let account = '';
        const recvPay = list.find((p) =>
            /^Recv\s*:/i.test(String(p?.reference ?? '').trim()),
        );

        const meta =
            inv.salesInvoiceMeta != null && typeof inv.salesInvoiceMeta === 'object'
                ? inv.salesInvoiceMeta
                : null;
        const metaAcc =
            meta && typeof meta.cashBankAccount === 'string' ? meta.cashBankAccount.trim() : '';
        const detailAcc =
            typeof inv.cashBankAccount === 'string' ? inv.cashBankAccount.trim() : metaAcc;

        const focal =
            recvPay ?? (paid > 0 && list.length > 0 ? list[0] : null);

        if (focal) {
            method = formatPortalPaymentMethodLabel(focal.method);
            account = receivingAccountFromPaymentReference(focal.reference);
        }
        if (!account && detailAcc) {
            account = detailAcc;
        }

        const methodDisp = method || '—';
        const accountDisp = account || '—';

        /** Hide misleading labels when unpaid and unset. */
        if (paid <= 0 && methodDisp === '—' && accountDisp === '—') {
            return { method: '—', account: '—' };
        }

        return { method: methodDisp, account: accountDisp };
    }, [
        inv.payments,
        inv.salesInvoiceMeta,
        inv.cashBankAccount,
        isSupplierSales,
        paid,
    ]);

    /** Build preview PDF from page-wise rendered invoice sections. */
    const buildInvoicePdf = useCallback(async () => {
        const el = printRootRef.current;
        if (!el) throw new Error('Invoice preview is not ready.');
        try {
            await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
            return buildStructuredInvoicePdf(el, WPI_PDF_CAPTURE_WIDTH);
        } catch (err) {
            console.error(err);
            throw err;
        }
    }, []);

    const downloadPdfFile = useCallback(async () => {
        const pdf = await buildInvoicePdf();
        const safe = String(invoiceNo).replace(/[^\w.-]+/g, '_').replace(/^_|_$/g, '').slice(0, 96) || 'invoice';
        const filename = `${isSuperSupplier ? 'Filter-SSP' : isSupplierSales ? 'Filter-SINV' : isWorkshopReceive ? 'Filter-WPI-Recv' : 'Filter-WPI'}-${safe}.pdf`;
        pdf.save(filename);
    }, [buildInvoicePdf, invoiceNo, isSuperSupplier, isSupplierSales, isWorkshopReceive]);

    useImperativeHandle(imperativeRef, () => ({ downloadPdf: downloadPdfFile }), [downloadPdfFile]);

    const handleDownloadPdf = useCallback(async () => {
        setPdfBusy(true);
        setPdfError('');
        try {
            await downloadPdfFile();
        } catch (err) {
            setPdfError(
                err instanceof Error && err.message
                    ? err.message
                    : 'Could not create PDF.',
            );
        } finally {
            setPdfBusy(false);
        }
    }, [downloadPdfFile]);

    return (
        <div
            className={`wpi-view${compact ? ' wpi-view--compact' : ''}`}
            ref={printRootRef}
        >
            <div className="wpi-view__toolbar">
                <button
                    type="button"
                    className="wpi-view__btn-download"
                    onClick={handleDownloadPdf}
                    disabled={pdfBusy}
                >
                    <Download size={16} strokeWidth={2.5} aria-hidden />
                    {pdfBusy ? 'Preparing…' : 'Download PDF'}
                </button>
                <span className={statusBadgeClass(status)}>{fmtStatusLabel(status)}</span>
                {pdfError ? (
                    <p className="wpi-view__pdf-error" role="alert">
                        {pdfError}
                    </p>
                ) : null}
            </div>

            <div className="wpi-view__sheet">
                <div className="wpi-view__watermark-layer" aria-hidden="true">
                    <span className="wpi-view__wm--primary">{watermarkText}</span>
                </div>

                <div className="wpi-view__surface">
                    <header
                        className={`wpi-view__corp-header${verifyUrl ? ' wpi-view__corp-header--with-qr' : ''}`}
                    >
                        <div className="wpi-view__corp-left">
                            <h1 className="wpi-view__corp-name">{supplierLabel}</h1>
                            <p className="wpi-view__corp-tagline">{supplierTagline}</p>
                            <p className="wpi-view__corp-vat">VAT No. {supplierVat || '—'}</p>
                        </div>

                        <div className="wpi-view__corp-logo">
                            <div className="wpi-view__corp-logo-ring" aria-hidden>
                                <span className="wpi-view__corp-logo-letter">{logoLetter}</span>
                            </div>
                        </div>

                        {verifyUrl ? (
                            <div className="wpi-view__header-qr">
                                {renderWorkshopVerifyQr('wpi-view__qr-block wpi-view__qr-block--header')}
                            </div>
                        ) : null}

                        <div className="wpi-view__corp-right">
                            <h2 className="wpi-view__corp-name-ar" dir="rtl">
                                {supplierLabelAr}
                            </h2>
                            <p className="wpi-view__corp-tagline-ar" dir="rtl">
                                {supplierTaglineAr}
                            </p>
                            <p className="wpi-view__corp-vat-ar" dir="rtl">
                                الرقم الضريبي: {supplierVat || '—'}
                            </p>
                        </div>
                    </header>

                    <div className="wpi-view__brands">
                        {['OEM parts', 'Lubricants', 'Filters', 'Fluids', 'Batteries', 'Workshop supply', 'Wholesale', 'Retail'].map(
                            (label) => (
                                <span key={label} className="wpi-view__brand-pill">
                                    {label}
                                </span>
                            ),
                        )}
                    </div>

                    <div className="wpi-view__title-ribbon">
                        <span className="wpi-view__title-ribbon-ar" dir="rtl">
                            فاتورة ضريبية
                        </span>
                        <span className="wpi-view__title-ribbon-en">Tax invoice</span>
                    </div>

                    <div className="wpi-view__meta-split">
                        <div className="wpi-view__panel">
                            <h3 className="wpi-view__panel-title">
                                {isSuperSupplier ? 'Vendor · المورّد' : 'Customer · العميل'}
                            </h3>
                            <div className="wpi-view__field">
                                <div className="wpi-view__field-label-bi">
                                    <span className="wpi-view__field-label-bi-en">
                                        {isSuperSupplier ? 'Vendor name' : 'Customer name'}
                                    </span>
                                    <span className="wpi-view__field-label-bi-ar" dir="rtl">
                                        {isSuperSupplier ? 'اسم المورّد' : 'اسم العميل'}
                                    </span>
                                </div>
                                <div className="wpi-view__field-value" dir="auto">
                                    {workshopLabel || '—'}
                                </div>
                            </div>
                            <div className="wpi-view__field">
                                <div className="wpi-view__field-label-bi">
                                    <span className="wpi-view__field-label-bi-en">
                                        {isSuperSupplier ? 'Vendor mobile' : 'Customer mobile'}
                                    </span>
                                    <span className="wpi-view__field-label-bi-ar" dir="rtl">
                                        {isSuperSupplier ? 'جوال المورّد' : 'جوال العميل'}
                                    </span>
                                </div>
                                <div className="wpi-view__field-value">{workshopMobile || '—'}</div>
                            </div>
                            <div className="wpi-view__field">
                                <div className="wpi-view__field-label-bi">
                                    <span className="wpi-view__field-label-bi-en">
                                        {isSuperSupplier ? 'Vendor VAT no.' : 'Customer VAT no.'}
                                    </span>
                                    <span className="wpi-view__field-label-bi-ar" dir="rtl">
                                        {isSuperSupplier ? 'الرقم الضريبي للمورّد' : 'الرقم الضريبي للعميل'}
                                    </span>
                                </div>
                                <div className="wpi-view__field-value">{workshopVat || '—'}</div>
                            </div>
                        </div>

                        <div className="wpi-view__panel">
                            <h3 className="wpi-view__panel-title">Invoice details · تفاصيل الفاتورة</h3>
                            <div className="wpi-view__details-grid">
                                <div className="wpi-view__field">
                                    <span className="wpi-view__field-label">Invoice no.</span>
                                    <div className="wpi-view__field-value" style={{ fontWeight: 800 }}>
                                        {invoiceNo}
                                    </div>
                                </div>
                                <div className="wpi-view__field">
                                    <span className="wpi-view__field-label">Due date</span>
                                    <div className="wpi-view__field-value">{dueDateDisplay || '—'}</div>
                                </div>
                            </div>
                            <div className="wpi-view__details-grid">
                                <div className="wpi-view__field">
                                    <span className="wpi-view__field-label">Date &amp; time</span>
                                    <div className="wpi-view__field-value">{invoiceDateDisplay}</div>
                                </div>
                                <div className="wpi-view__field">
                                    <span className="wpi-view__field-label">Vendor reference</span>
                                    <div className="wpi-view__field-value">{vendorRef || '—'}</div>
                                </div>
                            </div>
                            <div className="wpi-view__details-grid">
                                <div className="wpi-view__field">
                                    <span className="wpi-view__field-label">Issue date</span>
                                    <div className="wpi-view__field-value">{issueDate || '—'}</div>
                                </div>
                                <div className="wpi-view__field">
                                    <span className="wpi-view__field-label">Payment</span>
                                    <div className="wpi-view__field-value">{paymentLabel}</div>
                                </div>
                            </div>
                            {isSupplierSales ? (
                                <div className="wpi-view__details-grid">
                                    <div className="wpi-view__field">
                                        <span className="wpi-view__field-label">Payment method</span>
                                        <div className="wpi-view__field-value">
                                            {supplierArReceiptLabels.method}
                                        </div>
                                    </div>
                                    <div className="wpi-view__field">
                                        <span className="wpi-view__field-label">
                                            Receiving account
                                        </span>
                                        <div
                                            className="wpi-view__field-value"
                                            dir="auto"
                                            style={{ wordBreak: 'break-word' }}
                                        >
                                            {supplierArReceiptLabels.account}
                                        </div>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </div>

                    {(description || notes) ? (
                        <div className="wpi-view__memo-inline">
                            {description ? (
                                <span>
                                    <strong>Subject:</strong> {description}{' '}
                                </span>
                            ) : null}
                            {notes ? (
                                <span>
                                    {description ? (
                                        <>
                                            {' '}
                                            <strong>Notes:</strong>{' '}
                                        </>
                                    ) : (
                                        <strong>Notes:</strong>
                                    )}
                                    {notes}
                                </span>
                            ) : null}
                        </div>
                    ) : null}

                    <div className="wpi-view__table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th style={{ width: 36 }}>
                                        S. No.
                                        <span className="wpi-view__th-sub" dir="rtl">
                                            م
                                        </span>
                                    </th>
                                    <th>
                                        Description
                                        <span className="wpi-view__th-sub" dir="rtl">
                                            البيان
                                        </span>
                                    </th>
                                    <th className="wpi-view__th-num" style={{ minWidth: 88 }}>
                                        Quantity
                                        <span className="wpi-view__th-sub" dir="rtl">
                                            الكمية
                                        </span>
                                    </th>
                                    {isStockReceiveLayout ? (
                                        <th className="wpi-view__th-num" style={{ minWidth: 80 }}>
                                            Return qty
                                            <span className="wpi-view__th-sub" dir="rtl">
                                                مرتجع
                                            </span>
                                        </th>
                                    ) : null}
                                    <th className="wpi-view__th-num">
                                        Unit price
                                        <span className="wpi-view__th-sub" dir="rtl">
                                            سعر الوحدة
                                        </span>
                                    </th>
                                    <th className="wpi-view__th-num">
                                        Total
                                        <span className="wpi-view__th-sub" dir="rtl">
                                            الإجمالي
                                        </span>
                                    </th>
                                    <th className="wpi-view__th-num">
                                        VAT
                                        <span className="wpi-view__th-sub" dir="rtl">
                                            الضريبة
                                        </span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={lineTableColCount}
                                            className="wpi-view__table-empty"
                                        >
                                            No line items
                                        </td>
                                    </tr>
                                ) : (
                                    items.map((line, i) => (
                                        <tr key={line.id ?? line.lineId ?? i}>
                                            <td>{i + 1}</td>
                                            <td dir="auto">
                                                <div>{lineEnglishName(line)}</div>
                                                {lineArabicName(line) ? (
                                                    <div
                                                        dir="rtl"
                                                        style={{
                                                            fontSize: '0.875rem',
                                                            color: '#475569',
                                                            marginTop: 3,
                                                            lineHeight: 1.4,
                                                        }}
                                                    >
                                                        {lineArabicName(line)}
                                                    </div>
                                                ) : null}
                                                {isSuperSupplier &&
                                                ((line.sku != null && String(line.sku).trim() !== '') ||
                                                    (line.lineDescription != null &&
                                                        String(line.lineDescription).trim() !== '')) ? (
                                                    <div
                                                        style={{
                                                            fontSize: '0.75rem',
                                                            color: '#64748b',
                                                            marginTop: 4,
                                                            lineHeight: 1.35,
                                                        }}
                                                    >
                                                        {[
                                                            line.sku != null && String(line.sku).trim() !== ''
                                                                ? `SKU ${String(line.sku).trim()}`
                                                                : null,
                                                            line.lineDescription != null &&
                                                            String(line.lineDescription).trim() !== ''
                                                                ? String(line.lineDescription).trim()
                                                                : null,
                                                        ]
                                                            .filter(Boolean)
                                                            .join(' · ')}
                                                    </div>
                                                ) : null}
                                            </td>
                                            <td className="wpi-view__td-num">
                                                {lineQty(line)} {lineUom(line)}
                                                {isStockReceiveLayout && lineWorkshopConversionNote(line) ? (
                                                    <div
                                                        className="wpi-view__line-sub"
                                                        style={{
                                                            fontSize: '0.72rem',
                                                            color: '#64748b',
                                                            fontWeight: 500,
                                                            marginTop: 2,
                                                        }}
                                                    >
                                                        {lineWorkshopConversionNote(line)}
                                                    </div>
                                                ) : null}
                                            </td>
                                            {isStockReceiveLayout ? (
                                                <td className="wpi-view__td-num">
                                                    {lineQtyReturned(line)} {lineUom(line)}
                                                </td>
                                            ) : null}
                                            <td className="wpi-view__td-num">{money(lineUnitExVat(line), currency)}</td>
                                            <td className="wpi-view__td-num">
                                                {money(lineTotalExVatOnly(line), currency)}
                                            </td>
                                            <td className="wpi-view__td-num">{money(lineVatForDisplay(line), currency)}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="wpi-view__bottom-grid">
                        <div className="wpi-view__policy">
                            {notesForPolicy ? (
                                <>
                                    <strong>Notes · ملاحظات</strong>
                                    <div className="wpi-view__policy-notes" dir="auto">
                                        {notesForPolicy}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <strong>Returns · الإرجاع</strong>
                                    Return of products is allowed within <strong>7 days</strong> from the invoice date
                                    with the original invoice; products must be in good condition. Subject to supplier
                                    approval.
                                    <div className="wpi-view__policy-ar" dir="rtl">
                                        يُسمح بإرجاع المنتجات خلال <strong>7 أيام</strong> من تاريخ الفاتورة مع
                                        الفاتورة الأصلية، ويشترط أن تكون البضاعة بحالة سليمة — وفق سياسة المورد المعتمد.
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="wpi-view__sum-box">
                            <div className="wpi-view__sum-row">
                                <span className="wpi-view__sum-row-label">
                                    Total <span dir="rtl">(الإجمالي)</span>
                                </span>
                                <span className="wpi-view__sum-row-val">{money(subtotalEx, currency)}</span>
                            </div>
                            <div className="wpi-view__sum-row">
                                <span className="wpi-view__sum-row-label">
                                    Discount <span dir="rtl">(الخصم)</span>
                                </span>
                                <span className="wpi-view__sum-row-val">{money(discountAmount, currency)}</span>
                            </div>
                            <div className="wpi-view__sum-row">
                                <span className="wpi-view__sum-row-label">
                                    VAT <span dir="rtl">(الضريبة)</span>
                                </span>
                                <span className="wpi-view__sum-row-val">{money(totalVat, currency)}</span>
                            </div>
                            <div className="wpi-view__sum-row wpi-view__sum-row--net">
                                <span className="wpi-view__sum-row-label">
                                    Net total <span dir="rtl">(الصافي)</span>
                                </span>
                                <span className="wpi-view__sum-row-val">{money(grand, currency)}</span>
                            </div>
                            <div className="wpi-view__sum-words">ريال سعودي لا غير · Saudi riyals only</div>
                        </div>
                    </div>

                    {(paid > 0 || balance > 0 || (isSupplierSales && returnsTotal > 0)) && (
                        <div className="wpi-view__panel" style={{ marginBottom: 12 }}>
                            {isSupplierSales && returnsTotal > 0 ? (
                                <div className="wpi-view__sum-row" style={{ border: 'none', padding: '4px 0' }}>
                                    <span className="wpi-view__sum-row-label">
                                        Returns credited <span dir="rtl">(إشعار دائن)</span>
                                    </span>
                                    <span className="wpi-view__sum-row-val">
                                        {money(returnsTotal, currency)}
                                    </span>
                                </div>
                            ) : null}
                            <div className="wpi-view__sum-row" style={{ border: 'none', padding: '4px 0' }}>
                                <span className="wpi-view__sum-row-label">Amount paid</span>
                                <span className="wpi-view__sum-row-val">{money(paid, currency)}</span>
                            </div>
                            <div className="wpi-view__sum-row" style={{ border: 'none', padding: '4px 0' }}>
                                <span className="wpi-view__sum-row-label">
                                    Balance due
                                    {isSupplierSales && returnsTotal > 0 ? (
                                        <span
                                            style={{
                                                display: 'block',
                                                fontSize: '0.7rem',
                                                fontWeight: 500,
                                                color: '#64748b',
                                                marginTop: 2,
                                            }}
                                        >
                                            After returns &amp; payments · صافي بعد الإرجاع والدفعات
                                        </span>
                                    ) : null}
                                </span>
                                <span className="wpi-view__sum-row-val">{money(balance, currency)}</span>
                            </div>
                            {isSupplierSales && returnsTotal > 0 ? (
                                <p
                                    style={{
                                        margin: '10px 0 0',
                                        fontSize: '0.75rem',
                                        color: '#475569',
                                        lineHeight: 1.45,
                                    }}
                                >
                                    Net total is the original invoice. Balance due is what remains after recorded
                                    payments and approved return credits.
                                </p>
                            ) : null}
                        </div>
                    )}

                    <div className="wpi-view__closing-row">
                        <div className="wpi-view__signatures">
                            <div className="wpi-view__sig">
                                <div className="wpi-view__sig-line">Salesman: _________________________________</div>
                                <div className="wpi-view__sig-ar" dir="rtl">
                                    اسم مندوب المبيعات
                                </div>
                            </div>
                            <div className="wpi-view__sig">
                                <div className="wpi-view__sig-line">Received by: _________________________________</div>
                                <div className="wpi-view__sig-ar" dir="rtl">
                                    المستلم
                                </div>
                            </div>
                        </div>

                        <div className="wpi-view__zatca-qr">
                        <div className="wpi-view__zatca-qr-title">
                            ZATCA Phase 2 e-invoice QR · رمز هيئة الزكاة والضريبة والجمارك — المرحلة الثانية
                        </div>
                        {zatcaQrDataUrl ? (
                            <>
                                <img
                                    src={zatcaQrDataUrl}
                                    width={120}
                                    height={120}
                                    alt="ZATCA Phase 2 QR"
                                    className="wpi-view__zatca-qr-img"
                                />
                            </>
                        ) : (
                            <div className="wpi-view__zatca-qr-placeholder">
                                <div className="wpi-view__zatca-qr-placeholder-box">
                                    ZATCA QR
                                </div>
                                <p>
                                    {supplierVat
                                        ? 'QR will appear when invoice totals are available.'
                                        : 'VAT registration number required for ZATCA QR.'}
                                </p>
                                <p dir="rtl" style={{ marginTop: 6 }}>
                                    {supplierVat
                                        ? 'سيظهر الرمز عند توفر بيانات الفاتورة.'
                                        : 'يلزم الرقم الضريبي لإظهار رمز هيئة الزكاة والضريبة والجمارك.'}
                                </p>
                            </div>
                        )}
                        </div>
                    </div>
                </div>

                <footer className="wpi-view__corp-footer">
                    <div className="wpi-view__corp-footer-inner">
                        <div className="wpi-view__corp-footer-contact">
                            <strong>
                                Filter —{' '}
                                {isSuperSupplier
                                    ? 'super supplier purchase invoice'
                                    : isSupplierSales
                                      ? 'sales invoice (accounts receivable)'
                                      : isWorkshopReceive
                                        ? 'workshop purchase invoice (receive stock)'
                                        : 'workshop purchase invoice'}
                            </strong>
                            <br />
                            {isSuperSupplier ? (
                                <>
                                    Purchase recorded through Filter supplier portal · scan header QR to verify.
                                    <br />
                                    الإصدار الإلكتروني عبر منصّة فِلتر — امسح الرمز في أعلى الفاتورة للتحقق.
                                </>
                            ) : isSupplierSales || isWorkshopReceive ? (
                                <>
                                    {isWorkshopReceive ? (
                                        <>
                                            Workshop purchase invoice · scan header QR to receive stock &amp; invoice.
                                            <br />
                                            فاتورة مشتريات الورشة — امسح الرمز في أعلى الفاتورة لاستلام المخزون والفاتورة.
                                        </>
                                    ) : (
                                        <>
                                            Sales invoice issued through Filter supplier portal · scan header QR to receive stock &amp; invoice.
                                            <br />
                                            فاتورة مبيعات للورشة — امسح الرمز في أعلى الفاتورة لاستلام المخزون والفاتورة.
                                        </>
                                    )}
                                </>
                            ) : (
                                <>
                                    Digital document issued through Filter supplier portal · scan header QR to verify.
                                    <br />
                                    Support: hello@filter.app · الإصدار الإلكتروني عبر منصّة فِلتر
                                </>
                            )}
                        </div>
                        <div className="wpi-view__corp-footer-contact-ar">
                            {isSupplierSales || isWorkshopReceive ? (
                                <>
                                    {isWorkshopReceive ? (
                                        <>
                                            مستند مشتريات إلكتروني بين الورشة والمورد في منصّة فِلتر — امسح الرمز لاستلام المخزون.
                                            <br />
                                            للاستفسارات يُرجى التواصل عبر بوابة الورشة.
                                        </>
                                    ) : (
                                        <>
                                            مستند مبيعات إلكتروني بين المورد وفرع الورشة في منصّة فِلتر.
                                            <br />
                                            للاستفسارات يُرجى التواصل عبر بوابة المورد.
                                        </>
                                    )}
                                </>
                            ) : (
                                <>
                                    هذا المستند صادر إلكترونيًا وفق عملية التوريد بين الورشة والمورد.
                                    <br />
                                    لمزيد من المعلومات يُرجى التواصل عبر بوابة فِلتر.
                                </>
                            )}
                        </div>
                    </div>
                </footer>
            </div>
        </div>
    );
});

export default WorkshopPurchaseInvoiceView;
