#!/usr/bin/env python3
from pathlib import Path

PATH = Path(__file__).resolve().parents[1] / "src/pages/workshop/WorkshopApprovals.jsx"
lines = PATH.read_text(encoding="utf-8").splitlines(keepends=True)

ap_start = ap_end = None
for i, line in enumerate(lines):
    if line.strip() == "<AnimatePresence>":
        ap_start = i
    if ap_start is not None and line.strip() == "</AnimatePresence>":
        ap_end = i
        break
if ap_start is None:
    raise SystemExit("AnimatePresence not found")

def extract_modal_block(start_marker):
    open_i = None
    for i in range(ap_start, ap_end + 1):
        if start_marker in lines[i]:
            open_i = i
            break
    if open_i is None:
        raise SystemExit(f"{start_marker} not found")
    children_start = None
    for i in range(open_i, ap_end + 1):
        if lines[i].rstrip("\n") == "                    >":
            children_start = i + 1
            break
    close_i = None
    for i in range(children_start, ap_end + 1):
        if lines[i].strip() == "</Modal>":
            close_i = i
            break
    return lines[children_start:close_i]

def reindent(body, drop=4):
    out = []
    for ln in body:
        n = len(ln) - len(ln.lstrip())
        if n >= drop:
            out.append(" " * (n - drop) + ln.lstrip())
        else:
            out.append(ln)
    return out

reject_body = reindent(extract_modal_block("{rejectDialog && ("))
si_body = reindent(extract_modal_block("{siApproveModal && ("))
view_body = reindent(extract_modal_block("{viewDialog && ("))

main_return = None
for i, line in enumerate(lines):
    if line == "    return (\n" and i < ap_start:
        main_return = i

early = [
    "    if (rejectDialog) {\n",
    "        return (\n",
    "            <WorkshopSubScreen\n",
    "                title={isSupplierSalesInvoiceRow(rejectDialog) ? 'Reject supplier invoice' : 'Reject approval'}\n",
    "                subtitle=\"Provide a reason — this is stored on the request.\"\n",
    "                backLabel=\"Back to Approvals\"\n",
    "                onBack={closeRejectDialog}\n",
    "                backDisabled={actionLoadingId !== null}\n",
    "                size=\"narrow\"\n",
    "                footer={(\n",
    "                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', width: '100%' }}>\n",
    "                        <button\n",
    "                            className=\"btn-secondary\"\n",
    "                            onClick={closeRejectDialog}\n",
    "                            disabled={actionLoadingId !== null}\n",
    "                        >\n",
    "                            Cancel\n",
    "                        </button>\n",
    "                        <button\n",
    "                            className=\"btn-submit\"\n",
    "                            style={{ background: '#DC2626' }}\n",
    "                            disabled={!rejectReason.trim() || actionLoadingId !== null}\n",
    "                            onClick={handleRejectSubmit}\n",
    "                        >\n",
    "                            {actionLoadingId != null && String(actionLoadingId).startsWith('reject-')\n",
    "                                ? 'Rejecting...'\n",
    "                                : 'Reject'}\n",
    "                        </button>\n",
    "                    </div>\n",
    "                )}\n",
    "            >\n",
    "                <div className=\"ws-section\" style={{ padding: 20 }}>\n",
] + reject_body + [
    "                </div>\n",
    "            </WorkshopSubScreen>\n",
    "        );\n",
    "    }\n",
    "\n",
    "    if (siApproveModal) {\n",
    "        return (\n",
    "            <WorkshopSubScreen\n",
    "                title=\"Products will be added to branch inventory\"\n",
    "                subtitle=\"Set critical stock for new branch products, then approve.\"\n",
    "                backLabel=\"Back to Approvals\"\n",
    "                onBack={closeSiApproveScreen}\n",
    "                backDisabled={actionLoadingId !== null}\n",
    "                size=\"wide\"\n",
    "                footer={(\n",
    "                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap', width: '100%' }}>\n",
    "                        <button\n",
    "                            type=\"button\"\n",
    "                            className=\"btn-secondary\"\n",
    "                            onClick={closeSiApproveScreen}\n",
    "                            disabled={actionLoadingId !== null}\n",
    "                        >\n",
    "                            Cancel\n",
    "                        </button>\n",
    "                        <button\n",
    "                            type=\"button\"\n",
    "                            className=\"btn-submit\"\n",
    "                            onClick={submitSupplierInvoiceApproveFromModal}\n",
    "                            disabled={actionLoadingId !== null}\n",
    "                        >\n",
    "                            {actionLoadingId != null && String(actionLoadingId).startsWith('approve-si-')\n",
    "                                ? 'Approving…'\n",
    "                                : 'OK — approve & update inventory'}\n",
    "                        </button>\n",
    "                    </div>\n",
    "                )}\n",
    "            >\n",
    "                <div className=\"ws-section\" style={{ padding: 20 }}>\n",
] + si_body + [
    "                </div>\n",
    "            </WorkshopSubScreen>\n",
    "        );\n",
    "    }\n",
    "\n",
    "    if (viewDialog) {\n",
    "        const isSupplierView = isSupplierSalesInvoiceRow(viewDialog);\n",
    "        return (\n",
    "            <WorkshopSubScreen\n",
    "                title={isSupplierView ? `Supplier Invoice ${viewDialog.invoiceNo || ''}`.trim() : 'Approval Details'}\n",
    "                subtitle={\n",
    "                    isSupplierView\n",
    "                        ? (viewDialog.supplier?.name || 'Supplier invoice')\n",
    "                        : formatRequestKindLabel(viewDialog)\n",
    "                }\n",
    "                backLabel=\"Back to Approvals\"\n",
    "                onBack={closeViewDialog}\n",
    "                size={isSupplierView ? 'xl' : 'form'}\n",
    "                maxWidth={isSupplierView ? '1100px' : undefined}\n",
    "                className={isSupplierView ? 'ws-pi-sub-screen' : ''}\n",
    "            >\n",
    "                <div className={isSupplierView ? 'modal-content-purchase' : 'ws-section'} style={isSupplierView ? undefined : { padding: 20 }}>\n",
] + view_body + [
    "                </div>\n",
    "            </WorkshopSubScreen>\n",
    "        );\n",
    "    }\n",
    "\n",
]

out = lines[:main_return] + early + lines[main_return:ap_start] + lines[ap_end + 1 :]
PATH.write_text("".join(out), encoding="utf-8")
print("Done")
