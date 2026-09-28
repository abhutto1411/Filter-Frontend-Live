import React, { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
    applyCompensationRevision,
    listCompensationRevisions,
    previewCompensationRevision,
} from '../../services/workshopStaffApi';
import {
    applyTechnicianCompensation,
    listTechnicianCompensationRevisions,
    previewTechnicianCompensation,
} from '../../services/superAdminApi';
import './CompensationRevisionPanel.css';

const COPY = {
    en: {
        title: 'Compensation revision',
        lead: 'Set the new salary and commission above, choose Effective from, then Apply. Unpaid accrued commissions from that date update in one step — including jobs that had 0% (no ledger row yet). Paid slips stay frozen. Chart of accounts 6000 / 2200 adjust with a single journal.',
        effectiveFrom: 'Effective from',
        apply: 'Apply compensation',
        applying: 'Applying…',
        preview: 'Review impact',
        cancel: 'Cancel',
        confirm: 'Confirm apply',
        history: 'Revision history',
        empty: 'No revisions yet. Apply whenever a rate should change.',
        rates: 'Rates to apply',
        unpaid: 'Unpaid lines to revise',
        created: 'New lines to create',
        paidSkip: 'Paid lines skipped',
        ruleSkip: 'Rule-based lines skipped',
        oldMix: 'Current accrued total',
        newMix: 'Revised accrued total',
        delta: 'COA adjustment',
        accounts: 'Accounts',
        journal: 'Journal',
        none: 'No journal (delta is 0)',
        err: 'Could not apply compensation.',
        previewErr: 'Could not preview this change.',
        done: 'Applied. Salary tab and the technician app will use these figures.',
    },
    ar: {
        title: 'مراجعة التعويض',
        lead: 'حدد الراتب والعمولة الجديدة أعلاه وتاريخ السريان ثم اضغط تطبيق. العمولات المستحقة غير المدفوعة من ذلك التاريخ تُحدَّث دفعة واحدة — بما في ذلك الوظائف التي كانت بنسبة 0٪. القسائم المدفوعة تبقى كما هي. الحسابات 6000 / 2200 تُعدَّل بقيد واحد.',
        effectiveFrom: 'يسري من',
        apply: 'تطبيق التعويض',
        applying: 'جارٍ التطبيق…',
        preview: 'مراجعة الأثر',
        cancel: 'إلغاء',
        confirm: 'تأكيد التطبيق',
        history: 'سجل المراجعات',
        empty: 'لا توجد مراجعات بعد. استخدم التطبيق عند تغيير النسبة أو الراتب.',
        rates: 'النسب المُطبَّقة',
        unpaid: 'بنود غير مدفوعة ستُراجع',
        created: 'بنود جديدة ستُنشأ',
        paidSkip: 'بنود مدفوعة تم تجاوزها',
        ruleSkip: 'بنود بقواعد عمولة تم تجاوزها',
        oldMix: 'إجمالي المستحق الحالي',
        newMix: 'إجمالي المستحق بعد المراجعة',
        delta: 'تسوية دليل الحسابات',
        accounts: 'الحسابات',
        journal: 'القيد',
        none: 'لا قيد (الفرق صفر)',
        err: 'تعذر تطبيق التعويض.',
        previewErr: 'تعذر معاينة هذا التغيير.',
        done: 'تم التطبيق. تبويب الراتب وتطبيق الفني سيستخدمان هذه الأرقام.',
    },
};

function unwrap(res) {
    if (!res || typeof res !== 'object') return res;
    return res.data && typeof res.data === 'object' && !Array.isArray(res.data) && res.revisions == null
        ? { ...res, ...res.data }
        : res;
}

function money(n) {
    const v = Number(n) || 0;
    return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toFiniteNumber(value, fallback = 0) {
    if (value === '' || value == null || value === undefined) return fallback;
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

export default function CompensationRevisionPanel({
    locale = 'en',
    api = 'workshop',
    recordId,
    recordType = 'employee',
    workshopId,
    basicSalary,
    commissionPercent,
    onApplied,
}) {
    const t = COPY[locale] || COPY.en;
    const [effectiveFrom, setEffectiveFrom] = useState(() => new Date().toISOString().slice(0, 10));
    const [revisions, setRevisions] = useState([]);
    const [currentRates, setCurrentRates] = useState({ basicSalary: 0, commissionPercent: 0 });
    const [preview, setPreview] = useState(null);
    const [pendingBody, setPendingBody] = useState(null);
    const [busy, setBusy] = useState(false);
    const [loadingList, setLoadingList] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    const loadHistory = useCallback(async () => {
        if (!recordId) return;
        setLoadingList(true);
        try {
            const res =
                api === 'admin'
                    ? unwrap(await listTechnicianCompensationRevisions(recordId))
                    : unwrap(
                          await listCompensationRevisions({
                              recordId,
                              recordType,
                              workshopId,
                          }),
                      );
            setRevisions(Array.isArray(res?.revisions) ? res.revisions : []);
            if (res?.current) {
                setCurrentRates({
                    basicSalary: Number(res.current.basicSalary) || 0,
                    commissionPercent: Number(res.current.commissionPercent) || 0,
                });
            }
        } catch {
            setRevisions([]);
        } finally {
            setLoadingList(false);
        }
    }, [api, recordId, recordType, workshopId]);

    useEffect(() => {
        loadHistory();
    }, [loadHistory]);

    const buildBody = useCallback(() => {
        const salary =
            basicSalary === '' || basicSalary == null || basicSalary === undefined
                ? currentRates.basicSalary
                : toFiniteNumber(basicSalary, currentRates.basicSalary);
        const pct =
            commissionPercent === '' || commissionPercent == null || commissionPercent === undefined
                ? currentRates.commissionPercent
                : toFiniteNumber(commissionPercent, currentRates.commissionPercent);
        return {
            basicSalary: salary,
            basic_salary: salary,
            commissionPercent: pct,
            commission_percent: pct,
            effectiveFrom,
            recordType,
        };
    }, [basicSalary, commissionPercent, currentRates, effectiveFrom, recordType]);

    const runPreview = async () => {
        setError('');
        setNotice('');
        const body = buildBody();
        setBusy(true);
        try {
            const res =
                api === 'admin'
                    ? unwrap(await previewTechnicianCompensation(recordId, body))
                    : unwrap(
                          await previewCompensationRevision({
                              recordId,
                              recordType,
                              workshopId,
                              body,
                          }),
                      );
            setPendingBody(body);
            setPreview(res);
        } catch (e) {
            setError(e?.message || t.previewErr);
            setPreview(null);
            setPendingBody(null);
        } finally {
            setBusy(false);
        }
    };

    const runApply = async () => {
        setError('');
        // Always re-read salary/% from the live form fields so Confirm cannot
        // apply a stale 0% snapshot while the input shows 5.
        const live = buildBody();
        const payload = {
            ...live,
            effectiveFrom: pendingBody?.effectiveFrom || live.effectiveFrom,
        };
        setBusy(true);
        try {
            const res =
                api === 'admin'
                    ? unwrap(await applyTechnicianCompensation(recordId, payload))
                    : unwrap(
                          await applyCompensationRevision({
                              recordId,
                              recordType,
                              workshopId,
                              body: payload,
                          }),
                      );
            setPreview(null);
            setPendingBody(null);
            setNotice(t.done);
            await loadHistory();
            onApplied?.(res);
        } catch (e) {
            setError(e?.message || t.err);
        } finally {
            setBusy(false);
        }
    };

    if (!recordId) return null;

    const previewPct =
        preview?.newCommissionPercent ?? pendingBody?.commissionPercent ?? toFiniteNumber(commissionPercent, currentRates.commissionPercent);
    const previewOldPct = preview?.oldCommissionPercent ?? currentRates.commissionPercent;
    const previewSal =
        preview?.newBasicSalary ?? pendingBody?.basicSalary ?? toFiniteNumber(basicSalary, currentRates.basicSalary);
    const previewOldSal = preview?.oldBasicSalary ?? currentRates.basicSalary;

    return (
        <div className="cx-comp">
            <div className="cx-comp__head">
                <strong>{t.title}</strong>
                <p>{t.lead}</p>
            </div>
            <div className="cx-comp__row">
                <label>
                    {t.effectiveFrom}
                    <input
                        type="date"
                        value={effectiveFrom}
                        onChange={(e) => setEffectiveFrom(e.target.value)}
                    />
                </label>
                <button type="button" className="cx-comp__apply" onClick={runPreview} disabled={busy}>
                    {busy && !preview ? <Loader2 size={14} className="cx-spin" /> : null}
                    {t.apply}
                </button>
            </div>
            {error && <p className="cx-comp__err">{error}</p>}
            {notice && <p className="cx-comp__ok">{notice}</p>}

            {preview && (
                <div className="cx-comp__preview">
                    <p className="cx-comp__preview-title">{t.preview}</p>
                    <ul>
                        <li>
                            {t.rates}:{' '}
                            <b>
                                {money(previewOldSal)} → {money(previewSal)} SAR · {previewOldPct}% →{' '}
                                {previewPct}%
                            </b>
                        </li>
                        <li>
                            {t.unpaid}: <b>{preview.unpaidLines ?? 0}</b>
                            {preview.linesCreated != null ? (
                                <>
                                    {' '}
                                    ({t.created}: <b>{preview.linesCreated}</b>)
                                </>
                            ) : null}
                        </li>
                        <li>
                            {t.paidSkip}: <b>{preview.skippedPaidCount ?? 0}</b>
                        </li>
                        <li>
                            {t.ruleSkip}: <b>{preview.skippedRuleCount ?? 0}</b>
                        </li>
                        <li>
                            {t.oldMix}: <b>{money(preview.oldCommissionTotal)} SAR</b>
                        </li>
                        <li>
                            {t.newMix}: <b>{money(preview.newCommissionTotal)} SAR</b>
                        </li>
                        <li>
                            {t.delta}: <b>{money(preview.deltaSar)} SAR</b>
                        </li>
                        <li>
                            {t.accounts}: {preview.accounts?.expense} · {preview.accounts?.payable}
                        </li>
                    </ul>
                    <div className="cx-comp__actions">
                        <button type="button" onClick={() => { setPreview(null); setPendingBody(null); }} disabled={busy}>
                            {t.cancel}
                        </button>
                        <button type="button" className="cx-comp__apply" onClick={runApply} disabled={busy}>
                            {busy ? <Loader2 size={14} className="cx-spin" /> : null}
                            {busy ? t.applying : t.confirm}
                        </button>
                    </div>
                </div>
            )}

            <div className="cx-comp__history">
                <p className="cx-comp__preview-title">
                    {t.history}
                    {loadingList ? <Loader2 size={13} className="cx-spin" /> : null}
                </p>
                {revisions.length === 0 && !loadingList && <p className="cx-comp__empty">{t.empty}</p>}
                {revisions.length > 0 && (
                    <table>
                        <thead>
                            <tr>
                                <th>{t.effectiveFrom}</th>
                                <th>SAR</th>
                                <th>%</th>
                                <th>{t.unpaid}</th>
                                <th>{t.delta}</th>
                                <th>{t.journal}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {revisions.map((r) => (
                                <tr key={r.id}>
                                    <td>{r.effectiveFrom}</td>
                                    <td>
                                        {money(r.oldBasicSalary)} → {money(r.newBasicSalary)}
                                    </td>
                                    <td>
                                        {r.oldCommissionPercent} → {r.newCommissionPercent}
                                    </td>
                                    <td>{r.lineCount}</td>
                                    <td>{money(r.deltaSar)}</td>
                                    <td>{r.journalEntryNumber || t.none}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
