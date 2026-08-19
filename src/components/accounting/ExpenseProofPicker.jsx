import React, { useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { compressExpenseProofFile } from '../../utils/expenseProofImage';

export const EXPENSE_PROOF_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif';

export function readExpenseProofFile(file, { onReady, onError, onBusyChange } = {}) {
    if (!file) return;
    onBusyChange?.(true);
    compressExpenseProofFile(file)
        .then((dataUrl) => onReady?.(dataUrl))
        .catch((err) => onError?.(err?.message || 'Could not process image.'))
        .finally(() => onBusyChange?.(false));
}

export default function ExpenseProofPicker({
    preview,
    onChange,
    label = 'Expense proof *',
    id = 'expense-proof',
    disabled = false,
}) {
    const inputRef = useRef(null);
    const [processing, setProcessing] = useState(false);

    const handlePick = (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        readExpenseProofFile(file, {
            onReady: (dataUrl) => onChange?.(dataUrl),
            onError: (msg) => window.alert(msg),
            onBusyChange: setProcessing,
        });
    };

    const isDisabled = disabled || processing;

    return (
        <div className="form-group form-group-full">
            <label className="form-label" htmlFor={id}>{label}</label>
            <input
                id={id}
                ref={inputRef}
                type="file"
                accept={EXPENSE_PROOF_ACCEPT}
                capture="environment"
                style={{ display: 'none' }}
                disabled={isDisabled}
                onChange={handlePick}
            />
            <div
                role="button"
                tabIndex={isDisabled ? -1 : 0}
                onClick={() => !isDisabled && !preview && inputRef.current?.click()}
                onKeyDown={(e) => {
                    if (!isDisabled && !preview && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        inputRef.current?.click();
                    }
                }}
                style={{
                    border: `1.5px dashed ${preview ? '#16a34a' : '#cbd5e1'}`,
                    borderRadius: 10,
                    padding: preview ? 8 : 16,
                    background: preview ? '#fff' : '#FAFBFC',
                    cursor: isDisabled ? 'wait' : preview ? 'default' : 'pointer',
                    minHeight: preview ? 120 : 88,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                }}
            >
                {processing ? (
                    <div style={{ textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>
                        <Loader2 size={22} className="spin" style={{ marginBottom: 6 }} />
                        <div>Optimizing photo…</div>
                    </div>
                ) : preview ? (
                    <>
                        <img
                            src={preview}
                            alt="Expense proof preview"
                            style={{
                                maxWidth: '100%',
                                maxHeight: 160,
                                objectFit: 'contain',
                                borderRadius: 6,
                            }}
                        />
                        {!disabled ? (
                            <button
                                type="button"
                                aria-label="Remove proof"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onChange?.(null);
                                }}
                                style={{
                                    position: 'absolute',
                                    top: 8,
                                    right: 8,
                                    border: 'none',
                                    background: 'rgba(15,23,42,0.75)',
                                    color: '#fff',
                                    borderRadius: 999,
                                    width: 28,
                                    height: 28,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                }}
                            >
                                <X size={14} />
                            </button>
                        ) : null}
                    </>
                ) : (
                    <div style={{ textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>
                        <ImagePlus size={22} style={{ marginBottom: 6, opacity: 0.7 }} />
                        <div>Tap to upload receipt or proof photo</div>
                        <div style={{ fontSize: '0.75rem', marginTop: 4 }}>
                            Any phone photo — auto-optimized up to 5 MB
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
