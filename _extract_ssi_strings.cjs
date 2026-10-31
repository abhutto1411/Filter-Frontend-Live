const fs = require('fs');
const p = 'j:/work/Filter Both Front and Back/filter-web/src/pages/supplier/SupplierSalesInvoices.jsx';
let c = fs.readFileSync(p, 'utf8');
const crlf = (c.match(/\r\n/g) || []).length;
const lf = (c.match(/(?<!\r)\n/g) || []).length;
console.log('CRLF', crlf, 'LF', lf, 'lines', c.split(/\r?\n/).length);

const m = c.match(/export default function[^\n]+/);
console.log(m && m[0]);

const texts = new Set();
for (const x of c.matchAll(/>([^<>{}\n][^<>{}]*)</g)) {
  const t = x[1].trim();
  if (t && /[A-Za-z]/.test(t) && t.length > 1 && !/^[\d\s.,%+\-–—\/:]+$/.test(t)) texts.add('T:' + t);
}
for (const x of c.matchAll(/(?:title|placeholder|aria-label|label)=\{?["']([^"']+)["']/g)) texts.add('A:' + x[1]);
for (const x of c.matchAll(/(?:title|placeholder|aria-label)=\{?`([^`]+)`/g)) texts.add('A:' + x[1]);
for (const x of c.matchAll(/(?:window\.)?(?:alert|confirm)\(\s*["'`]([^"'`]+)/g)) texts.add('AL:' + x[1]);
for (const x of c.matchAll(/set\w*[Ee]rror\w*\(\s*["'`]([^"'`]+)/g)) texts.add('E:' + x[1]);
for (const x of c.matchAll(/set\w*[Mm]essage\w*\(\s*["'`]([^"'`]+)/g)) texts.add('M:' + x[1]);
for (const x of c.matchAll(/label:\s*["']([^"']+)["']/g)) texts.add('L:' + x[1]);
for (const x of c.matchAll(/text:\s*["']([^"']+)["']/g)) texts.add('TX:' + x[1]);
// template literals with English words in UI contexts
for (const x of c.matchAll(/`([^`$]*[A-Za-z]{3,}[^`]*)`/g)) {
  const t = x[1];
  if (t.includes('${')) {
    // keep templates that look like sentences
    if (/[A-Z][a-z]+/.test(t) && t.length < 120) texts.add('TL:' + t);
  }
}
console.log([...texts].sort().join('\n'));
console.log('TOTAL', texts.size);
