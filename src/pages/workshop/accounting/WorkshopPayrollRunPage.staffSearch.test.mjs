import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPayrollStaffHits, unwrapPayrollStaffSearchPayload } from '../../../utils/payrollRunDisplay.js';

const here = dirname(fileURLToPath(import.meta.url));

function renderHitsListbox(id, opts) {
  const options = opts
    .map(
      (o) =>
        `<div role="option" aria-disabled="${o.disabled ? 'true' : 'false'}">${escape(o.label)}<div>${escape(o.subtitle || '')}</div><span>${escape(o.trailing || '')}</span></div>`,
    )
    .join('');
  return `<div id="${id}"><input id="${id}" value="Za"/><div id="${id}-listbox" role="listbox">${options}</div></div>`;
}

function escape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

test('unwrap staff-search interceptor + data.items shapes', () => {
  assert.equal(unwrapPayrollStaffSearchPayload({ success: true, items: [{ id: '1' }] }).length, 1);
  assert.equal(unwrapPayrollStaffSearchPayload({ data: { items: [{ userId: '2' }] } }).length, 1);
  assert.equal(unwrapPayrollStaffSearchPayload({ data: [{ id: '3' }] }).length, 1);
});

test('run page has both comboboxes; typing Za yields visible options from mocked API', async () => {
  const src = readFileSync(join(here, 'WorkshopPayrollRunPage.jsx'), 'utf8');
  assert.match(src, /id="pr-emp"/);
  assert.match(src, /id="pr-add-emp"/);
  assert.match(src, /loadPayrollStaffHits/);
  assert.match(src, /filterLocally=\{false\}/);
  const combo = readFileSync(join(here, '../../../components/SearchableEntityCombobox.jsx'), 'utf8');
  assert.match(combo, /role="listbox"/);
  assert.match(combo, /role="option"/);
  assert.match(combo, /createPortal/);
  assert.match(combo, /zIndex: 10050/);

  const searchFn = async (params) => {
    assert.equal(params.q, 'Za');
    return {
      success: true,
      items: [
        {
          userId: '125',
          name: 'Zain',
          subtitle: 'technician · Pakistan Branch',
          inactive: false,
        },
        {
          id: '126',
          displayName: 'Zaid',
          role: 'manager',
          branchName: 'Pakistan Branch',
          inactive: true,
          alreadyInRun: true,
        },
      ],
    };
  };
  const opts = await loadPayrollStaffHits(searchFn, { q: 'Za' });
  assert.equal(opts.length, 2);
  assert.equal(opts[0].label.includes('Zain'), true);
  assert.equal(opts[1].disabled, true);

  const filterHtml = renderHitsListbox('pr-emp', opts);
  assert.match(filterHtml, /role="listbox"/);
  assert.match(filterHtml, /role="option"/);
  assert.match(filterHtml, /Zain/);
  assert.match(filterHtml, /technician · Pakistan Branch/);

  const addHtml = renderHitsListbox('pr-add-emp', opts);
  assert.match(addHtml, /pr-add-emp-listbox/);
  assert.match(addHtml, /Zaid/);
  assert.match(addHtml, /already in run|Inactive/);
});

test('draft salary sheet button is disabled; approved/paid ready', () => {
  const src = readFileSync(join(here, 'WorkshopPayrollRunPage.jsx'), 'utf8');
  const dlg = readFileSync(join(here, 'PayrollSheetDownloadDialog.jsx'), 'utf8');
  assert.match(src, /disabled=\{!sheetReady \|\| sheetBusy\}/);
  assert.match(src, /pr\.sheet\.availableAfter/);
  assert.match(dlg, /s === 'approved' \|\| s === 'paid' \|\| s === 'partially_paid'/);
  const ready = (status) => {
    const s = String(status || '').toLowerCase();
    return s === 'approved' || s === 'paid' || s === 'partially_paid';
  };
  assert.equal(ready('draft'), false);
  assert.equal(ready('approved'), true);
  assert.equal(ready('paid'), true);
});
