/**
 * Phase 6: mark paid, return modal, view modal + leftovers
 */
const fs = require('fs');
const JSX_PATH =
  'j:/work/Filter Both Front and Back/filter-web/src/pages/supplier/SupplierSalesInvoices.jsx';

let src = fs.readFileSync(JSX_PATH, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

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

tryReplace(
  `                        title="Record payment"`,
  `                        title={t('modal.recordPayment')}`,
  'mark paid title',
);

mustReplace(
  `                                        Cancel
                                    </button>
                                </div>
                                <div className="pi-footer-right">
                                    <button
                                        type="button"
                                        className="btn-pi-create"
                                        onClick={confirmMarkPaid}`,
  `                                        {t('btn.cancel')}
                                    </button>
                                </div>
                                <div className="pi-footer-right">
                                    <button
                                        type="button"
                                        className="btn-pi-create"
                                        onClick={confirmMarkPaid}`,
  'mark paid cancel',
);

mustReplace(
  `                                        {markPaidModalBusy ? 'Recording…' : 'Confirm paid'}`,
  `                                        {markPaidModalBusy ? t('btn.recording') : t('btn.confirmPaid')}`,
  'confirm paid',
);

mustReplace(
  `                        <p style={{ margin: '0 0 14px', fontSize: '0.875rem', color: '#475569' }}>
                            Invoice <strong>{markPaidModalRow.invoiceNo}</strong>
                            {' — '}
                            balance SAR{' '}
                            <strong>{Number(markPaidModalRow.balance || 0).toFixed(2)}</strong>
                        </p>`,
  `                        <p style={{ margin: '0 0 14px', fontSize: '0.875rem', color: '#475569' }}>
                            {t('modal.invoiceBalance.before')}{' '}
                            <strong>{markPaidModalRow.invoiceNo}</strong>{' '}
                            {t('modal.invoiceBalance.mid')}{' '}
                            <strong>
                                {t('money.sar', {
                                    amount: Number(markPaidModalRow.balance || 0).toFixed(2),
                                })}
                            </strong>
                        </p>`,
  'mark paid balance text',
);

mustReplace(
  `                                <label htmlFor="mark-paid-method">Payment method *</label>`,
  `                                <label htmlFor="mark-paid-method">{t('label.paymentMethodReq')}</label>`,
  'payment method label',
);

mustReplace(
  `                                <label htmlFor="mark-paid-account">
                                    Receiving cash / bank account *
                                </label>`,
  `                                <label htmlFor="mark-paid-account">
                                    {t('label.receivingAccountReq')}
                                </label>`,
  'receiving account label',
);

mustReplace(
  `                                            <option value="">Select account</option>
                                            {markPaidAccounts.map((acc) => (
                                                <option key={acc.id} value={acc.id}>
                                                    {acc.optionLabel}
                                                </option>
                                            ))}
                                            <option value="__custom__">
                                                Other (enter name)…
                                            </option>
                                        </>
                                    ) : (
                                        <option value="__custom__">
                                            Enter account manually
                                        </option>
                                    )}`,
  `                                            <option value="">{t('opt.selectAccount')}</option>
                                            {markPaidAccounts.map((acc) => (
                                                <option key={acc.id} value={acc.id}>
                                                    {acc.optionLabel}
                                                </option>
                                            ))}
                                            <option value="__custom__">
                                                {t('opt.otherEnter')}
                                            </option>
                                        </>
                                    ) : (
                                        <option value="__custom__">
                                            {t('opt.enterManually')}
                                        </option>
                                    )}`,
  'mark paid accounts',
);

mustReplace(
  `                                    <label htmlFor="mark-paid-account-custom">
                                        Account name / details *
                                    </label>
                                    <input
                                        id="mark-paid-account-custom"
                                        type="text"
                                        value={markPaidCustomAccount}
                                        onChange={(e) =>
                                            setMarkPaidCustomAccount(e.target.value)
                                        }
                                        placeholder="e.g. Bank — Al Rajhi (current)"`,
  `                                    <label htmlFor="mark-paid-account-custom">
                                        {t('label.accountNameReq')}
                                    </label>
                                    <input
                                        id="mark-paid-account-custom"
                                        type="text"
                                        value={markPaidCustomAccount}
                                        onChange={(e) =>
                                            setMarkPaidCustomAccount(e.target.value)
                                        }
                                        placeholder={t('ph.accountExample')}`,
  'custom account',
);

// Return modal
mustReplace(
  `                                <span className="pi-breadcrumb">
                                    Sales Invoices ›{' '}
                                    <span className="pi-b-active">Return</span>
                                </span>
                                <div className="pi-title-main">
                                    <RotateCcw size={24} />
                                    <span>Sales Invoice Return</span>
                                </div>`,
  `                                <span className="pi-breadcrumb">
                                    {t('form.crumb.sales')}{' '}
                                    <span className="pi-b-active">{t('form.crumb.return')}</span>
                                </span>
                                <div className="pi-title-main">
                                    <RotateCcw size={24} />
                                    <span>{t('form.returnTitle')}</span>
                                </div>`,
  'return title',
);

mustReplace(
  `                                        Cancel
                                    </button>
                                </div>
                                <div className="pi-footer-right">
                                    <button
                                        type="button"
                                        className="btn-pi-create"
                                        onClick={submitSalesInvoiceReturn}`,
  `                                        {t('btn.cancel')}
                                    </button>
                                </div>
                                <div className="pi-footer-right">
                                    <button
                                        type="button"
                                        className="btn-pi-create"
                                        onClick={submitSalesInvoiceReturn}`,
  'return cancel',
);

mustReplace(
  `                                                Saving…
                                            </span>
                                        ) : (
                                            'Submit return'
                                        )}`,
  `                                                {t('btn.saving')}
                                            </span>
                                        ) : (
                                            t('btn.submitReturn')
                                        )}`,
  'submit return',
);

mustReplace(
  `                                        Loading invoice &amp; return history…
                                    </p>`,
  `                                        {t('form.loadingReturn')}
                                    </p>`,
  'loading return',
);

mustReplace(
  `                                        Credits reduce the workshop&apos;s outstanding balance on this invoice (AR).
                                        Each return is saved with a reference number and logged in supplier
                                        transaction history — same as issuing an invoice, list totals update
                                        immediately after you submit.
                                    </div>`,
  `                                        {t('return.banner')}
                                    </div>`,
  'return banner',
);

mustReplace(
  `                                                    <label>Invoice #</label>
                                                    <input
                                                        readOnly
                                                        value={returnInvoiceDetail.invoice.invoiceNo || '—'}
                                                    />
                                                </div>
                                                <div className="pi-field">
                                                    <label>Issue date</label>`,
  `                                                    <label>{t('label.invoiceNo')}</label>
                                                    <input
                                                        readOnly
                                                        value={returnInvoiceDetail.invoice.invoiceNo || t('emdash')}
                                                    />
                                                </div>
                                                <div className="pi-field">
                                                    <label>{t('label.issueDate')}</label>`,
  'return invoice# issue',
);

mustReplace(
  `                                                    <label>Due date</label>
                                                    <input
                                                        readOnly
                                                        value={
                                                            returnInvoiceDetail.invoice.dueDate?.slice(0, 10) ||
                                                            '—'
                                                        }
                                                    />`,
  `                                                    <label>{t('label.dueDate')}</label>
                                                    <input
                                                        readOnly
                                                        value={
                                                            returnInvoiceDetail.invoice.dueDate?.slice(0, 10) ||
                                                            t('emdash')
                                                        }
                                                    />`,
  'return due',
);

mustReplace(
  `                                                    <label>Workshop / Branch (customer)</label>`,
  `                                                    <label>{t('label.workshopBranch')}</label>`,
  'workshop branch label',
);

mustReplace(
  `                                                    <label>Grand total</label>
                                                    <input
                                                        readOnly
                                                        value={\`SAR \${Number(
                                                            returnInvoiceDetail.invoice.grandTotal ?? 0,
                                                        ).toLocaleString(undefined, {
                                                            minimumFractionDigits: 2,
                                                            maximumFractionDigits: 2,
                                                        })}\`}
                                                    />
                                                </div>
                                                <div className="pi-field">
                                                    <label>Paid</label>
                                                    <input
                                                        readOnly
                                                        value={\`SAR \${Number(
                                                            returnInvoiceDetail.invoice.paid ?? 0,
                                                        ).toLocaleString(undefined, {
                                                            minimumFractionDigits: 2,
                                                            maximumFractionDigits: 2,
                                                        })}\`}
                                                    />
                                                </div>
                                                <div className="pi-field">
                                                    <label>Returns credited</label>
                                                    <input
                                                        readOnly
                                                        value={\`SAR \${Number(
                                                            returnInvoiceDetail.invoice.returnsTotal ?? 0,
                                                        ).toLocaleString(undefined, {
                                                            minimumFractionDigits: 2,
                                                            maximumFractionDigits: 2,
                                                        })}\`}
                                                    />
                                                </div>`,
  `                                                    <label>{t('label.grandTotal')}</label>
                                                    <input
                                                        readOnly
                                                        value={t('money.sar', {
                                                            amount: Number(
                                                                returnInvoiceDetail.invoice.grandTotal ?? 0,
                                                            ).toLocaleString(undefined, {
                                                                minimumFractionDigits: 2,
                                                                maximumFractionDigits: 2,
                                                            }),
                                                        })}
                                                    />
                                                </div>
                                                <div className="pi-field">
                                                    <label>{t('label.paid')}</label>
                                                    <input
                                                        readOnly
                                                        value={t('money.sar', {
                                                            amount: Number(
                                                                returnInvoiceDetail.invoice.paid ?? 0,
                                                            ).toLocaleString(undefined, {
                                                                minimumFractionDigits: 2,
                                                                maximumFractionDigits: 2,
                                                            }),
                                                        })}
                                                    />
                                                </div>
                                                <div className="pi-field">
                                                    <label>{t('label.returnsCredited')}</label>
                                                    <input
                                                        readOnly
                                                        value={t('money.sar', {
                                                            amount: Number(
                                                                returnInvoiceDetail.invoice.returnsTotal ?? 0,
                                                            ).toLocaleString(undefined, {
                                                                minimumFractionDigits: 2,
                                                                maximumFractionDigits: 2,
                                                            }),
                                                        })}
                                                    />
                                                </div>`,
  'return totals',
);

mustReplace(
  `                                                    <label>Balance due (after returns)</label>
                                                    <input
                                                        readOnly
                                                        style={{ fontWeight: 700, color: '#b91c1c' }}
                                                        value={\`SAR \${Number(
                                                            returnInvoiceDetail.invoice.outstanding ?? 0,
                                                        ).toLocaleString(undefined, {
                                                            minimumFractionDigits: 2,
                                                            maximumFractionDigits: 2,
                                                        })}\`}
                                                    />`,
  `                                                    <label>{t('label.balanceAfterReturns')}</label>
                                                    <input
                                                        readOnly
                                                        style={{ fontWeight: 700, color: '#b91c1c' }}
                                                        value={t('money.sar', {
                                                            amount: Number(
                                                                returnInvoiceDetail.invoice.outstanding ?? 0,
                                                            ).toLocaleString(undefined, {
                                                                minimumFractionDigits: 2,
                                                                maximumFractionDigits: 2,
                                                            }),
                                                        })}
                                                    />`,
  'balance after returns',
);

mustReplace(
  `                                                Previous returns ({returnHistory.length})
                                            </div>`,
  `                                                {t('return.prevReturns', { n: returnHistory.length })}
                                            </div>`,
  'prev returns',
);

mustReplace(
  `                                                            {r.returnDate?.slice(0, 10) || '—'} · SAR{' '}
                                                            {Number(r.grandTotal || 0).toLocaleString(undefined, {
                                                                minimumFractionDigits: 2,
                                                                maximumFractionDigits: 2,
                                                            })}`,
  `                                                            {r.returnDate?.slice(0, 10) || t('emdash')} ·{' '}
                                                            {t('money.sar', {
                                                                amount: Number(r.grandTotal || 0).toLocaleString(undefined, {
                                                                    minimumFractionDigits: 2,
                                                                    maximumFractionDigits: 2,
                                                                }),
                                                            })}`,
  'return history money',
);

mustReplace(
  `                                            Lines to return
                                        </div>`,
  `                                            {t('return.linesToReturn')}
                                        </div>`,
  'lines to return',
);

mustReplace(
  `                                            <div className="pi-col-item">Item</div>
                                            <div className="pi-col-qty">Invoiced</div>
                                            <div className="pi-col-qty">Returned</div>
                                            <div className="pi-col-qty">Left</div>
                                            <div className="pi-col-qty">Return qty</div>
                                            <div className="pi-col-item">Reason</div>`,
  `                                            <div className="pi-col-item">{t('label.item')}</div>
                                            <div className="pi-col-qty">{t('label.invoiced')}</div>
                                            <div className="pi-col-qty">{t('label.returned')}</div>
                                            <div className="pi-col-qty">{t('label.left')}</div>
                                            <div className="pi-col-qty">{t('label.returnQty')}</div>
                                            <div className="pi-col-item">{t('label.reason')}</div>`,
  'return line headers',
);

mustReplace(
  `                                                                placeholder="Optional"`,
  `                                                                placeholder={t('ph.returnReason')}`,
  'return reason ph',
);

mustReplace(
  `                                            placeholder="Internal note for this return"`,
  `                                            placeholder={t('ph.returnNotes')}`,
  'return notes ph',
);

// View modal leftovers
tryReplace(
  `                            <p style={{ margin: 0 }}>No data.</p>`,
  `                            <p style={{ margin: 0 }}>{t('empty.noData')}</p>`,
  'no data',
);

tryReplace(
  `                                        {viewPayload?.invoice?.invoiceNo || 'Invoice'}`,
  `                                        {viewPayload?.invoice?.invoiceNo || t('view.fallbackInvoice')}`,
  'view fallback invoice',
);

tryReplace(
  `item.itemType ||
                                                                'Product'`,
  `item.itemType ||
                                                                t('fallback.product')`,
  'bottom item type',
);

tryReplace(
  `|| '—'
                                                        }
                                                    />
                                                </div>
                                                <div className="pi-field">
                                                    <label>{t('label.dueDate')}</label>`,
  `|| t('emdash')
                                                        }
                                                    />
                                                </div>
                                                <div className="pi-field">
                                                    <label>{t('label.dueDate')}</label>`,
  'issue date emdash return',
);

fs.writeFileSync(JSX_PATH, src);
console.log('Phase 6 done');
