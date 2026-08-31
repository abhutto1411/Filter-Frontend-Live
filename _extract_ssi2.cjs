const fs = require('fs');
const p = 'j:/work/Filter Both Front and Back/filter-web/src/pages/supplier/SupplierSalesInvoices.jsx';
let c = fs.readFileSync(p, 'utf8');

// More thorough: all single/double quoted strings containing spaces or capital letters that look like English UI
const candidates = new Map(); // string -> count
function add(s, kind) {
  if (!s || s.length < 2) return;
  if (!/[A-Za-z]/.test(s)) return;
  // skip code-ish
  if (/^(https?:|\/|\.|supplier_|salesInvoice|filter_|pending_|partially_|paid|cancelled|draft|cash|bank|card|cheque|other|customer|affiliated|branch|workshop)/i.test(s) && !/\s/.test(s) && s.length < 40) {
    // keep some short labels
  }
  if (/^[a-z][a-zA-Z0-9_.]*$/.test(s) && !/\s/.test(s)) return; // identifiers
  if (/^[A-Z_]+$/.test(s)) return;
  if (s.includes('=>') || s.includes('function') || s.includes('return ')) return;
  if (s.startsWith('mgr-') || s.startsWith('si-') || s.includes('className')) return;
  if (/^\d/.test(s)) return;
  const key = kind + '|' + s;
  candidates.set(key, (candidates.get(key) || 0) + 1);
}

for (const x of c.matchAll(/'([^'\\]*(?:\\.[^'\\]*)*)'/g)) add(x[1].replace(/\\'/g, "'"), 'sq');
for (const x of c.matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"/g)) add(x[1].replace(/\\"/g, '"'), 'dq');
for (const x of c.matchAll(/`([^`\\]*(?:\\.[^`\\]*)*)`/g)) {
  const s = x[1];
  if (s.includes('${') || /[A-Za-z]{3,}/.test(s)) add(s, 'tl');
}

const lines = [...candidates.entries()]
  .filter(([k]) => {
    const s = k.slice(3);
    // keep if has space or looks like Title Case / sentence
    return /\s/.test(s) || /^[A-Z]/.test(s) || s.includes('…') || s.includes('…') || /[.?!]/.test(s);
  })
  .sort((a, b) => a[0].localeCompare(b[0]));

fs.writeFileSync('j:/work/Filter Both Front and Back/filter-web/_ssi_candidates.txt', lines.map(([k, n]) => `${n}\t${k}`).join('\n'));
console.log('candidates', lines.length);
