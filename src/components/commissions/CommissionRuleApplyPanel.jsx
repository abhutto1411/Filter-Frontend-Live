import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
    applyWorkshopCommissionRule,
    previewWorkshopCommissionRuleApply,
} from '../../services/workshopCommissionsApi';
import CommissionApplyWorkerPicker from './CommissionApplyWorkerPicker';
import {
    formatSelectedWorkerCount,
    presentApplyServerError,
    previewCoverage,
    samePreviewInputs,
} from './commissionApplyWorkers';
import { optionalFromDateError } from './commissionRuleDates';
import {
    applyResultCounts,
    commissionRoleLabel,
    differenceTone,
    displayMoneyString,
    isPeriodLocked,
    mapPreviewWorkers,
    previewApplyBody,
    previewTotals,
    unwrapApplyResponse,
} from './commissionRuleApplyModel';
import '../compensation/CompensationRevisionPanel.css';

/**
 * Preview, then confirm, applying one commission rule to past sales.
 * Same two-step layout as CompensationRevisionPanel.
 */
export default function CommissionRuleApplyPanel({
    ruleId,
    ruleName = '',
    t,
    canApply = false,
    workshopId = '',
    onApplied,
}) {
    const [fromDate, setFromDate] = useState('');
    const [selectedWorkers, setSelectedWorkers] = useState([]);
    const [preview, setPreview] = useState(null);
    const [pending, setPending] = useState(null);
    const [result, setResult] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const requestGen = useRef(0);

    const scope = useMemo(
        () => (workshopId ? { workshopId: String(workshopId) } : {}),
        [workshopId],
    );
    const selectedIds = useMemo(() => selectedWorkers.map((worker) => worker.id), [selectedWorkers]);
    const currentInputs = useMemo(() => ({
        ruleId: ruleId == null ? '' : String(ruleId),
        fromDate,
        workerIds: selectedIds,
    }), [ruleId, fromDate, selectedIds]);
    const previewMatches = samePreviewInputs(pending, currentInputs);

    useEffect(() => {
        setFromDate('');
        setSelectedWorkers([]);
        setPreview(null);
        setPending(null);
        setResult(null);
        setError('');
        setBusy(false);
        requestGen.current += 1;
    }, [ruleId]);

    if (!ruleId) return null;

    const workers = preview ? mapPreviewWorkers(preview) : [];
    const totals = preview ? previewTotals(preview) : null;
    const locked = isPeriodLocked(preview);
    const lockMessage = locked ? (preview?.periodLockMessage || t('apply.periodLockedFallback')) : '';

    const invalidatePreview = () => {
        requestGen.current += 1;
        setPreview(null);
        setPending(null);
        setResult(null);
        setBusy(false);
    };

    const onFromDate = (value) => {
        setFromDate(value);
        invalidatePreview();
        setError('');
    };

    const onWorkers = (next) => {
        setSelectedWorkers(next);
        invalidatePreview();
        setError('');
    };

    const runPreview = async () => {
        if (optionalFromDateError(fromDate)) {
            setError(t('rules.err.effectiveInvalid'));
            return;
        }
        const gen = requestGen.current + 1;
        requestGen.current = gen;
        setError('');
        setBusy(true);
        const body = previewApplyBody(fromDate, selectedIds);
        try {
            const res = unwrapApplyResponse(
                await previewWorkshopCommissionRuleApply(ruleId, body, scope),
            );
            if (gen !== requestGen.current) return;
            setPending({
                ruleId: String(ruleId),
                fromDate: body.fromDate || '',
                workerIds: body.workerIds || [],
            });
            setPreview(res);
            setResult(null);
        } catch (err) {
            if (gen !== requestGen.current) return;
            setPreview(null);
            setPending(null);
            setError(presentApplyServerError(err, t, t('apply.previewErr')));
        } finally {
            if (gen === requestGen.current) setBusy(false);
        }
    };

    const runApply = async () => {
        if (!canApply || locked || !previewMatches || !pending) return;
        setError('');
        setBusy(true);
        try {
            const body = previewApplyBody(pending.fromDate, pending.workerIds);
            const res = unwrapApplyResponse(await applyWorkshopCommissionRule(ruleId, body, scope));
            setResult(applyResultCounts(res));
            setPreview(null);
            setPending(null);
            onApplied?.(res);
        } catch (err) {
            setError(presentApplyServerError(err, t, t('apply.applyErr')));
        } finally {
            setBusy(false);
        }
    };

    const coverage = preview ? previewCoverage(preview) : null;
    const coverageLabel = coverage
        ? coverage.kind === 'selected'
            ? formatSelectedWorkerCount(coverage.count, t, 'apply.coverageSelected')
            : t('apply.coverageAll')
        : '';

    const meta = preview
        ? [preview.fromDate, preview.toDate, preview.runDate].some(Boolean)
            ? t('apply.meta', {
                from: preview.fromDate || t('emDash'),
                to: preview.toDate || t('emDash'),
                runDate: preview.runDate || t('emDash'),
            })
            : ''
        : '';

    return (
        <div className="cx-comp">
            <div className="cx-comp__head">
                <strong>{t('apply.title')}{ruleName ? ` — ${ruleName}` : ''}</strong>
                <p>{t('apply.lead')}</p>
            </div>
            <div className="cx-comp__row">
                <label>
                    {t('apply.fromDate')}
                    <input
                        type="date"
                        value={fromDate}
                        disabled={busy}
                        onChange={(e) => onFromDate(e.target.value)}
                    />
                </label>
                <button type="button" className="cx-comp__apply" onClick={runPreview} disabled={busy}>
                    {busy && !preview ? <Loader2 size={14} className="cx-spin" /> : null}
                    {busy && !preview ? t('apply.reviewing') : t('apply.review')}
                </button>
            </div>
            <p className="cx-comp__empty">{t('apply.fromDateHint')}</p>
            <CommissionApplyWorkerPicker
                ruleId={ruleId}
                workshopId={workshopId}
                t={t}
                selected={selectedWorkers}
                disabled={busy}
                onChange={onWorkers}
            />
            {error ? <p className="cx-comp__err">{error}</p> : null}
            {result ? (
                <div className="cx-comp__preview" aria-live="polite">
                    <p className="cx-comp__ok">
                        {t('apply.done', {
                            updated: result.updatedRowCount,
                            adjustments: result.adjustmentRowCount,
                            journals: result.journalCount,
                        })}
                    </p>
                    {result.createdRowCount ? (
                        <p className="cx-comp__ok">{t('apply.doneCreated', { created: result.createdRowCount })}</p>
                    ) : null}
                    {result.entryNumbers.length ? (
                        <ul>
                            {result.entryNumbers.map((entry) => (
                                <li key={entry}><bdi>{t('apply.journalLine', { entry })}</bdi></li>
                            ))}
                        </ul>
                    ) : null}
                </div>
            ) : null}

            {preview ? (
                <div className="cx-comp__preview">
                    <p className="cx-comp__preview-title">
                        {t('apply.review')}
                        {coverageLabel ? ` — ${coverageLabel}` : ''}
                    </p>
                    {meta ? <p className="cx-comp__empty">{meta}</p> : null}
                    {locked ? <p className="cx-comp__lock">{lockMessage}</p> : null}
                    {workers.length === 0 ? <p className="cx-comp__empty">{t('apply.empty')}</p> : null}
                    <div className="cx-comp__history">
                        <table>
                            <thead>
                                <tr>
                                    <th>{t('apply.th.name')}</th>
                                    <th>{t('apply.th.role')}</th>
                                    <th>{t('apply.th.branch')}</th>
                                    <th>{t('apply.th.old')}</th>
                                    <th>{t('apply.th.new')}</th>
                                    <th>{t('apply.th.diff')}</th>
                                    <th>{t('apply.th.lines')}</th>
                                    <th>{t('apply.th.paid')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {workers.map((worker) => (
                                    <tr key={worker.key}>
                                        <td>{worker.name || t('emDash')}</td>
                                        <td>{commissionRoleLabel(worker.role, t) || t('emDash')}</td>
                                        <td>{worker.branch || t('emDash')}</td>
                                        <td><bdi>{displayMoneyString(worker.oldTotal, t)}</bdi></td>
                                        <td><bdi>{displayMoneyString(worker.newTotal, t)}</bdi></td>
                                        <td className={`cx-comp__diff is-${differenceTone(worker.difference)}`}>
                                            <bdi>{displayMoneyString(worker.difference, t)}</bdi>
                                        </td>
                                        <td>{worker.lineCount}</td>
                                        <td>{worker.paidRowCount}</td>
                                    </tr>
                                ))}
                                <tr className="cx-comp__total">
                                    <td colSpan={3}>{t('apply.total')}</td>
                                    <td><bdi>{displayMoneyString(totals.oldTotal, t)}</bdi></td>
                                    <td><bdi>{displayMoneyString(totals.newTotal, t)}</bdi></td>
                                    <td className={`cx-comp__diff is-${differenceTone(totals.difference)}`}>
                                        <bdi>{displayMoneyString(totals.difference, t)}</bdi>
                                    </td>
                                    <td />
                                    <td />
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div className="cx-comp__actions">
                        <button
                            type="button"
                            onClick={() => {
                                setPreview(null);
                                setPending(null);
                            }}
                            disabled={busy}
                        >
                            {t('apply.cancel')}
                        </button>
                        {canApply ? (
                            <button
                                type="button"
                                className="cx-comp__apply"
                                onClick={runApply}
                                disabled={busy || locked || !previewMatches}
                            >
                                {busy ? <Loader2 size={14} className="cx-spin" /> : null}
                                {busy ? t('apply.applying') : t('apply.confirm')}
                            </button>
                        ) : (
                            <p className="cx-comp__empty">{t('apply.noEdit')}</p>
                        )}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
