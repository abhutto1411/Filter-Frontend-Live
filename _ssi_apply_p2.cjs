/**
 * Phase 2: call-site updates + bulk UI string replacements
 */
const fs = require('fs');
const JSX_PATH =
  'j:/work/Filter Both Front and Back/filter-web/src/pages/supplier/SupplierSalesInvoices.jsx';

let src = fs.readFileSync(JSX_PATH, 'utf8');

function mustReplace(from, to, label) {
  if (!src.includes(from)) {
    console.error('MISSING:', label || from.slice(0, 100));
    process.exit(1);
  }
  const n = src.split(from).length - 1;
  src = src.split(from).join(to);
  console.log('OK', (label || from.slice(0, 50)).replace(/\n/g, '⏎'), 'x' + n);
}

function tryReplace(from, to, label) {
  if (!src.includes(from)) {
    console.warn('SKIP', label || from.slice(0, 80));
    return false;
  }
  const n = src.split(from).length - 1;
  src = src.split(from).join(to);
  console.log('OK', (label || from.slice(0, 50)).replace(/\n/g, '⏎'), 'x' + n);
  return true;
}

// Call sites
mustReplace(
  'salesInvoiceArSettlementLabel(inv)',
  'salesInvoiceArSettlementLabel(inv, t)',
  'arSettle call',
);
mustReplace(
  'salesInvoiceMgrStatus(inv)',
  'salesInvoiceMgrStatus(inv, t)',
  'mgrStatus call',
);
mustReplace(
  'arSettle.text !== \'Paid\'',
  "arSettle.code !== 'paid'",
  'arSettle compare code',
);
mustReplace(
  'buildTransactionHubReceiptPrefill(inv)',
  'buildTransactionHubReceiptPrefill(inv, t)',
  'prefill call',
);
mustReplace(
  'formatLineUomConversionPreview(\n                                        line,\n                                        capsRow,\n                                    )',
  'formatLineUomConversionPreview(\n                                        line,\n                                        capsRow,\n                                        t,\n                                    )',
  'uom preview call',
);

// normalizeStockCatalogRow calls - find patterns
tryReplace(
  'normalizeStockCatalogRow(raw)',
  'normalizeStockCatalogRow(raw, t)',
  'normalizeStockCatalogRow(raw)',
);

tryReplace(
  '.map(mapSupplierCashBankAccountForPickers)',
  '.map((raw) => mapSupplierCashBankAccountForPickers(raw, t))',
  'map cash bank pickers',
);

// MARK_PAID_METHOD_OPTIONS -> VALUES + t labels
mustReplace(
  `{MARK_PAID_METHOD_OPTIONS.map((o) => (
                                        <option key={o.value} value={o.value}>
                                            {o.label}
                                        </option>
                                    ))}`,
  `{MARK_PAID_METHOD_VALUES.map((value) => (
                                        <option key={value} value={value}>
                                            {t(SSI_MARK_PAID_METHOD_KEYS[value])}
                                        </option>
                                    ))}`,
  'mark paid method options',
);

// Error / alert strings (exact)
const errPairs = [
  ["setSaveError('Select a customer.');", "setSaveError(t('err.selectCustomer'));"],
  ["setSaveError('Selected customer is inactive.');", "setSaveError(t('err.customerInactive'));"],
  ["setSaveError('Add at least one line item.');", "setSaveError(t('err.addLineItem'));"],
  [
    "setSaveError('Add at least one line with an account or item name to save a draft.');",
    "setSaveError(t('err.addLineDraft'));",
  ],
  [
    "setSaveError(`Line ${invalidLine.index + 1}: select an account (or enter item name), qty must be > 0, and price cannot be negative.`);",
    "setSaveError(t('err.lineInvalid', { n: invalidLine.index + 1 }));",
  ],
  ["err?.message || 'Failed to load invoices.'", "err?.message || t('err.loadInvoices')"],
  ["err?.message || 'Failed to refresh invoices.'", "err?.message || t('err.refreshInvoices')"],
  ["err?.message || 'Failed to save invoice.'", "err?.message || t('err.saveInvoice')"],
  ["setSaveError('Invoice not found.');", "setSaveError(t('err.invoiceNotFound'));"],
  ["err?.message || 'Could not load invoice.'", "err?.message || t('err.loadInvoice')"],
  [
    "setViewPayload({ error: err?.message || 'Failed to load invoice.' });",
    "setViewPayload({ error: err?.message || t('err.viewInvoice') });",
  ],
  ["throw new Error('Invoice not found.');", "throw new Error(t('err.invoiceNotFound'));"],
  [
    "throw new Error('Could not initialize invoice PDF.');",
    "throw new Error(t('err.initPdf'));",
  ],
  [
    "err?.message || 'Could not download invoice PDF.'",
    "err?.message || t('err.downloadPdf')",
  ],
  [
    "window.alert('Only invoices with status pending_payment (no payments) can be deleted.');",
    "window.alert(t('err.deleteOnlyPending'));",
  ],
  [
    'if (!window.confirm(`Delete invoice ${row.invoiceNo}?`)) return;',
    "if (!window.confirm(t('err.deleteConfirm', { no: row.invoiceNo }))) return;",
  ],
  ["err?.message || 'Delete failed.'", "err?.message || t('err.deleteFailed')"],
  [
    "err?.message || 'Could not update payment status.'",
    "err?.message || t('err.updatePayment')",
  ],
  [
    "err?.message || 'Could not load invoice for return.'",
    "err?.message || t('err.loadReturn')",
  ],
  [
    "setReturnModalErr(`Invalid qty for ${it.productName || 'line'}.`);",
    "setReturnModalErr(t('err.invalidQty', { name: it.productName || t('fallback.line') }));",
  ],
  [
    "setReturnModalErr('Enter a return quantity on at least one line.');",
    "setReturnModalErr(t('err.enterReturnQty'));",
  ],
  ["err?.message || 'Could not save return.'", "err?.message || t('err.saveReturn')"],
  [
    "setMarkPaidModalErr('Select a payment method.');",
    "setMarkPaidModalErr(t('err.selectPaymentMethod'));",
  ],
  [
    "setMarkPaidModalErr('Select receiving account or enter a custom account name.');",
    "setMarkPaidModalErr(t('err.selectReceivingAccount'));",
  ],
  ["err?.message || 'Could not record payment.'", "err?.message || t('err.recordPayment')"],
  ["err?.message || 'Failed to load.'", "err?.message || t('err.loadFailed')"],
  [
    "invRes.__error?.message || 'Failed to load invoices.'",
    "invRes.__error?.message || t('err.loadInvoices')",
  ],
];

for (const [a, b] of errPairs) {
  tryReplace(a, b, a.slice(0, 50));
}

// cannot return template
mustReplace(
  `                setReturnModalErr(
                    \`Cannot return \${q} of "\${it.productName}" — only \${remaining.toFixed(
                        4,
                    )} left on this invoice line.\`,
                );`,
  `                setReturnModalErr(
                    t('err.cannotReturn', {
                        q,
                        name: it.productName,
                        left: remaining.toFixed(4),
                    }),
                );`,
  'cannot return',
);

// stock confirm
mustReplace(
  `                \`The following product(s) exceed available supplier stock:\\n\\n\${detail}\\n\\nContinue anyway? Your stock inventory timeline will show a negative balance for these items.\`,`,
  `                t('err.stockConfirm', { detail }),`,
  'stock confirm',
);

// stock line detail builder - find the detail join
tryReplace(
  "`• ${row.name}: ${row.requestedQty} ${row.unit} (available: ${row.availableQty} ${row.unit})`",
  "t('err.stockLine', { name: row.name, requested: row.requestedQty, available: row.availableQty, unit: row.unit })",
  'stock line',
);

// workshop order note
tryReplace(
  "`Workshop order ${prefill.workshopPurchaseInvoiceNumber}`",
  "t('note.workshopOrder', { no: prefill.workshopPurchaseInvoiceNumber })",
  'workshop order note',
);

// Product fallback in exceeding stock
tryReplace(
  `                row.item ||
                'Product',`,
  `                row.item ||
                t('fallback.product'),`,
  'exceed product fallback',
);

fs.writeFileSync(JSX_PATH, src);
console.log('Phase 2a done');
