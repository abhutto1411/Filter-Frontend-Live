import React, { useCallback, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Camera, ImagePlus, Loader2, Upload, X } from 'lucide-react';
import { compressExpenseProofFile } from '../../utils/expenseProofImage';
import { awT } from '../../utils/adminWalletsI18n';

export const EXPENSE_PROOF_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif';

export function readExpenseProofFile(file, { onReady, onError, onBusyChange } = {}) {
    if (!file) return;
    onBusyChange?.(true);
    compressExpenseProofFile(file)
        .then((dataUrl) => onReady?.(dataUrl))
        .catch((err) => onError?.(err?.message || 'Could not process image.'))
        .finally(() => onBusyChange?.(false));
}

function useProofCopy(tProp) {
    const outletCtx = useOutletContext() || {};
    const locale =
        outletCtx.locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const fallback = useCallback((key, vars) => awT(locale, key, vars), [locale]);
    return tProp || fallback;
}

const sourceBtnStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid #CBD5E1',
    background: '#fff',
    color: '#0F172A',
    fontSize: '0.8125rem',
    fontWeight: 700,
    cursor: 'pointer',
};

export default function ExpenseProofPicker({
    preview,
    onChange,
    label = 'Expense proof *',
    id = 'expense-proof',
    disabled = false,
    t: tProp,
}) {
    const t = useProofCopy(tProp);
    const galleryRef = useRef(null);
    const cameraRef = useRef(null);
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
    const openGallery = () => !isDisabled && galleryRef.current?.click();
    const openCamera = () => !isDisabled && cameraRef.current?.click();

    return (
        <div className="form-group form-group-full">
            <label className="form-label" htmlFor={`${id}-gallery`}>{label}</label>
            <input
                id={`${id}-gallery`}
                ref={galleryRef}
                type="file"
                accept={EXPENSE_PROOF_ACCEPT}
                style={{ display: 'none' }}
                disabled={isDisabled}
                onChange={handlePick}
            />
            <input
                id={`${id}-camera`}
                ref={cameraRef}
                type="file"
                accept={EXPENSE_PROOF_ACCEPT}
                capture="environment"
                style={{ display: 'none' }}
                disabled={isDisabled}
                onChange={handlePick}
            />
            <div
                style={{
                    border: `1.5px dashed ${preview ? '#16a34a' : '#cbd5e1'}`,
                    borderRadius: 10,
                    padding: preview ? 8 : 16,
                    background: preview ? '#fff' : '#FAFBFC',
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
                        <div>{t('proof.optimizing')}</div>
                    </div>
                ) : preview ? (
                    <>
                        <img
                            src={preview}
                            alt={t('proof.alt')}
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
                                aria-label={t('proof.remove')}
                                onClick={() => onChange?.(null)}
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
                        <div>{t('proof.pickTitle')}</div>
                        <div style={{ fontSize: '0.75rem', marginTop: 4 }}>
                            {t('proof.pickHint')}
                        </div>
                    </div>
                )}
            </div>
            {!preview && !processing ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                    <button
                        type="button"
                        disabled={isDisabled}
                        onClick={openCamera}
                        style={sourceBtnStyle}
                    >
                        <Camera size={14} /> {t('proof.camera')}
                    </button>
                    <button
                        type="button"
                        disabled={isDisabled}
                        onClick={openGallery}
                        style={sourceBtnStyle}
                    >
                        <Upload size={14} /> {t('proof.gallery')}
                    </button>
                </div>
            ) : null}
        </div>
    );
}
