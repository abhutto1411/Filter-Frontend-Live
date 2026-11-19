/** @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { accT } from '../../../utils/accountingI18n';

const api = vi.hoisted(() => ({
    listCashBankAccounts: vi.fn(),
    listCoaAccounts: vi.fn(),
    listPayees: vi.fn(),
    getPayment: vi.fn(),
    getReceipt: vi.fn(),
    getJournalEntry: vi.fn(),
    getAccountingBatch: vi.fn(),
    closeAccountingBatch: vi.fn(),
    createPayments: vi.fn(),
    createReceipts: vi.fn(),
    listPayments: vi.fn(),
    listReceipts: vi.fn(),
    previewNextVouchers: vi.fn(),
    reverseJournalEntry: vi.fn(),
    updatePayment: vi.fn(),
    updateReceipt: vi.fn(),
    createJournalEntry: vi.fn(),
    updateJournalEntry: vi.fn(),
}));
vi.mock('../../../services/workshopAccountingApi', () => api);
vi.mock('../../../hooks/useCashBalance', () => ({
    useCashBalance: () => ({ available: 100000, allowNegative: false, loading: false }),
    handleCashGuard409: () => null,
}));
vi.mock('../../../context/AuthContext', () => ({
    useAuth: () => ({ user: { userType: 'workshop_owner' }, hasPermission: () => true }),
}));
vi.mock('../../../hooks/useHqAdminBooksScope', () => ({ useHqAdminBooksScope: () => ({ isAdminHqBooks: false }) }));
vi.mock('./WorkshopTransactionLogPanel', () => ({ default: () => <div data-testid="log-panel" /> }));

import WorkshopTransactionEntryPage from './WorkshopTransactionEntryPage';

const t = (k, v) => accT('en', k, v);
const accounts = [
    { id: 61, code: '6110', name: 'Fuel', type: 'EXPENSE' },
    { id: 71, code: '7001', name: 'Water Purchases', type: 'EXPENSE' },
    { id: 41, code: '4100', name: 'Service revenue', type: 'INCOME' },
];
const registers = [
    { id: 1, name: 'Main Cash', type: 'CASH', currentBalance: 5000 },
    { id: 2, name: 'Main Bank', type: 'BANK', currentBalance: 9000 },
];
const payees = {
    supplier: [{ id: 'local:9', name: 'Example Supplier Co' }],
    customer: [{ id: 'corp:3', name: 'Example Customer' }],
    employee: [],
};

function setupApi() {
    for (const f of Object.values(api)) f.mockReset();
    api.listCashBankAccounts.mockResolvedValue({ accounts: registers });
    api.listCoaAccounts.mockResolvedValue({ accounts });
    api.listPayees.mockImplementation(async (type) => ({ payees: payees[type] || [] }));
    api.previewNextVouchers.mockImplementation(async (prefix, n) => ({
        vouchers: Array.from({ length: n }, (_, i) => `${prefix}${String(100 + i).padStart(4, '0')}`),
    }));
    api.listPayments.mockResolvedValue({ rows: [] });
    api.listReceipts.mockResolvedValue({ rows: [] });
    api.createPayments.mockResolvedValue({ saved: 2, total: 165, status: 'posted' });
    api.createReceipts.mockResolvedValue({ saved: 1, total: 300, status: 'posted' });
    api.createJournalEntry.mockResolvedValue({ entry: { entryNumber: 'JE0001', totalDebit: 25, totalCredit: 25 } });
    api.closeAccountingBatch.mockResolvedValue({ status: 'closed' });
}

function renderPage(props = {}) {
    return render(
        <MemoryRouter>
            <WorkshopTransactionEntryPage branches={[{ id: 5, name: 'Main' }]} selectedBranchId="all" locale="en" mode="batch" {...props} />
        </MemoryRouter>,
    );
}

async function uploadCsv(text, name = 'tx.csv') {
    const input = await screen.findByTestId('tx-import-file');
    const file = new File([text], name, { type: 'text/csv' });
    fireEvent.change(input, { target: { files: [file] } });
}

const CSV = [
    'type,date,reference,payee_type,payee,account,amount,pay_from_receive_into,debit,credit,note',
    'payment,2026-11-19,INV-1,Supplier,Example Supplier Co,7001,115.00,Main Cash,,,Water',
    'payment,2026-11-19,INV-2,Other,Fuel station,6110,50,Main Cash,,,Fuel',
    'receipt,2026-11-19,RC-1,Customer,Example Customer,4100,300,Main Bank,,,Service',
    'journal,2026-11-19,ADJ-1,,,6110,,,25,,Reclass',
    'journal,2026-11-19,ADJ-1,,,7001,,,,25,Reclass',
].join('\n');

describe('Transactions page — import into the PE / RV / JE forms', () => {
    beforeEach(setupApi);
    afterEach(cleanup);

    it('CSV → 3 groups; Open PE fills the same Payment form; Save posts via createPayments; group marked saved', async () => {
        renderPage();
        await waitFor(() => expect(api.listCoaAccounts).toHaveBeenCalled());
        await uploadCsv(CSV);
        const result = await screen.findByTestId('tx-import-result');
        expect(within(result).getByTestId('tx-import-entry-payment')).toBeTruthy();
        expect(within(result).getByTestId('tx-import-entry-receipt')).toBeTruthy();
        expect(within(result).getByTestId('tx-import-entry-journal')).toBeTruthy();
        expect(within(result).getByTestId('tx-import-entry-payment').textContent).toContain('165.00');

        fireEvent.click(screen.getByTestId('tx-import-open-payment'));
        const grid = await screen.findByTestId('ws-tx-grid-payment');
        await waitFor(() => {
            const amounts = within(grid).getAllByPlaceholderText('0.00').map((i) => i.value);
            expect(amounts).toEqual(['115.00', '50.00']);
        });
        fireEvent.click(screen.getByRole('button', { name: t('tx.btn.savePayments') }));
        await waitFor(() => expect(api.createPayments).toHaveBeenCalledTimes(1));
        const body = api.createPayments.mock.calls[0][0];
        expect(body.cashBankAccountId).toBe('1');
        expect(body.status).toBeUndefined(); // posted, not draft → backend posts the JE
        expect(body.rows.map((r) => [r.payeeType, r.payeeId, r.payeeName, r.accountId, r.amount, r.reference, r.notes])).toEqual([
            ['Supplier', 'local:9', 'Example Supplier Co', '71', 115, 'INV-1', 'Water'],
            ['Other', undefined, 'Fuel station', '61', 50, 'INV-2', 'Fuel'],
        ]);
        await waitFor(() =>
            expect(within(screen.getByTestId('tx-import-entry-payment')).getByText(t('tx.imp.status.saved'))).toBeTruthy(),
        );
    });

    it('JE group opens in the Journal form and posts a balanced entry', async () => {
        renderPage();
        await waitFor(() => expect(api.listCoaAccounts).toHaveBeenCalled());
        await uploadCsv(CSV);
        fireEvent.click(await screen.findByTestId('tx-import-open-journal'));
        await screen.findByTestId('ws-tx-grid-journal');
        fireEvent.click(await screen.findByRole('button', { name: t('tx.postJe') }));
        await waitFor(() => expect(api.createJournalEntry).toHaveBeenCalledTimes(1));
        const body = api.createJournalEntry.mock.calls[0][0];
        expect(body.lines.map((l) => [l.accountId, l.debit, l.credit])).toEqual([
            ['61', 25, 0],
            ['71', 0, 25],
        ]);
    });

    it('a line with an unknown account is never dropped silently: save is blocked and the row is named', async () => {
        renderPage();
        await waitFor(() => expect(api.listCoaAccounts).toHaveBeenCalled());
        await uploadCsv(
            'type,payee_type,payee,account,amount,pay_from_receive_into\npayment,Other,A,6110,10,Main Cash\npayment,Other,B,9999,20,Main Cash',
        );
        const result = await screen.findByTestId('tx-import-result');
        expect(within(result).getByText(t('tx.imp.problems', { n: 1 }))).toBeTruthy();
        // single group → opened automatically
        await screen.findByTestId('ws-tx-grid-payment');
        fireEvent.click(screen.getByRole('button', { name: t('tx.btn.savePayments') }));
        expect(await screen.findByText(t('tx.err.incompleteRows', { rows: '2' }))).toBeTruthy();
        expect(api.createPayments).not.toHaveBeenCalled();
    });

    it('batch draft: only unposted rows load; saving every group closes the draft (no double posting)', async () => {
        api.getAccountingBatch.mockResolvedValue({
            id: '77',
            batchNo: 'BT-000077',
            status: 'partially_posted',
            version: 4,
            rows: [
                { lineNo: 1, state: 'posted', journalId: '900', payload: { type: 'payment', amount: '5', accountId: '61', cashBankAccountId: '1' } },
                { lineNo: 2, state: 'draft', payload: { type: 'payment', date: '2026-11-19', payeeType: 'Other', payeeName: 'Shop', accountId: '71', amount: '40', cashBankAccountId: '1' } },
            ],
        });
        renderPage({ batchDraftId: '77' });
        await screen.findByText(t('tx.imp.draftTitle', { no: 'BT-000077', n: 1 }));
        const grid = await screen.findByTestId('ws-tx-grid-payment');
        await waitFor(() => expect(within(grid).getAllByPlaceholderText('0.00').map((i) => i.value)).toEqual(['40.00']));
        fireEvent.click(screen.getByRole('button', { name: t('tx.btn.savePayments') }));
        await waitFor(() => expect(api.createPayments).toHaveBeenCalledTimes(1));
        expect(api.createPayments.mock.calls[0][0].rows).toHaveLength(1);
        await waitFor(() => expect(api.closeAccountingBatch).toHaveBeenCalledWith('77', { version: 4 }));
        expect(await screen.findByText(t('tx.imp.draftClosed', { no: 'BT-000077' }))).toBeTruthy();
    });

    it('paste from Excel into the Payment lines adds rows matched to accounts / payees', async () => {
        renderPage();
        const grid = await screen.findByTestId('ws-tx-grid-payment');
        await waitFor(() => expect(api.listCoaAccounts).toHaveBeenCalled());
        const text = '19/11/2026\tSupplier\tExample Supplier Co\t7001\t115\tINV-9\tWater\n19/11/2026\tOther\tCash shop\t6110\t12.5\t\tFuel';
        fireEvent.paste(grid, { clipboardData: { getData: () => text } });
        await waitFor(() => expect(within(grid).getAllByPlaceholderText('0.00').map((i) => i.value)).toEqual(['115.00', '12.50']));
        expect(screen.getByText(t('tx.paste.ok', { n: 2 }))).toBeTruthy();
    });

    it('"Save as draft" label is translated (was a raw key)', async () => {
        renderPage();
        await screen.findByTestId('ws-tx-grid-payment');
        expect(screen.getByRole('button', { name: 'Save as draft' })).toBeTruthy();
    });
});

describe('Transactions page vs batch page (separate pages, same forms)', () => {
    beforeEach(setupApi);
    afterEach(cleanup);

    it('Transactions page: PE/RV/JE + Recent; "New transactions (one or many)" links to the batch page; no import panel', async () => {
        renderPage({ mode: 'entry' });
        const card = await screen.findByTestId('tx-many-card');
        const link = within(card).getByTestId('tx-new-many');
        expect(link.getAttribute('href')).toBe('/workshop/accounting/transactions/batch/new');
        expect(screen.getByText(t('tx.title.paymentPe'))).toBeTruthy();
        expect(screen.getByTestId('log-panel')).toBeTruthy();
        expect(screen.queryByTestId('tx-import-panel')).toBeNull();
        expect(screen.queryByTestId('tx-batch-header')).toBeNull();
    });

    it('batch page: own title / breadcrumb / back link, import on top, full-width form with 5 lines, no Recent', async () => {
        renderPage({ mode: 'batch' });
        const header = await screen.findByTestId('tx-batch-header');
        expect(within(header).getByRole('heading').textContent).toBe(t('tx.batch.titleNew'));
        expect(within(header).getByText(t('tx.batch.crumbNew'))).toBeTruthy();
        expect(within(header).getByRole('link', { name: t('tx.batch.back') }).getAttribute('href')).toBe(
            '/workshop/accounting/transactions/batches',
        );
        expect(screen.getByTestId('tx-import-panel')).toBeTruthy();
        expect(screen.queryByTestId('log-panel')).toBeNull();
        const grid = await screen.findByTestId('ws-tx-grid-payment');
        await waitFor(() => expect(within(grid).getAllByPlaceholderText('0.00')).toHaveLength(5));
        // Journal tab starts with 4 lines in batch mode
        fireEvent.click(screen.getByRole('button', { name: t('tx.tab.journalJe') }));
        const je = await screen.findByTestId('ws-tx-grid-journal');
        expect(je.querySelectorAll('tr[data-ws-je-row]').length).toBe(4);
    });

    it('import page: highlighted import card with the import title', async () => {
        renderPage({ mode: 'import' });
        const header = await screen.findByTestId('tx-batch-header');
        expect(within(header).getByRole('heading').textContent).toBe(t('tx.batch.titleImport'));
        expect(screen.getByTestId('tx-import-panel').className).toContain('is-highlight');
        expect(screen.getByTestId('tx-import-drop').textContent).toBe(t('tx.imp.dropHint'));
    });

    it('a CSV dropped on the import card is imported', async () => {
        renderPage({ mode: 'import' });
        await waitFor(() => expect(api.listCoaAccounts).toHaveBeenCalled());
        const panel = await screen.findByTestId('tx-import-panel');
        const file = new File([CSV], 'drop.csv', { type: 'text/csv' });
        fireEvent.dragOver(panel, { dataTransfer: { files: [file] } });
        expect(screen.getByTestId('tx-import-drop').textContent).toBe(t('tx.imp.dropNow'));
        fireEvent.drop(panel, { dataTransfer: { files: [file] } });
        const result = await screen.findByTestId('tx-import-result');
        expect(within(result).getAllByRole('row').length).toBe(4); // header + PE + RV + JE
    });
});

describe('batch page with auto-suggested accounts on blank lines', () => {
    beforeEach(() => {
        setupApi();
        // Every supplier shares default account 7001 → the form pre-fills it on blank Supplier lines.
        api.listPayees.mockImplementation(async (type) => ({
            payees: type === 'supplier' ? [{ id: 'local:9', name: 'Example Supplier Co', defaultAccountId: 71 }] : [],
        }));
    });
    afterEach(cleanup);

    it('untouched lines (only an auto account) never block saving; only real lines are posted', async () => {
        renderPage({ mode: 'batch' });
        const grid = await screen.findByTestId('ws-tx-grid-payment');
        await waitFor(() => expect(within(grid).getAllByPlaceholderText('0.00')).toHaveLength(5));
        const text = '19/11/2026\tSupplier\tExample Supplier Co\t7001\t115\tINV-9\tWater\n19/11/2026\tOther\tCash shop\t6110\t12.5\t\tFuel';
        fireEvent.paste(grid, { clipboardData: { getData: () => text } });
        await waitFor(() => expect(within(grid).getAllByPlaceholderText('0.00').map((i) => i.value)).toEqual(['115.00', '12.50']));
        fireEvent.click(screen.getByRole('button', { name: t('tx.btn.savePayments') }));
        await waitFor(() => expect(api.createPayments).toHaveBeenCalledTimes(1));
        expect(api.createPayments.mock.calls[0][0].rows.map((r) => [r.accountId, r.amount])).toEqual([
            ['71', 115],
            ['61', 12.5],
        ]);
    });

    it('typing an amount on 2 of 5 lines saves those 2; the 3 untouched lines are ignored', async () => {
        renderPage({ mode: 'batch' });
        const grid = await screen.findByTestId('ws-tx-grid-payment');
        await waitFor(() => expect(within(grid).getAllByPlaceholderText('0.00')).toHaveLength(5));
        const amounts = within(grid).getAllByPlaceholderText('0.00');
        fireEvent.change(amounts[0], { target: { value: '10' } });
        fireEvent.change(amounts[1], { target: { value: '20' } });
        fireEvent.click(screen.getByRole('button', { name: t('tx.btn.savePayments') }));
        await waitFor(() => expect(api.createPayments).toHaveBeenCalledTimes(1));
        expect(screen.queryByText(/choose an account and enter an amount/)).toBeNull();
        expect(api.createPayments.mock.calls[0][0].rows.map((r) => [r.accountId, r.amount])).toEqual([
            ['71', 10],
            ['71', 20],
        ]);
    });
});
