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
const DEPT_HEADER_H_PT = 24;
const TOTAL_ROW_H_PT = 28;
const THEAD_HEIGHT_PT = 34;
const COL_COUNT = 12;

/** Bilingual EN + AR labels for the salary sheet PDF. */
const L = {
    title: 'Salary Payments Sheet / كشف رواتب المدفوعات',
    titleCont: 'Salary Payments Sheet (continued) / كشف رواتب المدفوعات (تابع)',
    subtitle: 'Department-wise · Managers & cashiers first / حسب القسم · المدراء والكاشير أولاً',
    branch: 'Branch / الفرع',
    period: 'Period / الفترة',
    empSearch: 'Employee search / بحث الموظف',
    records: 'Records / السجلات',
    totalNet: 'Total net salary after deductions (SAR) / إجمالي صافي الراتب بعد الخصومات',
    generated: 'Generated / تاريخ الإنشاء',
    continued: 'Continued / تابع',
    pageOf: (p, n) => `Page ${p} of ${n} / صفحة ${p} من ${n}`,
    colDate: 'Date<br/><span class="ar" dir="rtl">التاريخ</span>',
    colEmployee: 'Employee<br/><span class="ar" dir="rtl">الموظف</span>',
    colBranch: 'Branch<br/><span class="ar" dir="rtl">الفرع</span>',
    colPeriod: 'Period<br/><span class="ar" dir="rtl">الفترة</span>',
    colSalary: 'Salary<br/><span class="ar" dir="rtl">الراتب</span>',
    colReward: 'Reward<br/><span class="ar" dir="rtl">مكافأة</span>',
    colCommission: 'Commission<br/><span class="ar" dir="rtl">العمولة</span>',
    colGross: 'Gross Salary<br/><span class="ar" dir="rtl">الراتب الإجمالي</span>',
    colDeductions: 'Deductions<br/><span class="ar" dir="rtl">الخصومات</span>',
    colNet: 'Net Salary after deductions<br/><span class="ar" dir="rtl">صافي الراتب بعد الخصومات</span>',
    colSignature: 'Signature<br/><span class="ar" dir="rtl">التوقيع</span>',
    colTechnician: 'Technician<br/><span class="ar" dir="rtl">الفني</span>',
    colDepartment: 'Department<br/><span class="ar" dir="rtl">القسم</span>',
    colRows: 'Rows<br/><span class="ar" dir="rtl">الصفوف</span>',
    deptTotal: (d) => `${d} — Department total / إجمالي القسم`,
    pageTotal: 'Page total / إجمالي الصفحة',
    grandTotal: 'Grand total / الإجمالي الكلي',
    footerNote:
        'Amounts in SAR. Signature blank for wet-ink. Page totals = this page only. / المبالغ بالريال. عمود التوقيع فارغ. إجمالي الصفحة لهذه الصفحة فقط.',
    beginning: 'Beginning / البداية',
    today: 'Today / اليوم',
    allBranches: 'All branches / كل الفروع',
    summaryTitle: 'Department Summary / ملخص الأقسام',
    summarySub: 'Totals by department and final paid salary / إجماليات حسب القسم والراتب النهائي المدفوع',
    finalPaid: 'Final paid salary (Grand total) / الراتب النهائي المدفوع (الإجمالي الكلي)',
    ackAccepted: 'Accepted / مقبول',
    ackRejected: 'Rejected / مرفوض',
    ackAwaiting: 'Awaiting technician / بانتظار الفني',
    rowsN: (n) => `${n} row${n === 1 ? '' : 's'} / ${n} صف`,
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

function formatAckStatus(status, ackAt) {
    const s = String(status || 'pending').toLowerCase();
    if (s === 'accepted') {
        const when = ackAt ? new Date(ackAt).toLocaleString('en-GB') : '';
        return when ? `${L.ackAccepted} — ${when}` : L.ackAccepted;
    }
    if (s === 'rejected') {
        const when = ackAt ? new Date(ackAt).toLocaleString('en-GB') : '';
        return when ? `${L.ackRejected} — ${when}` : L.ackRejected;
    }
    return L.ackAwaiting;
}

function formatFilterRange(dateFrom, dateTo) {
    const from = dateFrom?.trim() ? fmtDate(dateFrom) : L.beginning;
    const to = dateTo?.trim() ? fmtDate(dateTo) : L.today;
    return `${from} → ${to}`;
}

function moneyFields(s) {
    const salary = Number(s.basicSalary ?? s.grossSalary) || 0;
    const rewardBonus = Number(s.rewardBonus) || 0;
    const commission = Number(s.commissionAmount) || 0;
    const grossSalary = salary + rewardBonus + commission;
    const deductions = Number(
        s.totalDeductions ?? (Number(s.advanceDeduction || 0) + Number(s.penalties || 0)),
    ) || 0;
    const netPaid = Number.isFinite(Number(s.netSalary))
        ? Number(s.netSalary)
        : Math.max(grossSalary - deductions, 0);
    return { salary, rewardBonus, commission, grossSalary, deductions, netPaid };
}

function emptyTotals() {
    return {
        salary: 0,
        rewardBonus: 0,
        commission: 0,
        grossSalary: 0,
        deductions: 0,
        netPaid: 0,
        count: 0,
    };
}

function addTotals(into, m) {
    into.salary += m.salary;
    into.rewardBonus += m.rewardBonus;
    into.commission += m.commission;
    into.grossSalary += m.grossSalary;
    into.deductions += m.deductions;
    into.netPaid += m.netPaid;
    into.count += 1;
}

function mapExportRows(rows) {
    return (rows || []).map((s) => {
        const m = moneyFields(s);
        return {
            date: fmtDate(s.paymentDate),
            employee: s.employeeName || '-',
            branch: s.branchName || '-',
            period: s.period || '-',
            salary: fmtMoney(m.salary),
            rewardBonus: fmtMoney(m.rewardBonus),
            commission: fmtMoney(m.commission),
            grossSalary: fmtMoney(m.grossSalary),
            deductions: fmtMoney(m.deductions),
            netPaid: fmtMoney(m.netPaid),
            signature: '',
            technician: formatAckStatus(s.technicianAckStatus, s.technicianAckAt),
            departmentName: s.departmentName || 'General',
            role: s.role || 'staff',
            roleRank: Number.isFinite(Number(s.roleRank)) ? Number(s.roleRank) : 50,
            _m: m,
        };
    });
}

function sortRowsForSalarySheet(mapped) {
    return [...mapped].sort((a, b) => {
        if (a.roleRank !== b.roleRank) return a.roleRank - b.roleRank;
        const da = String(a.departmentName || '').localeCompare(String(b.departmentName || ''));
        if (da !== 0) return da;
        const na = String(a.employee || '').localeCompare(String(b.employee || ''));
        if (na !== 0) return na;
        return String(a.date).localeCompare(String(b.date));
    });
}

function buildSheetBlocks(mapped) {
    const sorted = sortRowsForSalarySheet(mapped);
    const blocks = [];
    const deptSummaries = [];
    let i = 0;
    while (i < sorted.length) {
        const dept = sorted[i].departmentName || 'General';
        const rank = sorted[i].roleRank;
        const group = [];
        while (
            i < sorted.length
            && (sorted[i].departmentName || 'General') === dept
            && sorted[i].roleRank === rank
        ) {
            group.push(sorted[i]);
            i += 1;
        }
        const totals = emptyTotals();
        for (const r of group) addTotals(totals, r._m);
        deptSummaries.push({ department: dept, roleRank: rank, totals: { ...totals } });
        blocks.push({ type: 'dept-header', department: dept, roleRank: rank });
        for (const r of group) {
            blocks.push({ type: 'data', row: r });
        }
        blocks.push({ type: 'dept-total', department: dept, totals });
    }
    const grandTotals = emptyTotals();
    for (const d of deptSummaries) {
        grandTotals.salary += d.totals.salary;
        grandTotals.rewardBonus += d.totals.rewardBonus;
        grandTotals.commission += d.totals.commission;
        grandTotals.grossSalary += d.totals.grossSalary;
        grandTotals.deductions += d.totals.deductions;
        grandTotals.netPaid += d.totals.netPaid;
        grandTotals.count += d.totals.count;
    }
    return { blocks, deptSummaries, grandTotals };
}

function blockHeightPx(block, heights) {
    if (block.type === 'dept-header') return heights.deptHeader;
    if (block.type === 'dept-total') return heights.deptTotal;
    return heights.data;
}

function packBlocksIntoPages(blocks, budgetFirstPx, budgetContPx, heights) {
    const pages = [];
    let pageBlocks = [];
    let used = 0;
    let budget = budgetFirstPx;
    let openDept = null;

    const flush = () => {
        if (!pageBlocks.length) return;
        pages.push(pageBlocks);
        pageBlocks = [];
        used = 0;
        budget = budgetContPx;
        if (openDept) {
            const cont = {
                type: 'dept-header',
                department: `${openDept} (continued / تابع)`,
                roleRank: 0,
            };
            pageBlocks.push(cont);
            used += blockHeightPx(cont, heights);
        }
    };

    for (const block of blocks) {
        const h = blockHeightPx(block, heights);
        if (pageBlocks.length > 0 && used + h > budget + 0.5) {
            flush();
        }
        if (
            block.type === 'dept-header'
            && pageBlocks.length === 1
            && pageBlocks[0].type === 'dept-header'
            && String(pageBlocks[0].department).startsWith(`${block.department} (continued`)
        ) {
            pageBlocks[0] = block;
            used = blockHeightPx(block, heights);
            openDept = block.department;
            continue;
        }
        if (block.type === 'dept-header') {
            openDept = block.department;
        }
        pageBlocks.push(block);
        used += h;
        if (block.type === 'dept-total') {
            openDept = null;
        }
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
            <td colspan="4" class="tot-label">${escapeHtml(label)}</td>
            <td class="num bold">${escapeHtml(fmtMoney(totals.salary))}</td>
            <td class="num bold">${escapeHtml(fmtMoney(totals.rewardBonus))}</td>
            <td class="num bold">${escapeHtml(fmtMoney(totals.commission))}</td>
            <td class="num bold">${escapeHtml(fmtMoney(totals.grossSalary))}</td>
            <td class="num bold">${escapeHtml(fmtMoney(totals.deductions))}</td>
            <td class="num bold">${escapeHtml(fmtMoney(totals.netPaid))}</td>
            <td></td>
            <td class="tot-count">${escapeHtml(L.rowsN(totals.count))}</td>
        </tr>
    `;
}

function sharedPdfStyles(isFirstPage) {
    return `
        .salary-pdf {
            font-family: 'Poppins', 'Noto Sans Arabic', sans-serif;
            color: #0f172a;
            background: #fff;
            padding: 0;
            box-sizing: border-box;
            width: ${PDF_CAPTURE_WIDTH}px;
        }
        .salary-pdf .ar { display: block; font-size: 0.92em; font-weight: 600; }
        .salary-pdf-banner {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            gap: 12px;
            margin-bottom: 4px;
            padding-bottom: 4px;
            border-bottom: 2px solid #0f172a;
        }
        .salary-pdf h1 {
            margin: 0;
            font-size: ${isFirstPage ? 14 : 12}pt;
            font-weight: 700;
        }
        .salary-pdf-banner-sub {
            margin: 1px 0 0;
            font-size: 9pt;
            color: #64748b;
            font-weight: 600;
        }
        .salary-pdf-meta {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 2px 12px;
            font-size: 9pt;
            color: #475569;
            line-height: 1.3;
            margin-bottom: 4px;
        }
        .salary-pdf-meta strong { color: #0f172a; }
        .salary-pdf table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11pt;
            table-layout: fixed;
        }
        .salary-pdf thead th {
            height: ${THEAD_HEIGHT_PT}pt;
            background: #0f172a;
            color: #fff;
            font-weight: 700;
            text-align: left;
            padding: 2px 4px;
            border: 1px solid #0f172a;
            font-size: 8pt;
            vertical-align: middle;
            line-height: 1.15;
            text-transform: none;
        }
        .salary-pdf thead th .ar { font-size: 7.5pt; }
        .salary-pdf th.num { text-align: right; }
        .salary-pdf tbody tr.data-row { height: ${ROW_HEIGHT_PT}pt; }
        .salary-pdf tbody tr.data-row td {
            height: ${ROW_HEIGHT_PT}pt;
            max-height: ${ROW_HEIGHT_PT}pt;
            padding: 0 4px;
            border: 1px solid #cbd5e1;
            vertical-align: middle;
            word-wrap: break-word;
            overflow-wrap: anywhere;
            line-height: 1.2;
            box-sizing: border-box;
            font-size: 11pt;
        }
        .salary-pdf tbody tr.data-row:nth-child(even) td { background: #f8fafc; }
        .salary-pdf tr.dept-row td {
            height: ${DEPT_HEADER_H_PT}pt;
            background: #e2e8f0;
            color: #0f172a;
            font-weight: 700;
            font-size: 11pt;
            padding: 0 8px;
            border: 1px solid #94a3b8;
            vertical-align: middle;
        }
        .salary-pdf tr.tot-row td {
            height: ${TOTAL_ROW_H_PT}pt;
            background: #f1f5f9;
            border: 1px solid #94a3b8;
            padding: 0 4px;
            vertical-align: middle;
            font-size: 10pt;
        }
        .salary-pdf tr.tot-row.grand td {
            background: #0f172a;
            color: #fff;
            border-color: #0f172a;
        }
        .salary-pdf tr.tot-row.grand .tot-label,
        .salary-pdf tr.tot-row.grand .tot-count,
        .salary-pdf tr.tot-row.grand .num { color: #fff; }
        .salary-pdf tr.tot-row .tot-label {
            font-weight: 700;
            color: #0f172a;
            text-align: right;
        }
        .salary-pdf tr.tot-row .tot-count {
            color: #64748b;
            font-size: 9pt;
        }
        .salary-pdf .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .salary-pdf .bold { font-weight: 700; }
        .salary-pdf .sig { background: #fff; min-width: 56px; }
        .salary-pdf-pagefoot {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            margin-top: 4px;
            padding-top: 3px;
            border-top: 1px solid #e2e8f0;
            font-size: 8pt;
            color: #94a3b8;
        }
        .salary-pdf-summary-note {
            margin: 8px 0 6px;
            font-size: 11pt;
            font-weight: 700;
            color: #0f172a;
        }
        .salary-pdf table.summary-table thead th {
            height: auto;
            min-height: ${THEAD_HEIGHT_PT}pt;
            padding: 6px 8px;
        }
        .salary-pdf table.summary-table td {
            padding: 7px 8px;
            border: 1px solid #cbd5e1;
            vertical-align: middle;
        }
        .salary-pdf table.summary-table tr:nth-child(even) td { background: #f8fafc; }
        .salary-pdf table.summary-table tr.grand td {
            background: #0f172a;
            color: #fff;
            font-weight: 700;
            border-color: #0f172a;
        }
        .salary-pdf .final-paid {
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
        if (b.type === 'dept-header') {
            parts.push(`
                <tr class="dept-row">
                    <td colspan="${COL_COUNT}" dir="auto">${escapeHtml(b.department)}</td>
                </tr>
            `);
            continue;
        }
        if (b.type === 'dept-total') {
            parts.push(totalsCellsHtml(b.totals, L.deptTotal(b.department)));
            continue;
        }
        if (b.type === 'data') {
            const r = b.row;
            addTotals(pageTotals, r._m);
            parts.push(`
                <tr class="data-row">
                    <td>${escapeHtml(r.date)}</td>
                    <td dir="auto">${escapeHtml(r.employee)}</td>
                    <td dir="auto">${escapeHtml(r.branch)}</td>
                    <td>${escapeHtml(r.period)}</td>
                    <td class="num">${escapeHtml(r.salary)}</td>
                    <td class="num">${escapeHtml(r.rewardBonus)}</td>
                    <td class="num">${escapeHtml(r.commission)}</td>
                    <td class="num">${escapeHtml(r.grossSalary)}</td>
                    <td class="num">${escapeHtml(r.deductions)}</td>
                    <td class="num bold">${escapeHtml(r.netPaid)}</td>
                    <td class="sig"></td>
                    <td dir="auto">${escapeHtml(r.technician)}</td>
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

function buildSalaryPaymentsPageHtml({
    pageBlocks,
    branchName,
    dateFrom,
    dateTo,
    employeeSearch,
    totalNet,
    totalRecords,
    pageIndex,
    totalPages,
    isFirstPage,
    isLastDataPage = false,
    grandTotals = null,
    measureChromeOnly = false,
}) {
    const displayBranch = /^all branches$/i.test(String(branchName || '').trim())
        ? L.allBranches
        : branchName;
    const metaLines = isFirstPage
        ? [
            `<div><strong>${L.branch}:</strong> <span dir="auto">${escapeHtml(displayBranch)}</span></div>`,
            `<div><strong>${L.period}:</strong> ${escapeHtml(formatFilterRange(dateFrom, dateTo))}</div>`,
            employeeSearch?.trim()
                ? `<div><strong>${L.empSearch}:</strong> <span dir="auto">${escapeHtml(employeeSearch.trim())}</span></div>`
                : '',
            `<div><strong>${L.records}:</strong> ${totalRecords}</div>`,
            `<div><strong>${L.totalNet}:</strong> ${escapeHtml(fmtMoney(totalNet))}</div>`,
            `<div><strong>${L.generated}:</strong> ${escapeHtml(new Date().toLocaleString('en-GB'))}</div>`,
        ].filter(Boolean).join('')
        : [
            `<div><strong>${L.branch}:</strong> <span dir="auto">${escapeHtml(displayBranch)}</span></div>`,
            `<div><strong>${L.period}:</strong> ${escapeHtml(formatFilterRange(dateFrom, dateTo))}</div>`,
            `<div><strong>${L.continued}</strong> · ${escapeHtml(L.pageOf(pageIndex + 1, totalPages))}</div>`,
        ].join('');

    return `
        <style>${sharedPdfStyles(isFirstPage)}</style>
        <div class="salary-pdf">
            <div class="salary-pdf-banner">
                <div>
                    <h1>${isFirstPage ? L.title : L.titleCont}</h1>
                    <p class="salary-pdf-banner-sub">${L.subtitle}</p>
                </div>
                <div style="text-align:right;font-size:10pt;color:#334155;font-weight:600;">
                    ${isFirstPage
                        ? `${L.totalNet}: ${escapeHtml(fmtMoney(totalNet))}`
                        : L.pageOf(pageIndex + 1, totalPages)}
                </div>
            </div>
            <div class="salary-pdf-meta">${metaLines}</div>
            <table>
                <thead>
                    <tr>
                        <th style="width:6.5%">${L.colDate}</th>
                        <th style="width:10%">${L.colEmployee}</th>
                        <th style="width:9%">${L.colBranch}</th>
                        <th style="width:6%">${L.colPeriod}</th>
                        <th class="num" style="width:6.5%">${L.colSalary}</th>
                        <th class="num" style="width:6.5%">${L.colReward}</th>
                        <th class="num" style="width:7%">${L.colCommission}</th>
                        <th class="num" style="width:7%">${L.colGross}</th>
                        <th class="num" style="width:7%">${L.colDeductions}</th>
                        <th class="num" style="width:9%">${L.colNet}</th>
                        <th style="width:8.5%">${L.colSignature}</th>
                        <th style="width:12%">${L.colTechnician}</th>
                    </tr>
                </thead>
                <tbody>
                    ${measureChromeOnly ? '' : renderPageBodyHtml(pageBlocks, { isLastDataPage, grandTotals })}
                </tbody>
            </table>
            <div class="salary-pdf-pagefoot">
                <span>${L.footerNote}</span>
                <span>${L.pageOf(pageIndex + 1, totalPages)}</span>
            </div>
        </div>
    `;
}

function buildSummaryPageHtml({
    deptSummaries,
    grandTotals,
    branchName,
    dateFrom,
    dateTo,
    totalRecords,
    pageIndex,
    totalPages,
}) {
    const displayBranch = /^all branches$/i.test(String(branchName || '').trim())
        ? L.allBranches
        : branchName;
    const bodyRows = deptSummaries.map((d) => `
        <tr>
            <td dir="auto">${escapeHtml(d.department)}</td>
            <td class="num">${escapeHtml(fmtMoney(d.totals.salary))}</td>
            <td class="num">${escapeHtml(fmtMoney(d.totals.rewardBonus))}</td>
            <td class="num">${escapeHtml(fmtMoney(d.totals.commission))}</td>
            <td class="num">${escapeHtml(fmtMoney(d.totals.grossSalary))}</td>
            <td class="num">${escapeHtml(fmtMoney(d.totals.deductions))}</td>
            <td class="num bold">${escapeHtml(fmtMoney(d.totals.netPaid))}</td>
            <td class="num">${d.totals.count}</td>
        </tr>
    `).join('');

    return `
        <style>${sharedPdfStyles(true)}</style>
        <div class="salary-pdf">
            <div class="salary-pdf-banner">
                <div>
                    <h1>${L.summaryTitle}</h1>
                    <p class="salary-pdf-banner-sub">${L.summarySub}</p>
                </div>
                <div style="text-align:right;font-size:10pt;color:#334155;font-weight:600;">
                    ${L.pageOf(pageIndex + 1, totalPages)}
                </div>
            </div>
            <div class="salary-pdf-meta">
                <div><strong>${L.branch}:</strong> <span dir="auto">${escapeHtml(displayBranch)}</span></div>
                <div><strong>${L.period}:</strong> ${escapeHtml(formatFilterRange(dateFrom, dateTo))}</div>
                <div><strong>${L.records}:</strong> ${totalRecords}</div>
            </div>
            <p class="salary-pdf-summary-note">${L.summaryTitle}</p>
            <table class="summary-table">
                <thead>
                    <tr>
                        <th style="width:20%">${L.colDepartment}</th>
                        <th class="num" style="width:10%">${L.colSalary}</th>
                        <th class="num" style="width:10%">${L.colReward}</th>
                        <th class="num" style="width:10%">${L.colCommission}</th>
                        <th class="num" style="width:11%">${L.colGross}</th>
                        <th class="num" style="width:11%">${L.colDeductions}</th>
                        <th class="num" style="width:16%">${L.colNet}</th>
                        <th class="num" style="width:8%">${L.colRows}</th>
                    </tr>
                </thead>
                <tbody>
                    ${bodyRows || '<tr><td colspan="8" style="text-align:center;color:#94a3b8;">No records / لا سجلات</td></tr>'}
                    <tr class="grand">
                        <td>${escapeHtml(L.grandTotal)}</td>
                        <td class="num">${escapeHtml(fmtMoney(grandTotals.salary))}</td>
                        <td class="num">${escapeHtml(fmtMoney(grandTotals.rewardBonus))}</td>
                        <td class="num">${escapeHtml(fmtMoney(grandTotals.commission))}</td>
                        <td class="num">${escapeHtml(fmtMoney(grandTotals.grossSalary))}</td>
                        <td class="num">${escapeHtml(fmtMoney(grandTotals.deductions))}</td>
                        <td class="num">${escapeHtml(fmtMoney(grandTotals.netPaid))}</td>
                        <td class="num">${grandTotals.count}</td>
                    </tr>
                </tbody>
            </table>
            <div class="final-paid">
                <span>${L.finalPaid}</span>
                <span>SAR ${escapeHtml(fmtMoney(grandTotals.netPaid))}</span>
            </div>
            <div class="salary-pdf-pagefoot">
                <span>${L.footerNote}</span>
                <span>${L.pageOf(pageIndex + 1, totalPages)}</span>
            </div>
        </div>
    `;
}

function sampleDataRow() {
    return {
        date: '01/01/2026',
        employee: 'Sample Employee',
        branch: 'Sample Branch',
        period: '2026-01',
        salary: '1,000.00',
        rewardBonus: '0.00',
        commission: '0.00',
        grossSalary: '1,000.00',
        deductions: '0.00',
        netPaid: '1,000.00',
        signature: '',
        technician: L.ackAwaiting,
        departmentName: 'Sample',
        role: 'staff',
        roleRank: 2,
        _m: {
            salary: 1000,
            rewardBonus: 0,
            commission: 0,
            grossSalary: 1000,
            deductions: 0,
            netPaid: 1000,
        },
    };
}

async function measureLayout(mount, sampleArgs) {
    const waitFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    mount.innerHTML = buildSalaryPaymentsPageHtml({
        ...sampleArgs,
        pageBlocks: [],
        pageIndex: 0,
        totalPages: 1,
        isFirstPage: true,
        measureChromeOnly: true,
    });
    await waitFrame();
    const firstChromePx = mount.querySelector('.salary-pdf')?.scrollHeight || 140;

    mount.innerHTML = buildSalaryPaymentsPageHtml({
        ...sampleArgs,
        pageBlocks: [],
        pageIndex: 1,
        totalPages: 2,
        isFirstPage: false,
        measureChromeOnly: true,
    });
    await waitFrame();
    const contChromePx = mount.querySelector('.salary-pdf')?.scrollHeight || 110;

    const probe = sampleDataRow();
    const probeTotals = emptyTotals();
    addTotals(probeTotals, probe._m);
    mount.innerHTML = buildSalaryPaymentsPageHtml({
        ...sampleArgs,
        pageBlocks: [
            { type: 'dept-header', department: 'PROBE DEPT' },
            { type: 'data', row: probe },
            { type: 'dept-total', department: 'PROBE DEPT', totals: probeTotals },
        ],
        pageIndex: 0,
        totalPages: 1,
        isFirstPage: true,
        isLastDataPage: true,
        grandTotals: probeTotals,
    });
    await waitFrame();
    const root = mount.querySelector('.salary-pdf');
    const deptEl = root?.querySelector('tr.dept-row');
    const dataEl = root?.querySelector('tr.data-row');
    const totEls = root?.querySelectorAll('tr.tot-row');
    const deptHeader = Math.ceil(deptEl?.getBoundingClientRect().height || 28);
    const data = Math.ceil(dataEl?.getBoundingClientRect().height || 45);
    const deptTotal = Math.ceil(totEls?.[0]?.getBoundingClientRect().height || 32);
    // page total (+ optional grand) — reserve two total rows on last page
    const pageTotal = Math.ceil(totEls?.[1]?.getBoundingClientRect().height || 32);
    const grandTotalH = Math.ceil(totEls?.[2]?.getBoundingClientRect().height || pageTotal);

    const usableWpt = A4_LANDSCAPE.w - PDF_MARGIN_X_PT * 2;
    const usableHpt = A4_LANDSCAPE.h - PDF_MARGIN_Y_PT * 2;
    const pxPerPt = PDF_CAPTURE_WIDTH / usableWpt;
    const maxContentPx = usableHpt * pxPerPt;
    const tolPx = 2;

    // Reserve page total + grand total headroom so the last data page always fits
    // the Grand total row (middle pages simply have a little extra empty space).
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
        heights: { data, deptHeader, deptTotal, pageTotal },
    };
}

async function capturePageToPng(mount, html, toPng) {
    mount.innerHTML = html;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const captureEl = mount.querySelector('.salary-pdf');
    if (!captureEl) throw new Error('Could not render salary payments PDF page.');
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
        img.onerror = () => reject(new Error('Invalid PNG from salary payments capture'));
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
export async function exportSalaryPaymentsPdf({
    rows = [],
    branchName = 'All branches',
    dateFrom = '',
    dateTo = '',
    employeeSearch = '',
}) {
    await ensurePdfFonts();

    const mapped = mapExportRows(rows);
    const totalNet = rows.reduce((sum, r) => sum + (Number(r.netSalary) || 0), 0);
    const totalRecords = mapped.length;
    const { blocks, deptSummaries, grandTotals } = buildSheetBlocks(mapped);

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
            dateFrom,
            dateTo,
            employeeSearch,
            totalNet,
            totalRecords,
        };
        const { budgetFirstPx, budgetContPx, usableWpt, heights } = await measureLayout(mount, sampleArgs);
        const dataPages = packBlocksIntoPages(blocks, budgetFirstPx, budgetContPx, heights);
        // +1 summary page at the end
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
            const html = buildSalaryPaymentsPageHtml({
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
            deptSummaries,
            grandTotals,
            branchName,
            dateFrom,
            dateTo,
            totalRecords,
            pageIndex: dataPages.length,
            totalPages,
        });
        await addPdfPageFromHtml(pdf, mount, summaryHtml, toPng, usableWpt, true);

        pdf.save(`salary-payments-${safeFileSlug(branchName)}-${stamp()}.pdf`);
    } finally {
        mount.remove();
    }
}

export function exportSalaryPaymentsExcel({
    rows = [],
    branchName = 'All branches',
    dateFrom = '',
    dateTo = '',
    employeeSearch = '',
}) {
    const mapped = mapExportRows(rows);
    const { blocks, deptSummaries, grandTotals } = buildSheetBlocks(mapped);
    const headerRows = [
        [L.title],
        [`${L.branch}: ${branchName === 'All branches' ? L.allBranches : branchName}`],
        [`${L.period}: ${formatFilterRange(dateFrom, dateTo)}`],
        employeeSearch?.trim() ? [`${L.empSearch}: ${employeeSearch.trim()}`] : null,
        [`${L.generated}: ${new Date().toLocaleString('en-GB')}`],
        [],
        [
            'Date / التاريخ',
            'Employee / الموظف',
            'Branch / الفرع',
            'Period / الفترة',
            'Department / القسم',
            'Salary / الراتب',
            'Reward / مكافأة',
            'Commission / العمولة',
            'Gross Salary / الراتب الإجمالي',
            'Deductions / الخصومات',
            'Net Salary after deductions / صافي الراتب بعد الخصومات',
            'Signature / التوقيع',
            'Technician / الفني',
        ],
    ].filter(Boolean);

    const dataRows = [];
    const rowHeights = [];
    for (const b of blocks) {
        if (b.type === 'dept-header') {
            dataRows.push([b.department, '', '', '', '', '', '', '', '', '', '', '', '']);
            rowHeights.push({ hpt: 20 });
            continue;
        }
        if (b.type === 'dept-total') {
            dataRows.push([
                L.deptTotal(b.department),
                '',
                '',
                '',
                b.department,
                fmtMoney(b.totals.salary),
                fmtMoney(b.totals.rewardBonus),
                fmtMoney(b.totals.commission),
                fmtMoney(b.totals.grossSalary),
                fmtMoney(b.totals.deductions),
                fmtMoney(b.totals.netPaid),
                '',
                L.rowsN(b.totals.count),
            ]);
            rowHeights.push({ hpt: 22 });
            continue;
        }
        if (b.type === 'data') {
            const r = b.row;
            dataRows.push([
                r.date,
                r.employee,
                r.branch,
                r.period,
                r.departmentName,
                r.salary,
                r.rewardBonus,
                r.commission,
                r.grossSalary,
                r.deductions,
                r.netPaid,
                r.signature,
                r.technician,
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
        fmtMoney(grandTotals.salary),
        fmtMoney(grandTotals.rewardBonus),
        fmtMoney(grandTotals.commission),
        fmtMoney(grandTotals.grossSalary),
        fmtMoney(grandTotals.deductions),
        fmtMoney(grandTotals.netPaid),
        '',
        L.rowsN(grandTotals.count),
    ]);
    rowHeights.push({ hpt: 24 });

    dataRows.push([]);
    rowHeights.push({});
    dataRows.push([L.summaryTitle]);
    rowHeights.push({ hpt: 20 });
    dataRows.push([
        'Department / القسم',
        'Salary / الراتب',
        'Reward / مكافأة',
        'Commission / العمولة',
        'Gross Salary / الراتب الإجمالي',
        'Deductions / الخصومات',
        'Net Salary after deductions / صافي الراتب بعد الخصومات',
        'Rows / الصفوف',
    ]);
    rowHeights.push({ hpt: 20 });
    for (const d of deptSummaries) {
        dataRows.push([
            d.department,
            fmtMoney(d.totals.salary),
            fmtMoney(d.totals.rewardBonus),
            fmtMoney(d.totals.commission),
            fmtMoney(d.totals.grossSalary),
            fmtMoney(d.totals.deductions),
            fmtMoney(d.totals.netPaid),
            d.totals.count,
        ]);
        rowHeights.push({ hpt: 20 });
    }
    dataRows.push([
        L.finalPaid,
        fmtMoney(grandTotals.salary),
        fmtMoney(grandTotals.rewardBonus),
        fmtMoney(grandTotals.commission),
        fmtMoney(grandTotals.grossSalary),
        fmtMoney(grandTotals.deductions),
        fmtMoney(grandTotals.netPaid),
        grandTotals.count,
    ]);
    rowHeights.push({ hpt: 24 });

    const ws = XLSX.utils.aoa_to_sheet([...headerRows, ...dataRows]);
    ws['!rows'] = [
        ...Array.from({ length: headerRows.length }, () => ({})),
        ...rowHeights,
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Salary payments');
    XLSX.writeFile(wb, `salary-payments-${safeFileSlug(branchName)}-${stamp()}.xlsx`);
}
