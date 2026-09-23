# -*- coding: utf-8 -*-
"""Phase 2: remaining UI strings in SupplierPurchaseInvoices.jsx"""
from pathlib import Path

path = Path(r"j:\work\Filter Both Front and Back\filter-web\src\pages\supplier\SupplierPurchaseInvoices.jsx")
text = path.read_text(encoding="utf-8")

pairs = [
    # payables table headers
    ('<th className="table-th">Name</th>\n                            <th className="table-th">Accounts payable</th>\n                            <th className="table-th">Status</th>\n                            <th className="table-th">Actions</th>',
     '<th className="table-th">{t(\'th.name\')}</th>\n                            <th className="table-th">{t(\'th.ap\')}</th>\n                            <th className="table-th">{t(\'th.status\')}</th>\n                            <th className="table-th">{t(\'th.actions\')}</th>'),

    ("? 'No data loaded.'\n                                        : superSuppliers.length === 0\n                                          ? 'No super suppliers yet. Use \"Add Super Supplier\" above.'\n                                          : 'No suppliers match your search.'",
     "? t('empty.noData')\n                                        : superSuppliers.length === 0\n                                          ? t('empty.noSuperSuppliers')\n                                          : t('empty.noSearchMatch')"),

    ('title="Open accounts payable ledger"', 'title={t(\'title.openLedger\')}'),
    ("VAT: {ss.vatNumber}", "{t('vat.prefix', { id: ss.vatNumber })}"),
    ("<BookOpen size={14} /> Ledger", "<BookOpen size={14} /> {t('btn.ledger')}"),

    ("<Building2 size={18} /> Super suppliers", "<Building2 size={18} /> {t('ss.sectionTitle')}"),
    ("Vendors you buy inventory from. Record purchases here; all actions are stored in the audit log.",
     "{t('ss.sectionSub')}"),
    ("<History size={14} /> View full audit log", "<History size={14} /> {t('btn.viewAudit')}"),

    ('<th className="table-th">Name</th>\n                                <th className="table-th">VAT / Contact</th>\n                                <th className="table-th">Purchases</th>\n                                <th className="table-th">Status</th>\n                                <th className="table-th">Actions</th>',
     '<th className="table-th">{t(\'th.name\')}</th>\n                                <th className="table-th">{t(\'th.vatContact\')}</th>\n                                <th className="table-th">{t(\'th.purchases\')}</th>\n                                <th className="table-th">{t(\'th.status\')}</th>\n                                <th className="table-th">{t(\'th.actions\')}</th>'),

    ("No super suppliers yet. Use &quot;Add Super Supplier&quot; above.",
     "{t('empty.noSuperSuppliersHtml')}"),
    ('title="View purchased products"', 'title={t(\'title.viewProducts\')}'),
    ("{ss.isActive ? 'Active' : 'Inactive'}",
     "{ss.isActive ? t('status.active') : t('status.inactive')}"),
    ("""title={
                                                        ss.isActive
                                                            ? 'Set inactive'
                                                            : 'Set active'
                                                    }""",
     """title={
                                                        ss.isActive
                                                            ? t('title.setInactive')
                                                            : t('title.setActive')
                                                    }"""),
    ("""aria-label={
                                                            ss.isActive
                                                                ? 'Set inactive'
                                                                : 'Set active'
                                                        }""",
     """aria-label={
                                                            ss.isActive
                                                                ? t('title.setInactive')
                                                                : t('title.setActive')
                                                        }"""),
    ("ariaLabel={`Actions for ${ss.name || 'super supplier'}`}",
     "ariaLabel={t('aria.actionsFor', { name: ss.name || t('fallback.superSupplier') })}"),
    ("""items={[
                                                        {
                                                            label: 'Edit',
                                                            onClick: () => openEditSuperSupplier(ss),
                                                        },
                                                        {
                                                            label:
                                                                ssDeletingId === String(ss.id)
                                                                    ? 'Deleting…'
                                                                    : 'Delete',""",
     """items={[
                                                        {
                                                            label: t('btn.edit'),
                                                            onClick: () => openEditSuperSupplier(ss),
                                                        },
                                                        {
                                                            label:
                                                                ssDeletingId === String(ss.id)
                                                                    ? t('btn.deleting')
                                                                    : t('btn.delete'),"""),

    # Add/Edit SS modal
    ("{editingSuperSupplierId ? 'Edit Super Supplier' : 'Add Super Supplier'}",
     "{editingSuperSupplierId ? t('modal.editSs') : t('modal.addSs')}"),
    ("""                                >
                                    Cancel
                                </button>
                                <button type="button" className="btn-pi-create" disabled={ssSaving} onClick={handleSaveSuperSupplier}>
                                    {ssSaving ? 'Saving…' : editingSuperSupplierId ? 'Save changes' : 'Save'}
                                </button>""",
     """                                >
                                    {t('btn.cancel')}
                                </button>
                                <button type="button" className="btn-pi-create" disabled={ssSaving} onClick={handleSaveSuperSupplier}>
                                    {ssSaving ? t('btn.saving') : editingSuperSupplierId ? t('btn.saveChanges') : t('btn.save')}
                                </button>"""),
    ("<label>Name *</label>", "<label>{t('label.nameReq')}</label>"),
    ('placeholder="Company name"', 'placeholder={t(\'ph.companyName\')}'),
    ("<label>VAT number</label>", "<label>{t('label.vatNumber')}</label>"),
    ("<label>Mobile</label>", "<label>{t('label.mobile')}</label>"),
    ("<label>Email</label>", "<label>{t('label.email')}</label>"),
    ("<label>Address</label>", "<label>{t('label.address')}</label>"),
    # Notes label appears multiple times - careful
    ("Opening balance (accounts payable)", "{t('opening.title')}"),
    ("""                                Enter what you owed this vendor before go-live. A balanced journal
                                posts automatically: debit your contra account (e.g. stock inventory)
                                and credit AP for this vendor. Use a negative amount only for a
                                vendor credit balance (prepayment).""",
     "{t('opening.body')}"),
    ("""                                    Opening balance is locked because purchase invoices were already
                                    posted for this vendor.""",
     "{t('opening.locked')}"),
    ("<label>Opening balance (SAR)</label>", "<label>{t('label.openingBalance')}</label>"),
    ("<label>As of date</label>", "<label>{t('label.asOfDate')}</label>"),
    ("<label>Contra account (chart of accounts)</label>", "<label>{t('label.contraAccount')}</label>"),
    ("""                                        {ssCoaLoading
                                            ? 'Loading accounts…'
                                            : '— Select asset or expense account —'}""",
     """                                        {ssCoaLoading
                                            ? t('opt.loadingAccounts')
                                            : t('opt.selectAccount')}"""),
    ("{a.seedKey === 'INVENTORY' ? ' (recommended)' : ''}",
     "{a.seedKey === 'INVENTORY' ? t('opening.recommended') : ''}"),
    ("""                                    Typically stock inventory for goods bought on credit before
                                    system start.""",
     "{t('opening.hint')}"),

    # Ledger modal
    ("""                                <BookOpen size={20} /> Account ledger —{' '}
                                {ssLedgerData?.supplier?.name || 'Super supplier'}""",
     """                                <BookOpen size={20} />{' '}
                                {t('modal.ledger', {
                                    name: ssLedgerData?.supplier?.name || t('fallback.superSupplier'),
                                })}"""),
    ("Current accounts payable:{' '}", "{t('ledger.currentAp')}{' '}"),
    # Close buttons - many; handle contextually later
    ("Account:{' '}", "{t('ledger.account')}{' '}"),
    ("Current balance:{' '}", "{t('ledger.currentBalance')}{' '}"),
]

missing = 0
for a, b in pairs:
    if a not in text:
        print("MISSING:", repr(a[:120]))
        missing += 1
    else:
        text = text.replace(a, b, 1)  # one at a time for unique-ish

path.write_text(text, encoding="utf-8", newline="\n")
print("phase2a done, missing", missing)
