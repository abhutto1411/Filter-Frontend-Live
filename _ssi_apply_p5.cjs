/**
 * Phase 5: line items columns, tip, summary, mark paid, return, view
 */
const fs = require('fs');
const JSX_PATH =
  'j:/work/Filter Both Front and Back/filter-web/src/pages/supplier/SupplierSalesInvoices.jsx';

let src = fs.readFileSync(JSX_PATH, 'utf8');

function mustReplace(from, to, label) {
  from = from.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  to = to.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!src.includes(from)) {
    console.error('MISSING:', label || from.slice(0, 120));
    process.exit(1);
  }
  const n = src.split(from).length - 1;
  src = src.split(from).join(to);
  console.log('OK', (label || from.slice(0, 55)).replace(/\n/g, '⏎'), 'x' + n);
}

function tryReplace(from, to, label) {
  from = from.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  to = to.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!src.includes(from)) {
    console.warn('SKIP', label || from.slice(0, 80));
    return false;
  }
  const n = src.split(from).length - 1;
  src = src.split(from).join(to);
  console.log('OK', (label || from.slice(0, 55)).replace(/\n/g, '⏎'), 'x' + n);
  return true;
}

src = src.replace(/\r\n/g, '\n').replace(/\r/g, '\n');


mustReplace(
  `                                    {showLineNum && <div className="pi-col-hash">#</div>}
                                    <div className="pi-col-item">Item</div>
                                    <div className="pi-col-acc">Account</div>
                                    {showDesc && <div className="pi-col-desc">Description</div>}
                                    <div className="pi-col-uom">UOM</div>
                                    <div className="pi-col-qty">Qty</div>
                                    <div className="pi-col-price">
                                        Unit price
                                        {amountsTaxInclusive ? (
                                            <span
                                                style={{
                                                    display: 'block',
                                                    fontWeight: 400,
                                                    fontSize: 11,
                                                    color: '#64748b',
                                                }}
                                            >
                                                (incl. VAT)
                                            </span>
                                        ) : null}
                                    </div>
                                    {showDiscount && <div className="pi-col-disc">Discount</div>}
                                    <div className="pi-col-total">Total</div>
                                    <div className="pi-col-tax">Tax Code</div>
                                    <div className="pi-col-tamt">Tax Amt</div>
                                    <div className="pi-col-total">Grand Total</div>
                                    <div className="pi-col-total">Last Sale Price</div>`,
  `                                    {showLineNum && <div className="pi-col-hash">#</div>}
                                    <div className="pi-col-item">{t('label.item')}</div>
                                    <div className="pi-col-acc">{t('label.account')}</div>
                                    {showDesc && <div className="pi-col-desc">{t('label.description')}</div>}
                                    <div className="pi-col-uom">{t('label.uom')}</div>
                                    <div className="pi-col-qty">{t('label.qty')}</div>
                                    <div className="pi-col-price">
                                        {t('label.unitPrice')}
                                        {amountsTaxInclusive ? (
                                            <span
                                                style={{
                                                    display: 'block',
                                                    fontWeight: 400,
                                                    fontSize: 11,
                                                    color: '#64748b',
                                                }}
                                            >
                                                {t('label.inclVat')}
                                            </span>
                                        ) : null}
                                    </div>
                                    {showDiscount && <div className="pi-col-disc">{t('label.discount')}</div>}
                                    <div className="pi-col-total">{t('label.total')}</div>
                                    <div className="pi-col-tax">{t('label.taxCode')}</div>
                                    <div className="pi-col-tamt">{t('label.taxAmt')}</div>
                                    <div className="pi-col-total">{t('label.grandTotalCol')}</div>
                                    <div className="pi-col-total">{t('label.lastSalePrice')}</div>`,
  'line headers',
);

mustReplace(
  `                                                        placeholder="Item (optional)…"`,
  `                                                        placeholder={t('ph.itemOptional')}`,
  'item ph',
);

mustReplace(
  `                                                        title="Show item list"
                                                        aria-label="Open item list"`,
  `                                                        title={t('title.showItemList')}
                                                        aria-label={t('aria.openItemList')}`,
  'item list aria',
);

mustReplace(
  `                                                                        ? 'No products loaded.'
                                                                        : itemPickerFilter.trim()
                                                                          ? 'No matching products. Try SKU or more of the product name.'
                                                                          : 'No matching products.'}`,
  `                                                                        ? t('empty.noProductsLoaded')
                                                                        : itemPickerFilter.trim()
                                                                          ? t('empty.noMatchingProductsSku')
                                                                          : t('empty.noMatchingProducts')}`,
  'line picker empty',
);

mustReplace(
  `                                                            ? 'No products loaded. Try again later or use “Add line” and type manually.'
                                                            : searchQuery.trim()
                                                              ? 'No matching products. Try SKU, more letters, or check the product is active in your catalog.'
                                                              : 'No products available.'}`,
  `                                                            ? t('empty.noProductsTryAddLine')
                                                            : searchQuery.trim()
                                                              ? t('empty.noMatchingProductsActive')
                                                              : t('empty.noProductsAvailable')}`,
  'bottom picker empty',
);

mustReplace(
  `                                                                        ? \`per \${item.unit}\`
                                                                        : ' '}`,
  `                                                                        ? t('perUnit', { unit: item.unit })
                                                                        : ' '}`,
  'per unit',
);

// Remove the old tryReplace for product type that used wrong pattern - use exact
mustReplace(
  `                                                                                            {invItem.itemType ||
                                                                                                'Product'}`,
  `                                                                                            {invItem.itemType ||
                                                                                                t('fallback.product')}`,
  'invItem product type',
);

mustReplace(
  `                                                    placeholder="Description"`,
  `                                                    placeholder={t('ph.description')}`,
  'line desc ph',
);

mustReplace(
  `                                                    placeholder="UOM"`,
  `                                                    placeholder={t('ph.uom')}`,
  'uom ph',
);

mustReplace(
  `                                                        ? \`Quantity. Available \${maxQtyCap} \${line.uom || 'pcs'} (supplier stock balance).\`
                                                        : 'Quantity'`,
  `                                                        ? t('qty.ariaAvailable', {
                                                              cap: maxQtyCap,
                                                              uom: line.uom || 'pcs',
                                                          })
                                                        : t('qty.ariaDefault')`,
  'qty aria',
);

mustReplace(
  `                                                            ? \`Exceeds stock (\${maxQtyCap} \${line.uom || 'pcs'} available) — confirm on save\``,
  `                                                            ? t('qty.exceedsTitle', {
                                                                  cap: maxQtyCap,
                                                                  uom: line.uom || 'pcs',
                                                              })`,
  'exceeds title',
);

// available stock hint under qty
tryReplace(
  `\`\${maxQtyCap} \${line.uom || 'pcs'} available — supplier stock\``,
  `t('qty.availableStock', { cap: maxQtyCap, uom: line.uom || 'pcs' })`,
  'available stock hint',
);

mustReplace(
  `                                        <div className="pi-col-tamt">
                                            SAR {line.taxAmt}
                                        </div>
                                        <div className="pi-col-total">
                                            SAR {line.totalFinal}
                                        </div>`,
  `                                        <div className="pi-col-tamt">
                                            {t('money.sar', { amount: line.taxAmt })}
                                        </div>
                                        <div className="pi-col-total">
                                            {t('money.sar', { amount: line.totalFinal })}
                                        </div>`,
  'line money',
);

mustReplace(
  `                                                                Loading…
                                                            </span>`,
  `                                                                {t('loading')}
                                                            </span>`,
  'last sale loading',
);

mustReplace(
  `                                                        <span>
                                                            SAR{' '}
                                                            {Number(ls.price).toLocaleString(undefined, {
                                                                minimumFractionDigits: 2,
                                                                maximumFractionDigits: 4,
                                                            })}
                                                        </span>`,
  `                                                        <span>
                                                            {t('money.sar', {
                                                                amount: Number(ls.price).toLocaleString(undefined, {
                                                                    minimumFractionDigits: 2,
                                                                    maximumFractionDigits: 4,
                                                                }),
                                                            })}
                                                        </span>`,
  'last sale money',
);

mustReplace(
  `                                                        No previous sale or stock sales price set
                                                    </span>`,
  `                                                        {t('empty.noPreviousSale')}
                                                    </span>`,
  'no previous sale',
);

mustReplace(
  `                                                title="Remove line"
                                                aria-label="Remove line"`,
  `                                                title={t('title.removeLine')}
                                                aria-label={t('aria.removeLine')}`,
  'remove line',
);

mustReplace(
  `                                                placeholder="Search product to add"`,
  `                                                placeholder={t('ph.searchProduct')}`,
  'search product',
);

mustReplace(
  `                                        <Plus size={16} /> Add line
                                    </button>`,
  `                                        <Plus size={16} /> {t('btn.addLine')}
                                    </button>`,
  'add line btn',
);

mustReplace(
  `                                    <Zap size={14} /> Tip: ↑ ↓ arrows, Enter to select product on the
                                    same line. Tab moves across fields; Tab on the last field adds a
                                    new line. Price fields support math (e.g. 120*2).`,
  `                                    <Zap size={14} /> {t('tip.keyboard')}`,
  'keyboard tip',
);

mustReplace(
  `                                    <span>Column — Line number</span>`,
  `                                    <span>{t('col.lineNumber')}</span>`,
  'col line num',
);

mustReplace(
  `                                    <span>Column — Description</span>`,
  `                                    <span>{t('col.description')}</span>`,
  'col desc',
);

mustReplace(
  `                                    <span>Column — Discount</span>`,
  `                                    <span>{t('col.discount')}</span>`,
  'col disc',
);

mustReplace(
  `                                    <span>Amounts are tax inclusive</span>`,
  `                                    <span>{t('amounts.taxInclusive')}</span>`,
  'tax inclusive',
);

mustReplace(
  `                                        <label>Freight / Other Charges (SAR)</label>`,
  `                                        <label>{t('label.freight')}</label>`,
  'freight label',
);

mustReplace(
  `                                        <label>Invoice Discount</label>`,
  `                                        <label>{t('label.invoiceDiscount')}</label>`,
  'inv disc label',
);

mustReplace(
  `                                                <option value="fixed_sar">
                                                    Fixed (SAR)
                                                </option>`,
  `                                                <option value="fixed_sar">
                                                    {t('opt.fixedSar')}
                                                </option>`,
  'fixed sar opt',
);

mustReplace(
  `                                        <label>Notes</label>
                                        <textarea
                                            placeholder="Internal notes (optional, printed on invoice)"`,
  `                                        <label>{t('label.notes')}</label>
                                        <textarea
                                            placeholder={t('ph.internalNotes')}`,
  'notes field',
);

mustReplace(
  `                                            <span>Subtotal:</span>
                                            <span>SAR {summary.subtotal}</span>
                                        </div>
                                        {summary.showFreightRow ? (
                                            <div className="pi-summary-row">
                                                <span>Freight / Other charges:</span>
                                                <span>SAR {summary.freightInFormatted}</span>
                                            </div>
                                        ) : null}
                                        {summary.showInvoiceDiscountRow ? (
                                            <div className="pi-summary-row">
                                                <span>{summary.invoiceDiscountSummaryLabel}</span>
                                                <span style={{ color: '#B91C1C' }}>
                                                    − SAR {summary.invoiceDiscountFormatted}
                                                </span>
                                            </div>
                                        ) : null}
                                        {summary.showInvoiceDiscountRow ? (
                                            <div className="pi-summary-row">
                                                <span>Amount after invoice discount:</span>
                                                <span>SAR {summary.amountAfterDiscount}</span>
                                            </div>
                                        ) : null}
                                        <div className="pi-summary-row">
                                            <span>Total Tax (VAT):</span>
                                            <span>SAR {summary.totalTax}</span>
                                        </div>
                                        <div className="pi-summary-row pi-grand-total">
                                            <span>Grand Total:</span>
                                            <span>SAR {summary.grandTotal}</span>
                                        </div>`,
  `                                            <span>{t('summary.subtotal')}</span>
                                            <span>{t('money.sar', { amount: summary.subtotal })}</span>
                                        </div>
                                        {summary.showFreightRow ? (
                                            <div className="pi-summary-row">
                                                <span>{t('summary.freight')}</span>
                                                <span>{t('money.sar', { amount: summary.freightInFormatted })}</span>
                                            </div>
                                        ) : null}
                                        {summary.showInvoiceDiscountRow ? (
                                            <div className="pi-summary-row">
                                                <span>{summary.invoiceDiscountSummaryLabel}</span>
                                                <span style={{ color: '#B91C1C' }}>
                                                    − {t('money.sar', { amount: summary.invoiceDiscountFormatted })}
                                                </span>
                                            </div>
                                        ) : null}
                                        {summary.showInvoiceDiscountRow ? (
                                            <div className="pi-summary-row">
                                                <span>{t('summary.afterDisc')}</span>
                                                <span>{t('money.sar', { amount: summary.amountAfterDiscount })}</span>
                                            </div>
                                        ) : null}
                                        <div className="pi-summary-row">
                                            <span>{t('summary.totalTax')}</span>
                                            <span>{t('money.sar', { amount: summary.totalTax })}</span>
                                        </div>
                                        <div className="pi-summary-row pi-grand-total">
                                            <span>{t('summary.grandTotal')}</span>
                                            <span>{t('money.sar', { amount: summary.grandTotal })}</span>
                                        </div>`,
  'summary money',
);

mustReplace(
  `                                            {isWalkInCustomer ? (
                                                <>
                                                    Creates <strong>Accounts Receivable</strong> for
                                                    this walk-in customer and links the journal to{' '}
                                                    <strong>AR — Non-Affiliated Customers</strong> in
                                                    Chart of Accounts. Stock is reduced from your
                                                    warehouse; nothing is sent to a customer portal.
                                                </>
                                            ) : (
                                                <>
                                                    Creates <strong>Accounts Receivable</strong> for
                                                    this workshop branch. A linked{' '}
                                                    <strong>Purchase Invoice</strong> will appear in
                                                    the workshop&apos;s Accounting module.
                                                </>
                                            )}`,
  `                                            {isWalkInCustomer ? (
                                                <>
                                                    {t('alert.walkIn.before')}{' '}
                                                    <strong>{t('alert.walkIn.ar')}</strong>{' '}
                                                    {t('alert.walkIn.mid')}{' '}
                                                    <strong>{t('alert.walkIn.coa')}</strong>{' '}
                                                    {t('alert.walkIn.after')}
                                                </>
                                            ) : (
                                                <>
                                                    {t('alert.affiliated.before')}{' '}
                                                    <strong>{t('alert.affiliated.ar')}</strong>{' '}
                                                    {t('alert.affiliated.mid')}{' '}
                                                    <strong>{t('alert.affiliated.pi')}</strong>{' '}
                                                    {t('alert.affiliated.after')}
                                                </>
                                            )}`,
  'footer alerts',
);

fs.writeFileSync(JSX_PATH, src);
console.log('Phase 5a done');
