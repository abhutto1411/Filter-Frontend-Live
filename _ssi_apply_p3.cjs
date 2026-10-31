/**
 * Phase 2b + 3: remaining errors + full JSX UI string replacements
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

function tryReplace(from, to, label) {
  if (!src.includes(from)) {
    console.warn('SKIP', label || from.slice(0, 80));
    return false;
  }
  const n = src.split(from).length - 1;
  src = src.split(from).join(to);
  console.log('OK', (label || from.slice(0, 55)).replace(/\n/g, '⏎'), 'x' + n);
  return true;
}

mustReplace(
  `                setSaveError(
                    \`Line \${invalidLine.index + 1}: select an account (or enter item name), qty must be > 0, and price cannot be negative.\`,
                );`,
  `                setSaveError(
                    t('err.lineInvalid', { n: invalidLine.index + 1 }),
                );`,
  'line invalid',
);

mustReplace(
  `        const branchesErrDefault =
            'Could not load workshop branches. Check that the app points at your backend (see api.js BASE_URL) and you are logged in as a supplier user.';`,
  `        const branchesErrDefault = t('err.customerBranches');`,
  'branchesErrDefault',
);

// ——— LIST HEADER / TOOLBAR / TABLE ———
mustReplace(
  `                    <div className="mgr-si-breadcrumb">Sales Invoices (AR)</div>
                    <div className="mgr-si-toolbar-actions">
                        <button
                            type="button"
                            className="mgr-si-btn-new"
                            onClick={openNewInvoiceModal}
                        >
                            <Plus size={16} /> New Invoice
                        </button>
                    </div>
                </div>
                <h2 className="mgr-si-title">Sales Invoices (AR)</h2>
                <p className="mgr-si-subtitle">
                    Warehouse → workshop invoices. Creates <strong>Accounts Receivable</strong> for you and a{' '}
                    <strong>Purchase Invoice</strong> on the workshop side. Auto-posted to GL on save
                    (AR/Sales/VAT/COGS).
                </p>`,
  `                    <div className="mgr-si-breadcrumb">{t('page.breadcrumb')}</div>
                    <div className="mgr-si-toolbar-actions">
                        <button
                            type="button"
                            className="mgr-si-btn-new"
                            onClick={openNewInvoiceModal}
                        >
                            <Plus size={16} /> {t('btn.newInvoice')}
                        </button>
                    </div>
                </div>
                <h2 className="mgr-si-title">{t('page.title')}</h2>
                <p className="mgr-si-subtitle">
                    {t('page.subtitle.before')}{' '}
                    <strong>{t('page.subtitle.ar')}</strong> {t('page.subtitle.mid')}{' '}
                    <strong>{t('page.subtitle.pi')}</strong> {t('page.subtitle.after')}
                </p>`,
  'page header',
);

mustReplace(
  `                    <span className="mgr-si-filter-label">Where</span>
                    <select
                        className="mgr-si-filter-select"
                        value={invoiceListFilter}
                        onChange={(e) => setInvoiceListFilter(e.target.value)}
                        aria-label="Filter invoices"
                    >
                        <option value="all">All invoices</option>
                        <option value="unpaid">Balance due is greater than 0</option>
                        <option value="overdue">Balance due is overdue</option>
                        <option value="paid">Balance due is 0 (paid in full)</option>
                    </select>`,
  `                    <span className="mgr-si-filter-label">{t('filter.where')}</span>
                    <select
                        className="mgr-si-filter-select"
                        value={invoiceListFilter}
                        onChange={(e) => setInvoiceListFilter(e.target.value)}
                        aria-label={t('filter.aria')}
                    >
                        <option value="all">{t('filter.all')}</option>
                        <option value="unpaid">{t('filter.unpaid')}</option>
                        <option value="overdue">{t('filter.overdue')}</option>
                        <option value="paid">{t('filter.paid')}</option>
                    </select>`,
  'filter bar',
);

mustReplace(
  `                            placeholder="Search reference, customer, description…"
                            value={invoiceListSearch}
                            onChange={(e) => setInvoiceListSearch(e.target.value)}
                            aria-label="Search sales invoices"`,
  `                            placeholder={t('search.placeholder')}
                            value={invoiceListSearch}
                            onChange={(e) => setInvoiceListSearch(e.target.value)}
                            aria-label={t('search.aria')}`,
  'search input',
);

mustReplace(
  `                        onClick={() => void loadInvoiceList()}
                    >
                        Search
                    </button>`,
  `                        onClick={() => void loadInvoiceList()}
                    >
                        {t('btn.search')}
                    </button>`,
  'search btn',
);

mustReplace(
  `                                        <th className="table-th">Issue date</th>
                                        <th className="table-th">Due date</th>
                                        <th className="table-th">Reference</th>
                                        <th className="table-th">Customer</th>
                                        <th className="table-th">Description</th>
                                        <th className="table-th">Invoice Amount</th>
                                        <th className="table-th">Balance due</th>
                                        <th className="table-th">Status</th>
                                        <th className="table-th mgr-si-th-actions">Actions</th>`,
  `                                        <th className="table-th">{t('th.issueDate')}</th>
                                        <th className="table-th">{t('th.dueDate')}</th>
                                        <th className="table-th">{t('th.reference')}</th>
                                        <th className="table-th">{t('th.customer')}</th>
                                        <th className="table-th">{t('th.description')}</th>
                                        <th className="table-th">{t('th.invoiceAmount')}</th>
                                        <th className="table-th">{t('th.balanceDue')}</th>
                                        <th className="table-th">{t('th.status')}</th>
                                        <th className="table-th mgr-si-th-actions">{t('th.actions')}</th>`,
  'table headers',
);

mustReplace(
  `                                                    {list.length === 0
                                                        ? 'No sales invoices yet'
                                                        : 'No invoices match your search or filter'}`,
  `                                                    {list.length === 0
                                                        ? t('empty.noneYet')
                                                        : t('empty.noMatch')}`,
  'empty titles',
);

mustReplace(
  `                                                            Issue a warehouse → workshop invoice; it will appear here.
                                                        </div>
                                                        <button
                                                            type="button"
                                                            className="mgr-si-btn-new"
                                                            onClick={openNewInvoiceModal}
                                                        >
                                                            <Plus size={15} /> Create first invoice
                                                        </button>`,
  `                                                            {t('empty.hint')}
                                                        </div>
                                                        <button
                                                            type="button"
                                                            className="mgr-si-btn-new"
                                                            onClick={openNewInvoiceModal}
                                                        >
                                                            <Plus size={15} /> {t('btn.createFirst')}
                                                        </button>`,
  'empty hint+btn',
);

mustReplace(
  `                                                            title="View invoice"`,
  `                                                            title={t('title.viewInvoice')}`,
  'view invoice title',
);

mustReplace(
  `                                                    <td className="table-cell mgr-si-cell-amount">
                                                        SAR {salesInvoiceSarFmt(inv.amount)}
                                                    </td>
                                                    <td className="table-cell mgr-si-cell-balance">
                                                        <span>SAR {salesInvoiceSarFmt(inv.balance)}</span>
                                                        {Number(inv.returnsTotal || 0) > 0 ? (
                                                            <div className="mgr-si-returns-note">
                                                                − SAR{' '}
                                                                {salesInvoiceSarFmt(inv.returnsTotal)} returns
                                                            </div>
                                                        ) : null}`,
  `                                                    <td className="table-cell mgr-si-cell-amount">
                                                        {t('money.sar', { amount: salesInvoiceSarFmt(inv.amount) })}
                                                    </td>
                                                    <td className="table-cell mgr-si-cell-balance">
                                                        <span>{t('money.sar', { amount: salesInvoiceSarFmt(inv.balance) })}</span>
                                                        {Number(inv.returnsTotal || 0) > 0 ? (
                                                            <div className="mgr-si-returns-note">
                                                                {t('returns.note', {
                                                                    amount: t('money.sar', {
                                                                        amount: salesInvoiceSarFmt(inv.returnsTotal),
                                                                    }),
                                                                })}
                                                            </div>
                                                        ) : null}`,
  'money cells',
);

mustReplace(
  `                                                                Record payment
                                                            </button>`,
  `                                                                {t('btn.recordPayment')}
                                                            </button>`,
  'record payment btn',
);

mustReplace(
  `                                                            ariaLabel={\`Actions for invoice \${inv.invoiceNo || inv.id}\`}
                                                            items={[
                                                                {
                                                                    label: 'View',
                                                                    onClick: () => handleViewInvoice(inv),
                                                                },
                                                                {
                                                                    label: 'Download PDF',
                                                                    onClick: () => handleDownloadInvoice(inv),
                                                                    disabled: salesInvoicePdfBusy,
                                                                },
                                                                {
                                                                    label: 'Record return / credit',
                                                                    onClick: () => openReturnModal(inv),
                                                                },
                                                                {
                                                                    label: isDraft ? 'Edit draft' : 'Edit',
                                                                    onClick: () => openEditInvoice(inv),
                                                                    disabled: !canEdit,
                                                                },
                                                            ]}`,
  `                                                            ariaLabel={t('actions.aria', { no: inv.invoiceNo || inv.id })}
                                                            items={[
                                                                {
                                                                    label: t('action.view'),
                                                                    onClick: () => handleViewInvoice(inv),
                                                                },
                                                                {
                                                                    label: t('action.downloadPdf'),
                                                                    onClick: () => handleDownloadInvoice(inv),
                                                                    disabled: salesInvoicePdfBusy,
                                                                },
                                                                {
                                                                    label: t('action.recordReturn'),
                                                                    onClick: () => openReturnModal(inv),
                                                                },
                                                                {
                                                                    label: isDraft ? t('action.editDraft') : t('action.edit'),
                                                                    onClick: () => openEditInvoice(inv),
                                                                    disabled: !canEdit,
                                                                },
                                                            ]}`,
  'row actions',
);

mustReplace(
  `                                        Previous
                                    </button>
                                    <span className="mgr-si-pagination-meta">
                                        Page {invoiceListPage} of {invoiceListTotalPages}
                                        {invoiceListTotal > 0
                                            ? \` · \${invoiceRangeStart}–\${invoiceRangeEnd} of \${invoiceListTotal}\`
                                            : ''}
                                    </span>`,
  `                                        {t('btn.previous')}
                                    </button>
                                    <span className="mgr-si-pagination-meta">
                                        {t('page.meta', {
                                            page: invoiceListPage,
                                            pages: invoiceListTotalPages,
                                        })}
                                        {invoiceListTotal > 0
                                            ? t('page.range', {
                                                  start: invoiceRangeStart,
                                                  end: invoiceRangeEnd,
                                                  total: invoiceListTotal,
                                              })
                                            : ''}
                                    </span>`,
  'pagination prev',
);

mustReplace(
  `                                        onClick={() =>
                                            loadInvoiceList({ page: invoiceListPage + 1 })
                                        }
                                    >
                                        Next
                                    </button>`,
  `                                        onClick={() =>
                                            loadInvoiceList({ page: invoiceListPage + 1 })
                                        }
                                    >
                                        {t('btn.next')}
                                    </button>`,
  'pagination next',
);

fs.writeFileSync(JSX_PATH, src);
console.log('Phase 2b list UI done, len', src.length);
