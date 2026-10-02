const fs = require('fs');
const s = fs.readFileSync('_ssi_apply_p5.cjs', 'utf8');
const c = fs.readFileSync('src/pages/supplier/SupplierSalesInvoices.jsx', 'utf8');
const needle = "No products loaded. Try again later or use";
const si = s.indexOf(needle);
const ci = c.indexOf(needle);
console.log('script', JSON.stringify(s.slice(si, si + 90)));
console.log('jsx   ', JSON.stringify(c.slice(ci, ci + 90)));
console.log('equal substring?', s.slice(si, si + 90) === c.slice(ci, ci + 90));

// Check bottom empty block exists as exact mustReplace source
const from = `                                                            ? 'No products loaded. Try again later or use “Add line” and type manually.'
                                                            : searchQuery.trim()
                                                              ? 'No matching products. Try SKU, more letters, or check the product is active in your catalog.'
                                                              : 'No products available.'}`;
console.log('from in jsx?', c.includes(from));
console.log('from in script?', s.includes(from));
