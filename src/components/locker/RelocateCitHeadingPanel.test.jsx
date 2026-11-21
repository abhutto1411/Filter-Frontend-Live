/** @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../services/api', () => ({ apiFetch: vi.fn() }));
import { apiFetch } from '../../services/api';
import RelocateCitHeadingPanel from './RelocateCitHeadingPanel';

const t = (key, vars) => (vars ? `${key} ${JSON.stringify(vars)}` : key);

const DRY = {
    dryRun: true,
    wrote: false,
    idempotent: false,
    proposedHeadingCode: '1006',
    colliding: {
        id: '55',
        code: '1005',
        name: 'Employee Advances',
        type: 'ASSET',
        postedLineCount: 12,
        glBalance: 340.5,
    },
    officersWouldGetLeaves: [{ officerUserId: '9', code: '1006-O9', name: 'Omar' }],
};

describe('RelocateCitHeadingPanel', () => {
    beforeEach(() => apiFetch.mockReset());
    afterEach(cleanup);

    it('requires a reason of 5+ chars before dry-run', () => {
        render(<RelocateCitHeadingPanel t={t} />);
        const dryBtn = screen.getByText('record.relocateDryRun');
        expect(dryBtn.disabled).toBe(true);
        fireEvent.change(screen.getByLabelText('record.relocateReasonLabel'), { target: { value: 'abc' } });
        expect(dryBtn.disabled).toBe(true);
        fireEvent.change(screen.getByLabelText('record.relocateReasonLabel'), { target: { value: '1005 is advances' } });
        expect(dryBtn.disabled).toBe(false);
    });

    it('dry-run shows the full result and writes nothing; apply is a separate click', async () => {
        const onApplied = vi.fn();
        apiFetch.mockResolvedValueOnce(DRY);
        render(<RelocateCitHeadingPanel t={t} onApplied={onApplied} />);
        fireEvent.change(screen.getByLabelText('record.relocateReasonLabel'), { target: { value: '1005 is advances' } });
        fireEvent.click(screen.getByText('record.relocateDryRun'));
        await screen.findByText(/record\.relocateProposed .*1006/);
        expect(apiFetch).toHaveBeenCalledTimes(1);
        expect(JSON.parse(apiFetch.mock.calls[0][1].body)).toEqual({ dryRun: true, reason: '1005 is advances' });
        const coll = screen.getByTestId('cit-relocate-colliding').textContent;
        expect(coll).toContain('"id":"55"');
        expect(coll).toContain('"lines":12');
        expect(coll).toContain('"balance":"340.50"');
        expect(screen.getByTestId('cit-relocate-officers').textContent).toContain('1006-O9');
        expect(onApplied).not.toHaveBeenCalled();

        fireEvent.click(screen.getByText('record.relocateApply'));
        await screen.findByText('record.relocateConfirmTitle');
        fireEvent.click(screen.getByText('record.relocateConfirmYes'));
        await screen.findByText(/record\.relocateDone .*1006/);
        expect(JSON.parse(apiFetch.mock.calls[1][1].body)).toEqual({ dryRun: false, reason: '1005 is advances' });
        await waitFor(() => expect(onApplied).toHaveBeenCalledTimes(1));
    });

    it('cancel confirm does not call apply API', async () => {
        apiFetch.mockResolvedValueOnce(DRY);
        render(<RelocateCitHeadingPanel t={t} />);
        fireEvent.change(screen.getByLabelText('record.relocateReasonLabel'), { target: { value: '1005 is advances' } });
        fireEvent.click(screen.getByText('record.relocateDryRun'));
        await screen.findByText(/record\.relocateProposed .*1006/);
        fireEvent.click(screen.getByText('record.relocateApply'));
        await screen.findByText('record.relocateConfirmTitle');
        fireEvent.click(screen.getByText('record.relocateConfirmNo'));
        expect(screen.queryByText('record.relocateConfirmTitle')).toBeNull();
        expect(apiFetch).toHaveBeenCalledTimes(1);
    });

    it('idempotent replay shows the existing heading and no apply button', async () => {
        apiFetch.mockResolvedValueOnce({
            dryRun: true,
            idempotent: true,
            heading: { id: '77', code: '1006' },
            colliding: null,
            officersWouldGetLeaves: [],
        });
        render(<RelocateCitHeadingPanel t={t} />);
        fireEvent.change(screen.getByLabelText('record.relocateReasonLabel'), { target: { value: 'replay check' } });
        fireEvent.click(screen.getByText('record.relocateDryRun'));
        await screen.findByText(/record\.relocateIdempotent .*1006/);
        expect(screen.queryByText('record.relocateApply')).toBeNull();
    });

    it('shows the backend error (e.g. not owner) instead of navigating', async () => {
        apiFetch.mockRejectedValueOnce(Object.assign(new Error('Only the workshop owner'), { code: 'LOCKER_CIT_FORBIDDEN' }));
        render(<RelocateCitHeadingPanel t={t} />);
        fireEvent.change(screen.getByLabelText('record.relocateReasonLabel'), { target: { value: 'some reason' } });
        fireEvent.click(screen.getByText('record.relocateDryRun'));
        const alert = await screen.findByRole('alert');
        expect(alert.textContent.length).toBeGreaterThan(0);
    });
});
