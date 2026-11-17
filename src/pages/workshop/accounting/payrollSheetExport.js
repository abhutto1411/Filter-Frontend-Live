import * as XLSX from 'xlsx';

/** Cairo headings + Noto Naskh Arabic body (Asif). Loaded before html-to-image capture. */
export const SALARY_SHEET_FONT_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@600;700&family=Noto+Naskh+Arabic:wght@400;700&display=swap');
.salary-run-pdf, .salary-run-pdf * {
  font-family: "Noto Naskh Arabic", "Noto Naskh Arabic", serif;
  box-sizing: border-box;
}
.salary-run-pdf h1, .salary-run-pdf h2, .salary-run-pdf .heading {
  font-family: Cairo, "Cairo", sans-serif;
  font-weight: 700;
}
`;

const PDF_CAPTURE_WIDTH = 1700;
const A4_LANDSCAPE = { w: 841.89, h: 595.28 };
const PDF_MARGIN_X_PT = (1 / 2.54) * 72;
const PDF_MARGIN_Y_PT = (1.5 / 2.54) * 72;

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

function safeFileSlug(s) {
  const t = String(s || 'export')
    .replace(/[^\w.-]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80);
  return t || 'export';
}

function riyadhStamp(iso) {
  try {
    return new Date(iso || Date.now()).toLocaleString('en-GB', { timeZone: 'Asia/Riyadh' });
  } catch {
    return String(iso || '');
  }
}

const COLS = [
  ['Date', 'التاريخ'],
  ['Doc No.', 'رقم القيد'],
  ['Employee', 'الموظف'],
  ['Branch', 'الفرع'],
  ['Period', 'الفترة'],
  ['Basic', 'الأساسي'],
  ['Allowance', 'البدل'],
  ['Bonus', 'المكافأة'],
  ['Commission', 'العمولة'],
  ['Gross Salary', 'الراتب الإجمالي'],
  ['Recovery', 'الاسترداد'],
  ['Penalties', 'الغرامات'],
  ['Deductions', 'الخصومات'],
  ['Net Salary after deductions', 'صافي الراتب بعد الخصومات'],
  ['Remarks', 'ملاحظات'],
  ['Signature', 'التوقيع'],
];

export function salarySheetPageCss() {
  return `${SALARY_SHEET_FONT_CSS}
.salary-run-pdf { width: ${PDF_CAPTURE_WIDTH}px; background:#fff; color:#0f172a; padding:18px 22px 12px; }
.salary-run-pdf h1 { font-size:22px; margin:0 0 4px; color:#0f172a; }
.salary-run-pdf .sub { color:#475569; font-size:12px; margin-bottom:8px; }
.salary-run-pdf .meta { display:flex; justify-content:space-between; gap:16px; font-size:12px; margin-bottom:10px; }
.salary-run-pdf table { width:100%; border-collapse:collapse; font-size:11px; }
.salary-run-pdf th { background:#0f2744; color:#fff; padding:6px 4px; font-family:Cairo,sans-serif; font-weight:700; text-align:start; }
.salary-run-pdf td { border-bottom:1px solid #e2e8f0; padding:5px 4px; vertical-align:top; }
.salary-run-pdf tr.dept-row td { background:#e2e8f0; font-weight:700; font-family:Cairo,sans-serif; }
.salary-run-pdf tr.tot-row td { font-weight:800; background:#f8fafc; }
.salary-run-pdf .num { text-align:end; font-variant-numeric:tabular-nums; }
.salary-run-pdf .sig { min-width:72px; height:22px; }
.salary-run-pdf .final-paid { margin-top:14px; padding:12px 14px; background:#0f2744; color:#fff; display:flex; justify-content:space-between; font-family:Cairo,sans-serif; font-size:16px; }
.salary-run-pdf .pagefoot { display:flex; justify-content:space-between; font-size:10px; color:#64748b; margin-top:8px; }
.salary-run-pdf .ar { font-family:"Noto Naskh Arabic",serif; }
`;
}

export function buildSalarySheetHtml(sheet, { pageIndex = 0, totalPages = 1, isSummary = false } = {}) {
  const css = salarySheetPageCss();
  const title = 'Salary Payments Sheet / كشف رواتب المدفوعات';
  const head = COLS.map(
    ([en, ar]) => `<th>${escapeHtml(en)}<br/><span class="ar" dir="rtl">${escapeHtml(ar)}</span></th>`,
  ).join('');
  let body = '';
  if (!isSummary) {
    for (const g of sheet.groups || []) {
      body += `<tr class="dept-row"><td colspan="16">${escapeHtml(g.labelEn)} / <span class="ar" dir="rtl">${escapeHtml(g.labelAr)}</span></td></tr>`;
      for (const r of g.rows || []) {
        body += `<tr class="data-row">
          <td>${escapeHtml(r.date)}</td>
          <td>${escapeHtml(r.docNo)}</td>
          <td>${escapeHtml(r.employee)}<div class="ar" style="color:#64748b">${escapeHtml(r.role || '')}</div></td>
          <td>${escapeHtml(r.branch)}</td>
          <td>${escapeHtml(r.period)}</td>
          <td class="num">${escapeHtml(fmtMoney(r.basic))}</td>
          <td class="num">${escapeHtml(fmtMoney(r.allowance))}</td>
          <td class="num">${escapeHtml(fmtMoney(r.bonus))}</td>
          <td class="num">${escapeHtml(fmtMoney(r.commission))}</td>
          <td class="num">${escapeHtml(fmtMoney(r.gross))}</td>
          <td class="num">${escapeHtml(fmtMoney(r.recovery))}</td>
          <td class="num">${escapeHtml(fmtMoney(r.penalties))}</td>
          <td class="num">${escapeHtml(fmtMoney(r.deductions))}</td>
          <td class="num">${escapeHtml(fmtMoney(r.net))}</td>
          <td>${escapeHtml(r.remarks || '')}</td>
          <td class="sig"></td>
        </tr>`;
      }
      body += `<tr class="tot-row"><td colspan="5">${escapeHtml(g.labelEn)} — Department total / إجمالي القسم · ${g.rowCount}</td>
        <td class="num">${fmtMoney(g.totals.basic)}</td>
        <td class="num">${fmtMoney(g.totals.allowance)}</td>
        <td class="num">${fmtMoney(g.totals.bonus)}</td>
        <td class="num">${fmtMoney(g.totals.commission)}</td>
        <td class="num">${fmtMoney(g.totals.gross)}</td>
        <td class="num">${fmtMoney(g.totals.recovery)}</td>
        <td class="num">${fmtMoney(g.totals.penalties)}</td>
        <td class="num">${fmtMoney(g.totals.deductions)}</td>
        <td class="num">${fmtMoney(g.totals.net)}</td>
        <td colspan="2"></td></tr>`;
    }
  } else {
    body += `<tr class="dept-row"><td colspan="16">Department Summary / ملخص الأقسام</td></tr>`;
    for (const s of sheet.summary || []) {
      body += `<tr>
        <td colspan="5">${escapeHtml(s.labelEn)} / <span class="ar">${escapeHtml(s.labelAr)}</span></td>
        <td class="num">${fmtMoney(s.basic)}</td>
        <td class="num">${fmtMoney(s.allowance)}</td>
        <td class="num">${fmtMoney(s.bonus)}</td>
        <td class="num">${fmtMoney(s.commission)}</td>
        <td class="num">${fmtMoney(s.gross)}</td>
        <td colspan="2"></td>
        <td class="num">${fmtMoney(s.deductions)}</td>
        <td class="num">${fmtMoney(s.net)}</td>
        <td>${s.rows}</td>
        <td></td>
      </tr>`;
    }
    body += `<tr class="tot-row"><td colspan="5">Grand total / الإجمالي الكلي</td>
      <td class="num">${fmtMoney(sheet.grand?.basic)}</td>
      <td class="num">${fmtMoney(sheet.grand?.allowance)}</td>
      <td class="num">${fmtMoney(sheet.grand?.bonus)}</td>
      <td class="num">${fmtMoney(sheet.grand?.commission)}</td>
      <td class="num">${fmtMoney(sheet.grand?.gross)}</td>
      <td class="num">${fmtMoney(sheet.grand?.recovery)}</td>
      <td class="num">${fmtMoney(sheet.grand?.penalties)}</td>
      <td class="num">${fmtMoney(sheet.grand?.deductions)}</td>
      <td class="num">${fmtMoney(sheet.grand?.net)}</td>
      <td colspan="2">${sheet.records}</td></tr>`;
  }
  const finalBox = isSummary
    ? `<div class="final-paid"><span>Final paid salary (Grand total) / الراتب النهائي المدفوع</span><span>SAR ${escapeHtml(fmtMoney(sheet.grand?.net))}</span></div>`
    : '';
  return `<div class="salary-run-pdf" dir="ltr">
    <style>${css}</style>
    <h1 class="heading">${title}</h1>
    <div class="sub">Department-wise · Managers & cashiers first / حسب القسم · المدراء والكاشير أولاً</div>
    <div class="meta">
      <div>
        <div><strong>Branch / الفرع:</strong> ${escapeHtml(sheet.branchName || '')}</div>
        <div><strong>Salary for the Month of / راتب شهر:</strong> ${escapeHtml(sheet.period || '')}</div>
        <div><strong>Records / السجلات:</strong> ${sheet.records}</div>
        <div><strong>Generated / تاريخ الإنشاء:</strong> ${escapeHtml(riyadhStamp(sheet.generatedAt))} (Riyadh)</div>
      </div>
      <div><strong>Total net salary after deductions (SAR)</strong><div style="font-size:20px;font-family:Cairo,sans-serif">${escapeHtml(fmtMoney(sheet.grand?.net))}</div></div>
    </div>
    <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
    ${finalBox}
    <div class="pagefoot">
      <span>Amounts in SAR · Signature blank for wet-ink · Page totals = this page only / المبالغ بالريال · عمود التوقيع فارغ · إجمالي الصفحة لهذه الصفحة فقط</span>
      <span>Page ${pageIndex + 1} of ${totalPages} / صفحة ${pageIndex + 1} من ${totalPages}</span>
    </div>
  </div>`;
}

export function buildAdvanceSheetHtml(sheet, { pageIndex = 0, totalPages = 1 } = {}) {
  const css = salarySheetPageCss();
  const cols = [
    ['Date', 'التاريخ'],
    ['Doc/Voucher No.', 'رقم السند'],
    ['Employee', 'الموظف'],
    ['Branch', 'الفرع'],
    ['Advance type/reason', 'نوع / سبب السلفة'],
    ['Amount', 'المبلغ'],
    ['Paid from', 'صُرف من'],
    ['Recovery plan', 'خطة الاسترداد'],
    ['Outstanding after this payment', 'المتبقي بعد الصرف'],
    ['Remarks', 'ملاحظات'],
    ['Receiver signature', 'توقيع المستلم'],
    ['Thumb/ID', 'الإبهام / الهوية'],
  ];
  const head = cols.map(([en, ar]) => `<th>${escapeHtml(en)}<br/><span class="ar" dir="rtl">${escapeHtml(ar)}</span></th>`).join('');
  let body = '';
  for (const g of sheet.groups || []) {
    body += `<tr class="dept-row"><td colspan="12">${escapeHtml(g.labelEn)} / <span class="ar">${escapeHtml(g.labelAr)}</span></td></tr>`;
    for (const r of g.rows || []) {
      body += `<tr>
        <td>${escapeHtml(r.date)}</td>
        <td>${escapeHtml(r.docNo)}</td>
        <td>${escapeHtml(r.employee)}</td>
        <td>${escapeHtml(r.branch)}</td>
        <td>${escapeHtml(r.advanceType)}</td>
        <td class="num">${fmtMoney(r.amount)}</td>
        <td>${escapeHtml(r.paidFrom)}</td>
        <td>${escapeHtml(r.recoveryPlan)}</td>
        <td class="num">${escapeHtml(r.outstandingAfter || '')}</td>
        <td>${escapeHtml(r.remarks || '')}</td>
        <td class="sig"></td>
        <td class="sig"></td>
      </tr>`;
    }
    body += `<tr class="tot-row"><td colspan="5">${escapeHtml(g.labelEn)} — Department total / إجمالي القسم · ${g.rowCount}</td>
      <td class="num">${fmtMoney(g.total)}</td><td colspan="6"></td></tr>`;
  }
  const largeSig = (sheet.records || 0) === 1
    ? `<div style="margin-top:24px;border:1px dashed #94a3b8;height:90px;padding:8px;font-family:Cairo,sans-serif">Receiver signature / توقيع المستلم</div>`
    : '';
  return `<div class="salary-run-pdf" dir="ltr">
    <style>${css}</style>
    <h1 class="heading">Advance Payment Sheet / كشف صرف السلف</h1>
    <div class="sub">Department-wise · Managers & cashiers first</div>
    <div class="meta">
      <div>
        <div><strong>Branch / الفرع:</strong> ${escapeHtml(sheet.branchName || '')}</div>
        <div><strong>Period:</strong> ${escapeHtml(sheet.month || [sheet.from, sheet.to].filter(Boolean).join(' → ') || '')}</div>
        <div><strong>Records:</strong> ${sheet.records}</div>
        <div><strong>Generated:</strong> ${escapeHtml(riyadhStamp(sheet.generatedAt))} (Riyadh)</div>
      </div>
      <div><strong>Total advances paid (SAR)</strong><div style="font-size:20px;font-family:Cairo,sans-serif">${fmtMoney(sheet.grand?.amount)}</div></div>
    </div>
    <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
    <div class="final-paid"><span>Total advances paid / إجمالي السلف المصروفة</span><span>SAR ${fmtMoney(sheet.grand?.amount)}</span></div>
    ${largeSig}
    <div style="display:flex;gap:24px;margin-top:18px;font-size:12px">
      <div style="flex:1;border-top:1px solid #94a3b8;padding-top:6px">Prepared by / أعدّه</div>
      <div style="flex:1;border-top:1px solid #94a3b8;padding-top:6px">Approved by / اعتمده</div>
      <div style="flex:1;border-top:1px solid #94a3b8;padding-top:6px">Paid by / صرفه</div>
    </div>
    <div class="pagefoot">
      <span>Amounts in SAR · Receiver signature blank for wet-ink</span>
      <span>Page ${pageIndex + 1} of ${totalPages} / صفحة ${pageIndex + 1} من ${totalPages}</span>
    </div>
  </div>`;
}

async function ensureSheetFonts() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('filter-salary-sheet-fonts')) return;
  const link = document.createElement('link');
  link.id = 'filter-salary-sheet-fonts';
  link.rel = 'stylesheet';
  link.href =
    'https://fonts.googleapis.com/css2?family=Cairo:wght@600;700&family=Noto+Naskh+Arabic:wght@400;700&display=swap';
  document.head.appendChild(link);
  await new Promise((r) => setTimeout(r, 80));
}

async function htmlToPdf(pagesHtml, filename) {
  await ensureSheetFonts();
  const mount = document.createElement('div');
  mount.setAttribute('aria-hidden', 'true');
  mount.style.cssText = `position:fixed;left:-12000px;top:0;width:${PDF_CAPTURE_WIDTH}px;background:#fff;pointer-events:none;z-index:-1`;
  document.body.appendChild(mount);
  try {
    const [{ toPng }, { jsPDF }] = await Promise.all([
      import('html-to-image'),
      import('jspdf'),
    ]);
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4', compress: true });
    const usableWpt = A4_LANDSCAPE.w - PDF_MARGIN_X_PT * 2;
    for (let i = 0; i < pagesHtml.length; i += 1) {
      mount.innerHTML = pagesHtml[i];
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const el = mount.querySelector('.salary-run-pdf');
      const img = await toPng(el, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        cacheBust: true,
        width: PDF_CAPTURE_WIDTH,
        height: Math.max(el.scrollHeight, 1),
      });
      const im = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = img;
      });
      const displayH = (im.naturalHeight / im.naturalWidth) * usableWpt;
      if (i > 0) pdf.addPage('a4', 'landscape');
      pdf.addImage(img, 'PNG', PDF_MARGIN_X_PT, PDF_MARGIN_Y_PT, usableWpt, displayH, undefined, 'FAST');
    }
    pdf.save(filename);
  } finally {
    mount.remove();
  }
}

export async function exportPayrollSalaryPdf(sheet) {
  const branch = safeFileSlug(sheet.branchName || 'All-branches');
  const pages = [
    buildSalarySheetHtml(sheet, { pageIndex: 0, totalPages: 2, isSummary: false }),
    buildSalarySheetHtml(sheet, { pageIndex: 1, totalPages: 2, isSummary: true }),
  ];
  await htmlToPdf(pages, `Salary-Sheet_${branch}_${sheet.period}.pdf`);
}

function moneyCols() {
  return ['basic', 'allowance', 'bonus', 'commission', 'gross', 'recovery', 'penalties', 'deductions', 'net'];
}

export function buildSalarySheetWorkbook(sheet) {
  const header = [
    'Date / التاريخ',
    'Doc No. / رقم القيد',
    'Employee / الموظف',
    'Branch / الفرع',
    'Period / الفترة',
    'Basic / الأساسي',
    'Allowance / البدل',
    'Bonus / المكافأة',
    'Commission / العمولة',
    'Gross Salary / الراتب الإجمالي',
    'Recovery / الاسترداد',
    'Penalties / الغرامات',
    'Deductions / الخصومات',
    'Net Salary after deductions / صافي الراتب بعد الخصومات',
    'Remarks / ملاحظات',
    'Signature / التوقيع',
  ];
  const byBranch = new Map();
  for (const g of sheet.groups || []) {
    for (const r of g.rows || []) {
      const b = r.branch || sheet.branchName || 'Branch';
      if (!byBranch.has(b)) byBranch.set(b, []);
      byBranch.get(b).push({ ...r, dept: `${g.labelEn} / ${g.labelAr}` });
    }
  }
  const wb = XLSX.utils.book_new();
  const numFmt = '#,##0.00';
  for (const [branch, rows] of byBranch) {
    const aoa = [
      ['Salary Payments Sheet / كشف رواتب المدفوعات'],
      [`Branch / الفرع: ${branch}`],
      [`Salary for the Month of / راتب شهر: ${sheet.period}`],
      [],
      header,
    ];
    const formulaRows = [];
    let lastDept = '';
    for (const r of rows) {
      if (r.dept !== lastDept) {
        aoa.push([r.dept]);
        lastDept = r.dept;
      }
      aoa.push([
        r.date, r.docNo, r.employee, r.branch, r.period,
        Number(r.basic), Number(r.allowance), Number(r.bonus), Number(r.commission),
        Number(r.gross), Number(r.recovery), Number(r.penalties), Number(r.deductions),
        Number(r.net), r.remarks || '', '',
      ]);
      formulaRows.push(aoa.length);
    }
    const firstData = 6;
    const lastData = aoa.length;
    aoa.push([
      'Department / Grand total / الإجمالي',
      '', '', '', '',
      { f: `SUM(F${firstData}:F${lastData})`, t: 'n' },
      { f: `SUM(G${firstData}:G${lastData})`, t: 'n' },
      { f: `SUM(H${firstData}:H${lastData})`, t: 'n' },
      { f: `SUM(I${firstData}:I${lastData})`, t: 'n' },
      { f: `SUM(J${firstData}:J${lastData})`, t: 'n' },
      { f: `SUM(K${firstData}:K${lastData})`, t: 'n' },
      { f: `SUM(L${firstData}:L${lastData})`, t: 'n' },
      { f: `SUM(M${firstData}:M${lastData})`, t: 'n' },
      { f: `SUM(N${firstData}:N${lastData})`, t: 'n' },
      '', '',
    ]);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!freeze'] = { xSplit: 0, ySplit: 5 };
    ws['!views'] = [{ state: 'frozen', ySplit: 5 }];
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let r = 5; r <= range.e.r; r += 1) {
      for (let c = 5; c <= 13; c += 1) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (ws[addr]) ws[addr].z = numFmt;
      }
    }
    XLSX.utils.book_append_sheet(wb, ws, String(branch).slice(0, 31) || 'Branch');
  }
  const sumAoa = [
    ['Department Summary / ملخص الأقسام'],
    ['Department', 'Basic', 'Allowance', 'Bonus', 'Commission', 'Gross', 'Deductions', 'Net', 'Rows'],
    ...(sheet.summary || []).map((s) => [
      `${s.labelEn} / ${s.labelAr}`,
      Number(s.basic), Number(s.allowance), Number(s.bonus), Number(s.commission),
      Number(s.gross), Number(s.deductions), Number(s.net), s.rows,
    ]),
    [
      'Grand total / الإجمالي الكلي',
      Number(sheet.grand?.basic), Number(sheet.grand?.allowance), Number(sheet.grand?.bonus),
      Number(sheet.grand?.commission), Number(sheet.grand?.gross), Number(sheet.grand?.deductions),
      Number(sheet.grand?.net), sheet.records,
    ],
    ['Final paid salary (Grand total) / الراتب النهائي المدفوع', Number(sheet.grand?.net)],
  ];
  const sumWs = XLSX.utils.aoa_to_sheet(sumAoa);
  XLSX.utils.book_append_sheet(wb, sumWs, 'Summary');
  return { wb, numFmt, moneyCols: moneyCols() };
}

export function exportPayrollSalaryExcel(sheet) {
  const { wb } = buildSalarySheetWorkbook(sheet);
  const branch = safeFileSlug(sheet.branchName || 'All-branches');
  XLSX.writeFile(wb, `Salary-Sheet_${branch}_${sheet.period}.xlsx`);
}

export function buildAdvanceSheetWorkbook(sheet) {
  const header = [
    'Date / التاريخ',
    'Doc/Voucher No. / رقم السند',
    'Employee / الموظف',
    'Branch / الفرع',
    'Advance type/reason / نوع السلفة',
    'Amount / المبلغ',
    'Paid from / صُرف من',
    'Recovery plan / خطة الاسترداد',
    'Outstanding after / المتبقي',
    'Remarks / ملاحظات',
    'Receiver signature / توقيع المستلم',
    'Thumb/ID / الإبهام',
  ];
  const wb = XLSX.utils.book_new();
  const aoa = [['Advance Payment Sheet / كشف صرف السلف'], header];
  for (const g of sheet.groups || []) {
    aoa.push([`${g.labelEn} / ${g.labelAr}`]);
    const start = aoa.length + 1;
    for (const r of g.rows || []) {
      aoa.push([
        r.date, r.docNo, r.employee, r.branch, r.advanceType,
        Number(r.amount), r.paidFrom, r.recoveryPlan, r.outstandingAfter || '',
        r.remarks || '', '', '',
      ]);
    }
    const end = aoa.length;
    aoa.push(['Department total / إجمالي القسم', '', '', '', '', { f: `SUM(F${start}:F${end})`, t: 'n' }]);
  }
  aoa.push(['Grand total / الإجمالي الكلي', '', '', '', '', Number(sheet.grand?.amount)]);
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!views'] = [{ state: 'frozen', ySplit: 2 }];
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let r = 2; r <= range.e.r; r += 1) {
    const addr = XLSX.utils.encode_cell({ r, c: 5 });
    if (ws[addr]) ws[addr].z = '#,##0.00';
  }
  XLSX.utils.book_append_sheet(wb, ws, (sheet.branchName || 'Branch').slice(0, 31));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['Summary'],
      ['Total advances paid', Number(sheet.grand?.amount)],
      ['Rows', sheet.records],
    ]),
    'Summary',
  );
  return wb;
}

export async function exportAdvancePaymentPdf(sheet) {
  const branch = safeFileSlug(sheet.branchName || 'All-branches');
  const tag = sheet.month || 'range';
  await htmlToPdf(
    [buildAdvanceSheetHtml(sheet, { pageIndex: 0, totalPages: 1 })],
    `Advance-Sheet_${branch}_${tag}.pdf`,
  );
}

export function exportAdvancePaymentExcel(sheet) {
  const wb = buildAdvanceSheetWorkbook(sheet);
  const branch = safeFileSlug(sheet.branchName || 'All-branches');
  const tag = sheet.month || 'range';
  XLSX.writeFile(wb, `Advance-Sheet_${branch}_${tag}.xlsx`);
}
