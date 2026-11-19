import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const pagesDir = join(here, '..', 'pages', 'workshop', 'accounting');

const PATH_1 =
  'M699.62,1113.02h0c-20.06,44.48-33.32,92.75-38.4,143.37l424.51-90.24c20.06-44.47,33.31-92.75,38.4-143.37l-424.51,90.24Z';
const PATH_2 =
  'M1085.73,895.8c20.06-44.47,33.32-92.75,38.4-143.37l-330.68,70.33v-135.2l292.27-62.11c20.06-44.47,33.32-92.75,38.4-143.37l-330.68,70.27V66.13c-50.67,28.45-95.67,66.32-132.250,110.99v403.35l-132.25,28.11V0c-50.67,28.44-95.67,66.32-132.25,110.99v525.69l-295.91,62.88c-20.06,44.47-33.33,92.75-38.42,143.37l334.33-71.05v170.26l-358.3,76.14c-20.06,44.47-33.32,92.75-38.4,143.37l375.04-79.7c30.53-6.35,56.77-24.4,73.83-49.24l68.78-101.97v-.02c7.140-10.55,11.3-23.27,11.3-36.97v-149.98l132.25-28.11v270.4l424.53-90.28Z';

test('RiyalIcon is SAMA SVG with bilingual aria-label', () => {
  const src = readFileSync(join(here, 'RiyalIcon.jsx'), 'utf8');
  assert.match(src, /aria-label=\{label\}/);
  assert.match(src, /Saudi Riyal \/ ريال سعودي/);
  assert.match(src, /viewBox="0 0 1124\.14 1256\.39"/);
  assert.equal(src.includes(PATH_1), true);
  assert.equal(src.includes(PATH_2), true);
  assert.equal(src.includes('424.98'), false);
  assert.match(src, /direction: 'ltr'/);
  assert.match(src, /<svg/);
  assert.doesNotMatch(src, /from 'lucide-react'/);
});

test('touched screens do not print SAR next to closing diffs', () => {
  const panel = readFileSync(
    join(here, 'workshop', 'ClosingReportDetailPanel.jsx'),
    'utf8',
  );
  assert.match(panel, /RiyalIcon/);
  assert.doesNotMatch(panel, /SAR \$\{/);
  assert.match(panel, /\\u2212/);
  assert.match(panel, /bdi/);
  assert.match(panel, /textAlign: 'end'/);
});

test('SAR money cards no longer import DollarSign', () => {
  const files = [
    'WorkshopPayrollRunPage.jsx',
    'WorkshopAdvances.jsx',
    'WorkshopEmployeeLedgerTab.jsx',
  ];
  for (const name of files) {
    const src = readFileSync(join(pagesDir, name), 'utf8');
    assert.match(src, /RiyalIcon/, `${name} must use RiyalIcon`);
    assert.doesNotMatch(
      src,
      /import\s*\{[^}]*\bDollarSign\b[^}]*\}\s*from\s*['"]lucide-react['"]/,
      `${name} must not import DollarSign`,
    );
  }
});

test('OB-03 must-use RiyalIcon (opening balance + petty cash pay-from)', () => {
  const mustUse = [
    join(pagesDir, 'WorkshopOpeningBalancePage.jsx'),
    join(here, 'workshop', 'PettyCashPayFromDialog.jsx'),
  ];
  for (const file of mustUse) {
    const src = readFileSync(file, 'utf8');
    assert.match(src, /RiyalIcon/, `${file} must use RiyalIcon`);
    assert.doesNotMatch(src, /\u20C1|⃁/, `${file} must not use U+20C1`);
  }
});
