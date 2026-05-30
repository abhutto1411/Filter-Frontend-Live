import { BASE_URL } from '../services/api';

export const thermalR2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

export const INVOICE_COLORS = {
  primary: '#FCC247',
  secondary: '#23262D',
  border: '#1A1A1A',
  gridBorder: '#CCCCCC',
  goodsBody: '#F5F5F5',
  checklistHeader: '#E2E8F0',
};

const GOODS_HEADERS = [
  ['Goods/Services', 'السلعة / الخدمة'],
  ['Unit Price (Excl. VAT)', 'سعر الوحدة (بدون ضريبة)'],
  ['Qty', 'الكمية'],
  ['Gross Amt Before VAT', 'الإجمالي قبل الضريبة'],
  ['Discount', 'الخصم'],
  ['Total Before VAT', 'المجموع قبل الضريبة'],
  ['VAT', 'الضريبة'],
  ['Total With VAT', 'الإجمالي مع الضريبة'],
];

export { GOODS_HEADERS };

export const CHECKLIST_ROWS = [
  ['Tire Pressure Check', 'فحص هواء الإطارات'],
  ['Brake Fluid Check', 'فحص سائل الفرامل'],
  ['Wipers Fluid Check', 'فحص سائل المساحات'],
  ['Power Steering Fluid Check', 'فحص سائل المقود'],
  ['Transmission Fluid Check', 'فحص سائل نقل الحركة'],
  ['Radiator Fluid Check', 'فحص سائل رديتر المحرك'],
];

function normalizeLocalhostToHttp(url) {
  let b = String(url || '').trim().replace(/\/+$/, '');
  if (!b) return b;
  const lower = b.toLowerCase();
  if (lower.startsWith('https://localhost') || lower.startsWith('https://127.0.0.1')) {
    return `http://${b.slice('https://'.length)}`;
  }
  if (!lower.includes('://')) return `http://${b}`;
  return b;
}

function preferLoopbackIpForLocalQr(url) {
  const u = String(url || '').trim();
  if (/^http:\/\/localhost(?=:\d|[/]|$)/i.test(u)) {
    return u.replace(/^http:\/\/localhost/i, 'http://127.0.0.1');
  }
  return u;
}

export function resolveInvoicePublicQrUrl(invoice) {
  const path = (invoice?.publicInvoicePath || invoice?.public_invoice_path || '').trim();
  if (path) {
    const base = normalizeLocalhostToHttp(BASE_URL);
    if (!base) return null;
    const p = path.startsWith('/') ? path : `/${path}`;
    return preferLoopbackIpForLocalQr(`${base}${p}`);
  }
  const legacy = (invoice?.publicInvoiceUrl || invoice?.public_invoice_url || '').trim();
  if (legacy) return preferLoopbackIpForLocalQr(normalizeLocalhostToHttp(legacy));
  return null;
}

export function thermalInvoiceQrPayload(invoice, totalWithVat) {
  const link = resolveInvoicePublicQrUrl(invoice);
  if (link) return link;
  const no = invoice?.invoiceNo || invoice?.invoice_no || '';
  const id = invoice?.id || '';
  return `INV:${no},ID:${id},TOTAL:${thermalR2(totalWithVat).toFixed(2)}`;
}

export function formatInvoiceLegalDate(raw) {
  if (!raw) return '—';
  try {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return String(raw);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  } catch {
    return String(raw);
  }
}

export function formatInvoiceIssuedTime(raw) {
  if (!raw) return '—';
  try {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '—';
  }
}

export const sar = (v) => `SAR ${thermalR2(v).toFixed(2)}`;

function mapLineItem(it) {
  const unitIncl = parseFloat(it.unitPrice ?? it.price ?? it.afterDiscountPrice ?? 0) || 0;
  return {
    productName: it.productName || it.product?.name || it.name || 'Item',
    productNameArabic: it.productNameArabic || it.product_name_arabic || '',
    unitPrice: unitIncl,
    qty: parseFloat(it.qty ?? it.quantity ?? 1) || 1,
    discountType: (it.discountType || it.discount_type || '').toLowerCase(),
    discountValue: parseFloat(it.discountValue ?? it.discount_value ?? it.discount ?? 0) || 0,
  };
}

function accumulateItems(invoice, emit) {
  const depts = Array.isArray(invoice.departments) ? invoice.departments : [];
  if (depts.length > 0) {
    let lineCount = 0;
    depts.forEach((d) => {
      (d.items || []).forEach((it) => {
        emit(mapLineItem(it));
        lineCount += 1;
      });
    });
    if (lineCount > 0) return;
  }
  const jobs =
    Array.isArray(invoice.jobs) ? invoice.jobs
    : Array.isArray(invoice.salesOrder?.jobs) ? invoice.salesOrder.jobs
    : Array.isArray(invoice.sales_order?.jobs) ? invoice.sales_order.jobs
    : Array.isArray(invoice.order?.jobs) ? invoice.order.jobs
    : [];
  if (jobs.length > 0) {
    jobs.forEach((j) => (j.items || []).forEach((it) => emit(mapLineItem(it))));
    return;
  }
  const flat = invoice.items || invoice.lineItems || [];
  flat.forEach((it) => emit(mapLineItem(it)));
}

export function computeThermalInvoiceLineRows(invoice) {
  const rows = [];
  accumulateItems(invoice, (item) => {
    const unitExcl = thermalR2(item.unitPrice / 1.15);
    const gross = thermalR2(unitExcl * item.qty);
    let disc = 0;
    if (item.discountType === 'percent' || item.discountType === 'percentage') {
      disc = thermalR2(gross * (item.discountValue / 100));
    } else if (item.discountValue > 0) {
      disc = thermalR2(item.discountValue);
    }
    const totalBeforeVat = thermalR2(gross - disc);
    const lineVat = thermalR2(totalBeforeVat * 0.15);
    const totalWithVat = thermalR2(totalBeforeVat + lineVat);
    rows.push({
      productName: item.productName,
      productNameArabic: item.productNameArabic,
      unitPriceExclVat: unitExcl,
      qty: item.qty,
      grossBeforeVat: gross,
      discount: disc,
      totalBeforeVat,
      lineVat,
      totalWithVat,
    });
  });
  return rows;
}

export function computeThermalInvoiceTotals(invoice) {
  let grossAmountExclVat = 0;
  let itemDiscountsTotal = 0;

  accumulateItems(invoice, (item) => {
    const unitExcl = thermalR2(item.unitPrice / 1.15);
    const gross = thermalR2(unitExcl * item.qty);
    let disc = 0;
    if (item.discountType === 'percent' || item.discountType === 'percentage') {
      disc = thermalR2(gross * (item.discountValue / 100));
    } else if (item.discountValue > 0) {
      disc = thermalR2(item.discountValue);
    }
    grossAmountExclVat += gross;
    itemDiscountsTotal += disc;
  });

  let invoiceDiscount = 0;
  let promoDiscount = 0;
  const jobs =
    Array.isArray(invoice.jobs) ? invoice.jobs
    : Array.isArray(invoice.salesOrder?.jobs) ? invoice.salesOrder.jobs
    : Array.isArray(invoice.sales_order?.jobs) ? invoice.sales_order.jobs
    : [];

  jobs.forEach((j) => {
    const afterLine =
      parseFloat(j.amountAfterDiscount) > 0
        ? parseFloat(j.amountAfterDiscount)
        : grossAmountExclVat - itemDiscountsTotal;
    const tType = (j.totalDiscountType || '').toLowerCase();
    const tVal = parseFloat(j.totalDiscountValue) || 0;
    if (tType === 'percent' || tType === 'percentage') {
      invoiceDiscount += thermalR2(afterLine * (tVal / 100));
    } else {
      invoiceDiscount += tVal;
    }
    promoDiscount += parseFloat(j.promoDiscountAmount) || 0;
  });

  const subtotalApi = parseFloat(invoice.subtotal) || 0;
  const afterItem = thermalR2(grossAmountExclVat - itemDiscountsTotal);
  if (subtotalApi > 0.001 && afterItem > 0.001) {
    const impliedNonItem = thermalR2(afterItem - thermalR2(subtotalApi));
    const attributed = thermalR2(invoiceDiscount + promoDiscount);
    if (impliedNonItem > attributed + 0.015) {
      invoiceDiscount = thermalR2(invoiceDiscount + (impliedNonItem - attributed));
    }
  }

  let totalDiscountLine = thermalR2(itemDiscountsTotal + invoiceDiscount + promoDiscount);
  const discountApi = parseFloat(invoice.discountAmount ?? invoice.discount_amount) || 0;
  if (discountApi > 0.001) totalDiscountLine = thermalR2(discountApi);

  let totalTaxableAmount = thermalR2(
    grossAmountExclVat - itemDiscountsTotal - invoiceDiscount - promoDiscount,
  );
  let vatAmount = thermalR2(totalTaxableAmount * 0.15);
  let totalInvoiceAmount = thermalR2(totalTaxableAmount + vatAmount);

  if (subtotalApi > 0.001) totalTaxableAmount = thermalR2(subtotalApi);
  const vatApi = parseFloat(invoice.vatAmount ?? invoice.vat_amount) || 0;
  if (vatApi > 0.001) vatAmount = thermalR2(vatApi);
  const totalApi = parseFloat(invoice.totalAmount ?? invoice.total_amount ?? invoice.grandTotal) || 0;
  if (totalApi > 0.001) totalInvoiceAmount = thermalR2(totalApi);

  const grossExVatBeforeDiscount =
    grossAmountExclVat > 0.001
      ? grossAmountExclVat
      : thermalR2(totalTaxableAmount + totalDiscountLine);

  return {
    grossAmountExclVat,
    itemDiscountsTotal,
    invoiceDiscount,
    promoDiscount,
    totalDiscountLine,
    grossExVatBeforeDiscount,
    totalTaxableAmount,
    vatAmount,
    totalInvoiceAmount,
  };
}

/** Flatten nested corporate/cashier API invoice for the preview component. */
export function normalizeCashierInvoice(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  const order = raw.salesOrder || raw.sales_order || raw.order || {};
  const customer = raw.customer || order.customer || {};
  const vehicle = raw.vehicle || order.vehicle || {};
  const branch = raw.branch || order.branch || {};
  const workshop = raw.workshop || order.workshop || {};
  const jobs = Array.isArray(raw.jobs)
    ? raw.jobs
    : Array.isArray(order.jobs)
      ? order.jobs
      : [];

  const source = String(order.source || raw.source || '').toLowerCase();
  let customerType = raw.customerType || raw.customer_type || '';
  if (!customerType) {
    customerType =
      source.includes('corporate') || source.includes('walk_in_corporate')
        ? 'Corporate'
        : 'Individual';
  }

  return {
    ...raw,
    id: raw.id,
    invoiceNo: raw.invoiceNo || raw.invoice_no || raw.number,
    invoiceDate: raw.invoiceDate || raw.invoice_date || raw.date,
    issuedAt: raw.issuedAt || raw.issued_at || raw.createdAt,
    subtotal: raw.subtotal,
    vatAmount: raw.vatAmount ?? raw.vat_amount,
    discountAmount: raw.discountAmount ?? raw.discount_amount,
    totalAmount: raw.totalAmount ?? raw.total_amount ?? raw.grandTotal,
    branchName: raw.branchName || branch.name,
    branchVatId: raw.branchVatId || branch.vatId || branch.vat_id,
    branchAddress: raw.branchAddress || branch.address,
    workshopName: raw.workshopName || workshop.name,
    workshopTaxId: raw.workshopTaxId || workshop.taxId || workshop.tax_id,
    workshopAddress: raw.workshopAddress || workshop.address,
    customerName: raw.customerName || customer.name,
    customerMobile: raw.customerMobile || customer.mobile,
    customerTaxId: raw.customerTaxId || customer.taxId || customer.tax_id,
    customerType,
    vehicleMake: raw.vehicleMake || vehicle.make,
    vehicleModel: raw.vehicleModel || vehicle.model,
    vehicleYear: raw.vehicleYear ?? vehicle.year,
    vehicleVin: raw.vehicleVin || vehicle.vin,
    plateNo: raw.plateNo || vehicle.plateNo || vehicle.plateNumber,
    odometerReading: raw.odometerReading ?? order.odometerReading ?? order.odometer,
    nextOilChangeKm: raw.nextOilChangeKm ?? order.nextOilChangeKm,
    maintenanceChecklist: raw.maintenanceChecklist || raw.maintenance_checklist,
    publicInvoicePath: raw.publicInvoicePath || raw.public_invoice_path,
    publicInvoiceUrl: raw.publicInvoiceUrl || raw.public_invoice_url,
    jobs,
    order,
  };
}

export function branchRibbonSegments(invoice) {
  const b = String(invoice.branchName || '').trim();
  const w = String(invoice.workshopName || '').trim();
  if (b && w && b.toLowerCase() !== w.toLowerCase()) {
    return [b, w];
  }
  if (b) return [b];
  if (w) return [w];
  return [];
}

export function sellerVatRegistration(invoice) {
  const b = String(invoice.branchVatId || '').trim();
  if (b) return b;
  return String(invoice.workshopTaxId || '').trim();
}
