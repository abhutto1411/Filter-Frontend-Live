"""Add WorkshopSubScreen early returns for timeline, manual adjust, bulk adjust."""
import re
from pathlib import Path

path = Path(r"j:\work\Filter Both Front and Back\filter-web\src\pages\workshop\WorkshopInventory.jsx")
lines = path.read_text(encoding="utf-8").splitlines(keepends=True)


def indent(s, spaces):
    pad = " " * spaces
    return "\n".join(pad + ln if ln.strip() else ln for ln in s.splitlines())


def find_ap_block(condition_fragment, from_idx=0):
    cond_i = next(i for i in range(from_idx, len(lines)) if condition_fragment in lines[i])
    ap_i = cond_i
    while ap_i >= 0 and "<AnimatePresence>" not in lines[ap_i]:
        ap_i -= 1
    end_i = next(i for i in range(cond_i, len(lines)) if "</AnimatePresence>" in lines[i])
    return ap_i, end_i


def modal_body_from_ap(ap_start, ap_end):
    sub = lines[ap_start : ap_end + 1]
    modal_rel = next(i for i, ln in enumerate(sub) if "<Modal" in ln)
    j = modal_rel
    while j < len(sub) and ">" not in sub[j]:
        j += 1
    open_line = sub[j]
    gt = open_line.rfind(">")
    tail = open_line[gt + 1 :].strip()
    parts = [tail] if tail else []
    parts.extend(sub[j + 1 :])
    body = "".join(parts)
    body = re.sub(r"\s*</Modal>.*", "", body, flags=re.DOTALL).strip()
    if body.startswith('<div className="mc-modal-form"'):
        body = re.sub(
            r'^<div className="mc-modal-form" style=\{\{ padding: [^}]+\}\}>\s*',
            "",
            body,
            count=1,
        )
        if body.rstrip().endswith("</div>"):
            body = body[: body.rfind("</div>")].rstrip()
    return body


log_ap_s, log_ap_e = find_ap_block("{logProduct && (", 2700)
adj_ap_s, adj_ap_e = find_ap_block("{isAdjustModalOpen && (", log_ap_e)
bulk_ap_s, bulk_ap_e = find_ap_block("{isBulkAdjustModalOpen && (", adj_ap_e)

log_body = modal_body_from_ap(log_ap_s, log_ap_e)
adj_body = modal_body_from_ap(adj_ap_s, adj_ap_e)
bulk_body = modal_body_from_ap(bulk_ap_s, bulk_ap_e)

screens = (
    "    if (logProduct) {\n"
    "        return (\n"
    "            <WorkshopSubScreen\n"
    '                title="Inventory stock timeline"\n'
    "                subtitle={logProduct.name}\n"
    '                backLabel="Back to Inventory"\n'
    "                onBack={() => setLogProduct(null)}\n"
    '                size="wide"\n'
    "                footer={(\n"
    '                    <button type="button" className="mc-btn-ghost mc-btn-large" onClick={() => setLogProduct(null)}>Close</button>\n'
    "                )}\n"
    "            >\n"
    '                <div className="ws-section" style={{ padding: 20 }}>\n'
    + indent(log_body, 20)
    + "\n                </div>\n"
    "            </WorkshopSubScreen>\n"
    "        );\n"
    "    }\n"
    "\n"
    "    if (isAdjustModalOpen && adjustItem) {\n"
    "        return (\n"
    "            <WorkshopSubScreen\n"
    '                title="Manual Inventory Adjustment"\n'
    "                subtitle={adjustItem?.name || 'Update stock for this product.'}\n"
    '                backLabel="Back to Inventory"\n'
    "                onBack={closeAdjustModal}\n"
    "                backDisabled={adjustSaving}\n"
    "            >\n"
    '                <div className="ws-section" style={{ padding: 20 }}>\n'
    + indent(adj_body, 20)
    + "\n                </div>\n"
    "            </WorkshopSubScreen>\n"
    "        );\n"
    "    }\n"
    "\n"
    "    if (isBulkAdjustModalOpen) {\n"
    "        return (\n"
    "            <WorkshopSubScreen\n"
    "                title={`Bulk adjust — ${selectedProductsForBulk.length} product${selectedProductsForBulk.length !== 1 ? 's' : ''}`}\n"
    '                subtitle="Apply the same reason and quantity to all selected products."\n'
    '                backLabel="Back to Inventory"\n'
    "                onBack={closeBulkAdjustModal}\n"
    "                backDisabled={bulkAdjustSaving}\n"
    '                size="wide"\n'
    "            >\n"
    '                <div className="ws-section" style={{ padding: 20 }}>\n'
    + indent(bulk_body, 20)
    + "\n                </div>\n"
    "            </WorkshopSubScreen>\n"
    "        );\n"
    "    }\n"
    "\n"
)

main_i = next(
    i for i, ln in enumerate(lines) if ln.strip() == "return (" and "mc-catalog-container" in lines[i + 1]
)

insert_lines = screens.splitlines(keepends=True)
for offset, ln in enumerate(insert_lines):
    lines.insert(main_i + offset, ln)

# Re-find and delete (bottom-up)
log_ap_s2, log_ap_e2 = find_ap_block("{logProduct && (", 2700)
adj_ap_s2, adj_ap_e2 = find_ap_block("{isAdjustModalOpen && (", log_ap_e2)
bulk_ap_s2, bulk_ap_e2 = find_ap_block("{isBulkAdjustModalOpen && (", adj_ap_e2)

for s, e in sorted([(log_ap_s2, log_ap_e2), (adj_ap_s2, adj_ap_e2), (bulk_ap_s2, bulk_ap_e2)], reverse=True):
    del lines[s : e + 1]

path.write_text("".join(lines), encoding="utf-8")
print("Done. Inserted", len(insert_lines), "lines at", main_i)
