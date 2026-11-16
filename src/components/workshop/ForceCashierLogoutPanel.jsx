import React, { useEffect, useState } from 'react';
import { Lock, LogOut, X } from 'lucide-react';
import { forceClosePosSession } from '../../services/workshopStaffApi';

const CATEGORIES = [
    { key: 'cash', labelKey: 'force.cat.cash' },
    { key: 'bank', labelKey: 'force.cat.bank' },
    { key: 'corporate', labelKey: 'force.cat.corporate' },
    { key: 'tamara', labelKey: 'force.cat.tamara' },
    { key: 'tabby', labelKey: 'force.cat.tabby' },
    { key: 'others', labelKey: 'force.cat.others' },
];

const toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

/** Empty or invalid input → 0 (same as POS store closing). */
const parsePhysical = (value) => {
    if (value === '' || value == null) return 0;
    const n = parseFloat(String(value).trim());
    return Number.isFinite(n) ? Math.max(0, n) : 0;
};

function ReconResultTable({ reconciliation, grossSystemSales, systemTotalSales, salesReturnsTotal, totalDifference, t }) {
    const rows = [
        { labelKey: 'force.cat.cash', key: 'physicalCash' },
        { labelKey: 'force.cat.bank', key: 'bankCardSlips' },
        { labelKey: 'force.cat.corporate', key: 'corporateInvoice' },
        { labelKey: 'force.cat.tamara', key: 'tamaraCredits' },
        { labelKey: 'force.cat.tabby', key: 'tabbyCredits' },
        { labelKey: 'force.cat.others', key: 'others' },
    ];

    return (
        <div>
            <p style={{ margin: '0 0 12px', fontWeight: 700, fontSize: '0.9rem' }}>{t('force.reconTitle')}</p>
            <div style={{ overflowX: 'auto' }}>
                <table className="ws-table" style={{ margin: 0 }}>
                    <thead>
                        <tr>
                            <th>{t('force.th.category')}</th>
                            <th style={{ textAlign: 'right' }}>{t('force.th.systemGross')}</th>
                            <th style={{ textAlign: 'right' }}>{t('force.th.physical')}</th>
                            <th style={{ textAlign: 'right' }}>{t('force.th.diffNet')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(({ labelKey, key }) => {
                            const line = reconciliation?.[key] || {};
                            const diff = toNum(line.difference);
                            const diffColor = Math.abs(diff) < 0.01 ? 'var(--color-text-muted)' : diff < 0 ? '#B91C1C' : '#15803D';
                            return (
                                <tr key={key}>
                                    <td>{t(labelKey)}</td>
                                    <td style={{ textAlign: 'right' }}>{toNum(line.systemGross ?? line.system).toFixed(2)}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{toNum(line.physical).toFixed(2)}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 800, color: diffColor }}>
                                        {diff > 0 ? '+' : ''}{diff.toFixed(2)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            {toNum(salesReturnsTotal) > 0.001 && (
                <p style={{ margin: '12px 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    {t('force.salesReturnsMeta', {
                        returns: toNum(salesReturnsTotal).toFixed(2),
                        gross: toNum(grossSystemSales).toFixed(2),
                        net: toNum(systemTotalSales).toFixed(2),
                    })}
                </p>
            )}
            <div
                style={{
                    marginTop: 14,
                    padding: '12px 14px',
                    borderRadius: 10,
                    background: Math.abs(toNum(totalDifference)) < 0.01 ? '#DCFCE7' : '#FFF7ED',
                    border: `1px solid ${Math.abs(toNum(totalDifference)) < 0.01 ? '#86EFAC' : '#FDBA74'}`,
                }}
            >
                <p style={{ margin: 0, fontWeight: 800, fontSize: '0.88rem' }}>
                    {Math.abs(toNum(totalDifference)) < 0.01
                        ? t('force.balanced')
                        : t('force.totalDiff', { amount: toNum(totalDifference).toFixed(2) })}
                </p>
            </div>
        </div>
    );
}

/** Inline force-logout / store-closing panel. */
export default function ForceCashierLogoutPanel({ counter, t, onClose, onCompleted }) {
    const [step, setStep] = useState('form');
    const [closeResult, setCloseResult] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [counts, setCounts] = useState({
        cash: '',
        bank: '',
        corporate: '',
        tamara: '',
        tabby: '',
        others: '',
    });
    const [notes, setNotes] = useState('');

    const posSessionId = counter?.posSessionId;
    const cashier = counter?.cashierName || t('emdash');

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape' && !submitting && step !== 'result') onClose?.();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose, submitting, step]);

    const handleCloseShift = async () => {
        setSubmitting(true);
        setError('');
        try {
            const body = {
                physicalCash: parsePhysical(counts.cash),
                physicalBank: parsePhysical(counts.bank),
                physicalCorporate: parsePhysical(counts.corporate),
                physicalTamara: parsePhysical(counts.tamara),
                physicalTabby: parsePhysical(counts.tabby),
                physicalOthers: parsePhysical(counts.others),
                clientClosedAt: new Date().toISOString(),
            };
            if (notes.trim()) body.notes = notes.trim();

            const res = await forceClosePosSession(posSessionId, body);
            if (!res?.success) {
                throw new Error(res?.message || t('force.err.failed'));
            }
            setCloseResult(res);
            setStep('result');
        } catch (err) {
            setError(err.message || t('force.err.failed'));
            setStep('form');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div
            className="cash-bank-stat-card"
            style={{ margin: '12px 16px 16px', padding: 16 }}
            data-testid="pos-force-logout-panel"
            role="region"
            aria-label={t('force.title', { name: cashier })}
        >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
                    {step === 'result'
                        ? t('force.resultTitle', { name: cashier })
                        : t('force.title', { name: cashier })}
                </h3>
                {step !== 'result' ? (
                    <button
                        type="button"
                        className="btn-portal-outline"
                        onClick={onClose}
                        disabled={submitting}
                        aria-label={t('btn.close')}
                        style={{ height: 32, padding: '0 10px' }}
                    >
                        <X size={14} />
                    </button>
                ) : null}
            </div>

            {error ? (
                <div role="alert" style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 8, background: '#FEE2E2', color: '#B91C1C', fontSize: '0.85rem' }}>
                    {error}
                </div>
            ) : null}

            {step === 'form' || step === 'confirm' ? (
                <>
                    <p style={{ margin: '0 0 14px', fontWeight: 700, fontSize: '0.95rem' }}>{t('force.physicalCounts')}</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
                        {CATEGORIES.map((c) => (
                            <div key={c.key}>
                                <label htmlFor={`force-count-${c.key}`} style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                                    {t(c.labelKey)} (SAR)
                                </label>
                                <input
                                    id={`force-count-${c.key}`}
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={counts[c.key]}
                                    onChange={(e) => setCounts((prev) => ({ ...prev, [c.key]: e.target.value }))}
                                    placeholder="0.00"
                                    disabled={submitting || step === 'confirm'}
                                    style={{
                                        width: '100%',
                                        boxSizing: 'border-box',
                                        padding: '11px 14px',
                                        border: '1.5px solid #e5e7eb',
                                        borderRadius: 10,
                                        fontSize: '1rem',
                                        fontWeight: 700,
                                        fontFamily: 'inherit',
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                    <div>
                        <label htmlFor="force-notes" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                            {t('force.notes')}
                        </label>
                        <textarea
                            id="force-notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={2}
                            placeholder={t('force.notesPh')}
                            disabled={submitting || step === 'confirm'}
                            style={{
                                width: '100%',
                                boxSizing: 'border-box',
                                padding: '11px 14px',
                                border: '1.5px solid #e5e7eb',
                                borderRadius: 10,
                                fontSize: '0.88rem',
                                fontFamily: 'inherit',
                                resize: 'vertical',
                                minHeight: 70,
                            }}
                        />
                    </div>

                    {step === 'confirm' ? (
                        <div
                            className="gj-reverse-panel"
                            style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #e5e7eb' }}
                        >
                            <p style={{ margin: '0 0 10px', fontWeight: 700 }}>{t('force.confirmLead')}</p>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <button
                                    type="button"
                                    className="btn-submit btn-dark"
                                    onClick={handleCloseShift}
                                    disabled={submitting}
                                >
                                    <Lock size={14} style={{ marginInlineEnd: 6 }} />
                                    {submitting ? t('force.closing') : t('force.confirm')}
                                </button>
                                <button
                                    type="button"
                                    className="btn-portal-outline"
                                    onClick={() => setStep('form')}
                                    disabled={submitting}
                                >
                                    {t('force.cancel')}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14, paddingTop: 12, borderTop: '1px solid #e5e7eb' }}>
                            <button type="button" className="btn-portal-outline" onClick={onClose} disabled={submitting}>
                                {t('force.cancel')}
                            </button>
                            <button
                                type="button"
                                className="btn-submit btn-dark"
                                onClick={() => setStep('confirm')}
                                disabled={submitting}
                            >
                                <Lock size={14} style={{ marginInlineEnd: 6 }} />
                                {t('force.closeShift')}
                            </button>
                        </div>
                    )}
                </>
            ) : null}

            {step === 'result' && closeResult ? (
                <>
                    <ReconResultTable
                        reconciliation={closeResult.reconciliation}
                        grossSystemSales={closeResult.grossSystemSales}
                        systemTotalSales={closeResult.systemTotalSales}
                        salesReturnsTotal={closeResult.salesReturnsTotal}
                        totalDifference={closeResult.totalDifference}
                        t={t}
                    />
                    {closeResult.glLabel || closeResult.glStatus ? (
                        <p style={{ margin: '10px 0 0', fontSize: '0.8rem', fontWeight: 700 }}>
                            {closeResult.glLabel || closeResult.glStatus}
                            {closeResult.commissionError
                                ? ` · ${t('closing.commissionFailed', { reason: closeResult.commissionError })}`
                                : ''}
                        </p>
                    ) : null}
                    <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                        <button type="button" className="btn-submit btn-dark" onClick={onCompleted}>
                            <LogOut size={14} style={{ marginInlineEnd: 6 }} />
                            {t('force.logoutCashier')}
                        </button>
                    </div>
                </>
            ) : null}
        </div>
    );
}
