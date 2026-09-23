# -*- coding: utf-8 -*-
from pathlib import Path

path = Path(r"j:\work\Filter Both Front and Back\filter-web\src\pages\supplier\SupplierPurchaseInvoices.jsx")
text = path.read_text(encoding="utf-8")

pairs = [
    # Ledger table headers (unique block)
    ("""                                                <th style={{ textAlign: 'left', padding: 8 }}>Date</th>
                                                <th style={{ textAlign: 'left', padding: 8 }}>Entry #</th>
                                                <th style={{ textAlign: 'left', padding: 8 }}>Description</th>
                                                <th style={{ textAlign: 'left', padding: 8 }}>Reference</th>
                                                <th style={{ textAlign: 'right', padding: 8 }}>Debit</th>
                                                <th style={{ textAlign: 'right', padding: 8 }}>Credit</th>
                                                <th style={{ textAlign: 'right', padding: 8 }}>Balance</th>""",
     """                                                <th style={{ textAlign: 'left', padding: 8 }}>{t('th.date')}</th>
                                                <th style={{ textAlign: 'left', padding: 8 }}>{t('th.entryNo')}</th>
                                                <th style={{ textAlign: 'left', padding: 8 }}>{t('th.description')}</th>
                                                <th style={{ textAlign: 'left', padding: 8 }}>{t('th.reference')}</th>
                                                <th style={{ textAlign: 'right', padding: 8 }}>{t('th.debit')}</th>
                                                <th style={{ textAlign: 'right', padding: 8 }}>{t('th.credit')}</th>
                                                <th style={{ textAlign: 'right', padding: 8 }}>{t('th.balance')}</th>"""),

    ("No journal transactions for this supplier yet.", "{t('empty.noJournal')}"),
    ("""                                                            {Number(ln.debit) > 0
                                                                ? `SAR ${fmtApMoney(ln.debit)}`
                                                                : '—'}""",
     """                                                            {Number(ln.debit) > 0
                                                                ? money(fmtApMoney(ln.debit))
                                                                : t('emdash')}"""),
    ("""                                                            {Number(ln.credit) > 0
                                                                ? `SAR ${fmtApMoney(ln.credit)}`
                                                                : '—'}""",
     """                                                            {Number(ln.credit) > 0
                                                                ? money(fmtApMoney(ln.credit))
                                                                : t('emdash')}"""),
    ("Showing {ssLedgerData.lines.length} of {ssLedgerData.total} journal lines.",
     "{t('ledger.showing', { shown: ssLedgerData.lines.length, total: ssLedgerData.total })}"),

    # Products modal title
    ("""                                <Package size={20} /> Purchased products —{' '}
                                {ssProductsData?.supplier?.name || 'Super supplier'}""",
     """                                <Package size={20} />{' '}
                                {t('modal.products', {
                                    name: ssProductsData?.supplier?.name || t('fallback.superSupplier'),
                                })}"""),
    ("""                                    {ssProductsData?.summary
                                        ? `${ssProductsData.summary.lineCount} line(s) · Qty ${Number(ssProductsData.summary.totalQty || 0).toLocaleString(undefined, { maximumFractionDigits: 3 })} · Total SAR ${fmtApMoney(ssProductsData.summary.totalAmount || 0)}`
                                        : 'Purchased products'}""",
     """                                    {ssProductsData?.summary
                                        ? t('products.summary', {
                                              lines: ssProductsData.summary.lineCount,
                                              qty: Number(ssProductsData.summary.totalQty || 0).toLocaleString(undefined, { maximumFractionDigits: 3 }),
                                              total: money(fmtApMoney(ssProductsData.summary.totalAmount || 0)),
                                          })
                                        : t('products.purchased')}"""),

    ("<label>From date</label>", "<label>{t('label.fromDate')}</label>"),
    ("<label>To date</label>", "<label>{t('label.toDate')}</label>"),
    ("<label>Product filter</label>", "<label>{t('label.productFilter')}</label>"),
    ('placeholder="Search by product name or SKU"', 'placeholder={t(\'ph.productSku\')}'),
    ("""                                >
                                    Apply filters
                                </button>
                                <button
                                    type="button"
                                    className="btn-portal-outline"
                                    disabled={ssProductsLoading}
                                    onClick={clearSuperSupplierProductsFilters}
                                >
                                    Clear
                                </button>""",
     """                                >
                                    {t('btn.applyFilters')}
                                </button>
                                <button
                                    type="button"
                                    className="btn-portal-outline"
                                    disabled={ssProductsLoading}
                                    onClick={clearSuperSupplierProductsFilters}
                                >
                                    {t('btn.clear')}
                                </button>"""),

    ("""                                                <th style={{ textAlign: 'left', padding: 8 }}>Date</th>
                                                <th style={{ textAlign: 'left', padding: 8 }}>Invoice</th>
                                            <th style={{ textAlign: 'left', padding: 8 }}>Reference</th>
                                            <th style={{ textAlign: 'left', padding: 8 }}>Product</th>
                                                <th style={{ textAlign: 'left', padding: 8 }}>SKU</th>
                                                <th style={{ textAlign: 'right', padding: 8 }}>Qty</th>
                                                <th style={{ textAlign: 'right', padding: 8 }}>Unit price</th>
                                                <th style={{ textAlign: 'right', padding: 8 }}>Line total</th>""",
     """                                                <th style={{ textAlign: 'left', padding: 8 }}>{t('th.date')}</th>
                                                <th style={{ textAlign: 'left', padding: 8 }}>{t('th.invoice')}</th>
                                            <th style={{ textAlign: 'left', padding: 8 }}>{t('th.reference')}</th>
                                            <th style={{ textAlign: 'left', padding: 8 }}>{t('th.product')}</th>
                                                <th style={{ textAlign: 'left', padding: 8 }}>{t('th.sku')}</th>
                                                <th style={{ textAlign: 'right', padding: 8 }}>{t('th.qty')}</th>
                                                <th style={{ textAlign: 'right', padding: 8 }}>{t('th.unitPrice')}</th>
                                                <th style={{ textAlign: 'right', padding: 8 }}>{t('th.lineTotal')}</th>"""),

    ("No purchased products found for the selected filters.", "{t('empty.noProducts')}"),
    ("SAR {fmtApMoney(ln.unitPrice)}", "{money(fmtApMoney(ln.unitPrice))}"),
    ("SAR {fmtApMoney(ln.lineTotal)}", "{money(fmtApMoney(ln.lineTotal))}"),
    ("Showing {ssProductsData.lines.length} of {ssProductsData.total} product lines.",
     "{t('products.showing', { shown: ssProductsData.lines.length, total: ssProductsData.total })}"),

    # Audit
    ("""                                <History size={20} /> Super supplier audit {auditSsFilter ? '(filtered)' : ''}""",
     """                                <History size={20} />{' '}
                                {auditSsFilter ? t('modal.auditFiltered') : t('modal.audit')}"""),
    ("""                                            <th style={{ textAlign: 'left', padding: 8 }}>When</th>
                                            <th style={{ textAlign: 'left', padding: 8 }}>Action</th>
                                            <th style={{ textAlign: 'left', padding: 8 }}>Summary</th>
                                            <th style={{ textAlign: 'left', padding: 8 }}>By</th>""",
     """                                            <th style={{ textAlign: 'left', padding: 8 }}>{t('th.when')}</th>
                                            <th style={{ textAlign: 'left', padding: 8 }}>{t('th.action')}</th>
                                            <th style={{ textAlign: 'left', padding: 8 }}>{t('th.summary')}</th>
                                            <th style={{ textAlign: 'left', padding: 8 }}>{t('th.by')}</th>"""),
    ("No audit entries yet.", "{t('empty.noAudit')}"),
]

missing = 0
for a, b in pairs:
    c = text.count(a)
    if c == 0:
        print("MISSING:", repr(a[:140]))
        missing += 1
    else:
        text = text.replace(a, b)

path.write_text(text, encoding="utf-8", newline="\n")
print("phase2b done, missing", missing)
