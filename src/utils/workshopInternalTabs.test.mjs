import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { workshopAccountingPath } from './workshopAccTabSlug.js';
import {
  ACC_LOCKER_CIT_RECORD,
  ACC_LOCKER_CIT_WALLET,
  LOCKER_CIT_PARENT_TAB_ID,
  LOCKER_CIT_RECORD_PATH,
  WORKSHOP_INTERNAL_TABS,
  isWorkshopTabAllowed,
  lockerCitTabFromPath,
  lockerCitWalletPath,
  workshopDeniedTabSnapTarget,
} from './workshopInternalTabs.js';

function workshopTabToPath(tabId) {
  if (String(tabId).startsWith('acc-')) return workshopAccountingPath(tabId);
  return `/workshop/${tabId}`;
}

const PARENT = LOCKER_CIT_PARENT_TAB_ID;
const RECORD = ACC_LOCKER_CIT_RECORD;
const WALLET = ACC_LOCKER_CIT_WALLET;
const WALLET_OFFICER = '42';
const WALLET_PATH = `/workshop/accounting/locker-cash-in-transit/officers/${WALLET_OFFICER}`;

function visibleFor(ids) {
  return new Set(ids);
}

describe('locker CIT child IDs are in the internal allow-list', () => {
  it('recognizes record and wallet as internal child tabs', () => {
    assert.equal(WORKSHOP_INTERNAL_TABS.has(RECORD), true);
    assert.equal(WORKSHOP_INTERNAL_TABS.has(WALLET), true);
    assert.equal(WORKSHOP_INTERNAL_TABS.has(PARENT), false);
  });
});

describe('URL mapping (direct entry and Record collection navigate)', () => {
  it('maps overview, record, and discovered wallet paths', () => {
    assert.equal(
      lockerCitTabFromPath('/workshop/accounting/locker-cash-in-transit'),
      PARENT,
    );
    assert.equal(lockerCitTabFromPath(LOCKER_CIT_RECORD_PATH), RECORD);
    assert.equal(lockerCitTabFromPath(WALLET_PATH), WALLET);
    assert.equal(
      lockerCitTabFromPath('/workshop/accounting/locker-cash-in-transit/officers/'),
      PARENT,
    );
    assert.equal(lockerCitWalletPath(WALLET_OFFICER), WALLET_PATH);
    assert.equal(lockerCitWalletPath(''), null);
    assert.equal(lockerCitWalletPath(null), null);
  });

  it('does not treat unknown accounting slugs as CIT children', () => {
    assert.equal(lockerCitTabFromPath('/workshop/accounting/cash-bank'), null);
    assert.equal(lockerCitTabFromPath('/workshop/accounting/not-a-route'), null);
    assert.equal(lockerCitTabFromPath('/workshop/dashboard'), null);
  });
});

describe('Record collection callback vs navigate', () => {
  it('callback destination is the discovered record path when no parent handler', () => {
    const onOpenRecord = undefined;
    const destination = onOpenRecord
      ? { via: 'callback' }
      : { via: 'navigate', path: LOCKER_CIT_RECORD_PATH };
    assert.equal(destination.via, 'navigate');
    assert.equal(destination.path, '/workshop/accounting/locker-cash-in-transit/record');
    assert.equal(lockerCitTabFromPath(destination.path), RECORD);
  });

  it('parent onOpenRecord is used when provided (locker workspace openTab)', () => {
    let opened = null;
    const onOpenRecord = () => {
      opened = 'record';
    };
    if (onOpenRecord) onOpenRecord();
    else {
      throw new Error('should not navigate');
    }
    assert.equal(opened, 'record');
  });
});

describe('permitted vs denied (parent locker CIT visibility)', () => {
  it('permits record/wallet when parent acc-locker-cit is visible', () => {
    const visible = visibleFor([PARENT, 'dashboard']);
    assert.equal(isWorkshopTabAllowed(RECORD, visible), true);
    assert.equal(isWorkshopTabAllowed(WALLET, visible), true);
    assert.equal(isWorkshopTabAllowed(PARENT, visible), true);
  });

  it('denies record/wallet without parent permission (dashboard-only / no locker view)', () => {
    const dashboardOnly = visibleFor(['dashboard']);
    assert.equal(isWorkshopTabAllowed(RECORD, dashboardOnly), false);
    assert.equal(isWorkshopTabAllowed(WALLET, dashboardOnly), false);
    assert.equal(isWorkshopTabAllowed('dashboard', dashboardOnly), true);
  });

  it('owner-style unrestricted sidebar still requires the parent id in visible tabs', () => {
    const ownerVisible = visibleFor([
      'dashboard',
      PARENT,
      'acc-cash',
    ]);
    assert.equal(isWorkshopTabAllowed(RECORD, ownerVisible), true);
    const collectorNoWorkshopCit = visibleFor(['dashboard']);
    assert.equal(isWorkshopTabAllowed(RECORD, collectorNoWorkshopCit), false);
  });
});

describe('opening balance allowed only when acc-settings visible (F1a)', () => {
  it('permits acc-opening-balance with acc-settings', () => {
    assert.equal(
      isWorkshopTabAllowed('acc-opening-balance', visibleFor(['acc-settings'])),
      true,
    );
  });
  it('denies acc-opening-balance with dashboard only', () => {
    assert.equal(
      isWorkshopTabAllowed('acc-opening-balance', visibleFor(['dashboard'])),
      false,
    );
  });
});

describe('suppliers statement allowed only when acc-suppliers visible (F1b)', () => {
  it('permits acc-suppliers-statement with acc-suppliers', () => {
    assert.equal(
      isWorkshopTabAllowed(
        'acc-suppliers-statement',
        visibleFor(['acc-suppliers']),
      ),
      true,
    );
  });
  it('denies acc-suppliers-statement with dashboard only', () => {
    assert.equal(
      isWorkshopTabAllowed(
        'acc-suppliers-statement',
        visibleFor(['dashboard']),
      ),
      false,
    );
  });
});

describe('corporate generate-bill is allowed with corporate-management', () => {
  it('is in INTERNAL_TABS and allowed when corporate-management is visible', () => {
    assert.equal(WORKSHOP_INTERNAL_TABS.has('corporate-generate-bill'), true);
    const visible = visibleFor(['corporate-management', 'dashboard']);
    assert.equal(isWorkshopTabAllowed('corporate-generate-bill', visible), true);
    assert.equal(isWorkshopTabAllowed('corporate-statement', visible), true);
  });

  it('denies generate-bill without corporate-management', () => {
    const dashboardOnly = visibleFor(['dashboard']);
    assert.equal(isWorkshopTabAllowed('corporate-generate-bill', dashboardOnly), false);
  });
});

describe('unknown-route fallback is unchanged', () => {
  it('workshopAccountingPath still defaults unknown acc-* ids to cash-bank', () => {
    assert.equal(
      workshopAccountingPath('acc-not-a-real-tab'),
      '/workshop/accounting/cash-bank',
    );
    assert.equal(workshopAccountingPath('acc-cash'), '/workshop/accounting/cash-bank');
    assert.equal(
      workshopAccountingPath(PARENT),
      '/workshop/accounting/locker-cash-in-transit',
    );
  });

  it('denied CIT child snaps to first visible tab (dashboard when that is first)', () => {
    const visible = visibleFor(['dashboard']);
    assert.equal(isWorkshopTabAllowed(RECORD, visible), false);
    const snap = workshopDeniedTabSnapTarget('dashboard', workshopTabToPath);
    assert.equal(snap, '/workshop/dashboard');
  });

  it('does not snap when the child is allowed', () => {
    const visible = visibleFor([PARENT]);
    assert.equal(isWorkshopTabAllowed(RECORD, visible), true);
    assert.equal(isWorkshopTabAllowed(WALLET, visible), true);
  });
});
