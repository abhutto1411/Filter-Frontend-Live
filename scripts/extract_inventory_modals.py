import re
import subprocess
from pathlib import Path

orig = Path(r"C:\Users\User\AppData\Local\Temp\WorkshopInventory.orig.jsx")
if not orig.exists():
    out = subprocess.run(
        ["git", "-C", r"j:\work\Filter Both Front and Back\filter-web", "show", "HEAD:src/pages/workshop/WorkshopInventory.jsx"],
        capture_output=True,
        text=True,
        check=True,
    )
    orig.write_text(out.stdout, encoding="utf-8")

text = orig.read_text(encoding="utf-8")
parts = text.split("<AnimatePresence>")
for i, p in enumerate(parts[1:], 1):
    cond = re.search(r"\{(.+?)&&", p)
    title = re.search(r"title=(.+?)\s+onClose", p, re.DOTALL)
    print(f"--- {i} ---")
    print("cond:", (cond.group(1) if cond else "?")[:60])
    print("title:", (title.group(1) if title else "?")[:80].replace("\n", " "))
