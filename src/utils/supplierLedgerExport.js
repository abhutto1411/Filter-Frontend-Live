import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { formatLedgerDateCell } from './accountLedgerStatementUtils';
import {
    buildGenericLedgerPdfPages,
    stackedNameHtml,
    escapePdfHtml,
    exportHtmlPagesToPdf,
    wrapStmtPage,
    bilingualHeaderCell,
    pdfCellHtml,
    chunkRows,
} from './bilingualHtmlPdf';
import { riyalSvg } from './supplierTrialBalanceExport';

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

    const sellerName =
        header?.sellerName || header?.companyName || scopeName || '';
    const pages = buildGenericLedgerPdfPages({
        letterhead: true,
        brand: 'FILTER',
        sellerName,
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
    const sellerLabel = header?.sellerName || header?.companyName || header?.workshopName || '';
    const aoa = [
        [sellerLabel ? `FILTER · ${sellerLabel}` : 'FILTER'],
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

    const sellerName =
        header?.sellerName || header?.companyName || scopeName || '';
    const pages = buildGenericLedgerPdfPages({
        letterhead: true,
        brand: 'FILTER',
        sellerName,
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
    const sellerLabel = header?.sellerName || header?.companyName || header?.workshopName || '';
    const aoa = [
        [sellerLabel ? `FILTER · ${sellerLabel}` : 'FILTER'],
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

/** Export a Chart of Accounts ledger statement to PDF (every row passed in — no cap). */
export async function exportAccountLedgerPdf({ header, openingBalance, rows, totals, riyalSymbol = false }) {
    // SP-09: supplier portal passes riyalSymbol → official SAMA Riyal mark next to the currency.
    const riyalMark = riyalSymbol
        ? `<span style="display:inline-flex;vertical-align:middle;margin-inline-end:3px">${await riyalSvg()}</span>`
        : '';
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
        header?.sellerName || header?.companyName || scopeName || '';

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
        `Currency: ${riyalMark}${escapePdfHtml(currency)}`,
        riyalSymbol ? `Lines: ${escapePdfHtml(String((rows ?? []).length))}` : null,
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

/** Export a Chart of Accounts ledger statement to Excel (every row passed in — no cap). */
export function exportAccountLedgerExcel({ header, openingBalance, rows, totals, riyalSymbol = false }) {
    // SP-09: U+20C1 SAUDI RIYAL SIGN on amount headers when requested (supplier portal).
    const amt = (label) => (riyalSymbol ? `${label} (⃁)` : label);
    const accountLabel = header?.accountCode
        ? `[${header.accountCode}] ${header.accountName || ''}`
        : header?.accountName || 'Account';
    const colMode = accountLedgerColumnMode(rows);
    const hasCashCols = colMode === 'cash';
    const hasPettyCols = colMode === 'pettyCash';
    const sellerLabel = header?.sellerName || header?.companyName || '';
    const aoa = [
        [sellerLabel ? `FILTER · ${sellerLabel}` : 'FILTER'],
        ['Statement of Account / كشف حساب'],
        [header?.companyName || sellerLabel || 'Supplier'],
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
                      amt('Debit'),
                      amt('Credit'),
                      amt('Balance'),
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
                      amt('Debit'),
                      amt('Credit'),
                      amt('Balance'),
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
                  ['Date', 'Description', 'Reference', amt('Debit'), amt('Credit'), amt('Balance')],
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

/* ───────────────────────── SP-09 — General Ledger summary export ───────────────────────── */

const GL_RIYAL_SIGN = '⃁';
const GL_ROWS_PER_PAGE = 24;

function glRangeLabel(data) {
    return `${data?.dateFrom || '…'} – ${data?.dateTo || '…'} (Asia/Riyadh)`;
}

/** PDF of the General Ledger summary (every account row, multi-page). */
export async function exportSupplierGeneralLedgerPdf({ data, supplierName = '' }) {
    const rows = Array.isArray(data?.accounts) ? data.accounts : [];
    const svg = await riyalSvg();
    const money = (v) =>
        `<span style="display:inline-flex;align-items:center;gap:3px;direction:ltr">${svg}<span>${escapePdfHtml(fmtMoney(v))}</span></span>`;
    const showOpening = Boolean(data?.dateFrom);
    const head = `<tr>
        <th style="width:8%">${bilingualHeaderCell('Code', 'الرمز')}</th>
        <th>${bilingualHeaderCell('Account', 'الحساب')}</th>
        <th style="width:9%">${bilingualHeaderCell('Type', 'النوع')}</th>
        ${showOpening ? `<th class="num">${bilingualHeaderCell('Opening', 'الافتتاحي')}</th>` : ''}
        <th class="num">${bilingualHeaderCell('Period Dr', 'مدين الفترة')}</th>
        <th class="num">${bilingualHeaderCell('Period Cr', 'دائن الفترة')}</th>
        <th class="num">${bilingualHeaderCell('Closing', 'الختامي')}</th>
        <th class="num" style="width:6%">${bilingualHeaderCell('Lines', 'الأسطر')}</th>
    </tr>`;
    const tot = data?.totals || {};
    const totalsRow = `<tr class="close">
        <td></td><td>${bilingualHeaderCell('Totals', 'المجاميع')}</td><td></td>
        ${showOpening ? '<td></td>' : ''}
        <td class="num">${money(tot.periodDebit)}</td>
        <td class="num">${money(tot.periodCredit)}</td>
        <td></td>
        <td class="num">${escapePdfHtml(String(tot.lineCount ?? ''))}</td>
    </tr>`;
    const chk = data?.checks || {};
    const status = chk.periodBalanced && chk.matchesTrialBalance
        ? '<div class="meta" style="color:#065f46;font-weight:700">Period Dr = Period Cr = Trial balance / متوازن ومطابق لميزان المراجعة</div>'
        : `<div class="meta" style="color:#b91c1c;font-weight:700">Check: difference ${money(chk.periodDifference)} · TB Dr ${money(chk.tbPeriodDebit)} / Cr ${money(chk.tbPeriodCredit)}</div>`;
    const chunks = chunkRows(rows, GL_ROWS_PER_PAGE);
    const pages = chunks.map((chunk, i) => {
        const isLast = i === chunks.length - 1;
        const body = chunk
            .map(
                (r) => `<tr>
                    <td>${escapePdfHtml(r.code)}</td>
                    <td>${pdfCellHtml(r.name)}</td>
                    <td>${escapePdfHtml(r.type)}</td>
                    ${showOpening ? `<td class="num">${money(r.openingBalance)}</td>` : ''}
                    <td class="num">${money(r.periodDebit)}</td>
                    <td class="num">${money(r.periodCredit)}</td>
                    <td class="num">${money(r.closingBalance)}</td>
                    <td class="num">${escapePdfHtml(String(r.lineCount ?? 0))}</td>
                </tr>`,
            )
            .join('');
        return wrapStmtPage(`
            <div class="title-row">
                <div class="title-en">General Ledger</div>
                <div class="title-ar-wrap" style="text-align:center"><span class="title-ar">دفتر الأستاذ العام</span></div>
            </div>
            <div class="meta">${escapePdfHtml(supplierName)}${supplierName ? ' · ' : ''}${escapePdfHtml(glRangeLabel(data))} · Amounts in SAR (official Riyal) · closing on the account's normal side</div>
            <table class="grid"><thead>${head}</thead><tbody>${body}${isLast ? totalsRow : ''}</tbody></table>
            ${isLast ? status : ''}
            <div class="foot">FILTER · supplier ledger · read-only report</div>
        `);
    });
    await exportHtmlPagesToPdf({
        fileName: `general-ledger-${data?.dateFrom || 'all'}-${data?.dateTo || 'all'}.pdf`,
        orientation: 'landscape',
        pages,
    });
}

/** Excel of the General Ledger summary. */
export function exportSupplierGeneralLedgerExcel({ data }) {
    const rows = Array.isArray(data?.accounts) ? data.accounts : [];
    const showOpening = Boolean(data?.dateFrom);
    const num = (v) => Number(Number(v || 0).toFixed(2));
    const headers = [
        'Code / الرمز',
        'Account / الحساب',
        'Type / النوع',
        ...(showOpening ? [`Opening / الافتتاحي (${GL_RIYAL_SIGN})`] : []),
        `Period Dr / مدين الفترة (${GL_RIYAL_SIGN})`,
        `Period Cr / دائن الفترة (${GL_RIYAL_SIGN})`,
        `Closing / الختامي (${GL_RIYAL_SIGN})`,
        'Lines / الأسطر',
    ];
    const aoa = [
        headers,
        ...rows.map((r) => [
            r.code,
            r.name,
            r.type,
            ...(showOpening ? [num(r.openingBalance)] : []),
            num(r.periodDebit),
            num(r.periodCredit),
            num(r.closingBalance),
            Number(r.lineCount || 0),
        ]),
        [
            '',
            'Totals / المجاميع',
            '',
            ...(showOpening ? [''] : []),
            num(data?.totals?.periodDebit),
            num(data?.totals?.periodCredit),
            '',
            Number(data?.totals?.lineCount || 0),
        ],
        [],
        ['', `Range: ${glRangeLabel(data)}`],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'General Ledger');
    XLSX.writeFile(wb, `general-ledger-${data?.dateFrom || 'all'}-${data?.dateTo || 'all'}.xlsx`);
}

/* ───────────────────────── SP-10 — AR / AP aging export ───────────────────────── */

const AGING_COLS = [
    { key: 'current', en: 'Current', ar: 'غير مستحق' },
    { key: 'd1_30', en: '1–30', ar: '1–30' },
    { key: 'd31_60', en: '31–60', ar: '31–60' },
    { key: 'd61_90', en: '61–90', ar: '61–90' },
    { key: 'd90_plus', en: '90+', ar: '+90' },
];

function agingTitle(kind) {
    return kind === 'ap'
        ? { en: 'Aged Payables', ar: 'أعمار الذمم الدائنة' }
        : { en: 'Aged Receivables', ar: 'أعمار الذمم المدينة' };
}

/** PDF of the AR / AP aging (every party row, multi-page) with the GL tie-out line. */
export async function exportSupplierAgingPdf({ data, supplierName = '' }) {
    const rows = Array.isArray(data?.rows) ? data.rows : [];
    const svg = await riyalSvg();
    const money = (v) =>
        `<span style="display:inline-flex;align-items:center;gap:3px;direction:ltr">${svg}<span>${escapePdfHtml(fmtMoney(v))}</span></span>`;
    const title = agingTitle(data?.kind);
    const head = `<tr>
        <th>${bilingualHeaderCell(data?.kind === 'ap' ? 'Vendor' : 'Customer', data?.kind === 'ap' ? 'المورد' : 'العميل')}</th>
        ${AGING_COLS.map((c) => `<th class="num">${bilingualHeaderCell(c.en, c.ar)}</th>`).join('')}
        <th class="num">${bilingualHeaderCell('Total', 'الإجمالي')}</th>
    </tr>`;
    const tb = data?.totals?.buckets || {};
    const totalsRow = `<tr class="close">
        <td>${bilingualHeaderCell('Totals', 'المجاميع')}</td>
        ${AGING_COLS.map((c) => `<td class="num">${money(tb[c.key])}</td>`).join('')}
        <td class="num">${money(data?.totals?.total)}</td>
    </tr>`;
    const chk = data?.check || {};
    const tie = chk.tiesToGl
        ? `<div class="meta" style="color:#065f46;font-weight:700">Aging total = GL control ${money(chk.glControl)} / مطابق لحساب المراقبة</div>`
        : `<div class="meta" style="color:#b91c1c;font-weight:700">Aging total ${money(chk.agingTotal)} ≠ GL ${money(chk.glControl)} (difference ${money(chk.agingVsGl)})</div>`;
    const untagged = Number(chk.untagged || 0) !== 0
        ? `<div class="meta" style="color:#92400e">Untagged control lines (no party): ${money(chk.untagged)}</div>`
        : '';
    const docGap = Number(chk.documentVsGl || 0) !== 0
        ? `<div class="meta" style="color:#b91c1c">Document subledger (${escapePdfHtml(chk.documentBasis || '')}) ${money(chk.documentSubledger)} vs GL ${money(chk.glControl)} — gap ${money(chk.documentVsGl)} (not adjusted)</div>`
        : '';
    const chunks = chunkRows(rows, 22);
    const pages = chunks.map((chunk, i) => {
        const isLast = i === chunks.length - 1;
        const body = chunk
            .map(
                (r) => `<tr>
                    <td>${pdfCellHtml(r.name || '')}</td>
                    ${AGING_COLS.map((c) => `<td class="num">${money(r.buckets?.[c.key])}</td>`).join('')}
                    <td class="num">${money(r.total)}</td>
                </tr>`,
            )
            .join('');
        return wrapStmtPage(`
            <div class="title-row">
                <div class="title-en">${title.en}</div>
                <div class="title-ar-wrap" style="text-align:center"><span class="title-ar">${title.ar}</span></div>
            </div>
            <div class="meta">${escapePdfHtml(supplierName)}${supplierName ? ' · ' : ''}As of ${escapePdfHtml(data?.asOf || 'today')} (Asia/Riyadh) · days past due date · oldest-first settlement · Amounts in SAR (official Riyal)</div>
            <table class="grid"><thead>${head}</thead><tbody>${body}${isLast ? totalsRow : ''}</tbody></table>
            ${isLast ? tie + untagged + docGap : ''}
            <div class="foot">FILTER · supplier ledger · read-only report</div>
        `);
    });
    await exportHtmlPagesToPdf({
        fileName: `${data?.kind === 'ap' ? 'ap' : 'ar'}-aging-${data?.asOf || 'today'}.pdf`,
        orientation: 'landscape',
        pages,
    });
}

/** Excel of the AR / AP aging: summary sheet + open documents sheet. */
export function exportSupplierAgingExcel({ data }) {
    const rows = Array.isArray(data?.rows) ? data.rows : [];
    const num = (v) => Number(Number(v || 0).toFixed(2));
    const title = agingTitle(data?.kind);
    const R = GL_RIYAL_SIGN;
    const summary = [
        [`${title.en} / ${title.ar}`, `As of ${data?.asOf || 'today'} (Asia/Riyadh)`],
        [],
        [
            data?.kind === 'ap' ? 'Vendor / المورد' : 'Customer / العميل',
            ...AGING_COLS.map((c) => `${c.en} / ${c.ar} (${R})`),
            `Total / الإجمالي (${R})`,
        ],
        ...rows.map((r) => [r.name, ...AGING_COLS.map((c) => num(r.buckets?.[c.key])), num(r.total)]),
        ['Totals / المجاميع', ...AGING_COLS.map((c) => num(data?.totals?.buckets?.[c.key])), num(data?.totals?.total)],
        [],
        [`GL control (${R})`, num(data?.check?.glControl)],
        [`Aging − GL (${R})`, num(data?.check?.agingVsGl)],
        [`Untagged lines (${R})`, num(data?.check?.untagged)],
        [`Document subledger (${R}) — ${data?.check?.documentBasis || ''}`, num(data?.check?.documentSubledger)],
        [`Document − GL (${R})`, num(data?.check?.documentVsGl)],
    ];
    const docs = [
        ['Party / الطرف', 'Entry / القيد', 'Document / المستند', 'Date / التاريخ', 'Due / الاستحقاق', 'Days overdue / أيام التأخير', 'Bucket', `Original (${R})`, `Outstanding (${R})`],
        ...rows.flatMap((r) =>
            (r.documents || []).map((d) => [
                r.name,
                d.entryNumber || '',
                d.docNo || '',
                d.date,
                d.dueDate,
                d.daysOverdue,
                d.bucket,
                num(d.original),
                num(d.outstanding),
            ]),
        ),
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), 'Aging');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(docs), 'Open documents');
    XLSX.writeFile(wb, `${data?.kind === 'ap' ? 'ap' : 'ar'}-aging-${data?.asOf || 'today'}.xlsx`);
}

/* ───────────────────────── SP-12 — VAT return (KSA boxes) + VAT audit export ───────────────────────── */

const VAT_AUDIT_STATUS = {
    matched: 'Matched / مطابق',
    amount_mismatch: 'Amount differs / فرق في المبلغ',
    no_journal: 'No journal / بدون قيد',
    no_document: 'No document / بدون مستند',
};
const VAT_AUDIT_TYPE = {
    sales_invoice: 'Sales invoice / فاتورة مبيعات',
    sales_return: 'Sales return / مرتجع مبيعات',
    purchase_bill: 'Purchase bill / فاتورة شراء',
    debit_note: 'Debit note / إشعار مدين',
    expense: 'Expense / مصروف',
    journal_only: 'Journal only / قيد فقط',
};
function vatBoxList(data) {
    const b = data?.boxes || {};
    return [
        ['Box 1 — Standard-rated sales (net) / المبيعات الخاضعة للنسبة الأساسية', b.box1StandardRatedSales?.amount, 'GL 4000 + 4010 − 4090'],
        ['Box 6 — Output VAT / ضريبة المخرجات', b.box6OutputVat?.amount, 'GL 2100'],
        ['Box 7 — Standard-rated purchases (net) / المشتريات الخاضعة للنسبة الأساسية', b.box7StandardRatedPurchases?.amount, 'Documents'],
        ['Box 8 — Input VAT / ضريبة المدخلات', b.box8InputVat?.amount, 'GL 1300'],
        ['Net VAT payable (Box 6 − Box 8) / صافي الضريبة المستحقة', b.netPayable?.amount, ''],
    ];
}

/** PDF: return boxes + TB tie-out + audit (every row, multi-page). */
export async function exportVatReturnPdf({ data }) {
    const svg = await riyalSvg();
    const money = (v) =>
        `<span style="display:inline-flex;align-items:center;gap:3px;direction:ltr">${svg}<span>${escapePdfHtml(fmtMoney(v))}</span></span>`;
    const h = data?.header || {};
    const meta = `${escapePdfHtml(h.companyName || '')}${h.companyName ? ' · ' : ''}${escapePdfHtml(h.from || '…')} – ${escapePdfHtml(h.to || '…')} (Asia/Riyadh) · Amounts in SAR (official Riyal)`;
    const title = '<div class="title-row"><div class="title-en">VAT Return (KSA)</div><div class="title-ar-wrap" style="text-align:center"><span class="title-ar">إقرار ضريبة القيمة المضافة</span></div></div>';
    const tie = data?.tbTie;
    const boxRows = vatBoxList(data)
        .map(
            ([l, v, basis], i) =>
                `<tr${i === 4 ? ' class="close"' : ''}><td>${pdfCellHtml(l.replace(' / ', '\n'))}</td><td class="num">${money(v)}</td><td>${escapePdfHtml(basis)}</td></tr>`,
        )
        .join('');
    const boxesHtml = `<table class="grid"><thead><tr>
            <th>${bilingualHeaderCell('Box', 'الخانة')}</th>
            <th class="num">${bilingualHeaderCell('Amount', 'المبلغ')}</th>
            <th>${bilingualHeaderCell('Basis', 'الأساس')}</th>
        </tr></thead><tbody>${boxRows}</tbody></table>
        ${
            tie
                ? `<div class="meta">Trial balance tie-out — ${escapePdfHtml(tie.vatOutput?.code || '2100')} closing ${money(tie.vatOutput?.closing)} · ${escapePdfHtml(tie.vatInput?.code || '1300')} closing ${money(tie.vatInput?.closing)} (separate accounts, not blended)</div>`
                : ''
        }`;
    const auditRows = data?.audit?.rows || [];
    const auditHead = `<tr>
        <th>${bilingualHeaderCell('Status', 'الحالة')}</th>
        <th>${bilingualHeaderCell('Type', 'النوع')}</th>
        <th>${bilingualHeaderCell('Document', 'المستند')}</th>
        <th>${bilingualHeaderCell('Date', 'التاريخ')}</th>
        <th class="num">${bilingualHeaderCell('Document VAT', 'ضريبة المستند')}</th>
        <th class="num">${bilingualHeaderCell('Journal VAT', 'ضريبة القيد')}</th>
        <th class="num">${bilingualHeaderCell('Difference', 'الفرق')}</th>
    </tr>`;
    const auditRow = (r) => `<tr>
        <td>${pdfCellHtml((VAT_AUDIT_STATUS[r.status] || r.status).replace(' / ', '\n'))}</td>
        <td>${pdfCellHtml((VAT_AUDIT_TYPE[r.type] || r.type).replace(' / ', '\n'))}</td>
        <td>${escapePdfHtml(r.documentNo || (r.journalEntryNumbers || []).join(', ') || '—')}</td>
        <td>${escapePdfHtml(r.date || '')}</td>
        <td class="num">${money(r.documentVat)}</td>
        <td class="num">${money(r.journalVat)}</td>
        <td class="num">${money(r.difference)}</td>
    </tr>`;
    const sumLine = (side, label) => {
        const s = data?.audit?.summary?.[side] || {};
        return `${label}: documents ${money(s.documentVat)} · journals ${money(s.journalVat)} · difference ${money(s.difference)} · unmatched ${escapePdfHtml(String(s.unmatched ?? 0))}`;
    };
    const pages = [
        wrapStmtPage(`${title}<div class="meta">${meta}</div>${boxesHtml}
            <div class="meta" style="margin-top:10px;font-weight:700">VAT audit — documents vs journals / تدقيق الضريبة</div>
            <div class="meta">${sumLine('output', 'Output')}</div>
            <div class="meta">${sumLine('input', 'Input')}</div>
            <div class="foot">FILTER · supplier ledger · read-only report</div>`),
        ...chunkRows(auditRows, 20).map((chunk) =>
            wrapStmtPage(`${title}<div class="meta">${meta} · VAT audit</div>
                <table class="grid"><thead>${auditHead}</thead><tbody>${chunk.map(auditRow).join('')}</tbody></table>
                <div class="foot">FILTER · supplier ledger · read-only report</div>`),
        ),
    ];
    await exportHtmlPagesToPdf({
        fileName: `vat-return-${h.from || 'all'}-${h.to || 'all'}.pdf`,
        orientation: 'landscape',
        pages,
    });
}

/** Excel: Return (boxes + tie-out), VAT audit (every row), VAT journals. */
export function exportVatReturnExcel({ data }) {
    const R = GL_RIYAL_SIGN;
    const num = (v) => Number(Number(v || 0).toFixed(2));
    const h = data?.header || {};
    const tie = data?.tbTie || {};
    const ret = [
        ['VAT Return (KSA) / إقرار ضريبة القيمة المضافة', `${h.from || '…'} – ${h.to || '…'} (Asia/Riyadh)`],
        [],
        ['Box / الخانة', `Amount / المبلغ (${R})`, 'Basis / الأساس'],
        ...vatBoxList(data).map(([l, v, basis]) => [l, num(v), basis]),
        [],
        [`${tie.vatOutput?.code || '2100'} closing (= trial balance) (${R})`, num(tie.vatOutput?.closing)],
        [`${tie.vatInput?.code || '1300'} closing (= trial balance) (${R})`, num(tie.vatInput?.closing)],
    ];
    const audit = [
        ['Status / الحالة', 'Type / النوع', 'Document / المستند', 'Date / التاريخ', `Document VAT (${R})`, `Journal VAT (${R})`, `Difference (${R})`, 'Entries / القيود', 'Journal outside period'],
        ...(data?.audit?.rows || []).map((r) => [
            VAT_AUDIT_STATUS[r.status] || r.status,
            VAT_AUDIT_TYPE[r.type] || r.type,
            r.documentNo || '',
            r.date,
            num(r.documentVat),
            num(r.journalVat),
            num(r.difference),
            (r.journalEntryNumbers || []).join(', '),
            r.journalOutsideWindow ? 'yes' : '',
        ]),
    ];
    const journal = [
        ['Date / التاريخ', 'Reference / المرجع', 'Description / البيان', `Output VAT (${R})`, `Input VAT (${R})`, `Running net (${R})`],
        ...(data?.rows || []).map((r) => [r.date, r.reference || '', r.description || '', num(r.vatOutput), num(r.vatInput), num(r.payableToZatca)]),
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ret), 'Return');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(audit), 'VAT audit');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(journal), 'VAT journals');
    XLSX.writeFile(wb, `vat-return-${h.from || 'all'}-${h.to || 'all'}.xlsx`);
}

/* ───────────────────────── SP-13 — Day book export ───────────────────────── */

/** PDF of the day book: every posted line, grouped by date, with per-day totals. */
export async function exportSupplierDayBookPdf({ data }) {
    const svg = await riyalSvg();
    const money = (v) =>
        Number(v)
            ? `<span style="display:inline-flex;align-items:center;gap:3px;direction:ltr">${svg}<span>${escapePdfHtml(fmtMoney(v))}</span></span>`
            : '';
    const rows = data?.rows || [];
    const days = new Map((data?.days || []).map((d) => [d.date, d]));
    const printable = [];
    rows.forEach((r, i) => {
        const prev = rows[i - 1];
        if (!prev || prev.date !== r.date) printable.push({ kind: 'day', date: r.date, d: days.get(r.date) });
        printable.push({ kind: 'line', r, first: !prev || prev.journalId !== r.journalId });
    });
    const head = `<tr>
        <th style="width:10%">${bilingualHeaderCell('Entry', 'القيد')}</th>
        <th style="width:10%">${bilingualHeaderCell('Reference', 'المرجع')}</th>
        <th>${bilingualHeaderCell('Account', 'الحساب')}</th>
        <th>${bilingualHeaderCell('Description', 'البيان')}</th>
        <th class="num" style="width:13%">${bilingualHeaderCell('Debit', 'مدين')}</th>
        <th class="num" style="width:13%">${bilingualHeaderCell('Credit', 'دائن')}</th>
    </tr>`;
    const tot = data?.totals || {};
    const chunks = chunkRows(printable, 26);
    const pages = chunks.map((chunk, i) => {
        const isLast = i === chunks.length - 1;
        const body = chunk
            .map((p) =>
                p.kind === 'day'
                    ? `<tr class="open"><td colspan="4">${escapePdfHtml(p.date)} — ${p.d?.balanced ? 'balanced / متوازن' : 'NOT balanced / غير متوازن'}</td><td class="num">${money(p.d?.debit)}</td><td class="num">${money(p.d?.credit)}</td></tr>`
                    : `<tr>
                        <td>${p.first ? escapePdfHtml(p.r.entryNumber || '') : ''}</td>
                        <td>${p.first ? escapePdfHtml(p.r.reference || '') : ''}</td>
                        <td>${pdfCellHtml(`[${p.r.accountCode}] ${p.r.accountName}`)}</td>
                        <td>${pdfCellHtml(p.r.description || '')}</td>
                        <td class="num">${money(p.r.debit)}</td>
                        <td class="num">${money(p.r.credit)}</td>
                    </tr>`,
            )
            .join('');
        const totalsRow = isLast
            ? `<tr class="close"><td></td><td></td><td>${bilingualHeaderCell('Totals', 'المجاميع')}</td><td></td><td class="num">${money(tot.debit)}</td><td class="num">${money(tot.credit)}</td></tr>`
            : '';
        return wrapStmtPage(`
            <div class="title-row">
                <div class="title-en">Day Book</div>
                <div class="title-ar-wrap" style="text-align:center"><span class="title-ar">دفتر اليومية</span></div>
            </div>
            <div class="meta">${escapePdfHtml(data?.dateFrom || '')} – ${escapePdfHtml(data?.dateTo || '')} (Asia/Riyadh) · ${escapePdfHtml(String(tot.journals ?? 0))} journals · ${escapePdfHtml(String(tot.lines ?? 0))} lines · Amounts in SAR (official Riyal)</div>
            <table class="grid"><thead>${head}</thead><tbody>${body}${totalsRow}</tbody></table>
            ${isLast ? `<div class="meta" style="font-weight:700;color:${tot.balanced ? '#065f46' : '#b91c1c'}">${tot.balanced ? 'Debits = credits / المدين = الدائن' : `Out of balance by ${fmtMoney(tot.difference)}`}</div>` : ''}
            <div class="foot">FILTER · supplier ledger · read-only report</div>
        `);
    });
    await exportHtmlPagesToPdf({
        fileName: `day-book-${data?.dateFrom || ''}${data?.dateTo && data.dateTo !== data.dateFrom ? `-${data.dateTo}` : ''}.pdf`,
        orientation: 'portrait',
        pages,
    });
}

/** Excel of the day book. */
export function exportSupplierDayBookExcel({ data }) {
    const R = GL_RIYAL_SIGN;
    const num = (v) => (Number(v) ? Number(Number(v).toFixed(2)) : '');
    const aoa = [
        ['Day Book / دفتر اليومية', `${data?.dateFrom || ''} – ${data?.dateTo || ''} (Asia/Riyadh)`],
        [],
        ['Date / التاريخ', 'Entry / القيد', 'Reference / المرجع', 'Account / الحساب', 'Description / البيان', 'Party / الطرف', `Debit / مدين (${R})`, `Credit / دائن (${R})`, 'Source / المصدر'],
        ...(data?.rows || []).map((r) => [
            r.date,
            r.entryNumber || '',
            r.reference || '',
            `[${r.accountCode}] ${r.accountName}`,
            r.description || '',
            r.party || '',
            num(r.debit),
            num(r.credit),
            r.source || '',
        ]),
        [],
        ...(data?.days || []).map((d) => [`Day ${d.date}`, '', '', '', '', d.balanced ? 'balanced' : 'NOT balanced', num(d.debit), num(d.credit)]),
        ['Totals / المجاميع', '', '', '', '', '', num(data?.totals?.debit), num(data?.totals?.credit)],
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Day Book');
    XLSX.writeFile(wb, `day-book-${data?.dateFrom || ''}.xlsx`);
}

/* ───────────────────────── SP-14 — Year-end close preview export ───────────────────────── */

/** PDF of the year-end closing journal preview (Dr income / Cr expense / 3100 plug). */
export async function exportYearEndClosePdf({ data, supplierName = '' }) {
    const svg = await riyalSvg();
    const money = (v) =>
        Number(v)
            ? `<span style="display:inline-flex;align-items:center;gap:3px;direction:ltr">${svg}<span>${escapePdfHtml(fmtMoney(v))}</span></span>`
            : '';
    const typeLabel = { INCOME: 'Income / إيراد', EXPENSE: 'Expense / مصروف', EQUITY: 'Equity / حقوق ملكية' };
    const rows = [
        ...(data?.lines || []).map((l) => ({ ...l })),
        ...(data?.retainedEarnings
            ? [{ ...data.retainedEarnings, type: 'EQUITY', signed: '' }]
            : []),
    ];
    const head = `<tr>
        <th>${bilingualHeaderCell('Account', 'الحساب')}</th>
        <th style="width:16%">${bilingualHeaderCell('Type', 'النوع')}</th>
        <th class="num" style="width:17%">${bilingualHeaderCell('YTD balance', 'رصيد السنة')}</th>
        <th class="num" style="width:17%">${bilingualHeaderCell('Debit', 'مدين')}</th>
        <th class="num" style="width:17%">${bilingualHeaderCell('Credit', 'دائن')}</th>
    </tr>`;
    const tot = data?.totals || {};
    const chunks = chunkRows(rows, 24);
    if (!chunks.length) chunks.push([]);
    const pages = chunks.map((chunk, i) => {
        const isLast = i === chunks.length - 1;
        const body = chunk
            .map(
                (r) => `<tr>
                    <td>${pdfCellHtml(`[${r.accountCode}] ${r.accountName}`)}</td>
                    <td>${escapePdfHtml(typeLabel[r.type] || r.type || '')}</td>
                    <td class="num">${r.signed !== '' ? money(r.signed) : ''}</td>
                    <td class="num">${money(r.debit)}</td>
                    <td class="num">${money(r.credit)}</td>
                </tr>`,
            )
            .join('');
        const totalsRow = isLast
            ? `<tr class="close"><td>${bilingualHeaderCell('Totals', 'المجاميع')}</td><td></td><td></td><td class="num">${money(tot.debit)}</td><td class="num">${money(tot.credit)}</td></tr>`
            : '';
        return wrapStmtPage(`
            <div class="title-row">
                <div class="title-en">Year-end Closing Journal (preview)</div>
                <div class="title-ar-wrap" style="text-align:center"><span class="title-ar">قيد إقفال نهاية السنة (معاينة)</span></div>
            </div>
            <div class="meta">${escapePdfHtml(supplierName)} · Fiscal year ${escapePdfHtml(data?.startDate || '')} – ${escapePdfHtml(data?.endDate || '')} (Asia/Riyadh) · Amounts in SAR (official Riyal)</div>
            <div class="meta">Net income to close / صافي الربح المراد إقفاله: ${money(tot.netIncome) || '0.00'} · Income / الإيرادات ${money(tot.incomeToClose) || '0.00'} · Expenses / المصروفات ${money(tot.expenseToClose) || '0.00'}</div>
            <table class="grid"><thead>${head}</thead><tbody>${body}${totalsRow}</tbody></table>
            ${isLast ? `<div class="meta" style="font-weight:700;color:${tot.balanced ? '#065f46' : '#b91c1c'}">${tot.balanced ? 'Debits = credits / المدين = الدائن' : 'NOT balanced / غير متوازن'}${data?.fiscalYear?.closingJournal ? ` · Posted as ${escapePdfHtml(data.fiscalYear.closingJournal.entryNumber)}` : ''}</div>` : ''}
            <div class="foot">FILTER · supplier ledger · year-end close</div>
        `);
    });
    await exportHtmlPagesToPdf({
        fileName: `year-end-close-${data?.endDate || ''}.pdf`,
        orientation: 'portrait',
        pages,
    });
}

/** Excel of the year-end closing journal preview. */
export function exportYearEndCloseExcel({ data, supplierName = '' }) {
    const R = GL_RIYAL_SIGN;
    const num = (v) => (v === '' || v == null ? '' : Number(v));
    const tot = data?.totals || {};
    const aoa = [
        ['Year-end Closing Journal / قيد إقفال نهاية السنة', supplierName, `${data?.startDate || ''} – ${data?.endDate || ''} (Asia/Riyadh)`],
        [`Net income to close / صافي الربح (${R})`, num(tot.netIncome)],
        [],
        ['Code / الرمز', 'Account / الحساب', 'Type / النوع', `YTD balance / رصيد السنة (${R})`, `Debit / مدين (${R})`, `Credit / دائن (${R})`],
        ...(data?.lines || []).map((l) => [l.accountCode, l.accountName, l.type, num(l.signed), num(l.debit), num(l.credit)]),
        ...(data?.retainedEarnings
            ? [[data.retainedEarnings.accountCode, data.retainedEarnings.accountName, 'EQUITY', '', num(data.retainedEarnings.debit), num(data.retainedEarnings.credit)]]
            : []),
        ['', 'Totals / المجاميع', '', '', num(tot.debit), num(tot.credit)],
        ['', tot.balanced ? 'Debits = credits' : 'NOT balanced'],
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Year-end close');
    XLSX.writeFile(wb, `year-end-close-${data?.endDate || ''}.xlsx`);
}

/* ───────────────────────── SP-15 — Inventory valuation + stock ledger export ───────────────────────── */

async function sp15Money() {
    const svg = await riyalSvg();
    return (v) =>
        v != null && v !== ''
            ? `<span style="display:inline-flex;align-items:center;gap:3px;direction:ltr">${svg}<span>${escapePdfHtml(fmtMoney(v))}</span></span>`
            : '';
}
const sp15Qty = (v) => {
    const n = Number(v || 0);
    return Number.isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: 3 }) : '0';
};

/** PDF: stock valuation (qty × moving average) vs GL 1200, difference = GL − stock. */
export async function exportInventoryValuationPdf({ data }) {
    const money = await sp15Money();
    const tot = data?.totals || {};
    const head = `<tr>
        <th>${bilingualHeaderCell('Item', 'الصنف')}</th>
        <th class="num" style="width:14%">${bilingualHeaderCell('Qty on hand', 'الكمية')}</th>
        <th class="num" style="width:17%">${bilingualHeaderCell('Average cost', 'متوسط التكلفة')}</th>
        <th class="num" style="width:19%">${bilingualHeaderCell('Value', 'القيمة')}</th>
    </tr>`;
    const chunks = chunkRows(data?.items || [], 26);
    if (!chunks.length) chunks.push([]);
    const pages = chunks.map((chunk, i) => {
        const isFirst = i === 0;
        const isLast = i === chunks.length - 1;
        const body = chunk
            .map(
                (r) => `<tr>
                    <td>${pdfCellHtml(`${r.name}${r.sku ? ` · ${r.sku}` : ''}${r.unaveraged ? ' (no average)' : ''}`)}</td>
                    <td class="num">${escapePdfHtml(sp15Qty(r.qty))}</td>
                    <td class="num">${money(r.averageCost)}</td>
                    <td class="num">${money(r.value)}</td>
                </tr>`,
            )
            .join('');
        const totalsRow = isLast
            ? `<tr class="close"><td>${bilingualHeaderCell('Total stock valuation', 'إجمالي تقييم المخزون')}</td><td></td><td></td><td class="num">${money(tot.valuation)}</td></tr>`
            : '';
        return wrapStmtPage(`
            <div class="title-row">
                <div class="title-en">Inventory Valuation vs GL 1200</div>
                <div class="title-ar-wrap" style="text-align:center"><span class="title-ar">تقييم المخزون مقابل حساب 1200</span></div>
            </div>
            <div class="meta">As of ${escapePdfHtml(data?.asOf || '')} (Asia/Riyadh) · moving average, never selling price · Amounts in SAR (official Riyal)</div>
            ${isFirst ? `<div class="meta">Stock valuation / تقييم المخزون: ${money(tot.valuation)} · GL 1200 / حساب 1200: ${tot.gl1200 != null ? money(tot.gl1200) : '—'} · Difference (GL − stock) / الفرق: ${tot.difference != null ? money(tot.difference) : '—'} ${tot.tiesOut ? '✓' : '— NOT reconciled / غير مسوّى'}</div>` : ''}
            <table class="grid"><thead>${head}</thead><tbody>${body}${totalsRow}</tbody></table>
            <div class="foot">FILTER · supplier inventory · read-only report (no journal posted)</div>
        `);
    });
    await exportHtmlPagesToPdf({ fileName: `inventory-valuation-${data?.asOf || ''}.pdf`, orientation: 'portrait', pages });
}

/** Excel: valuation + GL 1200 by source. */
export function exportInventoryValuationExcel({ data }) {
    const R = GL_RIYAL_SIGN;
    const tot = data?.totals || {};
    const num = (v) => (v == null || v === '' ? '' : Number(v));
    const aoa = [
        ['Inventory Valuation vs GL 1200 / تقييم المخزون مقابل حساب 1200', `As of ${data?.asOf || ''} (Asia/Riyadh)`],
        [`Stock valuation / تقييم المخزون (${R})`, num(tot.valuation)],
        [`GL 1200 (${R})`, num(tot.gl1200)],
        [`Difference GL − stock / الفرق (${R})`, num(tot.difference), tot.tiesOut ? 'ties out' : 'NOT reconciled — no journal posted'],
        [],
        ['Item / الصنف', 'SKU', 'Qty on hand / الكمية', `Average cost / متوسط التكلفة (${R})`, `Value / القيمة (${R})`, 'Movement qty / كمية الحركات', 'Flags'],
        ...(data?.items || []).map((r) => [
            r.name,
            r.sku || '',
            Number(r.qty),
            num(r.averageCost),
            num(r.value),
            Number(r.movementQty),
            [r.unaveraged ? 'no average' : '', r.qtyMatchesMovements ? '' : 'qty ≠ movements'].filter(Boolean).join(', '),
        ]),
        ['Total / الإجمالي', '', '', '', num(tot.valuation)],
        [],
        ['GL 1200 by source / حساب 1200 حسب المصدر'],
        ['Source', `Debit (${R})`, `Credit (${R})`, `Net (${R})`, 'Lines'],
        ...(data?.glBySource || []).map((s) => [s.source || '', num(s.debit), num(s.credit), num(s.net), s.lines]),
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Valuation');
    XLSX.writeFile(wb, `inventory-valuation-${data?.asOf || ''}.xlsx`);
}

/** PDF: per-SKU stock ledger with running qty and value. */
export async function exportStockLedgerPdf({ data }) {
    const money = await sp15Money();
    const head = `<tr>
        <th style="width:10%">${bilingualHeaderCell('Date', 'التاريخ')}</th>
        <th style="width:14%">${bilingualHeaderCell('Type', 'النوع')}</th>
        <th>${bilingualHeaderCell('Journal', 'القيد')}</th>
        <th class="num" style="width:9%">${bilingualHeaderCell('In', 'وارد')}</th>
        <th class="num" style="width:9%">${bilingualHeaderCell('Out', 'صادر')}</th>
        <th class="num" style="width:13%">${bilingualHeaderCell('Unit cost', 'تكلفة الوحدة')}</th>
        <th class="num" style="width:10%">${bilingualHeaderCell('Qty', 'الكمية')}</th>
        <th class="num" style="width:15%">${bilingualHeaderCell('Value', 'القيمة')}</th>
    </tr>`;
    const chunks = chunkRows(data?.rows || [], 24);
    if (!chunks.length) chunks.push([]);
    const pages = chunks.map((chunk, i) => {
        const isFirst = i === 0;
        const isLast = i === chunks.length - 1;
        const openRow = isFirst
            ? `<tr class="open"><td colspan="6">${bilingualHeaderCell('Opening', 'الرصيد الافتتاحي')}</td><td class="num">${escapePdfHtml(sp15Qty(data?.opening?.qty))}</td><td class="num">${money(data?.opening?.value)}</td></tr>`
            : '';
        const body = chunk
            .map(
                (r) => `<tr>
                    <td>${escapePdfHtml(r.date)}</td>
                    <td>${escapePdfHtml(r.movementType)}</td>
                    <td>${escapePdfHtml(r.proof?.journalEntryNumber || '—')}</td>
                    <td class="num">${Number(r.qtyIn) ? escapePdfHtml(sp15Qty(r.qtyIn)) : ''}</td>
                    <td class="num">${Number(r.qtyOut) ? escapePdfHtml(sp15Qty(r.qtyOut)) : ''}</td>
                    <td class="num">${money(r.unitCost)}</td>
                    <td class="num">${escapePdfHtml(sp15Qty(r.runningQty))}</td>
                    <td class="num">${money(r.runningValue)}</td>
                </tr>`,
            )
            .join('');
        const closeRow = isLast
            ? `<tr class="close"><td colspan="3">${bilingualHeaderCell('Closing', 'الرصيد الختامي')}</td><td class="num">${escapePdfHtml(sp15Qty(data?.totals?.qtyIn))}</td><td class="num">${escapePdfHtml(sp15Qty(data?.totals?.qtyOut))}</td><td></td><td class="num">${escapePdfHtml(sp15Qty(data?.closing?.qty))}</td><td class="num">${money(data?.closing?.value)}</td></tr>`
            : '';
        return wrapStmtPage(`
            <div class="title-row">
                <div class="title-en">Stock Ledger</div>
                <div class="title-ar-wrap" style="text-align:center"><span class="title-ar">دفتر حركة الصنف</span></div>
            </div>
            <div class="meta">${escapePdfHtml(data?.product?.name || '')}${data?.product?.sku ? ` · ${escapePdfHtml(data.product.sku)}` : ''} · ${escapePdfHtml(data?.dateFrom || 'start')} – ${escapePdfHtml(data?.dateTo || 'today')} (Asia/Riyadh) · moving average · Amounts in SAR (official Riyal)</div>
            <table class="grid"><thead>${head}</thead><tbody>${openRow}${body}${closeRow}</tbody></table>
            <div class="foot">FILTER · supplier inventory · stock ledger</div>
        `);
    });
    await exportHtmlPagesToPdf({
        fileName: `stock-ledger-${data?.product?.sku || data?.product?.id || ''}.pdf`,
        orientation: 'portrait',
        pages,
    });
}

/** Excel: per-SKU stock ledger. */
export function exportStockLedgerExcel({ data }) {
    const R = GL_RIYAL_SIGN;
    const num = (v) => (v == null || v === '' ? '' : Number(v));
    const aoa = [
        ['Stock Ledger / دفتر حركة الصنف', data?.product?.name || '', data?.product?.sku || '', `${data?.dateFrom || 'start'} – ${data?.dateTo || 'today'} (Asia/Riyadh)`],
        [],
        ['Date / التاريخ', 'Type / النوع', 'Location / الموقع', 'Journal / القيد', 'Qty in / وارد', 'Qty out / صادر', `Unit cost / تكلفة الوحدة (${R})`, 'Running qty / الكمية الجارية', `Running value / القيمة الجارية (${R})`, 'Source', 'Source id'],
        ['Opening / الرصيد الافتتاحي', '', '', '', '', '', '', Number(data?.opening?.qty || 0), num(data?.opening?.value)],
        ...(data?.rows || []).map((r) => [
            r.date,
            r.movementType,
            r.locationName || '',
            r.proof?.journalEntryNumber || '',
            Number(r.qtyIn) || '',
            Number(r.qtyOut) || '',
            num(r.unitCost),
            Number(r.runningQty),
            num(r.runningValue),
            r.proof?.source || '',
            r.proof?.sourceId || '',
        ]),
        ['Closing / الرصيد الختامي', '', '', '', Number(data?.totals?.qtyIn || 0), Number(data?.totals?.qtyOut || 0), '', Number(data?.closing?.qty || 0), num(data?.closing?.value)],
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Stock ledger');
    XLSX.writeFile(wb, `stock-ledger-${data?.product?.sku || data?.product?.id || ''}.xlsx`);
}
