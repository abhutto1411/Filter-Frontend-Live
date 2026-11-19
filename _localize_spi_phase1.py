# -*- coding: utf-8 -*-
"""Localize SupplierPurchaseInvoices.jsx for EN/AR via spiT."""
from pathlib import Path

path = Path(r"j:\work\Filter Both Front and Back\filter-web\src\pages\supplier\SupplierPurchaseInvoices.jsx")
text = path.read_text(encoding="utf-8")
assert "\r" not in text, "file must be LF"

# --- imports ---
if "supplierPurchaseInvoicesI18n" not in text:
    text = text.replace(
        "import { ShimmerTable, ShimmerTextBlock } from '../../components/supplier/Shimmer';",
        "import { ShimmerTable, ShimmerTextBlock } from '../../components/supplier/Shimmer';\n"
        "import { spiT } from '../../utils/supplierPurchaseInvoicesI18n';",
    )

# --- helpers: product fallback + stock hints ---
text = text.replace(
    "function mapMasterCatalogToPurchasePickerRow(raw) {",
    "function mapMasterCatalogToPurchasePickerRow(raw, t) {",
)
text = text.replace(
    "        name: raw.name || raw.productName || 'Product',",
    "        name: raw.name || raw.productName || (t ? t('fallback.product') : 'Product'),",
)
text = text.replace(
    """        stockHint:
            'Master catalog product — added to Stock Inventory on save if not already listed.',""",
    """        stockHint: t
            ? t('hint.masterCatalog')
            : 'Master catalog product — added to Stock Inventory on save if not already listed.',""",
)

text = text.replace(
    "function applyStockBalanceHintsToPickerRow(pickerRow, stockRaw) {",
    "function applyStockBalanceHintsToPickerRow(pickerRow, stockRaw, t) {",
)
old_hint = """        stockHint:
            qtyWh >= 0
                ? `Warehouse stock: ${qtyWh} ${warehouseUnit}${
                      conversionFactor > 1
                          ? ` (= ${qtyWh * conversionFactor} ${workshopUnit})`
                          : ''
                  }`
                : pickerRow.stockHint,"""
new_hint = """        stockHint:
            qtyWh >= 0
                ? t
                    ? conversionFactor > 1
                        ? t('hint.warehouseStockConv', {
                              qty: qtyWh,
                              unit: warehouseUnit,
                              wsQty: qtyWh * conversionFactor,
                              wsUnit: workshopUnit,
                          })
                        : t('hint.warehouseStock', { qty: qtyWh, unit: warehouseUnit })
                    : `Warehouse stock: ${qtyWh} ${warehouseUnit}${
                          conversionFactor > 1
                              ? ` (= ${qtyWh * conversionFactor} ${workshopUnit})`
                              : ''
                      }`
                : pickerRow.stockHint,"""
assert old_hint in text
text = text.replace(old_hint, new_hint)

text = text.replace(
    "function mapStockBalanceToPurchasePickerRow(raw) {",
    "function mapStockBalanceToPurchasePickerRow(raw, t) {",
)
text = text.replace(
    """    const base = mapMasterCatalogToPurchasePickerRow({
        id: mid || pid,
        masterProductId: mid || pid,
        name: raw.productName,
        sku: raw.sku ?? raw.barcode,
        warehouseUnit: masterCatalogWarehouseUnit(raw, 'pcs'),
        workshopUnit: raw.workshopUnit,
        conversionFactor: raw.conversionFactor,
        purchasePrice: 0,
    });
    return applyStockBalanceHintsToPickerRow(base, raw);
}""",
    """    const base = mapMasterCatalogToPurchasePickerRow(
        {
            id: mid || pid,
            masterProductId: mid || pid,
            name: raw.productName,
            sku: raw.sku ?? raw.barcode,
            warehouseUnit: masterCatalogWarehouseUnit(raw, 'pcs'),
            workshopUnit: raw.workshopUnit,
            conversionFactor: raw.conversionFactor,
            purchasePrice: 0,
        },
        t,
    );
    return applyStockBalanceHintsToPickerRow(base, raw, t);
}""",
)

old_uom = """function formatPiUomConversionPreview(line, inv) {
    if (!inv) return '';
    const cf = Number(inv.conversionFactor) || 1;
    if (!(cf > 1)) return '';
    const wu = inv.warehouseUnit || 'Box';
    const wsu = inv.workshopUnit || 'pcs';
    const qty = parseFloat(String(line.qty).replace(',', '.')) || 0;
    if (!(qty > 0)) return '';
    const price = parseFloat(String(line.price).replace(',', '.')) || 0;
    if (isPiWarehouseUomLine(line, inv)) {
        const wsQty = roundMoney2(qty * cf);
        const wsPrice = cf > 0 ? roundMoney2(price / cf) : price;
        return `${qty} ${wu} → +${wsQty} ${wsu} in stock · SAR ${price.toFixed(2)}/${wu} → SAR ${wsPrice.toFixed(2)}/${wsu} cost`;
    }
    const whQty = roundMoney2(qty / cf);
    return `${qty} ${wsu} → +${whQty} ${wu} warehouse stock`;
}"""
new_uom = """function formatPiUomConversionPreview(line, inv, t, money) {
    if (!inv) return '';
    const cf = Number(inv.conversionFactor) || 1;
    if (!(cf > 1)) return '';
    const wu = inv.warehouseUnit || 'Box';
    const wsu = inv.workshopUnit || 'pcs';
    const qty = parseFloat(String(line.qty).replace(',', '.')) || 0;
    if (!(qty > 0)) return '';
    const price = parseFloat(String(line.price).replace(',', '.')) || 0;
    if (isPiWarehouseUomLine(line, inv)) {
        const wsQty = roundMoney2(qty * cf);
        const wsPrice = cf > 0 ? roundMoney2(price / cf) : price;
        if (t && money) {
            return t('uom.previewWh', {
                qty,
                wu,
                wsQty,
                wsu,
                pricePer: money(price.toFixed(2)),
                wsPricePer: money(wsPrice.toFixed(2)),
            });
        }
        return `${qty} ${wu} → +${wsQty} ${wsu} in stock · SAR ${price.toFixed(2)}/${wu} → SAR ${wsPrice.toFixed(2)}/${wsu} cost`;
    }
    const whQty = roundMoney2(qty / cf);
    if (t) {
        return t('uom.previewWs', { qty, wsu, whQty, wu });
    }
    return `${qty} ${wsu} → +${whQty} ${wu} warehouse stock`;
}"""
assert old_uom in text
text = text.replace(old_uom, new_uom)

old_fmt = """function formatAccountsPayableDisplay(amount) {
    const n = Number(amount ?? 0);
    if (n < -0.005) {
        return `- SAR ${fmtApMoney(Math.abs(n))}`;
    }
    return `SAR ${fmtApMoney(n)}`;
}

function apStatusLabel(apStatus) {
    if (apStatus === 'unpaid') return 'Unpaid';
    if (apStatus === 'overpaid') return 'Overpaid';
    return 'Paid';
}"""
new_fmt = """function formatAccountsPayableDisplay(amount, money) {
    const n = Number(amount ?? 0);
    if (n < -0.005) {
        return `- ${money(fmtApMoney(Math.abs(n)))}`;
    }
    return money(fmtApMoney(n));
}

function apStatusLabel(apStatus, t) {
    if (apStatus === 'unpaid') return t('ap.unpaid');
    if (apStatus === 'overpaid') return t('ap.overpaid');
    return t('ap.paid');
}"""
assert old_fmt in text
text = text.replace(old_fmt, new_fmt)

# --- component signature + locale/t/money ---
text = text.replace(
    "export default function SupplierPurchaseInvoices() {",
    "export default function SupplierPurchaseInvoices({ locale: localeProp } = {}) {\n"
    "    const locale =\n"
    "        localeProp ||\n"
    "        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||\n"
    "        'en';\n"
    "    const t = useCallback((key, vars) => spiT(locale, key, vars), [locale]);\n"
    "    const money = useCallback((amount) => t('money.sar', { amount }), [t]);\n",
)

# helper call sites inside component that need t
text = text.replace(
    "                        const base = mapMasterCatalogToPurchasePickerRow(row);\n"
    "                        if (!base) return null;\n"
    "                        const mid = String(base.masterProductId || base.id);\n"
    "                        const stock =\n"
    "                            mapped.find((x) => String(x.masterProductId ?? '') === mid) ||\n"
    "                            mapped.find((x) => String(x.id) === mid);\n"
    "                        return stock ? applyStockBalanceHintsToPickerRow(base, stock) : base;",
    "                        const base = mapMasterCatalogToPurchasePickerRow(row, t);\n"
    "                        if (!base) return null;\n"
    "                        const mid = String(base.masterProductId || base.id);\n"
    "                        const stock =\n"
    "                            mapped.find((x) => String(x.masterProductId ?? '') === mid) ||\n"
    "                            mapped.find((x) => String(x.id) === mid);\n"
    "                        return stock ? applyStockBalanceHintsToPickerRow(base, stock, t) : base;",
)

# Other applyStockBalanceHintsToPickerRow call sites
text = text.replace(
    "return stock ? applyStockBalanceHintsToPickerRow(row, stock) : row;",
    "return stock ? applyStockBalanceHintsToPickerRow(row, stock, t) : row;",
)
# mapStockBalance if any
text = text.replace(
    "mapStockBalanceToPurchasePickerRow(",
    "mapStockBalanceToPurchasePickerRow(",
)  # noop marker

# Fix remaining applyStockBalanceHintsToPickerRow( with 2 args inside enrich
import re

def patch_apply_calls(s):
    # applyStockBalanceHintsToPickerRow(a, b) -> add t if not already 3 args
    def repl(m):
        args = m.group(1)
        if ', t)' in m.group(0) or args.count(',') >= 2:
            return m.group(0)
        return f"applyStockBalanceHintsToPickerRow({args}, t)"
    return re.sub(r"applyStockBalanceHintsToPickerRow\(([^)]+)\)", repl, s)

text = patch_apply_calls(text)

# Error / alert / confirm strings
replacements = [
    ("err?.message || 'Failed to load suppliers'", "err?.message || t('err.loadSuppliers')"),
    ("e?.message || 'Could not load account ledger.'", "e?.message || t('err.loadLedger')"),
    ("e?.message || 'Could not load purchased products.'", "e?.message || t('err.loadProducts')"),
    ("setSsErr('Name is required')", "setSsErr(t('err.nameRequired'))"),
    ("setSsErr('As-of date is required when opening balance is set.')", "setSsErr(t('err.asOfRequired'))"),
    ("setSsErr('Select a contra account from your chart of accounts.')", "setSsErr(t('err.contraRequired'))"),
    ("e?.message || 'Could not save super supplier'", "e?.message || t('err.saveSs')"),
    ("e?.message || 'Could not update status'", "e?.message || t('err.updateStatus')"),
    (
        """window.alert(
                'This super supplier cannot be deleted because purchase or ledger transactions exist.',
            );""",
        """window.alert(t('err.cannotDelete'));""",
    ),
    (
        """!window.confirm(
                `Delete super supplier "${ss.name}"? This cannot be undone.`,
            )""",
        """!window.confirm(t('err.confirmDelete', { name: ss.name }))""",
    ),
    ("e?.message || 'Could not delete super supplier'", "e?.message || t('err.deleteSs')"),
    ("setCreateError('Could not load purchase for editing.')", "setCreateError(t('err.loadEdit'))"),
    ("e?.message || 'Could not load purchase for editing.'", "e?.message || t('err.loadEdit')"),
    ("setCreateError('Select a super supplier from the list.')", "setCreateError(t('err.selectSs'))"),
    ("setCreateError('Add at least one line item.')", "setCreateError(t('err.needLine'))"),
    ("setCreateError('Invalid super supplier selection. Refresh the page.')", "setCreateError(t('err.invalidSs'))"),
    ("setCreateError('Selected super supplier is inactive.')", "setCreateError(t('err.inactiveSs'))"),
    (
        """setCreateError(
                    'Add at least one product line (select from master catalog) to save a draft.',
                );""",
        """setCreateError(t('err.draftNeedProduct'));""",
    ),
    (
        """setCreateError(
                    `Line ${bad.idx + 1}: select a product from the master catalog, qty > 0, and unit price cannot be negative.`,
                );""",
        """setCreateError(t('err.lineBad', { n: bad.idx + 1 }));""",
    ),
    (
        "setCreateError('Invoice total must be greater than zero (check quantities and unit prices).');",
        "setCreateError(t('err.totalZero'));",
    ),
    ("err?.message || 'Could not save purchase invoice'", "err?.message || t('err.savePi')"),
    ("supplierName || 'Super supplier'", "supplierName || t('fallback.superSupplier')"),
]

for a, b in replacements:
    if a not in text:
        print("MISSING:", repr(a[:80]))
    else:
        text = text.replace(a, b)

# summary labels
text = text.replace(
    """            invoiceDiscountSummaryLabel:
                invoiceDiscountMode === 'percent'
                    ? `Invoice discount (${invPctDisplayed}%):`
                    : 'Invoice discount (fixed SAR):',""",
    """            invoiceDiscountSummaryLabel:
                invoiceDiscountMode === 'percent'
                    ? t('summary.invDiscPct', { pct: invPctDisplayed })
                    : t('summary.invDiscFixed'),""",
)

# formatAccountsPayableDisplay / apStatusLabel call sites
text = text.replace(
    "formatAccountsPayableDisplay(aggregateAp)",
    "formatAccountsPayableDisplay(aggregateAp, money)",
)
text = text.replace(
    "formatAccountsPayableDisplay(ss.accountsPayable)",
    "formatAccountsPayableDisplay(ss.accountsPayable, money)",
)
text = text.replace(
    "formatAccountsPayableDisplay(ssLedgerData?.accountsPayable)",
    "formatAccountsPayableDisplay(ssLedgerData?.accountsPayable, money)",
)
text = text.replace(
    "formatAccountsPayableDisplay(ln.runningBalance)",
    "formatAccountsPayableDisplay(ln.runningBalance, money)",
)
text = text.replace("apStatusLabel(apStatus)", "apStatusLabel(apStatus, t)")
text = text.replace(
    "apStatusLabel(ssLedgerData?.apStatus ?? 'paid')",
    "apStatusLabel(ssLedgerData?.apStatus ?? 'paid', t)",
)

text = text.replace(
    "const conversionPreview = formatPiUomConversionPreview(\n                                        line,\n                                        capsRow,\n                                    );",
    "const conversionPreview = formatPiUomConversionPreview(\n                                        line,\n                                        capsRow,\n                                        t,\n                                        money,\n                                    );",
)

# JSX string replacements (order matters for longer first)
jsx_pairs = [
    ("<strong>Could not load suppliers:</strong>", "<strong>{t('err.loadSuppliersStrong')}</strong>"),
    (">Purchases</h2>", ">{t('page.title')}</h2>"),
    (
        ">Track supplier payables, super suppliers, and upstream purchase invoices.</p>",
        ">{t('page.sub')}</p>",
    ),
    ("<Building2 size={18} /> Add Super Supplier", "<Building2 size={18} /> {t('btn.addSuperSupplier')}"),
    ("<Plus size={18} /> New Purchase Invoice", "<Plus size={18} /> {t('btn.newPurchaseInvoice')}"),
    ('aria-label="Purchase sections"', 'aria-label={t(\'tabs.aria\')}'),
    (
        """                {[
                    { id: 'payables', label: 'Suppliers' },
                    { id: 'super_suppliers', label: 'Super suppliers' },
                    { id: 'ssp_invoices', label: 'Super supplier invoices' },
                ].map((t) => {
                    const active = apTab === t.id;
                    return (
                        <button
                            key={t.id}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            id={`ap-tab-${t.id}`}
                            aria-controls={`ap-panel-${t.id}`}
                            onClick={() => setApTab(/** @type {ApTabId} */ (t.id))}
                            className={`theme-segmented__btn${active ? ' theme-segmented__btn--active' : ''}`}
                        >
                            {t.label}
                        </button>
                    );
                })}""",
        """                {[
                    { id: 'payables', labelKey: 'tab.payables' },
                    { id: 'super_suppliers', labelKey: 'tab.super_suppliers' },
                    { id: 'ssp_invoices', labelKey: 'tab.ssp_invoices' },
                ].map((tab) => {
                    const active = apTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            id={`ap-tab-${tab.id}`}
                            aria-controls={`ap-panel-${tab.id}`}
                            onClick={() => setApTab(/** @type {ApTabId} */ (tab.id))}
                            className={`theme-segmented__btn${active ? ' theme-segmented__btn--active' : ''}`}
                        >
                            {t(tab.labelKey)}
                        </button>
                    );
                })}""",
    ),
    ("Total suppliers: <strong>", "{t('kpi.totalSuppliers')} <strong>"),
    ("Aggregate AP: <strong>", "{t('kpi.aggregateAp')} <strong>"),
    ('placeholder="Search suppliers…"', 'placeholder={t(\'search.suppliers\')}'),
]

for a, b in jsx_pairs:
    if a not in text:
        print("MISSING JSX:", repr(a[:100]))
    else:
        text = text.replace(a, b)

path.write_text(text, encoding="utf-8", newline="\n")
print("phase1 done, len", len(text))
