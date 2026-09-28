const fs = require('fs');
const c = fs.readFileSync('src/pages/supplier/SupplierSalesInvoices.jsx', 'utf8');

const texts = new Set();
for (const x of c.matchAll(/>([^<>{}\n][^<>{}]*)</g)) {
  const t = x[1].trim();
  if (t && /[A-Za-z]/.test(t) && t.length > 1 && !/^[\d\s.,%+\-–—\/:]+$/.test(t)) texts.add('T:' + t);
}
for (const x of c.matchAll(/(?:title|placeholder|aria-label|label|backLabel)=\{?["']([^"']+)["']/g)) texts.add('A:' + x[1]);
for (const x of c.matchAll(/(?:window\.)?(?:alert|confirm)\(\s*["'`]([^"'`]+)/g)) texts.add('AL:' + x[1]);
for (const x of c.matchAll(/set\w*[Ee]rror\w*\(\s*["'`]([^"'`]+)/g)) texts.add('E:' + x[1]);
for (const x of c.matchAll(/label:\s*["']([^"']+)["']/g)) texts.add('L:' + x[1]);
for (const x of c.matchAll(/text:\s*["']([^"']+)["']/g)) texts.add('TX:' + x[1]);
// string literals that look like sentences still in code
for (const x of c.matchAll(/'([A-Z][^']{8,120})'/g)) {
  const t = x[1];
  if (/^(Arrow|Enter|Escape|Tab|Product|Service|Box|Net |Custom|EOM|VAT |Exempt|Main Cash|Bank —|DRAFT|WPI|pending|partially|paid|cancelled|draft|cash|bank|card)/.test(t)) continue;
  if (t.includes('/') && t.includes('components')) continue;
  if (t.includes('supplier_') || t.includes('salesInvoice')) continue;
  texts.add('SQ:' + t);
}

console.log([...texts].sort().join('\n'));
console.log('TOTAL', texts.size);

// Also check t( usage count
console.log('t( calls', (c.match(/\bt\('/g) || []).length);
console.log('SAR leftover', (c.match(/\bSAR\b/g) || []).length);
console.log('locale prop', /locale: localeProp/.test(c));
