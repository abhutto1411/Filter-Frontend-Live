import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pageSrc = readFileSync(
  join(here, 'WorkshopOpeningBalancePage.jsx'),
  'utf8',
);
const searchSrc = readFileSync(join(here, 'ObAccountSearch.jsx'), 'utf8');

describe('WorkshopOpeningBalancePage source shape (CLOSING-v2)', () => {
  it('B2: no type=date input; start chip + Settings link', () => {
    assert.equal(/type=["']date["']/.test(pageSrc), false);
    assert.ok(pageSrc.includes('ob.startChip'));
    assert.ok(pageSrc.includes('/workshop/accounting/settings'));
    assert.ok(pageSrc.includes('ymdToDisplay'));
  });

  it('C1: view states via resolveObViewState', () => {
    assert.ok(pageSrc.includes('resolveObViewState'));
    assert.ok(pageSrc.includes("viewState === 'loading'"));
    assert.ok(pageSrc.includes("viewState === 'needsStart'"));
    assert.ok(pageSrc.includes("viewState === 'error'"));
    assert.ok(pageSrc.includes("viewState === 'empty'"));
    assert.ok(pageSrc.includes("viewState === 'ready'"));
  });

  it('D1: ObAccountSearch + WsSearchSuggest combobox', () => {
    assert.ok(pageSrc.includes('ObAccountSearch'));
    assert.ok(searchSrc.includes('WsSearchSuggest'));
    assert.ok(searchSrc.includes('rankObAccountSuggestions'));
  });

  it('E3: Post disabled until matching preview fingerprint', () => {
    assert.ok(pageSrc.includes('obPreviewMatchesInputs'));
    assert.ok(pageSrc.includes('postEnabled'));
    assert.ok(pageSrc.includes('setPreview(null)'));
  });

  it('E: sticky footer + steps + sections', () => {
    assert.ok(pageSrc.includes('ob.footer.plugExplain'));
    assert.ok(pageSrc.includes('ob.step.enter'));
    assert.ok(pageSrc.includes('ob.section.assets'));
    assert.ok(pageSrc.includes('position: \'sticky\''));
  });

  it('F1: OpeningBalancePage.css imported; no bare btn classes', () => {
    assert.ok(pageSrc.includes("OpeningBalancePage.css"));
    assert.equal(/className=["']btn["']/.test(pageSrc), false);
    assert.equal(/className=["']btn /.test(pageSrc), false);
    assert.ok(pageSrc.includes('ob-btn'));
    assert.ok(pageSrc.includes('isObRowEditable'));
  });

  it('CLOSING-2: At start + Today columns and live-after-S note', () => {
    assert.ok(pageSrc.includes('ob.col.atStart'));
    assert.ok(pageSrc.includes('ob.col.today'));
    assert.ok(pageSrc.includes('ob.note.liveAfterS'));
    assert.ok(pageSrc.includes('currentToday'));
    assert.ok(pageSrc.includes('target="_blank"'));
  });

  it('OB-03: RiyalIcon, no U+20C1, legacy banner + Money plug', () => {
    assert.ok(pageSrc.includes('RiyalIcon'));
    assert.equal(pageSrc.includes('\u20C1'), false);
    assert.equal(pageSrc.includes('⃁'), false);
    assert.ok(pageSrc.includes('ob.totals.plugLabel'));
    assert.ok(pageSrc.includes('legacyOpeningsAfterStart'));
    assert.ok(pageSrc.includes('ob.warn.legacyOpening'));
    assert.ok(pageSrc.includes('ob.status.postedResyncHint'));
  });

  it('OB-03: accountingI18n EN/AR have no U+20C1', () => {
    const i18n = readFileSync(
      join(here, '..', '..', '..', 'utils', 'accountingI18n.js'),
      'utf8',
    );
    assert.equal(i18n.includes('\u20C1'), false);
    assert.equal(i18n.includes('⃁'), false);
    assert.ok(i18n.includes('ob.totals.plugLabel'));
    assert.ok(i18n.includes('ob.j1.infoLabel'));
    assert.ok(i18n.includes('ob.err.legacyOpening'));
    assert.ok(i18n.includes('ob.err.subledgerDiff'));
  });

  it('OB-03 CLOSING: mapApiErr uses details; no em-dash placeholders; resync both paths', () => {
    assert.ok(pageSrc.includes('e?.details'));
    assert.ok(pageSrc.includes('ob.err.legacyOpeningPlain'));
    assert.ok(pageSrc.includes('legacyOpeningsAfterStart'));
    assert.equal(pageSrc.includes("numbers: numbers || '—'"), false);
    assert.equal(pageSrc.includes("control: body.controlSigned"), false);
    assert.ok(pageSrc.includes('resyncWarning || syncWarnings.length'));
    assert.ok(pageSrc.includes('ob.status.postedResyncHint'));
  });

  it('REVIEW-POPUP-FIX: mapApiErr/loadWorkspace deps stable; previewRef present', () => {
    assert.ok(pageSrc.includes('previewRef'));
    assert.ok(pageSrc.includes('mapApiErrRef'));
    assert.equal(/\[\s*t\s*,\s*preview\s*\]/.test(pageSrc), false);
    assert.equal(/\},\s*\[\s*mapApiErr\s*\]\s*\)/.test(pageSrc), false);
    assert.ok(pageSrc.includes('setReviewOpen(false)'));
    assert.ok(pageSrc.includes('formatObSavedTime'));
    assert.ok(
      pageSrc.includes(
        'confirmPost || posted ? 3 : reviewOpen && preview ? 2 : 1',
      ),
    );
  });
});
