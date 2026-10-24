import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { formatLedgerDateCell } from './accountLedgerStatementUtils';
import {
    buildGenericLedgerPdfPages,
    stackedNameHtml,
    escapePdfHtml,
    exportHtmlPagesToPdf,
} from './bilingualHtmlPdf';

const fmtMoney = (v) =>
    Number(v ?? 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

function buildFileBase({ header }) {
    const safe = (s) => String(s || '').replace(/[^\w-]+/g, '_').replace(/_+/g, '_');
    const supplier = safe(header?.supplierName || 'supplier');
    const range =
        header?.from && header?.to
            ? `${header.from}_to_${header.to}`
            : header?.from
              ? `from_${header.from}`
              : header?.to
                ? `to_${header.to}`
                : 'all';
    return `Supplier_Ledger_${supplier}_${range}`;
}

function supplierTypeLabel(type) {
    return type === 'affiliated' ? 'Affiliated' : 'Non-Affiliated';
}

function moneyCell(v, show) {
    return {
        html: show ? escapePdfHtml(fmtMoney(v)) : '',
        className: 'num',
    };
}

function textCell(v) {
    return { text: v };
}

/**
 * Professional bilingual PDF (Noto Arabic) — same letterhead as COA / corporate statements.
 * Do not use jsPDF Helvetica for party names (Arabic becomes mojibake).
 */
export async function exportSupplierLedgerPdf({
    header,
    openingBalance,
    rows,
    totals,
}) {
    const typeLabel = supplierTypeLabel(header?.type);
    const partyTitle = header?.supplierName
        ? `${header.supplierName} (${typeLabel})`
        : `Supplier (${typeLabel})`;
    const accountLabel = header?.accountCode
        ? `[${header.accountCode}] ${header.accountName || ''}`.trim()
        : header?.accountName || '';
    const scopeName = header?.workshopName || '';
    const currency = header?.currencyCode || 'SAR';

    const columns = [
        { label: 'Date', labelAr: 'التاريخ' },
        { label: 'Description', labelAr: 'البيان' },
        { label: 'Reference', labelAr: 'المرجع' },
        { label: 'Debit', labelAr: 'مدين', num: true },
        { label: 'Credit', labelAr: 'دائن', num: true },
        { label: 'Balance', labelAr: 'الرصيد', num: true },
    ];

    const dataRows = (rows ?? []).map((r) => [
        textCell(r.date || formatLedgerDateCell(r) || '—'),
        textCell(r.description || '—'),
        textCell(r.reference || ''),
        moneyCell(r.debit, Number(r.debit) > 0),
        moneyCell(r.credit, Number(r.credit) > 0),
        moneyCell(r.runningBalance, true),
    ]);

    const openingCells = [
        textCell('—'),
        textCell('Opening balance'),
        textCell(''),
        moneyCell(0, false),
        moneyCell(0, false),
        moneyCell(openingBalance, true),
    ];
    const closingCells = [
        textCell(''),
        textCell('Totals / Closing'),
        textCell(''),
        moneyCell(totals?.totalDebit, true),
        moneyCell(totals?.totalCredit, true),
        moneyCell(totals?.closingBalance, true),
    ];

    const metaHtml = [
        `Supplier type: ${escapePdfHtml(typeLabel)}`,
        header?.branchName ? `Branch: ${escapePdfHtml(header.branchName)}` : null,
        header?.vatNumber ? `VAT No.: ${escapePdfHtml(header.vatNumber)}` : null,
        header?.phone ? `Tel.: ${escapePdfHtml(header.phone)}` : null,
        header?.contactPerson || header?.email
            ? `Contact:<br/>${stackedNameHtml(header.contactPerson || header.email, { enClass: 'meta-en', arClass: 'meta-ar' })}`
            : null,
        accountLabel ? `Account: ${escapePdfHtml(accountLabel)}` : null,
        `Period: ${escapePdfHtml(header?.from || '—')} to ${escapePdfHtml(header?.to || '—')}`,
        `Currency: ${escapePdfHtml(currency)}`,
    ]
        .filter(Boolean)
        .join('<br/>');

    const pages = buildGenericLedgerPdfPages({
        letterhead: true,
        brand: 'FILTER',
        sellerName: 'Filter Car Services',
        scopeName,
        sellerVat: header?.sellerVatNumber || header?.workshopVatNumber || '',
        title: partyTitle,
        statementTitleEn: 'Supplier Ledger Statement',
        statementTitleAr: 'كشف حساب المورد',
        metaHtml,
        columns,
        dataRows,
        openingCells,
        closingCells,
        rowsPerPage: 18,
        generated: `Generated ${new Date().toLocaleString()} · FILTER`,
    });

    await exportHtmlPagesToPdf({
        fileName: `${buildFileBase({ header })}.pdf`,
        orientation: 'portrait',
        pages,
    });
}

/** Export the same ledger to .xlsx with professional letterhead rows. */
export function exportSupplierLedgerExcel({
    header,
    openingBalance,
    rows,
    totals,
}) {
    const typeLabel = supplierTypeLabel(header?.type);
    const aoa = [
        ['FILTER · Filter Car Services'],
        ['Statement of Account / كشف حساب'],
        ['Supplier Ledger Statement'],
        [],
        ['Supplier', header?.supplierName || ''],
        ['Type', typeLabel],
        ['Workshop', header?.workshopName || ''],
        ['Branch', header?.branchName || ''],
        ['VAT No.', header?.vatNumber || ''],
        ['Phone', header?.phone || ''],
        ['Contact', header?.contactPerson || header?.email || ''],
        ...(header?.accountCode
            ? [['Account', `[${header.accountCode}] ${header.accountName || ''}`.trim()]]
            : []),
        ['Period', `${header?.from || '—'}  to  ${header?.to || '—'}`],
        ['Currency', header?.currencyCode || 'SAR'],
        [],
        ['Date', 'Description', 'Reference', 'Debit', 'Credit', 'Balance'],
        ['—', 'Opening balance', '', '', '', Number(openingBalance ?? 0)],
        ...rows.map((r) => [
            r.date,
            r.description || '',
            r.reference || '',
            r.debit > 0 ? Number(r.debit) : '',
            r.credit > 0 ? Number(r.credit) : '',
            Number(r.runningBalance ?? 0),
        ]),
        [
            '',
            'Totals / Closing',
            '',
            Number(totals?.totalDebit ?? 0),
            Number(totals?.totalCredit ?? 0),
            Number(totals?.closingBalance ?? 0),
        ],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [
        { wch: 14 },
        { wch: 48 },
        { wch: 18 },
        { wch: 14 },
        { wch: 14 },
        { wch: 16 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ledger');
    XLSX.writeFile(wb, `${buildFileBase({ header })}.xlsx`);
}

function buildCustomerFileBase({ header }) {
    const safe = (s) => String(s || '').replace(/[^\w-]+/g, '_').replace(/_+/g, '_');
    const customer = safe(header?.customerName || 'customer');
    const range =
        header?.from && header?.to
            ? `${header.from}_to_${header.to}`
            : header?.from
              ? `from_${header.from}`
              : header?.to
                ? `to_${header.to}`
                : 'all';
    return `Customer_Ledger_${customer}_${range}`;
}

/** Export a customer AR ledger to bilingual PDF (letterhead). */
export async function exportCustomerLedgerPdf({
    header,
    openingBalance,
    rows,
    totals,
}) {
    const partyTitle = header?.customerName || 'Customer';
    const scopeName = header?.companyName || header?.workshopName || '';
    const currency = header?.currencyCode || 'SAR';

    const columns = [
        { label: 'Date', labelAr: 'التاريخ' },
        { label: 'Description', labelAr: 'البيان' },
        { label: 'Reference', labelAr: 'المرجع' },
        { label: 'Debit', labelAr: 'مدين', num: true },
        { label: 'Credit', labelAr: 'دائن', num: true },
        { label: 'Balance', labelAr: 'الرصيد', num: true },
    ];

    const dataRows = (rows ?? []).map((r) => [
        textCell(r.date || '—'),
        textCell(r.description || '—'),
        textCell(r.reference || ''),
        moneyCell(r.debit, Number(r.debit) > 0),
        moneyCell(r.credit, Number(r.credit) > 0),
        moneyCell(r.runningBalance, true),
    ]);

    const pages = buildGenericLedgerPdfPages({
        letterhead: true,
        brand: 'FILTER',
        sellerName: 'Filter Car Services',
        scopeName,
        title: partyTitle,
        statementTitleEn: 'Customer Ledger Statement',
        statementTitleAr: 'كشف حساب العميل',
        metaHtml: [
            `Period: ${escapePdfHtml(header?.from || '—')} to ${escapePdfHtml(header?.to || '—')}`,
            `Currency: ${escapePdfHtml(currency)}`,
        ].join('<br/>'),
        columns,
        dataRows,
        openingCells: [
            textCell('—'),
            textCell('Opening balance'),
            textCell(''),
            moneyCell(0, false),
            moneyCell(0, false),
            moneyCell(openingBalance, true),
        ],
        closingCells: [
            textCell(''),
            textCell('Totals / Closing'),
            textCell(''),
            moneyCell(totals?.totalDebit, true),
            moneyCell(totals?.totalCredit, true),
            moneyCell(totals?.closingBalance, true),
        ],
        rowsPerPage: 18,
        generated: `Generated ${new Date().toLocaleString()} · FILTER`,
    });

    await exportHtmlPagesToPdf({
        fileName: `${buildCustomerFileBase({ header })}.pdf`,
        orientation: 'portrait',
        pages,
    });
}

/** Export a customer AR ledger to Excel. */
export function exportCustomerLedgerExcel({ header, openingBalance, rows, totals }) {
    const customerLabel = header?.customerName || 'Customer';
    const aoa = [
        ['FILTER · Filter Car Services'],
        ['Statement of Account / كشف حساب'],
        [customerLabel],
        ['Customer Ledger Statement'],
        [],
        ['Ledger account', customerLabel],
        ['Period', `${header?.from || '—'}  to  ${header?.to || '—'}`],
        ['Currency', header?.currencyCode || 'SAR'],
        [],
        ['Date', 'Description', 'Reference', 'Debit', 'Credit', 'Balance'],
        ['—', 'Opening balance', '', '', '', Number(openingBalance ?? 0)],
        ...rows.map((r) => [
            r.date,
            r.description || '',
            r.reference || '',
            r.debit > 0 ? Number(r.debit) : '',
            r.credit > 0 ? Number(r.credit) : '',
            Number(r.runningBalance ?? 0),
        ]),
        [
            '',
            'Totals / Closing',
            '',
            Number(totals?.totalDebit ?? 0),
            Number(totals?.totalCredit ?? 0),
            Number(totals?.closingBalance ?? 0),
        ],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [
        { wch: 14 },
        { wch: 48 },
        { wch: 18 },
        { wch: 14 },
        { wch: 14 },
        { wch: 16 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ledger');
    XLSX.writeFile(wb, `${buildCustomerFileBase({ header })}.xlsx`);
}


function buildAccountFileBase({ header }) {
    const safe = (s) => String(s || '').replace(/[^\w-]+/g, '_').replace(/_+/g, '_');
    const account = safe(`${header?.accountCode || ''}_${header?.accountName || 'account'}`);
    const range =
        header?.from && header?.to
            ? `${header.from}_to_${header.to}`
            : header?.from
              ? `from_${header.from}`
              : header?.to
                ? `to_${header.to}`
                : 'all';
    return `Account_Ledger_${account}_${range}`;
}

function accountLedgerHasCashColumns(rows) {
    return (rows ?? []).some((r) => r.counterpartyLabel || r.offsetAccountLabel);
}

function accountLedgerHasPettyCashColumns(rows) {
    return (rows ?? []).some((r) => r.walletUserLabel || r.expenseCategoryLabel);
}

function accountLedgerColumnMode(rows) {
    if (accountLedgerHasPettyCashColumns(rows)) return 'pettyCash';
    if (accountLedgerHasCashColumns(rows)) return 'cash';
    return 'basic';
}

/** Export a Chart of Accounts ledger statement to PDF. */
export async function exportAccountLedgerPdf({ header, openingBalance, rows, totals }) {
    const accountLabel = header?.accountCode
        ? `[${header.accountCode}] ${header.accountName || ''}`
        : header?.accountName || 'Account';
    const colMode = accountLedgerColumnMode(rows);
    const hasCashCols = colMode === 'cash';
    const hasPettyCols = colMode === 'pettyCash';
    const brand = 'FILTER';
    const currency = header?.currencyCode || 'SAR';
    const scopeName = header?.workshopName || header?.companyName || '';
    const partyTitle = (() => {
        const raw = header?.partyName || header?.partyLabel || header?.accountName || accountLabel;
        const code = header?.accountCode;
        if (code && raw && !String(raw).includes(String(code))) {
            return `[${code}] ${raw}`;
        }
        return raw || accountLabel;
    })();
    const sellerName =
        header?.sellerName && header.sellerName !== scopeName
            ? header.sellerName
            : 'Filter Car Services';

    const columns = hasPettyCols
        ? [
              { label: 'Date' },
              { label: 'Wallet user / employee' },
              { label: 'Expense category' },
              { label: 'Description' },
              { label: 'Reference' },
              { label: 'Debit', num: true },
              { label: 'Credit', num: true },
              { label: 'Balance', num: true },
          ]
        : hasCashCols
          ? [
                { label: 'Date' },
                { label: 'Paid to / Received from' },
                { label: 'Expense / AR account' },
                { label: 'Description' },
                { label: 'Reference' },
                { label: 'Debit', num: true },
                { label: 'Credit', num: true },
                { label: 'Balance', num: true },
            ]
          : [
                { label: 'Date' },
                { label: 'Description' },
                { label: 'Reference' },
                { label: 'Debit', num: true },
                { label: 'Credit', num: true },
                { label: 'Balance', num: true },
            ];

    const moneyCell = (v, show) => ({
        html: show ? escapePdfHtml(fmtMoney(v)) : '',
        className: 'num',
    });
    const textCell = (v) => ({ text: v });

    const dataRows = (rows ?? []).map((r) =>
        hasPettyCols
            ? [
                  textCell(formatLedgerDateCell(r)),
                  textCell(r.walletUserLabel),
                  textCell(r.expenseCategoryLabel),
                  textCell(r.description),
                  textCell(r.reference),
                  moneyCell(r.debit, r.debit > 0),
                  moneyCell(r.credit, r.credit > 0),
                  moneyCell(r.runningBalance, true),
              ]
            : hasCashCols
              ? [
                    textCell(formatLedgerDateCell(r)),
                    textCell(r.counterpartyLabel),
                    textCell(r.offsetAccountLabel),
                    textCell(r.description),
                    textCell(r.reference),
                    moneyCell(r.debit, r.debit > 0),
                    moneyCell(r.credit, r.credit > 0),
                    moneyCell(r.runningBalance, true),
                ]
              : [
                    textCell(formatLedgerDateCell(r)),
                    textCell(r.description),
                    textCell(r.reference),
                    moneyCell(r.debit, r.debit > 0),
                    moneyCell(r.credit, r.credit > 0),
                    moneyCell(r.runningBalance, true),
                ],
    );

    const blank = (n) => Array.from({ length: n }, () => textCell(''));
    const openingCells = hasPettyCols || hasCashCols
        ? [
              textCell('—'),
              textCell('Opening balance'),
              ...blank(5),
              moneyCell(openingBalance, true),
          ]
        : [
              textCell('—'),
              textCell('Opening balance'),
              textCell(''),
              ...blank(2),
              moneyCell(openingBalance, true),
          ];
    const closingCells = hasPettyCols || hasCashCols
        ? [
              textCell(''),
              textCell(''),
              textCell(''),
              textCell('Totals'),
              textCell(''),
              moneyCell(totals?.totalDebit, true),
              moneyCell(totals?.totalCredit, true),
              moneyCell(totals?.closingBalance, true),
          ]
        : [
              textCell(''),
              textCell('Totals'),
              textCell(''),
              moneyCell(totals?.totalDebit, true),
              moneyCell(totals?.totalCredit, true),
              moneyCell(totals?.closingBalance, true),
          ];

    const metaHtml = [
        header?.vatNumber ? `VAT No.: ${escapePdfHtml(header.vatNumber)}` : null,
        header?.crNumber ? `CR No.: ${escapePdfHtml(header.crNumber)}` : null,
        header?.contactPerson ? `Contact:<br/>${stackedNameHtml(header.contactPerson, { enClass: 'meta-en', arClass: 'meta-ar' })}` : null,
        header?.partyPhone ? `Tel.: ${escapePdfHtml(header.partyPhone)}` : null,
        header?.partyAddress ? `Address:<br/>${stackedNameHtml(header.partyAddress, { enClass: 'meta-en', arClass: 'meta-ar' })}` : null,
        header?.accountType ? `Account type: ${escapePdfHtml(header.accountType)}` : null,
        `Period: ${escapePdfHtml(header?.from || '—')} to ${escapePdfHtml(header?.to || '—')}`,
        header?.expenseCategory ? `Expense category: ${escapePdfHtml(header.expenseCategory)}` : null,
        `Currency: ${escapePdfHtml(currency)}`,
    ]
        .filter(Boolean)
        .join('<br/>');

    const pages = buildGenericLedgerPdfPages({
        letterhead: true,
        brand,
        sellerName,
        scopeName,
        sellerVat: header?.sellerVatNumber || '',
        title: partyTitle,
        metaHtml,
        columns,
        dataRows,
        openingCells,
        closingCells,
        rowsPerPage: hasPettyCols || hasCashCols ? 14 : 18,
        generated: `Generated ${new Date().toLocaleString()} · FILTER`,
    });

    await exportHtmlPagesToPdf({
        fileName: `${buildAccountFileBase({ header })}.pdf`,
        orientation: 'portrait',
        pages,
    });
}

/** Export a Chart of Accounts ledger statement to Excel. */
export function exportAccountLedgerExcel({ header, openingBalance, rows, totals }) {
    const accountLabel = header?.accountCode
        ? `[${header.accountCode}] ${header.accountName || ''}`
        : header?.accountName || 'Account';
    const colMode = accountLedgerColumnMode(rows);
    const hasCashCols = colMode === 'cash';
    const hasPettyCols = colMode === 'pettyCash';
    const aoa = [
        ['FILTER · Filter Car Services'],
        ['Statement of Account / كشف حساب'],
        [header?.companyName || 'Supplier'],
        [accountLabel],
        ['Account Ledger Statement'],
        [],
        ...(header?.sellerVatNumber ? [['Seller VAT No.', header.sellerVatNumber]] : []),
        ...(header?.vatNumber ? [['VAT No.', header.vatNumber]] : []),
        ...(header?.crNumber ? [['CR No.', header.crNumber]] : []),
        ...(header?.contactPerson ? [['Contact', header.contactPerson]] : []),
        ...(header?.partyPhone ? [['Phone', header.partyPhone]] : []),
        ...(header?.partyAddress ? [['Address', header.partyAddress]] : []),
        ['Ledger account', accountLabel],
        ['Account type', header?.accountType || ''],
        ['Period', `${header?.from || '—'}  to  ${header?.to || '—'}`],
        ['Currency', header?.currencyCode || 'SAR'],
        ...(header?.expenseCategory ? [['Expense category', header.expenseCategory]] : []),
        [],
        ...(hasPettyCols
            ? [
                  [
                      'Date',
                      'Wallet user / employee',
                      'Expense category',
                      'Description',
                      'Reference',
                      'Debit',
                      'Credit',
                      'Balance',
                  ],
                  ['—', 'Opening balance', '', '', '', '', '', Number(openingBalance ?? 0)],
                  ...rows.map((r) => [
                      formatLedgerDateCell(r),
                      r.walletUserLabel || '',
                      r.expenseCategoryLabel || '',
                      r.description || '',
                      r.reference || '',
                      r.debit > 0 ? Number(r.debit) : '',
                      r.credit > 0 ? Number(r.credit) : '',
                      Number(r.runningBalance ?? 0),
                  ]),
                  [
                      '',
                      '',
                      '',
                      'Totals',
                      '',
                      Number(totals?.totalDebit ?? 0),
                      Number(totals?.totalCredit ?? 0),
                      Number(totals?.closingBalance ?? 0),
                  ],
              ]
            : hasCashCols
              ? [
                  [
                      'Date',
                      'Paid to / Received from',
                      'Expense / AR account',
                      'Description',
                      'Reference',
                      'Debit',
                      'Credit',
                      'Balance',
                  ],
                  ['—', 'Opening balance', '', '', '', '', '', Number(openingBalance ?? 0)],
                  ...rows.map((r) => [
                      formatLedgerDateCell(r),
                      r.counterpartyLabel || '',
                      r.offsetAccountLabel || '',
                      r.description || '',
                      r.reference || '',
                      r.debit > 0 ? Number(r.debit) : '',
                      r.credit > 0 ? Number(r.credit) : '',
                      Number(r.runningBalance ?? 0),
                  ]),
                  [
                      '',
                      '',
                      '',
                      'Totals',
                      '',
                      Number(totals?.totalDebit ?? 0),
                      Number(totals?.totalCredit ?? 0),
                      Number(totals?.closingBalance ?? 0),
                  ],
              ]
            : [
                  ['Date', 'Description', 'Reference', 'Debit', 'Credit', 'Balance'],
                  ['—', 'Opening balance', '', '', '', Number(openingBalance ?? 0)],
                  ...rows.map((r) => [
                      formatLedgerDateCell(r),
                      r.description || '',
                      r.reference || '',
                      r.debit > 0 ? Number(r.debit) : '',
                      r.credit > 0 ? Number(r.credit) : '',
                      Number(r.runningBalance ?? 0),
                  ]),
                  [
                      '',
                      'Totals',
                      '',
                      Number(totals?.totalDebit ?? 0),
                      Number(totals?.totalCredit ?? 0),
                      Number(totals?.closingBalance ?? 0),
                  ],
              ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = hasPettyCols || hasCashCols
        ? [
              { wch: 14 },
              { wch: 26 },
              { wch: 22 },
              { wch: 36 },
              { wch: 16 },
              { wch: 12 },
              { wch: 12 },
              { wch: 14 },
          ]
        : [
              { wch: 14 },
              { wch: 42 },
              { wch: 18 },
              { wch: 14 },
              { wch: 14 },
              { wch: 16 },
          ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ledger');
    XLSX.writeFile(wb, `${buildAccountFileBase({ header })}.xlsx`);
}

function buildVatFileBase({ header }) {
    const range =
        header?.from && header?.to
            ? `${header.from}_to_${header.to}`
            : header?.from
              ? `from_${header.from}`
              : header?.to
                ? `to_${header.to}`
                : 'all';
    return `VAT_Report_${range}`;
}

/** Export VAT report to PDF. */
export function exportVatReportPdf({
    header,
    openingPayable,
    rows,
    totals,
    vatPayableAccount,
}) {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const margin = 32;
    let cursorY = margin;

    const accountLabel = vatPayableAccount?.code
        ? `[${vatPayableAccount.code}] ${vatPayableAccount.name || ''}`
        : 'VAT Payable to ZATCA';

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(header?.companyName || 'Company', margin, cursorY + 16);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(accountLabel, margin, cursorY + 38);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('VAT Calculation', margin, cursorY + 58);

    cursorY += 78;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const lines = [
        `Period: ${header?.from || '—'}  to  ${header?.to || '—'}`,
        `Currency: ${header?.currencyCode || 'SAR'}`,
        `Opening payable: ${fmtMoney(openingPayable ?? 0)}`,
        totals
            ? `Sales incl VAT: ${fmtMoney(totals.totalSaleInclVat)}   Purchases incl VAT: ${fmtMoney(totals.totalPurchaseInclVat)}   Output: ${fmtMoney(totals.totalVatOutput)}   Input: ${fmtMoney(totals.totalVatInput)}   Net change: ${fmtMoney(totals.periodNetChange ?? totals.payableToZatca)}   Closing payable: ${fmtMoney(totals.closingPayable ?? totals.payableToZatca)}`
            : null,
    ].filter(Boolean);
    lines.forEach((line, i) => {
        doc.text(line, margin, cursorY + i * 14);
    });
    cursorY += lines.length * 14 + 8;

    const body = [
        ['—', '—', 'Opening balance', '', '', '', '', fmtMoney(openingPayable ?? 0)],
        ...rows.map((r) => [
            r.date,
            r.reference || '',
            r.description || '',
            r.saleInclVat > 0 ? fmtMoney(r.saleInclVat) : '',
            r.purchaseInclVat > 0 ? fmtMoney(r.purchaseInclVat) : '',
            r.vatOutput > 0 ? fmtMoney(r.vatOutput) : '',
            r.vatInput > 0 ? fmtMoney(r.vatInput) : '',
            fmtMoney(r.payableToZatca),
        ]),
        totals
            ? [
                  '',
                  '',
                  'Closing summary',
                  fmtMoney(totals.totalSaleInclVat),
                  fmtMoney(totals.totalPurchaseInclVat),
                  fmtMoney(totals.totalVatOutput),
                  fmtMoney(totals.totalVatInput),
                  fmtMoney(totals.closingPayable ?? totals.payableToZatca),
              ]
            : [],
    ].filter((row) => row.length > 0);

    autoTable(doc, {
        startY: cursorY,
        head: [[
            'Date',
            'Reference',
            'Description',
            'Sale incl VAT',
            'Purchase incl VAT',
            'VAT Output',
            'VAT Input',
            'Payable to ZATCA',
        ]],
        body,
        margin: { left: margin, right: margin },
        styles: { fontSize: 7, cellPadding: 3 },
        headStyles: { fillColor: [241, 245, 249], textColor: 30 },
        columnStyles: {
            0: { cellWidth: 52 },
            1: { cellWidth: 58 },
            2: { cellWidth: 'auto' },
            3: { cellWidth: 52, halign: 'right' },
            4: { cellWidth: 52, halign: 'right' },
            5: { cellWidth: 48, halign: 'right' },
            6: { cellWidth: 48, halign: 'right' },
            7: { cellWidth: 58, halign: 'right' },
        },
        didParseCell(data) {
            const first = data.row.index === 0;
            const last = data.row.index === body.length - 1;
            if (first || last) {
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.fillColor = first ? [248, 250, 252] : [255, 247, 237];
            }
        },
    });

    doc.save(`${buildVatFileBase({ header })}.pdf`);
}

/** Export VAT report to Excel. */
export function exportVatReportExcel({
    header,
    openingPayable,
    rows,
    totals,
    vatPayableAccount,
}) {
    const accountLabel = vatPayableAccount?.code
        ? `[${vatPayableAccount.code}] ${vatPayableAccount.name || ''}`
        : 'VAT Payable to ZATCA';
    const aoa = [
        [header?.companyName || 'Company'],
        [accountLabel],
        ['VAT Calculation'],
        [],
        ['Ledger account', accountLabel],
        ['Period', `${header?.from || '—'}  to  ${header?.to || '—'}`],
        ['Currency', header?.currencyCode || 'SAR'],
        [],
        ['Date', 'Reference', 'Description', 'Sale incl VAT', 'Purchase incl VAT', 'VAT Output', 'VAT Input', 'Payable to ZATCA'],
        ['—', '—', 'Opening balance', '', '', '', '', Number(openingPayable ?? 0)],
        ...rows.map((r) => [
            r.date,
            r.reference || '',
            r.description || '',
            r.saleInclVat !== 0 ? Number(r.saleInclVat) : '',
            r.purchaseInclVat !== 0 ? Number(r.purchaseInclVat) : '',
            r.vatOutput !== 0 ? Number(r.vatOutput) : '',
            r.vatInput !== 0 ? Number(r.vatInput) : '',
            Number(r.payableToZatca ?? 0),
        ]),
        totals
            ? [
                  '',
                  '',
                  'Closing summary',
                  Number(totals.totalSaleInclVat ?? 0),
                  Number(totals.totalPurchaseInclVat ?? 0),
                  Number(totals.totalVatOutput ?? 0),
                  Number(totals.totalVatInput ?? 0),
                  Number(totals.closingPayable ?? totals.payableToZatca ?? 0),
              ]
            : [],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [
        { wch: 12 },
        { wch: 14 },
        { wch: 40 },
        { wch: 14 },
        { wch: 14 },
        { wch: 12 },
        { wch: 12 },
        { wch: 16 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'VAT');
    XLSX.writeFile(wb, `${buildVatFileBase({ header })}.xlsx`);
}
