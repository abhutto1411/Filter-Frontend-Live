import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import CollectionExpenseLineCard from './CollectionExpenseLineCard';
import useCollectionExpenseMeta from './useCollectionExpenseMeta';
import { formatCitMoneyLatn } from '../../utils/lockerCitDisplay';
import {
    MAX_STAGE_A_EXPENSE_LINES,
    newExpenseLine,
    stageAExpenseLineErrors,
    sumExpenseGross,
} from '../../pages/locker/recordCollectionHelpers';
import { recordCollectionPayloadWithinLimit } from '../../pages/locker/recordCollectionLimits';

/**
 * Record collection — "Collected with expenses" lines (Stage A).
 */
export default function CollectionExpenseLines({
    t,
    locale = 'en',
    branches = [],
    lines,
    setLines,
    disabled = false,
    onError,
    idPrefix = 'rc-exp',
    defaultBranchId = '',
}) {
    const [touched, setTouched] = useState({});
    const { vatPercent } = useCollectionExpenseMeta();
    const list = Array.isArray(lines) ? lines : [];
    const total = sumExpenseGross(list);

    const patch = (key, p) =>
        setLines((prev) => prev.map((ln) => (ln.key === key ? { ...ln, ...p } : ln)));
    const touch = (key, field) =>
        setTouched((prev) => ({ ...prev, [`${key}:${field}`]: true }));

    const remove = (key) =>
        setLines((prev) => (prev.length <= 1 ? prev : prev.filter((x) => x.key !== key)));
    const add = () =>
        setLines((prev) =>
            prev.length >= MAX_STAGE_A_EXPENSE_LINES
                ? prev
                : [...prev, newExpenseLine({ branchId: defaultBranchId || '' })],
        );

    const onPayloadGuard = (nextProofPatch, key) => {
        const nextLines = list.map((ln) => (ln.key === key ? { ...ln, ...nextProofPatch } : ln));
        if (!recordCollectionPayloadWithinLimit({ expenses: nextLines })) {
            onError?.(t('record.errPayloadTooLarge'));
            return false;
        }
        return true;
    };

    return (
        <div style={{ marginTop: 14 }} data-testid="collection-expense-lines">
            {list.map((ln, idx) => {
                const errs = stageAExpenseLineErrors(ln, locale, vatPercent);
                const lineTouched = {
                    gross: touched[`${ln.key}:gross`],
                    expenseAccountId: touched[`${ln.key}:expenseAccountId`],
                };
                return (
                    <CollectionExpenseLineCard
                        key={ln.key}
                        line={ln}
                        index={idx}
                        lineNo={idx + 1}
                        t={t}
                        locale={locale}
                        branches={branches}
                        disabled={disabled}
                        errors={errs}
                        touched={lineTouched}
                        idPrefix={idPrefix}
                        canRemove={list.length > 1}
                        onRemove={() => remove(ln.key)}
                        onPatch={(p) => {
                            if (p.proofUrl !== undefined && !onPayloadGuard(p, ln.key)) return;
                            patch(ln.key, p);
                            if (p.gross !== undefined) touch(ln.key, 'gross');
                            if (p.expenseAccountId !== undefined) touch(ln.key, 'expenseAccountId');
                            onError?.('');
                        }}
                        onProofError={(msg) => onError?.(msg)}
                    />
                );
            })}

            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                }}
            >
                {list.length < MAX_STAGE_A_EXPENSE_LINES ? (
                    <button
                        type="button"
                        className="btn-secondary"
                        disabled={disabled}
                        onClick={add}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                        <Plus size={14} /> {t('record.expense.add')}
                    </button>
                ) : (
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748B' }}>
                        {t('record.expense.maxLines', { n: MAX_STAGE_A_EXPENSE_LINES })}
                    </p>
                )}
                <div style={{ fontSize: '0.9rem', color: '#334155' }}>
                    {t('record.expense.total')}:{' '}
                    <strong dir="ltr" data-testid="expense-lines-total">
                        {formatCitMoneyLatn(total)}
                    </strong>
                </div>
            </div>
        </div>
    );
}