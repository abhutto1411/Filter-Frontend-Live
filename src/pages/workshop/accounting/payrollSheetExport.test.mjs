import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SALARY_SHEET_FONT_CSS,
  buildSalarySheetHtml,
  buildSalarySheetWorkbook,
  buildAdvanceSheetHtml,
  buildAdvanceSheetWorkbook,
} from './payrollSheetExport.js';

const sheet = {
  period: '2026-11',
  branchName: 'Pakistan Branch',
  generatedAt: '2026-11-10T00:40:00+03:00',
  records: 1,
  groups: [
    {
      key: 'managers',
      labelEn: 'Branch Managers',
      labelAr: 'مدراء الفروع',
      order: 1,
      rowCount: 1,
      totals: {
        basic: '500.00',
        allowance: '100.00',
        bonus: '50.00',
        commission: '56.20',
        gross: '706.20',
        recovery: '0.00',
        penalties: '0.00',
        deductions: '0.00',
        net: '706.20',
      },
      rows: [
        {
          date: '2026-11-10',
          docNo: 'PS-1',
          employee: 'Asif',
          role: 'manager',
          branch: 'Pakistan Branch',
          period: '2026-11',
          basic: '500.00',
          allowance: '100.00',
          bonus: '50.00',
          commission: '56.20',
          gross: '706.20',
          recovery: '0.00',
          penalties: '0.00',
          deductions: '0.00',
          net: '706.20',
          remarks: '',
        },
      ],
    },
  ],
  summary: [
    {
      labelEn: 'Branch Managers',
      labelAr: 'مدراء الفروع',
      basic: '500.00',
      allowance: '100.00',
      bonus: '50.00',
      commission: '56.20',
      gross: '706.20',
      deductions: '0.00',
      net: '706.20',
      rows: 1,
    },
  ],
  grand: {
    basic: '500.00',
    allowance: '100.00',
    bonus: '50.00',
    commission: '56.20',
    gross: '706.20',
    recovery: '0.00',
    penalties: '0.00',
    deductions: '0.00',
    net: '706.20',
  },
};

test('salary PDF HTML embeds Cairo + Noto Naskh Arabic and Arabic glyphs', () => {
  assert.match(SALARY_SHEET_FONT_CSS, /Noto Naskh Arabic/);
  assert.match(SALARY_SHEET_FONT_CSS, /Cairo/);
  const html = buildSalarySheetHtml(sheet, { pageIndex: 1, totalPages: 2, isSummary: true });
  assert.match(html, /Noto Naskh Arabic/);
  assert.match(html, /Cairo/);
  assert.match(html, /كشف رواتب المدفوعات/);
  assert.match(html, /ملخص الأقسام/);
  assert.match(html, /الراتب النهائي المدفوع/);
  assert.match(html, /706\.20/);
});

test('salary xlsx has branch + Summary sheets, SUM formulas, #,##0.00', () => {
  const { wb, numFmt } = buildSalarySheetWorkbook(sheet);
  assert.equal(numFmt, '#,##0.00');
  assert.ok(wb.SheetNames.includes('Pakistan Branch'));
  assert.ok(wb.SheetNames.includes('Summary'));
  const ws = wb.Sheets['Pakistan Branch'];
  const hasSum = Object.values(ws).some((c) => c && typeof c.f === 'string' && c.f.startsWith('SUM('));
  assert.equal(hasSum, true);
  const hasFmt = Object.values(ws).some((c) => c && c.z === '#,##0.00');
  assert.equal(hasFmt, true);
});

test('advance sheet HTML + xlsx summary', () => {
  const adv = {
    branchName: 'Pakistan Branch',
    month: '2026-11',
    records: 1,
    generatedAt: '2026-11-10T00:40:00+03:00',
    groups: [
      {
        labelEn: 'Cashiers',
        labelAr: 'الكاشير',
        rowCount: 1,
        total: '100.00',
        rows: [
          {
            date: '2026-11-01',
            docNo: 'ADV-1',
            employee: 'Zain (cashier · Pakistan Branch)',
            branch: 'Pakistan Branch',
            advanceType: 'Salary advance',
            amount: '100.00',
            paidFrom: 'Cash',
            recoveryPlan: '50.00 / month',
            outstandingAfter: '50.00',
            remarks: '',
          },
        ],
      },
    ],
    grand: { amount: '100.00', rows: 1 },
  };
  const html = buildAdvanceSheetHtml(adv);
  assert.match(html, /كشف صرف السلف/);
  assert.match(html, /Noto Naskh Arabic/);
  const wb = buildAdvanceSheetWorkbook(adv);
  assert.ok(wb.SheetNames.includes('Summary'));
});
