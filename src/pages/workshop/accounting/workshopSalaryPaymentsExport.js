import * as XLSX from 'xlsx';

const PDF_CAPTURE_WIDTH = 1050;
const ARABIC_FONT_LINK_ID = 'filter-noto-sans-arabic-font';

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
        return when ? `Accepted - ${when}` : 'Accepted';
    }
    if (s === 'rejected') {
        const when = ackAt ? new Date(ackAt).toLocaleString('en-GB') : '';
        return when ? `Rejected - ${when}` : 'Rejected';
    }
    return 'Awaiting technician';
}

function formatFilterRange(dateFrom, dateTo) {
    const from = dateFrom?.trim() ? fmtDate(dateFrom) : 'Beginning';
    const to = dateTo?.trim() ? fmtDate(dateTo) : 'Today';
    return `${from} to ${to}`;
}

function mapExportRows(rows) {
    return (rows || []).map((s) => ({
        date: fmtDate(s.paymentDate),
        employee: s.employeeName || '-',
        branch: s.branchName || '-',
        period: s.period || '-',
        salary: fmtMoney(s.basicSalary ?? s.grossSalary),
        rewardBonus: fmtMoney(s.rewardBonus),
        commission: fmtMoney(s.commissionAmount),
        deductions: fmtMoney(s.totalDeductions ?? (Number(s.advanceDeduction || 0) + Number(s.penalties || 0))),
        netPaid: fmtMoney(s.netSalary),
        signature: '',
        technician: formatAckStatus(s.technicianAckStatus, s.technicianAckAt),
    }));
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

function buildSalaryPaymentsHtml({
    mapped,
    branchName,
    dateFrom,
    dateTo,
    employeeSearch,
    totalNet,
}) {
    const rowsHtml = mapped.map((r) => `
        <tr>
            <td>${escapeHtml(r.date)}</td>
            <td>${escapeHtml(r.employee)}</td>
            <td dir="auto">${escapeHtml(r.branch)}</td>
            <td>${escapeHtml(r.period)}</td>
            <td class="num">${escapeHtml(r.salary)}</td>
            <td class="num">${escapeHtml(r.rewardBonus)}</td>
            <td class="num">${escapeHtml(r.commission)}</td>
            <td class="num">${escapeHtml(r.deductions)}</td>
            <td class="num bold">${escapeHtml(r.netPaid)}</td>
            <td class="sig"></td>
            <td>${escapeHtml(r.technician)}</td>
        </tr>
    `).join('');

    const metaLines = [
        `<div><strong>Branch:</strong> <span dir="auto">${escapeHtml(branchName)}</span></div>`,
        `<div><strong>Period:</strong> ${escapeHtml(formatFilterRange(dateFrom, dateTo))}</div>`,
        employeeSearch?.trim()
            ? `<div><strong>Employee search:</strong> <span dir="auto">${escapeHtml(employeeSearch.trim())}</span></div>`
            : '',
        `<div><strong>Records:</strong> ${mapped.length}</div>`,
        `<div><strong>Total net paid (SAR):</strong> ${escapeHtml(fmtMoney(totalNet))}</div>`,
        `<div><strong>Generated:</strong> ${escapeHtml(new Date().toLocaleString('en-GB'))}</div>`,
    ].filter(Boolean).join('');

    return `
        <style>
            .salary-pdf {
                font-family: 'Poppins', 'Noto Sans Arabic', sans-serif;
                color: #0f172a;
                background: #fff;
                padding: 20px 22px 24px;
                box-sizing: border-box;
            }
            .salary-pdf h1 {
                margin: 0 0 10px;
                font-size: 20px;
                font-weight: 700;
            }
            .salary-pdf-meta {
                font-size: 11px;
                color: #64748b;
                line-height: 1.55;
                margin-bottom: 14px;
            }
            .salary-pdf-meta strong { color: #334155; }
            .salary-pdf table {
                width: 100%;
                border-collapse: collapse;
                font-size: 10px;
                table-layout: fixed;
            }
            .salary-pdf th {
                background: #f8fafc;
                color: #0f172a;
                font-weight: 700;
                text-align: left;
                padding: 7px 6px;
                border: 1px solid #e2e8f0;
                font-size: 9px;
            }
            .salary-pdf td {
                padding: 6px;
                border: 1px solid #e2e8f0;
                vertical-align: top;
                word-wrap: break-word;
                overflow-wrap: anywhere;
            }
            .salary-pdf tr:nth-child(even) td { background: #fcfcfd; }
            .salary-pdf .num { text-align: right; font-variant-numeric: tabular-nums; }
            .salary-pdf .bold { font-weight: 700; }
            .salary-pdf .sig { min-height: 22px; }
        </style>
        <div class="salary-pdf">
            <h1>Recent Salary Payments</h1>
            <div class="salary-pdf-meta">${metaLines}</div>
            <table>
                <thead>
                    <tr>
                        <th style="width:7%">Date</th>
                        <th style="width:10%">Employee</th>
                        <th style="width:11%">Branch</th>
                        <th style="width:7%">Period</th>
                        <th style="width:8%">Salary</th>
                        <th style="width:8%">Reward/Bonus</th>
                        <th style="width:8%">Commission</th>
                        <th style="width:8%">Deductions</th>
                        <th style="width:8%">Net paid</th>
                        <th style="width:9%">Signature</th>
                        <th style="width:16%">Technician</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml || '<tr><td colspan="11" style="text-align:center;color:#94a3b8;padding:18px;">No records</td></tr>'}
                </tbody>
            </table>
        </div>
    `;
}

/**
 * @param {object} opts
 * @param {Array<object>} opts.rows
 * @param {string} [opts.branchName]
 * @param {string} [opts.dateFrom]
 * @param {string} [opts.dateTo]
 * @param {string} [opts.employeeSearch]
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
    mount.innerHTML = buildSalaryPaymentsHtml({
        mapped,
        branchName,
        dateFrom,
        dateTo,
        employeeSearch,
        totalNet,
    });
    document.body.appendChild(mount);

    try {
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const captureEl = mount.querySelector('.salary-pdf');
        if (!captureEl) throw new Error('Could not render salary payments PDF.');

        const captureHeight = Math.max(captureEl.scrollHeight, captureEl.offsetHeight, 1);
        const [{ toPng }, { jsPDF }] = await Promise.all([
            import('html-to-image'),
            import('jspdf'),
        ]);

        const imgData = await toPng(captureEl, {
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

        const dims = await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
            img.onerror = () => reject(new Error('Invalid PNG from salary payments capture'));
            img.src = imgData;
        });

        const pageWidth = 841.89;
        const pageHeight = 595.28;
        const margin = 28;
        const usableW = pageWidth - margin * 2;
        const usableH = pageHeight - margin * 2;
        const aspect = dims.h / dims.w;

        let displayW = usableW;
        let displayH = displayW * aspect;
        if (displayH > usableH) {
            displayH = usableH;
            displayW = displayH / aspect;
        }

        const offsetX = margin + (usableW - displayW) / 2;
        const offsetY = margin + (usableH - displayH) / 2;

        const pdf = new jsPDF({
            orientation: 'landscape',
            unit: 'pt',
            format: 'a4',
            compress: true,
        });
        pdf.addImage(imgData, 'PNG', offsetX, offsetY, displayW, displayH, undefined, 'FAST');
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
    const headerRows = [
        ['Recent Salary Payments'],
        [`Branch: ${branchName}`],
        [`Period: ${formatFilterRange(dateFrom, dateTo)}`],
        employeeSearch?.trim() ? [`Employee search: ${employeeSearch.trim()}`] : null,
        [`Generated: ${new Date().toLocaleString('en-GB')}`],
        [],
        [
            'Date',
            'Employee',
            'Branch',
            'Period',
            'Salary (SAR)',
            'Reward/Bonus (SAR)',
            'Commission (SAR)',
            'Deductions (SAR)',
            'Net paid (SAR)',
            'Signature',
            'Technician',
        ],
    ].filter(Boolean);

    const dataRows = mapped.map((r) => [
        r.date,
        r.employee,
        r.branch,
        r.period,
        r.salary,
        r.rewardBonus,
        r.commission,
        r.deductions,
        r.netPaid,
        r.signature,
        r.technician,
    ]);

    const ws = XLSX.utils.aoa_to_sheet([...headerRows, ...dataRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Salary payments');
    XLSX.writeFile(wb, `salary-payments-${safeFileSlug(branchName)}-${stamp()}.xlsx`);
}
