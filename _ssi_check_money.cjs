const fs = require('fs');
const c = fs.readFileSync('src/pages/supplier/SupplierSalesInvoices.jsx', 'utf8');
const i = c.indexOf('SAR {line.taxAmt}');
console.log(JSON.stringify(c.slice(i - 80, i + 120)));
