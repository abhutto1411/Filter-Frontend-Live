import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildObAccountTree,
  buildObInputFingerprint,
  buildObPreviewBody,
  emptyObFilters,
  filterObWorkspaceAccounts,
  formatObSavedTime,
  formatSarLatn,
  mapJournalPreviewLines,
  mapObCards,
  mapObTableRows,
  mapObTrueUpTotals,
  normalizeObSearchText,
  OB_DRAWER_TABS,
  isObRowEditable,
  obDiffSide,
  obErrorCodeToKey,
  obPreviewMatchesInputs,
  parseObPartyCsv,
  rankObAccountSuggestions,
  resolveObViewState,
  sourceLabelKey,
  splitCashBankCounts,
  sumObPartyTargets,
  validateObMoneyInput,
  validatePostReason,
  ymdToDisplay,
} from './openingBalanceDisplay.js';

describe('openingBalanceDisplay', () => {
  it('formatSarLatn', () => {
    assert.equal(formatSarLatn('1240'), '1,240.00');
  });

  it('formatObSavedTime local zone, null/garbage → em dash, ar Latin digits', () => {
    assert.equal(formatObSavedTime(null), '—');
    assert.equal(formatObSavedTime(''), '—');
    assert.equal(formatObSavedTime('not-a-date'), '—');
    const iso = '2026-11-15T19:15:00Z';
    const expected = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(iso));
    assert.equal(formatObSavedTime(iso, 'en'), expected);
    const ar = formatObSavedTime(iso, 'ar');
    assert.match(ar, /^[0-9]{2}:[0-9]{2}$/);
    assert.equal(ar, expected);
  });

  it('buildObPreviewBody', () => {
    const body = buildObPreviewBody({
      startDate: '2027-01-01',
      counts: {
        cash: [{ cashBankAccountId: '1', amount: '100' }],
        inventoryValue: '35000',
      },
      filter: { ...emptyObFilters(), search: 'cash', onlyDifferences: true },
      page: 2,
    });
    assert.equal(body.startDate, '2027-01-01');
    assert.equal(body.page, '2');
    assert.equal(body.counts.inventoryValue, '35000');
    assert.equal(body.filter.onlyDifferences, 'true');
  });

  it('mapObCards and mapObTableRows', () => {
    const cards = mapObCards({
      startDate: '2027-01-01',
      status: 'not_posted',
      cards: {
        accountsInPreview: '12',
        totalDifferenceToOpeningEquity: '1240.00',
      },
    });
    assert.equal(cards.accountsInPreview, '12');
    assert.equal(cards.totalDifference, '1240.00');
    const rows = mapObTableRows([
      {
        accountId: '1',
        code: '1010',
        name: 'Cash',
        type: 'asset',
        currentGl: '4200.00',
        proposed: '4150.00',
        difference: '-50.00',
        source: 'counted_cash',
        editable: true,
      },
    ]);
    assert.equal(rows[0].code, '1010');
    assert.equal(rows[0].editable, true);
  });

  it('mapJournalPreviewLines + sourceLabelKey', () => {
    const lines = mapJournalPreviewLines({
      lines: [{ accountId: '1', account: 'Cash', debit: '10', credit: '0' }],
    });
    assert.equal(lines[0].debit, '10');
    assert.equal(sourceLabelKey('counted_cash'), 'ob.src.countedCash');
  });

  it('validatePostReason', () => {
    assert.equal(validatePostReason('ab').ok, false);
    assert.equal(validatePostReason('Books cutover').ok, true);
  });

  it('splitCashBankCounts', () => {
    const { cash, bank } = splitCashBankCounts(
      [
        { id: '1', kind: 'CASH' },
        { id: '2', kind: 'BANK' },
      ],
      { 1: '10.00', 2: '20.00' },
    );
    assert.equal(cash.length, 1);
    assert.equal(bank.length, 1);
    assert.equal(bank[0].amount, '20.00');
  });

  it('obErrorCodeToKey maps B4 codes', () => {
    assert.equal(obErrorCodeToKey('PERIOD_LOCKED'), 'ob.err.periodLocked');
    assert.equal(obErrorCodeToKey('OPENING_MANAGED_BY_OB'), 'ob.err.managedByOb');
    assert.equal(obErrorCodeToKey('NOPE'), 'ob.err.generic');
  });

  it('obErrorCodeToKey maps OB-03 codes', () => {
    assert.equal(obErrorCodeToKey('OB_SUBLEDGER_MISMATCH'), 'ob.err.subledgerDiff');
    assert.equal(
      obErrorCodeToKey('OB_EMPLOYEE_BREAKDOWN_REQUIRED'),
      'ob.err.employeeBreakdown',
    );
    assert.equal(obErrorCodeToKey('CIT_IN_TRANSIT'), 'ob.err.citInTransit');
    assert.equal(
      obErrorCodeToKey('PREVIEW_HASH_REQUIRED'),
      'ob.err.previewHashRequired',
    );
    assert.equal(obErrorCodeToKey('INVALID_AMOUNT'), 'ob.err.invalidAmount');
    assert.equal(obErrorCodeToKey('OPENING_NOT_POSTED'), 'ob.err.openingNotPosted');
    assert.equal(
      obErrorCodeToKey('OB_LEGACY_OPENING_AFTER_START'),
      'ob.err.legacyOpening',
    );
    assert.equal(obErrorCodeToKey('TX_TIMEOUT'), 'ob.err.txTimeout');
  });

  it('OB-03 CLOSING: i18n messages for details with and without payload', async () => {
    const { accT } = await import('./accountingI18n.js');
    const withDetails = accT('en', 'ob.err.subledgerDiff', {
      control: '100.00',
      parties: '80.00',
      difference: '20.00',
    });
    assert.match(withDetails, /100\.00/);
    assert.match(withDetails, /80\.00/);
    assert.match(withDetails, /20\.00/);
    assert.equal(withDetails.includes('—'), false);

    const plainMismatch = accT('en', 'ob.err.subledgerMismatch');
    assert.ok(plainMismatch.length > 5);
    assert.equal(plainMismatch.includes('{control}'), false);

    const withJournals = accT('en', 'ob.err.legacyOpening', {
      numbers: 'JE0006',
    });
    assert.match(withJournals, /JE0006/);
    const plainLegacy = accT('en', 'ob.err.legacyOpeningPlain');
    assert.ok(plainLegacy.length > 5);
    assert.equal(plainLegacy.includes('{numbers}'), false);
    assert.equal(plainLegacy.includes('—'), false);

    const arLegacy = accT('ar', 'ob.err.legacyOpeningPlain');
    assert.ok(arLegacy.length > 5);
  });

  it('buildObAccountTree + filterObWorkspaceAccounts', () => {
    const tree = buildObAccountTree([
      { accountId: '1', code: '1000', name: 'Assets', parentId: null, delta: '0' },
      { accountId: '2', code: '1001', name: 'Cash', parentId: '1', delta: '5.00' },
    ]);
    assert.equal(tree.length, 1);
    assert.equal(tree[0].children.length, 1);
    const onlyDiff = filterObWorkspaceAccounts(
      [
        { accountId: '2', code: '1001', name: 'Cash', type: 'asset', delta: '5' },
        { accountId: '3', code: '2000', name: 'AP', type: 'liability', delta: '0' },
      ],
      { onlyDifferences: true, type: 'asset' },
    );
    assert.equal(onlyDiff.length, 1);
  });

  it('mapObTrueUpTotals plug side', () => {
    const t = mapObTrueUpTotals({
      totalDebit: '10.00',
      totalCredit: '10.00',
      balanced: true,
      plug: '-2.00',
    });
    assert.equal(t.plugSide, 'Dr');
    assert.equal(t.plugAbs, '2.00');
  });

  it('ymdToDisplay EN and AR Gregorian', () => {
    assert.equal(ymdToDisplay('2026-11-08', 'en'), '08 Nov 2026');
    const ar = ymdToDisplay('2026-11-08', 'ar');
    assert.ok(ar.includes('2026'));
    assert.ok(/08|٨/.test(ar) || ar.includes('8'));
    assert.ok(/نوفمبر|Nov/i.test(ar) || ar.length > 4);
    assert.equal(ymdToDisplay('', 'en'), '');
    assert.equal(ymdToDisplay('bad', 'en'), '');
  });

  it('G1 modes editability + CSV + party sum + drawer tabs', () => {
    assert.equal(
      isObRowEditable({ isLeaf: true, mode: 'entry' }, 'draft'),
      true,
    );
    assert.equal(
      isObRowEditable({ isLeaf: true, mode: 'stock_count' }, 'draft'),
      false,
    );
    assert.equal(
      isObRowEditable({ isLeaf: true, mode: 'party' }, 'draft'),
      false,
    );
    assert.equal(
      isObRowEditable({ isLeaf: true, mode: 'entry' }, 'posted'),
      false,
    );
    const csv = parseObPartyCsv('id,amount\n12,100.00\nbad\n13,x');
    assert.equal(csv.ok.length, 1);
    assert.equal(csv.ok[0].id, '12');
    assert.ok(csv.errors.some((e) => e.line === 3));
    assert.equal(sumObPartyTargets({ a: '10', b: '2.5' }), 12.5);
    assert.ok(OB_DRAWER_TABS.includes('walkin'));
    assert.ok(OB_DRAWER_TABS.includes('vault'));
  });

  it('C1 resolveObViewState machine', () => {
    assert.equal(resolveObViewState({ loading: true }), 'loading');
    assert.equal(
      resolveObViewState({ needsStartDate: true, accounts: [] }),
      'needsStart',
    );
    assert.equal(
      resolveObViewState({ error: 'boom', accounts: [] }),
      'error',
    );
    assert.equal(resolveObViewState({ accounts: [] }), 'empty');
    assert.equal(
      resolveObViewState({ accounts: [{ accountId: '1' }] }),
      'ready',
    );
  });

  it('D1 rankObAccountSuggestions: code prefix, name, Arabic, top-20, empty→[]', () => {
    assert.deepEqual(rankObAccountSuggestions([], 'x'), []);
    assert.deepEqual(rankObAccountSuggestions([{ code: '1000' }], ''), []);
    const accounts = [
      { accountId: '1', code: '1000', name: 'Cash on hand' },
      { accountId: '2', code: '1100', name: 'AR' },
      { accountId: '3', code: '2000', name: 'نقد' },
      ...Array.from({ length: 25 }, (_, i) => ({
        accountId: String(10 + i),
        code: `9${String(i).padStart(3, '0')}`,
        name: `Other ${i}`,
      })),
    ];
    const byCode = rankObAccountSuggestions(accounts, '10');
    assert.equal(byCode[0].code, '1000');
    const byName = rankObAccountSuggestions(accounts, 'cash');
    assert.equal(byName[0].code, '1000');
    const byAr = rankObAccountSuggestions(accounts, 'نقد');
    assert.equal(byAr[0].code, '2000');
    const many = rankObAccountSuggestions(
      accounts,
      '9',
    );
    assert.ok(many.length <= 20);
    assert.equal(normalizeObSearchText('أإآ'), 'ااا');
  });

  it('obDiffSide + validateObMoneyInput + preview match', () => {
    assert.equal(obDiffSide('asset', '10'), 'Dr');
    assert.equal(obDiffSide('liability', '10'), 'Cr');
    assert.equal(obDiffSide('asset', '0'), null);
    assert.equal(validateObMoneyInput('12.5').ok, true);
    assert.equal(validateObMoneyInput('12.555').ok, false);
    assert.equal(validateObMoneyInput('ab').ok, false);
    const fp = buildObInputFingerprint('2026-11-08', { a: '1.00' });
    assert.equal(
      obPreviewMatchesInputs(
        { previewHash: 'h', _inputFingerprint: fp },
        fp,
      ),
      true,
    );
    assert.equal(
      obPreviewMatchesInputs({ previewHash: 'h', _inputFingerprint: fp }, 'x'),
      false,
    );
  });

  it('obErrorCodeToKey start-date codes', () => {
    assert.equal(obErrorCodeToKey('START_DATE_NOT_SET'), 'ob.err.startNotSet');
    assert.equal(obErrorCodeToKey('START_DATE_MISMATCH'), 'ob.err.startMismatch');
  });
});
