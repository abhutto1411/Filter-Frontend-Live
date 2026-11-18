/** @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    cleanup,
    render,
    screen,
    waitFor,
    fireEvent,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { accT } from '../../../utils/accountingI18n';

const getAccountingSettings = vi.fn();
const patchAccountingSettings = vi.fn();
const getBooksHealthSummary = vi.fn();
const getStaffAppSettings = vi.fn();
const updateStaffAppSettings = vi.fn();
const getWorkshopBranches = vi.fn();

const authState = {
    user: {
        userType: 'platform_admin',
        type: 'admin',
        role: null,
        permissionSource: 'none',
    },
};

vi.mock('../../../services/accountingSettingsApi', () => ({
    getAccountingSettings: (...a) => getAccountingSettings(...a),
    patchAccountingSettings: (...a) => patchAccountingSettings(...a),
}));
vi.mock('../../../services/booksHealthApi', () => ({
    getBooksHealthSummary: (...a) => getBooksHealthSummary(...a),
}));
vi.mock('../../../services/staffAppApi', () => ({
    getStaffAppSettings: (...a) => getStaffAppSettings(...a),
    updateStaffAppSettings: (...a) => updateStaffAppSettings(...a),
}));
vi.mock('../../../services/workshopStaffApi', () => ({
    getWorkshopBranches: (...a) => getWorkshopBranches(...a),
}));
vi.mock('../../../context/AuthContext', () => ({
    useAuth: () => ({
        hasPermission: () => true,
        user: authState.user,
    }),
}));

import WorkshopAccountingSettingsPage from './WorkshopAccountingSettingsPage';

const lockedSettings = {
    startDate: '2026-06-01',
    lockedUpTo: null,
    cutoverEnabled: false,
    basis: 'accrual',
    allowNegativeCashBank: false,
    allowNegativeCashBankByBranch: {},
    headingReclassOpen: false,
    headingReclassEffectiveOpen: false,
    headingReclassOpenedBy: null,
    headingReclassOpenedAt: null,
    headingReclassExpiresAt: null,
    history: [],
};

function renderPage(props = {}, locale = 'en') {
    return render(
        <MemoryRouter initialEntries={['/?tab=basis']}>
            <WorkshopAccountingSettingsPage locale={locale} {...props} />
        </MemoryRouter>,
    );
}

describe('WorkshopAccountingSettings heading toggle dialog', () => {
    beforeEach(() => {
        globalThis.ResizeObserver = class {
            observe() {}
            unobserve() {}
            disconnect() {}
        };
        authState.user = {
            userType: 'platform_admin',
            type: 'admin',
            role: null,
            permissionSource: 'none',
        };
        getAccountingSettings.mockResolvedValue({ ...lockedSettings });
        patchAccountingSettings.mockReset();
        getBooksHealthSummary.mockResolvedValue({});
        getStaffAppSettings.mockResolvedValue({ settings: {} });
        getWorkshopBranches.mockResolvedValue([
            { id: '1', name: 'Main' },
            { id: '2', name: 'B2' },
        ]);
    });

    afterEach(() => {
        cleanup();
    });

    it('workshop scope: click checkbox opens dialog without footer reason error', async () => {
        renderPage({ crossWorkshopSaScope: true, workshopId: '42' });
        await waitFor(() =>
            expect(screen.getByTestId('heading-reclass-open-checkbox')).toBeTruthy(),
        );
        fireEvent.click(screen.getByTestId('heading-reclass-open-checkbox'));
        expect(screen.getByTestId('heading-reclass-reason-dialog')).toBeTruthy();
        expect(patchAccountingSettings).not.toHaveBeenCalled();
        expect(
            screen.queryByText(/Reason is required when changing settings/i),
        ).toBeNull();
        expect(screen.getByTestId('heading-reclass-open-checkbox').checked).toBe(
            false,
        );
    });

    it('confirm disabled for short reason, enabled for long', async () => {
        renderPage({ crossWorkshopSaScope: true, workshopId: '42' });
        await waitFor(() =>
            expect(screen.getByTestId('heading-reclass-open-checkbox')).toBeTruthy(),
        );
        fireEvent.click(screen.getByTestId('heading-reclass-open-checkbox'));
        const confirm = screen.getByTestId('heading-reclass-confirm');
        const reason = screen.getByTestId('heading-reclass-reason');
        fireEvent.change(reason, { target: { value: 'abc' } });
        expect(confirm.disabled).toBe(true);
        fireEvent.change(reason, { target: { value: 'open for Q3 fix' } });
        expect(confirm.disabled).toBe(false);
    });

    it('confirm patches exact body and shows opened status', async () => {
        patchAccountingSettings.mockResolvedValue({
            ...lockedSettings,
            headingReclassOpen: true,
            headingReclassEffectiveOpen: true,
            headingReclassOpenedBy: '7',
            headingReclassOpenedAt: '2026-06-01T10:00:00.000Z',
            headingReclassExpiresAt: '2026-06-01T11:00:00.000Z',
        });
        renderPage({ crossWorkshopSaScope: true, workshopId: '42' });
        await waitFor(() =>
            expect(screen.getByTestId('heading-reclass-open-checkbox')).toBeTruthy(),
        );
        fireEvent.click(screen.getByTestId('heading-reclass-open-checkbox'));
        fireEvent.change(screen.getByTestId('heading-reclass-reason'), {
            target: { value: 'open for Q3 fix' },
        });
        fireEvent.click(screen.getByTestId('heading-reclass-confirm'));
        await waitFor(() => expect(patchAccountingSettings).toHaveBeenCalledTimes(1));
        const [body, scope] = patchAccountingSettings.mock.calls[0];
        expect(scope).toEqual({ workshopId: '42' });
        expect(body).toEqual({
            headingReclassOpen: true,
            reason: 'open for Q3 fix',
        });
        expect(Object.keys(body).sort()).toEqual(['headingReclassOpen', 'reason']);
        await waitFor(() =>
            expect(screen.getByTestId('heading-reclass-open-checkbox').checked).toBe(
                true,
            ),
        );
        expect(screen.getByTestId('heading-reclass-status').textContent).toMatch(
            /Opened by user #7/i,
        );
        expect(screen.getByTestId('heading-reclass-status').textContent).toMatch(
            /Auto-locks at/i,
        );
    });

    it('cancel and Escape do not patch', async () => {
        renderPage({ crossWorkshopSaScope: true, workshopId: '42' });
        await waitFor(() =>
            expect(screen.getByTestId('heading-reclass-open-checkbox')).toBeTruthy(),
        );
        fireEvent.click(screen.getByTestId('heading-reclass-open-checkbox'));
        fireEvent.click(screen.getByTestId('heading-reclass-cancel'));
        expect(patchAccountingSettings).not.toHaveBeenCalled();
        expect(screen.queryByTestId('heading-reclass-reason-dialog')).toBeNull();
        expect(screen.getByTestId('heading-reclass-open-checkbox').checked).toBe(
            false,
        );

        fireEvent.click(screen.getByTestId('heading-reclass-open-checkbox'));
        fireEvent.keyDown(window, { key: 'Escape' });
        await waitFor(() =>
            expect(screen.queryByTestId('heading-reclass-reason-dialog')).toBeNull(),
        );
        expect(patchAccountingSettings).not.toHaveBeenCalled();
    });

    it('maps SUPER_ADMIN_SETTINGS_SCOPE in dialog EN and AR', async () => {
        patchAccountingSettings.mockRejectedValue({
            code: 'SUPER_ADMIN_SETTINGS_SCOPE',
            status: 403,
        });
        renderPage({ crossWorkshopSaScope: true, workshopId: '42' }, 'en');
        await waitFor(() =>
            expect(screen.getByTestId('heading-reclass-open-checkbox')).toBeTruthy(),
        );
        fireEvent.click(screen.getByTestId('heading-reclass-open-checkbox'));
        fireEvent.change(screen.getByTestId('heading-reclass-reason'), {
            target: { value: 'open for Q3 fix' },
        });
        fireEvent.click(screen.getByTestId('heading-reclass-confirm'));
        await waitFor(() =>
            expect(screen.getByTestId('heading-reclass-dialog-error').textContent).toBe(
                accT('en', 'settings.saScopeHint'),
            ),
        );
        expect(screen.getByTestId('heading-reclass-reason-dialog')).toBeTruthy();
        cleanup();

        getAccountingSettings.mockResolvedValue({ ...lockedSettings });
        renderPage({ crossWorkshopSaScope: true, workshopId: '42' }, 'ar');
        await waitFor(() =>
            expect(screen.getByTestId('heading-reclass-open-checkbox')).toBeTruthy(),
        );
        fireEvent.click(screen.getByTestId('heading-reclass-open-checkbox'));
        fireEvent.change(screen.getByTestId('heading-reclass-reason'), {
            target: { value: 'open for Q3 fix' },
        });
        fireEvent.click(screen.getByTestId('heading-reclass-confirm'));
        await waitFor(() =>
            expect(screen.getByTestId('heading-reclass-dialog-error').textContent).toBe(
                accT('ar', 'settings.saScopeHint'),
            ),
        );
    });

    it('lock button uses dialog and maps SUPER_ADMIN_ONLY', async () => {
        getAccountingSettings.mockResolvedValue({
            ...lockedSettings,
            headingReclassOpen: true,
            headingReclassEffectiveOpen: true,
            headingReclassOpenedBy: '7',
            headingReclassOpenedAt: '2026-06-01T10:00:00.000Z',
            headingReclassExpiresAt: '2026-06-01T11:00:00.000Z',
        });
        patchAccountingSettings.mockRejectedValue({
            code: 'HEADING_RECLASS_SUPER_ADMIN_ONLY',
        });
        renderPage({ crossWorkshopSaScope: true, workshopId: '42' });
        await waitFor(() =>
            expect(screen.getByTestId('heading-reclass-lock-btn')).toBeTruthy(),
        );
        fireEvent.click(screen.getByTestId('heading-reclass-lock-btn'));
        fireEvent.change(screen.getByTestId('heading-reclass-reason'), {
            target: { value: 'lock after review' },
        });
        fireEvent.click(screen.getByTestId('heading-reclass-confirm'));
        await waitFor(() => expect(patchAccountingSettings).toHaveBeenCalled());
        const [body] = patchAccountingSettings.mock.calls[0];
        expect(body).toEqual({
            headingReclassOpen: false,
            reason: 'lock after review',
        });
        await waitFor(() =>
            expect(screen.getByTestId('heading-reclass-dialog-error').textContent).toBe(
                accT('en', 'err.HEADING_RECLASS_SUPER_ADMIN_ONLY'),
            ),
        );
    });

    it('HQ scope open works without footer reason', async () => {
        patchAccountingSettings.mockResolvedValue({
            ...lockedSettings,
            headingReclassEffectiveOpen: true,
            headingReclassOpenedBy: '1',
            headingReclassOpenedAt: '2026-06-01T10:00:00.000Z',
            headingReclassExpiresAt: '2026-06-01T11:00:00.000Z',
        });
        renderPage({ crossWorkshopSaScope: false, workshopId: '1' });
        await waitFor(() =>
            expect(screen.getByTestId('heading-reclass-open-checkbox')).toBeTruthy(),
        );
        expect(document.getElementById('acc-reason-basis')).toBeTruthy();
        fireEvent.click(screen.getByTestId('heading-reclass-open-checkbox'));
        fireEvent.change(screen.getByTestId('heading-reclass-reason'), {
            target: { value: 'hq open books' },
        });
        fireEvent.click(screen.getByTestId('heading-reclass-confirm'));
        await waitFor(() => expect(patchAccountingSettings).toHaveBeenCalled());
        expect(patchAccountingSettings.mock.calls[0][0]).toEqual({
            headingReclassOpen: true,
            reason: 'hq open books',
        });
        expect(patchAccountingSettings.mock.calls[0][1]).toEqual({ workshopId: '1' });
    });

    it('limited admin sees no checkbox', async () => {
        authState.user = {
            userType: 'platform_admin',
            type: 'admin',
            role: { isSystem: false, name: 'Limited' },
        };
        renderPage({ crossWorkshopSaScope: true, workshopId: '42' });
        await waitFor(() =>
            expect(screen.getByTestId('heading-reclass-controls')).toBeTruthy(),
        );
        expect(screen.queryByTestId('heading-reclass-open-checkbox')).toBeNull();
        expect(screen.queryByTestId('heading-reclass-lock-btn')).toBeNull();
        expect(screen.getByTestId('heading-reclass-status').textContent).toMatch(
            /Heading adjustment is locked/i,
        );
    });

    it('B2: cross-workshop SA books read-only except heading toggle', async () => {
        render(
            <MemoryRouter initialEntries={['/?tab=dates']}>
                <WorkshopAccountingSettingsPage
                    locale="en"
                    crossWorkshopSaScope
                    workshopId="42"
                />
            </MemoryRouter>,
        );
        await waitFor(() =>
            expect(screen.getByTestId('sa-settings-scope-hint')).toBeTruthy(),
        );
        expect(screen.getByTestId('sa-settings-scope-hint').textContent).toBe(
            accT('en', 'settings.saScopeHint'),
        );
        expect(document.getElementById('acc-start-date')?.disabled).toBe(true);
        expect(document.getElementById('acc-locked-up-to')?.disabled).toBe(true);
        const cutoverBox = screen
            .getAllByRole('checkbox')
            .find((el) => el.type === 'checkbox' && el.closest('label'));
        // Cutover is the only dates-form checkbox (heading toggle is basis-tab only).
        expect(cutoverBox).toBeTruthy();
        expect(cutoverBox.disabled).toBe(true);
        screen.getAllByRole('radio').forEach((r) => expect(r.disabled).toBe(true));
        expect(screen.queryByRole('button', { name: /Save changes/i })).toBeNull();
        cleanup();

        renderPage({ crossWorkshopSaScope: true, workshopId: '42' }, 'en');
        await waitFor(() =>
            expect(screen.getByTestId('heading-reclass-open-checkbox')).toBeTruthy(),
        );
        const allowNeg = screen
            .getAllByRole('checkbox')
            .find((el) =>
                (el.parentElement?.textContent || '').match(/below zero|Allow Cash/i),
            );
        expect(allowNeg?.disabled).toBe(true);
        expect(screen.queryByRole('button', { name: /Save changes/i })).toBeNull();
        expect(document.getElementById('acc-reason-basis')).toBeNull();
        expect(screen.getByTestId('heading-reclass-open-checkbox').disabled).toBe(
            false,
        );
        expect(screen.queryByTestId('cash-bank-branch-overrides')).toBeNull();
        cleanup();

        render(
            <MemoryRouter initialEntries={['/?tab=dates']}>
                <WorkshopAccountingSettingsPage
                    locale="ar"
                    crossWorkshopSaScope
                    workshopId="42"
                />
            </MemoryRouter>,
        );
        await waitFor(() =>
            expect(screen.getByTestId('sa-settings-scope-hint')).toBeTruthy(),
        );
        expect(screen.getByTestId('sa-settings-scope-hint').textContent).toBe(
            accT('ar', 'settings.saScopeHint'),
        );
    });
});
