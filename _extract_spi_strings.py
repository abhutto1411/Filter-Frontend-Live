import re
from pathlib import Path

p = Path(r"j:\work\Filter Both Front and Back\filter-web\src\pages\supplier\SupplierPurchaseInvoices.jsx")
text = p.read_text(encoding="utf-8")
patterns = []
for m in re.finditer(r">([^<{\n][^<]*?)<", text):
    s = m.group(1).strip()
    if s and re.search(r"[A-Za-z]", s) and len(s) > 1:
        patterns.append(("jsx", s))
for m in re.finditer(r"""['"]([^'"]{3,})['"]""", text):
    s = m.group(1)
    if re.search(r"[A-Za-z]", s) and (
        " " in s
        or s[0].isupper()
        or s.endswith("…")
        or s.endswith("?")
        or s.endswith(".")
    ):
        if any(
            x in s
            for x in [
                "/",
                "\\",
                "http",
                "className",
                "px",
                "rem",
                "var(",
                "rgba",
                "function",
                "Date.",
                "ISO",
                "theme-",
                "cash-",
                "btn-",
                "table-",
                "ws-",
            ]
        ):
            continue
        if re.match(r"^[a-z_./-]+$", s):
            continue
        patterns.append(("str", s))
seen = set()
out = []
for kind, s in patterns:
    if s in seen:
        continue
    seen.add(s)
    out.append(f"{kind}: {s}")
print(f"unique: {len(out)}")
Path(r"j:\work\Filter Both Front and Back\filter-web\_spi_strings.txt").write_text(
    "\n".join(out), encoding="utf-8"
)
print("wrote _spi_strings.txt")
