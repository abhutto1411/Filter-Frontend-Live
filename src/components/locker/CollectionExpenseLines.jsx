import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Plus, Receipt, Trash2, Upload, X } from 'lucide-react';
import SearchSelect from '../SearchSelect';
import { listMyExpensePurposes } from '../../services/workshopAccountingApi';
import { purposeDisplayName } from '../../utils/expensePurposesDisplay';
import { formatCitMoneyLatn } from '../../utils/lockerCitDisplay';
import {
    MAX_STAGE_A_EXPENSE_LINES,
    newExpenseLine,
    sanitizeMoneyInput,
    stageAExpenseLineErrors,
    stageAVatNotClaimable,
    sumExpenseGross,
} from '../../pages/locker/recordCollectionHelpers';
import {
    MAX_EXPENSE_PROOF_FILE_BYTES,
    recordCollectionPayloadWithinLimit,
} from '../../pages/locker/recordCollectionLimits';

/** Same look as the "Received amount (SAR)" input on Record collection. */
const RECORD_INPUT_STYLE = {
    width: '100%',
    height: 36,
    borderRadius: 8,
    border: '1px solid #CBD5E1',
    padding: '0 10px',
    background: '#fff',
    boxSizing: 'border-box',
};

const ERR_INPUT_STYLE = { ...RECORD_INPUT_STYLE, border: '1px solid #DC2626' };
const FIELD_GRID = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 12,
};
const HINT = { margin: '4px 0 0', fontSize: '0.75rem', color: '#64748B' };
const ERR = { margin: '4px 0 0', fontSize: '0.75rem', color: '#DC2626' };

function ReceiptPicker({ line, index, t, disabled, onPick, onClear, showError }) {
    const fileRef = useRef(null);
    const camRef = useRef(null);
    const has = Boolean(line.proofPreview || line.proofUrl);
    return (
        <div>
            <div
                role="button"
                tabIndex={disabled || has ? -1 : 0}
                aria-label={t('record.expense.receiptAttach')}
                onClick={() => !disabled && !has && fileRef.current?.click()}
                onKeyDown={(e) => {
                    if (!disabled && !has && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        fileRef.current?.click();
                    }
                }}
                style={{
                    border: `1.5px dashed ${has ? '#16a34a' : showError ? '#DC2626' : '#cbd5e1'}`,
                    background: has ? '#fff' : '#FAFBFC',
                    borderRadius: 10,
                    padding: has ? 8 : 14,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    cursor: disabled || has ? 'default' : 'pointer',
                    color: '#64748b',
                }}
            >
                <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    hidden
                    data-testid={`expense-receipt-input-${index}`}
                    onChange={(e) => onPick(e)}
                />
                <input
                    ref={camRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    hidden
                    onChange={(e) => onPick(e)}
                />
                {has ? (
                    <>
                        <img
                            src={line.proofPreview || line.proofUrl}
                            alt={t('record.expense.receiptAlt')}
                            style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6 }}
                        />
                        <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: '0.85rem', color: '#16a34a', fontWeight: 600 }}>
                                {t('record.expense.receiptAttached')}
                            </div>
                            {line.proofName ? (
                                <div
                                    style={{
                                        fontSize: '0.75rem',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    {line.proofName}
                                </div>
                            ) : null}
                        </div>
                    </>
                ) : (
                    <>
                        <Receipt size={22} />
                        <div>
                            <div style={{ fontSize: '0.85rem', color: '#334155', fontWeight: 600 }}>
                                {t('record.expense.receiptAttach')}
                            </div>
                            <div style={{ fontSize: '0.75rem' }}>{t('record.expense.receiptHint')}</div>
                        </div>
                    </>
                )}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                {has ? (
                    <>
                        <button
                            type="button"
                            className="btn-secondary"
                            disabled={disabled}
                            onClick={() => fileRef.current?.click()}
                        >
                            <Upload size={14} /> {t('record.expense.replace')}
                        </button>
                        <button type="button" className="btn-secondary" disabled={disabled} onClick={onClear}>
                            <X size={14} /> {t('record.expense.removeReceipt')}
                        </button>
                    </>
                ) : (
                    <>
                        <button
                            type="button"
                            className="btn-secondary"
                            disabled={disabled}
                            onClick={() => fileRef.current?.click()}
                        >
                            <Upload size={14} /> {t('record.expense.upload')}
                        </button>
                        <button
                            type="button"
                            className="btn-secondary"
                            disabled={disabled}
                            onClick={() => camRef.current?.click()}
                        >
                            <Camera size={14} /> {t('record.expense.camera')}
                        </button>
                    </>
                )}
            </div>
            {showError ? <p style={ERR}>{t('record.expense.receiptRequired')}</p> : null}
        </div>
    );
}

/**
 * Record collection — "Collected with expenses" lines (Stage A pickup expenses).
 * Each line is a card: purpose, description, gross, VAT, supplier VAT no., bill no., receipt.
 */
export default function CollectionExpenseLines({
    t,
    locale = 'en',
    lines,
    setLines,
    disabled = false,
    onError,
    idPrefix = 'rc-exp',
}) {
    const [purposes, setPurposes] = useState([]);
    const [purposesLoading, setPurposesLoading] = useState(true);
    const [purposesError, setPurposesError] = useState(false);
    const [touched, setTouched] = useState({});
    const [purposesReload, setPurposesReload] = useState(0);

    useEffect(() => {
        let cancelled = false;
        setPurposesLoading(true);
        setPurposesError(false);
        (async () => {
            try {
                const res = await listMyExpensePurposes({});
                const rows = Array.isArray(res) ? res : res?.items || [];
                if (!cancelled) setPurposes(rows);
            } catch {
                if (!cancelled) {
                    setPurposes([]);
                    setPurposesError(true);
                }
            } finally {
                if (!cancelled) setPurposesLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [purposesReload]);

    const purposesEmpty = !purposesLoading && !purposesError && purposes.length === 0;

    const purposeOptions = useMemo(
        () =>
            purposes.map((row) => ({
                value: String(row.id),
                label: purposeDisplayName(row, locale),
                searchText: `${row.name_en || row.nameEn || ''} ${row.name_ar || row.nameAr || ''}`,
                raw: row,
            })),
        [purposes, locale],
    );

    const list = Array.isArray(lines) ? lines : [];
    const total = sumExpenseGross(list);

    const patch = (key, p) =>
        setLines((prev) => prev.map((ln) => (ln.key === key ? { ...ln, ...p } : ln)));
    const touch = (key, field) =>
        setTouched((prev) => ({ ...prev, [`${key}:${field}`]: true }));
    const isTouched = (key, field) => Boolean(touched[`${key}:${field}`]);

    const remove = (key) =>
        setLines((prev) => (prev.length <= 1 ? prev : prev.filter((x) => x.key !== key)));
    const add = () =>
        setLines((prev) =>
            prev.length >= MAX_STAGE_A_EXPENSE_LINES ? prev : [...prev, newExpenseLine()],
        );

    const pickReceipt = (key, e) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        touch(key, 'proof');
        if (!f) return;
        if (!/^image\//.test(f.type) || f.size > MAX_EXPENSE_PROOF_FILE_BYTES) {
            onError?.(t('record.errImageTooLarge'));
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result;
            const nextLines = list.map((ln) =>
                ln.key === key
                    ? { ...ln, proofUrl: dataUrl, proofPreview: dataUrl, proofName: f.name }
                    : ln,
            );
            if (!recordCollectionPayloadWithinLimit({ expenses: nextLines })) {
                onError?.(t('record.errPayloadTooLarge'));
                return;
            }
            patch(key, { proofUrl: dataUrl, proofPreview: dataUrl, proofName: f.name });
            onError?.('');
        };
        reader.readAsDataURL(f);
    };

    return (
        <div style={{ marginTop: 14 }} data-testid="collection-expense-lines">
            {purposesError || purposesEmpty ? (
                <p style={HINT} data-testid="expense-purpose-hint">
                    {t(
                        purposesError
                            ? 'record.expense.purposeUnavailable'
                            : 'record.expense.purposeEmpty',
                    )}{' '}
                    <button
                        type="button"
                        className="btn-link"
                        onClick={() => setPurposesReload((n) => n + 1)}
                        disabled={disabled}
                    >
                        {t('record.expense.purposeRetry')}
                    </button>
                </p>
            ) : null}
            {list.map((ln, idx) => {
                const n = idx + 1;
                const errs = stageAExpenseLineErrors(ln, locale);
                const fid = (f) => `${idPrefix}-${f}-${idx}`;
                const showGrossErr = errs.gross && (isTouched(ln.key, 'gross') || ln.gross !== '');
                const showVatErr = errs.vat && ln.vat !== '';
                const showVatNoErr = errs.vatNumber && String(ln.supplierVatNumber || '').trim() !== '';
                return (
                    <div
                        key={ln.key}
                        data-testid={`expense-line-${idx}`}
                        style={{
                            border: '1px solid #E2E8F0',
                            borderRadius: 12,
                            padding: 16,
                            marginBottom: 12,
                            background: '#fff',
                            boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginBottom: 12,
                                gap: 8,
                            }}
                        >
                            <strong style={{ color: '#1f2937' }}>
                                {t('record.expense.lineTitle', { n })}
                            </strong>
                            <button
                                type="button"
                                className="btn-secondary"
                                aria-label={t('record.expense.removeAria', { n })}
                                title={t('record.expense.remove')}
                                disabled={disabled || list.length <= 1}
                                onClick={() => remove(ln.key)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#DC2626' }}
                            >
                                <Trash2 size={14} /> {t('record.expense.remove')}
                            </button>
                        </div>

                        <div style={FIELD_GRID}>
                            <div className="ws-field" style={{ gridColumn: '1 / -1' }}>
                                <label htmlFor={fid('purpose')}>{t('record.expense.purpose')}</label>
                                <SearchSelect
                                    id={fid('purpose')}
                                    options={purposeOptions}
                                    value={ln.purposeId || ''}
                                    onChange={(v, opt) =>
                                        patch(ln.key, {
                                            purposeId: v ? String(v) : '',
                                            purposeLabel: opt?.raw
                                                ? purposeDisplayName(opt.raw, 'en')
                                                : '',
                                        })
                                    }
                                    ariaLabel={t('record.expense.purpose')}
                                    placeholder={t('record.expense.purposePh')}
                                    emptyHint={
                                        purposesEmpty
                                            ? t('record.expense.purposeEmpty')
                                            : t('common.noMatches')
                                    }
                                    disabled={disabled || purposesLoading || purposesError}
                                    loading={purposesLoading}
                                    clearable
                                />
                            </div>

                            <div className="ws-field" style={{ gridColumn: '1 / -1' }}>
                                <label htmlFor={fid('desc')}>{t('record.expense.description')}</label>
                                <input
                                    id={fid('desc')}
                                    type="text"
                                    value={ln.description}
                                    maxLength={200}
                                    disabled={disabled}
                                    placeholder={t('record.expense.descriptionPh')}
                                    onChange={(e) => patch(ln.key, { description: e.target.value })}
                                    style={RECORD_INPUT_STYLE}
                                />
                            </div>

                            <div className="ws-field">
                                <label htmlFor={fid('gross')}>{t('record.expense.grossLabel')}</label>
                                <input
                                    id={fid('gross')}
                                    type="text"
                                    inputMode="decimal"
                                    autoComplete="off"
                                    dir="ltr"
                                    value={ln.gross}
                                    disabled={disabled}
                                    placeholder="0.00"
                                    onChange={(e) => patch(ln.key, { gross: sanitizeMoneyInput(e.target.value) })}
                                    onBlur={() => touch(ln.key, 'gross')}
                                    aria-invalid={showGrossErr ? 'true' : undefined}
                                    style={showGrossErr ? ERR_INPUT_STYLE : RECORD_INPUT_STYLE}
                                />
                                {showGrossErr ? <p style={ERR}>{t(errs.gross)}</p> : null}
                            </div>

                            <div className="ws-field">
                                <label htmlFor={fid('vat')}>{t('record.expense.vatLabel')}</label>
                                <input
                                    id={fid('vat')}
                                    type="text"
                                    inputMode="decimal"
                                    autoComplete="off"
                                    dir="ltr"
                                    value={ln.vat}
                                    disabled={disabled}
                                    placeholder="0.00"
                                    onChange={(e) => patch(ln.key, { vat: sanitizeMoneyInput(e.target.value) })}
                                    aria-invalid={showVatErr ? 'true' : undefined}
                                    style={showVatErr ? ERR_INPUT_STYLE : RECORD_INPUT_STYLE}
                                />
                                {showVatErr ? <p style={ERR}>{t(errs.vat)}</p> : null}
                            </div>

                            <div className="ws-field">
                                <label htmlFor={fid('vatno')}>{t('record.expense.supplierVat')}</label>
                                <input
                                    id={fid('vatno')}
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="off"
                                    dir="ltr"
                                    maxLength={20}
                                    value={ln.supplierVatNumber}
                                    disabled={disabled}
                                    placeholder="3XXXXXXXXXXXXX3"
                                    onChange={(e) => patch(ln.key, { supplierVatNumber: e.target.value })}
                                    aria-invalid={showVatNoErr ? 'true' : undefined}
                                    style={showVatNoErr ? ERR_INPUT_STYLE : RECORD_INPUT_STYLE}
                                />
                                {showVatNoErr ? (
                                    <p style={ERR}>{errs.vatNumber}</p>
                                ) : stageAVatNotClaimable(ln) ? (
                                    <p style={{ ...HINT, color: '#B45309' }}>
                                        {t('record.expense.vatNotClaimable')}
                                    </p>
                                ) : (
                                    <p style={HINT}>{t('record.expense.supplierVatHint')}</p>
                                )}
                            </div>

                            <div className="ws-field">
                                <label htmlFor={fid('bill')}>{t('record.expense.billNo')}</label>
                                <input
                                    id={fid('bill')}
                                    type="text"
                                    autoComplete="off"
                                    maxLength={60}
                                    value={ln.billNo}
                                    disabled={disabled}
                                    onChange={(e) => patch(ln.key, { billNo: e.target.value })}
                                    style={RECORD_INPUT_STYLE}
                                />
                            </div>

                            <div className="ws-field" style={{ gridColumn: '1 / -1' }}>
                                <label>{t('record.expense.receiptLabel')}</label>
                                <ReceiptPicker
                                    line={ln}
                                    index={idx}
                                    t={t}
                                    disabled={disabled}
                                    onPick={(e) => pickReceipt(ln.key, e)}
                                    onClear={() => {
                                        touch(ln.key, 'proof');
                                        patch(ln.key, { proofUrl: '', proofPreview: null, proofName: '' });
                                    }}
                                    showError={Boolean(errs.proof) && isTouched(ln.key, 'proof')}
                                />
                            </div>
                        </div>
                    </div>
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