import * as XLSX from 'xlsx';

/** Wide capture canvas matched to A4 landscape usable width. */
const PDF_CAPTURE_WIDTH = 1700;
const ARABIC_FONT_LINK_ID = 'filter-noto-sans-arabic-font';
const A4_LANDSCAPE = { w: 841.89, h: 595.28 };
/** Page margins: L/R 1 cm, T/B 1.5 cm. */
const PAGE_MARGIN_X_CM = 1;
const PAGE_MARGIN_Y_CM = 1.5;
const PDF_MARGIN_X_PT = (PAGE_MARGIN_X_CM / 2.54) * 72;
const PDF_MARGIN_Y_PT = (PAGE_MARGIN_Y_CM / 2.54) * 72;
const ROW_HEIGHT_PT = 36;
const GROUP_HEADER_H_PT = 24;
const TOTAL_ROW_H_PT = 28;
const THEAD_HEIGHT_PT = 34;
const COL_COUNT = 10;

const L = {
    title: 'Salary Advances Sheet / كشف سلف الرواتب',
    titleCont: 'Salary Advances Sheet (continued) / كشف سلف الرواتب (تابع)',
    subtitle: 'Branch-wise advances list / قائمة السلف حسب الفرع',
    branch: 'Branch / الفرع',
    statusFilter: 'Status filter / فلتر الحالة',
    search: 'Search / بحث',
    records: 'Records / السجلات',
    totalAmount: 'Total amount (SAR) / إجمالي المبلغ',
    totalOutstanding: 'Total outstanding (SAR) / إجمالي المتبقي',
    generated: 'Generated / تاريخ الإنشاء',
    continued: 'Continued / تابع',
    pageOf: (p, n) => `Page ${p} of ${n} / صفحة ${p} من ${n}`,
    colDate: 'Date<br/><span class="ar" dir="rtl">التاريخ</span>',
    colBranch: 'Branch<br/><span class="ar" dir="rtl">الفرع</span>',
    colEmployee: 'Employee<br/><span class="ar" dir="rtl">الموظف</span>',
    colReason: 'Reason<br/><span class="ar" dir="rtl">السبب</span>',
    colPaidFrom: 'Paid from<br/><span class="ar" dir="rtl">الدفع من</span>',
    colAmount: 'Amount<br/><span class="ar" dir="rtl">المبلغ</span>',
    colRepaid: 'Repaid<br/><span class="ar" dir="rtl">المسدد</span>',
    colBalance: 'Balance<br/><span class="ar" dir="rtl">المتبقي</span>',
    colStatus: 'Status<br/><span class="ar" dir="rtl">الحالة</span>',
    colSignature: 'Signature<br/><span class="ar" dir="rtl">التوقيع</span>',
    colRows: 'Rows<br/><span class="ar" dir="rtl">الصفوف</span>',
    branchTotal: (b) => `${b} — Branch total / إجمالي الفرع`,
    pageTotal: 'Page total / إجمالي الصفحة',
    grandTotal: 'Grand total / الإجمالي الكلي',
    footerNote:
        'Amounts in SAR. Signature blank for wet-ink. Page totals = this page only. / المبالغ بالريال. عمود التوقيع فارغ. إجمالي الصفحة لهذه الصفحة فقط.',
    allBranches: 'All branches / كل الفروع',
    allStatuses: 'All / الكل',
    pettyCash: 'Petty cash / النثرية',
    summaryTitle: 'Branch Summary / ملخص الفروع',
    summarySub: 'Totals by branch and final outstanding / إجماليات حسب الفرع والمتبقي النهائي',
    finalOutstanding: 'Final outstanding balance / الرصيد المتبقي النهائي',
    rowsN: (n) => `${n} row${n === 1 ? '' : 's'} / ${n} صف`,
    statusPending: 'Pending / قيد الانتظار',
    statusApproved: 'Approved / موافق عليه',
    statusRepaid: 'Settled / مسدد',
    statusRejected: 'Rejected / مرفوض',
    statusOther: (s) => `${s}`,
};

function safeFileSlug(s) {
    const t = String(s || 'export')
        .replace(/[^\w.-]+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 80);
    return t || 'export';
}

function stamp() {
    return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
}

function escapeHtml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function fmtMoney(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return '0.00';
    return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso) {
    if (!iso) return '-';
    try {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return '-';
        return d.toLocaleDateString('en-GB');
    } catch {
        return '-';
    }
}

function formatStatus(status) {
    const s = String(status || '').toLowerCase();
    if (s === 'pending') return L.statusPending;
    if (s === 'approved') return L.statusApproved;
    if (s === 'repaid' || s === 'settled') return L.statusRepaid;
    if (s === 'rejected') return L.statusRejected;
    return status ? L.statusOther(status) : '—';
}

function moneyFields(a) {
    return {
        amount: Number(a.amount) || 0,
        repaid: Number(a.repaidAmount) || 0,
        balance: Number(a.balance) || 0,
    };
}

function emptyTotals() {
    return { amount: 0, repaid: 0, balance: 0, count: 0 };
}

function addTotals(into, m) {
    into.amount += m.amount;
    into.repaid += m.repaid;
    into.balance += m.balance;
    into.count += 1;
}

function mapExportRows(rows) {
    return (rows || []).map((a) => {
        const m = moneyFields(a);
        return {
            date: fmtDate(a.date),
            branch: a.branchName || L.allBranches,
            employee: a.employeeName || '-',
            reason: a.reason || '—',
            paidFrom: a.payFromAccountName || (a.payFromAccountId ? '—' : L.pettyCash),
            amount: fmtMoney(m.amount),
            repaid: fmtMoney(m.repaid),
            balance: fmtMoney(m.balance),
            status: formatStatus(a.status),
            signature: '',
            _m: m,
        };
    });
}

function sortRowsForSheet(mapped) {
    return [...mapped].sort((a, b) => {
        const ba = String(a.branch || '').localeCompare(String(b.branch || ''));
        if (ba !== 0) return ba;
        const da = String(a.date).localeCompare(String(b.date));
        if (da !== 0) return da;
        return String(a.employee || '').localeCompare(String(b.employee || ''));
    });
}

function buildSheetBlocks(mapped) {
    const sorted = sortRowsForSheet(mapped);
    const blocks = [];
    const branchSummaries = [];
    let i = 0;
    while (i < sorted.length) {
        const branch = sorted[i].branch || L.allBranches;
        const group = [];
        while (i < sorted.length && (sorted[i].branch || L.allBranches) === branch) {
            group.push(sorted[i]);
            i += 1;
        }
        const totals = emptyTotals();
        for (const r of group) addTotals(totals, r._m);
        branchSummaries.push({ branch, totals: { ...totals } });
        blocks.push({ type: 'group-header', branch });
        for (const r of group) blocks.push({ type: 'data', row: r });
        blocks.push({ type: 'group-total', branch, totals });
    }
    const grandTotals = emptyTotals();
    for (const b of branchSummaries) {
        grandTotals.amount += b.totals.amount;
        grandTotals.repaid += b.totals.repaid;
        grandTotals.balance += b.totals.balance;
        grandTotals.count += b.totals.count;
    }
    return { blocks, branchSummaries, grandTotals };
}

function blockHeightPx(block, heights) {
    if (block.type === 'group-header') return heights.groupHeader;
    if (block.type === 'group-total') return heights.groupTotal;
    return heights.data;
}

function packBlocksIntoPages(blocks, budgetFirstPx, budgetContPx, heights) {
    const pages = [];
    let pageBlocks = [];
    let used = 0;
    let pageIndex = 0;
    let openBranch = null;

    const budgetFor = () => (pageIndex === 0 ? budgetFirstPx : budgetContPx);

    const flush = () => {
        if (!pageBlocks.length) return;
        pages.push(pageBlocks);
        pageBlocks = [];
        used = 0;
        pageIndex += 1;
        if (openBranch) {
            const cont = {
                type: 'group-header',
                branch: `${openBranch} (continued / تابع)`,
            };
            pageBlocks.push(cont);
            used += blockHeightPx(cont, heights);
        }
    };

    for (const block of blocks) {
        const h = blockHeightPx(block, heights);
        const budget = budgetFor();
        if (pageBlocks.length > 0 && used + h > budget + 0.5) {
            flush();
        }
        if (
            block.type === 'group-header'
            && pageBlocks.length === 1
            && pageBlocks[0].type === 'group-header'
            && String(pageBlocks[0].branch).startsWith(`${block.branch} (continued`)
        ) {
            pageBlocks[0] = block;
            used = blockHeightPx(block, heights);
            openBranch = block.branch;
            continue;
        }
        if (block.type === 'group-header') openBranch = block.branch;
        pageBlocks.push(block);
        used += h;
        if (block.type === 'group-total') openBranch = null;
    }
    if (pageBlocks.length) pages.push(pageBlocks);
    return pages.length ? pages : [[]];
}

async function ensurePdfFonts() {
    if (!document.getElementById(ARABIC_FONT_LINK_ID)) {
        const link = document.createElement('link');
        link.id = ARABIC_FONT_LINK_ID;
        link.rel = 'stylesheet';
        link.href =
            'https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;600;700&family=Poppins:wght@400;600;700&display=swap';
        document.head.appendChild(link);
    }
    if (document.fonts?.load) {
        await Promise.all([
            document.fonts.load('400 12px "Noto Sans Arabic"'),
            document.fonts.load('600 12px "Noto Sans Arabic"'),
            document.fonts.load('700 12px "Poppins"'),
        ]).catch(() => {});
        await document.fonts.ready.catch(() => {});
    }
    await new Promise((r) => setTimeout(r, 120));
}

function totalsCellsHtml(totals, label, extraClass = '') {
    return `
        <tr class="tot-row ${extraClass}">
            <td colspan="5" class="tot-label">${escapeHtml(label)}</td>
            <td class="num bold">${escapeHtml(fmtMoney(totals.amount))}</td>
            <td class="num bold">${escapeHtml(fmtMoney(totals.repaid))}</td>
            <td class="num bold">${escapeHtml(fmtMoney(totals.balance))}</td>
            <td class="tot-count">${escapeHtml(L.rowsN(totals.count))}</td>
            <td></td>
        </tr>
    `;
}

function sharedPdfStyles(isFirstPage) {
    return `
        .adv-pdf {
            font-family: 'Poppins', 'Noto Sans Arabic', sans-serif;
            color: #0f172a;
            background: #fff;
            padding: 0;
            box-sizing: border-box;
            width: ${PDF_CAPTURE_WIDTH}px;
        }
        .adv-pdf .ar { display: block; font-size: 0.92em; font-weight: 600; }
        .adv-pdf-banner {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            gap: 12px;
            margin-bottom: 4px;
            padding-bottom: 4px;
            border-bottom: 2px solid #0f172a;
        }
        .adv-pdf h1 {
            margin: 0;
            font-size: ${isFirstPage ? 14 : 12}pt;
            font-weight: 700;
        }
        .adv-pdf-banner-sub {
            margin: 1px 0 0;
            font-size: 9pt;
            color: #64748b;
            font-weight: 600;
        }
        .adv-pdf-meta {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 2px 12px;
            font-size: 9pt;
            color: #475569;
            line-height: 1.3;
            margin-bottom: 4px;
        }
        .adv-pdf-meta strong { color: #0f172a; }
        .adv-pdf table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11pt;
            table-layout: fixed;
        }
        .adv-pdf thead th {
            height: ${THEAD_HEIGHT_PT}pt;
            background: #0f172a;
            color: #fff;
            font-weight: 700;
            text-align: left;
            padding: 2px 5px;
            border: 1px solid #0f172a;
            font-size: 8.5pt;
            vertical-align: middle;
            line-height: 1.15;
        }
        .adv-pdf thead th .ar { font-size: 7.5pt; }
        .adv-pdf th.num { text-align: right; }
        .adv-pdf tbody tr.data-row { height: ${ROW_HEIGHT_PT}pt; }
        .adv-pdf tbody tr.data-row td {
            height: ${ROW_HEIGHT_PT}pt;
            max-height: ${ROW_HEIGHT_PT}pt;
            padding: 0 5px;
            border: 1px solid #cbd5e1;
            vertical-align: middle;
            word-wrap: break-word;
            overflow-wrap: anywhere;
            line-height: 1.2;
            box-sizing: border-box;
            font-size: 11pt;
        }
        .adv-pdf tbody tr.data-row:nth-child(even) td { background: #f8fafc; }
        .adv-pdf tr.group-row td {
            height: ${GROUP_HEADER_H_PT}pt;
            background: #e2e8f0;
            color: #0f172a;
            font-weight: 700;
            font-size: 11pt;
            padding: 0 8px;
            border: 1px solid #94a3b8;
            vertical-align: middle;
        }
        .adv-pdf tr.tot-row td {
            height: ${TOTAL_ROW_H_PT}pt;
            background: #f1f5f9;
            border: 1px solid #94a3b8;
            padding: 0 5px;
            vertical-align: middle;
            font-size: 10pt;
        }
        .adv-pdf tr.tot-row.grand td {
            background: #0f172a;
            color: #fff;
            border-color: #0f172a;
        }
        .adv-pdf tr.tot-row.grand .tot-label,
        .adv-pdf tr.tot-row.grand .tot-count,
        .adv-pdf tr.tot-row.grand .num { color: #fff; }
        .adv-pdf tr.tot-row .tot-label {
            font-weight: 700;
            color: #0f172a;
            text-align: right;
        }
        .adv-pdf tr.tot-row .tot-count {
            color: #64748b;
            font-size: 9pt;
        }
        .adv-pdf .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .adv-pdf .bold { font-weight: 700; }
        .adv-pdf .sig { background: #fff; min-width: 72px; }
        .adv-pdf-pagefoot {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            margin-top: 4px;
            padding-top: 3px;
            border-top: 1px solid #e2e8f0;
            font-size: 8pt;
            color: #94a3b8;
        }
        .adv-pdf-summary-note {
            margin: 8px 0 6px;
            font-size: 11pt;
            font-weight: 700;
            color: #0f172a;
        }
        .adv-pdf table.summary-table thead th {
            height: auto;
            min-height: ${THEAD_HEIGHT_PT}pt;
            padding: 6px 8px;
        }
        .adv-pdf table.summary-table td {
            padding: 7px 8px;
            border: 1px solid #cbd5e1;
            vertical-align: middle;
        }
        .adv-pdf table.summary-table tr:nth-child(even) td { background: #f8fafc; }
        .adv-pdf table.summary-table tr.grand td {
            background: #0f172a;
            color: #fff;
            font-weight: 700;
            border-color: #0f172a;
        }
        .adv-pdf .final-paid {
            margin-top: 10px;
            padding: 10px 12px;
            background: #fef3c7;
            border: 1px solid #f59e0b;
            border-radius: 6px;
            font-size: 11pt;
            font-weight: 700;
            color: #92400e;
            display: flex;
            justify-content: space-between;
            gap: 16px;
        }
    `;
}

function renderPageBodyHtml(pageBlocks, { isLastDataPage, grandTotals }) {
    if (!pageBlocks.length) {
        return `<tr><td colspan="${COL_COUNT}" style="text-align:center;color:#94a3b8;height:${ROW_HEIGHT_PT}pt;">No records / لا سجلات</td></tr>`;
    }
    const pageTotals = emptyTotals();
    const parts = [];
    for (const b of pageBlocks) {
        if (b.type === 'group-header') {
            parts.push(`
                <tr class="group-row">
                    <td colspan="${COL_COUNT}" dir="auto">${escapeHtml(b.branch)}</td>
                </tr>
            `);
            continue;
        }
        if (b.type === 'group-total') {
            parts.push(totalsCellsHtml(b.totals, L.branchTotal(b.branch)));
            continue;
        }
        if (b.type === 'data') {
            const r = b.row;
            addTotals(pageTotals, r._m);
            parts.push(`
                <tr class="data-row">
                    <td>${escapeHtml(r.date)}</td>
                    <td dir="auto">${escapeHtml(r.branch)}</td>
                    <td dir="auto">${escapeHtml(r.employee)}</td>
                    <td dir="auto">${escapeHtml(r.reason)}</td>
                    <td dir="auto">${escapeHtml(r.paidFrom)}</td>
                    <td class="num bold">${escapeHtml(r.amount)}</td>
                    <td class="num">${escapeHtml(r.repaid)}</td>
                    <td class="num">${escapeHtml(r.balance)}</td>
                    <td dir="auto">${escapeHtml(r.status)}</td>
                    <td class="sig"></td>
                </tr>
            `);
        }
    }
    parts.push(totalsCellsHtml(pageTotals, L.pageTotal));
    if (isLastDataPage && grandTotals) {
        parts.push(totalsCellsHtml(grandTotals, L.grandTotal, 'grand'));
    }
    return parts.join('');
}

function displayBranchName(branchName) {
    return /^all branches$/i.test(String(branchName || '').trim())
        ? L.allBranches
        : branchName;
}

function buildAdvancesPageHtml({
    pageBlocks,
    branchName,
    statusLabel,
    search,
    totalAmount,
    totalOutstanding,
    totalRecords,
    pageIndex,
    totalPages,
    isFirstPage,
    isLastDataPage = false,
    grandTotals = null,
    measureChromeOnly = false,
}) {
    const displayBranch = displayBranchName(branchName);
    const metaLines = isFirstPage
        ? [
            `<div><strong>${L.branch}:</strong> <span dir="auto">${escapeHtml(displayBranch)}</span></div>`,
            `<div><strong>${L.statusFilter}:</strong> ${escapeHtml(statusLabel || L.allStatuses)}</div>`,
            search?.trim()
                ? `<div><strong>${L.search}:</strong> <span dir="auto">${escapeHtml(search.trim())}</span></div>`
                : '',
            `<div><strong>${L.records}:</strong> ${totalRecords}</div>`,
            `<div><strong>${L.totalAmount}:</strong> ${escapeHtml(fmtMoney(totalAmount))}</div>`,
            `<div><strong>${L.totalOutstanding}:</strong> ${escapeHtml(fmtMoney(totalOutstanding))}</div>`,
            `<div><strong>${L.generated}:</strong> ${escapeHtml(new Date().toLocaleString('en-GB'))}</div>`,
        ].filter(Boolean).join('')
        : [
            `<div><strong>${L.branch}:</strong> <span dir="auto">${escapeHtml(displayBranch)}</span></div>`,
            `<div><strong>${L.statusFilter}:</strong> ${escapeHtml(statusLabel || L.allStatuses)}</div>`,
            `<div><strong>${L.continued}</strong> · ${escapeHtml(L.pageOf(pageIndex + 1, totalPages))}</div>`,
        ].join('');

    return `
        <style>${sharedPdfStyles(isFirstPage)}</style>
        <div class="adv-pdf">
            <div class="adv-pdf-banner">
                <div>
                    <h1>${isFirstPage ? L.title : L.titleCont}</h1>
                    <p class="adv-pdf-banner-sub">${L.subtitle}</p>
                </div>
                <div style="text-align:right;font-size:10pt;color:#334155;font-weight:600;">
                    ${isFirstPage
                        ? `${L.totalOutstanding}: ${escapeHtml(fmtMoney(totalOutstanding))}`
                        : L.pageOf(pageIndex + 1, totalPages)}
                </div>
            </div>
            <div class="adv-pdf-meta">${metaLines}</div>
            <table>
                <thead>
                    <tr>
                        <th style="width:8%">${L.colDate}</th>
                        <th style="width:12%">${L.colBranch}</th>
                        <th style="width:12%">${L.colEmployee}</th>
                        <th style="width:14%">${L.colReason}</th>
                        <th style="width:12%">${L.colPaidFrom}</th>
                        <th class="num" style="width:9%">${L.colAmount}</th>
                        <th class="num" style="width:9%">${L.colRepaid}</th>
                        <th class="num" style="width:9%">${L.colBalance}</th>
                        <th style="width:8%">${L.colStatus}</th>
                        <th style="width:7%">${L.colSignature}</th>
                    </tr>
                </thead>
                <tbody>
                    ${measureChromeOnly ? '' : renderPageBodyHtml(pageBlocks, { isLastDataPage, grandTotals })}
                </tbody>
            </table>
            <div class="adv-pdf-pagefoot">
                <span>${L.footerNote}</span>
                <span>${L.pageOf(pageIndex + 1, totalPages)}</span>
            </div>
        </div>
    `;
}

function buildSummaryPageHtml({
    branchSummaries,
    grandTotals,
    branchName,
    statusLabel,
    totalRecords,
    pageIndex,
    totalPages,
}) {
    const displayBranch = displayBranchName(branchName);
    const bodyRows = branchSummaries.map((b) => `
        <tr>
            <td dir="auto">${escapeHtml(b.branch)}</td>
            <td class="num">${escapeHtml(fmtMoney(b.totals.amount))}</td>
            <td class="num">${escapeHtml(fmtMoney(b.totals.repaid))}</td>
            <td class="num bold">${escapeHtml(fmtMoney(b.totals.balance))}</td>
            <td class="num">${b.totals.count}</td>
        </tr>
    `).join('');

    return `
        <style>${sharedPdfStyles(true)}</style>
        <div class="adv-pdf">
            <div class="adv-pdf-banner">
                <div>
                    <h1>${L.summaryTitle}</h1>
                    <p class="adv-pdf-banner-sub">${L.summarySub}</p>
                </div>
                <div style="text-align:right;font-size:10pt;color:#334155;font-weight:600;">
                    ${L.pageOf(pageIndex + 1, totalPages)}
                </div>
            </div>
            <div class="adv-pdf-meta">
                <div><strong>${L.branch}:</strong> <span dir="auto">${escapeHtml(displayBranch)}</span></div>
                <div><strong>${L.statusFilter}:</strong> ${escapeHtml(statusLabel || L.allStatuses)}</div>
                <div><strong>${L.records}:</strong> ${totalRecords}</div>
            </div>
            <p class="adv-pdf-summary-note">${L.summaryTitle}</p>
            <table class="summary-table">
                <thead>
                    <tr>
                        <th style="width:36%">${L.colBranch}</th>
                        <th class="num" style="width:16%">${L.colAmount}</th>
                        <th class="num" style="width:16%">${L.colRepaid}</th>
                        <th class="num" style="width:16%">${L.colBalance}</th>
                        <th class="num" style="width:16%">${L.colRows}</th>
                    </tr>
                </thead>
                <tbody>
                    ${bodyRows || '<tr><td colspan="5" style="text-align:center;color:#94a3b8;">No records / لا سجلات</td></tr>'}
                    <tr class="grand">
                        <td>${escapeHtml(L.grandTotal)}</td>
                        <td class="num">${escapeHtml(fmtMoney(grandTotals.amount))}</td>
                        <td class="num">${escapeHtml(fmtMoney(grandTotals.repaid))}</td>
                        <td class="num">${escapeHtml(fmtMoney(grandTotals.balance))}</td>
                        <td class="num">${grandTotals.count}</td>
                    </tr>
                </tbody>
            </table>
            <div class="final-paid">
                <span>${L.finalOutstanding}</span>
                <span>SAR ${escapeHtml(fmtMoney(grandTotals.balance))}</span>
            </div>
            <div class="adv-pdf-pagefoot">
                <span>${L.footerNote}</span>
                <span>${L.pageOf(pageIndex + 1, totalPages)}</span>
            </div>
        </div>
    `;
}

function sampleDataRow() {
    return {
        date: '01/01/2026',
        branch: 'Sample Branch',
        employee: 'Sample Employee',
        reason: 'Salary Advance',
        paidFrom: 'Cash',
        amount: '100.00',
        repaid: '0.00',
        balance: '100.00',
        status: L.statusPending,
        signature: '',
        _m: { amount: 100, repaid: 0, balance: 100 },
    };
}

async function measureLayout(mount, sampleArgs) {
    const waitFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    mount.innerHTML = buildAdvancesPageHtml({
        ...sampleArgs,
        pageBlocks: [],
        pageIndex: 0,
        totalPages: 1,
        isFirstPage: true,
        measureChromeOnly: true,
    });
    await waitFrame();
    const firstChromePx = mount.querySelector('.adv-pdf')?.scrollHeight || 140;

    mount.innerHTML = buildAdvancesPageHtml({
        ...sampleArgs,
        pageBlocks: [],
        pageIndex: 1,
        totalPages: 2,
        isFirstPage: false,
        measureChromeOnly: true,
    });
    await waitFrame();
    const contChromePx = mount.querySelector('.adv-pdf')?.scrollHeight || 110;

    const probe = sampleDataRow();
    const probeTotals = emptyTotals();
    addTotals(probeTotals, probe._m);
    mount.innerHTML = buildAdvancesPageHtml({
        ...sampleArgs,
        pageBlocks: [
            { type: 'group-header', branch: 'PROBE BRANCH' },
            { type: 'data', row: probe },
            { type: 'group-total', branch: 'PROBE BRANCH', totals: probeTotals },
        ],
        pageIndex: 0,
        totalPages: 1,
        isFirstPage: true,
        isLastDataPage: true,
        grandTotals: probeTotals,
    });
    await waitFrame();
    const root = mount.querySelector('.adv-pdf');
    const groupEl = root?.querySelector('tr.group-row');
    const dataEl = root?.querySelector('tr.data-row');
    const totEls = root?.querySelectorAll('tr.tot-row');
    const groupHeader = Math.ceil(groupEl?.getBoundingClientRect().height || 28);
    const data = Math.ceil(dataEl?.getBoundingClientRect().height || 45);
    const groupTotal = Math.ceil(totEls?.[0]?.getBoundingClientRect().height || 32);
    const pageTotal = Math.ceil(totEls?.[1]?.getBoundingClientRect().height || 32);
    const grandTotalH = Math.ceil(totEls?.[2]?.getBoundingClientRect().height || pageTotal);

    const usableWpt = A4_LANDSCAPE.w - PDF_MARGIN_X_PT * 2;
    const usableHpt = A4_LANDSCAPE.h - PDF_MARGIN_Y_PT * 2;
    const pxPerPt = PDF_CAPTURE_WIDTH / usableWpt;
    const maxContentPx = usableHpt * pxPerPt;
    const tolPx = 2;

    const budgetFirstPx = Math.max(
        data * 2,
        maxContentPx - firstChromePx - pageTotal - grandTotalH - tolPx,
    );
    const budgetContPx = Math.max(
        data * 2,
        maxContentPx - contChromePx - pageTotal - grandTotalH - tolPx,
    );

    return {
        budgetFirstPx,
        budgetContPx,
        usableWpt,
        heights: { data, groupHeader, groupTotal, pageTotal },
    };
}

async function capturePageToPng(mount, html, toPng) {
    mount.innerHTML = html;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const captureEl = mount.querySelector('.adv-pdf');
    if (!captureEl) throw new Error('Could not render advances PDF page.');
    const captureHeight = Math.max(captureEl.scrollHeight, captureEl.offsetHeight, 1);
    return toPng(captureEl, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        cacheBust: true,
        width: PDF_CAPTURE_WIDTH,
        height: captureHeight,
        style: {
            width: `${PDF_CAPTURE_WIDTH}px`,
            height: `${captureHeight}px`,
            backgroundColor: '#ffffff',
        },
    });
}

async function addPdfPageFromHtml(pdf, mount, html, toPng, usableWpt, addPage) {
    const imgData = await capturePageToPng(mount, html, toPng);
    const dims = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => reject(new Error('Invalid PNG from advances capture'));
        img.src = imgData;
    });
    const displayW = usableWpt;
    const displayH = (dims.h / dims.w) * displayW;
    if (addPage) pdf.addPage('a4', 'landscape');
    pdf.addImage(imgData, 'PNG', PDF_MARGIN_X_PT, PDF_MARGIN_Y_PT, displayW, displayH, undefined, 'FAST');
}

/**
 * @param {object} opts
 * @param {Array<object>} opts.rows
 */
export async function exportAdvancesPdf({
    rows = [],
    branchName = 'All branches',
    statusLabel = 'All',
    search = '',
}) {
    await ensurePdfFonts();

    const mapped = mapExportRows(rows);
    const totalAmount = mapped.reduce((sum, r) => sum + (r._m.amount || 0), 0);
    const totalOutstanding = mapped.reduce((sum, r) => sum + (r._m.balance || 0), 0);
    const totalRecords = mapped.length;
    const { blocks, branchSummaries, grandTotals } = buildSheetBlocks(mapped);

    const mount = document.createElement('div');
    mount.setAttribute('aria-hidden', 'true');
    mount.style.cssText = [
        'position:fixed',
        'left:-12000px',
        'top:0',
        `width:${PDF_CAPTURE_WIDTH}px`,
        'background:#fff',
        'pointer-events:none',
        'z-index:-1',
    ].join(';');
    document.body.appendChild(mount);

    try {
        const sampleArgs = {
            branchName,
            statusLabel,
            search,
            totalAmount,
            totalOutstanding,
            totalRecords,
        };
        const { budgetFirstPx, budgetContPx, usableWpt, heights } = await measureLayout(mount, sampleArgs);
        const dataPages = packBlocksIntoPages(blocks, budgetFirstPx, budgetContPx, heights);
        const totalPages = dataPages.length + 1;

        const [{ toPng }, { jsPDF }] = await Promise.all([
            import('html-to-image'),
            import('jspdf'),
        ]);

        const pdf = new jsPDF({
            orientation: 'landscape',
            unit: 'pt',
            format: 'a4',
            compress: true,
        });

        for (let pageIndex = 0; pageIndex < dataPages.length; pageIndex += 1) {
            const isLastDataPage = pageIndex === dataPages.length - 1;
            const html = buildAdvancesPageHtml({
                ...sampleArgs,
                pageBlocks: dataPages[pageIndex],
                pageIndex,
                totalPages,
                isFirstPage: pageIndex === 0,
                isLastDataPage,
                grandTotals,
            });
            await addPdfPageFromHtml(pdf, mount, html, toPng, usableWpt, pageIndex > 0);
        }

        const summaryHtml = buildSummaryPageHtml({
            branchSummaries,
            grandTotals,
            branchName,
            statusLabel,
            totalRecords,
            pageIndex: dataPages.length,
            totalPages,
        });
        await addPdfPageFromHtml(pdf, mount, summaryHtml, toPng, usableWpt, true);

        pdf.save(`salary-advances-${safeFileSlug(branchName)}-${stamp()}.pdf`);
    } finally {
        mount.remove();
    }
}

export function exportAdvancesExcel({
    rows = [],
    branchName = 'All branches',
    statusLabel = 'All',
    search = '',
}) {
    const mapped = mapExportRows(rows);
    const { blocks, branchSummaries, grandTotals } = buildSheetBlocks(mapped);
    const headerRows = [
        [L.title],
        [`${L.branch}: ${displayBranchName(branchName)}`],
        [`${L.statusFilter}: ${statusLabel || L.allStatuses}`],
        search?.trim() ? [`${L.search}: ${search.trim()}`] : null,
        [`${L.generated}: ${new Date().toLocaleString('en-GB')}`],
        [],
        [
            'Date / التاريخ',
            'Branch / الفرع',
            'Employee / الموظف',
            'Reason / السبب',
            'Paid from / الدفع من',
            'Amount / المبلغ',
            'Repaid / المسدد',
            'Balance / المتبقي',
            'Status / الحالة',
            'Signature / التوقيع',
        ],
    ].filter(Boolean);

    const dataRows = [];
    const rowHeights = [];
    for (const b of blocks) {
        if (b.type === 'group-header') {
            dataRows.push([b.branch, '', '', '', '', '', '', '', '', '']);
            rowHeights.push({ hpt: 20 });
            continue;
        }
        if (b.type === 'group-total') {
            dataRows.push([
                L.branchTotal(b.branch),
                '',
                '',
                '',
                '',
                fmtMoney(b.totals.amount),
                fmtMoney(b.totals.repaid),
                fmtMoney(b.totals.balance),
                L.rowsN(b.totals.count),
                '',
            ]);
            rowHeights.push({ hpt: 22 });
            continue;
        }
        if (b.type === 'data') {
            const r = b.row;
            dataRows.push([
                r.date,
                r.branch,
                r.employee,
                r.reason,
                r.paidFrom,
                r.amount,
                r.repaid,
                r.balance,
                r.status,
                r.signature,
            ]);
            rowHeights.push({ hpt: ROW_HEIGHT_PT });
        }
    }

    dataRows.push([
        L.grandTotal,
        '',
        '',
        '',
        '',
        fmtMoney(grandTotals.amount),
        fmtMoney(grandTotals.repaid),
        fmtMoney(grandTotals.balance),
        L.rowsN(grandTotals.count),
        '',
    ]);
    rowHeights.push({ hpt: 24 });

    dataRows.push([]);
    rowHeights.push({});
    dataRows.push([L.summaryTitle]);
    rowHeights.push({ hpt: 20 });
    dataRows.push([
        'Branch / الفرع',
        'Amount / المبلغ',
        'Repaid / المسدد',
        'Balance / المتبقي',
        'Rows / الصفوف',
    ]);
    rowHeights.push({ hpt: 20 });
    for (const b of branchSummaries) {
        dataRows.push([
            b.branch,
            fmtMoney(b.totals.amount),
            fmtMoney(b.totals.repaid),
            fmtMoney(b.totals.balance),
            b.totals.count,
        ]);
        rowHeights.push({ hpt: 20 });
    }
    dataRows.push([
        L.finalOutstanding,
        fmtMoney(grandTotals.amount),
        fmtMoney(grandTotals.repaid),
        fmtMoney(grandTotals.balance),
        grandTotals.count,
    ]);
    rowHeights.push({ hpt: 24 });

    const ws = XLSX.utils.aoa_to_sheet([...headerRows, ...dataRows]);
    ws['!rows'] = [
        ...Array.from({ length: headerRows.length }, () => ({})),
        ...rowHeights,
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Advances');
    XLSX.writeFile(wb, `salary-advances-${safeFileSlug(branchName)}-${stamp()}.xlsx`);
}
