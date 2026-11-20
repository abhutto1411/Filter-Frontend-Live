/** @vitest-environment jsdom */
/* global process */
process.env.TZ = 'Asia/Riyadh';

import React from 'react';
import {
  afterEach,
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
import { MemoryRouter } from 'react-router-dom';
import { formatObSavedTime } from '../../../utils/openingBalanceDisplay';

const getOpeningBalanceWorkspace = vi.fn();
const getOpeningBalanceSubledger = vi.fn();
const previewOpeningBalance = vi.fn();
const postOpeningBalance = vi.fn();
const reverseOpeningBalance = vi.fn();
const saveOpeningBalanceDraft = vi.fn();

vi.mock('../../../services/openingBalanceApi', () => ({
  getOpeningBalanceWorkspace: (...a) => getOpeningBalanceWorkspace(...a),
  getOpeningBalanceSubledger: (...a) => getOpeningBalanceSubledger(...a),
  previewOpeningBalance: (...a) => previewOpeningBalance(...a),
  postOpeningBalance: (...a) => postOpeningBalance(...a),
  reverseOpeningBalance: (...a) => reverseOpeningBalance(...a),
  saveOpeningBalanceDraft: (...a) => saveOpeningBalanceDraft(...a),
}));

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({
    hasPermission: () => true,
    user: { userType: 'workshop_owner', id: '1', name: 'Owner' },
  }),
}));

vi.mock('./ObAccountSearch', () => ({
  default: () => <div data-testid="ob-account-search" />,
}));

import WorkshopOpeningBalancePage from './WorkshopOpeningBalancePage';

const workspaceFixture = {
  startDate: '2026-11-12',
  needsStartDate: false,
  status: 'draft',
  draft: {
    draftVersion: 3,
    savedAt: '2026-11-15T19:15:00Z',
    accounts: { '1001': '-96933.31' },
  },
  accounts: [
    {
      accountId: '1',
      code: '1000',
      name: 'Assets',
      type: 'asset',
      parentId: null,
      isLeaf: false,
      mode: 'system',
      baseline: '0.00',
      target: '0.00',
      delta: '0.00',
      currentToday: '0.00',
    },
    {
      accountId: '1001',
      code: '1001',
      name: 'Cash leaf',
      type: 'asset',
      parentId: '1',
      isLeaf: true,
      mode: 'entry',
      baseline: '-96933.31',
      target: '-96933.31',
      delta: '0.00',
      currentToday: '-96933.31',
      editable: true,
    },
    {
      accountId: '1200',
      code: '1200',
      name: 'Inventory',
      type: 'asset',
      parentId: '1',
      isLeaf: true,
      mode: 'stock_count',
      baseline: '500.00',
      target: '500.00',
      delta: '0.00',
      currentToday: '500.00',
      editable: false,
    },
  ],
};

const previewFixture = {
  previewHash: 'h1',
  trueUp: {
    totalDebit: '100.00',
    totalCredit: '100.00',
    balanced: true,
    plug: '0.00',
    lines: [
      {
        accountId: '1001',
        account: '1001 Cash leaf',
        debit: '100.00',
        credit: '0.00',
      },
      {
        accountId: '3500',
        account: '3500 Equity',
        debit: '0.00',
        credit: '100.00',
      },
    ],
  },
  journalPreview: {
    balanced: true,
    lines: [],
  },
  legacyOpeningsAfterStart: [],
};

function renderPage() {
  return render(
    <MemoryRouter>
      <WorkshopOpeningBalancePage locale="en" />
    </MemoryRouter>,
  );
}

async function readyPage() {
  renderPage();
  await screen.findByRole('button', { name: /Review journal/i });
}

describe('WorkshopOpeningBalancePage review popup', () => {
  beforeEach(() => {
    getOpeningBalanceWorkspace.mockReset();
    getOpeningBalanceSubledger.mockReset();
    previewOpeningBalance.mockReset();
    postOpeningBalance.mockReset();
    reverseOpeningBalance.mockReset();
    saveOpeningBalanceDraft.mockReset();

    getOpeningBalanceWorkspace.mockResolvedValue({ ...workspaceFixture });
    previewOpeningBalance.mockResolvedValue({ ...previewFixture });
    saveOpeningBalanceDraft.mockResolvedValue({
      draft: {
        draftVersion: 4,
        savedAt: '2026-11-15T19:15:00Z',
      },
    });
    getOpeningBalanceSubledger.mockResolvedValue({ items: [] });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('1: popup stays open ≥10s; workspace GET exactly once; preview once', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTime.bind(vi),
    });
    await readyPage();
    expect(getOpeningBalanceWorkspace).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /Review journal/i }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(previewOpeningBalance).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(getOpeningBalanceWorkspace).toHaveBeenCalledTimes(1);
    expect(previewOpeningBalance).toHaveBeenCalledTimes(1);
  });

  it('2: Post & lock enables after review; confirm opens step 3; post not called', async () => {
    const user = userEvent.setup();
    await readyPage();
    await user.click(screen.getByRole('button', { name: /Review journal/i }));
    const reviewDialog = await screen.findByRole('dialog');

    const footerPosts = screen
      .getAllByRole('button', { name: /Post & lock/i })
      .filter((b) => !reviewDialog.contains(b));
    const dialogPost = within(reviewDialog).getByRole('button', {
      name: /Post & lock/i,
    });
    expect(dialogPost).toBeEnabled();
    for (const btn of footerPosts) {
      expect(btn).toBeEnabled();
    }

    await user.click(dialogPost);
    await waitFor(() => {
      expect(screen.getByLabelText(/Reason \(required\)/i)).toBeInTheDocument();
    });
    expect(postOpeningBalance).not.toHaveBeenCalled();
  });

  it('3a: survives autosave — popup stays; workspace GET still 1', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTime.bind(vi),
    });
    await readyPage();

    const cashInput = screen.getByLabelText(/1001 opening/i);
    await user.clear(cashInput);
    await user.type(cashInput, '-90000.00');

    await user.click(screen.getByRole('button', { name: /Review journal/i }));
    await screen.findByRole('dialog');
    expect(getOpeningBalanceWorkspace).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(61_000);
    await waitFor(() => {
      expect(saveOpeningBalanceDraft).toHaveBeenCalled();
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(getOpeningBalanceWorkspace).toHaveBeenCalledTimes(1);
  });

  it('3b: editing an amount while review is open invalidates preview', async () => {
    const user = userEvent.setup();
    await readyPage();
    await user.click(screen.getByRole('button', { name: /Review journal/i }));
    await screen.findByRole('dialog');
    for (const btn of screen.getAllByRole('button', { name: /Post & lock/i })) {
      expect(btn).toBeEnabled();
    }
    // Overlay blocks pointer events; change the controlled input directly.
    fireEvent.change(screen.getByLabelText(/1001 opening/i), {
      target: { value: '-89999.00' },
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    for (const btn of screen.getAllByRole('button', { name: /Post & lock/i })) {
      expect(btn).toBeDisabled();
    }
  });

  it('4: unsaved edits are not wiped by Review; preview body contains them', async () => {
    const user = userEvent.setup();
    await readyPage();
    const cashInput = screen.getByLabelText(/1001 opening/i);
    await user.clear(cashInput);
    await user.type(cashInput, '-90000.00');
    await user.click(screen.getByRole('button', { name: /Review journal/i }));
    await screen.findByRole('dialog');
    expect(cashInput).toHaveValue('-90000.00');
    expect(previewOpeningBalance).toHaveBeenCalledWith(
      expect.objectContaining({
        accounts: expect.objectContaining({ '1001': '-90000.00' }),
      }),
    );
  });

  it('5: Back closes popup; click inside does not', async () => {
    const user = userEvent.setup();
    await readyPage();
    await user.click(screen.getByRole('button', { name: /Review journal/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('heading', { name: /Review journal/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: /^Back$/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('6: refresh closes cleanly; stepper back to step 1', async () => {
    const user = userEvent.setup();
    await readyPage();
    await user.click(screen.getByRole('button', { name: /Review journal/i }));
    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: /^Refresh$/i }));
    await waitFor(() => {
      expect(getOpeningBalanceWorkspace).toHaveBeenCalledTimes(2);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Review journal/i })).toBeInTheDocument();
    // Step 1 active: first stepper item is bold / shows "1" (not checkmark) for Enter balances
    expect(screen.getByText(/Enter balances/i)).toBeInTheDocument();
    const step1 = screen.getByText(/Enter balances/i).closest('li');
    expect(within(step1).getByText('1')).toBeInTheDocument();
  });

  it('7: preview error shows JE-9; no dialog; workspace GET still 1', async () => {
    const user = userEvent.setup();
    previewOpeningBalance.mockRejectedValueOnce(
      Object.assign(new Error('legacy'), {
        code: 'OB_LEGACY_OPENING_AFTER_START',
        details: { journals: [{ number: 'JE-9' }] },
      }),
    );
    await readyPage();
    await user.click(screen.getByRole('button', { name: /Review journal/i }));
    await waitFor(() => {
      expect(screen.getByText(/JE-9/)).toBeInTheDocument();
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(getOpeningBalanceWorkspace).toHaveBeenCalledTimes(1);
  });

  it('8: R3 draft chip shows local time 22:15 not 19:15', async () => {
    await readyPage();
    const expected = formatObSavedTime('2026-11-15T19:15:00Z', 'en');
    expect(expected).toBe('22:15');
    expect(screen.getByText(new RegExp(expected))).toBeInTheDocument();
    expect(screen.queryByText(/Draft · saved 19:15|19:15/)).not.toBeInTheDocument();
  });

  it('9: inventory account stays read-only (Montana)', async () => {
    await readyPage();
    expect(screen.queryByLabelText(/1200 opening/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Inventory/i)).toBeInTheDocument();
  });
});
