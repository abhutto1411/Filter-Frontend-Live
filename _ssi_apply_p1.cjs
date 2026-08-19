/**
 * Apply EN/AR localization wiring to SupplierSalesInvoices.jsx
 * Run after _ssi_localize.cjs. Prefer exact multi-line replacements.
 */
const fs = require('fs');

const JSX_PATH =
  'j:/work/Filter Both Front and Back/filter-web/src/pages/supplier/SupplierSalesInvoices.jsx';

let src = fs.readFileSync(JSX_PATH, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

function mustReplace(from, to, label) {
  if (!src.includes(from)) {
    console.error('MISSING block:', label || from.slice(0, 80));
    process.exit(1);
  }
  const n = src.split(from).length - 1;
  src = src.split(from).join(to);
  console.log('OK', label || from.slice(0, 60).replace(/\n/g, '⏎'), 'x' + n);
}

function tryReplace(from, to, label) {
  if (!src.includes(from)) {
    console.warn('SKIP', label || from.slice(0, 80));
    return false;
  }
  const n = src.split(from).length - 1;
  src = src.split(from).join(to);
  console.log('OK', label || from.slice(0, 60).replace(/\n/g, '⏎'), 'x' + n);
  return true;
}

// ——— imports ———
mustReplace(
  "import { resolveInvoiceLineProductName } from '../../utils/invoiceLineLabel';\n",
  "import { resolveInvoiceLineProductName } from '../../utils/invoiceLineLabel';\n" +
    "import { ssiT, SSI_MARK_PAID_METHOD_KEYS } from '../../utils/supplierSalesInvoicesI18n';\n",
  'import ssiT',
);

// ——— MARK_PAID_METHOD_OPTIONS: store value only; labels via t ———
mustReplace(
  `const MARK_PAID_METHOD_OPTIONS = [
    { value: 'cash', label: 'Cash' },
    { value: 'bank_transfer', label: 'Bank transfer' },
    { value: 'card', label: 'Card' },
    { value: 'cheque', label: 'Cheque' },
    { value: 'other', label: 'Other' },
];`,
  `const MARK_PAID_METHOD_VALUES = ['cash', 'bank_transfer', 'card', 'cheque', 'other'];`,
  'MARK_PAID_METHOD_VALUES',
);

// ——— settlement / status helpers ———
mustReplace(
  `function salesInvoiceArSettlementLabel(inv) {
    const bal = Number(inv?.balance ?? 0);
    const paid = Number(inv?.paid ?? 0);
    if (bal <= 0.005) return { text: 'Paid', tone: 'green' };
    if (paid > 0.005) return { text: 'Partial', tone: 'amber' };
    return { text: 'Unpaid', tone: 'amber' };
}`,
  `function salesInvoiceArSettlementLabel(inv, t) {
    const bal = Number(inv?.balance ?? 0);
    const paid = Number(inv?.paid ?? 0);
    if (bal <= 0.005) return { text: t('settle.paid'), tone: 'green', code: 'paid' };
    if (paid > 0.005) return { text: t('settle.partial'), tone: 'amber', code: 'partial' };
    return { text: t('settle.unpaid'), tone: 'amber', code: 'unpaid' };
}`,
  'salesInvoiceArSettlementLabel',
);

mustReplace(
  `function salesInvoiceMgrStatus(inv) {
    const balance = Number(inv?.balance ?? 0);
    const paid = Number(inv?.paid ?? 0);
    const due = String(inv?.dueDate ?? '').slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    if (balance <= 0.005) {
        return { label: 'Paid in full', cls: 'mgr-si-status mgr-si-status--paid' };
    }
    if (due && due < today && balance > 0.005) {
        return { label: 'Overdue', cls: 'mgr-si-status mgr-si-status--overdue' };
    }
    if (paid > 0.005) {
        return { label: 'Partially paid', cls: 'mgr-si-status mgr-si-status--partial' };
    }
    const raw = String(inv?.status || '')
        .replace(/_/g, ' ')
        .trim();
    if (raw === 'draft') {
        return { label: 'Draft', cls: 'mgr-si-status mgr-si-status--draft' };
    }
    return {
        label: raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : 'Pending payment',
        cls: 'mgr-si-status mgr-si-status--pending',
    };
}`,
  `function salesInvoiceMgrStatus(inv, t) {
    const balance = Number(inv?.balance ?? 0);
    const paid = Number(inv?.paid ?? 0);
    const due = String(inv?.dueDate ?? '').slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    if (balance <= 0.005) {
        return { label: t('status.paidInFull'), cls: 'mgr-si-status mgr-si-status--paid' };
    }
    if (due && due < today && balance > 0.005) {
        return { label: t('status.overdue'), cls: 'mgr-si-status mgr-si-status--overdue' };
    }
    if (paid > 0.005) {
        return { label: t('status.partiallyPaid'), cls: 'mgr-si-status mgr-si-status--partial' };
    }
    const raw = String(inv?.status || '')
        .replace(/_/g, ' ')
        .trim();
    if (raw === 'draft') {
        return { label: t('status.draft'), cls: 'mgr-si-status mgr-si-status--draft' };
    }
    return {
        label: raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : t('status.pendingPayment'),
        cls: 'mgr-si-status mgr-si-status--pending',
    };
}`,
  'salesInvoiceMgrStatus',
);

mustReplace(
  `    const typeLabel = rawType === 'cash' ? 'Cash' : 'Bank';
    const nameBaseRaw = raw.name ?? raw.accountName;
    const nameBase =
        nameBaseRaw != null && String(nameBaseRaw).trim() !== ''
            ? String(nameBaseRaw).trim()
            : 'Account';
    const optionLabel = \`\${nameBase} (\${typeLabel})\`;`,
  `    const typeLabel = rawType === 'cash' ? t('account.cash') : t('account.bank');
    const nameBaseRaw = raw.name ?? raw.accountName;
    const nameBase =
        nameBaseRaw != null && String(nameBaseRaw).trim() !== ''
            ? String(nameBaseRaw).trim()
            : t('account.fallback');
    const optionLabel = t('account.option', { name: nameBase, type: typeLabel });`,
  'mapSupplierCashBankAccountForPickers labels',
);

mustReplace(
  `function mapSupplierCashBankAccountForPickers(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const id = raw.id ?? raw.accountId;
    if (id == null || id === '') return null;
    const rawType = String(raw.accountType ?? raw.type ?? 'bank').toLowerCase();`,
  `function mapSupplierCashBankAccountForPickers(raw, t = (k, v) => ssiT('en', k, v)) {
    if (!raw || typeof raw !== 'object') return null;
    const id = raw.id ?? raw.accountId;
    if (id == null || id === '') return null;
    const rawType = String(raw.accountType ?? raw.type ?? 'bank').toLowerCase();`,
  'mapSupplierCashBankAccountForPickers sig',
);

mustReplace(
  `        generalNote: invoiceNo ? \`Payment received for sales invoice \${invoiceNo}\` : '',`,
  `        generalNote: invoiceNo ? t('note.paymentReceived', { no: invoiceNo }) : '',`,
  'payment received note',
);

mustReplace(
  `function buildTransactionHubReceiptPrefill(inv) {`,
  `function buildTransactionHubReceiptPrefill(inv, t = (k, v) => ssiT('en', k, v)) {`,
  'buildTransactionHubReceiptPrefill sig',
);

// ——— normalizeStockCatalogRow hints ———
mustReplace(
  `function normalizeStockCatalogRow(item) {`,
  `function normalizeStockCatalogRow(item, t = (k, v) => ssiT('en', k, v)) {`,
  'normalizeStockCatalogRow sig',
);

mustReplace(
  `    const costHint =
        qtyWh > 0
            ? \`Warehouse stock: \${qtyWh} \${warehouseUnit} • Unit cost SAR \${unitCostWh.toLocaleString(undefined, { maximumFractionDigits: 4 })} / \${warehouseUnit}\`
            : 'No warehouse stock — you can still sell; you will be asked to confirm before issuing.';
    const listHint =
        catalogSalePrice > 0
            ? \`Stock sales price SAR \${roundMoney2(catalogSalePrice * conversionFactor).toFixed(2)} / \${warehouseUnit} incl. VAT\`
            : Number.isFinite(suggestedWh) && suggestedWh > 0
              ? \`Suggested list SAR \${suggestedWh.toFixed(2)} / \${warehouseUnit} (invoice default)\`
              : '';`,
  `    const costHint =
        qtyWh > 0
            ? t('hint.warehouseStock', {
                  qty: qtyWh,
                  unit: warehouseUnit,
                  cost: t('money.sar', {
                      amount: unitCostWh.toLocaleString(undefined, { maximumFractionDigits: 4 }),
                  }),
              })
            : t('hint.noWarehouseStock');
    const listHint =
        catalogSalePrice > 0
            ? t('hint.stockSalesPriceAmt', {
                  amount: t('money.sar', {
                      amount: roundMoney2(catalogSalePrice * conversionFactor).toFixed(2),
                  }),
                  unit: warehouseUnit,
              })
            : Number.isFinite(suggestedWh) && suggestedWh > 0
              ? t('hint.suggestedList', {
                    amount: t('money.sar', { amount: suggestedWh.toFixed(2) }),
                    unit: warehouseUnit,
                })
              : '';`,
  'stock hints',
);

mustReplace(
  `        : catalogSalePrice > 0
          ? 'Stock sales price'
          : '';`,
  `        : catalogSalePrice > 0
          ? t('hint.stockSalesPrice')
          : '';`,
  'lastSaleMeta stock sales price',
);

mustReplace(
  `    name: item.productName || 'Product',`,
  `    name: item.productName || t('fallback.product'),`,
  'fallback product name',
);

// ——— formatLineUomConversionPreview ———
mustReplace(
  `function formatLineUomConversionPreview(line, inv) {
    if (!inv) return '';
    const cf = Number(inv.conversionFactor) || 1;
    if (!(cf > 1)) return '';
    const wu = inv.warehouseUnit || 'Box';
    const wsu = inv.workshopUnit || 'pcs';
    const qty = parseFloat(String(line.qty).replace(',', '.')) || 0;
    if (!(qty > 0)) return '';
    const price = parseFloat(String(line.price).replace(',', '.')) || 0;
    if (isWarehouseUomLine(line, inv)) {
        const wsQty = roundMoney2(qty * cf);
        const wsPrice = cf > 0 ? roundMoney2(price / cf) : price;
        return \`\${qty} \${wu} = \${wsQty} \${wsu} at workshop · SAR \${price.toFixed(2)}/\${wu} → SAR \${wsPrice.toFixed(2)}/\${wsu}\`;
    }
    const whQty = roundMoney2(qty / cf);
    const whPrice = roundMoney2(price * cf);
    return \`\${qty} \${wsu} = \${whQty} \${wu} warehouse · SAR \${price.toFixed(2)}/\${wsu} → SAR \${whPrice.toFixed(2)}/\${wu}\`;
}`,
  `function formatLineUomConversionPreview(line, inv, t = (k, v) => ssiT('en', k, v)) {
    if (!inv) return '';
    const cf = Number(inv.conversionFactor) || 1;
    if (!(cf > 1)) return '';
    const wu = inv.warehouseUnit || 'Box';
    const wsu = inv.workshopUnit || 'pcs';
    const qty = parseFloat(String(line.qty).replace(',', '.')) || 0;
    if (!(qty > 0)) return '';
    const price = parseFloat(String(line.price).replace(',', '.')) || 0;
    if (isWarehouseUomLine(line, inv)) {
        const wsQty = roundMoney2(qty * cf);
        const wsPrice = cf > 0 ? roundMoney2(price / cf) : price;
        return t('hint.uomWhToWs', {
            qty,
            wu,
            wsQty,
            wsu,
            price: t('money.sar', { amount: price.toFixed(2) }),
            wsPrice: t('money.sar', { amount: wsPrice.toFixed(2) }),
        });
    }
    const whQty = roundMoney2(qty / cf);
    const whPrice = roundMoney2(price * cf);
    return t('hint.uomWsToWh', {
        qty,
        wsu,
        whQty,
        wu,
        price: t('money.sar', { amount: price.toFixed(2) }),
        whPrice: t('money.sar', { amount: whPrice.toFixed(2) }),
    });
}`,
  'formatLineUomConversionPreview',
);

// ——— component signature + t ———
mustReplace(
  `export default function SupplierSalesInvoices() {
    const [invoices, setInvoices] = useState([]);`,
  `export default function SupplierSalesInvoices({ locale: localeProp } = {}) {
    const locale =
        localeProp ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => ssiT(locale, key, vars), [locale]);

    const [invoices, setInvoices] = useState([]);`,
  'component locale+t',
);

// ——— issue button labels ———
mustReplace(
  `    const issueButtonLabel = isEditingDraft
        ? isWalkInCustomer
            ? 'Create Sale Invoice'
            : 'Issue Sales Invoice'
        : invoiceModalMode === 'edit'
          ? 'Update Invoice'
          : isWalkInCustomer
            ? 'Create Sale Invoice'
            : 'Issue Sales Invoice';`,
  `    const issueButtonLabel = isEditingDraft
        ? isWalkInCustomer
            ? t('btn.createSaleInvoice')
            : t('btn.issueSalesInvoice')
        : invoiceModalMode === 'edit'
          ? t('btn.updateInvoice')
          : isWalkInCustomer
            ? t('btn.createSaleInvoice')
            : t('btn.issueSalesInvoice');`,
  'issueButtonLabel',
);

// ——— summary discount labels ———
mustReplace(
  `            invoiceDiscountSummaryLabel:
                invoiceDiscountMode === 'percent'
                    ? \`Invoice discount (\${invPctDisplayed}%):\`
                    : 'Invoice discount (fixed SAR):',`,
  `            invoiceDiscountSummaryLabel:
                invoiceDiscountMode === 'percent'
                    ? t('summary.invDiscPct', { pct: invPctDisplayed })
                    : t('summary.invDiscFixed'),`,
  'invoiceDiscountSummaryLabel',
);

// ——— customer group fallbacks in normalizeSalesInvoiceCustomers ———
mustReplace(
  `            group: c.group || 'Customers',
            label: c.label || 'Customer',`,
  `            group: c.group || 'Customers',
            label: c.label || 'Customer', // display via localizeCustomerGroup in UI`,
  'customer fallback comment',
);

// Note: group strings from API stay as English keys we map at display time.
// Add helper after imports area for group localization used in render.

mustReplace(
  `import { ssiT, SSI_MARK_PAID_METHOD_KEYS } from '../../utils/supplierSalesInvoicesI18n';\n`,
  `import { ssiT, SSI_MARK_PAID_METHOD_KEYS } from '../../utils/supplierSalesInvoicesI18n';\n\n` +
    `function localizeCustomerGroup(group, t) {\n` +
    `    const g = String(group || '').trim();\n` +
    `    if (!g) return t('group.customers');\n` +
    `    const lower = g.toLowerCase();\n` +
    `    if (lower === 'customers') return t('group.customers');\n` +
    `    if (lower === 'affiliated workshops') return t('group.affiliated');\n` +
    `    return g;\n` +
    `}\n`,
  'localizeCustomerGroup helper',
);

fs.writeFileSync(JSX_PATH, src);
console.log('Phase 1 done, length', src.length);
