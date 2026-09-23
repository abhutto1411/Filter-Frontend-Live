import { useEffect, useMemo, useState } from 'react';
import { Loader, Trash2 } from 'lucide-react';
import AdminModalAsScreen from './AdminModalAsScreen';

function r2(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
}

function fmt(n) {
    return Number(n ?? 0).toLocaleString('en-SA', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function buildDraftLines(ledger) {
    const invoices = (ledger?.lines || []).filter((l) => l.type === 'Invoice');
    return invoices.map((l, idx) => ({
        key: String(l.invoiceId || l.id || `${l.invoiceNo}-${idx}`),
        invoiceId: String(l.invoiceId || ''),
        invoiceNo: l.invoiceNo || '—',
        date: l.date || '',
        vehicleNo: l.vehicleNo || '—',
        productsServices: l.productsServicesEn || l.productsServices || '—',
        invoiceExclVat: r2(l.invoiceExclVat),
        vat15: r2(l.vat15),
        salesDiscounts: r2(l.salesDiscounts),
        invoiceInclusiveVat: r2(l.invoiceInclusiveVat),
        original: {
            invoiceExclVat: r2(l.invoiceExclVat),
            vat15: r2(l.vat15),
            salesDiscounts: r2(l.salesDiscounts),
            invoiceInclusiveVat: r2(l.invoiceInclusiveVat),
        },
    }));
}

/**
 * Multi-step Generate Bill:
 *  1) review snapshot (+ due date)
 *  2) include previous opening balance? yes/no
 *  3) ask edit?
 *  4) optional edit invoice amounts / remove lines (bill-only)
 *  5) confirm generate
 */
export default function CorporateGenerateBillModal({
    open,
    onClose,
    t,
    companyName,
    dateFrom,
    dateTo,
    dueDate,
    onDueDateChange,
    ledger,
    generating,
    onGenerate,
}) {
    const [step, setStep] = useState('review'); // review | askOpening | askEdit | edit | confirm
    const [draftLines, setDraftLines] = useState([]);
    const [originalInvoiceIds, setOriginalInvoiceIds] = useState([]);
    const [selectedKeys, setSelectedKeys] = useState(() => new Set());
    const [includeOpeningBalance, setIncludeOpeningBalance] = useState(true);
    const [stepError, setStepError] = useState('');

    const priorOpening = r2(ledger?.summary?.openingBalance);

    // Init only when modal opens — do not reset step if ledger reference changes mid-flow.
    useEffect(() => {
        if (!open) {
            setStep('review');
            setDraftLines([]);
            setOriginalInvoiceIds([]);
            setSelectedKeys(new Set());
            setIncludeOpeningBalance(true);
            setStepError('');
            return;
        }
        const lines = buildDraftLines(ledger);
        setDraftLines(lines);
        setOriginalInvoiceIds(lines.map((l) => l.invoiceId).filter(Boolean));
        setSelectedKeys(new Set());
        setIncludeOpeningBalance(true);
        setStep('review');
        setStepError('');
        if (!(dueDate || '').trim() && dateTo) {
            onDueDateChange(dateTo);
        }
        // intentionally omit ledger/dueDate from deps so Continue / Edit steps are not reset
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const totals = useMemo(() => {
        const excl = r2(draftLines.reduce((s, l) => s + Number(l.invoiceExclVat || 0), 0));
        const vat = r2(draftLines.reduce((s, l) => s + Number(l.vat15 || 0), 0));
        const disc = r2(draftLines.reduce((s, l) => s + Number(l.salesDiscounts || 0), 0));
        const incl = r2(draftLines.reduce((s, l) => s + Number(l.invoiceInclusiveVat || 0), 0));
        return { excl, vat, disc, incl };
    }, [draftLines]);

    const dirtyOverrides = useMemo(() => {
        return draftLines
            .filter((l) => {
                if (!l.invoiceId) return false;
                const o = l.original || {};
                return (
                    r2(l.invoiceExclVat) !== r2(o.invoiceExclVat) ||
                    r2(l.vat15) !== r2(o.vat15) ||
                    r2(l.salesDiscounts) !== r2(o.salesDiscounts) ||
                    r2(l.invoiceInclusiveVat) !== r2(o.invoiceInclusiveVat)
                );
            })
            .map((l) => ({
                invoiceId: l.invoiceId,
                invoiceExclVat: r2(l.invoiceExclVat),
                vat15: r2(l.vat15),
                salesDiscounts: r2(l.salesDiscounts),
                invoiceInclusiveVat: r2(l.invoiceInclusiveVat),
            }));
    }, [draftLines]);

    const excludeInvoiceIds = useMemo(() => {
        const kept = new Set(draftLines.map((l) => l.invoiceId).filter(Boolean));
        return originalInvoiceIds.filter((id) => !kept.has(id));
    }, [originalInvoiceIds, draftLines]);

    const hasBillEdits = dirtyOverrides.length > 0 || excludeInvoiceIds.length > 0;
    const allSelected =
        draftLines.length > 0 && draftLines.every((l) => selectedKeys.has(l.key));

    if (!open) return null;

    const updateLine = (key, patch) => {
        setDraftLines((prev) =>
            prev.map((l) => {
                if (l.key !== key) return l;
                const next = { ...l, ...patch };
                const excl = Number(next.invoiceExclVat || 0);
                const disc = Number(next.salesDiscounts || 0);
                const taxable = Math.max(0, excl - disc);

                // Excl or discount change → VAT on post-discount base; Incl = base + VAT.
                if (
                    (patch.invoiceExclVat != null || patch.salesDiscounts != null) &&
                    patch.vat15 == null &&
                    patch.invoiceInclusiveVat == null
                ) {
                    next.vat15 = r2(taxable * 0.15);
                    next.invoiceInclusiveVat = r2(taxable + Number(next.vat15));
                    return next;
                }
                // Manual VAT edit → Incl = post-discount excl + VAT.
                if (patch.vat15 != null && patch.invoiceInclusiveVat == null) {
                    next.invoiceInclusiveVat = r2(taxable + Number(next.vat15 || 0));
                    return next;
                }
                // Manual Incl only — leave excl/vat as typed.
                return next;
            }),
        );
    };

    const toggleSelect = (key) => {
        setSelectedKeys((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (allSelected) {
            setSelectedKeys(new Set());
            return;
        }
        setSelectedKeys(new Set(draftLines.map((l) => l.key)));
    };

    const removeSelectedLines = () => {
        if (!selectedKeys.size) return;
        if (selectedKeys.size >= draftLines.length) {
            setStepError(t('err.keepOneInvoice'));
            return;
        }
        setStepError('');
        setDraftLines((prev) => prev.filter((l) => !selectedKeys.has(l.key)));
        setSelectedKeys(new Set());
    };

    const ensureDueDate = () => {
        if ((dueDate || '').trim()) return true;
        if (dateTo) {
            onDueDateChange(dateTo);
            return true;
        }
        setStepError(t('err.selectDueDate'));
        return false;
    };

    const goContinueFromReview = () => {
        setStepError('');
        if (!(dueDate || '').trim()) {
            if (dateTo) onDueDateChange(dateTo);
            else {
                setStepError(t('err.selectDueDate'));
                return;
            }
        }
        setStep('askOpening');
    };

    const goContinueFromEdit = () => {
        setStepError('');
        if (!draftLines.length) {
            setStepError(t('err.keepOneInvoice'));
            return;
        }
        setStep('confirm');
    };

    const fireGenerate = () => {
        setStepError('');
        if (!ensureDueDate()) return;
        if (!draftLines.length) {
            setStepError(t('err.keepOneInvoice'));
            return;
        }
        onGenerate({
            lineOverrides: dirtyOverrides,
            excludeInvoiceIds,
            includeOpeningBalance,
        });
    };

    const title =
        step === 'askOpening'
            ? t('modal.askOpeningTitle')
            : step === 'askEdit'
              ? t('modal.askEditTitle')
              : step === 'edit'
                ? t('modal.editTitle')
                : step === 'confirm'
                  ? t('modal.confirmTitle')
                  : t('modal.title');

    const footer = (() => {
        if (step === 'review') {
            return (
                <>
                    <button type="button" className="btn-secondary" onClick={onClose} disabled={generating}>
                        {t('btn.cancel')}
                    </button>
                    <button
                        type="button"
                        className="btn-submit"
                        disabled={generating}
                        onClick={goContinueFromReview}
                    >
                        {t('btn.continueReview')}
                    </button>
                </>
            );
        }
        if (step === 'askOpening') {
            return (
                <>
                    <button type="button" className="btn-secondary" onClick={() => setStep('review')} disabled={generating}>
                        {t('btn.wizardBack')}
                    </button>
                    <button
                        type="button"
                        className="btn-portal-outline"
                        disabled={generating}
                        onClick={() => {
                            setIncludeOpeningBalance(false);
                            setStep('askEdit');
                        }}
                    >
                        {t('btn.noOpening')}
                    </button>
                    <button
                        type="button"
                        className="btn-submit"
                        disabled={generating}
                        onClick={() => {
                            setIncludeOpeningBalance(true);
                            setStep('askEdit');
                        }}
                    >
                        {t('btn.yesOpening')}
                    </button>
                </>
            );
        }
        if (step === 'askEdit') {
            return (
                <>
                    <button type="button" className="btn-secondary" onClick={() => setStep('askOpening')} disabled={generating}>
                        {t('btn.wizardBack')}
                    </button>
                    <button
                        type="button"
                        className="btn-portal-outline"
                        disabled={generating}
                        onClick={() => setStep('confirm')}
                    >
                        {t('btn.noKeepAsIs')}
                    </button>
                    <button type="button" className="btn-submit" disabled={generating} onClick={() => setStep('edit')}>
                        {t('btn.yesEdit')}
                    </button>
                </>
            );
        }
        if (step === 'edit') {
            return (
                <>
                    <button type="button" className="btn-secondary" onClick={() => setStep('askEdit')} disabled={generating}>
                        {t('btn.wizardBack')}
                    </button>
                    <button
                        type="button"
                        className="btn-submit"
                        disabled={generating || !draftLines.length}
                        onClick={goContinueFromEdit}
                    >
                        {t('btn.continueToGenerate')}
                    </button>
                </>
            );
        }
        return (
            <>
                <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setStep(hasBillEdits ? 'edit' : 'askEdit')}
                    disabled={generating}
                >
                    {t('btn.wizardBack')}
                </button>
                <button
                    type="button"
                    className="btn-submit"
                    disabled={generating || !draftLines.length}
                    onClick={fireGenerate}
                >
                    {generating ? (
                        <>
                            <Loader size={14} className="spin" /> {t('btn.generating')}
                        </>
                    ) : (
                        t('btn.confirmGenerate')
                    )}
                </button>
            </>
        );
    })();

    const colSpan = step === 'edit' ? 8 : 7;

    return (
        <AdminModalAsScreen title={title} onClose={onClose} footer={footer} size="large" backDisabled={generating}>
            <p style={{ marginTop: 0, color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                {t('modal.period')} <strong>{dateFrom} — {dateTo}</strong>
                <br />
                {t('modal.company')} <strong>{companyName}</strong>
            </p>

            {(step === 'review' || step === 'edit' || step === 'confirm') && (
                <div className="form-group">
                    <label className="form-label">{t('modal.dueDate')}</label>
                    <input
                        type="date"
                        className="form-input-field"
                        value={dueDate || ''}
                        onChange={(e) => {
                            setStepError('');
                            onDueDateChange(e.target.value);
                        }}
                        required
                        disabled={generating}
                    />
                    {!dueDate?.trim() ? (
                        <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#b45309' }}>
                            {t('modal.dueDateHint')}
                        </p>
                    ) : null}
                </div>
            )}

            {stepError ? (
                <p style={{ margin: '0 0 10px', padding: '8px 10px', borderRadius: 8, background: '#fef2f2', color: '#b91c1c', fontSize: '0.85rem' }}>
                    {stepError}
                </p>
            ) : null}

            {step === 'askOpening' ? (
                <div style={{ padding: '12px 0' }}>
                    <p style={{ fontSize: '0.95rem', lineHeight: 1.5, margin: 0 }}>
                        {t('modal.askOpeningBody')}
                    </p>
                    <p style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: 12 }}>
                        {t('modal.priorOpening', {
                            amount: fmt(priorOpening),
                        })}
                    </p>
                    <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 10 }}>
                        {t('modal.askOpeningHint')}
                    </p>
                </div>
            ) : null}

            {step === 'askEdit' ? (
                <div style={{ padding: '12px 0' }}>
                    <p style={{ fontSize: '0.95rem', lineHeight: 1.5, margin: 0 }}>
                        {t('modal.askEditBody')}
                    </p>
                    <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 10 }}>
                        {t('modal.editDisclaimer')}
                    </p>
                    <p style={{ fontSize: '0.8rem', color: '#475569', marginTop: 8 }}>
                        {includeOpeningBalance
                            ? t('modal.openingIncluded')
                            : t('modal.openingExcluded')}
                    </p>
                </div>
            ) : null}

            {(step === 'review' || step === 'edit' || step === 'confirm') && (
                <>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                        <Kpi label={t('modal.kpiExcl')} value={fmt(totals.excl)} t={t} />
                        <Kpi label={t('modal.kpiVat')} value={fmt(totals.vat)} t={t} />
                        <Kpi label={t('modal.kpiDisc')} value={fmt(totals.disc)} t={t} />
                        <Kpi label={t('modal.kpiIncl')} value={fmt(totals.incl)} t={t} accent />
                    </div>

                    {step === 'edit' ? (
                        <div
                            style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 8,
                                marginBottom: 10,
                            }}
                        >
                            <p style={{ fontSize: '0.85rem', color: '#1d4ed8', background: '#eff6ff', padding: '8px 10px', borderRadius: 8, margin: 0, flex: '1 1 220px' }}>
                                {t('modal.editModeBanner')}
                            </p>
                            <button
                                type="button"
                                className="btn-portal-outline"
                                disabled={generating || selectedKeys.size === 0}
                                onClick={removeSelectedLines}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36 }}
                            >
                                <Trash2 size={14} /> {t('btn.removeSelected')}
                                {selectedKeys.size > 0 ? ` (${selectedKeys.size})` : ''}
                            </button>
                        </div>
                    ) : null}

                    {step === 'confirm' ? (
                        <p style={{ fontSize: '0.8rem', color: '#475569', marginBottom: 8 }}>
                            {includeOpeningBalance
                                ? t('modal.openingIncluded')
                                : t('modal.openingExcluded')}
                            {includeOpeningBalance
                                ? ` (${t('money.sar', { amount: fmt(priorOpening) })})`
                                : ''}
                        </p>
                    ) : null}

                    {step === 'confirm' && dirtyOverrides.length > 0 ? (
                        <p style={{ fontSize: '0.8rem', color: '#92400e', background: '#fffbeb', padding: '8px 10px', borderRadius: 8 }}>
                            {t('modal.editedNotice', { n: dirtyOverrides.length })}
                        </p>
                    ) : null}

                    {step === 'confirm' && excludeInvoiceIds.length > 0 ? (
                        <p style={{ fontSize: '0.8rem', color: '#92400e', background: '#fffbeb', padding: '8px 10px', borderRadius: 8, marginTop: dirtyOverrides.length ? 6 : 0 }}>
                            {t('modal.removedNotice', { n: excludeInvoiceIds.length })}
                        </p>
                    ) : null}

                    <div style={{ overflowX: 'auto', maxHeight: 360, border: '1px solid #e2e8f0', borderRadius: 10 }}>
                        <table className="ws-table" style={{ width: '100%', fontSize: '0.8rem' }}>
                            <thead>
                                <tr>
                                    {step === 'edit' ? (
                                        <th style={{ width: 42, textAlign: 'center' }}>
                                            <input
                                                type="checkbox"
                                                checked={allSelected}
                                                onChange={toggleSelectAll}
                                                disabled={!draftLines.length || generating}
                                                aria-label={t('btn.selectAll')}
                                            />
                                        </th>
                                    ) : null}
                                    <th>{t('th.date')}</th>
                                    <th>{t('th.invNo')}</th>
                                    <th>{t('th.vehicle')}</th>
                                    <th style={{ textAlign: 'right' }}>{t('th.exclVatShort')}</th>
                                    <th style={{ textAlign: 'right' }}>{t('th.vat15')}</th>
                                    <th style={{ textAlign: 'right' }}>{t('th.discounts')}</th>
                                    <th style={{ textAlign: 'right' }}>{t('th.inclVatShort')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {draftLines.length === 0 ? (
                                    <tr>
                                        <td colSpan={colSpan} style={{ padding: 16, textAlign: 'center', color: '#64748b' }}>
                                            {t('empty.period')}
                                        </td>
                                    </tr>
                                ) : (
                                    draftLines.map((l) => (
                                        <tr key={l.key}>
                                            {step === 'edit' ? (
                                                <td style={{ textAlign: 'center' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedKeys.has(l.key)}
                                                        onChange={() => toggleSelect(l.key)}
                                                        disabled={generating}
                                                        aria-label={t('btn.selectInvoice', { no: l.invoiceNo })}
                                                    />
                                                </td>
                                            ) : null}
                                            <td>{l.date}</td>
                                            <td style={{ fontWeight: 700 }}>{l.invoiceNo}</td>
                                            <td>{l.vehicleNo}</td>
                                            {step === 'edit' ? (
                                                <>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <NumInput
                                                            value={l.invoiceExclVat}
                                                            onChange={(v) => updateLine(l.key, { invoiceExclVat: v })}
                                                        />
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <NumInput
                                                            value={l.vat15}
                                                            onChange={(v) => updateLine(l.key, { vat15: v })}
                                                        />
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <NumInput
                                                            value={l.salesDiscounts}
                                                            onChange={(v) => updateLine(l.key, { salesDiscounts: v })}
                                                        />
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <NumInput
                                                            value={l.invoiceInclusiveVat}
                                                            onChange={(v) =>
                                                                updateLine(l.key, { invoiceInclusiveVat: v })
                                                            }
                                                        />
                                                    </td>
                                                </>
                                            ) : (
                                                <>
                                                    <td style={{ textAlign: 'right' }}>{t('money.sar', { amount: fmt(l.invoiceExclVat) })}</td>
                                                    <td style={{ textAlign: 'right' }}>{t('money.sar', { amount: fmt(l.vat15) })}</td>
                                                    <td style={{ textAlign: 'right' }}>{t('money.sar', { amount: fmt(l.salesDiscounts) })}</td>
                                                    <td style={{ textAlign: 'right', fontWeight: 700 }}>
                                                        {t('money.sar', { amount: fmt(l.invoiceInclusiveVat) })}
                                                    </td>
                                                </>
                                            )}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    {step === 'edit' ? (
                        <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 8 }}>
                            {t('modal.editDisclaimer')}
                        </p>
                    ) : null}
                </>
            )}
        </AdminModalAsScreen>
    );
}

function Kpi({ label, value, t, accent }) {
    return (
        <div
            style={{
                flex: '1 1 120px',
                padding: '8px 10px',
                borderRadius: 10,
                border: '1px solid #e2e8f0',
                background: accent ? '#fef2f2' : '#f8fafc',
            }}
        >
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{label}</div>
            <div style={{ fontWeight: 800, marginTop: 2 }}>{t('money.sar', { amount: value })}</div>
        </div>
    );
}

function NumInput({ value, onChange }) {
    return (
        <input
            type="number"
            step="0.01"
            min="0"
            value={Number.isFinite(Number(value)) ? value : 0}
            onChange={(e) => onChange(r2(e.target.value))}
            style={{
                width: 96,
                padding: '6px 8px',
                borderRadius: 6,
                border: '1px solid #93c5fd',
                background: '#fff',
                textAlign: 'right',
                fontSize: '0.8rem',
            }}
        />
    );
}
