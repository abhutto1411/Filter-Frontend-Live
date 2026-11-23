import React, { useRef, useState } from 'react';
import { Camera, Receipt, Trash2, Upload, X } from 'lucide-react';
import ExpenseAccountCombobox from './ExpenseAccountCombobox';
import useCollectionExpenseMeta from './useCollectionExpenseMeta';
import {
    EXPENSE_VAT_MODES,
    expenseLineAccounting,
    expenseLineVatState,
    expenseVatPatch,
} from '../../utils/collectionExpenseVat';
import { compressExpenseProofFile } from '../../utils/expenseProofImage';
import { MAX_EXPENSE_PROOF_FILE_BYTES } from '../../pages/locker/recordCollectionLimits';
import { sanitizeMoneyInput } from '../../pages/locker/recordCollectionHelpers';

const INPUT = {
    width: '100%',
    height: 36,
    borderRadius: 8,
    border: '1px solid #CBD5E1',
    padding: '0 10px',
    background: '#fff',
    boxSizing: 'border-box',
};
const ERR_INPUT = { ...INPUT, border: '1px solid #DC2626' };
/** Gross + VAT side by side; branch gets its own full-width row (long Arabic names). */
const ROW2 = {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 12,
};
const ERR = { margin: '4px 0 0', fontSize: '0.75rem', color: '#DC2626' };
const READONLY_INPUT = { ...INPUT, background: '#F1F5F9', color: '#64748B' };
const LABEL = {
    display: 'block',
    fontSize: '0.6875rem',
    fontWeight: 600,
    color: 'var(--color-text-muted, #64748b)',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    marginBottom: 6,
};

/** Halalas → "1,234.56" (Latin digits; '—' when not a number). */
function fmtH(h) {
    if (!Number.isFinite(h)) return '—';
    return (h / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtRate(r) {
    const n = Number(r);
    return Number.isFinite(n) ? String(Number(n.toFixed(2))) : '15';
}

async function proofFileToDataUrl(file) {
    if (!file) return null;
    if (String(file.type || '') === 'application/pdf') {
        if (file.size > MAX_EXPENSE_PROOF_FILE_BYTES) {
            const err = new Error('too large');
            err.code = 'PROOF_TOO_LARGE';
            throw err;
        }
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('read failed'));
            reader.readAsDataURL(file);
        });
    }
    return compressExpenseProofFile(file);
}

function ReceiptBlock({ line, index, t, disabled, onPick, onClear }) {
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
                    border: `1.5px dashed ${has ? '#16a34a' : '#cbd5e1'}`,
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
                    accept="image/*,application/pdf"
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
                        {String(line.proofUrl || '').startsWith('data:image') ||
                        line.proofPreview ? (
                            <img
                                src={line.proofPreview || line.proofUrl}
                                alt={t('record.expense.receiptAlt')}
                                style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6 }}
                            />
                        ) : (
                            <Receipt size={28} />
                        )}
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
                            <div style={{ fontSize: '0.75rem' }}>{t('record.expense.receiptOptionalHint')}</div>
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
        </div>
    );
}

/** Shared expense line card (Stage A record collection + Stage B officer receive). */
export default function CollectionExpenseLineCard({
    line,
    index,
    lineNo,
    t,
    locale = 'en',
    branches = [],
    disabled = false,
    errors = {},
    touched = {},
    onPatch,
    onRemove,
    canRemove = true,
    onProofError,
    idPrefix = 'exp-line',
    defaultBranchId = '',
}) {
    const [proofBusy, setProofBusy] = useState(false);
    const { vatPercent, vatInputAccount } = useCollectionExpenseMeta();
    const fid = (f) => `${idPrefix}-${f}-${index}`;
    const vatState = expenseLineVatState(line);
    const acct = expenseLineAccounting(line);
    const patchVat = (change) => onPatch?.(expenseVatPatch(line, change, vatPercent));
    const showGross = errors.gross && (touched.gross || line.gross !== '');
    const showVat = errors.vat && line.vat !== '';
    const showVatNo = Boolean(errors.vatNumber) && String(line.supplierVatNumber || '').trim() !== '';
    const showAcct = errors.expenseAccountId && (touched.expenseAccountId || line.expenseAccountId);

    const branchOpts = (branches || []).map((b) => ({
        id: String(b.id),
        label: b.name || b.label || String(b.id),
    }));

    const pickReceipt = async (e) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (!f) return;
        setProofBusy(true);
        try {
            const dataUrl = await proofFileToDataUrl(f);
            onPatch?.({
                proofUrl: dataUrl,
                proofPreview: String(dataUrl).startsWith('data:image') ? dataUrl : null,
                proofName: f.name,
            });
            onProofError?.('');
        } catch {
            onProofError?.(t('record.errImageTooLarge'));
        } finally {
            setProofBusy(false);
        }
    };

    return (
        <div
            data-testid={`expense-line-card-${index}`}
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
                    {t('record.expense.lineTitle', { n: lineNo ?? index + 1 })}
                </strong>
                <button
                    type="button"
                    className="btn-secondary"
                    disabled={disabled || !canRemove || proofBusy}
                    onClick={onRemove}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#DC2626' }}
                >
                    <Trash2 size={14} /> {t('record.expense.remove')}
                </button>
            </div>

            <div className="ws-field" style={{ marginBottom: 12 }}>
                <label htmlFor={fid('account')}>{t('record.expense.account')}</label>
                <ExpenseAccountCombobox
                    id={fid('account')}
                    value={line.expenseAccountId || ''}
                    onChange={(id, opt) =>
                        onPatch?.({
                            expenseAccountId: id || '',
                            expenseAccountCode: opt?.raw?.code || '',
                            expenseAccountName: opt?.raw?.name || '',
                        })
                    }
                    locale={locale}
                    branchId={line.branchId || defaultBranchId || ''}
                    disabled={disabled || proofBusy}
                    placeholder={t('record.expense.accountPh')}
                    aria-label={t('record.expense.account')}
                    systemLabel={t('record.expense.systemBadge')}
                    otherBranchesLabel={t('record.expense.otherBranches')}
                    emptyHint={t('record.expense.accountEmpty')}
                />
                {showAcct ? <p style={ERR}>{t(errors.expenseAccountId)}</p> : null}
            </div>

            <div className="ws-field" style={{ marginBottom: 8 }}>
                <span id={fid('mode-label')} style={LABEL}>
                    {t('record.expense.amountType')}
                </span>
                <div
                    role="radiogroup"
                    aria-labelledby={fid('mode-label')}
                    className="cit-exp-vat-mode"
                    data-testid={`${idPrefix}-vat-mode-${index}`}
                >
                    {EXPENSE_VAT_MODES.map((m) => {
                        const on = vatState.mode === m;
                        return (
                            <button
                                key={m}
                                type="button"
                                role="radio"
                                aria-checked={on}
                                disabled={disabled || proofBusy}
                                className={on ? 'is-on' : ''}
                                data-testid={`${idPrefix}-vat-mode-${m}-${index}`}
                                onClick={() => !on && patchVat({ amountMode: m })}
                            >
                                {t(`record.expense.mode.${m}`)}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div style={ROW2} className="cit-exp-line-metrics">
                <div className="ws-field">
                    <label htmlFor={fid('gross')}>{t('record.expense.grossLabel')}</label>
                    <input
                        id={fid('gross')}
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        dir="ltr"
                        value={vatState.amount}
                        disabled={disabled || proofBusy}
                        placeholder="0.00"
                        onChange={(e) => patchVat({ amount: sanitizeMoneyInput(e.target.value) })}
                        aria-invalid={showGross ? 'true' : undefined}
                        aria-describedby={fid('vat-summary')}
                        style={showGross ? ERR_INPUT : INPUT}
                    />
                    {showGross ? <p style={ERR}>{t(errors.gross)}</p> : null}
                </div>
                <div className="ws-field">
                    <label htmlFor={fid('vat')}>
                        {t('record.expense.vatLabel', { rate: fmtRate(vatPercent) })}
                    </label>
                    <input
                        id={fid('vat')}
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        dir="ltr"
                        value={vatState.mode === 'none' ? '0.00' : (line.vat ?? '')}
                        disabled={disabled || proofBusy || vatState.mode === 'none'}
                        placeholder="0.00"
                        title={t('record.expense.vatEditHint')}
                        onChange={(e) => patchVat({ vat: sanitizeMoneyInput(e.target.value) })}
                        aria-invalid={showVat ? 'true' : undefined}
                        style={showVat ? ERR_INPUT : vatState.mode === 'none' ? READONLY_INPUT : INPUT}
                    />
                    {showVat ? <p style={ERR}>{t(errors.vat)}</p> : null}
                </div>
            </div>

            <div
                id={fid('vat-summary')}
                className="cit-exp-vat-summary"
                data-testid={`${idPrefix}-vat-summary-${index}`}
                dir="ltr"
            >
                <span>
                    {t('record.expense.net')} <b>{fmtH(acct.netH)}</b>
                </span>
                <span aria-hidden="true">+</span>
                <span>
                    {t('record.expense.vatShort')} <b>{fmtH(acct.vatH)}</b>
                </span>
                <span aria-hidden="true">=</span>
                <span>
                    {t('record.expense.lineTotal')} <b>{fmtH(acct.grossH)}</b>
                </span>
            </div>

            {vatState.mode !== 'none' ? (
                <div style={{ ...ROW2, marginTop: 12 }} className="cit-exp-line-metrics">
                    <div className="ws-field">
                        <label htmlFor={fid('vatno')}>{t('record.expense.vatNumber')}</label>
                        <input
                            id={fid('vatno')}
                            type="text"
                            inputMode="numeric"
                            autoComplete="off"
                            dir="ltr"
                            maxLength={24}
                            value={line.supplierVatNumber ?? ''}
                            disabled={disabled || proofBusy}
                            placeholder={t('record.expense.vatNumberPh')}
                            onChange={(e) => onPatch?.({ supplierVatNumber: e.target.value })}
                            aria-invalid={showVatNo ? 'true' : undefined}
                            style={showVatNo ? ERR_INPUT : INPUT}
                        />
                        {showVatNo ? <p style={ERR}>{errors.vatNumber}</p> : null}
                    </div>
                    <div className="ws-field">
                        <label htmlFor={fid('billno')}>{t('record.expense.billNo')}</label>
                        <input
                            id={fid('billno')}
                            type="text"
                            autoComplete="off"
                            dir="ltr"
                            maxLength={60}
                            value={line.billNo ?? ''}
                            disabled={disabled || proofBusy}
                            onChange={(e) => onPatch?.({ billNo: e.target.value })}
                            style={INPUT}
                        />
                    </div>
                </div>
            ) : null}

            {acct.vatH > 0 ? (
                <p
                    role="status"
                    data-testid={`${idPrefix}-vat-status-${index}`}
                    className={acct.claimable ? 'cit-exp-vat-note is-ok' : 'cit-exp-vat-note is-warn'}
                >
                    {acct.claimable
                        ? t('record.expense.vatClaimable', {
                              vat: fmtH(acct.vatH),
                              account: vatInputAccount
                                  ? `${vatInputAccount.code} ${vatInputAccount.name}`
                                  : '1310',
                              net: fmtH(acct.netH),
                          })
                        : t('record.expense.vatNotClaimableLine', { gross: fmtH(acct.grossH) })}
                </p>
            ) : null}

            <div className="ws-field" style={{ marginTop: 12 }}>
                <label htmlFor={fid('branch')}>{t('record.expense.branch')}</label>
                <select
                    id={fid('branch')}
                    value={line.branchId || ''}
                    disabled={disabled || proofBusy}
                    onChange={(e) => onPatch?.({ branchId: e.target.value })}
                    style={INPUT}
                >
                    {!line.branchId ? (
                        <option value="">{t('record.expense.branchDefault')}</option>
                    ) : null}
                    {branchOpts.map((b) => (
                        <option key={b.id} value={b.id}>
                            {b.label}
                        </option>
                    ))}
                </select>
            </div>

            <div className="ws-field" style={{ marginTop: 12 }}>
                <label htmlFor={fid('note')}>{t('record.expense.note')}</label>
                <input
                    id={fid('note')}
                    type="text"
                    value={line.note ?? line.description ?? ''}
                    disabled={disabled || proofBusy}
                    maxLength={200}
                    onChange={(e) =>
                        onPatch?.(
                            line.description != null
                                ? { description: e.target.value }
                                : { note: e.target.value },
                        )
                    }
                    style={INPUT}
                />
            </div>

            <div className="ws-field" style={{ marginTop: 12 }}>
                <label>{t('record.expense.receiptLabel')}</label>
                <ReceiptBlock
                    line={line}
                    index={index}
                    t={t}
                    disabled={disabled || proofBusy}
                    onPick={pickReceipt}
                    onClear={() =>
                        onPatch?.({ proofUrl: '', proofPreview: null, proofName: '' })
                    }
                />
            </div>

            <style>{`
                .exp-acct-combobox .pi-search-box {
                    min-height: 36px;
                    background: #fff;
                }
                .cit-exp-vat-mode {
                    display: inline-flex;
                    border: 1px solid #CBD5E1;
                    border-radius: 8px;
                    overflow: hidden;
                    background: #fff;
                    max-width: 100%;
                }
                .cit-exp-vat-mode button {
                    border: 0;
                    background: transparent;
                    padding: 7px 14px;
                    font-size: 0.8125rem;
                    font-weight: 600;
                    color: #475569;
                    cursor: pointer;
                    white-space: nowrap;
                }
                .cit-exp-vat-mode button + button {
                    border-inline-start: 1px solid #CBD5E1;
                }
                .cit-exp-vat-mode button.is-on {
                    background: #0F172A;
                    color: #fff;
                }
                .cit-exp-vat-mode button:disabled {
                    cursor: default;
                    opacity: 0.6;
                }
                .cit-exp-vat-summary {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px 10px;
                    align-items: center;
                    margin-top: 8px;
                    padding: 8px 12px;
                    border-radius: 8px;
                    background: #F8FAFC;
                    border: 1px solid #E2E8F0;
                    font-size: 0.8125rem;
                    color: #475569;
                }
                .cit-exp-vat-summary b {
                    color: #0F172A;
                    font-variant-numeric: tabular-nums;
                }
                .cit-exp-vat-note {
                    margin: 8px 0 0;
                    padding: 8px 12px;
                    border-radius: 8px;
                    font-size: 0.78rem;
                    line-height: 1.45;
                }
                .cit-exp-vat-note.is-ok {
                    background: #F0FDF4;
                    border: 1px solid #BBF7D0;
                    color: #166534;
                }
                .cit-exp-vat-note.is-warn {
                    background: #FFFBEB;
                    border: 1px solid #FDE68A;
                    color: #92400E;
                }
                .ws-field .exp-acct-combobox .pi-search-box input {
                    border: 0;
                    background: transparent;
                    padding: 6px 0;
                    border-radius: 0;
                    box-shadow: none;
                    width: auto;
                }
                @media (max-width: 520px) {
                    .cit-exp-line-metrics {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>
        </div>
    );
}