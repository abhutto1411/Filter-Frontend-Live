import React, { useCallback, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ImageIcon } from 'lucide-react';
import { awT } from '../../utils/adminWalletsI18n';

function useAwLocale() {
    const outletCtx = useOutletContext() || {};
    const locale =
        outletCtx.locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => awT(locale, key, vars), [locale]);
    return { locale, t };
}

export default function ExpenseProofThumbnail({
    proofUrl,
    hasExpenseProof = false,
    size = 40,
    emptyLabel,
}) {
    const { t } = useAwLocale();
    const [open, setOpen] = useState(false);
    const url = proofUrl?.trim?.() ? proofUrl.trim() : proofUrl;
    const dash = emptyLabel ?? t('empty.emDash');

    if (!url) {
        if (hasExpenseProof) {
            return (
                <span title={t('proof.onFile')} style={{ color: '#64748b', fontSize: 12 }}>
                    {t('proof.label')}
                </span>
            );
        }
        return <span style={{ color: '#94a3b8' }}>{dash}</span>;
    }

    return (
        <>
            <button
                type="button"
                title={t('proof.view')}
                onClick={() => setOpen(true)}
                style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: 6,
                    padding: 2,
                    background: '#fff',
                    cursor: 'pointer',
                    lineHeight: 0,
                }}
            >
                <img
                    src={url}
                    alt={t('proof.alt')}
                    style={{
                        width: size,
                        height: size,
                        objectFit: 'cover',
                        borderRadius: 4,
                        display: 'block',
                    }}
                    onError={(e) => {
                        e.currentTarget.style.display = 'none';
                    }}
                />
            </button>
            {!open ? null : (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label={t('proof.title')}
                    onClick={() => setOpen(false)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 10050,
                        background: 'rgba(15, 23, 42, 0.72)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 24,
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            background: '#fff',
                            borderRadius: 12,
                            padding: 12,
                            maxWidth: 'min(920px, 96vw)',
                            maxHeight: '92vh',
                            overflow: 'auto',
                            boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, gap: 12 }}>
                            <strong style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <ImageIcon size={16} /> {t('proof.title')}
                            </strong>
                            <button type="button" className="btn-portal-outline" onClick={() => setOpen(false)}>
                                {t('btn.close')}
                            </button>
                        </div>
                        <img
                            src={url}
                            alt={t('proof.altFull')}
                            style={{
                                maxWidth: '100%',
                                maxHeight: 'calc(92vh - 80px)',
                                objectFit: 'contain',
                                borderRadius: 8,
                                border: '1px solid #e2e8f0',
                                background: '#f8fafc',
                            }}
                        />
                    </div>
                </div>
            )}
        </>
    );
}
