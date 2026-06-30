import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import CashierTaxInvoiceView from '../components/pos/modern/CashierTaxInvoiceView';
import { getInvoices, getSuperAdminInvoiceView } from '../services/superAdminApi';

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
    return {
        ...invoice,
        order: { ...srcOrder, jobs: srcJobs },
        jobs: srcJobs,
        customer: srcCustomer,
        vehicle: srcVehicle,
        branch: invoice.branch || srcOrder.branch,
        workshop: invoice.workshop || srcOrder.workshop,
        paymentMethod: invoice.paymentMethod || invoice.payments?.[0]?.method,
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
 */
export async function downloadPosInvoicePdf(invoice) {
    const normalized = normalizeInvoiceForModal(invoice);
    const invoiceNo =
        normalized?.invoiceNo ?? normalized?.invoice_no ?? normalized?.id ?? 'invoice';

    const mount = document.createElement('div');
    mount.setAttribute('data-pos-invoice-pdf-mount', '1');
    mount.style.cssText =
        'position:fixed;left:-10000px;top:0;width:800px;background:#fff;pointer-events:none;';
    document.body.appendChild(mount);

    const root = createRoot(mount);
    try {
        flushSync(() => {
            root.render(React.createElement(CashierTaxInvoiceView, { invoice: normalized }));
        });

        await new Promise((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(resolve));
        });

        const el = mount.querySelector('.cti-root');
        if (!el) throw new Error('Invoice preview could not be rendered.');

        const [{ toPng }, { jsPDF }] = await Promise.all([
            import('html-to-image'),
            import('jspdf'),
        ]);

        const imgData = await toPng(el, {
            backgroundColor: '#ffffff',
            pixelRatio: Math.min(2, window.devicePixelRatio || 2),
            cacheBust: true,
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
            pdf.addImage(imgData, 'PNG', margin, margin, usableW, imgDisplayHeight);
        } else {
            let heightLeft = imgDisplayHeight;
            let position = 0;
            while (heightLeft > 0) {
                pdf.addImage(imgData, 'PNG', margin, margin + position, usableW, imgDisplayHeight);
                heightLeft -= usableH;
                position -= usableH;
                if (heightLeft > 0) pdf.addPage();
            }
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
