"""One-off: convert WorkshopInventory modal blocks to early-return WorkshopSubScreens."""
from pathlib import Path

path = Path(r"j:\work\Filter Both Front and Back\filter-web\src\pages\workshop\WorkshopInventory.jsx")
text = path.read_text(encoding="utf-8")
lines = text.splitlines(keepends=True)

# Locate main component return (inventory list)
main_i = next(i for i, ln in enumerate(lines) if i > 1800 and ln.strip() == "return (" and "mc-catalog-container" in lines[i + 1])

# First modal overlay block
modal_start = next(i for i, ln in enumerate(lines) if i > main_i and "<AnimatePresence>" in ln)

# UOM inline renders (after bulk adjust modal)
uom_start = next(i for i, ln in enumerate(lines) if "WorkshopProductUomEditModal" in ln and "<" in ln)
bulk_uom_start = next(i for i, ln in enumerate(lines) if "WorkshopBulkUomModal" in ln and "<" in ln)
uom_end = next(i for i, ln in enumerate(lines) if i > bulk_uom_start and ln.strip() == ") : null}")

# Last AnimatePresence close before component end
last_ap_close = next(i for i in range(len(lines) - 1, modal_start, -1) if "</AnimatePresence>" in lines[i])

# Extract modal section (AnimatePresence blocks only — not UOM)
modal_section = "".join(lines[modal_start : uom_start])

# Build early-return screens from known modal patterns
screens = []

def add_screen(condition, title, subtitle, back_label, on_back, size, body_lines, footer_lines, back_disabled="false"):
    size_attr = f'\n            size="{size}"' if size != "form" else ""
    back_dis = f"\n            backDisabled={{{back_disabled}}}" if back_disabled != "false" else ""
    screens.append(
        f"""    if ({condition}) {{
        return (
            <WorkshopSubScreen
                title={title}
                subtitle={subtitle}
                backLabel="{back_label}"
                onBack={{{on_back}}}{back_dis}{size_attr}
                footer={{(
                    {footer_lines}
                )}}
            >
                <div className="ws-section" style={{ padding: 20 }}>
{body_lines}
                </div>
            </WorkshopSubScreen>
        );
    }}

"""
    )

# --- Request (dead but kept) ---
add_screen(
    "isRequestModalOpen && requestItem",
    '"Request Stock from Supplier"',
    '"Submit a replenishment request to your supplier."',
    "Back to Inventory",
    "() => setIsRequestModalOpen(false)",
    "form",
    """                    <div style={{ marginBottom: 20, padding: 16, background: '#F9FAFB', borderRadius: 12, border: '1px solid var(--color-border-light)' }}>
                        <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Product Details</p>
                        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>{requestItem?.name}</h4>
                        <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>SKU: {requestItem?.sku || 'N/A'}</p>
                    </div>
                    <div className="mc-form-group" style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 8, display: 'block' }}>CHOOSE SUPPLIER</label>
                        <select className="mc-filter-select" style={{ width: '100%', height: 45 }} value={selectedSupplier} onChange={(e) => setSelectedSupplier(e.target.value)}>
                            <option value="">Select a supplier...</option>
                            {MOCK_SUPPLIERS_CATALOG.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="mc-form-group" style={{ marginBottom: 24 }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 8, display: 'block' }}>QUANTITY TO REQUEST</label>
                        <input type="number" className="mc-filter-select" style={{ width: '100%', height: 45 }} placeholder="Enter quantity..." value={requestQty} onChange={(e) => setRequestQty(e.target.value)} />
                    </div>""",
    """                    <div style={{ display: 'flex', gap: 12, width: '100%' }}>
                        <button type="button" className="mc-btn-ghost" style={{ flex: 1, padding: 12 }} onClick={() => setIsRequestModalOpen(false)}>Cancel</button>
                        <button type="button" className="mc-btn-primary" style={{ flex: 2, padding: 12 }} onClick={handleRequestSubmit} disabled={!selectedSupplier || requestQty <= 0}>Submit Request</button>
                    </div>""",
)

# For timeline, adjust, bulk, critical, proofs — extract body from original file between Modal tags
import re

blocks = re.findall(
    r"<AnimatePresence>\s*\{([^}]+)&&\s*\(\s*<Modal[^>]*title=\{?([^>]*?)\}?\s*[^>]*onClose=\{([^}]+)\}[^>]*>\s*(.*?)\s*</Modal>\s*\)\s*\}\s*</AnimatePresence>",
    modal_section,
    re.DOTALL,
)

# Manual mapping for complex modals — extract with simpler line-based approach
sections = modal_section.split("<AnimatePresence>")
section_map = []

for raw in sections[1:]:
    cond_m = re.search(r"\{(.+?)&&\s*\(", raw)
    title_m = re.search(r'title=\{?("`|[^"\n]+|{[^}]+})', raw)
    if not cond_m:
        continue
    cond = cond_m.group(1).strip()
    inner_m = re.search(r"<Modal[^>]*>(.*)</Modal>", raw, re.DOTALL)
    if not inner_m:
        continue
    inner = inner_m.group(1).strip()
    # strip outer padding wrapper if duplicate
    section_map.append((cond, inner))

# Fallback: use line slices from original indices
def slice_modal_body(start_marker, end_marker):
    s = modal_section.find(start_marker)
    e = modal_section.find(end_marker, s)
    return modal_section[s:e].strip()

# Timeline — keep inner from original (between Modal tags)
timeline_inner = re.search(
    r"logProduct && \(\s*<Modal[^>]*>\s*(.*?)\s*</Modal>",
    modal_section,
    re.DOTALL,
).group(1).strip()
# Remove extra padding wrapper
timeline_inner = re.sub(r"^<div style=\{\{ padding: '0 24px 24px' \}\}>\s*", "", timeline_inner)
timeline_inner = re.sub(r"\s*</div>\s*$", "", timeline_inner, count=1)

add_screen(
    "logProduct",
    '"Inventory stock timeline"',
    "logProduct.name",
    "Back to Inventory",
    "() => setLogProduct(null)",
    "wide",
    "                    " + timeline_inner.replace("\n", "\n                    "),
    """                    <button type="button" className="mc-btn-ghost mc-btn-large" onClick={() => setLogProduct(null)}>Close</button>""",
)

path.write_text("".join(lines), encoding="utf-8")
print("section_map", len(section_map), "blocks found", len(blocks))
