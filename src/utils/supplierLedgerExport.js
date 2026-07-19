import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const fmtMoney = (v) =>
    Number(v ?? 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

/** jsPDF built-in fonts cannot render Arabic/RTL — avoid garbled PDF headings. */
function pdfAsciiOrFallback(text, fallback = '') {
    const s = String(text || '').trim();
    if (!s) return fallback;
    if (/[^\u0020-\u007E]/.test(s)) return fallback;
    return s;
}

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

/** Export a supplier ledger to a styled PDF. */
export function exportSupplierLedgerPdf({
    header,
    openingBalance,
    rows,
    totals,
    logoDataUrl, // optional base64 data URL for the workshop logo
}) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const margin = 32;
    let cursorY = margin;

    if (logoDataUrl) {
        try {
            doc.addImage(logoDataUrl, 'PNG', margin, cursorY, 60, 60);
        } catch (e) {
            console.warn('logo render failed', e);
        }
    }

    const headerLeft = logoDataUrl ? margin + 76 : margin;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(header?.workshopName || 'Workshop', headerLeft, cursorY + 16);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    if (header?.workshopAddress) {
        doc.text(String(header.workshopAddress), headerLeft, cursorY + 32);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Supplier Ledger Statement', headerLeft, cursorY + 50);

    cursorY += 80;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const lines = [
        `Supplier: ${header?.supplierName || ''}  ` +
            `(${header?.type === 'affiliated' ? 'Affiliated' : 'Non-Affiliated'})`,
        header?.branchName ? `Branch: ${header.branchName}` : null,
        `Period: ${header?.from || '—'}  to  ${header?.to || '—'}`,
        `Currency: ${header?.currencyCode || 'SAR'}`,
    ].filter(Boolean);
    lines.forEach((line, i) => {
        doc.text(line, margin, cursorY + i * 14);
    });
    cursorY += lines.length * 14 + 8;

    const body = [];
    body.push([
        '—',
        'Opening balance',
        '',
        '',
        fmtMoney(openingBalance),
    ]);
    rows.forEach((r) => {
        body.push([
            r.date,
            r.description || '',
            r.debit > 0 ? fmtMoney(r.debit) : '',
            r.credit > 0 ? fmtMoney(r.credit) : '',
            fmtMoney(r.runningBalance),
        ]);
    });
    body.push([
        '',
        'Totals',
        fmtMoney(totals?.totalDebit),
        fmtMoney(totals?.totalCredit),
        fmtMoney(totals?.closingBalance),
    ]);

    autoTable(doc, {
        startY: cursorY,
        head: [['Date', 'Description', 'Debit', 'Credit', 'Balance']],
        body,
        margin: { left: margin, right: margin },
        styles: { fontSize: 9, cellPadding: 5 },
        headStyles: { fillColor: [241, 245, 249], textColor: 30 },
        columnStyles: {
            0: { cellWidth: 70 },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 75, halign: 'right' },
            3: { cellWidth: 75, halign: 'right' },
            4: { cellWidth: 85, halign: 'right' },
        },
        didParseCell(data) {
            const last = data.row.index === body.length - 1;
            const first = data.row.index === 0;
            if (last || first) {
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.fillColor = first ? [248, 250, 252] : [255, 247, 237];
            }
        },
    });

    const finalY = doc.lastAutoTable?.finalY ?? cursorY + 200;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(
        `Generated ${new Date().toLocaleString()}`,
        margin,
        Math.min(finalY + 18, doc.internal.pageSize.getHeight() - 16),
    );

    const file = `${buildFileBase({ header })}.pdf`;
    doc.save(file);
}

/** Export the same ledger to .xlsx. */
export function exportSupplierLedgerExcel({
    header,
    openingBalance,
    rows,
    totals,
}) {
    const aoa = [
        [header?.workshopName || 'Workshop'],
        ['Supplier Ledger Statement'],
        [],
        ['Supplier', header?.supplierName || ''],
        ['Type', header?.type === 'affiliated' ? 'Affiliated' : 'Non-Affiliated'],
        ['Branch', header?.branchName || ''],
        ['Period', `${header?.from || '—'}  to  ${header?.to || '—'}`],
        ['Currency', header?.currencyCode || 'SAR'],
        [],
        ['Date', 'Description', 'Debit', 'Credit', 'Balance'],
        ['—', 'Opening balance', '', '', Number(openingBalance ?? 0)],
        ...rows.map((r) => [
            r.date,
            r.description || '',
            r.debit > 0 ? Number(r.debit) : '',
            r.credit > 0 ? Number(r.credit) : '',
            Number(r.runningBalance ?? 0),
        ]),
        [
            '',
            'Totals',
            Number(totals?.totalDebit ?? 0),
            Number(totals?.totalCredit ?? 0),
            Number(totals?.closingBalance ?? 0),
        ],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 14 }, { wch: 50 }, { wch: 14 }, { wch: 14 }, { wch: 16 }];
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

/** Export a non-affiliated customer AR ledger to PDF. */
export function exportCustomerLedgerPdf({
    header,
    openingBalance,
    rows,
    totals,
}) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const margin = 32;
    let cursorY = margin;

    const customerLabel = header?.customerName || 'Customer';

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(header?.companyName || 'Supplier', margin, cursorY + 16);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(customerLabel, margin, cursorY + 38);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Customer Ledger Statement', margin, cursorY + 58);

    cursorY += 78;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const lines = [
        `Period: ${header?.from || '—'}  to  ${header?.to || '—'}`,
        `Currency: ${header?.currencyCode || 'SAR'}`,
    ];
    lines.forEach((line, i) => {
        doc.text(line, margin, cursorY + i * 14);
    });
    cursorY += lines.length * 14 + 8;

    const body = [
        ['—', 'Opening balance', '', '', fmtMoney(openingBalance)],
        ...rows.map((r) => [
            r.date,
            r.description || '',
            r.debit > 0 ? fmtMoney(r.debit) : '',
            r.credit > 0 ? fmtMoney(r.credit) : '',
            fmtMoney(r.runningBalance),
        ]),
        [
            '',
            'Totals',
            fmtMoney(totals?.totalDebit),
            fmtMoney(totals?.totalCredit),
            fmtMoney(totals?.closingBalance),
        ],
    ];

    autoTable(doc, {
        startY: cursorY,
        head: [['Date', 'Description', 'Debit', 'Credit', 'Balance']],
        body,
        margin: { left: margin, right: margin },
        styles: { fontSize: 9, cellPadding: 5 },
        headStyles: { fillColor: [241, 245, 249], textColor: 30 },
        columnStyles: {
            0: { cellWidth: 70 },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 75, halign: 'right' },
            3: { cellWidth: 75, halign: 'right' },
            4: { cellWidth: 85, halign: 'right' },
        },
        didParseCell(data) {
            const last = data.row.index === body.length - 1;
            const first = data.row.index === 0;
            if (last || first) {
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.fillColor = first ? [248, 250, 252] : [255, 247, 237];
            }
        },
    });

    const finalY = doc.lastAutoTable?.finalY ?? cursorY + 200;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(
        `Generated ${new Date().toLocaleString()}`,
        margin,
        Math.min(finalY + 18, doc.internal.pageSize.getHeight() - 16),
    );

    doc.save(`${buildCustomerFileBase({ header })}.pdf`);
}

/** Export a non-affiliated customer AR ledger to Excel. */
export function exportCustomerLedgerExcel({ header, openingBalance, rows, totals }) {
    const customerLabel = header?.customerName || 'Customer';
    const aoa = [
        [header?.companyName || 'Supplier'],
        [customerLabel],
        ['Customer Ledger Statement'],
        [],
        ['Ledger account', customerLabel],
        ['Period', `${header?.from || '—'}  to  ${header?.to || '—'}`],
        ['Currency', header?.currencyCode || 'SAR'],
        [],
        ['Date', 'Description', 'Debit', 'Credit', 'Balance'],
        ['—', 'Opening balance', '', '', Number(openingBalance ?? 0)],
        ...rows.map((r) => [
            r.date,
            r.description || '',
            r.debit > 0 ? Number(r.debit) : '',
            r.credit > 0 ? Number(r.credit) : '',
            Number(r.runningBalance ?? 0),
        ]),
        [
            '',
            'Totals',
            Number(totals?.totalDebit ?? 0),
            Number(totals?.totalCredit ?? 0),
            Number(totals?.closingBalance ?? 0),
        ],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 14 }, { wch: 50 }, { wch: 14 }, { wch: 14 }, { wch: 16 }];
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
export function exportAccountLedgerPdf({ header, openingBalance, rows, totals }) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const margin = 32;
    let cursorY = margin;

    const accountLabel = header?.accountCode
        ? `[${header.accountCode}] ${header.accountName || ''}`
        : header?.accountName || 'Account';

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(pdfAsciiOrFallback(header?.companyName, 'FILTER'), margin, cursorY + 16);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(pdfAsciiOrFallback(accountLabel, 'Account Ledger'), margin, cursorY + 38);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Account Ledger Statement', margin, cursorY + 58);

    cursorY += 78;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const lines = [
        header?.accountType ? `Account type: ${header.accountType}` : null,
        `Period: ${header?.from || '—'}  to  ${header?.to || '—'}`,
        header?.expenseCategory ? `Expense category: ${header.expenseCategory}` : null,
        `Currency: ${header?.currencyCode || 'SAR'}`,
    ].filter(Boolean);
    lines.forEach((line, i) => {
        doc.text(line, margin, cursorY + i * 14);
    });
    cursorY += lines.length * 14 + 8;

    const colMode = accountLedgerColumnMode(rows);
    const hasCashCols = colMode === 'cash';
    const hasPettyCols = colMode === 'pettyCash';
    const body = [
        hasPettyCols
            ? ['—', 'Opening balance', '', '', '', '', fmtMoney(openingBalance)]
            : hasCashCols
              ? ['—', 'Opening balance', '', '', '', '', fmtMoney(openingBalance)]
              : ['—', 'Opening balance', '', '', fmtMoney(openingBalance)],
        ...rows.map((r) =>
            hasPettyCols
                ? [
                      r.date,
                      r.walletUserLabel || '',
                      r.expenseCategoryLabel || '',
                      r.description || '',
                      r.debit > 0 ? fmtMoney(r.debit) : '',
                      r.credit > 0 ? fmtMoney(r.credit) : '',
                      fmtMoney(r.runningBalance),
                  ]
                : hasCashCols
                  ? [
                        r.date,
                        r.counterpartyLabel || '',
                        r.offsetAccountLabel || '',
                        r.description || '',
                        r.debit > 0 ? fmtMoney(r.debit) : '',
                        r.credit > 0 ? fmtMoney(r.credit) : '',
                        fmtMoney(r.runningBalance),
                    ]
                  : [
                        r.date,
                        r.description || '',
                        r.debit > 0 ? fmtMoney(r.debit) : '',
                        r.credit > 0 ? fmtMoney(r.credit) : '',
                        fmtMoney(r.runningBalance),
                    ],
        ),
        hasPettyCols
            ? [
                  '',
                  '',
                  '',
                  'Totals',
                  fmtMoney(totals?.totalDebit),
                  fmtMoney(totals?.totalCredit),
                  fmtMoney(totals?.closingBalance),
              ]
            : hasCashCols
              ? [
                    '',
                    '',
                    '',
                    'Totals',
                    fmtMoney(totals?.totalDebit),
                    fmtMoney(totals?.totalCredit),
                    fmtMoney(totals?.closingBalance),
                ]
              : [
                    '',
                    'Totals',
                    fmtMoney(totals?.totalDebit),
                    fmtMoney(totals?.totalCredit),
                    fmtMoney(totals?.closingBalance),
                ],
    ];

    autoTable(doc, {
        startY: cursorY,
        head: hasPettyCols
            ? [
                  [
                      'Date',
                      'Wallet user / employee',
                      'Expense category',
                      'Description',
                      'Debit',
                      'Credit',
                      'Balance',
                  ],
              ]
            : hasCashCols
              ? [
                    [
                        'Date',
                        'Paid to / Received from',
                        'Expense / AR account',
                        'Description',
                        'Debit',
                        'Credit',
                        'Balance',
                    ],
                ]
              : [['Date', 'Description', 'Debit', 'Credit', 'Balance']],
        body,
        margin: { left: margin, right: margin },
        styles: { fontSize: 9, cellPadding: 5 },
        headStyles: { fillColor: [241, 245, 249], textColor: 30 },
        columnStyles: hasPettyCols || hasCashCols
            ? {
                  0: { cellWidth: 58 },
                  1: { cellWidth: 82 },
                  2: { cellWidth: 82 },
                  3: { cellWidth: 'auto' },
                  4: { cellWidth: 58, halign: 'right' },
                  5: { cellWidth: 58, halign: 'right' },
                  6: { cellWidth: 68, halign: 'right' },
              }
            : {
                  0: { cellWidth: 70 },
                  1: { cellWidth: 'auto' },
                  2: { cellWidth: 75, halign: 'left' },
                  3: { cellWidth: 75, halign: 'left' },
                  4: { cellWidth: 85, halign: 'left' },
              },
        didParseCell(data) {
            const last = data.row.index === body.length - 1;
            const first = data.row.index === 0;
            if (last || first) {
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.fillColor = first ? [248, 250, 252] : [255, 247, 237];
            }
        },
    });

    const finalY = doc.lastAutoTable?.finalY ?? cursorY + 200;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(
        `Generated ${new Date().toLocaleString()}`,
        margin,
        Math.min(finalY + 18, doc.internal.pageSize.getHeight() - 16),
    );

    doc.save(`${buildAccountFileBase({ header })}.pdf`);
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
        [header?.companyName || 'Supplier'],
        [accountLabel],
        ['Account Ledger Statement'],
        [],
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
                      'Debit',
                      'Credit',
                      'Balance',
                  ],
                  ['—', 'Opening balance', '', '', '', '', Number(openingBalance ?? 0)],
                  ...rows.map((r) => [
                      r.date,
                      r.walletUserLabel || '',
                      r.expenseCategoryLabel || '',
                      r.description || '',
                      r.debit > 0 ? Number(r.debit) : '',
                      r.credit > 0 ? Number(r.credit) : '',
                      Number(r.runningBalance ?? 0),
                  ]),
                  [
                      '',
                      '',
                      '',
                      'Totals',
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
                      'Debit',
                      'Credit',
                      'Balance',
                  ],
                  ['—', 'Opening balance', '', '', '', '', Number(openingBalance ?? 0)],
                  ...rows.map((r) => [
                      r.date,
                      r.counterpartyLabel || '',
                      r.offsetAccountLabel || '',
                      r.description || '',
                      r.debit > 0 ? Number(r.debit) : '',
                      r.credit > 0 ? Number(r.credit) : '',
                      Number(r.runningBalance ?? 0),
                  ]),
                  [
                      '',
                      '',
                      '',
                      'Totals',
                      Number(totals?.totalDebit ?? 0),
                      Number(totals?.totalCredit ?? 0),
                      Number(totals?.closingBalance ?? 0),
                  ],
              ]
            : [
                  ['Date', 'Description', 'Debit', 'Credit', 'Balance'],
                  ['—', 'Opening balance', '', '', Number(openingBalance ?? 0)],
                  ...rows.map((r) => [
                      r.date,
                      r.description || '',
                      r.debit > 0 ? Number(r.debit) : '',
                      r.credit > 0 ? Number(r.credit) : '',
                      Number(r.runningBalance ?? 0),
                  ]),
                  [
                      '',
                      'Totals',
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
              { wch: 28 },
              { wch: 24 },
              { wch: 40 },
              { wch: 12 },
              { wch: 12 },
              { wch: 14 },
          ]
        : [{ wch: 14 }, { wch: 50 }, { wch: 14 }, { wch: 14 }, { wch: 16 }];
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
    doc.text(header?.companyName || 'Supplier', margin, cursorY + 16);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(accountLabel, margin, cursorY + 38);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('VAT Report', margin, cursorY + 58);

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
        [header?.companyName || 'Supplier'],
        [accountLabel],
        ['VAT Report'],
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
            r.saleInclVat > 0 ? Number(r.saleInclVat) : '',
            r.purchaseInclVat > 0 ? Number(r.purchaseInclVat) : '',
            r.vatOutput > 0 ? Number(r.vatOutput) : '',
            r.vatInput > 0 ? Number(r.vatInput) : '',
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
