import assert from 'node:assert/strict';
import {
    escapePdfHtml,
    pdfCellHtml,
    splitLatinAndArabic,
    stackedNameHtml,
    statementScopeLabel,
    chunkRows,
    buildGenericLedgerPdfPages,
} from './bilingualHtmlPdf.js';
import { buildCashBankRegisterPdfPages } from './cashBankRegisterExport.js';

assert.equal(escapePdfHtml('A & B <C>'), 'A &amp; B &lt;C&gt;');
assert.ok(pdfCellHtml('مؤسسة مدار رندا للمقاولات').includes('مؤسسة مدار رندا للمقاولات'));
assert.ok(pdfCellHtml('مؤسسة مدار رندا للمقاولات').includes('class="td-ar"'));
assert.equal(chunkRows([1, 2, 3, 4, 5], 2).length, 3);

assert.equal(statementScopeLabel('Platform HQ'), 'Headquarters');
assert.equal(statementScopeLabel('Al Basateen Branch'), 'Al Basateen Branch');

const mixed = 'Madar Randa Contracting Establishment مؤسسة مدار رندا للمقاولات';
const split = splitLatinAndArabic(mixed);
assert.equal(split.english, 'Madar Randa Contracting Establishment');
assert.equal(split.arabic, 'مؤسسة مدار رندا للمقاولات');

const mixedHtml = pdfCellHtml(mixed);
assert.ok(mixedHtml.includes('class="td-en"'));
assert.ok(mixedHtml.includes('class="td-ar"'));
assert.ok(mixedHtml.includes('Madar Randa Contracting Establishment'));
assert.ok(mixedHtml.includes('مؤسسة مدار رندا للمقاولات'));
assert.ok(!mixedHtml.includes('j-pQ0jE7v0Paja0'));
assert.ok(!/td-en">[^<]*مؤسسة/.test(mixedHtml), 'Arabic must not sit inside the English span');

const cashPages = buildGenericLedgerPdfPages({
    brand: 'FILTER ERP',
    title: 'Cash Register',
    metaHtml: 'Account: [1001] Cash — HQ',
    columns: [
        { label: 'Date' },
        { label: 'Paid to / Received from' },
        { label: 'Description' },
        { label: 'IN', num: true },
    ],
    dataRows: [
        [
            { text: '2026-09-08' },
            { text: mixed },
            { text: 'Received from Madar Randa Contracting مؤسسة مدار رندا للمقاولات' },
            { html: '3,246.34', className: 'num in' },
        ],
    ],
    generated: 'Generated',
});

assert.equal(cashPages.length, 1);
assert.ok(cashPages[0].includes('مؤسسة مدار رندا للمقاولات'));
assert.ok(cashPages[0].includes('Madar Randa Contracting Establishment'));
assert.ok(cashPages[0].includes('class="td-ar"'));
assert.ok(!cashPages[0].includes('unicode-bidi:plaintext'));
assert.ok(!cashPages[0].includes('j-pQ0jE7v0Paja0'));

const ledgerPages = buildGenericLedgerPdfPages({
    brand: 'FILTER ERP',
    title: '[1113] FILTER - Free Wash فلتر غسيل مجاني',
    metaHtml: 'Account: FILTER - Free Wash فلتر غسيل مجاني',
    columns: [{ label: 'Date' }, { label: 'Description' }, { label: 'Credit', num: true }],
    dataRows: [
        [
            { text: '2026-09-15' },
            { text: 'BILL-0056 فلتر غسيل مجاني' },
            { html: '1,615.00', className: 'num' },
        ],
    ],
    generated: 'Generated',
});
assert.ok(ledgerPages[0].includes('فلتر غسيل مجاني'));
assert.ok(ledgerPages[0].includes('FILTER - Free Wash'));
assert.ok(ledgerPages[0].includes('class="td-ar"'));
assert.ok(ledgerPages[0].includes('class="title-en"'));
assert.ok(ledgerPages[0].includes('class="title-ar"'));
assert.ok(!ledgerPages[0].includes('title-sep'));
assert.ok(
    ledgerPages[0].indexOf('FILTER - Free Wash') < ledgerPages[0].indexOf('فلتر غسيل مجاني'),
    'English title must appear before Arabic title',
);

const registerPages = buildCashBankRegisterPdfPages({
    header: {
        registerSlug: 'CASH',
        accountLabel: '[1001] Cash-HQ — Cash-HQ',
        from: '2026-08-31',
        to: '2026-09-15',
        currencyCode: 'SAR',
    },
    summary: {
        openingBalance: 3434.75,
        totalReceipts: 3246.34,
        totalPayments: 0,
        closingBalance: 6681.09,
    },
    lines: [
        {
            entryDate: '2026-09-08',
            coaCode: '1001',
            coaName: 'Cash-HQ',
            accountName: 'Cash-HQ',
            counterpartyLabel: 'Madar Randa Contracting Establishment مؤسسة مدار رندا للمقاولات',
            offsetAccountLabel: 'Corporate bill BILL-0018-20260601-001',
            description: 'Received from Madar Randa Contracting Establishment مؤسسة مدار رندا للمقاولات',
            reference: 'JE0391',
            direction: 'in',
            amount: 3246.34,
            balance: 6681.09,
        },
    ],
});

assert.equal(registerPages.length, 1);
assert.ok(registerPages[0].includes('Cash Register Statement'));
assert.ok(registerPages[0].includes('كشف الصندوق النقدي'));
assert.ok(registerPages[0].includes('Filter Car Services'));
assert.ok(registerPages[0].includes('فلتر لخدمات السيارات'));
assert.ok(registerPages[0].includes('الرصيد الافتتاحي'));
assert.ok(registerPages[0].includes('المستلم / المدفوع له'));
assert.ok(registerPages[0].includes('class="td-ar"'));
assert.ok(registerPages[0].includes('مؤسسة مدار رندا للمقاولات'));
assert.ok(registerPages[0].includes('Madar Randa Contracting Establishment'));
assert.ok(!registerPages[0].includes('unicode-bidi:plaintext'));
assert.ok(!/td-en">[^<]*مؤسسة/.test(registerPages[0]));
assert.ok(registerPages[0].includes('meta-val">31 Aug 2026'));
assert.ok(!registerPages[0].includes('Period / الفترة'));
assert.ok(!registerPages[0].includes('j-pQ0jE7v0Paja0'));

const stacked = stackedNameHtml(
    '[1129] Bin Zoma International Trading and Development Company Limited شركة بن زومه للتجارة الدولية و الإنماء المحدودة',
    { enClass: 'party-en', arClass: 'party-ar' },
);
assert.ok(stacked.includes('class="party-en"'));
assert.ok(stacked.includes('class="party-ar-wrap"'));
assert.ok(stacked.includes('class="party-ar"'));
assert.ok(stacked.includes('<span class="party-ar">'));
assert.ok(stacked.includes('Bin Zoma International Trading and Development Company Limited'));
assert.ok(stacked.includes('شركة بن زومه للتجارة الدولية و الإنماء المحدودة'));
assert.ok(!stacked.includes('|'));
assert.ok(
    stacked.indexOf('class="party-en"') < stacked.indexOf('class="party-ar"'),
    'English party line must wrap above Arabic',
);

const letterheadPages = buildGenericLedgerPdfPages({
    letterhead: true,
    brand: 'FILTER',
    sellerName: 'Filter Car Services',
    sellerNameAr: 'فلتر لخدمات السيارات',
    scopeName: 'Platform HQ',
    sellerVat: '311120967500003',
    title: '[1129] Bin Zoma International Trading and Development Company Limited شركة بن زومه للتجارة الدولية و الإنماء المحدودة',
    metaHtml: `Contact:<br/>${stackedNameHtml(
        'Bin Zoma International Trading and Development Company Limited شركة بن زومه للتجارة الدولية و الإنماء المحدودة',
        { enClass: 'meta-en', arClass: 'meta-ar' },
    )}`,
    columns: [{ label: 'Date' }, { label: 'Description' }, { label: 'Debit', num: true }],
    dataRows: [
        [
            { text: '2026-09-15' },
            { text: 'test receiving super admin' },
            { html: '156.00', className: 'num' },
        ],
    ],
    generated: 'Generated',
});
assert.equal(letterheadPages.length, 1);
assert.ok(letterheadPages[0].includes('class="hdr-letter"'));
assert.ok(letterheadPages[0].includes('class="hdr-party"'));
assert.ok(letterheadPages[0].includes('class="hdr-scope"'));
assert.ok(letterheadPages[0].includes('Statement of Account'));
assert.ok(letterheadPages[0].includes('كشف حساب'));
assert.ok(letterheadPages[0].includes('Bin Zoma International Trading and Development Company Limited'));
assert.ok(letterheadPages[0].includes('شركة بن زومه للتجارة الدولية و الإنماء المحدودة'));
assert.ok(letterheadPages[0].includes('Headquarters'));
assert.ok(letterheadPages[0].includes('class="party-ar-wrap"'));
assert.ok(letterheadPages[0].includes('class="stmt-title-ar-wrap"'));
assert.ok(letterheadPages[0].includes('class="meta-ar-wrap"'));
assert.ok(letterheadPages[0].includes('party-ar-wrap'));
assert.ok(letterheadPages[0].includes('text-align:left'));
assert.ok(letterheadPages[0].includes('grid-template-columns'));
assert.ok(!letterheadPages[0].includes('width:fit-content'));
assert.ok(!letterheadPages[0].includes('>Platform HQ<'));
assert.ok(letterheadPages[0].includes('Filter Car Services'));
assert.ok(letterheadPages[0].includes('فلتر لخدمات السيارات'));
assert.ok(letterheadPages[0].includes('class="party-en"'));
assert.ok(letterheadPages[0].includes('class="party-ar"'));
assert.ok(!letterheadPages[0].includes('title-sep'));
assert.ok(
    letterheadPages[0].indexOf('hdr-party') < letterheadPages[0].indexOf('hdr-scope'),
    'Party column stays on the opposite side from FILTER / platform',
);
assert.ok(
    letterheadPages[0].indexOf('class="party-en"') < letterheadPages[0].indexOf('class="party-ar"'),
);

const workshopLetterhead = buildGenericLedgerPdfPages({
    letterhead: true,
    brand: 'FILTER',
    scopeName: 'Al Basateen Branch',
    title: 'Kadarat Plus Information Technology شركة كدرات بلس لتقنية المعلومات',
    columns: [{ label: 'Date' }],
    dataRows: [[{ text: '2026-02-11' }]],
    generated: 'Generated',
});
assert.ok(workshopLetterhead[0].includes('Al Basateen Branch'));
assert.ok(workshopLetterhead[0].includes('Kadarat Plus Information Technology'));
assert.ok(workshopLetterhead[0].includes('شركة كدرات بلس لتقنية المعلومات'));
assert.ok(
    workshopLetterhead[0].indexOf('Kadarat Plus Information Technology')
        < workshopLetterhead[0].indexOf('شركة كدرات بلس لتقنية المعلومات'),
);

console.log('ledger bilingual pdf html tests ok');
