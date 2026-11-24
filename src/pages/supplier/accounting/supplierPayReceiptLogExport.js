import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

function money(n) {
    return Number(n || 0).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function stampFile() {
    return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
}

function generatedAt() {
    return new Date().toLocaleString('en-GB', {
        timeZone: 'Asia/Riyadh',
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function classifyPayReceiptCashKind(journal) {
    const kind = String(journal?.cashKind || '').toLowerCase();
    if (kind === 'bank' || kind === 'cash') return kind;
    const hay = String(journal?.cashAccountLabel || '').toLowerCase();
    if (/\bbank\b|بنك|مصرف/.test(hay)) return 'bank';
    if (/\bcash\b|صندوق|نقد|register|petty/.test(hay)) return 'cash';
    return 'unknown';
}

export const ALL_MONEY_LOG_COMBO = '__all__';

export function journalMatchesMoneyLogCombo(journal, { variant, comboId, comboLabel } = {}) {
    if (!comboId || comboId === ALL_MONEY_LOG_COMBO) return true;
    const id = String(comboId);
    if (variant === 'payment') {
        if (journal?.cashAccountId && String(journal.cashAccountId) === id) return true;
        const hay = String(journal?.cashAccountLabel || '').trim().toLowerCase();
        const label = String(comboLabel || '').replace(/\s+[—–-]\s+sar\b.*/i, '').trim().toLowerCase();
        if (hay && label && (hay === label || hay.startsWith(label))) return true;
        return false;
    }
    const keys = Array.isArray(journal?.counterpartyKeys) ? journal.counterpartyKeys.map(String) : [];
    if (keys.includes(id)) return true;
    const hay = String(journal?.counterpartyLabel || '').trim().toLowerCase();
    const label = String(comboLabel || '').trim().toLowerCase();
    if (hay && label && hay === label) return true;
    return false;
}

export function filterMoneyLogJournals(journals, meta) {
    return (Array.isArray(journals) ? journals : []).filter((j) =>
        journalMatchesMoneyLogCombo(j, meta),
    );
}

export function summarizePayReceiptLogKpis(journals) {
    let cash = 0;
    let bank = 0;
    let total = 0;
    let lineCount = 0;
    for (const j of Array.isArray(journals) ? journals : []) {
        if (String(j?.status || '') === 'void') continue;
        const amt = Number(j?.totalDebit || 0);
        if (!Number.isFinite(amt)) continue;
        lineCount += 1;
        total += amt;
        const kind = classifyPayReceiptCashKind(j);
        if (kind === 'bank') bank += amt;
        else if (kind === 'cash') cash += amt;
    }
    return {
        cash: Number(cash.toFixed(2)),
        bank: Number(bank.toFixed(2)),
        total: Number(total.toFixed(2)),
        lineCount,
    };
}

export function buildPayReceiptLogExportPayload({
    variant = 'payment',
    journals = [],
    filters = {},
    kpis = {},
}) {
    const isPayment = variant === 'payment';
    return {
        title: isPayment ? 'Payments log' : 'Receipts log',
        subtitle: isPayment
            ? 'Money paid from cash or bank'
            : 'Money received into cash or bank',
        generatedAt: generatedAt(),
        filters: {
            dateFrom: filters.dateFrom || 'All dates',
            dateTo: filters.dateTo || 'All dates',
            search: filters.search || 'All entries',
            combo: filters.comboLabel || (isPayment ? 'All paid from' : 'All received from'),
        },
        kpis: {
            cash: Number(kpis.cash || 0),
            bank: Number(kpis.bank || 0),
            total: Number(kpis.total || 0),
        },
        kpiLabels: isPayment
            ? { cash: 'Paid cash', bank: 'Paid bank', total: 'Total paid' }
            : { cash: 'Received cash', bank: 'Received bank', total: 'Total received' },
        columns: {
            counterparty: isPayment ? 'Paid to' : 'Received from',
            ledger: isPayment ? 'Expense / AP account' : 'Against account',
            cash: isPayment ? 'Paid from (cash/bank)' : 'Received in (cash/bank)',
        },
        rows: (Array.isArray(journals) ? journals : []).map((j, idx) => ({
            no: idx + 1,
            date: String(j.date || '').slice(0, 10),
            entryNumber: j.entryNumber || '—',
            counterparty: j.counterpartyLabel || '—',
            ledger: j.ledgerAccountLabel || '—',
            cash: j.cashAccountLabel || '—',
            description: j.description || '—',
            reference: j.reference || '—',
            status: j.lastEditedAt ? 'Edited' : j.status || 'Posted',
            total: Number(j.totalDebit || 0),
        })),
    };
}

export function exportPayReceiptLogPdf(input) {
    const data = buildPayReceiptLogExportPayload(input);
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 28;

    doc.setFillColor(17, 24, 39);
    doc.rect(0, 0, pageW, 62, 'F');
    doc.setFillColor(245, 158, 11);
    doc.rect(0, 62, pageW, 4, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Filter Supplier Portal', margin, 26);
    doc.setFontSize(12);
    doc.text(data.title, margin, 46);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Generated ${data.generatedAt} (Asia/Riyadh)`, pageW - margin, 46, {
        align: 'right',
    });

    let y = 84;
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Applied filters', margin, y);
    y += 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    [
        `From: ${data.filters.dateFrom}    To: ${data.filters.dateTo}`,
        `Search: ${data.filters.search}`,
        `${input.variant === 'receipt' ? 'Received from' : 'Paid from'}: ${data.filters.combo}`,
    ].forEach((line) => {
        doc.text(line, margin, y);
        y += 13;
    });
    y += 8;
    const kpis = [
        [data.kpiLabels.cash, `SAR ${money(data.kpis.cash)}`],
        [data.kpiLabels.bank, `SAR ${money(data.kpis.bank)}`],
        [data.kpiLabels.total, `SAR ${money(data.kpis.total)}`],
    ];
    const kpiW = (pageW - margin * 2 - 12) / 3;
    kpis.forEach((kpi, i) => {
        const x = margin + i * (kpiW + 6);
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(x, y, kpiW, 36, 4, 4, 'FD');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(kpi[0], x + 10, y + 14);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text(kpi[1], x + 10, y + 28);
    });

    const body = data.rows.map((r) => [
        String(r.no),
        r.date,
        r.entryNumber,
        r.counterparty,
        r.ledger,
        r.cash,
        r.description,
        r.reference,
        r.status,
        money(r.total),
    ]);
    body.push(['', '', '', '', '', '', 'TOTAL', '', '', money(data.kpis.total)]);

    autoTable(doc, {
        startY: y + 48,
        head: [[
            '#',
            'Date',
            'Entry #',
            data.columns.counterparty,
            data.columns.ledger,
            data.columns.cash,
            'Description',
            'Reference',
            'Status',
            'Total (SAR)',
        ]],
        body,
        margin: { left: margin, right: margin, bottom: 36 },
        tableWidth: pageW - margin * 2,
        styles: {
            font: 'helvetica',
            fontSize: 7.5,
            cellPadding: 3.5,
            overflow: 'linebreak',
            valign: 'middle',
            textColor: [15, 23, 42],
            lineColor: [226, 232, 240],
            lineWidth: 0.4,
        },
        headStyles: {
            fillColor: [31, 41, 55],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 7,
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
            0: { cellWidth: 22, halign: 'center' },
            1: { cellWidth: 58, halign: 'center' },
            2: { cellWidth: 56 },
            9: { cellWidth: 62, halign: 'right', fontStyle: 'bold' },
        },
        didParseCell(hook) {
            if (hook.section === 'body' && hook.row.index === body.length - 1) {
                hook.cell.styles.fontStyle = 'bold';
                hook.cell.styles.fillColor = [255, 247, 237];
            }
        },
        didDrawPage(hook) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            doc.text('Confidential — Filter Supplier Portal', margin, pageH - 16);
            doc.text(`Page ${hook.pageNumber}`, pageW - margin, pageH - 16, {
                align: 'right',
            });
        },
    });

    const slug = input.variant === 'receipt' ? 'receipts-log' : 'payments-log';
    doc.save(`${slug}-${stampFile()}.pdf`);
    return data;
}

export function exportPayReceiptLogExcel(input) {
    const data = buildPayReceiptLogExportPayload(input);
    const header = [
        ['Filter Supplier Portal'],
        [data.title],
        [`Generated ${data.generatedAt} (Asia/Riyadh)`],
        [],
        ['From', data.filters.dateFrom],
        ['To', data.filters.dateTo],
        ['Search', data.filters.search],
        [input.variant === 'receipt' ? 'Received from' : 'Paid from', data.filters.combo],
        [],
        [data.kpiLabels.cash, data.kpis.cash],
        [data.kpiLabels.bank, data.kpis.bank],
        [data.kpiLabels.total, data.kpis.total],
        [],
        [
            '#',
            'Date',
            'Entry #',
            data.columns.counterparty,
            data.columns.ledger,
            data.columns.cash,
            'Description',
            'Reference',
            'Status',
            'Total (SAR)',
        ],
    ];
    const table = data.rows.map((r) => [
        r.no,
        r.date,
        r.entryNumber,
        r.counterparty,
        r.ledger,
        r.cash,
        r.description,
        r.reference,
        r.status,
        r.total,
    ]);
    table.push(['', '', '', '', '', '', 'TOTAL', '', '', data.kpis.total]);
    const ws = XLSX.utils.aoa_to_sheet([...header, ...table]);
    ws['!cols'] = [
        { wch: 5 },
        { wch: 12 },
        { wch: 12 },
        { wch: 28 },
        { wch: 32 },
        { wch: 28 },
        { wch: 28 },
        { wch: 16 },
        { wch: 12 },
        { wch: 14 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, data.title.slice(0, 31));
    const slug = input.variant === 'receipt' ? 'receipts-log' : 'payments-log';
    XLSX.writeFile(wb, `${slug}-${stampFile()}.xlsx`);
    return data;
}
