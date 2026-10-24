"""Convert WorkshopInventory modals to WorkshopSubScreen early returns."""
import re
import subprocess
from pathlib import Path

REPO = Path(r"j:\work\Filter Both Front and Back\filter-web")
TARGET = REPO / "src/pages/workshop/WorkshopInventory.jsx"
ORIG = Path(r"C:\Users\User\AppData\Local\Temp\WorkshopInventory.orig.jsx")

if not ORIG.exists():
    out = subprocess.run(
        ["git", "-C", str(REPO), "show", "HEAD:src/pages/workshop/WorkshopInventory.jsx"],
        capture_output=True,
        text=True,
        check=True,
    )
    ORIG.write_text(out.stdout, encoding="utf-8")

orig_lines = ORIG.read_text(encoding="utf-8").splitlines(keepends=True)
lines = TARGET.read_text(encoding="utf-8").splitlines(keepends=True)

# Replace modal imports
for i, ln in enumerate(lines):
    if "framer-motion" in ln and "AnimatePresence" in ln:
        lines[i] = "import WorkshopSubScreen from '../../components/workshop/WorkshopSubScreen';\n"
        if i + 1 < len(lines) and "Modal" in lines[i + 1]:
            del lines[i + 1]
        break

def modal_inner(start, end, unwrap=True):
    chunk_lines = orig_lines[start - 1 : end]
    modal_i = next(i for i, ln in enumerate(chunk_lines) if "<Modal" in ln)
    j = modal_i
    while j < len(chunk_lines) and ">" not in chunk_lines[j]:
        j += 1
    if j >= len(chunk_lines):
        raise RuntimeError(f"No Modal opening tag end {start}-{end}")
    open_line = chunk_lines[j]
    gt = open_line.rfind(">")
    tail = open_line[gt + 1 :].strip()
    body_parts = [tail] if tail else []
    body_parts.extend(chunk_lines[j + 1 :])
    body = "".join(body_parts)
    body = re.sub(r"\s*</Modal>.*", "", body, flags=re.DOTALL).strip()
    if not unwrap:
        return body
    if body.startswith('<div className="mc-modal-form"'):
        body = re.sub(r'^<div className="mc-modal-form" style=\{\{ padding: [^}]+\}\}>\s*', "", body, count=1)
        if body.endswith("</div>"):
            body = body[: body.rfind("</div>")].rstrip()
    elif body.startswith('<div style={{ padding:'):
        body = re.sub(r'^<div style=\{\{ padding: [^}]+\}\}>\s*', "", body, count=1)
        if body.endswith("</div>"):
            body = body[: body.rfind("</div>")].rstrip()
    return body

def indent_block(s, spaces=20):
    pad = " " * spaces
    return "\n".join(pad + ln if ln.strip() else ln for ln in s.splitlines())

SCREENS = [
    {
        "cond": "isRequestModalOpen && requestItem",
        "title": '"Request Stock from Supplier"',
        "subtitle": '"Submit a replenishment request to your supplier."',
        "back": "Back to Inventory",
        "on_back": "() => setIsRequestModalOpen(false)",
        "size": "form",
        "body": modal_inner(2656, 2686),
        "footer": """<div style={{ display: 'flex', gap: 12, width: '100%' }}>
                        <button type="button" className="mc-btn-ghost" style={{ flex: 1, padding: '12px' }} onClick={() => setIsRequestModalOpen(false)}>Cancel</button>
                        <button type="button" className="mc-btn-primary" style={{ flex: 2, padding: '12px' }} onClick={handleRequestSubmit} disabled={!selectedSupplier || requestQty <= 0}>Submit Request</button>
                    </div>""",
    },
    {
        "cond": "logProduct",
        "title": '"Inventory stock timeline"',
        "subtitle": "{logProduct.name}",
        "back": "Back to Inventory",
        "on_back": "() => setLogProduct(null)",
        "size": "wide",
        "body": modal_inner(2701, 2937, unwrap=False),
        "footer": """<button type="button" className="mc-btn-ghost mc-btn-large" onClick={() => setLogProduct(null)}>Close</button>""",
    },
    {
        "cond": "isAdjustModalOpen && adjustItem",
        "title": '"Manual Inventory Adjustment"',
        "subtitle": "{adjustItem?.name || 'Update stock for this product.'}",
        "back": "Back to Inventory",
        "on_back": "closeAdjustModal",
        "back_disabled": "adjustSaving",
        "size": "form",
        "body": modal_inner(2939, 3077),
        "footer": None,  # buttons in body
        "no_footer": True,
    },
    {
        "cond": "isBulkAdjustModalOpen",
        "title": "{`Bulk adjust — ${selectedProductsForBulk.length} product${selectedProductsForBulk.length !== 1 ? 's' : ''}`}",
        "subtitle": '"Apply the same reason and quantity to all selected products."',
        "back": "Back to Inventory",
        "on_back": "closeBulkAdjustModal",
        "back_disabled": "bulkAdjustSaving",
        "size": "wide",
        "body": modal_inner(3079, 3312),
        "footer": None,
        "no_footer": True,
    },
    {
        "cond": "isCriticalModalOpen && criticalItem",
        "title": '"Critical stock level"',
        "subtitle": "{criticalItem?.name || 'Set low-stock alert threshold for this branch.'}",
        "back": "Back to Inventory",
        "on_back": "closeCriticalModal",
        "back_disabled": "criticalSaving",
        "size": "form",
        "body": modal_inner(3333, 3407),
        "footer": None,
        "no_footer": True,
    },
    {
        "cond": "isLowStockProofOpen",
        "title": '"Low stock (SKUs) — breakdown"',
        "subtitle": '"Line-by-line SKUs at or below critical stock."',
        "back": "Back to Inventory",
        "on_back": "() => setIsLowStockProofOpen(false)",
        "size": "full",
        "body": modal_inner(3409, 3523, unwrap=False),
        "footer": """<button type="button" className="mc-btn-ghost mc-btn-large" onClick={() => setIsLowStockProofOpen(false)}>Close</button>""",
    },
    {
        "cond": "isInvValueProofOpen",
        "title": '"Total inventory value — calculation"',
        "subtitle": '"How the inventory value KPI is computed for this scope."',
        "back": "Back to Inventory",
        "on_back": "() => setIsInvValueProofOpen(false)",
        "size": "full",
        "body": modal_inner(3525, 3635, unwrap=False),
        "footer": """<button type="button" className="mc-btn-ghost mc-btn-large" onClick={() => setIsInvValueProofOpen(false)}>Close</button>""",
    },
]

def render_screen(sc):
    size_line = f'\n                size="{sc["size"]}"' if sc.get("size") != "form" else ""
    back_dis = f'\n                backDisabled={{{sc["back_disabled"]}}}' if sc.get("back_disabled") else ""
    footer_block = ""
    if not sc.get("no_footer"):
        footer_block = f"""
                footer={{(
                    {indent_block(sc["footer"], 20)}
                )}}"""
    return f"""    if ({sc["cond"]}) {{
        return (
            <WorkshopSubScreen
                title={sc["title"]}
                subtitle={sc["subtitle"]}
                backLabel="{sc["back"]}"
                onBack={{{sc["on_back"]}}}{back_dis}{size_line}{footer_block}
            >
                <div className="ws-section" style={{{{ padding: 20 }}}}>
{indent_block(sc["body"], 20)}
                </div>
            </WorkshopSubScreen>
        );
    }}

"""

insert_blocks = []
# UOM early returns first (after other screens? put uom last so list shows when no sub-screen)
for sc in SCREENS:
    insert_blocks.append(render_screen(sc))

insert_blocks.append("""    if (uomEditProduct && !isAllBranches) {
        return (
            <WorkshopProductUomEditModal
                product={uomEditProduct}
                branchId={String(selectedBranchId)}
                workshopId={workshopIdQuery}
                onClose={() => setUomEditProduct(null)}
                onSaved={handleUomSaved}
            />
        );
    }

    if (isBulkUomModalOpen && !isAllBranches) {
        return (
            <WorkshopBulkUomModal
                products={selectedProductsForBulk}
                branchId={String(selectedBranchId)}
                workshopId={workshopIdQuery}
                onClose={() => setIsBulkUomModalOpen(false)}
                onSaved={handleBulkUomSaved}
            />
        );
    }

""")

insert_text = "".join(insert_blocks)

# Find main return — inventory page root only
main_i = next(
    i
    for i, ln in enumerate(lines)
    if ln.strip() == "return (" and i + 1 < len(lines) and "mc-catalog-container" in lines[i + 1]
)
assert main_i > 0, "main return not found"
insert_lines = insert_text.splitlines(keepends=True)
for offset, ln in enumerate(insert_lines):
    lines.insert(main_i + offset, ln)

# Re-find modal blocks after insert
modal_start = next(i for i, ln in enumerate(lines) if "<AnimatePresence>" in ln)
uom_start = next(i for i, ln in enumerate(lines) if "WorkshopProductUomEditModal" in ln and "<" in ln)
last_ap = next(i for i in range(len(lines) - 1, modal_start, -1) if "</AnimatePresence>" in lines[i])

# Remove AnimatePresence blocks
del lines[modal_start : last_ap + 1]

# Remove UOM inline (re-find after delete)
uom_start = next((i for i, ln in enumerate(lines) if "WorkshopProductUomEditModal" in ln and "<" in ln), None)
if uom_start is not None:
    uom_end = next(i for i in range(uom_start, len(lines)) if lines[i].strip() == ") : null}")
    # also remove bulk uom block if follows
    bulk_end = uom_end
    for j in range(uom_end + 1, min(uom_end + 20, len(lines))):
        if "WorkshopBulkUomModal" in lines[j]:
            bulk_end = next(k for k in range(j, len(lines)) if lines[k].strip() == ") : null}")
            break
    del lines[uom_start : bulk_end + 1]

TARGET.write_text("".join(lines), encoding="utf-8")
print("Done. main_i was", main_i, "removed modals", modal_start, "-", last_ap)
