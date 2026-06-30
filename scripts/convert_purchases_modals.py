#!/usr/bin/env python3
"""Convert WorkshopPurchases.jsx modals to WorkshopSubScreen early returns."""
from pathlib import Path

PATH = Path(__file__).resolve().parents[1] / "src/pages/workshop/WorkshopPurchases.jsx"
text = PATH.read_text(encoding="utf-8")
lines = text.splitlines(keepends=True)

# Locate AnimatePresence block
ap_start = None
ap_end = None
for i, line in enumerate(lines):
    if line.strip() == "<AnimatePresence>":
        ap_start = i
    if ap_start is not None and line.strip() == "</AnimatePresence>":
        ap_end = i
        break

if ap_start is None or ap_end is None:
    raise SystemExit("AnimatePresence block not found")

# Find create modal: {modalOpen && (
create_open = None
for i in range(ap_start, ap_end + 1):
    if "{modalOpen && (" in lines[i]:
        create_open = i
        break
if create_open is None:
    raise SystemExit("modalOpen block not found")

# Find children start: line with only `                    >` after Modal props
create_children_start = None
for i in range(create_open, ap_end + 1):
    if lines[i].rstrip("\n") == "                    >":
        create_children_start = i + 1
        break
if create_children_start is None:
    raise SystemExit("create modal children start not found")

# Find create modal end
create_close = None
for i in range(create_children_start, ap_end + 1):
    if lines[i].strip() == "</Modal>":
        create_close = i
        break
if create_close is None:
    raise SystemExit("create </Modal> not found")

create_body = lines[create_children_start:create_close]

# Find view modal
view_open = None
for i in range(create_close, ap_end + 1):
    if "{viewModalOpen && viewInvoiceRow && (" in lines[i]:
        view_open = i
        break
if view_open is None:
    raise SystemExit("viewModalOpen block not found")

view_children_start = None
for i in range(view_open, ap_end + 1):
    if lines[i].rstrip("\n") == "                    >":
        view_children_start = i + 1
        break
if view_children_start is None:
    raise SystemExit("view modal children start not found")

view_close = None
for i in range(view_children_start, ap_end + 1):
    if lines[i].strip() == "</Modal>":
        view_close = i
        break
if view_close is None:
    raise SystemExit("view </Modal> not found")

view_body = lines[view_children_start:view_close]

# Main return line
main_return = None
for i, line in enumerate(lines):
    if line == "    return (\n" and i < ap_start:
        # last return before AnimatePresence
        main_return = i
if main_return is None:
    raise SystemExit("main return not found")

close_fn = """    const closePurchaseInvoiceForm = useCallback(() => {
        setModalOpen(false);
        setSubmitInvoiceError('');
        setFreightSar('0');
        setAmountsTaxInclusive(false);
        setInvoiceBranchId('');
        setProductSearchByLineId({});
        setActiveProductSearchLineId(null);
        setProductDropdownPosition(null);
        setEditingDraftId(null);
        clearDraftEditSession();
    }, [clearDraftEditSession]);

"""

# Insert closePurchaseInvoiceForm after closeViewInvoiceModal block
insert_at = None
for i, line in enumerate(lines):
    if "const closeViewInvoiceModal = useCallback" in line:
        # find closing `}, []);` of this callback
        for j in range(i, min(i + 20, len(lines))):
            if lines[j].strip() == "}, []);":
                insert_at = j + 1
                break
        break

if insert_at is None:
    raise SystemExit("insert point for closePurchaseInvoiceForm not found")

if "closePurchaseInvoiceForm" not in text:
    lines.insert(insert_at, close_fn)

# Re-find indices after insert
offset = 1 if "closePurchaseInvoiceForm" not in text else 0
# Actually we inserted only if not present - recalculate from fresh read
text = "".join(lines)
if "closePurchaseInvoiceForm" not in text:
    raise SystemExit("failed to insert closePurchaseInvoiceForm")
lines = text.splitlines(keepends=True)

# Re-find all indices
ap_start = ap_end = create_open = create_children_start = create_close = view_open = view_children_start = view_close = main_return = None
for i, line in enumerate(lines):
    if line.strip() == "<AnimatePresence>":
        ap_start = i
    if ap_start is not None and line.strip() == "</AnimatePresence>":
        ap_end = i
for i in range(ap_start, ap_end + 1):
    if "{modalOpen && (" in lines[i]:
        create_open = i
for i in range(create_open, ap_end + 1):
    if lines[i].rstrip("\n") == "                    >" and create_children_start is None and i > create_open:
        create_children_start = i + 1
        break
for i in range(create_children_start, ap_end + 1):
    if lines[i].strip() == "</Modal>":
        create_close = i
        break
create_body = lines[create_children_start:create_close]
for i in range(create_close, ap_end + 1):
    if "{viewModalOpen && viewInvoiceRow && (" in lines[i]:
        view_open = i
for i in range(view_open, ap_end + 1):
    if lines[i].rstrip("\n") == "                    >":
        view_children_start = i + 1
        break
for i in range(view_children_start, ap_end + 1):
    if lines[i].strip() == "</Modal>":
        view_close = i
        break
view_body = lines[view_children_start:view_close]
for i, line in enumerate(lines):
    if line == "    return (\n" and i < ap_start:
        main_return = i

create_screen = [
    "    if (modalOpen) {\n",
    "        return (\n",
    "            <WorkshopSubScreen\n",
    "                title={editingDraftId || editingLocalPiId ? 'Edit Purchase Invoice Draft' : 'New Purchase Invoice'}\n",
    "                subtitle=\"Record supplier purchases, line items, and stock for a branch.\"\n",
    "                backLabel=\"Back to Purchase Invoices\"\n",
    "                onBack={closePurchaseInvoiceForm}\n",
    "                backDisabled={submittingInvoice}\n",
    "                size=\"full\"\n",
    "                maxWidth=\"1350px\"\n",
    "                className=\"ws-pi-sub-screen\"\n",
    "                footer={(\n",
    "                    <div className=\"pi-modal-footer\">\n",
    "                        <div className=\"pi-footer-left\">\n",
    "                            <button\n",
    "                                type=\"button\"\n",
    "                                className=\"btn-pi-cancel\"\n",
    "                                onClick={closePurchaseInvoiceForm}\n",
    "                                disabled={submittingInvoice}\n",
    "                            >\n",
    "                                Cancel\n",
    "                            </button>\n",
    "                        </div>\n",
    "                        <div className=\"pi-footer-right\" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>\n",
    "                            {submitInvoiceError && (\n",
    "                                <p style={{ margin: 0, fontSize: '0.8125rem', color: '#B91C1C', maxWidth: 420, textAlign: 'right' }}>\n",
    "                                    {submitInvoiceError}\n",
    "                                </p>\n",
    "                            )}\n",
    "                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>\n",
    "                                <button\n",
    "                                    type=\"button\"\n",
    "                                    className=\"btn-pi-draft\"\n",
    "                                    onClick={() => handleCreateInvoice('draft')}\n",
    "                                    disabled={!canSavePurchaseInvoiceDraft || submittingInvoice}\n",
    "                                >\n",
    "                                    {submittingInvoice\n",
    "                                        ? 'Saving…'\n",
    "                                        : editingDraftId || editingLocalPiId\n",
    "                                          ? 'Update Draft'\n",
    "                                          : 'Save as Draft'}\n",
    "                                </button>\n",
    "                                <button\n",
    "                                    type=\"button\"\n",
    "                                    className=\"btn-pi-create\"\n",
    "                                    onClick={() => handleCreateInvoice('pending')}\n",
    "                                    disabled={!canSubmitPurchaseInvoice || submittingInvoice}\n",
    "                                    title={\n",
    "                                        !canSubmitPurchaseInvoice\n",
    "                                            ? 'Need invoice branch, linked supplier with ID, at least one line with a branch product, and loaded suppliers.'\n",
    "                                            : undefined\n",
    "                                    }\n",
    "                                >\n",
    "                                    {submittingInvoice\n",
    "                                        ? 'Creating…'\n",
    "                                        : editingDraftId || editingLocalPiId\n",
    "                                          ? isModalLocalSupplier\n",
    "                                              ? 'Complete invoice'\n",
    "                                              : 'Send to Supplier'\n",
    "                                          : isModalLocalSupplier\n",
    "                                            ? 'Create purchase invoice'\n",
    "                                            : 'Create Purchase Invoice'}\n",
    "                                </button>\n",
    "                            </div>\n",
    "                        </div>\n",
    "                    </div>\n",
    "                )}\n",
    "            >\n",
    "                <div className=\"modal-content-purchase\">\n",
] + [("                    " + ln[20:] if ln.startswith("                        ") else ln) for ln in create_body] + [
    "                </div>\n",
    "            </WorkshopSubScreen>\n",
    "        );\n",
    "    }\n",
    "\n",
    "    if (viewModalOpen && viewInvoiceRow) {\n",
    "        return (\n",
    "            <WorkshopSubScreen\n",
    "                title={`Purchase Invoice ${viewInvoiceRow.invoice_number || viewInvoiceRow.id}`}\n",
    "                subtitle={viewInvoiceRow.vendor_name || viewInvoiceRow.supplier || 'Supplier purchase invoice'}\n",
    "                backLabel=\"Back to Purchase Invoices\"\n",
    "                onBack={closeViewInvoiceModal}\n",
    "                size=\"xl\"\n",
    "                maxWidth=\"1100px\"\n",
    "                className=\"ws-pi-sub-screen\"\n",
    "                footer={(\n",
    "                    <div className=\"pi-modal-footer\">\n",
    "                        <div className=\"pi-footer-left\">\n",
    "                            <button type=\"button\" className=\"btn-pi-cancel\" onClick={closeViewInvoiceModal}>\n",
    "                                Close\n",
    "                            </button>\n",
    "                        </div>\n",
    "                    </div>\n",
    "                )}\n",
    "            >\n",
    "                <div className=\"modal-content-purchase\">\n",
] + [("                    " + ln[20:] if ln.startswith("                        ") else ln) for ln in view_body] + [
    "                </div>\n",
    "            </WorkshopSubScreen>\n",
    "        );\n",
    "    }\n",
    "\n",
]

# Fix indentation of body lines - they were 24 spaces inside Modal, need 16 inside wrapper
def reindent_body(body_lines, extra_drop=4):
    out = []
    for ln in body_lines:
        if ln.startswith(" " * 24):
            out.append(" " * (len(ln) - len(ln.lstrip()) - extra_drop) + ln.lstrip())
        else:
            out.append(ln)
    return out

create_body_fixed = reindent_body(create_body)
view_body_fixed = reindent_body(view_body)

create_screen = (
    create_screen[:29]
    + create_body_fixed
    + create_screen[-4:]
)
# rebuild view part separately
view_screen_start = [
    "    if (viewModalOpen && viewInvoiceRow) {\n",
    "        return (\n",
    "            <WorkshopSubScreen\n",
    "                title={`Purchase Invoice ${viewInvoiceRow.invoice_number || viewInvoiceRow.id}`}\n",
    "                subtitle={viewInvoiceRow.vendor_name || viewInvoiceRow.supplier || 'Supplier purchase invoice'}\n",
    "                backLabel=\"Back to Purchase Invoices\"\n",
    "                onBack={closeViewInvoiceModal}\n",
    "                size=\"xl\"\n",
    "                maxWidth=\"1100px\"\n",
    "                className=\"ws-pi-sub-screen\"\n",
    "                footer={(\n",
    "                    <div className=\"pi-modal-footer\">\n",
    "                        <div className=\"pi-footer-left\">\n",
    "                            <button type=\"button\" className=\"btn-pi-cancel\" onClick={closeViewInvoiceModal}>\n",
    "                                Close\n",
    "                            </button>\n",
    "                        </div>\n",
    "                    </div>\n",
    "                )}\n",
    "            >\n",
    "                <div className=\"modal-content-purchase\">\n",
]
view_screen_end = [
    "                </div>\n",
    "            </WorkshopSubScreen>\n",
    "        );\n",
    "    }\n",
    "\n",
]

create_screen_full = (
    create_screen[:29]
    + create_body_fixed
    + ["                </div>\n", "            </WorkshopSubScreen>\n", "        );\n", "    }\n", "\n"]
    + view_screen_start
    + view_body_fixed
    + view_screen_end
)

# Fix create_screen - the first build was wrong. Let me rebuild create part only
create_part = [
    "    if (modalOpen) {\n",
    "        return (\n",
    "            <WorkshopSubScreen\n",
    "                title={editingDraftId || editingLocalPiId ? 'Edit Purchase Invoice Draft' : 'New Purchase Invoice'}\n",
    "                subtitle=\"Record supplier purchases, line items, and stock for a branch.\"\n",
    "                backLabel=\"Back to Purchase Invoices\"\n",
    "                onBack={closePurchaseInvoiceForm}\n",
    "                backDisabled={submittingInvoice}\n",
    "                size=\"full\"\n",
    "                maxWidth=\"1350px\"\n",
    "                className=\"ws-pi-sub-screen\"\n",
    "                footer={(\n",
    "                    <div className=\"pi-modal-footer\">\n",
    "                        <div className=\"pi-footer-left\">\n",
    "                            <button\n",
    "                                type=\"button\"\n",
    "                                className=\"btn-pi-cancel\"\n",
    "                                onClick={closePurchaseInvoiceForm}\n",
    "                                disabled={submittingInvoice}\n",
    "                            >\n",
    "                                Cancel\n",
    "                            </button>\n",
    "                        </div>\n",
    "                        <div className=\"pi-footer-right\" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>\n",
    "                            {submitInvoiceError && (\n",
    "                                <p style={{ margin: 0, fontSize: '0.8125rem', color: '#B91C1C', maxWidth: 420, textAlign: 'right' }}>\n",
    "                                    {submitInvoiceError}\n",
    "                                </p>\n",
    "                            )}\n",
    "                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>\n",
    "                                <button\n",
    "                                    type=\"button\"\n",
    "                                    className=\"btn-pi-draft\"\n",
    "                                    onClick={() => handleCreateInvoice('draft')}\n",
    "                                    disabled={!canSavePurchaseInvoiceDraft || submittingInvoice}\n",
    "                                >\n",
    "                                    {submittingInvoice\n",
    "                                        ? 'Saving…'\n",
    "                                        : editingDraftId || editingLocalPiId\n",
    "                                          ? 'Update Draft'\n",
    "                                          : 'Save as Draft'}\n",
    "                                </button>\n",
    "                                <button\n",
    "                                    type=\"button\"\n",
    "                                    className=\"btn-pi-create\"\n",
    "                                    onClick={() => handleCreateInvoice('pending')}\n",
    "                                    disabled={!canSubmitPurchaseInvoice || submittingInvoice}\n",
    "                                    title={\n",
    "                                        !canSubmitPurchaseInvoice\n",
    "                                            ? 'Need invoice branch, linked supplier with ID, at least one line with a branch product, and loaded suppliers.'\n",
    "                                            : undefined\n",
    "                                    }\n",
    "                                >\n",
    "                                    {submittingInvoice\n",
    "                                        ? 'Creating…'\n",
    "                                        : editingDraftId || editingLocalPiId\n",
    "                                          ? isModalLocalSupplier\n",
    "                                              ? 'Complete invoice'\n",
    "                                              : 'Send to Supplier'\n",
    "                                          : isModalLocalSupplier\n",
    "                                            ? 'Create purchase invoice'\n",
    "                                            : 'Create Purchase Invoice'}\n",
    "                                </button>\n",
    "                            </div>\n",
    "                        </div>\n",
    "                    </div>\n",
    "                )}\n",
    "            >\n",
    "                <div className=\"modal-content-purchase\">\n",
] + create_body_fixed + [
    "                </div>\n",
    "            </WorkshopSubScreen>\n",
    "        );\n",
    "    }\n",
    "\n",
] + view_screen_start + view_body_fixed + view_screen_end

# Update imports
out_lines = lines[:main_return] + create_part + lines[main_return:ap_start] + lines[ap_end + 1 :]

result = "".join(out_lines)

# Fix imports
result = result.replace(
    "import { AnimatePresence } from 'framer-motion';\nimport Modal from '../../components/Modal';\n",
    "import WorkshopSubScreen from '../../components/workshop/WorkshopSubScreen';\n",
)

# Replace duplicate close logic in handleCreateInvoice success with closePurchaseInvoiceForm if easy - skip for now

# Use closePurchaseInvoiceForm in handleCreateInvoice success path
if "setModalOpen(false);\n            setSubmitInvoiceError('');" in result:
    result = result.replace(
        """            setModalOpen(false);
            setSubmitInvoiceError('');
            setFreightSar('0');
            setAmountsTaxInclusive(false);
            setInvoiceBranchId('');
            setProductSearchByLineId({});
            setActiveProductSearchLineId(null);
            setProductDropdownPosition(null);
            setEditingDraftId(null);
            clearDraftEditSession();
            setUpdateLastPurchasePrice(true);""",
        """            closePurchaseInvoiceForm();
            setUpdateLastPurchasePrice(true);""",
        1,
    )

PATH.write_text(result, encoding="utf-8")
print("Converted WorkshopPurchases.jsx modals to WorkshopSubScreen")
