import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import CashierTaxInvoiceView from '../components/pos/modern/CashierTaxInvoiceView';
import { getInvoices, getSuperAdminInvoiceView } from '../services/superAdminApi';

/** Inner content width of InvoiceDetailsModal (.invoice-modal-card 940px − 14px×2 padding). */
const INVOICE_PDF_CONTENT_WIDTH = 912;

const INVOICE_ARABIC_FONT_LINK_ID = 'filter-noto-sans-arabic-font';

/** Load Noto Sans Arabic before rasterizing so PDF Arabic matches on-screen Naskh style. */
async function ensureInvoicePdfFonts() {
    if (!document.getElementById(INVOICE_ARABIC_FONT_LINK_ID)) {
        const link = document.createElement('link');
        link.id = INVOICE_ARABIC_FONT_LINK_ID;
        link.rel = 'stylesheet';
        link.href =
            'https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;600;700;800&display=swap';
        document.head.appendChild(link);
    }
    if (document.fonts?.load) {
        await Promise.all([
            document.fonts.load('400 12px "Noto Sans Arabic"'),
            document.fonts.load('600 12px "Noto Sans Arabic"'),
            document.fonts.load('700 14px "Noto Sans Arabic"'),
            document.fonts.load('800 15px "Noto Sans Arabic"'),
        ]).catch(() => {});
        await document.fonts.ready;
    } else {
        await new Promise((resolve) => setTimeout(resolve, 400));
    }
}

/** Invoice / credit-note refs that can be opened as PDF. */
export function isClickableInvoiceRef(invoiceNo) {
    const s = String(invoiceNo ?? '').trim();
    return /^INV-/i.test(s) || /^RET-/i.test(s);
}

/** Normalize backend invoice payload for CashierTaxInvoiceView / InvoiceDetailsModal. */
export function normalizeInvoiceForModal(invoice) {
    if (!invoice || typeof invoice !== 'object') return invoice;
    const srcOrder = invoice.salesOrder || invoice.sales_order || {};
    const srcCustomer = srcOrder.customer || invoice.customer || {};
    const srcVehicle = srcOrder.vehicle || invoice.vehicle || {};
    const srcJobs = Array.isArray(srcOrder.jobs)
        ? srcOrder.jobs
        : Array.isArray(invoice.jobs) ? invoice.jobs : [];
    const zatca = invoice.zatca || invoice.zatca_detail || invoice.zatcaDetail || null;
    return {
        ...invoice,
        order: { ...srcOrder, jobs: srcJobs },
        jobs: srcJobs,
        customer: srcCustomer,
        vehicle: srcVehicle,
        branch: invoice.branch || srcOrder.branch,
        workshop: invoice.workshop || srcOrder.workshop,
        paymentMethod: invoice.paymentMethod || invoice.payments?.[0]?.method,
        zatca,
    };
}

export async function fetchSuperAdminInvoiceForModal(invoiceId) {
    const raw = await getSuperAdminInvoiceView(invoiceId);
    const inv = raw?.invoice ?? raw?.data?.invoice ?? raw?.data ?? raw;
    return normalizeInvoiceForModal(inv);
}

/** Resolve numeric invoice id from id and/or invoice number (INV-xxxxx). */
export async function resolveInvoiceId({ invoiceId, invoiceNo, workshopId } = {}) {
    if (invoiceId != null && String(invoiceId).trim() !== '') {
        return String(invoiceId);
    }
    const no = String(invoiceNo ?? '').trim();
    if (!no || no === '—' || !isClickableInvoiceRef(no)) return null;

    const res = await getInvoices({
        search: no,
        workshopId: workshopId || undefined,
        limit: 50,
    });
    const list = res?.receipts ?? res?.invoices ?? res?.items ?? [];
    const exact = list.find(
        (r) => String(r.invoiceNo ?? '').trim().toUpperCase() === no.toUpperCase(),
    );
    if (exact?.id) return String(exact.id);

    const partial = list.find((r) =>
        String(r.invoiceNo ?? '').trim().toUpperCase().includes(no.toUpperCase()),
    );
    return partial?.id ? String(partial.id) : null;
}

/**
 * Rasterize CashierTaxInvoiceView off-screen and save as PDF.
 * Uses the same 940px width as InvoiceDetailsModal so output matches View Invoice.
 */
export async function downloadPosInvoicePdf(invoice) {
    const normalized = normalizeInvoiceForModal(invoice);
    const invoiceNo =
        normalized?.invoiceNo ?? normalized?.invoice_no ?? normalized?.id ?? 'invoice';

    await ensureInvoicePdfFonts();

    const mount = document.createElement('div');
    mount.setAttribute('data-pos-invoice-pdf-mount', '1');
    mount.style.cssText = [
        'position:fixed',
        'left:-10000px',
        'top:0',
        `width:${INVOICE_PDF_CONTENT_WIDTH}px`,
        'padding:0',
        'background:#fff',
        'pointer-events:none',
        'overflow:hidden',
        'box-sizing:border-box',
    ].join(';');
    document.body.appendChild(mount);

    const root = createRoot(mount);
    try {
        flushSync(() => {
            root.render(
                React.createElement(CashierTaxInvoiceView, {
                    invoice: normalized,
                    pdfCapture: true,
                }),
            );
        });

        await new Promise((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(resolve));
        });

        const qrImg = mount.querySelector('.cti-qr-wrap img');
        if (qrImg && !qrImg.complete) {
            await new Promise((resolve) => {
                qrImg.addEventListener('load', resolve, { once: true });
                qrImg.addEventListener('error', resolve, { once: true });
            });
        } else {
            await new Promise((resolve) => setTimeout(resolve, 120));
        }

        const el = mount.querySelector('.cti-root');
        if (!el) throw new Error('Invoice preview could not be rendered.');

        const captureWidth = INVOICE_PDF_CONTENT_WIDTH;
        const captureHeight = Math.max(el.scrollHeight, el.offsetHeight);

        const [{ toPng }, { jsPDF }] = await Promise.all([
            import('html-to-image'),
            import('jspdf'),
        ]);

        const imgData = await toPng(el, {
            backgroundColor: '#ffffff',
            pixelRatio: 2,
            cacheBust: true,
            width: captureWidth,
            height: captureHeight,
            style: {
                overflow: 'hidden',
                width: `${captureWidth}px`,
                maxWidth: `${captureWidth}px`,
            },
        });

        const dims = await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
            img.onerror = () => reject(new Error('Invalid PNG from invoice capture'));
            img.src = imgData;
        });

        const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 28;
        const usableW = pageWidth - margin * 2;
        const usableH = pageHeight - margin * 2;
        const imgDisplayHeight = (dims.h * usableW) / dims.w;

        if (imgDisplayHeight <= usableH) {
            pdf.addImage(imgData, 'PNG', margin, margin, usableW, imgDisplayHeight, undefined, 'FAST');
        } else {
            // One continuous page (like the view modal scroll) — avoids slicing through the goods table.
            const pageH = Math.ceil(imgDisplayHeight + margin * 2);
            const tallPdf = new jsPDF({
                unit: 'pt',
                format: [pageWidth, pageH],
                orientation: 'portrait',
                compress: true,
            });
            tallPdf.addImage(imgData, 'PNG', margin, margin, usableW, imgDisplayHeight, undefined, 'FAST');
            const safe =
                String(invoiceNo).replace(/[^\w.-]+/g, '_').replace(/^_|_$/g, '').slice(0, 96) ||
                'invoice';
            tallPdf.save(`${safe}.pdf`);
            return;
        }

        const safe = String(invoiceNo).replace(/[^\w.-]+/g, '_').replace(/^_|_$/g, '').slice(0, 96) || 'invoice';
        pdf.save(`${safe}.pdf`);
    } finally {
        root.unmount();
        mount.remove();
    }
}

/** Load invoice by id or number, open in modal (caller), and download PDF. */
export async function openInvoiceViewAndDownloadPdf(ctx = {}) {
    const resolvedId = await resolveInvoiceId(ctx);
    if (!resolvedId) {
        throw new Error(`Could not find invoice ${ctx.invoiceNo ?? ''}.`.trim());
    }
    const invoice = await fetchSuperAdminInvoiceForModal(resolvedId);
    await downloadPosInvoicePdf(invoice);
    return invoice;
}
