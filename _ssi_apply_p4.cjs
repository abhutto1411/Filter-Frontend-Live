/**
 * Phase 4: invoice form modal + banners + fields
 */
const fs = require('fs');
const JSX_PATH =
  'j:/work/Filter Both Front and Back/filter-web/src/pages/supplier/SupplierSalesInvoices.jsx';

let src = fs.readFileSync(JSX_PATH, 'utf8');

function mustReplace(from, to, label) {
  if (!src.includes(from)) {
    console.error('MISSING:', label || from.slice(0, 120));
    process.exit(1);
  }
  const n = src.split(from).length - 1;
  src = src.split(from).join(to);
  console.log('OK', (label || from.slice(0, 55)).replace(/\n/g, '⏎'), 'x' + n);
}

mustReplace(
  `                                <span className="pi-breadcrumb">
                                    Sales Invoices ›{' '}
                                    <span className="pi-b-active">
                                        {invoiceModalMode === 'edit'
                                            ? editingInvoiceStatus === 'draft'
                                                ? 'Draft'
                                                : 'Edit'
                                            : 'New'}
                                    </span>
                                </span>
                                <div className="pi-title-main">
                                    <FileText size={24} />
                                    <span>Sales Invoice (Warehouse — Workshop)</span>
                                </div>`,
  `                                <span className="pi-breadcrumb">
                                    {t('form.crumb.sales')}{' '}
                                    <span className="pi-b-active">
                                        {invoiceModalMode === 'edit'
                                            ? editingInvoiceStatus === 'draft'
                                                ? t('form.crumb.draft')
                                                : t('form.crumb.edit')
                                            : t('form.crumb.new')}
                                    </span>
                                </span>
                                <div className="pi-title-main">
                                    <FileText size={24} />
                                    <span>{t('form.title')}</span>
                                </div>`,
  'form title crumb',
);

mustReplace(
  `                        backLabel="Back to Sales Invoices"`,
  `                        backLabel={t('form.back')}`,
  'backLabel both - careful',
);

// The above may replace both occurrences - that's fine (view + form)

mustReplace(
  `                                        Cancel
                                    </button>
                                </div>
                                <div className="pi-footer-right">
                                    {saveError ? (`,
  `                                        {t('btn.cancel')}
                                    </button>
                                </div>
                                <div className="pi-footer-right">
                                    {saveError ? (`,
  'form cancel',
);

mustReplace(
  `                                            {savingAction === 'draft' ? 'Saving…' : 'Save as Draft'}
                                        </button>`,
  `                                            {savingAction === 'draft' ? t('btn.saving') : t('btn.saveDraft')}
                                        </button>`,
  'save draft',
);

mustReplace(
  `                                        {savingAction === 'issue' ? 'Saving…' : issueButtonLabel}`,
  `                                        {savingAction === 'issue' ? t('btn.saving') : issueButtonLabel}`,
  'issue saving',
);

mustReplace(
  `                                        {invoiceModalMode === 'edit'
                                            ? 'Loading invoice…'
                                            : 'Loading warehouse catalog and branches…'}`,
  `                                        {invoiceModalMode === 'edit'
                                            ? t('form.loadingInvoice')
                                            : t('form.loadingCatalog')}`,
  'form loading',
);

mustReplace(
  `                                {isWalkInCustomer ? (
                                    <>
                                        Walk-in / off-platform customer — this invoice stays in{' '}
                                        <strong>your supplier portal only</strong> (no workshop portal
                                        or purchase invoice on the customer side). AR posts to the{' '}
                                        <strong>Non-Affiliated Customers</strong> control account in
                                        Chart of Accounts.
                                    </>
                                ) : (
                                    <>
                                        This creates an <strong>Accounts Receivable</strong> for you
                                        (supplier). It will also create a matching{' '}
                                        <strong>Purchase Invoice</strong> on the workshop side and
                                        update stock levels on both ends.
                                    </>
                                )}`,
  `                                {isWalkInCustomer ? (
                                    <>
                                        {t('banner.walkIn.before')}{' '}
                                        <strong>{t('banner.walkIn.strong')}</strong>{' '}
                                        {t('banner.walkIn.mid')}{' '}
                                        <strong>{t('banner.walkIn.ar')}</strong>{' '}
                                        {t('banner.walkIn.after')}
                                    </>
                                ) : (
                                    <>
                                        {t('banner.affiliated.before')}{' '}
                                        <strong>{t('banner.affiliated.ar')}</strong>{' '}
                                        {t('banner.affiliated.mid')}{' '}
                                        <strong>{t('banner.affiliated.pi')}</strong>{' '}
                                        {t('banner.affiliated.after')}
                                    </>
                                )}`,
  'form banners',
);

mustReplace(
  `                                    <label>Issue date</label>
                                    <div className="pi-input-with-icon">
                                        <input
                                            type="date"
                                            value={issueDate}
                                            onChange={(e) => setIssueDate(e.target.value)}
                                        />
                                        <Calendar size={16} />
                                    </div>
                                </div>
                                <div className="pi-field">
                                    <label>Due date</label>`,
  `                                    <label>{t('label.issueDate')}</label>
                                    <div className="pi-input-with-icon">
                                        <input
                                            type="date"
                                            value={issueDate}
                                            onChange={(e) => setIssueDate(e.target.value)}
                                        />
                                        <Calendar size={16} />
                                    </div>
                                </div>
                                <div className="pi-field">
                                    <label>{t('label.dueDate')}</label>`,
  'issue/due labels',
);

mustReplace(
  `                                            <option value="Net">Net</option>
                                            <option value="Custom">Custom</option>
                                            <option value="EOM">EOM</option>
                                        </select>
                                        {dueDateType === 'Net' && (
                                            <div className="pi-days-input">
                                                <input
                                                    type="number"
                                                    value={netDays}
                                                    onChange={(e) => setNetDays(e.target.value)}
                                                />
                                                <span>days</span>
                                            </div>
                                        )}`,
  `                                            <option value="Net">{t('opt.net')}</option>
                                            <option value="Custom">{t('opt.custom')}</option>
                                            <option value="EOM">{t('opt.eom')}</option>
                                        </select>
                                        {dueDateType === 'Net' && (
                                            <div className="pi-days-input">
                                                <input
                                                    type="number"
                                                    value={netDays}
                                                    onChange={(e) => setNetDays(e.target.value)}
                                                />
                                                <span>{t('label.days')}</span>
                                            </div>
                                        )}`,
  'due options',
);

mustReplace(
  `                                    <span className="pi-sub-label">Due: {calculatedDueDate}</span>
                                </div>
                                <InvoiceRefField
                                    label={
                                        invoiceModalMode === 'edit' ? 'Invoice #' : 'Ref # (Optional)'
                                    }
                                    placeholder="Ref #"`,
  `                                    <span className="pi-sub-label">{t('label.duePrefix')} {calculatedDueDate}</span>
                                </div>
                                <InvoiceRefField
                                    label={
                                        invoiceModalMode === 'edit' ? t('label.invoiceNo') : t('label.refOptional')
                                    }
                                    placeholder={t('label.refPlaceholder')}`,
  'due prefix + ref',
);

mustReplace(
  `                                    <label>Customer *</label>`,
  `                                    <label>{t('label.customerReq')}</label>`,
  'customer label',
);

mustReplace(
  `                                                placeholder="Search affiliated or non-affiliated customer…"`,
  `                                                placeholder={t('ph.customerSearch')}`,
  'customer search ph',
);

mustReplace(
  `                                                                            {customer.group}
                                                                        </div>`,
  `                                                                            {localizeCustomerGroup(customer.group, t)}
                                                                        </div>`,
  'customer group localize',
);

mustReplace(
  `                                                        {customerOptions.length === 0
                                                            ? 'No customers loaded. Add affiliated workshops or non-affiliated customers first.'
                                                            : 'No matching customers.'}`,
  `                                                        {customerOptions.length === 0
                                                            ? t('empty.noCustomersLoaded')
                                                            : t('empty.noMatchingCustomers')}`,
  'customer empty picker',
);

mustReplace(
  `                                            No customers found. Add workshops under Affiliated Filter
                                            workshops or customers under Non-affiliated customers /
                                            workshops.
                                        </span>`,
  `                                            {t('empty.noCustomersFound')}
                                        </span>`,
  'no customers found',
);

mustReplace(
  `                                    <label>Cash / Bank Account</label>
                                    <select
                                        value={cashAccount}
                                        onChange={(e) => setCashAccount(e.target.value)}
                                    >
                                        <option value="">Select account</option>`,
  `                                    <label>{t('label.cashBank')}</label>
                                    <select
                                        value={cashAccount}
                                        onChange={(e) => setCashAccount(e.target.value)}
                                    >
                                        <option value="">{t('opt.selectAccount')}</option>`,
  'cash bank label',
);

mustReplace(
  `                                <label>Description</label>
                                <input
                                    type="text"
                                    placeholder="Invoice description (optional)"`,
  `                                <label>{t('label.description')}</label>
                                <input
                                    type="text"
                                    placeholder={t('ph.invoiceDesc')}`,
  'desc field',
);

fs.writeFileSync(JSX_PATH, src);
console.log('Phase 4a done');
