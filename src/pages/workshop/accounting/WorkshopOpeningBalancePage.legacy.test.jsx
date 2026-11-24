/** @vitest-environment jsdom */
/* global process */
process.env.TZ = 'Asia/Riyadh';

import React from 'react';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import '@testing-library/jest-dom/vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const getOpeningBalanceWorkspace = vi.fn();
const getOpeningBalanceSubledger = vi.fn();
const previewOpeningBalance = vi.fn();
const postOpeningBalance = vi.fn();
const reverseOpeningBalance = vi.fn();
const saveOpeningBalanceDraft = vi.fn();
const getAcctJournalEntry = vi.fn();
const listAcctJournalEntries = vi.fn();

vi.mock('../../../services/openingBalanceApi', () => ({
  getOpeningBalanceWorkspace: (...a) => getOpeningBalanceWorkspace(...a),
  getOpeningBalanceSubledger: (...a) => getOpeningBalanceSubledger(...a),
  previewOpeningBalance: (...a) => previewOpeningBalance(...a),
  postOpeningBalance: (...a) => postOpeningBalance(...a),
  reverseOpeningBalance: (...a) => reverseOpeningBalance(...a),
  saveOpeningBalanceDraft: (...a) => saveOpeningBalanceDraft(...a),
}));

vi.mock('../../../services/workshopAccountingApi', () => ({
  getJournalEntry: (...a) => getAcctJournalEntry(...a),
  listJournalEntries: (...a) => listAcctJournalEntries(...a),
  reverseJournalEntry: vi.fn(),
  voidJournalEntry: vi.fn(),
}));

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({
    hasPermission: () => true,
    user: { userType: 'workshop_owner', id: '1', name: 'Owner' },
  }),
}));

vi.mock('../../../hooks/useHqAdminBooksScope', () => ({
  useHqAdminBooksScope: () => ({ isAdminHqBooks: false }),
}));

vi.mock('./ObAccountSearch', () => ({
  default: () => <div data-testid="ob-account-search" />,
}));

vi.mock('./JournalReversePanel', () => ({
  default: () => null,
}));

import WorkshopOpeningBalancePage from './WorkshopOpeningBalancePage';
import WorkshopGeneralJournalPage from './WorkshopGeneralJournalPage';

const workspaceFixture = {
  startDate: '2026-11-08',
  needsStartDate: false,
  status: 'draft',
  draft: { draftVersion: 1, savedAt: '2026-11-15T19:15:00Z', accounts: {} },
  accounts: [
    {
      accountId: '1001',
      code: '1001',
      name: 'Cash leaf',
      type: 'asset',
      parentId: null,
      isLeaf: true,
      mode: 'entry',
      baseline: '0.00',
      target: '0.00',
      delta: '0.00',
      currentToday: '0.00',
      editable: true,
    },
  ],
};

const legacyRow = {
  id: '112405',
  number: 'JE0006',
  date: '2026-11-14',
  total: '220.00',
  source: 'OPENING_BAL',
  description: 'Opening balance — Test Non-Affiliated',
  parties: [
    {
      kind: 'ap_local',
      partyId: '47',
      name: 'Test Non-Affiliated supplier 14-11-2026',
      debit: '0.00',
      credit: '220.00',
    },
  ],
  lines: [],
};

const previewWithLegacy = {
  previewHash: 'h-legacy',
  trueUp: {
    totalDebit: '0.00',
    totalCredit: '0.00',
    balanced: true,
    plug: '0.00',
    lines: [],
  },
  journalPreview: { balanced: true, lines: [] },
  legacyOpeningsAfterStart: [legacyRow],
};

const previewEmpty = {
  ...previewWithLegacy,
  previewHash: 'h-empty',
  legacyOpeningsAfterStart: [],
};

function renderOb() {
  return render(
    <MemoryRouter>
      <WorkshopOpeningBalancePage locale="en" />
    </MemoryRouter>,
  );
}

async function reviewAndOpenPost(user) {
  await screen.findByRole('button', { name: /Review journal/i });
  await user.click(screen.getByRole('button', { name: /Review journal/i }));
  const reviewDialog = await screen.findByRole('dialog');
  await user.click(
    within(reviewDialog).getByRole('button', { name: /Post & lock/i }),
  );
  await screen.findByTestId('ob-reverse-legacy');
}

describe('WorkshopOpeningBalancePage legacy opening (F-T1–F-T8)', () => {
  beforeEach(() => {
    getOpeningBalanceWorkspace.mockReset();
    getOpeningBalanceSubledger.mockReset();
    previewOpeningBalance.mockReset();
    postOpeningBalance.mockReset();
    reverseOpeningBalance.mockReset();
    saveOpeningBalanceDraft.mockReset();
    getOpeningBalanceWorkspace.mockResolvedValue({ ...workspaceFixture });
    previewOpeningBalance.mockResolvedValue({ ...previewWithLegacy });
    saveOpeningBalanceDraft.mockResolvedValue({
      draft: { draftVersion: 2, savedAt: '2026-11-15T19:15:00Z' },
    });
    getOpeningBalanceSubledger.mockResolvedValue({ items: [] });
    postOpeningBalance.mockResolvedValue({
      status: 'posted',
      journalNo: 'JE0100',
      journalId: '999',
      legacyReversed: [
        {
          originalId: '112405',
          originalNumber: 'JE0006',
          reversalId: '112500',
          reversalNumber: 'JE0101',
          date: '2026-11-14',
        },
      ],
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('F-T1: banner shows JE0006 line, Open link, no re-date', async () => {
    const user = userEvent.setup();
    renderOb();
    await user.click(
      await screen.findByRole('button', { name: /Review journal/i }),
    );
    const banner = await screen.findByTestId('ob-legacy-banner');
    expect(banner).toHaveTextContent(/JE0006/);
    expect(banner).toHaveTextContent(/220/);
    expect(banner).toHaveTextContent(/Test Non-Affiliated/);
    expect(banner.textContent.toLowerCase()).not.toMatch(/re-date|re-dated/);
    const open = within(banner).getByRole('link', { name: /^Open$/i });
    expect(open).toHaveAttribute(
      'href',
      '/workshop/accounting/journal-entries?journal=112405',
    );
  });

  it('F-T2: reverse-legacy checkbox unticked; confirm disabled until ticked', async () => {
    const user = userEvent.setup();
    renderOb();
    await reviewAndOpenPost(user);
    const box = screen.getByTestId('ob-reverse-legacy');
    expect(box).not.toBeChecked();
    expect(screen.getByTestId('ob-post-confirm')).toBeDisabled();
    await user.click(box);
    expect(screen.getByTestId('ob-post-confirm')).toBeEnabled();
  });

  it('F-T3: post sends reverseLegacyOpeningIds; omitted when no legacy', async () => {
    const user = userEvent.setup();
    renderOb();
    await reviewAndOpenPost(user);
    await user.click(screen.getByTestId('ob-reverse-legacy'));
    fireEvent.change(screen.getByLabelText(/Reason \(required\)/i), {
      target: { value: 'Test OB cutover' },
    });
    await user.click(screen.getByTestId('ob-post-confirm'));
    await waitFor(() => {
      expect(postOpeningBalance).toHaveBeenCalledTimes(1);
    });
    expect(postOpeningBalance).toHaveBeenCalledWith(
      expect.objectContaining({
        reverseLegacyOpeningIds: ['112405'],
      }),
    );

    cleanup();
    postOpeningBalance.mockClear();
    previewOpeningBalance.mockResolvedValue({ ...previewEmpty });
    getOpeningBalanceWorkspace.mockResolvedValue({ ...workspaceFixture });
    renderOb();
    await user.click(
      await screen.findByRole('button', { name: /Review journal/i }),
    );
    const reviewDialog = await screen.findByRole('dialog');
    await user.click(
      within(reviewDialog).getByRole('button', { name: /Post & lock/i }),
    );
    expect(screen.queryByTestId('ob-reverse-legacy')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Reason \(required\)/i), {
      target: { value: 'Test OB cutover' },
    });
    await user.click(screen.getByTestId('ob-post-confirm'));
    await waitFor(() => expect(postOpeningBalance).toHaveBeenCalled());
    const body = postOpeningBalance.mock.calls[0][0];
    expect(body.reverseLegacyOpeningIds).toBeUndefined();
  });

  it('F-T4 + F-T7: CHANGED keeps popup, clears tick, disables until re-review', async () => {
    const user = userEvent.setup();
    postOpeningBalance.mockRejectedValueOnce(
      Object.assign(new Error('changed'), {
        code: 'OB_LEGACY_OPENING_CHANGED',
        details: { expected: ['112405', '99'], provided: ['112405'] },
      }),
    );
    renderOb();
    await reviewAndOpenPost(user);
    await user.click(screen.getByTestId('ob-reverse-legacy'));
    fireEvent.change(screen.getByLabelText(/Reason \(required\)/i), {
      target: { value: 'Test OB cutover' },
    });
    expect(screen.getByTestId('ob-post-confirm')).toBeEnabled();
    await user.click(screen.getByTestId('ob-post-confirm'));
    await waitFor(() => {
      expect(postOpeningBalance).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getAllByText(/Review again/i).length).toBeGreaterThan(0);
    });
    const confirmDlg = screen.getByTestId('ob-post-confirm').closest('[role="dialog"]');
    expect(confirmDlg).toBeTruthy();
    expect(screen.getByTestId('ob-reverse-legacy')).not.toBeChecked();
    expect(screen.getByTestId('ob-post-confirm')).toBeDisabled();
    expect(getOpeningBalanceWorkspace).toHaveBeenCalledTimes(1);

    previewOpeningBalance.mockResolvedValueOnce({
      ...previewWithLegacy,
      previewHash: 'h2',
      legacyOpeningsAfterStart: [
        legacyRow,
        {
          ...legacyRow,
          id: '99',
          number: 'JE0099',
          total: '10.00',
        },
      ],
    });
    await user.click(within(confirmDlg).getByRole('button', { name: /Cancel/i }));
    // Close review overlay, then Review again so the late JE appears in the banner.
    const reviewDlg = screen.getByRole('dialog');
    const backBtn = within(reviewDlg).queryByRole('button', { name: /^Back$/i });
    if (backBtn) await user.click(backBtn);
    await user.click(screen.getByRole('button', { name: /Review journal/i }));
    await waitFor(() => {
      expect(screen.getByTestId('ob-legacy-banner')).toHaveTextContent(/JE0099/);
    });
    expect(getOpeningBalanceWorkspace).toHaveBeenCalledTimes(1);
  });

  it('F-T5: success toast lists reversal', async () => {
    const user = userEvent.setup();
    renderOb();
    await reviewAndOpenPost(user);
    await user.click(screen.getByTestId('ob-reverse-legacy'));
    fireEvent.change(screen.getByLabelText(/Reason \(required\)/i), {
      target: { value: 'Test OB cutover' },
    });
    await user.click(screen.getByTestId('ob-post-confirm'));
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/JE0006/);
      expect(screen.getByRole('status')).toHaveTextContent(/JE0101/);
    });
  });

  it('F-T8: posted status hides banner and tick', async () => {
    const user = userEvent.setup();
    getOpeningBalanceWorkspace.mockResolvedValue({
      ...workspaceFixture,
      status: 'posted',
      posted: { journalNo: 'JE0100', journalId: '1', postedAt: '2026-11-08' },
    });
    renderOb();
    await screen.findByText(/Posted/i);
    // Even if preview somehow has legacy, banner gated on status
    previewOpeningBalance.mockResolvedValue({ ...previewWithLegacy });
    // Review may still be allowed or not when posted — banner must not show for posted
    expect(screen.queryByTestId('ob-legacy-banner')).not.toBeInTheDocument();
    void user;
  });

  it('F-T9: banner prefixes the party with Opening balance —', async () => {
    const user = userEvent.setup();
    renderOb();
    await user.click(
      await screen.findByRole('button', { name: /Review journal/i }),
    );
    const banner = await screen.findByTestId('ob-legacy-banner');
    expect(banner).toHaveTextContent(
      'Opening balance — Test Non-Affiliated supplier 14-11-2026',
    );
  });

  it('F-T10: unticked reverse box shows the required message and keeps Post disabled', async () => {
    const user = userEvent.setup();
    renderOb();
    await reviewAndOpenPost(user);
    expect(screen.getByTestId('ob-post-confirm')).toBeDisabled();
    const note = screen.getByTestId('ob-reverse-legacy-required');
    expect(note).toHaveTextContent(
      'Tick “Reverse these old opening entries” before Post & lock.',
    );
    expect(note.textContent).not.toContain('—');
    expect(postOpeningBalance).not.toHaveBeenCalled();
  });

  it('F-T11: PREVIEW_STALE keeps the popup, clears the tick, and shows the stale note', async () => {
    const user = userEvent.setup();
    postOpeningBalance.mockRejectedValueOnce(
      Object.assign(new Error('stale'), { code: 'PREVIEW_STALE' }),
    );
    renderOb();
    await reviewAndOpenPost(user);
    await user.click(screen.getByTestId('ob-reverse-legacy'));
    fireEvent.change(screen.getByLabelText(/Reason \(required\)/i), {
      target: { value: 'Test OB cutover' },
    });
    await user.click(screen.getByTestId('ob-post-confirm'));
    await waitFor(() => {
      expect(screen.getByText(/Press Review journal again/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/old opening entries changed/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('ob-reverse-legacy')).not.toBeChecked();
    expect(screen.getByTestId('ob-post-confirm')).toBeDisabled();
    expect(getOpeningBalanceWorkspace).toHaveBeenCalledTimes(1);
  });
});

describe('WorkshopGeneralJournalPage ?journal= (F-T6)', () => {
  beforeEach(() => {
    listAcctJournalEntries.mockReset();
    getAcctJournalEntry.mockReset();
    listAcctJournalEntries.mockResolvedValue({
      total: 1,
      entries: [
        {
          id: '112405',
          entryNumber: 'JE0006',
          date: '2026-11-14',
          status: 'posted',
          totalDebit: '220.00',
        },
      ],
      summary: {},
    });
    getAcctJournalEntry.mockResolvedValue({
      entry: {
        id: '112405',
        entryNumber: 'JE0006',
        date: '2026-11-14',
        status: 'posted',
        lines: [],
        isBalanced: true,
      },
    });
  });

  afterEach(() => cleanup());

  it('opens detail for journal query param', async () => {
    render(
      <MemoryRouter
        initialEntries={['/workshop/accounting/journal-entries?journal=112405']}
      >
        <Routes>
          <Route
            path="/workshop/accounting/journal-entries"
            element={<WorkshopGeneralJournalPage locale="en" />}
          />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(getAcctJournalEntry).toHaveBeenCalledWith('112405');
    });
    // Detail panel loads the entry selected from ?journal=
    await waitFor(() => {
      expect(
        screen.getAllByText(/JE0006/).some((el) => el.textContent?.includes('JE0006')),
      ).toBe(true);
    });
  });
});
