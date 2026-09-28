import { fmtDateYmd, moneySar } from '../pages/workshop/accounting/workshopTransactionUi';

function esc(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const VOUCHER_CSS = `
body { font-family: 'Poppins', sans-serif; padding: 40px; color: #1e293b; line-height: 1.5; }
.voucher-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; }
.company-info h1 { margin: 0; font-size: 24px; font-weight: 900; color: #0f172a; }
.company-info p { margin: 4px 0; color: #64748b; font-size: 14px; }
.voucher-title-box { text-align: right; }
.voucher-title { font-size: 20px; font-weight: 800; color: #0f172a; margin: 0; text-transform: uppercase; }
.voucher-id { font-size: 14px; font-weight: 700; color: #3b82f6; margin-top: 4px; }
.details-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 40px; }
.detail-item { display: flex; flex-direction: column; }
.detail-label { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
.detail-value { font-size: 14px; font-weight: 600; color: #334155; }
.description-box { background: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 40px; border: 1px solid #f1f5f9; }
.description-text { margin: 0; font-size: 14px; color: #475569; }
table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
th { background: #f8fafc; padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 700; color: #64748b; border-bottom: 1px solid #e2e8f0; }
td { padding: 14px 16px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
.text-right { text-align: right; }
.totals-row td { background: #f8fafc; font-weight: 800; font-size: 14px; border-top: 2px solid #e2e8f0; border-bottom: none; }
.debit-color { color: #059669; }
.credit-color { color: #2563eb; }
.footer-signatures { display: grid; grid-template-columns: repeat(2, 1fr); gap: 100px; margin-top: 100px; }
.sig-line { border-top: 1px solid #cbd5e1; padding-top: 8px; text-align: center; font-size: 12px; color: #64748b; font-weight: 600; }
@media print { body { padding: 0; } .no-print { display: none; } }
`;

function openPrintHtml(title, bodyHtml) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
        <html>
            <head>
                <title>${esc(title)}</title>
                <style>${VOUCHER_CSS}</style>
            </head>
            <body>
                ${bodyHtml}
                <script>window.onload = function () { window.print(); };</script>
            </body>
        </html>
    `);
    printWindow.document.close();
}

function companyHeader(t, title, code) {
    return `
        <div class="voucher-header">
            <div class="company-info">
                <h1>${esc(t('gj.print.company'))}</h1>
                <p>${esc(t('gj.print.tagline'))}</p>
            </div>
            <div class="voucher-title-box">
                <h2 class="voucher-title">${esc(title)}</h2>
                <div class="voucher-id">${esc(code)}</div>
            </div>
        </div>
    `;
}

function signatures(t) {
    return `
        <div class="footer-signatures">
            <div class="sig-line">${esc(t('gj.print.preparedBy'))}</div>
            <div class="sig-line">${esc(t('gj.print.approvedBy'))}</div>
        </div>
    `;
}

export function printJournalVoucher(t, entry) {
    const code = entry?.entryNumber || entry?.code || '';
    const lines = Array.isArray(entry?.lines) ? entry.lines : [];
    const totalDebit = Number(entry?.totalDebit || 0);
    const totalCredit = Number(entry?.totalCredit || 0);
    const body = `
        ${companyHeader(t, t('gj.print.voucher'), code)}
        <div class="details-grid">
            <div class="detail-item">
                <span class="detail-label">${esc(t('gj.print.entryDate'))}</span>
                <span class="detail-value">${esc(fmtDateYmd(entry?.date))}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">${esc(t('gj.print.entryType'))}</span>
                <span class="detail-value">${esc(entry?.type || '')}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">${esc(t('gj.print.status'))}</span>
                <span class="detail-value">${esc(String(entry?.status || '').toUpperCase())}</span>
            </div>
        </div>
        <div class="description-box">
            <span class="detail-label">${esc(t('gj.print.descMemo'))}</span>
            <p class="description-text">${esc(entry?.description || '')}</p>
        </div>
        <table>
            <thead>
                <tr>
                    <th>${esc(t('gj.print.accountName'))}</th>
                    <th>${esc(t('gj.print.description'))}</th>
                    <th class="text-right">${esc(t('gj.print.debitSar'))}</th>
                    <th class="text-right">${esc(t('gj.print.creditSar'))}</th>
                </tr>
            </thead>
            <tbody>
                ${lines.map((line) => {
                    const account = [line.accountCode, line.accountName].filter(Boolean).join(' — ')
                        || line.account
                        || '';
                    return `
                        <tr>
                            <td style="font-weight: 700;">${esc(account)}</td>
                            <td style="color: #64748b;">${esc(line.description || '')}</td>
                            <td class="text-right debit-color">${Number(line.debit) ? esc(moneySar(line.debit)) : '—'}</td>
                            <td class="text-right credit-color">${Number(line.credit) ? esc(moneySar(line.credit)) : '—'}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
            <tfoot>
                <tr class="totals-row">
                    <td colspan="2">${esc(t('gj.print.totals'))}</td>
                    <td class="text-right debit-color">${esc(moneySar(totalDebit))}</td>
                    <td class="text-right credit-color">${esc(moneySar(totalCredit))}</td>
                </tr>
            </tfoot>
        </table>
        ${signatures(t)}
    `;
    openPrintHtml(t('gj.print.title', { code }), body);
}

export function printPayReceiptVoucher(t, row, kind) {
    const isPayment = kind === 'payment';
    const code = row?.voucherNumber || '';
    const title = isPayment ? t('tx.print.paymentVoucher') : t('tx.print.receiptVoucher');
    const partyLabel = isPayment ? t('tx.print.paidTo') : t('tx.print.receivedFrom');
    const cashLabel = isPayment ? t('tx.print.paidFrom') : t('tx.print.receivedIn');
    const against = [row?.accountCode, row?.accountName].filter(Boolean).join(' — ');
    const body = `
        ${companyHeader(t, title, code)}
        <div class="details-grid">
            <div class="detail-item">
                <span class="detail-label">${esc(t('gj.print.entryDate'))}</span>
                <span class="detail-value">${esc(fmtDateYmd(row?.date))}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">${esc(t('gj.print.status'))}</span>
                <span class="detail-value">${esc(String(row?.status || '').toUpperCase())}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">${esc(t('tx.print.amount'))}</span>
                <span class="detail-value">${esc(moneySar(row?.amount))}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">${esc(partyLabel)}</span>
                <span class="detail-value">${esc(row?.payeeName || '—')}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">${esc(cashLabel)}</span>
                <span class="detail-value">${esc(row?.cashBankAccountName || '—')}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">${esc(t('tx.print.against'))}</span>
                <span class="detail-value">${esc(against || '—')}</span>
            </div>
        </div>
        <div class="description-box">
            <span class="detail-label">${esc(t('gj.print.descMemo'))}</span>
            <p class="description-text">${esc(row?.notes || row?.generalNote || row?.reference || '')}</p>
        </div>
        ${signatures(t)}
    `;
    openPrintHtml(`${title} ${code}`.trim(), body);
}

export function journalFromPayReceipt(row, kind) {
    const isPayment = kind === 'payment';
    const cash = row?.cashBankAccountName || '';
    const against = [row?.accountCode, row?.accountName].filter(Boolean).join(' — ');
    const amount = Number(row?.amount || 0);
    return {
        entryNumber: row?.voucherNumber,
        date: row?.date,
        type: isPayment ? 'Payment' : 'Receipt',
        status: row?.status,
        description: row?.notes || row?.generalNote || '',
        totalDebit: amount,
        totalCredit: amount,
        lines: isPayment
            ? [
                { accountName: against, description: row?.payeeName || '', debit: amount, credit: 0 },
                { accountName: cash, description: '', debit: 0, credit: amount },
            ]
            : [
                { accountName: cash, description: '', debit: amount, credit: 0 },
                { accountName: against, description: row?.payeeName || '', debit: 0, credit: amount },
            ],
    };
}
