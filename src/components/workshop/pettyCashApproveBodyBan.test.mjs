/**
 * Q5/K21: no approve call may send an empty {}.
 * Run: node --test src/components/workshop/pettyCashApproveBodyBan.test.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.join(__dirname, '..', '..');

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name.endsWith('.test.mjs')) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out);
    else if (/\.(js|jsx)$/.test(ent.name)) out.push(full);
  }
  return out;
}

describe('approveExpenseRequest must not send {}', () => {
  it('no approveExpenseRequest(id, {}) in src', () => {
    const files = walk(srcRoot);
    const hits = [];
    for (const f of files) {
      const text = fs.readFileSync(f, 'utf8');
      if (/approveExpenseRequest\s*\(\s*[^,]+,\s*\{\s*\}\s*\)/.test(text)) {
        hits.push(path.relative(srcRoot, f));
      }
    }
    assert.deepEqual(hits, []);
  });

  it('D10 workshop Approvals admin-wallet fund sends fundSourceType', () => {
    const p = path.join(srcRoot, 'pages', 'workshop', 'WorkshopApprovals.jsx');
    const text = fs.readFileSync(p, 'utf8');
    assert.match(text, /fundSourceType/);
    assert.match(text, /lockerConfirm\.paidFrom|Paid from Locker Cash/);
    assert.match(text, /badge\.paidFrom/);
  });

  it('D10 platform chat approve bodies include fundSourceType', () => {
    const p = path.join(
      srcRoot,
      'components',
      'platform-chat',
      'PlatformChatWalletActionModals.jsx',
    );
    const text = fs.readFileSync(p, 'utf8');
    assert.match(text, /body\.fundSourceType\s*=\s*'external'/);
    assert.match(text, /body\.fundSourceType\s*=\s*'wallet'/);
    assert.match(text, /body\.fundSourceType\s*=\s*'locker'/);
  });

  it('D10 purchases show From supplier invoice chip key', () => {
    const p = path.join(srcRoot, 'pages', 'workshop', 'WorkshopPurchases.jsx');
    const text = fs.readFileSync(p, 'utf8');
    assert.match(text, /chip\.fromSupplierInvoice/);
    assert.match(text, /from_supplier_invoice/);
  });
});
